// @vitest-environment happy-dom
import { act, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { mount, type Mounted } from '../test/dom';
import { Sheet } from './index';
import { ToastOutlet, ToastProvider, useToast, useToastLift, type ToastSpec } from './Toast';

/**
 * The toast's placement contract (WP3, B9 — review of Stage 1).
 *
 * A screen lifts it through context, because the outlet is not inside any
 * screen and a custom property set on one never reaches it; and a sheet
 * opening dismisses it, so an undo never floats beside a dialog that edits
 * the record it would undo.
 */

let mounted: Mounted | null = null;
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  document.body.innerHTML = '';
});

let show: (spec: ToastSpec) => void = () => undefined;
let setLift: (lift: string | null) => void = () => undefined;
let setSheet: (open: boolean) => void = () => undefined;

function Screen() {
  show = useToast();
  const [lift, setLiftState] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  setLift = setLiftState;
  setSheet = setOpen;
  useToastLift(lift);
  return (
    <Sheet open={open} title="Lauf" onClose={() => setOpen(false)}>
      <input id="field" />
    </Sheet>
  );
}

async function render() {
  mounted = await mount(
    <I18nProvider language="de" setLanguage={() => undefined}>
      <ToastProvider>
        <Screen />
        <ToastOutlet />
      </ToastProvider>
    </I18nProvider>,
  );
}

const region = () => document.querySelector<HTMLElement>('.toast-region')!;
const pill = () => document.querySelector('.toast');

describe('the toast', () => {
  it('is always in the document as a polite live region', async () => {
    await render();
    expect(region().getAttribute('role')).toBe('status');
    expect(region().getAttribute('aria-live')).toBe('polite');
  });

  it('is lifted by the screen on show, and drops back when the lift is withdrawn', async () => {
    await render();
    expect(region().style.getPropertyValue('--toast-lift')).toBe('');
    await act(async () => setLift('72px'));
    expect(region().style.getPropertyValue('--toast-lift')).toBe('72px');
    await act(async () => setLift(null));
    expect(region().style.getPropertyValue('--toast-lift')).toBe('');
  });

  it('keeps the screen on top on top when the one underneath changes its lift', async () => {
    let setLower: (lift: string) => void = () => undefined;
    let setUpperShown: (shown: boolean) => void = () => undefined;
    function Lower() {
      const [lift, set] = useState('72px');
      setLower = set;
      useToastLift(lift);
      return null;
    }
    function Upper() {
      useToastLift('120px');
      return null;
    }
    function Stack() {
      const [upper, setUpper] = useState(false);
      setUpperShown = setUpper;
      return (
        <>
          <Lower />
          {upper ? <Upper /> : null}
        </>
      );
    }
    mounted = await mount(
      <ToastProvider>
        <Stack />
        <ToastOutlet />
      </ToastProvider>,
    );
    expect(region().style.getPropertyValue('--toast-lift')).toBe('72px');
    await act(async () => setUpperShown(true));
    expect(region().style.getPropertyValue('--toast-lift')).toBe('120px');
    await act(async () => setLower('80px'));
    expect(region().style.getPropertyValue('--toast-lift')).toBe('120px');
    await act(async () => setUpperShown(false));
    expect(region().style.getPropertyValue('--toast-lift')).toBe('80px');
  });

  it('runs its action once', async () => {
    await render();
    let runs = 0;
    await act(async () => show({ message: 'Lauf eingetragen.', action: { label: 'Rückgängig', run: () => (runs += 1) } }));
    const button = document.querySelector<HTMLButtonElement>('.toast__action')!;
    await act(async () => {
      button.click();
      button.click();
    });
    expect(runs).toBe(1);
    expect(pill()).toBeNull();
  });

  it('is dismissed when a sheet opens', async () => {
    await render();
    await act(async () => show({ message: 'Lauf eingetragen.', action: { label: 'Rückgängig', run: () => undefined } }));
    expect(pill()?.textContent).toContain('Lauf eingetragen.');
    await act(async () => setSheet(true));
    expect(document.querySelector('.sheet')).not.toBeNull();
    expect(pill()).toBeNull();
  });
});
