import { describe, expect, it } from 'vitest';
import type { MuscleGroup } from '../model';
import type { ExerciseDayInput, SetInput } from './performance';
import { exerciseDayVolume, isWorkingSet, workVolumeByWeek } from './volume';

/**
 * Work volume (D152): the sum of reps × effective load over the working
 * sets, per muscle group and week. Shown beside the metric and never scored;
 * that nothing which scores reads it is held by `volumeUnscored.test.ts`.
 */

let ids = 0;
const set = (reps: number, kg: number, extra: Partial<SetInput> = {}): SetInput => ({
  id: `s${(ids += 1)}`,
  reps,
  weightGrams: Math.round(kg * 1000),
  order: ids,
  ...extra,
});

const day = (
  date: string,
  exerciseId: string,
  muscles: MuscleGroup[],
  primary: MuscleGroup[] | undefined,
  sets: SetInput[],
): ExerciseDayInput => ({ date, exerciseId, muscles, ...(primary === undefined ? {} : { primaryMuscles: primary }), sets });

/** Bench press: the chest is primary, triceps and shoulders are secondary — 70, 15 and 15 %. */
const bench = (date: string, sets: SetInput[]) => day(date, 'ex_bench_press', ['chest', 'triceps', 'shoulders'], ['chest'], sets);

describe('the work of one exercise on one day', () => {
  it('is the sum of reps × load over its sets', () => {
    // 3 × (8 × 80 kg) = 1 920 kg, in gram-reps.
    expect(exerciseDayVolume([set(8, 80), set(8, 80), set(8, 80)])).toBe(1_920_000);
  });

  it('leaves out a set marked as a warm-up', () => {
    expect(exerciseDayVolume([set(10, 40, { warmUp: true }), set(8, 80)])).toBe(640_000);
    expect(isWorkingSet(set(10, 40, { warmUp: true }))).toBe(false);
  });

  it('leaves out a set that describes no work: no reps, or no load', () => {
    expect(exerciseDayVolume([set(0, 80), set(8, 0), set(8, 80)])).toBe(640_000);
    expect(isWorkingSet(set(0, 80))).toBe(false);
    expect(isWorkingSet(set(8, 0))).toBe(false);
  });

  it('reads the load it is handed — the effective one, as the metric does', () => {
    // A pull-up at 78 kg bodyweight with 10 kg added is handed in as 88 kg.
    expect(exerciseDayVolume([set(6, 88)])).toBe(528_000);
  });
});

describe('the volume of a group in a week', () => {
  it('spreads an exercise over its groups by the shares the rating uses, and loses nothing', () => {
    // Monday 2 November 2026: 1 920 kg of bench press.
    const weeks = workVolumeByWeek([bench('2026-11-02', [set(8, 80), set(8, 80), set(8, 80)])]);
    expect(weeks.chest).toEqual([{ week: '2026-W45', volume: 1_920_000 * 0.7 }]);
    expect(weeks.triceps[0]!.volume).toBeCloseTo(1_920_000 * 0.15, 6);
    expect(weeks.shoulders[0]!.volume).toBeCloseTo(1_920_000 * 0.15, 6);
    const total = weeks.chest[0]!.volume + weeks.triceps[0]!.volume + weeks.shoulders[0]!.volume;
    expect(total).toBeCloseTo(1_920_000, 6);
    // A group the exercise does not reach has no week at all.
    expect(weeks.back).toEqual([]);
  });

  it('gives an exercise with no secondaries wholly to its primaries, and one without roles to all alike', () => {
    const fly = day('2026-11-02', 'ex_cable_fly', ['chest'], ['chest'], [set(12, 20)]);
    expect(workVolumeByWeek([fly]).chest[0]!.volume).toBe(240_000);
    // A set logged before roles were recorded: equal shares (D92).
    const old = day('2026-11-02', 'ex_old', ['chest', 'triceps'], undefined, [set(10, 50)]);
    const weeks = workVolumeByWeek([old]);
    expect(weeks.chest[0]!.volume).toBe(250_000);
    expect(weeks.triceps[0]!.volume).toBe(250_000);
  });

  it('adds the exercises and the days of one week, and begins a week on its Monday', () => {
    const weeks = workVolumeByWeek([
      // Sunday 8 November is the last day of week 45, Monday 9 November the first of week 46.
      bench('2026-11-04', [set(8, 80)]),
      day('2026-11-08', 'ex_cable_fly', ['chest'], ['chest'], [set(12, 20)]),
      bench('2026-11-09', [set(8, 82.5)]),
    ]);
    expect(weeks.chest).toEqual([
      { week: '2026-W45', volume: 640_000 * 0.7 + 240_000 },
      { week: '2026-W46', volume: 660_000 * 0.7 },
    ]);
  });

  it('leaves a week without a working set of the group out: a gap, not a nought', () => {
    const weeks = workVolumeByWeek([
      bench('2026-10-26', [set(8, 80)]),
      // Week 45: only warm-up sets, which are no work.
      bench('2026-11-03', [set(10, 40, { warmUp: true })]),
      bench('2026-11-10', [set(8, 80)]),
    ]);
    expect(weeks.chest.map((entry) => entry.week)).toEqual(['2026-W44', '2026-W46']);
  });

  it('keeps a week with the year it belongs to across New Year', () => {
    // Thursday 31 December 2026 and Friday 1 January 2027 are both in week 53 of 2026.
    const weeks = workVolumeByWeek([bench('2026-12-31', [set(8, 80)]), bench('2027-01-01', [set(8, 80)])]);
    expect(weeks.chest).toEqual([{ week: '2026-W53', volume: 2 * 640_000 * 0.7 }]);
  });

  it('gives the same numbers whatever order the days are handed in', () => {
    const inputs = [
      bench('2026-11-02', [set(8, 80), set(7, 80)]),
      day('2026-11-02', 'ex_dip', ['triceps', 'chest'], ['triceps'], [set(9, 88)]),
      bench('2026-11-05', [set(8, 82.5)]),
      day('2026-11-06', 'ex_pushdown', ['triceps'], ['triceps'], [set(12, 27.5)]),
    ];
    const forwards = workVolumeByWeek(inputs);
    const backwards = workVolumeByWeek([...inputs].reverse());
    // To the bit: the sums are formed in one order.
    expect(backwards).toEqual(forwards);
    expect(Object.is(backwards.triceps[0]!.volume, forwards.triceps[0]!.volume)).toBe(true);
  });

  it('by the roles the day was logged under: mapping an exercise anew later moves no week already trained', () => {
    const before = day('2026-11-02', 'ex_row', ['back', 'biceps'], ['back'], [set(10, 60)]);
    // From the next week the same exercise is logged with the forearms as well.
    const after = day('2026-11-09', 'ex_row', ['back', 'biceps', 'forearms'], ['back'], [set(10, 60)]);
    const weeks = workVolumeByWeek([before, after]);
    expect(weeks.biceps).toEqual([
      { week: '2026-W45', volume: 600_000 * 0.3 },
      { week: '2026-W46', volume: 600_000 * 0.15 },
    ]);
    expect(weeks.forearms.map((entry) => entry.week)).toEqual(['2026-W46']);
  });
});
