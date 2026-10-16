/**
 * Whole percentages that add to exactly 100 (D82).
 *
 * Three equal shares are 33.33 each, and three 33s are 99. The missing
 * points go to the rows with the largest fractional part — the standard
 * largest-remainder apportionment — rather than to whichever row happens to
 * be last, so the one row that reads 34 is the one that was closest to it.
 *
 * Rang states a share twice, in the list of areas and on the Gewichtung
 * card. Both read it from here, so one area never shows two numbers.
 */
export function wholePercents(shares: readonly number[]): number[] {
  const exact = shares.map((share) => share * 100);
  const percents = exact.map((value) => Math.floor(value));
  let drift = 100 - percents.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of order) {
    if (drift <= 0) break;
    percents[index] = (percents[index] ?? 0) + 1;
    drift -= 1;
  }
  return percents;
}
