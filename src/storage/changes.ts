/**
 * One signal for "something on disk changed" (WP3, B2).
 *
 * Every write in the app goes through `runTransaction`, so that is where the
 * signal is raised: once a read-write transaction has **committed**. A screen
 * whose numbers depend on the whole store — the Boss, the Gym and Running
 * ratings, the hub's Training card — subscribes and reloads, instead of each
 * write site having to know who is watching.
 *
 * Writes come in bursts (a set saved, its session touched, a snapshot
 * appended), so listeners are told once per burst: the version moves at the
 * end of a short quiet period rather than per transaction. A reload that a
 * subscriber starts may itself write — the Boss replay reconciles the stored
 * promotion state, the settings record is created on first read — but every
 * such write is conditional on the data having changed, so the second round
 * finds nothing to write and the signal falls silent. `loadsDoNotWrite` in
 * `changes.test.ts` holds that property for the loaders that subscribe.
 */

/** Quiet period before listeners hear about a burst of writes. */
export const CHANGE_SETTLE_MS = 60;

let committed = 0;
let published = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function publish(): void {
  timer = null;
  if (published === committed) return;
  published = committed;
  for (const listener of [...listeners]) listener();
}

/** Called by the storage layer after a read-write transaction commits. */
export function noteCommittedWrite(): void {
  committed += 1;
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(publish, CHANGE_SETTLE_MS);
}

/**
 * The published version: the number of committed writes as of the last
 * settled burst. It moves once per burst — by however many writes the burst
 * held — and never goes back.
 */
export function changeVersion(): number {
  return published;
}

/** How many read-write transactions have committed since the app started. */
export function committedWrites(): number {
  return committed;
}

export function subscribeToChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Publishes a pending burst now. For tests, which do not wait for timers. */
export function flushChanges(): void {
  if (timer !== null) clearTimeout(timer);
  publish();
}
