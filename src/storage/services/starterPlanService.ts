import { nowIso } from '../../core/clock';
import { settingsRepository } from '../repositories';
import { ensureExerciseCatalogue } from './gymService';
import { createTrainingPlan, listTrainingPlans, planSlotsOf } from './trainingPlanService';

/**
 * The training plans a device starts with: Push A, Push B, Pull A, Pull B.
 *
 * Created once per device on app start, after the catalogue, through
 * `createTrainingPlan`. That it has happened is a recorded fact
 * (`settings.starterPlansSeededAt`), so a plan the user deletes or renames
 * never comes back. A plan whose name already exists is skipped. Plans are
 * configuration: no session, set, snapshot or scored value arises.
 */
export const STARTER_PLANS: readonly { name: string; exerciseIds: readonly string[] }[] = [
  {
    name: 'Push A',
    exerciseIds: ['ex_bench_press', 'ex_incline_press', 'ex_high_to_low_cable_fly', 'ex_cable_lateral_raise', 'ex_overhead_cable_extension', 'ex_triceps_pushdown'],
  },
  {
    name: 'Push B',
    exerciseIds: ['ex_overhead_cable_extension', 'ex_lateral_raise_machine', 'ex_incline_press_machine', 'ex_chest_press_machine', 'ex_cable_fly_low_to_high', 'ex_triceps_pushdown'],
  },
  {
    name: 'Pull A',
    exerciseIds: ['ex_lat_pulldown_neutral', 'ex_close_cable_row', 'ex_seated_row_machine', 'ex_reverse_fly_machine', 'ex_bayesian_cable_curl', 'ex_hammer_curl'],
  },
  {
    name: 'Pull B',
    exerciseIds: ['ex_preacher_curl', 'ex_lat_pulldown', 'ex_single_arm_cable_pulldown', 'ex_seated_row_machine', 'ex_reverse_fly_machine', 'ex_rope_hammer_curl'],
  },
];

const key = (name: string): string => name.trim().toLowerCase();

async function seed(): Promise<void> {
  const settings = await settingsRepository.getOrCreate();
  if (settings.starterPlansSeededAt !== undefined) return;

  await ensureExerciseCatalogue();
  const stamp = nowIso();
  const base = Date.parse(stamp);
  for (const [index, plan] of STARTER_PLANS.entries()) {
    const existing = await listTrainingPlans();
    if (existing.some((record) => key(record.name) === key(plan.name))) continue;
    if (!planSlotsOf(existing.length).free) continue;
    await createTrainingPlan(
      { name: plan.name, exercises: plan.exerciseIds.map((exerciseId) => ({ exerciseId })) },
      // A millisecond apart: the list is ordered by creation.
      new Date(base + index).toISOString(),
    );
  }
  await settingsRepository.update({ starterPlansSeededAt: stamp });
}

let running: Promise<void> | null = null;

/** Seeds the starter plans where this device has not been seeded yet; two calls at once share one run. */
export function ensureStarterPlans(): Promise<void> {
  running ??= seed().finally(() => {
    running = null;
  });
  return running;
}
