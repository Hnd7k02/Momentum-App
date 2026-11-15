import type { DateKey } from '../dates';
import { MUSCLE_GROUPS, type GymWindowComparison, type MuscleGroup } from '../model';
import type { GymMetric } from './metric';
import { muscleWeights, type MuscleRoles } from './muscles';

/**
 * Gym performance: the whole pipeline, and nothing that touches storage or
 * React.
 *
 * ```
 *   sets → exercise-day best set → comparison with the previous workout
 *        → muscle-group value → equal-weighted Gym performance
 * ```
 *
 * Every function here is pure and deterministic. The body renderer, the
 * progress screen and the exercise detail all read what this produces; none
 * of them computes any part of it, so there is exactly one place where a Gym
 * number can be wrong.
 *
 * ## Two metrics, one per era (WP3 Stage 5b, D150)
 *
 * What an exercise-day is worth, and how a window compares an exercise's
 * days, depend on the era the scored day was lived in. The functions that
 * differ take a `GymMetric | null`:
 *
 * - `null` — the metric before Stage 5b (D84): the best set by
 *   `reps × load` over every set, a window's last day against its first.
 *   This is the default, and the code it runs is the code that ran before
 *   the stage, statement for statement: a day lived under it replays to the
 *   same bits.
 * - a `GymMetric` — the best **working** set by the strength score
 *   `load × (1 + reps ÷ repsDivisor)`, a window by the comparison the
 *   metric names, and a fixed order: exercise-days sorted by date and
 *   exercise id, so the same sets under other record ids give the same bits.
 *
 * Which of the two a day has is read from that day's config snapshot
 * (`metric.ts`), never decided here.
 */

/* ── The set, and the day ───────────────────────────────────────────────── */

export interface SetInput {
  id: string;
  reps: number;
  /**
   * The **effective load** in whole grams — what the set actually asked of
   * the body, not necessarily the number the user typed.
   *
   * For an external lift the two are the same. For a bodyweight or assisted
   * one the caller has already added the bodyweight in force on that day or
   * subtracted the machine's help (`core/gym/load.ts`), because that
   * resolution needs a dated weight history and this module is pure
   * arithmetic over one workout. A set whose load could not be resolved is
   * not passed in at all, which is the same treatment a zero-rep set gets.
   *
   * Integers, so two identical sets always compare equal.
   */
  weightGrams: number;
  /** Position within the exercise on that day, for a deterministic tie-break. */
  order: number;
  /**
   * Present, and `true`, only on a set the user marked as a warm-up (D151).
   * Never `false`: an unmarked set has no such key, so it serialises as it
   * always did. The metric before Stage 5b does not read it.
   */
  warmUp?: true;
}

export interface BestSet {
  /**
   * The exercise-day performance, in the unit of the metric the day was
   * built under: `reps × weightGrams` before Stage 5b, the strength score
   * `weightGrams × (repsDivisor + reps)` from it. An integer either way,
   * and only ever divided by another score of the same metric.
   */
  score: number;
  /** One set that achieves it — for display only; ties never change `score`. */
  set: SetInput;
}

/**
 * A set counts when it describes work that happened.
 *
 * Zero reps is not a set, zero weight is not a load, and a negative or
 * non-finite number is a bug upstream rather than a very bad workout. All are
 * dropped rather than scored, so a stray empty row a user tapped into
 * existence cannot drag a day down.
 */
export function isScorableSet(set: SetInput): boolean {
  return (
    Number.isFinite(set.reps) &&
    Number.isFinite(set.weightGrams) &&
    Number.isInteger(set.weightGrams) &&
    set.reps > 0 &&
    set.weightGrams > 0
  );
}

export function setScore(set: SetInput): number {
  return set.reps * set.weightGrams;
}

