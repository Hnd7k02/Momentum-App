import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { workVolumeByWeek } from '../../core/gym/volume';
import { closeDatabase, deleteDatabase } from '../db';
import { applyOnboarding } from './configurationService';
import {
  addSet,
  ensureExerciseCatalogue,
  lastTrainedBefore,
  loadGymHistory,
  loadGymRange,
  openSessionForDay,
  recordBodyweight,
  updateSet,
} from './gymService';

/**
 * A range's history with the sets it was read from (block 7C).
 *
 * `loadGymRange` hands on what `loadGymHistory` reads — for the work volume,
 * which is shown and never scored (D152) — and `lastTrainedBefore` answers
 * one question the range cannot: when a group was last trained before it.
 * Neither stores anything, and the history is the one it always was.
 */

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

const kg = (value: number) => value * 1000;
const BENCH = 'ex_bench_press';
const PULL_UP = 'ex_pull_up';
const SQUAT = 'ex_squat';

/** Logs one day: the clock stands on it, so the day is writable (D133). */
async function logDay(
  day: string,
  sets: { exerciseId: string; reps: number; weight: number; warmUp?: boolean }[],
): Promise<void> {
  freezeAt(day);
  const session = await openSessionForDay(day);
  for (const entry of sets) {
    const set = await addSet({ sessionId: session.id, exerciseId: entry.exerciseId, reps: entry.reps, weightGrams: kg(entry.weight) });
    if (entry.warmUp) await updateSet(set.id, { warmUp: true });
  }
}

beforeEach(async () => {
  await deleteDatabase();
  freezeAt('2026-09-01');
  await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
  await ensureExerciseCatalogue();
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

describe('loadGymRange', () => {
  beforeEach(async () => {
    await logDay('2026-09-02', [{ exerciseId: SQUAT, reps: 5, weight: 100 }]);
    await logDay('2026-11-02', [
      { exerciseId: BENCH, reps: 12, weight: 40, warmUp: true },
      { exerciseId: BENCH, reps: 8, weight: 80 },
      { exerciseId: BENCH, reps: 8, weight: 80 },
    ]);
    await logDay('2026-11-09', [{ exerciseId: BENCH, reps: 9, weight: 80 }]);
    freezeAt('2026-11-15');
  });

  it('carries the history loadGymHistory returns, unchanged', async () => {
    const range = await loadGymRange('2026-10-17', '2026-11-15');
    expect(range.history).toEqual(await loadGymHistory('2026-10-17', '2026-11-15'));
    expect(range.history.days.map((day) => [day.date, day.exerciseId])).toEqual([
      ['2026-11-02', BENCH],
      ['2026-11-09', BENCH],
    ]);
  });

  it('hands on every set of the range, the warm-ups among them and marked', async () => {
    const { sets } = await loadGymRange('2026-10-17', '2026-11-15');
    expect(sets.map((day) => [day.date, day.exerciseId, day.sets.length])).toEqual([
      ['2026-11-02', BENCH, 3],
      ['2026-11-09', BENCH, 1],
    ]);
    expect(sets[0]!.sets.map((set) => [set.reps, set.weightGrams, set.warmUp === true])).toEqual([
      [12, 40_000, true],
      [8, 80_000, false],
      [8, 80_000, false],
    ]);
    // The groups and roles are the ones the sets were logged under.
    expect(sets[0]!.muscles).toContain('chest');
    expect(sets[0]!.primaryMuscles).toEqual(['chest']);
  });

  it('holds nothing from outside the range', async () => {
    const { sets, history } = await loadGymRange('2026-10-17', '2026-11-15');
    expect(sets.some((day) => day.exerciseId === SQUAT)).toBe(false);
    expect(history.days.some((day) => day.exerciseId === SQUAT)).toBe(false);
  });

  it('gives the work volume: working sets only, by the group\'s share', async () => {
    const { sets } = await loadGymRange('2026-10-17', '2026-11-15');
    const chest = workVolumeByWeek(sets).chest;
    const share = chest[0]!.volume / (16 * 80_000);
    // Two working sets of 8 × 80 kg; the warm-up of 12 × 40 kg is out. The
    // chest takes the primary share of the bench press, whatever that is.
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThanOrEqual(1);
    expect(chest.map((week) => week.week)).toEqual(['2026-W45', '2026-W46']);
    expect(chest[1]!.volume).toBeCloseTo(9 * 80_000 * share, 6);
  });

  it('resolves a bodyweight set with the weight in force on its day, as the metric does', async () => {
    freezeAt('2026-11-10');
    await recordBodyweight(78, '2026-11-10');
    await logDay('2026-11-10', [{ exerciseId: PULL_UP, reps: 6, weight: 10 }]);
    freezeAt('2026-11-15');
    const { sets, history } = await loadGymRange('2026-10-17', '2026-11-15');
    const pullUp = sets.find((day) => day.exerciseId === PULL_UP)!;
    expect(pullUp.sets[0]!.weightGrams).toBe(88_000);
    expect(history.days.find((day) => day.exerciseId === PULL_UP)!.best.set.weightGrams).toBe(88_000);
  });

  it('writes nothing', async () => {
    const before = JSON.stringify(await loadGymHistory('2026-01-01', '2026-11-15'));
    await loadGymRange('2026-10-17', '2026-11-15');
    await lastTrainedBefore('2026-10-17');
    expect(JSON.stringify(await loadGymHistory('2026-01-01', '2026-11-15'))).toBe(before);
  });
});

describe('lastTrainedBefore', () => {
  it('names each group\'s latest day before the day given, and no group that was never trained', async () => {
    await logDay('2026-09-02', [{ exerciseId: SQUAT, reps: 5, weight: 100 }]);
    await logDay('2026-09-09', [{ exerciseId: SQUAT, reps: 5, weight: 100 }]);
    await logDay('2026-10-01', [{ exerciseId: BENCH, reps: 8, weight: 80 }]);
    freezeAt('2026-11-15');
    const last = await lastTrainedBefore('2026-10-17');
    expect(last.quadriceps).toBe('2026-09-09');
    expect(last.chest).toBe('2026-10-01');
    expect(last.calves).toBeUndefined();
  });

  it('does not count the day itself, nor any day after', async () => {
    await logDay('2026-10-16', [{ exerciseId: BENCH, reps: 8, weight: 80 }]);
    await logDay('2026-10-17', [{ exerciseId: SQUAT, reps: 5, weight: 100 }]);
    await logDay('2026-11-02', [{ exerciseId: SQUAT, reps: 5, weight: 100 }]);
    freezeAt('2026-11-15');
    const last = await lastTrainedBefore('2026-10-17');
    expect(last.chest).toBe('2026-10-16');
    expect(last.quadriceps).toBeUndefined();
  });

  it('is empty before the first session', async () => {
    expect(await lastTrainedBefore('2026-10-17')).toEqual({});
  });
});
