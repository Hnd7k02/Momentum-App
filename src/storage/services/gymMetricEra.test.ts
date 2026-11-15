import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { GYM_METRIC } from '../../core/config/constants';
import { addDays, type DateKey } from '../../core/dates';
import { gymMetricOf, type GymMetric } from '../../core/gym/metric';
import { percentChange } from '../../core/gym/performance';
import type { AppConfigSnapshot, ConfigSnapshotRecord } from '../../core/model';
import { closeDatabase, deleteDatabase } from '../db';
import { ensureCurrentSnapshot, ensureGymMetricEra } from '../configService';
import {
  configSnapshotsRepository,
  domainsRepository,
  gymSetsRepository,
  questionsRepository,
} from '../repositories';
import { exportBackup, importBackup } from './backupService';
import { loadBossProgression, type BossProgression } from './bossService';
import { saveAnswer } from './checkInService';
import { addQuestion, applyOnboarding, loadConfiguration } from './configurationService';
import { performanceOn } from './gymRatingService';
import { loadExerciseDaySource, loadGymHistory } from './gymService';
import { withoutGymCurveValue, withoutGymMetricEra } from './fixtures/legacyGymMetric';
import { START, at, currentProfile } from './fixtures/profiles';
import {
  RANDOM_GYM_DAYS,
  RANDOM_GYM_LAST,
  RANDOM_GYM_PROFILES,
  RANDOM_GYM_START,
  randomGymProfile,
} from './fixtures/randomGym';
import { dayOutputs } from './fixtures/replayOutputs';

/**
 * The exercise-day metric of WP3 Stage 5b as an era (D150).
 *
 * The first load after the update appends a snapshot with `gymMetric`,
 * effective that day. Every day before it has no marker in its snapshot and
 * replays by the best set of `reps × load`, exactly as it did; from that
 * day a day's windows are read by the best working set and the strength
 * score. This file holds the step in every case its two models know, the
 * owner's device with three activations in one load, the proof that no day
 * before the boundary moves, the fixed order, and the comparison switch
 * through the whole replay.
 */

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

const marked = (config: AppConfigSnapshot): boolean => gymMetricOf(config) !== null;

const snapshotOn = async (date: DateKey): Promise<ConfigSnapshotRecord> =>
  (await configSnapshotsRepository.resolveForDate(date))!;

const effectiveDates = async (): Promise<string[]> =>
  (await configSnapshotsRepository.list()).map((snapshot) => snapshot.effectiveFrom);

/** `config` with the Stage 5b field taken out, for comparing everything else. */
function unmarked(config: AppConfigSnapshot): AppConfigSnapshot {
  const scoring: Partial<AppConfigSnapshot['scoring']> = { ...config.scoring };
  delete scoring.gymMetric;
  return { ...config, scoring: scoring as AppConfigSnapshot['scoring'] };
}

async function importProfile(profile: string, clock: string): Promise<void> {
  await deleteDatabase();
  setClock({ now: () => at(clock) });
  const result = await importBackup(profile);
  if (!result.ok) throw new Error(result.details.join('; '));
}

/* ── The step itself ────────────────────────────────────────────────────── */

