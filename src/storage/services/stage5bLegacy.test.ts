import 'fake-indexeddb/auto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { addDays, type DateKey } from '../../core/dates';
import { canonical } from '../../testing/canonical';
import { closeDatabase, deleteDatabase } from '../db';
import { importBackup } from './backupService';
import { loadBossProgression, type BossProgression } from './bossService';
import { loadGymHistory, type GymHistory } from './gymService';
import { at } from './fixtures/profiles';
import { RANDOM_GYM_CLOCKS, RANDOM_GYM_PROFILES, randomGymProfile } from './fixtures/randomGym';

/**
 * A history that lies wholly before the exercise-day metric of WP3 Stage 5b
 * replays, in every field, as the code before that stage replayed it (D150).
 *
 * Four seeded Gym histories (`fixtures/randomGym.ts`) — several sets per
 * exercise and day, changing reps, light sets round the heavy ones, a
 * bodyweight and an assisted exercise, a break, a turn of the year — each
 * replayed at two clocks. What is frozen is everything the metric reaches:
 * the Boss series, Gym's ladder series, the whole Gym rating state down to
 * every day's attendance, performance, target and movement and both windows
 * as they stand on the clock day, and the Gym history the screens read at 7,
 * 30 and 90 days — every exercise-day with its best set, the comparisons,
 * and both aggregates down to each muscle group.
 *
 * The files under `.github/fixtures/stage5b/` were written by this test from
 * the engine **as it was before any Stage 5b code** and are never
 * regenerated: none of these histories carries the new metric, so none of
 * their values may ever move. Nothing is rounded and equality is exact — the
 * profiles in `profiles.ts` log one set per exercise and day and round to
 * nine decimals; these are what would notice a sum added in another order.
 *
 * To capture (once, from the unmodified engine):
 *   UPDATE_STAGE5B_LEGACY=1 npx vitest run stage5bLegacy
 */

const fixtureDir = new URL('../../../.github/fixtures/stage5b/', import.meta.url);

const GYM_RANGES = [7, 30, 90] as const;

function gymHistoryOf(history: GymHistory) {
  return {
    days: history.days,
    comparisons: history.comparisons,
    recent: history.recent,
    overall: history.overall,
    awaitingBodyweight: history.awaitingBodyweight,
  };
}

function legacyOutputsOf(boss: BossProgression, histories: Record<number, GymHistory>) {
  return {
    boss: {
      progress: boss.progress,
      rank: boss.rank.id,
      peakRank: boss.peakRank.id,
      lifetimeXp: boss.lifetimeXp,
      changes: boss.changes,
      points: boss.points.map((point, index) => [boss.history.days[index]?.date ?? null, point.progress, point.rating, point.movement]),
    },
    gymSeries: boss.domains.find((domain) => domain.domain === 'gym')?.series ?? null,
    gym: boss.gym,
    history: Object.fromEntries(GYM_RANGES.map((range) => [range, gymHistoryOf(histories[range]!)])),
  };
}

async function replay(profile: { seed: number; p8From: number | null }, clock: DateKey) {
  await deleteDatabase();
  setClock({ now: () => at(clock) });
  const result = await importBackup(randomGymProfile(profile.seed, { p8From: profile.p8From }));
  if (!result.ok) throw new Error(result.details.join('; '));
  const boss = await loadBossProgression();
  const histories: Record<number, GymHistory> = {};
  for (const range of GYM_RANGES) {
    histories[range] = await loadGymHistory(addDays(clock, -(range - 1)), clock);
  }
  return canonical(legacyOutputsOf(boss, histories)) as ReturnType<typeof legacyOutputsOf>;
}

describe('a history before the Stage 5b metric replays as it did before the stage', () => {
  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  for (const profile of RANDOM_GYM_PROFILES) {
    for (const clock of RANDOM_GYM_CLOCKS) {
      it(`${profile.name} at ${clock}`, async () => {
        const actual = await replay(profile, clock);
        const path = fileURLToPath(new URL(`legacy-${profile.name}-${clock}.json`, fixtureDir));
        if (process.env.UPDATE_STAGE5B_LEGACY) {
          mkdirSync(fileURLToPath(fixtureDir), { recursive: true });
          writeFileSync(path, `${JSON.stringify(actual)}\n`);
          return;
        }
        if (!existsSync(path)) throw new Error(`No Stage 5b legacy baseline at ${path}; it is captured from the engine before Stage 5b`);
        const expected = JSON.parse(readFileSync(path, 'utf8')) as typeof actual;

        // The histories are worth nothing if they are thin: each must hold
        // several sets per exercise and day and a real comparison.
        const days = actual.history[90]!.days as unknown as { best: { score: number } }[];
        expect(days.length).toBeGreaterThan(40);

        // Section by section, so a difference names the number.
        expect(actual.boss).toEqual(expected.boss);
        expect(actual.gymSeries).toEqual(expected.gymSeries);
        expect(actual.gym).toEqual(expected.gym);
        expect(actual.history).toEqual(expected.history);
        // And the whole text, so nothing added later can slip past the sections.
        expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
      });
    }
  }
});
