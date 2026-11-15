import { TRAINING_RATING, RATING } from '../config/constants';

/**
 * Turning a performance *change* into a 0–1000 Performance Score.
 *
 * This is the piece phase 4 deliberately left open (D88): performance is a
 * rate of change, the rating is a level, and nothing said what rate equalled
 * what level. It is now one function with one parameter.
 *
 * ## The curve
 *
 * ```
 *                            1000
 *   score(x) =  ────────────────────────────
 *                 1 + ODDS ^ (−x / DECADE)
 * ```
 *
 * with `ODDS = 4` and `DECADE = 10` percentage points — a logistic curve
 * written in base 4 rather than base e, because in that form it says
 * something a reader can hold on to:
 *
 * > **Every ten points of improvement multiplies the odds by four.**
 *
 * The score's odds are `score / (1000 − score)`. At 0 % they are 1:1, which
 * is 500. At +10 % they are 4:1, which is 800. At −10 % they are 1:4, which
 * is 200. Nothing else needs to be memorised, and the single constant can be
 * retuned without any of the properties below changing.
 *
 * ## The properties it has to have, and why each one holds
 *
 * | Required | Why it holds |
 * |---|---|
 * | `score(0) = 500` | `ODDS^0 = 1`, so the denominator is exactly 2. Exact, not fitted. |
 * | symmetric about 500 | `1000 − score(x) = score(−x)` is an identity of the logistic, exact in algebra; in the stable form used below the two sides agree to within one unit in the last place of a double. |
 * | monotonic | the exponent is strictly decreasing in `x`, so the denominator is too. |
 * | diminishing returns | the logistic's slope is maximal at `x = 0` and falls monotonically as `|x|` grows, which is the definition of diminishing marginal reward. |
 * | continuous at 0 | one expression over the whole line; there is no branch on sign that changes the value, only one that keeps the exponential in range. |
 * | bounded 0–1000 | the denominator is always > 1, and → 1 or → ∞ at the extremes. |
 * | no cap on the input | a beginner tripling their best set is +200 %, which scores 999.999. Large gains keep helping and keep helping less. |
 * | deterministic | pure arithmetic on a double; the same input gives the same bits every time. |
 *
 * ## The fit against the approved anchors
 *
 * ```
 *   change    approved    curve      note
 *    −20 %          0      58.82     see below
 *    −10 %        200     200.00     exact
 *     −5 %        330     333.33     +3.33
 *      0 %        500     500.00     exact
 *     +5 %        670     666.67     −3.33
 *    +10 %        800     800.00     exact
 *    +20 %        950     941.18     −8.82
 * ```
 *
 * **The anchor table cannot be satisfied as written, and the specification
 * says which way to resolve it.** −20 % → 0 and +20 % → 950 are not
 * symmetric: symmetry about 500 requires that if +20 % scores 950 then −20 %
 * scores 50. And an asymptotically bounded curve cannot reach exactly 0 at a
 * finite input at all — a function that hits 0 at −20 % either stops being
 * monotonic below it or clips, and clipping would make every collapse worse
 * than −20 % indistinguishable from every other. The approved priority order
 * puts `score(0) = 500`, monotonicity, symmetry and diminishing returns above
 * closeness to the table, so the two ±20 % anchors are the ones that give.
 * Every other anchor is met exactly or within 3.4 points.
 *
 * ## One function, and the one value a domain may bring of its own
 *
 * The properties above are the curve's, for every domain, and none of them
 * depends on `DECADE` (D101). `DECADE` is the one value D99 allows to be
 * tuned: how many percentage points of change multiply the odds by `ODDS`.
 * It is ten in the constants, and ten is what this module computes with
 * **when no value is handed in** — every Running day, and every Gym day
 * before the era of WP3 Stage 5b.
 *
 * From that era on Gym brings its own (D177): the Stage 5b metric reads a
 * week's progress as two or three percent where `reps × load` read ten and
 * more, so the same curve needs fewer points per decade to say the same
 * thing. The value travels in the day's snapshot
 * (`scoring.gymMetric.curveDecadePercent`, read by `gymCurveOf()`), and the
 * caller hands it in. It is an argument, not a second curve: one expression,
 * one set of properties, no table and no branch.
 */

/** `ln(ODDS) / DECADE` — the logistic rate, per percentage point, of the constants. */
const K =
  Math.log(TRAINING_RATING.CURVE_ODDS_PER_DECADE) / TRAINING_RATING.CURVE_DECADE_PERCENT;

/**
 * The logistic rate for a curve whose odds multiply by `ODDS` every
 * `decadePercent` points. Without a value it is `K` itself — the same
 * double, so a caller that hands nothing in computes bit for bit what this
 * module always computed. With ten it is the same quotient of the same two
 * numbers, and so the same double again.
 */
function rateOf(decadePercent: number | undefined): number {
  return decadePercent === undefined
    ? K
    : Math.log(TRAINING_RATING.CURVE_ODDS_PER_DECADE) / decadePercent;
}

/**
 * Whether a value can be a curve's `DECADE`: a positive finite number of
 * percentage points whose rate is finite and above zero. A stored value is
 * asked this before it is used (`gymCurveOf()`); anything else — a string
 * from a restored file, zero, a number so small that its rate overflows —
 * is no value, and the curve of the constants applies.
 */
