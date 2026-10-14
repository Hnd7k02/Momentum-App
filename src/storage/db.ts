import { noteCommittedWrite } from './changes';
import { SCHEMA_VERSION } from '../core/model';
import type { LegacySportMigration, QuestionCategory, Sensitivity } from '../core/model';

/**
 * The only module in Momentum that talks to IndexedDB.
 *
 * Everything above it — repositories, domain logic, React — sees typed
 * functions and never an `IDBRequest`. The schema is versioned from the first
 * commit and every future change goes in as a numbered migration, so an
 * installed PWA carrying real history can always be upgraded in place.
 */

export const DB_NAME = 'momentum';
export const DB_VERSION = SCHEMA_VERSION;

export const STORES = {
  settings: 'settings',
  domains: 'domains',
  questions: 'questions',
  answers: 'answers',
  /** RC2's generic sport sessions. Kept under its original name: renaming a
   *  store means copying every record for no gain. */
  sportsSessions: 'sportsSessions',
  configSnapshots: 'configSnapshots',
  rankEvents: 'rankEvents',
  // Iteration 2.
  profile: 'profile',
  exercises: 'exercises',
  gymPlans: 'gymPlans',
  gymSessions: 'gymSessions',
  gymSets: 'gymSets',
  runs: 'runs',
  foodEntries: 'foodEntries',
  /** One nutrition adherence rating per calendar day, keyed by the date. */
  foodDays: 'foodDays',
  weightEntries: 'weightEntries',
  restDays: 'restDays',
  pausePeriods: 'pausePeriods',
  tombstones: 'tombstones',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export const ALL_STORES: StoreName[] = Object.values(STORES);

/** A per-record rewrite. Returns the new record, or `null` to leave it. */
type RecordTransform = (record: Record<string, unknown>) => Record<string, unknown> | null;

interface Migration {
  version: number;
  describe: string;
  /** Structural work: stores, indexes, and anything that is not a rewrite. */
  up(db: IDBDatabase, tx: IDBTransaction): void;
  /**
   * Per-record rewrites, by store.
   *
   * Declared rather than performed, because **two migrations rewriting the
   * same store must not each open their own cursor.** Requests inside one
   * upgrade transaction are served in the order they were made, so two
   * cursors over `exercises` would both read a record as it was before either
   * of them wrote, and the later write would win with a value that never saw
   * the earlier one. A device upgrading from version 2 straight to version 4
   * would have lost version 3's reshape entirely — silently, and only on the
   * devices that skipped a release.
   *
   * The runner composes every applicable migration's transform for a store,
   * in version order, and applies the chain in a single pass. Each transform
   * therefore sees exactly what the one before it produced, which is what
   * running the versions in sequence was always supposed to mean.
   */
  transforms?: Partial<Record<StoreName, RecordTransform>>;
}

/**
 * Migrations run in order for every version above the installed one.
 * Version 1 has nothing to migrate *from*, but the path exists so that
 * version 2 does not have to invent it under pressure.
 */
/**
 * Exported so a migration can be tested against a database that really was
 * created at the older version, rather than against a hand-built imitation
 * of one. Nothing in the app reads this.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    describe: 'initial schema',
    up(db) {
      db.createObjectStore(STORES.settings, { keyPath: 'id' });

      const domains = db.createObjectStore(STORES.domains, { keyPath: 'id' });
      domains.createIndex('by_type', 'type', { unique: false });

      const questions = db.createObjectStore(STORES.questions, { keyPath: 'id' });
      questions.createIndex('by_domain', 'domainId', { unique: false });
      questions.createIndex('by_status', 'status', { unique: false });

      const answers = db.createObjectStore(STORES.answers, { keyPath: 'id' });
      answers.createIndex('by_date', 'date', { unique: false });
      answers.createIndex('by_question', 'questionId', { unique: false });
      answers.createIndex('by_domain_date', ['domainId', 'date'], { unique: false });

      const sessions = db.createObjectStore(STORES.sportsSessions, { keyPath: 'id' });
      sessions.createIndex('by_date', 'date', { unique: false });
      sessions.createIndex('by_week', 'weekKey', { unique: false });

      const snapshots = db.createObjectStore(STORES.configSnapshots, { keyPath: 'id' });
      snapshots.createIndex('by_effective_from', 'effectiveFrom', { unique: false });

      const rankEvents = db.createObjectStore(STORES.rankEvents, { keyPath: 'id' });
      rankEvents.createIndex('by_date', 'date', { unique: false });
    },
  },
  {
    version: 2,
    describe: 'iteration 2: domains, gym, running, food, profile',
    up(db, tx) {
      /*
       * Purely additive. Not one existing record is deleted or reshaped in a
       * way that changes its meaning, and the RC2 sport domain is deliberately
       * left exactly as it is — what those sessions were is the user's to say,
       * and until they do, nothing about their history is reinterpreted.
       */
      db.createObjectStore(STORES.profile, { keyPath: 'id' });

      const exercises = db.createObjectStore(STORES.exercises, { keyPath: 'id' });
      exercises.createIndex('by_muscle', 'muscle', { unique: false });

      db.createObjectStore(STORES.gymPlans, { keyPath: 'id' });

      const gymSessions = db.createObjectStore(STORES.gymSessions, { keyPath: 'id' });
      gymSessions.createIndex('by_date', 'date', { unique: false });
      gymSessions.createIndex('by_week', 'weekKey', { unique: false });

      const gymSets = db.createObjectStore(STORES.gymSets, { keyPath: 'id' });
      gymSets.createIndex('by_session', 'sessionId', { unique: false });
      gymSets.createIndex('by_exercise', 'exerciseId', { unique: false });
      gymSets.createIndex('by_date', 'date', { unique: false });

      const runs = db.createObjectStore(STORES.runs, { keyPath: 'id' });
      runs.createIndex('by_date', 'date', { unique: false });
      runs.createIndex('by_week', 'weekKey', { unique: false });
      // An imported activity may arrive twice; one external id is one run.
      runs.createIndex('by_external', 'externalId', { unique: false });

      const food = db.createObjectStore(STORES.foodEntries, { keyPath: 'id' });
      food.createIndex('by_date', 'date', { unique: false });

      const weights = db.createObjectStore(STORES.weightEntries, { keyPath: 'id' });
      weights.createIndex('by_date', 'date', { unique: false });

      const restDays = db.createObjectStore(STORES.restDays, { keyPath: 'id' });
      restDays.createIndex('by_date', 'date', { unique: false });

      const pauses = db.createObjectStore(STORES.pausePeriods, { keyPath: 'id' });
      pauses.createIndex('by_from', 'from', { unique: false });

      db.createObjectStore(STORES.tombstones, { keyPath: 'id' });

      // Questions gain a category and the inverted flag. `false` is the only
      // safe default: no RC2 question was inverted, so nothing any existing
      // answer already scored can move.
      backfill(tx, STORES.questions, (question) => {
        if (question.category !== undefined && question.inverted !== undefined) return null;
        return {
          ...question,
          category:
            question.category ??
            RC2_QUESTION_CATEGORIES[String(question.text)] ??
            ('eigene' satisfies QuestionCategory),
          inverted: question.inverted ?? false,
        };
      });

      backfill(tx, STORES.answers, (answer) =>
        answer.sensitivity === undefined
          ? { ...answer, sensitivity: 'private' satisfies Sensitivity }
          : null,
      );

      /*
       * Does this device carry RC2 sport data that has to be classified?
       *
       * Only if a sports domain exists. `pending` means the user is asked
       * once, on their own terms; `none` means there is nothing to ask about
       * and they are never interrupted.
       */
      const sportsQuery = tx.objectStore(STORES.domains).index('by_type').count('sports');
      sportsQuery.onsuccess = () => {
        const hasLegacySport = sportsQuery.result > 0;
        backfill(tx, STORES.settings, (settings) =>
          settings.legacySportMigration === undefined
            ? {
                ...settings,
                legacySportMigration: (hasLegacySport
                  ? 'pending'
                  : 'none') satisfies LegacySportMigration,
              }
            : null,
        );
      };
    },
  },
  {
    version: 3,
    describe: 'gym: multi-muscle exercises, integer set weights',
    up() {
      /*
       * Two shape changes in the gym stores, both additive in effect.
       *
       * Nothing on any device has ever written an exercise or a set — phase 1
       * created the stores and phase 4 is the first code to fill them — so
       * this is a migration over an empty store in practice. It is written
       * properly anyway: a store that is empty everywhere today is exactly
       * the store that turns out not to have been, and a backup restored from
       * a hand-edited file can carry anything.
       */
    },
    transforms: {
      [STORES.exercises]: (exercise) => {
        if (Array.isArray(exercise.muscles)) return null;
        const single = exercise.muscle;
        const { muscle: _drop, ...rest } = exercise;
        return { ...rest, muscles: typeof single === 'string' ? [single] : [] };
      },
      [STORES.gymSets]: (set) => {
        if (set.weightGrams !== undefined && Array.isArray(set.muscles)) return null;
        const { weightKg, ...rest } = set;
        return {
          ...rest,
          weightGrams:
            set.weightGrams ?? (typeof weightKg === 'number' ? Math.round(weightKg * 1000) : 0),
          muscles: Array.isArray(set.muscles) ? set.muscles : [],
        };
      },
    },
  },
  {
    version: 4,
    describe: 'gym: primary/secondary muscle roles, exercise load types',
    up() {
      /*
       * Additive, and pointedly incomplete on purpose.
       *
       * An exercise gains `loadType` and `primaryMuscles`, migrated from the
       * `bodyweightBased` flag and from the "primary group first" ordering
       * that phase 4's catalogue used as a display convention. That is a safe
       * reading for an *exercise*: it is configuration, and configuration is
       * allowed to change going forward.
       *
       * **A set is left alone.** A set written by phase 4 recorded no roles,
       * because none existed, and it was aggregated with every one of its
       * groups counting equally. Filling roles in now — from today's
       * catalogue, or from an ordering nobody promised meant anything — would
       * silently re-weight a workout already done, which is the one thing
       * D87 exists to prevent. The absence of `primaryMuscles` on a set is
       * therefore the record of how that set was actually scored, and the
       * replay reads it as such.
       *
       * The same applies to `loadType`: absent means external, which is what
       * every set written before load types existed was, since phase 4 had no
       * way to log anything else.
       */
    },
    transforms: {
      [STORES.exercises]: (exercise) => {
        if (exercise.loadType !== undefined && exercise.primaryMuscles !== undefined) return null;
        const { bodyweightBased, addedWeightKg: _added, ...rest } = exercise;
        const muscles = Array.isArray(exercise.muscles) ? exercise.muscles : [];
        return {
          ...rest,
          loadType: exercise.loadType ?? (bodyweightBased === true ? 'bodyweight' : 'external'),
          primaryMuscles: exercise.primaryMuscles ?? muscles.slice(0, 1),
        };
      },
    },
  },
  {
    version: 5,
    describe: 'food: one adherence rating per day',
    up(db) {
      /*
       * One new store and nothing else. Purely additive, with no transform:
       * there is no earlier record anywhere that could be read as an
       * adherence rating, and inventing one from the food entries a user
       * happened to log would be fabricating an answer they never gave.
       *
       * A device that had Food switched on before this version simply has no
       * ratings for those days, which is what actually happened — Food
       * contributed nothing to the Boss then and its absence is the record of
       * that, not a gap to fill.
       */
      const foodDays = db.createObjectStore(STORES.foodDays, { keyPath: 'id' });
      foodDays.createIndex('by_date', 'date', { unique: false });
    },
  },
];

