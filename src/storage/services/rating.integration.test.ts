import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { RATING } from '../../core/config/constants';
import { addDays } from '../../core/dates';
import { closeDatabase, deleteDatabase } from '../db';
import { questionsRepository } from '../repositories';
import {
  addQuestion,
  applyOnboarding,
  archiveQuestion,
  setWeeklyTarget,
} from './configurationService';
import { logSession, saveAnswer } from './checkInService';
import { loadHistory } from './historyService';
import { loadProgression } from './ratingService';

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

const ORIGIN = '2025-01-06'; // a Monday

beforeEach(async () => {
  await deleteDatabase();
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

/** Answers every active question well for `count` days from `from`. */
async function recordGoodDays(count: number, from = ORIGIN) {
  const questions = await questionsRepository.listActive();
  for (let index = 0; index < count; index += 1) {
    const date = addDays(from, index);
    freezeAt(date);
    for (const question of questions) {
      await saveAnswer(date, question.id, question.type === 'scale' ? 9 : true);
    }
  }
}

describe('a rating derived from history', () => {
  it('starts new users at the specified value', async () => {
    freezeAt(ORIGIN);
    await applyOnboarding({
      questions: [{ text: 'A', type: 'boolean', category: 'eigene' }],
      gymTargetPerWeek: null,
    });
    const progression = await loadProgression();
    expect(progression.current).toBe(RATING.START);
    expect(progression.rank.id).toBe('challenger');
    expect(progression.peakRank.id).toBe('challenger');
  });

  it('rises with sustained good days and drives the rank', async () => {
    freezeAt(ORIGIN);
    await applyOnboarding({
      questions: [{ text: 'A', type: 'boolean', category: 'eigene' }],
      gymTargetPerWeek: null,
    });
    await recordGoodDays(40);

    freezeAt(addDays(ORIGIN, 45));
    const progression = await loadProgression();
    expect(progression.current).toBeGreaterThan(RATING.START);
    expect(progression.rank.index).toBeGreaterThan(1);
    expect(progression.peak).toBeGreaterThanOrEqual(progression.current);
    expect(progression.checkInStreak.best).toBeGreaterThanOrEqual(30);
  });
});

describe('historical integrity', () => {
  /**
   * The requirement: a rating shown for a past date must come from the
   * history that was valid then, and must not move because of a later
   * configuration change.
   */
  async function ratingsAfter(setup: () => Promise<void>) {
    freezeAt(ORIGIN);
    await applyOnboarding({
      questions: [{ text: 'A', type: 'boolean', category: 'eigene' }],
      gymTargetPerWeek: 2,
    });
    await recordGoodDays(20);
    // Logged the next day, as P8 allows (D133).
    freezeAt(addDays(ORIGIN, 23));
    await logSession('gym', addDays(ORIGIN, 22));

    freezeAt(addDays(ORIGIN, 30));
    const before = await loadProgression();

    await setup();

    freezeAt(addDays(ORIGIN, 30));
    const after = await loadProgression();
    return { before, after };
  }

  function pastPoints(progression: Awaited<ReturnType<typeof loadProgression>>) {
    // Everything up to and including the twentieth day — all closed, all past.
    const cutoff = addDays(ORIGIN, 20);
    return progression.points
      .filter((point) => point.date <= cutoff)
      .map((point) => [point.date, Math.round(point.rating * 1e6) / 1e6]);
  }

  it('does not move when a new question is added today', async () => {
    const { before, after } = await ratingsAfter(async () => {
      freezeAt(addDays(ORIGIN, 30));
      await addQuestion({ text: 'Neu', type: 'scale', category: 'eigene' });
    });
    expect(pastPoints(after)).toEqual(pastPoints(before));
  });

  it('does not move when a question is archived today', async () => {
    const { before, after } = await ratingsAfter(async () => {
      freezeAt(addDays(ORIGIN, 30));
      const history = await loadHistory(ORIGIN, addDays(ORIGIN, 30));
      await archiveQuestion(history.questions[0]!.id);
    });
    expect(pastPoints(after)).toEqual(pastPoints(before));
  });

  it('does not move when the sports target changes today', async () => {
    const { before, after } = await ratingsAfter(async () => {
      freezeAt(addDays(ORIGIN, 30));
      await setGymTarget(6);
    });
    expect(pastPoints(after)).toEqual(pastPoints(before));
  });

  it('gives the same answer every time it is replayed', async () => {
    freezeAt(ORIGIN);
    await applyOnboarding({
      questions: [{ text: 'A', type: 'boolean', category: 'eigene' }],
      gymTargetPerWeek: 2,
    });
    await recordGoodDays(15);
    freezeAt(addDays(ORIGIN, 20));

    const first = await loadProgression();
    const second = await loadProgression();
    expect(second.points.map((point) => point.rating)).toEqual(
      first.points.map((point) => point.rating),
    );
    expect(second.lifetimeXp).toBe(first.lifetimeXp);
    expect(second.peak).toBe(first.peak);
  });

  it('keeps earlier days identical as the history grows past them', async () => {
    freezeAt(ORIGIN);
    await applyOnboarding({
      questions: [{ text: 'A', type: 'boolean', category: 'eigene' }],
      gymTargetPerWeek: null,
    });
    await recordGoodDays(10);

    freezeAt(addDays(ORIGIN, 12));
    const early = await loadProgression();

    await recordGoodDays(10, addDays(ORIGIN, 13));
    freezeAt(addDays(ORIGIN, 30));
    const later = await loadProgression();

    const cutoff = addDays(ORIGIN, 8);
    const earlyPast = early.points.filter((point) => point.date <= cutoff);
    const laterPast = later.points.filter((point) => point.date <= cutoff);
    expect(laterPast.map((point) => point.rating)).toEqual(
      earlyPast.map((point) => point.rating),
    );
  });
});

describe('peak and lifetime totals never decrease', () => {
  it('keeps the peak rank after the rating falls back', async () => {
    freezeAt(ORIGIN);
    await applyOnboarding({
      questions: [{ text: 'A', type: 'boolean', category: 'eigene' }],
      gymTargetPerWeek: null,
    });
    await recordGoodDays(60);

    const atBest = await (async () => {
      freezeAt(addDays(ORIGIN, 62));
      return loadProgression();
    })();

    // Four months of nothing at all.
    freezeAt(addDays(ORIGIN, 180));
    const afterAbsence = await loadProgression();

    expect(afterAbsence.current).toBeLessThan(atBest.current);
    expect(afterAbsence.peak).toBeGreaterThanOrEqual(atBest.peak);
    expect(afterAbsence.peakRank.index).toBeGreaterThanOrEqual(atBest.rank.index);
    expect(afterAbsence.lifetimeXp).toBeGreaterThanOrEqual(atBest.lifetimeXp);
  });

  it('never loses the best streak once the current one breaks', async () => {
    freezeAt(ORIGIN);
    await applyOnboarding({
      questions: [{ text: 'A', type: 'boolean', category: 'eigene' }],
      gymTargetPerWeek: null,
    });
    await recordGoodDays(12);

    freezeAt(addDays(ORIGIN, 40));
    const progression = await loadProgression();
    expect(progression.checkInStreak.current).toBe(0);
    expect(progression.checkInStreak.best).toBeGreaterThanOrEqual(12);
  });
});
