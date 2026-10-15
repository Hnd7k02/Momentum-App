import { useCallback } from 'react';
import { exerciseDetail, exerciseDisplayName } from '../../core/gym/catalogue';
import { useI18n } from '../../i18n/I18nProvider';
import type { Language } from '../../i18n';

/**
 * How an exercise is named on screen (WP2-1, decision 4).
 *
 * A built-in shows its localised catalogue name — "Bankdrücken" in German,
 * "Bench Press" in English — whatever its stored record says, and a custom
 * exercise shows the name the user gave it. The stored name is only ever
 * the fallback, so history logged under `ex_bench_press` years ago reads in
 * today's language with not one record touched.
 */
export function useExerciseNamer(): {
  name(id: string, fallback: string): string;
  detail(id: string): string | null;
  /** "obere Brust · Brust · Schultern" — the detail first, then the groups it does not simply repeat. */
  describe(id: string, groupLabels: readonly string[]): string;
} {
  const { language } = useI18n();
  const name = useCallback(
    (id: string, fallback: string) => exerciseDisplayName(id, fallback, language),
    [language],
  );
  const detail = useCallback((id: string) => exerciseDetail(id, language), [language]);
  const describe = useCallback(
    (id: string, groupLabels: readonly string[]) => describeExercise(id, groupLabels, language),
    [language],
  );
  return { name, detail, describe };
}

/**
 * "obere Brust · Brust · Schultern": the catalogue detail first, then the
 * groups. A detail the group labels already say is dropped — "Beinbeuger"
 * says nothing that "Beinbeuger und Gesäss" does not (WP3, B11). A detail of
 * several parts ("Quadrizeps / Gesäss") is dropped only when every part is
 * said by some group; one part that adds something ("Brust unten / Trizeps")
 * keeps it. The comparison ignores case.
 */
export function describeExercise(
  id: string,
  groupLabels: readonly string[],
  language: Language,
): string {
  const label = exerciseDetail(id, language);
  const groups = groupLabels.map((group) => group.toLowerCase());
  const repeats =
    label !== null &&
    label
      .split('/')
      .map((part) => part.trim().toLowerCase())
      .every((part) => groups.some((group) => group.includes(part)));
  return [...(label && !repeats ? [label] : []), ...groupLabels].join(' · ');
}
