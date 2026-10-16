import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { closeDatabase, deleteDatabase } from '../db';
import { configSnapshotsRepository } from '../repositories';
import {
  addQuestion,
  applyOnboarding,
  archiveQuestion,
  setWeeklyTarget,
} from './configurationService';
import { logSession, saveAnswer } from './checkInService';
import { loadHistory } from './historyService';

/**
 * The weekly-quota domain these suites exercise is Gym.
 *
 * RC2 had one generic Sport domain; iteration 2 has two independent ones, and
 * the rules under test here — the target, the week window, what a met week is
 * worth — belong to any weekly quota rather than to a particular sport. Gym
 * stands in for all of them.
 */
const setGymTarget = (target: number) => setWeeklyTarget('gym', target);


function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

beforeEach(async () => {
  await deleteDatabase();
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

/** Index of a date within a history range starting at `from`. */
function at(history: { days: { date: string }[] }, date: string): number {
  return history.days.findIndex((day) => day.date === date);
}

describe('reconstructing past days', () => {
  it('scores a closed day from the answers it actually has', async () => {
    freezeAt('2025-03-03');
    await applyOnboarding({
      questions: [
        { text: 'A', type: 'boolean', category: 'eigene' },
        { text: 'B', type: 'scale', category: 'eigene' },
      ],
      gymTargetPerWeek: null,
    });
    const questions = (await loadHistory('2025-03-03', '2025-03-03')).questions;
    // The drill-down follows the order the questions appear in Areas.
    expect(questions.map((question) => question.text)).toEqual(['A', 'B']);
    await saveAnswer('2025-03-03', questions[0]!.id, true);
    await saveAnswer('2025-03-03', questions[1]!.id, 6);

    freezeAt('2025-03-10');
    const history = await loadHistory('2025-03-03', '2025-03-03');
    expect(history.days[0]?.status).toBe('scored');
    expect(history.overall[0]).toBe(80); // (100 + 60) / 2
  });

  it('counts an unanswered closed day as missed, and an open one as neither', async () => {
    freezeAt('2025-03-03');
    await applyOnboarding({ questions: [{ text: 'A', type: 'boolean', category: 'eigene' }], gymTargetPerWeek: null });

    // On 8 March the window covers the 7th and the 8th (P8, D132); the 6th
    // has closed.
    freezeAt('2025-03-08');
    const history = await loadHistory('2025-03-03', '2025-03-08');
    expect(history.days[at(history, '2025-03-07')]?.status).toBe('open');
    expect(history.overall[at(history, '2025-03-07')]).toBeNull();
    expect(history.days[at(history, '2025-03-06')]?.status).toBe('scored');
    expect(history.overall[at(history, '2025-03-06')]).toBe(0);
  });

  it('closes a day lived before P8 by its own three-day window (D132)', async () => {
    freezeAt('2025-03-03');
    await applyOnboarding({ questions: [{ text: 'A', type: 'boolean', category: 'eigene' }], gymTargetPerWeek: null });
    // The profile was set up by a build before P8: its snapshot has neither
    // the one-day window nor the P8 marker.
    const [snapshot] = await configSnapshotsRepository.list();
    const { sessionWindowDays: _marker, ...scoring } = snapshot!.config.scoring;
    await configSnapshotsRepository.replaceAll([
      { ...snapshot!, config: { ...snapshot!.config, scoring: { ...scoring, editWindowDays: 3 } } },
    ]);

    freezeAt('2025-03-08');
    const history = await loadHistory('2025-03-03', '2025-03-08');
    expect(history.days[at(history, '2025-03-05')]?.status).toBe('open');
    expect(history.days[at(history, '2025-03-04')]?.status).toBe('scored');
  });

  it('leaves days before the app was ever configured neutral', async () => {
    freezeAt('2025-03-10');
    await applyOnboarding({ questions: [{ text: 'A', type: 'boolean', category: 'eigene' }], gymTargetPerWeek: null });
    freezeAt('2025-03-20');
    const history = await loadHistory('2025-03-01', '2025-03-20');

    // Nothing was due before onboarding, so those days are neutral. Scoring
    // them as missed would fill a new user's first history with red.
    for (const date of ['2025-03-01', '2025-03-05', '2025-03-09']) {
      expect(history.days[at(history, date)]?.status).toBe('neutral');
      expect(history.overall[at(history, date)]).toBeNull();
    }
    // From the day it was configured, the rule applies again.
    expect(history.days[at(history, '2025-03-10')]?.status).toBe('scored');
  });

  it('shows a brand-new profile as empty rather than as a wall of zeros', async () => {
    freezeAt('2025-03-20');
    await applyOnboarding({ questions: [{ text: 'A', type: 'boolean', category: 'eigene' }], gymTargetPerWeek: 3 });
    const history = await loadHistory('2025-02-19', '2025-03-20');
    const scored = history.overall.filter((value) => value !== null);
    // Only today, which is still open, so nothing is scored at all yet.
    expect(scored).toHaveLength(0);
    expect(history.empty).toBe(true);
  });
});

describe('configuration history is respected', () => {
  it('judges each week against the sports target in force then', async () => {
    // Week of 3 March: target 2, one session logged.
    freezeAt('2025-03-03');
    await applyOnboarding({ questions: [], gymTargetPerWeek: 2 });
    await logSession('gym', '2025-03-03');

    // Week of 10 March: target raised to 4, one session logged.
    freezeAt('2025-03-10');
    await setGymTarget(4);
    await logSession('gym', '2025-03-10');

    freezeAt('2025-03-24');
    const history = await loadHistory('2025-03-03', '2025-03-16');
    // The earlier week is still judged against 2, not against 4.
    expect(history.gym[at(history, '2025-03-03')]).toBe(50);
    expect(history.gym[at(history, '2025-03-10')]).toBe(25);
  });

  it('keeps counting a question for the days it was actually asked', async () => {
    freezeAt('2025-03-03');
    await applyOnboarding({ questions: [{ text: 'A', type: 'boolean', category: 'eigene' }], gymTargetPerWeek: null });
    const first = (await loadHistory('2025-03-03', '2025-03-03')).questions[0]!;
    await saveAnswer('2025-03-03', first.id, true);

    // Archived on 5 March: asked on the 3rd and 4th, not afterwards.
    freezeAt('2025-03-05');
    await archiveQuestion(first.id);

    freezeAt('2025-03-20');
    const history = await loadHistory('2025-03-03', '2025-03-08');
    const row = history.questions.find((question) => question.id === first.id)!;
    expect(row.scores[at(history, '2025-03-03')]).toBe(100);
    expect(row.scores[at(history, '2025-03-04')]).toBe(0); // due, unanswered, closed
    // From the day it was archived it is simply absent, not a zero.
    expect(row.scores[at(history, '2025-03-05')]).toBeNull();
    expect(row.scores[at(history, '2025-03-08')]).toBeNull();
    // And the day it stopped being asked has nothing due at all.
    expect(history.days[at(history, '2025-03-06')]?.status).toBe('neutral');
  });

  it('shows a question as absent before it was created', async () => {
    freezeAt('2025-03-03');
    await applyOnboarding({ questions: [{ text: 'A', type: 'boolean', category: 'eigene' }], gymTargetPerWeek: null });

    freezeAt('2025-03-06');
    const added = await addQuestion({ text: 'B', type: 'boolean', category: 'eigene' });

    freezeAt('2025-03-20');
    const history = await loadHistory('2025-03-03', '2025-03-08');
    const row = history.questions.find((question) => question.id === added.id)!;
    expect(row.scores[at(history, '2025-03-03')]).toBeNull();
    expect(row.scores[at(history, '2025-03-06')]).toBe(0);
  });
});

describe('the shape handed to the Progress screen', () => {
  it('aligns every series with the day list', async () => {
    freezeAt('2025-03-03');
    await applyOnboarding({ questions: [{ text: 'A', type: 'boolean', category: 'eigene' }], gymTargetPerWeek: 2 });
    freezeAt('2025-03-20');
    const history = await loadHistory('2025-03-01', '2025-03-20');
    expect(history.days).toHaveLength(20);
    expect(history.overall).toHaveLength(20);
    expect(history.mental).toHaveLength(20);
    expect(history.sports).toHaveLength(20);
    for (const question of history.questions) {
      expect(question.scores).toHaveLength(20);
    }
  });

  it('reports an empty range rather than a grid of zeros', async () => {
    freezeAt('2025-03-20');
    await applyOnboarding({ questions: [], gymTargetPerWeek: null });
    const history = await loadHistory('2025-03-01', '2025-03-20');
    expect(history.empty).toBe(true);
    expect(history.overall.every((value) => value === null)).toBe(true);
    expect(history.questions).toEqual([]);
  });

  it('reports which days had anything recorded at all', async () => {
    freezeAt('2025-03-03');
    await applyOnboarding({ questions: [{ text: 'A', type: 'boolean', category: 'eigene' }], gymTargetPerWeek: null });
    const question = (await loadHistory('2025-03-03', '2025-03-03')).questions[0]!;
    await saveAnswer('2025-03-03', question.id, true);

    freezeAt('2025-03-20');
    const history = await loadHistory('2025-03-01', '2025-03-08');
    expect(history.activity[at(history, '2025-03-03')]).toBe(true);
    // Missed days score zero, which reads as data — activity says otherwise.
    expect(history.activity[at(history, '2025-03-04')]).toBe(false);
    expect(history.overall[at(history, '2025-03-04')]).toBe(0);
  });

  it('returns nothing for an inverted range', async () => {
    freezeAt('2025-03-20');
    const history = await loadHistory('2025-03-20', '2025-03-01');
    expect(history.days).toEqual([]);
    expect(history.empty).toBe(true);
  });
});
