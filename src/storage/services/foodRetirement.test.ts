import 'fake-indexeddb/auto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { equalWeights, weightsForSnapshot, type BossWeights } from '../../core/boss';
import { setClock } from '../../core/clock';
import { buildConfigSnapshot } from '../../core/config/snapshot';
import { addDays, type DateKey } from '../../core/dates';
import type { AppConfigSnapshot } from '../../core/model';
import { closeDatabase, deleteDatabase } from '../db';
import { ensureCurrentSnapshot, ensureFoodRetired, ensureSessionWindowEra } from '../configService';
import {
  configSnapshotsRepository,
  domainsRepository,
  foodDaysRepository,
  questionsRepository,
  settingsRepository,
} from '../repositories';
import { importBackup } from './backupService';
import { loadBossProgression, type BossProgression } from './bossService';
import { applyOnboarding, bossWeightingOf, loadConfiguration, setBossWeights } from './configurationService';
import { enableLegacyFood, rateLegacyFood } from './fixtures/legacyFood';
import {
  FOOD_OFF_CLOCKS,
  FOOD_OFF_FROM,
  START,
  at,
  confirmationProfile,
  currentProfile,
  foodOffProfile,
  p8CrossingProfile,
} from './fixtures/profiles';

/**
 * Food switched off as an era (WP3 Stage 4 — D139, D140).
 *
 * The first load after the update switches Food off from that day wherever
 * it is still on: the live record, the snapshot in force, a snapshot dated
 * later. Every day before replays exactly as it did; from that day the Boss
 * moves by the remaining domains alone, with the weights worked out again
 * over them; and no Food row is ever deleted.
 */

const PARTS: BossWeights = { mental: 4, gym: 3, running: 2, food: 1 };
const REMAINING = ['mental', 'gym', 'running'] as const;

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

const foodOn = (config: AppConfigSnapshot) =>
  config.domains.some((domain) => domain.type === 'food' && domain.enabled);

/* ── The step itself ────────────────────────────────────────────────────── */

