import { TRAINING_RATING, RATING } from '../config/constants';
import type { DateKey } from '../dates';
import { applyAbstinenceDecay } from './abstinence';
import { decayTierFor, holdDecayTier, type DecayTier } from './decayTier';
import { attendanceScore, performanceScore, type PerformanceScore } from './performanceCurve';

/**
 * The Gym rating: **40 % attendance, 60 % personal development.**
 *
 * This is the decision phase 4 left open (D88), and the shape of it is worth
 * stating before the code, because two readings of "Gym rating" are possible
 * and only one of them is this app's:
 *
 * > A Gym rating is a statement about **the user against their own history**,
 * > never about the user against anyone else. Someone pressing 30 kg who
 * > trains three times a week and adds a rep a month outranks someone
 * > pressing 120 kg who turns up occasionally and has not moved in a year.
 * > Absolute strength is a real thing and it is not measured here — that is
 * > what Tombstones are for (D95).
 *
 * ```
 *   target = 0.40 × attendanceScore + 0.60 × performanceScore
 *   rating ← rating + (target − rating) × movementFactor(rating, target)
 * ```
 *
 * ## The pieces, and where each lives
 *
 * | Piece | Where |
 * |---|---|
 * | best set of the day | `performance.ts` (D84, unchanged) |
 * | effective load | `load.ts` |
 * | 70/30 muscle influence | `muscles.ts` |
 * | trend and year-to-date windows | `performance.ts` |
 * | change % → 0–1000 | `score.ts` |
 * | attendance → 0–1000 | `score.ts` |
 * | the fold below | here |
 * | first-promotion gate | `endurance.ts` |
 * | abstinence decay | `decay.ts` |
 */

/* ── Movement ───────────────────────────────────────────────────────────── */

/**
 * How much of the gap to the target one update closes.
 *
 * ```
 *   downward           BASE
 *   upward             BASE × min(1, (MAX − rating) / (MAX − FULL_SPEED_BELOW))
 * ```
 *
 * which with the approved numbers is 10 % of the gap at or below 500, and
 * then a straight line down to nothing at 1000: 6 % at 700, 2 % at 900.
 *
 * **This is the smallest function that satisfies the rule**, and each half of
 * it is there for a stated reason:
 *
 * - *Higher ratings are harder to climb.* Not because the performance is
 *   worth less — it is not, and that is the next point — but because the
 *   distance from Master to Champion should ask for more sustained evidence
 *   than the distance from Rookie to Challenger.
 * - *The Performance Score itself is never touched.* Two users who both
 *   improved 8 % get exactly the same Performance Score and the same target;
 *   what differs is how fast the rating walks towards it. A rank must never
 *   change what a performance is worth, only how long it takes to bank it.
 * - *Ordinary progression stays at the approved 10 %.* The scaling is 1
 *   throughout the lower two thirds of the scale rather than starting to bite
 *   immediately, so the moderate responsiveness that was approved is what a
 *   normal user actually experiences.
 * - *Falling is not slowed.* A high rating buys no protection from a decline;
 *   if it did, a rating could only ever ratchet upwards. Maintenance is the
 *   one rule that holds a rating up, it is explicit, and it has conditions.
 *
 * Monotone non-increasing in the rating, and the `min` meets at rating = 500
 * where both of its branches are 1.
 *
 * The *factor* does step where the target crosses the rating — a climb from
 * 900 moves at 2 % and a fall from 900 at 10 % — but **the movement it
 * produces does not**, because the step happens exactly where the gap it
 * multiplies is zero. `(target − rating) × factor` is continuous in both
 * arguments everywhere, which is the quantity the rating actually sees and
 * the one the tests assert.
 */
export function movementFactor(rating: number, target: number): number {
  const base = TRAINING_RATING.BASE_MOVEMENT;
  if (target < rating) return base;
  const headroom = RATING.MAX - TRAINING_RATING.MOVEMENT_FULL_SPEED_BELOW;
  const scale = headroom <= 0 ? 1 : Math.min(1, (RATING.MAX - rating) / headroom);
  return base * Math.max(0, scale);
}

/* ── The target ─────────────────────────────────────────────────────────── */

export interface TargetInput {
  /** 0–1000 from `min(sessions / target, 1)`. Always available. */
  attendance: number;
  /** 0–1000, or `null` before any valid same-exercise comparison exists. */
  performance: number | null;
}

