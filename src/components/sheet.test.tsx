// @vitest-environment happy-dom
import { act, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { mount, type Mounted } from '../test/dom';
import { SHEET_INITIAL_FOCUS, Sheet } from './index';

/**
 * The Sheet's focus contract (WP3, B1).
 *
 * Focus moves in when the sheet opens and back out when it closes, and at
 * no other time. Before the fix the effect also depended on `onClose`, which
 * every caller passes inline, so each keystroke that re-rendered the caller
 * moved focus to the close button.
 */

let mounted: Mounted | null = null;
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  document.body.innerHTML = '';
});

let setOpen: (open: boolean) => void = () => undefined;
let setText: (text: string) => void = () => undefined;
let closes: string[] = [];

function Host({ marked }: { marked: boolean }) {
  const [open, setOpenState] = useState(false);
  const [text, setTextState] = useState('');
  setOpen = setOpenState;
  setText = setTextState;
  return (
    <I18nProvider language="de" setLanguage={() => undefined}>
      <button type="button" id="launcher-button">open</button>
      {/* A new inline onClose on every render, as every caller writes it. */}
      <Sheet open={open} title="Übung" onClose={() => closes.push(text)}>
        <input
          {...(marked ? SHEET_INITIAL_FOCUS : {})}
          id="sheet-field"
          value={text}
          onChange={(event) => setTextState(event.target.value)}
        />
      </Sheet>
    </I18nProvider>
  );
}

const active = () => document.activeElement as HTMLElement | null;

async function openFrom(marked: boolean) {
  closes = [];
  mounted = await mount(<Host marked={marked} />);
  document.getElementById('launcher-button')!.focus();
  await act(async () => setOpen(true));
}

describe('Sheet focus', () => {
  it('opens on the field it marks', async () => {
    await openFrom(true);
    expect(active()?.id).toBe('sheet-field');
  });

  it('opens on the dialog when no field is marked — never on the close button', async () => {
    await openFrom(false);
    expect(active()?.getAttribute('role')).toBe('dialog');
    expect(active()?.getAttribute('aria-label')).toBe('Übung');
  });

  it('keeps focus in the field through every keystroke', async () => {
    await openFrom(true);
    for (const value of ['B', 'Ba', 'Ban', 'Bank']) {
      await act(async () => setText(value));
      expect(active()?.id, value).toBe('sheet-field');
      expect((document.getElementById('sheet-field') as HTMLInputElement).value).toBe(value);
    }
  });

  it('closes on Escape through the latest onClose', async () => {
    await openFrom(true);
    await act(async () => setText('Bank'));
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(closes).toEqual(['Bank']);
  });

  it('returns focus to where it came from when it closes', async () => {
    await openFrom(true);
    await act(async () => setText('Ba'));
    await act(async () => setOpen(false));
    expect(active()?.id).toBe('launcher-button');
  });
});
