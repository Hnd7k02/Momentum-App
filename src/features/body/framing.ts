import { MOTION } from './motion';

/**
 * Where the body stands in its stage, and what a zoom shows of it
 * (block 7B, contract §8).
 *
 * **One framing for every stage.** The camera's angle of view is fixed, so
 * the body takes the same share of the stage's height on every phone and
 * its still picture can stand in the same place while it loads. (Until this
 * block the angle followed the height of a card, 27° at 400px; the stage is
 * as tall as 55 % of the screen, and what it needs is the opposite — a body
 * that grows with it.)
 *
 * **A zoom is a window on the picture.** The camera does not come closer
 * and its perspective does not change: the stage shows a part of the
 * unzoomed picture, 1/zoom of its width and height, and the window's place
 * is all there is to decide. Three rules place it, in this order:
 *
 * 1. It never leaves the picture: no zoom shows the empty ground beside the
 *    body's frame, and at 1.0 it is the whole picture again.
 * 2. A chosen group stays inside it. Whatever the fingers do, the group
 *    that is selected does not fall out of the stage; where the fingers ask
 *    for a window that would lose it, the window stops at its edge.
 * 3. Otherwise it follows the fingers: what was under the two fingers when
 *    they came down stays under them.
 *
 * Everything here is arithmetic on numbers between 0 and 1 — the picture's
 * own coordinates, x to the right and y down — so it is tested without a
 * camera (`framing.test.ts`), and block 7C can ask the same functions for
 * the window that holds a group above its sheet.
 */

export const STAGE = {
  /**
   * The camera's vertical angle of view, in degrees: seen level, the body
   * takes 82 % of the stage's height. The room above its head is the row
   * of buttons — 44px, a ninth of the stage on the smallest phone — and
   * the room under its feet is the ground it stands on.
   */
  fov: 29.6,
  /** How far the camera stands from the point it turns about. */
  distance: 4.05,
  /** That point: on the body's axis, above its middle, so the body stands low in its stage. */
  target: [0, 0.945, 0] as const,
  /** The room a chosen group keeps to the window's edge, as a share of the picture. */
  keepMargin: 0.02,
} as const;

/** A point or a size in the picture: 0–1, x to the right, y down. */
export interface Point {
  x: number;
  y: number;
}

/** A rectangle in the picture. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const clamp = (value: number, low: number, high: number) => (value < low ? low : value > high ? high : value);

/** The zoom, held to its range. */
export function clampZoom(zoom: number): number {
  return clamp(zoom, MOTION.zoomMin, MOTION.zoomMax);
}

function keepOnAxis(centre: number, half: number, from: number | null, to: number | null): number {
  let value = centre;
  if (from !== null && to !== null) {
    // The window [value − half, value + half] must hold [from, to] and its margin.
    const low = to + STAGE.keepMargin - half;
    const high = from - STAGE.keepMargin + half;
    // A group wider than the window cannot be held whole: its middle is.
    value = low > high ? (from + to) / 2 : clamp(value, low, high);
  }
  // Rule 1 last, so it always holds: the window stays inside the picture.
  return clamp(value, half, 1 - half);
}

/**
 * The window's centre, moved as little as the rules ask. `keep` is the
 * chosen group's box in the picture, or `null` with nothing chosen.
 */
export function clampWindow(centre: Point, zoom: number, keep: Box | null): Point {
  const half = 0.5 / Math.max(zoom, 1);
  return {
    x: keepOnAxis(centre.x, half, keep ? keep.x0 : null, keep ? keep.x1 : null),
    y: keepOnAxis(centre.y, half, keep ? keep.y0 : null, keep ? keep.y1 : null),
  };
}

/** The point of the picture that a point of the stage shows. */
export function pictureAt(stage: Point, centre: Point, zoom: number): Point {
  return { x: centre.x + (stage.x - 0.5) / zoom, y: centre.y + (stage.y - 0.5) / zoom };
}

/**
 * The window after two fingers moved (rule 3): the zoom they ask for, held
 * to its range, and the centre that keeps `held` — the point of the picture
 * that was under their middle when they came down — under their middle
 * now. The caller clamps the result.
 */
export function pinchWindow(
  held: Point,
  /** The fingers' middle now, on the stage. */
  middle: Point,
  startZoom: number,
  /** How far apart the fingers are now, over how far apart they were. */
  spread: number,
): { zoom: number; centre: Point } {
  const zoom = clampZoom(startZoom * spread);
  return {
    zoom,
    centre: { x: held.x - (middle.x - 0.5) / zoom, y: held.y - (middle.y - 0.5) / zoom },
  };
}

/** The camera's view offset for a window: the part of the picture to draw, as shares of it. */
export function windowRect(centre: Point, zoom: number): { x: number; y: number; width: number; height: number } {
  const size = 1 / zoom;
  return { x: centre.x - size / 2, y: centre.y - size / 2, width: size, height: size };
}

/**
 * The box in the picture that holds a set of points given in the camera's
 * own space (x right, y up, the camera looking down −z). Points behind the
 * camera are left out; with none in front there is no box.
 */
export function pictureBox(points: readonly (readonly [number, number, number])[], aspect: number): Box | null {
  const slope = Math.tan((STAGE.fov * Math.PI) / 360);
  let box: Box | null = null;
  for (const [x, y, z] of points) {
    if (z >= -1e-6) continue;
    const px = 0.5 + x / (-z * slope * aspect) / 2;
    const py = 0.5 - y / (-z * slope) / 2;
    if (!box) box = { x0: px, y0: py, x1: px, y1: py };
    else {
      if (px < box.x0) box.x0 = px;
      if (px > box.x1) box.x1 = px;
      if (py < box.y0) box.y0 = py;
      if (py > box.y1) box.y1 = py;
    }
  }
  return box;
}

/** The largest zoom at which a box still fits the window, with its margin — never above the range. */
export function fitZoom(box: Box): number {
  const width = box.x1 - box.x0 + 2 * STAGE.keepMargin;
  const height = box.y1 - box.y0 + 2 * STAGE.keepMargin;
  return clampZoom(1 / Math.max(width, height, 1e-6));
}