describe('the switch-off step', () => {
  /** A Monday: Food on since then, on a device from before the update. */
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

  async function legacyDevice(parts?: BossWeights): Promise<void> {
    freezeAt(SINCE);
    await applyOnboarding({
      questions: [{ text: 'A', type: 'scale', category: 'eigene' }],
      gymTargetPerWeek: 3,
      runningTargetPerWeek: 2,
    });
    if (parts) await setBossWeights(parts);
    await enableLegacyFood(SINCE);
    freezeAt(TODAY);
  }

  const snapshotOn = async (date: DateKey) => (await configSnapshotsRepository.resolveForDate(date))!;

  it('switches Food off from today, and only once', async () => {
    await legacyDevice();
    expect(await ensureFoodRetired()).toBe('retired');

    const off = await snapshotOn(TODAY);
    expect(off.effectiveFrom).toBe(TODAY);
    expect(foodOn(off.config)).toBe(false);
    // Yesterday was lived with Food, and stays so.
    expect(foodOn((await snapshotOn(addDays(TODAY, -1))).config)).toBe(true);

    const count = (await configSnapshotsRepository.list()).length;
    expect(await ensureFoodRetired()).toBe('unchanged');
    expect(await configSnapshotsRepository.list()).toHaveLength(count);
  });

  it('keeps the Food record and its settings, switched off (P2)', async () => {
    await legacyDevice();
    // The old build kept the user's focus sentence on the record.
    freezeAt(SINCE);
    const food = (await domainsRepository.findByType('food'))!;
    await domainsRepository.updateSettings(food.id, { focus: 'Zmittag selber kochen' } as never);
    await ensureCurrentSnapshot(SINCE);
    freezeAt(TODAY);

    await ensureFoodRetired();
    const after = await domainsRepository.findByType('food');
    expect(after?.id).toBe(food.id);
    expect(after?.enabled).toBe(false);
    expect(after?.settings).toEqual({ focus: 'Zmittag selber kochen' });
  });

  it('carries the configuration over, with Food off and the weights over what remains', async () => {
    await legacyDevice(PARTS);
    const inForce = (await snapshotOn(TODAY)).config;
    expect(inForce.boss?.weights.food).toBeCloseTo(0.1, 12);

    await ensureFoodRetired();
    const off = (await snapshotOn(TODAY)).config;
    expect(Object.keys(off)).toEqual(Object.keys(inForce));
    // The P8 marker and every model, as they were: this starts no other era.
    expect(off.scoring).toEqual(inForce.scoring);
    expect(off.questions).toEqual(inForce.questions);
    expect(off.domains).toEqual(
      inForce.domains.map((domain) => (domain.type === 'food' ? { ...domain, enabled: false } : domain)),
    );
    // 4 : 3 : 2, from the parts the user set.
    expect(off.boss?.weights).toEqual(weightsForSnapshot(PARTS, REMAINING));
    expect(off.boss?.weights.mental).toBeCloseTo(4 / 9, 12);
    expect(off.boss?.weights.gym).toBeCloseTo(3 / 9, 12);
    expect(off.boss?.weights.running).toBeCloseTo(2 / 9, 12);
  });

  it('shares the Boss equally over what remains where no parts were set', async () => {
    await legacyDevice();
    await ensureFoodRetired();
    expect((await snapshotOn(TODAY)).config.boss?.weights).toEqual(equalWeights(REMAINING));
  });

  it('writes byte for byte what the next write would, so nothing follows it', async () => {
    for (const parts of [undefined, PARTS]) {
      await deleteDatabase();
      await legacyDevice(parts);
      await ensureFoodRetired();
      const off = await snapshotOn(TODAY);

      const [domains, questions, settings] = await Promise.all([
        domainsRepository.list(),
        questionsRepository.list(),
        settingsRepository.get(),
      ]);
      expect(JSON.stringify(off.config)).toBe(JSON.stringify(buildConfigSnapshot(domains, questions, settings?.bossWeights)));

      const count = (await configSnapshotsRepository.list()).length;
      expect(await ensureCurrentSnapshot()).toEqual(off);
      expect(await configSnapshotsRepository.list()).toHaveLength(count);
    }
  });

  it('gives a configuration without the Boss none', async () => {
    // A configuration from before the Boss era (RC2) carries no weights, and
    // switching Food off must not start that era.
    await legacyDevice();
    const snapshots = await configSnapshotsRepository.list();
    await configSnapshotsRepository.replaceAll(
      snapshots.map((snapshot) => {
        const { boss: _boss, ...config } = snapshot.config;
        return { ...snapshot, config };
      }),
    );
    await ensureFoodRetired();
    const off = (await snapshotOn(TODAY)).config;
    expect(foodOn(off)).toBe(false);
    expect('boss' in off).toBe(false);
  });

  it('switches a snapshot dated after today off at its own date', async () => {
    await legacyDevice();
    const snapshots = await configSnapshotsRepository.list();
    const first = snapshots[snapshots.length - 1]!;
    const later = addDays(TODAY, 3);
    await configSnapshotsRepository.replaceAll([...snapshots, { ...first, id: 'cfg_later', effectiveFrom: later }]);

    expect(await ensureFoodRetired()).toBe('retired');
    expect(foodOn((await snapshotOn(TODAY)).config)).toBe(false);
    expect(foodOn((await snapshotOn(later)).config)).toBe(false);
  });

  it('keeps a switch-off already written when the local date has moved back', async () => {
    // Written on the update day's first load, at an instant already past —
    // then the local date moved back a day (a journey west). Today was lived
    // with Food and replays so; the switch-off waits for its own date.
    await legacyDevice();
    const snapshots = await configSnapshotsRepository.list();
    const first = snapshots[snapshots.length - 1]!;
    const tomorrow = addDays(TODAY, 1);
    await configSnapshotsRepository.replaceAll([
      ...snapshots,
      {
        ...first,
        id: 'cfg_off',
        effectiveFrom: tomorrow,
        createdAt: `${TODAY}T05:00:00.000Z`,
        config: {
          ...first.config,
          domains: first.config.domains.map((domain) => (domain.type === 'food' ? { ...domain, enabled: false } : domain)),
          boss: { weights: equalWeights(REMAINING) },
        },
      },
    ]);
    const food = (await domainsRepository.findByType('food'))!;
    await domainsRepository.setEnabled(food.id, false);

    expect(await ensureFoodRetired()).toBe('unchanged');
    expect((await configSnapshotsRepository.list()).map((snapshot) => snapshot.effectiveFrom)).toEqual([SINCE, tomorrow]);
    expect(foodOn((await snapshotOn(TODAY)).config)).toBe(true);
  });

  it('brings a switch-off written on a clock that was ahead back to today', async () => {
    await legacyDevice();
    // The first load after the update ran with the clock three days ahead…
    freezeAt(addDays(TODAY, 3));
    await ensureFoodRetired(addDays(TODAY, 3));
    // …and the clock was put right.
    freezeAt(TODAY);
    expect(await ensureFoodRetired()).toBe('retired');
    expect(foodOn((await snapshotOn(TODAY)).config)).toBe(false);
  });

  it('writes nothing before the first day of a profile set up with the clock ahead', async () => {
    const first = addDays(TODAY, 2);
    freezeAt(first);
    await applyOnboarding({ questions: [{ text: 'A', type: 'scale', category: 'eigene' }] });
    await enableLegacyFood(first);
    freezeAt(TODAY);

    expect(await ensureFoodRetired()).toBe('retired');
    const snapshots = await configSnapshotsRepository.list();
    expect(snapshots.map((snapshot) => snapshot.effectiveFrom)).toEqual([first]);
    expect(foodOn(snapshots[0]!.config)).toBe(false);
  });

  it('touches nothing on a profile that never had Food', async () => {
    freezeAt(SINCE);
    await applyOnboarding({ questions: [{ text: 'A', type: 'scale', category: 'eigene' }], gymTargetPerWeek: 3 });
    freezeAt(TODAY);
    const snapshots = await configSnapshotsRepository.list();
    const domains = await domainsRepository.list();
    expect(await ensureFoodRetired()).toBe('unchanged');
    expect(await configSnapshotsRepository.list()).toEqual(snapshots);
    expect(await domainsRepository.list()).toEqual(domains);
  });

  it('switches Food off again after an old build switched it back on', async () => {
    await legacyDevice();
    await ensureFoodRetired();
    // A second tab still running the old build: Food back on, from today.
    await enableLegacyFood(TODAY);
    expect(foodOn((await snapshotOn(TODAY)).config)).toBe(true);

    expect(await ensureFoodRetired()).toBe('retired');
    expect(foodOn((await snapshotOn(TODAY)).config)).toBe(false);
    expect((await domainsRepository.findByType('food'))?.enabled).toBe(false);
  });

  it('never throws on a configuration it does not recognise', async () => {
    // A throw here would stop the app from opening, on every retry.
    await legacyDevice();
    const snapshots = await configSnapshotsRepository.list();
    await configSnapshotsRepository.replaceAll(
      snapshots.map((snapshot) => ({ ...snapshot, config: { ...snapshot.config, domains: undefined as never } })),
    );
    await expect(ensureFoodRetired()).resolves.toBe('retired');
    expect((await domainsRepository.findByType('food'))?.enabled).toBe(false);
  });

  it('runs on every load, before anything is read, and Rang shows the weights the Boss uses', async () => {
    await legacyDevice(PARTS);
    await rateLegacyFood(addDays(TODAY, -1), 7);
    const configuration = await loadConfiguration();
    expect(configuration.activation.enabled).toEqual([...REMAINING]);
    expect(configuration.domains.food?.enabled).toBe(false);

    const weighting = bossWeightingOf(configuration);
    expect(weighting.map((entry) => [entry.domain, entry.parts])).toEqual([
      ['mental', 4],
      ['gym', 3],
      ['running', 2],
    ]);
    const used = (await snapshotOn(TODAY)).config.boss!.weights;
    for (const entry of weighting) expect(entry.share).toBeCloseTo(used[entry.domain]!, 12);
    // Nothing of Food's is deleted.
    expect((await foodDaysRepository.get(addDays(TODAY, -1)))?.adherence).toBe(7);
  });

  it('leaves a profile that had only Food with nothing on and a Boss that holds still', async () => {
    freezeAt(SINCE);
    await applyOnboarding({ questions: [] });
    await enableLegacyFood(SINCE);
    for (let index = 0; index < 9; index += 1) {
      freezeAt(addDays(SINCE, index));
      await rateLegacyFood(addDays(SINCE, index), index % 2 === 0 ? 9 : 4);
    }
    freezeAt(TODAY);
    expect((await loadConfiguration()).activation.enabled).toEqual([]);

    const reference = addDays(TODAY, 10);
    freezeAt(reference);
    const boss = await loadBossProgression(reference);
    const t = boss.history.days.findIndex((day) => day.date === TODAY);
    expect(t).toBeGreaterThan(0);
    for (const point of boss.points.slice(t)) {
      expect(point.progress).toBe(boss.points[t - 1]!.progress);
      expect(point.contributions).toEqual([]);
    }
  });
});

