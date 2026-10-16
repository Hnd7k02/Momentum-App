import { useCallback } from 'react';
import { today } from '../../core/clock';
import type { AnswerValue, StoredDomainType } from '../../core/model';
import { useLoadable, type Loadable } from '../../app/useLoadable';
import {
  clearAnswer,
  deleteSession,
  loadDay,
  logSession,
  saveAnswer,
  updateSession,
  type DayView,
  type SessionInput,
} from '../../storage/services/checkInService';

export type DayState = Loadable<DayView>;

/**
 * The Today screen's connection to storage.
 *
 * Writes go through the check-in service, which owns the one write rule —
 * today and yesterday (D133) — and each write is followed by a reload so what is on
 * screen is what is on disk. The interaction is small enough that this costs
 * nothing and removes a whole class of drift.
 *
 * A reload that fails after the day is already on screen does not take the
 * day down with it: the loader keeps the last good view and marks it stale,
 * so a lost write is reported without the screen emptying under the user.
 */
export function useDay(date: string = today()) {
  const load = useCallback(() => loadDay(date), [date]);
  // A new day is a new load (WP3, B3). Until it arrives the view still holds
  // the old one, and `state.value.date` says so — Today checks it before it
  // offers a single control.
  const { state, reload } = useLoadable(load, [date]);

  const run = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T | undefined> => {
      try {
        const result = await operation();
        await reload();
        return result;
      } catch (error: unknown) {
        // A rejected write means a rule refused it — a day that can no
        // longer be written. Reloading puts the screen back on the truth.
        console.warn('Check-in write refused', error);
        await reload();
        return undefined;
      }
    },
    [reload],
  );

  return {
    state,
    answer: (questionId: string, value: AnswerValue | null) =>
      run<unknown>(() =>
        value === null ? clearAnswer(date, questionId) : saveAnswer(date, questionId, value),
      ),
    logSession: (domain: StoredDomainType) => run(() => logSession(domain, date)),
    /** `true` once saved; `undefined` when a rule refused it (a closed day). */
    updateSession: (domain: StoredDomainType, id: string, input: SessionInput) =>
      run(async () => {
        await updateSession(domain, id, input);
        return true as const;
      }),
    /** `true` once deleted; `undefined` when a rule refused it (a closed day). */
    deleteSession: (domain: StoredDomainType, id: string) =>
      run(async () => {
        await deleteSession(domain, id);
        return true as const;
      }),
    reload,
  };
}
