import type { Translator } from '../../i18n';
import { roundShown, shownTrendOfChange, type ShownTrend } from './muscleState';

/**
 * A change as the one line a list, a tile or a card has room for: "+9 %",
 * "−4 %", and "Gehalten" for everything inside the band.
 *
 * Rounding and band are `muscleState.ts`'s — this only chooses the words.
 * Where a figure stands alone on a line, a held change is the word and not
 * "+2 %": a bare "+2 %" in the text colour would read as a rise, and the
 * word is the statement the band makes. The muscle rows and the figure
 * above them have room for both and print both.
 */
export interface ChangeWords {
  text: string;
  trend: ShownTrend;
}

export function changeWords(change: number | null, t: Translator): ChangeWords | null {
  const percent = roundShown(change);
  const trend = shownTrendOfChange(change);
  if (percent === null || trend === null) return null;
  if (trend === 'unchanged') return { text: t('gym.change.unchanged'), trend };
  return {
    text: t(trend === 'improved' ? 'gym.change.improved' : 'gym.change.declined', { percent }),
    trend,
  };
}
