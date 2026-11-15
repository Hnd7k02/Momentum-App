import { describe, expect, it } from 'vitest';
import type { GymMetric } from './metric';
import {
  bestSet,
  bestWorkingSet,
  comparedDays,
  compareExerciseDays,
  exerciseDays,
  exerciseSpans,
  gymPerformance,
  gymPerformanceInWindow,
  gymPerformanceOverSpan,
  median,
  percentChange,
  strengthScore,
  type ExerciseDay,
  type ExerciseDayInput,
  type SetInput,
} from './performance';

/**
 * The exercise-day metric of WP3 Stage 5b (D150, D151): the best working set
 * by the strength score, and the window comparison by medians.
 *
 * `performance.test.ts` holds the metric before it and is unchanged: every
 * function there is called without a metric and computes as it always did.
 */

const METRIC: GymMetric = { repsDivisor: 30, comparison: 'median' };
const FIRST_LAST: GymMetric = { repsDivisor: 30, comparison: 'firstLast' };

const kg = (value: number): number => Math.round(value * 1000);

let nextId = 0;
const set = (reps: number, weightKg: number, extra: Partial<SetInput> = {}): SetInput => ({
  id: `s${(nextId += 1)}`,
  reps,
  weightGrams: kg(weightKg),
  order: extra.order ?? nextId,
  ...(extra.warmUp === true ? { warmUp: true as const } : {}),
});

/** `[reps, kg]` pairs as the sets of one exercise on one day, in order. */
const sets = (...pairs: [reps: number, weightKg: number][]): SetInput[] =>
  pairs.map(([reps, weightKg], index) => set(reps, weightKg, { order: index }));

const day = (date: string, daySets: SetInput[], exerciseId = 'ex_bench_press'): ExerciseDayInput => ({
  date,
  exerciseId,
  muscles: ['chest', 'triceps', 'shoulders'],
  primaryMuscles: ['chest'],
  sets: daySets,
});

/** The day-over-day change of the second of two days, in percent. */
function change(before: SetInput[], after: SetInput[], metric: GymMetric | null = METRIC): number {
  const days = exerciseDays([day('2026-03-02', before), day('2026-03-05', after)], metric);
  const comparisons = compareExerciseDays(days);
  return percentChange(comparisons[comparisons.length - 1]!.ratio)!;
}

/* ── The score ──────────────────────────────────────────────────────────── */

describe('the strength score', () => {
  it('is load × (30 + reps): an integer that orders as load × (1 + reps ÷ 30)', () => {
    expect(strengthScore(set(5, 100), 30)).toBe(kg(100) * 35);
    expect(strengthScore(set(12, 80), 30)).toBe(kg(80) * 42);
    expect(Number.isInteger(strengthScore(set(7, 72.5), 30))).toBe(true);
    // As the score itself: 100 kg × (1 + 5 ÷ 30) = 116.67 kg.
    expect(strengthScore(set(5, 100), 30) / 30 / 1000).toBeCloseTo(116.6667, 4);
  });

  it('rises with the load and with the reps', () => {
    expect(strengthScore(set(8, 82.5), 30)).toBeGreaterThan(strengthScore(set(8, 80), 30));
    expect(strengthScore(set(9, 80), 30)).toBeGreaterThan(strengthScore(set(8, 80), 30));
  });

  it('takes its one constant from the metric', () => {
    expect(strengthScore(set(10, 50), 40)).toBe(kg(50) * 50);
  });

  it('compares two identical sets as equal, whatever the load', () => {
    for (const weight of [0.5, 2.5, 61.25, 102.5, 227.5]) {
      expect(strengthScore(set(7, weight), 30)).toBe(strengthScore(set(7, weight), 30));
    }
  });
});

/* ── The best working set ───────────────────────────────────────────────── */