/* ── The Boss across the switch-off ─────────────────────────────────────── */

/** A fixture profile with the user's parts set, as the frozen Food-off profile has. */
function withParts(load: () => string): () => string {
  return () => {
    const backup = JSON.parse(load()) as { data: { settings: Record<string, unknown> } };
    backup.data.settings.bossWeights = PARTS;
    return JSON.stringify(backup);
  };
}

/** The same profile with no Food rating on the given days. */
function unratedOn(load: () => string, offsets: readonly number[]): () => string {
  return () => {
    const backup = JSON.parse(load()) as { data: { foodDays: { date: string }[] } };
    const dates = new Set(offsets.map((offset) => addDays(START, offset)));
    backup.data.foodDays = backup.data.foodDays.filter((row) => !dates.has(row.date));
    return JSON.stringify(backup);
  };
}

/** Every output of one day — exact, not rounded: these must not move at all. */
function dayOutputs(boss: BossProgression, index: number) {
  return {
    row: boss.history.days[index],
    food: boss.history.food[index],
    domains: boss.domains.map((entry) => [entry.domain, entry.series[index], entry.points[index]]),
    boss: boss.points[index],
    gym: [boss.gym.points[index], boss.gym.detail.find((point) => point.date === boss.history.days[index]!.date)],
    running: boss.running.points[index],
  };
}