describe('the activation step', () => {
  /** A Monday: the device was set up then, by a build before the update. */
  const SINCE = '2026-02-23';
  /** The Wednesday of the week after: the update day. */
  const TODAY = '2026-03-04';

  beforeEach(async () => {
    await deleteDatabase();
  });

  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  /** A device from before the update: set up on `SINCE`, no snapshot with the field. */
  async function legacyDevice(): Promise<void> {
    freezeAt(SINCE);
    await applyOnboarding({
      questions: [{ text: 'A', type: 'scale', category: 'eigene' }],
      gymTargetPerWeek: 3,
    });
    await withoutGymMetricEra();
    freezeAt(TODAY);
  }

  it('starts the era today, and only once', async () => {
    await legacyDevice();
    expect(marked((await snapshotOn(TODAY)).config)).toBe(false);
    expect(await ensureGymMetricEra()).toBe('appended');

    const from = await snapshotOn(TODAY);
    expect(from.effectiveFrom).toBe(TODAY);
    expect(from.config.scoring.gymMetric).toEqual(GYM_METRIC);
    // Yesterday was lived under the metric before, and stays so.
    expect(marked((await snapshotOn(addDays(TODAY, -1))).config)).toBe(false);

    const before = await configSnapshotsRepository.list();
    expect(await ensureGymMetricEra()).toBe('unchanged');
    expect(await configSnapshotsRepository.list()).toEqual(before);
  });

  it('adds the field and nothing else: it starts this era and no other', async () => {
    await legacyDevice();
    const before = (await snapshotOn(TODAY)).config;
    await ensureGymMetricEra();
    const after = (await snapshotOn(TODAY)).config;
    expect(unmarked(after)).toEqual(before);
    expect(Object.keys(after.scoring).sort()).toEqual([...Object.keys(before.scoring), 'gymMetric'].sort());
  });

  it('writes byte for byte what the next write would, so nothing follows it', async () => {
    await legacyDevice();
    await ensureGymMetricEra();
    const written = await configSnapshotsRepository.list();
    await ensureCurrentSnapshot();
    expect(await configSnapshotsRepository.list()).toEqual(written);
  });

  it('carries over a snapshot already written today, with the field added', async () => {
    await legacyDevice();
    // A configuration change made today by the old build, before the update loaded.
    await addQuestion({ text: 'Neu', type: 'boolean', category: 'eigene' });
    await withoutGymMetricEra();
    const today = await snapshotOn(TODAY);
    expect(today.effectiveFrom).toBe(TODAY);

    expect(await ensureGymMetricEra()).toBe('appended');
    const after = await snapshotOn(TODAY);
    expect(after.id).toBe(today.id);
    expect(unmarked(after.config)).toEqual(today.config);
    expect(await effectiveDates()).toEqual([SINCE, TODAY]);
  });

  it('gives a snapshot dated after today the field at its own date', async () => {
    await legacyDevice();
    const snapshots = await configSnapshotsRepository.list();
    const first = snapshots[snapshots.length - 1]!;
    const later = addDays(TODAY, 3);
    await configSnapshotsRepository.replaceAll([...snapshots, { ...first, id: 'cfg_later', effectiveFrom: later }]);

    expect(await ensureGymMetricEra()).toBe('appended');
    expect(marked((await snapshotOn(TODAY)).config)).toBe(true);
    expect(marked((await snapshotOn(later)).config)).toBe(true);
    expect(await effectiveDates()).toEqual([SINCE, TODAY, later]);
  });

  /** The state a journey west leaves: the boundary written for tomorrow, at an instant already past. */
  async function boundaryTomorrow(): Promise<DateKey> {
    const snapshots = await configSnapshotsRepository.list();
    const first = snapshots[snapshots.length - 1]!;
    const tomorrow = addDays(TODAY, 1);
    await configSnapshotsRepository.replaceAll([
      ...snapshots,
      {
        ...first,
        id: 'cfg_metric',
        effectiveFrom: tomorrow,
        createdAt: `${TODAY}T05:00:00.000Z`,
        config: { ...first.config, scoring: { ...first.config.scoring, gymMetric: { ...GYM_METRIC } } },
      },
    ]);
    return tomorrow;
  }

  it('keeps a boundary already written when the local date has moved back', async () => {
    // Written on the update day's first load — then the local date moved
    // back a day. Today was lived under the old metric and replays so; the
    // era waits for its own date.
    await legacyDevice();
    const tomorrow = await boundaryTomorrow();

    expect(await ensureGymMetricEra()).toBe('unchanged');
    expect(await effectiveDates()).toEqual([SINCE, tomorrow]);
    expect(marked((await snapshotOn(TODAY)).config)).toBe(false);
    expect(marked((await snapshotOn(tomorrow)).config)).toBe(true);
  });

  it('keeps it there through the next write, and a change made that day reaches both sides', async () => {
    await legacyDevice();
    const question = (await questionsRepository.list())[0]!;
    const tomorrow = await boundaryTomorrow();
    expect(await ensureGymMetricEra()).toBe('unchanged');

    // An answer today: nothing about the configuration may move.
    await saveAnswer(TODAY, question.id, 7);
    expect(await effectiveDates()).toEqual([SINCE, tomorrow]);
    expect(marked((await snapshotOn(TODAY)).config)).toBe(false);

    // A question added today: on today without the field, from the boundary with it.
    await addQuestion({ text: 'Neu', type: 'boolean', category: 'eigene' });
    const onDay = (await snapshotOn(TODAY)).config;
    const fromBoundary = (await snapshotOn(tomorrow)).config;
    expect(await effectiveDates()).toEqual([SINCE, TODAY, tomorrow]);
    expect(onDay.questions.some((entry) => entry.text === 'Neu')).toBe(true);
    expect(fromBoundary.questions.some((entry) => entry.text === 'Neu')).toBe(true);
    expect(marked(onDay)).toBe(false);
    expect(fromBoundary.scoring.gymMetric).toEqual(GYM_METRIC);
    // And the step still has nothing to do.
    expect(await ensureGymMetricEra()).toBe('unchanged');
  });

  it('brings a boundary written on a clock that was ahead back to today', async () => {
    await legacyDevice();
    // The first load after the update ran with the clock three days ahead…
    const ahead = addDays(TODAY, 3);
    freezeAt(ahead);
    expect(await ensureGymMetricEra(ahead)).toBe('appended');
    // …and the clock was put right.
    freezeAt(TODAY);
    expect(await ensureGymMetricEra()).toBe('appended');
    expect(marked((await snapshotOn(TODAY)).config)).toBe(true);
    expect(await effectiveDates()).toEqual([SINCE, TODAY, ahead]);
    expect(await ensureGymMetricEra()).toBe('unchanged');
  });

  it('writes nothing before the first day of a profile set up with the clock ahead', async () => {
    const first = addDays(TODAY, 2);
    freezeAt(first);
    await applyOnboarding({ questions: [{ text: 'A', type: 'scale', category: 'eigene' }], gymTargetPerWeek: 3 });
    await withoutGymMetricEra();
    freezeAt(TODAY);

    expect(await ensureGymMetricEra()).toBe('appended');
    const snapshots = await configSnapshotsRepository.list();
    expect(snapshots.map((snapshot) => snapshot.effectiveFrom)).toEqual([first]);
    expect(marked(snapshots[0]!.config)).toBe(true);
  });

  it('leaves a profile with no snapshot at all alone', async () => {
    freezeAt(TODAY);
    expect(await ensureGymMetricEra()).toBe('unchanged');
    expect(await configSnapshotsRepository.list()).toEqual([]);
  });

  it('writes nothing on a device set up under this version: its first snapshot has the field', async () => {
    freezeAt(SINCE);
    await applyOnboarding({ questions: [{ text: 'A', type: 'scale', category: 'eigene' }], gymTargetPerWeek: 3 });
    const snapshots = await configSnapshotsRepository.list();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]!.config.scoring.gymMetric).toEqual(GYM_METRIC);

    freezeAt(TODAY);
    expect(await ensureGymMetricEra()).toBe('unchanged');
    await loadConfiguration();
    expect(await configSnapshotsRepository.list()).toEqual(snapshots);
  });

  it('never throws on a snapshot it cannot read, and leaves it as it is', async () => {
    await legacyDevice();
    const snapshots = await configSnapshotsRepository.list();
    const broken = [
      ...snapshots,
      { id: 'cfg_no_scoring', effectiveFrom: addDays(TODAY, 2), createdAt: `${TODAY}T05:00:00.000Z`, config: { domains: [], questions: [] } },
      { id: 'cfg_null', effectiveFrom: addDays(TODAY, 4), createdAt: `${TODAY}T05:00:00.000Z`, config: null },
    ] as unknown as ConfigSnapshotRecord[];
    await configSnapshotsRepository.replaceAll(broken);

    await expect(ensureGymMetricEra()).resolves.toBe('appended');
    const after = await configSnapshotsRepository.list();
    expect(after.find((snapshot) => snapshot.id === 'cfg_no_scoring')?.config).toEqual({ domains: [], questions: [] });
    expect(after.find((snapshot) => snapshot.id === 'cfg_null')?.config).toBeNull();
    await expect(ensureGymMetricEra()).resolves.toBe('unchanged');
  });

  it('takes a field that is no object as no marker, and writes a real one', async () => {
    await legacyDevice();
    const [first] = await configSnapshotsRepository.list();
    await configSnapshotsRepository.replaceAll([
      { ...first!, config: { ...first!.config, scoring: { ...first!.config.scoring, gymMetric: null as never } } },
    ]);
    expect(await ensureGymMetricEra()).toBe('appended');
    expect((await snapshotOn(TODAY)).config.scoring.gymMetric).toEqual(GYM_METRIC);
  });

  it('starts the era on the next load after an old backup is imported', async () => {
    // A backup from before the update, restored into the updated app later.
    const day = addDays(START, 60);
    await importProfile(currentProfile(), day);
    expect((await configSnapshotsRepository.list()).some((snapshot) => marked(snapshot.config))).toBe(false);

    await loadConfiguration();
    const boundary = await snapshotOn(day);
    expect(boundary.effectiveFrom).toBe(day);
    expect(boundary.config.scoring.gymMetric).toEqual(GYM_METRIC);
    expect(marked((await snapshotOn(addDays(day, -1))).config)).toBe(false);
  });

  it('keeps the boundary of a backup made by this build', async () => {
    const day = addDays(START, 60);
    await importProfile(currentProfile(), day);
    await loadConfiguration();
    const written = await configSnapshotsRepository.list();
    const backup = JSON.stringify(await exportBackup());
    await closeDatabase();

    // Restored three weeks later: the era began where the file says.
    await importProfile(backup, addDays(day, 21));
    await loadConfiguration();
    expect(await configSnapshotsRepository.list()).toEqual(written);
  });

  it('runs on every load, after the steps before it', async () => {
    await legacyDevice();
    await loadConfiguration();
    expect((await snapshotOn(TODAY)).config.scoring.gymMetric).toEqual(GYM_METRIC);
    expect(await effectiveDates()).toEqual([SINCE, TODAY]);
  });
});

