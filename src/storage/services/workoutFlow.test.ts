import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { committedWrites } from '../changes';
import { closeDatabase, deleteDatabase } from '../db';
import { gymSessionsRepository, gymSetsRepository } from '../repositories';
import { InvalidAnswerError, deleteSession } from './checkInService';
import { applyOnboarding } from './configurationService';
import {
  addSessionExercise,
  addSet,
  draftFromPlan,
  ensureExerciseCatalogue,
  finishSession,
  loadRunningWorkout,
  loadSession,
  openSessionForDay,
  removeExerciseFromSession,
  removeSet,
  restoreExercise,
  restoreSet,
  startSessionFromDraft,
  updateSet,
} from './gymService';
import { createTrainingPlan } from './trainingPlanService';

/**
 * The workout flow's storage side (WP3, Stage 2).
 *
 * - A workout started in the app is running (`finishedAt: null`) until
 *   "Fertig"; a session recorded before the field existed is finished.
 * - Removing a set or an exercise can be undone exactly: the same rows, the
 *   same line in the same place.
 * - Heute's running workout counts planned exercises with a saved set, or
 *   states a free workout as counts.
 */

const WEDNESDAY = '2026-10-14';
const SUNDAY = '2026-10-18';
const MONDAY = '2026-10-19';
const TUESDAY = '2026-10-20';

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

beforeEach(async () => {
  await deleteDatabase();
  freezeAt(WEDNESDAY);
  await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
  await ensureExerciseCatalogue();
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

const kg = (value: number) => value * 1000;

describe('a running workout', () => {
  it('starts running and is finished by "Fertig"', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    expect(session.finishedAt).toBeNull();
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    expect(await loadRunningWorkout(WEDNESDAY)).toMatchObject({ sessionId: session.id, kind: 'free', exercises: 1, sets: 1 });

    const finished = await finishSession(session.id);
    expect(typeof finished?.finishedAt).toBe('string');
    expect(await loadRunningWorkout(WEDNESDAY)).toBeNull();
  });

  it('is not running before its first saved set', async () => {
    await openSessionForDay(WEDNESDAY);
    expect(await loadRunningWorkout(WEDNESDAY)).toBeNull();
  });

  it('treats a session recorded before the field existed as finished', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    const { finishedAt: _dropped, ...legacy } = (await gymSessionsRepository.get(session.id))!;
    await gymSessionsRepository.put(legacy);
    expect(await loadRunningWorkout(WEDNESDAY)).toBeNull();
  });

  it('states a plan as the share of planned exercises with a saved set, extras excluded', async () => {
    const plan = await createTrainingPlan({
      name: 'Push',
      exercises: ['ex_bench_press', 'ex_incline_press', 'ex_dip', 'ex_triceps_pushdown', 'ex_lateral_raise'].map(
        (exerciseId) => ({ exerciseId }),
      ),
    });
    const session = await startSessionFromDraft(draftFromPlan(plan), WEDNESDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    await addSet({ sessionId: session.id, exerciseId: 'ex_incline_press', reps: 10, weightGrams: kg(40) });
    await addSessionExercise(session.id, 'ex_face_pull');
    await addSet({ sessionId: session.id, exerciseId: 'ex_face_pull', reps: 12, weightGrams: kg(20) });
    expect(await loadRunningWorkout(WEDNESDAY)).toMatchObject({
      kind: 'plan',
      done: 2,
      planned: 5,
      percent: 40,
      exercises: 3,
      sets: 4,
    });
  });

  it('counts an exercise a plan lists twice once, as the workout shows it', async () => {
    const plan = await createTrainingPlan({
      name: 'Push',
      exercises: ['ex_bench_press', 'ex_bench_press', 'ex_squat'].map((exerciseId) => ({ exerciseId })),
    });
    const session = await startSessionFromDraft(draftFromPlan(plan), WEDNESDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    expect(await loadRunningWorkout(WEDNESDAY)).toMatchObject({ kind: 'plan', done: 1, planned: 2, percent: 50 });
  });

  it('leaves the field absent on a session recorded before it, whatever "Fertig" says', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const { finishedAt: _dropped, ...legacy } = (await gymSessionsRepository.get(session.id))!;
    await gymSessionsRepository.put(legacy);
    await finishSession(session.id);
    expect('finishedAt' in (await gymSessionsRepository.get(session.id))!).toBe(false);
  });

  it('records "Fertig" on yesterday\'s workout, across the week boundary, and not after its window', async () => {
    freezeAt(SUNDAY);
    const sunday = await openSessionForDay(SUNDAY);
    freezeAt(MONDAY);
    expect(typeof (await finishSession(sunday.id))?.finishedAt).toBe('string');

    freezeAt(SUNDAY);
    const late = await openSessionForDay(SUNDAY);
    await addSet({ sessionId: late.id, exerciseId: 'ex_bench_press', reps: 5, weightGrams: kg(60) });
    freezeAt(TUESDAY);
    expect((await finishSession(late.id))?.finishedAt).toBeNull();
  });

  it('runs again when a new set is added, and not when a set is corrected (STOP 2, decision 2)', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const set = await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    await finishSession(session.id);

    await updateSet(set.id, { reps: 9 });
    expect(typeof (await gymSessionsRepository.get(session.id))?.finishedAt).toBe('string');
    expect(await loadRunningWorkout(WEDNESDAY)).toBeNull();

    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    expect((await gymSessionsRepository.get(session.id))?.finishedAt).toBeNull();
    expect(await loadRunningWorkout(WEDNESDAY)).toMatchObject({ sessionId: session.id, sets: 2 });
  });
});

