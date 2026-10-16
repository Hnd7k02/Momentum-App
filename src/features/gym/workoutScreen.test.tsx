// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import type { GymSetRecord } from '../../core/model';
import { I18nProvider } from '../../i18n/I18nProvider';
import { ToastOutlet, ToastProvider } from '../../components/Toast';
import { WeightUnitProvider } from '../../app/useWeights';
import type { WeightUnit } from '../../core/gym/weight';
import { closeDatabase, deleteDatabase } from '../../storage/db';
import { gymSessionsRepository, gymSetsRepository, weightEntriesRepository } from '../../storage/repositories';
import { applyOnboarding } from '../../storage/services/configurationService';
import {
  addSet,
  draftFromPlan,
  ensureExerciseCatalogue,
  loadSession,
  recordBodyweight,
  removeSet,
  restoreSet,
  startSessionFromDraft,
  type SessionDraft,
} from '../../storage/services/gymService';
import { createTrainingPlan } from '../../storage/services/trainingPlanService';
import { mount, type Mounted } from '../../test/dom';
import { GymSessionScreen } from './GymSessionScreen';

/**
 * The workout screen against real storage (WP3, Stage 2 — review).
 *
 * A tap on a control first takes the focus from the field the user was
 * typing in, so the field's write is queued a moment before the tap's own.
 * Every action therefore decides from what is stored when its turn comes,
 * never from the render the finger landed on: an undo puts back what was
 * actually removed (D131), a new set copies the set as it now is, and an
 * exercise removed while its first set is being saved is removed with it.
 */

const WEDNESDAY = '2026-10-14';
let mounted: Mounted | null = null;
let closedCount = 0;

beforeEach(async () => {
  await deleteDatabase();
  setClock({ now: () => new Date(2026, 9, 14, 9, 0, 0) });
  await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
  await ensureExerciseCatalogue();
  closedCount = 0;
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  setClock(null);
  await closeDatabase();
});

async function open(props: {
  sessionId?: string | null;
  draft?: SessionDraft | null;
  free?: boolean;
  unit?: WeightUnit;
}) {
  mounted = await mount(
    <I18nProvider language="de" setLanguage={() => undefined}>
      <WeightUnitProvider unit={props.unit ?? 'kg'}>
        <ToastProvider>
          <GymSessionScreen
            sessionId={props.sessionId ?? null}
            draft={props.draft ?? null}
            free={props.free ?? false}
            date={WEDNESDAY}
            onClose={() => {
              closedCount += 1;
            }}
          />
          <ToastOutlet />
        </ToastProvider>
      </WeightUnitProvider>
    </I18nProvider>,
  );
  await until(() => document.querySelector('.gym-session .gym-exercise__name') !== null || document.querySelector('.gym-session .empty-state') !== null);
}

/** Real IndexedDB answers on later turns of the event loop, so wait for it. */
async function until(ok: () => boolean, rounds = 120): Promise<void> {
  for (let i = 0; i < rounds && !ok(); i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}
async function quiet(rounds = 40): Promise<void> {
  await until(() => false, rounds);
}

const card = (name: string): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>('.gym-session .card')].find(
    (element) => element.querySelector('.gym-exercise__name')?.firstChild?.textContent?.trim() === name,
  );
  if (!found) throw new Error(`no card for ${name}`);
  return found;
};
const hasCard = (name: string) =>
  [...document.querySelectorAll('.gym-session .gym-exercise__name')].some(
    (element) => element.firstChild?.textContent?.trim() === name,
  );
const button = (label: string): HTMLButtonElement => {
  const found = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!found) throw new Error(`no button ${label}`);
  return found;
};
const undoButton = () => document.querySelector<HTMLButtonElement>('.toast .toast__action');
const toastText = () => document.querySelector('.toast .toast__message')?.textContent ?? null;

/** Types as a person does: the field takes the focus, then the text. */
function type(input: HTMLInputElement, text: string): void {
  input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
/** The field loses the focus — to `next`, or to nothing focusable. */
function leave(input: HTMLInputElement, next: Element | null = null): void {
  input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: next }));
}
/** A tap on `target` while `field` still has the focus: blur first, then the click. */
async function tapAway(field: HTMLInputElement, target: HTMLElement): Promise<void> {
  await act(async () => {
    leave(field, target);
    target.click();
  });
}

