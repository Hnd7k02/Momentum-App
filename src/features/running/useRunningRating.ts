import { useCallback } from 'react';
import { useLoadable } from '../../app/useLoadable';
import { useDataVersion } from '../../app/useDataVersion';
import { useToday } from '../../app/useToday';
import { loadBossProgression } from '../../storage/services/bossService';
import type { RunningRatingState } from '../../storage/services/runningRatingService';

export interface RunningRatingView {
  state: RunningRatingState;
  started: boolean;
}

/**
 * Running's rating and the state behind it.
 *
 * From the Boss replay rather than a second one of its own, for the same
 * reason Gym reads it there: two replays of the same rows are two chances to
 * disagree.
 *
 * Like Gym's, it reloads when the day turns and after any committed write
 * (WP3, B2), so a run logged on Heute is in the board the next time it shows.
 */
export function useRunningRating(): RunningRatingView | null {
  const date = useToday();
  const version = useDataVersion();
  const load = useCallback(async (): Promise<RunningRatingView> => {
    const boss = await loadBossProgression(date);
    const ledger = boss.domains.find((domain) => domain.domain === 'running')!;
    return { state: boss.running, started: ledger.started };
  }, [date]);
  const { state } = useLoadable(load, [date], [version]);
  return state.status === 'ready' ? state.value : null;
}
