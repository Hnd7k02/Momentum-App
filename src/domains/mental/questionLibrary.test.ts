import { describe, expect, it } from 'vitest';
import { suggestedQuestions, yesterdayWordingOf } from './questionLibrary';

/**
 * The standard questions as Gestern shows them (STOP 3b, question 3 — D144).
 *
 * Display only, and only for a library sentence stored exactly as it was
 * picked: the wording comes from the library, in the stored text's own
 * language, and anything else is shown as written.
 */

const LANGUAGES = ['de', 'en'] as const;
const all = LANGUAGES.flatMap((language) => suggestedQuestions(language).map((question) => ({ language, ...question })));

describe('the Gestern wording', () => {
  it('exists for every standard question, and differs from the Heute one', () => {
    for (const question of all) {
      expect(question.yesterday.trim(), question.id).not.toBe('');
      expect(question.yesterday, question.id).not.toBe(question.text);
    }
  });

  it('speaks of yesterday and never of today', () => {
    for (const question of all) {
      if (question.language === 'de') {
        expect(question.yesterday, question.id).not.toMatch(/\bheute\b/i);
        expect(question.yesterday, question.id).toMatch(/\bgestern\b|vorletzte Nacht/);
      } else {
        expect(question.yesterday, question.id).not.toMatch(/\btoday\b/i);
        expect(question.yesterday, question.id).toMatch(/\byesterday\b|night before last/);
      }
    }
  });

  it('is Swiss German: no ß, and every sentence normalised', () => {
    for (const question of all) {
      expect(question.yesterday, question.id).not.toContain('ß');
      expect(question.text.normalize('NFC')).toBe(question.text);
      expect(question.yesterday.normalize('NFC')).toBe(question.yesterday);
    }
  });

  it('is matched without ambiguity: every sentence occurs once, in one language', () => {
    const sentences = all.flatMap((question) => [question.text, question.yesterday]);
    expect(new Set(sentences).size).toBe(sentences.length);
  });

  it('answers a stored library sentence in its own language, whatever the interface', () => {
    for (const question of all) expect(yesterdayWordingOf(question.text), question.id).toBe(question.yesterday);
    expect(yesterdayWordingOf('Wie war deine Stimmung heute?')).toBe('Wie war deine Stimmung gestern?');
    expect(yesterdayWordingOf('How was your mood today?')).toBe('How was your mood yesterday?');
  });

  it('leaves anything else as written', () => {
    for (const text of [
      'Wie war deine Stimmung heute', // edited: the question mark
      'wie war deine Stimmung heute?', // edited: the case
      'Wie war deine Stimmung heute? ',
      'Hast du heute die Küche aufgeräumt?', // the user's own
      'Wie war deine Stimmung gestern?', // a Gestern wording typed as a question
      '',
    ]) {
      expect(yesterdayWordingOf(text), JSON.stringify(text)).toBeNull();
    }
  });
});
