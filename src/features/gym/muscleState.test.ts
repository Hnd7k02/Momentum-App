import { describe, expect, it } from 'vitest';
import type { MusclePerformance } from '../../core/gym/performance';
import { muscleStateOf, roundShown, shownChangeText, shownPercent, shownTrend } from './muscleState';

/**
 * Number, sign and state agree on the shown figure (WP3, B6).
 *
 * The screen rounds a change to a whole percent, so the colour and the sign
 * follow the rounded figure: +0.4 % reads as a held "0 %", never a green
 * "+0 %", and −0.3 % never a red "0 %". Presentation only — the ratio itself
 * is untouched.
 */

const measured = (ratio: number): MusclePerformance =>
  ({ muscle: 'calves', status: 'measured', ratio, exercises: 1, compared: 1, latestScore: 1 }) as MusclePerformance;

describe('the shown change', () => {
  it.each([
    [1.004, 0, 'unchanged', '0 %'],
    [0.997, 0, 'unchanged', '0 %'],
    [1.0049, 0, 'unchanged', '0 %'],
    [1.0051, 1, 'improved', '+1 %'],
    [0.9949, -1, 'declined', '-1 %'],
    [1.26, 26, 'improved', '+26 %'],
    [1, 0, 'unchanged', '0 %'],
  ])('ratio %s shows %s, reads %s, prints "%s"', (ratio, percent, trend, text) => {
    expect(shownPercent(ratio)).toBe(percent);
    expect(shownTrend(ratio)).toBe(trend);
    expect(shownChangeText((ratio - 1) * 100)).toBe(text);
  });

  it('never prints a negative zero', () => {
    expect(Object.is(roundShown(-0.3), 0)).toBe(true);
    expect(shownChangeText(-0.3)).toBe('0 %');
  });

  it('has nothing to show where there is no ratio', () => {
    expect(shownPercent(null)).toBeNull();
    expect(shownTrend(null)).toBeNull();
    expect(shownChangeText(null)).toBeNull();
  });
});

describe('muscleStateOf follows the shown figure', () => {
  it('reads a change that rounds to 0 % as held, in both directions', () => {
    expect(muscleStateOf(measured(1.004))).toBe('unchanged');
    expect(muscleStateOf(measured(0.997))).toBe('unchanged');
  });

  it('keeps every visible change in its direction', () => {
    expect(muscleStateOf(measured(1.006))).toBe('improved');
    expect(muscleStateOf(measured(0.994))).toBe('declined');
  });

  it('leaves no data and no baseline exactly as they were', () => {
    expect(muscleStateOf({ ...measured(1), status: 'noData', ratio: null })).toBe('noData');
    expect(muscleStateOf({ ...measured(1), status: 'insufficientBaseline', ratio: null })).toBe(
      'awaitingBaseline',
    );
  });
});