describe('a session the user empties (STOP 2, decision 1)', () => {
  it('goes with its last set, and an undo brings it back as itself', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const set = await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    const stored = (await gymSessionsRepository.get(session.id))!;

    const removed = await removeSet(set.id);
    expect(removed?.session).toEqual(stored);
    expect(await gymSessionsRepository.get(session.id)).toBeUndefined();

    await restoreSet(removed!.set, undefined, removed!.session);
    expect(await gymSessionsRepository.get(session.id)).toEqual(stored);
    expect(await gymSetsRepository.get(set.id)).toEqual(set);
  });

  it('stays while it still has a set', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const first = await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    await addSet({ sessionId: session.id, exerciseId: 'ex_squat', reps: 5, weightGrams: kg(100) });
    expect((await removeSet(first.id))?.session).toBeNull();
    expect(await gymSessionsRepository.get(session.id)).toBeDefined();
  });

  it('stays when a line without sets is removed, with its other lines', async () => {
    // A planned session with lines and no set yet — what a first set that
    // failed to save leaves, and how a session stored empty before P6 looks.
    const plan = await createTrainingPlan({
      name: 'Push',
      exercises: [{ exerciseId: 'ex_bench_press' }, { exerciseId: 'ex_dip' }],
    });
    const session = await startSessionFromDraft(draftFromPlan(plan), WEDNESDAY);
    const removed = await removeExerciseFromSession(session.id, 'ex_bench_press');
    expect(removed.session).toBeNull();
    const kept = await gymSessionsRepository.get(session.id);
    expect(kept?.exercises?.map((line) => line.exerciseId)).toEqual(['ex_dip']);
  });
});

