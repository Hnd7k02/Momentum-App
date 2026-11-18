// @vitest-environment happy-dom
import { act, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { layerDepth, resetBackLayers } from '../app/backLayer';
import { today } from '../core/clock';
import { QuestionSheet } from '../domains/mental/QuestionSheet';
import { SessionSheet } from '../domains/sports/SessionSheet';
import { ExercisePicker } from '../features/gym/ExercisePicker';
import { I18nProvider } from '../i18n/I18nProvider';
import type { QuestionRecord } from '../core/model';
import type { TrainingSession } from '../storage/services/checkInService';
import { mount, type Mounted } from '../test/dom';
import { FakeHistory } from '../test/history';
import { Sheet } from './index';
import { forgetDrafts } from './sheetDraft';

/**
 * Back closes every sheet, and a sheet with fields loses nothing typed
 * (the tidy-up of WP3, D187).
 *
 * A sheet owns a history entry with the address of the screen it lies on,
 * so Back closes the sheet and leaves the screen. Its own ways out take
 * the entry with them. And where a sheet has fields, what was typed when
 * Back closed it stands there again the next time it opens for the same
 * thing — while its cross still discards, as it always did.
 */

let history: FakeHistory;
const realHistory = window.history;
let mounted: Mounted | null = null;

/** Lets the microtask that reconciles, and any traversal it asked for, land. */
async function landed(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
  }
}

beforeEach(() => {
  history = new FakeHistory();
  history.entries[0]!.url = '#/areas/mental';
  Object.defineProperty(window, 'history', { value: history, configurable: true });
  resetBackLayers();
  forgetDrafts();
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  await landed();
  document.body.innerHTML = '';
  Object.defineProperty(window, 'history', { value: realHistory, configurable: true });
});

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const field = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;