const pendingInputs = (name: string) => [...card(name).querySelectorAll<HTMLInputElement>('.gym-set--pending input')];
const setInputs = (name: string, index: number) =>
  [...card(name).querySelectorAll<HTMLElement>('.gym-set:not(.gym-set--pending)')][index]!.querySelectorAll<HTMLInputElement>('input');

async function setsOf(exerciseId: string): Promise<GymSetRecord[]> {
  return (await gymSetsRepository.getAll())
    .filter((set) => set.exerciseId === exerciseId)
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

async function planDraft(ids: string[]): Promise<SessionDraft> {
  const plan = await createTrainingPlan({ name: 'Push', exercises: ids.map((exerciseId) => ({ exerciseId })) });
  return draftFromPlan(plan);
}

describe('removing an exercise while its first set is being saved', () => {
  it('in a plan session: the undo puts back the set the same tap saved', async () => {
    const draft = await planDraft(['ex_bench_press', 'ex_incline_press']);
    const session = await startSessionFromDraft(draft, WEDNESDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_incline_press', reps: 10, weightGrams: 40000 });
    await open({ sessionId: session.id });

    const [reps, weight] = pendingInputs('Bankdrücken');
    await act(async () => type(reps!, '8'));
    await act(async () => leave(reps!, weight!));
    await act(async () => type(weight!, '60'));
    await tapAway(weight!, button('Bankdrücken aus der Session entfernen'));
    await until(() => undoButton() !== null && !hasCard('Bankdrücken'));
    expect(await setsOf('ex_bench_press')).toHaveLength(0);

    await act(async () => undoButton()!.click());
    await until(() => hasCard('Bankdrücken'));
    await quiet();
    const back = await setsOf('ex_bench_press');
    expect(back.map((set) => [set.reps, set.weightGrams])).toEqual([[8, 60000]]);
    const lines = (await gymSessionsRepository.get(session.id))!.exercises!.map((line) => line.exerciseId);
    expect(lines).toEqual(['ex_bench_press', 'ex_incline_press']);
  });

  it('in a plan draft: the exercise goes, with the set and the session that set created', async () => {
    const draft = await planDraft(['ex_bench_press', 'ex_incline_press']);
    await open({ draft });

    const [reps, weight] = pendingInputs('Bankdrücken');
    await act(async () => type(reps!, '8'));
    await act(async () => leave(reps!, weight!));
    await act(async () => type(weight!, '60'));
    await tapAway(weight!, button('Bankdrücken aus der Session entfernen'));
    await until(() => undoButton() !== null);
    await quiet();

    expect(hasCard('Bankdrücken')).toBe(false);
    expect(toastText()).toBe('Bankdrücken entfernt.');
    expect(await setsOf('ex_bench_press')).toHaveLength(0);

    await act(async () => undoButton()!.click());
    await until(() => hasCard('Bankdrücken'));
    await quiet();
    expect((await setsOf('ex_bench_press')).map((set) => set.reps)).toEqual([8]);
    expect(card('Bankdrücken').querySelectorAll('.gym-set:not(.gym-set--pending)')).toHaveLength(1);
  });

  it('an undo of a draft line lands in the session the draft has become meanwhile', async () => {
    const draft = await planDraft(['ex_bench_press', 'ex_incline_press', 'ex_dip']);
    await open({ draft });

    await act(async () => button('Schrägbank Kurzhantel aus der Session entfernen').click());
    await until(() => undoButton() !== null && !hasCard('Schrägbank Kurzhantel'));

    // Within the undo's few seconds the first set is saved, and with it
    // the session the draft becomes.
    const [reps, weight] = pendingInputs('Bankdrücken');
    await act(async () => type(reps!, '8'));
    await act(async () => leave(reps!, weight!));
    await act(async () => type(weight!, '60'));
    await act(async () => leave(weight!));
    await until(() => card('Bankdrücken').querySelectorAll('.gym-set:not(.gym-set--pending)').length === 1);
    expect(await gymSessionsRepository.getAll()).toHaveLength(1);

    await act(async () => undoButton()!.click());
    await until(() => hasCard('Schrägbank Kurzhantel'));
    await quiet();

    const sessions = await gymSessionsRepository.getAll();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.exercises!.map((line) => line.exerciseId)).toEqual([
      'ex_bench_press',
      'ex_incline_press',
      'ex_dip',
    ]);
  });
});

describe('removing a set', () => {
  it('the undo puts back the set as stored, with the edit the same tap saved', async () => {
    const session = await startSessionFromDraft(await planDraft(['ex_bench_press']), WEDNESDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: 60000 });
    await open({ sessionId: session.id });

    const [reps] = setInputs('Bankdrücken', 0);
    await act(async () => type(reps!, '10'));
    await tapAway(reps!, button('Satz 1 von Bankdrücken entfernen'));
    await until(() => undoButton() !== null);
    await quiet();
    expect(await setsOf('ex_bench_press')).toHaveLength(0);

    await act(async () => undoButton()!.click());
    await until(() => card('Bankdrücken').querySelectorAll('.gym-set:not(.gym-set--pending)').length === 1);
    await quiet();
    expect((await setsOf('ex_bench_press')).map((set) => set.reps)).toEqual([10]);
  });

  it('no undo follows the user out of the workout', async () => {
    const session = await startSessionFromDraft(await planDraft(['ex_bench_press']), WEDNESDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: 60000 });
    await open({ sessionId: session.id });

    await act(async () => {
      button('Satz 1 von Bankdrücken entfernen').click();
      button('Zurück').click();
    });
    await until(() => closedCount > 0);
    await quiet();
    expect(closedCount).toBe(1);
    expect(document.querySelector('.toast')).toBeNull();
  });
});

