/**
 * What was typed into a sheet that Back closed (the tidy-up of WP3, D187).
 *
 * Back — the gesture from the edge of an iPhone, the button of a browser —
 * closes every sheet. On an iPhone that gesture is made by accident as
 * easily as on purpose, so the owner's condition is that **a sheet with
 * fields loses nothing typed** by it. The answer is the quiet one: the
 * sheet goes, as Back says, and what stood in its fields is kept here and
 * stands there again the next time the same sheet opens for the same
 * thing. No question is asked on the way out — a question would have to
 * hold a sheet open against the step back the browser has already taken.
 *
 * A draft is what was on screen, never a stored value: it lives in memory
 * for as long as the app is open, is handed back once and is gone. The
 * sheet's own ways out — its cross, the ground behind it, Escape, its
 * buttons — are decisions about what was typed and keep nothing, exactly
 * as before.
 */
const kept = new Map<string, unknown>();

/** Back closed the sheet: what stood in its fields, under the thing it was open for. */
export function keepDraft<T>(key: string, draft: T): void {
  kept.set(key, draft);
}

/** The sheet opens: what Back left behind for it, once — or nothing. */
export function takeDraft<T>(key: string): T | null {
  if (!kept.has(key)) return null;
  const draft = kept.get(key) as T;
  kept.delete(key);
  return draft;
}

/** For tests: forget every draft. */
export function forgetDrafts(): void {
  kept.clear();
}
