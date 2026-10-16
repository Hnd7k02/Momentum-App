import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { EXERCISE_CATALOGUE, catalogueRecords } from '../../core/gym/catalogue';
import { GYM } from '../../core/config/constants';
import { TRAINING_PLAN_KIND, TRAINING_PLAN_VERSION, type TrainingPlanRecord } from '../../core/model';
import { canonicalJson } from '../../testing/canonical';
import { closeDatabase, deleteDatabase } from '../db';
import { exercisesRepository, gymPlansRepository, gymSessionsRepository, gymSetsRepository } from '../repositories';
import { applyOnboarding } from './configurationService';
import { loadDay } from './checkInService';
import {
  addSessionExercise,
  addSet,
  createExercise,
  draftFromPlan,
  ensureExerciseCatalogue,
  lastRecordedFor,
  loadDraftView,
  loadSession,
  openSessionForDay,
  removeExerciseFromSession,
  startSessionFromDraft,
  updateSet,
} from './gymService';
import {
  createTrainingPlan,
  deleteTrainingPlan,
  duplicateTrainingPlan,
  getTrainingPlan,
  listTrainingPlans,
  planSlots,
  PlanLimitError,
  updateTrainingPlan,
} from './trainingPlanService';

/**
 * Training plans (WP2-1): the plan itself, the limit, the session that
 * comes from one, and the promise that the two never touch each other
 * again once the session exists.
 */

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

const MONDAY = '2026-03-02';
const kg = (value: number) => Math.round(value * 1000);

const PUSH = {
  name: 'Push A',
  exercises: [
    { exerciseId: 'ex_bench_press' },
    { exerciseId: 'ex_incline_press' },
    { exerciseId: 'ex_cable_lateral_raise' },
    { exerciseId: 'ex_triceps_pushdown' },
  ],
};

