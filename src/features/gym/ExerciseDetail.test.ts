import { describe, expect, it } from 'vitest';
import { barHeight } from './ExerciseDetail';

/**
 * The exercise detail's bars start at zero (STOP 6b, contract §6).
 *
 * For one stage they ran from the smallest day to the largest, so the
 * smallest day stood at 30 % whatever it was: a fall from 535 to 480
 * kg-reps — a tenth — was drawn as a bar a third as high. A small change
 * must look small (D160).
 */
describe('a bar is its day’s share of the largest day', () => {
  it('draws the largest day at full height and half of it at half', () => {
    expect(barHeight(535.5, 535.5)).toBe(100);
    expect(barHeight(267.75, 535.5)).toBe(50);
  });

  it('draws a fall of a tenth as a tenth', () => {
    // 8 × 60 kg after 7 × 76.5 kg: 480 against 535.5.
    expect(barHeight(480, 535.5)).toBeCloseTo(89.64, 2);
    // And never as the collapse a smallest-to-largest scale made of it.
    expect(barHeight(480, 535.5)).toBeGreaterThan(85);
  });

  it('keeps the ratio between any two days', () => {
    const peak = 1200;
    for (const [a, b] of [[300, 600], [450, 900], [1000, 1100]] as const) {
      expect(barHeight(a, peak) / barHeight(b, peak)).toBeCloseTo(a / b, 10);
    }
  });

  it('keeps a very small day a visible bar, and survives a history without a score', () => {
    expect(barHeight(10, 1000)).toBe(8);
    expect(barHeight(0, 0)).toBe(8);
  });
});
