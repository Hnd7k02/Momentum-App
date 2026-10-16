import {
  RANK_DEMOTION_SUSTAIN_DAYS,
  RANK_PROMOTION_CONFIRMATION_DAYS,
  type RankId,
} from '../config/constants';
import { compareDateKeys, type DateKey } from '../dates';
import type { PromotionConfirmationState } from '../model';
import {
  newRankWalk,
  nextRank,
  rankById,
  rankForRating,
  rankWalkDemotionStep,
  rankWalkStep,
  type Rank,
  type RankChange,
} from './index';

/**
 * Boss promotion confirmation (D126).
 *
 * Two eras, and the join between them is the whole design:
 *
 * - **Before `from`** every point is walked by the legacy rule, unchanged —
 *   the same function, the same immediate promotion, the same sustained
 *   demotion — so a rank a user already held on the activation day is the
 *   rank they keep. The activation day itself is legacy on purpose.
 * - **From `from` on** a promotion has to be *confirmed*: the next rank is
 *   awarded only once the rating has been at or above its threshold on
 *   `RANK_PROMOTION_CONFIRMATION_DAYS` eligible days in a row. A day is
 *   eligible when it was scored, was not paused, and is final: strictly
 *   before today for a day lived before P8, **settled** for a day of the P8
 *   era (D136) — closed, and its week judged if that week carried a weekly
 *   target up to it. Everything else — today, an open day, a day of a week
 *   not yet judged, a neutral day, a paused day — is transparent: it neither
 *   counts nor resets. A scored day below the threshold resets the count to
 *   nothing.
 *
 * One target at a time. The dates collected for one rank can never confirm
 * another, a rating already two thresholds up still advances one rank per
 * confirmation, and each promotion starts the next target from zero.
 *
 * **Demotion keeps its step.** The new walk runs the same demotion step the
 * legacy walk runs, with the counter carried across the boundary: on every
 * point lived before P8, today's and unscored ones included, and on a P8 day
 * only once it is settled (D136) — a demotion counted on a day whose week can
 * still take a session could be taken back by that session. The confirmation
 * rule replaces the promotion branch and nothing else.
 *
 * Pure. Same days, same boundary, same today: same result, byte for byte.
 */

export interface ConfirmationDay {
  date: DateKey;
  /** The Boss rating on this day. */
  rating: number;
  /** `history.days[i].status === 'scored'`: the day was evaluated. */
  scored: boolean;
  paused: boolean;
  /**
   * P8 (D136), absent on a day before P8: nothing about the day can be
   * written any more and, if its week carried a weekly target up to it, that
   * week has been judged — so its rating and the Boss on it are final. Only
   * such a day counts towards a promotion or moves the demotion counter.
   */
  settled?: boolean;
}

export interface PendingConfirmation {
  targetRankId: RankId;
  /** Ascending, unique: the fold visits each day once. */
  eligibleDates: DateKey[];
  required: number;
}

export interface ConfirmedRankHistory {
  changes: RankChange[];
  current: Rank;
  peak: Rank;
  /** `null` at the top of the ladder. */
  pending: PendingConfirmation | null;
  /** How many leading points were walked by the legacy rule. */
  legacyPoints: number;
}

export interface ConfirmationOptions {
  /** First day of the confirmation era. */
  from: DateKey;
  /**
   * The current local day. A day lived before P8 counts only when strictly
   * before it; a P8 day by its `settled` flag.
   */
  today: DateKey;
  required?: number;
  sustainDays?: number;
}