/**
 * The target rating for one day.
 *
 * When performance is available this is the 40/60 blend. When it is not — a
 * first week, an exercise never repeated — the target is attendance **alone**,
 * not attendance plus a fabricated neutral 500 and not attendance plus a
 * zero. That is the app's existing available-score rule, the same one the
 * Wellbeing day score uses for a category nobody answered: a component with
 * no data leaves the denominator instead of contributing a number it did not
 * earn. Scoring the absence either way would be a claim about a user who has
 * simply not trained the same exercise twice yet.
 */
export function targetRating(input: TargetInput): number {
  if (input.performance === null) return clamp(input.attendance);
  return clamp(
    TRAINING_RATING.ATTENDANCE_WEIGHT * input.attendance +
      TRAINING_RATING.PERFORMANCE_WEIGHT * input.performance,
  );
}

/* ── Maintenance ────────────────────────────────────────────────────────── */

export interface MaintenanceInput {
  ageMonths: number;
  /** `sessions / target`, uncapped, so "fully met" can be told from "nearly". */
  attendanceFraction: number;
  /** The aggregate performance change in percent, or `null` if unavailable. */
  performanceChange: number | null;
  /** Whether there is enough history for "unchanged" to be a real statement. */
  sufficientHistory: boolean;
}

/**
 * The one-year Maintenance rule.
 *
 * After a year of training, holding steady is a legitimate outcome and not a
 * failure. Without this rule it would read as one: 0 % maps to 500, and a
 * user who has honestly earned 780 would be dragged towards 500 for ever by
 * doing exactly what they set out to do. "Improve every month or lose your
 * rank" is not a thing this app should say to someone in their second year.
 *
 * So when **all** of these hold —
 *
 * - Gym training age is at least twelve months;
 * - the week's attendance target is fully met;
 * - the aggregate performance is genuinely about zero rather than missing;
 * - there is enough performance history for that to mean something;
 *
 * — the target is not allowed to pull the rating **down**. It is a floor
 * under the target, nothing more, which is why the rule stays narrow:
 *
 * - positive performance still raises the rating, because the blended target
 *   is above the current rating on its own and the floor never applies;
 * - negative performance still lowers it, because the change is then outside
 *   the tolerance and the rule does not fire at all;
 * - missed attendance still lowers it, for the same reason;
 * - abstinence decay is untouched — it is not a target, and the month-13
 *   schedule applies to a maintaining user exactly as it does to anyone else.
 *
 * The tolerance is ±0.25 percentage points. Aggregating ratios across groups
 * leaves floating-point dust in the last few bits, which without a tolerance
 * would flick Maintenance on and off between two replays of identical data;
 * a quarter of a point is far below one rep or one micro-plate on any real
 * best set, so it can only ever absorb noise and never a change.
 */
export function maintenanceHolds(input: MaintenanceInput): boolean {
  return (
    input.ageMonths >= TRAINING_RATING.MAINTENANCE_MIN_MONTHS &&
    input.attendanceFraction >= 1 &&
    input.sufficientHistory &&
    input.performanceChange !== null &&
    Math.abs(input.performanceChange) <= TRAINING_RATING.MAINTENANCE_TOLERANCE_PERCENT
  );
}

/* ── The fold ───────────────────────────────────────────────────────────── */

