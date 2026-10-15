import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon, CloseIcon } from './Icons';
import { useT } from '../i18n/I18nProvider';
import { useDismissToast } from './Toast';
import './ui.css';

/**
 * The tile everything sits on.
 *
 * The card carries its own inset on all four sides, so a child never has to
 * remember to. Two variants exist and neither adds anything — they only say
 * which part of that inset the card is *not* responsible for:
 *
 * - `rows` — the children are rows and carry the vertical rhythm themselves.
 * - `flush` — the child is one edge-to-edge visual and insets its own text.
 *
 * `data-card` marks the tile for the geometry harness, which measures every
 * line of text against the box that clips it.
 */
export function Card({ children, rows = false, flush = false, className = '' }: {
  children: ReactNode;
  rows?: boolean;
  flush?: boolean;
  className?: string;
}) {
  const variant = flush ? 'card--flush' : rows ? 'card--rows' : '';
  return (
    <div data-card className={`card ${variant} ${className}`.trim()}>{children}</div>
  );
}

/**
 * A titled group.
 *
 * `labelHidden` keeps the heading in the document but out of the design. Some
 * cards carry their own visual title — a chart states its range, a grid its
 * legend — and repeating it as a grey label above would be noise; without
 * any heading, though, the section is an unnamed region a screen reader
 * cannot navigate to or skip.
 */
export function Section({
  label,
  labelHidden = false,
  children,
}: {
  label?: string;
  labelHidden?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="section" aria-label={label && labelHidden ? label : undefined}>
      {label ? (
        <h2 className={labelHidden ? 'visually-hidden' : 'section__label'}>{label}</h2>
      ) : null}
      {children}
    </section>
  );
}

