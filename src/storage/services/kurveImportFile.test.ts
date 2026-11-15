import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { gymCurveOf, gymMetricOf } from '../../core/gym/metric';
import { MUSCLE_GROUPS, type MuscleGroup } from '../../core/model';
import { toBodyVisuals } from '../../features/body/bodyVisuals';
import { roundShown, shownPerformance } from '../../features/gym/muscleState';
import { closeDatabase, deleteDatabase } from '../db';
import { configSnapshotsRepository, gymSetsRepository } from '../repositories';
import { importBackup, inspectBackup } from './backupService';
import { loadBossProgression } from './bossService';
import { loadConfiguration } from './configurationService';
import { loadGymHistory, type GymHistory } from './gymService';
import { at } from './fixtures/profiles';

/**
 * The import file of the owner's iPhone check at STOP Kurve:
 * `docs/wp3/kurve/momentum-pruefdaten-kurve.json`.
 *
 * Made the way the file of Stage 5b was — by the live build itself, through
 * its own interface (`scripts/verify/stage5b-live-backup.mjs`, given `LAST`
 * and `OUT`) — as the same diary carried to the day of the STOP, with the
 * last session on that day so that the check does not open on a training
 * break. **The STOP fell on 15 November 2026, the last day of the Stage 5b
 * file**, so the diary is that file's, set for set; the records are new
 * ones, written by a second run of the live build. A check on a later day
 * needs a file made for that day: the same command with another `LAST`.
 *
 * The owner loads it into the live app and into the preview. These tests
 * hold what the STOP report tells him he will read there. Old is the file
 * as imported, before any load — what the live build shows; new is the same
 * database after `loadConfiguration()`, which is the update.
 */
const FILE = readFileSync(new URL('../../../docs/wp3/kurve/momentum-pruefdaten-kurve.json', import.meta.url), 'utf8');
const STAGE5B_FILE = readFileSync(new URL('../../../docs/wp3/stage5b/momentum-pruefdaten-5b.json', import.meta.url), 'utf8');
/** The day of the STOP, and the file's last session. */
const TODAY = '2026-11-15';

interface Backup {
  formatVersion: number;
  schemaVersion: number;
  data: {
    configSnapshots: { effectiveFrom: string; config: { scoring: Record<string, unknown> } }[];
    gymSets: { id: string; date: string; exerciseId: string; order: number; reps: number; weightGrams: number; muscles: string[]; primaryMuscles?: string[]; loadType?: string; warmUp?: unknown }[];
    gymSessions: { date: string; finishedAt?: unknown }[];
    answers: { date: string; value: unknown }[];
    weightEntries: { date: string; kg: number }[];
    domains: { type: string; enabled: boolean }[];
  };
}

const shown = (value: number | null | undefined): number | null => roundShown(value ?? null);

async function history(days: number): Promise<GymHistory> {
  const from = at(TODAY);
  from.setDate(from.getDate() - (days - 1));
  const key = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
  return loadGymHistory(key as never, TODAY as never);
}

/** The ten rows as Muskelgruppen prints them: the whole percent, or `null` without a figure. */
function rows(gym: GymHistory): Record<MuscleGroup, number | null> {
  const performance = shownPerformance(gym.days, gym.overall);
  return Object.fromEntries(
    MUSCLE_GROUPS.map((muscle) => [muscle, shown(performance.muscles.find((entry) => entry.muscle === muscle)?.change)]),
  ) as Record<MuscleGroup, number | null>;
}

/** The strength of each group's tint on the body, to two places. */
function strengths(gym: GymHistory): Record<MuscleGroup, number> {
  const visuals = toBodyVisuals(shownPerformance(gym.days, gym.overall).muscles);
  return Object.fromEntries(visuals.map((visual) => [visual.id, Math.round(visual.intensity * 100) / 100])) as Record<MuscleGroup, number>;
}

/**
 * Gym today. The screen prints the rating and, as "Leistung seit
 * Jahresbeginn", the year's change in whole percent; the level and the
 * target behind the rating are not printed anywhere, and stand here for the
 * report.
 */
async function gymToday(): Promise<{ level: number | null; target: number | null; rating: number; boss: number; yearToDate: number | null }> {
  const boss = await loadBossProgression();
  const today = boss.gym.detail[boss.gym.detail.length - 1]!;
  expect(today.date).toBe(TODAY);
  return {
    level: boss.gym.performance.score === null ? null : Math.round(boss.gym.performance.score),
    target: today.target === null ? null : Math.round(today.target),
    rating: Math.round(boss.gym.rating * 10) / 10,
    boss: Math.round(boss.points[boss.points.length - 1]!.rating * 10) / 10,
    yearToDate: shown(boss.gym.ytdChange),
  };
}

