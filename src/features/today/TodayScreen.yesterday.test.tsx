// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { refreshToday } from '../../app/useToday';
import { WeightUnitProvider } from '../../app/useWeights';
import { ToastOutlet, ToastProvider } from '../../components/Toast';
import { I18nProvider } from '../../i18n/I18nProvider';
import { closeDatabase, deleteDatabase } from '../../storage/db';
import { ensureSessionWindowEra } from '../../storage/configService';
import { answersRepository, configSnapshotsRepository, runsRepository } from '../../storage/repositories';
import { applyOnboarding, enableDomain } from '../../storage/services/configurationService';
import { createPause } from '../../storage/services/pauseService';
import { ensureExerciseCatalogue } from '../../storage/services/gymService';
import { mount, type Mounted } from '../../test/dom';
import { TodayScreen } from './TodayScreen';

/**
 * Heute | Gestern against real storage (WP3, P8 — D138).
 *
 * Anything can be written for today and yesterday and nothing older, so the
 * screen shows one of exactly those two days. Every write goes to the day on
 * show; a yesterday the write rule does not open is shown read-only; the
 * switch is relative and follows the one "today" across midnight (B3).
 */

let mounted: Mounted | null = null;

function at(day: string, hour = 9, minute = 0): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, minute, 0) });
}

// Wednesday 14 October 2026; set up the Saturday before.
const TODAY = '2026-10-14';
const YESTERDAY = '2026-10-13';

beforeEach(async () => {
  await deleteDatabase();
  at('2026-10-10');
  await applyOnboarding({
    questions: [
      { text: 'Bett gemacht?', type: 'boolean', category: 'eigene' },
      { text: 'Wie geschlafen?', type: 'scale', category: 'eigene' },
    ],
    gymTargetPerWeek: 3,
    runningTargetPerWeek: 2,
  });
  await ensureExerciseCatalogue();
  at(TODAY);
  refreshToday();
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  setClock(null);
  await closeDatabase();
});

/** Real IndexedDB answers on later turns of the event loop, so wait for it. */
async function until(ok: () => boolean, rounds = 160): Promise<void> {
  for (let i = 0; i < rounds && !ok(); i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function open(): Promise<void> {
  mounted = await mount(
    <I18nProvider language="de" setLanguage={() => undefined}>
      <WeightUnitProvider unit="kg">
        <ToastProvider>
          <TodayScreen onGoToAreas={() => undefined} />
          <ToastOutlet />
        </ToastProvider>
      </WeightUnitProvider>
    </I18nProvider>,
  );
  await until(() => document.querySelector('.check-in') !== null);
}

const dateLine = () => document.querySelector('.today__date')?.textContent ?? '';
const switchButton = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.today__switch button')].find(
    (button) => button.textContent === label,
  )!;
const yesterdayLine = () => document.querySelector<HTMLButtonElement>('button.today__yesterday');
const buttonNamed = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes(text)) ?? null;
const closedNote = () => document.querySelector('.today__closed')?.textContent ?? null;

async function click(element: HTMLElement): Promise<void> {
  await act(async () => element.click());
}

async function show(label: 'Heute' | 'Gestern', date: string): Promise<void> {
  await click(switchButton(label));
  await until(() => dateLine().includes(date) && document.querySelector('.today__scroll[aria-busy]') === null);
}

/** A question's id by its text; snapshots keep questions sorted by id, not by order. */
async function questionId(text: string): Promise<string> {
  const question = (await configSnapshotsRepository.list())[0]!.config.questions.find((entry) => entry.text === text);
  return question!.id;
}

