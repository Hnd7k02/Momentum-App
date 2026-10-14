import type { MuscleState } from '../../components/BodyRenderer';
import { percentChange, type MusclePerformance } from '../../core/gym/performance';

/**
 * A change as the screen shows it: the whole percent, with −0 as 0 (WP3, B6).
 *
 * The figure on screen is rounded, so the colour and the sign must follow
 * the rounded figure too. Taking the sign from the unrounded change and the
 * state from `ratio ≠ 1` showed +0.4 % as a green "+0 %" and −0.3 % as a red
 * "0 %". This is presentation only: the comparison, the ratio and every
 * score stay exactly as computed.
 */
export function shownPercent(ratio: number | null): number | null {
  return roundShown(percentChange(ratio));
}

/** The same rounding, for a change already expressed by `percentChange()`. */
export function roundShown(change: number | null): number | null {
  if (change === null) return null;
  const rounded = Math.round(change);
  // `Math.round(-0.3)` is −0, which prints as "0" but is not `> 0` either way.
  return rounded === 0 ? 0 : rounded;
}

export type ShownTrend = 'improved' | 'unchanged' | 'declined';

/** Which way a change reads once rounded: a 0 % change is held, like "Gehalten". */
export function shownTrend(ratio: number | null): ShownTrend | null {
  const percent = shownPercent(ratio);
  if (percent === null) return null;
  return percent > 0 ? 'improved' : percent < 0 ? 'declined' : 'unchanged';
}

/** "+12 %", "-3 %", "0 %" for a held group — from a `percentChange()` value. */
export function shownChangeText(change: number | null): string | null {
  const percent = roundShown(change);
  return percent === null ? null : `${percent > 0 ? '+' : ''}${percent} %`;
}

/**
 * The five states the body draws, from one group's performance.
 *
 * The one place the domain's three-way status and ratio become the five
 * presentation states; the SVG renderer, the 3D body and the muscle rows
 * all read this and never re-derive it. A measured group's direction is the
 * direction of the figure shown beside it (`shownTrend`), so the body tint,
 * the row and the exercise list can never disagree with their own number.
 */
export function muscleStateOf(entry: MusclePerformance): MuscleState {
  if (entry.status === 'noData') return 'noData';
  if (entry.status === 'insufficientBaseline') return 'awaitingBaseline';
  return shownTrend(entry.ratio ?? 1) ?? 'unchanged';
}
