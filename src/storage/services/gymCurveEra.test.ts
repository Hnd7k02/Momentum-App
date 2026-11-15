import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { GYM_METRIC } from '../../core/config/constants';
import { addDays, type DateKey } from '../../core/dates';
import { gymCurveOf, gymMetricOf, type GymMetric } from '../../core/gym/metric';
import type { AppConfigSnapshot, ConfigSnapshotRecord } from '../../core/model';
import { performanceScore } from '../../core/scoring/performanceCurve';
import { targetRating } from '../../core/scoring/trainingRating';
import { shownPerformance } from '../../features/gym/muscleState';
import { closeDatabase, deleteDatabase } from '../db';
import {
  currentConfigSnapshot,
  ensureCurrentSnapshot,
  ensureFoodRetired,
  ensureGymMetricEra,
  ensureSessionWindowEra,
} from '../configService';
import { configSnapshotsRepository, domainsRepository, questionsRepository } from '../repositories';
import { exportBackup, importBackup } from './backupService';
import { loadBossProgression, type BossProgression } from './bossService';
import { saveAnswer } from './checkInService';
import { addQuestion, applyOnboarding, loadConfiguration } from './configurationService';
import { performanceOn } from './gymRatingService';
import { loadExerciseDaySource, loadGymHistory } from './gymService';
import { withoutGymCurveValue, withoutGymMetricEra } from './fixtures/legacyGymMetric';
import { BREAK_LAST, LAST, START, at, currentProfile, trainingBreakProfile } from './fixtures/profiles';
import {
  RANDOM_GYM_DAYS,
  RANDOM_GYM_LAST,
  RANDOM_GYM_PROFILES,
  RANDOM_GYM_START,
  randomGymProfile,
} from './fixtures/randomGym';
import { dayOutputs } from './fixtures/replayOutputs';

/**
 * The value of the performance curve as part of the Stage 5b era (block
 * "Kurve", D177, D178).
 *
 * The curve's one value travels in the marker of Stage 5b,
 * `scoring.gymMetric.curveDecadePercent`, and a Gym day is scored with the
 * value **its own snapshot** names. A snapshot is in one of three states:
 *
 * - **before** — no marker: the best set by `reps × load`, the curve of the
 *   constants;
 * - **metric only** — the marker without the value, which only a Stage 5b
 *   preview wrote: the new metric, the curve of the constants;
 * - **complete** — the metric and the curve fitted to it.
 *
 * `gymMetricEra.test.ts` holds the step for a device the live build left —
 * *before* to *complete* in one snapshot. This file holds the rest: the
 * step on a device a preview left, in every case the design names
 * (`docs/design/wp3/kurve.md`, section 7); the owner's two devices; the
 * proof that no day before a boundary moves, whichever way the value
 * arrives; that Running does not move on any day; that the value in the
 * snapshot is what the replay runs; and that nothing but the performance
 * level and what follows from it differs.
 */

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

type MarkerState = 'before' | 'metric only' | 'complete';

const stateOf = (config: AppConfigSnapshot): MarkerState =>
  gymMetricOf(config) === null ? 'before' : gymCurveOf(config) === null ? 'metric only' : 'complete';

/** The marker as a Stage 5b preview wrote it. */
const PREVIEW_MARKER = { id: 'bestWorkingSet', repsDivisor: 30, comparison: 'median' };

const list = (): Promise<ConfigSnapshotRecord[]> => configSnapshotsRepository.list();

const snapshotOn = async (date: DateKey): Promise<ConfigSnapshotRecord> =>
  (await configSnapshotsRepository.resolveForDate(date))!;

const stateOn = async (date: DateKey): Promise<MarkerState> => stateOf((await snapshotOn(date)).config);

const effectiveDates = async (): Promise<string[]> => (await list()).map((snapshot) => snapshot.effectiveFrom);

/** Every snapshot's date and state, oldest first. */
const states = async (): Promise<[string, MarkerState][]> =>
  (await list()).map((snapshot) => [snapshot.effectiveFrom, stateOf(snapshot.config)]);

/** `snapshot` with its marker replaced — as a file edited by hand could hold it. */
function withMarker(snapshot: ConfigSnapshotRecord, marker: unknown): ConfigSnapshotRecord {
  return { ...snapshot, config: { ...snapshot.config, scoring: { ...snapshot.config.scoring, gymMetric: marker as never } } };
}

/** `config` with the curve's value taken out of its marker, for comparing everything else. */
function withoutValue(config: AppConfigSnapshot): AppConfigSnapshot {
  const { curveDecadePercent: _value, ...marker } = config.scoring.gymMetric as unknown as Record<string, unknown>;
  void _value;
  return { ...config, scoring: { ...config.scoring, gymMetric: marker as never } };
}

/** Writes `value` as the curve's value into every snapshot that carries a marker. */
async function setCurveValue(value: unknown): Promise<void> {
  const all = await list();
  await configSnapshotsRepository.replaceAll(
    all.map((snapshot) =>
      stateOf(snapshot.config) === 'before'
        ? snapshot
        : withMarker(snapshot, { ...(snapshot.config.scoring.gymMetric as object), curveDecadePercent: value }),
    ),
  );
}

