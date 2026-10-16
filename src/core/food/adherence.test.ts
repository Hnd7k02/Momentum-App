import { describe, expect, it } from 'vitest';
import { scaleValueToPercent } from '../scoring/scale';
import { adherencePercent } from './adherence';

/**
 * Food's replay arithmetic (D106, kept for the days Food was on — D139).
 */
describe('a replayed Food day', () => {
  it('maps the stored 1–10 to the same percentage a scale answer would', () => {
    for (let value = 1; value <= 10; value += 1) {
      expect(adherencePercent(value)).toBe(scaleValueToPercent(value));
    }
    expect(adherencePercent(1)).toBe(10);
    expect(adherencePercent(10)).toBe(100);
  });
});