/* ── The owner's device ─────────────────────────────────────────────────── */

describe("the owner's device: three activations in one load", () => {
  /**
   * A profile as the live build (`e30becd`) leaves it: Food on, the
   * three-day window, promotion confirmation known, no metric marker.
   */
  function liveProfile(): string {
    const backup = JSON.parse(currentProfile()) as { data: { settings: Record<string, unknown> } };
    backup.data.settings.promotionConfirmation = { from: START, targetRankId: null, eligibleDates: [] };
    return JSON.stringify(backup);
  }
  const UPDATE = addDays(START, 60); // a Thursday

  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  it('writes one snapshot that day, carrying all three, and leaves every earlier one as it was', async () => {
    await importProfile(liveProfile(), UPDATE);
    const before = await configSnapshotsRepository.list();
    expect(before).toHaveLength(1);
    const old = before[0]!.config;
    expect(old.scoring.sessionWindowDays).toBeUndefined();
    expect(old.scoring.gymMetric).toBeUndefined();
    expect(old.domains.find((domain) => domain.type === 'food')?.enabled).toBe(true);

    await loadConfiguration();

    const after = await configSnapshotsRepository.list();
    expect(after.map((snapshot) => snapshot.effectiveFrom)).toEqual([START, UPDATE]);
    expect(after[0]).toEqual(before[0]);
    const update = after[1]!.config;
    // The one-day window (D132)…
    expect(update.scoring.editWindowDays).toBe(1);
    expect(update.scoring.sessionWindowDays).toBe(1);
    // …Food off, the Boss shared over what remains (D139)…
    expect(update.domains.find((domain) => domain.type === 'food')?.enabled).toBe(false);
    expect(Object.keys(update.boss!.weights).sort()).toEqual(['gym', 'mental', 'running']);
    // …and the metric (D150).
    expect(update.scoring.gymMetric).toEqual(GYM_METRIC);
    // Nothing else about the configuration moved.
    expect(update.questions).toEqual(old.questions);
    expect(update.scoring.model).toBe(old.scoring.model);
    expect(update.scoring.gymModel).toBe(old.scoring.gymModel);
    expect(update.scoring.runningModel).toBe(old.scoring.runningModel);
    expect((await domainsRepository.findByType('food'))?.enabled).toBe(false);
  });

  it('writes nothing on the second load', async () => {
    await importProfile(liveProfile(), UPDATE);
    await loadConfiguration();
    const snapshots = await configSnapshotsRepository.list();
    const domains = await domainsRepository.list();
    const boss = await loadBossProgression();

    await loadConfiguration();
    expect(await configSnapshotsRepository.list()).toEqual(snapshots);
    expect(await domainsRepository.list()).toEqual(domains);
    expect(await loadBossProgression()).toEqual(boss);

    // Nor on a load the day after.
    setClock({ now: () => at(addDays(UPDATE, 1)) });
    await loadConfiguration();
    expect(await configSnapshotsRepository.list()).toEqual(snapshots);
  });

  it('leaves every day before the update exactly as the old build showed it', async () => {
    await importProfile(liveProfile(), UPDATE);
    const before = await loadBossProgression();
    await loadConfiguration();
    const after = await loadBossProgression();

    const index = before.history.days.findIndex((day) => day.date === UPDATE);
    expect(index).toBe(60);
    for (let day = 0; day < index; day += 1) {
      expect(dayOutputs(after, day), before.history.days[day]!.date).toEqual(dayOutputs(before, day));
    }
    expect(after.changes.filter((change) => change.date < UPDATE)).toEqual(before.changes.filter((change) => change.date < UPDATE));
  });
});

