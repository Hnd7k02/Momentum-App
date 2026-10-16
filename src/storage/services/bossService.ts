import { today } from '../../core/clock';
import { daySettled, isP8, snapshotOn, weekTargetThrough, weekWindows } from '../../core/config/closure';
import type { DateKey } from '../../core/dates';
import {
  BOSS_PROGRESS_MAX,
  bossEraOf,
  bossSeries,
  ratingToProgress,
  type BossDayInput,
  type BossEra,
  type BossPoint,
  type BossTransition,
} from '../../core/boss';
import { DOMAIN_TYPES } from '../../core/domains';
import { buildLedger, type DomainLedger } from '../../core/ledger';
import type { ConfigSnapshotRecord, DomainType } from '../../core/model';
import { compareDateKeys } from '../../core/dates';
import type { DayState } from '../../core/rating';
import type { PromotionConfirmationState } from '../../core/model';
import { rankHistory, rankForRating, type Rank, type RankChange } from '../../core/ranks';
import {
  canonicalConfirmation,
  confirmedRankHistory,
  type PendingConfirmation,
} from '../../core/ranks/confirmation';
import {
  configSnapshotsRepository,
  gymSessionsRepository,
  runsRepository,
  settingsRepository,
} from '../repositories';
import { reconcilePromotionConfirmation } from './promotionConfirmationService';
import { buildGymRating, type GymRatingState } from './gymRatingService';
import { loadExerciseDays } from './gymService';
import {
  buildRunningRating,
  loadRunObservations,
  type RunningRatingState,
} from './runningRatingService';
import type { History } from './historyService';
import { loadProgression, progressionOrigin, type Progression } from './ratingService';

/**
 * Per-domain progression and the Boss Rank above it — **the only rank**.
 *
 * A domain here is a rating series and the ladder position the Boss reads
 * from it; the rank, peak rank, rank history and lifetime XP below are the
 * Boss's and nobody else's (Stage 2 of the Overall-rank update).
 *
 * Replayed, never stored — the same rule as everything else derived. Adding
 * this service does not change what RC2 already computes: `loadProgression`
 * still produces the one undivided progression a pre-iteration-2 profile had,
 * and that series is what the Boss uses for every day that predates the
 * upgrade. Nothing here can move a number a user has already seen.
 *
 * ## The two eras, and the join between them
 *
 * Each day resolves to the config snapshot in force on it, and that snapshot
 * decides how the Boss is computed for that day:
 *
 * - **No `boss` field** — the snapshot was written by RC2. That day had one
 *   progression covering everything the user did, so the Boss for it *is*
 *   that progression. It is not a carried-over number seeded at the boundary,
 *   it is the same replay, so pre-upgrade Boss history is exactly what RC2
 *   showed and cannot drift.
 * - **Weights present** — the Boss continues from where the RC2 era left it
 *   and moves by the weighted movement of the domain ledgers.
 *
 * An application upgrade must not create progress or take it away. Replacing
 * the user's standing with a weighted *level* computed a different way would
 * do exactly that on the day it landed; accumulating weighted *movement* from
 * the RC2 era's final value cannot. `bossSeries` holds the formula and the
 * reasoning; this module's job is to feed it truthful per-domain series.
 */

export interface DomainProgression extends DomainLedger {
  /** Ladder position on each day, aligned with the history days. */
  series: number[];
  /** Whether the domain had started by each of those days. */
  active: boolean[];
}

export interface BossProgression {
  origin: DateKey;
  /** One Boss point per day, aligned with `history.days`. */
  points: BossPoint[];
  /** Where the weighted era begins, and the value it continues from. */
  transition: (BossTransition & { date: DateKey }) | null;
  /** Ladder position today, 0–8. */
  progress: number;
  rank: Rank;
  peakRank: Rank;
  changes: RankChange[];
  /** Lifetime XP across every domain — one number, never per domain. */
  lifetimeXp: number;
  /**
   * The promotion being confirmed, or `null` at the top of the ladder or
   * before the confirmation era was activated (D126).
   */
  pending: PendingConfirmation | null;
  /** The persisted confirmation state as reconciled by this replay, if active. */
  confirmation: PromotionConfirmationState | null;
  domains: DomainProgression[];
  /** The era today's Boss was computed in, for the "why this number" panel. */
  era: BossEra['era'];
  history: History;
  /** The undivided RC2 progression, still the source for pre-upgrade days. */
  legacy: Progression;
  /**
   * Gym's own rating state — the Endurance Phase, the two performance
   * windows, the abstinence episode and the era each day was scored in.
   *
   * The Gym *ledger* above is built from this and is an ordinary ledger like
   * any other, which is the point: the Boss reads ladder positions and knows
   * nothing about how Gym produced its rating (§22). There is no separate
   * Gym-to-Boss formula, and this field exists so the Gym screens can explain
   * a number the Boss simply consumes.
   */
  gym: GymRatingState;
  /**
   * Running's rating state — its distance identities, the two pace windows,
   * the Endurance Phase and the abstinence episode.
   *
   * The same arrangement as `gym` above and for the same reason: the Boss
   * reads a ladder position and knows nothing about how either domain
   * produced its rating. There is no separate Running-to-Boss formula.
   */
  running: RunningRatingState;
}

