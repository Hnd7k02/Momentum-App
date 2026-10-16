import { sessionDayOpen, weekWindows } from '../../core/config/closure';
import { RATING, TRAINING_RATING } from '../../core/config/constants';
import { addDays, compareDateKeys, weekKeyOf, type DateKey, type WeekKey } from '../../core/dates';
import type {
  AppConfigSnapshot,
  ConfigSnapshotRecord,
  RunRecord,
  RunningScoringModel,
} from '../../core/model';
import type { DayState, RatingPoint } from '../../core/rating';
import { computeRating } from '../../core/rating';
import {
  currentAbstinence,
  trainingAgeMonths,
  type AbstinenceEpisode,
} from '../../core/scoring/abstinence';
import {
  enduranceState,
  type EnduranceState,
  type EnduranceWeek,
} from '../../core/scoring/endurance';
import { performanceScore, type PerformanceScore } from '../../core/scoring/performanceCurve';
import {
  computeTrainingRating,
  type TrainingRatingDay,
  type TrainingRatingPoint,
} from '../../core/scoring/trainingRating';
import {
  paceChangePercent,
  runningPerformanceInWindow,
  type RunObservation,
  type RunningPerformance,
} from '../../core/running/performance';
import { runsRepository } from '../repositories';
import type { History } from './historyService';

/**
 * The Running rating, assembled from what is stored and nothing else.
 *
 * A deliberate near-twin of `gymRatingService`. The two domains differ in
 * exactly one place — what a performance observation *is* — and everything
 * downstream of that is the same shared code (`core/scoring/*`). Keeping the
 * two services parallel rather than merging them into one generic replay is
 * the smaller cost: their storage shapes and their windows are genuinely
 * different, and a single abstraction over both would have to carry a
 * discriminator into every line.
 *
 * ## Two eras, joined the way Gym joins its own
 *
 * A snapshot with no `runningModel` predates phase 5, and the days it covers
 * are scored the way they were actually scored: the shared EWMA over
 * attendance. From the first snapshot carrying `attendancePerformance` the
 * new fold takes over, **continuing from the number the old one left**, so
 * the day the update lands moves the rating by one ordinary step rather than
 * by a jump.
 */

export interface RunningRatingState {
  /** One point per history day, aligned with `history.days`. */
  points: RatingPoint[];
  /** The richer per-day record, for the screens that explain the number. */
  detail: TrainingRatingPoint[];
  rating: number;
  peak: number;
  model: RunningScoringModel;
  /** The day Running first had anything of its own, or `null`. */
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
  /** Today's windows, for the Running screens. */
  performance: PerformanceScore;
  trend: RunningPerformance | null;
  ytd: RunningPerformance | null;
  trendChange: number | null;
  ytdChange: number | null;
  sessionsThisWeek: number;
  weeklyTarget: number;
  abstinence: AbstinenceEpisode | null;
  decayFraction: number;
  /**
   * Present, as `true`, while a charge waits for its day to close (D135):
   * the run has reached a block of the schedule on a day that can still take
   * a session. Absent otherwise — so every state before P8 serialises
   * exactly as it did.
   */
  decayPending?: true;
  maintenance: boolean;
  /** Runs in the window that carry no performance, so a screen can say why. */
  attendanceOnlyRuns: number;
}