describe('the import file of the check at STOP Kurve', () => {
  beforeEach(async () => {
    await closeDatabase();
    await deleteDatabase();
    setClock({ now: () => at(TODAY) });
  });

  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  it('is a backup as the live build writes it: format 3, schema 5, one snapshot without any of the three eras, no warm-up mark', () => {
    expect(inspectBackup(FILE).ok).toBe(true);
    const backup = JSON.parse(FILE) as Backup;
    expect([backup.formatVersion, backup.schemaVersion]).toEqual([3, 5]);
    expect(backup.data.configSnapshots.map((snapshot) => snapshot.effectiveFrom)).toEqual(['2026-10-12']);
    const scoring = backup.data.configSnapshots[0]!.config.scoring;
    expect('gymMetric' in scoring).toBe(false);
    expect('sessionWindowDays' in scoring).toBe(false);
    expect(backup.data.gymSets.some((set) => 'warmUp' in set)).toBe(false);
    expect(backup.data.gymSessions.some((session) => 'finishedAt' in session)).toBe(false);
    expect(backup.data.domains.map((domain) => [domain.type, domain.enabled]).sort()).toEqual([['gym', true], ['mental', true]]);

    // Five weeks, three sessions a week, the last one on the day of the STOP.
    const dates = backup.data.gymSessions.map((session) => session.date).sort();
    expect(dates).toHaveLength(15);
    expect([dates[0], dates[dates.length - 1]]).toEqual(['2026-10-14', TODAY]);
    expect(backup.data.gymSets).toHaveLength(194);
    expect(new Set(backup.data.gymSets.map((set) => set.exerciseId)).size).toBe(12);
  });

  it('holds the diary of the Stage 5b file, set for set — the STOP fell on that file\'s last day — in records of its own', () => {
    const fresh = (JSON.parse(FILE) as Backup).data;
    const stage5b = (JSON.parse(STAGE5B_FILE) as Backup).data;
    const sets = (data: Backup['data']) =>
      data.gymSets
        .map((set) => [set.date, set.exerciseId, set.order, set.reps, set.weightGrams, set.muscles.join('+'), (set.primaryMuscles ?? []).join('+'), set.loadType ?? ''].join('|'))
        .sort();
    expect(sets(fresh)).toEqual(sets(stage5b));
    expect(fresh.answers.map((answer) => `${answer.date}|${String(answer.value)}`).sort())
      .toEqual(stage5b.answers.map((answer) => `${answer.date}|${String(answer.value)}`).sort());
    expect(fresh.weightEntries.map((entry) => [entry.date, entry.kg]).sort()).toEqual([['2026-10-16', 78.4], ['2026-11-06', 77.6]]);
    expect(fresh.weightEntries.map((entry) => [entry.date, entry.kg]).sort()).toEqual(stage5b.weightEntries.map((entry) => [entry.date, entry.kg]).sort());
    // A second run of the live build, not a copy: no set id is shared.
    const ids = new Set(stage5b.gymSets.map((set) => set.id));
    expect(fresh.gymSets.some((set) => ids.has(set.id))).toBe(false);
  });

  it('imports, and the first load is the update: one more snapshot from that day, with the metric and the curve; a second load writes nothing', async () => {
    const result = await importBackup(FILE);
    expect(result.ok).toBe(true);
    const before = await configSnapshotsRepository.list();
    expect(before).toHaveLength(1);
    expect(gymMetricOf(before[0]!.config)).toBeNull();

    await loadConfiguration();
    const after = await configSnapshotsRepository.list();
    expect(after).toHaveLength(2);
    expect(after[0]).toEqual(before[0]);
    expect(after[1]!.effectiveFrom).toBe(TODAY);
    expect(after[1]!.config.scoring.sessionWindowDays).toBeDefined();
    expect(gymMetricOf(after[1]!.config)).toEqual({ repsDivisor: 30, comparison: 'median' });
    expect(gymCurveOf(after[1]!.config)).toBe(3);

    await loadConfiguration();
    expect(await configSnapshotsRepository.list()).toEqual(after);
    expect(await gymSetsRepository.getAll()).toHaveLength(194);
  });

  it('the Gym screen: rating 833.1 in the preview for 831.7 in the live app — behind it level 952 for 884 and target 971 for 930; the year reads +6 % for +15 %', async () => {
    await importBackup(FILE);
    const live = await gymToday();
    await loadConfiguration();
    const preview = await gymToday();

    expect(live).toEqual({ level: 884, target: 930, rating: 831.7, boss: 758.8, yearToDate: 15 });
    expect(preview).toEqual({ level: 952, target: 971, rating: 833.1, boss: 759.5, yearToDate: 6 });
    // The aim: not lower.
    expect(preview.rating).toBeGreaterThanOrEqual(live.rating);
  });

  it('Muskelgruppen: the ten figures are what they were before this block — the curve does not reach them', async () => {
    await importBackup(FILE);
    await loadConfiguration();
    const month = await history(30);
    const quarter = await history(90);

    expect(rows(month)).toEqual({
      chest: 3, back: 4, shoulders: 3, biceps: 7, triceps: 4,
      core: 4, quadriceps: 5, hamstringsGlutes: 6, calves: 7, forearms: 4,
    });
    expect(rows(quarter)).toEqual({
      chest: 5, back: 6, shoulders: 6, biceps: 11, triceps: 7,
      core: 6, quadriceps: 5, hamstringsGlutes: 6, calves: 7, forearms: 7,
    });
    expect([shown(shownPerformance(month.days, month.overall).change), shown(shownPerformance(quarter.days, quarter.overall).change)]).toEqual([5, 6]);
  });

  it('the body at 30 days: the calves and the biceps at +7 % are tinted more than twice as strongly as the chest at +3 %', async () => {
    await importBackup(FILE);
    await loadConfiguration();
    const tint = strengths(await history(30));

    expect(tint).toEqual({
      chest: 0.32, back: 0.44, shoulders: 0.39, biceps: 0.82, triceps: 0.51,
      core: 0.51, quadriceps: 0.58, hamstringsGlutes: 0.7, calves: 0.89, forearms: 0.52,
    });
    expect(tint.calves / tint.chest).toBeGreaterThan(2);
    expect(tint.biceps / tint.chest).toBeGreaterThan(2);
    // No group of the file is held at 30 days: none is white.
    expect(Object.values(tint).every((strength) => strength >= 0.3)).toBe(true);
  });
});