async function importProfile(profile: string, clock: string): Promise<void> {
  await closeDatabase();
  await deleteDatabase();
  setClock({ now: () => at(clock) });
  const result = await importBackup(profile);
  if (!result.ok) throw new Error(result.details.join('; '));
}

/* ── The step on a device a Stage 5b preview left ───────────────────────── */

describe('the activation step on a device a Stage 5b preview left', () => {
  /** A Monday: the device was set up then, by the live build. */
  const SINCE = '2026-02-23';
  /** The Friday of that week: a Stage 5b preview loaded, and wrote its marker. */
  const PREVIEW = '2026-02-27';
  /** The Wednesday after: this build loads for the first time. */
  const TODAY = '2026-03-04';

  beforeEach(async () => {
    await deleteDatabase();
  });

  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  /** Set up on `SINCE` without the metric, the marker without the curve's value from `PREVIEW`. */
  async function previewDevice(): Promise<void> {
    freezeAt(SINCE);
    await applyOnboarding({
      questions: [{ text: 'A', type: 'scale', category: 'eigene' }],
      gymTargetPerWeek: 3,
    });
    await withoutGymMetricEra();
    freezeAt(PREVIEW);
    await ensureGymMetricEra();
    await withoutGymCurveValue();
    freezeAt(TODAY);
  }

  it('is a device with the marker as the preview wrote it: the metric, and no value', async () => {
    await previewDevice();
    expect(await states()).toEqual([[SINCE, 'before'], [PREVIEW, 'metric only']]);
    const marker = (await snapshotOn(TODAY)).config.scoring.gymMetric;
    expect(marker).toStrictEqual(PREVIEW_MARKER);
    expect(gymMetricOf((await snapshotOn(TODAY)).config)).toEqual({ repsDivisor: 30, comparison: 'median' });
    expect(gymCurveOf((await snapshotOn(TODAY)).config)).toBeNull();
  });

  it('adds the value today, and only once', async () => {
    await previewDevice();
    expect(await ensureGymMetricEra()).toBe('appended');

    const from = await snapshotOn(TODAY);
    expect(from.effectiveFrom).toBe(TODAY);
    expect(from.config.scoring.gymMetric).toStrictEqual({ ...GYM_METRIC });
    expect(gymCurveOf(from.config)).toBe(GYM_METRIC.curveDecadePercent);
    // The days since the preview's boundary keep the curve as it was, and
    // the days before it the metric as it was: two boundaries, neither moved.
    expect(await states()).toEqual([[SINCE, 'before'], [PREVIEW, 'metric only'], [TODAY, 'complete']]);
    expect((await snapshotOn(addDays(TODAY, -1))).config.scoring.gymMetric).toStrictEqual(PREVIEW_MARKER);

    const before = await list();
    expect(await ensureGymMetricEra()).toBe('unchanged');
    expect(await list()).toEqual(before);
  });

  it('adds the value and nothing else: the divisor and the comparison of the marker are carried as they were', async () => {
    await previewDevice();
    // A marker with a divisor and a comparison of its own, as a restored file could hold it.
    const own = { id: 'bestWorkingSet', repsDivisor: 25, comparison: 'firstLast' };
    await configSnapshotsRepository.replaceAll(
      (await list()).map((snapshot) => (stateOf(snapshot.config) === 'before' ? snapshot : withMarker(snapshot, own))),
    );
    const before = (await snapshotOn(TODAY)).config;

    expect(await ensureGymMetricEra()).toBe('appended');
    const after = (await snapshotOn(TODAY)).config;
    expect(after.scoring.gymMetric).toStrictEqual({ ...own, curveDecadePercent: GYM_METRIC.curveDecadePercent });
    expect(withoutValue(after)).toStrictEqual(before);
    expect(Object.keys(after.scoring)).toEqual(Object.keys(before.scoring));
    expect(gymMetricOf(after)).toEqual({ repsDivisor: 25, comparison: 'firstLast' });
  });

  it('writes byte for byte what the next write would, so nothing follows it', async () => {
    await previewDevice();
    await ensureGymMetricEra();
    const written = await list();
    // Key for key in the order the live configuration has them: the log compares as text.
    expect(JSON.stringify(written[written.length - 1]!.config)).toBe(JSON.stringify(await currentConfigSnapshot()));
    await ensureCurrentSnapshot();
    expect(await list()).toEqual(written);
  });

  it('carries over a snapshot already written today, with the value added', async () => {
    await previewDevice();
    // A configuration change made today by the preview, before this build loaded.
    await addQuestion({ text: 'Neu', type: 'boolean', category: 'eigene' });
    await withoutGymCurveValue();
    const today = await snapshotOn(TODAY);
    expect(today.effectiveFrom).toBe(TODAY);
    expect(stateOf(today.config)).toBe('metric only');

    expect(await ensureGymMetricEra()).toBe('appended');
    const after = await snapshotOn(TODAY);
    expect(after.id).toBe(today.id);
    expect(withoutValue(after.config)).toStrictEqual(today.config);
    expect(await states()).toEqual([[SINCE, 'before'], [PREVIEW, 'metric only'], [TODAY, 'complete']]);
  });

  it('gives a snapshot dated after today the value at its own date', async () => {
    await previewDevice();
    const snapshots = await list();
    const last = snapshots[snapshots.length - 1]!;
    const later = addDays(TODAY, 3);
    await configSnapshotsRepository.replaceAll([...snapshots, { ...last, id: 'cfg_later', effectiveFrom: later }]);

    expect(await ensureGymMetricEra()).toBe('appended');
    expect(await states()).toEqual([
      [SINCE, 'before'],
      [PREVIEW, 'metric only'],
      [TODAY, 'complete'],
      [later, 'complete'],
    ]);
    expect(await ensureGymMetricEra()).toBe('unchanged');
  });

  /** The state a journey west leaves: the value written for tomorrow, at an instant already past. */
  async function valueTomorrow(): Promise<DateKey> {
    const snapshots = await list();
    const last = snapshots[snapshots.length - 1]!;
    const tomorrow = addDays(TODAY, 1);
    await configSnapshotsRepository.replaceAll([
      ...snapshots,
      { ...withMarker(last, { ...GYM_METRIC }), id: 'cfg_curve', effectiveFrom: tomorrow, createdAt: `${TODAY}T05:00:00.000Z` },
    ]);
    return tomorrow;
  }

  it('keeps a boundary already written when the local date has moved back', async () => {
    // Today was lived under the metric and the curve as it was, and replays
    // so; the value waits for its own date.
    await previewDevice();
    const tomorrow = await valueTomorrow();

    expect(await ensureGymMetricEra()).toBe('unchanged');
    expect(await states()).toEqual([[SINCE, 'before'], [PREVIEW, 'metric only'], [tomorrow, 'complete']]);
    expect(await stateOn(TODAY)).toBe('metric only');
  });

  it('keeps it there through the next write, and a change made that day reaches both sides', async () => {
    await previewDevice();
    const question = (await questionsRepository.list())[0]!;
    const tomorrow = await valueTomorrow();
    expect(await ensureGymMetricEra()).toBe('unchanged');

    // An answer today: nothing about the configuration may move.
    await saveAnswer(TODAY, question.id, 7);
    expect(await states()).toEqual([[SINCE, 'before'], [PREVIEW, 'metric only'], [tomorrow, 'complete']]);

    // A question added today: on today with the marker as that day had it —
    // no value —, from the boundary with the whole of it.
    await addQuestion({ text: 'Neu', type: 'boolean', category: 'eigene' });
    const onDay = (await snapshotOn(TODAY)).config;
    const fromBoundary = (await snapshotOn(tomorrow)).config;
    expect(await effectiveDates()).toEqual([SINCE, PREVIEW, TODAY, tomorrow]);
    expect(onDay.questions.some((entry) => entry.text === 'Neu')).toBe(true);
    expect(fromBoundary.questions.some((entry) => entry.text === 'Neu')).toBe(true);
    expect(onDay.scoring.gymMetric).toStrictEqual(PREVIEW_MARKER);
    expect(fromBoundary.scoring.gymMetric).toStrictEqual({ ...GYM_METRIC });
    // And the step still has nothing to do.
    expect(await ensureGymMetricEra()).toBe('unchanged');
  });

  it('brings a value written on a clock that was ahead back to today', async () => {
    await previewDevice();
    // The first load of this build ran with the clock three days ahead…
    const ahead = addDays(TODAY, 3);
    freezeAt(ahead);
    expect(await ensureGymMetricEra(ahead)).toBe('appended');
    // …and the clock was put right.
    freezeAt(TODAY);
    expect(await ensureGymMetricEra()).toBe('appended');
    expect(await states()).toEqual([
      [SINCE, 'before'],
      [PREVIEW, 'metric only'],
      [TODAY, 'complete'],
      [ahead, 'complete'],
    ]);
    expect(await ensureGymMetricEra()).toBe('unchanged');
  });

  it('writes nothing before the first day of a profile set up with the clock ahead, and completes that day', async () => {
    const first = addDays(TODAY, 2);
    freezeAt(first);
    await applyOnboarding({ questions: [{ text: 'A', type: 'scale', category: 'eigene' }], gymTargetPerWeek: 3 });
    await withoutGymCurveValue();
    freezeAt(TODAY);

    expect(await ensureGymMetricEra()).toBe('appended');
    expect(await states()).toEqual([[first, 'complete']]);
  });

  /** Values a restored file could hold where the curve's value stands, and none of them is one. */
  const UNREADABLE: [string, unknown][] = [
    ['a string', '3'],
    ['zero', 0],
    ['a negative number', -3],
    ['null', null],
    ['not a number', Number.NaN],
    ['infinity', Number.POSITIVE_INFINITY],
    ['a number so small that its rate is not finite', 1e-320],
    ['an object', { value: 3 }],
  ];

  for (const [name, value] of UNREADABLE) {
    it(`takes ${name} as no value: the curve as it was, and the step writes a real one`, async () => {
      await previewDevice();
      await setCurveValue(value);
      expect(await stateOn(TODAY)).toBe('metric only');
      // Nothing throws on it, in the step or in the replay.
      await expect(loadBossProgression()).resolves.toBeDefined();
      await expect(ensureGymMetricEra()).resolves.toBe('appended');

      expect((await snapshotOn(TODAY)).config.scoring.gymMetric).toStrictEqual({ ...GYM_METRIC });
      // The snapshot that held it is left as it is.
      const kept = (await snapshotOn(PREVIEW)).config.scoring.gymMetric as unknown as { curveDecadePercent: unknown };
      expect(Object.is(kept.curveDecadePercent, value) || JSON.stringify(kept.curveDecadePercent) === JSON.stringify(value)).toBe(true);
      await expect(ensureGymMetricEra()).resolves.toBe('unchanged');
    });
  }

  it('runs on every load, after the steps before it, and a second load writes nothing', async () => {
    await previewDevice();
    await loadConfiguration();
    const written = await list();
    expect(written.map((snapshot) => [snapshot.effectiveFrom, stateOf(snapshot.config)])).toEqual([
      [SINCE, 'before'],
      [PREVIEW, 'metric only'],
      [TODAY, 'complete'],
    ]);
    await loadConfiguration();
    expect(await list()).toEqual(written);
    // Nor a load the day after.
    freezeAt(addDays(TODAY, 1));
    await loadConfiguration();
    expect(await list()).toEqual(written);
  });

  it('adds the value on the next load after a backup of a Stage 5b preview is imported', async () => {
    // A device the live build left, updated by a 5b preview on `first`, exported there…
    const first = addDays(START, 40);
    await importProfile(currentProfile(), first);
    await loadConfiguration();
    await withoutGymCurveValue();
    const preview = await list();
    expect(preview.map((snapshot) => [snapshot.effectiveFrom, stateOf(snapshot.config)])).toEqual([
      [START, 'before'],
      [first, 'metric only'],
    ]);
    const backup = JSON.stringify(await exportBackup());
    expect(backup).not.toContain('curveDecadePercent');

    // …and restored into this build three weeks later.
    const day = addDays(first, 21);
    await importProfile(backup, day);
    expect(await list()).toEqual(preview);
    await loadConfiguration();
    const after = await list();
    expect(after.slice(0, 2)).toEqual(preview);
    expect(after.map((snapshot) => [snapshot.effectiveFrom, stateOf(snapshot.config)])).toEqual([
      [START, 'before'],
      [first, 'metric only'],
      [day, 'complete'],
    ]);
    // The value is all that day's snapshot adds.
    expect(withoutValue(after[2]!.config)).toStrictEqual(preview[1]!.config);
  });

  it('keeps both boundaries of a backup made by this build', async () => {
    const first = addDays(START, 40);
    const second = addDays(first, 21);
    await importProfile(currentProfile(), first);
    await loadConfiguration();
    await withoutGymCurveValue();
    setClock({ now: () => at(second) });
    await loadConfiguration();
    const written = await list();
    expect(written.map((snapshot) => stateOf(snapshot.config))).toEqual(['before', 'metric only', 'complete']);
    const backup = JSON.stringify(await exportBackup());

    // Restored three weeks later: both eras began where the file says.
    await importProfile(backup, addDays(second, 21));
    await loadConfiguration();
    expect(await list()).toEqual(written);
  });
});