/**
 * The best set of an exercise on one day.
 *
 * **`max(reps × weight)`, and nothing else.** Not total volume, not the sum
 * of the sets, not their average, not the average weight, not an estimated
 * one-rep max, and not the heaviest weight on its own. Ten at 10 kg and six
 * at 20 kg are both 100 kg-reps of best set; eight at 15 kg beats them both
 * at 120.
 *
 * Ties do not change the number — that is the point of taking a maximum. A
 * screen that wants to name one set gets the earliest by `order`, which is
 * stable across reloads and edits, but nothing downstream reads it.
 */
export function bestSet(sets: readonly SetInput[]): BestSet | null {
  let best: BestSet | null = null;
  for (const set of sets) {
    if (!isScorableSet(set)) continue;
    const score = setScore(set);
    if (best === null || score > best.score || (score === best.score && set.order < best.set.order)) {
      best = { score, set };
    }
  }
  return best;
}

/**
 * The strength score of one set (D150), as an integer:
 * `load × (repsDivisor + reps)`.
 *
 * That is `load × (1 + reps ÷ repsDivisor)` times the divisor. It orders
 * two sets exactly as the score itself does and every ratio of two of them
 * is the ratio of the scores, but it stays an integer for integer inputs —
 * so two identical sets always compare equal, which a product of a
 * fraction would not promise.
 *
 * More load and more reps both raise it, and a set at a quarter more load
 * for half the reps is not a collapse: 8 × 85 kg after 12 × 80 kg is −3.9 %,
 * where `reps × load` reads −29 %. The divisor is the score's one constant,
 * carried in the config snapshot; it converts the user's own sets into one
 * another and compares them with nobody (D150). **It is never printed as
 * kilograms**: it would read as a maximum the user never lifted.
 */
export function strengthScore(set: SetInput, repsDivisor: number): number {
  return set.weightGrams * (repsDivisor + set.reps);
}

/**
 * The best working set of an exercise on one day (D150, D151): the highest
 * strength score among the scorable sets that are not marked as warm-ups.
 *
 * Still a maximum and nothing else — not the mean, not the sum. A lighter
 * set before or after the work, marked or not, cannot lower the day, and a
 * marked one can never provide it. `null` when no working set is scorable:
 * a day of warm-ups only is no exercise-day at all, never a zero.
 *
 * Of two sets with the same score a screen names the earlier by `order`,
 * then the heavier — two sets equal in all three print the same line.
 */
export function bestWorkingSet(sets: readonly SetInput[], repsDivisor: number): BestSet | null {
  let best: BestSet | null = null;
  for (const set of sets) {
    if (set.warmUp === true || !isScorableSet(set)) continue;
    const score = strengthScore(set, repsDivisor);
    if (best === null || score > best.score || (score === best.score && namedBefore(set, best.set))) {
      best = { score, set };
    }
  }
  return best;
}

function namedBefore(a: SetInput, b: SetInput): boolean {
  return a.order < b.order || (a.order === b.order && a.weightGrams > b.weightGrams);
}

/** Code-unit order: the same on every device, whatever its locale collates. */
function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** One exercise on one day, as the rest of the pipeline sees it. */
export interface ExerciseDay {
  date: DateKey;
  exerciseId: string;
  /** The groups the sets were logged under, not the ones mapped today. */
  muscles: MuscleGroup[];
  /**
   * Which of those were primary, as recorded at the time.
   *
   * **Absent is the pre-roles era**, not an empty list of primaries: a set
   * logged by phase 4 recorded no roles and replays under the equal weighting
   * it was actually logged under (D92).
   */
  primaryMuscles?: MuscleGroup[];
  best: BestSet;
}

export interface ExerciseDayInput {
  date: DateKey;
  exerciseId: string;
  muscles: MuscleGroup[];
  primaryMuscles?: MuscleGroup[];
  sets: readonly SetInput[];
}

