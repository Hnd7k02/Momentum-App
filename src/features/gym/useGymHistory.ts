import { useCallback } from 'react';
import { addDays, type DateKey } from '../../core/dates';
import { useLoadable } from '../../app/useLoadable';
import { useDataVersion } from '../../app/useDataVersion';
import { useToday } from '../../app/useToday';
import { latestGymSession, loadGymHistory, type GymHistory } from '../../storage/services/gymService';

/**
 * Gym's replay, over the range a screen is showing.
 *
 * Separate from `useProgression` because it is a different question answered
 * from different rows: the progression replays day scores, and Gym replays
 * sets. Loading it here rather than folding it into the progression keeps a
 * failure in one from emptying the other.
 *
 * It loads again when the range changes, when the day turns and after any
 * committed write (WP3, B2). It used to load once, so the 7- and 30-day views
 * showed the same numbers and a finished workout did not reach them.
 *
 * Loading is told apart from "nothing arrived" and from a load that failed:
 * a screen holds its layout while the replay is on its way (contract §11),
 * says so when it could not be loaded, and must not keep holding the layout
 * for a failure.
 *
 * With the history comes one stored fact the range cannot hold: the day of
 * the latest Gym session of all. A range with nothing in it means "never
 * trained" only when that is `null`; otherwise the screen says when the
 * last session was (`muscleGap`). Both are read in one load, so the screen
 * never shows the one without the other.
 */
export function useGymHistoryState(rangeDays: number): {
  history: GymHistory | null;
  /** The day of the most recent Gym session, `null` before the first. */
  latestSession: DateKey | null;
  loading: boolean;
  failed: boolean;
  reload(): Promise<void>;
} {
  const to = useToday();
  const version = useDataVersion();
  const load = useCallback(
    async () => {
      const [history, latest] = await Promise.all([
        loadGymHistory(addDays(to, -(rangeDays - 1)), to),
        latestGymSession(),
      ]);
      return { history, latestSession: latest?.date ?? null };
    },
    [rangeDays, to],
  );
  const { state, reload } = useLoadable(load, [rangeDays, to], [version]);
  const value = state.status === 'ready' ? state.value : null;
  return {
    history: value?.history ?? null,
    latestSession: value?.latestSession ?? null,
    loading: state.status === 'loading',
    failed: state.status === 'failed',
    reload,
  };
}
