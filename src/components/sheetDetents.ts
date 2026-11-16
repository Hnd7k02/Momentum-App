/**
 * A sheet with two heights, moved by a finger (block 7C, contract §9).
 *
 * The sheet is one box as tall as its upper detent, standing on the bottom
 * of the screen and moved down by an **offset**: nothing at the upper
 * detent, the difference of the two heights at the lower, its whole height
 * when it is gone. A drag sets that offset directly; letting go decides
 * where it comes to rest (`releaseTarget`) and the transition takes it
 * there. Nothing here animates anything by itself.
 *
 * **Who a drag belongs to** — the sheet or its content — is decided once,
 * with the first movement, the way a phone decides it:
 *
 * - On the lower detent every vertical drag is the sheet's: up raises it,
 *   and what the finger goes on after the upper detent scrolls the content,
 *   in the same gesture.
 * - On the upper detent a drag on the content scrolls the content. Only at
 *   the content's very start does a drag *down* take the sheet with it —
 *   back to the lower detent, and from there away.
 * - The grabber and the header always move the sheet.
 * - A drag that begins sideways is nobody's.
 *
 * The page behind is never part of it: the sheet takes every movement it
 * decides is its own away from the browser.
 */

export type SheetDetent = 'lower' | 'upper';

/** How a release is judged. Behaviour, not appearance: not tokens. */
export const SHEET_DRAG = {
  /** A finger faster than this is a flick, and its direction decides: px per ms. */
  flick: 0.5,
  /** A flick counts from the detent it is at, within this much: px. */
  slop: 8,
  /** Let go slowly, the sheet goes away once it is this share of the way from the lower detent to gone. */
  closeShare: 0.35,
  /** The finger's speed is read over its last movements within this long: ms. */
  velocityWindowMs: 100,
  /** A finger that rested this long before lifting threw nothing: ms. */
  velocityRestMs: 80,
} as const;

/**
 * Where a released sheet comes to rest.
 *
 * A flick goes one step in its direction from where the sheet is: down from
 * above the lower detent is the lower detent, down from it — or from below
 * it — is gone. Let go slowly, the sheet takes the nearer detent, and goes
 * away only when it was pulled well below the lower one.
 */
export function releaseTarget({
  offset,
  lower,
  closed,
  velocity,
}: {
  /** How far the sheet is moved down from its upper detent: px. */
  offset: number;
  /** The offset of the lower detent, and the one at which the sheet is gone. */
  lower: number;
  closed: number;
  /** The finger's speed when it lifted, px per ms, down positive. */
  velocity: number;
}): SheetDetent | 'closed' {
  if (velocity > SHEET_DRAG.flick) return offset < lower - SHEET_DRAG.slop ? 'lower' : 'closed';
  if (velocity < -SHEET_DRAG.flick) return offset > lower + SHEET_DRAG.slop ? 'lower' : 'upper';
  if (offset > lower + (closed - lower) * SHEET_DRAG.closeShare) return 'closed';
  return offset < lower / 2 ? 'upper' : 'lower';
}

interface Sample {
  at: number;
  y: number;
}

/** The finger's speed at release, px per ms, from its last movements. */
export function releaseSpeed(samples: readonly Sample[], releasedAt: number): number {
  const last = samples[samples.length - 1];
  if (!last || releasedAt - last.at > SHEET_DRAG.velocityRestMs) return 0;
  let first = last;
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const sample = samples[index]!;
    if (last.at - sample.at > SHEET_DRAG.velocityWindowMs) break;
    first = sample;
  }
  const ms = last.at - first.at;
  return ms <= 0 ? 0 : (last.y - first.y) / ms;
}

/**
 * Whether a drag that has just begun to move is the sheet's.
 * `dx`, `dy`: the first movement; `dy` down positive.
 */
