import { useCallback } from 'react';
import { useLoadable } from '../../app/useLoadable';
import { useDataVersion } from '../../app/useDataVersion';
import { useToday } from '../../app/useToday';
import type { DomainType } from '../../core/model';
import { loadBossProgression } from '../../storage/services/bossService';

export interface DomainStanding {
  /** The domain's rating on the shared 0–1000 scale. */
  momentum: number;
  /** False until the domain has a scored day behind it. */
  started: boolean;
}

/**
 * One domain's standing — its rating — read from the Boss replay.
 *
 * The same ledger the Boss is built from, read here so a terminal can open
 * with the domain's current rating above its detail. Not a second replay of
 * its own and not a second definition of the rating: the ledger the Boss
 * builds *is* the domain rating, so the two screens cannot disagree. A
 * domain has no rank; the Boss is the only one.
 */
export function useDomainStanding(domain: DomainType): DomainStanding | null {
  const date = useToday();
  const version = useDataVersion();
  const load = useCallback(async (): Promise<DomainStanding> => {
    const boss = await loadBossProgression(date);
    const ledger = boss.domains.find((entry) => entry.domain === domain)!;
    return { momentum: ledger.momentum, started: ledger.started };
  }, [domain, date]);
  // A new area, a new day or a committed write (WP3, B2).
  const { state } = useLoadable(load, [domain, date], [version]);
  return state.status === 'ready' ? state.value : null;
}
