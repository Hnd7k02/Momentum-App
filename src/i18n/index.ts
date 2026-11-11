import type { Language } from '../core/model';
import { withMinus } from './typography';
import { de, type TranslationKey, type Translations } from './de';
import { en } from './en';

export type { TranslationKey, Translations };
export type { Language };

export const LANGUAGES: Language[] = ['de', 'en'];
export const DEFAULT_LANGUAGE: Language = 'de';

const CATALOGUES: Record<Language, Translations> = { de, en };

/**
 * BCP 47 tags for `Intl`. Dates and numbers follow the chosen language.
 *
 * German uses the Swiss locale: dates, weekdays and month names are identical
 * to de-DE, but thousands group with an apostrophe — 4'820, not 4.820.
 */
const LOCALES: Record<Language, string> = { de: 'de-CH', en: 'en-GB' };

export type TranslationParams = Record<string, string | number>;

/**
 * A deliberately small key-based string layer — no framework, no runtime
 * loading, no plural engine beyond what the copy actually needs. Keys are
 * typed, so an unknown one does not compile.
 */
export function translate(
  language: Language,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  const template = CATALOGUES[language][key] ?? de[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) return match;
    // A negative number is printed with a real minus sign (`typography.ts`).
    return typeof value === 'number' ? withMinus(value) : String(value);
  });
}

export type Translator = (key: TranslationKey, params?: TranslationParams) => string;

export function createTranslator(language: Language): Translator {
  return (key, params) => translate(language, key, params);
}

export function localeOf(language: Language): string {
  return LOCALES[language];
}

export function isLanguage(value: unknown): value is Language {
  return value === 'de' || value === 'en';
}