describe('a workout the user empties (STOP 2, decision 1)', () => {
  it('goes with its last set, and the undo brings it back under the same id', async () => {
    const session = await startSessionFromDraft(await planDraft(['ex_bench_press']), WEDNESDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: 60000 });
    await open({ sessionId: session.id });

    await act(async () => button('Satz 1 von Bankdrücken entfernen').click());
    await until(() => undoButton() !== null);
    await quiet();
    expect(await gymSessionsRepository.getAll()).toEqual([]);
    // The workout stays on screen, its exercise waiting for a set.
    expect(hasCard('Bankdrücken')).toBe(true);
    expect(pendingInputs('Bankdrücken')).toHaveLength(2);

    await act(async () => undoButton()!.click());
    await until(() => card('Bankdrücken').querySelectorAll('.gym-set:not(.gym-set--pending)').length === 1);
    await quiet();
    const back = await gymSessionsRepository.getAll();
    expect(back.map((entry) => entry.id)).toEqual([session.id]);
    expect(back[0]!.exercises!.map((line) => line.exerciseId)).toEqual(['ex_bench_press']);
    expect((await setsOf('ex_bench_press')).map((set) => [set.reps, set.weightGrams])).toEqual([[8, 60000]]);
  });

  it('comes back under the same id with the next saved set', async () => {
    const session = await startSessionFromDraft(await planDraft(['ex_bench_press']), WEDNESDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: 60000 });
    await open({ sessionId: session.id });

    await act(async () => button('Satz 1 von Bankdrücken entfernen').click());
    await until(() => undoButton() !== null);
    await quiet();
    expect(await gymSessionsRepository.getAll()).toEqual([]);

    const [reps, weight] = pendingInputs('Bankdrücken');
    await act(async () => type(reps!, '5'));
    await act(async () => leave(reps!, weight!));
    await act(async () => type(weight!, '70'));
    await act(async () => leave(weight!));
    await until(() => card('Bankdrücken').querySelectorAll('.gym-set:not(.gym-set--pending)').length === 1);
    await quiet();
    const back = await gymSessionsRepository.getAll();
    expect(back.map((entry) => entry.id)).toEqual([session.id]);
    expect((await setsOf('ex_bench_press')).map((set) => [set.reps, set.weightGrams])).toEqual([[5, 70000]]);
  });
});

describe('an assisted exercise (STOP 2, decision 3)', () => {
  it('waits for its assistance to be typed, and takes an explicit 0', async () => {
    const name = 'Klimmzüge assistiert';
    await open({ draft: await planDraft(['ex_assisted_pull_up']) });

    const [reps] = pendingInputs(name);
    await act(async () => type(reps!, '8'));
    await act(async () => leave(reps!));
    await quiet();
    // Reps alone are not a set: how much the machine took off is part of it.
    expect(await gymSessionsRepository.getAll()).toHaveLength(0);
    expect(pendingInputs(name)).toHaveLength(2);

    await act(async () => type(pendingInputs(name)[1]!, '0'));
    await act(async () => leave(pendingInputs(name)[1]!));
    await until(() => card(name).querySelectorAll('.gym-set:not(.gym-set--pending)').length === 1);
    await quiet();
    expect((await setsOf('ex_assisted_pull_up')).map((set) => [set.reps, set.weightGrams])).toEqual([[8, 0]]);
  });
});

