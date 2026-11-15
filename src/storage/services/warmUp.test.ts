import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BACKUP_FORMAT_VERSION } from '../../core/backup/format';
import { setClock } from '../../core/clock';
import { SCHEMA_VERSION } from '../../core/model';
import { closeDatabase, deleteDatabase } from '../db';
import { gymSessionsRepository, gymSetsRepository, settingsRepository } from '../repositories';
import { exportBackup, importBackup } from './backupService';
import { loadBossProgression } from './bossService';
import { EditWindowError } from './checkInService';
import { applyOnboarding } from './configurationService';
import {
  addSet,
  ensureExerciseCatalogue,
  finishSession,
  lastRecordedFor,
  loadGymHistory,
  loadRunningWorkout,
  loadSession,
  openSessionForDay,
  recordBodyweight,
  removeExerciseFromSession,
  removeSet,
  repeatLastSet,
  restoreExercise,
  restoreSet,
  toggleWarmUp,
  updateSet,
} from './gymService';
import { withoutGymMetricEra } from './fixtures/legacyGymMetric';

/**
 * The warm-up set (WP3 Stage 5b, D151).
 *
 * A fact on the set, off by default, set by hand. It is a set like any
 * other for the session and the week, and it is never the exercise-day
 * value, never "Bester Arbeitssatz" and never a mark to train against.
 */

const MONDAY = '2026-10-12';
const TUESDAY = '2026-10-13';
const WEDNESDAY = '2026-10-14';
const THURSDAY = '2026-10-15';

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

const kg = (value: number) => value * 1000;
const BENCH = 'ex_bench_press';

beforeEach(async () => {
  await deleteDatabase();
  freezeAt(MONDAY);
  await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
  await ensureExerciseCatalogue();
  freezeAt(WEDNESDAY);
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

async function benchSet(sessionId: string, reps: number, weight: number) {
  return addSet({ sessionId, exerciseId: BENCH, reps, weightGrams: kg(weight) });
}

describe('the mark', () => {
  it('is off by default: a new set carries no such field', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const set = await benchSet(session.id, 10, 40);
    expect('warmUp' in set).toBe(false);
    expect('warmUp' in (await gymSetsRepository.get(set.id))!).toBe(false);
  });

  it('is set and taken off again, and an unmarked set is the record it was', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const set = await benchSet(session.id, 10, 40);

    const marked = await updateSet(set.id, { warmUp: true });
    expect(marked?.warmUp).toBe(true);
    expect((await gymSetsRepository.get(set.id))?.warmUp).toBe(true);
    // Nothing else about the set moved.
    expect({ ...marked, warmUp: undefined }).toEqual({ ...set, warmUp: undefined });

    const unmarked = await updateSet(set.id, { warmUp: false });
    expect(unmarked).toEqual(set);
    expect('warmUp' in (await gymSetsRepository.get(set.id))!).toBe(false);
  });

  it('is left as it is by a correction of the reps or the weight', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const set = await benchSet(session.id, 10, 40);
    await updateSet(set.id, { warmUp: true });
    expect((await updateSet(set.id, { reps: 12 }))?.warmUp).toBe(true);
    expect((await updateSet(set.id, { weightGrams: kg(42.5) }))?.warmUp).toBe(true);
  });

  it('is toggled from the set as it is stored', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const set = await benchSet(session.id, 10, 40);
    expect((await toggleWarmUp(set.id))?.warmUp).toBe(true);
    expect('warmUp' in (await toggleWarmUp(set.id))!).toBe(false);
    expect(await toggleWarmUp('set_unknown')).toBeUndefined();
  });

  it('can be set today and yesterday, and not on an older day (D133)', async () => {
    freezeAt(TUESDAY);
    const tuesday = await openSessionForDay(TUESDAY);
    const older = await benchSet(tuesday.id, 10, 40);
    freezeAt(WEDNESDAY);
    const wednesday = await openSessionForDay(WEDNESDAY);
    const yesterdays = await benchSet(wednesday.id, 10, 40);

    freezeAt(THURSDAY);
    expect((await toggleWarmUp(yesterdays.id))?.warmUp).toBe(true);
    await expect(toggleWarmUp(older.id)).rejects.toBeInstanceOf(EditWindowError);
    await expect(updateSet(older.id, { warmUp: true })).rejects.toBeInstanceOf(EditWindowError);
    expect('warmUp' in (await gymSetsRepository.get(older.id))!).toBe(false);
  });

  it('does not reopen a finished workout', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const set = await benchSet(session.id, 10, 40);
    await finishSession(session.id);
    await toggleWarmUp(set.id);
    expect(typeof (await gymSessionsRepository.get(session.id))?.finishedAt).toBe('string');
  });
});

