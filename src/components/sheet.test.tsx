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


/**
 * A sheet with two heights (block 7C, contract §9): it has a grabber that
 * is a control, shows what it showed while it leaves, gives focus back to
 * where its host says when nothing was in focus, and keeps out of the way
 * of what lies on top of it.
 */
let setSheet: (open: boolean) => void = () => undefined;
let setOnTop: (onTop: boolean) => void = () => undefined;
let detentsSeen: string[] = [];

function DetentHost() {
  const [open, setOpenState] = useState(false);
  const [onTop, setOnTopState] = useState(false);
  setSheet = setOpenState;
  setOnTop = setOnTopState;
  return (
    <I18nProvider language="de" setLanguage={() => undefined}>
      <button type="button" id="group-row">Brust</button>
      <Sheet
        open={open}
        title="Brust"
        onClose={() => setOpenState(false)}
        detents
        overBody
        suspended={onTop}
        returnFocus={() => document.getElementById('group-row')}
        onDetentChange={(detent) => detentsSeen.push(detent)}
      >
        <button type="button" id="exercise-row">Bankdrücken</button>
      </Sheet>
    </I18nProvider>
  );
}

const sheet = () => document.querySelector<HTMLElement>('.sheet');
const scrimOf = () => document.querySelector<HTMLElement>('.sheet-scrim');
const grabber = () => document.querySelector<HTMLButtonElement>('.sheet__grabber');
const wait = (ms: number) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });

async function openDetents() {
  detentsSeen = [];
  mounted = await mount(<DetentHost />);
  await act(async () => setSheet(true));
  await wait(5);
}

describe('a sheet with two heights', () => {
  it('opens on the lower one, solid and over a clear scrim', async () => {
    await openDetents();
    expect(sheet()!.dataset.detent).toBe('lower');
    expect(sheet()!.className).toContain('sheet--detents');
    expect(sheet()!.className).toContain('sheet--solid');
    expect(scrimOf()!.className).toContain('sheet-scrim--clear');
    expect(detentsSeen).toEqual(['lower']);
  });

  it('has a grabber that is a control with a name, and changes the height', async () => {
    await openDetents();
    expect(grabber()!.getAttribute('aria-label')).toBe('Ansicht vergrössern');
    await act(async () => grabber()!.click());
    expect(sheet()!.dataset.detent).toBe('upper');
    expect(grabber()!.getAttribute('aria-label')).toBe('Ansicht verkleinern');
    expect(detentsSeen).toEqual(['lower', 'upper']);
    await act(async () => grabber()!.click());
    expect(sheet()!.dataset.detent).toBe('lower');
  });

  it('opens on the lower one again, whatever height it was closed at', async () => {
    await openDetents();
    await act(async () => grabber()!.click());
    await act(async () => setSheet(false));
    await wait(5);
    await act(async () => setSheet(true));
    await wait(5);
    expect(sheet()!.dataset.detent).toBe('lower');
  });

  it('takes focus when it stands and gives it to where its host says when nothing was in focus', async () => {
    await openDetents();
    expect(active()).toBe(sheet());
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(active()?.id).toBe('group-row');
  });

  it('is gone once its way out has ended, and takes no tap on that way', async () => {
    await openDetents();
    await act(async () => setSheet(false));
    await wait(5);
    expect(sheet()).toBeNull();
  });

  it('keeps out of the way of what lies on top of it, and stays what it was', async () => {
    await openDetents();
    await act(async () => grabber()!.click());
    document.getElementById('exercise-row')!.focus();
    await act(async () => setOnTop(true));
    expect(scrimOf()!.hasAttribute('data-suspended')).toBe(true);
    expect(scrimOf()!.getAttribute('aria-hidden')).toBe('true');
    expect(scrimOf()!.hasAttribute('inert')).toBe(true);
    // Escape is not the sheet's while something lies on it.
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(sheet()).not.toBeNull();
    // Whatever lay on top puts focus back on the row it was opened from.
    document.getElementById('exercise-row')!.focus();
    await act(async () => setOnTop(false));
    expect(scrimOf()!.hasAttribute('data-suspended')).toBe(false);
    expect(sheet()!.dataset.detent).toBe('upper');
    expect(active()?.id).toBe('exercise-row');
    // And closing it now still leads back to the group's row.
    await act(async () => setSheet(false));
    expect(active()?.id).toBe('group-row');
  });
});

describe('every other sheet', () => {
  it('has no grabber: one stands only where one can drag', async () => {
    await openFrom(false);
    expect(document.querySelector('.sheet')).not.toBeNull();
    expect(document.querySelector('.sheet__grabber')).toBeNull();
    expect(document.querySelector('.sheet')!.className).toBe('sheet');
    expect(document.querySelector('.sheet-scrim')!.className).toBe('sheet-scrim');
  });
});
