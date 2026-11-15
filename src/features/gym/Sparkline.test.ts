import { describe, expect, it } from 'vitest';
import { SPARK_HEIGHT, SPARK_SCALE, SPARK_WIDTH, SPARK_WIDTH_NARROW, sparkPoints, sparkY } from './Sparkline';

/**
 * The row chart's geometry (contract §6, D160): 80 × 24, a 3px inset, and
 * one scale for every row of a list — −8 % to +8 %, zero in the middle
 * (±12 % until STOP Kurve, D180; the tests held that scale as they hold
 * this one).
 *
 * Until Stage 6b each row scaled to its own minimum and maximum (the
 * handoff's `spark80()`), and this file pinned that: the lowest value on
 * the floor, the highest on the ceiling, "the same shape at any magnitude".
 * The contract replaces that rule with its opposite, so the tests below pin
 * the new one just as tightly.
 */
describe('sparkPoints', () => {
  it('spreads the points evenly and puts the first and last on the margins', () => {
    const points = sparkPoints([0, 4, 8]);
    expect(points.map((p) => p.x)).toEqual([3, 40, 77]);
  });

  it('puts zero on the middle line and ±8 % on the edges', () => {
    expect(SPARK_SCALE).toBe(8);
    expect(sparkY(0)).toBe(SPARK_HEIGHT / 2);
    expect(sparkY(8)).toBe(3);     // a gain reaches the top, an end point's radius inside the box
    expect(sparkY(-8)).toBe(21);   // a loss the bottom
    expect(sparkY(4)).toBe(7.5);   // and half the change is half the way
    expect(sparkY(-2)).toBe(14.25);
  });

  it('shares one scale between rows: a small change looks small', () => {
    // The old rule drew [1, 2, 3] and [100, 200, 300] as the same line.
    const small = sparkPoints([0, 0.5, 1]);
    const large = sparkPoints([0, 4, 8]);
    expect(small).not.toEqual(large);
    const rise = (points: { y: number }[]) => points[0]!.y - points[points.length - 1]!.y;
    expect(rise(small)).toBeCloseTo(1.125, 10); // +1 % climbs an eighth of the half height
    expect(rise(large)).toBe(9);                // +8 % climbs all of it
    // What the Stage 5b metric reads in a month: +3 % and +7 % are told apart by four and a half pixels.
    expect(sparkY(3) - sparkY(7)).toBe(4.5);
  });

  it('leaves what goes beyond 8 % standing at the edge, never outside the box', () => {
    const points = sparkPoints([0, 30, 78, -60]);
    expect(points.map((p) => p.y)).toEqual([12, 3, 3, 21]);
    expect(points.every((p) => p.y >= 3 && p.y <= SPARK_HEIGHT - 3)).toBe(true);
    expect(points.every((p) => p.x >= 3 && p.x <= SPARK_WIDTH - 3)).toBe(true);
  });

  it('draws a series with no span flat at its own value — on the zero line when it is held', () => {
    expect(sparkPoints([0, 0]).every((p) => p.y === 12)).toBe(true);
    expect(sparkPoints([4, 4, 4]).every((p) => p.y === 7.5)).toBe(true);
    expect(sparkPoints([-2, -2, -2, -2]).every((p) => p.y === 14.25)).toBe(true);
    for (const values of [[0, 0], [4, 4, 4], [-2, -2, -2, -2]]) {
      expect(sparkPoints(values).every((p) => Number.isFinite(p.y))).toBe(true);
    }
  });

  it('places a single observation in the middle of the width, at the height of its value', () => {
    expect(sparkPoints([0])).toEqual([{ x: 40, y: 12 }]);
    expect(sparkPoints([4])).toEqual([{ x: 40, y: 7.5 }]);
    expect(sparkPoints([42])).toEqual([{ x: 40, y: 3 }]);
  });

  it('has nothing to draw without points, and never invents one', () => {
    expect(sparkPoints([])).toEqual([]);
  });

  it('keeps negative values inside the box, below the zero line', () => {
    const points = sparkPoints([-20, 0, -5]);
    expect(points.every((p) => p.y >= 3 && p.y <= 21)).toBe(true);
    expect(points[0]!.y).toBe(21);
    expect(points[1]!.y).toBe(12);
    expect(points[2]!.y).toBe(17.625);
  });

  it('draws the narrow chart at 64 units with the same heights', () => {
    expect(SPARK_WIDTH_NARROW).toBe(64);
    const wide = sparkPoints([0, 4, 8]);
    const narrow = sparkPoints([0, 4, 8], SPARK_WIDTH_NARROW);
    expect(narrow.map((p) => p.x)).toEqual([3, 32, 61]);
    expect(narrow.map((p) => p.y)).toEqual(wide.map((p) => p.y));
  });
});