describe('a warm-up set is a set', () => {
  it('opens the session and counts for the week, alone', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const set = await benchSet(session.id, 10, 40);
    await toggleWarmUp(set.id);

    expect(await gymSessionsRepository.get(session.id)).toBeDefined();
    expect(await loadRunningWorkout(WEDNESDAY)).toMatchObject({ sessionId: session.id, exercises: 1, sets: 1 });
    const boss = await loadBossProgression(WEDNESDAY);
    expect(boss.gym.sessionsThisWeek).toBe(1);
    const week = boss.history.weeks[boss.history.weeks.length - 1]!;
    expect(week.domains.find((domain) => domain.domain === 'gym')?.sessions).toBe(1);
  });

  it('but provides no exercise-day: no value, and never a zero', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const set = await benchSet(session.id, 10, 40);
    await toggleWarmUp(set.id);

    const history = await loadGymHistory(MONDAY, WEDNESDAY);
    expect(history.days).toEqual([]);
    expect(history.overall.untrained).toContain('chest');
    // The range can say why it has nothing to evaluate: warm-up sets only.
    expect(history.warmUpOnly).toEqual([BENCH]);
    expect(history.awaitingBodyweight).toEqual([]);
    const view = await loadSession(session.id);
    expect(view?.exercises[0]?.bestScore).toBeNull();
    expect(view?.exercises[0]?.bestSetId).toBeNull();
    expect(view?.exercises[0]?.sets).toHaveLength(1);
  });
});

describe('the best working set', () => {
  it('is never the warm-up set, however it scores', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    // Marked wrongly on purpose: the heaviest set of the day.
    const heavy = await benchSet(session.id, 5, 100);
    const work = await benchSet(session.id, 8, 60);
    await toggleWarmUp(heavy.id);

    const view = await loadSession(session.id);
    expect(view?.exercises[0]?.bestSetId).toBe(work.id);
    expect(view?.exercises[0]?.bestScore).toBe(kg(60) * 38);
    const history = await loadGymHistory(MONDAY, WEDNESDAY);
    expect(history.days[0]?.best.set.id).toBe(work.id);
    expect(history.days[0]?.best.score).toBe(kg(60) * 38);
    // An exercise with a working set is not "warm-up only", marked sets or not.
    expect(history.warmUpOnly).toEqual([]);

    // Unmarked again, it is the best working set.
    await toggleWarmUp(heavy.id);
    expect((await loadSession(session.id))?.exercises[0]?.bestSetId).toBe(heavy.id);
  });

  it('is named by the load the set asked of the body, as the metric reads it', async () => {
    // A bodyweight exercise: ten with no added weight outscores five with
    // ten kilograms added at 80 kg — 80 × 40 against 90 × 35 — although the
    // number typed for the second is the larger.
    await recordBodyweight(80, WEDNESDAY);
    const session = await openSessionForDay(WEDNESDAY);
    const many = await addSet({ sessionId: session.id, exerciseId: 'ex_pull_up', reps: 10, weightGrams: 0 });
    await addSet({ sessionId: session.id, exerciseId: 'ex_pull_up', reps: 5, weightGrams: kg(10) });
    const view = await loadSession(session.id);
    expect(view?.exercises[0]?.bestSetId).toBe(many.id);
    expect(view?.exercises[0]?.bestScore).toBe(kg(80) * 40);
  });

  it('is not read by the metric before Stage 5b: there every set counts', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const heavy = await benchSet(session.id, 5, 100);
    await benchSet(session.id, 8, 60);
    await toggleWarmUp(heavy.id);
    await withoutGymMetricEra();

    const history = await loadGymHistory(MONDAY, WEDNESDAY);
    expect(history.metric).toBeNull();
    expect(history.days[0]?.best.set.id).toBe(heavy.id);
    expect(history.days[0]?.best.score).toBe(5 * kg(100));
    expect((await loadSession(session.id))?.exercises[0]?.bestSetId).toBe(heavy.id);
  });
});

