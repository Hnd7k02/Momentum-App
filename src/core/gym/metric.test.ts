import { describe, expect, it } from 'vitest';
import { GYM_COMPARISON_CONFIRMED, GYM_METRIC } from '../config/constants';
import { buildConfigSnapshot } from '../config/snapshot';
import type { AppConfigSnapshot } from '../model';
import { gymMetricKey, gymMetricOf, type GymMetric } from './metric';
import {
  comparedDays,
  exerciseDays,
  exerciseSpans,
  gymPerformanceInWindow,
  gymPerformanceOverSpan,
  percentChange,
  type ExerciseDayInput,
} from './performance';

/**
 * The marker of the Stage 5b metric, and the one switch inside it (D150).
 *
 * Two things are held here. That a snapshot is read as the era it was
 * written in — absence is the metric before, never today's. And that the
 * comparison a snapshot names is the comparison that runs: the switch is
 * confirmed by the owner at STOP 5b, and until then a reserved decision is
 * only reserved if flipping it changes what is computed (`CLAUDE.md`).
 */

const base = (): AppConfigSnapshot => buildConfigSnapshot([], []);

const withMetric = (gymMetric: unknown): AppConfigSnapshot => {
  const config = base();
  return { ...config, scoring: { ...config.scoring, gymMetric: gymMetric as never } };
};

const without = (): AppConfigSnapshot => {
  const config = base();
  const scoring: Partial<AppConfigSnapshot['scoring']> = { ...config.scoring };
  delete scoring.gymMetric;
  return { ...config, scoring: scoring as AppConfigSnapshot['scoring'] };
};

