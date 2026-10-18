import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../core/clock';
import { SCHEMA_VERSION } from '../core/model';
import { yesterdayWordingOf } from '../domains/mental/questionLibrary';
import type {
  AnswerRecord,
  ConfigSnapshotRecord,
  DomainRecord,
  QuestionRecord,
  SettingsRecord,
  SportsSessionRecord,
} from '../core/model';
import {
  ALL_STORES,
  DB_NAME,
  MIGRATIONS,
  STORES,
  closeDatabase,
  deleteDatabase,
  openDatabase,
} from './db';
import {
  answersRepository,
  configSnapshotsRepository,
  domainsRepository,
  exercisesRepository,
  foodDaysRepository,
  foodEntriesRepository,
  gymSetsRepository,
  questionsRepository,
  runsRepository,
  settingsRepository,
  sportsSessionsRepository,
} from './repositories';
import { runningPerformance } from '../core/running/performance';
import { loadProgression } from './services/ratingService';
import { loadBossProgression } from './services/bossService';

/**
 * The version 1 → version 2 migration, run against a database that really was
 * created at version 1.
 *
 * The point of these tests is not that the new stores appear. It is that a
 * user who installed RC2, used it for months and then receives this update
 * finds **the same numbers** afterwards. A migration that loses a rank is a
 * migration that has failed, however cleanly it ran.
 */

interface V1Backup {
  data: {
    settings: SettingsRecord;
    domains: DomainRecord[];
    questions: QuestionRecord[];
    answers: AnswerRecord[];
    sportsSessions: SportsSessionRecord[];
    configSnapshots: ConfigSnapshotRecord[];
  };
}

const fixture = (name: string): V1Backup =>
  JSON.parse(readFileSync(new URL(`../../.github/fixtures/${name}`, import.meta.url), 'utf8'));

/** Opens the database at version 1 and seeds it, exactly as RC2 left it. */
async function seedVersion1(data: V1Backup['data']): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => MIGRATIONS[0]!.up(request.result, request.transaction!);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(
        [
          STORES.settings,
          STORES.domains,
          STORES.questions,
          STORES.answers,
          STORES.sportsSessions,
          STORES.configSnapshots,
        ],
        'readwrite',
      );
      tx.objectStore(STORES.settings).put(data.settings);
      for (const domain of data.domains) tx.objectStore(STORES.domains).put(domain);
      for (const question of data.questions) tx.objectStore(STORES.questions).put(question);
      for (const answer of data.answers) tx.objectStore(STORES.answers).put(answer);
      for (const session of data.sportsSessions) {
        tx.objectStore(STORES.sportsSessions).put(session);
      }
      for (const snapshot of data.configSnapshots) {
        tx.objectStore(STORES.configSnapshots).put(snapshot);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    };
  });
}

