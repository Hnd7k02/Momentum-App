import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { closeDatabase, deleteDatabase } from '../db';
import { importBackup } from './backupService';
import { loadBossProgression } from './bossService';
import { saveAnswer } from './checkInService';
import { loadConfiguration } from './configurationService';
import { addSet, finishSession, openSessionForDay } from './gymService';
import { loadHistory } from './historyService';

/**
 * Block 9, step 6a (D194): a workout saved on a day that is still open.
 *
 * The owner, at STOP 7D: "Ein eingetragenes Training erscheint im
 * Entwicklungs-Chart erst am nächsten Tag." The cause: while a question of
 * the day is unanswered the day is open (D111), every domain inherits that,
 * and the Gym rating does not count the day until it is complete or has
 * closed. The rule stays. Beside the rating stands what it would be with
 * the open day counted — at once, and exactly what the day settles on once
 * it is complete.
 *
 * The device is the check file of block 7D (last session 17 November),
 * imported on a Monday, so the week holds no session yet, and on a
 * Wednesday, in a week that already holds one.
 */
const FILE = readFileSync(new URL('../../../docs/wp3/stage7d/momentum-pruefdaten-7d-2026-11-17.json', import.meta.url), 'utf8');

beforeEach(async () => {
  await deleteDatabase();
});
afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

async function deviceOn(day: string) {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, 10, 0, 0) });
  await importBackup(FILE);
  await loadConfiguration();
}

async function workout(day: string) {
  const session = await openSessionForDay(day, day);
  await addSet({ sessionId: session.id, exerciseId: 'ex_bench_press', reps: 8, weightGrams: 90000 }, day);
  await finishSession(session.id, day);
}

describe('a workout on a day still open (D194)', () => {
  for (const day of ['2026-11-23', '2026-11-18']) {
    it(`stands at once in the provisional Gym rating, and is what the day settles on (${day})`, async () => {
      await deviceOn(day);
      const before = await loadBossProgression(day);
      expect(before.provisional.gym).toBeNull();

      await workout(day);
      const open = await loadBossProgression(day);
      // The day is open: the rating does not count it yet (D111), its own
      // point is skipped — and the provisional value has moved.
      expect(open.history.days[open.history.days.length - 1]?.status).toBe('open');
      expect(open.gym.detail[open.gym.detail.length - 1]?.skipped).toBe(true);
      expect(open.provisional.gym).not.toBeNull();
      expect(open.provisional.gym).not.toBe(open.gym.rating);
      if (day === '2026-11-23') expect(open.gym.rating).toBe(before.gym.rating); // the week held nothing before
      expect(open.provisional.running).toBeNull(); // no run on any open day

      // Every question of the day answered: the day is complete, the rating
      // counts it, and it lands exactly where the provisional value stood.
      const questions = (await loadHistory(day, day)).questions;
      for (const question of questions) await saveAnswer(day, question.id, question.type === 'scale' ? 7 : true, day);
      const complete = await loadBossProgression(day);
      expect(complete.history.days[complete.history.days.length - 1]?.status).toBe('scored');
      expect(complete.provisional.gym).toBeNull();
      expect(complete.gym.rating).toBe(open.provisional.gym);
    });
  }

  it('leaves every day before the workout and the Boss as they were', async () => {
    const day = '2026-11-23';
    await deviceOn(day);
    const before = await loadBossProgression(day);
    await workout(day);
    const after = await loadBossProgression(day);
    expect(after.gym.points.slice(0, -1)).toEqual(before.gym.points.slice(0, -1));
    expect(after.points).toEqual(before.points);
    expect(after.progress).toBe(before.progress);
  });
});
