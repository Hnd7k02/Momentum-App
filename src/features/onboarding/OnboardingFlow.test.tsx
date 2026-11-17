// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { GYM, RANKS } from '../../core/config/constants';
import { suggestedQuestions } from '../../domains/mental/questionLibrary';
import { translate, type Language } from '../../i18n';
import { I18nProvider } from '../../i18n/I18nProvider';
import type { OnboardingSelection } from '../../storage/services/configurationService';
import { mount, type Mounted } from '../../test/dom';
import { OnboardingFlow, STARTER_QUESTIONS } from './OnboardingFlow';

/**
 * The onboarding, every way through it.
 *
 * WP3 Stage 4 (D139, D143): two worlds, Mind and Gym with Laufen inside
 * Gym, and nothing that could switch Food on. Block 7E (D190, D191): the
 * look of direction C, three starter questions chosen, «Weiter» held while
 * Mind has none, and a step that never shows a number the flow does not
 * hold. What the flow hands to storage is checked for every path; the
 * flow itself writes nothing — `onFinish` is the only way out of it.
 */

let mounted: Mounted | null = null;

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  document.documentElement.removeAttribute('data-onboarding');
});

async function open(
  language: Language = 'de',
  onFinish: (selection: OnboardingSelection) => void = () => undefined,
  failed = false,
) {
  mounted = await mount(
    <I18nProvider language={language} setLanguage={() => undefined}>
      <OnboardingFlow onFinish={onFinish} failed={failed} />
    </I18nProvider>,
  );
}

const text = () => (document.querySelector('.onboarding')?.textContent ?? '').replace(/\s+/g, ' ');
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('button')];
const buttonNamed = (name: string) => buttons().find((button) => button.textContent?.trim() === name);
const primary = () => document.querySelector<HTMLButtonElement>('.onboarding__footer .button--primary')!;
const step = () => document.querySelector('.onboarding')?.getAttribute('data-step');
const note = () => document.querySelector('.onboarding__note')?.textContent?.trim() ?? '';

async function click(element: Element | undefined | null): Promise<void> {
  expect(element).toBeTruthy();
  await act(async () => (element as HTMLElement).click());
}

/** One of the two area tiles by its name. */
const area = (name: 'Mind' | 'Gym') =>
  [...document.querySelectorAll<HTMLButtonElement>('.world-tile--choice')].find(
    (tile) => tile.querySelector('.world-tile__name')?.textContent === name,
  );

/** A question row by the start of its text. */
const question = (start: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.category-group .question-pick[aria-pressed]')].find((row) =>
    row.querySelector('.question-pick__text')?.textContent?.startsWith(start),
  );

const chosenQuestions = () =>
  [...document.querySelectorAll('.category-group .question-pick[aria-pressed="true"] .question-pick__text')].map(
    (node) => node.textContent,
  );

/** A target's value, in the group named for it. */
const target = (group: string, count: number) =>
  document
    .querySelector(`[role="group"][aria-label="${group}"]`)
    ?.querySelector<HTMLButtonElement>(`button[aria-label="${count} pro Woche"]`);

/** Through the three slides to the areas. */
async function toAreas(language: Language = 'de'): Promise<void> {
  await click(buttonNamed(translate(language, 'onboarding.welcome.start')));
  await click(buttonNamed(translate(language, 'common.continue')));
  await click(buttonNamed(translate(language, 'common.continue')));
  expect(step()).toBe('domains');
}

const next = (language: Language = 'de') => click(buttonNamed(translate(language, 'common.continue')));

/** What the library says a starter question is, as the flow hands it on. */
function starters(language: Language) {
  const library = suggestedQuestions(language);
  return STARTER_QUESTIONS.map((id) => {
    const entry = library.find((suggestion) => suggestion.id === id)!;
    return { text: entry.text, type: entry.type, category: entry.category };
  });
}

/** Elements a keyboard or a screen reader could operate. */
const OPERABLE = 'button, a[href], input, select, textarea, [tabindex], [role="button"], [role="radio"], [role="switch"]';