describe('"+ Satz"', () => {
  it('copies the reps and the weight of the set before it, and not the mark', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const warm = await benchSet(session.id, 10, 40);
    await toggleWarmUp(warm.id);

    const next = await repeatLastSet(session.id, BENCH);
    expect(next).toMatchObject({ reps: 10, weightGrams: kg(40), order: 1 });
    expect('warmUp' in next!).toBe(false);
    expect('warmUp' in (await gymSetsRepository.get(next!.id))!).toBe(false);
    // The set it was copied from keeps its mark.
    expect((await gymSetsRepository.get(warm.id))?.warmUp).toBe(true);
  });
});

describe('undo (D131)', () => {
  it('brings a removed set back with its mark', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const warm = await benchSet(session.id, 10, 40);
    await benchSet(session.id, 8, 60);
    const marked = (await toggleWarmUp(warm.id))!;

    const removed = await removeSet(warm.id);
    expect(removed?.set).toEqual(marked);
    expect(await gymSetsRepository.get(warm.id)).toBeUndefined();
    await restoreSet(removed!.set, undefined, removed!.session);
    expect(await gymSetsRepository.get(warm.id)).toEqual(marked);
  });

  it('brings back a workout that held only a warm-up set, session and mark', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const warm = await benchSet(session.id, 10, 40);
    const marked = (await toggleWarmUp(warm.id))!;
    const stored = (await gymSessionsRepository.get(session.id))!;

    const removed = await removeSet(warm.id);
    expect(removed?.session).toEqual(stored);
    await restoreSet(removed!.set, undefined, removed!.session);
    expect(await gymSetsRepository.get(warm.id)).toEqual(marked);
    expect(await gymSessionsRepository.get(session.id)).toEqual(stored);
  });

  it('brings a removed exercise back with every mark where it was', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const warm = await benchSet(session.id, 10, 40);
    const work = await benchSet(session.id, 8, 60);
    await addSet({ sessionId: session.id, exerciseId: 'ex_squat', reps: 5, weightGrams: kg(100) });
    await toggleWarmUp(warm.id);
    const before = await gymSetsRepository.listBySession(session.id);

    const removed = await removeExerciseFromSession(session.id, BENCH);
    expect(removed.sets.map((set) => [set.id, set.warmUp])).toEqual([[warm.id, true], [work.id, undefined]]);
    await restoreExercise(session.id, removed.sets, removed.line, undefined, removed.session);
    const byId = (sets: typeof before) => [...sets].sort((a, b) => a.id.localeCompare(b.id));
    expect(byId(await gymSetsRepository.listBySession(session.id))).toEqual(byId(before));
  });
});

describe('the last time', () => {
  it('lists the working sets only', async () => {
    freezeAt(MONDAY);
    const monday = await openSessionForDay(MONDAY);
    const warm = await benchSet(monday.id, 10, 40);
    await benchSet(monday.id, 8, 60);
    await benchSet(monday.id, 7, 60);
    await toggleWarmUp(warm.id);

    freezeAt(WEDNESDAY);
    expect(await lastRecordedFor(BENCH, null, WEDNESDAY)).toEqual({
      date: MONDAY,
      sets: [{ reps: 8, weightGrams: kg(60) }, { reps: 7, weightGrams: kg(60) }],
    });
  });

  it('passes over a day that held only warm-up sets, for the day before it', async () => {
    freezeAt(MONDAY);
    const monday = await openSessionForDay(MONDAY);
    await benchSet(monday.id, 8, 60);
    freezeAt(TUESDAY);
    const tuesday = await openSessionForDay(TUESDAY);
    const only = await benchSet(tuesday.id, 10, 40);
    await toggleWarmUp(only.id);

    freezeAt(WEDNESDAY);
    expect(await lastRecordedFor(BENCH, null, WEDNESDAY)).toEqual({ date: MONDAY, sets: [{ reps: 8, weightGrams: kg(60) }] });
    // In the workout: the line and the pending row's placeholder say Monday's working set.
    const wednesday = await openSessionForDay(WEDNESDAY);
    await addSet({ sessionId: wednesday.id, exerciseId: 'ex_squat', reps: 5, weightGrams: kg(100) });
    await benchSet(wednesday.id, 8, 62.5);
    const view = await loadSession(wednesday.id);
    expect(view?.exercises.find((entry) => entry.exercise.id === BENCH)?.lastRecorded?.date).toBe(MONDAY);
  });

  it('is nothing when the exercise has only ever been warmed up', async () => {
    freezeAt(MONDAY);
    const monday = await openSessionForDay(MONDAY);
    await toggleWarmUp((await benchSet(monday.id, 10, 40)).id);
    freezeAt(WEDNESDAY);
    expect(await lastRecordedFor(BENCH, null, WEDNESDAY)).toBeNull();
  });
});

