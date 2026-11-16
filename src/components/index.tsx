import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon, CloseIcon } from './Icons';
import { stillness } from '../app/stillness';
import { useT } from '../i18n/I18nProvider';
import { useDismissToast } from './Toast';
import { SHEET_Y, bindSheetDrag, type SheetDetent } from './sheetDetents';
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

/**
 * Where a printed figure ends and its unit or scale begins — "830" and
 * " von 1000", "0 / 3" and " Trainings", "8 × 60 " and "kg".
 *
 * The text is the catalogue's, untouched: this only finds the seam, so the
 * number can be set at the size of its place and what follows it smaller
 * and secondary (contract §3). Name the seam from the front (`figure`, what
 * the text begins with) or from the back (`unit`, what it ends with). A
 * text that does not begin or end that way stays whole.
 */
export function splitFigure(
  text: string,
  seam: { figure: string | number } | { unit: string },
): [head: string, rest: string | null] {
  if ('figure' in seam) {
    const head = String(seam.figure);
    return text.startsWith(head) && text.length > head.length ? [head, text.slice(head.length)] : [text, null];
  }
  const at = text.length - seam.unit.length;
  return seam.unit !== '' && at > 0 && text.endsWith(seam.unit) ? [text.slice(0, at), seam.unit] : [text, null];
}

/**
 * A figure with its unit: one run of text for a screen reader and a test,
 * two weights for the eye.
 */