/** The step's dark surfaces: a Gym surface or the rank's stage. */
const darkSurfaces = () =>
  [...document.querySelectorAll('.onboarding [data-world="gym"], .onboarding .rank-stage')].filter(
    // A Gym surface inside another counts once.
    (element) => !element.parentElement?.closest('[data-world="gym"]'),
  );

describe('the onboarding picker', () => {
  it.each(['de', 'en'] as const)('offers Mind and Gym, Laufen included, and no Food (%s)', async (language) => {
    await open(language);
    await click(buttonNamed(translate(language, 'onboarding.welcome.start')));
    const worlds = text();
    expect(worlds).toContain(translate(language, 'onboarding.concept.worlds.title').replace(/\s+/g, ' '));
    expect(worlds).toContain(translate(language, 'onboarding.concept.worlds.body'));
    await next(language);
    await next(language);

    expect(document.querySelector('.onboarding__title')?.textContent).toBe(translate(language, 'onboarding.domains.title'));
    const choices = [...document.querySelectorAll('.question-pick')].map((choice) => [
      choice.querySelector('.question-pick__text')?.textContent,
      choice.querySelector('.onboarding__hint')?.textContent,
    ]);
    expect(choices).toEqual([
      ['Mind', translate(language, 'domain.mental.description')],
      ['Gym', translate(language, 'onboarding.domains.gym')],
    ]);
    expect(document.body.textContent).not.toMatch(/ernährung|food|sport\b/i);
  });

  it('hands storage a selection with no field for Food, and Laufen through Gym', async () => {
    const finished: OnboardingSelection[] = [];
    await open('de', (selection) => finished.push(selection));
    await toAreas();
    // Gym on, Mind off: the Gym step asks for both targets.
    await click(area('Gym'));
    await click(area('Mind'));
    await next();
    expect(document.body.textContent).toContain(translate('de', 'onboarding.sport.gym'));
    expect(document.body.textContent).toContain(translate('de', 'onboarding.sport.running'));
    await next();
    await click(buttonNamed(translate('de', 'onboarding.summary.start')));

    expect(finished).toEqual([{ questions: [], gymTargetPerWeek: 3, runningTargetPerWeek: null }]);
    expect(Object.keys(finished[0]!).sort()).toEqual(['gymTargetPerWeek', 'questions', 'runningTargetPerWeek']);
  });
});

