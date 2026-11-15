import { describe, expect, it } from 'vitest';
import { GYM_COMPARISON_CONFIRMED, GYM_CURVE_CONFIRMED, GYM_METRIC, TRAINING_RATING } from '../config/constants';
import { buildConfigSnapshot } from '../config/snapshot';
import type { AppConfigSnapshot } from '../model';
import { mapPerformanceChangeToScore, performanceScore } from '../scoring/performanceCurve';
import { gymCurveOf, gymMetricKey, gymMetricOf, gymScoringKey, type GymMetric } from './metric';
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
 * comparison a snapshot names is the comparison that runs: the owner
 * confirmed the median at STOP 5b (D175), and the switch stays wired —
 * flipping it in a snapshot still changes what is computed (`CLAUDE.md`,
 * "wire the shape to the thing it governs").
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
  it('is written into every snapshot this build makes, with the one constant and the curve that goes with it', () => {
    // Until the block "Kurve" the marker held three fields; the curve's
    // value travels in it since (D177).
    expect(base().scoring.gymMetric).toEqual({ id: 'bestWorkingSet', repsDivisor: 30, comparison: 'median', curveDecadePercent: 3 });
    expect(GYM_METRIC.repsDivisor).toBe(30);
    // What the pipeline takes is the metric, as before: the curve is not its business.
    expect(gymMetricOf(base())).toEqual({ repsDivisor: 30, comparison: 'median' });
    expect(gymCurveOf(base())).toBe(3);
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

describe('the comparison switch (confirmed at STOP 5b, D175)', () => {
  const median: GymMetric = { repsDivisor: 30, comparison: 'median' };
  const firstLast: GymMetric = { repsDivisor: 30, comparison: 'firstLast' };

  it('is the median in the snapshots this build writes, as the owner confirmed', () => {
    // The flag and the switch cannot disagree: what was confirmed is the
    // median, and a build that wrote anything else would say so here. A
    // snapshot's own switch is what computes either way.
    expect(GYM_COMPARISON_CONFIRMED).toBe(true);
    expect(GYM_METRIC.comparison).toBe('median');
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

/* ── The curve's value, and the calculation it governs ──────────────────── */

describe('the value of the performance curve a snapshot carries (block "Kurve", D177)', () => {
  const marker = (extra: Record<string, unknown> = {}) => ({ id: 'bestWorkingSet', repsDivisor: 30, comparison: 'median', ...extra });

  it('is read from the snapshot, not from the constant', () => {
    for (const value of [10, 8, 6, 5, 4, 3.5, 3, 2.5, 2]) {
      expect(gymCurveOf(withMetric(marker({ curveDecadePercent: value })))).toBe(value);
    }
  });

  it('is absent before the Stage 5b era and on the marker a Stage 5b preview wrote: the curve as it was, never today\'s', () => {
    expect(gymCurveOf(without())).toBeNull();
    expect(gymCurveOf(null)).toBeNull();
    expect(gymCurveOf(undefined)).toBeNull();
    // The marker as Stage 5b wrote it: the metric, and no value.
    const preview = withMetric(marker());
    expect(gymMetricOf(preview)).toEqual({ repsDivisor: 30, comparison: 'median' });
    expect(gymCurveOf(preview)).toBeNull();
  });

  it('cannot be carried without the metric: it lives inside the marker', () => {
    const config = without();
    const beside = { ...config, scoring: { ...config.scoring, curveDecadePercent: 3 } } as unknown as AppConfigSnapshot;
    expect(gymCurveOf(beside)).toBeNull();
    for (const junk of [null, true, 3, 'bestWorkingSet']) expect(gymCurveOf(withMetric(junk))).toBeNull();
  });

  it('takes a value it cannot read as no value, and never throws', () => {
    for (const junk of [0, -3, Number.NaN, Number.POSITIVE_INFINITY, '3', null, {}, [], true, Number.MIN_VALUE]) {
      expect(gymCurveOf(withMetric(marker({ curveDecadePercent: junk }))), String(junk)).toBeNull();
    }
    // The metric of such a marker is read all the same.
    expect(gymMetricOf(withMetric(marker({ curveDecadePercent: 'steep' })))).toEqual({ repsDivisor: 30, comparison: 'median' });
  });

  it('gives every distinct way of scoring a day its own key, so no cache can mix two curves', () => {
    const median: GymMetric = { repsDivisor: 30, comparison: 'median' };
    const keys = [
      gymScoringKey(null, null),
      gymScoringKey(median, null),
      gymScoringKey(median, 10),
      gymScoringKey(median, 3),
      gymScoringKey(median, 4),
      gymScoringKey({ repsDivisor: 30, comparison: 'firstLast' }, 3),
    ];
    expect(new Set(keys).size).toBe(keys.length);
    // The metric's own key is what it was: the exercise-days do not depend on the curve.
    expect(gymMetricKey(median)).toBe('strength:30:median');
  });

  it('is three in the snapshots this build writes, as the owner confirmed at STOP Kurve (D180)', () => {
    // The flag, the constant and the snapshot cannot disagree: what he
    // confirmed is three, the value every new snapshot carries, and a build
    // that wrote anything else would say so here.
    expect(GYM_CURVE_CONFIRMED).toBe(true);
    expect(GYM_METRIC.curveDecadePercent).toBe(3);
    expect(gymCurveOf(base())).toBe(GYM_METRIC.curveDecadePercent);
    // The constants of the shared curve are what they were: Running's curve, and Gym's before the era.
    expect([TRAINING_RATING.CURVE_ODDS_PER_DECADE, TRAINING_RATING.CURVE_DECADE_PERCENT]).toEqual([4, 10]);
  });

  it('from a snapshot to the level, with nothing in between that could choose', () => {
    // The same two window changes under three snapshots: three levels, each
    // the curve at that snapshot's value and at no other.
    const changes = { trendChange: 3, ytdChange: 6 };
    const levelOf = (config: AppConfigSnapshot): number => {
      const value = gymCurveOf(config);
      return (value === null ? performanceScore(changes) : performanceScore(changes, value)).score!;
    };
    const before = levelOf(without());
    const preview = levelOf(withMetric(marker()));
    const built = levelOf(base());
    const other = levelOf(withMetric(marker({ curveDecadePercent: 5 })));
    expect(before).toBe((mapPerformanceChangeToScore(3) + mapPerformanceChangeToScore(6)) / 2);
    expect(preview).toBe(before);
    expect(built).toBe(0.5 * mapPerformanceChangeToScore(3, 3) + 0.5 * mapPerformanceChangeToScore(6, 3));
    expect(built).toBeCloseTo((800 + 941.176) / 2, 2);
    expect(other).toBeCloseTo((696.83 + 840.71) / 2, 1);
    expect(new Set([before, built, other]).size).toBe(3);
  });
});
