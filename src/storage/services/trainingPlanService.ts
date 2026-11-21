import { nowIso } from '../../core/clock';
import { GYM } from '../../core/config/constants';
import { createId } from '../../core/ids';
import {
  TRAINING_PLAN_KIND,
  TRAINING_PLAN_VERSION,
  type TrainingPlanExercise,
  type TrainingPlanRecord,
} from '../../core/model';
import { exercisesRepository, gymPlansRepository } from '../repositories';

/**
 * The user's training plans (WP2-1).
 *
 * A plan is a named, ordered list of exercises the user trains together. It
 * is configuration: Momentum creates none, suggests none, and never changes
 * one without the user. A session started from a plan copies the lines into
 * its own snapshot (`gymService.startSessionFromDraft`), so nothing here can
 * reach a workout already done — edit, reorder, rename or delete a plan and
 * every past session renders exactly as before.
 *
 * At most `GYM.MAX_PLANS` plans exist at once. The limit is enforced here,
 * on the write, and the interface reads `planSlots()` to say so inline.
 */

export class PlanLimitError extends Error {
  constructor() {
    super(`At most ${GYM.MAX_PLANS} training plans may be saved`);
    this.name = 'PlanLimitError';
  }
}

export class PlanNotFoundError extends Error {
  constructor(readonly planId: string) {
    super(`Training plan ${planId} does not exist`);
    this.name = 'PlanNotFoundError';
  }
}

export class InvalidPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPlanError';
  }
}

/** One line as the editor hands it over. The name snapshot is resolved here. */
export interface PlanExerciseInput {
  exerciseId: string;
  /** A fallback name, used only when the exercise record cannot be read. */
  name?: string;
}

export interface PlanDraftInput {
  name: string;
  exercises: PlanExerciseInput[];
}

export interface PlanSlots {
  used: number;
  max: number;
  /** Whether one more plan may be created or duplicated. */
  free: boolean;
}

export async function listTrainingPlans(): Promise<TrainingPlanRecord[]> {
  return gymPlansRepository.listTrainingPlans();
}

export async function getTrainingPlan(id: string): Promise<TrainingPlanRecord | undefined> {
  return gymPlansRepository.get(id);
}

export function planSlotsOf(count: number): PlanSlots {
  return { used: count, max: GYM.MAX_PLANS, free: count < GYM.MAX_PLANS };
}

export async function planSlots(): Promise<PlanSlots> {
  return planSlotsOf((await listTrainingPlans()).length);
}

/**
 * The lines of a plan, with each name snapshot taken from the exercise
 * record as it stands now.
 *
 * The record's name is the fallback, not the display: a built-in shows its
 * localised catalogue name at render time. The snapshot exists for the day
 * the id cannot be resolved at all, and the stored English or user-typed
 * name is the honest thing to show then.
 */
async function snapshotLines(inputs: readonly PlanExerciseInput[]): Promise<TrainingPlanExercise[]> {
  const records = await exercisesRepository.getAll();
  const byId = new Map(records.map((record) => [record.id, record]));
  return inputs.map((input, index) => ({
    exerciseId: input.exerciseId,
    name: byId.get(input.exerciseId)?.name ?? input.name ?? input.exerciseId,
    order: index,
  }));
}

function validateDraft(input: PlanDraftInput): string {
  const name = input.name.trim();
  if (name === '') throw new InvalidPlanError('A training plan needs a name');
  if (input.exercises.length === 0) throw new InvalidPlanError('A training plan needs at least one exercise');
  return name;
}

/** `createdAt` is now unless named: the starter plans name it, because the list is ordered by it. */
export async function createTrainingPlan(
  input: PlanDraftInput,
  createdAt?: string,
): Promise<TrainingPlanRecord> {
  const name = validateDraft(input);
  const existing = await listTrainingPlans();
  if (!planSlotsOf(existing.length).free) throw new PlanLimitError();
  const stamp = createdAt ?? nowIso();
  const record: TrainingPlanRecord = {
    id: createId('plan'),
    kind: TRAINING_PLAN_KIND,
    version: TRAINING_PLAN_VERSION,
    name,
    exercises: await snapshotLines(input.exercises),
    createdAt: stamp,
    updatedAt: stamp,
  };
  await gymPlansRepository.put(record);
  return record;
}

/**
 * Replaces a plan's name and lines. Reordering, adding and removing are all
 * this one write; the editor hands over the whole list it shows.
 */
export async function updateTrainingPlan(
  id: string,
  input: PlanDraftInput,
): Promise<TrainingPlanRecord> {
  const name = validateDraft(input);
  const existing = await gymPlansRepository.get(id);
  if (!existing) throw new PlanNotFoundError(id);
  const next: TrainingPlanRecord = {
    ...existing,
    name,
    exercises: await snapshotLines(input.exercises),
    updatedAt: nowIso(),
  };
  await gymPlansRepository.put(next);
  return next;
}

/** A copy with a fresh id and its own timestamps; the lines are copied as they are. */
export async function duplicateTrainingPlan(
  id: string,
  name?: string,
): Promise<TrainingPlanRecord> {
  const source = await gymPlansRepository.get(id);
  if (!source) throw new PlanNotFoundError(id);
  const existing = await listTrainingPlans();
  if (!planSlotsOf(existing.length).free) throw new PlanLimitError();
  const stamp = nowIso();
  const copy: TrainingPlanRecord = {
    ...source,
    id: createId('plan'),
    name: (name ?? source.name).trim() || source.name,
    exercises: source.exercises.map((line) => ({ ...line })),
    createdAt: stamp,
    updatedAt: stamp,
  };
  await gymPlansRepository.put(copy);
  return copy;
}

/** Deleting a plan frees its slot. Sessions started from it are untouched. */
export async function deleteTrainingPlan(id: string): Promise<void> {
  await gymPlansRepository.remove(id);
}
