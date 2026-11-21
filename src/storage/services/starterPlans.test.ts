import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, deleteDatabase } from '../db';
import { answersRepository, domainsRepository, gymSessionsRepository, gymSetsRepository, questionsRepository, settingsRepository } from '../repositories';
import { ensureStarterPlans, STARTER_PLANS } from './starterPlanService';
import { deleteTrainingPlan, listTrainingPlans } from './trainingPlanService';

/** The starter plans: there on a fresh device, once. */

beforeEach(async () => {
  await deleteDatabase();
});

afterEach(async () => {
  await closeDatabase();
});

describe('the starter plans', () => {
  it('exist on a fresh database, in order, with their exercises — and nothing else is chosen or logged', async () => {
    await ensureStarterPlans();

    const plans = await listTrainingPlans();
    expect(plans.map((plan) => plan.name)).toEqual(['Push A', 'Push B', 'Pull A', 'Pull B']);
    for (const [index, plan] of plans.entries()) {
      expect(plan.exercises.map((line) => line.exerciseId)).toEqual(STARTER_PLANS[index]!.exerciseIds);
      // Every line found its exercise in the catalogue.
      for (const line of plan.exercises) expect(line.name).not.toBe(line.exerciseId);
    }

    expect((await settingsRepository.get())?.onboardingCompletedAt).toBeNull();
    expect(await domainsRepository.list()).toEqual([]);
    expect(await questionsRepository.list()).toEqual([]);
    expect(await answersRepository.getAll()).toEqual([]);
    expect(await gymSessionsRepository.getAll()).toEqual([]);
    expect(await gymSetsRepository.getAll()).toEqual([]);
  });

  it('do not come back: a deleted plan stays gone after a restart', async () => {
    await ensureStarterPlans();
    const pushA = (await listTrainingPlans()).find((plan) => plan.name === 'Push A')!;
    await deleteTrainingPlan(pushA.id);

    await closeDatabase();
    await ensureStarterPlans();
    expect((await listTrainingPlans()).map((plan) => plan.name)).toEqual(['Push B', 'Pull A', 'Pull B']);
  });
});