export interface TrainingRatingDay {
  date: DateKey;
  /**
   * Whether this day counts at all. A day before Gym was enabled, or one
   * still inside its edit window, is neither a success nor a failure.
   */
  scored: boolean;
  /** Sessions logged in the week this day belongs to, and the week's target. */
  sessionsInWeek: number;
  weeklyTarget: number;
  /** Whether a session was saved on this exact day — what ends abstinence. */
  sessionToday: boolean;
  /** The two performance windows as of this day, already computed. */
  performance: PerformanceScore;
  /** The aggregate change in percent, for Maintenance. `null` if unavailable. */
  performanceChange: number | null;
  /** Consecutive days with no saved session, ending on this day. */
  abstinentDays: number;
  /**
   * Whether the day fell inside a declared pause.
   *
   * An **exception layer around** the abstinence rule, never a change to it.
   * The approved arithmetic in `abstinence.ts` is untouched: what a pause
   * does is stop the clock that feeds it. A paused day contributes no day to
   * `abstinentDays` (the caller freezes the run) and triggers no decay, and
   * it does not reset the count either — five silent days, a fortnight
   * paused, and the next silent day is the sixth.
   *
   * It is not attendance either. A paused day is not a saved session and
   * earns no attendance credit: the week's session count, the met flag and
   * every screen that reads them are untouched.
   *
   * What it does instead is **decline to score the day at all** when the
   * week has no sessions in it — the same "no data" the app already gives a
   * day before the domain was enabled. Suppressing only the decay would have
   * been strictly worse than no pause at all: the decay branch is
   * tier-floored, the ordinary target is not, so a paused week of zero
   * attendance would drag the rating towards zero while an unpaused one
   * stopped at the floor. Measured before this rule existed: 899 → 98 paused
   * against 899 → 560 unpaused. A pause that punishes is not a pause.
   *
   * A week the user *did* train in scores normally, pause or no pause. That
   * is decision 5 — a pause protects against what was not done, never
   * against what was.
   */
  paused?: boolean;
  /**
   * P8 (D135): a session can still be written for this day. If the
   * abstinence rule would decay it, the day is carried instead — no decay
   * and no gap step, never both (D96) — and the charge lands once the day
   * can no longer be backfilled. Absent on every day of a week before P8,
   * which keeps the rule it was lived under.
   */
  open?: boolean;
  /** Gym training age in whole months on this day. */
  ageMonths: number;
  /** True once the Endurance Phase has been completed, on this day. */
  enduranceUnlocked: boolean;
}

export interface TrainingRatingPoint {
  date: DateKey;
  rating: number;
  /** Where the rating was heading. `null` on a day that did not count. */
  target: number | null;
  attendance: number;
  performance: number | null;
  movement: number;
  /** Share of the baseline tier progress removed today, 0 to 1. */
  decayFraction: number;
  /** True when this day's rating was set by decay rather than by movement. */
  decaying: boolean;
  maintenance: boolean;
  skipped: boolean;
}

export interface TrainingRatingResult {
  points: TrainingRatingPoint[];
  current: number;
  peak: number;
}

const clamp = (value: number) => Math.min(RATING.MAX, Math.max(RATING.MIN, value));

/**
 * The rating, replayed day by day. Nothing here is stored.
 *
 * One update per scored day, which is the cadence the rest of the app already
 * folds at. At 10 % of the gap a day, a week of steady training closes a
 * little over half of it — gradual, as required, and quick enough that a
 * user can see their own effort land.
 *
 * ## Absence is handled once, not twice
 *
 * A week with fewer sessions than the target already lowers Attendance, and
 * that is a real result which lowers the rating through the ordinary target.
 * Once an absence reaches seven days it becomes an *abstinence episode*, and
 * from that day the rating is set by the decay schedule computed from the
 * rating, and the tier, held when the episode began — the gap movement does
 * not also run.
 * Charging for the same absence through two mechanisms is exactly the double
 * penalty the decay rule was written to avoid, and it is why decay reads its
 * baseline once and then recomputes from it rather than eating the remainder.
 */
export interface TrainingRatingOptions {
  /**
   * The rating to continue from.
   *
   * Set when the days handed in are the tail of a longer history whose
   * earlier part was scored under the previous Gym model. The new model
   * carries on from exactly the number the old one left, so the day the
   * change lands moves the rating by an ordinary step and not by a jump —
   * the same continuity rule the Boss follows across its own era boundary
   * (D68a). An upgrade must neither create progress nor take it away.
   */
  start?: number;
  /** The peak already reached before those days, which can never fall. */
  peak?: number;
}

