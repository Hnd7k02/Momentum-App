import { addDays, middayOf, todayKey, type DateKey } from '../core/dates';
import type { Language } from '../core/model';
import { localeOf, translate } from './index';
import { percentText } from './typography';

/**
 * All user-facing dates and numbers go through here, so the language setting
 * changes the whole interface rather than just the labels.
 */

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(language: Language, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const cacheKey = `${language}:${JSON.stringify(options)}`;
  let existing = cache.get(cacheKey);
  if (!existing) {
    existing = new Intl.DateTimeFormat(localeOf(language), options);
    cache.set(cacheKey, existing);
  }
  return existing;
}

/** "31. März" / "31 March". */
export function formatDayAndMonth(language: Language, day: DateKey): string {
  return formatter(language, { day: 'numeric', month: 'long' }).format(middayOf(day));
}

/** "Montag" / "Monday". */
export function formatWeekday(language: Language, day: DateKey): string {
  return formatter(language, { weekday: 'long' }).format(middayOf(day));
}

/** "Mo" / "Mon" — for the heatmap axis, where space is scarce. */
export function formatWeekdayShort(language: Language, day: DateKey): string {
  return formatter(language, { weekday: 'short' }).format(middayOf(day));
}

/** "31.03.2025" / "31/03/2025". */
export function formatFullDate(language: Language, day: DateKey): string {
  return formatter(language, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    middayOf(day),
  );
}

/** Prefers "Heute" and "Gestern" over a date the user has to decode. */
export function formatRelativeDay(language: Language, day: DateKey, reference: DateKey = todayKey()): string {
  if (day === reference) return translate(language, 'common.today');
  if (day === addDays(reference, -1)) return translate(language, 'common.yesterday');
  return formatDayAndMonth(language, day);
}

/** "14:32" — used where several entries share a day and the time is what
 *  tells them apart. */
export function formatTime(language: Language, instant: string | Date): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return '';
  return formatter(language, { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatNumber(language: Language, value: number, fractionDigits = 0): string {
  const formatted = new Intl.NumberFormat(localeOf(language), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
  // Some ICU versions group Swiss thousands with a typographic apostrophe
  // (U+2019) and others with a straight one. Normalise, so the same number
  // does not render differently on iOS and on desktop.
  return formatted.replace(/\u2019/g, "'");
}

/** Percentages are shown without decimals: the extra precision is noise. */
export function formatPercent(language: Language, ratio0to100: number): string {
  return percentText(formatNumber(language, Math.round(ratio0to100)));
}
