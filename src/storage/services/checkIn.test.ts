import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { closeDatabase, deleteDatabase } from '../db';
import { answersRepository, gymSessionsRepository, runsRepository } from '../repositories';
import { addQuestion, applyOnboarding, archiveQuestion, pauseQuestion } from './configurationService';
import {
  EditWindowError,
  InvalidAnswerError,
  clearAnswer,
  deleteSession,
  loadDay,
  logSession,
  saveAnswer,
  updateSession,
} from './checkInService';

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

// Monday 31 March 2025. The preceding week ran 24–30 March.
const TODAY = '2025-03-31';

beforeEach(async () => {
  await deleteDatabase();
  freezeAt(TODAY);
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

/**
 * Onboards on `since` (default today) and returns to today. A backfill can
 * only reach a day the app was already set up on — before that, no domain
 * existed (D133).
 */
async function setup(since: string = TODAY, runningTargetPerWeek: number | null = null) {
  freezeAt(since);
  await applyOnboarding({
    questions: [
      { text: 'Hast du dein Bett gemacht?', type: 'boolean', category: 'eigene' },
      { text: 'Wie gut hast du geschlafen?', type: 'scale', category: 'eigene' },
    ],
    gymTargetPerWeek: 3,
    runningTargetPerWeek,
  });
  freezeAt(TODAY);
  const day = await loadDay();
  return {
    boolQuestion: day.mental!.items[0]!.question,
    scaleQuestion: day.mental!.items[1]!.question,
  };
}

describe('what is due today', () => {
  it('lists every active question, unanswered', async () => {
    await setup();
    const day = await loadDay();
    expect(day.mental?.items).toHaveLength(2);
    expect(day.mental?.items.every((item) => item.answer === null)).toBe(true);
    expect(day.mental?.answeredCount).toBe(0);
    expect(day.mental?.complete).toBe(false);
    expect(day.empty).toBe(false);
  });

  it('drops paused and archived questions from the day', async () => {
    const { boolQuestion, scaleQuestion } = await setup();
    await pauseQuestion(boolQuestion.id);
    await archiveQuestion(scaleQuestion.id);
    const day = await loadDay();
    expect(day.mental?.items).toEqual([]);
  });

  it('reports a domain that is off as absent, not as empty', async () => {
    await applyOnboarding({ questions: [], gymTargetPerWeek: null });
    const day = await loadDay();
    // Nothing is tracked at all — which is different from nothing being due.
    expect(day.mental).toBeNull();
    expect(day.training).toEqual([]);
    expect(day.empty).toBe(true);
  });

  it('reports the day complete once every question is answered', async () => {
    const { boolQuestion, scaleQuestion } = await setup();
    await saveAnswer(TODAY, boolQuestion.id, true);
    expect((await loadDay()).mental?.complete).toBe(false);
    await saveAnswer(TODAY, scaleQuestion.id, 8);
    const day = await loadDay();
    expect(day.mental?.answeredCount).toBe(2);
    expect(day.mental?.complete).toBe(true);
  });

  it('a question added today is due today', async () => {
    await setup();
    await addQuestion({ text: 'Neu', type: 'boolean', category: 'eigene' });
    expect((await loadDay()).mental?.items).toHaveLength(3);
  });
});

describe('answering', () => {
  it('saves a yes/no answer on tap', async () => {
    const { boolQuestion } = await setup();
    await saveAnswer(TODAY, boolQuestion.id, true);
    const day = await loadDay();
    expect(day.mental?.items[0]?.answer?.value).toBe(true);
  });

  it('saves a scale answer', async () => {
    const { scaleQuestion } = await setup();
    await saveAnswer(TODAY, scaleQuestion.id, 7);
    expect((await loadDay()).mental?.items[1]?.answer?.value).toBe(7);
  });

  it('replaces rather than stacks when an answer is corrected', async () => {
    const { scaleQuestion } = await setup();
    await saveAnswer(TODAY, scaleQuestion.id, 3);
    await saveAnswer(TODAY, scaleQuestion.id, 9);
    const answers = await answersRepository.listByQuestion(scaleQuestion.id);
    expect(answers).toHaveLength(1);
    expect(answers[0]?.value).toBe(9);
  });

  it('keeps the answer when the same value is chosen again', async () => {
    const { boolQuestion, scaleQuestion } = await setup();
    await saveAnswer(TODAY, boolQuestion.id, true);
    await saveAnswer(TODAY, boolQuestion.id, true);
    await saveAnswer(TODAY, scaleQuestion.id, 7);
    await saveAnswer(TODAY, scaleQuestion.id, 7);

    // Selecting an option is never a toggle: a second tap must not remove
    // the answer, and must not create a second record either.
    expect((await answersRepository.get(TODAY, boolQuestion.id))?.value).toBe(true);
    expect(await answersRepository.listByQuestion(boolQuestion.id)).toHaveLength(1);
    expect((await answersRepository.get(TODAY, scaleQuestion.id))?.value).toBe(7);
    expect((await loadDay()).mental?.answeredCount).toBe(2);
  });

  it('removes an answer only through an explicit clear', async () => {
    const { boolQuestion } = await setup();
    await saveAnswer(TODAY, boolQuestion.id, false);
    expect((await loadDay()).mental?.answeredCount).toBe(1);

    await clearAnswer(TODAY, boolQuestion.id);
    // Unanswered again — which is a different thing from having answered "no".
    expect(await answersRepository.get(TODAY, boolQuestion.id)).toBeUndefined();
    expect((await loadDay()).mental?.answeredCount).toBe(0);
  });

  it('rejects a value that does not match the question type', async () => {
    const { boolQuestion, scaleQuestion } = await setup();
    await expect(saveAnswer(TODAY, boolQuestion.id, 5)).rejects.toThrow(InvalidAnswerError);
    await expect(saveAnswer(TODAY, scaleQuestion.id, true)).rejects.toThrow(InvalidAnswerError);
    await expect(saveAnswer(TODAY, scaleQuestion.id, 0)).rejects.toThrow(InvalidAnswerError);
    await expect(saveAnswer(TODAY, scaleQuestion.id, 11)).rejects.toThrow(InvalidAnswerError);
    await expect(saveAnswer(TODAY, scaleQuestion.id, 7.5)).rejects.toThrow(InvalidAnswerError);
  });
});

describe('the edit window: today and yesterday (P8, D133)', () => {
  it('accepts today and yesterday', async () => {
    const { boolQuestion } = await setup('2025-03-27');
    for (const date of ['2025-03-31', '2025-03-30']) {
      await saveAnswer(date, boolQuestion.id, true);
      expect((await answersRepository.get(date, boolQuestion.id))?.value).toBe(true);
    }
  });

  it('refuses the second preceding day', async () => {
    const { boolQuestion } = await setup('2025-03-27');
    await expect(saveAnswer('2025-03-29', boolQuestion.id, true)).rejects.toThrow(EditWindowError);
    expect(await answersRepository.get('2025-03-29', boolQuestion.id)).toBeUndefined();
  });

  it('refuses a future day', async () => {
    const { boolQuestion } = await setup();
    await expect(saveAnswer('2025-04-01', boolQuestion.id, true)).rejects.toThrow(EditWindowError);
  });

  it('refuses a day before the app was set up', async () => {
    const { boolQuestion } = await setup();
    // Yesterday, but nothing was enabled yet then.
    await expect(saveAnswer('2025-03-30', boolQuestion.id, true)).rejects.toThrow();
    expect(await answersRepository.get('2025-03-30', boolQuestion.id)).toBeUndefined();
  });

  it('refuses to clear an answer on a closed day', async () => {
    const { boolQuestion } = await setup('2025-03-27');
    await saveAnswer('2025-03-30', boolQuestion.id, true);
    // Two days later that day has closed and the record is final.
    freezeAt('2025-04-01');
    await expect(clearAnswer('2025-03-30', boolQuestion.id)).rejects.toThrow(EditWindowError);
    expect(await answersRepository.get('2025-03-30', boolQuestion.id)).toBeDefined();
  });

  it('reports the state of a day it will not let you edit', async () => {
    await setup('2025-03-27');
    const closed = await loadDay('2025-03-29');
    expect(closed.editState).toBe('closed');
    expect(closed.editable).toBe(false);

    const open = await loadDay('2025-03-30');
    expect(open.editState).toBe('open');
    expect(open.editable).toBe(true);
  });

  it('closes a day as the window rolls forward, without touching its data', async () => {
    const { boolQuestion } = await setup('2025-03-27');
    await saveAnswer('2025-03-30', boolQuestion.id, true);
    expect((await loadDay('2025-03-30')).editable).toBe(true);

    freezeAt('2025-04-01');
    const day = await loadDay('2025-03-30');
    expect(day.editable).toBe(false);
    expect(day.mental?.items[0]?.answer?.value).toBe(true);
  });
});

describe('training sessions', () => {
  it('counts this week towards the target', async () => {
    await setup();
    await logSession('gym', TODAY);
    await logSession('gym', TODAY);
    const day = await loadDay();
    expect(day.training[0]?.progress.completed).toBe(2);
    expect(day.training[0]?.progress.target).toBe(3);
    expect(day.training[0]?.progress.remaining).toBe(1);
    expect(day.training[0]?.progress.met).toBe(false);
  });

  it('allows several sessions on one day', async () => {
    await setup();
    await logSession('gym', TODAY);
    await logSession('gym', TODAY);
    expect((await loadDay())?.training[0]?.sessionsToday).toHaveLength(2);
  });

  it('does not count last week towards this week', async () => {
    await setup('2025-03-27');
    // Sunday 30 March belongs to the previous Monday-to-Sunday week.
    freezeAt('2025-03-30');
    await logSession('gym', '2025-03-30');
    freezeAt(TODAY);
    const day = await loadDay();
    expect(day.training[0]?.progress.completed).toBe(0);
    expect((await gymSessionsRepository.getAll())).toHaveLength(1);
  });

  it('adds a note to a session after logging it', async () => {
    await setup();
    const session = await logSession('gym', TODAY);
    await updateSession('gym', session.id, { note: 'Kurz', durationMinutes: 30 });
    const updated = await gymSessionsRepository.get(session.id);
    expect(updated?.note).toBe('Kurz');
  });

  it('deletes a session within its own week', async () => {
    await setup();
    const session = await logSession('gym', TODAY);
    await deleteSession('gym', session.id);
    expect((await loadDay())?.training[0]?.progress.completed).toBe(0);
  });

  it('keeps a Gym session on the day it was logged for (STOP 3a, question 9)', async () => {
    await setup('2025-03-27');
    const session = await logSession('gym', TODAY);
    await expect(updateSession('gym', session.id, { date: '2025-03-30', note: 'Laufen' })).rejects.toThrow(
      InvalidAnswerError,
    );
    expect((await gymSessionsRepository.get(session.id))?.date).toBe(TODAY);
  });

  it('moves a run to the day it actually happened: yesterday, across the week boundary', async () => {
    await setup('2025-03-27', 2);
    const run = await logSession('running', TODAY);
    // Logged on Monday, but the run was on Sunday — the week before.
    await updateSession('running', run.id, { date: '2025-03-30' });
    const moved = await runsRepository.get(run.id);
    expect(moved?.date).toBe('2025-03-30');
    expect(moved?.weekKey).toBe('2025-W13');
    // It now counts for last week, not this one.
    expect((await loadDay())?.training.find((entry) => entry.domain === 'running')?.progress.completed).toBe(0);
  });

  it('refuses to move a run further back than yesterday', async () => {
    await setup('2025-03-27', 2);
    const run = await logSession('running', TODAY);
    await expect(updateSession('running', run.id, { date: '2025-03-29' })).rejects.toThrow(EditWindowError);
    expect((await runsRepository.get(run.id))?.date).toBe(TODAY);
  });

  it('lets yesterday be changed today, and refuses it once its window has passed', async () => {
    await setup('2025-03-27');
    freezeAt('2025-03-30');
    const session = await logSession('gym', '2025-03-30');

    // Monday: Sunday is yesterday, still writable although its week is over.
    freezeAt(TODAY);
    await updateSession('gym', session.id, { note: 'am Sonntag' });
    expect((await gymSessionsRepository.get(session.id))?.note).toBe('am Sonntag');

    // Tuesday: it can no longer be written.
    freezeAt('2025-04-01');
    await expect(deleteSession('gym', session.id)).rejects.toThrow(EditWindowError);
    await expect(updateSession('gym', session.id, { note: 'zu spät' })).rejects.toThrow(EditWindowError);
    expect(await gymSessionsRepository.get(session.id)).toBeDefined();
  });

  it('refuses to log a session older than yesterday', async () => {
    await setup('2025-03-27');
    await expect(logSession('gym', '2025-03-29')).rejects.toThrow(EditWindowError);
  });

  it('refuses to backfill a day on which the domain was not enabled (STOP 3a, question 10)', async () => {
    await setup('2025-03-27');
    // Running is switched on today; yesterday it did not exist.
    await applyOnboarding({ questions: [], gymTargetPerWeek: 3, runningTargetPerWeek: 2 });
    await expect(logSession('running', '2025-03-30')).rejects.toThrow(InvalidAnswerError);
    await logSession('running', TODAY);
  });

  it('refuses to log when sports is not enabled', async () => {
    await applyOnboarding({ questions: [], gymTargetPerWeek: null });
    await expect(logSession('gym', TODAY)).rejects.toThrow(InvalidAnswerError);
  });

  it('meets the target and does not overcount beyond it', async () => {
    await setup();
    for (let i = 0; i < 4; i += 1) await logSession('gym', TODAY);
    const day = await loadDay();
    expect(day.training[0]?.progress.met).toBe(true);
    expect(day.training[0]?.progress.exceeded).toBe(true);
    expect(day.training[0]?.progress.score).toBe(100);
  });
});
