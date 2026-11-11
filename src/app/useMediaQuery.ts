import { useSyncExternalStore } from 'react';

/**
 * Whether a media query matches, kept current.
 *
 * For the few places where a width decides something CSS cannot — a chart
 * that is drawn at 64 instead of 80 units, not merely squeezed into 64px.
 * Layout itself stays in the stylesheets. Where there is no `matchMedia`
 * (a server render, a test without one) the answer is `false`.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () =>
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(query).matches
        : false,
    () => false,
  );
}
