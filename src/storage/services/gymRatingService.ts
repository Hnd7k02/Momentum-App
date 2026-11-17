import { isP8, sessionWritable, snapshotOn, weekWindows } from '../../core/config/closure';
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
import { gymCurveOf, gymMetricOf, gymScoringKey, type GymMetric } from '../../core/gym/metric';
import {
  gymPerformanceInWindow,
  percentChange,
  type ExerciseDay,
  type GymPerformance,
} from '../../core/gym/performance';
import {
  computeTrainingRating,
  type DecayPending,
  type TrainingRatingDay,
  type TrainingRatingPoint,
} from '../../core/scoring/trainingRating';
import { performanceScore, type PerformanceScore } from '../../core/scoring/performanceCurve';
import type { AppConfigSnapshot, ConfigSnapshotRecord, GymScoringModel } from '../../core/model';
import type { DayState, RatingPoint, RatingResult } from '../../core/rating';
import { computeRating } from '../../core/rating';
import { loadExerciseDaySource, type ExerciseDaySource } from './gymService';
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
 *
 * ## And two exercise-day metrics, joined by reading each day in its own
 *
 * A snapshot with no `gymMetric` was written before WP3 Stage 5b, and the
 * days it covers read their two windows by the best set of `reps × load`,
 * as they were scored (D84). From the first snapshot that carries the field
 * a day reads its windows by the best working set and the strength score —
 * **the whole window, in that day's metric**, the sets before the boundary
 * included, so no ratio ever divides one unit by the other and no window is
 * left without a baseline (D150). The fold itself does not change at the
 * boundary: the day the update lands takes one ordinary step towards the
 * target its windows give.
 *
 * ## And the curve at the value of the day
 *
 * How a window's change becomes a level is the shared curve
 * (`core/scoring/performanceCurve.ts`), and in the era of Stage 5b its one
 * value is Gym's own and travels in the snapshot beside the metric it was
 * fitted to (block "Kurve", D177). A day's windows are mapped with the
 * value **its own snapshot** names; a snapshot that names none — every day
 * before the boundary, and the days a Stage 5b preview scored — is the
 * curve of the constants. Nothing here knows a value of its own.
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
  /**
   * Present while a charge waits for its day to close (D135): the earliest
   * day that can still take a session — yesterday or today — on which the
   * run reached a block of the schedule, and how long the run was then. It
   * outlives a session logged today, which ends the run but not yesterday's
   * charge. Absent otherwise, so every state before P8 serialises exactly as
   * it did.
   */
  decayPending?: DecayPending;
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

/**
 * `days` must be the exercise-days as `metric` values them: the windows are
 * computed in one metric, the one the day `on` was lived under (D150).
 *
 * `curveDecadePercent` is the curve's value that day's snapshot names
 * (`gymCurveOf()`), or `null` where it names none: the curve of the
 * constants (D177).
 */
export function performanceOn(
  days: readonly ExerciseDay[],
  on: DateKey,
  metric: GymMetric | null = null,
  curveDecadePercent: number | null = null,
): WindowPerformance {
  const trendFrom = addDays(on, -(TRAINING_RATING.TREND_WINDOW_DAYS - 1));
  const trend = gymPerformanceInWindow(days, trendFrom, on, metric);
  const ytd = gymPerformanceInWindow(days, `${on.slice(0, 4)}-01-01`, on, metric);
  const changes = { trendChange: percentChange(trend.ratio), ytdChange: percentChange(ytd.ratio) };
  return {
    trend,
    ytd,
    // No value: the function is called as it always was, with one argument.
    score: curveDecadePercent === null ? performanceScore(changes) : performanceScore(changes, curveDecadePercent),
  };
}

