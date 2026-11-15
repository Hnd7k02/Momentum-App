import { describe, expect, it } from 'vitest';
import type { ExerciseDay } from '../../core/gym/performance';
import { LINE_SCALE, lineRange, lineReach, lineValues } from './ExerciseLineChart';

/**
 * The scale of the exercise detail's line (contract §6; the owner's choice
 * at STOP 5b, D175): what each point is, how far the plot reaches, and on
 * which side of the zero line a series is drawn. Where a point stands
 * inside that range is `ExerciseDetail.test.ts`.
 */
const day = (date: string, score: number): ExerciseDay =>
  ({ date, exerciseId: 'ex', muscles: [], best: { score, set: { reps: 1, weightGrams: score, order: 0 } } }) as unknown as ExerciseDay;

describe('the line of the exercise detail', () => {
  it('reads each day as its change since the first day shown, oldest first', () => {
    // Handed over newest first, as the detail holds its days.
    const values = lineValues([day('2026-06-08', 1120), day('2026-06-01', 980), day('2026-05-25', 1000)]);
    expect(values.map((value) => Math.round(value * 10) / 10)).toEqual([0, -2, 12]);
  });

  it('reaches eight percent at the least, so that a small change looks small', () => {
    // Twelve until STOP Kurve (D180): the scale of the muscle rows, which went to eight with it.
    expect(LINE_SCALE).toBe(8);
    expect(lineReach([0, 1.5, 3])).toBe(8);
    expect(lineReach([0, -7.9])).toBe(8);
    expect(lineReach([0, 8])).toBe(8);
  });

  it('widens in steps of four where a series goes further, and never cuts it off', () => {
    expect(lineReach([0, 8.1])).toBe(12);
    expect(lineReach([0, 12])).toBe(12);
    expect(lineReach([0, 24])).toBe(24);
    expect(lineReach([0, -20])).toBe(20);
    expect(lineReach([0, 31])).toBe(32);
  });

  it('draws a series that only rises above its zero line, one that only falls below it, and both round it', () => {
    expect(lineRange([0, 4, 7])).toEqual({ low: 0, high: 8 });
    expect(lineRange([0, 4, 9])).toEqual({ low: 0, high: 12 });
    expect(lineRange([0, -3, -20])).toEqual({ low: -20, high: 0 });
    expect(lineRange([0, 5, -2, 12])).toEqual({ low: -12, high: 12 });
    // One day, or days that never move: the zero line and the room above it.
    expect(lineRange([0])).toEqual({ low: 0, high: 8 });
  });
});
