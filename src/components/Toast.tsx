import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import './toast.css';

/**
 * One short-lived message with at most one action — the app's only toast
 * (WP3, B9; reused by the workout screen's undo in Stage 2).
 *
 * It exists for one job: making a one-tap write reversible without asking
 * first. "Lauf eingetragen · Rückgängig" costs nothing when it was meant and
 * saves a correction trip when it was not.
 *
 * - **One at a time.** A new toast replaces the one on screen, and the
 *   replaced toast's action is gone with it, so an undo can never act on
 *   something other than what its message names.
 * - **It waits for the reader.** It stays for `durationMs` (5 s by default),
 *   and the countdown starts again while a pointer is over it or focus is
 *   inside it, so it does not vanish under the thumb about to tap Undo.
 * - **It is announced.** The region is a polite live region that is always
 *   in the document, so a screen reader hears each message as it arrives.
 * - **It sits above whatever holds the bottom edge** — the tab bar, and an
 *   update or failure banner when one is shown — and never covers them: the
 *   outlet is placed in the shell's flow right above them. A screen with a
 *   bar of its own lifts it further with `useToastLift` (the workout
 *   screen's sticky "Übung hinzufügen" bar in Stage 2).
 * - **It stays out of a sheet's way.** It is stacked below the sheet layer,
 *   and opening a sheet dismisses it: a sheet is a new task, and an undo
 *   left floating beside it could change the very record the sheet edits.
 * - **Its action runs once**, and a second tap does nothing.
 */
export interface ToastSpec {
  message: string;
  action?: { label: string; run(): void };
  durationMs?: number;
}

export const TOAST_DURATION_MS = 5000;

interface Toaster {
  show(spec: ToastSpec): void;
  dismiss(): void;
  /** Sets the extra lift and returns the function that withdraws it. */
  lift(value: string): () => void;
}

interface ShownToast extends ToastSpec {
  id: number;
}

const ToastContext = createContext<Toaster>({
  show: () => undefined,
  dismiss: () => undefined,
  lift: () => () => undefined,
});
const ShownContext = createContext<{
  toast: ShownToast | null;
  lift: string | null;
  hold(): void;
  release(): void;
  act(toast: ShownToast): void;
}>({ toast: null, lift: null, hold: () => undefined, release: () => undefined, act: () => undefined });

export function useToast(): (spec: ToastSpec) => void {
  return useContext(ToastContext).show;
}

/** Closes the toast on screen, if any. */
export function useDismissToast(): () => void {
  return useContext(ToastContext).dismiss;
}

/**
 * Lifts the toast by `value` (a CSS length) for as long as the calling
 * screen is mounted with a non-null value — for a screen whose own bottom
 * bar the toast must clear. The newest lift wins; withdrawing it restores
 * the one before.
 */
export function useToastLift(value: string | null): void {
  const { lift } = useContext(ToastContext);
  useEffect(() => (value === null ? undefined : lift(value)), [lift, value]);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ShownToast | null>(null);
  const [lifts, setLifts] = useState<{ id: number; value: string }[]>([]);
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const acted = useRef(false);

  const show = useCallback((spec: ToastSpec) => {
    counter.current += 1;
    acted.current = false;
    held.current = false;
    setToast({ ...spec, id: counter.current });
  }, []);

  const dismiss = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const lift = useCallback((value: string) => {
    counter.current += 1;
    const id = counter.current;
    setLifts((current) => [...current, { id, value }]);
    return () => setLifts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const arm = useCallback(
    (durationMs: number) => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (!held.current) dismiss();
      }, durationMs);
    },
    [dismiss],
  );

  useEffect(() => {
    if (!toast) return undefined;
    arm(toast.durationMs ?? TOAST_DURATION_MS);
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [toast, arm]);

  const hold = useCallback(() => {
    held.current = true;
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);
  const release = useCallback(() => {
    held.current = false;
    if (toast) arm(toast.durationMs ?? TOAST_DURATION_MS);
  }, [toast, arm]);
  const act = useCallback(
    (shown: ShownToast) => {
      if (acted.current) return;
      acted.current = true;
      shown.action?.run();
      dismiss();
    },
    [dismiss],
  );

  const toaster = useMemo(() => ({ show, dismiss, lift }), [show, dismiss, lift]);
  const shown = useMemo(
    () => ({ toast, lift: lifts[lifts.length - 1]?.value ?? null, hold, release, act }),
    [toast, lifts, hold, release, act],
  );

  return (
    <ToastContext.Provider value={toaster}>
      <ShownContext.Provider value={shown}>{children}</ShownContext.Provider>
    </ToastContext.Provider>
  );
}

/**
 * Where the toast appears: the shell renders this once, in its flow directly
 * above the banners and the tab bar, so the toast clears whichever of them
 * is showing without having to know their heights.
 */
export function ToastOutlet() {
  const { toast, lift, hold, release, act } = useContext(ShownContext);
  return (
    <div className="toast-anchor">
      <div
        className="toast-region"
        role="status"
        aria-live="polite"
        style={lift === null ? undefined : ({ '--toast-lift': lift } as CSSProperties)}
      >
        {toast ? (
          <div
            key={toast.id}
            className="toast"
            onPointerEnter={hold}
            onPointerLeave={release}
            onFocus={hold}
            onBlur={release}
          >
            <span className="toast__message">{toast.message}</span>
            {toast.action ? (
              <button type="button" className="toast__action" onClick={() => act(toast)}>
                {toast.action.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
