import { scaleValueToPercent } from '../scoring/scale';

/**
 * How a Food day replays (D106–D111).
 *
 * Food left the product in WP3 Stage 4 (D139): nothing rates a day any more
 * and nothing shows one. But the days it was switched on still replay, and
 * they replay by what Food measured then — **one number the user chose each
 * day**, how closely the day matched what they were trying to eat like, on
 * the same 1–10 scale every other subjective answer uses. That number was
 * stored verbatim (`FoodDayRecord.adherence`), and the day's percentage is
 * derived from it here, on every replay, exactly as it was when the day was
 * lived.
 *
 * Calories and macros were logged and totalled for the user's own record
 * and never scored: what a person's targets should be was never decided, and
 * no number stood in for it. That stays true of every replayed Food day.
 */

/** The day's percentage: value × 10, the same mapping a scale answer uses. */
export function adherencePercent(value: number): number {
  return scaleValueToPercent(value);
}