export function dragIsSheets({
  detent,
  onContent,
  contentAtStart,
  dx,
  dy,
}: {
  detent: SheetDetent;
  /** The finger came down on the scrolling content, not on the grabber or the header. */
  onContent: boolean;
  /** The content stood at its very start when the finger came down. */
  contentAtStart: boolean;
  dx: number;
  dy: number;
}): boolean {
  if (Math.abs(dx) > Math.abs(dy)) return false;
  if (!onContent || detent === 'lower') return true;
  return contentAtStart && dy > 0;
}

/** The offset as the CSS that puts the sheet there (`--sheet-y`). */
export const SHEET_Y: Record<SheetDetent | 'closed', string> = {
  upper: '0px',
  // A share of the sheet's own height: the difference of the two detents.
  lower: 'calc(100% * (1 - var(--sheet-detent-lower) / var(--sheet-detent-upper)))',
  closed: '100%',
};

export interface SheetDragHost {
  /** The detent the sheet stands at when a finger comes down. */
  detent(): SheetDetent;
  /** A drag became the sheet's: it will move. */
  onStart(): void;
  /** The finger lifted, and the sheet goes here. */
  onRelease(target: SheetDetent | 'closed'): void;
}

/**
 * Binds the drag to a sheet's panel. `content` is its scrolling body.
 *
 * Touches are read as touch events — the first movement of a touch can be
 * taken away from the browser only there — and a mouse or a pen as pointer
 * events on the grabber and the header alone: on the content a mouse
 * selects text and its wheel scrolls.
 */
