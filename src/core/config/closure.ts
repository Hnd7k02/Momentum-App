import { weeklyTargetsIn } from '../domains';
import {
  addDays,
  compareDateKeys,
  dayEditState,
  diffInDays,
  endOfWeek,
  isSameWeek,
  startOfWeek,
  type DateKey,
} from '../dates';
import type { AppConfigSnapshot, ConfigSnapshotRecord } from '../model';
import { LEGACY_EDIT_WINDOW_DAYS } from './constants';

/**
 * When a day or a week stops being writable, and so when it may be charged
 * (WP3 Stage 3, P8 — D132).
 *
 * One principle: **a day or week is judged only once nothing can be written
 * into it any more**, so no legal backfill can reverse a charge. Everything
 * here is read from the snapshots, per era, because the window decides what
 * counts as missed and is therefore scoring configuration (CLAUDE.md):
 *
 * - A **day** closes after the window of its own snapshot
 *   (`scoring.editWindowDays`): 3 for every day lived before P8, 1 from it.
 * - A **week** belongs to the era of the snapshot in force on its Monday —
 *   where its target already comes from (D127) — and stays in progress until
 *   its Sunday plus that era's session window has passed: Sunday midnight
 *   before P8, Monday midnight in P8, since a Sunday session may be written
 *   on Monday.
 * - **Writes** follow one rule: today or yesterday, on a day of the P8 era;
 *   for sessions also in a week whose Sunday is still writable. So every write
 *   lands on a day and in a week that are still open, and a day lived before
 *   the update is never reopened by it.
 *
 * Pure: snapshots and dates in, answers out.
 */

/** The snapshot in force on `date`, or `null` before the first one. */
export function snapshotOn(
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
 * The day window a day was lived under. A snapshot without the field — every
 * snapshot is written with it, but a restored file is not validated — reads
 * as the legacy 3, never as today's window.
 */
export function editWindowOf(config: AppConfigSnapshot | null | undefined): number {
  return config?.scoring.editWindowDays ?? LEGACY_EDIT_WINDOW_DAYS;
}

/** The session window a snapshot carries, or `null` for the era before P8. */
export function sessionWindowOf(config: AppConfigSnapshot | null | undefined): number | null {
  return config?.scoring.sessionWindowDays ?? null;
}

/** Whether a snapshot belongs to the P8 era. */
export function isP8(config: AppConfigSnapshot | null | undefined): boolean {
  return sessionWindowOf(config) !== null;
}

/**
 * The snapshot a week's rules come from: the one in force on its Monday, or —
 * for the week a profile was created in, whose Monday predates every
 * snapshot — the first one that took effect inside it.
 *
 * Monday, not Sunday: keyed on Sunday, the week the update lands in would
 * take the P8 rules for its days lived before the update, and those days
 * would replay differently from how they were shown.
 */
export function weekSnapshot(
  snapshots: readonly ConfigSnapshotRecord[],
  date: DateKey,
): AppConfigSnapshot | null {
  const monday = startOfWeek(date);
  const atMonday = snapshotOn(snapshots, monday);
  if (atMonday) return atMonday;
  const sunday = addDays(monday, 6);
  const first = snapshots.find(
    (snapshot) =>
      compareDateKeys(snapshot.effectiveFrom, monday) >= 0 &&
      compareDateKeys(snapshot.effectiveFrom, sunday) <= 0,
  );
  return first?.config ?? null;
}

/** Each week's session window, memoised per Monday for a whole replay. */
export function weekWindows(
  snapshots: readonly ConfigSnapshotRecord[],
): (date: DateKey) => number | null {
  const cache = new Map<DateKey, number | null>();
  return (date) => {
    const monday = startOfWeek(date);
    const cached = cache.get(monday);
    if (cached !== undefined || cache.has(monday)) return cached ?? null;
    const value = sessionWindowOf(weekSnapshot(snapshots, monday));
    cache.set(monday, value);
    return value;
  };
}

/**
 * Whether `date`'s week is still in progress: until its Sunday plus the
 * week's session window has passed (0 before P8).
 */
export function weekInProgress(date: DateKey, reference: DateKey, weekWindow: number | null): boolean {
  return compareDateKeys(addDays(endOfWeek(date), weekWindow ?? 0), reference) >= 0;
}

/**
 * Whether a check-in answer or a Food rating may be written for `date`: today
 * or yesterday, on a day of the P8 era. A day lived before the update keeps
 * its own window for scoring but is not reopened for writing.
 */
export function checkInWritable(
  date: DateKey,
  today: DateKey,
  dayConfig: AppConfigSnapshot | null | undefined,
): boolean {
  if (!isP8(dayConfig)) return false;
  return dayEditState(date, today, editWindowOf(dayConfig)) === 'open';
}

/**
 * Whether a session, set, run or weight entry may be written for `date`:
 * today or yesterday, on a day of the P8 era, and in a week that is still in
 * progress — for a week that began before P8, that is its own ISO week.
 */
export function sessionWritable(
  date: DateKey,
  today: DateKey,
  dayConfig: AppConfigSnapshot | null | undefined,
  weekWindow: number | null,
): boolean {
  const window = sessionWindowOf(dayConfig);
  if (window === null) return false;
  const age = diffInDays(date, today);
  if (age < 0 || age > window) return false;
  return weekWindow === null ? isSameWeek(date, today) : age <= weekWindow;
}

/**
 * Whether a P8 day can no longer be written in any way — the moment it may be
 * charged as missed, and when it counts for the demotion counter. `null` for
 * a day before P8, which keeps the rules it was lived under.
 */
export function dayClosed(
  date: DateKey,
  reference: DateKey,
  dayConfig: AppConfigSnapshot | null | undefined,
  weekWindow: number | null,
): boolean | null {
  if (!isP8(dayConfig)) return null;
  if (compareDateKeys(date, reference) >= 0) return false;
  return (
    dayEditState(date, reference, editWindowOf(dayConfig)) === 'closed' &&
    !sessionWritable(date, reference, dayConfig, weekWindow)
  );
}

/**
 * Whether a P8 day is settled: closed, and — if it carries a weekly target —
 * its week judged too. Until then a training day's attendance still counts as
 * met (D134), so its rating is not final and a promotion may not count it
 * (D136). `null` for a day before P8.
 */
export function daySettled(
  date: DateKey,
  reference: DateKey,
  dayConfig: AppConfigSnapshot | null | undefined,
  weekWindow: number | null,
): boolean | null {
  const closed = dayClosed(date, reference, dayConfig, weekWindow);
  if (closed !== true) return closed;
  const hasWeeklyTarget = dayConfig ? weeklyTargetsIn(dayConfig).length > 0 : false;
  return !hasWeeklyTarget || !weekInProgress(date, reference, weekWindow);
}

/**
 * Whether a session could still be written for a day of a P8 week. On such a
 * day an abstinence step that would decay is carried instead (D135). `false`
 * for a week before P8, which keeps the rule it was lived under.
 */
export function sessionDayOpen(date: DateKey, reference: DateKey, weekWindow: number | null): boolean {
  if (weekWindow === null) return false;
  const age = diffInDays(date, reference);
  return age >= 0 && age <= weekWindow;
}