/* ── No day before the boundary moves ───────────────────────────────────── */

describe('the update day replays every earlier day bit for bit (D150)', () => {
  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  /** Update days: early, before a P8 crossing, after it, in the break, the first of January. */
  const UPDATES = [35, 56, 77, 87, 110];
  /** The update day itself, the next day, a week, a fortnight and a month on. */
  const AFTER = [0, 1, 7, 14, 30];

  async function replay(profile: { seed: number; p8From: number | null }, clock: DateKey, update: DateKey | null) {
    await importProfile(randomGymProfile(profile.seed, { p8From: profile.p8From }), clock);
    if (update) expect(await ensureGymMetricEra(update)).toBe('appended');
    return loadBossProgression(clock);
  }

  for (const profile of RANDOM_GYM_PROFILES) {
    it(`${profile.name}: every output of every day before the update`, async () => {
      let moved = 0;
      for (const offset of UPDATES) {
        const update = addDays(RANDOM_GYM_START, offset);
        for (const after of AFTER) {
          const clock = addDays(update, after);
          if (clock > RANDOM_GYM_LAST) continue;
          const before = await replay(profile, clock, null);
          const updated = await replay(profile, clock, update);
          const boundary = before.history.days.findIndex((day) => day.date === update);
          expect(boundary).toBe(offset);
          for (let index = 0; index < boundary; index += 1) {
            expect(dayOutputs(updated, index), `${before.history.days[index]!.date} at ${clock}`).toEqual(dayOutputs(before, index));
          }
          const changesBefore = (boss: BossProgression) => boss.changes.filter((change) => change.date < update);
          expect(changesBefore(updated), `at ${clock}`).toEqual(changesBefore(before));
          // From the boundary on the two replays are two metrics: count the
          // days whose Gym performance differs, so the proof is not empty.
          for (let index = boundary; index < before.history.days.length; index += 1) {
            const a = updated.gym.detail.find((point) => point.date === before.history.days[index]!.date)?.performance;
            const b = before.gym.detail.find((point) => point.date === before.history.days[index]!.date)?.performance;
            if (a !== b) moved += 1;
          }
        }
      }
      expect(moved, 'the metric changes something from the boundary on').toBeGreaterThan(20);
    });
  }

  it('reads the windows of the update day by the new metric, reaching back over the old sets', async () => {
    const profile = RANDOM_GYM_PROFILES[0]!;
    const update = addDays(RANDOM_GYM_START, 77);
    await importProfile(randomGymProfile(profile.seed, { p8From: profile.p8From }), update);
    await ensureGymMetricEra(update);
    const boss = await loadBossProgression(update);

    // The whole history, valued once by the metric of the day and mapped by
    // the curve its snapshot names (D177)…
    const metric: GymMetric = { repsDivisor: GYM_METRIC.repsDivisor, comparison: GYM_METRIC.comparison };
    const source = await loadExerciseDaySource(RANDOM_GYM_START, update);
    const expected = performanceOn(source.under(metric).days, update, metric, GYM_METRIC.curveDecadePercent);
    expect(boss.gym.trendChange).toBe(percentChange(expected.trend.ratio));
    expect(boss.gym.ytdChange).toBe(percentChange(expected.ytd.ratio));
    expect(boss.gym.performance).toEqual(expected.score);
    // …which is not the curve as it was: the same windows, another level.
    const atTen = performanceOn(source.under(metric).days, update, metric);
    expect(atTen.trend).toEqual(expected.trend);
    expect(atTen.ytd).toEqual(expected.ytd);
    expect(atTen.score.score).not.toBe(expected.score.score);
    // …a baseline from before the boundary, so no window is left empty by it…
    expect(boss.gym.trend?.measured.length).toBeGreaterThan(0);
    // …and not the old metric's answer.
    const legacy = performanceOn(source.under(null).days, update, null);
    expect(boss.gym.trendChange).not.toBe(percentChange(legacy.trend.ratio));
    // The day before reads the old one.
    const yesterday = addDays(update, -1);
    const point = boss.gym.detail.find((entry) => entry.date === yesterday)!;
    expect(point.performance).toBe(performanceOn(source.under(null).days, yesterday, null).score.score);

    // A device a Stage 5b preview left carries the marker without the
    // curve's value: the same windows, mapped by the curve as it was —
    // what this test held before the block "Kurve".
    await withoutGymCurveValue();
    const preview = await loadBossProgression(update);
    expect(preview.gym.trendChange).toBe(boss.gym.trendChange);
    expect(preview.gym.ytdChange).toBe(boss.gym.ytdChange);
    expect(preview.gym.performance).toEqual(atTen.score);
  });

  it('shows the screens the metric of the day the range ends on', async () => {
    const profile = RANDOM_GYM_PROFILES[1]!;
    const update = addDays(RANDOM_GYM_START, 77);
    await importProfile(randomGymProfile(profile.seed, { p8From: profile.p8From }), update);
    const from = addDays(update, -29);
    const before = await loadGymHistory(from, update);
    expect(before.metric).toBeNull();

    await ensureGymMetricEra(update);
    const after = await loadGymHistory(from, update);
    expect(after.metric).toEqual({ repsDivisor: 30, comparison: 'median' });
    // The same range the day before the boundary is still the old metric's.
    const yesterday = await loadGymHistory(addDays(from, -1), addDays(update, -1));
    expect(yesterday.metric).toBeNull();
    // Every day's value is in one unit: the strength score of one of its sets.
    for (const day of after.days) {
      expect(day.best.score).toBe(day.best.set.weightGrams * (30 + day.best.set.reps));
    }
    for (const day of before.days) {
      expect(day.best.score).toBe(day.best.set.weightGrams * day.best.set.reps);
    }
  });
});

