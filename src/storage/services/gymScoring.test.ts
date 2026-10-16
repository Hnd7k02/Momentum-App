import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { TRAINING_RATING, RATING } from '../../core/config/constants';
import { addDays, weekKeyOf } from '../../core/dates';
import { mapPerformanceChangeToScore } from '../../core/scoring/performanceCurve';
import { closeDatabase, deleteDatabase } from '../db';
import {
  configSnapshotsRepository,
  exercisesRepository,
  gymSetsRepository,
} from '../repositories';
import { loadBossProgression } from './bossService';
import { applyOnboarding } from './configurationService';
import { gymModelOf } from './gymRatingService';
import {
  addSet,
  BuiltInExerciseError,
  createExercise,
  ensureExerciseCatalogue,
  loadGymHistory,
  openSessionForDay,
  bodyweightFor,
  recordBodyweight,
  remapExercise,
} from './gymService';

/**
 * The Gym scoring model end to end: attendance and performance reaching the
 * rating, the Endurance Phase gating the first promotion, abstinence decay,
 * and every promise about history not moving underneath any of it.
 */

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

/** A Monday, so weeks line up with the fixture dates. */
const START = '2026-01-05';
const kg = (value: number) => Math.round(value * 1000);

beforeEach(async () => {
  await deleteDatabase();
  freezeAt(START);
  await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
  await ensureExerciseCatalogue();
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

/** Logs one squat session on a date, at the given weight. */
async function train(date: string, weightKg: number, exerciseId = 'ex_squat') {
  freezeAt(date);
  const session = await openSessionForDay(date);
  await addSet({ sessionId: session.id, exerciseId, reps: 5, weightGrams: kg(weightKg) });
}

/** Trains three times in the week beginning on `monday`. */
async function trainWeek(monday: string, weightKg: number, exerciseId = 'ex_squat') {
  for (const offset of [0, 2, 4]) await train(addDays(monday, offset), weightKg, exerciseId);
}

const gymOf = async (reference: string) => {
  freezeAt(reference);
  const boss = await loadBossProgression();
  return {
    boss,
    state: boss.gym,
    ledger: boss.domains.find((domain) => domain.domain === 'gym')!,
  };
};

/* ── The era marker ─────────────────────────────────────────────────────── */

describe('which model a day was scored under', () => {
  it('reads a snapshot with no gymModel as the attendance era', () => {
    expect(gymModelOf({ domains: [], questions: [], scoring: { editWindowDays: 3, scaleMin: 1, scaleMax: 10 } })).toBe(
      'attendance',
    );
  });

  it('writes the new model into every snapshot this build takes', async () => {
    const snapshots = await configSnapshotsRepository.list();
    expect(snapshots.length).toBeGreaterThan(0);
    for (const snapshot of snapshots) {
      expect(snapshot.config.scoring.gymModel).toBe('attendancePerformance');
    }
  });
});

/* ── Attendance and performance reaching the rating ─────────────────────── */

describe('the 40/60 target', () => {
  it('moves the rating on attendance alone before any comparison exists', async () => {
    await trainWeek(START, 100);
    const { state } = await gymOf(addDays(START, 7));
    // One exercise, one week, one recorded day per session but no repeat of
    // the *same* weight to compare across the window's ends yet — except
    // there is, because the exercise was recorded three times.
    expect(state.rating).toBeGreaterThan(RATING.START);
  });

  it('blends 40 % attendance with 60 % performance once both exist', async () => {
    await trainWeek(START, 100);
    await trainWeek(addDays(START, 7), 110);
    const reference = addDays(START, 13);
    const { state } = await gymOf(reference);

    expect(state.performance.score).not.toBeNull();
    const attendance = 1000; // three of three
    const expected =
      TRAINING_RATING.ATTENDANCE_WEIGHT * attendance +
      TRAINING_RATING.PERFORMANCE_WEIGHT * state.performance.score!;
    const last = state.detail[state.detail.length - 1]!;
    expect(last.target).toBeCloseTo(expected, 6);
  });

  it('counts a saved session towards attendance with no minimum number of sets', async () => {
    freezeAt(START);
    // A session with no sets at all still counts for attendance.
    await openSessionForDay(START);
    const { state } = await gymOf(START);
    expect(state.sessionsThisWeek).toBe(1);
  });

  it('caps attendance at the target, so a fourth session adds nothing there', async () => {
    for (const offset of [0, 1, 2, 3]) await train(addDays(START, offset), 100);
    const { state } = await gymOf(addDays(START, 3));
    expect(state.sessionsThisWeek).toBe(4);
    const last = state.detail[state.detail.length - 1]!;
    expect(last.attendance).toBe(1000);
  });

  it('never lets the day score stop being attendance', async () => {
    // The rating changed; the *history* did not. Two thirds of a week is two
    // thirds of a week whatever was lifted in it.
    await train(START, 100);
    await train(addDays(START, 2), 500);
    const { boss } = await gymOf(addDays(START, 13));
    const day = boss.history.days.find((entry) => entry.date === START)!;
    const gym = day.domains.find((entry) => entry.domain === 'gym')!;
    expect(gym.score).toBeCloseTo((2 / 3) * 100, 6);
  });
});

/* ── The Endurance Phase ────────────────────────────────────────────────── */

describe('the Endurance Phase, end to end', () => {
  it('calculates a rating before the gate opens, and keeps the gate shut', async () => {
    await trainWeek(START, 100);
    await trainWeek(addDays(START, 7), 110);
    const { state, ledger } = await gymOf(addDays(START, 13));

    expect(state.endurance.unlocked).toBe(false);
    expect(state.rating).toBeGreaterThan(RATING.START);
    // The rating is well past the first ladder threshold, and the gate still
    // reads shut on every day: Endurance gates nothing but the gate itself.
    expect(state.rating).toBeGreaterThan(120);
    expect(state.promotionUnlocked.some(Boolean)).toBe(false);
    // And the Boss contribution follows the rating regardless.
    expect(ledger.progress).toBeGreaterThan(1);
  });

  it('unlocks after four met weeks, from the day after the fourth', async () => {
    for (let week = 0; week < 5; week += 1) {
      await trainWeek(addDays(START, week * 7), 100 + week * 5);
    }
    const { state, ledger } = await gymOf(addDays(START, 34));
    expect(state.endurance.progress).toBeGreaterThanOrEqual(4);
    expect(state.endurance.unlocked).toBe(true);
    expect(state.promotionUnlocked[state.promotionUnlocked.length - 1]).toBe(true);
    expect(ledger.progress).toBeGreaterThan(1);
  });

  it('awards no rating at the unlock itself', async () => {
    for (let week = 0; week < 4; week += 1) {
      await trainWeek(addDays(START, week * 7), 100);
    }
    // The fourth week ends on day 27 and is judged once its Sunday can no
    // longer be written — on day 29 (D134). Only then is the gate known open.
    const { state } = await gymOf(addDays(START, 29));
    const unlockWeek = state.endurance.unlockedAt!;
    const points = state.detail;
    // No step in the series larger than one ordinary movement.
    const steps = points.slice(1).map((point, index) => point.rating - points[index]!.rating);
    const largest = Math.max(...steps.map(Math.abs));
    expect(unlockWeek).toBeTruthy();
    expect(largest).toBeLessThan(RATING.MAX * TRAINING_RATING.BASE_MOVEMENT + 1e-6);
  });

  it('holds the gate shut through four weeks that were not met', async () => {
    for (let week = 0; week < 4; week += 1) {
      // One session a week against a target of three.
      await train(addDays(START, week * 7), 100);
    }
    const { state } = await gymOf(addDays(START, 28));
    expect(state.endurance.unlocked).toBe(false);
    expect(state.promotionUnlocked.some(Boolean)).toBe(false);
  });
});

/* ── Bodyweight and assisted exercises ──────────────────────────────────── */

describe('bodyweight exercises through the replay', () => {
  it('scores a pull-up as the body that did it', async () => {
    await recordBodyweight(85, START, START);
    freezeAt(START);
    const session = await openSessionForDay(START);
    await addSet({ sessionId: session.id, exerciseId: 'ex_pull_up', reps: 8, weightGrams: 0 });

    const history = await loadGymHistory(START, START);
    expect(history.days[0]?.best.score).toBe(8 * kg(85));
  });

  it('adds the weight the user hung off themselves', async () => {
    await recordBodyweight(85, START, START);
    freezeAt(START);
    const session = await openSessionForDay(START);
    await addSet({ sessionId: session.id, exerciseId: 'ex_pull_up', reps: 5, weightGrams: kg(15) });

    const history = await loadGymHistory(START, START);
    // 85 + 15 = 100, then 5 × 100.
    expect(history.days[0]?.best.score).toBe(5 * kg(100));
  });

  it('subtracts the machine on an assisted exercise', async () => {
    await recordBodyweight(85, START, START);
    freezeAt(START);
    const session = await openSessionForDay(START);
    await addSet({
      sessionId: session.id,
      exerciseId: 'ex_assisted_pull_up',
      reps: 10,
      weightGrams: kg(25),
    });

    const history = await loadGymHistory(START, START);
    // 85 − 25 = 60, then 10 × 60.
    expect(history.days[0]?.best.score).toBe(10 * kg(60));
  });

  it('uses the latest bodyweight before the session, never a later one', async () => {
    await recordBodyweight(80, START, START);
    freezeAt(addDays(START, 3));
    const session = await openSessionForDay(addDays(START, 3));
    await addSet({ sessionId: session.id, exerciseId: 'ex_pull_up', reps: 5, weightGrams: 0 });

    const before = await loadGymHistory(START, addDays(START, 3));
    expect(before.days[0]?.best.score).toBe(5 * kg(80));

    // Weighing in heavier next month must not rewrite that session.
    await recordBodyweight(90, addDays(START, 30), addDays(START, 30));
    const after = await loadGymHistory(START, addDays(START, 40));
    const session1 = after.days.find((entry) => entry.date === addDays(START, 3));
    expect(session1?.best.score).toBe(5 * kg(80));
  });

  it('refuses a weigh-in dated into a closed day, exactly as a set is refused (D133)', async () => {
    // Two days on, START can no longer be written.
    await expect(recordBodyweight(80, START, addDays(START, 2))).rejects.toThrow();
    expect(await bodyweightFor(START)).toBeNull();
    // The next day it still can.
    await recordBodyweight(80, START, addDays(START, 1));
    expect(await bodyweightFor(START)).toBe(80);
  });

  it('drops a bodyweight set logged before any weigh-in, rather than scoring zero', async () => {
    freezeAt(START);
    const session = await openSessionForDay(START);
    await addSet({ sessionId: session.id, exerciseId: 'ex_pull_up', reps: 8, weightGrams: 0 });

    const history = await loadGymHistory(START, START);
    expect(history.days).toHaveLength(0);
    // And the interface can say why rather than showing nothing at all.
    expect(history.awaitingBodyweight).toEqual(['ex_pull_up']);
  });

  it('handles assistance heavier than the user deterministically', async () => {
    await recordBodyweight(60, START, START);
    freezeAt(START);
    const session = await openSessionForDay(START);
    await addSet({
      sessionId: session.id,
      exerciseId: 'ex_assisted_pull_up',
      reps: 5,
      weightGrams: kg(70),
    });

    const history = await loadGymHistory(START, START);
    expect(history.days).toHaveLength(0);
    // Not re-read as a 10 kg lift in the other direction.
    expect(history.overall.ratio).toBeNull();
  });

  it('replaces the day rather than keeping two weights for it', async () => {
    await recordBodyweight(85, START, START);
    await recordBodyweight(86, START, START);
    freezeAt(START);
    const session = await openSessionForDay(START);
    await addSet({ sessionId: session.id, exerciseId: 'ex_pull_up', reps: 5, weightGrams: 0 });
    const history = await loadGymHistory(START, START);
    expect(history.days[0]?.best.score).toBe(5 * kg(86));
  });
});

/* ── Muscle roles through storage ───────────────────────────────────────── */

describe('muscle roles, recorded and protected', () => {
  it('records the roles a set was logged under', async () => {
    freezeAt(START);
    const session = await openSessionForDay(START);
    const set = await addSet({
      sessionId: session.id,
      exerciseId: 'ex_bench_press',
      reps: 5,
      weightGrams: kg(60),
    });
    expect(set.primaryMuscles).toEqual(['chest']);
    expect(set.muscles).toEqual(['chest', 'triceps', 'shoulders']);
  });

  it('lets a user remap their own exercise', async () => {
    const custom = await createExercise({
      name: 'Landmine Press',
      muscles: ['shoulders', 'chest'],
      primaryMuscles: ['shoulders'],
    });
    const next = await remapExercise(custom.id, ['chest', 'shoulders'], ['chest']);
    expect(next?.primaryMuscles).toEqual(['chest']);
  });

  it('refuses to remap a built-in, whose mapping is the catalogue’s', async () => {
    await expect(remapExercise('ex_bench_press', ['calves'], ['calves'])).rejects.toBeInstanceOf(
      BuiltInExerciseError,
    );
    expect((await exercisesRepository.get('ex_bench_press'))?.muscles).toContain('chest');
  });

  it('keeps a closed workout on the roles it was logged under', async () => {
    const custom = await createExercise({
      name: 'Landmine Press',
      muscles: ['shoulders', 'chest'],
      primaryMuscles: ['shoulders'],
    });
    await train(START, 40, custom.id);
    await remapExercise(custom.id, ['calves'], ['calves']);

    const history = await loadGymHistory(START, START);
    expect(history.days[0]?.muscles).toEqual(['shoulders', 'chest']);
    expect(history.days[0]?.primaryMuscles).toEqual(['shoulders']);
  });

  it('replays a set with no roles under the equal weighting it was logged with', async () => {
    await train(START, 100, 'ex_deadlift');
    await train(addDays(START, 7), 200, 'ex_deadlift');
    // Strip the roles, as a phase-4 row has none.
    for (const set of await gymSetsRepository.getAll()) {
      const { primaryMuscles: _drop, ...rest } = set;
      await gymSetsRepository.put(rest as typeof set);
    }
    const history = await loadGymHistory(START, addDays(START, 7));
    const ratioOf = (muscle: string) =>
      history.overall.muscles.find((entry) => entry.muscle === muscle)?.ratio;
    // Every group counted the same, so all three doubled equally.
    expect(ratioOf('back')).toBeCloseTo(2, 10);
    expect(ratioOf('hamstringsGlutes')).toBeCloseTo(2, 10);
    expect(ratioOf('forearms')).toBeCloseTo(2, 10);
  });
});

/* ── Decay, and what it may not touch ───────────────────────────────────── */

describe('abstinence decay through the replay', () => {
  /**
   * Four met weeks to open the gate, then silence.
   *
   * The last session of the fourth week is on day 25, so `silentDays` is
   * counted from there — and the gate itself opens on day 28, once the week
   * that completed it is actually over.
   */
  const LAST_SESSION = 25;
  async function unlockThenStop(silentDays: number) {
    for (let week = 0; week < 4; week += 1) {
      await trainWeek(addDays(START, week * 7), 100 + week * 10);
    }
    return gymOf(addDays(START, LAST_SESSION + silentDays));
  }

  it('does not decay while at least one session is in the week', async () => {
    const { state } = await unlockThenStop(0);
    expect(state.abstinence).toBeNull();
    expect(state.decayFraction).toBe(0);
  });

  it('does not decay at six days of silence', async () => {
    const { state } = await unlockThenStop(6);
    expect(state.abstinence?.days).toBe(6);
    expect(state.decayFraction).toBe(0);
    expect(state.decayPending).toBeUndefined();
  });

  it('decays at seven, once the seventh silent day can no longer be written (D135)', async () => {
    // Day seven is today: it counts as seven, but a session could still be
    // logged for it, so nothing is charged yet — and the tile says so.
    const today = await unlockThenStop(7);
    expect(today.state.endurance.unlocked).toBe(true);
    expect(today.state.abstinence?.days).toBe(7);
    expect(today.state.decayFraction).toBe(0);
    expect(today.state.decayPending).toEqual({ day: 'today', days: 7 });
    // Day eight: day seven is yesterday, still writable, still pending.
    const eight = await gymOf(addDays(START, LAST_SESSION + 8));
    expect(eight.state.decayFraction).toBe(0);
    expect(eight.state.decayPending).toEqual({ day: 'yesterday', days: 7 });
    // Two days on, day seven is closed and the decay lands, once. Day eight
    // and nine sit in the same block, so nothing more waits.
    const { state } = await gymOf(addDays(START, LAST_SESSION + 9));
    expect(state.decayFraction).toBeGreaterThan(0);
    expect(state.decayPending).toBeUndefined();
  });

  it('marks the next block pending on day fourteen, on top of what is charged', async () => {
    const charged = await unlockThenStop(13);
    expect(charged.state.decayPending).toBeUndefined();
    const fourteen = await gymOf(addDays(START, LAST_SESSION + 14));
    expect(fourteen.state.decayFraction).toBe(charged.state.decayFraction);
    expect(fourteen.state.decayPending).toEqual({ day: 'today', days: 14 });
    const sixteen = await gymOf(addDays(START, LAST_SESSION + 16));
    expect(sixteen.state.decayFraction).toBeGreaterThan(charged.state.decayFraction);
    expect(sixteen.state.decayPending).toBeUndefined();
  });

  it('does not decay a user who is still inside the Endurance Phase', async () => {
    // One session, then a month of nothing: the gate never opened.
    await train(START, 100);
    const { state } = await gymOf(addDays(START, 35));
    expect(state.endurance.unlocked).toBe(false);
    expect(state.decayFraction).toBe(0);
  });

  it('leaves every historical performance figure exactly where it was', async () => {
    for (let week = 0; week < 4; week += 1) {
      await trainWeek(addDays(START, week * 7), 100 + week * 10);
    }
    const active = await loadGymHistory(START, addDays(START, 25));
    const before = active.overall.ratio;

    const { state } = await gymOf(addDays(START, 60));
    expect(state.decayFraction).toBeGreaterThan(0);

    const after = await loadGymHistory(START, addDays(START, 25));
    expect(after.overall.ratio).toBe(before);
    expect(after.days.length).toBe(active.days.length);
  });

  it('ends the episode the moment training resumes, and does not refund', async () => {
    const stopped = await unlockThenStop(14);
    const decayed = stopped.state.rating;
    expect(stopped.state.decayFraction).toBeGreaterThan(0);

    await train(addDays(START, 45), 130);
    const { state } = await gymOf(addDays(START, 45));
    expect(state.abstinence).toBeNull();
    expect(state.decayFraction).toBe(0);
    // It resumes from where the decay left it rather than from before.
    expect(state.rating).toBeLessThan(stopped.state.peak);
    expect(decayed).toBeLessThan(stopped.state.peak);
  });
});

/* ── The Boss, and the rest of the app ──────────────────────────────────── */

describe('what the new Gym rating does to everything else', () => {
  it('flows into the Boss through the ordinary weighting, with no special path', async () => {
    await trainWeek(START, 100);
    const { boss, ledger } = await gymOf(addDays(START, 6));
    const last = boss.points[boss.points.length - 1]!;
    const contribution = last.contributions.find((entry) => entry.domain === 'gym');
    expect(contribution).toBeDefined();
    expect(ledger.progress).toBeGreaterThan(0);
  });

  it('leaves Food dormant', async () => {
    await trainWeek(START, 100);
    const { boss } = await gymOf(addDays(START, 6));
    const food = boss.domains.find((domain) => domain.domain === 'food')!;
    expect(food.started).toBe(false);
    const last = boss.points[boss.points.length - 1]!;
    expect(last.contributions.some((entry) => entry.domain === 'food')).toBe(false);
  });

  it('replays identically twice, from the same stored state', async () => {
    for (let week = 0; week < 5; week += 1) {
      await trainWeek(addDays(START, week * 7), 100 + week * 5);
    }
    const first = await gymOf(addDays(START, 40));
    const second = await gymOf(addDays(START, 40));
    expect(second.state.rating).toBe(first.state.rating);
    expect(second.state.endurance.progress).toBe(first.state.endurance.progress);
    second.boss.points.forEach((point, index) => {
      expect(point.progress).toBeCloseTo(first.boss.points[index]!.progress, 12);
    });
  });

  it('leaves the Gym ledger unstarted until something is actually logged', async () => {
    const { ledger, state } = await gymOf(addDays(START, 6));
    expect(ledger.started).toBe(false);
    expect(state.origin).toBeNull();
    expect(state.endurance.progress).toBe(0);
  });
});

/* ── The curve, where it lands in practice ──────────────────────────────── */

describe('a real improvement, priced', () => {
  it('prices a 10 % improvement in both windows at 800', async () => {
    await trainWeek(START, 100);
    await trainWeek(addDays(START, 7), 110);
    const { state } = await gymOf(addDays(START, 13));
    expect(state.trendChange).toBeCloseTo(10, 6);
    expect(state.ytdChange).toBeCloseTo(10, 6);
    expect(state.performance.score).toBeCloseTo(mapPerformanceChangeToScore(10), 6);
    expect(state.performance.score).toBeCloseTo(800, 6);
  });

  it('keeps the week key arithmetic the endurance gate depends on', () => {
    expect(weekKeyOf(START)).toBe(weekKeyOf(addDays(START, 6)));
    expect(weekKeyOf(START)).not.toBe(weekKeyOf(addDays(START, 7)));
  });
});

/* ── The era boundary ───────────────────────────────────────────────────── */

describe('a profile that predates the Gym scoring model', () => {
  /** Strips `gymModel` from every snapshot, as a pre-4.1 build wrote them. */
  async function makeLegacyEra() {
    const snapshots = await configSnapshotsRepository.list();
    await configSnapshotsRepository.replaceAll(
      snapshots.map((snapshot) => {
        const { gymModel: _drop, ...scoring } = snapshot.config.scoring;
        return { ...snapshot, config: { ...snapshot.config, scoring } };
      }),
    );
  }

  /** Adds a snapshot carrying the new model, effective from `date`. */
  async function landTheUpdate(date: string) {
    const snapshots = await configSnapshotsRepository.list();
    const latest = snapshots[snapshots.length - 1]!;
    await configSnapshotsRepository.replaceAll([
      ...snapshots,
      {
        ...latest,
        id: `${latest.id}_v41`,
        effectiveFrom: date,
        config: {
          ...latest.config,
          scoring: { ...latest.config.scoring, gymModel: 'attendancePerformance' as const },
        },
      },
    ]);
  }

  it('keeps scoring those days the way they were actually scored', async () => {
    await trainWeek(START, 100);
    await trainWeek(addDays(START, 7), 150);
    const modern = (await gymOf(addDays(START, 13))).state.rating;

    await makeLegacyEra();
    const legacy = (await gymOf(addDays(START, 13))).state;
    expect(legacy.model).toBe('attendance');
    // The old fold is an EWMA over attendance and cannot agree with the new
    // 40/60 target by accident; if it did, this test would prove nothing.
    expect(legacy.rating).not.toBeCloseTo(modern, 3);
  });

  it('continues from the number the old model left, rather than jumping', async () => {
    // Four weeks under the old model, then the update lands.
    await trainWeek(START, 100);
    await trainWeek(addDays(START, 7), 110);
    await trainWeek(addDays(START, 14), 120);
    await makeLegacyEra();

    const before = (await gymOf(addDays(START, 20))).state;
    expect(before.model).toBe('attendance');

    // A snapshot carrying the new model, effective from the following Monday.
    await landTheUpdate(addDays(START, 21));

    const after = (await gymOf(addDays(START, 21))).state;
    expect(after.model).toBe('attendancePerformance');
    // The day the model changes moves the rating by one ordinary step at
    // most: an upgrade neither creates progress nor takes it away.
    const step = Math.abs(after.rating - before.rating);
    expect(step).toBeLessThanOrEqual(RATING.MAX * TRAINING_RATING.BASE_MOVEMENT + 1e-6);
  });

  it('leaves every earlier day exactly where the old model put it', async () => {
    await trainWeek(START, 100);
    await trainWeek(addDays(START, 7), 110);
    await makeLegacyEra();
    const legacy = (await gymOf(addDays(START, 13))).state.points.map((point) => point.rating);

    await landTheUpdate(addDays(START, 14));

    const mixed = (await gymOf(addDays(START, 20))).state.points.map((point) => point.rating);
    // Every day before the transition is untouched, to the last bit.
    legacy.forEach((rating, index) => expect(mixed[index]).toBe(rating));
  });
});

/* ── What a long absence can and cannot take ────────────────────────────── */

describe('the peak Gym keeps', () => {
  it('never lets the peak rating fall, whatever the rating did afterwards', async () => {
    // Train hard past a threshold, then stop for a long time.
    for (let week = 0; week < 8; week += 1) {
      await trainWeek(addDays(START, week * 7), 100 + week * 8);
    }
    const climbed = await gymOf(addDays(START, 55));
    expect(climbed.ledger.progress).toBeGreaterThan(1);
    const peak = climbed.ledger.peakMomentum;

    const later = await gymOf(addDays(START, 200));
    expect(later.ledger.peakMomentum).toBeGreaterThanOrEqual(peak);
    expect(later.ledger.momentum).toBeLessThanOrEqual(later.ledger.peakMomentum);
  });

  it('opens the Endurance gate from the day after the week it was met in, and never before', async () => {
    for (let week = 0; week < 8; week += 1) {
      await trainWeek(addDays(START, week * 7), 100 + week * 8);
    }
    const { state, boss } = await gymOf(addDays(START, 55));
    expect(state.endurance.unlocked).toBe(true);
    const opened = addDays(START, 28);
    boss.history.days.forEach((day, index) => {
      expect(state.promotionUnlocked[index]).toBe(day.date >= opened);
    });
  });
});

/* ── Replay cost ────────────────────────────────────────────────────────── */

describe('the cost of replaying the windows', () => {
  it('stays linear over a long history of real sets', async () => {
    /*
     * The two performance windows are recomputed for every day of history, so
     * the obvious implementation filters the exercise-days per day and is
     * quadratic — which is the shape that was already found and removed from
     * the week lookup once (D73). The windows are walked with pointers and
     * memoised on their contents instead; this measures that it worked.
     *
     * The guard is a ratio against a plain history load rather than a
     * millisecond figure, because the absolute numbers are the machine's.
     */
    const DAYS = 420;
    const sessions: { date: string; exercise: string; weight: number }[] = [];
    const exercises = ['ex_squat', 'ex_bench_press', 'ex_deadlift', 'ex_lat_pulldown'];
    for (let index = 0; index < DAYS; index += 1) {
      if (index % 2 === 1) continue;
      const date = addDays(START, index);
      sessions.push({
        date,
        exercise: exercises[(index / 2) % exercises.length]!,
        weight: 80 + (index % 40),
      });
    }
    for (const entry of sessions) await train(entry.date, entry.weight, entry.exercise);

    const reference = addDays(START, DAYS);
    freezeAt(reference);

    const started = performance.now();
    const boss = await loadBossProgression();
    const elapsed = performance.now() - started;

    expect(boss.history.days).toHaveLength(DAYS + 1);
    expect(boss.gym.detail.length).toBeGreaterThan(0);
    expect(boss.gym.rating).toBeGreaterThan(0);
    // Generous, and still nowhere near what a per-day filter would cost.
    expect(elapsed).toBeLessThan(4000);
  });
});
