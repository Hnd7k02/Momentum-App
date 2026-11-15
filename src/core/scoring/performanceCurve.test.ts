import { describe, expect, it } from 'vitest';
import { TRAINING_RATING, RATING } from '../config/constants';
import {
  attendanceScore,
  isCurveDecade,
  mapPerformanceChangeToScore,
  performanceChangeForScore,
  performanceScore,
  scoreForRatio,
} from './performanceCurve';

const map = mapPerformanceChangeToScore;

/**
 * The curve is one parameter and a handful of promises. These are the
 * promises, in the order the specification ranks them: `score(0) = 500`
 * first, then monotonicity, then symmetry, then diminishing returns, then
 * closeness to the approved anchors.
 */
describe('the performance curve', () => {
  it('scores no change as exactly the midpoint', () => {
    // Exact, not fitted: ODDS^0 is 1, so the denominator is 2.
    expect(map(0)).toBe(500);
  });

  it('meets the approved anchors it can meet exactly', () => {
    expect(map(10)).toBeCloseTo(800, 9);
    expect(map(-10)).toBeCloseTo(200, 9);
  });

  it('meets the ±5 % anchors within a third of a per cent of the scale', () => {
    expect(map(5)).toBeCloseTo(666.667, 3);
    expect(map(-5)).toBeCloseTo(333.333, 3);
    expect(Math.abs(map(5) - 670)).toBeLessThan(3.4);
    expect(Math.abs(map(-5) - 330)).toBeLessThan(3.4);
  });

  it('resolves the ±20 % anchors in favour of symmetry, as instructed', () => {
    /*
     * The approved table asks for −20 % → 0 and +20 % → 950, which cannot
     * both hold: symmetry about 500 requires that if +20 scores 950 then −20
     * scores 50, and an asymptotic curve cannot reach 0 at a finite input at
     * all. Symmetry outranks anchor fit, so these are the two that give.
     */
    expect(map(20)).toBeCloseTo(941.176, 3);
    expect(map(-20)).toBeCloseTo(58.824, 3);
    expect(map(20) + map(-20)).toBeCloseTo(1000, 9);
  });

  it('is symmetric about the midpoint for every change', () => {
    for (const change of [0.001, 0.5, 1, 3, 7.5, 12, 25, 60, 250, 1000]) {
      expect(map(change) + map(-change)).toBeCloseTo(1000, 9);
    }
  });

  it('is monotonic across the whole range, with no step at zero', () => {
    /*
     * Strictly increasing wherever a double can tell two values apart, which
     * is everywhere inside ±100 %. Beyond that the curve is within a
     * ten-thousandth of a point of its asymptote and consecutive values
     * become equal — saturation of the representation, not a flat spot in the
     * function, and the reason the wider range is asserted as non-decreasing.
     */
    let previous = -Infinity;
    for (let change = -100; change <= 100; change += 0.25) {
      const score = map(change);
      expect(score).toBeGreaterThan(previous);
      previous = score;
    }
    previous = -Infinity;
    for (let change = -400; change <= 400; change += 0.25) {
      const score = map(change);
      expect(score).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = score;
    }
    /*
     * And the two numerical branches meet at the join rather than stepping.
     * A hair either side of zero differs only by what the slope asks for —
     * about 69 points per per cent, so 1.4e-7 across a gap of 2e-9 — which is
     * continuity, not equality.
     */
    expect(map(1e-9) - map(-1e-9)).toBeLessThan(1e-6);
    expect(map(-1e-9)).toBeLessThan(map(0));
    expect(map(1e-9)).toBeGreaterThan(map(0));
  });

  it('rewards each further per cent less than the one before', () => {
    // Diminishing returns, stated as the second difference being negative.
    for (let change = 0; change < 60; change += 1) {
      const first = map(change + 1) - map(change);
      const second = map(change + 2) - map(change + 1);
      expect(second).toBeLessThan(first);
    }
  });

  it('does not cap the input, and approaches the bounds without reaching them', () => {
    // A beginner tripling their best set is +200 %. It keeps helping.
    expect(map(200)).toBeGreaterThan(999);
    expect(map(200)).toBeLessThan(RATING.MAX);
    expect(map(100000)).toBeLessThanOrEqual(RATING.MAX);
    expect(map(1e6)).toBeGreaterThan(map(1000) - 1e-6);
    // A total collapse is bounded too, and is never negative.
    expect(map(-99.9)).toBeGreaterThan(RATING.MIN);
    expect(map(-100000)).toBeGreaterThanOrEqual(RATING.MIN);
  });

  it('survives the numbers that break a naive exponential', () => {
    for (const change of [-1e6, -1e4, -745, 745, 1e4, 1e6]) {
      const score = map(change);
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(RATING.MIN);
      expect(score).toBeLessThanOrEqual(RATING.MAX);
    }
  });

  it('is deterministic to the last bit', () => {
    for (const change of [-17.3, -0.4, 0, 0.4, 17.3, 123.456]) {
      expect(map(change)).toBe(map(change));
    }
  });

  it('reads back the change a score implies', () => {
    for (const change of [-30, -10, 0, 10, 30]) {
      expect(performanceChangeForScore(map(change))).toBeCloseTo(change, 9);
    }
  });

  it('says nothing about a ratio it does not have', () => {
    expect(scoreForRatio(null)).toBeNull();
    expect(scoreForRatio(1)).toBe(500);
    expect(scoreForRatio(1.1)).toBeCloseTo(800, 9);
  });

  it('is one documented parameter, not a table of branches', () => {
    // Every ten points of improvement multiplies the odds by four.
    const odds = (change: number) => map(change) / (RATING.MAX - map(change));
    expect(odds(10) / odds(0)).toBeCloseTo(TRAINING_RATING.CURVE_ODDS_PER_DECADE, 9);
    expect(odds(20) / odds(10)).toBeCloseTo(TRAINING_RATING.CURVE_ODDS_PER_DECADE, 9);
  });
});