beforeEach(async () => {
  await deleteDatabase();
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

describe('upgrading a real RC2 database', () => {
  beforeEach(async () => {
    setClock({ now: () => new Date(2026, 8, 7, 21, 0, 0) });
    await seedVersion1(fixture('rc2-export.json').data);
  });

  it('opens at the new version with every store present', async () => {
    const db = await openDatabase();
    expect(db.version).toBe(SCHEMA_VERSION);
    for (const store of ALL_STORES) expect(db.objectStoreNames.contains(store)).toBe(true);
  });

  it('leaves every record that was already there', async () => {
    await openDatabase();
    expect(await answersRepository.listByDate('2026-09-07')).toHaveLength(9);
    expect(await sportsSessionsRepository.getAll()).toHaveLength(1);
    expect(await questionsRepository.list()).toHaveLength(9);
  });

  it('leaves the sports domain exactly as it was', async () => {
    // Until the user says what those sessions were, nothing about their
    // history is reinterpreted — not the domain, not its target, not a row.
    await openDatabase();
    const sports = await domainsRepository.findByType('sports');
    expect(sports?.enabled).toBe(true);
    expect(sports?.type === 'sports' && sports.settings.targetPerWeek).toBe(4);
  });

  it('marks the legacy Sport question as outstanding rather than answering it', async () => {
    await openDatabase();
    const settings = await settingsRepository.getOrCreate();
    expect(settings.legacySportMigration).toBe('pending');
  });

  it('gives every question a category, and none of them an inversion', async () => {
    await openDatabase();
    const questions = await questionsRepository.list();
    expect(questions.every((question) => question.category !== undefined)).toBe(true);
    // No RC2 question was inverted, so `false` is the only value that cannot
    // change a score that has already been recorded.
    expect(questions.every((question) => question.inverted === false)).toBe(true);
  });

  it('recognises the questions RC2 shipped and calls anything else Eigene', async () => {
    await openDatabase();
    const questions = await questionsRepository.list();
    const byText = new Map(questions.map((question) => [question.text, question.category]));
    expect(byText.get('Wie gut hast du geschlafen?')).toBe('gesundheit');
    expect(byText.get('Hast du dir heute bewusst Zeit für dich genommen?')).toBe('mental');
    expect(byText.get('Trainiert?')).toBe('eigene');
  });

  it('gives exactly the five questions RC2 shipped their Gestern wording (D144)', async () => {
    await openDatabase();
    const worded = (await questionsRepository.list())
      .map((question) => [question.text, yesterdayWordingOf(question.text)] as const)
      .filter(([, yesterday]) => yesterday !== null);
    expect(new Map(worded)).toEqual(
      new Map([
        ['Hast du dir heute bewusst Zeit für dich genommen?', 'Hast du dir gestern bewusst Zeit für dich genommen?'],
        ['Wie zufrieden bist du heute mit deinem Tag?', 'Wie zufrieden warst du gestern mit deinem Tag?'],
        ['Wie gut hast du geschlafen?', 'Wie gut hast du in der Nacht auf gestern geschlafen?'],
        ['Hast du heute etwas gemacht, das dir gutgetan hat?', 'Hast du gestern etwas gemacht, das dir gutgetan hat?'],
        ['Wie hoch war dein Energielevel?', 'Wie hoch war dein Energielevel gestern?'],
      ]),
    );
    // The user's own four read as written, on either side.
    expect((await questionsRepository.list()).length).toBe(9);
  });

  it('marks existing answers private, which is what a later social layer needs', async () => {
    await openDatabase();
    const answers = await answersRepository.listByDate('2026-09-07');
    expect(answers.every((answer) => answer.sensitivity === 'private')).toBe(true);
  });

  it('reproduces the exact numbers RC2 showed for this profile', async () => {
    // Recorded by running the RC2 build (application commit c3e8b7f) against
    // this same fixture. If any of these move, the upgrade has rewritten a
    // user's history, which D45 forbids.
    await openDatabase();
    const progression = await loadProgression();
    expect(progression.current).toBeCloseTo(261.67367135576694, 10);
    expect(progression.peak).toBeCloseTo(261.67367135576694, 10);
    expect(progression.rank.id).toBe('contender');
    expect(progression.peakRank.id).toBe('contender');
    expect(progression.lifetimeXp).toBe(90);
    expect(progression.checkInStreak).toEqual({ current: 1, best: 1 });
    expect(progression.trainingStreak).toEqual({ current: 0, best: 0 });
    expect(progression.firstScoredDate).toBe('2026-09-07');
    expect(progression.history.overall).toEqual([49.166666666666664]);
    expect(progression.history.mental).toEqual([73.33333333333333]);
    expect(progression.history.sports).toEqual([25]);
  });
});

describe('upgrading a database with months of history', () => {
  beforeEach(async () => {
    setClock({ now: () => new Date(2026, 8, 1, 9, 0, 0) });
    await seedVersion1(fixture('rc2-synthetic.json').data);
  });

  it('reproduces every number RC2 showed, including the rank history', async () => {
    // 120 days with a fortnight of silence in the middle: decay, a broken
    // streak, five rank changes and eighteen weeks of targets. This is the
    // assertion that "existing data survives" actually means something.
    await openDatabase();
    const progression = await loadProgression();
    expect(progression.current).toBeCloseTo(732.5342908289315, 9);
    expect(progression.peak).toBeCloseTo(749.5023613714083, 9);
    expect(progression.rank.id).toBe('master');
    expect(progression.peakRank.id).toBe('master');
    expect(progression.lifetimeXp).toBe(4640);
    expect(progression.checkInStreak).toEqual({ current: 5, best: 5 });
    expect(progression.trainingStreak).toEqual({ current: 6, best: 8 });
    expect(progression.points).toHaveLength(121);
    expect(progression.changes).toHaveLength(5);
    expect(progression.changes[4]).toEqual({
      date: '2026-08-03',
      kind: 'promotion',
      from: 'veteran',
      to: 'master',
      rating: 700.4840124889928,
    });
    expect(progression.points[30]?.rating).toBeCloseTo(628.2508425931381, 9);
    expect(progression.points[90]?.rating).toBeCloseTo(692.5198493242135, 9);
    expect(progression.history.days.filter((day) => day.status === 'scored')).toHaveLength(119);
    expect(progression.history.weeks.filter((week) => week.met)).toHaveLength(14);
  });

  it('grandfathers that progression into the Boss, day for day', async () => {
    // Every snapshot RC2 wrote carries no Boss weights, and the replay reads
    // that absence as "one undivided progression". So the Boss for a
    // pre-upgrade day is not a number carried across a boundary — it is the
    // same replay, and it cannot drift from what the user already saw.
    await openDatabase();
    const [legacy, boss] = await Promise.all([loadProgression(), loadBossProgression()]);
    expect(boss.era).toBe('legacy');
    expect(boss.rank.id).toBe(legacy.rank.id);
    expect(boss.peakRank.id).toBe(legacy.peakRank.id);
    expect(boss.lifetimeXp).toBe(legacy.lifetimeXp);
    boss.points.forEach((point, index) => {
      expect(point.era).toBe('legacy');
      expect(point.rating).toBeCloseTo(legacy.points[index]!.rating, 9);
    });
  });
});

describe('the gym stores at version 3 and 4', () => {
  /**
   * Version 3 reshapes two gym stores: an exercise gains `muscles` in place
   * of a single `muscle`, and a set stores whole grams in place of a
   * floating-point kilogram figure. Version 4 then gives an exercise a load
   * type and explicit muscle roles.
   *
   * The seed here is a **version 2** database, so both migrations run in one
   * upgrade — which is the case that matters, because two migrations
   * rewriting the same store used to be able to overwrite each other.
   *
   * No release has ever written either record — phase 1 created the stores
   * and phase 4 is the first code to fill them — so on a real device this
   * migrates nothing. It is tested against version 2 rows anyway, because a
   * store that is empty everywhere today is exactly the one that turns out
   * not to have been, and a restored backup can carry anything.
   */
  async function seedVersion2Gym(): Promise<void> {
    await seedVersion1(fixture('rc2-export.json').data);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 2);
      request.onupgradeneeded = () => MIGRATIONS[1]!.up(request.result, request.transaction!);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction([STORES.exercises, STORES.gymSets], 'readwrite');
        tx.objectStore(STORES.exercises).put({
          id: 'ex_old',
          muscle: 'chest',
          name: 'Bench Press',
          builtIn: true,
          bodyweightBased: false,
          addedWeightKg: null,
          durationSeconds: null,
          attributes: {},
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        });
        tx.objectStore(STORES.gymSets).put({
          id: 'set_old',
          sessionId: 'gym_old',
          exerciseId: 'ex_old',
          date: '2026-09-07',
          weightKg: 62.5,
          reps: 8,
          order: 0,
          createdAt: '2026-09-07T18:00:00.000Z',
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      };
    });
  }

  beforeEach(async () => {
    setClock({ now: () => new Date(2026, 8, 7, 21, 0, 0) });
    await seedVersion2Gym();
  });

  it('opens at the current version with every store still present', async () => {
    const db = await openDatabase();
    expect(db.version).toBe(SCHEMA_VERSION);
    for (const store of ALL_STORES) expect(db.objectStoreNames.contains(store)).toBe(true);
  });

  it('gives an exercise a list of muscles instead of one', async () => {
    await openDatabase();
    const exercise = await exercisesRepository.get('ex_old');
    expect(exercise?.muscles).toEqual(['chest']);
    expect((exercise as unknown as { muscle?: string }).muscle).toBeUndefined();
    // And it keeps the name it had, which is what history joins on after id.
    expect(exercise?.name).toBe('Bench Press');
  });

  it('gives an exercise a load type and explicit roles', async () => {
    await openDatabase();
    const exercise = await exercisesRepository.get('ex_old');
    // Both migrations reached the same record, in order, in one upgrade.
    expect(exercise?.muscles).toEqual(['chest']);
    expect(exercise?.loadType).toBe('external');
    expect(exercise?.primaryMuscles).toEqual(['chest']);
    expect((exercise as unknown as { bodyweightBased?: boolean }).bodyweightBased).toBeUndefined();
  });

  it('reads a bodyweight-flagged exercise as a bodyweight load type', async () => {
    await openDatabase();
    await exercisesRepository.put({
      id: 'ex_flagged',
      muscles: ['back'],
      name: 'Pull-Up',
      builtIn: false,
      durationSeconds: null,
      attributes: {},
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      // As a version-3 record carried it.
      ...({ bodyweightBased: true } as object),
    });
    const transform = MIGRATIONS[3]!.transforms![STORES.exercises]!;
    const migrated = transform({
      id: 'ex_flagged',
      muscles: ['back', 'biceps'],
      bodyweightBased: true,
      addedWeightKg: 5,
    })!;
    expect(migrated.loadType).toBe('bodyweight');
    expect(migrated.primaryMuscles).toEqual(['back']);
    expect(migrated.bodyweightBased).toBeUndefined();
    expect(migrated.addedWeightKg).toBeUndefined();
  });

  it('leaves a set with no roles alone, because that is how it was scored', async () => {
    await openDatabase();
    const set = (await gymSetsRepository.getAll()).find((entry) => entry.id === 'set_old');
    // Filling roles in from today's catalogue would silently re-weight a
    // workout already done. Absent is the record of the equal weighting it
    // was actually aggregated under.
    expect(set?.primaryMuscles).toBeUndefined();
    expect(set?.loadType).toBeUndefined();
  });

  it('converts a set to whole grams without losing the weight', async () => {
    await openDatabase();
    const set = (await gymSetsRepository.getAll()).find((entry) => entry.id === 'set_old');
    expect(set?.weightGrams).toBe(62_500);
    expect((set as unknown as { weightKg?: number }).weightKg).toBeUndefined();
    expect(set?.reps).toBe(8);
    expect(set?.muscles).toEqual([]);
  });

  it('leaves a legacy run attendance-only, because RC2 recorded no distance', async () => {
    /*
     * Phase 5 changed no record shape — `distanceMetres` has existed since
     * schema 2 — so there is no migration to run. What has to hold is that a
     * run carrying no distance is never given one, and therefore never
     * carries performance. This is the promise every converted RC2 run
     * depends on.
     */
    await openDatabase();
    const snapshot = (await configSnapshotsRepository.list())[0]!;
    await runsRepository.create({
      date: '2026-09-06',
      durationSeconds: 1800,
      configSnapshotId: snapshot.id,
      legacyCarryOver: true,
    });
    const stored = (await runsRepository.getAll()).find((run) => run.legacyCarryOver)!;
    expect(stored.distanceMetres).toBeNull();
    expect(stored.elevationMetres).toBeNull();
    expect(runningPerformance([
      { id: stored.id, date: stored.date, distanceMetres: stored.distanceMetres, durationSeconds: stored.durationSeconds },
    ]).ratio).toBeNull();
  });

  it('still reproduces the RC2 numbers it was carrying', async () => {
    // The gym reshape must not have disturbed a single Wellbeing day.
    await openDatabase();
    const progression = await loadProgression();
    expect(progression.current).toBeCloseTo(261.67367135576694, 10);
    expect(progression.rank.id).toBe('contender');
    expect(progression.lifetimeXp).toBe(90);
  });
});


