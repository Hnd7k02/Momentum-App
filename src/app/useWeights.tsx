import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  formatBodyweight,
  formatWeight,
  parseBodyweight,
  parseWeight,
  type WeightUnit,
} from '../core/gym/weight';
import { useT } from '../i18n/I18nProvider';

/**
 * The weight unit the user chose (WP3, P4), for every screen that shows or
 * takes a weight. The shell provides it from the settings record; a screen
 * reads it through `useWeights`, which binds the one formatter and the one
 * parser to it. Without a provider — tests, the onboarding — it is kg.
 */
const WeightUnitContext = createContext<WeightUnit>('kg');

export function WeightUnitProvider({ unit, children }: { unit: WeightUnit; children: ReactNode }) {
  return <WeightUnitContext.Provider value={unit}>{children}</WeightUnitContext.Provider>;
}

export interface Weights {
  unit: WeightUnit;
  /** "kg" or "lb", as it is written after a number. */
  unitLabel: string;
  /** Grams as text in the unit, without the unit. */
  format(grams: number): string;
  /** Typed text as whole grams; `null` when it is not a number. */
  parse(text: string): number | null;
  /** A weight entry (kilograms) as text in the unit. */
  formatBodyweight(kg: number): string;
  /** Typed text as kilograms; `null` when it is not a number. */
  parseBodyweight(text: string): number | null;
}

export function useWeights(): Weights {
  const unit = useContext(WeightUnitContext);
  const t = useT();
  const unitLabel = t(`unit.${unit}`);
  return useMemo(
    () => ({
      unit,
      unitLabel,
      format: (grams: number) => formatWeight(grams, unit),
      parse: (text: string) => parseWeight(text, unit),
      formatBodyweight: (kg: number) => formatBodyweight(kg, unit),
      parseBodyweight: (text: string) => parseBodyweight(text, unit),
    }),
    [unit, unitLabel],
  );
}
