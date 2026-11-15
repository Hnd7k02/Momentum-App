import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { gymMetricOf } from '../../core/gym/metric';
import { compareExerciseDays, percentChange, type ExerciseDay } from '../../core/gym/performance';
import { MUSCLE_GROUPS, type MuscleGroup } from '../../core/model';
import { roundShown, shownPerformance } from '../../features/gym/muscleState';
import { closeDatabase, deleteDatabase } from '../db';
import { configSnapshotsRepository, gymSetsRepository } from '../repositories';
import { importBackup, inspectBackup } from './backupService';
import { loadConfiguration } from './configurationService';
import { loadGymHistory, type GymHistory } from './gymService';
import { at } from './fixtures/profiles';

/**
 * The import file of the owner's iPhone check at STOP 5b:
 * `docs/wp3/stage5b/momentum-pruefdaten-5b.json`.
 *
 * It was made by the live build itself (`scripts/verify/stage5b-live-backup.mjs`
 * drives its interface and exports through it), so it is what a device
 * before the update holds: one snapshot, no metric, no warm-up mark. The
 * owner loads it into the live app and into the preview and compares the
 * two. These tests hold what the STOP report tells him he will see, so that
 * no figure in the checklist is one nobody computed — and they are the
 * trial run of step 8 as a test: an import of a live backup, then the first
 * load.
 *
 * Old is the file as imported, before any load: the best set by
 * `reps × load`, the last day against the first. New is the same database
 * after `loadConfiguration()`, which is the update.
 */
const FILE = readFileSync(new URL('../../../docs/wp3/stage5b/momentum-pruefdaten-5b.json', import.meta.url), 'utf8');
const TODAY = '2026-11-15';

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

/** One exercise's days, oldest first: the set that is named and the change against the day before. */
function series(gym: GymHistory, exerciseId: string): { date: string; set: string; change: number | null }[] {
  const days: ExerciseDay[] = gym.days.filter((day) => day.exerciseId === exerciseId);
  const change = new Map(compareExerciseDays(days).map((entry) => [entry.date, percentChange(entry.ratio)]));
  return days.map((day) => ({
    date: day.date,
    set: `${day.best.set.reps} × ${day.best.set.weightGrams / 1000}`,
    change: change.get(day.date) === null || change.get(day.date) === undefined ? null : Math.round(change.get(day.date)! * 10) / 10,
  }));
}