/*
 * A check on a later day. The update is the first load, and no day before
 * it moves: loaded on a day after its last session, the file shows the same
 * rating in both apps until a day is scored again (read off both builds:
 * 832 and 832 from the 16th to the 19th). So the diary is made once more for
 * each of the two days after the STOP, the next session done on that day —
 * the same command with another `LAST`.
 */
const LATER: { day: string; live: [number | null, number | null, number]; preview: [number | null, number | null, number] }[] = [
  { day: '2026-11-16', live: [931, 692, 817.8], preview: [952, 971, 836.4] },
  { day: '2026-11-17', live: [931, 692, 802.6], preview: [952, 971, 820.7] },
];

describe('the same diary for a check on one of the two days after the STOP', () => {
  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  for (const { day, live, preview } of LATER) {
    const file = readFileSync(new URL(`../../../docs/wp3/kurve/momentum-pruefdaten-kurve-${day}.json`, import.meta.url), 'utf8');

    it(`${day}: the file of the STOP day and one session more, on that day, made by the live build`, () => {
      expect(inspectBackup(file).ok).toBe(true);
      const later = JSON.parse(file) as Backup;
      const stop = (JSON.parse(FILE) as Backup).data;
      expect([later.formatVersion, later.schemaVersion]).toEqual([3, 5]);
      expect(later.data.configSnapshots.map((snapshot) => snapshot.effectiveFrom)).toEqual(['2026-10-12']);
      expect('gymMetric' in later.data.configSnapshots[0]!.config.scoring).toBe(false);
      expect('sessionWindowDays' in later.data.configSnapshots[0]!.config.scoring).toBe(false);

      const line = (set: Backup['data']['gymSets'][number]) => [set.date, set.exerciseId, set.order, set.reps, set.weightGrams].join('|');
      const until = later.data.gymSets.filter((set) => set.date <= TODAY).map(line).sort();
      expect(until).toEqual(stop.gymSets.map(line).sort());
      const added = later.data.gymSets.filter((set) => set.date > TODAY);
      expect(new Set(added.map((set) => set.date))).toEqual(new Set([day]));
      expect(added).toHaveLength(14);
      expect(later.data.gymSessions.map((session) => session.date).sort().pop()).toBe(day);
    });

    it(`${day}: the preview stands at ${preview[2]} where the live app stands at ${live[2]}`, async () => {
      await closeDatabase();
      await deleteDatabase();
      setClock({ now: () => at(day) });
      const result = await importBackup(file);
      expect(result.ok).toBe(true);
      const read = async (): Promise<[number | null, number | null, number]> => {
        const boss = await loadBossProgression();
        const today = boss.gym.detail[boss.gym.detail.length - 1]!;
        expect(today.date).toBe(day);
        return [
          boss.gym.performance.score === null ? null : Math.round(boss.gym.performance.score),
          today.target === null ? null : Math.round(today.target),
          Math.round(boss.gym.rating * 10) / 10,
        ];
      };
      const before = await read();
      await loadConfiguration();
      const after = await read();
      expect(before).toEqual(live);
      expect(after).toEqual(preview);
      expect(after[2]).toBeGreaterThanOrEqual(before[2]);
    });
  }
});