/**
 * Collapses a day's sets into one number per exercise, under one metric.
 *
 * An exercise whose sets are all unscorable produces nothing at all rather
 * than a zero: it was not performed, and "not performed" is not a bad
 * performance. Under the Stage 5b metric the same holds for an exercise
 * with only warm-up sets that day (D151).
 *
 * **The list belongs to the metric it was built under.** Every `best.score`
 * in it is in that metric's unit; a list is never mixed with another.
 * Before Stage 5b the entries of one day stand in the order they were
 * handed in — the order of the set index, which is the record ids'. Under
 * the Stage 5b metric they are sorted by exercise id, so the sums built on
 * them do not depend on record ids.
 */
export function exerciseDays(
  inputs: readonly ExerciseDayInput[],
  metric: GymMetric | null = null,
): ExerciseDay[] {
  const days: ExerciseDay[] = [];
  for (const input of inputs) {
    const best = metric === null ? bestSet(input.sets) : bestWorkingSet(input.sets, metric.repsDivisor);
    if (!best) continue;
    days.push({
      date: input.date,
      exerciseId: input.exerciseId,
      muscles: input.muscles,
      ...(input.primaryMuscles === undefined ? {} : { primaryMuscles: input.primaryMuscles }),
      best,
    });
  }
  if (metric === null) return days.sort((a, b) => a.date.localeCompare(b.date));
  return days.sort((a, b) => compareIds(a.date, b.date) || compareIds(a.exerciseId, b.exerciseId));
}

/* ── Comparison with the previous workout ───────────────────────────────── */

export type ProgressKind = 'noBaseline' | 'improved' | 'unchanged' | 'declined';

export interface ExerciseComparison {
  exerciseId: string;
  date: DateKey;
  kind: ProgressKind;
  /** This day's best-set score. */
  current: number;
  /** The previous recorded day's, or `null` when there is no baseline. */
  previous: number | null;
  /** The day that baseline came from, however long ago it was. */
  previousDate: DateKey | null;
  /** `current / previous`, or `null` with no usable baseline. 1 is unchanged. */
  ratio: number | null;
  /** `current − previous`, or `null`. */
  delta: number | null;
}

/**
 * How a day compares with the last day this exercise was actually done.
 *
 * Four states, and the first of them is why this returns a kind rather than a
 * number. A first-ever workout has nothing to compare against, and reporting
 * that as +0 % or −100 % would be inventing a baseline out of an absence.
 * `noBaseline` says so, and the interface can show it as the start of a
 * history rather than as a result.
 *
 * Two absences are deliberately not failures either:
 *
 * - **A skipped exercise is not a zero.** The baseline is the previous day
 *   the exercise was *recorded*, whether that was last Tuesday or in March.
 * - **A long gap is not a decline.** Time does not enter the comparison at
 *   all. Coming back after two months and matching your old best is
 *   `unchanged`, because that is what happened.
 */
export function compareExerciseDays(days: readonly ExerciseDay[]): ExerciseComparison[] {
  const byExercise = new Map<string, ExerciseDay[]>();
  for (const day of days) {
    const list = byExercise.get(day.exerciseId);
    if (list) list.push(day);
    else byExercise.set(day.exerciseId, [day]);
  }

  const comparisons: ExerciseComparison[] = [];
  for (const [exerciseId, list] of byExercise) {
    const ordered = [...list].sort((a, b) => a.date.localeCompare(b.date));
    let previous: ExerciseDay | null = null;
    for (const day of ordered) {
      comparisons.push(compareOne(exerciseId, day, previous));
      previous = day;
    }
  }
  return comparisons.sort(
    (a, b) => a.date.localeCompare(b.date) || a.exerciseId.localeCompare(b.exerciseId),
  );
}

