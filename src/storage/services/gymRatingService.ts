import { sessionDayOpen, weekWindows } from '../../core/config/closure';
import { RATING } from '../../core/config/constants';
import {
  addDays,
  compareDateKeys,
  weekKeyOf,
  type DateKey,
  type WeekKey,
} from '../../core/dates';
import { TRAINING_RATING } from '../../core/config/constants';
import {
  currentAbstinence,
  trainingAgeMonths,
  type AbstinenceEpisode,
} from '../../core/scoring/abstinence';
import { enduranceState, type EnduranceState, type EnduranceWeek } from '../../core/scoring/endurance';
import {
  gymPerformanceInWindow,
  percentChange,
  type ExerciseDay,
  type GymPerformance,
} from '../../core/gym/performance';
import {
  computeTrainingRating,
  type TrainingRatingDay,
  type TrainingRatingPoint,
} from '../../core/scoring/trainingRating';
import { performanceScore, type PerformanceScore } from '../../core/scoring/performanceCurve';
import type { AppConfigSnapshot, ConfigSnapshotRecord, GymScoringModel } from '../../core/model';
import type { DayState, RatingPoint, RatingResult } from '../../core/rating';
import { computeRating } from '../../core/rating';
import { loadExerciseDays } from './gymService';
import type { History } from './historyService';

/**
 * The Gym rating, assembled from what is stored and nothing else.
 *
 * The arithmetic is all in `core/gym/*` and none of it is here; this module's
 * job is to feed it truthful inputs — which day was scored, what the week's
 * target was, what the user had actually lifted by each day, and which
 * scoring era each day belongs to.
 *
 * ## Two eras, joined the way the Boss joins its own
 *
 * A config snapshot with no `gymModel` was written before this model existed,
 * and the days it covers are scored the way they were actually scored: the
 * shared EWMA over attendance. From the first snapshot that carries
 * `attendancePerformance`, the new fold takes over — **continuing from the
 * number the old one left**, so the day the update lands moves the rating by
 * one ordinary step rather than by a jump. Upgrading the app must neither
 * create progress nor take it away, and that rule does not stop applying
 * because the domain is Gym rather than the Boss (D68a, D90).
 */

export interface GymRatingState {
  /** One point per history day, aligned with `history.days`. */
  points: RatingPoint[];
  /** The richer per-day record, for the screens that explain the number. */
  detail: TrainingRatingPoint[];
  rating: number;
  peak: number;
  /** The era today's number was produced in. */
  model: GymScoringModel;
  /** The day Gym first had anything of its own, or `null` if it never has. */
  origin: DateKey | null;
  ageMonths: number;
  endurance: EnduranceState;
  /**
   * Whether the Endurance gate was open on each day, aligned with `points`.
   *
   * The name is the one D94 gave it, when the gate held a domain's first
   * promotion. A domain has no rank since D125, so nothing reads this any
   * more; it stays as the gate's per-day answer, which the Stage 2 baseline
   * records, and it is not a promotion of anything.
   */
  promotionUnlocked: boolean[];
  /** Today's windows, for the Gym screens. */
  performance: PerformanceScore;
  trend: GymPerformance | null;
  ytd: GymPerformance | null;
  trendChange: number | null;
  ytdChange: number | null;
  /** This week's attendance, as the user is living it. */
  sessionsThisWeek: number;
  weeklyTarget: number;
  /** The abstinence episode in progress, or `null` when there is none. */
  abstinence: AbstinenceEpisode | null;
  /** Share of the baseline rank progress the episode has removed so far. */
  decayFraction: number;
  /** True when today's rating is being held up by the Maintenance rule. */
  maintenance: boolean;
}

/** Which Gym model a day was lived under. Absent is the pre-4.1 era. */
export function gymModelOf(config: AppConfigSnapshot): GymScoringModel {
  return config.scoring.gymModel ?? 'attendance';
}

