import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { addDays } from '../../core/dates';
import { closeDatabase, deleteDatabase } from '../db';
import { foodDaysRepository } from '../repositories';
import { applyOnboarding, disableDomainType, enableDomain, loadConfiguration } from './configurationService';
import { enableLegacyFood, logLegacyFoodEntry, rateLegacyFood } from './fixtures/legacyFood';
import { loadHistory } from './historyService';

/**
 * Food-era days, replayed (D106–D111, D139).
 *
 * Food left the product in WP3 Stage 4: nothing rates a day and nothing logs
 * a meal any more. What stays true is how the days it was switched on
 * replay — a rating reads back as the number the user entered, a day before
 * Food existed is never a missed one, and nothing logged ever reached the
 * score. The history is seeded the way the old build left it on disk
 * (`fixtures/legacyFood.ts`); the switch-off itself is pinned in
 * `foodRetirement.test.ts`.
 */

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

/** A Monday. */
const START = '2026-02-02';

beforeEach(async () => {
  await deleteDatabase();
  freezeAt(START);
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

/** A device that had Food switched on from `from`. */
async function legacyFoodFrom(from = START) {
  await applyOnboarding({ questions: [] });
  freezeAt(from);
  await enableLegacyFood(from);
}

const foodScoreOn = (history: Awaited<ReturnType<typeof loadHistory>>, date: string) => {
  const index = history.days.findIndex((day) => day.date === date);
  return index < 0
    ? undefined
    : history.days[index]!.domains.find((entry) => entry.domain === 'food');
};

/* ── Historical continuity ──────────────────────────────────────────────── */

describe('a rating stays readable as what the user entered', () => {
  it('reads back unchanged after the switch-off and a year of other changes', async () => {
    await legacyFoodFrom();
    const values = [2, 5, 9, 10, 1];
    for (const [index, value] of values.entries()) {
      await rateLegacyFood(addDays(START, index), value);
    }

    // The update switches Food off; then everything else a user could
    // plausibly change afterwards.
    freezeAt(addDays(START, 200));
    await loadConfiguration();
    await enableDomain('gym', 3);

    freezeAt(addDays(START, 365));
    for (const [index, value] of values.entries()) {
      const record = await foodDaysRepository.get(addDays(START, index));
      expect(record?.adherence).toBe(value);
    }

    // And the replayed day score is still exactly that value times ten.
    const history = await loadHistory(START, addDays(START, 365), addDays(START, 365));
    for (const [index, value] of values.entries()) {
      expect(foodScoreOn(history, addDays(START, index))?.score).toBe(value * 10);
    }
  });
});

/* ── The era: a day before Food is not a missed food day ────────────────── */

describe('the day Food was switched on', () => {
  it('leaves every earlier day alone', async () => {
    await applyOnboarding({
      questions: [{ text: 'A', type: 'boolean', category: 'eigene' }],
    });
    const switchOn = addDays(START, 30);
    const reference = addDays(START, 60);

    freezeAt(switchOn);
    await enableLegacyFood(switchOn);
    await rateLegacyFood(switchOn, 8);

    freezeAt(reference);
    const history = await loadHistory(START, reference, reference);

    // Before: no food entry at all — the day was never asked.
    expect(foodScoreOn(history, START)).toBeUndefined();
    expect(foodScoreOn(history, addDays(switchOn, -1))).toBeUndefined();
    // From the day it was switched on: due, and rated.
    expect(foodScoreOn(history, switchOn)?.score).toBe(80);
    // A later day nobody rated: due, missed, and that is a real result.
    expect(foodScoreOn(history, addDays(switchOn, 5))).toEqual({
      domain: 'food',
      score: 0,
      itemsDue: 1,
      itemsAnswered: 0,
    });
  });

  it('does not score days after Food was switched off again', async () => {
    await legacyFoodFrom();
    await rateLegacyFood(START, 6);

    const off = addDays(START, 10);
    freezeAt(off);
    await disableDomainType('food');

    const reference = addDays(START, 20);
    freezeAt(reference);
    const history = await loadHistory(START, reference, reference);
    expect(foodScoreOn(history, START)?.score).toBe(60);
    expect(foodScoreOn(history, addDays(off, 5))).toBeUndefined();
  });
});

/* ── The log, which was shown and never scored ──────────────────────────── */

describe('what was logged', () => {
  it('never reached the score of a rated day', async () => {
    await legacyFoodFrom();
    await logLegacyFoodEntry(START, {
      foodId: 'food_oats',
      label: 'Haferflocken',
      grams: 60,
      kcal: 223,
      proteinG: 8,
      carbsG: 35,
      fatG: 4,
    });
    await logLegacyFoodEntry(START, { label: 'Kaffee', kcal: 5 });
    await rateLegacyFood(START, 6);

    const history = await loadHistory(START, START, START);
    // Six, not something derived from 228 kcal.
    expect(foodScoreOn(history, START)?.score).toBe(60);
  });

  it('never rated a day by itself', async () => {
    await legacyFoodFrom();
    await logLegacyFoodEntry(START, { label: 'Znüni', kcal: 300 });
    const reference = addDays(START, 10);
    freezeAt(reference);
    const history = await loadHistory(START, reference, reference);
    // Logging food was not rating the day, and the app does not guess.
    expect(foodScoreOn(history, START)?.itemsAnswered).toBe(0);
  });
});