/* ── The owner's two devices ────────────────────────────────────────────── */

describe("the owner's devices", () => {
  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

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

  it('the live app: three older activations and this one in one load, one snapshot, and the second load writes nothing', async () => {
    await importProfile(liveProfile(), UPDATE);
    const before = await list();
    expect(before).toHaveLength(1);
    expect(stateOf(before[0]!.config)).toBe('before');

    await loadConfiguration();

    const after = await list();
    expect(after.map((snapshot) => snapshot.effectiveFrom)).toEqual([START, UPDATE]);
    expect(after[0]).toEqual(before[0]);
    const update = after[1]!.config;
    // The one-day window (D132), Food off (D139), the metric (D150)…
    expect(update.scoring.sessionWindowDays).toBe(1);
    expect(update.domains.find((domain) => domain.type === 'food')?.enabled).toBe(false);
    expect(gymMetricOf(update)).toEqual({ repsDivisor: 30, comparison: 'median' });
    // …and the curve fitted to it (D177), in the same snapshot.
    expect(gymCurveOf(update)).toBe(GYM_METRIC.curveDecadePercent);
    expect(update.scoring.gymMetric).toStrictEqual({ ...GYM_METRIC });

    const domains = await domainsRepository.list();
    const boss = await loadBossProgression();
    await loadConfiguration();
    expect(await list()).toEqual(after);
    expect(await domainsRepository.list()).toEqual(domains);
    expect(await loadBossProgression()).toEqual(boss);
    setClock({ now: () => at(addDays(UPDATE, 1)) });
    await loadConfiguration();
    expect(await list()).toEqual(after);
  });

  it('the preview: its first load of this build adds the value and nothing else, and its days in between replay as they were', async () => {
    // The import file of the Stage 5b check, as the owner's preview holds it:
    // imported, and loaded by a Stage 5b preview on the second of November.
    const file = readFileSync(new URL('../../../docs/wp3/stage5b/momentum-pruefdaten-5b.json', import.meta.url), 'utf8');
    const previewDay = '2026-11-02';
    const today = '2026-11-15';
    await importProfile(file, today);
    await ensureSessionWindowEra(previewDay);
    await ensureFoodRetired(previewDay);
    await ensureGymMetricEra(previewDay);
    await withoutGymCurveValue();
    const held = await list();
    expect(held.map((snapshot) => [snapshot.effectiveFrom, stateOf(snapshot.config)])).toEqual([
      ['2026-10-12', 'before'],
      [previewDay, 'metric only'],
    ]);
    const asThePreviewShowedIt = await loadBossProgression();

    await loadConfiguration();
    const after = await list();
    expect(after.slice(0, 2)).toEqual(held);
    expect(after.map((snapshot) => [snapshot.effectiveFrom, stateOf(snapshot.config)])).toEqual([
      ['2026-10-12', 'before'],
      [previewDay, 'metric only'],
      [today, 'complete'],
    ]);
    expect(withoutValue(after[2]!.config)).toStrictEqual(held[1]!.config);

    // Every day before today is what the preview showed; today is scored with the new curve.
    const now = await loadBossProgression();
    const last = now.history.days.length - 1;
    expect(now.history.days[last]!.date).toBe(today);
    for (let index = 0; index < last; index += 1) {
      expect(dayOutputs(now, index), now.history.days[index]!.date).toEqual(dayOutputs(asThePreviewShowedIt, index));
    }
    expect(now.gym.performance.score).toBeGreaterThan(asThePreviewShowedIt.gym.performance.score!);
    expect(now.gym.rating).toBeGreaterThan(asThePreviewShowedIt.gym.rating);

    // And the second load writes nothing.
    await loadConfiguration();
    expect(await list()).toEqual(after);
  });
});

