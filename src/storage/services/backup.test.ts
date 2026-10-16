import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { BACKUP_FORMAT_VERSION } from '../../core/backup/format';
import { addDays } from '../../core/dates';
import { SCHEMA_VERSION } from '../../core/model';
import { closeDatabase, deleteDatabase } from '../db';
import {
  answersRepository,
  configSnapshotsRepository,
  domainsRepository,
  foodDaysRepository,
  foodEntriesRepository,
  questionsRepository,
  settingsRepository,
} from '../repositories';
import {
  addQuestion,
  applyOnboarding,
  archiveQuestion,
  loadConfiguration,
  setWeeklyTarget,
  weeklyTargetOfDomain,
} from './configurationService';
import { logSession, saveAnswer } from './checkInService';
import { enableLegacyFood, logLegacyFoodEntry, rateLegacyFood } from './fixtures/legacyFood';
import { loadHistory } from './historyService';
import { loadProgression } from './ratingService';
import { exportBackup, exportBackupFile, importBackup, inspectBackup } from './backupService';

/**
 * The weekly-quota domain these suites exercise is Gym.
 *
 * RC2 had one generic Sport domain; iteration 2 has two independent ones, and
 * the rules under test here — the target, the week window, what a met week is
 * worth — belong to any weekly quota rather than to a particular sport. Gym
 * stands in for all of them.
 */
const setGymTarget = (target: number) => setWeeklyTarget('gym', target);


function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

const ORIGIN = '2025-01-06'; // a Monday

