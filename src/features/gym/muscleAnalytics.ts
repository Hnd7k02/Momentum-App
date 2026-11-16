import { MUSCLE_GROUPS, type MuscleGroup } from '../../core/model';
import type { DateKey } from '../../core/dates';
import type { GymMetric } from '../../core/gym/metric';
import {
  gymPerformanceOverSpan,
  percentChange,
  type ExerciseDay,
} from '../../core/gym/performance';
import type { MuscleState } from '../../components/BodyRenderer';
import type { GymHistory } from '../../storage/services/gymService';
import { exerciseGroups, shownPerformance, type ShownPerformance } from './muscleState';

/**
 * The muscle rows' view model: per group, its state and delta as the row
 * shows them today, when it was last trained, which exercise that was where
 * that is unambiguous, and the compact trend the mini chart draws.
 *
 * Read-only over the history the screen already loaded. Every number comes
 * out of an existing domain helper called on existing rows; the one thing
 * this file adds is *which rows* each helper is handed.
 *
 * ## The trend
 *
 * "Performance change for this muscle since the beginning of the selected
 * range, measured at each valid training observation."
 *
 * For each day on which any exercise reaching the group was recorded, the
 * point is the group's over-span ratio — `gymPerformanceOverSpan()`, the
 * very helper the row's own delta comes from — evaluated over the history up
 * to and including that day, expressed with `percentChange()`. So the last
 * point *is* the row's delta, by construction: the chart cannot end on a
 * number the row does not show.
 *
 * The helper is called with the metric the history was loaded under
 * (`GymHistory.metric`, D150), so every point is the comparison the row's
 * own figure is: under the Stage 5b metric the median of the last days
 * against the median of the first, as far as the history had come by then.
 *
 * A day on which the group had no exercise with a baseline yet yields
 * nothing: the helper reports `insufficientBaseline`, and an absence is not a
 * zero. Days between observations are simply not in the array — the renderer
 * decides spacing, and it must never draw a gap as a value.
 *
 * A group with too little to compare (contract §7) draws no line and states
 * no delta, even where the domain has a ratio for it: the row shows the
 * chip, and a line there would state the trend the chip says is not there
 * yet. `muscleTrend()` itself stays the full series.
 *
 * ## The line that is drawn
 *
 * **A line begins on the baseline of its first day** (D170, the owner's
 * choice at STOP 7C, D187): the group's first training day in the range,
 * at nought — the day everything after it is measured from — and then the
 * trend's points. `trend` stays the observations, and `line` is what the
 * row draws (`fromBaseline`). Until then a single observation was a dot
 * floating over the zero line, which read as an error; now it is the
 * shortest line there is, from where the group began to where it stands,
 * and every other line begins where it began too. The nought is not an
 * absence read as a zero: it is the reference itself, which by definition
 * has not changed against itself.
 */

export type MuscleDataState =
  /** No exercise reaching the group was recorded in the range. */
  | 'no-history'
  /** Exactly one valid observation — a value, not yet a direction. */
  | 'single-observation'
  /** Trained in the range, with too little to compare (contract §7). */
  | 'awaiting-baseline'
  /** Two or more valid observations. */
  | 'measured';

export interface MuscleTrendPoint {
  /** The local calendar day of the observation, as the set recorded it. */
  date: DateKey;
  /** Percentage change since the start of the range, as of that day. Raw. */
  value: number;
}

export interface MuscleAnalyticsView {
  id: MuscleGroup;
  state: MuscleState;
  dataState: MuscleDataState;
  /**
   * The row's delta: `percentChange()` of the range's over-span ratio —
   * `null` unless the group states a trend.
   */
  delta: number | null;
  /** The group's exercise days in the range (`exerciseDayCounts`). */
  exerciseDays: number;
  /** Whether one of its exercises was recorded on two days of the range. */
  compared: boolean;
  /** The latest day an exercise reaching the group was recorded, or `null`. */
  lastTrainedAt: DateKey | null;
  /**
   * The most recent valid observations, capped for the compact chart (see
   * `SPARKLINE_POINTS`). Ascending by date; the full series is
   * `muscleTrend()`.
   */
  trend: readonly MuscleTrendPoint[];
  /**
   * What the row draws (D170): the observations from the baseline of the
   * group's first training day in the range, at nought — capped like the
   * trend, so a long series shows its most recent points and no longer
   * begins on the baseline. Empty where the group states no figure.
   */
  line: readonly MuscleTrendPoint[];
  /** How many valid observations the range holds in all, before the cap. */
  observations: number;
  /**
   * The exercise recorded on the latest training day, when there was exactly
   * one reaching the group; `null` when there were several or none. There is
   * no domain notion of *the* exercise of a day, so none is invented.
   */
  latestExerciseLabel: string | null;
  /** Every exercise reaching the group on that day, for a later UI to count. */
  latestExerciseIds: readonly string[];
}