/**
 * The five predefined questions RC2 shipped, and the category each belongs to.
 *
 * Matched on the exact text because that is what RC2 copied into the record —
 * a suggestion's id was never stored. Anything unrecognised, including every
 * question the user wrote, becomes "Eigene", which is true by definition.
 */
const RC2_QUESTION_CATEGORIES: Record<string, QuestionCategory> = {
  'Wie gut hast du geschlafen?': 'gesundheit',
  'How well did you sleep?': 'gesundheit',
  'Wie hoch war dein Energielevel?': 'gesundheit',
  'How high was your energy level?': 'gesundheit',
  'Wie zufrieden bist du heute mit deinem Tag?': 'mental',
  'How satisfied are you with your day?': 'mental',
  'Hast du dir heute bewusst Zeit für dich genommen?': 'mental',
  'Did you take time for yourself today?': 'mental',
  'Hast du heute etwas gemacht, das dir gutgetan hat?': 'mental',
  'Did you do something today that was good for you?': 'mental',
};

/** Walks every record in a store and writes back whatever `fn` returns. */
function backfill(tx: IDBTransaction, store: StoreName, fn: RecordTransform): void {
  const request = tx.objectStore(store).openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    const next = fn(cursor.value as Record<string, unknown>);
    if (next) cursor.update(next);
    cursor.continue();
  };
}