export function isCurveDecade(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return false;
  const rate = Math.log(TRAINING_RATING.CURVE_ODDS_PER_DECADE) / value;
  return Number.isFinite(rate) && rate > 0;
}

/**
 * A performance change in **percent** (+10 means ten per cent better) as a
 * 0–1000 Performance Score.
 *
 * The two branches are a numerical-stability device and nothing else: both
 * compute the same logistic, and each is written so the exponential runs
 * towards zero rather than towards infinity. Evaluating `1/(1+e^-kx)`
 * directly at x = −10000 overflows to `Infinity` and returns 0 by luck;
 * at +10000 it underflows cleanly. Mirroring the algebra means a collapse of
 * −99.9 % and a gain of +100000 % both land on a real number, and the two
 * branches agree exactly at their shared boundary, x = 0, where each is 500.
 *
 * `decadePercent` is the curve's one value, where the day's snapshot carries
 * one (see above): how many percentage points multiply the odds by four.
 * Left out, it is the constants' ten.
 */
export function mapPerformanceChangeToScore(changePercent: number, decadePercent?: number): number {
  if (!Number.isFinite(changePercent)) {
    // Not a rate anything produced: ±Infinity cannot come out of a ratio of
    // two positive finite best sets, and NaN is a bug. Neither is a result.
    return changePercent > 0 ? RATING.MAX : RATING.MIN;
  }
  const rate = rateOf(decadePercent);
  if (changePercent >= 0) {
    return RATING.MAX / (1 + Math.exp(-rate * changePercent));
  }
  const odds = Math.exp(rate * changePercent);
  return (RATING.MAX * odds) / (1 + odds);
}

/** The same curve read backwards, for a screen that wants to state a target. */
export function performanceChangeForScore(score: number, decadePercent?: number): number {
  if (score <= RATING.MIN) return -Infinity;
  if (score >= RATING.MAX) return Infinity;
  return Math.log(score / (RATING.MAX - score)) / rateOf(decadePercent);
}

/**
 * A ratio (1.2 for twenty per cent better) as a Performance Score.
 *
 * `null` in, `null` out: no comparison is not a change of zero, and the one
 * thing this app never does is score an absence.
 */
export function scoreForRatio(ratio: number | null, decadePercent?: number): number | null {
  if (ratio === null) return null;
  return mapPerformanceChangeToScore((ratio - 1) * 100, decadePercent);
}

/**
 * Attendance as a 0–1000 score.
 *
 * The existing weekly rule, on the existing scale: `min(sessions / target, 1)`
 * — so extra sessions beyond the target buy nothing here. They are not
 * wasted, they are simply counted where they belong: in performance, and in
 * the weeks that keep the Endurance progression moving.
 */
export function attendanceScore(sessions: number, target: number): number {
  const quota = Math.max(1, target);
  const fraction = Math.min(1, Math.max(0, sessions / quota));
  return fraction * RATING.MAX;
}

export interface PerformanceComponents {
  /** The rolling-window change, in percent, or `null` with no baseline. */
  trendChange: number | null;
  /** The year-to-date change, in percent, or `null` with no baseline. */
  ytdChange: number | null;
}

export interface PerformanceScore {
  /** The blended 0–1000 score, or `null` when neither window has a baseline. */
  score: number | null;
  trendScore: number | null;
  ytdScore: number | null;
  /** Which components were actually available, for the interface to explain. */
  components: ('trend' | 'ytd')[];
}

/**
 * The Performance Score: **map each window, then average the scores.**
 *
 * The order matters and is not interchangeable. Averaging the two *changes*
 * and mapping once would run a non-linear curve over a blended rate and lose
 * exactly the thing the two windows exist to keep apart. A user who has
 * improved 20 % over the year and slipped 20 % in the last two months is not
 * the same as one who has done nothing at all: mapped first, they score
 * (941 + 59) / 2 = 500 — a genuine "these two signals disagree" — where
 * averaging the changes first gives 0 % and the same 500 by coincidence. The
 * disagreement is visible in the components either way, and at other values
 * the two orders simply differ. There is a test that proves this code takes
 * the first road.
 *
 * When only one window has a baseline, that window *is* the score. The
 * missing one is not a zero and not a neutral 500 — it is missing, and
 * inventing a value for it would be the one mistake this app is built not to
 * make.
 *
 * `decadePercent` is the curve's value for both windows of the day, handed
 * through as it came from that day's snapshot; left out, the constants'.
 */
export function performanceScore(input: PerformanceComponents, decadePercent?: number): PerformanceScore {
  const trendScore =
    input.trendChange === null ? null : mapPerformanceChangeToScore(input.trendChange, decadePercent);
  const ytdScore =
    input.ytdChange === null ? null : mapPerformanceChangeToScore(input.ytdChange, decadePercent);

  const components: ('trend' | 'ytd')[] = [];
  if (trendScore !== null) components.push('trend');
  if (ytdScore !== null) components.push('ytd');

  if (trendScore !== null && ytdScore !== null) {
    return {
      score: TRAINING_RATING.TREND_WEIGHT * trendScore + TRAINING_RATING.YTD_WEIGHT * ytdScore,
      trendScore,
      ytdScore,
      components,
    };
  }

  return { score: trendScore ?? ytdScore, trendScore, ytdScore, components };
}
