import type { MuscleState } from '../../components/BodyRenderer';
import { MUSCLE_GROUPS, type MuscleGroup } from '../../core/model';
import { muscleWeights } from '../../core/gym/muscles';
import {
  percentChange,
  type ExerciseDay,
  type GymPerformance,
  type MusclePerformance,
} from '../../core/gym/performance';
import { signedPercentText } from '../../i18n/typography';

/**
 * The one place a number becomes a state (contract §7, D153).
 *
 * Three rules, and every surface that colours a change reads them here —
 * the 3D body, the flat figure, the muscle rows, the hub's card, the figure
 * above the rows, the exercise list, the exercise detail and the golden
 * test. None of them rounds, compares or counts on its own.
 *
 * 1. **Rounding.** A change is shown as a whole percent, rounded half away
 *    from zero in both directions: +2.5 is +3 and −2.5 is −3.
 * 2. **The band.** The state follows the figure as shown: −2 to +2 is held,
 *    from +3 improved, from −3 declined. Figure and colour cannot part.
 * 3. **Enough to compare.** A group states a trend only with three exercise
 *    days in the range *and* an exercise recorded on two days; with less it
 *    is "Zu wenig Vergleichsdaten", whatever its ratio says.
 *
 * All of it is presentation. The comparison, the ratio, the rating and every
 * score stay exactly as `core/gym` computed them; nothing here is stored.
 */

/** The widest shown figure that still reads as held: −2 … +2. */
export const HELD_BAND_PERCENT = 2;

/** The exercise days a group needs in the range before it states a trend. */
export const MIN_EXERCISE_DAYS = 3;

/**
 * Far below anything a ratio of two set scores can mean, far above the noise
 * of `(ratio − 1) × 100` in floating point: 41/40 is 2.4999999999999911 %
 * there, and it is +2.5 %, which is +3.
 */
const HALF_EPSILON = 1e-9;

/**
 * A change as the screen shows it: the whole percent, with −0 as 0 (WP3, B6).
 *
 * The figure on screen is rounded, so the colour and the sign must follow
 * the rounded figure too. This is presentation only: the comparison, the
 * ratio and every score stay exactly as computed.
 */
export function shownPercent(ratio: number | null): number | null {
  return roundShown(percentChange(ratio));
}

/**
 * The same rounding, for a change already expressed by `percentChange()`:
 * half away from zero, so a fall rounds as a rise of the same size does.
 * `Math.round` alone rounds −2.5 to −2 and +2.5 to +3.
 */
export function roundShown(change: number | null): number | null {
  if (change === null) return null;
  const rounded = Math.sign(change) * Math.round(Math.abs(change) + HALF_EPSILON);
  // −0.3 rounds to −0, which prints as "0" but is not `=== 0` to `Object.is`.
  return rounded === 0 ? 0 : rounded;
}

export type ShownTrend = 'improved' | 'unchanged' | 'declined';

/** The band, on a figure that is already the shown whole percent. */
export function trendOfShown(percent: number): ShownTrend {
  if (percent > HELD_BAND_PERCENT) return 'improved';
  if (percent < -HELD_BAND_PERCENT) return 'declined';
  return 'unchanged';
}

/** Which way a ratio reads once rounded: −2 % to +2 % is held, "Gehalten". */
export function shownTrend(ratio: number | null): ShownTrend | null {
  const percent = shownPercent(ratio);
  return percent === null ? null : trendOfShown(percent);
}

/** The same, for a change already expressed by `percentChange()`. */
export function shownTrendOfChange(change: number | null): ShownTrend | null {
  const percent = roundShown(change);
  return percent === null ? null : trendOfShown(percent);
}

/**
 * "+12 %", "−3 %", "0 %" for a held group — from a `percentChange()` value.
 * A real minus sign and an unbreakable space, like every figure (`typography.ts`).
 */
export function shownChangeText(change: number | null): string | null {
  const percent = roundShown(change);
  return percent === null ? null : signedPercentText(percent);
}

/**
 * How many exercise days each group has in the loaded range.
 *
 * An **exercise day** is one exercise on one day — one entry of
 * `GymHistory.days` — and it counts for every group that exercise gives a
 * weight above zero. Bench press and incline press on Monday and bench
 * press on Thursday are three exercise days for the chest, on two calendar
 * days.
 *
 * **Which groups an exercise belongs to is the domain's answer, not a
 * second one.** `musclePerformance()` takes an exercise's groups and roles
 * from its latest recorded day in the range and lets every comparison of
 * that exercise speak for those groups; the count follows it, day for day.
 * Counting each day by its own roles instead would part from the figure it
 * is the evidence for the moment an exercise's mapping changed inside a
 * range: a group could then be untrained in the domain with three exercise
 * days, or print a figure that rests on days it was never counted for.
 * While the mapping does not change — which is every range but the one
 * across such an edit — the two readings are the same number.
 */