describe('attendance', () => {
  it('is the weekly fraction on the existing scale', () => {
    expect(attendanceScore(0, 3)).toBe(0);
    expect(attendanceScore(1, 3)).toBeCloseTo(1000 / 3, 9);
    expect(attendanceScore(3, 3)).toBe(1000);
  });

  it('is capped at the target, so an extra session buys nothing here', () => {
    expect(attendanceScore(4, 3)).toBe(1000);
    expect(attendanceScore(40, 3)).toBe(1000);
  });

  it('never divides by a target of zero', () => {
    expect(attendanceScore(1, 0)).toBe(1000);
  });
});

describe('composing the two windows', () => {
  it('weights trend and year-to-date equally', () => {
    const result = performanceScore({ trendChange: 10, ytdChange: -10 });
    expect(result.trendScore).toBeCloseTo(800, 9);
    expect(result.ytdScore).toBeCloseTo(200, 9);
    expect(result.score).toBeCloseTo(500, 9);
  });

  it('maps each window and then averages, rather than the other way round', () => {
    /*
     * The order is the point of the rule. Averaging the changes first and
     * mapping once would run a non-linear curve over a blended rate and lose
     * the disagreement between a good year and a bad two months.
     */
    const trendChange = 30;
    const ytdChange = 0;
    const mapThenAverage = performanceScore({ trendChange, ytdChange }).score!;
    const averageThenMap = mapPerformanceChangeToScore((trendChange + ytdChange) / 2);
    expect(mapThenAverage).toBeCloseTo((map(30) + map(0)) / 2, 9);
    expect(averageThenMap).toBeCloseTo(map(15), 9);
    // They genuinely differ, so the assertion above is not a tautology.
    expect(Math.abs(mapThenAverage - averageThenMap)).toBeGreaterThan(5);
  });

  it('uses whichever component it has when the other has no baseline', () => {
    const trendOnly = performanceScore({ trendChange: 10, ytdChange: null });
    expect(trendOnly.score).toBeCloseTo(800, 9);
    expect(trendOnly.components).toEqual(['trend']);

    const ytdOnly = performanceScore({ trendChange: null, ytdChange: -10 });
    expect(ytdOnly.score).toBeCloseTo(200, 9);
    expect(ytdOnly.components).toEqual(['ytd']);
  });

  it('never fills a missing component with a zero or a neutral 500', () => {
    const trendOnly = performanceScore({ trendChange: 10, ytdChange: null });
    // Averaging with 500 would give 650; averaging with 0 would give 400.
    expect(trendOnly.score).not.toBeCloseTo(650, 3);
    expect(trendOnly.score).not.toBeCloseTo(400, 3);
  });

  it('has nothing to say when neither window has a baseline', () => {
    const none = performanceScore({ trendChange: null, ytdChange: null });
    expect(none.score).toBeNull();
    expect(none.components).toEqual([]);
  });

  it('keeps the two weights summing to one', () => {
    expect(TRAINING_RATING.TREND_WEIGHT + TRAINING_RATING.YTD_WEIGHT).toBe(1);
    expect(TRAINING_RATING.ATTENDANCE_WEIGHT + TRAINING_RATING.PERFORMANCE_WEIGHT).toBeCloseTo(1, 12);
  });
});

