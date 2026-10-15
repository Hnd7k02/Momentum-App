// @vitest-environment happy-dom
import { act, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayView } from '../../storage/services/checkInService';
import { mount, settle, type Mounted } from '../../test/dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { ToastProvider } from '../../components/Toast';

/**
 * Heute across local midnight (WP3, B3 — review of Stage 1).
 *
 * The day on show turns at midnight, and the screen withholds every control
 * until the new day has loaded. What floats over the day is not the day's:
 * an open workout belongs to its session, the run sheet edits a run by id.
 * Neither may be unmounted by the day turning, and a new day that fails to
 * load is a failure with a retry — never an endless wait.
 */

const failing = new Set<string>();
const loads: string[] = [];

function dayFor(date: string): DayView {
  return {
    date,
    editState: 'open',
    editable: true,
    mental: null,
    training: [
      {
        domain: 'running',
        weekKey: '2026-W42',
        progress: { completed: 1, target: 2, met: false, exceeded: false, remaining: 1 },
        sessions: [
          {
            id: 'run-1',
            domain: 'running',
            date: '2026-10-14',
            performedAt: '2026-10-14T20:00:00Z',
            note: null,
            durationMinutes: null,
            distanceMetres: null,
            legacyCarryOver: false,
          },
        ],
        sessionsToday: [],
      },
    ],
    food: {
      adherence: null,
      note: null,
      focus: null,
      entries: [],
      totals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    },
    legacySportChoicePending: false,
    paused: false,
    empty: false,
  } as unknown as DayView;
}

vi.mock('../../storage/services/checkInService', async (original) => ({
  ...(await original<typeof import('../../storage/services/checkInService')>()),
  loadDay: async (date: string) => {
    loads.push(date);
    if (failing.has(date)) throw new Error('Connection to Indexed Database server lost');
    return dayFor(date);
  },
}));

vi.mock('./BossSummary', () => ({ BossSummary: () => null }));

// The workout itself is GymSessionScreen's business; here it only has to
// say whether it stayed mounted.
let workoutOpen = false;
let workoutMounts = 0;
function Workout() {
  useEffect(() => {
    workoutMounts += 1;
  }, []);
  return <div className="gym-session" data-testid="workout" />;
}
vi.mock('../gym/useTrainingLauncher', () => ({
  useTrainingLauncher: () => ({
    start: () => undefined,
    open: workoutOpen,
    overlay: workoutOpen ? <Workout /> : null,
  }),
}));

const { TodayScreen } = await import('./TodayScreen');

let mounted: Mounted | null = null;

const tree = () => (
  <I18nProvider language="de" setLanguage={() => undefined}>
    <ToastProvider>
      <TodayScreen onGoToAreas={() => undefined} />
    </ToastProvider>
  </I18nProvider>
);

beforeEach(() => {
  failing.clear();
  loads.length = 0;
  workoutOpen = false;
  workoutMounts = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-10-14T23:58:00'));
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
});

async function pastMidnight() {
  await act(async () => {
    vi.advanceTimersByTime(3 * 60 * 1000);
  });
  await settle();
}

const distance = () => document.getElementById('session-distance') as HTMLInputElement | null;

async function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('Heute across midnight', () => {
  it('keeps the run sheet open, with what was typed into it', async () => {
    mounted = await mount(tree());
    await settle();
    const row = [...document.querySelectorAll<HTMLButtonElement>('button.row')][0];
    expect(row).toBeTruthy();
    await act(async () => row!.click());
    await type(distance()!, '5.2');

    await pastMidnight();
    expect(loads).toEqual(['2026-10-14', '2026-10-15']);
    expect(distance()?.value).toBe('5.2');
    expect(document.querySelector('.today__date')?.textContent).toContain('15.');
  });

  it('keeps the food entry sheet open, with what was typed into it', async () => {
    mounted = await mount(tree());
    await settle();
    // Opened from the keyboard: the opener has focus when the sheet opens.
    await act(async () => {
      const opener = document.querySelector<HTMLButtonElement>('button.food__add')!;
      opener.focus();
      opener.click();
    });
    const name = () => document.querySelector<HTMLInputElement>('.sheet input');
    await type(name()!, 'Pasta');

    await pastMidnight();
    expect(document.querySelector('.today__date')?.textContent).toContain('15.');
    expect(name()?.value).toBe('Pasta');

    // The opener was replaced while the new day loaded; focus finds the new one.
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.querySelector('.sheet')).toBeNull();
    expect(document.activeElement?.className).toContain('food__add');
  });

  it('returns focus to the run row when the run sheet closes after midnight', async () => {
    mounted = await mount(tree());
    await settle();
    await act(async () => {
      const opener = document.querySelector<HTMLButtonElement>('button.row')!;
      opener.focus();
      opener.click();
    });
    await pastMidnight();
    expect(distance()).not.toBeNull();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.activeElement?.getAttribute('data-focus-key')).toBe('session-run-1');
  });

  it('never unmounts an open workout when the day turns', async () => {
    workoutOpen = true;
    mounted = await mount(tree());
    await settle();
    expect(workoutMounts).toBe(1);

    await pastMidnight();
    await mounted.rerender(tree());
    await settle();
    expect(document.querySelector('[data-testid="workout"]')).not.toBeNull();
    expect(workoutMounts).toBe(1);
  });

  it('turns a new day that fails to load into a failure with a retry, not a wait', async () => {
    mounted = await mount(tree());
    await settle();
    failing.add('2026-10-15');

    await pastMidnight();
    const scroll = document.querySelector('.today__scroll');
    expect(scroll?.getAttribute('aria-busy')).toBe('false');
    const retry = [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      /erneut/i.test(button.textContent ?? ''),
    );
    expect(retry).toBeTruthy();

    failing.clear();
    await act(async () => retry!.click());
    await settle();
    expect(document.querySelector('.today__date')?.textContent).toContain('15.');
  });
});