/* ── The fixed order ────────────────────────────────────────────────────── */

describe('the same sets under other record ids replay to the same bits (D150)', () => {
  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  /** The profile with every set id replaced, so the set index returns each day's sets in another order. */
  function reId(profile: string, salt: number): string {
    const backup = JSON.parse(profile) as { data: { gymSets: { id: string }[] } };
    let state = salt >>> 0;
    const next = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state;
    };
    for (const set of backup.data.gymSets) set.id = `set_${next().toString(16).padStart(8, '0')}${next().toString(16).padStart(8, '0')}`;
    backup.data.gymSets.reverse();
    return JSON.stringify(backup);
  }

  /** The profile under the Stage 5b metric from its first day. */
  function fromDayOne(profile: string): string {
    const backup = JSON.parse(profile) as { data: { configSnapshots: { config: AppConfigSnapshot }[] } };
    for (const snapshot of backup.data.configSnapshots) {
      snapshot.config.scoring = { ...snapshot.config.scoring, gymMetric: { ...GYM_METRIC } };
    }
    return JSON.stringify(backup);
  }

  /** Everything computed, with the record ids — which differ by construction — left out. */
  async function outputs(profile: string, clock: DateKey) {
    await importProfile(profile, clock);
    const boss = await loadBossProgression(clock);
    const history = await loadGymHistory(addDays(clock, -89), clock);
    const stripId = (day: (typeof history.days)[number]) => ({ ...day, best: { score: day.best.score, reps: day.best.set.reps, weightGrams: day.best.set.weightGrams, order: day.best.set.order } });
    return {
      setsStored: (await gymSetsRepository.getAll()).length,
      boss: boss.points,
      domains: boss.domains.map((domain) => [domain.domain, domain.series, domain.points]),
      gym: boss.gym,
      days: history.days.map(stripId),
      comparisons: [...history.comparisons.entries()],
      recent: history.recent,
      overall: history.overall,
      awaitingBodyweight: history.awaitingBodyweight,
    };
  }

  /** How many numbers differ between two outputs of the same shape. */
  function differences(a: unknown, b: unknown): number {
    if (typeof a === 'number' && typeof b === 'number') return Object.is(a, b) ? 0 : 1;
    if (Array.isArray(a) && Array.isArray(b)) return a.reduce<number>((sum, entry, index) => sum + differences(entry, b[index]), 0);
    if (a instanceof Map && b instanceof Map) return differences([...a.entries()], [...b.entries()]);
    if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
      return Object.keys(a).reduce<number>((sum, key) => sum + differences((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]), 0);
    }
    return 0;
  }

  for (const profile of RANDOM_GYM_PROFILES) {
    it(`${profile.name}: bit for bit under the Stage 5b metric`, async () => {
      const original = fromDayOne(randomGymProfile(profile.seed, { p8From: profile.p8From }));
      const first = await outputs(original, RANDOM_GYM_LAST);
      for (const salt of [1, 2, 3]) {
        const second = await outputs(reId(original, salt), RANDOM_GYM_LAST);
        expect(second.setsStored).toBe(first.setsStored);
        expect(differences(first, second), `salt ${salt}`).toBe(0);
        expect(second).toEqual(first);
      }
    });
  }

  it('which the metric before it does not promise: there the order of the set index is in the sums', async () => {
    // The debt HANDOVER records, shown on these histories — and the reason
    // the order is fixed with the era rather than for every day: a day
    // before the boundary keeps the order, and the bits, it always had.
    let differing = 0;
    for (const profile of RANDOM_GYM_PROFILES) {
      const original = randomGymProfile(profile.seed, { p8From: profile.p8From });
      const first = await outputs(original, RANDOM_GYM_LAST);
      for (const salt of [1, 2, 3]) differing += differences(first, await outputs(reId(original, salt), RANDOM_GYM_LAST));
    }
    expect(differing).toBeGreaterThan(0);
  });
});

