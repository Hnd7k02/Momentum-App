import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { EXERCISE_CATALOGUE, catalogueRecords } from '../../core/gym/catalogue';
import { closeDatabase, deleteDatabase } from '../db';
import { exercisesRepository, gymSetsRepository } from '../repositories';
import { applyOnboarding } from './configurationService';
import { EditWindowError } from './checkInService';
import { loadBossProgression } from './bossService';
import { loadProgression } from './ratingService';
import { withoutGymMetricEra } from './fixtures/legacyGymMetric';
import {
  addSet,
  createExercise,
  ensureExerciseCatalogue,
  loadGymHistory,
  loadSession,
  openSessionForDay,
  removeExerciseFromSession,
  removeSet,
  updateSet,
} from './gymService';

/**
 * Gym end to end: the catalogue, a session, its sets, the replay over them,
 * and the promise that none of it disturbs the ranking that was already
 * there.
 */

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

const MONDAY = '2026-03-02';

/** The ids block 7D adds (D171): every entry after the 49 that were there before it. */
const BLOCK_7D_IDS = new Set([
  'ex_chest_press_machine', 'ex_pec_deck', 'ex_cable_chest_press', 'ex_high_to_low_cable_fly', 'ex_dumbbell_bench_press', 'ex_dumbbell_fly',
  'ex_incline_bench_press', 'ex_decline_bench_press', 'ex_smith_machine_bench_press', 'ex_seated_row_machine', 'ex_back_extension_machine',
  'ex_chin_up', 'ex_inverted_row', 'ex_hyperextension', 'ex_one_arm_dumbbell_row', 'ex_t_bar_row', 'ex_dumbbell_shrug', 'ex_barbell_shrug',
  'ex_shoulder_press_machine', 'ex_lateral_raise_machine', 'ex_cable_reverse_fly', 'ex_pike_push_up', 'ex_dumbbell_shoulder_press',
  'ex_arnold_press', 'ex_dumbbell_reverse_fly', 'ex_upright_row', 'ex_cable_curl', 'ex_bayesian_cable_curl', 'ex_rope_hammer_curl', 'ex_barbell_curl', 'ex_ez_bar_curl',
  'ex_concentration_curl', 'ex_bar_pushdown', 'ex_triceps_extension_machine', 'ex_seated_dip_machine', 'ex_bench_dip', 'ex_close_grip_push_up',
  'ex_close_grip_bench_press', 'ex_dumbbell_overhead_extension', 'ex_triceps_kickback', 'ex_hack_squat', 'ex_smith_machine_squat',
  'ex_bodyweight_squat', 'ex_front_squat', 'ex_goblet_squat', 'ex_bulgarian_split_squat', 'ex_lunge', 'ex_step_up', 'ex_hip_thrust_machine',
  'ex_seated_leg_curl', 'ex_cable_glute_kickback', 'ex_cable_pull_through', 'ex_glute_bridge', 'ex_nordic_hamstring_curl',
  'ex_dumbbell_romanian_deadlift', 'ex_good_morning', 'ex_kettlebell_swing', 'ex_leg_press_calf_raise', 'ex_donkey_calf_raise',
  'ex_smith_machine_calf_raise', 'ex_bodyweight_calf_raise', 'ex_single_leg_calf_raise', 'ex_dumbbell_calf_raise',
  'ex_seated_dumbbell_calf_raise', 'ex_barbell_calf_raise', 'ex_ab_crunch_machine', 'ex_rotary_torso_machine', 'ex_cable_woodchop',
  'ex_pallof_press', 'ex_crunch', 'ex_reverse_crunch', 'ex_bicycle_crunch', 'ex_sit_up', 'ex_lying_leg_raise', 'ex_russian_twist',
  'ex_ab_wheel_rollout', 'ex_dumbbell_side_bend', 'ex_cable_wrist_curl', 'ex_cable_reverse_curl', 'ex_dumbbell_reverse_wrist_curl',
  'ex_barbell_wrist_curl', 'ex_barbell_reverse_wrist_curl', 'ex_barbell_reverse_curl', 'ex_wrist_roller', 'ex_ez_bar_reverse_curl',
]);
const kg = (value: number) => Math.round(value * 1000);

/**
 * An exercise-day's value under the Stage 5b metric (D150): the strength
 * score `load × (30 + reps)`. A device set up by these tests carries that
 * metric from its first day; `withoutGymMetricEra()` reads the same history
 * the way a device before the update holds it, as `reps × load` (D84).
 */