/** The row a sheet was opened from, found again by its `focusKey`. */
export function focusTarget(key: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-focus-key="${key}"]`);
}

export function Row({
  title,
  subtitle,
  trailing,
  leading,
  onClick,
  muted = false,
  ariaLabel,
  focusKey,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  leading?: ReactNode;
  onClick?: () => void;
  muted?: boolean;
  ariaLabel?: string;
  /** A stable name a sheet can find this row by again (`focusTarget`). */
  focusKey?: string;
}) {
  const className = `row ${onClick ? 'row--tappable' : ''} ${muted ? 'row--muted' : ''}`.trim();
  const content = (
    <>
      {leading}
      <span className="row__body">
        <span className="row__title">{title}</span>
        {subtitle ? <span className="row__subtitle">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="row__trailing">{trailing}</span> : null}
    </>
  );

  if (!onClick) return <div className={className}>{content}</div>;
  return (
    <button type="button" className={className} onClick={onClick} aria-label={ariaLabel} data-focus-key={focusKey}>
      {content}
    </button>
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  block = false,
  disabled = false,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'quiet' | 'destructive';
  block?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      className={`button button--${variant} ${block ? 'button--block' : ''}`.trim()}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/** iOS-style switch. A real button with `aria-checked`, not a styled div. */
export function Switch({
  checked,
  onChange,
  label,
  accent,
}: {
  checked: boolean;
  onChange(next: boolean): void;
  label: string;
  accent?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      style={accent ? ({ '--switch-on': accent } as React.CSSProperties) : undefined}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__knob" />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange(next: T): void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__option"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function BubbleRow({
  values,
  selected,
  onSelect,
  label,
  accent,
  describe,
}: {
  values: number[];
  selected: number | null;
  onSelect(value: number): void;
  label: string;
  accent?: string;
  describe?(value: number): string;
}) {
  return (
    <div
      className="bubble-row"
      role="group"
      aria-label={label}
      style={accent ? ({ '--bubble-accent': accent } as React.CSSProperties) : undefined}
    >
      {values.map((value) => (
        <button
          key={value}
          type="button"
          className="bubble"
          aria-pressed={value === selected}
          aria-label={describe ? describe(value) : String(value)}
          onClick={() => onSelect(value)}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon ? <span className="empty__icon">{icon}</span> : null}
      <span className="empty__title">{title}</span>
      {body ? <p className="empty__body">{body}</p> : null}
      {action}
    </div>
  );
}

/**
 * A retry that cannot be double-fired and cannot get stuck.
 *
 * The button is out of action while the attempt is in flight, and the flag
 * is cleared in a `finally` — including when the retry rejects, which is the
 * case that would otherwise leave a permanently disabled button.
 */
function useRetry(onRetry: () => void | Promise<void>) {
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const retry = useCallback(() => {
    setBusy(true);
    void Promise.resolve(onRetry()).finally(() => {
      if (mounted.current) setBusy(false);
    });
  }, [onRetry]);

  return { busy, retry };
}

/**
 * A screen that could not load.
 *
 * Distinct from an empty state by construction: this one is an `alert`, and
 * it always offers the action that helps. It takes focus when it appears,
 * because the content the reader was waiting for did not arrive and the next
 * thing they need is one tab away.
 */
export function LoadFailure({
  title,
  onRetry,
}: {
  title: string;
  onRetry(): void | Promise<void>;
}) {
  const t = useT();
  const { busy, retry } = useRetry(onRetry);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    container.current?.focus();
  }, []);

  return (
    <Card>
      <div className="load-failure" role="alert" tabIndex={-1} ref={container}>
        <EmptyState
          title={title}
          body={t('error.load.body')}
          action={
            <span aria-busy={busy}>
              <Button variant="secondary" disabled={busy} onClick={retry}>
                {t('error.load.retry')}
              </Button>
            </span>
          }
        />
      </div>
    </Card>
  );
}

/**
 * What is on screen is real but may no longer be current.
 *
 * Quieter than a failure and deliberately non-destructive: the content stays
 * where it is, and this says only that the last refresh did not get through.
 */
export function StaleNotice({ onRetry }: { onRetry(): void | Promise<void> }) {
  const t = useT();
  const { busy, retry } = useRetry(onRetry);

  return (
    <div className="stale-notice" role="status">
      <span>{t('error.stale')}</span>
      <button type="button" onClick={retry} disabled={busy} aria-busy={busy}>
        {t('error.load.retry')}
      </button>
    </div>
  );
}

/**
 * Marks the field a sheet focuses when it opens (WP3, B1).
 *
 * Spread onto one input: `<input {...SHEET_INITIAL_FOCUS} />`. A sheet with
 * no marked field focuses the dialog itself, never its first button — that
 * is the close button, and landing there invites closing by accident.
 */
export const SHEET_INITIAL_FOCUS = { 'data-sheet-initial-focus': '' } as const;

/**
 * Bottom sheet. Focus moves into it on open and Escape closes it, so it
 * behaves like a modal for a keyboard and a screen reader too.
 *
 * Focus moves in, and back to where it came from, only when `open` changes
 * (WP3, B1). The effect used to depend on `onClose` as well, and every caller
 * passes an inline one, so each keystroke that re-rendered the caller re-ran
 * it: its cleanup put focus back behind the sheet and the next run moved it
 * to the close button — after one letter, typing went nowhere. `onClose` is
 * now read through a ref, so the effect sees the latest one without
 * depending on it.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
  returnFocus,
}: {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * Where focus goes on close when the control that opened the sheet is no
   * longer in the document — Heute re-renders its day under an open sheet
   * at midnight, and the opener is a new node by the time the sheet closes.
   */
  returnFocus?: () => HTMLElement | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const returnFocusRef = useRef(returnFocus);
  returnFocusRef.current = returnFocus;
  const t = useT();
  const dismissToast = useDismissToast();

  useEffect(() => {
    if (!open) return undefined;
    // A sheet is a new task: an undo left floating beside it could change
    // the very record the sheet is editing (WP3, B9).
    dismissToast();
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const initial = panel?.querySelector<HTMLElement>('[data-sheet-initial-focus]');
    (initial ?? panel)?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const target = previous?.isConnected ? previous : (returnFocusRef.current?.() ?? null);
      target?.focus({ preventScroll: true });
    };
  }, [open, dismissToast]);

  if (!open) return null;

  /*
   * Rendered into <body>, not in place: a sheet opened inside the workout or
   * another full-screen overlay (z 30, each a stacking context of its own)
   * would otherwise stack its scrim inside that overlay, below the toast
   * (z 35) — and a toast's action would sit on top of the sheet.
   */
  const scrim = (
    <div className="sheet-scrim" onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panelRef}
        // Focusable from script only, so a sheet with no marked field can
        // still take focus without adding a tab stop.
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet__grabber" aria-hidden="true" />
        <header className="sheet__header">
          <h2 className="sheet__title">{title}</h2>
          <button
            type="button"
            className="sheet__close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </button>
        </header>
        <div className="sheet__body">{children}</div>
        {footer ? <div className="sheet__footer">{footer}</div> : null}
      </div>
    </div>
  );
  // Without a document — the static-markup tests render on the server — it
  // stays in place; the app itself always has one.
  return typeof document === 'undefined' ? scrim : createPortal(scrim, document.body);
}

/** A round check used by selectable cards. */
export function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <span className={`selection-mark ${selected ? 'selection-mark--on' : ''}`.trim()} aria-hidden="true">
      {selected ? <CheckIcon size={16} /> : null}
    </span>
  );
}