/* ── No day before a boundary moves ─────────────────────────────────────── */

describe('no day before a boundary moves, whichever way the value arrives (D177)', () => {
  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  type Build = 'never' | 'stage5b' | 'kurve';

  /**
   * The history as replayed on `clock`: by a build before Stage 5b
   * (`never`), by Stage 5b as it was built — the marker without the value —
   * (`stage5b`), or by this build (`kurve`), each updated on `update`.
   */
  async function replay(profile: { seed: number; p8From: number | null }, clock: DateKey, update: DateKey, build: Build) {
    await importProfile(randomGymProfile(profile.seed, { p8From: profile.p8From }), clock);
    if (build !== 'never') {
      expect(await ensureGymMetricEra(update)).toBe('appended');
      if (build === 'stage5b') await withoutGymCurveValue();
    }
    return loadBossProgression(clock);
  }

  const changesBefore = (boss: BossProgression, date: DateKey) => boss.changes.filter((change) => change.date < date);

  /** Update days: early, before a P8 crossing, after it, in the break, the first of January. */
  const UPDATES = [35, 56, 77, 87, 110];
  /**
   * The update day itself, a week and a month on. (`gymMetricEra.test.ts`
   * holds this build against the one before Stage 5b on five clocks; here
   * all three builds stand side by side.)
   */
  const AFTER = [0, 7, 30];

  for (const profile of RANDOM_GYM_PROFILES) {
    it(`${profile.name}: metric and curve in one snapshot — every output of every day before the update`, async () => {
      let moved = 0;
      for (const offset of UPDATES) {
        const update = addDays(RANDOM_GYM_START, offset);
        for (const after of AFTER) {
          const clock = addDays(update, after);
          if (clock > RANDOM_GYM_LAST) continue;
          const never = await replay(profile, clock, update, 'never');
          const stage5b = await replay(profile, clock, update, 'stage5b');
          const kurve = await replay(profile, clock, update, 'kurve');
          const boundary = never.history.days.findIndex((day) => day.date === update);
          expect(boundary).toBe(offset);
          for (let index = 0; index < boundary; index += 1) {
            const label = `${never.history.days[index]!.date} at ${clock}`;
            expect(dayOutputs(kurve, index), label).toEqual(dayOutputs(never, index));
            expect(dayOutputs(stage5b, index), label).toEqual(dayOutputs(never, index));
          }
          expect(changesBefore(kurve, update), `at ${clock}`).toEqual(changesBefore(never, update));
          // From the boundary on this build and Stage 5b are two curves over
          // the same windows: count the days whose level differs, so the
          // proof is not empty.
          for (let index = boundary; index < never.history.days.length; index += 1) {
            const date = never.history.days[index]!.date;
            const a = kurve.gym.detail.find((point) => point.date === date)?.performance;
            const b = stage5b.gym.detail.find((point) => point.date === date)?.performance;
            if (a !== b) moved += 1;
          }
        }
      }
      expect(moved, 'the curve changes something from the boundary on').toBeGreaterThan(20);
    });
  }

  /** The preview's boundary and, later, the value's: day indices. */
  const TWO_BOUNDARIES: [number, number][] = [[35, 56], [56, 87], [77, 110], [87, 88]];

  for (const profile of RANDOM_GYM_PROFILES) {
    it(`${profile.name}: the value after the metric — no day before either boundary moves`, async () => {
      let moved = 0;
      for (const [first, second] of TWO_BOUNDARIES) {
        const previewDay = addDays(RANDOM_GYM_START, first);
        const update = addDays(RANDOM_GYM_START, second);
        for (const clock of [update, addDays(update, 14), RANDOM_GYM_LAST]) {
          if (clock > RANDOM_GYM_LAST) continue;
          const never = await replay(profile, clock, previewDay, 'never');
          const preview = await replay(profile, clock, previewDay, 'stage5b');
          // The same device after its first load of this build, on `update`.
          await importProfile(randomGymProfile(profile.seed, { p8From: profile.p8From }), clock);
          await ensureGymMetricEra(previewDay);
          await withoutGymCurveValue();
          expect(await ensureGymMetricEra(update)).toBe('appended');
          // Three eras, by date — a profile's own later snapshot takes the state of its day.
          for (const [date, state] of await states()) {
            expect(state, date).toBe(date < previewDay ? 'before' : date < update ? 'metric only' : 'complete');
          }
          expect([await stateOn(previewDay), await stateOn(addDays(update, -1)), await stateOn(update)])
            .toEqual(['metric only', 'metric only', 'complete']);
          const both = await loadBossProgression(clock);

          for (const [index, row] of both.history.days.entries()) {
            const label = `${row.date} at ${clock}`;
            // Before the preview: the build before Stage 5b. Between the two
            // boundaries: what the preview showed, the curve at ten.
            if (index < first) expect(dayOutputs(both, index), label).toEqual(dayOutputs(never, index));
            else if (index < second) expect(dayOutputs(both, index), label).toEqual(dayOutputs(preview, index));
            else if (both.gym.detail.find((point) => point.date === row.date)?.performance !== preview.gym.detail.find((point) => point.date === row.date)?.performance) moved += 1;
          }
          expect(changesBefore(both, update), `at ${clock}`).toEqual(changesBefore(preview, update));
        }
      }
      expect(moved, 'the value changes something from its own boundary on').toBeGreaterThan(20);
    });
  }
});