export function confirmedRankHistory(
  days: readonly ConfirmationDay[],
  options: ConfirmationOptions,
): ConfirmedRankHistory {
  const required = options.required ?? RANK_PROMOTION_CONFIRMATION_DAYS;
  const sustainDays = options.sustainDays ?? RANK_DEMOTION_SUSTAIN_DAYS;
  const state = newRankWalk();

  const split = days.findIndex((day) => compareDateKeys(day.date, options.from) >= 0);
  const legacyPoints = split === -1 ? days.length : split;

  // The legacy prefix, exactly as rankHistory() walks it.
  for (let index = 0; index < legacyPoints; index += 1) {
    rankWalkStep(state, days[index]!, true, sustainDays);
  }

  let target: Rank | null = state.current ? nextRank(state.current) : null;
  let eligible: DateKey[] = [];
  const retarget = () => {
    target = state.current ? nextRank(state.current) : null;
    eligible = [];
  };

  for (let index = legacyPoints; index < days.length; index += 1) {
    const day = days[index]!;

    if (state.current === null) {
      // No legacy prefix at all — a profile created under the confirmation
      // rule. There is no earned standing to keep, so it opens at the bottom
      // of the ladder and confirms every rank from there; a rating already
      // past a threshold on day one shows 0/7 rather than a rank it has not
      // held for seven days. (A legacy prefix opens where its rating is, as
      // it always did — that is rankWalkStep's own opening.)
      state.current = rankById('rookie');
      state.peak = state.current;
      retarget();
      // And the day itself is evaluated like any other: once it is past, a
      // first day at or above the first threshold is the first of seven.
    }

    const before = state.current;
    const natural = rankForRating(day.rating);
    // Before P8: strictly before today. From P8: once its rating is final.
    const past = day.settled ?? compareDateKeys(day.date, options.today) < 0;
    const eligibleDay = past && !day.paused && day.scored;

    let promoted = false;
    if (eligibleDay && target !== null) {
      if (day.rating >= target.min) {
        // A set: the fold visits each day once, and this guards it anyway.
        if (!eligible.includes(day.date)) eligible.push(day.date);
        if (eligible.length >= required) {
          const duplicate = state.changes.some(
            (change) =>
              change.kind === 'promotion' && change.to === target!.id && change.date === day.date,
          );
          if (!duplicate) {
            state.changes.push({
              date: day.date,
              kind: 'promotion',
              from: state.current.id,
              to: target.id,
              rating: day.rating,
            });
          }
          state.current = target;
          state.daysBelow = 0;
          promoted = true;
          retarget();
        }
      } else {
        eligible = [];
      }
    }

    // The demotion step, on every point that did not confirm — exactly the
    // legacy walk's, with its counter carried in from the prefix. From P8 a
    // day that is not settled is transparent to it (D136): a dip that a
    // write into its day or its week could still lift never counts.
    if (!promoted && day.settled !== false) rankWalkDemotionStep(state, day, natural, sustainDays);
    if (state.current !== before && !promoted) retarget();

    if (state.current.index > state.peak.index) state.peak = state.current;
  }

  return {
    changes: state.changes,
    current: state.current ?? rankById('rookie'),
    peak: state.peak,
    pending: target
      ? { targetRankId: (target as Rank).id, eligibleDates: [...eligible], required }
      : null,
    legacyPoints,
  };
}

/**
 * The persisted shape, in one fixed key order with the dates sorted and
 * deduplicated — so the same canonical state always serialises to the same
 * bytes, whichever path produced it.
 */
export function canonicalConfirmation(
  from: DateKey,
  pending: PendingConfirmation | null,
): PromotionConfirmationState {
  const dates = [...new Set(pending?.eligibleDates ?? [])].sort(compareDateKeys);
  return {
    from,
    targetRankId: pending?.targetRankId ?? null,
    eligibleDates: dates,
  };
}

export function serialiseConfirmation(state: PromotionConfirmationState): string {
  return JSON.stringify(canonicalConfirmation(state.from, state.targetRankId
    ? { targetRankId: state.targetRankId, eligibleDates: state.eligibleDates, required: RANK_PROMOTION_CONFIRMATION_DAYS }
    : null));
}

/**
 * Whether the distance caption should stop counting.
 *
 * "Noch 0 bis Veteran" is true and misleading once the threshold has been
 * reached and the rank is merely waiting to be confirmed; the caption says
 * the threshold is reached instead, and the indicator carries the count.
 * Below the threshold the numeric distance stays, even while dates are
 * pending, because there is a real distance to state again.
 */
export function thresholdReached(rating: number, pending: PendingConfirmation | null): boolean {
  if (!pending) return false;
  return rating >= rankById(pending.targetRankId).min;
}

export interface ConfirmationIndicator {
  targetRankId: RankId;
  count: number;
  required: number;
}

/**
 * What the screen says, if anything.
 *
 * Shown as soon as a promotion is pending — the rating has reached the next
 * threshold, or qualifying days are already on record — so a user who has
 * just crossed a threshold sees why nothing happened yet. Not shown merely
 * because a next rank exists.
 */
export function confirmationIndicator(
  rating: number,
  pending: PendingConfirmation | null,
): ConfirmationIndicator | null {
  if (!pending) return null;
  const target = rankById(pending.targetRankId);
  if (pending.eligibleDates.length === 0 && rating < target.min) return null;
  return {
    targetRankId: pending.targetRankId,
    count: pending.eligibleDates.length,
    required: pending.required,
  };
}