/** Types as a person does: the field's value, and the event React listens for. */
async function type(id: string, value: string): Promise<void> {
  const element = field(id)!;
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function back(): Promise<void> {
  history.back();
  await landed();
}

async function press(element: Element | null | undefined): Promise<void> {
  await act(async () => {
    (element as HTMLElement).click();
  });
  await landed();
}

let open: (value: boolean) => void = () => undefined;

describe('a sheet and Back', () => {
  let events: string[] = [];

  function Host({ hostsBack = false }: { hostsBack?: boolean }) {
    const [isOpen, setOpen] = useState(false);
    open = setOpen;
    return (
      <I18nProvider language="de" setLanguage={() => undefined}>
        <Sheet
          open={isOpen}
          title="Legende"
          hostsBack={hostsBack}
          onBack={() => events.push('back')}
          onClose={() => {
            events.push('close');
            setOpen(false);
          }}
        >
          <p>Inhalt</p>
        </Sheet>
      </I18nProvider>
    );
  }

  beforeEach(() => {
    events = [];
  });

  it('owns one history entry with the address of the screen it lies on', async () => {
    mounted = await mount(<Host />);
    expect(history.length).toBe(1);
    await act(async () => open(true));
    await landed();
    expect(dialog()).not.toBeNull();
    expect(history.length).toBe(2);
    expect(layerDepth(history.state)).toBe(1);
    // A sheet is not a place: the address is the screen's.
    expect(history.url).toBe('#/areas/mental');
  });

  it('is closed by Back, which says so first, and the screen stays', async () => {
    mounted = await mount(<Host />);
    await act(async () => open(true));
    await landed();
    await back();
    expect(events).toEqual(['back', 'close']);
    expect(dialog()).toBeNull();
    expect(history.index).toBe(0);
    expect(history.url).toBe('#/areas/mental');
  });

  it('closed by its cross takes its entry with it, and that is not Back', async () => {
    mounted = await mount(<Host />);
    await act(async () => open(true));
    await landed();
    await press(document.querySelector('.sheet__close'));
    expect(events).toEqual(['close']);
    expect(dialog()).toBeNull();
    expect(history.index).toBe(0);
    expect(layerDepth(history.state)).toBe(0);
  });

  it('adds no entry where its host owns the layer', async () => {
    mounted = await mount(<Host hostsBack />);
    await act(async () => open(true));
    await landed();
    expect(dialog()).not.toBeNull();
    expect(history.length).toBe(1);
  });
});

describe('a sheet with fields loses nothing typed when Back closes it', () => {
  const question = (id: string, text: string): QuestionRecord =>
    ({ id, text, type: 'scale', category: 'mental', status: 'active' }) as unknown as QuestionRecord;

  function Questions({ first, second }: { first: QuestionRecord | null; second?: QuestionRecord }) {
    const [target, setTarget] = useState<QuestionRecord | null | 'none'>('none');
    open = (value) => setTarget(value ? first : 'none');
    openSecond = () => setTarget(second ?? null);
    return (
      <I18nProvider language="de" setLanguage={() => undefined}>
        <QuestionSheet
          open={target !== 'none'}
          question={target === 'none' ? null : target}
          onClose={() => setTarget('none')}
          onSubmit={() => setTarget('none')}
        />
      </I18nProvider>
    );
  }
  let openSecond: () => void = () => undefined;

  it('a new question: the text stands again after Back, and is gone after the cross', async () => {
    mounted = await mount(<Questions first={null} />);
    await act(async () => open(true));
    await landed();
    await type('question-text', 'Habe ich heute gelesen?');
    await back();
    expect(dialog()).toBeNull();

    await act(async () => open(true));
    await landed();
    expect(field('question-text')!.value).toBe('Habe ich heute gelesen?');

    // The cross is a decision about what was typed: nothing is kept.
    await press(document.querySelector('.sheet__close'));
    await act(async () => open(true));
    await landed();
    expect(field('question-text')!.value).toBe('');
  });

  it('a draft belongs to the question it was typed for', async () => {
    const one = question('q1', 'Wie war deine Stimmung heute?');
    const two = question('q2', 'Wie gut hast du geschlafen?');
    mounted = await mount(<Questions first={one} second={two} />);
    await act(async () => open(true));
    await landed();
    await type('question-text', 'Wie war deine Stimmung am Abend?');
    await back();

    await act(async () => openSecond());
    await landed();
    expect(field('question-text')!.value).toBe('Wie gut hast du geschlafen?');
    await press(document.querySelector('.sheet__close'));

    await act(async () => open(true));
    await landed();
    expect(field('question-text')!.value).toBe('Wie war deine Stimmung am Abend?');
  });

  it('a run: distance, duration and note stand again after Back', async () => {
    const day = today();
    const run: TrainingSession = {
      id: 'run-1',
      domain: 'running',
      date: day,
      performedAt: `${day}T18:00:00.000Z`,
      note: null,
      durationMinutes: null,
      distanceMetres: null,
      legacyCarryOver: false,
    } as TrainingSession;
    function Runs() {
      const [isOpen, setOpen] = useState(false);
      open = setOpen;
      return (
        <I18nProvider language="de" setLanguage={() => undefined}>
          <SessionSheet
            open={isOpen}
            session={run}
            days={[day]}
            onClose={() => setOpen(false)}
            onSave={() => setOpen(false)}
            onDelete={() => setOpen(false)}
          />
        </I18nProvider>
      );
    }
    mounted = await mount(<Runs />);
    await act(async () => open(true));
    await landed();
    await type('session-distance', '7,5');
    await type('session-duration', '42');
    await type('session-note', 'Am See entlang');
    await back();
    expect(dialog()).toBeNull();

    await act(async () => open(true));
    await landed();
    expect(field('session-distance')!.value).toBe('7,5');
    expect(field('session-duration')!.value).toBe('42');
    expect(field('session-note')!.value).toBe('Am See entlang');

    await press(document.querySelector('.sheet__close'));
    await act(async () => open(true));
    await landed();
    expect(field('session-note')!.value).toBe('');
  });

  it('the exercise picker: the search stands again after Back, and is empty after the cross', async () => {
    function Picker() {
      const [isOpen, setOpen] = useState(false);
      open = setOpen;
      return (
        <I18nProvider language="de" setLanguage={() => undefined}>
          <ExercisePicker
            open={isOpen}
            exercises={[]}
            onClose={() => setOpen(false)}
            onPick={() => setOpen(false)}
            onCreate={() => setOpen(false)}
          />
        </I18nProvider>
      );
    }
    mounted = await mount(<Picker />);
    await act(async () => open(true));
    await landed();
    await type('exercise-search', 'Kabelzug');
    await back();
    expect(dialog()).toBeNull();

    await act(async () => open(true));
    await landed();
    expect(field('exercise-search')!.value).toBe('Kabelzug');

    await press(document.querySelector('.sheet__close'));
    await act(async () => open(true));
    await landed();
    expect(field('exercise-search')!.value).toBe('');
  });
});