function resolveSnapshot(
  snapshots: readonly ConfigSnapshotRecord[],
  date: DateKey,
): AppConfigSnapshot | null {
  let match: ConfigSnapshotRecord | undefined;
  for (const snapshot of snapshots) {
    if (compareDateKeys(snapshot.effectiveFrom, date) <= 0) match = snapshot;
    else break;
  }
  return match?.config ?? null;
}

/**
 * The performance windows as they stood on one day.
 *
 * Both windows are spans — one comparison per exercise — so training
 * frequency adds evidence and never weight. The trend window rolls; the
 * year-to-date window starts at January the first and is therefore a
 * different, deliberately shorter, question every January.
 */
export interface WindowPerformance {
  trend: GymPerformance;
  ytd: GymPerformance;
  score: PerformanceScore;
}

export function performanceOn(days: readonly ExerciseDay[], on: DateKey): WindowPerformance {
  const trendFrom = addDays(on, -(TRAINING_RATING.TREND_WINDOW_DAYS - 1));
  const trend = gymPerformanceInWindow(days, trendFrom, on);
  const ytd = gymPerformanceInWindow(days, `${on.slice(0, 4)}-01-01`, on);
  return {
    trend,
    ytd,
    score: performanceScore({
      trendChange: percentChange(trend.ratio),
      ytdChange: percentChange(ytd.ratio),
    }),
  };
}

export interface GymRatingInput {
  history: History;
  /** Gym day states, as `bossService` already derives them per domain. */
  dayStates: readonly DayState[];
  snapshots: readonly ConfigSnapshotRecord[];
  /** Every day a Gym session was saved, whatever else happened that day. */
  sessionDates: ReadonlySet<DateKey>;
  exerciseDays: readonly ExerciseDay[];
  reference: DateKey;
}

