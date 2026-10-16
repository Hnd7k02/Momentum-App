// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { translate, type Language } from '../../i18n';
import { I18nProvider } from '../../i18n/I18nProvider';
import type { OnboardingSelection } from '../../storage/services/configurationService';
import { mount, type Mounted } from '../../test/dom';
import { OnboardingFlow } from './OnboardingFlow';

/**
 * Onboarding without Food (WP3 Stage 4 — D139, D143).
 *
 * Two worlds, Mind and Gym, with Laufen inside Gym: the picker offers those
 * two and nothing else, in both languages, and what it hands to storage has
 * no field that could switch Food on.
 */

let mounted: Mounted | null = null;

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

async function open(language: Language, onFinish: (selection: OnboardingSelection) => void = () => undefined) {
  mounted = await mount(
    <I18nProvider language={language} setLanguage={() => undefined}>
      <OnboardingFlow onFinish={onFinish} />
    </I18nProvider>,
  );
}

const buttonNamed = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === text);

async function click(element: HTMLElement | undefined): Promise<void> {
  expect(element).toBeDefined();
  await act(async () => element!.click());
}

/** Through the three concept screens, collecting what each one says. */
async function toPicker(language: Language): Promise<string[]> {
  const said: string[] = [];
  await click(buttonNamed(translate(language, 'onboarding.welcome.start')));
  said.push(document.querySelector('.onboarding')!.textContent ?? '');
  await click(buttonNamed(translate(language, 'common.continue')));
  await click(buttonNamed(translate(language, 'common.continue')));
  return said;
}

const choices = () =>
  [...document.querySelectorAll('.question-pick')].map((choice) => [
    choice.querySelector('.question-pick__text')?.textContent,
    choice.querySelector('.onboarding__hint')?.textContent,
  ]);

describe('the onboarding picker', () => {
  it.each(['de', 'en'] as const)('offers Mind and Gym, Laufen included, and no Food (%s)', async (language) => {
    await open(language);
    const [worlds] = await toPicker(language);
    expect(worlds).toContain(translate(language, 'onboarding.concept.worlds.title'));
    expect(worlds).toContain(translate(language, 'onboarding.concept.worlds.body'));

    expect(document.querySelector('.onboarding__title')?.textContent).toBe(translate(language, 'onboarding.domains.title'));
    expect(choices()).toEqual([
      ['Mind', translate(language, 'domain.mental.description')],
      ['Gym', translate(language, 'onboarding.domains.gym')],
    ]);
    expect(document.body.textContent).not.toMatch(/ernährung|food|sport\b/i);
  });

  it('hands storage a selection with no field for Food, and Laufen through Gym', async () => {
    const finished: OnboardingSelection[] = [];
    await open('de', (selection) => finished.push(selection));
    await toPicker('de');
    // Gym on, Mind off: the Gym step asks for both targets.
    await click([...document.querySelectorAll<HTMLButtonElement>('.question-pick')][1]);
    await click([...document.querySelectorAll<HTMLButtonElement>('.question-pick')][0]);
    await click(buttonNamed('Weiter'));
    expect(document.body.textContent).toContain(translate('de', 'onboarding.sport.gym'));
    expect(document.body.textContent).toContain(translate('de', 'onboarding.sport.running'));
    await click(buttonNamed('Weiter'));
    await click(buttonNamed(translate('de', 'onboarding.summary.start')));

    expect(finished).toEqual([{ questions: [], gymTargetPerWeek: 3, runningTargetPerWeek: null }]);
    expect(Object.keys(finished[0]!).sort()).toEqual(['gymTargetPerWeek', 'questions', 'runningTargetPerWeek']);
  });
});
