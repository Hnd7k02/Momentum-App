/**
 * Weights as the user reads and types them (WP3, P4).
 *
 * Storage never changes unit: a set's load is integer **grams**, a weight
 * entry is **kilograms**. The unit is a display preference — kg or lb —
 * applied here, in one formatter and one parser, at the edge of the screen.
 * Nothing in scoring or replay reads it, so switching it moves no number
 * anywhere but on the screen.
 *
 * - **kg** reads as before: whole numbers whole, 62.5 keeps its half, 60.25
 *   its quarter.
 * - **lb** is shown with at most one decimal; what is typed in lb is
 *   converted at 1 lb = 453.59237 g and rounded to whole grams, so 135 lb is
 *   stored as 61 235 g and reads back as 135.
 */
export type WeightUnit = 'kg' | 'lb';

export const WEIGHT_UNITS: readonly WeightUnit[] = ['kg', 'lb'];

/** The international avoirdupois pound, exactly. */
export const GRAMS_PER_POUND = 453.59237;

const GRAMS_PER: Record<WeightUnit, number> = { kg: 1000, lb: GRAMS_PER_POUND };

/** A stored load in grams, as text in `unit` (no unit sign). */
export function formatWeight(grams: number, unit: WeightUnit): string {
  if (unit === 'lb') {
    const pounds = Math.round((grams / GRAMS_PER_POUND) * 10) / 10;
    return String(pounds === 0 ? 0 : pounds);
  }
  const kg = grams / 1000;
  return Number.isInteger(kg) ? String(kg) : String(Number(kg.toFixed(3)));
}

/**
 * Typed text in `unit`, as whole grams. A comma reads as a decimal point.
 * Text that is not a number reads as `null`, so a caller can tell an empty
 * field from a typed zero.
 */
export function parseWeight(text: string, unit: WeightUnit): number | null {
  const value = Number.parseFloat(text.trim().replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value * GRAMS_PER[unit]));
}

/** A weight entry, stored in kilograms, as text in `unit`. */
export function formatBodyweight(kg: number, unit: WeightUnit): string {
  return formatWeight(Math.round(kg * 1000), unit);
}

/** Typed text in `unit`, as kilograms to the gram; `null` when not a number. */
export function parseBodyweight(text: string, unit: WeightUnit): number | null {
  const grams = parseWeight(text, unit);
  return grams === null ? null : grams / 1000;
}

/** Whatever was stored before the preference existed reads as kilograms. */
export function weightUnitOf(value: unknown): WeightUnit {
  return value === 'lb' ? 'lb' : 'kg';
}