/* ── The one value, as an argument (block "Kurve", D177) ────────────────── */

/**
 * The candidates of `docs/design/wp3/kurve.md`: how many percentage points
 * of change multiply the odds by four. Ten is the constants' value; three
 * is what Gym's snapshots of the Stage 5b era carry.
 */
const CANDIDATES = [10, 8, 6, 5, 4, 3.5, 3, 2.5, 2];

/** One unit in the last place of a double at 1000. */
const ULP_AT_MAX = 2 ** -43;

describe('the curve without a value handed in', () => {
  it('computes bit for bit what it always computed', () => {
    // The expression as it stood before the value became an argument.
    const k = Math.log(4) / 10;
    const before = (change: number): number => {
      if (change >= 0) return 1000 / (1 + Math.exp(-k * change));
      const odds = Math.exp(k * change);
      return (1000 * odds) / (1 + odds);
    };
    for (let change = -60; change <= 60; change += 0.37) {
      expect(Object.is(map(change), before(change)), String(change)).toBe(true);
    }
    for (const change of [-1e6, -745, -99.9, -1e-9, 0, 1e-9, 3, 745, 1e6]) {
      expect(Object.is(map(change), before(change)), String(change)).toBe(true);
    }
  });

  it('and the value ten is the same curve: a snapshot that names it changes nothing', () => {
    for (let change = -60; change <= 60; change += 0.37) {
      expect(Object.is(map(change, 10), map(change)), String(change)).toBe(true);
    }
    expect(Object.is(map(10, TRAINING_RATING.CURVE_DECADE_PERCENT), map(10))).toBe(true);
  });

  it('composes the two windows with the same value, and with none as before', () => {
    const changes = { trendChange: 4, ytdChange: -2 };
    expect(performanceScore(changes)).toEqual(performanceScore(changes, 10));
    const atThree = performanceScore(changes, 3);
    expect(atThree.trendScore).toBe(map(4, 3));
    expect(atThree.ytdScore).toBe(map(-2, 3));
    expect(atThree.score).toBe(0.5 * map(4, 3) + 0.5 * map(-2, 3));
    expect(atThree.score).not.toBe(performanceScore(changes).score);
    // One window missing: the other is the score, under any value.
    expect(performanceScore({ trendChange: 4, ytdChange: null }, 3).score).toBe(map(4, 3));
    expect(performanceScore({ trendChange: null, ytdChange: null }, 3).score).toBeNull();
  });

  it('reads back, and prices a ratio, with the value it is given', () => {
    for (const decade of CANDIDATES) {
      for (const change of [-12, -3, 0, 3, 12]) {
        expect(performanceChangeForScore(map(change, decade), decade)).toBeCloseTo(change, 9);
      }
      expect(scoreForRatio(1.03, decade)).toBeCloseTo(map(3, decade), 9);
      expect(scoreForRatio(null, decade)).toBeNull();
    }
  });
});