describe('every way through it (block 7E, D191)', () => {
  it('Mind alone: three slides, the areas, the questions, the summary — and the three starter questions', async () => {
    const finished: OnboardingSelection[] = [];
    await open('de', (selection) => finished.push(selection));
    const seen: (string | null | undefined)[] = [step()];
    await click(buttonNamed('Los geht’s'));
    seen.push(step());
    await next();
    seen.push(step());
    await next();
    seen.push(step());
    // Mind is chosen from the start, so the areas need no tap.
    expect(area('Mind')?.getAttribute('aria-pressed')).toBe('true');
    expect(area('Gym')?.getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelectorAll('.onboarding__dot')).toHaveLength(6);
    await next();
    seen.push(step());
    await next();
    seen.push(step());
    await click(buttonNamed('Starten'));

    expect(seen).toEqual(['momentum', 'worlds', 'rank', 'domains', 'questions', 'summary']);
    expect(finished).toEqual([{ questions: starters('de'), gymTargetPerWeek: null, runningTargetPerWeek: null }]);
  });

  it('Mind and Gym: seven steps; Gym on its default target, Laufen on none unless chosen', async () => {
    const finished: OnboardingSelection[] = [];
    await open('de', (selection) => finished.push(selection));
    await toAreas();
    await click(area('Gym'));
    expect(document.querySelectorAll('.onboarding__dot')).toHaveLength(7);
    await next();
    await next();
    expect(step()).toBe('sport');
    expect(target('Gym-Sessions pro Woche', GYM.DEFAULT_TARGET_PER_WEEK)?.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('[aria-label="Läufe pro Woche"] [aria-pressed="true"]')).toHaveLength(0);
    await next();
    await click(buttonNamed('Starten'));
    expect(finished).toEqual([{ questions: starters('de'), gymTargetPerWeek: 3, runningTargetPerWeek: null }]);
  });

  it('Gym alone, two runs a week and five sessions: no question step, and both targets handed on', async () => {
    const finished: OnboardingSelection[] = [];
    await open('de', (selection) => finished.push(selection));
    await toAreas();
    await click(area('Gym'));
    await click(area('Mind'));
    expect(document.querySelectorAll('.onboarding__dot')).toHaveLength(6);
    await next();
    expect(step()).toBe('sport');
    await click(target('Gym-Sessions pro Woche', 5));
    await click(target('Läufe pro Woche', 2));
    await next();
    // The summary has the Gym tile and no Mind tile.
    expect([...document.querySelectorAll('.summary__list .world-tile__name')].map((n) => n.textContent)).toEqual(['Gym']);
    expect(text()).toContain('5 Gym-Sessions pro Woche');
    expect(text()).toContain('2 Läufe pro Woche');
    await click(buttonNamed('Starten'));
    expect(finished).toEqual([{ questions: [], gymTargetPerWeek: 5, runningTargetPerWeek: 2 }]);
  });

  it('no area: «Weiter» waits and says why', async () => {
    await open();
    await toAreas();
    await click(area('Mind'));
    expect(primary().disabled).toBe(true);
    expect(note()).toBe(translate('de', 'onboarding.domains.needOne'));
    await click(area('Gym'));
    expect(primary().disabled).toBe(false);
  });

  it('the three starter questions are one per category, and any of them can be taken off', async () => {
    await open();
    await toAreas();
    await next();
    expect(step()).toBe('questions');
    const library = suggestedQuestions('de');
    const chosen = library.filter((suggestion) => (STARTER_QUESTIONS as readonly string[]).includes(suggestion.id));
    expect(new Set(chosen.map((suggestion) => suggestion.category))).toEqual(new Set(['alltag', 'gesundheit', 'mental']));
    expect(chosenQuestions()).toEqual(chosen.map((suggestion) => suggestion.text));
    expect(note()).toBe('3 ausgewählt');
    await click(question('Wie gut hast du geschlafen'));
    expect(chosenQuestions()).toHaveLength(2);
    expect(note()).toBe('2 ausgewählt');
  });

  it('Mind without a question: «Weiter» waits with the owner’s words, and comes back with one', async () => {
    const finished: OnboardingSelection[] = [];
    await open('de', (selection) => finished.push(selection));
    await toAreas();
    await next();
    for (const start of ['Wie gut hat dein Alltag', 'Wie gut hast du geschlafen', 'Wie war deine Stimmung']) {
      await click(question(start));
    }
    expect(chosenQuestions()).toEqual([]);
    expect(primary().disabled).toBe(true);
    expect(note()).toBe('Wähl mindestens eine Frage oder nimm Mind ab.');
    // One question is enough.
    await click(question('Hast du heute aufgeräumt'));
    expect(primary().disabled).toBe(false);
    expect(note()).toBe('1 ausgewählt');
    await next();
    // One question is a figure with its unit, like two or more.
    const tile = document.querySelector('.summary__list .world-tile__figure');
    expect(tile?.textContent).toBe('1 Frage täglich');
    expect(tile?.querySelector('.figure__unit')?.textContent).toBe(' Frage täglich');
    await click(buttonNamed('Starten'));
    expect(finished[0]!.questions.map((q) => q.text)).toEqual(['Hast du heute aufgeräumt?']);
  });

  it('… or with Mind taken off: back to the areas, and on to the summary without questions', async () => {
    const finished: OnboardingSelection[] = [];
    await open('de', (selection) => finished.push(selection));
    await toAreas();
    await click(area('Gym'));
    await next();
    for (const start of ['Wie gut hat dein Alltag', 'Wie gut hast du geschlafen', 'Wie war deine Stimmung']) {
      await click(question(start));
    }
    expect(primary().disabled).toBe(true);
    await click(buttonNamed('Zurück') ?? document.querySelector('.onboarding__back'));
    expect(step()).toBe('domains');
    await click(area('Mind'));
    await next();
    expect(step()).toBe('sport');
    await next();
    await click(buttonNamed('Starten'));
    expect(finished).toEqual([{ questions: [], gymTargetPerWeek: 3, runningTargetPerWeek: null }]);
  });

  it('a question of the user’s own counts as a chosen one, and is handed on after the library’s', async () => {
    const finished: OnboardingSelection[] = [];
    await open('de', (selection) => finished.push(selection));
    await toAreas();
    await next();
    await click(buttons().find((button) => button.textContent?.includes('Eigene Frage')));
    const input = document.querySelector<HTMLInputElement>('#question-text')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Habe ich heute gelesen?');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(buttonNamed('Hinzufügen'));
    expect(note()).toBe('4 ausgewählt');
    // Without the three starters, the own question alone carries the step.
    for (const start of ['Wie gut hat dein Alltag', 'Wie gut hast du geschlafen', 'Wie war deine Stimmung']) {
      await click(question(start));
    }
    expect(primary().disabled).toBe(false);
    // A starter chosen again after it: the library's questions come first.
    await click(question('Wie war deine Stimmung'));
    await next();
    await click(buttonNamed('Starten'));
    expect(finished[0]!.questions.map((q) => q.text)).toEqual(['Wie war deine Stimmung heute?', 'Habe ich heute gelesen?']);
  });

  it('back walks step by step and keeps every choice', async () => {
    const finished: OnboardingSelection[] = [];
    await open('de', (selection) => finished.push(selection));
    await toAreas();
    await click(area('Gym'));
    await next();
    await click(question('Hast du heute selbst gekocht'));
    await next();
    await click(target('Läufe pro Woche', 4));
    await next();
    expect(step()).toBe('summary');
    for (const expected of ['sport', 'questions', 'domains', 'rank', 'worlds', 'momentum']) {
      await click(document.querySelector('.onboarding__back'));
      expect(step()).toBe(expected);
    }
    // The first step has no way back, and the brand stands there instead.
    expect(document.querySelector('.onboarding__back')).toBeNull();
    expect(document.querySelector('.onboarding__brand')?.textContent).toBe('Momentum');
    await toAreas();
    expect(area('Gym')?.getAttribute('aria-pressed')).toBe('true');
    await next();
    expect(chosenQuestions()).toHaveLength(4);
    await next();
    expect(target('Läufe pro Woche', 4)?.getAttribute('aria-pressed')).toBe('true');
    await next();
    await click(buttonNamed('Starten'));
    expect(finished[0]).toMatchObject({ gymTargetPerWeek: 3, runningTargetPerWeek: 4 });
    expect(finished[0]!.questions).toHaveLength(4);
  });

  it('names its step for a screen reader, as a picture of the marks', async () => {
    await open();
    const steps = () => document.querySelector('.onboarding__steps');
    expect(steps()?.getAttribute('role')).toBe('img');
    expect(steps()?.getAttribute('aria-label')).toBe('Schritt 1 von 6');
    await toAreas();
    await click(area('Gym'));
    expect(steps()?.getAttribute('aria-label')).toBe('Schritt 4 von 7');
  });

  it('says so when the setup could not be saved, above the button that tries again', async () => {
    await open('de', () => undefined, true);
    await toAreas();
    await next();
    await next();
    expect(step()).toBe('summary');
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(translate('de', 'error.action'));
  });

  it('walks in English, the owner’s hint included', async () => {
    const finished: OnboardingSelection[] = [];
    await open('en', (selection) => finished.push(selection));
    await toAreas('en');
    await next('en');
    for (const start of ['How well did your day run', 'How well did you sleep', 'How was your mood']) {
      await click(question(start));
    }
    expect(note()).toBe('Choose at least one question, or switch Mind off.');
    await click(question('How well did you sleep'));
    await next('en');
    expect(text()).toContain('1 question daily');
    await click(buttonNamed('Start'));
    expect(finished[0]!.questions.map((q) => q.text)).toEqual(['How well did you sleep?']);
  });
});

