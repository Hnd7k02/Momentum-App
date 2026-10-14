import { useCallback } from 'react';
import { useLoadable } from '../../app/useLoadable';
import { useDataVersion } from '../../app/useDataVersion';
import { useToday } from '../../app/useToday';
import { loadBossProgression } from '../../storage/services/bossService';
import type { GymRatingState } from '../../storage/services/gymRatingService';

export interface GymRatingView {
  state: GymRatingState;
  started: boolean;
}

/**
 * Gym's rating and the state behind it.
 *
 * It comes from the Boss replay rather than a second one of its own, for the
 * same reason Progress and Rang share theirs: two replays of the same rows
 * are two chances to disagree. The Gym ledger the Boss builds *is* the Gym
 * rating, so reading it here cannot drift from what the Boss is built on.
 *
 * It reloads when the day turns and after any committed write (WP3, B2): a
 * set saved in a workout, an answer, a backup restored. It loaded once
 * before, so the hub kept a rating from before the workout it had just shown.
 */
export function useGymRating(): GymRatingView | null {
  const date = useToday();
  const version = useDataVersion();
  const load = useCallback(async (): Promise<GymRatingView> => {
    const boss = await loadBossProgression(date);
    const ledger = boss.domains.find((domain) => domain.domain === 'gym')!;
    return { state: boss.gym, started: ledger.started };
  }, [date]);
  const { state } = useLoadable(load, [date, version]);
  return state.status === 'ready' ? state.value : null;
}