/** Which era a day was lived under. Absent is the pre-phase-5 era. */
export function runningModelOf(config: AppConfigSnapshot): RunningScoringModel {
  return config.scoring.runningModel ?? 'attendance';
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

export interface WindowPerformance {
  trend: RunningPerformance;
  ytd: RunningPerformance;
  score: PerformanceScore;
}

/**
 * The two performance windows as they stood on one day.
 *
 * Each is computed independently over its own date range, so the trend cannot
 * borrow the year's baseline and January the first genuinely restarts the
 * yearly question.
 */
export function performanceOn(runs: readonly RunObservation[], on: DateKey): WindowPerformance {
  const trendFrom = addDays(on, -(TRAINING_RATING.TREND_WINDOW_DAYS - 1));
  const trend = runningPerformanceInWindow(runs, trendFrom, on);
  const ytd = runningPerformanceInWindow(runs, `${on.slice(0, 4)}-01-01`, on);
  return {
    trend,
    ytd,
    score: performanceScore({
      trendChange: paceChangePercent(trend.ratio),
      ytdChange: paceChangePercent(ytd.ratio),
    }),
  };
}

export interface RunningRatingInput {
  history: History;
  dayStates: readonly DayState[];
  snapshots: readonly ConfigSnapshotRecord[];
  /** Every day a run was saved, whatever else happened that day. */
  runDates: ReadonlySet<DateKey>;
  runs: readonly RunObservation[];
  reference: DateKey;
}

export function buildRunningRating(input: RunningRatingInput): RunningRatingState {
  const { history, dayStates, snapshots, runDates } = input;
  const dates = history.days.map((day) => day.date);

  /* ── Weeks, for attendance and for the Endurance Phase ───────────────── */

  const weeks = new Map<WeekKey, { sessions: number; target: number; inProgress: boolean }>();
  for (const week of history.weeks) {
    const entry = week.domains.find((domain) => domain.domain === 'running');
    if (!entry) continue;
    weeks.set(week.weekKey, {
      sessions: entry.sessions,
      target: entry.target,
      inProgress: week.inProgress,
    });
  }

  /*
   * Running's own timeline. A user who enabled Running in June is two months
   * into Running in August, however long they have been logging their sleep —
   * so the Endurance Phase, the decay schedule's training age and the
   * abstinence run all start at the first day Running had a session.
   */
  const origin = dates.find((date) => runDates.has(date)) ?? null;

  const enduranceWeeks: EnduranceWeek[] = origin
    ? history.weeks
        .filter((week) => week.weekKey >= weekKeyOf(origin))
        .flatMap((week) => {
          const entry = weeks.get(week.weekKey);
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
    return config ? runningModelOf(config) : ('attendance' as const);
  });
  const transition = models.findIndex((model) => model === 'attendancePerformance');

  /* ── Performance per day, memoised on the window contents ─────────────── */

  const ordered = [...input.runs].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  /*
   * The windows change only when a run enters or leaves one, so the pipeline
   * runs once per distinct window rather than once per calendar day. The
   * bounds are walked with pointers rather than by filtering inside the day
   * loop — that filter is the quadratic D73 already removed once from the week
   * lookup, and it would come straight back here.
   */
  const cache = new Map<string, WindowPerformance>();
  const byDate = new Map<DateKey, WindowPerformance>();
  let trendLow = 0;
  let yearLow = 0;
  let high = 0;
  for (const date of dates) {
    const trendFrom = addDays(date, -(TRAINING_RATING.TREND_WINDOW_DAYS - 1));
    const yearFrom = `${date.slice(0, 4)}-01-01`;
    while (trendLow < ordered.length && ordered[trendLow]!.date < trendFrom) trendLow += 1;
    // January the first walks the pointer back, once a year.
    if (yearLow > 0 && ordered[yearLow - 1]!.date >= yearFrom) yearLow = 0;
    while (yearLow < ordered.length && ordered[yearLow]!.date < yearFrom) yearLow += 1;
    while (high < ordered.length && ordered[high]!.date <= date) high += 1;

    const key = `${trendLow}:${yearLow}:${high}`;
    let value = cache.get(key);
    if (!value) {
      value = performanceOn(ordered.slice(Math.min(trendLow, yearLow), high), date);
      cache.set(key, value);
    }
    byDate.set(date, value);
  }
  const performanceFor = (date: DateKey): WindowPerformance =>
    byDate.get(date) ?? performanceOn(ordered, date);

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
     * count of consecutive zero-run days, there are simply fewer of them.
     */
    if (runDates.has(date)) run = 0;
    else if (!pausedOn(date)) run += 1;
    abstinentDays.push(run);
  }

  /* ── The two folds ───────────────────────────────────────────────────── */

  const legacy = computeRating(dayStates as DayState[], { domain: 'running' });
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
    const week = weeks.get(weekKeyOf(date));
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
      sessionToday: runDates.has(date),
      paused: pausedOn(date),
      performance: performance.score,
      performanceChange: aggregateChange(performance),
      abstinentDays: abstinentDays[index] ?? 0,
      // P8 (D135): a day that can still take a session is carried, not charged.
      ...(sessionDayOpen(date, input.reference, weekWindow) ? { open: true } : {}),
      ageMonths: origin ? trainingAgeMonths(origin, date) : 0,
      // A week is only known to have been met once it is over.
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
  const todayWeek = weeks.get(weekKeyOf(input.reference));
  const todayPerformance = performanceFor(input.reference);
  const lastDetail = modern.points[modern.points.length - 1];
  const trendFrom = addDays(input.reference, -(TRAINING_RATING.TREND_WINDOW_DAYS - 1));

  return {
    points,
    detail: modern.points,
    rating: last?.rating ?? RATING.START,
    peak: Math.max(legacyEnd === 0 ? RATING.START : legacy.peak, modern.peak),
    model: models[models.length - 1] ?? 'attendance',
    origin,
    ageMonths: origin ? trainingAgeMonths(origin, input.reference) : 0,
    endurance,
    promotionUnlocked,
    performance: todayPerformance.score,
    trend: todayPerformance.trend,
    ytd: todayPerformance.ytd,
    trendChange: paceChangePercent(todayPerformance.trend.ratio),
    ytdChange: paceChangePercent(todayPerformance.ytd.ratio),
    sessionsThisWeek: todayWeek?.sessions ?? 0,
    weeklyTarget: todayWeek?.target ?? 0,
    abstinence: origin ? currentAbstinence(runDates, origin, input.reference) : null,
    decayFraction: lastDetail?.decayFraction ?? 0,
    ...(lastDetail?.decayPending === true ? { decayPending: true as const } : {}),
    maintenance: lastDetail?.maintenance ?? false,
    attendanceOnlyRuns: ordered.filter(
      (entry) =>
        entry.date >= trendFrom &&
        entry.date <= input.reference &&
        (entry.distanceMetres === null || entry.durationSeconds === null),
    ).length,
  };
}

/**
 * The one aggregate change Maintenance judges, in percent.
 *
 * The mean of the two windows' ratios, converted once. This number is only
 * ever compared against zero, where averaging-then-converting and the score's
 * own convert-then-average agree exactly, because the curve is symmetric
 * about it. Identical to Gym's treatment, deliberately.
 */
function aggregateChange(performance: WindowPerformance): number | null {
  const values = [performance.trend.ratio, performance.ytd.ratio].filter(
    (value): value is number => value !== null,
  );
  if (values.length === 0) return null;
  return (values.reduce((sum, value) => sum + value, 0) / values.length - 1) * 100;
}

/** Every run in a range, as the pure pipeline wants it. */
export async function loadRunObservations(
  from: DateKey,
  to: DateKey,
): Promise<RunObservation[]> {
  const runs: RunRecord[] = await runsRepository.listByDateRange(from, to);
  return runs.map((entry) => ({
    id: entry.id,
    date: entry.date,
    distanceMetres: entry.distanceMetres,
    durationSeconds: entry.durationSeconds,
  }));
}