describe('Heute | Gestern', () => {
  it("opens on today, and shows yesterday's date and questions on the other side", async () => {
    await open();
    expect(dateLine()).toBe('Mittwoch, 14. Oktober');
    expect(switchButton('Heute').getAttribute('aria-pressed')).toBe('true');
    expect(switchButton('Gestern').getAttribute('aria-pressed')).toBe('false');

    await show('Gestern', '13. Oktober');
    expect(dateLine()).toBe('Dienstag, 13. Oktober');
    expect(switchButton('Gestern').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('.check-in')).toHaveLength(2);
    expect(closedNote()).toBeNull();
  });

  it('writes an answer given on the Gestern side to yesterday', async () => {
    await open();
    await show('Gestern', '13. Oktober');
    await click(document.querySelector<HTMLButtonElement>('.answer-boolean__option--yes')!);
    const boolId = await questionId('Bett gemacht?');
    await until(() => document.querySelector('.check-in--answered') !== null);
    expect((await answersRepository.get(YESTERDAY, boolId))?.value).toBe(true);
    expect(await answersRepository.get(TODAY, boolId)).toBeUndefined();
  });

  it('points from Heute to an open yesterday, and stops once it is answered', async () => {
    await open();
    await until(() => yesterdayLine() !== null);
    expect(yesterdayLine()?.textContent).toBe('Gestern ist noch offen');

    await click(yesterdayLine()!);
    await until(() => dateLine().includes('13. Oktober') && document.querySelector('.check-in') !== null);
    expect(switchButton('Gestern').getAttribute('aria-pressed')).toBe('true');
    // The pointer belongs to Heute only.
    expect(yesterdayLine()).toBeNull();

    await click(document.querySelector<HTMLButtonElement>('.answer-boolean__option--no')!);
    await until(() => document.querySelectorAll('.check-in--answered').length === 1);
    await click(document.querySelectorAll<HTMLButtonElement>('.answer-scale__value')[6]!);
    await until(() => document.querySelectorAll('.check-in--answered').length === 2);
    expect(document.querySelector('.today__progress')?.textContent).toBe('Gestern erledigt');

    await show('Heute', '14. Oktober');
    await until(() => false, 30);
    expect(yesterdayLine()).toBeNull();
    // Today is still owed, and says so in its own words.
    expect(document.querySelector('.today__progress')?.textContent).toBe('0 von 2 beantwortet');
  });

  it('shows a yesterday lived before the update read-only, with the closed copy', async () => {
    // A profile from before P8: the update appends the P8 era today, so
    // yesterday keeps the rules it was lived by and is not reopened.
    const legacy = (await configSnapshotsRepository.list()).map((snapshot) => {
      const { sessionWindowDays: _marker, ...scoring } = snapshot.config.scoring;
      return { ...snapshot, config: { ...snapshot.config, scoring: { ...scoring, editWindowDays: 3 } } };
    });
    await configSnapshotsRepository.replaceAll(legacy);
    await ensureSessionWindowEra(TODAY);

    await open();
    await until(() => false, 30);
    expect(yesterdayLine()).toBeNull();

    await show('Gestern', '13. Oktober');
    expect(closedNote()).toBe('Dieser Tag ist abgeschlossen.');
    const controls = [...document.querySelectorAll<HTMLButtonElement>('.answer-boolean__option, .answer-scale__value')];
    expect(controls.length).toBeGreaterThan(0);
    expect(controls.every((control) => control.disabled)).toBe(true);
    // No way to log a session for it either, and no second notice.
    expect(document.querySelector('.week__log')).toBeNull();
    expect(document.querySelector('.week__closed')).toBeNull();
  });

  it('follows midnight on the Gestern side: the new yesterday is the day that was today', async () => {
    at(TODAY, 23, 58);
    refreshToday();
    await open();
    await show('Gestern', '13. Oktober');

    at('2026-10-15', 0, 1);
    await act(async () => refreshToday());
    await until(() => dateLine().includes('14. Oktober') && document.querySelector('.check-in') !== null);
    expect(switchButton('Gestern').getAttribute('aria-pressed')).toBe('true');
    expect(dateLine()).toBe('Mittwoch, 14. Oktober');
  });

  it('logs a run on the Gestern side for yesterday, and offers it today and yesterday only', async () => {
    await open();
    await show('Gestern', '13. Oktober');
    await click(buttonNamed('Lauf eintragen')!);
    await until(() => document.querySelector('.toast') !== null);
    const runs = await runsRepository.getAll();
    expect(runs.map((run) => run.date)).toEqual([YESTERDAY]);

    await until(() => document.querySelector('button.row') !== null);
    await click(document.querySelector<HTMLButtonElement>('button.row')!);
    await until(() => document.querySelector('.session-days') !== null);
    const days = [...document.querySelectorAll<HTMLButtonElement>('.session-days__day')];
    expect(days.map((day) => day.textContent)).toEqual(['Di', 'Mi']);
    expect(days.map((day) => day.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(days.every((day) => !day.disabled)).toBe(true);
    expect(buttonNamed('Sichern')).not.toBeNull();
    expect(document.querySelector('.session-sheet__closed')).toBeNull();
  });

  it('opens a run older than yesterday read-only', async () => {
    await runsRepository.create({
      date: '2026-10-12',
      note: null,
      durationSeconds: 1800,
      distanceMetres: 5000,
      configSnapshotId: (await configSnapshotsRepository.list())[0]!.id,
    });
    await open();
    await until(() => document.querySelector('button.row') !== null);
    await click(document.querySelector<HTMLButtonElement>('button.row')!);
    await until(() => document.querySelector('.session-days') !== null);

    expect(document.querySelector('.session-sheet__closed')?.textContent).toBe('Dieser Tag ist abgeschlossen.');
    expect(buttonNamed('Sichern')).toBeNull();
    expect(buttonNamed('Training löschen')).toBeNull();
    // Read-only, it shows the run's own day and nothing it could move to.
    const days = [...document.querySelectorAll<HTMLButtonElement>('.session-days__day')];
    expect(days.map((day) => day.textContent)).toEqual(['Mo']);
    expect(days.every((day) => day.disabled)).toBe(true);
    expect(document.querySelector<HTMLInputElement>('#session-distance')?.readOnly).toBe(true);
  });

  it('starts a workout on the Gestern side for yesterday', async () => {
    await open();
    await show('Gestern', '13. Oktober');
    await click(buttonNamed('Session eintragen')!);
    await until(() => document.querySelector('.gym-session__date') !== null);
    expect(document.querySelector('.gym-session__date')?.textContent).toContain('13. Oktober');
    expect(document.querySelector('.gym-session__closed')).toBeNull();
  });

  it('names the week on the Monday as last week on the Gestern side', async () => {
    at('2026-10-19');
    refreshToday();
    await open();
    expect(document.querySelector('.week__label')?.textContent).toBe('Diese Woche');
    await show('Gestern', '18. Oktober');
    expect(document.querySelector('.week__label')?.textContent).toBe('Letzte Woche');
  });

  it('speaks of yesterday on the Gestern side: Food and a paused day', async () => {
    at('2026-10-12');
    await enableDomain('food');
    await createPause({ from: '2026-10-12', to: '2026-10-13' });
    at(TODAY);
    refreshToday();
    await open();
    expect(document.querySelector('.today__paused')).toBeNull();
    expect(document.querySelector('.food__question')?.textContent).toBe('Wie gut hast du heute deinem Vorsatz entsprochen?');

    await show('Gestern', '13. Oktober');
    expect(document.querySelector('.today__pausedTitle')?.textContent).toBe(
      'Gestern war Pause. Anwesenheitsverluste sind ausgesetzt.',
    );
    expect(document.querySelector('.food__question')?.textContent).toBe('Wie gut hast du gestern deinem Vorsatz entsprochen?');
    expect(document.querySelector('.food__rating')?.textContent).toBe('Gestern noch nicht bewertet');
    expect(document.querySelector('.food__logTitle')?.textContent).toBe('Gestern gegessen');
  });

  it('says nothing was due on a yesterday that asked nothing', async () => {
    await deleteDatabase();
    at('2026-10-10');
    await applyOnboarding({ questions: [] });
    at(TODAY);
    refreshToday();
    await enableDomain('food');
    mounted = await mount(
      <I18nProvider language="de" setLanguage={() => undefined}>
        <WeightUnitProvider unit="kg">
          <ToastProvider>
            <TodayScreen onGoToAreas={() => undefined} />
          </ToastProvider>
        </WeightUnitProvider>
      </I18nProvider>,
    );
    await until(() => document.querySelector('.food__question') !== null);
    await show('Gestern', '13. Oktober');
    expect(document.querySelector('.today__nothingDue')?.textContent).toBe('An diesem Tag war nichts fällig.');
    expect(document.querySelector('.today__closed')).toBeNull();
  });

  it('shows a run logged for yesterday by its weekday, not the time it was logged', async () => {
    await open();
    await show('Gestern', '13. Oktober');
    await click(buttonNamed('Lauf eintragen')!);
    await until(() => document.querySelector('button.row .session-row__time') !== null);
    expect(document.querySelector('button.row .session-row__time')?.textContent).toBe('Dienstag');
  });

  it('moves focus to the Gestern option when the pointer leads there', async () => {
    await open();
    await until(() => yesterdayLine() !== null);
    await act(async () => {
      yesterdayLine()!.focus();
      yesterdayLine()!.click();
    });
    await until(() => dateLine().includes('13. Oktober') && document.querySelector('.check-in') !== null);
    expect(document.activeElement).toBe(switchButton('Gestern'));
  });

  it('saves a run sheet left open across midnight on the run\'s own day, if the day picked is gone', async () => {
    at(TODAY, 23, 58);
    refreshToday();
    const snapshotId = (await configSnapshotsRepository.list())[0]!.id;
    await runsRepository.create({ date: TODAY, note: null, durationSeconds: null, distanceMetres: null, configSnapshotId: snapshotId });
    await open();
    await until(() => document.querySelector('button.row') !== null);
    await click(document.querySelector<HTMLButtonElement>('button.row')!);
    await until(() => document.querySelector('.session-days') !== null);
    await click([...document.querySelectorAll<HTMLButtonElement>('.session-days__day')][0]!);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      const distance = document.getElementById('session-distance') as HTMLInputElement;
      setter.call(distance, '5.2');
      distance.dispatchEvent(new Event('input', { bubbles: true }));
    });

    at('2026-10-15', 0, 1);
    await act(async () => refreshToday());
    await until(() => dateLine().includes('15. Oktober') && document.querySelector('.check-in') !== null);
    const days = [...document.querySelectorAll<HTMLButtonElement>('.session-days__day')];
    expect(days.map((day) => [day.textContent, day.getAttribute('aria-checked')])).toEqual([
      ['Mi', 'true'],
      ['Do', 'false'],
    ]);
    await click(buttonNamed('Sichern')!);
    await until(() => false, 30);
    expect((await runsRepository.getAll()).map((run) => [run.date, run.distanceMetres])).toEqual([[TODAY, 5200]]);
  });

  it('shows the run as stored when its sheet turns read-only at midnight', async () => {
    at(TODAY, 23, 58);
    refreshToday();
    const snapshotId = (await configSnapshotsRepository.list())[0]!.id;
    await runsRepository.create({ date: YESTERDAY, note: null, durationSeconds: 1800, distanceMetres: 5000, configSnapshotId: snapshotId });
    await open();
    await until(() => document.querySelector('button.row') !== null);
    await click(document.querySelector<HTMLButtonElement>('button.row')!);
    await until(() => document.querySelector('.session-days') !== null);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      const distance = document.getElementById('session-distance') as HTMLInputElement;
      setter.call(distance, '7.5');
      distance.dispatchEvent(new Event('input', { bubbles: true }));
    });

    at('2026-10-15', 0, 1);
    await act(async () => refreshToday());
    await until(() => document.querySelector('.session-sheet__closed') !== null);
    expect((document.getElementById('session-distance') as HTMLInputElement).value).toBe('5');
    expect([...document.querySelectorAll('.session-days__day')].map((day) => day.textContent)).toEqual(['Di']);
  });
});
