import { addDays, addWeeks, startOfWeek, weekKeyOf, type DateKey, type WeekKey } from '../../core/dates';
import {
  exerciseSpans,
  percentChange,
  type BestSet,
  type ExerciseDay,
  type ExerciseDayInput,
} from '../../core/gym/performance';
import { workVolumeByWeek } from '../../core/gym/volume';
import type { GymWindowComparison, MuscleGroup } from '../../core/model';
import type { MuscleState } from '../../components/BodyRenderer';
import type { GymHistory } from '../../storage/services/gymService';
import { fromBaseline, muscleTrend, type MuscleTrendPoint } from './muscleAnalytics';
import { exerciseGroups, isUneven, type ShownPerformance } from './muscleState';

/**
 * The muscle sheet's view model (block 7C, contract §9): one group, in the
 * range the screen shows.
 *
 * **It computes nothing of its own.** The group's state and figure are the
 * very `ShownMuscle` the row and the body read (`shownPerformance`); its
 * line is `muscleTrend()`, whose last point is that figure by construction,
 * drawn from the baseline of the group's first day (D170); an exercise's
 * change is `exerciseSpans()`, the comparison the group's figure is the
 * mean of, and its line the same comparison day by day
 * (`exerciseLine`); and the work volume is `workVolumeByWeek()`. What this
 * file adds is *which rows* each of them is handed, and the order they are
 * shown in.
 *
 * Three things on it are shown and never scored: the best working set of an
 * exercise in the range, the list of what was recorded, and the work volume
 * (D152) — which enters no rating, no state and no colour.
 */

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The change of every exercise of a range — **the one figure an exercise
 * has** (D176): the comparison its groups' figures are formed from, the
 * median of its last days against the median of its first under the Stage
 * 5b metric, the last day against the first before it.
 *
 * The sheet's rows and the exercise detail both read this map, so an
 * exercise cannot carry one number here and another there. `null` for an
 * exercise recorded on a single day of the range: one day is a value, not a
 * change.
 */
export function exerciseChanges(history: Pick<GymHistory, 'days' | 'metric'>): Map<string, number | null> {
  const changes = new Map<string, number | null>();
  for (const span of exerciseSpans(history.days, history.metric?.comparison ?? 'firstLast')) {
    changes.set(span.exerciseId, percentChange(span.ratio));
  }
  return changes;
}

/**
 * The line of one exercise (the owner's correction at STOP 7C, D187): **at
 * each of its days, its change in the range up to that day** — the very
 * comparison its one figure is (`exerciseChanges`), as if the range had
 * ended on that day, exactly as the line of a group is its figure day by
 * day (`muscleTrend`). So the line ends on the figure, by construction, and
 * an end point in a rise's colour never lies under the zero line. It
 * begins on the baseline of its first day, at nought (D170).
 *
 * Until STOP 7C each day stood at its change since the first day shown:
 * under the Stage 5b metric another comparison than the figure's, which
 * set the median of the last days against the median of the first. The
 * Dips of the check data read +5 % in the range while their last day lay
 * under their first, and the line ended green below nought. Before the
 * Stage 5b era (`firstLast`) the two rules are one: each day against the
 * first.
 *
 * `days` are one exercise's, in any order; the result is oldest first, one
 * point a day. A day whose comparison cannot be divided — a first day with
 * no score, which a scorable set never has — stands on the zero line.
 */
export function exerciseLine(days: readonly ExerciseDay[], comparison: GymWindowComparison): MuscleTrendPoint[] {
  const ordered = [...days].sort((a, b) => byText(a.date, b.date));
  return ordered.map((day, index) => {
    if (index === 0) return { date: day.date, value: 0 };
    const span = exerciseSpans(ordered.slice(0, index + 1), comparison)[0];
    return { date: day.date, value: percentChange(span?.ratio ?? null) ?? 0 };
  });
}

/** One exercise of the group, as its row in the sheet shows it. */
export interface SheetExercise {
  id: string;
  /**
   * Its best working set in the range: the day with the highest value, and
   * the later one where two days are level. The set is shown as reps × load;
   * the value it was chosen by is the metric's and is not shown.
   */
  best: { date: DateKey; set: BestSet['set'] };
  /** Its change in the range, raw; `null` with a single day. */
  change: number | null;
  /** Its exercise days in the range. */
  days: number;
}

/** One exercise on one day: what "Erfasst" lists for a group with too little to compare. */
export interface SheetRecord {
  exerciseId: string;
  date: DateKey;
  set: BestSet['set'];
}

/** One week of the range: the group's work volume, or `null` where the week has no working set of it. */
export interface SheetWeek {
  week: WeekKey;
  /** The calendar week's number, 1–53. */
  number: number;
  /** Σ reps × effective load in grams over the week, by the group's share; `null` is a gap, never a nought. */
  volume: number | null;
}