function compareOne(
  exerciseId: string,
  day: ExerciseDay,
  previous: ExerciseDay | null,
): ExerciseComparison {
  const current = day.best.score;
  // A previous score of zero cannot be divided by, and cannot have been a
  // real performance either — a scorable set has positive reps and weight.
  if (previous === null || previous.best.score <= 0) {
    return {
      exerciseId,
      date: day.date,
      kind: 'noBaseline',
      current,
      previous: null,
      previousDate: null,
      ratio: null,
      delta: null,
    };
  }

  const before = previous.best.score;
  const ratio = current / before;
  return {
    exerciseId,
    date: day.date,
    kind: current > before ? 'improved' : current < before ? 'declined' : 'unchanged',
    current,
    previous: before,
    previousDate: previous.date,
    ratio,
    delta: current - before,
  };
}

/** The latest comparison per exercise, which is what a list wants to show. */
export function latestComparisons(days: readonly ExerciseDay[]): Map<string, ExerciseComparison> {
  const latest = new Map<string, ExerciseComparison>();
  for (const comparison of compareExerciseDays(days)) latest.set(comparison.exerciseId, comparison);
  return latest;
}

/* ── Muscle groups ──────────────────────────────────────────────────────── */

/**
 * Why a muscle group has no number, when it has none.
 *
 * These are three different things and the interface has to be able to say
 * which: a group nobody has trained is not a group that got worse.
 */
export type MuscleStatus = 'noData' | 'insufficientBaseline' | 'measured';

export interface MusclePerformance {
  muscle: MuscleGroup;
  status: MuscleStatus;
  /**
   * The group's progress ratio, or `null` unless `status` is `measured`.
   * 1 means it held; above 1 means it improved.
   */
  ratio: number | null;
  /** Exercises in the group with a recorded day in the window. */
  exercises: number;
  /** Of those, how many had a previous performance to compare against. */
  compared: number;
  /** Its most recent best-set score, whether or not it could be compared. */
  latestScore: number | null;
}

/**
 * One value per muscle group, from the exercises that reach it.
 *
 * **The rule, written down.** An exercise's progress ratio is the ratio for
 * its most recent comparable day. Every group the exercise is mapped to
 * receives that ratio *at the share the exercise gives that group* — 70 % to
 * the primaries and 30 % to the secondaries, split inside each role
 * (`core/gym/muscles.ts`) — and a group's value is the **weighted mean** of
 * what it received. Groups are then equal-weighted above (`gymPerformance`),
 * so:
 *
 * - a group with five exercises does not outweigh a group with one;
 * - **an exercise is worth one exercise, however many groups it touches.**
 *   Bench press speaks with 70 % of a voice for chest and 15 % for triceps,
 *   so it cannot outvote a triceps pushdown inside the triceps group and
 *   cannot gain total influence by being a compound movement.
 * - a set recorded before roles existed carries none, and its groups share it
 *   equally — the weighting it was actually logged under.
 *
 * A group with recorded work but no exercise that has a baseline yet is
 * `insufficientBaseline` — it has data and no progress, which is not the same
 * as no data and is emphatically not a decline.
 */
export function musclePerformance(days: readonly ExerciseDay[]): MusclePerformance[] {
  const comparisons = latestComparisons(days);

  /** Latest score per exercise, for the groups that cannot be compared yet. */
  const latestScore = new Map<string, number>();
  const rolesOf = new Map<string, { muscles: MuscleGroup[]; primary?: MuscleGroup[] }>();
  for (const day of days) {
    latestScore.set(day.exerciseId, day.best.score);
    rolesOf.set(day.exerciseId, {
      muscles: day.muscles,
      ...(day.primaryMuscles === undefined ? {} : { primary: day.primaryMuscles }),
    });
  }

  const rows: ExerciseRow[] = [];
  for (const [exerciseId, roles] of rolesOf) {
    rows.push({
      exerciseId,
      roles,
      score: latestScore.get(exerciseId) ?? null,
      ratio: comparisons.get(exerciseId)?.ratio ?? null,
    });
  }
  return musclesFromRows(rows);
}