describe('the backup', () => {
  it('carries the mark out and back in, and leaves an unmarked set without the field', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const warm = await benchSet(session.id, 10, 40);
    const work = await benchSet(session.id, 8, 60);
    await toggleWarmUp(warm.id);
    const stored = await gymSetsRepository.getAll();

    const backup = await exportBackup();
    expect(backup.formatVersion).toBe(3);
    expect(backup.schemaVersion).toBe(5);
    // The versions this stage must not move.
    expect(BACKUP_FORMAT_VERSION).toBe(3);
    expect(SCHEMA_VERSION).toBe(5);
    const text = JSON.stringify(backup);
    expect((backup.data.gymSets as { id: string; warmUp?: boolean }[]).find((set) => set.id === warm.id)?.warmUp).toBe(true);

    await closeDatabase();
    await deleteDatabase();
    const result = await importBackup(text);
    expect(result.ok).toBe(true);
    const byId = (sets: typeof stored) => [...sets].sort((a, b) => a.id.localeCompare(b.id));
    expect(byId(await gymSetsRepository.getAll())).toEqual(byId(stored));
    expect((await gymSetsRepository.get(warm.id))?.warmUp).toBe(true);
    expect('warmUp' in (await gymSetsRepository.get(work.id))!).toBe(false);
    // And it computes the same after the round trip.
    const history = await loadGymHistory(MONDAY, WEDNESDAY);
    expect(history.days[0]?.best.set.id).toBe(work.id);
  });
});

describe('the hint that says where the mark is (D175)', () => {
  it('stands until a set has been marked once, and never again after', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const warm = await benchSet(session.id, 10, 40);
    await benchSet(session.id, 8, 60);
    expect((await settingsRepository.get())?.warmUpMarkUsed).toBeUndefined();
    expect((await loadSession(session.id))?.warmUpHint).toBe(true);

    // The first mark ends it…
    await toggleWarmUp(warm.id);
    expect((await settingsRepository.get())?.warmUpMarkUsed).toBe(true);
    expect((await loadSession(session.id))?.warmUpHint).toBe(false);

    // …and taking the mark off again does not bring it back: it records
    // that the user has found the mark, not that a set carries one.
    await toggleWarmUp(warm.id);
    expect('warmUp' in (await gymSetsRepository.get(warm.id))!).toBe(false);
    expect((await loadSession(session.id))?.warmUpHint).toBe(false);

    // Nor does another workout on another day.
    freezeAt(THURSDAY);
    const next = await openSessionForDay(THURSDAY);
    await benchSet(next.id, 8, 60);
    expect((await loadSession(next.id))?.warmUpHint).toBe(false);
  });

  it('is written the first time only: a later mark leaves the settings record as it is', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const first = await benchSet(session.id, 10, 40);
    const second = await benchSet(session.id, 10, 50);
    await toggleWarmUp(first.id);
    const after = await settingsRepository.get();
    freezeAt(WEDNESDAY, 18);
    await toggleWarmUp(second.id);
    expect(await settingsRepository.get()).toEqual(after);
  });

  it('is not ended by a correction of reps or weight, nor by taking a mark off', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const set = await benchSet(session.id, 10, 40);
    await updateSet(set.id, { reps: 11 });
    await updateSet(set.id, { warmUp: false });
    expect((await settingsRepository.get())?.warmUpMarkUsed).toBeUndefined();
    expect((await loadSession(session.id))?.warmUpHint).toBe(true);
  });

  it('travels with a backup, and a backup from before it shows the hint again', async () => {
    const session = await openSessionForDay(WEDNESDAY);
    const set = await benchSet(session.id, 10, 40);
    const before = JSON.stringify(await exportBackup());
    await toggleWarmUp(set.id);
    const after = JSON.stringify(await exportBackup());

    await closeDatabase();
    await deleteDatabase();
    expect((await importBackup(after)).ok).toBe(true);
    expect((await loadSession(session.id))?.warmUpHint).toBe(false);

    await closeDatabase();
    await deleteDatabase();
    expect((await importBackup(before)).ok).toBe(true);
    expect((await loadSession(session.id))?.warmUpHint).toBe(true);
    // Neither version moved for it.
    expect(BACKUP_FORMAT_VERSION).toBe(3);
    expect(SCHEMA_VERSION).toBe(5);
  });
});