describe('the best working set of a day', () => {
  it('is the highest strength score, not the highest reps × load', () => {
    // 10 × 50 kg is 500 kg-reps against 375 for 5 × 75 kg — the drop set
    // that was the old metric's one artefact (Gate G). By strength it is not.
    const day = sets([5, 75], [5, 75], [5, 75], [10, 50], [12, 40]);
    expect(bestSet(day)?.set.reps).toBe(10);
    const best = bestWorkingSet(day, 30)!;
    expect(best.set.reps).toBe(5);
    expect(best.set.weightGrams).toBe(kg(75));
    expect(best.score).toBe(kg(75) * 35);
  });

  it('never takes a set marked as a warm-up, however heavy', () => {
    const warm = set(5, 120, { order: 0, warmUp: true });
    const work = set(5, 100, { order: 1 });
    expect(bestWorkingSet([warm, work], 30)?.set).toBe(work);
  });

  it('is nothing at all when every set is a warm-up — no exercise-day, never a zero', () => {
    expect(bestWorkingSet([set(10, 20, { warmUp: true }), set(5, 40, { warmUp: true })], 30)).toBeNull();
    expect(exerciseDays([day('2026-03-02', [set(10, 20, { warmUp: true })])], METRIC)).toEqual([]);
  });

  it('drops what describes no work, as the metric before it does', () => {
    expect(bestWorkingSet([set(0, 100), set(5, 0)], 30)).toBeNull();
    expect(bestWorkingSet([{ id: 'x', reps: 5, weightGrams: 60000.5, order: 0 }], 30)).toBeNull();
  });

  it('names the earlier of two sets with one score, then the heavier', () => {
    // 80 kg × 9 and 78 kg × 10 have the same score: 80 × 39 = 78 × 40.
    expect(strengthScore(set(9, 80), 30)).toBe(strengthScore(set(10, 78), 30));
    const early = set(10, 78, { order: 1 });
    const late = set(9, 80, { order: 2 });
    expect(bestWorkingSet([late, early], 30)?.set).toBe(early);
    expect(bestWorkingSet([early, late], 30)?.set).toBe(early);
    // Same place in two sessions of one day: the heavier is named, either way round.
    const light = set(10, 78, { order: 0 });
    const heavy = set(9, 80, { order: 0 });
    expect(bestWorkingSet([light, heavy], 30)?.set).toBe(heavy);
    expect(bestWorkingSet([heavy, light], 30)?.set).toBe(heavy);
  });

  it('is not read by the metric before it: a marked set still counts there', () => {
    const warm = set(5, 120, { order: 0, warmUp: true });
    const work = set(5, 100, { order: 1 });
    expect(bestSet([warm, work])?.set).toBe(warm);
    const legacy = exerciseDays([day('2026-03-02', [warm, work])]);
    expect(legacy[0]?.best.score).toBe(5 * kg(120));
  });
});

/* ── The list ───────────────────────────────────────────────────────────── */

describe('the exercise-days under the Stage 5b metric', () => {
  it('stand by date and then by exercise id, whatever order they were handed in', () => {
    const inputs = [
      day('2026-03-05', sets([5, 100]), 'ex_squat'),
      day('2026-03-02', sets([5, 100]), 'ex_squat'),
      day('2026-03-05', sets([5, 60]), 'ex_bench_press'),
      day('2026-03-02', sets([8, 20]), 'ex_biceps_curl'),
    ];
    const order = (list: ExerciseDay[]) => list.map((entry) => `${entry.date} ${entry.exerciseId}`);
    const expected = [
      '2026-03-02 ex_biceps_curl',
      '2026-03-02 ex_squat',
      '2026-03-05 ex_bench_press',
      '2026-03-05 ex_squat',
    ];
    expect(order(exerciseDays(inputs, METRIC))).toEqual(expected);
    expect(order(exerciseDays([...inputs].reverse(), METRIC))).toEqual(expected);
    // Before the metric: by date only, a day's entries as they came.
    expect(order(exerciseDays(inputs))).toEqual([
      '2026-03-02 ex_squat',
      '2026-03-02 ex_biceps_curl',
      '2026-03-05 ex_squat',
      '2026-03-05 ex_bench_press',
    ]);
  });

  it('sorts ids by code unit, so no locale can reorder them', () => {
    const ids = ['ex_Z', 'ex_a', 'ex__b', 'ex_1', 'ex_ä'];
    const inputs = ids.map((id) => day('2026-03-02', sets([5, 100]), id));
    expect(exerciseDays(inputs, METRIC).map((entry) => entry.exerciseId)).toEqual([...ids].sort());
  });
});

/* ── The eight worked cases of the review, section E ────────────────────── */