const PROFILES: {
  name: string;
  load(): string;
  updates: number[];
  shares: BossWeights;
  /** Days left without a Food rating, which the update leaves unratable. */
  unrated?: number[];
  /** Whether those days are P8 days, closing a day after they are yesterday. */
  p8?: boolean;
}[] = [
  // Before P8: the update starts both eras on the same day. A Monday, a
  // Wednesday and a Sunday, so every relation to the week is met.
  { name: 'the four-domain profile, parts 4 : 3 : 2 : 1', load: withParts(currentProfile), updates: [28, 30, 34], shares: weightsForSnapshot(PARTS, REMAINING) },
  { name: 'the four-domain profile, no parts set', load: currentProfile, updates: [30], shares: equalWeights(REMAINING) },
  // In P8 since day 7, promotions confirmed from day one.
  { name: 'confirmation and P8', load: withParts(confirmationProfile), updates: [16, 20, 45], shares: weightsForSnapshot(PARTS, REMAINING) },
  // Inside the Gym break, decay running, P8 since day 56.
  { name: 'the training break in P8', load: withParts(p8CrossingProfile), updates: [63, 66, 69], shares: weightsForSnapshot(PARTS, REMAINING) },
  // The one-time cost (D141): yesterday's Food was still to be rated.
  {
    name: "yesterday's Food unrated, in P8",
    load: unratedOn(withParts(confirmationProfile), [29]),
    updates: [30],
    shares: weightsForSnapshot(PARTS, REMAINING),
    unrated: [29],
    p8: true,
  },
  {
    name: 'three days of Food unrated, before P8',
    load: unratedOn(withParts(currentProfile), [28, 29]),
    updates: [30],
    shares: weightsForSnapshot(PARTS, REMAINING),
    unrated: [28, 29],
  },
];

/** The update day itself, the next three, and a week on. */
const AFTER = [0, 1, 2, 3, 8];

/**
 * The profile at `clock`, as the build before the update replays it, or —
 * with `update` — after that day's first load ran the update's two steps.
 */
async function replay(load: () => string, clock: DateKey, update: DateKey | null): Promise<BossProgression> {
  await deleteDatabase();
  setClock({ now: () => at(clock) });
  const result = await importBackup(load());
  if (!result.ok) throw new Error(result.details.join('; '));
  if (update) {
    setClock({ now: () => at(update, 7) });
    await ensureSessionWindowEra(update);
    expect(await ensureFoodRetired(update)).toBe('retired');
    setClock({ now: () => at(clock) });
  }
  return loadBossProgression(clock);
}