/** Which era each day belongs to, resolved once rather than per domain. */
function eraByDate(
  snapshots: ConfigSnapshotRecord[],
  dates: readonly DateKey[],
): BossEra[] {
  const eras: BossEra[] = [];
  let index = 0;
  let current: BossEra = { era: 'legacy' };
  for (const date of dates) {
    while (
      index < snapshots.length &&
      compareDateKeys(snapshots[index]!.effectiveFrom, date) <= 0
    ) {
      current = bossEraOf(snapshots[index]!.config);
      index += 1;
    }
    eras.push(current);
  }
  return eras;
}

/**
 * One domain's day states, taken from the already-scored history.
 *
 * A domain absent from a day's scores was not enabled then, and that day is
 * neutral for it — never a zero. That is what lets a user switch Running on
 * in June without June's ledger being dragged down by a spring it was not
 * asked about.
 */
function domainDayStates(
  history: History,
  domain: DomainType,
  p8Day: (date: DateKey) => boolean = () => false,
): DayState[] {
  return history.days.map((day, index) => {
    const paused = history.paused[index] === true;
    const entry = day.domains.find((candidate) => candidate.domain === domain);
    if (!entry) {
      return {
        date: day.date,
        status: 'neutral',
        score: null,
        recordedScore: null,
        dueItems: 0,
        answeredItems: 0,
        recorded: false,
        complete: false,
        paused,
      };
    }
    /*
     * P8 (D134): a training domain with nothing logged in a week that can
     * still take a session has no data on this day, whatever else the day
     * scored. Inheriting the day's 'scored' charged zero attendance for a
     * week whose Sunday could still be written — a charge the first session
     * of the week then took back. Decided per day, so the days lived under
     * P8 in the week the update lands in follow it too; a day before P8
     * keeps the old reading.
     */
    if (entry.score === null && p8Day(day.date)) {
      return {
        date: day.date,
        status: 'neutral',
        score: null,
        recordedScore: null,
        dueItems: entry.itemsDue,
        answeredItems: entry.itemsAnswered,
        recorded: false,
        complete: false,
        paused,
      };
    }
    /*
     * The day's own status is inherited rather than recomputed per domain: an
     * open day is one the user can still finish, and that is a property of the
     * day, not of one area of it. Inheriting it can only postpone a day being
     * counted, never bring it forward, so it cannot cost anyone anything.
     *
     * For a weekly-quota domain, `itemsAnswered` is the week's session count,
     * so a rest day inside a training week reads as recorded — which is the
     * point of a weekly target, and why it does not decay.
     */
    return {
      date: day.date,
      status: day.status,
      score: entry.score,
      recordedScore: entry.score,
      dueItems: entry.itemsDue,
      answeredItems: entry.itemsAnswered,
      recorded: entry.itemsAnswered > 0,
      complete: entry.itemsDue > 0 && entry.itemsAnswered >= entry.itemsDue,
      // Suspends the penalty for absence and nothing else. The two training
      // domains supply their own series and ignore this; Wellbeing and Food
      // fold through the general model, which reads it.
      paused,
    };
  });
}

/**
 * The first day a domain had anything of its own, and every day after it.
 *
 * A domain contributes to the Boss only from here. Before it, it has no
 * history — and it is not given one: an untouched ledger sits at the starting
 * rating, which is an arbitrary constant, not a performance the user earned.
 */
function startedByDay(days: readonly DayState[]): boolean[] {
  let started = false;
  return days.map((day) => {
    if (day.status === 'scored' && day.recorded) started = true;
    return started;
  });
}