/**
 * Every applicable migration's transforms for one store, as a single pass.
 *
 * Composed in version order, and each transform is handed what the previous
 * one produced — so a device jumping from version 2 to version 4 gets the
 * same record as one that upgraded to 3 first and to 4 later. One cursor per
 * store is the whole point: two cursors would both read the record as it was
 * before either wrote, and one of the two versions would vanish.
 */
function applyTransforms(tx: IDBTransaction, from: number): void {
  const chains = new Map<StoreName, RecordTransform[]>();
  for (const migration of MIGRATIONS) {
    if (migration.version <= from || !migration.transforms) continue;
    for (const [store, transform] of Object.entries(migration.transforms)) {
      if (!transform) continue;
      const list = chains.get(store as StoreName);
      if (list) list.push(transform);
      else chains.set(store as StoreName, [transform]);
    }
  }

  for (const [store, transforms] of chains) {
    backfill(tx, store, (record) => {
      let current = record;
      let changed = false;
      for (const transform of transforms) {
        const next = transform(current);
        if (next) {
          current = next;
          changed = true;
        }
      }
      return changed ? current : null;
    });
  }
}

/**
 * Why storage failed, in terms the interface can act on.
 *
 * - `unavailable` — no IndexedDB at all (private mode in some browsers).
 * - `blocked`     — another tab holds an older version open.
 * - `newerData`   — the database on disk is newer than this build understands,
 *                   which happens when an older tab is opened after an update.
 * - `failed`      — everything else, including a migration that threw.
 */