/** What one exercise brings to its groups: its roles, its latest score, its one ratio. */
interface ExerciseRow {
  exerciseId: string;
  roles: MuscleRoles;
  score: number | null;
  /** `null` while the exercise has nothing to compare. */
  ratio: number | null;
}

/**
 * The muscle sums, from one row per exercise.
 *
 * Which ratio an exercise speaks with is the caller's business — its latest
 * day against the day before (`musclePerformance`), or its window
 * (`gymPerformanceOverSpan`). How the ratios reach the groups is the one
 * rule above and lives here once. **The rows are summed in the order
 * given**: floating-point addition is not associative, so the order is part
 * of the result.
 */
function musclesFromRows(rows: readonly ExerciseRow[]): MusclePerformance[] {
  interface Bucket {
    /** Σ weight × ratio, and Σ weight — a weighted mean, kept as two sums. */
    weightedRatio: number;
    weight: number;
    compared: number;
    exercises: Set<string>;
    best: number | null;
  }
  const byMuscle = new Map<MuscleGroup, Bucket>();
  const bucket = (muscle: MuscleGroup): Bucket => {
    let entry = byMuscle.get(muscle);
    if (!entry) {
      entry = { weightedRatio: 0, weight: 0, compared: 0, exercises: new Set(), best: null };
      byMuscle.set(muscle, entry);
    }
    return entry;
  };

  for (const { exerciseId, roles, score, ratio } of rows) {
    for (const { muscle, weight } of muscleWeights(roles)) {
      const entry = bucket(muscle);
      entry.exercises.add(exerciseId);
      if (score !== null) entry.best = Math.max(entry.best ?? 0, score);
      if (ratio !== null && weight > 0) {
        entry.weightedRatio += weight * ratio;
        entry.weight += weight;
        entry.compared += 1;
      }
    }
  }

  return MUSCLE_GROUPS.map((muscle) => {
    const entry = byMuscle.get(muscle);
    if (!entry || entry.exercises.size === 0) {
      return {
        muscle,
        status: 'noData' as const,
        ratio: null,
        exercises: 0,
        compared: 0,
        latestScore: null,
      };
    }
    if (entry.weight <= 0) {
      return {
        muscle,
        status: 'insufficientBaseline' as const,
        ratio: null,
        exercises: entry.exercises.size,
        compared: 0,
        latestScore: entry.best,
      };
    }
    return {
      muscle,
      status: 'measured' as const,
      ratio: entry.weightedRatio / entry.weight,
      exercises: entry.exercises.size,
      compared: entry.compared,
      latestScore: entry.best,
    };
  });
}

export interface GymPerformance {
  /** The equal-weighted mean of the measured groups' ratios, or `null`. */
  ratio: number | null;
  /** Every group, whatever its status — the body renderer draws all ten. */
  muscles: MusclePerformance[];
  /** The groups that actually entered the mean. */
  measured: MuscleGroup[];
  /** Trained, but with nothing to compare against yet. */
  awaitingBaseline: MuscleGroup[];
  /** Never trained in the window. */
  untrained: MuscleGroup[];
}

/**
 * The Gym aggregate: **the equal-weighted mean over muscle groups.**
 *
 * Chest with five exercises and legs with two do not become five sevenths and
 * two sevenths. Each group produces one value and each value counts once.
 *
 * Only `measured` groups enter the denominator. A group nobody has trained is
 * not an earned zero — the app has never treated absence as failure, and
 * doing it here would mean a user who trains chest hard and has not yet
 * touched calves is scored as though they had failed at calves. A group that
 * has been trained but has no baseline is likewise excluded until it has one:
 * it has produced no progress to average.
 *
 * With no measured group at all the ratio is `null`, and every screen above
 * says "not started yet" rather than drawing a zero.
 */
export function gymPerformance(days: readonly ExerciseDay[]): GymPerformance {
  return gymPerformanceOf(musclePerformance(days));
}