describe('what each step shows (contract §16)', () => {
  it('the hero is one picture of example values: a name that says so, and nothing to operate', async () => {
    await open();
    const hero = document.querySelector('.onboarding-hero')!;
    expect(hero.getAttribute('role')).toBe('img');
    expect(hero.getAttribute('aria-label')).toBe(translate('de', 'onboarding.hero.label'));
    expect(hero.getAttribute('aria-label')).toMatch(/Beispielwerten/);
    expect(hero.querySelectorAll(OPERABLE)).toHaveLength(0);
    expect(hero.textContent).toContain('+9 %');
  });

  it('no step after the first shows an example value', async () => {
    await open();
    const examples = /\+9|8 von 10|2 von 3|Beispiel/;
    await click(buttonNamed('Los geht’s'));
    const visited: string[] = [];
    for (let guard = 0; guard < 8 && step() !== 'summary'; guard += 1) {
      visited.push(step()!);
      expect(text(), step()!).not.toMatch(examples);
      if (step() === 'domains') await click(area('Gym'));
      await next();
    }
    expect(text()).not.toMatch(examples);
    expect(visited).toEqual(['worlds', 'rank', 'domains', 'questions', 'sport']);
  });

  it('the second slide names Laufen without a number until a target is chosen', async () => {
    await open();
    await click(buttonNamed('Los geht’s'));
    expect(text()).toContain('0 von 3 Sessions');
    expect(text()).toContain('Ein eigenes Wochenziel, wenn du willst.');
    expect(text()).not.toMatch(/von \d+ Läufen/);
    // Choose two runs, and walk back to the slide.
    await next();
    await next();
    await click(area('Gym'));
    await next();
    await next();
    await click(target('Läufe pro Woche', 2));
    for (let index = 0; index < 4; index += 1) await click(document.querySelector('.onboarding__back'));
    expect(step()).toBe('worlds');
    expect(text()).toContain('0 von 2 Läufen');
  });

  it('the rank slide is the start, the way to the next rank, and the ranks beyond — no milestones', async () => {
    await open();
    await click(buttonNamed('Los geht’s'));
    await next();
    expect(step()).toBe('rank');
    const stage = document.querySelector('.rank-stage')!;
    expect(stage.querySelector('.rank-stage__name')?.textContent).toBe(RANKS[0].name);
    expect(stage.querySelector('.rank-stage__nextName')?.textContent).toBe(RANKS[1].name);
    expect(stage.querySelector('.rank-stage__path')?.getAttribute('aria-label')).toBe(
      `Der Weg zum nächsten Rang: von 0 bis ${RANKS[1].min}.`,
    );
    expect(text()).toContain(`${RANKS.length - 2} weitere Ränge bis ${RANKS[RANKS.length - 1]!.name}`);
    expect(text()).not.toMatch(/Meilenstein/);
  });

  it('every step has at most one dark surface, and it is Gym or the rank', async () => {
    await open();
    const counts: Record<string, number> = {};
    const record = () => {
      const dark = darkSurfaces();
      counts[step()!] = dark.length;
      for (const element of dark) {
        expect(element.getAttribute('data-world') === 'gym' || element.classList.contains('rank-stage')).toBe(true);
      }
    };
    record();
    await click(buttonNamed('Los geht’s'));
    record();
    await next();
    record();
    await next();
    await click(area('Gym'));
    record();
    await next();
    record();
    await next();
    record();
    await next();
    record();
    expect(counts).toEqual({ momentum: 1, worlds: 1, rank: 1, domains: 1, questions: 0, sport: 1, summary: 1 });
  });

  it('a chosen area carries a filled mark in the accent, and its name says the state too', async () => {
    await open();
    await toAreas();
    const mark = (tile: HTMLElement | undefined) => tile?.querySelector('.selection-mark');
    expect(mark(area('Mind'))?.classList.contains('selection-mark--on')).toBe(true);
    expect(mark(area('Gym'))?.classList.contains('selection-mark--on')).toBe(false);
    expect(area('Mind')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('marks the document while it stands, for the flat ground, and leaves nothing behind', async () => {
    await open();
    expect(document.documentElement.hasAttribute('data-onboarding')).toBe(true);
    await mounted!.unmount();
    mounted = null;
    expect(document.documentElement.hasAttribute('data-onboarding')).toBe(false);
  });
});