export async function loadBossProgression(
  reference: DateKey = today(),
): Promise<BossProgression> {
  const origin = await progressionOrigin();
  const [legacy, snapshots] = await Promise.all([
    loadProgression(reference),
    configSnapshotsRepository.list(),
  ]);
  const history = legacy.history;
  const dates = history.days.map((day) => day.date);

  /*
   * Gym is replayed from its own sets before the ledgers are built, because
   * its rating is not the shared fold over day scores. Everything downstream
   * — the ladder position, the rank, the Boss — reads the result exactly as
   * it reads every other domain's.
   */
  const gymSessions = await gymSessionsRepository.getAll();
  const weekWindowOf = weekWindows(snapshots);
  const p8Day = (date: DateKey): boolean => isP8(snapshotOn(snapshots, date));
  const gymDayStates = domainDayStates(history, 'gym', p8Day);
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const gym = buildGymRating({
    history,
    dayStates: gymDayStates,
    snapshots,
    sessionDates: new Set(gymSessions.map((session) => session.date)),
    exerciseDays:
      firstDate && lastDate ? await loadExerciseDays(firstDate, lastDate) : [],
    reference,
  });

  /* Running is replayed from its runs the same way, and by the same shared
     scoring code once its own evidence has been reduced to a percentage. */
  const runs = await runsRepository.getAll();
  const runningDayStates = domainDayStates(history, 'running', p8Day);
  const running = buildRunningRating({
    history,
    dayStates: runningDayStates,
    snapshots,
    runDates: new Set(runs.map((entry) => entry.date)),
    runs: firstDate && lastDate ? await loadRunObservations(firstDate, lastDate) : [],
    reference,
  });

  /** The two training domains supply their own rating series; the rest fold. */
  const supplied: Partial<Record<DomainType, { state: GymRatingState | RunningRatingState; days: DayState[] }>> = {
    gym: { state: gym, days: gymDayStates },
    running: { state: running, days: runningDayStates },
  };

  const domains: DomainProgression[] = DOMAIN_TYPES.map((domain) => {
    const own = supplied[domain];
    const days = own ? own.days : domainDayStates(history, domain);
    const ledger = buildLedger({
      domain,
      days,
      ...(own
        ? {
            rating: {
              points: own.state.points,
              current: own.state.rating,
              peak: own.state.peak,
              currentStreak: 0,
              bestStreak: 0,
            },
          }
        : {}),
    });
    return {
      ...ledger,
      series: ledger.points.map((point) => ratingToProgress(point.rating)),
      active: startedByDay(days),
    };
  });

  const eras = eraByDate(snapshots, dates);
  const legacySeries = legacy.points.map((point) => ratingToProgress(point.rating));

  const series = bossSeries(
    dates.map((_, index): BossDayInput => ({
      era: eras[index] ?? { era: 'legacy' },
      legacyProgress: legacySeries[index] ?? null,
      domains: domains.map((domain) => ({
        domain: domain.domain,
        progress: domain.series[index] ?? 0,
        started: domain.active[index] ?? false,
      })),
    })),
  );
  const points = series.points;

  /*
   * The rank walk. Before the confirmation era was activated every point is
   * walked by the legacy rule; once it is, days before `from` still are —
   * verbatim, by the same function — and days from `from` on need a
   * confirmed promotion. Demotion is the same step in both (D126).
   */
  const settings = await settingsRepository.get();
  const activation = settings?.promotionConfirmation ?? null;
  const p8Settled = (date: DateKey): { settled?: boolean } => {
    const settled = daySettled(
      date,
      reference,
      snapshotOn(snapshots, date),
      weekWindowOf(date),
      weekTargetThrough(snapshots, date),
    );
    return settled === null ? {} : { settled };
  };
  const walk = activation
    ? confirmedRankHistory(
        points.map((point, index) => ({
          date: dates[index]!,
          rating: point.rating,
          scored: history.days[index]!.status === 'scored',
          paused: history.paused[index] === true,
          // P8 (D136): when a day may count, for either direction. Absent
          // before P8.
          ...p8Settled(dates[index]!),
        })),
        { from: activation.from, today: reference },
      )
    : { ...rankHistory(points.map((point, index) => ({ date: dates[index]!, rating: point.rating }))), pending: null };
  const ranks = walk;
  const confirmation = activation ? canonicalConfirmation(activation.from, walk.pending) : null;
  // The persisted set is what this replay says it is, and nothing else.
  if (confirmation) await reconcilePromotionConfirmation(confirmation);

  const peakRating = points.reduce((max, point) => Math.max(max, point.rating), 0);
  const last = points[points.length - 1];

  return {
    origin,
    points,
    transition: series.transition
      ? { ...series.transition, date: dates[series.transition.index]! }
      : null,
    progress: last?.progress ?? 0,
    rank: ranks.current,
    peakRank: ranks.peak.index >= ranks.current.index ? ranks.peak : rankForRating(peakRating),
    changes: ranks.changes,
    // One lifetime total, not four: XP answers "how much have I done", and
    // the answer to that question is not per domain.
    lifetimeXp: legacy.lifetimeXp,
    pending: walk.pending,
    confirmation,
    domains,
    era: last ? last.era : 'legacy',
    history,
    legacy,
    gym,
    running,
  };
}

export { BOSS_PROGRESS_MAX };