describe('the food ratings store at version 5', () => {
  /**
   * Version 5 adds one store and rewrites nothing.
   *
   * The case that matters is a device that had Food switched on before there
   * was anything to rate with: it must come out with an empty ratings store,
   * not with ratings guessed from the entries it happens to carry. What a
   * person ate is not a statement about how the day went, and putting a
   * number in the history that nobody entered is exactly the failure the
   * whole "store what happened" rule exists to prevent.
   */
  async function seedVersion4WithFoodEntries(): Promise<void> {
    await seedVersion1(fixture('rc2-export.json').data);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 4);
      request.onupgradeneeded = () => {
        for (const migration of MIGRATIONS) {
          if (migration.version < 2 || migration.version > 4) continue;
          migration.up(request.result, request.transaction!);
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction([STORES.foodEntries], 'readwrite');
        tx.objectStore(STORES.foodEntries).put({
          id: 'food_old',
          date: '2026-09-07',
          foodId: null,
          label: 'Znüni',
          grams: 80,
          kcal: 310,
          proteinG: null,
          carbsG: null,
          fatG: null,
          detail: null,
          sensitivity: 'private',
          configSnapshotId: 'cfg_1',
          createdAt: '2026-09-07T10:00:00.000Z',
          updatedAt: '2026-09-07T10:00:00.000Z',
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      };
    });
  }

  beforeEach(async () => {
    setClock({ now: () => new Date(2026, 8, 7, 21, 0, 0) });
    await seedVersion4WithFoodEntries();
  });

  it('opens at the current version with the new store in place', async () => {
    const db = await openDatabase();
    expect(db.version).toBe(SCHEMA_VERSION);
    expect(db.objectStoreNames.contains(STORES.foodDays)).toBe(true);
    for (const store of ALL_STORES) expect(db.objectStoreNames.contains(store)).toBe(true);
  });

  it('invents no rating from the entries that were already there', async () => {
    await openDatabase();
    expect(await foodDaysRepository.getAll()).toEqual([]);
    // And the entry itself is untouched.
    const entry = await foodEntriesRepository.get('food_old');
    expect(entry?.kcal).toBe(310);
  });

  it('declares no per-record rewrite, so it cannot collide with another', () => {
    const migration = MIGRATIONS.find((entry) => entry.version === 5)!;
    expect(migration.transforms).toBeUndefined();
  });
});