/* ── The switch, through the whole replay ───────────────────────────────── */

describe('the comparison a snapshot names is the comparison the rating runs (D150)', () => {
  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  /** The era from `from`, with the switch as given, the way the step writes it. */
  async function eraWith(comparison: 'median' | 'firstLast', from: DateKey): Promise<void> {
    await ensureGymMetricEra(from);
    const all = await configSnapshotsRepository.list();
    await configSnapshotsRepository.replaceAll(
      all.map((snapshot) =>
        marked(snapshot.config)
          ? { ...snapshot, config: { ...snapshot.config, scoring: { ...snapshot.config.scoring, gymMetric: { ...GYM_METRIC, comparison } } } }
          : snapshot,
      ),
    );
  }

  it('follows the switch, value for value, on every day of the era and on none before it', async () => {
    const profile = RANDOM_GYM_PROFILES[2]!;
    const update = addDays(RANDOM_GYM_START, 70);
    const clock = addDays(RANDOM_GYM_START, RANDOM_GYM_DAYS - 20);
    const replayWith = async (comparison: 'median' | 'firstLast') => {
      await importProfile(randomGymProfile(profile.seed, { p8From: profile.p8From }), clock);
      await eraWith(comparison, update);
      const boss = await loadBossProgression(clock);
      const source = await loadExerciseDaySource(RANDOM_GYM_START, clock);
      return { boss, source };
    };
    const median = await replayWith('median');
    const firstLast = await replayWith('firstLast');

    let differing = 0;
    for (const [index, row] of median.boss.history.days.entries()) {
      const a = median.boss.gym.detail.find((point) => point.date === row.date);
      const b = firstLast.boss.gym.detail.find((point) => point.date === row.date);
      if (row.date < update) {
        expect(dayOutputs(median.boss, index), row.date).toEqual(dayOutputs(firstLast.boss, index));
        continue;
      }
      // Each replay is the pure windows of its own switch, and nothing else.
      for (const [replay, comparison] of [[median, 'median'], [firstLast, 'firstLast']] as const) {
        const metric: GymMetric = { repsDivisor: 30, comparison };
        // The era as the step writes it carries the curve's value too (D177).
        const expected = performanceOn(replay.source.under(metric).days, row.date, metric, GYM_METRIC.curveDecadePercent).score.score;
        const actual = replay.boss.gym.detail.find((point) => point.date === row.date)?.performance ?? null;
        expect(actual, `${row.date} under ${comparison}`).toBe(expected);
      }
      if (a?.performance !== b?.performance) differing += 1;
    }
    expect(differing, 'the two rules disagree somewhere in the era').toBeGreaterThan(10);
  });
});
