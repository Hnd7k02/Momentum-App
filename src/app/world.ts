import { useLayoutEffect } from 'react';

/**
 * The two worlds (WP3 Stage 6, P11): Mind is light and Gym is dark.
 *
 * A screen declares the world it belongs to while it is mounted, and the
 * document carries the result as `data-world` on `<html>`. Everything reads
 * its colours from the design tokens, and the Gym token set is scoped to
 * that attribute in `tokens.css`, so one attribute at the root turns the
 * whole display — the screen, the tab bar, a toast, and the sheets that
 * render into `<body>` outside the screen that opened them.
 *
 * The root, not the screen, because the Gym screens are not one subtree:
 * the workout and the exercise detail are overlays mounted by whichever
 * host opened them — Heute or the hub — and a sheet is a portal. The claim
 * is counted rather than toggled: a workout opened over the Gym hub holds
 * the world until both have gone.
 *
 * The status bar follows. `theme-color` is the one colour iOS reads for the
 * band above the page, and it is rewritten from the `--status-bar` token of
 * the world now in force — never a literal here.
 */
export type World = 'mind' | 'gym';

let gymClaims = 0;

function apply(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (gymClaims > 0) root.setAttribute('data-world', 'gym');
  else root.removeAttribute('data-world');
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) return;
  const colour = getComputedStyle(root).getPropertyValue('--status-bar').trim();
  if (colour) meta.setAttribute('content', colour);
}

/** Holds the Gym world while the calling screen is mounted with `world === 'gym'`. */
export function useWorld(world: World): void {
  useLayoutEffect(() => {
    if (world !== 'gym') return undefined;
    gymClaims += 1;
    apply();
    return () => {
      gymClaims -= 1;
      apply();
    };
  }, [world]);
}

/** The world the document is in right now. */
export function currentWorld(): World {
  return gymClaims > 0 ? 'gym' : 'mind';
}