export type StorageFailure = 'unavailable' | 'blocked' | 'newerData' | 'failed';

export class StorageError extends Error {
  constructor(
    readonly reason: StorageFailure,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export function isStorageAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    // Accessing the global itself can throw where site data is blocked.
    return false;
  }
}

export function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  if (!isStorageAvailable()) {
    dbPromise = null;
    return Promise.reject(
      new StorageError('unavailable', 'This browser will not let Momentum store data'),
    );
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction;
      if (!tx) throw new Error('Upgrade transaction missing');
      const from = event.oldVersion;
      try {
        for (const migration of MIGRATIONS) {
          if (migration.version > from) migration.up(db, tx);
        }
        applyTransforms(tx, from);
      } catch (error) {
        // Abort rather than leave a half-migrated database behind; the open
        // then fails and the interface can offer a way out.
        tx.abort();
        throw new StorageError('failed', 'Momentum could not update its stored data', error);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Another tab upgraded the schema: drop this handle rather than serve
      // stale structure.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      const error = request.error;
      // A database newer than this build is the update case: an old tab is
      // still open after a new version has run.
      const reason: StorageFailure = error?.name === 'VersionError' ? 'newerData' : 'failed';
      reject(
        new StorageError(
          reason,
          reason === 'newerData'
            ? 'This page is running an older version of Momentum than the stored data'
            : 'Momentum could not open its stored data',
          error,
        ),
      );
    };
    request.onblocked = () =>
      reject(
        new StorageError('blocked', 'Another open Momentum tab is holding the data'),
      );
  }).catch((error) => {
    dbPromise = null;
    throw error instanceof StorageError
      ? error
      : new StorageError('failed', 'Momentum could not open its stored data', error);
  });

  return dbPromise;
}

export async function closeDatabase(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise.catch(() => null);
  db?.close();
  dbPromise = null;
}

/** Used by import (§19) and by tests. Destroys all local data. */
export async function deleteDatabase(): Promise<void> {
  await closeDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Could not delete database'));
    request.onblocked = () => resolve();
  });
}

/**
 * Replaces the contents of every store in **one** transaction.
 *
 * This is what makes an import atomic: IndexedDB rolls the whole transaction
 * back if any part of it fails, so a profile is either fully replaced or
 * left exactly as it was. Clearing and writing store by store would leave a
 * half-restored profile behind the moment one write failed.
 */
export async function replaceAllStores(
  contents: Partial<Record<StoreName, unknown[]>>,
): Promise<void> {
  await runTransaction(ALL_STORES, 'readwrite', (tx) => {
    for (const store of ALL_STORES) {
      const objectStore = tx.objectStore(store);
      objectStore.clear();
      for (const record of contents[store] ?? []) objectStore.put(record);
    }
  });
}

/**
 * Runs `body` inside one transaction and resolves only once that transaction
 * has actually committed — so a caller that awaits it knows the data is
 * durable, which matters for an import that must be atomic.
 */
export async function runTransaction<T>(
  stores: StoreName[],
  mode: IDBTransactionMode,
  body: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openDatabase();
  const tx = db.transaction(stores, mode);
  const done = transactionDone(tx);
  let result: T;
  try {
    result = await body(tx);
  } catch (error) {
    // `done` is about to reject too — aborting the transaction is what makes
    // it reject — and nothing is waiting on it any more, because the error
    // from `body` is the one worth reporting. Observe it, or it surfaces as
    // an unhandled rejection: noise in the browser, and a non-zero exit from
    // the test runner even when every test passes.
    done.catch(() => undefined);
    try {
      tx.abort();
    } catch {
      // Already finished; the original error is the interesting one.
    }
    throw error;
  }
  await done;
  // Committed: tell the screens that read the whole store (WP3, B2).
  if (mode === 'readwrite') noteCommittedWrite();
  return result;
}
