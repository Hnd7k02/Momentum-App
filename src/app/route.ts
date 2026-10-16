import { useCallback, useEffect, useState } from 'react';
import type { TabId } from './TabBar';

/**
 * The two areas the domain terminal switches between: Mind and Gym (WP3
 * Stage 4, D139). An address left by an older build — `#/areas/food` — names
 * no area any more and lands on Bereiche with the hash corrected.
 */
export type DomainTerminal = 'mental' | 'gym';

/**
 * Where the user is: one tab, and — on the domain terminal — one area.
 *
 * This is the **one authoritative source** of navigation state. The tab bar,
 * the domain switch and the rendered screen all derive from it, and the URL
 * hash mirrors it, so a link can name a place (`#/progress/gym`) and the
 * browser's Back button walks the places the user actually visited.
 *
 * The hash is a mirror, not a second state: `navigate` writes the state and
 * the hash together, and a `popstate` reads the hash back into the state.
 * Nothing else touches either. Sheets, edit windows and onboarding are not
 * places and never enter the URL.
 *
 * The area is kept in the state even while another tab is open, so coming
 * back to the terminal restores the area that was being looked at; the hash
 * carries it only where it applies.
 */
/**
 * A destination inside the Gym area (WP2-2). `muscles` is the muscle-group
 * progress view — the one place the 3D body is rendered. The hub itself has
 * no section: it *is* `#/areas/gym`.
 */
export type GymSection = 'muscles';

export interface Route {
  tab: TabId;
  terminal: DomainTerminal;
  /** Only meaningful on the Gym area; absent everywhere else. */
  section?: GymSection;
}

const TABS: readonly TabId[] = ['today', 'progress', 'rank', 'areas'];
export const TERMINALS: readonly DomainTerminal[] = ['mental', 'gym'];
const GYM_SECTIONS: readonly GymSection[] = ['muscles'];

const isTab = (value: string): value is TabId => (TABS as readonly string[]).includes(value);
const isTerminal = (value: string): value is DomainTerminal =>
  (TERMINALS as readonly string[]).includes(value);
const isGymSection = (value: string): value is GymSection =>
  (GYM_SECTIONS as readonly string[]).includes(value);

/**
 * `#/areas/gym` → `{ tab: 'areas', terminal: 'gym' }`,
 * `#/areas/gym/muscles` → the same with `section: 'muscles'`; anything else
 * → `null`. A section on any other area is not a place and is dropped.
 */
export function parseRoute(hash: string): Partial<Route> | null {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [tab, terminal, section] = parts;
  if (!tab || !isTab(tab)) return null;
  if (tab === 'areas' && terminal && isTerminal(terminal)) {
    if (terminal === 'gym' && section && isGymSection(section)) return { tab, terminal, section };
    return { tab, terminal };
  }
  return { tab };
}

/** The hash for a route. The area and the section appear only where they mean something. */
export function formatRoute(route: Route): string {
  if (route.tab !== 'areas') return `#/${route.tab}`;
  const section = route.terminal === 'gym' && route.section ? `/${route.section}` : '';
  return `#/${route.tab}/${route.terminal}${section}`;
}

/**
 * The route after a change. A section belongs to the place it was opened
 * in, so moving tab or area leaves it behind unless the move names one.
 */
export function mergeRoute(previous: Route, next: Partial<Route>): Route {
  const moved = next.tab !== undefined || next.terminal !== undefined;
  const section = 'section' in next ? next.section : moved ? undefined : previous.section;
  const merged: Route = { tab: next.tab ?? previous.tab, terminal: next.terminal ?? previous.terminal };
  if (section !== undefined && merged.tab === 'areas' && merged.terminal === 'gym') merged.section = section;
  return merged;
}

const hasWindow = typeof window !== 'undefined' && typeof window.history !== 'undefined';

function fromLocation(fallback: Route): Route {
  if (!hasWindow) return fallback;
  const parsed = parseRoute(window.location.hash);
  return parsed ? mergeRoute(fallback, parsed) : fallback;
}

/**
 * The route and the one way to change it.
 *
 * `replace` rewrites the current history entry instead of adding one — for a
 * correction the user did not make. A user's own tap always pushes, so Back
 * always goes where they came from.
 */
export function useRoute(initial: Route): {
  route: Route;
  navigate(next: Partial<Route>, options?: { replace?: boolean }): void;
  /**
   * Leaves the current place the way it was entered: if the app pushed it,
   * Back walks the history entry — so a section opened from its hub returns
   * to the hub without leaving a second hub entry behind it; if the user
   * arrived by link, there is nothing to walk and `next` replaces it.
   */
  leave(next: Partial<Route>): void;
} {
  const [route, setRoute] = useState<Route>(() => fromLocation(initial));

  // The first render establishes the hash if the address bar had none, so
  // Back from the first place the user visits has somewhere to go.
  useEffect(() => {
    if (!hasWindow) return undefined;
    const current = formatRoute(route);
    if (window.location.hash !== current) {
      window.history.replaceState(null, '', current);
    }
    const onPop = () => {
      // A hash that names no place — typed, or left by an older build —
      // does not move the user; the screen stays and the hash is corrected
      // to it, so state and address never disagree. A fresh load of an
      // unknown tab falls back to Today through `fromLocation` above; a
      // known tab with an unknown area (`#/areas/food`) keeps the tab.
      setRoute((previous) => {
        const next = fromLocation(previous);
        const hash = formatRoute(next);
        if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
        return next;
      });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // Only on mount: later hashes are written by `navigate` below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = useCallback((next: Partial<Route>, options?: { replace?: boolean }) => {
    setRoute((previous) => {
      const merged = mergeRoute(previous, next);
      if (hasWindow) {
        const hash = formatRoute(merged);
        if (window.location.hash !== hash) {
          // A pushed entry is marked, so `leave` knows Back has somewhere to go.
          if (options?.replace) window.history.replaceState(null, '', hash);
          else window.history.pushState({ pushed: true }, '', hash);
        }
      }
      return merged;
    });
  }, []);

  const leave = useCallback(
    (next: Partial<Route>) => {
      const pushed = hasWindow && (window.history.state as { pushed?: boolean } | null)?.pushed === true;
      if (pushed) window.history.back();
      else navigate(next, { replace: true });
    },
    [navigate],
  );

  return { route, navigate, leave };
}
