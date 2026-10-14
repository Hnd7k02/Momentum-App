import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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
 * - **It sits above the tab bar** and never covers it. A screen with its own
 *   bottom bar lifts it further with `--toast-lift` (the workout screen's
 *   sticky "Übung hinzufügen" bar in Stage 2).
 * - **Its action runs once**, and a second tap does nothing.
 */
export interface ToastSpec {
  message: string;
  action?: { label: string; run(): void };
  durationMs?: number;
}

export const TOAST_DURATION_MS = 5000;

const ToastContext = createContext<(spec: ToastSpec) => void>(() => undefined);

export function useToast(): (spec: ToastSpec) => void {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastSpec & { id: number }) | null>(null);
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

  const hold = () => {
    held.current = true;
    if (timer.current !== null) clearTimeout(timer.current);
  };
  const release = () => {
    held.current = false;
    if (toast) arm(toast.durationMs ?? TOAST_DURATION_MS);
  };

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
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
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  if (acted.current) return;
                  acted.current = true;
                  toast.action?.run();
                  dismiss();
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