const strength = (reps: number, grams: number) => grams * (30 + reps);

beforeEach(async () => {
  await deleteDatabase();
  freezeAt(MONDAY);
  await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

describe('the exercise catalogue', () => {
  it('seeds the built-ins once', async () => {
    const first = await ensureExerciseCatalogue();
    const again = await ensureExerciseCatalogue();
    expect(first).toHaveLength(EXERCISE_CATALOGUE.length);
    expect(again).toHaveLength(EXERCISE_CATALOGUE.length);
  });

  it('gives every built-in a stable, readable id', async () => {
    await ensureExerciseCatalogue();
    const stored = await exercisesRepository.get('ex_bench_press');
    expect(stored?.name).toBe('Bench Press');
    expect(stored?.builtIn).toBe(true);
    // Ids are permanent and unique: history joins on them.
    const ids = EXERCISE_CATALOGUE.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('states every muscle group explicitly, never inferring one', async () => {
    await ensureExerciseCatalogue();
    for (const entry of EXERCISE_CATALOGUE) {
      expect(entry.muscles.length, entry.id).toBeGreaterThan(0);
    }
    // Deadlift reaches three groups, and says so.
    expect((await exercisesRepository.get('ex_deadlift'))?.muscles).toEqual([
      'back',
      'hamstringsGlutes',
      'forearms',
    ]);
    // And it says which of them are primary, rather than leaving it to the
    // order they happen to be listed in (D92).
    expect((await exercisesRepository.get('ex_deadlift'))?.primaryMuscles).toEqual([
      'back',
      'hamstringsGlutes',
    ]);
    for (const entry of EXERCISE_CATALOGUE) {
      expect(entry.primary.length, entry.id).toBeGreaterThan(0);
      for (const muscle of entry.primary) expect(entry.muscles, entry.id).toContain(muscle);
    }
  });

  it('never overwrites an exercise the user has renamed', async () => {
    await ensureExerciseCatalogue();
    const original = (await exercisesRepository.get('ex_bench_press'))!;
    await exercisesRepository.put({ ...original, name: 'Flachbankdrücken' });
    await ensureExerciseCatalogue();
    expect((await exercisesRepository.get('ex_bench_press'))?.name).toBe('Flachbankdrücken');
  });

  it('brings the entries of block 7D to a device that holds the 49 before it, and leaves those 49 as they were', async () => {
    // A device seeded before block 7D: the 49 entries as that build wrote
    // them, on its own day, and one of them renamed by its user since.
    // (The one-arm cable pulldown came later still, with the starter plans.)
    const ids49 = new Set(EXERCISE_CATALOGUE.map((entry) => entry.id).filter((id) => !BLOCK_7D_IDS.has(id) && id !== 'ex_single_arm_cable_pulldown'));
    expect(ids49.size).toBe(49);
    const before = catalogueRecords('2026-01-05T08:00:00.000Z').filter((record) => ids49.has(record.id));
    const renamed = { ...before.find((record) => record.id === 'ex_lat_pulldown')!, name: 'Latzug breit', updatedAt: '2026-02-01T08:00:00.000Z' };
    const stored = before.map((record) => (record.id === renamed.id ? renamed : record));
    await exercisesRepository.putMany(stored);
    const bytes = JSON.stringify([...(await exercisesRepository.getAll())].sort((a, b) => a.id.localeCompare(b.id)));

    const after = await ensureExerciseCatalogue();

    expect(after).toHaveLength(EXERCISE_CATALOGUE.length);
    const all = await exercisesRepository.getAll();
    for (const id of BLOCK_7D_IDS) expect(all.some((record) => record.id === id), id).toBe(true);
    // The 49 byte for byte, the renamed one with its user's name.
    const old = all.filter((record) => ids49.has(record.id)).sort((a, b) => a.id.localeCompare(b.id));
    expect(JSON.stringify(old)).toBe(bytes);
    expect(old.find((record) => record.id === 'ex_lat_pulldown')?.name).toBe('Latzug breit');
    // A new entry is written as the catalogue has it, on the day it arrives.
    const chestPress = all.find((record) => record.id === 'ex_chest_press_machine')!;
    expect(chestPress).toMatchObject({ name: 'Chest Press Machine', muscles: ['chest', 'triceps', 'shoulders'], primaryMuscles: ['chest'], builtIn: true, loadType: 'external' });
    expect(chestPress.createdAt.slice(0, 10)).toBe(MONDAY);
  });

  it('lets the user add one, with the groups they chose', async () => {
    const created = await createExercise({ name: 'Zercher Squat', muscles: ['quadriceps', 'core'] });
    expect(created.builtIn).toBe(false);
    expect(created.muscles).toEqual(['quadriceps', 'core']);
    expect(created.id).not.toBe('Zercher Squat');
  });
});

describe('logging a session', () => {
  it('reuses the session already open for that day', async () => {
    const first = await openSessionForDay(MONDAY);
    const again = await openSessionForDay(MONDAY);
    expect(again.id).toBe(first.id);
  });

  it('records the muscle groups the exercise had when the set was logged', async () => {
    await ensureExerciseCatalogue();
    const session = await openSessionForDay(MONDAY);
    const set = await addSet({
      sessionId: session.id,
      exerciseId: 'ex_deadlift',
      reps: 5,
      weightGrams: kg(100),
    });
    expect(set.muscles).toEqual(['back', 'hamstringsGlutes', 'forearms']);
    // The roles and the load type travel with the set for the same reason.
    expect(set.primaryMuscles).toEqual(['back', 'hamstringsGlutes']);
    expect(set.loadType).toBe('external');
  });

  it('groups sets under their exercise, in the order they were added', async () => {
    await ensureExerciseCatalogue();
    const session = await openSessionForDay(MONDAY);
    for (const [exerciseId, reps, weight] of [
      ['ex_bench_press', 10, 50],
      ['ex_bench_press', 8, 70],
      ['ex_squat', 5, 100],
    ] as const) {
      await addSet({ sessionId: session.id, exerciseId, reps, weightGrams: kg(weight) });
    }
    const view = await loadSession(session.id);
    expect(view?.exercises.map((entry) => entry.exercise.id)).toEqual([
      'ex_bench_press',
      'ex_squat',
    ]);
    expect(view?.exercises[0]?.sets).toHaveLength(2);
    // The best working set is 8 × 70, by the strength score (70 × 38 against
    // 50 × 40) — and it is the set the view names.
    expect(view?.exercises[0]?.bestScore).toBe(strength(8, kg(70)));
    expect(view?.exercises[0]?.bestSetId).toBe(view?.exercises[0]?.sets[1]?.id);
    // Before Stage 5b the same set, as 8 × 70 = 560 against 10 × 50 = 500.
    await withoutGymMetricEra();
    const legacy = await loadSession(session.id);
    expect(legacy?.exercises[0]?.bestScore).toBe(kg(70) * 8);
    expect(legacy?.exercises[0]?.bestSetId).toBe(view?.exercises[0]?.sets[1]?.id);
  });

  it('edits and removes a set', async () => {
    await ensureExerciseCatalogue();
    const session = await openSessionForDay(MONDAY);
    const set = await addSet({
      sessionId: session.id,
      exerciseId: 'ex_squat',
      reps: 5,
      weightGrams: kg(100),
    });
    await updateSet(set.id, { weightGrams: kg(110) });
    expect((await gymSetsRepository.get(set.id))?.weightGrams).toBe(kg(110));
    await removeSet(set.id);
    expect(await gymSetsRepository.get(set.id)).toBeUndefined();
  });

  it('removes a whole exercise and every set of it', async () => {
    await ensureExerciseCatalogue();
    const session = await openSessionForDay(MONDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_squat', reps: 5, weightGrams: kg(100) });
    await addSet({ sessionId: session.id, exerciseId: 'ex_squat', reps: 5, weightGrams: kg(105) });
    await addSet({ sessionId: session.id, exerciseId: 'ex_plank', reps: 1, weightGrams: kg(10) });
    await removeExerciseFromSession(session.id, 'ex_squat');
    const view = await loadSession(session.id);
    expect(view?.exercises.map((entry) => entry.exercise.id)).toEqual(['ex_plank']);
  });
});

describe('the edit window, which Gym does not get its own version of', () => {
  it('lets a set be changed the next day, and not the day after (D133)', async () => {
    await ensureExerciseCatalogue();
    const session = await openSessionForDay(MONDAY);
    const set = await addSet({
      sessionId: session.id,
      exerciseId: 'ex_squat',
      reps: 5,
      weightGrams: kg(100),
    });
    // Tuesday: Monday is yesterday.
    freezeAt('2026-03-03');
    await expect(updateSet(set.id, { reps: 6 })).resolves.toBeDefined();
    // Wednesday of the same week: no longer.
    freezeAt('2026-03-04');
    await expect(updateSet(set.id, { reps: 7 })).rejects.toThrow(EditWindowError);
  });

  it('refuses once that week has passed', async () => {
    await ensureExerciseCatalogue();
    const session = await openSessionForDay(MONDAY);
    const set = await addSet({
      sessionId: session.id,
      exerciseId: 'ex_squat',
      reps: 5,
      weightGrams: kg(100),
    });
    freezeAt('2026-03-16');
    await expect(updateSet(set.id, { reps: 6 })).rejects.toThrow(EditWindowError);
    await expect(removeSet(set.id)).rejects.toThrow(EditWindowError);
    await expect(
      addSet({ sessionId: session.id, exerciseId: 'ex_squat', reps: 5, weightGrams: kg(100) }),
    ).rejects.toThrow(EditWindowError);
    // And the session reports itself as closed rather than silently failing.
    expect((await loadSession(session.id))?.editable).toBe(false);
  });
});

describe('the replay over sets', () => {
  /** Logs one exercise on one day. */
  async function log(date: string, exerciseId: string, sets: [number, number][]) {
    freezeAt(date);
    const session = await openSessionForDay(date);
    for (const [reps, weight] of sets) {
      await addSet({ sessionId: session.id, exerciseId, reps, weightGrams: kg(weight) });
    }
  }

  it('produces one value per exercise per day, from the best set', async () => {
    await ensureExerciseCatalogue();
    await log(MONDAY, 'ex_bench_press', [
      [10, 10],
      [8, 15],
      [6, 20],
    ]);
    const history = await loadGymHistory(MONDAY, MONDAY);
    expect(history.days).toHaveLength(1);
    // One value, from one set: the heaviest here, 6 × 20, by the strength
    // score (20 × 36 against 15 × 38 and 10 × 40).
    expect(history.days[0]?.best.score).toBe(strength(6, kg(20)));
    expect(history.days[0]?.best.set.reps).toBe(6);
    // Before Stage 5b it was 8 × 15: 120 against 100 and 120 — the earlier
    // of the two sets that tie.
    await withoutGymMetricEra();
    const legacy = await loadGymHistory(MONDAY, MONDAY);
    expect(legacy.days).toHaveLength(1);
    expect(legacy.days[0]?.best.score).toBe(kg(15) * 8);
  });

  it('compares against the previous recorded day and nothing else', async () => {
    await ensureExerciseCatalogue();
    await log(MONDAY, 'ex_bench_press', [[8, 60]]);
    await log('2026-03-09', 'ex_squat', [[5, 100]]);
    await log('2026-03-16', 'ex_bench_press', [[8, 65]]);
    freezeAt('2026-03-16');
    const history = await loadGymHistory(MONDAY, '2026-03-16');
    const bench = history.comparisons.get('ex_bench_press');
    expect(bench?.kind).toBe('improved');
    expect(bench?.previousDate).toBe(MONDAY);
  });

  it('follows an edit, because nothing derived is stored', async () => {
    await ensureExerciseCatalogue();
    await log(MONDAY, 'ex_bench_press', [[8, 60]]);
    const before = (await loadGymHistory(MONDAY, MONDAY)).days[0]!.best.score;
    const sets = await gymSetsRepository.getAll();
    await updateSet(sets[0]!.id, { weightGrams: kg(65) });
    const after = (await loadGymHistory(MONDAY, MONDAY)).days[0]!.best.score;
    expect(before).toBe(strength(8, kg(60)));
    expect(after).toBe(strength(8, kg(65)));
    // And under the metric before Stage 5b the edit is followed the same way.
    await withoutGymMetricEra();
    expect((await loadGymHistory(MONDAY, MONDAY)).days[0]!.best.score).toBe(kg(65) * 8);
  });

  it('keeps closed history when an exercise is remapped today', async () => {
    // The set carries the mapping it was logged under, so correcting an
    // exercise's muscle groups applies to what comes next.
    await ensureExerciseCatalogue();
    await log(MONDAY, 'ex_squat', [[5, 100]]);
    const stored = (await exercisesRepository.get('ex_squat'))!;
    await exercisesRepository.put({ ...stored, muscles: ['calves'] });

    const history = await loadGymHistory(MONDAY, MONDAY);
    expect(history.days[0]?.muscles).toEqual(['quadriceps', 'hamstringsGlutes', 'core']);
    const calves = history.overall.muscles.find((entry) => entry.muscle === 'calves');
    expect(calves?.status).toBe('noData');
  });

  it('keeps closed history when an exercise is renamed today', async () => {
    await ensureExerciseCatalogue();
    await log(MONDAY, 'ex_bench_press', [[8, 60]]);
    await log('2026-03-09', 'ex_bench_press', [[8, 65]]);
    const stored = (await exercisesRepository.get('ex_bench_press'))!;
    await exercisesRepository.put({ ...stored, name: 'Flachbank' });

    freezeAt('2026-03-09');
    const history = await loadGymHistory(MONDAY, '2026-03-09');
    // One history, under the new label.
    expect(history.comparisons.get('ex_bench_press')?.kind).toBe('improved');
    expect(history.names.get('ex_bench_press')).toBe('Flachbank');
  });

  it('replays the same answer every time', async () => {
    await ensureExerciseCatalogue();
    await log(MONDAY, 'ex_bench_press', [[8, 60]]);
    await log('2026-03-09', 'ex_bench_press', [[8, 66]]);
    freezeAt('2026-03-09');
    const a = await loadGymHistory(MONDAY, '2026-03-09');
    const b = await loadGymHistory(MONDAY, '2026-03-09');
    expect(a.overall.ratio).toBe(b.overall.ratio);
    expect(a.recent.ratio).toBe(b.recent.ratio);
  });
});

describe('what Gym does and does not do to the ranking', () => {
  it('says a domain with no training is not started', async () => {
    const boss = await loadBossProgression();
    const gym = boss.domains.find((domain) => domain.domain === 'gym')!;
    expect(gym.started).toBe(false);
    expect(gym.active.some(Boolean)).toBe(false);
  });

  it('starts the Gym ledger once a session is logged', async () => {
    await ensureExerciseCatalogue();
    const session = await openSessionForDay(MONDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_squat', reps: 5, weightGrams: kg(100) });
    freezeAt('2026-03-16');
    const boss = await loadBossProgression();
    const gym = boss.domains.find((domain) => domain.domain === 'gym')!;
    expect(gym.started).toBe(true);
    expect(gym.active[gym.active.length - 1]).toBe(true);
  });

  it('scores the Gym day on attendance, exactly as it did before phase 4', async () => {
    // Two sessions against a target of three is two thirds of the week,
    // whatever was lifted in them. Sets do not change this number, and the
    // report says why that decision is still open.
    await ensureExerciseCatalogue();
    for (const date of [MONDAY, '2026-03-03']) {
      freezeAt(date);
      const session = await openSessionForDay(date);
      await addSet({
        sessionId: session.id,
        exerciseId: 'ex_squat',
        reps: 5,
        weightGrams: kg(date === MONDAY ? 100 : 500),
      });
    }
    freezeAt('2026-03-16');
    const progression = await loadProgression();
    const day = progression.history.days.find((entry) => entry.date === MONDAY)!;
    const gym = day.domains.find((entry) => entry.domain === 'gym')!;
    expect(gym.score).toBeCloseTo((2 / 3) * 100, 6);
  });

  it('leaves Food dormant, because Food has no scoring engine yet', async () => {
    const boss = await loadBossProgression();
    const food = boss.domains.find((domain) => domain.domain === 'food')!;
    expect(food.started).toBe(false);
    // And it is not in the Boss at all, rather than in it as a zero.
    const last = boss.points[boss.points.length - 1];
    expect(last?.contributions.some((entry) => entry.domain === 'food')).toBe(false);
  });

  it('keeps the Boss weighting snapshot-safe while Gym is being used', async () => {
    await ensureExerciseCatalogue();
    const session = await openSessionForDay(MONDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_squat', reps: 5, weightGrams: kg(100) });
    freezeAt('2026-03-16');
    const before = await loadBossProgression();
    const boss = await loadBossProgression();
    // Two loads of the same data agree point for point.
    boss.points.forEach((point, index) => {
      expect(point.progress).toBeCloseTo(before.points[index]!.progress, 12);
    });
  });
});
