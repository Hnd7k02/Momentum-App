/**
 * What a move to the Gym hub was made for (the tidy-up of WP3, D163).
 *
 * «Pläne verwalten» in the plan chooser leads to the training plans, which
 * stand on the hub — far down it. The chooser opens on three screens, and
 * on two of them, Heute and Muskelgruppen, the hub is somewhere else: the
 * move got there and arrived at its top, because whoever arrives at the hub
 * did not bring what they came for. This is that one thing, said once: the
 * screen that sends the user names the intent before it moves, and the hub
 * takes it when it stands — scrolls its plans into view and puts the focus
 * on them.
 *
 * It is not a place. The address is the hub's, no link names it, a reload
 * forgets it, and Back from the hub leads where the user came from, as
 * after any move there. It is taken once: the hub opened again by a tab or
 * a link starts at its top.
 */
export type HubIntent = 'plans';

let pending: HubIntent | null = null;

/** Said before the move to the hub: what the hub is opened for. */
export function arriveAt(intent: HubIntent): void {
  pending = intent;
}

/** The hub's, once it stands: the intent it was opened with, and none after. */
export function takeHubIntent(): HubIntent | null {
  const intent = pending;
  pending = null;
  return intent;
}
