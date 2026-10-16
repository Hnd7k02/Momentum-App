// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { TERMINALS, type DomainTerminal } from '../../app/route';
import { translate, type Language } from '../../i18n';
import { I18nProvider } from '../../i18n/I18nProvider';
import { mount, type Mounted } from '../../test/dom';
import { DomainSwitch } from './DomainSwitch';

/**
 * The domain terminal's area switch: Mind | Gym (WP3 Stage 4 — D143).
 *
 * Two areas, one name each, the same in both languages: the wellbeing
 * area's id stays `mental` (P3) and only its name changed.
 */

let mounted: Mounted | null = null;

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

async function render(language: Language, active: DomainTerminal, onSelect: (domain: DomainTerminal) => void = () => undefined) {
  mounted = await mount(
    <I18nProvider language={language} setLanguage={() => undefined}>
      <DomainSwitch domains={TERMINALS} active={active} onSelect={onSelect} />
    </I18nProvider>,
  );
}

const options = () => [...document.querySelectorAll<HTMLButtonElement>('[role="radio"]')];

describe('the area switch', () => {
  it('switches between exactly two areas', () => {
    expect(TERMINALS).toEqual(['mental', 'gym']);
  });

  it.each(['de', 'en'] as const)('reads Mind | Gym (%s)', async (language) => {
    await render(language, 'mental');
    expect(document.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe(
      translate(language, 'areas.terminalSwitch'),
    );
    expect(options().map((option) => option.textContent)).toEqual(['Mind', 'Gym']);
    expect(options().map((option) => option.getAttribute('aria-checked'))).toEqual(['true', 'false']);
  });

  it('selects by tap and by arrow key', async () => {
    const selected: DomainTerminal[] = [];
    await render('de', 'mental', (domain) => selected.push(domain));
    await act(async () => options()[1]!.click());
    await act(async () => {
      options()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(selected).toEqual(['gym', 'gym']);
  });
});