beforeEach(async () => {
  await deleteDatabase();
  freezeAt(ORIGIN);
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

const text = async () => JSON.stringify(await exportBackup());

/** Wipes the profile the way a new device or cleared browser would. */
async function wipe() {
  await deleteDatabase();
}

async function recordDays(count: number, from = ORIGIN) {
  const questions = await questionsRepository.listActive();
  for (let index = 0; index < count; index += 1) {
    const date = addDays(from, index);
    freezeAt(date);
    for (const question of questions) {
      await saveAnswer(date, question.id, question.type === 'scale' ? 8 : true);
    }
    if (index % 3 === 0) await logSession('gym', date).catch(() => undefined);
  }
}

describe('the exported file', () => {
  it('is named for the day and is readable JSON', async () => {
    await applyOnboarding({ questions: [{ text: 'A', type: 'boolean', category: 'eigene' }], gymTargetPerWeek: 3 });
    const file = await exportBackupFile();
    expect(file.fileName).toBe('momentum-backup-2025-01-06.json');
    expect(() => JSON.parse(file.contents)).not.toThrow();
    expect(file.contents.endsWith('\n')).toBe(true);
  });

  it('states both versions it depends on', async () => {
    await applyOnboarding({ questions: [], gymTargetPerWeek: null });
    const backup = await exportBackup();
    expect(backup.format).toBe('momentum-backup');
    expect(backup.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(backup.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('carries source data and no derived values', async () => {
    await applyOnboarding({ questions: [{ text: 'A', type: 'boolean', category: 'eigene' }], gymTargetPerWeek: 2 });
    await recordDays(5);
    const backup = await exportBackup();
    // Exhaustive on purpose: adding a collection to the backup should be a
    // deliberate act, and forgetting to add one is exactly the bug that loses
    // a user's data on restore.
    expect(Object.keys(backup.data).sort()).toEqual([
      'answers',
      'configSnapshots',
      'domains',
      'exercises',
      'foodDays',
      'foodEntries',
      'gymPlans',
      'gymSessions',
      'gymSets',
      'pausePeriods',
      'profile',
      'questions',
      'rankEvents',
      'restDays',
      'runs',
      'settings',
      'sportsSessions',
      'tombstones',
      'weightEntries',
    ]);
    // Ratings, ranks, streaks and scores are replayed, never stored.
    expect(JSON.stringify(backup.data)).not.toContain('"rating"');
    expect(JSON.stringify(backup.data)).not.toContain('"lifetimeXp"');
  });
});

describe('round trips', () => {
  async function roundTrip() {
    const before = await text();
    await wipe();
    const result = await importBackup(before);
    expect(result.ok).toBe(true);
    const after = await text();
    return { before, after };
  }

  it('restores an empty, freshly onboarded profile', async () => {
    await applyOnboarding({ questions: [], gymTargetPerWeek: null });
    const { before, after } = await roundTrip();
    expect(JSON.parse(after).data).toEqual(JSON.parse(before).data);
  });

  it('restores a Mental-only profile', async () => {
    await applyOnboarding({
      questions: [
        { text: 'A', type: 'boolean', category: 'eigene' },
        { text: 'B', type: 'scale', category: 'eigene' },
      ],
      gymTargetPerWeek: null,
    });
    await recordDays(10);
    const { before, after } = await roundTrip();
    expect(JSON.parse(after).data).toEqual(JSON.parse(before).data);
  });

  it('restores a Sports-only profile', async () => {
    await applyOnboarding({ questions: [], gymTargetPerWeek: 4 });
    for (const offset of [0, 2, 4, 8, 9]) {
      freezeAt(addDays(ORIGIN, offset));
      await logSession('gym', addDays(ORIGIN, offset));
    }
    const { before, after } = await roundTrip();
    expect(JSON.parse(after).data).toEqual(JSON.parse(before).data);
  });

  it('restores a long-running mixed profile', async () => {
    await applyOnboarding({
      questions: [
        { text: 'A', type: 'boolean', category: 'eigene' },
        { text: 'B', type: 'scale', category: 'eigene' },
      ],
      gymTargetPerWeek: 3,
    });
    await recordDays(60);
    const { before, after } = await roundTrip();
    expect(JSON.parse(after).data).toEqual(JSON.parse(before).data);
  });

  it('restores archived questions and changed targets', async () => {
    await applyOnboarding({
      questions: [{ text: 'A', type: 'boolean', category: 'eigene' }],
      gymTargetPerWeek: 2,
    });
    await recordDays(6);
    freezeAt(addDays(ORIGIN, 10));
    const added = await addQuestion({ text: 'B', type: 'scale', category: 'eigene' });
    await setGymTarget(5);
    freezeAt(addDays(ORIGIN, 14));
    await archiveQuestion(added.id);

    const { before, after } = await roundTrip();
    expect(JSON.parse(after).data).toEqual(JSON.parse(before).data);

    const configuration = await loadConfiguration();
    expect(configuration.questions.some((question) => question.status === 'archived')).toBe(true);
    expect(weeklyTargetOfDomain(configuration.domains.gym))
      .toBe(5);
  });

  /**
   * Twelve days of Food on a device from before WP3 Stage 4: ratings every
   * day, an entry every fourth, stored the way the old build stored them.
   */
  async function legacyFoodProfile() {
    await applyOnboarding({ questions: [{ text: 'A', type: 'boolean', category: 'eigene' }] });
    await enableLegacyFood(ORIGIN);
    for (let index = 0; index < 12; index += 1) {
      const date = addDays(ORIGIN, index);
      freezeAt(date);
      await rateLegacyFood(date, (index % 10) + 1);
      if (index % 4 === 0) {
        await logLegacyFoodEntry(date, {
          foodId: 'food_oats',
          label: 'Haferflocken',
          grams: 60,
          kcal: 223,
          proteinG: 8,
          carbsG: 35,
          fatG: 4,
        });
      }
    }
  }

  it('restores a profile with Food ratings and entries (D140)', async () => {
    await legacyFoodProfile();

    const before = await loadHistory(ORIGIN, addDays(ORIGIN, 11), addDays(ORIGIN, 20));
    const { before: file, after } = await roundTrip();
    expect(JSON.parse(after).data).toEqual(JSON.parse(file).data);

    // The ratings are the one piece of Food data that cannot be recomputed
    // from anything else, so losing them would be losing history outright.
    const restored = await loadHistory(ORIGIN, addDays(ORIGIN, 11), addDays(ORIGIN, 20));
    expect(restored.food).toEqual(before.food);
    expect(restored.food.filter((value) => value !== null)).toHaveLength(12);
  });

  it('imports a file with Food switched on, keeps every row, and the next load switches it off (D139, D140)', async () => {
    await legacyFoodProfile();
    const file = await text();
    const stored = JSON.parse(file).data;
    expect(stored.foodDays).toHaveLength(12);
    expect(stored.foodEntries).toHaveLength(3);

    // Restored on a new device a few days later, and opened.
    const importDay = addDays(ORIGIN, 14);
    freezeAt(importDay);
    await wipe();
    expect((await importBackup(file)).ok).toBe(true);
    const before = await loadHistory(ORIGIN, addDays(ORIGIN, 13), importDay);
    await loadConfiguration();

    // Every Food row is still there, byte for byte, and so is the record.
    expect(await foodDaysRepository.getAll()).toEqual(stored.foodDays);
    expect(await foodEntriesRepository.getAll()).toHaveLength(3);
    const food = await domainsRepository.findByType('food');
    expect(food?.enabled).toBe(false);
    expect(food?.settings).toEqual(stored.domains.find((domain: { type: string }) => domain.type === 'food').settings);

    // Food is off from the import day, and only from it.
    const snapshots = await configSnapshotsRepository.list();
    expect(snapshots[snapshots.length - 1]?.effectiveFrom).toBe(importDay);
    const foodOn = (date: string) =>
      [...snapshots].reverse().find((snapshot) => snapshot.effectiveFrom <= date)!
        .config.domains.some((domain) => domain.type === 'food' && domain.enabled);
    expect(foodOn(addDays(importDay, -1))).toBe(true);
    expect(foodOn(importDay)).toBe(false);

    // The days before replay exactly as they did.
    const after = await loadHistory(ORIGIN, addDays(ORIGIN, 13), importDay);
    expect(after.food).toEqual(before.food);
    expect(after.days).toEqual(before.days);

    // And a second export still carries all of it.
    const again = JSON.parse(await text()).data;
    expect(again.foodDays).toEqual(stored.foodDays);
    expect(again.foodEntries).toEqual(stored.foodEntries);
  });

  it('exporting twice around an import gives the same file', async () => {
    await applyOnboarding({ questions: [{ text: 'A', type: 'boolean', category: 'eigene' }], gymTargetPerWeek: 3 });
    await recordDays(20);
    const first = await exportBackup();
    await wipe();
    await importBackup(JSON.stringify(first));
    const second = await exportBackup();
    // The envelope carries the moment of export; the data must not differ.
    expect(second.data).toEqual(first.data);
  });
});

describe('historical integrity survives a restore', () => {
  it('replays exactly the same ratings after export, wipe and import', async () => {
    await applyOnboarding({
      questions: [
        { text: 'A', type: 'boolean', category: 'eigene' },
        { text: 'B', type: 'scale', category: 'eigene' },
      ],
      gymTargetPerWeek: 3,
    });
    await recordDays(45);
    freezeAt(addDays(ORIGIN, 50));

    const before = await loadProgression();
    const beforeHistory = await loadHistory(ORIGIN, addDays(ORIGIN, 49));
    const file = await text();

    await wipe();
    freezeAt(addDays(ORIGIN, 50));
    await importBackup(file);

    const after = await loadProgression();
    const afterHistory = await loadHistory(ORIGIN, addDays(ORIGIN, 49));

    expect(after.points.map((point) => point.rating)).toEqual(
      before.points.map((point) => point.rating),
    );
    expect(after.current).toBe(before.current);
    expect(after.peak).toBe(before.peak);
    expect(after.lifetimeXp).toBe(before.lifetimeXp);
    expect(after.rank.id).toBe(before.rank.id);
    expect(after.peakRank.id).toBe(before.peakRank.id);
    expect(after.checkInStreak).toEqual(before.checkInStreak);
    expect(afterHistory.overall).toEqual(beforeHistory.overall);
  });
});

describe('a bad file changes nothing', () => {
  async function existingProfile() {
    await applyOnboarding({ questions: [{ text: 'A', type: 'boolean', category: 'eigene' }], gymTargetPerWeek: 3 });
    await recordDays(5);
    return text();
  }

  async function expectUnchanged(before: string, attempt: string) {
    const result = await importBackup(attempt);
    expect(result.ok).toBe(false);
    expect(await text()).toBe(before);
  }

  it('rejects text that is not JSON', async () => {
    const before = await existingProfile();
    expect(inspectBackup('not a backup').ok).toBe(false);
    await expectUnchanged(before, 'not a backup');
  });

  it('rejects JSON that is not a Momentum backup', async () => {
    const before = await existingProfile();
    await expectUnchanged(before, JSON.stringify({ hello: 'world' }));
  });

  it('rejects a backup with missing sections', async () => {
    const before = await existingProfile();
    const broken = JSON.parse(before);
    delete broken.data.questions;
    await expectUnchanged(before, JSON.stringify(broken));
  });

  it('rejects records with missing fields', async () => {
    const before = await existingProfile();
    const broken = JSON.parse(before);
    delete broken.data.answers[0].date;
    await expectUnchanged(before, JSON.stringify(broken));
  });

  it('rejects a backup from a newer app', async () => {
    const before = await existingProfile();
    const future = JSON.parse(before);
    future.formatVersion = BACKUP_FORMAT_VERSION + 1;
    const result = inspectBackup(JSON.stringify(future));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problem).toBe('newerFormat');
    await expectUnchanged(before, JSON.stringify(future));
  });

  it('rejects data from a newer schema', async () => {
    const before = await existingProfile();
    const future = JSON.parse(before);
    future.schemaVersion = SCHEMA_VERSION + 1;
    const result = inspectBackup(JSON.stringify(future));
    if (!result.ok) expect(result.problem).toBe('newerSchema');
    await expectUnchanged(before, JSON.stringify(future));
  });

  it('rejects a file whose answers point at missing questions', async () => {
    const before = await existingProfile();
    const broken = JSON.parse(before);
    broken.data.questions = [];
    await expectUnchanged(before, JSON.stringify(broken));
  });

  it('rejects duplicated records', async () => {
    const before = await existingProfile();
    const broken = JSON.parse(before);
    broken.data.answers.push(broken.data.answers[0]);
    await expectUnchanged(before, JSON.stringify(broken));
  });

  it('reports every problem it found, not only the first', async () => {
    const before = await existingProfile();
    const broken = JSON.parse(before);
    delete broken.data.answers[0].date;
    delete broken.data.questions[0].text;
    const result = inspectBackup(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.details.length).toBeGreaterThan(1);
    await expectUnchanged(before, JSON.stringify(broken));
  });
});

describe('importing over an existing profile', () => {
  it('replaces rather than merges', async () => {
    await applyOnboarding({ questions: [{ text: 'Alt', type: 'boolean', category: 'eigene' }], gymTargetPerWeek: 3 });
    await recordDays(4);
    const saved = await text();

    await wipe();
    freezeAt(addDays(ORIGIN, 30));
    await applyOnboarding({ questions: [{ text: 'Neu', type: 'scale', category: 'eigene' }], gymTargetPerWeek: 6 });
    await recordDays(3, addDays(ORIGIN, 30));

    await importBackup(saved);
    const configuration = await loadConfiguration();
    // Nothing of the replaced profile survives.
    expect(configuration.questions.map((question) => question.text)).toEqual(['Alt']);
    expect(weeklyTargetOfDomain(configuration.domains.gym))
      .toBe(3);
  });

  it('is idempotent when the same backup is imported twice', async () => {
    await applyOnboarding({ questions: [{ text: 'A', type: 'boolean', category: 'eigene' }], gymTargetPerWeek: 3 });
    await recordDays(8);
    const saved = await text();

    await importBackup(saved);
    const once = await text();
    await importBackup(saved);
    const twice = await text();

    expect(twice).toBe(once);
    expect(JSON.parse(twice).data).toEqual(JSON.parse(saved).data);
    // No duplicated rows from importing on top of itself.
    expect((await answersRepository.getAll()).length).toBe(JSON.parse(saved).data.answers.length);
  });

  it('restores the settings that were in the backup', async () => {
    await applyOnboarding({ questions: [{ text: 'A', type: 'boolean', category: 'eigene' }], gymTargetPerWeek: null });
    await settingsRepository.setLanguage('en');
    const saved = await text();

    await wipe();
    await applyOnboarding({ questions: [], gymTargetPerWeek: null });
    await settingsRepository.setLanguage('de');

    await importBackup(saved);
    const settings = await settingsRepository.get();
    expect(settings?.language).toBe('en');
    expect(settings?.firstUseDate).toBe(ORIGIN);
  });
});
