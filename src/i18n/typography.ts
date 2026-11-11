/**
 * Three small rules of how a number is printed (STOP 6b).
 *
 * - **A fall carries a minus sign**, U+2212, never the hyphen from the
 *   keyboard: "−10 %". The hyphen is narrower than the plus it stands
 *   opposite, sits lower, and a screen reader may read it as a dash.
 * - **A number and its percent sign never part at a line end**: the space
 *   between them is a no-break space. "auf 100 / % gerechnet" was a real
 *   line break on a 360px phone.
 * - A figure that can only be whole is printed whole; rounding is the
 *   caller's, because what is shown must agree with the colour and the
 *   word beside it (`muscleState.ts`).
 *
 * The catalogue's strings follow the same two rules by a test
 * (`typography.test.ts`), and `translate()` prints a negative parameter
 * with the minus sign, so no caller has to remember either.
 */

/** U+00A0. In a source string it is written as the escape, never typed. */
export const NBSP = ' ';

/** U+2212, the minus sign. */
export const MINUS = '−';

/** "3", "−3": a number with a real minus sign. −0 is 0. */
export function withMinus(value: number): string {
  if (Object.is(value, -0) || value === 0) return '0';
  return value < 0 ? `${MINUS}${String(Math.abs(value))}` : String(value);
}

/** "67 %", "−3 %": a number and its percent sign, unbreakable. */
export function percentText(value: number | string): string {
  return `${typeof value === 'number' ? withMinus(value) : value}${NBSP}%`;
}

/** "+12 %", "−3 %", "0 %": a change, which always carries its sign. */
export function signedPercentText(value: number): string {
  return `${value > 0 ? '+' : ''}${percentText(value)}`;
}
