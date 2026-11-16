import { useEffect, useRef } from 'react';

/**
 * A layer the browser's Back closes, without the address naming a new place
 * (block 7C, contract §9).
 *
 * The muscle sheet and the exercise detail opened from it are not places: a
 * link cannot name them, and `route.ts` keeps knowing nothing of them. But
 * Back — the gesture from the edge of an iPhone, the button of a browser —
 * must close them one by one instead of leaving the screen underneath. So an
 * open layer owns **one history entry with the very address of the screen it
 * lies on**, marked in its state with how many layers lie on that screen.
 * Going back pops the entry, the address does not change, and whoever opened
 * the layer is told to close it.
 *
 * The history is made to follow the layers, never the other way round:
 *
 * - A layer that opens adds an entry; one that is closed some other way —
 *   its cross, Escape, a drag — takes its entry with it.
 * - Both happen in one step after the render that changed them, by counting:
 *   the entries on top must be as many as the layers that are open. A layer
 *   that closes while another opens reuses the entry; two that close at once
 *   go back two.
 * - A Back the user made closes every layer above the entry it lands on,
 *   innermost first.
 *
 * An entry whose layer is long gone — reached with Forward, or after a
 * reload — is the screen itself: nothing opens from an address.
 */

interface Layer {
  close(): void;
}

const layers: Layer[] = [];
/** Traversals this module asked for and has not yet seen land. */
let settling = 0;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let scheduled = false;
let listening = false;

/** How many layers the current history entry says lie on its screen. */
export function layerDepth(state: unknown): number {
  const depth = (state as { layer?: unknown } | null)?.layer;
  return typeof depth === 'number' && Number.isInteger(depth) && depth > 0 ? depth : 0;
}

function reconcile(): void {
  scheduled = false;
  // Our own step back is still on its way: the entry it lands on decides.
  if (settling > 0) return;
  const depth = layerDepth(window.history.state);
  if (depth > layers.length) {
    settling += 1;
    // A traversal that cannot happen reports nothing; do not wait for ever.
    if (settleTimer !== null) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      settleTimer = null;
      settling = 0;
      schedule();
    }, 1000);
    window.history.go(layers.length - depth);
    return;
  }
  for (let next = depth + 1; next <= layers.length; next += 1) {
    const state = (window.history.state ?? {}) as Record<string, unknown>;
    // The same address: a layer is not a place.
    window.history.pushState({ ...state, layer: next }, '');
  }
}

function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(reconcile);
}

function onPop(): void {
  if (settling > 0) {
    // The step back this module took for a layer that was closed by hand.
    settling -= 1;
    if (settling === 0 && settleTimer !== null) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    schedule();
    return;
  }
  // The user went back: every layer above this entry closes, innermost first.
  const depth = layerDepth(window.history.state);
  while (layers.length > depth) layers.pop()!.close();
}

/**
 * While `open`, Back closes this layer: `onBack` is called, and the caller
 * closes it as it would for its own cross. Closing it any other way needs
 * nothing more — the entry follows.
 *
 * Layers nest in the order they open; a caller with two — a sheet and the
 * detail opened from it — calls this once for each, the outer one first.
 */
export function useBackLayer(open: boolean, onBack: () => void): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!open || typeof window === 'undefined' || typeof window.history === 'undefined') return undefined;
    if (!listening) {
      listening = true;
      window.addEventListener('popstate', onPop);
    }
    const layer: Layer = { close: () => onBackRef.current() };
    layers.push(layer);
    schedule();
    return () => {
      const index = layers.indexOf(layer);
      // Back has closed it and taken its entry already.
      if (index === -1) return;
      layers.splice(index, 1);
      schedule();
    };
  }, [open]);
}

/** For tests: forget every layer and every pending step. */
export function resetBackLayers(): void {
  layers.length = 0;
  settling = 0;
  scheduled = false;
  if (settleTimer !== null) clearTimeout(settleTimer);
  settleTimer = null;
}