/** The aggregate over the ten groups, whichever comparison produced them. */
function gymPerformanceOf(muscles: MusclePerformance[]): GymPerformance {
  const measured = muscles.filter((entry) => entry.status === 'measured');

  return {
    ratio:
      measured.length === 0
        ? null
        : measured.reduce((sum, entry) => sum + (entry.ratio ?? 0), 0) / measured.length,
    muscles,
    measured: measured.map((entry) => entry.muscle),
    awaitingBaseline: muscles
      .filter((entry) => entry.status === 'insufficientBaseline')
      .map((entry) => entry.muscle),
    untrained: muscles.filter((entry) => entry.status === 'noData').map((entry) => entry.muscle),
  };
}

/**
 * The same aggregation over a longer window — a year, or everything.
 *
 * The only difference is which comparison each exercise contributes: over a
 * long window it is the exercise's **whole span**, its most recent recorded
 * best against its first, rather than day against previous day. That is what
 * stops training frequency from becoming structural weight. Someone who
 * benches twice a week produces more comparisons than someone who benches
 * fortnightly, and if those were averaged the frequent trainer's chest would
 * speak more loudly than their legs. One span per exercise, one value per
 * group, equal weight per group: frequency changes how much evidence there
 * is, never how much a muscle counts.
 *
 * Under the Stage 5b metric the span of an exercise is the comparison the
 * metric names (`exerciseSpans`) — by default the median of its last days
 * against the median of its first — and `days` must be the list built under
 * that same metric.
 */
export function gymPerformanceOverSpan(
  days: readonly ExerciseDay[],
  metric: GymMetric | null = null,
): GymPerformance {
  if (metric !== null) {
    return gymPerformanceOf(
      musclesFromRows(
        exerciseSpans(days, metric.comparison).map((span) => ({
          exerciseId: span.exerciseId,
          roles: {
            muscles: span.muscles,
            ...(span.primaryMuscles === undefined ? {} : { primary: span.primaryMuscles }),
          },
          score: span.latestScore,
          ratio: span.ratio,
        })),
      ),
    );
  }

  const byExercise = new Map<string, ExerciseDay[]>();
  for (const day of days) {
    const list = byExercise.get(day.exerciseId);
    if (list) list.push(day);
    else byExercise.set(day.exerciseId, [day]);
  }

  /* Reduce each exercise to its first and last recorded day, then run the
     ordinary pipeline over those two — one comparison per exercise. */
  const spans: ExerciseDay[] = [];
  for (const list of byExercise.values()) {
    const ordered = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;
    spans.push(first);
    if (last !== first) spans.push(last);
  }

  return gymPerformance(spans);
}

/**
 * The same aggregation over an explicit date window.
 *
 * This is what the trend and year-to-date components run on, and the window
 * is the whole of the difference between them: 60 rolling days for one,
 * January the first for the other.
 *
 * Each exercise contributes **one** comparison, its last recorded best inside
 * the window against its first inside the window, and only when it was
 * actually recorded on two or more days there. Two consequences are the
 * reason it is written this way:
 *
 * - **Frequency is evidence, not weight.** Benching eight times in the window
 *   and squatting twice produces one chest comparison and one quad
 *   comparison, so training something often cannot make it count for more.
 * - **The anchor moves with the window.** A year-to-date figure measured from
 *   an exercise's first-ever session would keep reporting a beginner's first
 *   month for ever; measured from the first session *this year* it reports
 *   this year, which is what year-to-date means.
 *
 * Days outside the window are not compared against, and not treated as a
 * decline either — they are simply not in this question.
 */
export function gymPerformanceInWindow(
  days: readonly ExerciseDay[],
  from: DateKey,
  to: DateKey,
  metric: GymMetric | null = null,
): GymPerformance {
  return gymPerformanceOverSpan(
    days.filter((day) => day.date >= from && day.date <= to),
    metric,
  );
}

