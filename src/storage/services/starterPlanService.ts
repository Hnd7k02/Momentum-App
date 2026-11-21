import { nowIso } from '../../core/clock';
import { settingsRepository } from '../repositories';
import { ensureExerciseCatalogue } from './gymService';
import { createTrainingPlan, listTrainingPlans, planSlotsOf } from './trainingPlanService';

/**
 * The two training plans a device starts with (D205).
 *
 * Push A and Push B are put into the plans once per device, on a load — a
 * new one before its introduction, an existing one on the first load after
 * the update. They are configuration and nothing else: no session, no set,
 * no snapshot and nothing scored arises from them, and the introduction
 * neither shows nor chooses them.
 *
 * **Once is a recorded fact** (`settings.starterPlansSeededAt`), not a thing
 * derived from the plans: a starter plan the user renames or deletes belongs
 * to them and never comes back. A device that already holds a plan of one
 * of the two names gets no second one, and a device with no slot left gets
 * none — and is still done, for good.
 *
 * The plans are made by `createTrainingPlan`, after the catalogue is there,
 * as a plan the user writes is; the lines are ids of built-in exercises.
 */

export interface StarterPlan {
  name: string;
  exerciseIds: readonly string[];
}

export const STARTER_PLANS: readonly StarterPlan[] = [
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
];

const nameKey = (name: string): string => name.trim().toLocaleLowerCase('de');

async function seed(): Promise<'seeded' | 'unchanged'> {
  const settings = await settingsRepository.getOrCreate();
  if (settings.starterPlansSeededAt !== undefined) return 'unchanged';

  await ensureExerciseCatalogue();
  const stamp = nowIso();
  const base = Date.parse(stamp);
  for (const [index, plan] of STARTER_PLANS.entries()) {
    const existing = await listTrainingPlans();
    if (existing.some((record) => nameKey(record.name) === nameKey(plan.name))) continue;
    if (!planSlotsOf(existing.length).free) continue;
    await createTrainingPlan(
      { name: plan.name, exercises: plan.exerciseIds.map((exerciseId) => ({ exerciseId })) },
      // One millisecond apart, so the list — ordered by creation — shows A before B.
      new Date(base + index).toISOString(),
    );
  }
  await settingsRepository.update({ starterPlansSeededAt: stamp });
  return 'seeded';
}

let running: Promise<'seeded' | 'unchanged'> | null = null;

/**
 * Seeds the starter plans where this device has not been seeded yet.
 *
 * Two loads at once share one run: the flag is written after the plans, so
 * a second run beside the first would otherwise find it absent as well.
 */
export function ensureStarterPlans(): Promise<'seeded' | 'unchanged'> {
  running ??= seed().finally(() => {
    running = null;
  });
  return running;
}