export function computeTrainingRating(
  days: readonly TrainingRatingDay[],
  options: TrainingRatingOptions = {},
): TrainingRatingResult {
  const points: TrainingRatingPoint[] = [];
  let rating: number = options.start ?? RATING.START;
  let peak: number = Math.max(options.peak ?? RATING.START, rating);

  /** Captured once when an episode starts, and left alone until it ends. */
  let episode: { rating: number; tier: DecayTier; ageMonths: number } | null = null;
  /**
   * The decay tier held so far — the ladder interval the rating last
   * cleared, kept with hysteresis so an episode is measured in a stable
   * interval rather than whichever one today's rating happens to sit in.
   * Internal to the fold: it is not a rank, it is never shown, and nothing
   * is promoted or demoted by it (`decayTier.ts`).
   */
  let heldTier: DecayTier | null = null;
  /** The episode's share removed so far, which a carried day reports unchanged. */
  let carriedFraction = 0;

  for (const day of days) {
    // Any saved session ends the episode immediately. What was lost stays
    // lost — the user rebuilds it through attendance and performance.
    if (day.sessionToday) episode = null;

    /*
     * Decay is judged before the day's own status, and deliberately.
     *
     * A week with nothing logged in it yet has no *score* — a week still
     * running cannot have missed its target, so the day is neutral. That rule
     * is right and stays, but it describes the day score, not the clock: an
     * abstinence episode is seven days with no saved session, and those seven
     * days are precisely the ones a running empty week is made of. Requiring
     * a scored day here would have meant the schedule never ran during the
     * only week it was written for.
     */
    const decaying =
      day.enduranceUnlocked &&
      !day.sessionToday &&
      day.paused !== true &&
      day.abstinentDays >= TRAINING_RATING.ABSTINENCE_BLOCK_DAYS;

    /*
     * A day that would decay but can still receive a session is carried:
     * charging it now is a charge a backfill of that very day would take
     * back (D135). The episode does not begin, and nothing moves, until the
     * day closes — then the replay charges it, once, for good.
     */
    if (decaying && day.open === true) {
      points.push({
        date: day.date,
        rating,
        target: null,
        attendance: 0,
        performance: null,
        movement: 0,
        decayFraction: carriedFraction,
        decaying: false,
        maintenance: false,
        skipped: true,
      });
      continue;
    }

    if (!day.scored && !decaying) {
      points.push({
        date: day.date,
        rating,
        target: null,
        attendance: 0,
        performance: null,
        movement: 0,
        decayFraction: 0,
        decaying: false,
        maintenance: false,
        skipped: true,
      });
      continue;
    }

    const attendance = attendanceScore(day.sessionsInWeek, day.weeklyTarget);
    const performance = day.performance.score;

    let target: number | null = null;
    let movement = 0;
    let decayFraction = 0;
    let maintenance = false;

    if (decaying) {
      // A fresh episode takes its baseline from the rating held on the day it
      // began, not from whatever the decay has since left behind.
      if (episode === null) {
        episode = {
          rating,
          tier: heldTier ?? decayTierFor(rating),
          ageMonths: day.ageMonths,
        };
      }
      const result = applyAbstinenceDecay({
        baselineRating: episode.rating,
        baselineTier: episode.tier,
        days: day.abstinentDays,
        ageMonths: episode.ageMonths,
      });
      decayFraction = result.fraction;
      carriedFraction = result.fraction;
      rating = clamp(result.rating);
    } else {
      carriedFraction = 0;
      if (!day.sessionToday && day.abstinentDays === 0) episode = null;
      target = targetRating({ attendance, performance });
      if (
        maintenanceHolds({
          ageMonths: day.ageMonths,
          attendanceFraction: day.sessionsInWeek / Math.max(1, day.weeklyTarget),
          performanceChange: day.performanceChange,
          sufficientHistory: day.performance.components.length >= 2,
        })
      ) {
        maintenance = true;
        target = Math.max(target, rating);
      }
      /*
       * A paused day's target may raise the rating but never lower it.
       *
       * Without this, training *some* during a pause was far worse than
       * training none: a week with one session of two is 50 % attendance,
       * and attendance is a measure of the absence the pause exists to
       * excuse. Measured over a 28-day pause from 899.58 — logging nothing
       * held 899.58, logging one session a week gave 520.91, and logging the
       * full target gave 936.10. Honest partial effort cost 378 points and a
       * rank, which is D35's failure mode ("reporting must never cost more
       * than silence") reappearing inside this feature.
       *
       * The floor is deliberately one-sided. Real work still counts: train
       * well through a pause and the rating climbs, because a pause protects
       * against what was not done and never against what was.
       *
       * Wellbeing and Food get no such floor, and should not: there a low
       * day is a *reported result*, not a measure of absence.
       */
      if (day.paused === true) target = Math.max(target, rating);
      movement = movementFactor(rating, target);
      rating = clamp(rating + (target - rating) * movement);
    }

    heldTier = holdDecayTier(rating, heldTier);
    peak = Math.max(peak, rating);

    points.push({
      date: day.date,
      rating,
      target,
      attendance,
      performance,
      movement,
      decayFraction,
      decaying,
      maintenance,
      skipped: false,
    });
  }

  const last = points[points.length - 1];
  return { points, current: last ? last.rating : RATING.START, peak };
}

export { performanceScore };