describe('the metric a snapshot carries', () => {
  it('is written into every snapshot this build makes, with the one constant', () => {
    expect(base().scoring.gymMetric).toEqual({ id: 'bestWorkingSet', repsDivisor: 30, comparison: 'median' });
    expect(GYM_METRIC.repsDivisor).toBe(30);
    expect(gymMetricOf(base())).toEqual({ repsDivisor: 30, comparison: 'median' });
  });

  it('never shares an object with the constant, so no snapshot can be edited through another', () => {
    const first = base().scoring.gymMetric!;
    const second = base().scoring.gymMetric!;
    expect(first).not.toBe(second);
    expect(first).not.toBe(GYM_METRIC);
  });

  it('reads a snapshot without the field as the metric before, never as today\'s', () => {
    expect(gymMetricOf(without())).toBeNull();
    expect(gymMetricOf(null)).toBeNull();
    expect(gymMetricOf(undefined)).toBeNull();
  });

  it('reads the numbers from the snapshot, not from the constant', () => {
    expect(gymMetricOf(withMetric({ id: 'bestWorkingSet', repsDivisor: 40, comparison: 'firstLast' }))).toEqual({
      repsDivisor: 40,
      comparison: 'firstLast',
    });
  });

  it('takes a field it does not recognise as the era all the same, and never throws', () => {
    expect(gymMetricOf(withMetric({}))).toEqual({ repsDivisor: 30, comparison: 'median' });
    expect(gymMetricOf(withMetric({ repsDivisor: 0, comparison: 'mean' }))).toEqual({ repsDivisor: 30, comparison: 'median' });
    expect(gymMetricOf(withMetric({ repsDivisor: Number.NaN }))).toEqual({ repsDivisor: 30, comparison: 'median' });
    expect(gymMetricOf(withMetric({ repsDivisor: '30' }))).toEqual({ repsDivisor: 30, comparison: 'median' });
  });

  it('takes a field that is no object as no marker at all', () => {
    for (const junk of [null, true, 30, 'bestWorkingSet']) expect(gymMetricOf(withMetric(junk))).toBeNull();
    // A snapshot with no scoring object is not one this function can read.
    expect(gymMetricOf({ domains: [], questions: [] } as unknown as AppConfigSnapshot)).toBeNull();
  });

  it('gives every distinct metric its own key', () => {
    const keys = [
      gymMetricKey(null),
      gymMetricKey({ repsDivisor: 30, comparison: 'median' }),
      gymMetricKey({ repsDivisor: 30, comparison: 'firstLast' }),
      gymMetricKey({ repsDivisor: 40, comparison: 'median' }),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
});

/* ── The switch and the calculation cannot part ─────────────────────────── */

const set = (reps: number, kg: number, order = 0) => ({ id: `${reps}x${kg}#${order}`, reps, weightGrams: kg * 1000, order });

/** Seven days of one exercise whose first and last differ from the rest. */
const SERIES: [date: string, reps: number, kg: number][] = [
  ['2026-03-02', 8, 60],
  ['2026-03-05', 8, 70],
  ['2026-03-09', 8, 72],
  ['2026-03-12', 8, 74],
  ['2026-03-16', 8, 76],
  ['2026-03-19', 8, 78],
  ['2026-03-23', 8, 100],
];

const inputs: ExerciseDayInput[] = SERIES.map(([date, reps, kg]) => ({
  date,
  exerciseId: 'ex_bench_press',
  muscles: ['chest'],
  primaryMuscles: ['chest'],
  sets: [set(reps, kg)],
}));

describe('the comparison switch (reserved until STOP 5b)', () => {
  const median: GymMetric = { repsDivisor: 30, comparison: 'median' };
  const firstLast: GymMetric = { repsDivisor: 30, comparison: 'firstLast' };

  it('is built and on in the snapshots this build writes, and not yet confirmed', () => {
    expect(GYM_METRIC.comparison).toBe('median');
    // Flipped to `true` in the commit that records the owner's confirmation;
    // a snapshot's own switch is what computes either way.
    expect(GYM_COMPARISON_CONFIRMED).toBe(false);
  });

  it('decides what a window computes: the two values of the switch give two results', () => {
    const days = exerciseDays(inputs, median);
    // The same values under either: the switch is the comparison, nothing else.
    expect(exerciseDays(inputs, firstLast)).toEqual(days);

    const byMedian = percentChange(gymPerformanceOverSpan(days, median).ratio)!;
    const byFirstLast = percentChange(gymPerformanceOverSpan(days, firstLast).ratio)!;
    // Median of the last three (76, 78, 100 → 78) over the first three (60, 70, 72 → 70).
    expect(byMedian).toBeCloseTo((78 / 70 - 1) * 100, 9);
    // Last over first.
    expect(byFirstLast).toBeCloseTo((100 / 60 - 1) * 100, 9);
    expect(byMedian).not.toBeCloseTo(byFirstLast, 1);
  });

  it('is read by the window function too, with the window cut first', () => {
    const days = exerciseDays(inputs, median);
    const from = '2026-03-05';
    const to = '2026-03-19';
    // Five days inside: 70, 72, 74, 76, 78 — two against two, or last against first.
    expect(percentChange(gymPerformanceInWindow(days, from, to, median).ratio)).toBeCloseTo((77 / 71 - 1) * 100, 9);
    expect(percentChange(gymPerformanceInWindow(days, from, to, firstLast).ratio)).toBeCloseTo((78 / 70 - 1) * 100, 9);
  });

  it('is the only thing `exerciseSpans` reads besides the days', () => {
    const days = exerciseDays(inputs, median);
    const [byMedian] = exerciseSpans(days, 'median');
    const [byFirstLast] = exerciseSpans(days, 'firstLast');
    expect(byMedian!.compared).toBe(comparedDays(7, 'median'));
    expect(byFirstLast!.compared).toBe(1);
    expect({ ...byMedian, compared: 0, baseline: 0, current: 0, ratio: 0 }).toEqual({
      ...byFirstLast,
      compared: 0,
      baseline: 0,
      current: 0,
      ratio: 0,
    });
  });

  it('from a snapshot to the result, with nothing in between that could choose', () => {
    for (const comparison of ['median', 'firstLast'] as const) {
      const metric = gymMetricOf(withMetric({ id: 'bestWorkingSet', repsDivisor: 30, comparison }))!;
      const days = exerciseDays(inputs, metric);
      const expected = comparison === 'median' ? 78 / 70 : 100 / 60;
      expect(gymPerformanceOverSpan(days, metric).ratio).toBeCloseTo(expected, 12);
    }
  });
});
