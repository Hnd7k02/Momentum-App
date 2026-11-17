import 'fake-indexeddb/auto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { GYM_METRIC } from '../../core/config/constants';
import { canonical, canonicalJson } from '../../testing/canonical';
import { closeDatabase, deleteDatabase } from '../db';
import { ensureFoodRetired, ensureGymMetricEra, ensureSessionWindowEra } from '../configService';
import { configSnapshotsRepository } from '../repositories';
import { exportBackup, importBackup } from './backupService';
import { loadBossProgression } from './bossService';
import { applyOnboarding, loadConfiguration } from './configurationService';
import { updateOutputs, type UpdateOutputs } from './fixtures/updateOutputs';

/**
 * The update from the live build, rehearsed as a whole (block 9, step 4).
 *
 * The device is `.github/fixtures/wp3-update/live-profile.json`: a backup the
 * live build `e30becd` made of itself, through its own screens, over seven
 * weeks to the update day — Mind answered daily, Gym with several sets and a
 * bodyweight exercise, runs with distance and time, a training plan, and
 * Food switched on and rated every day (`stage5b-live-backup.mjs` with
 * `FOOD=1 RUNS=1 PLAN=1`). Every figure is invented.
 *
 * A backup imported into an empty database is that device's database: the
 * import writes every store as the file holds it, and the schema is the
 * live build's. So "in place" here is the live device the moment before the
 * new build first opens it; the browser suite `update-in-place.mjs` does the
 * same in one browser, one database, the live build first.
 *
 * What it proves:
 *
 * 1. The first load runs every activation the live build does not know —
 *    the one-day window (D132), the end of Food (D139), the metric of Stage
 *    5b with its curve (D150, D177) — each exactly once, and a second load
 *    writes nothing.
 * 2. Nothing is lost: every collection holds every record it held.
 * 3. Every day before the update shows what the live build showed, read by
 *    the live build's own code (`update-live-outputs.mjs`) through the same
 *    file (`fixtures/updateOutputs.ts`).
 * 4. The same backup imported into a fresh install of this build — after its
 *    own onboarding, the way a person would — ends in the same state as the
 *    update in place.
 * 5. The replay on the update day and a week later is frozen
 *    (`after-update-*.json`); with the live build's reading of that day
 *    (`e30becd-outputs-*.json`) these are the three dates: before, on and
 *    after the update.
 */

const DIR = new URL('../../../.github/fixtures/wp3-update/', import.meta.url);
const read = (name: string) => readFileSync(fileURLToPath(new URL(name, DIR)), 'utf8');
const BACKUP = read('live-profile.json');
const UPDATE_DAY = '2026-11-18';
const WEEK_AFTER = '2026-11-25';
const FREEZE = Boolean(process.env.FREEZE_UPDATE_REHEARSAL);

function at(day: string, hour = 12): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

beforeEach(async () => {
  await deleteDatabase();
});
afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

/** Every collection of the database, as the export carries it, without the instant of the export. */
async function stores() {
  const { exportedAt: _at, ...file } = await exportBackup();
  return file.data as unknown as Record<string, unknown[]>;
}

/**
 * A database's contents with what an activation makes up on the spot — a
 * snapshot's id and the instant it was written — left out, the snapshots in
 * date order: two devices that went through the same update hold this.
 */
async function state() {
  const data = await stores();
  return canonical({
    ...data,
    configSnapshots: (data.configSnapshots as { effectiveFrom: string; config: unknown }[])
      .map(({ effectiveFrom, config }) => ({ effectiveFrom, config }))
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)),
  });
}

async function liveDevice(): Promise<Record<string, unknown[]>> {
  at(UPDATE_DAY, 8);
  const result = await importBackup(BACKUP);
  if (!result.ok) throw new Error(result.details.join('; '));
  return stores();
}

function frozen(name: string, actual: unknown) {
  if (FREEZE) {
    writeFileSync(fileURLToPath(new URL(name, DIR)), canonicalJson(actual));
    return;
  }
  if (!existsSync(fileURLToPath(new URL(name, DIR)))) throw new Error(`${name} is missing: freeze it on purpose with FREEZE_UPDATE_REHEARSAL=1`);
  expect(canonicalJson(actual)).toBe(read(name));
}