/**
 * How many observations the compact 80 px sparkline shows. A presentation
 * constraint, not a domain one: twelve points leave about 7 px per segment,
 * the least that still shows a shape, and a 30-day range at three sessions a
 * week holds at most thirteen training days anyway. `muscleTrend()` is
 * never capped.
 */
export const SPARKLINE_POINTS = 12;

/**
 * The one selection the 3D body, the SVG figure and the muscle rows share:
 * whichever of them selects, the host holds this and hands it to all three.
 * None of them owns a selection of its own.
 */
export type MuscleSelection = MuscleGroup | null;

/**
 * Whether a recorded day belongs to a group — by the one membership the
 * state and the count of exercise days use (`exerciseGroups`): the
 * exercise's groups as of its latest day in the range, which is how the
 * domain attributes it. A row can therefore never say "Noch nicht
 * trainiert" over a "Vor 3 Tagen", nor list exercises for a group the
 * domain does not count them for.
 */
type Membership = ReturnType<typeof exerciseGroups>;
const reaches = (membership: Membership, day: ExerciseDay, muscle: MuscleGroup): boolean =>
  membership.get(day.exerciseId)?.includes(muscle) ?? false;

/** The days on which the group was trained, ascending, each once. */
function trainingDays(days: readonly ExerciseDay[], muscle: MuscleGroup, membership: Membership): DateKey[] {
  return [...new Set(days.filter((day) => reaches(membership, day, muscle)).map((day) => day.date))].sort();
}

/**
 * A line as it is drawn (D170): `points` from the baseline of `first` — the
 * day they are measured from, at nought — where there is anything to draw.
 *
 * `first` lies before the first point by construction: a point needs a day
 * to compare with, and that day is a training day of the same series. A
 * `first` that does not (no day, or one not earlier) adds nothing.
 */
export function fromBaseline(points: readonly MuscleTrendPoint[], first: DateKey | null | undefined): MuscleTrendPoint[] {
  if (points.length === 0 || !first || first >= points[0]!.date) return [...points];
  return [{ date: first, value: 0 }, ...points];
}

/**
 * The full, deterministic series for one group over the loaded range: one
 * point per training day that had a comparable observation. Same rows in,
 * same points out.
 *
 * `metric` is the one `days` were built under — `GymHistory.metric` — and
 * `null` for the metric before Stage 5b.
 */
export function muscleTrend(
  days: readonly ExerciseDay[],
  muscle: MuscleGroup,
  membership: Membership = exerciseGroups(days),
  metric: GymMetric | null = null,
): MuscleTrendPoint[] {
  const points: MuscleTrendPoint[] = [];
  for (const date of trainingDays(days, muscle, membership)) {
    const asOf = gymPerformanceOverSpan(days.filter((day) => day.date <= date), metric);
    const ratio = asOf.muscles.find((entry) => entry.muscle === muscle)?.ratio ?? null;
    const value = percentChange(ratio);
    if (value !== null) points.push({ date, value });
  }
  return points;
}

export function toMuscleAnalytics(
  history: GymHistory,
  /** What the screen shows for the range; derived here when not handed in. */
  shown: ShownPerformance = shownPerformance(history.days, history.overall),
): MuscleAnalyticsView[] {
  const shownBy = new Map(shown.muscles.map((entry) => [entry.muscle, entry]));
  const membership = exerciseGroups(history.days);
  return MUSCLE_GROUPS.map((id) => {
    const entry = shownBy.get(id);
    const state: MuscleState = entry?.state ?? 'noData';
    const delta = entry?.change ?? null;
    // No trend stated, no line drawn.
    const series = delta === null ? [] : muscleTrend(history.days, id, membership, history.metric);
    const trained = trainingDays(history.days, id, membership);
    const lastTrainedAt = trained.length > 0 ? trained[trained.length - 1]! : null;
    const latestExerciseIds =
      lastTrainedAt === null
        ? []
        : [...new Set(history.days.filter((day) => day.date === lastTrainedAt && reaches(membership, day, id)).map((day) => day.exerciseId))].sort();
    const only = latestExerciseIds.length === 1 ? latestExerciseIds[0]! : null;

    const dataState: MuscleDataState =
      state === 'noData'
        ? 'no-history'
        : state === 'awaitingBaseline'
          ? 'awaiting-baseline'
          : series.length <= 1
            ? 'single-observation'
            : 'measured';

    return {
      id,
      state,
      dataState,
      delta,
      exerciseDays: entry?.exerciseDays ?? 0,
      compared: entry?.compared ?? false,
      lastTrainedAt,
      trend: series.slice(-SPARKLINE_POINTS),
      line: fromBaseline(series, trained[0]).slice(-SPARKLINE_POINTS),
      observations: series.length,
      latestExerciseLabel: only === null ? null : (history.names.get(only) ?? only),
      latestExerciseIds,
    };
  });
}
