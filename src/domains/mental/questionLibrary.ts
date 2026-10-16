import { QUESTION_CATEGORIES, type Language, type QuestionCategory, type QuestionType } from '../../core/model';
import type { TranslationKey } from '../../i18n';

export interface SuggestedQuestion {
  id: string;
  category: QuestionCategory;
  text: string;
  type: QuestionType;
  /**
   * The same question as Gestern shows it, in the same language (D144).
   * Required, so a new entry cannot ship without one.
   */
  yesterday: string;
}

/**
 * The library of Wellbeing questions offered during setup.
 *
 * Organised by the part of life a question belongs to (D17), because that is
 * how the daily score is computed: the mean within a category, then the mean
 * across categories. Six questions about the household cannot drown out the
 * one that asks how the user actually feels — and a user picking from a flat
 * list would produce exactly that imbalance without ever intending to.
 *
 * Each one is a literal sentence rather than a keyword, and each is
 * answerable without thinking. The mix of types is deliberate: a state with
 * no "done" moment is a scale, an action is yes/no.
 *
 * A suggestion is only a seed. Once picked, its text is copied into a normal
 * question record and belongs to the user, so later edits to this list never
 * disturb anyone's history. The five that RC2 shipped keep their exact
 * wording, so a migrated question and a newly picked one are the same
 * question rather than two that merely look alike.
 */
const LIBRARY: Record<Language, SuggestedQuestion[]> = {
  de: [
    // Alltag — kochen, aufräumen, Routinen.
    { id: 'cook', category: 'alltag', text: 'Hast du heute selbst gekocht?', type: 'boolean',
      yesterday: 'Hast du gestern selbst gekocht?' },
    { id: 'tidy', category: 'alltag', text: 'Hast du heute aufgeräumt?', type: 'boolean',
      yesterday: 'Hast du gestern aufgeräumt?' },
    { id: 'routine', category: 'alltag', text: 'Wie gut hat dein Alltag heute funktioniert?', type: 'scale',
      yesterday: 'Wie gut hat dein Alltag gestern funktioniert?' },
    { id: 'outside', category: 'alltag', text: 'Warst du heute an der frischen Luft?', type: 'boolean',
      yesterday: 'Warst du gestern an der frischen Luft?' },

    // Gesundheit — Energie, Schlaf, körperliches Wohlbefinden.
    { id: 'sleep', category: 'gesundheit', text: 'Wie gut hast du geschlafen?', type: 'scale',
      yesterday: 'Wie gut hast du vorletzte Nacht geschlafen?' },
    { id: 'energy', category: 'gesundheit', text: 'Wie hoch war dein Energielevel?', type: 'scale',
      yesterday: 'Wie hoch war dein Energielevel gestern?' },
    { id: 'body', category: 'gesundheit', text: 'Wie hat sich dein Körper heute angefühlt?', type: 'scale',
      yesterday: 'Wie hat sich dein Körper gestern angefühlt?' },
    { id: 'water', category: 'gesundheit', text: 'Hast du heute genug getrunken?', type: 'boolean',
      yesterday: 'Hast du gestern genug getrunken?' },

    // Mental — Stimmung, Motivation, seelischer Zustand.
    { id: 'satisfaction', category: 'mental', text: 'Wie zufrieden bist du heute mit deinem Tag?', type: 'scale',
      yesterday: 'Wie zufrieden warst du gestern mit deinem Tag?' },
    { id: 'mood', category: 'mental', text: 'Wie war deine Stimmung heute?', type: 'scale',
      yesterday: 'Wie war deine Stimmung gestern?' },
    { id: 'motivation', category: 'mental', text: 'Wie motiviert warst du heute?', type: 'scale',
      yesterday: 'Wie motiviert warst du gestern?' },
    { id: 'time', category: 'mental', text: 'Hast du dir heute bewusst Zeit für dich genommen?', type: 'boolean',
      yesterday: 'Hast du dir gestern bewusst Zeit für dich genommen?' },
    { id: 'good', category: 'mental', text: 'Hast du heute etwas gemacht, das dir gutgetan hat?', type: 'boolean',
      yesterday: 'Hast du gestern etwas gemacht, das dir gutgetan hat?' },
  ],
  en: [
    { id: 'cook', category: 'alltag', text: 'Did you cook for yourself today?', type: 'boolean',
      yesterday: 'Did you cook for yourself yesterday?' },
    { id: 'tidy', category: 'alltag', text: 'Did you tidy up today?', type: 'boolean',
      yesterday: 'Did you tidy up yesterday?' },
    { id: 'routine', category: 'alltag', text: 'How well did your day run?', type: 'scale',
      yesterday: 'How well did your day run yesterday?' },
    { id: 'outside', category: 'alltag', text: 'Did you get outside today?', type: 'boolean',
      yesterday: 'Did you get outside yesterday?' },

    { id: 'sleep', category: 'gesundheit', text: 'How well did you sleep?', type: 'scale',
      yesterday: 'How well did you sleep the night before last?' },
    { id: 'energy', category: 'gesundheit', text: 'How high was your energy level?', type: 'scale',
      yesterday: 'How high was your energy level yesterday?' },
    { id: 'body', category: 'gesundheit', text: 'How did your body feel today?', type: 'scale',
      yesterday: 'How did your body feel yesterday?' },
    { id: 'water', category: 'gesundheit', text: 'Did you drink enough today?', type: 'boolean',
      yesterday: 'Did you drink enough yesterday?' },

    { id: 'satisfaction', category: 'mental', text: 'How satisfied are you with your day?', type: 'scale',
      yesterday: 'How satisfied were you with your day yesterday?' },
    { id: 'mood', category: 'mental', text: 'How was your mood today?', type: 'scale',
      yesterday: 'How was your mood yesterday?' },
    { id: 'motivation', category: 'mental', text: 'How motivated were you today?', type: 'scale',
      yesterday: 'How motivated were you yesterday?' },
    { id: 'time', category: 'mental', text: 'Did you take time for yourself today?', type: 'boolean',
      yesterday: 'Did you take time for yourself yesterday?' },
    { id: 'good', category: 'mental', text: 'Did you do something today that was good for you?', type: 'boolean',
      yesterday: 'Did you do something yesterday that was good for you?' },
  ],
};