describe('the cases of the November review, by the best working set and the strength score', () => {
  it('heavier, with the reps falling off: 3 × 5 at 100 kg → 5, 4, 3 at 102.5 kg is +2.5 %', () => {
    expect(change(sets([5, 100], [5, 100], [5, 100]), sets([5, 102.5], [4, 102.5], [3, 102.5]))).toBeCloseTo(2.5, 9);
  });

  it('a pyramid whose heaviest set rises from 6 × 90 to 6 × 95 is +5.6 %', () => {
    const before = sets([12, 60], [10, 70], [8, 80], [6, 90]);
    const after = sets([12, 60], [10, 70], [8, 80], [6, 95]);
    expect(change(before, after)).toBeCloseTo((95 / 90 - 1) * 100, 9);
    expect(change(before, after).toFixed(1)).toBe('5.6');
    // The old metric did not see it at all: its best was the 8 × 80.
    expect(change(before, after, null)).toBe(0);
  });

  it('the same work plus a lighter set of 8 × 70 is 0.0 %', () => {
    const work = sets([5, 100], [5, 100], [5, 100]);
    expect(change(work, [...work, set(8, 70, { order: 3 })])).toBe(0);
    // reps × load read the lighter set as the day's best: +12 %.
    expect(change(work, [...work, set(8, 70, { order: 3 })], null)).toBeCloseTo(12, 9);
  });

  it('two warm-up sets that were not marked (10 × 20, 5 × 40) are 0.0 %', () => {
    const work = sets([5, 100], [5, 100], [5, 100]);
    const withWarmUps = [set(10, 20, { order: 0 }), set(5, 40, { order: 1 }), ...sets([5, 100], [5, 100], [5, 100]).map((entry, index) => ({ ...entry, order: index + 2 }))];
    expect(change(work, withWarmUps)).toBe(0);
  });

  it('a drop set after the work (10 × 50, 12 × 40) is 0.0 %', () => {
    const work = sets([5, 75], [5, 75], [5, 75]);
    const withDrop = [...sets([5, 75], [5, 75], [5, 75]), set(10, 50, { order: 3 }), set(12, 40, { order: 4 })];
    expect(change(work, withDrop)).toBe(0);
    expect(change(work, withDrop, null)).toBeCloseTo(33.3333333333, 9);
  });

  it('a change from 3 × 5 at 100 kg to 3 × 10 at 80 kg is −8.6 %', () => {
    const value = change(sets([5, 100], [5, 100], [5, 100]), sets([10, 80], [10, 80], [10, 80]));
    expect(value).toBeCloseTo(((80 * 40) / (100 * 35) - 1) * 100, 9);
    expect(value.toFixed(1)).toBe('-8.6');
    expect(change(sets([5, 100]), sets([10, 80]), null)).toBeCloseTo(60, 9);
  });

  it('the reset of a double progression, 12 × 80 → 8 × 85, is −3.9 %', () => {
    const value = change(sets([12, 80]), sets([8, 85]));
    expect(value).toBeCloseTo(((85 * 38) / (80 * 42) - 1) * 100, 9);
    expect(value.toFixed(1)).toBe('-3.9');
    expect(change(sets([12, 80]), sets([8, 85]), null).toFixed(1)).toBe('-29.2');
  });

  it('a deload day, 3 × 5 at 100 kg → 3 × 5 at 80 kg, is −20.0 %', () => {
    expect(change(sets([5, 100], [5, 100], [5, 100]), sets([5, 80], [5, 80], [5, 80]))).toBeCloseTo(-20, 9);
  });
});

/* ── The series in the repository's own screenshot ──────────────────────── */