export function bindSheetDrag(panel: HTMLElement, content: HTMLElement | null, host: SheetDragHost): () => void {
  const scrim = panel.parentElement;
  const shares = () => {
    const style = getComputedStyle(panel);
    const lower = Number.parseFloat(style.getPropertyValue('--sheet-detent-lower')) || 2 / 3;
    return { lower };
  };
  /** The offsets in px, as the sheet is laid out now. */
  const offsets = () => {
    const closed = panel.offsetHeight;
    const screen = scrim?.clientHeight ?? closed;
    return { lower: Math.max(0, closed - screen * shares().lower), closed };
  };

  let drag: {
    id: number;
    x: number;
    y: number;
    from: number;
    scroll: number;
    onContent: boolean;
    mode: 'undecided' | 'sheet' | 'other';
    samples: Sample[];
    at: number;
  } | null = null;
  let position = 0;
  /** A drag with the mouse ends in a click on what it began on; that click is not one. */
  let swallowClick = false;

  const place = (offset: number) => {
    position = offset;
    panel.style.setProperty('--sheet-y', `${offset.toFixed(1)}px`);
  };

  const begin = (id: number, x: number, y: number, at: number, target: EventTarget | null) => {
    const onContent = content !== null && target instanceof Node && content.contains(target);
    drag = {
      id,
      x,
      y,
      from: host.detent() === 'upper' ? 0 : offsets().lower,
      scroll: content?.scrollTop ?? 0,
      onContent,
      mode: 'undecided',
      samples: [{ at, y }],
      at,
    };
  };

  /** Returns whether the movement was the sheet's, so the caller takes it from the browser. */
  const move = (x: number, y: number, at: number): boolean => {
    if (!drag) return false;
    const dx = x - drag.x;
    const dy = y - drag.y;
    if (drag.mode === 'undecided') {
      if (dx === 0 && dy === 0) return false;
      const ours = dragIsSheets({
        detent: host.detent(),
        onContent: drag.onContent,
        contentAtStart: drag.scroll <= 0,
        dx,
        dy,
      });
      drag.mode = ours ? 'sheet' : 'other';
      if (ours) {
        panel.setAttribute('data-dragging', '');
        host.onStart();
      }
    }
    if (drag.mode !== 'sheet') return false;
    const wanted = drag.from + dy;
    if (wanted < 0) {
      // At the upper detent: what the finger goes on scrolls the content.
      if (content && drag.onContent) content.scrollTop = drag.scroll - wanted;
      place(0);
    } else {
      if (content && drag.onContent && content.scrollTop !== drag.scroll) content.scrollTop = drag.scroll;
      place(wanted);
    }
    drag.samples.push({ at, y });
    if (drag.samples.length > 12) drag.samples.shift();
    drag.at = at;
    return true;
  };

  const end = (at: number, cancelled: boolean) => {
    const done = drag;
    drag = null;
    if (!done || done.mode !== 'sheet') return;
    panel.removeAttribute('data-dragging');
    const { lower, closed } = offsets();
    const target = cancelled
      ? host.detent()
      : releaseTarget({ offset: position, lower, closed, velocity: releaseSpeed(done.samples, at) });
    // The same value the sheet renders for its detent, so nothing written
    // here in pixels outlives the drag.
    panel.style.setProperty('--sheet-y', SHEET_Y[target]);
    host.onRelease(target);
  };

  /* ── Touch ─────────────────────────────────────────────────────────── */

  const touchOf = (event: TouchEvent, id: number): Touch | null => {
    for (const touch of Array.from(event.changedTouches)) if (touch.identifier === id) return touch;
    return null;
  };
  const onTouchStart = (event: TouchEvent) => {
    // One finger moves a sheet; a second one joins nothing.
    if (drag || event.touches.length !== 1) return;
    const touch = event.changedTouches[0];
    if (touch) begin(touch.identifier, touch.clientX, touch.clientY, event.timeStamp, event.target);
  };
  const onTouchMove = (event: TouchEvent) => {
    if (!drag) return;
    const touch = touchOf(event, drag.id);
    if (!touch) return;
    if (move(touch.clientX, touch.clientY, event.timeStamp) && event.cancelable) event.preventDefault();
  };
  const onTouchEnd = (event: TouchEvent) => {
    if (drag && touchOf(event, drag.id)) end(event.timeStamp, false);
  };
  const onTouchCancel = (event: TouchEvent) => {
    if (drag && touchOf(event, drag.id)) end(event.timeStamp, true);
  };

  /* ── Mouse and pen: the grabber and the header ─────────────────────── */

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || event.button !== 0 || drag) return;
    if (content !== null && event.target instanceof Node && content.contains(event.target)) return;
    begin(event.pointerId, event.clientX, event.clientY, event.timeStamp, event.target);
    swallowClick = false;
  };
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || !drag || drag.id !== event.pointerId) return;
    if (move(event.clientX, event.clientY, event.timeStamp)) {
      swallowClick = true;
      try {
        panel.setPointerCapture(event.pointerId);
      } catch {
        /* a pointer that is gone needs no capture */
      }
      event.preventDefault();
    }
  };
  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || !drag || drag.id !== event.pointerId) return;
    end(event.timeStamp, event.type === 'pointercancel');
  };
  const onClick = (event: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    event.stopPropagation();
    event.preventDefault();
  };

  panel.addEventListener('touchstart', onTouchStart, { passive: true });
  panel.addEventListener('touchmove', onTouchMove, { passive: false });
  panel.addEventListener('touchend', onTouchEnd);
  panel.addEventListener('touchcancel', onTouchCancel);
  panel.addEventListener('pointerdown', onPointerDown);
  panel.addEventListener('pointermove', onPointerMove);
  panel.addEventListener('pointerup', onPointerUp);
  panel.addEventListener('pointercancel', onPointerUp);
  panel.addEventListener('click', onClick, true);
  return () => {
    panel.removeEventListener('touchstart', onTouchStart);
    panel.removeEventListener('touchmove', onTouchMove);
    panel.removeEventListener('touchend', onTouchEnd);
    panel.removeEventListener('touchcancel', onTouchCancel);
    panel.removeEventListener('pointerdown', onPointerDown);
    panel.removeEventListener('pointermove', onPointerMove);
    panel.removeEventListener('pointerup', onPointerUp);
    panel.removeEventListener('pointercancel', onPointerUp);
    panel.removeEventListener('click', onClick, true);
    panel.removeAttribute('data-dragging');
  };
}