/* ── Running ────────────────────────────────────────────────────────────── */

describe('Running does not move on any day (D177)', () => {
  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  /** Everything Running: its rating state in full and its ledger on the Boss. */
  const runningOf = (boss: BossProgression) => ({
    state: boss.running,
    ledger: boss.domains.find((entry) => entry.domain === 'running'),
  });

  /** What the Gym rating stands at on each day. */
  const gymOf = (boss: BossProgression) => boss.gym.points.map((point) => point.rating);

  const CASES: [string, () => string, DateKey, number][] = [
    ['ninety days of four domains', currentProfile, LAST, 45],
    ['a hundred and eighty days with a break in each training domain', trainingBreakProfile, BREAK_LAST, 100],
  ];

  for (const [name, profile, clock, updateDay] of CASES) {
    it(`${name}: the same history without the era, with the metric, and with every value of the curve — every output field of Running the same`, async () => {
      const update = addDays(START, updateDay);
      const replayWith = async (build: (() => Promise<void>) | null): Promise<BossProgression> => {
        await importProfile(profile(), clock);
        if (build !== null) {
          await ensureGymMetricEra(update);
          await build();
        }
        return loadBossProgression(clock);
      };
      const never = await replayWith(null);
      const variants: [string, BossProgression][] = [
        ['the marker without the value', await replayWith(withoutGymCurveValue)],
        ['the value this build writes', await replayWith(async () => {})],
        ['a steeper value', await replayWith(() => setCurveValue(2))],
        ['a flatter value', await replayWith(() => setCurveValue(6))],
        ['the value of the constants, written out', await replayWith(() => setCurveValue(10))],
      ];

      // There is something to compare: Running was scored on these days.
      expect(never.running.detail.filter((point) => point.performance !== null).length).toBeGreaterThan(20);
      for (const [label, boss] of variants) {
        expect(runningOf(boss), label).toEqual(runningOf(never));
      }
      // And the proof is not empty: Gym, on the same days, is not the same.
      const built = variants[1]![1];
      const stage5b = variants[0]![1];
      expect(gymOf(built)).not.toEqual(gymOf(never));
      expect(gymOf(built)).not.toEqual(gymOf(stage5b));
      expect(gymOf(variants[2]![1])).not.toEqual(gymOf(built));
    });
  }

  it('a device under this version from its first day: Running as on a device without the era', async () => {
    /** The profile with `marker` in every snapshot from day one. */
    const fromDayOne = (marker: object | null): string => {
      const backup = JSON.parse(currentProfile()) as { data: { configSnapshots: { config: AppConfigSnapshot }[] } };
      if (marker !== null) {
        for (const snapshot of backup.data.configSnapshots) {
          snapshot.config.scoring = { ...snapshot.config.scoring, gymMetric: marker as never };
        }
      }
      return JSON.stringify(backup);
    };
    const replayOf = async (marker: object | null): Promise<BossProgression> => {
      await importProfile(fromDayOne(marker), LAST);
      return loadBossProgression(LAST);
    };
    const never = await replayOf(null);
    const complete = await replayOf({ ...GYM_METRIC });
    const metricOnly = await replayOf(PREVIEW_MARKER);
    expect(runningOf(complete)).toEqual(runningOf(never));
    expect(runningOf(metricOnly)).toEqual(runningOf(never));
    expect(gymOf(complete)).not.toEqual(gymOf(metricOnly));
  });

  it("Running's level is the curve of the constants, and not the curve Gym's snapshot names", async () => {
    await importProfile(currentProfile(), LAST);
    await ensureGymMetricEra(addDays(START, 45));
    const boss = await loadBossProgression(LAST);
    expect(await stateOn(LAST)).toBe('complete');

    const changes = { trendChange: boss.running.trendChange, ytdChange: boss.running.ytdChange };
    expect(changes.trendChange).not.toBeNull();
    expect(changes.trendChange).not.toBe(0);
    // Called as Running calls it: without a value.
    expect(boss.running.performance).toEqual(performanceScore(changes));
    expect(boss.running.performance).not.toEqual(performanceScore(changes, GYM_METRIC.curveDecadePercent));
  });
});