describe('the bench press series of the exercise-detail screenshot', () => {
  const SERIES: [reps: number, kg: number][] = [[5, 69], [6, 70.5], [7, 72], [5, 73.5], [6, 75], [7, 76.5]];
  const inputs = SERIES.map(([reps, weight], index) => day(`2026-03-${String(2 + index * 3).padStart(2, '0')}`, sets([reps, weight])));

  it('reads −3 % on the fourth day, where reps × load reads −27 %', () => {
    const fourth = (metric: GymMetric | null) =>
      percentChange(compareExerciseDays(exerciseDays(inputs, metric))[3]!.ratio)!;
    expect(Math.round(fourth(METRIC))).toBe(-3);
    expect(fourth(METRIC)).toBeCloseTo(((73.5 * 35) / (72 * 37) - 1) * 100, 9);
    expect(Math.round(fourth(null))).toBe(-27);
  });

  it('reads +17 % over the series, last day against first, where reps × load reads +55 %', () => {
    const over = (metric: GymMetric | null) => percentChange(gymPerformanceOverSpan(exerciseDays(inputs, metric), metric).ratio)!;
    expect(Math.round(over(FIRST_LAST))).toBe(17);
    expect(over(FIRST_LAST)).toBeCloseTo(((76.5 * 37) / (69 * 35) - 1) * 100, 9);
    expect(Math.round(over(null))).toBe(55);
  });

  it('reads +6 % by the medians: the fifth day against the second', () => {
    // Last three: 5 × 73.5, 6 × 75, 7 × 76.5 → the middle is 6 × 75.
    // First three: 5 × 69, 6 × 70.5, 7 × 72 → the middle is 6 × 70.5.
    const value = percentChange(gymPerformanceOverSpan(exerciseDays(inputs, METRIC), METRIC).ratio)!;
    expect(value).toBeCloseTo((75 / 70.5 - 1) * 100, 9);
    expect(Math.round(value)).toBe(6);
  });
});

/* ── The median, and what a window compares ─────────────────────────────── */

describe('the median', () => {
  it('is the middle value, or the mean of the two middle ones', () => {
    expect(median([7])).toBe(7);
    expect(median([3, 9])).toBe(6);
    expect(median([9, 1, 5])).toBe(5);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([5, 5, 5])).toBe(5);
  });

  it('does not reorder what it was given', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe('how many days each end of a comparison rests on', () => {
  it('is half the days, rounded down, and three at most', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 30].map((days) => comparedDays(days, 'median'))).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 3, 3]);
  });

  it('is one under `firstLast`, from two days on', () => {
    expect([0, 1, 2, 3, 6, 30].map((days) => comparedDays(days, 'firstLast'))).toEqual([0, 0, 1, 1, 1, 1]);
  });
});

/** `scores` in kilograms at five reps, one exercise-day every three days. */
function series(weights: number[], exerciseId = 'ex_bench_press'): ExerciseDay[] {
  return exerciseDays(
    weights.map((weight, index) => day(`2026-04-${String(1 + index * 3).padStart(2, '0')}`, sets([5, weight]), exerciseId)),
    METRIC,
  );
}

const overSpan = (weights: number[], metric: GymMetric = METRIC): number | null =>
  percentChange(gymPerformanceOverSpan(series(weights), metric).ratio);

describe('the window comparison at its edges', () => {
  it('one day: nothing to compare, and the group says so rather than zero', () => {
    const performance = gymPerformanceOverSpan(series([100]), METRIC);
    expect(performance.ratio).toBeNull();
    expect(performance.awaitingBaseline).toEqual(['chest', 'shoulders', 'triceps']);
    expect(exerciseSpans(series([100]), 'median')[0]).toMatchObject({ days: 1, compared: 0, baseline: null, current: null, ratio: null });
  });

  it('two days: the last against the first', () => {
    expect(overSpan([100, 105])).toBeCloseTo(5, 9);
  });

  it('three days: still the last against the first — the middle day is not read', () => {
    expect(overSpan([100, 60, 105])).toBeCloseTo(5, 9);
    expect(overSpan([100, 140, 105])).toBeCloseTo(5, 9);
  });

  it('four days: the two last against the two first', () => {
    expect(overSpan([100, 102, 104, 110])).toBeCloseTo((107 / 101 - 1) * 100, 9);
  });

  it('five days: the two last against the two first — the middle day is not read', () => {
    expect(overSpan([100, 102, 50, 104, 110])).toBeCloseTo((107 / 101 - 1) * 100, 9);
  });

  it('six days: the middle of the three last against the middle of the three first', () => {
    expect(overSpan([100, 102, 104, 106, 108, 110])).toBeCloseTo((108 / 102 - 1) * 100, 9);
  });

  it('seven days: three against three, the fourth day not read', () => {
    expect(overSpan([100, 102, 104, 999, 106, 108, 110])).toBeCloseTo((108 / 102 - 1) * 100, 9);
  });

  it('many days: never more than three at either end', () => {
    const weights = Array.from({ length: 10 }, (_, index) => 100 + index);
    expect(overSpan(weights)).toBeCloseTo((108 / 101 - 1) * 100, 9);
  });
});