beforeEach(async () => {
  await deleteDatabase();
  freezeAt(MONDAY);
  await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
  await ensureExerciseCatalogue();
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

/* ── The catalogue on a device that already had one ─────────────────────── */

describe('the catalogue on an existing device', () => {
  it('adds the new ids and leaves the 29 existing records byte-identical', async () => {
    // A device seeded by iteration 2: the 29 old records, as they were.
    await deleteDatabase();
    freezeAt('2025-11-03');
    await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
    const old = catalogueRecords('2025-11-03T08:00:00.000Z').filter((record) =>
      ['ex_bench_press', 'ex_squat', 'ex_dip', 'ex_pull_up', 'ex_wrist_curl'].includes(record.id),
    );
    await exercisesRepository.putMany(old);
    const before = canonicalJson(await exercisesRepository.getAll());

    freezeAt(MONDAY);
    await ensureExerciseCatalogue();
    const after = await exercisesRepository.getAll();
    expect(after).toHaveLength(EXERCISE_CATALOGUE.length);
    const untouched = after.filter((record) => old.some((entry) => entry.id === record.id));
    expect(canonicalJson(untouched)).toBe(before);
    // The new ones carry today's stamp, not the old device's.
    expect(after.find((record) => record.id === 'ex_lat_pulldown_wide')?.createdAt).toMatch(/^2026-03-02/);
  });
});

/* ── Plans ──────────────────────────────────────────────────────────────── */

describe('a training plan', () => {
  it('is created with the user’s name and a name snapshot per line', async () => {
    const plan = await createTrainingPlan(PUSH);
    expect(plan.kind).toBe(TRAINING_PLAN_KIND);
    expect(plan.version).toBe(TRAINING_PLAN_VERSION);
    expect(plan.name).toBe('Push A');
    expect(plan.exercises.map((line) => [line.exerciseId, line.name, line.order])).toEqual([
      ['ex_bench_press', 'Bench Press', 0],
      ['ex_incline_press', 'Incline Dumbbell Press', 1],
      ['ex_cable_lateral_raise', 'Cable Lateral Raise', 2],
      ['ex_triceps_pushdown', 'Triceps Pushdown', 3],
    ]);
    expect(await listTrainingPlans()).toHaveLength(1);
  });

  it('snapshots a custom exercise’s own name', async () => {
    const custom = await createExercise({ name: 'Zercher Squat', muscles: ['quadriceps', 'core'] });
    const plan = await createTrainingPlan({ name: 'Legs', exercises: [{ exerciseId: custom.id }] });
    expect(plan.exercises[0]?.name).toBe('Zercher Squat');
  });

  it('refuses an empty name or an empty list', async () => {
    await expect(createTrainingPlan({ name: '  ', exercises: PUSH.exercises })).rejects.toThrow();
    await expect(createTrainingPlan({ name: 'Push', exercises: [] })).rejects.toThrow();
    expect(await listTrainingPlans()).toHaveLength(0);
  });

  it('is renamed, reordered, extended and shortened by one write', async () => {
    const plan = await createTrainingPlan(PUSH);
    const next = await updateTrainingPlan(plan.id, {
      name: 'Push B',
      exercises: [
        { exerciseId: 'ex_triceps_pushdown' },
        { exerciseId: 'ex_bench_press' },
        { exerciseId: 'ex_dip' },
      ],
    });
    expect(next.name).toBe('Push B');
    expect(next.exercises.map((line) => line.exerciseId)).toEqual(['ex_triceps_pushdown', 'ex_bench_press', 'ex_dip']);
    expect(next.exercises.map((line) => line.order)).toEqual([0, 1, 2]);
    expect(next.createdAt).toBe(plan.createdAt);
  });

  it('is duplicated with its own id and deleted to free its slot', async () => {
    const plan = await createTrainingPlan(PUSH);
    const copy = await duplicateTrainingPlan(plan.id, 'Push A (Kopie)');
    expect(copy.id).not.toBe(plan.id);
    expect(copy.name).toBe('Push A (Kopie)');
    expect(copy.exercises).toEqual(plan.exercises);
    expect(await listTrainingPlans()).toHaveLength(2);
    await deleteTrainingPlan(plan.id);
    expect((await listTrainingPlans()).map((entry) => entry.id)).toEqual([copy.id]);
    expect(await getTrainingPlan(plan.id)).toBeUndefined();
  });
});

describe('the plan limit', () => {
  it('allows five, refuses the sixth, and refuses a duplicate at five', async () => {
    for (let index = 0; index < GYM.MAX_PLANS; index += 1) {
      await createTrainingPlan({ name: `Plan ${index + 1}`, exercises: [{ exerciseId: 'ex_squat' }] });
    }
    expect(await planSlots()).toEqual({ used: 5, max: 5, free: false });
    await expect(createTrainingPlan(PUSH)).rejects.toThrow(PlanLimitError);
    const [first] = await listTrainingPlans();
    await expect(duplicateTrainingPlan(first!.id)).rejects.toThrow(PlanLimitError);
    expect(await listTrainingPlans()).toHaveLength(5);
  });

  it('frees a slot when a plan is deleted', async () => {
    for (let index = 0; index < GYM.MAX_PLANS; index += 1) {
      await createTrainingPlan({ name: `Plan ${index + 1}`, exercises: [{ exerciseId: 'ex_squat' }] });
    }
    const [first] = await listTrainingPlans();
    await deleteTrainingPlan(first!.id);
    expect((await planSlots()).free).toBe(true);
    await expect(createTrainingPlan(PUSH)).resolves.toBeDefined();
  });
});

describe('what the gymPlans store may also hold', () => {
  it('never shows a record without the discriminator as a plan', async () => {
    await gymPlansRepository.replaceAll([
      {
        id: 'plan_legacy',
        daysPerWeek: 3,
        focus: 'fullBody',
        goal: 'mixed',
        volume: 'medium',
        muscles: ['chest'],
        editedAt: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ]);
    expect(await listTrainingPlans()).toEqual([]);
    expect(await getTrainingPlan('plan_legacy')).toBeUndefined();
    // It is still there: preserved, not deleted.
    expect((await gymPlansRepository.getAll()).map((record) => record.id)).toEqual(['plan_legacy']);
    // And it does not take a slot.
    expect((await planSlots()).used).toBe(0);
  });
});

/* ── From a plan to a session ───────────────────────────────────────────── */

describe('opening a plan', () => {
  it('writes nothing until the first set is saved', async () => {
    const plan = await createTrainingPlan(PUSH);
    const draft = draftFromPlan(plan);
    const view = await loadDraftView(draft, MONDAY);
    expect(view.exercises.map((entry) => entry.exercise.id)).toEqual(
      PUSH.exercises.map((line) => line.exerciseId),
    );
    expect(view.exercises.every((entry) => entry.sets.length === 0 && entry.source === 'plan')).toBe(true);
    expect(await gymSessionsRepository.getAll()).toEqual([]);
    expect(await gymSetsRepository.getAll()).toEqual([]);
    // Today reports no session, so nothing has been credited.
    const day = await loadDay(MONDAY);
    expect(day.training.find((entry) => entry.domain === 'gym')?.sessions).toEqual([]);
  });

  it('persists the session with its own snapshot when the first set is saved', async () => {
    const plan = await createTrainingPlan(PUSH);
    const session = await startSessionFromDraft(draftFromPlan(plan), MONDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    const stored = (await gymSessionsRepository.get(session.id))!;
    expect(stored.planId).toBe(plan.id);
    expect(stored.exercises).toEqual([
      { exerciseId: 'ex_bench_press', name: 'Bench Press', order: 0, source: 'plan' },
      { exerciseId: 'ex_incline_press', name: 'Incline Dumbbell Press', order: 1, source: 'plan' },
      { exerciseId: 'ex_cable_lateral_raise', name: 'Cable Lateral Raise', order: 2, source: 'plan' },
      { exerciseId: 'ex_triceps_pushdown', name: 'Triceps Pushdown', order: 3, source: 'plan' },
    ]);
    // The session renders every plan exercise, with or without a set.
    const view = (await loadSession(session.id))!;
    expect(view.exercises.map((entry) => [entry.exercise.id, entry.sets.length])).toEqual([
      ['ex_bench_press', 1],
      ['ex_incline_press', 0],
      ['ex_cable_lateral_raise', 0],
      ['ex_triceps_pushdown', 0],
    ]);
    const day = await loadDay(MONDAY);
    expect(day.training.find((entry) => entry.domain === 'gym')?.sessions).toHaveLength(1);
  });

  it('continues the day’s existing session rather than seeding a second one', async () => {
    const free = await openSessionForDay(MONDAY);
    await addSet({ sessionId: free.id, exerciseId: 'ex_squat', reps: 5, weightGrams: kg(100) });
    const plan = await createTrainingPlan(PUSH);
    const session = await startSessionFromDraft(draftFromPlan(plan), MONDAY);
    expect(session.id).toBe(free.id);
    expect(await gymSessionsRepository.getAll()).toHaveLength(1);
  });

  it('never overwrites a snapshot a session already has', async () => {
    const push = await createTrainingPlan(PUSH);
    const legs = await createTrainingPlan({ name: 'Legs', exercises: [{ exerciseId: 'ex_squat' }] });
    const first = await startSessionFromDraft(draftFromPlan(push), MONDAY);
    const again = await startSessionFromDraft(draftFromPlan(legs), MONDAY);
    expect(again.id).toBe(first.id);
    expect(again.exercises?.map((entry) => entry.exerciseId)).toEqual(PUSH.exercises.map((line) => line.exerciseId));
    expect(again.planId).toBe(push.id);
  });
});

/* ── Referential integrity ──────────────────────────────────────────────── */

describe('a session started from a plan', () => {
  async function logged(): Promise<{ plan: TrainingPlanRecord; sessionId: string; record: string; view: string }> {
    const plan = await createTrainingPlan(PUSH);
    const session = await startSessionFromDraft(draftFromPlan(plan), MONDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(62.5) });
    await addSet({ sessionId: session.id, exerciseId: 'ex_incline_press', reps: 10, weightGrams: kg(24) });
    const record = canonicalJson(await gymSessionsRepository.get(session.id));
    const view = canonicalJson(await loadSession(session.id));
    return { plan, sessionId: session.id, record, view };
  }

  it('is unchanged when the plan is edited, reordered, renamed and deleted', async () => {
    const { plan, sessionId, record, view } = await logged();
    const sets = canonicalJson(await gymSetsRepository.listBySession(sessionId));

    await updateTrainingPlan(plan.id, {
      name: 'Push A',
      exercises: [{ exerciseId: 'ex_bench_press' }, { exerciseId: 'ex_dip' }],
    });
    expect(canonicalJson(await gymSessionsRepository.get(sessionId))).toBe(record);
    expect(canonicalJson(await loadSession(sessionId))).toBe(view);

    await updateTrainingPlan(plan.id, {
      name: 'Push A',
      exercises: [{ exerciseId: 'ex_dip' }, { exerciseId: 'ex_bench_press' }],
    });
    expect(canonicalJson(await gymSessionsRepository.get(sessionId))).toBe(record);
    expect(canonicalJson(await loadSession(sessionId))).toBe(view);

    await updateTrainingPlan(plan.id, {
      name: 'Umbenannt',
      exercises: [{ exerciseId: 'ex_dip' }, { exerciseId: 'ex_bench_press' }],
    });
    expect(canonicalJson(await gymSessionsRepository.get(sessionId))).toBe(record);
    expect(canonicalJson(await loadSession(sessionId))).toBe(view);

    await deleteTrainingPlan(plan.id);
    expect(await getTrainingPlan(plan.id)).toBeUndefined();
    expect(canonicalJson(await gymSessionsRepository.get(sessionId))).toBe(record);
    expect(canonicalJson(await loadSession(sessionId))).toBe(view);
    expect(canonicalJson(await gymSetsRepository.listBySession(sessionId))).toBe(sets);
  });

  it('still renders when the exercise record itself is gone, from its own snapshot', async () => {
    const { sessionId } = await logged();
    await exercisesRepository.remove('ex_cable_lateral_raise');
    const view = (await loadSession(sessionId))!;
    const entry = view.exercises.find((item) => item.exercise.id === 'ex_cable_lateral_raise')!;
    expect(entry.exercise.name).toBe('Cable Lateral Raise');
    expect(entry.source).toBe('plan');
  });
});

/* ── Extras ─────────────────────────────────────────────────────────────── */

describe('an extra exercise during a planned session', () => {
  it('lands in the session snapshot and never in the plan', async () => {
    const plan = await createTrainingPlan(PUSH);
    const planBefore = canonicalJson(await getTrainingPlan(plan.id));
    const session = await startSessionFromDraft(draftFromPlan(plan), MONDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    await addSessionExercise(session.id, 'ex_face_pull');
    await addSet({ sessionId: session.id, exerciseId: 'ex_face_pull', reps: 15, weightGrams: kg(20) });

    const stored = (await gymSessionsRepository.get(session.id))!;
    expect(stored.exercises?.[stored.exercises.length - 1]).toEqual({ exerciseId: 'ex_face_pull', name: 'Face Pulls', order: 4, source: 'extra' });
    expect(canonicalJson(await getTrainingPlan(plan.id))).toBe(planBefore);
    const view = (await loadSession(session.id))!;
    expect(view.exercises[view.exercises.length - 1]?.source).toBe('extra');
  });

  it('is added once, however often the call is repeated', async () => {
    const plan = await createTrainingPlan(PUSH);
    const session = await startSessionFromDraft(draftFromPlan(plan), MONDAY);
    await addSessionExercise(session.id, 'ex_face_pull');
    await addSessionExercise(session.id, 'ex_face_pull');
    await addSessionExercise(session.id, 'ex_bench_press');
    expect((await gymSessionsRepository.get(session.id))!.exercises).toHaveLength(5);
  });

  it('is removed from the snapshot with its sets, and the plan stays whole', async () => {
    const plan = await createTrainingPlan(PUSH);
    const session = await startSessionFromDraft(draftFromPlan(plan), MONDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    await addSet({ sessionId: session.id, exerciseId: 'ex_incline_press', reps: 8, weightGrams: kg(24) });
    await removeExerciseFromSession(session.id, 'ex_incline_press');
    // The bench press keeps the session (an emptied one would go, D137).
    const stored = (await gymSessionsRepository.get(session.id))!;
    expect(stored.exercises?.map((entry) => [entry.exerciseId, entry.order])).toEqual([
      ['ex_bench_press', 0],
      ['ex_cable_lateral_raise', 1],
      ['ex_triceps_pushdown', 2],
    ]);
    expect((await getTrainingPlan(plan.id))!.exercises).toHaveLength(4);
  });
});

/* ── Idempotency ────────────────────────────────────────────────────────── */

describe('idempotency', () => {
  it('starting the same planned workout twice yields one session and one snapshot', async () => {
    const plan = await createTrainingPlan(PUSH);
    const draft = draftFromPlan(plan);
    const first = await startSessionFromDraft(draft, MONDAY);
    const second = await startSessionFromDraft(draft, MONDAY);
    expect(second.id).toBe(first.id);
    expect(await gymSessionsRepository.getAll()).toHaveLength(1);
    expect(second.exercises).toHaveLength(4);
    expect(new Set(second.exercises!.map((entry) => entry.exerciseId)).size).toBe(4);
  });

  it('repeating a set mutation leaves one set with one value', async () => {
    const plan = await createTrainingPlan(PUSH);
    const session = await startSessionFromDraft(draftFromPlan(plan), MONDAY);
    const set = await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    await updateSet(set.id, { weightGrams: kg(62.5) });
    await updateSet(set.id, { weightGrams: kg(62.5) });
    const sets = await gymSetsRepository.listBySession(session.id);
    expect(sets).toHaveLength(1);
    expect(sets[0]?.weightGrams).toBe(62500);
    expect(sets[0]?.id).toBe(set.id);
  });

  it('reloading after one set continues the same session with the remaining plan lines', async () => {
    const plan = await createTrainingPlan(PUSH);
    const session = await startSessionFromDraft(draftFromPlan(plan), MONDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });

    // A reload: the screen finds today's session and reopens it.
    await closeDatabase();
    const day = await loadDay(MONDAY);
    const todays = day.training.find((entry) => entry.domain === 'gym')!.sessionsToday;
    expect(todays.map((entry) => entry.id)).toEqual([session.id]);
    const view = (await loadSession(session.id))!;
    expect(view.exercises.map((entry) => [entry.exercise.id, entry.sets.length])).toEqual([
      ['ex_bench_press', 1],
      ['ex_incline_press', 0],
      ['ex_cable_lateral_raise', 0],
      ['ex_triceps_pushdown', 0],
    ]);

    // Logging continues on the same rows.
    await addSet({ sessionId: session.id, exerciseId: 'ex_incline_press', reps: 10, weightGrams: kg(24) });
    expect(await gymSessionsRepository.getAll()).toHaveLength(1);
    expect(await gymSetsRepository.getAll()).toHaveLength(2);
    expect((await gymSessionsRepository.get(session.id))!.exercises).toHaveLength(4);
  });
});

/* ── Last time ──────────────────────────────────────────────────────────── */

describe('what the user did last time', () => {
  it('reads the most recent earlier day, in set order, and never the session on screen', async () => {
    // Set up a week earlier, so those days can be logged as they happen.
    await deleteDatabase();
    freezeAt('2026-02-20');
    await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
    await ensureExerciseCatalogue();
    freezeAt('2026-02-23');
    const earlier = await openSessionForDay('2026-02-23');
    await addSet({ sessionId: earlier.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(55) });
    await addSet({ sessionId: earlier.id, exerciseId: 'ex_bench_press', reps: 6, weightGrams: kg(57.5) });
    freezeAt('2026-02-25');
    const later = await openSessionForDay('2026-02-25');
    await addSet({ sessionId: later.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(60) });
    await addSet({ sessionId: later.id, exerciseId: 'ex_bench_press', reps: 0, weightGrams: kg(60) });

    freezeAt(MONDAY);
    const plan = await createTrainingPlan(PUSH);
    const draft = await loadDraftView(draftFromPlan(plan), MONDAY);
    expect(draft.exercises[0]?.lastRecorded).toEqual({ date: '2026-02-25', sets: [{ reps: 8, weightGrams: 60000 }] });
    expect(draft.exercises[1]?.lastRecorded).toBeNull();

    const session = await startSessionFromDraft(draftFromPlan(plan), MONDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: kg(62.5) });
    expect(await lastRecordedFor('ex_bench_press', session.id, MONDAY)).toEqual({
      date: '2026-02-25',
      sets: [{ reps: 8, weightGrams: 60000 }],
    });
    const view = (await loadSession(session.id))!;
    expect(view.exercises[0]?.lastRecorded?.date).toBe('2026-02-25');
  });
});
