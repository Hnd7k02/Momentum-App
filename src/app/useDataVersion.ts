import { useSyncExternalStore } from 'react';
import { changeVersion, subscribeToChanges } from '../storage/changes';

/**
 * The store's change version, as a value a loader can depend on (WP3, B2).
 *
 * It moves once per settled burst of committed writes, wherever they came
 * from. A screen that reads the whole store — the Boss, a rating, the hub's
 * week — passes it in its `useLoadable` dependencies and is current after any
 * write without knowing who wrote.
 */
export function useDataVersion(): number {
  return useSyncExternalStore(subscribeToChanges, changeVersion, changeVersion);
}
