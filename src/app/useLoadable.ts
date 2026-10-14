import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

/**
 * The one way a screen loads something.
 *
 * Three screens read from storage on mount, and each had grown its own
 * version of the same effect. The versions did not agree: one turned a
 * rejected load into a permanent spinner, one into a blank screen, and none
 * of them could be retried, because the load lived in an effect with no
 * dependencies and nothing else could re-run it.
 *
 * Three properties matter here and are easy to lose when this is written
 * per screen:
 *
 * **Loading, failure and emptiness are different states.** They are three
 * variants, so a screen cannot accidentally render one as another. What is
 * *empty* is the caller's business — it depends on the data — and is never
 * decided here.
 *
 * **A retry is a fresh attempt.** Every attempt takes a ticket, and a reply
 * is only accepted while its ticket is still the current one. An earlier
 * attempt that resolves late can therefore never overwrite a newer one, so
 * a retry cannot be undone by the failure it was retrying.
 *
 * **Content already on screen survives a failed refresh.** Reloading after a
 * write is not a reason to throw away what the user was reading; the view is
 * marked stale instead, and the screen decides how quietly to say so.
 *
 * **It loads again whenever its inputs change** (WP3, B2). The caller names
 * them in `deps`, exactly as for an effect: the range a chart covers, the day
 * a screen shows, the store's change version. The first version loaded once
 * and never again, so a new range or a new day kept the old numbers on
 * screen. While the new load is in flight the previous value stays — a
 * toggle does not blank the page — and the ticket guarantees that only the
 * newest load is ever shown. A screen for which an outdated value would be
 * misleading compares it with what it asked for (Today checks the day).
 */
export type Loadable<T> =
  | { status: 'loading' }
  | { status: 'failed'; error: Error }
  /** `refreshFailed` means the value is real but no longer known to be current. */
  | { status: 'ready'; value: T; refreshFailed: boolean };

export function useLoadable<T>(load: () => Promise<T>, deps: DependencyList): {
  state: Loadable<T>;
  reload: () => Promise<void>;
} {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading' });

  // The loader is read through a ref so `reload` keeps a stable identity.
  // Callers pass inline closures; without this, every render would be a new
  // loader, and the effect below would reload forever.
  const loadRef = useRef(load);
  loadRef.current = load;

  const attempt = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const ticket = (attempt.current += 1);
    try {
      const value = await loadRef.current();
      if (!alive.current || attempt.current !== ticket) return;
      setState({ status: 'ready', value, refreshFailed: false });
    } catch (error: unknown) {
      if (!alive.current || attempt.current !== ticket) return;
      const failure = error instanceof Error ? error : new Error(String(error));
      setState((previous) =>
        previous.status === 'ready'
          ? { ...previous, refreshFailed: true }
          : { status: 'failed', error: failure },
      );
    }
  }, []);

  useEffect(() => {
    void reload();
    // `deps` are the caller's inputs; the loader itself is read through the
    // ref, so it is deliberately not one of them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { state, reload };
}