/* ── The value in the snapshot is the curve the rating runs ─────────────── */

describe('the value a snapshot names is the curve the rating runs (D177)', () => {
  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  const profile = RANDOM_GYM_PROFILES[2]!;
  const update = addDays(RANDOM_GYM_START, 70);
  const clock = addDays(RANDOM_GYM_START, RANDOM_GYM_DAYS - 20);
  const metric: GymMetric = { repsDivisor: GYM_METRIC.repsDivisor, comparison: GYM_METRIC.comparison };

  /** The era from `update`, with the curve's value as given — `null` for the marker without one. */
  async function replayWith(value: number | null) {
    await importProfile(randomGymProfile(profile.seed, { p8From: profile.p8From }), clock);
    await ensureGymMetricEra(update);
    if (value === null) await withoutGymCurveValue();
    else await setCurveValue(value);
    const boss = await loadBossProgression(clock);
    const source = await loadExerciseDaySource(RANDOM_GYM_START, clock);
    return { boss, source };
  }

  it('follows the value, day for day, on every day of the era and on none before it', async () => {
    // Values this build does not ship among them: what runs is read from the
    // snapshot, and the constant beside `GYM_METRIC` is only what the step writes.
    const values = [2, 2.5, GYM_METRIC.curveDecadePercent, 4, 6];
    const replays = new Map<number, Awaited<ReturnType<typeof replayWith>>>();
    for (const value of values) replays.set(value, await replayWith(value));
    const first = replays.get(values[0]!)!;

    const differing = new Map(values.map((value) => [value, 0]));
    for (const [index, row] of first.boss.history.days.entries()) {
      for (const value of values) {
        const replay = replays.get(value)!;
        if (row.date < update) {
          expect(dayOutputs(replay.boss, index), `${row.date} at ${value}`).toEqual(dayOutputs(first.boss, index));
          continue;
        }
        // Each replay is the pure windows of the day, mapped by the value its snapshot names.
        const expected = performanceOn(replay.source.under(metric).days, row.date, metric, value).score.score;
        const actual = replay.boss.gym.detail.find((point) => point.date === row.date)?.performance ?? null;
        expect(actual, `${row.date} at ${value}`).toBe(expected);
        const other = first.boss.gym.detail.find((point) => point.date === row.date)?.performance ?? null;
        if (actual !== other) differing.set(value, differing.get(value)! + 1);
      }
    }
    for (const value of values.slice(1)) {
      expect(differing.get(value), `${value} against ${values[0]}`).toBeGreaterThan(10);
    }
  });

  it('reads a marker without a value, and the value ten written out, as the same curve: the constants', async () => {
    const absent = await replayWith(null);
    const ten = await replayWith(10);
    expect(ten.boss.points).toEqual(absent.boss.points);
    expect(ten.boss.gym).toEqual(absent.boss.gym);
    expect(ten.boss.domains).toEqual(absent.boss.domains);
    // Which is what `performanceOn()` gives without a value.
    for (const point of absent.boss.gym.detail) {
      if (point.date < update || point.performance === null) continue;
      expect(point.performance, point.date).toBe(performanceOn(absent.source.under(metric).days, point.date, metric).score.score);
    }
  });

  it('keeps each day of a history lived under two values on its own', async () => {
    // The metric from `update` with one value, another from three weeks on —
    // a device that loaded a preview with a value the owner then changed.
    const second = addDays(update, 21);
    await importProfile(randomGymProfile(profile.seed, { p8From: profile.p8From }), clock);
    await ensureGymMetricEra(update);
    await setCurveValue(6);
    const snapshots = await list();
    const era = snapshots[snapshots.length - 1]!;
    expect(era.effectiveFrom).toBe(update);
    await configSnapshotsRepository.replaceAll([
      ...snapshots,
      { ...withMarker(era, { ...GYM_METRIC, curveDecadePercent: 2.5 }), id: 'cfg_second_value', effectiveFrom: second },
    ]);
    const boss = await loadBossProgression(clock);
    const source = await loadExerciseDaySource(RANDOM_GYM_START, clock);

    let scored = 0;
    for (const point of boss.gym.detail) {
      if (point.date < update || point.performance === null) continue;
      const value = point.date < second ? 6 : 2.5;
      expect(point.performance, point.date).toBe(performanceOn(source.under(metric).days, point.date, metric, value).score.score);
      scored += 1;
    }
    expect(scored).toBeGreaterThan(30);
  });

  it("gives the Gym screen its level and its target out of that calculation, on the day the replay ends", async () => {
    for (const value of [GYM_METRIC.curveDecadePercent, 5]) {
      const { boss, source } = await replayWith(value);
      const today = boss.gym.detail[boss.gym.detail.length - 1]!;
      expect(today.date).toBe(clock);
      const pure = performanceOn(source.under(metric).days, clock, metric, value);
      // The level the screen prints…
      expect(boss.gym.performance, `at ${value}`).toEqual(pure.score);
      expect(boss.gym.performance.score).not.toBeNull();
      // …the day's own level, and the target the rating moves towards.
      expect(today.performance).toBe(pure.score.score);
      expect(today.target).toBe(targetRating({ attendance: today.attendance, performance: pure.score.score }));
    }
  });
});

