import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { addDays, diffInDays, type DateKey } from '../../core/dates';
import { closeDatabase, deleteDatabase } from '../db';
import { ensureSessionWindowEra } from '../configService';
import { importBackup } from './backupService';
import { loadBossProgression, type BossProgression } from './bossService';
import { START, at, currentProfile, trainingBreakProfile } from './fixtures/profiles';

/**
 * The update day replays every earlier day byte for byte (WP3, P8 — D132).
 *
 * P8 is an era: the first load after the update appends a snapshot with the
 * one-day window and the P8 marker, effective that day. Every day before it
 * keeps the rules it was lived by — its own three-day window, its week
 * judged at Sunday midnight — so nothing already shown can move, on the
 * update day or any day after.
 *
 * Each profile is replayed twice at the same clock: as stored by a build
 * before P8, and after the update's append. Every output of every day before
 * the update must be identical, and so must every rank change dated before
 * it; on the update day itself, so must the promotion being confirmed.
 */

const round = (value: number | null | undefined) =>
  value === null || value === undefined ? null : Math.round(value * 1e9) / 1e9;

function dayOutputs(boss: BossProgression, index: number) {
  const row = boss.history.days[index]!;
  return {
    date: row.date,
    row: [row.status, round(row.score), round(row.recordedScore), row.dueItems, row.answeredItems],
    domains: boss.domains.map((entry) => [entry.domain, round(entry.series[index]), entry.points[index]?.skipped]),
    boss: round(boss.points[index]?.rating),
    gym: [round(boss.gym.points[index]?.rating), boss.gym.detail.find((point) => point.date === row.date)?.attendance],
    running: round(boss.running.points[index]?.rating),
  };
}

/** The four-domain profile with promotion confirmation on, and no P8 snapshot. */
function confirmationOn(): string {
  const backup = JSON.parse(currentProfile()) as { data: { settings: Record<string, unknown> } };
  backup.data.settings.promotionConfirmation = { from: START, targetRankId: null, eligibleDates: [] };
  return JSON.stringify(backup);
}

/**
 * A profile left unanswered on some days: no check-in, no Food rating. Only
 * an incomplete day's status depends on the window, so this is the profile
 * that would move if the update reopened or shortened a day lived before it.
 */
function silentOn(load: () => string, offsets: readonly number[]): () => string {
  return () => {
    const backup = JSON.parse(load()) as { data: Record<string, { date?: string }[]> };
    const dates = new Set(offsets.map((offset) => addDays(START, offset)));
    for (const key of ['answers', 'foodDays']) {
      backup.data[key] = backup.data[key]!.filter((row) => !dates.has(row.date as DateKey));
    }
    return JSON.stringify(backup);
  };
}

const PROFILES: { name: string; load(): string; updates: number[]; silent?: number[] }[] = [
  // A Monday, a Wednesday and a Sunday, so every relation to the week is met.
  { name: 'the four-domain profile', load: () => currentProfile(), updates: [28, 30, 34] },
  // The two days before the update left unanswered: lived under the
  // three-day window, they stay open for three days, update or not.
  { name: 'unanswered before a Monday update', load: silentOn(currentProfile, [26, 27]), updates: [28], silent: [26, 27] },
  { name: 'unanswered before a Wednesday update', load: silentOn(currentProfile, [28, 29]), updates: [30], silent: [28, 29] },
  // Inside the Gym break, with the Endurance gate open and decay running.
  { name: 'the training-break profile', load: trainingBreakProfile, updates: [63, 66, 69] },
  { name: 'promotion confirmation on', load: confirmationOn, updates: [7, 16, 20] },
];

/** The day of the update itself, the next three, and a week on. */
const AFTER = [0, 1, 2, 3, 8];

async function replay(load: () => string, clock: DateKey, update: DateKey | null): Promise<BossProgression> {
  await deleteDatabase();
  setClock({ now: () => at(clock) });
  const result = await importBackup(load());
  if (!result.ok) throw new Error(result.details.join('; '));
  if (update) expect(await ensureSessionWindowEra(update)).toBe('appended');
  return loadBossProgression(clock);
}

describe('the P8 update day (D132)', () => {
  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  for (const profile of PROFILES) {
    for (const offset of profile.updates) {
      const update = addDays(START, offset);
      it(`${profile.name}, updated on ${update}`, async () => {
        for (const after of AFTER) {
          const clock = addDays(update, after);
          const before = await replay(profile.load, clock, null);
          const updated = await replay(profile.load, clock, update);
          const earlier = before.history.days.findIndex((day) => day.date === update);
          expect(earlier, 'the update day is in the history').toBeGreaterThan(0);
          for (let index = 0; index < earlier; index += 1) {
            expect(dayOutputs(updated, index), `at ${clock}`).toEqual(dayOutputs(before, index));
          }
          const changesBefore = (boss: BossProgression) =>
            boss.changes.filter((change) => change.date < update).map((change) => JSON.stringify(change));
          expect(changesBefore(updated), `at ${clock}`).toEqual(changesBefore(before));
          if (after === 0) expect(updated.pending).toEqual(before.pending);
          // The legacy window itself, in both replays: three days, not one.
          for (const offset of profile.silent ?? []) {
            const day = addDays(START, offset);
            const expected = diffInDays(day, clock) <= 3 ? 'open' : 'scored';
            for (const boss of [before, updated]) {
              expect(boss.history.days.find((entry) => entry.date === day)?.status, `${day} at ${clock}`).toBe(expected);
            }
          }
        }
      });
    }
  }
});
