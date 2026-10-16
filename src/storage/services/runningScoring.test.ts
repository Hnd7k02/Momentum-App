import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { RATING, TRAINING_RATING } from '../../core/config/constants';
import { addDays } from '../../core/dates';
import { bandOf, bandRange } from '../../core/running/performance';
import { mapPerformanceChangeToScore } from '../../core/scoring/performanceCurve';
import { closeDatabase, deleteDatabase } from '../db';
import { configSnapshotsRepository, runsRepository } from '../repositories';
import { loadBossProgression } from './bossService';
import { logSession, updateSession, type SessionInput } from './checkInService';
import { applyOnboarding } from './configurationService';
import { runningModelOf } from './runningRatingService';

/**
 * Running end to end: pace evidence reaching the rating, the Endurance Phase,
 * abstinence decay, the era join, and every promise about a distance identity
 * never moving underneath a user.
 */

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

/** A Monday, so weeks line up with the fixture dates. */
const START = '2026-01-05';

beforeEach(async () => {
  await deleteDatabase();
  freezeAt(START);
  await applyOnboarding({ questions: [], runningTargetPerWeek: 2 });
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

/** Logs one run. `metres`/`minPerKm` omitted logs an attendance-only run. */
async function logRun(date: string, metres?: number, minPerKm?: number) {
  freezeAt(date);
  const input: SessionInput = {};
  if (metres !== undefined && minPerKm !== undefined) {
    input.distanceMetres = metres;
    input.durationMinutes = (metres / 1000) * minPerKm;
  }
  return logSession('running', date, input, date);
}

/** Two runs a week at the given distance and pace. */
async function runWeek(monday: string, metres: number, minPerKm: number) {
  for (const offset of [0, 3]) await logRun(addDays(monday, offset), metres, minPerKm);
}

const stateAt = async (reference: string) => {
  freezeAt(reference);
  const boss = await loadBossProgression();
  return {
    boss,
    state: boss.running,
    ledger: boss.domains.find((domain) => domain.domain === 'running')!,
  };
};

/* ── The era marker ─────────────────────────────────────────────────────── */

describe('which model a Running day was scored under', () => {
  it('reads a snapshot with no runningModel as the attendance era', () => {
    expect(
      runningModelOf({ domains: [], questions: [], scoring: { editWindowDays: 3, scaleMin: 1, scaleMax: 10 } }),
    ).toBe('attendance');
  });

  it('writes the new model into every snapshot this build takes', async () => {
    const snapshots = await configSnapshotsRepository.list();
    expect(snapshots.length).toBeGreaterThan(0);
    for (const snapshot of snapshots) {
      expect(snapshot.config.scoring.runningModel).toBe('attendancePerformance');
    }
  });
});

/* ── Logging stays light ────────────────────────────────────────────────── */

describe('logging a run', () => {
  it('saves with neither distance nor duration, and still counts for attendance', async () => {
    await logRun(START);
    const { state } = await stateAt(START);
    expect(state.sessionsThisWeek).toBe(1);
    expect(state.performance.score).toBeNull();
  });

  it('stores a measured distance in whole metres when one is given', async () => {
    await logRun(START, 5000, 5.5);
    const stored = (await runsRepository.listByDate(START))[0]!;
    expect(stored.distanceMetres).toBe(5000);
    expect(stored.durationSeconds).toBe(1650);
  });

  it('lets a distance be added afterwards, and cleared again', async () => {
    const session = await logRun(START);
    expect(session.distanceMetres).toBeNull();
    await updateSession('running', session.id, { distanceMetres: 5000, durationMinutes: 27.5 }, START);
    expect((await runsRepository.get(session.id))!.distanceMetres).toBe(5000);
    await updateSession('running', session.id, { durationMinutes: 27.5 }, START);
    expect((await runsRepository.get(session.id))!.distanceMetres).toBeNull();
  });

  it('never invents a distance for a run that has none', async () => {
    await logRun(START);
    const stored = (await runsRepository.listByDate(START))[0]!;
    expect(stored.distanceMetres).toBeNull();
    expect(stored.elevationMetres).toBeNull();
    expect(stored.steps).toBeNull();
  });
});

/* ── Performance reaching the rating ────────────────────────────────────── */

describe('pace evidence reaching the rating', () => {
  it('moves on attendance alone before a second comparable run exists', async () => {
    await runWeek(START, 5000, 5.5);
    const { state } = await stateAt(addDays(START, 6));
    expect(state.rating).toBeGreaterThan(RATING.START);
  });

  it('blends 40 % attendance with 60 % pace development once both exist', async () => {
    await runWeek(START, 5000, 5.5);
    await runWeek(addDays(START, 7), 5000, 5.0);
    const { state } = await stateAt(addDays(START, 10));

    expect(state.performance.score).not.toBeNull();
    const expected =
      TRAINING_RATING.ATTENDANCE_WEIGHT * 1000 +
      TRAINING_RATING.PERFORMANCE_WEIGHT * state.performance.score!;
    const last = state.detail[state.detail.length - 1]!;
    expect(last.target).toBeCloseTo(expected, 6);
  });

  it('prices a 10 % pace improvement in both windows at 800', async () => {
    await runWeek(START, 5000, 5.5);
    await runWeek(addDays(START, 7), 5000, 5.0);
    const { state } = await stateAt(addDays(START, 10));
    expect(state.trendChange).toBeCloseTo(10, 6);
    expect(state.ytdChange).toBeCloseTo(10, 6);
    expect(state.performance.score).toBeCloseTo(mapPerformanceChangeToScore(10), 6);
    expect(state.performance.score).toBeCloseTo(800, 6);
  });

  it('caps attendance at the weekly target', async () => {
    for (const offset of [0, 1, 2, 3]) await logRun(addDays(START, offset), 5000, 5.5);
    const { state } = await stateAt(addDays(START, 3));
    expect(state.sessionsThisWeek).toBe(4);
    expect(state.detail[state.detail.length - 1]!.attendance).toBe(1000);
  });

  it('leaves the Running day score as attendance, because that is history', async () => {
    await logRun(START, 5000, 5.5);
    const { boss } = await stateAt(addDays(START, 10));
    const day = boss.history.days.find((entry) => entry.date === START)!;
    const running = day.domains.find((entry) => entry.domain === 'running')!;
    expect(running.score).toBeCloseTo(50, 6); // one run of a target of two
  });

  it('keeps a run under 3 km out of performance but in attendance', async () => {
    await logRun(START, 2900, 5.5);
    await logRun(addDays(START, 3), 2900, 5.0);
    const { state } = await stateAt(addDays(START, 6));
    expect(state.sessionsThisWeek).toBe(2);
    expect(state.performance.score).toBeNull();
  });
});

/* ── Distance identities through storage ────────────────────────────────── */

describe('distance identities, through the real replay', () => {
  it('keeps 5 km and 20 km as separate evidence', async () => {
    await logRun(START, 5000, 5.5);
    await logRun(addDays(START, 7), 5000, 5.2);
    await logRun(addDays(START, 3), 20000, 6.4);
    await logRun(addDays(START, 10), 20000, 6.2);
    const { state } = await stateAt(addDays(START, 13));
    expect(state.ytd?.measured).toHaveLength(2);
  });

  it('gives repeated 5 km runs one identity however many there are', async () => {
    for (let week = 0; week < 4; week += 1) {
      await runWeek(addDays(START, week * 7), 5000 + (week % 2) * 40, 5.5 - week * 0.1);
    }
    const { state } = await stateAt(addDays(START, 27));
    expect(state.ytd?.measured).toHaveLength(1);
  });

  it('does not repartition history when an unrelated run is added', async () => {
    // The 4900/5000/5500 regression, through storage this time.
    await logRun(START, 5000, 5.5);
    await logRun(addDays(START, 14), 5500, 5.4);
    const before = await stateAt(addDays(START, 17));
    const beforeBands = before.state.ytd!.comparisons.map((c) => c.band).sort();

    await logRun(addDays(START, 21), 4900, 5.3);
    const after = await stateAt(addDays(START, 24));
    const afterBands = after.state.ytd!.comparisons.map((c) => c.band);
    // Every identity that existed still exists, unchanged.
    for (const band of beforeBands) expect(afterBands).toContain(band);
  });

  it('does not let one history swallow another that shares no identity', async () => {
    // The 5.4/6.4 regression: 18.5 % apart, so two identities, both counted.
    await logRun(START, 5400, 5.6);
    await logRun(addDays(START, 28), 5400, 5.2);
    await logRun(addDays(START, 7), 6400, 5.9);
    await logRun(addDays(START, 35), 6400, 5.4);
    const { state } = await stateAt(addDays(START, 38));
    expect(bandOf(5400)).not.toBe(bandOf(6400));
    expect(state.ytd?.measured).toHaveLength(2);
  });

  it('counts a route that straddles a boundary as two identities, deterministically', async () => {
    const { toExclusive } = bandRange(bandOf(5000)!);
    const lo = Math.floor(toExclusive) - 5;
    const hi = Math.ceil(toExclusive) + 5;
    await logRun(START, lo, 5.5);
    await logRun(addDays(START, 14), lo, 5.3);
    await logRun(addDays(START, 7), hi, 5.5);
    await logRun(addDays(START, 21), hi, 5.3);
    const { state } = await stateAt(addDays(START, 24));
    // Accepted split-inflation: one route, two equal-weighted identities.
    expect(state.ytd?.measured).toHaveLength(2);
  });
});

/* ── The Endurance Phase ────────────────────────────────────────────────── */

describe('the Endurance Phase for Running', () => {
  it('calculates a rating before the gate opens and keeps the gate shut', async () => {
    await runWeek(START, 5000, 5.5);
    await runWeek(addDays(START, 7), 5000, 5.2);
    const { state, ledger } = await stateAt(addDays(START, 13));
    expect(state.endurance.unlocked).toBe(false);
    expect(state.rating).toBeGreaterThan(RATING.START);
    expect(state.promotionUnlocked.some(Boolean)).toBe(false);
    expect(ledger.progress).toBeGreaterThan(0);
  });

  it('unlocks after four met weeks', async () => {
    for (let week = 0; week < 5; week += 1) {
      await runWeek(addDays(START, week * 7), 5000, 5.5 - week * 0.1);
    }
    const { state, ledger } = await stateAt(addDays(START, 35));
    expect(state.endurance.progress).toBeGreaterThanOrEqual(4);
    expect(state.endurance.unlocked).toBe(true);
    expect(state.promotionUnlocked[state.promotionUnlocked.length - 1]).toBe(true);
    expect(ledger.progress).toBeGreaterThan(1);
  });

  it('costs half a week for a missed week rather than resetting', async () => {
    await runWeek(START, 5000, 5.5);
    await runWeek(addDays(START, 7), 5000, 5.4);
    await logRun(addDays(START, 14), 5000, 5.3); // one run against a target of two
    await runWeek(addDays(START, 21), 5000, 5.2);
    // The fourth week is judged once its Sunday can no longer be written (D134).
    const { state } = await stateAt(addDays(START, 29));
    expect(state.endurance.progress).toBeCloseTo(2.5, 6);
    expect(state.endurance.unlocked).toBe(false);
  });

  it('uses Running\'s own weekly target, not Gym\'s', async () => {
    // Two runs a week meets a target of two; the requirement is still 4 weeks.
    for (let week = 0; week < 4; week += 1) await runWeek(addDays(START, week * 7), 5000, 5.5);
    const { state } = await stateAt(addDays(START, 29));
    expect(state.weeklyTarget).toBe(2);
    expect(state.endurance.progress).toBeCloseTo(4, 6);
  });
});

/* ── Abstinence decay ───────────────────────────────────────────────────── */

describe('abstinence decay for Running', () => {
  async function unlockThenStop(silentDays: number) {
    for (let week = 0; week < 4; week += 1) {
      await runWeek(addDays(START, week * 7), 5000, 5.5 - week * 0.1);
    }
    return stateAt(addDays(START, 24 + silentDays));
  }

  it('does not decay at six days of silence', async () => {
    const { state } = await unlockThenStop(6);
    expect(state.abstinence?.days).toBe(6);
    expect(state.decayFraction).toBe(0);
  });

  it('decays at seven, once the seventh silent day can no longer be written (D135)', async () => {
    const today = await unlockThenStop(7);
    expect(today.state.endurance.unlocked).toBe(true);
    expect(today.state.abstinence?.days).toBe(7);
    expect(today.state.decayFraction).toBe(0);
    // Two days on, day seven is closed and the decay lands, once.
    const { state } = await stateAt(addDays(START, 24 + 9));
    expect(state.decayFraction).toBeGreaterThan(0);
  });

  it('does not decay a user still inside the Endurance Phase', async () => {
    await logRun(START, 5000, 5.5);
    const { state } = await stateAt(addDays(START, 35));
    expect(state.endurance.unlocked).toBe(false);
    expect(state.decayFraction).toBe(0);
  });

  it('does not treat a merely missed weekly target as abstinence', async () => {
    for (let week = 0; week < 4; week += 1) await runWeek(addDays(START, week * 7), 5000, 5.5);
    // One run a week from here: the target is missed, but never seven silent days.
    for (let week = 4; week < 7; week += 1) await logRun(addDays(START, week * 7 + 2), 5000, 5.5);
    const { state } = await stateAt(addDays(START, 44));
    expect(state.decayFraction).toBe(0);
  });

  it('leaves historical pace figures untouched while it decays', async () => {
    for (let week = 0; week < 4; week += 1) {
      await runWeek(addDays(START, week * 7), 5000, 5.5 - week * 0.1);
    }
    const active = await stateAt(addDays(START, 24));
    const before = active.state.ytd?.ratio;

    const { state } = await stateAt(addDays(START, 60));
    expect(state.decayFraction).toBeGreaterThan(0);
    // The window has moved on, but the recorded runs have not changed.
    const runs = await runsRepository.getAll();
    expect(runs.every((run) => run.distanceMetres === 5000)).toBe(true);
    expect(before).toBeGreaterThan(1);
  });
});

/* ── The era boundary ───────────────────────────────────────────────────── */

describe('a profile that predates the Running scoring model', () => {
  async function makeLegacyEra() {
    const snapshots = await configSnapshotsRepository.list();
    await configSnapshotsRepository.replaceAll(
      snapshots.map((snapshot) => {
        const { runningModel: _drop, ...scoring } = snapshot.config.scoring;
        return { ...snapshot, config: { ...snapshot.config, scoring } };
      }),
    );
  }

  it('keeps scoring those days the way they were actually scored', async () => {
    await runWeek(START, 5000, 5.5);
    await runWeek(addDays(START, 7), 5000, 5.0);
    const modern = (await stateAt(addDays(START, 13))).state.rating;

    await makeLegacyEra();
    const legacy = (await stateAt(addDays(START, 13))).state;
    expect(legacy.model).toBe('attendance');
    expect(legacy.rating).not.toBeCloseTo(modern, 3);
  });

  it('continues from the number the old model left, rather than jumping', async () => {
    await runWeek(START, 5000, 5.5);
    await runWeek(addDays(START, 7), 5000, 5.3);
    await runWeek(addDays(START, 14), 5000, 5.1);
    await makeLegacyEra();
    const before = (await stateAt(addDays(START, 20))).state;
    expect(before.model).toBe('attendance');

    const snapshots = await configSnapshotsRepository.list();
    const latest = snapshots[snapshots.length - 1]!;
    await configSnapshotsRepository.replaceAll([
      ...snapshots,
      {
        ...latest,
        id: `${latest.id}_p5`,
        effectiveFrom: addDays(START, 21),
        config: {
          ...latest.config,
          scoring: { ...latest.config.scoring, runningModel: 'attendancePerformance' as const },
        },
      },
    ]);

    const after = (await stateAt(addDays(START, 21))).state;
    expect(after.model).toBe('attendancePerformance');
    const step = Math.abs(after.rating - before.rating);
    expect(step).toBeLessThanOrEqual(RATING.MAX * TRAINING_RATING.BASE_MOVEMENT + 1e-6);
  });

  it('leaves every earlier day exactly where the old model put it', async () => {
    await runWeek(START, 5000, 5.5);
    await runWeek(addDays(START, 7), 5000, 5.2);
    await makeLegacyEra();
    const legacy = (await stateAt(addDays(START, 13))).state.points.map((point) => point.rating);

    const snapshots = await configSnapshotsRepository.list();
    const latest = snapshots[snapshots.length - 1]!;
    await configSnapshotsRepository.replaceAll([
      ...snapshots,
      {
        ...latest,
        id: `${latest.id}_p5`,
        effectiveFrom: addDays(START, 14),
        config: {
          ...latest.config,
          scoring: { ...latest.config.scoring, runningModel: 'attendancePerformance' as const },
        },
      },
    ]);

    const mixed = (await stateAt(addDays(START, 20))).state.points.map((point) => point.rating);
    legacy.forEach((rating, index) => expect(mixed[index]).toBe(rating));
  });
});

/* ── Everything else must keep working ──────────────────────────────────── */

describe('what Running does to the rest of the app', () => {
  it('flows into the Boss through the ordinary weighting', async () => {
    await runWeek(START, 5000, 5.5);
    const { boss, ledger } = await stateAt(addDays(START, 6));
    const last = boss.points[boss.points.length - 1]!;
    expect(last.contributions.some((entry) => entry.domain === 'running')).toBe(true);
    expect(ledger.progress).toBeGreaterThan(0);
  });

  it('replays identically twice from the same stored state', async () => {
    for (let week = 0; week < 5; week += 1) {
      await runWeek(addDays(START, week * 7), 5000, 5.5 - week * 0.1);
    }
    const first = await stateAt(addDays(START, 40));
    const second = await stateAt(addDays(START, 40));
    expect(second.state.rating).toBe(first.state.rating);
    expect(second.state.endurance.progress).toBe(first.state.endurance.progress);
    second.boss.points.forEach((point, index) => {
      expect(point.progress).toBeCloseTo(first.boss.points[index]!.progress, 12);
    });
  });

  it('leaves the ledger unstarted until something is logged', async () => {
    const { ledger, state } = await stateAt(addDays(START, 6));
    expect(ledger.started).toBe(false);
    expect(state.origin).toBeNull();
    expect(state.endurance.progress).toBe(0);
  });

  it('leaves Food dormant', async () => {
    await runWeek(START, 5000, 5.5);
    const { boss } = await stateAt(addDays(START, 6));
    expect(boss.domains.find((domain) => domain.domain === 'food')!.started).toBe(false);
  });
});
