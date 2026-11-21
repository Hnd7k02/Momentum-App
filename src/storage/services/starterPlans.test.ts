import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { GYM } from '../../core/config/constants';
import { EXERCISE_CATALOGUE } from '../../core/gym/catalogue';
import { TRAINING_PLAN_KIND } from '../../core/model';
import { BACKUP_FORMAT_VERSION } from '../../core/backup/format';
import { closeDatabase, deleteDatabase } from '../db';
import { settingsRepository } from '../repositories';
import { exportBackup, importBackup } from './backupService';
import { loadBossProgression } from './bossService';
import { applyOnboarding, loadConfiguration } from './configurationService';
import { updateOutputs } from './fixtures/updateOutputs';
import { ensureStarterPlans, STARTER_PLANS } from './starterPlanService';
import { createTrainingPlan, deleteTrainingPlan, listTrainingPlans, updateTrainingPlan } from './trainingPlanService';

/**
 * The two starter plans (D205): Push A and Push B, once per device.
 *
 * A new device holds them from its first load and nothing else it did not
 * hold before; an existing device is given them once, its data as it was; a
 * plan its user deletes or renames never comes back; a backup import brings
 * the backup's plans and no seed after it; and nothing that is scored moves.
 */

const DAY = '2026-11-21';
const LIVE = readFileSync(
  fileURLToPath(new URL('../../../.github/fixtures/wp3-update/live-profile.json', import.meta.url)),
  'utf8',
);