export interface MuscleSheetView {
  muscle: MuscleGroup;
  /** The state and the figure the row and the body show. */
  state: MuscleState;
  change: number | null;
  exerciseDays: number;
  compared: boolean;
  /** The observations: one point per training day with something to compare, uncapped. Empty unless the group states a figure. */
  trend: readonly MuscleTrendPoint[];
  /** What the chart draws (D170): the observations from the baseline of the group's first training day in the range, at nought. */
  line: readonly MuscleTrendPoint[];
  /** The group's exercises, in the order of their ids; a screen sorts them by the name it shows. */
  exercises: readonly SheetExercise[];
  /** The exercises lie more than ten shown points apart (`isUneven`); only ever said beside a figure. */
  uneven: boolean;
  /** Every exercise-day of the group in the range, newest first. */
  records: readonly SheetRecord[];
  /** The weeks of the range, oldest first. */
  weeks: readonly SheetWeek[];
  /** The latest day before the range on which the group was trained, where there is one. */
  lastTrainedBefore: DateKey | null;
  /**
   * Whether the group was ever trained: `false` only when that was read and
   * nothing was found, in the range or before it; `null` where it was not
   * read. Not trained in the range is not "never".
   */
  everTrained: boolean | null;
}

/**
 * The weeks a range shows a volume for: every week that lies wholly inside
 * it, and the week of its last day.
 *
 * A week only partly inside the range at its start is left out: its bar
 * would stand for less than the week held, and a volume is read as a week's.
 * The running week is in, as it stands — it is the one week everybody knows
 * to be unfinished. 30 days are four or five weeks, 90 days twelve or
 * thirteen.
 */
export function rangeWeeks(from: DateKey, to: DateKey): WeekKey[] {
  const last = weekKeyOf(to);
  const monday = startOfWeek(from) === from ? from : addDays(startOfWeek(from), 7);
  if (monday > to) return [last];
  const weeks: WeekKey[] = [];
  for (let week = weekKeyOf(monday); week <= last; week = addWeeks(week, 1)) weeks.push(week);
  return weeks;
}

/** "2026-W46" → 46. */
export function weekNumber(week: WeekKey): number {
  return Number(week.slice(week.indexOf('W') + 1));
}

export function toMuscleSheet({
  muscle,
  history,
  shown,
  sets,
  from,
  to,
  lastTrained = null,
}: {
  muscle: MuscleGroup;
  history: GymHistory;
  /** What the screen shows for the range: the one the rows and the body read. */
  shown: ShownPerformance;
  /** The range's exercise-days with all of their sets (`loadGymRange`). */
  sets: readonly ExerciseDayInput[];
  /** The range, both ends included. */
  from: DateKey;
  to: DateKey;
  /** Each group's latest day before the range, where it was read. */
  lastTrained?: Partial<Record<MuscleGroup, DateKey>> | null;
}): MuscleSheetView {
  const entry = shown.muscles.find((candidate) => candidate.muscle === muscle);
  const state: MuscleState = entry?.state ?? 'noData';
  const change = entry?.change ?? null;
  const membership = exerciseGroups(history.days);
  const mine = history.days.filter((day) => membership.get(day.exerciseId)?.includes(muscle) ?? false);

  const changes = exerciseChanges(history);
  const byExercise = new Map<string, ExerciseDay[]>();
  for (const day of mine) {
    const list = byExercise.get(day.exerciseId);
    if (list) list.push(day);
    else byExercise.set(day.exerciseId, [day]);
  }
  const exercises: SheetExercise[] = [...byExercise.entries()]
    .sort((a, b) => byText(a[0], b[0]))
    .map(([id, days]) => {
      let best = days[0]!;
      for (const day of days) {
        if (day.best.score > best.best.score || (day.best.score === best.best.score && day.date > best.date)) best = day;
      }
      return { id, best: { date: best.date, set: best.best.set }, change: changes.get(id) ?? null, days: days.length };
    });

  const volume = new Map(workVolumeByWeek(sets)[muscle].map((week) => [week.week, week.volume]));
  // No figure stated, no line drawn (contract §6): exactly as the row.
  const trend = change === null ? [] : muscleTrend(history.days, muscle, membership, history.metric);
  const firstDay = mine.reduce<DateKey | null>((first, day) => (first === null || day.date < first ? day.date : first), null);

  return {
    muscle,
    state,
    change,
    exerciseDays: entry?.exerciseDays ?? 0,
    compared: entry?.compared ?? false,
    trend,
    line: fromBaseline(trend, firstDay),
    exercises,
    uneven: change !== null && isUneven(exercises.map((exercise) => exercise.change)),
    records: [...mine]
      .sort((a, b) => byText(b.date, a.date) || byText(a.exerciseId, b.exerciseId))
      .map((day) => ({ exerciseId: day.exerciseId, date: day.date, set: day.best.set })),
    weeks: rangeWeeks(from, to).map((week) => ({ week, number: weekNumber(week), volume: volume.get(week) ?? null })),
    lastTrainedBefore: state === 'noData' ? (lastTrained?.[muscle] ?? null) : null,
    everTrained: state !== 'noData' ? true : lastTrained === null ? null : lastTrained[muscle] !== undefined,
  };
}
