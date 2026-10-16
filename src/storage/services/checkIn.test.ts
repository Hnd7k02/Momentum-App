import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { snapshotOn } from '../../core/config/closure';
import { closeDatabase, deleteDatabase } from '../db';
import { ensureSessionWindowEra } from '../configService';
import { answersRepository, configSnapshotsRepository, gymSessionsRepository, runsRepository } from '../repositories';
import {
  addQuestion,
  applyOnboarding,
  archiveQuestion,
  disableDomainType,
  enableDomain,
  pauseQuestion,
  updateQuestion,
} from './configurationService';
import {
  EditWindowError,
  InvalidAnswerError,
  clearAnswer,
  deleteSession,
  loadDay,
  logSession,
  saveAdherence,
  saveAnswer,
  updateSession,
  yesterdayOutstanding,
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

/** The snapshot in force on `date`, as stored. */
async function snapshotOnFor(date: string) {
  return snapshotOn(await configSnapshotsRepository.list(), date);
}

/**
 * Strips the P8 marker from every stored snapshot, as a profile set up by a
 * build before P8 has them, and appends the P8 era from `from` — what the
 * first load after the update does on that day.
 */
async function updatedOn(from: string): Promise<void> {
  const legacy = (await configSnapshotsRepository.list()).map((snapshot) => {
    const { sessionWindowDays: _marker, ...scoring } = snapshot.config.scoring;
    return { ...snapshot, config: { ...snapshot.config, scoring: { ...scoring, editWindowDays: 3 } } };
  });
  await configSnapshotsRepository.replaceAll(legacy);
  expect(await ensureSessionWindowEra(from)).toBe('appended');
}

describe('the day view under one day back (D133, D138)', () => {
  it('offers today and yesterday for a session, and nothing older', async () => {
    await setup('2025-03-20', 2);
    const day = await loadDay(TODAY);
    for (const training of day.training) {
      expect(training.writableDays, training.domain).toEqual(['2025-03-30', TODAY]);
    }
    // The same answer from yesterday's side: the days do not depend on the day on show.
    const yesterday = await loadDay('2025-03-30');
    expect(yesterday.training.map((entry) => entry.writableDays)).toEqual([
      ['2025-03-30', TODAY],
      ['2025-03-30', TODAY],
    ]);
  });

  it("shows yesterday's week on the Monday, with Sunday's run in it", async () => {
    await setup('2025-03-20', 2);
    await logSession('running', '2025-03-30');
    const yesterday = await loadDay('2025-03-30');
    const running = yesterday.training.find((entry) => entry.domain === 'running')!;
    expect(running.weekKey).toBe('2025-W13');
    expect(running.sessionsToday.map((session) => session.date)).toEqual(['2025-03-30']);
    // Today's own week does not hold it.
    const today = (await loadDay(TODAY)).training.find((entry) => entry.domain === 'running')!;
    expect(today.sessions).toEqual([]);
  });

  it('leaves yesterday read-only on the update day', async () => {
    const { boolQuestion } = await setup('2025-03-20', 2);
    await updatedOn(TODAY);
    const yesterday = await loadDay('2025-03-30');
    expect(yesterday.editable).toBe(false);
    expect(yesterday.editState).toBe('closed');
    for (const training of yesterday.training) expect(training.writableDays).toEqual([TODAY]);
    await expect(saveAnswer('2025-03-30', boolQuestion.id, true)).rejects.toThrow(EditWindowError);
    await expect(logSession('running', '2025-03-30')).rejects.toThrow(EditWindowError);
    expect(await yesterdayOutstanding(TODAY)).toBe(false);
  });

  it("keeps a Sunday's check-in open on the Monday after a mid-week update, and its week closed", async () => {
    // The week of 24 March began before the update (Saturday 29th), so it
    // closed at Sunday midnight under the rules it was lived by.
    const { boolQuestion } = await setup('2025-03-20', 2);
    await updatedOn('2025-03-29');
    const sunday = await loadDay('2025-03-30');
    expect(sunday.editable).toBe(true);
    for (const training of sunday.training) expect(training.writableDays).toEqual([TODAY]);
    await saveAnswer('2025-03-30', boolQuestion.id, true);
    await expect(logSession('running', '2025-03-30')).rejects.toThrow(EditWindowError);
  });

  it("shows yesterday the questions it asked, not today's", async () => {
    const { boolQuestion, scaleQuestion } = await setup('2025-03-20');
    await archiveQuestion(scaleQuestion.id);
    await addQuestion({ text: 'Neu seit heute', type: 'boolean', category: 'eigene' });

    const today = await loadDay(TODAY);
    expect(today.mental?.items.map((item) => item.question.text)).toEqual([
      'Hast du dein Bett gemacht?',
      'Neu seit heute',
    ]);
    // Yesterday still asked the archived one and never asked the new one.
    const yesterday = await loadDay('2025-03-30');
    expect(yesterday.mental?.items.map((item) => item.question.id)).toEqual([boolQuestion.id, scaleQuestion.id]);
    await saveAnswer('2025-03-30', scaleQuestion.id, 7);
    expect((await loadDay('2025-03-30')).mental?.answeredCount).toBe(1);
  });

  it('leaves a domain out of a day it was not enabled on', async () => {
    await setup('2025-03-20');
    await enableDomain('running', 2);
    const today = await loadDay(TODAY);
    expect(today.training.map((entry) => entry.domain)).toEqual(['gym', 'running']);
    expect(today.training[1]?.writableDays).toEqual([TODAY]);
    const yesterday = await loadDay('2025-03-30');
    expect(yesterday.training.map((entry) => entry.domain)).toEqual(['gym']);
  });

  it('says whether yesterday still owes an answer that can be given', async () => {
    const { boolQuestion, scaleQuestion } = await setup('2025-03-20');
    expect(await yesterdayOutstanding(TODAY)).toBe(true);
    await saveAnswer('2025-03-30', boolQuestion.id, true);
    expect(await yesterdayOutstanding(TODAY)).toBe(true);
    await saveAnswer('2025-03-30', scaleQuestion.id, 6);
    expect(await yesterdayOutstanding(TODAY)).toBe(false);
    // Today's own answers are not yesterday's business.
    expect((await loadDay(TODAY)).mental?.answeredCount).toBe(0);
  });

  it('owes nothing for a yesterday before the app was set up, and shows nothing for it', async () => {
    await setup();
    expect(await yesterdayOutstanding(TODAY)).toBe(false);
    const yesterday = await loadDay('2025-03-30');
    expect(yesterday.mental).toBeNull();
    expect(yesterday.training).toEqual([]);
    expect(yesterday.editable).toBe(false);
    expect(yesterday.empty).toBe(true);
  });
});

describe('a past day as it was asked (D133, review of Stage 3b)', () => {
  it("answers yesterday's question with yesterday's type, and refuses one it did not ask", async () => {
    const { boolQuestion, scaleQuestion } = await setup('2025-03-20');
    // Both types swapped this morning, and a question added.
    await updateQuestion(boolQuestion.id, { type: 'scale' });
    await updateQuestion(scaleQuestion.id, { type: 'boolean' });
    const added = await addQuestion({ text: 'Neu', type: 'boolean', category: 'eigene' });

    const yesterday = await loadDay('2025-03-30');
    expect(yesterday.mental?.items.map((item) => [item.question.id, item.question.type])).toEqual([
      [boolQuestion.id, 'boolean'],
      [scaleQuestion.id, 'scale'],
    ]);
    await saveAnswer('2025-03-30', boolQuestion.id, true);
    await expect(saveAnswer('2025-03-30', scaleQuestion.id, false)).rejects.toThrow(InvalidAnswerError);
    await saveAnswer('2025-03-30', scaleQuestion.id, 6);
    expect((await answersRepository.get('2025-03-30', scaleQuestion.id))?.valueType).toBe('scale');
    await expect(saveAnswer('2025-03-30', added.id, true)).rejects.toThrow(InvalidAnswerError);
    // Today asks the new types.
    await saveAnswer(TODAY, boolQuestion.id, 7);
    expect((await answersRepository.get(TODAY, boolQuestion.id))?.valueType).toBe('scale');
  });

  it('shows yesterday the domains switched off this morning, and takes their backfill', async () => {
    await setup('2025-03-20', 2);
    // Food on since Saturday, so yesterday had it too.
    freezeAt('2025-03-29');
    await enableDomain('food');
    freezeAt(TODAY);
    await disableDomainType('mental');
    await disableDomainType('running');
    await disableDomainType('food');

    const yesterday = await loadDay('2025-03-30');
    expect(yesterday.mental?.items).toHaveLength(2);
    expect(yesterday.food).not.toBeNull();
    expect(yesterday.training.map((entry) => entry.domain)).toEqual(['gym', 'running']);
    expect(yesterday.training[1]?.progress.target).toBe(2);
    expect(yesterday.training[1]?.writableDays).toEqual(['2025-03-30']);
    expect(await yesterdayOutstanding(TODAY)).toBe(true);
    await logSession('running', '2025-03-30');
    expect(await runsRepository.getAll()).toHaveLength(1);
    await saveAdherence('2025-03-30', 6);
    // Today has none of them.
    const today = await loadDay(TODAY);
    expect(today.mental).toBeNull();
    expect(today.food).toBeNull();
    expect(today.training.map((entry) => entry.domain)).toEqual(['gym']);
    await expect(logSession('running', TODAY)).rejects.toThrow();
  });

  it('refuses an answer or a Food rating for a yesterday on which its domain was off (Q10)', async () => {
    freezeAt('2025-03-20');
    await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
    freezeAt(TODAY);
    const question = await addQuestion({ text: 'Neu', type: 'boolean', category: 'eigene' });
    await enableDomain('food');
    await expect(saveAnswer('2025-03-30', question.id, true)).rejects.toThrow(/mental was not enabled/);
    await expect(saveAdherence('2025-03-30', 7)).rejects.toThrow(/food was not enabled/);
    await saveAnswer(TODAY, question.id, true);
    await saveAdherence(TODAY, 7);
  });

  it("points to a yesterday that owes only its Food rating", async () => {
    const { boolQuestion, scaleQuestion } = await setup('2025-03-20');
    freezeAt('2025-03-20');
    await enableDomain('food');
    freezeAt(TODAY);
    await saveAnswer('2025-03-30', boolQuestion.id, true);
    await saveAnswer('2025-03-30', scaleQuestion.id, 6);
    expect(await yesterdayOutstanding(TODAY)).toBe(true);
    await saveAdherence('2025-03-30', 8);
    expect(await yesterdayOutstanding(TODAY)).toBe(false);
  });
});

describe('the P8 era append (D132)', () => {
  it('appends once and then stays put', async () => {
    await setup('2025-03-20');
    await updatedOn(TODAY);
    expect(await ensureSessionWindowEra(TODAY)).toBe('unchanged');
    expect(await ensureSessionWindowEra('2025-04-01')).toBe('unchanged');
  });

  it('never leaves today locked after a clock that was ahead', async () => {
    const { boolQuestion } = await setup('2025-03-20');
    // The first load after the update ran with the clock four days ahead…
    freezeAt('2025-04-04');
    await updatedOn('2025-04-04');
    // …and the clock was put right.
    freezeAt(TODAY);
    expect(await ensureSessionWindowEra(TODAY)).toBe('appended');
    expect((await loadDay(TODAY)).editable).toBe(true);
    await saveAnswer(TODAY, boolQuestion.id, true);
    await logSession('gym', TODAY);
  });

  it('marks a snapshot dated after today too', async () => {
    await setup('2025-03-20');
    const [first] = await configSnapshotsRepository.list();
    const { sessionWindowDays: _marker, ...scoring } = first!.config.scoring;
    const legacy = { ...first!.config, scoring: { ...scoring, editWindowDays: 3 } };
    await configSnapshotsRepository.replaceAll([
      { ...first!, config: legacy },
      { ...first!, id: 'cfg_later', effectiveFrom: '2025-04-05', config: legacy },
    ]);
    expect(await ensureSessionWindowEra(TODAY)).toBe('appended');
    const later = (await configSnapshotsRepository.list()).find((snapshot) => snapshot.effectiveFrom === '2025-04-05');
    expect(later?.config.scoring.sessionWindowDays).toBe(1);
  });

  it('keeps a boundary written before now when the local date has moved back', async () => {
    // The era was appended on the first of April, at an instant already past —
    // then the local date moved back to the 31st (a journey west). The 31st
    // was lived under the old rules and stays so; today waits for the boundary.
    await setup('2025-03-20');
    const [first] = await configSnapshotsRepository.list();
    const { sessionWindowDays: _marker, ...scoring } = first!.config.scoring;
    const legacy = { ...first!.config, scoring: { ...scoring, editWindowDays: 3 } };
    await configSnapshotsRepository.replaceAll([
      { ...first!, config: legacy },
      {
        ...first!,
        id: 'cfg_p8',
        effectiveFrom: '2025-04-01',
        createdAt: '2025-03-31T05:00:00.000Z',
        config: { ...legacy, scoring: { ...legacy.scoring, editWindowDays: 1, sessionWindowDays: 1 } },
      },
    ]);
    expect(await ensureSessionWindowEra(TODAY)).toBe('unchanged');
    expect((await configSnapshotsRepository.list()).map((snapshot) => snapshot.effectiveFrom)).toEqual([
      '2025-03-20',
      '2025-04-01',
    ]);
  });

  it('leaves a profile set up with the clock ahead to begin on its first day', async () => {
    // Moving its configuration back would put days before its first day, and
    // its promotion boundary, into its history. Until then nothing is due.
    freezeAt('2025-04-03');
    await applyOnboarding({ questions: [{ text: 'A', type: 'boolean', category: 'eigene' }], gymTargetPerWeek: 3 });
    freezeAt(TODAY);
    expect(await ensureSessionWindowEra(TODAY)).toBe('unchanged');
    expect((await loadDay(TODAY)).editable).toBe(false);
  });

  it('measures drift against the snapshot in force today, and carries a change into a later one', async () => {
    const { boolQuestion } = await setup('2025-03-20');
    const [first] = await configSnapshotsRepository.list();
    await configSnapshotsRepository.replaceAll([first!, { ...first!, id: 'cfg_later', effectiveFrom: '2025-04-05' }]);
    const added = await addQuestion({ text: 'Neu', type: 'boolean', category: 'eigene' });
    const asked = (date: string) =>
      snapshotOnFor(date).then((config) => config?.questions.some((question) => question.id === added.id));
    expect(await asked(TODAY)).toBe(true);
    expect(await asked('2025-04-05')).toBe(true);
    await saveAnswer(TODAY, boolQuestion.id, true);
  });

  it("repairs today's snapshot with the answer, when it lags behind the questions", async () => {
    await setup('2025-03-20');
    const added = await addQuestion({ text: 'Neu', type: 'boolean', category: 'eigene' });
    // Today's snapshot as if the append after adding the question never landed.
    const snapshots = await configSnapshotsRepository.list();
    await configSnapshotsRepository.replaceAll(
      snapshots.map((snapshot) => ({
        ...snapshot,
        config: { ...snapshot.config, questions: snapshot.config.questions.filter((question) => question.id !== added.id) },
      })),
    );
    expect((await loadDay(TODAY)).mental?.items.map((item) => item.question.id)).toContain(added.id);
    await saveAnswer(TODAY, added.id, true);
    expect((await answersRepository.get(TODAY, added.id))?.value).toBe(true);
    expect((await snapshotOnFor(TODAY))?.questions.some((question) => question.id === added.id)).toBe(true);
  });

  it('never takes a new session into the retired Sport log', async () => {
    await setup('2025-03-20');
    await expect(logSession('sports', TODAY)).rejects.toThrow(/retired Sport log/);
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

  it('deletes a session while its day can still be written', async () => {
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
