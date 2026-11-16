/**
 * Which group a tap means (block 7B, contract §8).
 *
 * **What you see is what you tap.** A tap means the surface the finger
 * sees: the first thing a ray from the eye meets, whichever region it
 * belongs to. Head, hands and feet are never selectable — and they are not
 * see-through either. Until this block a tap on a hand went on to whatever
 * lay behind it, so a hand in front of a thigh selected the thigh; now it
 * is a neutral surface like any other, and selects nothing by itself.
 *
 * **Twelve pixels of tolerance.** A tap that lands on no group — beside the
 * body, or on a neutral surface — selects the nearest group whose visible
 * surface lies within 12 screen pixels of it. That is what makes the
 * forearms, a few pixels wide on a narrow phone, a target a thumb can hit;
 * and it holds at the neutral zone's edge too: a tap on the hand, a few
 * pixels below the wrist, means the forearm. The 12 are CSS pixels of the
 * screen, whatever the zoom and the pixel ratio.
 *
 * The tap is probed where it landed first; only when that is no group are
 * the rings around it probed, nearest first. A tap further than 12 pixels
 * from every group selects nothing, and the selection stays as it was.
 */

/** How far beside a group a tap may land and still mean it: CSS pixels. */
export const HIT_TOLERANCE_PX = 12;

/** A place to probe, relative to the tap, in CSS pixels. */
export interface Probe {
  dx: number;
  dy: number;
  /** How far from the tap. */
  distance: number;
}

/**
 * The rings around a tap: 4, 8 and 12 pixels out, with enough points on
 * each that no gap between two neighbours is wider than about five pixels
 * — a forearm is wider than that on every phone the app supports. Each
 * ring is turned against the one before, so their points do not line up.
 */
export const RINGS: readonly (readonly Probe[])[] = [
  ring(4, 8, 0),
  ring(8, 12, 0.5),
  ring(HIT_TOLERANCE_PX, 16, 0.25),
];

function ring(distance: number, points: number, turn: number): Probe[] {
  return Array.from({ length: points }, (_, index) => {
    const angle = ((index + turn) / points) * 2 * Math.PI;
    return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance, distance };
  });
}

/**
 * The group a ring means: the one most of its probes saw, and of two seen
 * equally often the one seen first — the rings are walked in a fixed
 * order, so the same tap always means the same group. `null` when no probe
 * of the ring saw a group.
 */
export function groupOfRing<T extends string>(seen: readonly (T | null)[]): T | null {
  const counts = new Map<T, number>();
  for (const group of seen) {
    if (group !== null) counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  let best: T | null = null;
  let most = 0;
  for (const [group, count] of counts) {
    if (count > most) {
      best = group;
      most = count;
    }
  }
  return best;
}

/**
 * The group a tap means, given a way to ask what is seen at a place:
 * `look(dx, dy)` returns the group whose surface is visible there, or
 * `null` for a neutral surface and for nothing at all.
 */
export function groupAtTap<T extends string>(look: (dx: number, dy: number) => T | null): T | null {
  const direct = look(0, 0);
  if (direct !== null) return direct;
  for (const probes of RINGS) {
    const found = groupOfRing(probes.map((probe) => look(probe.dx, probe.dy)));
    if (found !== null) return found;
  }
  return null;
}
