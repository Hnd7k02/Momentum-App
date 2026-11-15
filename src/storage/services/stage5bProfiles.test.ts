import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { GYM_METRIC } from '../../core/config/constants';
import { addDays, type DateKey } from '../../core/dates';
import { compareExerciseDays, exerciseSpans, percentChange, type ExerciseDay } from '../../core/gym/performance';
import { closeDatabase, deleteDatabase } from '../db';
import { configSnapshotsRepository, domainsRepository, gymSetsRepository } from '../repositories';
import { importBackup } from './backupService';
import { loadBossProgression } from './bossService';
import { loadConfiguration } from './configurationService';
import { loadGymHistory, type GymHistory } from './gymService';
import { at } from './fixtures/profiles';
import {
  LIGHT_DAY,
  LIGHT_WEEK,
  METRIC_CROSSING_CLOCKS,
  METRIC_FROM,
  TRAINING_LAST,
  TRAINING_START,
  WARM_UP_ONLY_WEEK,
  metricCrossingProfile,
  strengthProfile,
} from './fixtures/trainingProfile';

/**
 * The two profiles of WP3 Stage 5b hold what they claim to hold.
 *
 * The golden files freeze their numbers; this says what the numbers are
 * numbers *of* — each pattern the owner named or the review computed, and
 * that the crossing profile's update day is exactly what the first load of
 * the update writes. A golden file that froze a profile without its pattern
 * would be green and worth nothing.
 */

const kg = (value: number) => Math.round(value * 1000);

async function load(profile: string, clock: DateKey): Promise<void> {
  await deleteDatabase();
  setClock({ now: () => at(clock) });
  const result = await importBackup(profile);
  if (!result.ok) throw new Error(result.details.join('; '));
}

const daysOf = (history: GymHistory, exerciseId: string): ExerciseDay[] =>
  history.days.filter((day) => day.exerciseId === exerciseId);

/** Each day's change against the day before, in percent, by date. */
const changes = (history: GymHistory, exerciseId: string): Map<string, number | null> =>
  new Map(compareExerciseDays(daysOf(history, exerciseId)).map((entry) => [entry.date, percentChange(entry.ratio)]));

const spanOf = (history: GymHistory, exerciseId: string) =>
  exerciseSpans(history.days, history.metric?.comparison ?? 'firstLast').find((span) => span.exerciseId === exerciseId)!;

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