describe('the Boss across the switch-off (D139)', () => {
  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  for (const profile of PROFILES) {
    for (const offset of profile.updates) {
      const update = addDays(START, offset);
      it(`${profile.name}, switched off on ${update}`, async () => {
        for (const after of AFTER) {
          const clock = addDays(update, after);
          const before = await replay(profile.load, clock, null);
          const updated = await replay(profile.load, clock, update);
          const t = updated.history.days.findIndex((day) => day.date === update);
          expect(t, 'the update day is in the history').toBeGreaterThan(0);

          // Every day before the switch-off, byte for byte, and every rank
          // change dated before it.
          for (let index = 0; index < t; index += 1) {
            expect(dayOutputs(updated, index), `${updated.history.days[index]!.date} at ${clock}`).toEqual(
              dayOutputs(before, index),
            );
          }
          const changesBefore = (boss: BossProgression) =>
            boss.changes.filter((change) => change.date < update).map((change) => JSON.stringify(change));
          expect(changesBefore(updated), `at ${clock}`).toEqual(changesBefore(before));
          // Today is transparent to a confirmation, so the update day cannot move one.
          if (after === 0) expect(updated.pending).toEqual(before.pending);

          // From the switch-off, the remaining domains alone, at their new shares.
          expect(before.points[t]!.contributions.some((entry) => entry.domain === 'food')).toBe(true);
          const foodSeries = updated.domains.find((entry) => entry.domain === 'food')!.series;
          for (let index = t; index < updated.points.length; index += 1) {
            const point = updated.points[index]!;
            expect(point.contributions.map((entry) => entry.domain)).toEqual([...REMAINING]);
            for (const entry of point.contributions) expect(entry.weight).toBeCloseTo(profile.shares[entry.domain]!, 12);
            // No jump: the level continues from the day before by their movement.
            expect(point.movement).toBeCloseTo(
              point.contributions.reduce((sum, entry) => sum + entry.weight * entry.movement, 0),
              12,
            );
            expect(point.progress).toBeCloseTo(
              Math.min(8, Math.max(0, updated.points[index - 1]!.progress + point.movement)),
              12,
            );
            // Food's own figures stand where its last day left them.
            expect(updated.history.food[index]).toBeNull();
            expect(foodSeries[index]).toBe(foodSeries[t - 1]);
          }

          // A day whose Food was still to be rated: held open while it can be
          // written, then closed with Food missed in `score` — the same in
          // both replays, so the switch-off itself moved nothing.
          for (const day of profile.unrated ?? []) {
            const date = addDays(START, day);
            const row = updated.history.days.find((entry) => entry.date === date)!;
            const window = profile.p8 ? 1 : 3;
            const closed = offset - day + after > window;
            expect(row.status, `${date} at ${clock}`).toBe(closed ? 'scored' : 'open');
            if (closed) {
              expect(row.domains.find((entry) => entry.domain === 'food')).toEqual({
                domain: 'food',
                score: 0,
                itemsDue: 1,
                itemsAnswered: 0,
              });
            }
          }
        }
      });
    }
  }
});

/* ── The frozen profile ─────────────────────────────────────────────────── */

describe('the frozen Food-off profile', () => {
  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  it('is exactly what the switch-off writes, and replays the same at every clock', async () => {
    // Its switch-off snapshot was written by hand before any Stage 4 code
    // (db6076a), so the golden files are pinned to it. The step has to write
    // that configuration, byte for byte.
    const frozen = JSON.parse(foodOffProfile()) as { data: { configSnapshots: { config: unknown }[] } };
    const expected = frozen.data.configSnapshots[frozen.data.configSnapshots.length - 1]!.config;

    for (const clock of FOOD_OFF_CLOCKS) {
      await deleteDatabase();
      setClock({ now: () => at(FOOD_OFF_FROM, 7) });
      expect((await importBackup(withParts(confirmationProfile)())).ok).toBe(true);
      expect(await ensureFoodRetired(FOOD_OFF_FROM)).toBe('retired');
      const written = await configSnapshotsRepository.resolveForDate(FOOD_OFF_FROM);
      expect(written?.effectiveFrom).toBe(FOOD_OFF_FROM);
      expect(JSON.stringify(written?.config)).toBe(JSON.stringify(expected));
      setClock({ now: () => at(clock) });
      const live = await loadBossProgression(clock);

      await deleteDatabase();
      expect((await importBackup(foodOffProfile())).ok).toBe(true);
      const pinned = await loadBossProgression(clock);
      for (let index = 0; index < pinned.points.length; index += 1) {
        expect(dayOutputs(live, index), `${pinned.history.days[index]!.date} at ${clock}`).toEqual(dayOutputs(pinned, index));
      }
      expect(live.changes).toEqual(pinned.changes);
      expect(live.pending).toEqual(pinned.pending);
    }
  });
});

/* ── Nothing creates Food data ──────────────────────────────────────────── */

const SRC = fileURLToPath(new URL('../../', import.meta.url));

/** Every source file that ships: no tests, no test fixtures. */
function shippedSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== 'fixtures' && entry !== 'test') shippedSources(path, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

describe('nothing creates Food data (D140)', () => {
  it('has no writer of a Food row or record anywhere the app runs', () => {
    // The repositories keep their writers, as the dormant stores do (D115):
    // a backup restores Food through its own stores, and the tests seed
    // Food-era history through them. Nothing that ships may call one.
    const writer =
      /food(Days|Entries)Repository\.(save|clear|put|putMany|remove|replaceAll)\(|\.ensure\(\s*'food'|enableDomain\(\s*'food'/;
    const carriers = shippedSources(SRC)
      .filter((path) => writer.test(readFileSync(path, 'utf8')))
      .map((path) => path.slice(SRC.length));
    expect(carriers).toEqual([]);
    expect(shippedSources(SRC).length).toBeGreaterThan(100);
  });
});