describe('adding a set', () => {
  it('copies the set before it as stored, including the edit the same tap saved', async () => {
    const session = await startSessionFromDraft(await planDraft(['ex_bench_press']), WEDNESDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: 60000 });
    await open({ sessionId: session.id });

    const [reps] = setInputs('Bankdrücken', 0);
    await act(async () => type(reps!, '10'));
    await tapAway(reps!, button('Satz zu Bankdrücken hinzufügen'));
    await until(() => card('Bankdrücken').querySelectorAll('.gym-set:not(.gym-set--pending)').length === 2);
    await quiet();
    expect((await setsOf('ex_bench_press')).map((set) => set.reps)).toEqual([10, 10]);
  });
});

describe('a saved set row', () => {
  it('keeps the last value typed, even when it is the stored one again', async () => {
    const session = await startSessionFromDraft(await planDraft(['ex_bench_press']), WEDNESDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: 60000 });
    await open({ sessionId: session.id });

    const [reps] = setInputs('Bankdrücken', 0);
    // Typed, left, corrected back before the first write has come back.
    await act(async () => {
      type(reps!, '10');
      leave(reps!);
      type(reps!, '8');
      leave(reps!);
    });
    await quiet();
    expect((await setsOf('ex_bench_press')).map((set) => set.reps)).toEqual([8]);
    expect(setInputs('Bankdrücken', 0)[0]!.value).toBe('8');
  });
});

describe('the first set of a bodyweight exercise', () => {
  it('is saved when the focus leaves the row, not when it moves to the weight', async () => {
    const draft = await planDraft(['ex_dip']);
    await open({ draft });

    const [reps, weight] = pendingInputs('Dips');
    await act(async () => type(reps!, '8'));
    await act(async () => leave(reps!, weight!));
    await quiet();
    expect(await gymSessionsRepository.getAll()).toHaveLength(0);
    expect(pendingInputs('Dips')).toHaveLength(2);

    await act(async () => type(pendingInputs('Dips')[1]!, '10'));
    await act(async () => leave(pendingInputs('Dips')[1]!));
    await until(() => card('Dips').querySelectorAll('.gym-set:not(.gym-set--pending)').length === 1);
    await quiet();
    expect((await setsOf('ex_dip')).map((set) => [set.reps, set.weightGrams])).toEqual([[8, 10000]]);
  });
});

describe('set order', () => {
  it('a new set follows the highest order, so a removal never makes two sets share one', async () => {
    const session = await startSessionFromDraft(await planDraft(['ex_bench_press']), WEDNESDAY);
    const sets = [];
    for (const reps of [5, 6, 7]) {
      sets.push(await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps, weightGrams: 60000 }));
    }
    await removeSet(sets[0]!.id);
    const added = await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: 60000 });
    expect(added.order).toBe(3);
  });

  it('a set put back by an undo keeps its place before a set added meanwhile', async () => {
    const session = await startSessionFromDraft(await planDraft(['ex_bench_press']), WEDNESDAY);
    const first = await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 5, weightGrams: 60000 });
    const second = await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 6, weightGrams: 60000 });
    await removeSet(second.id);
    setClock({ now: () => new Date(2026, 9, 14, 9, 5, 0) });
    const added = await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 7, weightGrams: 60000 });
    await restoreSet(second);
    const view = await loadSession(session.id);
    expect(view!.exercises[0]!.sets.map((set) => set.id)).toEqual([first.id, second.id, added.id]);
  });
});

/*
 * A weight is written only when it changed (D130). In lb the text on screen
 * is rounded to a tenth of a pound, so re-parsing what is shown would move
 * the stored grams: 60 000 g reads 132.3 lb, and 132.3 lb is 60 010 g.
 */