describe('the profile under the Stage 5b metric from day one', () => {
  const whole = async (clock: DateKey = TRAINING_LAST) => {
    await load(strengthProfile(), clock);
    return loadGymHistory(TRAINING_START, clock);
  };

  it('is under the metric on every day, and holds sixteen weeks of four sessions', async () => {
    const history = await whole();
    expect(history.metric).toEqual({ repsDivisor: 30, comparison: 'median' });
    const boss = await loadBossProgression(TRAINING_LAST);
    expect(boss.history.days).toHaveLength(112);
    expect(new Set(history.days.map((day) => day.date)).size).toBe(64);
    expect(boss.gym.endurance.unlocked).toBe(true);
  });

  it('double progression in 8–12 reps: no collapse on the day the load goes up', async () => {
    const history = await whole();
    const bench = daysOf(history, 'ex_bench_press');
    expect(bench.slice(0, 6).map((day) => [day.best.set.reps, day.best.set.weightGrams])).toEqual([
      [8, kg(80)], [9, kg(80)], [10, kg(80)], [11, kg(80)], [12, kg(80)], [8, kg(82.5)],
    ]);
    const steps = [...changes(history, 'ex_bench_press').values()].slice(1);
    // A rep more is about +2.5 %; the reset from 12 × 80 to 8 × 82.5 is −6.7 %.
    expect(Math.min(...steps.map((step) => step!))).toBeGreaterThan(-7);
    expect(steps[4]!.toFixed(1)).toBe('-6.7');
    // By `reps × load` the same day read −31 %.
    expect(((8 * 82.5) / (12 * 80) - 1) * 100).toBeCloseTo(-31.25, 2);
  });

  it('marked warm-up sets before the bench never provide the day', async () => {
    const history = await whole();
    const stored = (await gymSetsRepository.getAll()).filter((set) => set.exerciseId === 'ex_bench_press');
    expect(stored.filter((set) => set.warmUp === true)).toHaveLength(32);
    for (const day of daysOf(history, 'ex_bench_press')) {
      expect(day.best.set.weightGrams).toBeGreaterThanOrEqual(kg(80));
      expect(day.best.set.warmUp).toBeUndefined();
    }
  });

  it('an unmarked light set before the work does not provide it either', async () => {
    const history = await whole();
    // Bizeps-Curls: 15 × 6 kg, never marked, then 10 × 14 kg.
    for (const day of daysOf(history, 'ex_biceps_curl')) expect(day.best.set.weightGrams).toBeGreaterThanOrEqual(kg(14));
    const stored = (await gymSetsRepository.getAll()).filter((set) => set.exerciseId === 'ex_biceps_curl');
    expect(stored.some((set) => set.warmUp === true)).toBe(false);
  });

  it('a pyramid: the heaviest set is the day, and it rises', async () => {
    const history = await whole();
    const row = daysOf(history, 'ex_barbell_row');
    expect(row[0]!.best.set).toMatchObject({ reps: 6, weightGrams: kg(80) });
    expect(row[row.length - 1]!.best.set).toMatchObject({ reps: 6, weightGrams: kg(92.5) });
    expect(spanOf(history, 'ex_barbell_row').ratio).toBeGreaterThan(1.1);
  });

  it('drop sets after the work leave the day where it was: 0 %', async () => {
    const history = await whole();
    const pushdown = daysOf(history, 'ex_triceps_pushdown');
    expect(pushdown).toHaveLength(16);
    for (const day of pushdown) expect(day.best.set).toMatchObject({ reps: 8, weightGrams: kg(35) });
    for (const step of [...changes(history, 'ex_triceps_pushdown').values()].slice(1)) expect(step).toBe(0);
    // The drop sets are stored, as working sets, from week 4 on.
    const stored = (await gymSetsRepository.getAll()).filter((set) => set.exerciseId === 'ex_triceps_pushdown');
    expect(stored.filter((set) => set.reps === 15 && set.weightGrams === kg(22.5))).toHaveLength(12);
  });

  it('a day of warm-up sets only is no exercise-day, and the week still counts', async () => {
    const history = await whole();
    const day = addDays(TRAINING_START, WARM_UP_ONLY_WEEK * 7 + 3);
    const calves = daysOf(history, 'ex_calf_raise');
    expect(calves).toHaveLength(15);
    expect(calves.some((entry) => entry.date === day)).toBe(false);
    expect((await gymSetsRepository.getAll()).filter((set) => set.exerciseId === 'ex_calf_raise' && set.date === day)).toHaveLength(2);
    // The session of that day is there with its other exercises.
    expect(daysOf(history, 'ex_squat').some((entry) => entry.date === day)).toBe(true);
    // Level before and after: the missing day is not a fall.
    expect(spanOf(history, 'ex_calf_raise').ratio).toBe(1);
  });

  it('a single light day after six exercise-days falls out of the window', async () => {
    await load(strengthProfile(), LIGHT_DAY);
    const history = await loadGymHistory(addDays(LIGHT_DAY, -29), LIGHT_DAY);
    const fly = spanOf(history, 'ex_chest_fly');
    expect(fly.days).toBe(6);
    expect(fly.compared).toBe(3);
    expect(fly.ratio).toBe(1);
    // The day itself is the light one: −20 % against the day before.
    expect(changes(history, 'ex_chest_fly').get(LIGHT_DAY)).toBeCloseTo(-20, 9);
  });

  it('and after four exercise-days it is halved', async () => {
    await load(strengthProfile(), LIGHT_DAY);
    const history = await loadGymHistory(addDays(LIGHT_DAY, -29), LIGHT_DAY);
    const pulls = spanOf(history, 'ex_face_pull');
    expect(pulls.days).toBe(4);
    expect(pulls.compared).toBe(2);
    expect(percentChange(pulls.ratio)).toBeCloseTo(-10, 9);
  });

  it('a whole light week stays a decline while it is the end of the window', async () => {
    const sunday = addDays(TRAINING_START, LIGHT_WEEK * 7 + 6);
    await load(strengthProfile(), sunday);
    const history = await loadGymHistory(addDays(sunday, -29), sunday);
    // Four squat days in the window, the last at 80 %: two against two —
    // (120 + 98) ÷ 2 against (115 + 117.5) ÷ 2, at five reps each.
    const squat = spanOf(history, 'ex_squat');
    expect(squat.days).toBe(4);
    expect(squat.compared).toBe(2);
    expect(percentChange(squat.ratio)).toBeCloseTo((218 / 232.5 - 1) * 100, 9);
    expect(percentChange(squat.ratio)).toBeLessThan(-5);
    const shown = history.overall.muscles.find((entry) => entry.muscle === 'quadriceps')!;
    expect(percentChange(shown.ratio)).toBeLessThan(-5);
  });

  it('a bodyweight exercise is read with the weight in force on each day', async () => {
    const history = await whole();
    const pullUps = daysOf(history, 'ex_pull_up');
    // 82 kg in week 0, 81 from week 4, 80 from week 8 (plus 5 kg added), 79 from week 12.
    expect(pullUps[0]!.best.set.weightGrams).toBe(kg(82));
    expect(pullUps[4]!.best.set.weightGrams).toBe(kg(81));
    expect(pullUps[8]!.best.set.weightGrams).toBe(kg(85));
    expect(pullUps[12]!.best.set.weightGrams).toBe(kg(84));
  });
});

