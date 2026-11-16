import { weekKeyOf, type WeekKey } from '../dates';
import { MUSCLE_GROUPS, type MuscleGroup } from '../model';
import { muscleWeights } from './muscles';
import { isScorableSet, type ExerciseDayInput, type SetInput } from './performance';

/**
 * Work volume: shown, never scored (D152).
 *
 * The volume of a muscle group in a week is the sum of `reps × load` over
 * the working sets that reached it. It answers "the app should read all my
 * sets" beside a metric that reads one set a day — and it answers nothing
 * else: **no rating, no Boss share, no colour and no state is derived from
 * it.** Nothing under `core/scoring`, no rating service and not
 * `muscleState.ts` may import this file; `volumeUnscored.test.ts` walks the
 * sources and holds that.
 *
 * Four rules:
 *
 * - **Working sets only.** A set the user marked as a warm-up (D151) is not
 *   work in this sense, and a set that describes no work — no reps, no load —
 *   is no set, exactly as the metric reads it (`isScorableSet`).
 * - **The effective load.** `SetInput.weightGrams` is already what the set
 *   asked of the body: the bar, the bodyweight in force that day plus what
 *   was added, or less what a machine took off (`core/gym/load.ts`). The
 *   volume reads the same number the metric does.
 * - **One exercise is worth one exercise** (D92). A compound movement
 *   reaches several groups, and counting its sets in full for each would
 *   make the body's volume grow with the number of groups an exercise
 *   names. Its volume is spread by the shares the rating spreads its change
 *   by (`muscleWeights`): primaries share 70 %, secondaries 30 %; the shares
 *   of one exercise-day add up to its whole volume.
 * - **By the roles the day was logged under.** A set carries the groups and
 *   roles it was logged under, and a week that has been trained keeps its
 *   volume when an exercise is mapped anew later: the volume is a sum of
 *   what was done, not a view of today's catalogue.
 *
 * A week belongs to its Monday, like every week in this app.
 *
 * The unit is the gram-rep: whole numbers per exercise-day, a share of one
 * per group. A screen shows it in the user's unit of weight.
 */

/** One week of one group. A week without a working set of the group has no entry: a gap is not a nought. */
export interface WeekVolume {
  week: WeekKey;
  /** Σ reps × effective load in grams, by the group's share of each exercise-day. */
  volume: number;
}

/** Whether a set is work the volume counts: scorable, and not marked as a warm-up. */
export function isWorkingSet(set: SetInput): boolean {
  return set.warmUp !== true && isScorableSet(set);
}

/** The work of one exercise on one day: Σ reps × effective load over its working sets. An integer. */
export function exerciseDayVolume(sets: readonly SetInput[]): number {
  let total = 0;
  for (const set of sets) if (isWorkingSet(set)) total += set.reps * set.weightGrams;
  return total;
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The work volume of every group, week by week, over a list of exercise-days
 * with their sets.
 *
 * The order of the sums is fixed — by day, then exercise id — so the same
 * sets give the same numbers whatever order they were handed in.
 */
export function workVolumeByWeek(inputs: readonly ExerciseDayInput[]): Record<MuscleGroup, WeekVolume[]> {
  const sums = new Map<MuscleGroup, Map<WeekKey, number>>();
  const ordered = [...inputs].sort((a, b) => byText(a.date, b.date) || byText(a.exerciseId, b.exerciseId));
  for (const input of ordered) {
    const volume = exerciseDayVolume(input.sets);
    if (volume === 0) continue;
    const week = weekKeyOf(input.date);
    const shares = muscleWeights({
      muscles: input.muscles,
      ...(input.primaryMuscles === undefined ? {} : { primary: input.primaryMuscles }),
    });
    for (const { muscle, weight } of shares) {
      if (weight <= 0) continue;
      let weeks = sums.get(muscle);
      if (!weeks) {
        weeks = new Map();
        sums.set(muscle, weeks);
      }
      weeks.set(week, (weeks.get(week) ?? 0) + volume * weight);
    }
  }
  const result = {} as Record<MuscleGroup, WeekVolume[]>;
  for (const muscle of MUSCLE_GROUPS) {
    const weeks = sums.get(muscle);
    result[muscle] = weeks
      ? [...weeks.entries()].sort((a, b) => byText(a[0], b[0])).map(([week, volume]) => ({ week, volume }))
      : [];
  }
  return result;
}