describe('the five fixed properties hold for every candidate (D101)', () => {
  for (const decade of CANDIDATES) {
    describe(`every ${decade} points multiply the odds by four`, () => {
      it('scores no change as exactly 500', () => {
        expect(map(0, decade)).toBe(500);
        expect(map(-0, decade)).toBe(500);
      });

      it('is symmetric about 500, to the last place a double has', () => {
        // The identity is exact in algebra. In floating point the two sides
        // are two roundings of it and may differ by one unit in the last
        // place — under ten as under any other value.
        for (let change = 0.001; change < 200; change += 0.137) {
          expect(Math.abs(map(change, decade) + map(-change, decade) - 1000), String(change)).toBeLessThanOrEqual(ULP_AT_MAX);
        }
        for (const change of [1e-9, 0.5, 3, 7.5, 12, 25, 60, 250, 1000]) {
          expect(Math.abs(map(change, decade) + map(-change, decade) - 1000)).toBeLessThanOrEqual(ULP_AT_MAX);
        }
      });

      it('is monotonic and continuous, with no step at zero', () => {
        // Strictly increasing wherever a double can tell two values apart:
        // out to where the curve is within a ten-billionth of its bound.
        const reach = decade * 12;
        let previous = -Infinity;
        for (let change = -reach; change <= reach; change += reach / 480) {
          const score = map(change, decade);
          expect(score).toBeGreaterThan(previous);
          previous = score;
        }
        previous = -Infinity;
        for (let change = -400; change <= 400; change += 0.25) {
          const score = map(change, decade);
          expect(score).toBeGreaterThanOrEqual(previous);
          previous = score;
        }
        expect(map(1e-9, decade) - map(-1e-9, decade)).toBeLessThan(1e-5);
        expect(map(-1e-9, decade)).toBeLessThan(500);
        expect(map(1e-9, decade)).toBeGreaterThan(500);
      });

      it('rewards each further step less than the one before', () => {
        const step = decade / 10;
        for (let change = 0; change < decade * 6; change += step) {
          const first = map(change + step, decade) - map(change, decade);
          const second = map(change + 2 * step, decade) - map(change + step, decade);
          expect(second).toBeLessThan(first);
        }
      });

      it('is bounded to 0–1000 with no cap on the input', () => {
        for (const change of [-1e6, -1e4, -745, -99.9, 99.9, 745, 1e4, 1e6]) {
          const score = map(change, decade);
          expect(Number.isFinite(score)).toBe(true);
          expect(score).toBeGreaterThanOrEqual(RATING.MIN);
          expect(score).toBeLessThanOrEqual(RATING.MAX);
        }
        expect(map(decade * 2, decade)).toBeLessThan(RATING.MAX);
        expect(map(-decade * 2, decade)).toBeGreaterThan(RATING.MIN);
        // Every `decade` points multiply the odds by four: the one sentence, at this value.
        const odds = (change: number) => map(change, decade) / (RATING.MAX - map(change, decade));
        expect(odds(decade) / odds(0)).toBeCloseTo(TRAINING_RATING.CURVE_ODDS_PER_DECADE, 9);
        expect(odds(2 * decade) / odds(decade)).toBeCloseTo(TRAINING_RATING.CURVE_ODDS_PER_DECADE, 9);
      });
    });
  }
});

describe('what can be a curve\'s value', () => {
  it('is a positive finite number of percentage points', () => {
    for (const value of [...CANDIDATES, 0.5, 100]) expect(isCurveDecade(value), String(value)).toBe(true);
  });

  it('and nothing else: such a value would make the curve flat, a step, or not a number', () => {
    for (const junk of [0, -3, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MIN_VALUE, '3', null, undefined, {}, [], true]) {
      expect(isCurveDecade(junk), String(junk)).toBe(false);
    }
  });
});