export function exerciseDayCounts(days: readonly ExerciseDay[]): Record<MuscleGroup, number> {
  const counts = Object.fromEntries(MUSCLE_GROUPS.map((muscle) => [muscle, 0])) as Record<MuscleGroup, number>;

  /** An exercise's roles as of its latest day, as `musclePerformance()` reads them. */
  const latest = new Map<string, ExerciseDay>();
  for (const day of days) {
    const known = latest.get(day.exerciseId);
    // An exercise has one entry a day, so a later date is the only way to
    // replace what is known; `>=` keeps the last one listed all the same.
    if (!known || day.date >= known.date) latest.set(day.exerciseId, day);
  }

  for (const day of days) {
    const from = latest.get(day.exerciseId) ?? day;
    const roles =
      from.primaryMuscles === undefined
        ? { muscles: from.muscles }
        : { muscles: from.muscles, primary: from.primaryMuscles };
    for (const { muscle, weight } of muscleWeights(roles)) {
      if (weight > 0) counts[muscle] += 1;
    }
  }
  return counts;
}

/**
 * The five states, from one group's performance and its exercise days in the
 * same range.
 *
 * The direction of a group with enough to compare is the direction of the
 * figure shown beside it, so the body tint, the row and the exercise list
 * can never disagree with their own number.
 */
export function muscleStateOf(entry: MusclePerformance, exerciseDays: number): MuscleState {
  if (entry.status === 'noData') return 'noData';
  if (entry.status === 'insufficientBaseline') return 'awaitingBaseline';
  if (exerciseDays < MIN_EXERCISE_DAYS) return 'awaitingBaseline';
  return shownTrend(entry.ratio ?? 1) ?? 'unchanged';
}

/** One group as the screen shows it. */
export interface ShownMuscle {
  muscle: MuscleGroup;
  state: MuscleState;
  /**
   * The group's change, raw, where it states one: `null` unless the state is
   * improved, held or declined. A group with too little to compare has a
   * ratio in the domain and no figure on screen.
   */
  change: number | null;
  /** Its exercise days in the range. */
  exerciseDays: number;
  /** Whether any of its exercises was recorded on two days of the range. */
  compared: boolean;
}

/**
 * A performance window as the screen shows it: the ten groups, which of them
 * count as rated, and the figure above them.
 *
 * **"Gewertet" is a statement of the display.** A group is rated when its
 * row prints a figure — improved, held or declined. The trend above is the
 * mean of those groups' ratios, each with equal weight, the way
 * `gymPerformance()` forms its own mean, and it carries a state by the same
 * band. The domain's `measured` list and `ratio` are a different statement —
 * what the comparison could compute — and the rating keeps reading its own
 * windows from `core/gym`; nothing here reaches it.
 */
export interface ShownPerformance {
  muscles: ShownMuscle[];
  /** The groups whose row prints a figure. */
  rated: MuscleGroup[];
  /** The mean ratio of the rated groups, or `null` with none. */
  ratio: number | null;
  /** That mean as a change, raw. */
  change: number | null;
  /** Its state by the band, or `null` with no rated group. */
  trend: ShownTrend | null;
}

const isRated = (state: MuscleState): boolean =>
  state === 'improved' || state === 'unchanged' || state === 'declined';

export function shownPerformance(
  days: readonly ExerciseDay[],
  performance: Pick<GymPerformance, 'muscles'>,
): ShownPerformance {
  const counts = exerciseDayCounts(days);
  const muscles: ShownMuscle[] = [];
  const ratios: number[] = [];
  for (const entry of performance.muscles) {
    const exerciseDays = counts[entry.muscle];
    const state = muscleStateOf(entry, exerciseDays);
    const rated = isRated(state) && entry.ratio !== null;
    if (rated) ratios.push(entry.ratio!);
    muscles.push({
      muscle: entry.muscle,
      state,
      change: rated ? percentChange(entry.ratio) : null,
      exerciseDays,
      compared: entry.status === 'measured',
    });
  }
  const ratio = ratios.length === 0 ? null : ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
  return {
    muscles,
    rated: muscles.filter((entry) => entry.change !== null).map((entry) => entry.muscle),
    ratio,
    change: percentChange(ratio),
    trend: shownTrend(ratio),
  };
}

/** The window with nothing in it: ten untrained groups, nothing rated. */
export const NOTHING_SHOWN: ShownPerformance = {
  muscles: MUSCLE_GROUPS.map((muscle) => ({ muscle, state: 'noData', change: null, exerciseDays: 0, compared: false })),
  rated: [],
  ratio: null,
  change: null,
  trend: null,
};