export function buildGymRating(input: GymRatingInput): GymRatingState {
  const { history, dayStates, snapshots, sessionDates } = input;
  const dates = history.days.map((day) => day.date);

  /* ── Weeks, for attendance and for the Endurance Phase ───────────────── */

  const weekTargets = new Map<WeekKey, { sessions: number; target: number; inProgress: boolean }>();
  for (const week of history.weeks) {
    const gym = week.domains.find((entry) => entry.domain === 'gym');
    if (!gym) continue;
    weekTargets.set(week.weekKey, {
      sessions: gym.sessions,
      target: gym.target,
      inProgress: week.inProgress,
    });
  }

  /*
   * Gym's own timeline. The Endurance Phase, the training age the decay
   * schedule is keyed on and the abstinence run all start here, and "here" is
   * the first day Gym actually had something of its own — not the first day
   * the app was installed. A user who enabled Gym in June is two months into
   * Gym in August, however long they have been logging their sleep.
   */
  const origin = dates.find((date) => sessionDates.has(date)) ?? null;

  const enduranceWeeks: EnduranceWeek[] = origin
    ? history.weeks
        .filter((week) => week.weekKey >= weekKeyOf(origin))
        .flatMap((week) => {
          const entry = weekTargets.get(week.weekKey);
          return entry
            ? [{
                weekKey: week.weekKey,
                sessions: entry.sessions,
                target: entry.target,
                inProgress: entry.inProgress,
              }]
            : [];
        })
    : [];
  const endurance = enduranceState(enduranceWeeks);

  /* ── Which era each day belongs to ───────────────────────────────────── */

  const models = dates.map((date) => {
    const config = resolveSnapshot(snapshots, date);
    return config ? gymModelOf(config) : 'attendance';
  });
  /* The first day the new model is in force. Everything before it keeps the
     number it already had, computed by the fold that produced it. */
  const transition = models.findIndex((model) => model === 'attendancePerformance');

  /* ── Performance per day, memoised on the window contents ─────────────── */

  const ordered = [...input.exerciseDays].sort((a, b) => a.date.localeCompare(b.date));
  /*
   * The windows only change when a day enters or leaves one, so the whole
   * pipeline runs once per distinct window rather than once per calendar day.
   * A two-year replay of someone training three times a week has a few
   * hundred distinct windows, not seven hundred and thirty of them.
   *
   * The bounds are found by walking three pointers forward with the dates
   * rather than by filtering the array per day. Filtering inside a loop over
   * the history is the quadratic that was already found and removed once
   * here (D73), and it would have come straight back.
   */
  const cache = new Map<string, WindowPerformance>();
  let trendLow = 0;
  let yearLow = 0;
  let high = 0;
  const performanceByDate = new Map<DateKey, WindowPerformance>();
  for (const date of dates) {
    const trendFrom = addDays(date, -(TRAINING_RATING.TREND_WINDOW_DAYS - 1));
    const yearFrom = `${date.slice(0, 4)}-01-01`;
    while (trendLow < ordered.length && ordered[trendLow]!.date < trendFrom) trendLow += 1;
    // January the first walks the pointer back, once a year, by at most a
    // year's worth of entries — so the pointer is reset rather than advanced.
    if (yearLow > 0 && ordered[yearLow - 1]!.date >= yearFrom) yearLow = 0;
    while (yearLow < ordered.length && ordered[yearLow]!.date < yearFrom) yearLow += 1;
    while (high < ordered.length && ordered[high]!.date <= date) high += 1;

    const key = `${trendLow}:${yearLow}:${high}`;
    let value = cache.get(key);
    if (!value) {
      value = performanceOn(ordered.slice(Math.min(trendLow, yearLow), high), date);
      cache.set(key, value);
    }
    performanceByDate.set(date, value);
  }
  const performanceFor = (date: DateKey): WindowPerformance =>
    performanceByDate.get(date) ?? performanceOn(ordered, date);

  /* ── The abstinence run, walked once ─────────────────────────────────── */

  /*
   * One canonical answer to "was this date paused", taken from the history
   * the replay already resolved. Neither service re-derives date overlap.
   */
  const pausedByIndex = new Map(dates.map((date, index) => [date, history.paused[index] === true]));
  const pausedOn = (date: DateKey): boolean => pausedByIndex.get(date) === true;

  const abstinentDays: number[] = [];
  let run = 0;
  for (const date of dates) {
    if (origin === null || date < origin) {
      abstinentDays.push(0);
      continue;
    }
    /*
     * A paused day neither advances the clock nor resets it. Freezing the
     * run here — rather than teaching `abstinence.ts` about pauses — is what
     * keeps the approved decay arithmetic exactly as it was: it still sees a
     * count of consecutive zero-session days, there are simply fewer of them.
     */
    if (sessionDates.has(date)) run = 0;
    else if (!pausedOn(date)) run += 1;
    abstinentDays.push(run);
  }

  /* ── The two folds ───────────────────────────────────────────────────── */

  const legacy = computeRating(dayStates as DayState[], { domain: 'gym' });
  const legacyEnd = transition === -1 ? dates.length : transition;

  const unlockedFrom =
    endurance.unlockedAt === null
      ? Infinity
      : dates.findIndex((date) => weekKeyOf(date) > endurance.unlockedAt!);

  /* Each week's era (D132): a P8 week waits for its Sunday to close. */
  const weekWindowOf = weekWindows(snapshots);

  const modernDays: TrainingRatingDay[] = [];
  for (let index = legacyEnd; index < dates.length; index += 1) {
    const date = dates[index]!;
    const state = dayStates[index];
    const weekWindow = weekWindowOf(date);
    const week = weekTargets.get(weekKeyOf(date));
    const performance = performanceFor(date);
    modernDays.push({
      date,
      /*
       * A paused week with nothing logged in it is not scored — it is "no
       * data", exactly like a day before the domain existed. Charging zero
       * attendance for a declared absence is the penalty a pause exists to
       * suspend, and it is not suspended by the decay rule alone: the decay
       * branch is rank-floored and the ordinary target is not, so leaving
       * this out made a pause strictly worse than no pause.
       */
      scored:
        state?.status === 'scored' &&
        week !== undefined &&
        !(pausedOn(date) && (week?.sessions ?? 0) === 0),
      /*
       * The weekly target is judged when the week is over (D134): while a
       * P8 week can still take a session, anything logged in it counts as
       * met, so a session written for yesterday can never lift a day this
       * replay already charged. Performance moves daily all the same. The
       * real count lands once the week's Sunday can no longer be written.
       */
      sessionsInWeek:
        weekWindow !== null && week?.inProgress === true && (week?.sessions ?? 0) > 0
          ? Math.max(week.sessions, week.target)
          : week?.sessions ?? 0,
      weeklyTarget: week?.target ?? 1,
      sessionToday: sessionDates.has(date),
      paused: pausedOn(date),
      performance: performance.score,
      performanceChange: aggregateChange(performance),
      abstinentDays: abstinentDays[index] ?? 0,
      // P8 (D135): a day that can still take a session is carried, not charged.
      ...(sessionDayOpen(date, input.reference, weekWindow) ? { open: true } : {}),
      ageMonths: origin ? trainingAgeMonths(origin, date) : 0,
      // The gate opens from the day *after* the week it was completed in:
      // a week is only known to have been met once it is over.
      enduranceUnlocked: index >= unlockedFrom,
    });
  }

  const carried = legacyEnd === 0 ? undefined : legacy.points[legacyEnd - 1]?.rating;
  const modern = computeTrainingRating(modernDays, {
    ...(carried === undefined ? {} : { start: carried }),
    peak: legacyEnd === 0 ? RATING.START : legacy.peak,
  });

  /* One series, whose increments change definition at one point. */
  const points: RatingPoint[] = [
    ...legacy.points.slice(0, legacyEnd),
    ...modern.points.map((point) => ({
      date: point.date,
      rating: point.rating,
      streak: 0,
      streakBonus: 0,
      weight: point.skipped ? 0 : 1,
      decay: 0,
      calibrating: false,
      skipped: point.skipped,
    })),
  ];

  const promotionUnlocked = dates.map((_, index) =>
    index < legacyEnd ? true : index >= unlockedFrom,
  );

  const last = points[points.length - 1];
  const rating = last?.rating ?? RATING.START;
  const todayWeek = weekTargets.get(weekKeyOf(input.reference));
  const todayPerformance = performanceFor(input.reference);
  const abstinence = origin
    ? currentAbstinence(sessionDates, origin, input.reference)
    : null;
  const lastDetail = modern.points[modern.points.length - 1];

  return {
    points,
    detail: modern.points,
    rating,
    peak: Math.max(legacyEnd === 0 ? RATING.START : legacy.peak, modern.peak),
    model: models[models.length - 1] ?? 'attendance',
    origin,
    ageMonths: origin ? trainingAgeMonths(origin, input.reference) : 0,
    endurance,
    promotionUnlocked,
    performance: todayPerformance.score,
    trend: todayPerformance.trend,
    ytd: todayPerformance.ytd,
    trendChange: percentChange(todayPerformance.trend.ratio),
    ytdChange: percentChange(todayPerformance.ytd.ratio),
    sessionsThisWeek: todayWeek?.sessions ?? 0,
    weeklyTarget: todayWeek?.target ?? 0,
    abstinence,
    decayFraction: lastDetail?.decayFraction ?? 0,
    maintenance: lastDetail?.maintenance ?? false,
  };
}

/**
 * The one aggregate change Maintenance judges, in percent.
 *
 * The blended Performance Score read back through the curve would do, but it
 * is simpler and more honest to average the two windows' changes here: this
 * number is only ever compared against zero, and at zero the two agree
 * exactly because the curve is symmetric about it.
 */
function aggregateChange(performance: WindowPerformance): number | null {
  const values = [performance.trend.ratio, performance.ytd.ratio].filter(
    (value): value is number => value !== null,
  );
  if (values.length === 0) return null;
  return ((values.reduce((sum, value) => sum + value, 0) / values.length) - 1) * 100;
}

export type { RatingResult };
export { loadExerciseDays };
