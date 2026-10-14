import { useSyncExternalStore } from 'react';
import { now, today } from '../core/clock';
import type { DateKey } from '../core/dates';

/**
 * The one source of "today" for the screens (WP3, B3).
 *
 * Each screen used to read `today()` while it rendered and keep that answer
 * for as long as it stayed mounted, so an app left open over midnight went on
 * showing yesterday — and wrote the first answer of the morning under it,
 * before jumping to the new day.
 *
 * Here the day is held in one place and moved on:
 *
 * - by a timer at the next local midnight, computed from the local calendar,
 *   so a day of 23 or 25 hours and a midnight that does not exist (a DST jump
 *   at 00:00) all land on the first instant of the new day;
 * - when the page becomes visible again, gains focus or is restored from the
 *   back-forward cache — a phone suspends timers in the background, and the
 *   next look at the app is exactly when the day has to be right;
 * - and, as the backstop, at the very start of any pointer or key input. The
 *   check runs in the capture phase of `pointerdown` and `keydown`, so a day
 *   that has turned re-renders the screen before the `click` or the typed
 *   character that follows reaches it. A tap can therefore never land on a
 *   day the screen no longer shows.
 *
 * Every subscriber sees the same value; a write made from a screen goes to
 * the day that screen shows.
 */

let current: DateKey | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

/** Milliseconds from `from` to the first instant of the next local day. */
export function msUntilNextLocalDay(from: Date): number {
  const next = new Date(from.getTime());
  // `setHours(24)` rolls to the next calendar day in local time; where local
  // midnight does not exist the engine moves forward to the first valid
  // instant, which is the moment that day begins.
  next.setHours(24, 0, 0, 0);
  return Math.max(0, next.getTime() - from.getTime());
}

function check(): void {
  const next = today();
  if (next !== current) {
    current = next;
    for (const listener of [...listeners]) listener();
  }
  schedule();
}

function schedule(): void {
  if (timer !== null) clearTimeout(timer);
  if (listeners.size === 0) {
    timer = null;
    return;
  }
  // A few milliseconds past the boundary, so the new day is unambiguous.
  timer = setTimeout(check, msUntilNextLocalDay(now()) + 50);
}

const onVisibility = () => {
  if (document.visibilityState === 'visible') check();
};
const onInput = () => check();

function attach(): void {
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onInput);
  window.addEventListener('pageshow', onInput);
  document.addEventListener('pointerdown', onInput, true);
  document.addEventListener('keydown', onInput, true);
}

function detach(): void {
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('focus', onInput);
  window.removeEventListener('pageshow', onInput);
  document.removeEventListener('pointerdown', onInput, true);
  document.removeEventListener('keydown', onInput, true);
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) attach();
  listeners.add(listener);
  check();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) detach();
  };
}

function snapshot(): DateKey {
  // Kept while anything is subscribed, so every subscriber in one render
  // agrees and only the checks above move it. With nobody subscribed the
  // kept value may be days old — the first screen of the morning would draw
  // yesterday for one frame — so it is read afresh.
  if (current === null || listeners.size === 0) current = today();
  return current;
}

export function useToday(): DateKey {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Re-reads the clock now. For tests that move the clock by hand. */
export function refreshToday(): void {
  check();
}