describe('what the median is for', () => {
  const steady = [100, 100, 100, 100, 100];

  it('a single light day at the end of six exercise-days falls out entirely', () => {
    expect(overSpan([...steady, 80])).toBe(0);
    expect(overSpan([...steady, 80], FIRST_LAST)).toBeCloseTo(-20, 9);
  });

  it('with four exercise-days it is halved', () => {
    expect(overSpan([100, 100, 100, 80])).toBeCloseTo(-10, 9);
    expect(overSpan([100, 100, 100, 80], FIRST_LAST)).toBeCloseTo(-20, 9);
  });

  it('with five it is halved too', () => {
    expect(overSpan([100, 100, 100, 100, 80])).toBeCloseTo(-10, 9);
  });

  it('a whole light week stays the decline it was', () => {
    expect(overSpan([100, 100, 100, 80, 80, 80])).toBeCloseTo(-20, 9);
    expect(overSpan([100, 100, 100, 100, 80, 80])).toBeCloseTo(-20, 9);
  });

  it('a single heavy day at the end does not make a rise either', () => {
    expect(overSpan([...steady, 120])).toBe(0);
  });

  it('a steady rise is read from the second day to the last but one', () => {
    // Six days, +2 kg each: last against first is +10 %, the medians +6 %.
    expect(overSpan([100, 102, 104, 106, 108, 110], FIRST_LAST)).toBeCloseTo(10, 9);
    expect(overSpan([100, 102, 104, 106, 108, 110])).toBeCloseTo((108 / 102 - 1) * 100, 9);
  });
});

/* ── Through the groups ─────────────────────────────────────────────────── */

describe('the groups under the Stage 5b metric', () => {
  it('give an exercise one voice, by its roles as of its latest day', () => {
    const days = exerciseDays(
      [
        day('2026-04-01', sets([5, 100])),
        day('2026-04-04', sets([5, 110])),
        day('2026-04-01', sets([10, 20]), 'ex_triceps_pushdown'),
        day('2026-04-04', sets([10, 20]), 'ex_triceps_pushdown'),
      ].map((entry) => (entry.exerciseId === 'ex_triceps_pushdown' ? { ...entry, muscles: ['triceps'], primaryMuscles: ['triceps'] } : entry)) as ExerciseDayInput[],
      METRIC,
    );
    const performance = gymPerformanceOverSpan(days, METRIC);
    const of = (muscle: string) => performance.muscles.find((entry) => entry.muscle === muscle)!;
    expect(of('chest').ratio).toBeCloseTo(1.1, 12);
    // Bench speaks with 15 % for the triceps, the pushdown with 100 %.
    expect(of('triceps').ratio).toBeCloseTo((0.15 * 1.1 + 1 * 1) / 1.15, 12);
    expect(of('triceps').compared).toBe(2);
    expect(of('chest').latestScore).toBe(kg(110) * 35);
  });

  it('cut the window before comparing, so days outside it are not in the medians', () => {
    const days = series([60, 100, 100, 100, 100, 100, 100]);
    // The first day lies before the window: six level days are level.
    expect(percentChange(gymPerformanceInWindow(days, '2026-04-04', '2026-04-30', METRIC).ratio)).toBe(0);
    // Inside it, the low first day is one of three and the median passes over it.
    expect(percentChange(gymPerformanceInWindow(days, '2026-04-01', '2026-04-30', METRIC).ratio)).toBe(0);
    expect(percentChange(gymPerformanceInWindow(days, '2026-04-01', '2026-04-30', FIRST_LAST).ratio)).toBeCloseTo((100 / 60 - 1) * 100, 9);
  });

  it('leave the comparison with the previous day as it was', () => {
    const days = series([100, 80, 100]);
    const recent = gymPerformance(days);
    expect(recent.ratio).toBeCloseTo(1.25, 12);
    expect(compareExerciseDays(days).map((entry) => entry.kind)).toEqual(['noBaseline', 'declined', 'improved']);
  });
});