export interface GymRatingInput {
  history: History;
  /** Gym day states, as `bossService` already derives them per domain. */
  dayStates: readonly DayState[];
  snapshots: readonly ConfigSnapshotRecord[];
  /** Every day a Gym session was saved, whatever else happened that day. */
  sessionDates: ReadonlySet<DateKey>;
  /**
   * The exercise-days of the whole history, under whichever metric a day
   * asks for (D150) — one read, however many metrics the history was lived
   * in.
   */
  exerciseDays: ExerciseDaySource;
  reference: DateKey;
}

export function buildGymRating(input: GymRatingInput): GymRatingState {
  return replayGymRating(input).state;
}

/**
 * The Gym rating, and beside it the rating as it stands if the open days
 * that hold a Gym session counted now (block 9, step 6a, D194): `null` when
 * no open day holds one. Kept apart from the state, which is what the
 * baselines freeze.
 */
export function replayGymRating(input: GymRatingInput): { state: GymRatingState; provisional: number | null } {
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

  const configs = dates.map((date) => resolveSnapshot(snapshots, date));
  const models = configs.map((config) => (config ? gymModelOf(config) : 'attendance'));
  /* The first day the new model is in force. Everything before it keeps the
     number it already had, computed by the fold that produced it. */
  const transition = models.findIndex((model) => model === 'attendancePerformance');

  /* ── Performance per day, memoised on the window contents ─────────────── */

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
   *
   * **One set of pointers and one cache per way of scoring** (D150, D177).
   * A day reads the exercise-days as its own metric values them and maps
   * their changes with its own snapshot's curve, so each pair of metric
   * and curve that occurs in the history has a track of its own: its list
   * in date order, its three pointers, its cache. A history has one track
   * before the Stage 5b update and two after it — three on a device a
   * Stage 5b preview left, never one per day — and a day advances only its
   * own. The pointers only move forward with the dates, so a track that
   * has not been read for a while catches up when it is, and nothing
   * computed under one metric or one curve can be handed to a day of
   * another.
   */
  interface Track {
    metric: GymMetric | null;
    /** The curve's value of the track's days, or `null` for the constants'. */
    curve: number | null;
    ordered: ExerciseDay[];
    trendLow: number;
    yearLow: number;
    high: number;
    cache: Map<string, WindowPerformance>;
  }
  const tracks = new Map<string, Track>();
  const trackOf = (config: AppConfigSnapshot | null): Track => {
    const metric = gymMetricOf(config);
    const curve = gymCurveOf(config);
    const key = gymScoringKey(metric, curve);
    let track = tracks.get(key);
    if (!track) {
      track = {
        metric,
        curve,
        ordered: [...input.exerciseDays.under(metric).days].sort((a, b) => a.date.localeCompare(b.date)),
        trendLow: 0,
        yearLow: 0,
        high: 0,
        cache: new Map(),
      };
      tracks.set(key, track);
    }
    return track;
  };
  const performanceByDate = new Map<DateKey, WindowPerformance>();
  dates.forEach((date, index) => {
    const track = trackOf(configs[index] ?? null);
    const { ordered } = track;
    const trendFrom = addDays(date, -(TRAINING_RATING.TREND_WINDOW_DAYS - 1));
    const yearFrom = `${date.slice(0, 4)}-01-01`;
    while (track.trendLow < ordered.length && ordered[track.trendLow]!.date < trendFrom) track.trendLow += 1;
    // January the first walks the pointer back, once a year, by at most a
    // year's worth of entries — so the pointer is reset rather than advanced.
    if (track.yearLow > 0 && ordered[track.yearLow - 1]!.date >= yearFrom) track.yearLow = 0;
    while (track.yearLow < ordered.length && ordered[track.yearLow]!.date < yearFrom) track.yearLow += 1;
    while (track.high < ordered.length && ordered[track.high]!.date <= date) track.high += 1;

    const key = `${track.trendLow}:${track.yearLow}:${track.high}`;
    let value = track.cache.get(key);
    if (!value) {
      value = performanceOn(
        ordered.slice(Math.min(track.trendLow, track.yearLow), track.high),
        date,
        track.metric,
        track.curve,
      );
      track.cache.set(key, value);
    }
    performanceByDate.set(date, value);
  });
  const performanceFor = (date: DateKey): WindowPerformance => {
    const known = performanceByDate.get(date);
    if (known) return known;
    // A day outside the history: computed in that day's own metric, with its own curve.
    const track = trackOf(resolveSnapshot(snapshots, date));
    return performanceOn(track.ordered, date, track.metric, track.curve);
  };

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
  /** Per modern day: still open (D111), with a Gym session on it (D194). */
  const openWithSession: boolean[] = [];
  for (let index = legacyEnd; index < dates.length; index += 1) {
    const date = dates[index]!;
    const state = dayStates[index];
    const weekWindow = weekWindowOf(date);
    const dayConfig = snapshotOn(snapshots, date);
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
       * week can still take a session, anything logged in it counts as met
       * on a day lived under P8, so a session written for yesterday can never
       * lift a day this replay already charged. Performance moves daily all
       * the same. The real count lands once the week can no longer be
       * written. Decided per day: in the week the update lands in, its days
       * before the update keep the running count they were lived under.
       */
      sessionsInWeek:
        isP8(dayConfig) && week?.inProgress === true && (week?.sessions ?? 0) > 0
          ? Math.max(week.sessions, week.target)
          : week?.sessions ?? 0,
      weeklyTarget: week?.target ?? 1,
      sessionToday: sessionDates.has(date),
      paused: pausedOn(date),
      performance: performance.score,
      performanceChange: aggregateChange(performance),
      abstinentDays: abstinentDays[index] ?? 0,
      // P8 (D135): a day that can still take a session is carried, not
      // charged — exactly the days the write rule still opens.
      ...(sessionWritable(date, input.reference, dayConfig, weekWindow) ? { open: true } : {}),
      ageMonths: origin ? trainingAgeMonths(origin, date) : 0,
      // The gate opens from the day *after* the week it was completed in:
      // a week is only known to have been met once it is over.
      enduranceUnlocked: index >= unlockedFrom,
    });
    openWithSession.push(
      state?.status === 'open' && sessionDates.has(date) && week !== undefined && !(pausedOn(date) && (week?.sessions ?? 0) === 0),
    );
  }

  const carried = legacyEnd === 0 ? undefined : legacy.points[legacyEnd - 1]?.rating;
  const foldOptions = {
    ...(carried === undefined ? {} : { start: carried }),
    peak: legacyEnd === 0 ? RATING.START : legacy.peak,
  };
  const modern = computeTrainingRating(modernDays, foldOptions);

  /*
   * Block 9, step 6a (D194). A workout saved on a day that is still open —
   * a question of that day unanswered (D111) — is not counted until the day
   * is complete or has closed, so the rating did not move with it until
   * then: "erst am nächsten Tag". The rule stays. Beside it, the rating as
   * it stands if those days counted now: the same fold over the same days,
   * an open day that holds a Gym session taken as scored. A screen shows it
   * as provisional; nothing that rates reads it, and it is absent on every
   * load where no open day holds a session.
   */
  const provisional = openWithSession.some(Boolean)
    ? computeTrainingRating(
        modernDays.map((day, index) => (openWithSession[index] ? { ...day, scored: true } : day)),
        foldOptions,
      )
    : null;

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
  // Only yesterday and today can still be carried; the earlier of them waits first.
  const pendingPoint = modern.points.slice(-2).find((point) => point.decayPending === true);
  const decayPending: DecayPending | null = pendingPoint
    ? {
        day: pendingPoint.date === input.reference ? 'today' : 'yesterday',
        days: abstinentDays[dates.indexOf(pendingPoint.date)] ?? 0,
      }
    : null;

  const state: GymRatingState = {
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
    ...(decayPending ? { decayPending } : {}),
    maintenance: lastDetail?.maintenance ?? false,
  };
  return { state, provisional: provisional ? provisional.current : null };
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
export { loadExerciseDaySource };