describe('the update from the live build, as a whole (block 9, step 4)', () => {
  it('runs each activation once on the first load, and a second load writes nothing', async () => {
    const before = await liveDevice();
    const lived = (before.configSnapshots ?? []) as { effectiveFrom: string }[];
    // The live build knows none of the three eras.
    for (const snapshot of (before.configSnapshots ?? []) as { config: { scoring: Record<string, unknown>; domains: { type: string; enabled: boolean }[] } }[]) {
      expect(snapshot.config.scoring.sessionWindowDays).toBeUndefined();
      expect(snapshot.config.scoring.gymMetric).toBeUndefined();
    }

    at(UPDATE_DAY);
    await loadConfiguration();
    const after = await stores();
    const snapshots = after.configSnapshots as { effectiveFrom: string; config: { scoring: Record<string, unknown>; domains: { type: string; enabled: boolean }[] } }[];
    // Every snapshot the live build wrote is still there, unchanged …
    for (const snapshot of before.configSnapshots ?? []) expect(snapshots).toContainEqual(snapshot);
    // … and what was added is dated on the update day and carries all three.
    const added = snapshots.filter((snapshot) => !((before.configSnapshots ?? []) as unknown[]).some((old) => JSON.stringify(old) === JSON.stringify(snapshot)));
    expect(added.length).toBeGreaterThan(0);
    for (const snapshot of added) expect(snapshot.effectiveFrom).toBe(UPDATE_DAY);
    const inForce = (await configSnapshotsRepository.resolveForDate(UPDATE_DAY))!.config;
    expect(inForce.scoring.sessionWindowDays).toBe(1);
    expect(inForce.scoring.gymMetric).toEqual(GYM_METRIC);
    expect(inForce.domains.find((domain) => domain.type === 'food')?.enabled).toBe(false);
    expect(lived.every((snapshot) => snapshot.effectiveFrom < UPDATE_DAY)).toBe(true);

    // Once: each step finds nothing left to do, and a second load writes nothing.
    expect(await ensureSessionWindowEra(UPDATE_DAY)).toBe('unchanged');
    expect(await ensureFoodRetired(UPDATE_DAY)).toBe('unchanged');
    expect(await ensureGymMetricEra(UPDATE_DAY)).toBe('unchanged');
    await loadConfiguration();
    expect(await stores()).toEqual(after);
  });

  it('loses nothing: every collection holds every record it held', async () => {
    const before = await liveDevice();
    at(UPDATE_DAY);
    await loadConfiguration();
    await loadBossProgression(UPDATE_DAY);
    const after = await stores();
    for (const [name, rows] of Object.entries(before)) {
      if (!Array.isArray(rows)) continue;
      if (name === 'configSnapshots') continue; // appended to, above
      if (name === 'domains' || name === 'settings') {
        // The Food record is switched off and kept, its settings with it (D139, D140).
        expect((after[name] as unknown[]).length, name).toBe(rows.length);
        continue;
      }
      expect(after[name], name).toEqual(rows);
    }
    const food = (after.domains as { type: string; enabled: boolean; settings: unknown }[]).find((domain) => domain.type === 'food')!;
    expect(food.enabled).toBe(false);
    expect(food.settings).toEqual((before.domains as { type: string; settings: unknown }[]).find((domain) => domain.type === 'food')!.settings);
  });

  it('shows every day before the update as the live build showed it', async () => {
    const live = JSON.parse(read(`e30becd-outputs-${UPDATE_DAY}.json`)) as { commit: string; reference: string; days: UpdateOutputs };
    expect(live.commit).toBe('e30becd');
    await liveDevice();
    at(UPDATE_DAY);
    await loadConfiguration();
    const now = updateOutputs(await loadBossProgression(UPDATE_DAY));
    const before = (days: UpdateOutputs) => days.filter((day) => day.date < UPDATE_DAY);
    expect(before(now).length).toBeGreaterThan(40);
    expect(canonical(before(now))).toEqual(canonical(before(live.days)));
  });

  it('ends, by way of the backup into a fresh install, in the same state as the update in place', async () => {
    await liveDevice();
    at(UPDATE_DAY);
    await loadConfiguration();
    const inPlace = await state();
    const inPlaceDays = updateOutputs(await loadBossProgression(UPDATE_DAY));
    await closeDatabase();
    await deleteDatabase();

    // A fresh install of this build: its own onboarding, then "Backup importieren".
    at(UPDATE_DAY, 10);
    await applyOnboarding({ questions: [{ text: 'Neu', type: 'scale', category: 'eigene' }], gymTargetPerWeek: 2 });
    await loadConfiguration();
    const result = await importBackup(BACKUP);
    if (!result.ok) throw new Error(result.details.join('; '));
    at(UPDATE_DAY);
    await loadConfiguration();
    expect(await state()).toEqual(inPlace);
    expect(canonical(updateOutputs(await loadBossProgression(UPDATE_DAY)))).toEqual(canonical(inPlaceDays));
  });

  it('goes there and back by the backup: export, delete, import, export — the same file, every rating as before (step 6)', async () => {
    await liveDevice();
    at(UPDATE_DAY);
    await loadConfiguration();
    const ratings = canonical(updateOutputs(await loadBossProgression(UPDATE_DAY)));
    const { exportedAt: _first, ...first } = await exportBackup();
    await closeDatabase();
    await deleteDatabase();

    const result = await importBackup(JSON.stringify({ ...first, exportedAt: new Date().toISOString() }));
    if (!result.ok) throw new Error(result.details.join('; '));
    await loadConfiguration();
    const { exportedAt: _second, ...second } = await exportBackup();
    expect(second).toEqual(first);
    expect(canonical(updateOutputs(await loadBossProgression(UPDATE_DAY)))).toEqual(ratings);
  });

  it('replays the update day and the week after it to their frozen files', async () => {
    await liveDevice();
    at(UPDATE_DAY);
    await loadConfiguration();
    frozen(`after-update-${UPDATE_DAY}.json`, updateOutputs(await loadBossProgression(UPDATE_DAY)));
    // A week on, nothing new logged: the update's week has been judged (D134).
    at(WEEK_AFTER);
    await loadConfiguration();
    frozen(`after-update-${WEEK_AFTER}.json`, updateOutputs(await loadBossProgression(WEEK_AFTER)));
  });
});
