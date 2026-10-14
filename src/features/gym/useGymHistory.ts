import { useCallback } from 'react';
import { addDays } from '../../core/dates';
import { useLoadable } from '../../app/useLoadable';
import { useDataVersion } from '../../app/useDataVersion';
import { useToday } from '../../app/useToday';
import { loadGymHistory, type GymHistory } from '../../storage/services/gymService';

/**
 * Gym's replay, over the range the Progress screen is showing.
 *
 * Separate from `useProgression` because it is a different question answered
 * from different rows: the progression replays day scores, and Gym replays
 * sets. Loading it here rather than folding it into the progression keeps a
 * failure in one from emptying the other.
 *
 * It loads again when the range changes, when the day turns and after any
 * committed write (WP3, B2). It used to load once, so the 7- and 30-day views
 * showed the same numbers and a finished workout did not reach them.
 */
export function useGymHistory(rangeDays: number): GymHistory | null {
  const to = useToday();
  const version = useDataVersion();
  const load = useCallback(
    () => loadGymHistory(addDays(to, -(rangeDays - 1)), to),
    [rangeDays, to],
  );
  const { state } = useLoadable(load, [rangeDays, to, version]);
  return state.status === 'ready' ? state.value : null;
}
