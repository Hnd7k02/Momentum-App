import { describe, expect, it } from 'vitest';
import type { ExerciseDay } from '../../core/gym/performance';
import { LINE_SCALE, lineRange, lineReach, lineValues } from './ExerciseLineChart';

/**
 * The scale of the line proposed for the exercise detail at STOP 5b. The
 * chart itself is on the dev server only; its arithmetic is held here so
 * that the pictures the owner judges are drawn by a rule and not by eye.
 */
const day = (date: string, score: number): ExerciseDay =>
  ({ date, exerciseId: 'ex', muscles: [], best: { score, set: { reps: 1, weightGrams: score, order: 0 } } }) as unknown as ExerciseDay;

describe('the proposed line of the exercise detail', () => {
  it('reads each day as its change since the first day shown, oldest first', () => {
    // Handed over newest first, as the detail holds its days.
    const values = lineValues([day('2026-06-08', 1120), day('2026-06-01', 980), day('2026-05-25', 1000)]);
    expect(values.map((value) => Math.round(value * 10) / 10)).toEqual([0, -2, 12]);
  });

  it('reaches twelve percent at the least, so that a small change looks small', () => {
    expect(LINE_SCALE).toBe(12);
    expect(lineReach([0, 1.5, 3])).toBe(12);
    expect(lineReach([0, -11.9])).toBe(12);
    expect(lineReach([0, 12])).toBe(12);
  });

  it('widens in steps of six where a series goes further, and never cuts it off', () => {
    expect(lineReach([0, 12.1])).toBe(18);
    expect(lineReach([0, 24])).toBe(24);
    expect(lineReach([0, -20])).toBe(24);
    expect(lineReach([0, 31])).toBe(36);
  });

  it('draws a series that only rises above its zero line, one that only falls below it, and both round it', () => {
    expect(lineRange([0, 4, 9])).toEqual({ low: 0, high: 12 });
    expect(lineRange([0, -3, -20])).toEqual({ low: -24, high: 0 });
    expect(lineRange([0, 5, -2, 12])).toEqual({ low: -12, high: 12 });
    // One day, or days that never move: the zero line and the room above it.
    expect(lineRange([0])).toEqual({ low: 0, high: 12 });
  });
});