/* ── The window comparison of the Stage 5b metric ───────────────────────── */

/**
 * The median of a non-empty list: the middle value, or the mean of the two
 * middle ones. Dividing a sum of two integers by two is exact.
 */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/**
 * How many exercise-days each end of a window comparison rests on.
 *
 * `median`: half the days, rounded down, and three at most — so two or
 * three days are the last against the first, four or five the two last
 * against the two first, six or more the three last against the three
 * first. `firstLast`: one, whatever lies between. With fewer than two days
 * there is nothing to compare, under either.
 */
export function comparedDays(days: number, comparison: GymWindowComparison): number {
  if (days < 2) return 0;
  return comparison === 'firstLast' ? 1 : Math.min(3, Math.floor(days / 2));
}

/** One exercise over a list of its exercise-days: what it compares, and the result. */
export interface ExerciseSpan {
  exerciseId: string;
  /** Its groups and roles as of its latest day in the list. */
  muscles: MuscleGroup[];
  primaryMuscles?: MuscleGroup[];
  /** Its exercise-days in the list. */
  days: number;
  /** How many of them each end of the comparison rests on; 0 with fewer than two days. */
  compared: number;
  /** Its latest day's score, whether or not it could be compared. */
  latestScore: number;
  /** The median of its first `compared` days, or `null`. */
  baseline: number | null;
  /** The median of its last `compared` days, or `null`. */
  current: number | null;
  /** `current ÷ baseline`, or `null` with nothing to compare. 1 is unchanged. */
  ratio: number | null;
}

/**
 * Each exercise's change over a list of exercise-days, by the comparison a
 * Stage 5b metric names (D150).
 *
 * **The median of the last k days against the median of the first k.** One
 * comparison per exercise, as before: frequency adds evidence, never
 * weight. What the median adds is that a single day cannot speak for the
 * exercise — from six exercise-days a single light day at the end of the
 * window falls out entirely, with four or five it is halved, and a whole
 * light week stays visible as the decline it was. With two or three days
 * the comparison is the last against the first, as it always was.
 *
 * **This is the one place the comparison switch is read.** `firstLast`
 * rests each end on one day whatever the count; nothing else about the
 * function differs.
 *
 * The exercises stand in the order of their first appearance in `days`,
 * which under the Stage 5b metric is by date and exercise id.
 */
export function exerciseSpans(
  days: readonly ExerciseDay[],
  comparison: GymWindowComparison,
): ExerciseSpan[] {
  const byExercise = new Map<string, ExerciseDay[]>();
  for (const day of days) {
    const list = byExercise.get(day.exerciseId);
    if (list) list.push(day);
    else byExercise.set(day.exerciseId, [day]);
  }

  const spans: ExerciseSpan[] = [];
  for (const [exerciseId, list] of byExercise) {
    const ordered = [...list].sort((a, b) => compareIds(a.date, b.date));
    const latest = ordered[ordered.length - 1]!;
    const compared = comparedDays(ordered.length, comparison);
    const baseline =
      compared === 0 ? null : median(ordered.slice(0, compared).map((day) => day.best.score));
    const current =
      compared === 0 ? null : median(ordered.slice(-compared).map((day) => day.best.score));
    spans.push({
      exerciseId,
      muscles: latest.muscles,
      ...(latest.primaryMuscles === undefined ? {} : { primaryMuscles: latest.primaryMuscles }),
      days: ordered.length,
      compared,
      latestScore: latest.best.score,
      baseline,
      current,
      // A scorable set has positive reps and load, so a baseline is positive.
      ratio: baseline !== null && current !== null && baseline > 0 ? current / baseline : null,
    });
  }
  return spans;
}

/** A ratio as a percentage change: 1.2 → +20. `null` stays `null`. */
export function percentChange(ratio: number | null): number | null {
  return ratio === null ? null : (ratio - 1) * 100;
}