function at(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

async function stores(): Promise<Record<string, unknown>> {
  return (await exportBackup()).data as unknown as Record<string, unknown>;
}

/** A device as a build before D205 left it: the backup's contents, and no mark. */
async function deviceBeforeTheSeed(backup: string = LIVE): Promise<void> {
  const result = await importBackup(backup);
  if (!result.ok) throw new Error(result.details.join('; '));
  const { starterPlansSeededAt: _mark, ...settings } = (await settingsRepository.get())!;
  await settingsRepository.replaceAll(settings);
}

const names = async () => (await listTrainingPlans()).map((plan) => plan.name);

beforeEach(async () => {
  await deleteDatabase();
  at(DAY);
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

describe('the plans themselves', () => {
  it('are Push A and Push B, of built-in exercises, in the order given', () => {
    expect(STARTER_PLANS).toEqual([
      {
        name: 'Push A',
        exerciseIds: [
          'ex_bench_press',
          'ex_incline_press',
          'ex_high_to_low_cable_fly',
          'ex_cable_lateral_raise',
          'ex_overhead_cable_extension',
          'ex_triceps_pushdown',
        ],
      },
      {
        name: 'Push B',
        exerciseIds: [
          'ex_overhead_cable_extension',
          'ex_lateral_raise_machine',
          'ex_incline_press_machine',
          'ex_chest_press_machine',
          'ex_cable_fly_low_to_high',
          'ex_triceps_pushdown',
        ],
      },
    ]);
    const builtIn = new Set(EXERCISE_CATALOGUE.map((entry) => entry.id));
    for (const plan of STARTER_PLANS) for (const id of plan.exerciseIds) expect(builtIn.has(id), id).toBe(true);
  });
});

describe('a fresh install', () => {
  it('still opens on the introduction, with nothing chosen, and holds the two plans and nothing else new', async () => {
    const configuration = await loadConfiguration();

    // The introduction is still to come, and nothing is preselected.
    expect(configuration.settings.onboardingCompletedAt).toBeNull();
    expect(Object.values(configuration.domains).every((domain) => domain === null)).toBe(true);
    expect(configuration.questions).toEqual([]);

    const data = await stores();
    const plans = await listTrainingPlans();
    expect(plans.map((plan) => plan.name)).toEqual(['Push A', 'Push B']);
    for (const [index, plan] of plans.entries()) {
      expect(plan.kind).toBe(TRAINING_PLAN_KIND);
      expect(plan.exercises.map((line) => line.exerciseId)).toEqual(STARTER_PLANS[index]!.exerciseIds);
      expect(plan.exercises.map((line) => line.order)).toEqual([0, 1, 2, 3, 4, 5]);
      // Each line carries the catalogue's name, as a plan the user writes does.
      for (const line of plan.exercises) expect(line.name).not.toBe(line.exerciseId);
    }

    // Beside the plans: the settings record every first load writes, and the
    // catalogue the plans are made of. No area, question, answer, session,
    // set, run, weight, pause or snapshot.
    expect((data.exercises as unknown[]).length).toBe(EXERCISE_CATALOGUE.length);
    for (const [name, rows] of Object.entries(data)) {
      if (['settings', 'profile', 'exercises', 'gymPlans'].includes(name)) continue;
      expect(rows, name).toEqual([]);
    }
    expect(data.profile).toBeNull();
  });

  it('holds exactly the two plans after the introduction, and the introduction wrote none of its own', async () => {
    await loadConfiguration();
    await applyOnboarding({ questions: [{ text: 'Geschlafen?', type: 'boolean', category: 'eigene' }], gymTargetPerWeek: 3 });
    expect(await names()).toEqual(['Push A', 'Push B']);
    const data = await stores();
    expect(data.gymSessions).toEqual([]);
    expect(data.gymSets).toEqual([]);
  });
});

describe('once per device', () => {
  it('writes nothing on a second load', async () => {
    await loadConfiguration();
    const first = await stores();
    at(DAY, 15);
    await loadConfiguration();
    expect(await stores()).toEqual(first);
    expect(await ensureStarterPlans()).toBe('unchanged');
  });

  it('seeds once when two loads run at the same time', async () => {
    await Promise.all([loadConfiguration(), loadConfiguration()]);
    expect(await names()).toEqual(['Push A', 'Push B']);
  });

  it('leaves a deleted plan gone and a renamed one renamed', async () => {
    await loadConfiguration();
    const [a, b] = await listTrainingPlans();
    await deleteTrainingPlan(a!.id);
    await updateTrainingPlan(b!.id, { name: 'Drücken', exercises: b!.exercises.map((line) => ({ exerciseId: line.exerciseId })) });

    await closeDatabase();
    await loadConfiguration();
    expect(await names()).toEqual(['Drücken']);

    await deleteTrainingPlan(b!.id);
    await loadConfiguration();
    expect(await names()).toEqual([]);
  });
});

describe('an existing install', () => {
  it('is given the plans once, with every record it held as it was and every rating unmoved', async () => {
    await deviceBeforeTheSeed();
    const before = await stores();
    // What the update does without the seed, for the comparison of ratings.
    const held = new Set((before.exercises as { id: string }[]).map((row) => row.id));

    await loadConfiguration();
    const ratings = JSON.stringify(updateOutputs(await loadBossProgression(DAY)));
    const after = await stores();

    expect(await names()).toEqual(['Push', 'Push A', 'Push B']);
    for (const name of ['answers', 'questions', 'gymSessions', 'gymSets', 'runs', 'weightEntries', 'foodDays', 'foodEntries', 'rankEvents', 'pausePeriods', 'tombstones', 'sportsSessions', 'restDays']) {
      expect(after[name], name).toEqual(before[name]);
    }
    expect((after.gymPlans as { name: string }[]).filter((plan) => plan.name === 'Push')).toEqual(before.gymPlans);
    expect((after.exercises as { id: string }[]).filter((row) => held.has(row.id))).toEqual(before.exercises);

    // The same device with the mark already set — no plans added — rates the same.
    await closeDatabase();
    await deleteDatabase();
    const result = await importBackup(LIVE);
    if (!result.ok) throw new Error(result.details.join('; '));
    await loadConfiguration();
    expect(await names()).toEqual(['Push']);
    expect(JSON.stringify(updateOutputs(await loadBossProgression(DAY)))).toBe(ratings);

    // And once: a later load adds nothing.
    await loadConfiguration();
    expect(await names()).toEqual(['Push']);
  });

  it('gets no second "Push A" where it holds one, whatever its case, and still gets Push B', async () => {
    await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
    for (const plan of await listTrainingPlans()) await deleteTrainingPlan(plan.id);
    const own = await createTrainingPlan({ name: ' push a ', exercises: [{ exerciseId: 'ex_squat' }] });
    await settingsRepository.replaceAll((({ starterPlansSeededAt: _mark, ...rest }) => rest)((await settingsRepository.get())!));

    at(DAY, 11);
    await loadConfiguration();
    const plans = await listTrainingPlans();
    expect(plans.map((plan) => plan.name)).toEqual(['push a', 'Push B']);
    expect(plans[0]).toEqual(own);
  });

  it('never goes over the limit: a device with one slot left gets Push A, a full one gets nothing, and neither is asked again', async () => {
    const deviceWith = async (count: number) => {
      await closeDatabase();
      await deleteDatabase();
      at(DAY);
      await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
      for (const plan of await listTrainingPlans()) await deleteTrainingPlan(plan.id);
      for (let index = 0; index < count; index += 1) {
        await createTrainingPlan({ name: `Plan ${index + 1}`, exercises: [{ exerciseId: 'ex_squat' }] });
      }
      await settingsRepository.replaceAll((({ starterPlansSeededAt: _mark, ...rest }) => rest)((await settingsRepository.get())!));
      at(DAY, 11);
      await loadConfiguration();
    };
    const sorted = async () => (await names()).sort();

    await deviceWith(GYM.MAX_PLANS - 1);
    expect(await sorted()).toEqual(['Plan 1', 'Plan 2', 'Plan 3', 'Plan 4', 'Push A']);
    // A slot freed later brings nothing: the seed has had its turn.
    await deleteTrainingPlan((await listTrainingPlans()).find((plan) => plan.name === 'Plan 1')!.id);
    await loadConfiguration();
    expect(await sorted()).toEqual(['Plan 2', 'Plan 3', 'Plan 4', 'Push A']);

    await deviceWith(GYM.MAX_PLANS);
    expect(await sorted()).toEqual(['Plan 1', 'Plan 2', 'Plan 3', 'Plan 4', 'Plan 5']);
    await deleteTrainingPlan((await listTrainingPlans()).find((plan) => plan.name === 'Plan 1')!.id);
    await loadConfiguration();
    expect(await sorted()).toEqual(['Plan 2', 'Plan 3', 'Plan 4', 'Plan 5']);
  });
});

describe('a backup import', () => {
  it('of a file written before the seed brings the file’s plans and no seed after it, in the same format', async () => {
    const file = JSON.parse(LIVE) as { formatVersion: number; data: { settings: Record<string, unknown>; gymPlans: unknown[] } };
    expect(file.data.settings.starterPlansSeededAt).toBeUndefined();

    // A device of this build, seeded, takes the old file.
    await loadConfiguration();
    await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
    expect(await names()).toEqual(['Push A', 'Push B']);
    const result = await importBackup(LIVE);
    expect(result.ok).toBe(true);

    await loadConfiguration();
    await loadConfiguration();
    expect(await names()).toEqual(['Push']);
    const exported = await exportBackup();
    expect(exported.formatVersion).toBe(file.formatVersion);
    expect(exported.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(exported.data.gymPlans).toEqual(file.data.gymPlans);
  });

  it('of a file of this build goes there and back as the same file, a deleted starter plan still gone', async () => {
    await loadConfiguration();
    await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
    await deleteTrainingPlan((await listTrainingPlans())[0]!.id);
    const { exportedAt: _first, ...first } = await exportBackup();

    await closeDatabase();
    await deleteDatabase();
    at(DAY, 14);
    await loadConfiguration();
    const result = await importBackup(JSON.stringify({ ...first, exportedAt: new Date().toISOString() }));
    expect(result.ok).toBe(true);
    await loadConfiguration();
    const { exportedAt: _second, ...second } = await exportBackup();
    expect(second).toEqual(first);
    expect(await names()).toEqual(['Push B']);
  });
});