describe('undo', () => {
  it('puts a removed set back exactly as it was', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const set = await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    const removed = await removeSet(set.id);
    expect(await gymSetsRepository.get(set.id)).toBeUndefined();
    await restoreSet(set, undefined, removed!.session);
    expect(await gymSetsRepository.get(set.id)).toEqual(set);
  });

  it('puts a removed planned exercise back: its sets, its line and its place', async () => {
    const plan = await createTrainingPlan({
      name: 'Push',
      exercises: ['ex_bench_press', 'ex_incline_press', 'ex_dip'].map((exerciseId) => ({ exerciseId })),
    });
    const session = await startSessionFromDraft(draftFromPlan(plan), WEDNESDAY);
    const first = await addSet({ sessionId: session.id, exerciseId: 'ex_incline_press', reps: 10, weightGrams: kg(40) });
    const second = await addSet({ sessionId: session.id, exerciseId: 'ex_incline_press', reps: 9, weightGrams: kg(40) });
    const before = await loadSession(session.id);
    const line = before!.session.exercises!.find((entry) => entry.exerciseId === 'ex_incline_press')!;

    const removed = await removeExerciseFromSession(session.id, 'ex_incline_press');
    // Its sets were the session's only sets, so the session went too (D137),
    // as it was without the line.
    expect(await loadSession(session.id)).toBeNull();
    expect(removed.session!.exercises!.map((entry) => entry.exerciseId)).toEqual(['ex_bench_press', 'ex_dip']);

    await restoreExercise(session.id, [first, second], line, undefined, removed.session);
    const after = await loadSession(session.id);
    expect(after!.session.exercises).toEqual(before!.session.exercises);
    expect(after!.exercises.map((entry) => [entry.exercise.id, entry.sets.length])).toEqual([
      ['ex_bench_press', 0],
      ['ex_incline_press', 2],
      ['ex_dip', 0],
    ]);
    expect(await gymSetsRepository.get(first.id)).toEqual(first);
  });

  it("restores a free workout's exercise from its sets alone", async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const set = await addSet({ sessionId: session.id, exerciseId: 'ex_squat', reps: 5, weightGrams: kg(100) });
    const removed = await removeExerciseFromSession(session.id, 'ex_squat');
    await restoreExercise(session.id, [set], null, undefined, removed.session);
    expect((await gymSessionsRepository.get(session.id))!.exercises).toBeUndefined();
    expect(await gymSetsRepository.get(set.id)).toEqual(set);
  });

  it('takes an undo of yesterday, and refuses it once the day can no longer be written', async () => {
    freezeAt(SUNDAY);
    const session = await openSessionForDay(SUNDAY);
    const set = await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    const keep = await addSet({ sessionId: session.id, exerciseId: 'ex_squat', reps: 5, weightGrams: kg(100) });
    await removeSet(set.id);
    freezeAt(MONDAY);
    await restoreSet(set);
    expect(await gymSetsRepository.get(set.id)).toEqual(set);

    await removeSet(set.id);
    freezeAt(TUESDAY);
    await expect(restoreSet(set)).rejects.toThrow();
    expect(await gymSetsRepository.get(set.id)).toBeUndefined();
    expect(await gymSetsRepository.get(keep.id)).toEqual(keep);
  });
});

describe('a Gym session outside its workout (D142)', () => {
  /*
   * A Gym session goes with its sets, in the workout, where an undo can put
   * it back. The check-in service's delete would have removed the session
   * alone and left its sets counting for performance, so it refuses — before
   * it reads or writes anything, on any day.
   */
  it('is never deleted by the check-in service, sets and all', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const sets = [
      await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) }),
      await addSet({ sessionId: session.id, exerciseId: 'ex_squat', reps: 5, weightGrams: kg(100) }),
    ];
    const writes = committedWrites();
    await expect(deleteSession('gym', session.id)).rejects.toThrow(InvalidAnswerError);
    expect(committedWrites()).toBe(writes);
    expect(await gymSessionsRepository.get(session.id)).toBeDefined();
    expect(await gymSetsRepository.listBySession(session.id)).toEqual(expect.arrayContaining(sets));
    expect(await gymSetsRepository.listBySession(session.id)).toHaveLength(2);
  });

  it('is refused the same way once its day is closed', async () => {
    freezeAt(SUNDAY);
    const session = await openSessionForDay(SUNDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    freezeAt(TUESDAY);
    await expect(deleteSession('gym', session.id)).rejects.toThrow(InvalidAnswerError);
    expect(await gymSetsRepository.listBySession(session.id)).toHaveLength(1);
  });
});
