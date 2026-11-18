// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { exerciseDays, gymPerformance, gymPerformanceOverSpan, latestComparisons } from '../../core/gym/performance';
import { de } from '../../i18n/de';
import { I18nProvider } from '../../i18n/I18nProvider';
import type { GymHistory } from '../../storage/services/gymService';
import { mount, type Mounted } from '../../test/dom';
import { MuscleEntryCard } from './MuscleEntryCard';

/**
 * What the hub's Muskelgruppen card says never changes under its glass
 * (the tidy-up of WP3, D199).
 *
 * The owner's finding on the iPhone after STOP 9: on a first load, now and
 * then, «Noch nicht trainiert» stood cut through the middle and the hint
 * under it was missing; the next load was right. The card is there before
 * its history (D168), and its two placeholder lines became words inside a
 * living sheet of glass — the one card of the hub that changed that way.
 * It is now put there whole: when its words change, the button is a new
 * element, which a browser paints from nothing.
 *
 * That it is a new element is held here; that the picture of it is the
 * picture of a fresh paint is `muscle-card.mjs`, in Chromium and in WebKit.
 */

const emptyHistory = (): GymHistory => {
  const days = exerciseDays([]);
  return {
    days,
    comparisons: latestComparisons(days),
    recent: gymPerformance(days),
    overall: gymPerformanceOverSpan(days),
    names: new Map(),
    awaitingBodyweight: [],
    warmUpOnly: [],
    metric: null,
  };
};

const card = (history: GymHistory | null, failed = false) => (
  <I18nProvider language="de" setLanguage={() => undefined}>
    <MuscleEntryCard history={history} rangeDays={30} failed={failed} onOpen={() => undefined} />
  </I18nProvider>
);

let mounted: Mounted | null = null;
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

const button = () => document.querySelector<HTMLButtonElement>('.gym-hub__muscles')!;
const lines = () => [...document.querySelectorAll('.gym-hub__musclesBody > span')].map((span) => span.textContent);

describe('the Muskelgruppen card when its history arrives', () => {
  it('is a new element with the words, not the loading one with its text changed', async () => {
    mounted = await mount(card(null));
    const loading = button();
    expect(lines()).toEqual(['Muskelgruppen', ' ', ' ']);

    await mounted.rerender(card(emptyHistory()));
    const loaded = button();
    expect(lines()).toEqual(['Muskelgruppen', de['gymHub.muscles.none'], de['gymHub.muscles.noneHint']]);
    expect(loaded).not.toBe(loading);
    expect(loading.isConnected).toBe(false);
    // One card, as before, with the same name and the same picture.
    expect(document.querySelectorAll('.gym-hub__muscles')).toHaveLength(1);
    expect(loaded.getAttribute('aria-label')).toBe(de['gymHub.muscles.open']);
    expect(loaded.querySelector('img.gym-hub__previewBody')).not.toBeNull();
  });

  it('is a new element when the load fails, too', async () => {
    mounted = await mount(card(null));
    const loading = button();
    await mounted.rerender(card(null, true));
    expect(button()).not.toBe(loading);
    expect(lines()[1]).toBe(de['error.muscles.title']);
  });

  it('stays the same element while what it says stays the same', async () => {
    const history = emptyHistory();
    mounted = await mount(card(history));
    const first = button();
    // The same facts in a new object, as a reload hands them over.
    await mounted.rerender(card(emptyHistory()));
    expect(button()).toBe(first);
  });

  it('takes a keyboard\'s focus along, and gives none to a card that had none', async () => {
    mounted = await mount(card(null));
    button().focus();
    expect(document.activeElement).toBe(button());
    await mounted.rerender(card(emptyHistory()));
    expect(document.activeElement).toBe(button());
    await mounted.unmount();

    mounted = await mount(card(null));
    expect(document.activeElement).not.toBe(button());
    await mounted.rerender(card(emptyHistory()));
    expect(document.activeElement).not.toBe(button());
  });
});
