import { nowIso } from '../../core/clock';
import { weekKeyOf, type DateKey, type WeekKey } from '../../core/dates';
import { createId } from '../../core/ids';
import {
  isTrainingPlan,
  type ExerciseRecord,
  type GymPlanStoreRecord,
  type GymSessionRecord,
  type GymSetRecord,
  type MuscleGroup,
  type TrainingPlanRecord,
} from '../../core/model';
import { STORES } from '../db';
import { createRepository } from './base';

/**
 * The gym stores.
 *
 * Four stores rather than one nested record, for one reason: D24 judges
 * strength on the **best set of the day**, so every set has to survive as its
 * own row. Storing sets inside a session as an array would work until the
 * first query that asks "what is the heaviest this exercise has ever been
 * lifted", which is the query the whole domain is built on.
 */

const exercises = createRepository<ExerciseRecord>(STORES.exercises);
const plans = createRepository<GymPlanStoreRecord>(STORES.gymPlans);
const sessions = createRepository<GymSessionRecord>(STORES.gymSessions);
const sets = createRepository<GymSetRecord>(STORES.gymSets);

const byTime = (a: { performedAt: string }, b: { performedAt: string }) =>
  a.performedAt.localeCompare(b.performedAt);

export const exercisesRepository = {
  get: (id: string) => exercises.get(id),
  getAll: () => exercises.getAll(),
  listByMuscle: (muscle: MuscleGroup) => exercises.queryIndex('by_muscle', muscle),
  put: (record: ExerciseRecord) => exercises.put(record),
  putMany: (records: ExerciseRecord[]) => exercises.putMany(records),
  remove: (id: string) => exercises.remove(id),
  replaceAll: async (records: ExerciseRecord[]) => {
    await exercises.clear();
    await exercises.putMany(records);
  },
};

/**
 * The `gymPlans` store holds the user's training plans (WP2-1).
 *
 * It was declared in iteration 2 for a generated-plan shape nothing ever
 * wrote. `getAll` returns whatever is there, for backup; `listTrainingPlans`
 * returns only records carrying the training-plan discriminator, so a
 * record of any other shape — restored from a hand-edited file, say — is
 * preserved and never shown as a plan.
 */
export const gymPlansRepository = {
  async get(id: string): Promise<TrainingPlanRecord | undefined> {
    const record = await plans.get(id);
    return isTrainingPlan(record) ? record : undefined;
  },
  getAll: () => plans.getAll(),
  async listTrainingPlans(): Promise<TrainingPlanRecord[]> {
    return (await plans.getAll())
      .filter(isTrainingPlan)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  },
  put: (record: TrainingPlanRecord) => plans.put(record),
  remove: (id: string) => plans.remove(id),
  replaceAll: async (records: GymPlanStoreRecord[]) => {
    await plans.clear();
    await plans.putMany(records);
  },
};

export interface NewGymSessionInput {
  date: DateKey;
  performedAt?: string;
  planId?: string | null;
  note?: string | null;
  /** True only for sessions carried over from RC2's Sport log. */
  legacyCarryOver?: boolean;
  configSnapshotId: string;
  /** `null` for a workout started in the app (WP3, P7); left out otherwise. */
  finishedAt?: null;
}

export const gymSessionsRepository = {
  get: (id: string) => sessions.get(id),

  async getAll(): Promise<GymSessionRecord[]> {
    return (await sessions.getAll()).sort(byTime);
  },

  async listByDate(date: DateKey): Promise<GymSessionRecord[]> {
    return (await sessions.queryIndex('by_date', date)).sort(byTime);
  },

  async listByWeek(weekKey: WeekKey): Promise<GymSessionRecord[]> {
    return (await sessions.queryIndex('by_week', weekKey)).sort(byTime);
  },

  async listByDateRange(from: DateKey, to: DateKey): Promise<GymSessionRecord[]> {
    if (to < from) return [];
    return (await sessions.queryIndex('by_date', IDBKeyRange.bound(from, to))).sort(byTime);
  },

  async create(input: NewGymSessionInput): Promise<GymSessionRecord> {
    const stamp = nowIso();
    const record: GymSessionRecord = {
      id: createId('gym'),
      date: input.date,
      weekKey: weekKeyOf(input.date),
      performedAt: input.performedAt ?? stamp,
      planId: input.planId ?? null,
      note: input.note ?? null,
      legacyCarryOver: input.legacyCarryOver ?? false,
      configSnapshotId: input.configSnapshotId,
      ...(input.finishedAt === undefined ? {} : { finishedAt: input.finishedAt }),
      createdAt: stamp,
      updatedAt: stamp,
    };
    await sessions.put(record);
    return record;
  },

  put: (record: GymSessionRecord) => sessions.put(record),
  putMany: (records: GymSessionRecord[]) => sessions.putMany(records),
  remove: (id: string) => sessions.remove(id),

  replaceAll: async (records: GymSessionRecord[]) => {
    await sessions.clear();
    await sessions.putMany(records);
  },
};

export const gymSetsRepository = {
  get: (id: string) => sets.get(id),
  getAll: () => sets.getAll(),
  listBySession: (sessionId: string) => sets.queryIndex('by_session', sessionId),
  listByExercise: (exerciseId: string) => sets.queryIndex('by_exercise', exerciseId),

  async listByDateRange(from: DateKey, to: DateKey): Promise<GymSetRecord[]> {
    if (to < from) return [];
    return sets.queryIndex('by_date', IDBKeyRange.bound(from, to));
  },

  put: (record: GymSetRecord) => sets.put(record),
  putMany: (records: GymSetRecord[]) => sets.putMany(records),
  remove: (id: string) => sets.remove(id),

  replaceAll: async (records: GymSetRecord[]) => {
    await sets.clear();
    await sets.putMany(records);
  },
};