describe('the profile crossing into the Stage 5b metric', () => {
  it('is the live build\'s device before the update: the old metric, Food on, the three-day window', async () => {
    const before = METRIC_CROSSING_CLOCKS[0]!;
    await load(metricCrossingProfile(), before);
    const history = await loadGymHistory(TRAINING_START, before);
    expect(history.metric).toBeNull();
    // No warm-up set is marked before the update, and the bench has none logged.
    const sets = await gymSetsRepository.getAll();
    expect(sets.filter((set) => set.date < METRIC_FROM && set.warmUp === true)).toHaveLength(0);
    expect(sets.filter((set) => set.date < METRIC_FROM && set.exerciseId === 'ex_bench_press' && set.weightGrams < kg(80))).toHaveLength(0);
    // The pyramid's best set by `reps × load` is its lightest: 12 × 50.
    const row = history.days.filter((day) => day.exerciseId === 'ex_barbell_row');
    for (const day of row) expect(day.best.score).toBe(12 * kg(50));
  });

  it('carries, on the update day, exactly what the first load of the update writes', async () => {
    // The same device with the update snapshot taken out, as it stands when
    // the update is first opened…
    const backup = JSON.parse(metricCrossingProfile()) as {
      data: { configSnapshots: { id: string }[]; domains: { type: string; enabled: boolean }[] };
    };
    const frozen = backup.data.configSnapshots.find((snapshot) => snapshot.id === 'cfg_tp_update')!;
    backup.data.configSnapshots = backup.data.configSnapshots.filter((snapshot) => snapshot.id !== 'cfg_tp_update');
    for (const domain of backup.data.domains) if (domain.type === 'food') domain.enabled = true;
    await load(JSON.stringify(backup), METRIC_FROM);

    // …and that load.
    await loadConfiguration();
    const written = (await configSnapshotsRepository.list()).find((snapshot) => snapshot.effectiveFrom === METRIC_FROM)!;
    expect(written.config).toEqual((frozen as unknown as { config: unknown }).config);
    expect(written.config.scoring.gymMetric).toEqual(GYM_METRIC);
    expect((await domainsRepository.findByType('food'))?.enabled).toBe(false);
    expect(await configSnapshotsRepository.list()).toHaveLength(2);
  });

  it('reads the range in the new metric from the update day on, the days before it included', async () => {
    await load(metricCrossingProfile(), METRIC_FROM);
    const history = await loadGymHistory(TRAINING_START, METRIC_FROM);
    expect(history.metric).toEqual({ repsDivisor: 30, comparison: 'median' });
    const row = history.days.filter((day) => day.exerciseId === 'ex_barbell_row');
    // Every day of the pyramid, the old ones too, is its heaviest set now.
    for (const day of row) expect(day.best.set.reps).toBe(6);
  });

  it('keeps every day before the update at the value the file of the day before has', async () => {
    await load(metricCrossingProfile(), METRIC_CROSSING_CLOCKS[0]!);
    const before = await loadBossProgression(METRIC_CROSSING_CLOCKS[0]!);
    for (const clock of METRIC_CROSSING_CLOCKS.slice(1)) {
      await load(metricCrossingProfile(), clock);
      const after = await loadBossProgression(clock);
      // Up to two days before the update: the last two are still open under
      // the three-day window on the day before it, and settle afterwards.
      const settled = before.history.days.length - 3;
      for (let index = 0; index < settled; index += 1) {
        expect(after.gym.points[index], `${after.history.days[index]!.date} at ${clock}`).toEqual(before.gym.points[index]);
        expect(after.gym.detail[index]?.performance, `${after.history.days[index]!.date} at ${clock}`).toBe(before.gym.detail[index]?.performance);
      }
    }
  });
});