describe('the import file of the Stage 5b check', () => {
  beforeEach(async () => {
    await closeDatabase();
    await deleteDatabase();
    setClock({ now: () => at(TODAY) });
  });

  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  it('is a backup as the live build writes it: format 3, schema 5, one snapshot without the metric, no warm-up mark', () => {
    const inspected = inspectBackup(FILE);
    expect(inspected.ok).toBe(true);
    const backup = JSON.parse(FILE) as {
      formatVersion: number;
      schemaVersion: number;
      data: {
        configSnapshots: { effectiveFrom: string; config: { scoring: Record<string, unknown> } }[];
        gymSets: { date: string; exerciseId: string; warmUp?: unknown }[];
        gymSessions: { date: string }[];
        weightEntries: { date: string; kg: number }[];
        domains: { type: string; enabled: boolean }[];
      };
    };
    expect([backup.formatVersion, backup.schemaVersion]).toEqual([3, 5]);
    expect(backup.data.configSnapshots.map((snapshot) => snapshot.effectiveFrom)).toEqual(['2026-10-12']);
    const scoring = backup.data.configSnapshots[0]!.config.scoring;
    expect('gymMetric' in scoring).toBe(false);
    expect('sessionWindowDays' in scoring).toBe(false);
    expect(backup.data.gymSets.some((set) => 'warmUp' in set)).toBe(false);
    expect(backup.data.domains.map((domain) => [domain.type, domain.enabled])).toEqual([['mental', true], ['gym', true]]);

    // Five weeks, three sessions a week, the last one on the day the file was made.
    const dates = backup.data.gymSessions.map((session) => session.date).sort();
    expect(dates).toHaveLength(15);
    expect([dates[0], dates[dates.length - 1]]).toEqual(['2026-10-14', TODAY]);
    expect(backup.data.gymSets).toHaveLength(194);
    expect(new Set(backup.data.gymSets.map((set) => set.exerciseId)).size).toBe(12);
    expect(backup.data.weightEntries.map((entry) => [entry.date, entry.kg]).sort()).toEqual([['2026-10-16', 78.4], ['2026-11-06', 77.6]]);
  });

  it('imports, and the first load after it is the update: one more snapshot, from that day, with all three eras', async () => {
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
    expect(gymMetricOf(after[1]!.config)).toEqual({ repsDivisor: 30, comparison: 'median' });
    expect(after[1]!.config.scoring.sessionWindowDays).toBeDefined();

    // And a second load writes nothing.
    await loadConfiguration();
    expect(await configSnapshotsRepository.list()).toEqual(after);
    expect(await gymSetsRepository.getAll()).toHaveLength(194);
  });

  it('reads the day the weight went up as a fall of a sixth by the old metric, and of a hundredth by the new', async () => {
    await importBackup(FILE);
    const old = series(await history(90), 'ex_bench_press');
    await loadConfiguration();
    const fresh = series(await history(90), 'ex_bench_press');

    // The reps rise at 60 kg, then the weight goes to 62.5 kg and the reps fall back.
    expect(old.map((day) => day.set)).toEqual(['8 × 60', '9 × 60', '10 × 60', '8 × 62.5', '9 × 62.5']);
    expect(fresh.map((day) => day.set)).toEqual(old.map((day) => day.set));
    expect(old.map((day) => day.date)).toEqual(['2026-10-14', '2026-10-21', '2026-10-28', '2026-11-04', '2026-11-11']);
    expect(old.map((day) => day.change)).toEqual([null, 12.5, 11.1, -16.7, 12.5]);
    expect(fresh.map((day) => day.change)).toEqual([null, 2.6, 2.6, -1, 2.6]);
  });

  it('names the heavy set of a pyramid and the working set before a drop set, where the old metric named the light ones', async () => {
    await importBackup(FILE);
    const old = await history(90);
    await loadConfiguration();
    const fresh = await history(90);

    expect(series(old, 'ex_lat_pulldown').map((day) => day.set)).toEqual(['12 × 50', '12 × 50', '12 × 52.5', '12 × 52.5', '12 × 55']);
    expect(series(fresh, 'ex_lat_pulldown').map((day) => day.set)).toEqual(['8 × 65', '9 × 65', '8 × 67.5', '9 × 67.5', '8 × 70']);
    expect(series(old, 'ex_triceps_pushdown').map((day) => day.set)).toEqual(['13 × 20', '11 × 25', '12 × 25', '15 × 20', '15 × 20']);
    expect(series(fresh, 'ex_triceps_pushdown').map((day) => day.set)).toEqual(['10 × 25', '11 × 25', '12 × 25', '9 × 27.5', '10 × 27.5']);
  });

  it('reads the light squat day as the dip it was, where the old metric read it as the best day', async () => {
    await importBackup(FILE);
    const old = series(await history(90), 'ex_squat');
    await loadConfiguration();
    const fresh = series(await history(90), 'ex_squat');

    expect(old.map((day) => day.set)).toEqual(['5 × 100', '5 × 102.5', '8 × 80', '5 × 105', '5 × 107.5']);
    expect(old.map((day) => day.change)).toEqual([null, 2.5, 24.9, -18, 2.4]);
    expect(fresh.map((day) => day.change)).toEqual([null, 2.5, -15.3, 20.9, 2.4]);
  });

  it('shows these ten rows at 90 days, old against new — the figures of the checklist', async () => {
    await importBackup(FILE);
    const old = await history(90);
    await loadConfiguration();
    const fresh = await history(90);

    expect(old.metric).toBeNull();
    expect(fresh.metric).toEqual({ repsDivisor: 30, comparison: 'median' });
    expect(rows(old)).toEqual({
      chest: 13, back: 22, shoulders: 21, biceps: 20, triceps: 16,
      core: 16, quadriceps: 7, hamstringsGlutes: 15, calves: 8, forearms: 8,
    });
    expect(rows(fresh)).toEqual({
      chest: 5, back: 6, shoulders: 6, biceps: 11, triceps: 7,
      core: 6, quadriceps: 5, hamstringsGlutes: 6, calves: 7, forearms: 7,
    });
    expect([shown(shownPerformance(old.days, old.overall).change), shown(shownPerformance(fresh.days, fresh.overall).change)]).toEqual([15, 6]);
  });

  it('and at 30 days on the day the file was made: the forearms fell by the old metric and rose by the new', async () => {
    await importBackup(FILE);
    const old = await history(30);
    await loadConfiguration();
    const fresh = await history(30);

    expect(rows(old)).toEqual({
      chest: 2, back: 12, shoulders: 5, biceps: 16, triceps: 7,
      core: 7, quadriceps: 7, hamstringsGlutes: 15, calves: 8, forearms: -4,
    });
    expect(rows(fresh)).toEqual({
      chest: 3, back: 4, shoulders: 3, biceps: 7, triceps: 4,
      core: 4, quadriceps: 5, hamstringsGlutes: 6, calves: 7, forearms: 4,
    });
  });
});