export function Figure(props: { text: string } & ({ figure: string | number } | { unit: string })) {
  const [head, rest] = splitFigure(props.text, props);
  if (rest === null) return <>{head}</>;
  return (
    <>
      {head}
      <span className="figure__unit">{rest}</span>
    </>
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

/**
 * iOS-style switch. A real button with `aria-checked`, not a styled div.
 * Switched on it carries the accent of the world it stands in, whatever it
 * switches (D154): an area has no colour of its own.
 */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange(next: boolean): void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
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
  describe,
}: {
  values: number[];
  selected: number | null;
  onSelect(value: number): void;
  label: string;
  describe?(value: number): string;
}) {
  return (
    // One column per value: the row never wraps (`ui.css`).
    <div
      className="bubble-row"
      role="group"
      aria-label={label}
      style={{ '--bubble-count': values.length } as CSSProperties}
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
 * What a screen shows while its content loads (contract §11).
 *
 * Calm surfaces where the cards will stand, each about the height of the
 * card it holds the place of, so the layout is there before the content is
 * and nothing jumps when it arrives. No shimmer: a surface, not an
 * animation. Hidden from assistive technology — the scroll port around it
 * carries `aria-busy`, which is what says "loading" there.
 */
export function LoadingBlocks({ heights }: { heights: readonly number[] }) {
  return (
    <div className="loading-blocks" aria-hidden="true">
      {heights.map((height, index) => (
        <div key={index} className="loading-block" style={{ height }} />
      ))}
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
 * Focus moves in, and back to where it came from, only when the sheet
 * comes to stand or goes (WP3, B1). The effect used to depend on `onClose` as well, and every caller
 * passes an inline one, so each keystroke that re-rendered the caller re-ran
 * it: its cleanup put focus back behind the sheet and the next run moved it
 * to the close button — after one letter, typing went nowhere. `onClose` is
 * now read through a ref, so the effect sees the latest one without
 * depending on it.
 *
 * **Two heights and a finger** (block 7C, contract §9), for the sheet that
 * asks for them with `detents`: it opens at two thirds of the screen, is
 * dragged to 92 % and down to close, and its grabber is a control with a
 * name that changes the height for whoever does not drag
 * (`sheetDetents.ts`). It travels in and out; with reduced motion the
 * travel takes no time. Every other sheet is as tall as its content and
 * does not move — and **has no grabber: a grabber stands only where one can
 * drag.** Sheets with fields stay as calm as they were.
 *
 * **Over the body** (`overBody`) a sheet is a solid surface and its scrim
 * neither dims nor blurs: the window above it shows the body, and the body
 * may still be travelling to the group while the sheet rises (D146 — no
 * blur over a canvas that draws). Such a sheet does not ask the body to
 * stop; its host holds the viewer once the camera rests.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
  returnFocus,
  lead,
  detents = false,
  overBody = false,
  suspended = false,
  onDetentChange,
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
  /** A mark before the title — the muscle sheet's dot. Decorative; the title is the name. */
  lead?: ReactNode;
  /** Two heights and dragging (contract §9). */
  detents?: boolean;
  /** The sheet stands over the 3D body: solid, a clear scrim, and no wait for the body to rest. */
  overBody?: boolean;
  /**
   * Something lies on top of the sheet — the exercise detail opened from
   * it. The sheet stays as it is, at its height and where it was scrolled,
   * and is out of sight and out of reach until that goes.
   */
  suspended?: boolean;
  /** The height the sheet came to rest at, whenever it changes. */
  onDetentChange?: (detent: SheetDetent) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const returnFocusRef = useRef(returnFocus);
  returnFocusRef.current = returnFocus;
  const onDetentChangeRef = useRef(onDetentChange);
  onDetentChangeRef.current = onDetentChange;
  const t = useT();
  const dismissToast = useDismissToast();

  /*
   * No glass over a moving body (D146, block 7B). A sheet blurs and dims
   * what lies under it, so it stands over a body that is still: it asks
   * whatever can draw by itself to stop (`app/stillness.ts`) and stands
   * once that has happened — and from then on until it is closed, whatever
   * happens beneath it. On every screen without the 3D body nothing can
   * move, and the sheet stands in the render that opened it, as it always
   * did. A sheet over the body neither blurs nor dims and does not wait.
   */
  const still = useSyncExternalStore(stillness.subscribe, stillness.isStill, () => true);
  const stood = useRef(false);
  useEffect(() => (open && !overBody ? stillness.ask() : undefined), [open, overBody]);
  if (!open) stood.current = false;
  else if (still || overBody) stood.current = true;
  const standing = open && stood.current;
  const standingRef = useRef(standing);
  standingRef.current = standing;

  /*
   * A sheet with detents travels: it is in the document from the render
   * after it comes to stand until its way out has ended, and shows what it
   * last showed while it leaves.
   */
  const [phase, setPhase] = useState<'gone' | 'entering' | 'shown' | 'leaving'>('gone');
  const [detent, setDetent] = useState<SheetDetent>('lower');
  const detentRef = useRef(detent);
  detentRef.current = detent;
  const last = useRef({ title, children, footer, lead });
  if (standing) last.current = { title, children, footer, lead };

  useTravelEffect(() => {
    if (!detents) return;
    if (standing) {
      setDetent('lower');
      setPhase((current) => (current === 'shown' ? 'shown' : 'entering'));
    } else {
      setPhase((current) => (current === 'gone' ? 'gone' : 'leaving'));
    }
  }, [standing, detents]);

  useTravelEffect(() => {
    if (phase !== 'entering') return;
    // The sheet has been laid out below the screen; from there it travels.
    panelRef.current?.getBoundingClientRect();
    setPhase('shown');
  }, [phase]);

  useEffect(() => {
    if (phase !== 'leaving') return undefined;
    const timer = window.setTimeout(() => setPhase('gone'), sheetTravelMs());
    return () => window.clearTimeout(timer);
  }, [phase]);

  const rendered = detents ? phase !== 'gone' : standing;
  /** In the document, standing, and with nothing on top of it. */
  const active = standing && rendered && !suspended;

  useEffect(() => {
    if (!active) return undefined;
    // A sheet is a new task: an undo left floating beside it could change
    // the very record the sheet is editing (WP3, B9).
    dismissToast();
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // What was on top of the sheet has gone and put focus back inside it:
    // it stays where it is.
    if (!panel?.contains(previous)) {
      const initial = panel?.querySelector<HTMLElement>('[data-sheet-initial-focus]');
      (initial ?? panel)?.focus({ preventScroll: true });
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Something is opening on top: focus is its to take, and comes back.
      if (panel?.isConnected && standingRef.current) return;
      // A sheet opened with nothing in focus — a tap on the body — and one
      // whose opener was inside it have no opener to go back to.
      const from = !previous || previous === document.body || panel?.contains(previous) ? null : previous;
      const target = from?.isConnected ? from : (returnFocusRef.current?.() ?? null);
      target?.focus({ preventScroll: true });
    };
  }, [active, dismissToast]);

  /* ── The two heights ────────────────────────────────────────────────── */

  // The content is as tall as what can be seen of it: on the lower detent
  // the part of the box below the screen is taken out of it — but only once
  // the sheet has arrived there, and at once when it starts to rise.
  useEffect(() => {
    if (!detents || phase !== 'shown') return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;
    onDetentChangeRef.current?.(detent);
    if (detent === 'upper') {
      panel.removeAttribute('data-short');
      return undefined;
    }
    const timer = window.setTimeout(() => panel.setAttribute('data-short', ''), sheetTravelMs());
    return () => window.clearTimeout(timer);
  }, [detents, detent, phase]);

  useEffect(() => {
    if (!detents || phase !== 'shown') return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;
    return bindSheetDrag(panel, bodyRef.current, {
      detent: () => detentRef.current,
      onStart: () => panel.removeAttribute('data-short'),
      onRelease: (target) => {
        if (target === 'closed') onCloseRef.current();
        else if (target === detentRef.current) {
          // Back where it was: the content is sized for it again.
          if (target === 'lower') window.setTimeout(() => panel.setAttribute('data-short', ''), sheetTravelMs());
        } else setDetent(target);
      },
    });
  }, [detents, phase]);

  if (!rendered) return null;

  const shown = detents && !standing ? last.current : { title, children, footer, lead };
  const leaving = detents && phase === 'leaving';
  const hidden = leaving || suspended;
  const y = !detents ? undefined : phase === 'shown' ? SHEET_Y[detent] : SHEET_Y.closed;

  /*
   * Rendered into <body>, not in place: a sheet opened inside the workout or
   * another full-screen overlay (z 30, each a stacking context of its own)
   * would otherwise stack its scrim inside that overlay, below the toast
   * (z 35) — and a toast's action would sit on top of the sheet.
   */
  const scrim = (
    <div
      className={`sheet-scrim${overBody ? ' sheet-scrim--clear' : ''}`}
      onClick={onClose}
      role="presentation"
      data-leaving={leaving ? '' : undefined}
      data-suspended={suspended ? '' : undefined}
      aria-hidden={hidden ? true : undefined}
      {...(hidden ? { inert: '' } : {})}
    >
      <div
        className={`sheet${detents ? ' sheet--detents' : ''}${overBody ? ' sheet--solid' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={shown.title}
        ref={panelRef}
        data-detent={detents ? detent : undefined}
        style={y === undefined ? undefined : ({ '--sheet-y': y } as CSSProperties)}
        // Focusable from script only, so a sheet with no marked field can
        // still take focus without adding a tab stop.
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Only where one can drag (contract §9): a control with a name,
            for whoever changes the height without dragging. */}
        {detents ? (
          <button
            type="button"
            className="sheet__grabber"
            aria-label={t(detent === 'lower' ? 'sheet.expand' : 'sheet.collapse')}
            onClick={() => setDetent((current) => (current === 'lower' ? 'upper' : 'lower'))}
          />
        ) : null}
        <header className="sheet__header">
          <h2 className={shown.lead ? 'sheet__title sheet__title--lead' : 'sheet__title'}>
            {shown.lead}
            {shown.title}
          </h2>
          <button
            type="button"
            className="sheet__close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </button>
        </header>
        <div className="sheet__body" ref={bodyRef}>{shown.children}</div>
        {shown.footer ? <div className="sheet__footer">{shown.footer}</div> : null}
        {detents ? <div className="sheet__below" aria-hidden="true" /> : null}
      </div>
    </div>
  );
  // Without a document — the static-markup tests render on the server — it
  // stays in place; the app itself always has one.
  return typeof document === 'undefined' ? scrim : createPortal(scrim, document.body);
}

/**
 * Before the browser paints, where there is one: the sheet must be laid out
 * below the screen before it is told to rise, or it would not travel. The
 * static-markup tests render without a document, and there it is an
 * ordinary effect that never runs.
 */
const useTravelEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

/** How long a sheet travels: the one duration, as the document has it now — nothing under reduced motion. */
function sheetTravelMs(): number {
  if (typeof document === 'undefined') return 0;
  const value = getComputedStyle(document.documentElement).getPropertyValue('--duration-sheet').trim();
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return 0;
  return value.endsWith('ms') ? number : number * 1000;
}

/** A round check used by selectable cards. */
export function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <span className={`selection-mark ${selected ? 'selection-mark--on' : ''}`.trim()} aria-hidden="true">
      {selected ? <CheckIcon size={16} /> : null}
    </span>
  );
}
