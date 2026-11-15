import { describe, expect, it } from 'vitest';
import type { ExerciseDay } from '../../core/gym/performance';
import { lineRange, lineValues, lineY } from './ExerciseLineChart';

/**
 * A small change must look small in the exercise detail (D160, D163).
 *
 * Until STOP 5b the detail drew bars, and these four tests held that a bar
 * was its day's share of the largest day, from zero — for one stage they
 * had run from the smallest day to the largest, so a fall of a tenth was
 * drawn as a bar a third as high. The owner chose the line at STOP 5b
 * (D175), and the same four statements are held for it: a day stands where
 * its change since the first day shown puts it on a scale that reaches
 * 12 % at the least, never on a scale from the smallest day to the
 * largest.
 */
const day = (date: string, score: number): ExerciseDay =>
  ({ date, exerciseId: 'ex', muscles: [], best: { score, set: { reps: 1, weightGrams: score, order: 0 } } }) as unknown as ExerciseDay;

/** Newest first, as the detail holds its days. */
const series = (...scores: number[]): ExerciseDay[] =>
  scores.map((score, index) => day(`2026-06-${String(index + 1).padStart(2, '0')}`, score)).reverse();

describe('a day stands at its change since the first day shown', () => {
  it('draws the first day on the zero line, the scale’s reach at the edge and half of it halfway', () => {
    const range = lineRange(lineValues(series(1000, 1060, 1120)));
    expect(range).toEqual({ low: 0, high: 12 });
    // From the top: the zero line is the lower edge of a series that only rises.
    expect(lineY(0, range)).toBe(1);
    expect(lineY(12, range)).toBe(0);
    expect(lineY(6, range)).toBeCloseTo(0.5, 10);
  });

  it('draws a fall of a tenth as a fall of a tenth', () => {
    // 480 after 535.5: the same two days the bars were held to.
    const values = lineValues(series(535.5, 480));
    expect(values[1]).toBeCloseTo(-10.36, 2);
    const range = lineRange(values);
    expect(range).toEqual({ low: -12, high: 0 });
    // Ten twelfths of the way down — and never at the lower edge, which is
    // where a scale from the smallest day to the largest put it.
    expect(lineY(values[1]!, range)).toBeCloseTo(10.36 / 12, 2);
    expect(lineY(values[1]!, range)).toBeLessThan(0.9);
    // A fall of three percent is a quarter of the way.
    expect(lineY(-3, range)).toBeCloseTo(0.25, 10);
  });

  it('keeps the ratio between any two changes, whatever else the series holds', () => {
    for (const scores of [[1000, 1030, 1060], [1000, 1100, 1300], [1000, 960, 1080]]) {
      const values = lineValues(series(...scores));
      const range = lineRange(values);
      const zero = lineY(0, range);
      const [, a, b] = values as [number, number, number];
      // The distance from the zero line is the change, to scale.
      expect((zero - lineY(a, range)) / (zero - lineY(b, range))).toBeCloseTo(a / b, 10);
    }
  });

  it('keeps one day a dot on its zero line, and survives a history without a score', () => {
    const one = lineValues(series(720));
    expect(one).toEqual([0]);
    expect(lineY(0, lineRange(one))).toBe(1);
    // A first day that cannot be divided by leaves every day on the zero line.
    expect(lineValues(series(0, 0, 500))).toEqual([0, 0, 0]);
  });
});