describe('a weight nobody changed, in lb', () => {
  async function benchAt60kg() {
    const session = await startSessionFromDraft(await planDraft(['ex_bench_press']), WEDNESDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: 60000 });
    await open({ sessionId: session.id, unit: 'lb' });
    return session;
  }

  it('keeps its grams when the field is only visited', async () => {
    await benchAt60kg();
    const [, weight] = setInputs('Bankdrücken', 0);
    expect(weight!.value).toBe('132.3');
    await act(async () => {
      weight!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      leave(weight!);
    });
    await quiet();
    expect((await setsOf('ex_bench_press')).map((set) => set.weightGrams)).toEqual([60000]);
  });

  it('keeps its grams when the same value is typed again, with a comma', async () => {
    await benchAt60kg();
    const [, weight] = setInputs('Bankdrücken', 0);
    await act(async () => type(weight!, '132,3'));
    await act(async () => leave(weight!));
    await quiet();
    expect((await setsOf('ex_bench_press')).map((set) => set.weightGrams)).toEqual([60000]);
  });

  it('is written when it did change', async () => {
    await benchAt60kg();
    const [, weight] = setInputs('Bankdrücken', 0);
    await act(async () => type(weight!, '135'));
    await act(async () => leave(weight!));
    await quiet();
    expect((await setsOf('ex_bench_press')).map((set) => set.weightGrams)).toEqual([61235]);
  });
});

describe('a field left empty', () => {
  async function benchSession() {
    const session = await startSessionFromDraft(await planDraft(['ex_bench_press']), WEDNESDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: 60000 });
    await open({ sessionId: session.id });
  }

  it("is not a weight of zero: a barbell set's load stays what it was", async () => {
    await benchSession();
    const [, weight] = setInputs('Bankdrücken', 0);
    await act(async () => type(weight!, ''));
    await act(async () => leave(weight!));
    await quiet();
    expect((await setsOf('ex_bench_press')).map((set) => set.weightGrams)).toEqual([60000]);
    expect(setInputs('Bankdrücken', 0)[1]!.value).toBe('60');
  });

  it('is not zero reps either', async () => {
    await benchSession();
    const [reps] = setInputs('Bankdrücken', 0);
    await act(async () => type(reps!, ''));
    await act(async () => leave(reps!));
    await quiet();
    expect((await setsOf('ex_bench_press')).map((set) => set.reps)).toEqual([8]);
    expect(setInputs('Bankdrücken', 0)[0]!.value).toBe('8');
  });

  it("is not zero assistance: an assisted set's load stays what it was", async () => {
    const session = await startSessionFromDraft(await planDraft(['ex_assisted_pull_up']), WEDNESDAY);
    await addSet({ sessionId: session.id, exerciseId: 'ex_assisted_pull_up', reps: 8, weightGrams: 20000 });
    await open({ sessionId: session.id });
    const [, weight] = setInputs('Klimmzüge assistiert', 0);
    await act(async () => type(weight!, ''));
    await act(async () => leave(weight!));
    await quiet();
    expect((await setsOf('ex_assisted_pull_up')).map((set) => set.weightGrams)).toEqual([20000]);
    expect(setInputs('Klimmzüge assistiert', 0)[1]!.value).toBe('20');
  });

  it('a pending barbell row with only a decimal point stores nothing', async () => {
    await open({ draft: await planDraft(['ex_bench_press']) });
    const [reps, weight] = pendingInputs('Bankdrücken');
    await act(async () => type(reps!, '8'));
    await act(async () => leave(reps!, weight!));
    await act(async () => type(weight!, '.'));
    await act(async () => leave(weight!));
    await quiet();
    expect(await gymSessionsRepository.getAll()).toHaveLength(0);
  });
});

describe('the bodyweight card', () => {
  it('saves an unchanged weight exactly, in lb, whichever decimal mark', async () => {
    await recordBodyweight(80, WEDNESDAY);
    await open({ draft: await planDraft(['ex_pull_up']), unit: 'lb' });
    const field = document.querySelector<HTMLInputElement>('.gym-bodyweight__input')!;
    await until(() => field.value !== '');
    expect(field.value).toBe('176.4');
    await act(async () => type(field, '176,4'));
    await act(async () => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Gewicht sichern')!.click());
    await quiet();
    expect((await weightEntriesRepository.getAll()).map((entry) => entry.kg)).toEqual([80]);
  });

  it('says when the weight in force was entered, not the day of the session', async () => {
    // A weigh-in from three weeks ago, as stored history (no write window
    // reaches that far back any more, D133).
    await weightEntriesRepository.put({
      id: 'wt_old', date: '2026-09-23', kg: 80,
      createdAt: '2026-09-23T07:00:00.000Z', updatedAt: '2026-09-23T07:00:00.000Z',
    });
    await open({ draft: await planDraft(['ex_pull_up']) });
    const text = () => document.querySelector('.gym-bodyweight')?.closest('.card')?.textContent ?? '';
    await until(() => text().includes('Zuletzt gewogen'));
    expect(text()).toContain('Zuletzt gewogen am 23. September');
  });
});
