import { describe, expect, it } from 'vitest';
import { addDays, dayEditState, diffInDays, startOfWeek, type DateKey } from '../dates';
import type { AppConfigSnapshot, ConfigSnapshotRecord } from '../model';
import {
  checkInWritable,
  dayClosed,
  daySettled,
  editWindowOf,
  sessionWritable,
  snapshotOn,
  weekInProgress,
  weekTargetThrough,
  weekWindows,
} from './closure';

/**
 * The closure the one write rule guarantees, checked exhaustively
 * (WP3, P8 — D132, D133).
 *
 * A profile lived under the rules before P8 from 5 January 2026 and is
 * updated on each weekday in turn. For every reference day from the update
 * to eight weeks after it, and every day from two weeks back to tomorrow:
 *
 * - every write lands on a day that is still open, and every session write
 *   in a week still in progress — so nothing written can reverse a charge;
 * - only today and yesterday are ever writable, a day lived before the
 *   update never is, and a day once closed to writes stays closed;
 * - a day once closed, or settled, stays so;
 * - and the rule is live: today and yesterday of the P8 era can be written,
 *   for sessions too unless yesterday is the Sunday of a week that began
 *   before the update.
 */

const ORIGIN = '2026-01-05' as DateKey; // a Monday

function config(era: 'legacy' | 'p8'): AppConfigSnapshot {
  return {
    domains: [
      { id: 'd-mental', type: 'mental', enabled: true, settings: {} },
      { id: 'd-gym', type: 'gym', enabled: true, settings: { targetPerWeek: 3 } },
    ],
    questions: [],
    scoring:
      era === 'legacy'
        ? { editWindowDays: 3, scaleMin: 1, scaleMax: 10 }
        : { editWindowDays: 1, scaleMin: 1, scaleMax: 10, sessionWindowDays: 1 },
  } as AppConfigSnapshot;
}

function profile(update: DateKey): ConfigSnapshotRecord[] {
  return [
    { id: 's-legacy', effectiveFrom: ORIGIN, createdAt: '', config: config('legacy') },
    { id: 's-p8', effectiveFrom: update, createdAt: '', config: config('p8') },
  ];
}

const range = (from: DateKey, days: number): DateKey[] =>
  Array.from({ length: days }, (_, offset) => addDays(from, offset));

/** One update per weekday, three weeks after the origin. */
const UPDATES = range(addDays(ORIGIN, 21), 7);

describe('the write rule closes behind itself (D133)', () => {
  for (const update of UPDATES) {
    it(`with the update on ${update}`, () => {
      const snapshots = profile(update);
      const weekWindowOf = weekWindows(snapshots);
      const at = (date: DateKey) => snapshotOn(snapshots, date);
      const checkIn = (date: DateKey, reference: DateKey) => checkInWritable(date, reference, at(date));
      const session = (date: DateKey, reference: DateKey) =>
        sessionWritable(date, reference, at(date), weekWindowOf(date));
      const closed = (date: DateKey, reference: DateKey) =>
        dayClosed(date, reference, at(date), weekWindowOf(date));
      const settled = (date: DateKey, reference: DateKey) =>
        daySettled(date, reference, at(date), weekWindowOf(date), weekTargetThrough(snapshots, date));

      let checked = 0;
      for (const reference of range(update, 57)) {
        for (const date of range(addDays(reference, -14), 16)) {
          const age = diffInDays(date, reference);
          const p8Day = date >= update;
          const canCheckIn = checkIn(date, reference);
          const canSession = session(date, reference);

          // Writes land only on open days, and session writes only in weeks
          // still in progress.
          if (canCheckIn) {
            expect(dayEditState(date, reference, editWindowOf(at(date)))).toBe('open');
            expect(closed(date, reference)).toBe(false);
          }
          if (canSession) {
            expect(weekInProgress(date, reference, weekWindowOf(date))).toBe(true);
            expect(closed(date, reference)).toBe(false);
            expect(settled(date, reference)).toBe(false);
          }

          // Only today and yesterday, never a day lived before the update.
          if (canCheckIn || canSession) {
            expect(age >= 0 && age <= 1, `${date} at ${reference}`).toBe(true);
            expect(p8Day).toBe(true);
          }

          // Live: today and yesterday of the P8 era are open for the check-in,
          // and for sessions unless yesterday closed with a pre-P8 week.
          if (p8Day && age >= 0 && age <= 1) {
            expect(canCheckIn, `${date} at ${reference}`).toBe(true);
            const straddling = weekWindowOf(date) === null && startOfWeek(date) !== startOfWeek(reference);
            expect(canSession, `${date} at ${reference}`).toBe(!straddling);
          }

          // What is closed — to writes, to charges — stays closed.
          const next = addDays(reference, 1);
          if (!canCheckIn && age >= 0) expect(checkIn(date, next)).toBe(false);
          if (!canSession && age >= 0) expect(session(date, next)).toBe(false);
          if (closed(date, reference) === true) expect(closed(date, next)).toBe(true);
          if (settled(date, reference) === true) expect(settled(date, next)).toBe(true);

          // A day lived before the update keeps the rules it was lived by.
          if (!p8Day) {
            expect(closed(date, reference)).toBeNull();
            expect(settled(date, reference)).toBeNull();
          }
          checked += 1;
        }
      }
      expect(checked).toBe(57 * 16);
    });
  }

  it('closes a P8 day two days on, and judges its week the Tuesday after', () => {
    const snapshots = profile(ORIGIN);
    const weekWindowOf = weekWindows(snapshots);
    const wednesday = addDays(ORIGIN, 2);
    const at = (reference: DateKey) => ({
      closed: dayClosed(wednesday, reference, snapshotOn(snapshots, wednesday), weekWindowOf(wednesday)),
      settled: daySettled(
        wednesday,
        reference,
        snapshotOn(snapshots, wednesday),
        weekWindowOf(wednesday),
        weekTargetThrough(snapshots, wednesday),
      ),
    });
    expect(at(addDays(wednesday, 1))).toEqual({ closed: false, settled: false });
    expect(at(addDays(wednesday, 2))).toEqual({ closed: true, settled: false });
    // Sunday, Monday: the week can still take Sunday's session.
    expect(at(addDays(ORIGIN, 7))).toEqual({ closed: true, settled: false });
    expect(at(addDays(ORIGIN, 8))).toEqual({ closed: true, settled: true });
  });
});