/* ── Nothing but the level, and what follows from it ────────────────────── */

describe('the curve moves the level and nothing a level does not reach (D177)', () => {
  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  for (const profile of RANDOM_GYM_PROFILES) {
    it(`${profile.name}: the same sets under Stage 5b's curve and under this build's`, async () => {
      const update = addDays(RANDOM_GYM_START, 77);
      const read = async (stage5b: boolean) => {
        await importProfile(randomGymProfile(profile.seed, { p8From: profile.p8From }), RANDOM_GYM_LAST);
        await ensureGymMetricEra(update);
        if (stage5b) await withoutGymCurveValue();
        const boss = await loadBossProgression(RANDOM_GYM_LAST);
        const month = await loadGymHistory(addDays(RANDOM_GYM_LAST, -29), RANDOM_GYM_LAST);
        const quarter = await loadGymHistory(addDays(RANDOM_GYM_LAST, -89), RANDOM_GYM_LAST);
        return { boss, month, quarter };
      };
      const before = await read(true);
      const after = await read(false);

      // What the Gym screens show of the sets: the exercise-days, the
      // percentage changes, the muscle groups and their states.
      expect(after.month).toEqual(before.month);
      expect(after.quarter).toEqual(before.quarter);
      expect(shownPerformance(after.month.days, after.month.overall)).toEqual(shownPerformance(before.month.days, before.month.overall));
      expect(shownPerformance(after.quarter.days, after.quarter.overall)).toEqual(shownPerformance(before.quarter.days, before.quarter.overall));

      // The windows of the rating and everything about attendance.
      const { gym } = after.boss;
      expect(gym.trend).toEqual(before.boss.gym.trend);
      expect(gym.ytd).toEqual(before.boss.gym.ytd);
      expect([gym.trendChange, gym.ytdChange]).toEqual([before.boss.gym.trendChange, before.boss.gym.ytdChange]);
      expect([gym.origin, gym.ageMonths, gym.model, gym.sessionsThisWeek, gym.weeklyTarget, gym.endurance, gym.promotionUnlocked])
        .toEqual([before.boss.gym.origin, before.boss.gym.ageMonths, before.boss.gym.model, before.boss.gym.sessionsThisWeek, before.boss.gym.weeklyTarget, before.boss.gym.endurance, before.boss.gym.promotionUnlocked]);
      expect(gym.detail.map((point) => [point.date, point.attendance, point.skipped])).toEqual(before.boss.gym.detail.map((point) => [point.date, point.attendance, point.skipped]));
      // Which windows had a baseline is a fact about the sets, not about the curve.
      expect(gym.performance.components).toEqual(before.boss.gym.performance.components);

      // The days themselves, every other domain, and lifetime XP.
      expect(after.boss.history).toEqual(before.boss.history);
      expect(after.boss.lifetimeXp).toBe(before.boss.lifetimeXp);
      expect(after.boss.running).toEqual(before.boss.running);
      for (const domain of after.boss.domains) {
        if (domain.domain === 'gym') continue;
        expect(domain, domain.domain).toEqual(before.boss.domains.find((entry) => entry.domain === domain.domain));
      }

      // What does differ, from the boundary on: the level, and with it the
      // target, the rating and the Boss.
      const levels = (boss: BossProgression) => boss.gym.detail.filter((point) => point.date >= update).map((point) => point.performance);
      expect(levels(after.boss)).not.toEqual(levels(before.boss));
      expect(after.boss.gym.rating).not.toBe(before.boss.gym.rating);
    });
  }
});