/**
 * The categories a user picks from, in the order they are offered.
 *
 * "Eigene" is not among them: it is where a question the user writes lands,
 * not a shelf with anything on it.
 */
export const PICKABLE_CATEGORIES: QuestionCategory[] = QUESTION_CATEGORIES.filter(
  (category) => category !== 'eigene',
);

export const CATEGORY_LABEL_KEYS = {
  alltag: 'category.alltag',
  gesundheit: 'category.gesundheit',
  mental: 'category.mental',
  eigene: 'category.eigene',
} as const satisfies Record<QuestionCategory, TranslationKey>;

export const CATEGORY_DESCRIPTION_KEYS = {
  alltag: 'category.alltag.description',
  gesundheit: 'category.gesundheit.description',
  mental: 'category.mental.description',
  eigene: 'category.eigene.description',
} as const satisfies Record<QuestionCategory, TranslationKey>;

export function suggestedQuestions(language: Language): SuggestedQuestion[] {
  return LIBRARY[language];
}

/** Every library sentence, in either language, to its Gestern wording. */
const YESTERDAY = new Map(
  Object.values(LIBRARY).flatMap((questions) => questions.map((question) => [question.text, question.yesterday] as const)),
);

/**
 * How a question reads on the Gestern side (STOP 3b, question 3 — D144):
 * a library sentence, stored exactly as it was picked, in its own language;
 * `null` for anything else.
 *
 * Display only. The record, every snapshot and every answer keep the stored
 * text; nothing here is written. The match is exact because only the
 * library's own sentences are known to say which day they mean — a question
 * the user wrote or edited, even by one letter, is shown as written, "heute"
 * and all. A record stores no language, so a German question reads in German
 * whatever the interface language, as it does on Heute.
 */
export function yesterdayWordingOf(text: string): string | null {
  return YESTERDAY.get(text) ?? null;
}

export function suggestionsByCategory(
  language: Language,
): { category: QuestionCategory; questions: SuggestedQuestion[] }[] {
  const all = suggestedQuestions(language);
  return PICKABLE_CATEGORIES.map((category) => ({
    category,
    questions: all.filter((question) => question.category === category),
  }));
}
