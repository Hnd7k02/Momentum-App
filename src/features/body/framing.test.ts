import { describe, expect, it } from 'vitest';
import { STAGE, clampWindow, clampZoom, fitZoom, pictureAt, pictureBox, pinchWindow, windowRect, type Box } from './framing';
import { MOTION } from './motion';

/**
 * What a zoom shows (block 7B, contract §8): a window on the picture that
 * never leaves it, keeps a chosen group inside and otherwise follows the
 * fingers.
 */

/** Whether a window holds a box, margin included. */
function holds(centre: { x: number; y: number }, zoom: number, box: Box): boolean {
  const rect = windowRect(centre, zoom);
  const m = STAGE.keepMargin - 1e-9;
  return (
    rect.x <= box.x0 - m && rect.x + rect.width >= box.x1 + m && rect.y <= box.y0 - m && rect.y + rect.height >= box.y1 + m
  );
}

describe('the zoom', () => {
  it('lies between 1.0 and 1.8', () => {
    expect(MOTION.zoomMin).toBe(1);
    expect(MOTION.zoomMax).toBe(1.8);
    expect(clampZoom(0.4)).toBe(1);
    expect(clampZoom(1.37)).toBe(1.37);
    expect(clampZoom(5)).toBe(1.8);
  });

  it('at 1.0 the window is the whole picture, wherever it was asked to be', () => {
    expect(clampWindow({ x: 0.1, y: 0.9 }, 1, null)).toEqual({ x: 0.5, y: 0.5 });
    expect(windowRect({ x: 0.5, y: 0.5 }, 1)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
});

describe('the window never leaves the picture', () => {
  it('stops at each edge', () => {
    for (const zoom of [1.2, 1.5, 1.8]) {
      for (const asked of [{ x: -3, y: -3 }, { x: 4, y: 0.5 }, { x: 0.5, y: 9 }, { x: 0.02, y: 0.98 }]) {
        const rect = windowRect(clampWindow(asked, zoom, null), zoom);
        expect(rect.x).toBeGreaterThanOrEqual(-1e-12);
        expect(rect.y).toBeGreaterThanOrEqual(-1e-12);
        expect(rect.x + rect.width).toBeLessThanOrEqual(1 + 1e-12);
        expect(rect.y + rect.height).toBeLessThanOrEqual(1 + 1e-12);
      }
    }
  });

  it('a window inside the picture is left where the fingers put it', () => {
    expect(clampWindow({ x: 0.45, y: 0.6 }, 1.8, null)).toEqual({ x: 0.45, y: 0.6 });
  });
});

describe('a chosen group stays in the window', () => {
  // The forearms from the front, roughly: the widest group there is.
  const forearms: Box = { x0: 0.28, y0: 0.38, x1: 0.72, y1: 0.52 };
  const calves: Box = { x0: 0.38, y0: 0.72, x1: 0.62, y1: 0.93 };

  it('whatever window the fingers ask for', () => {
    for (const zoom of [1.2, 1.5, 1.8]) {
      for (let x = 0; x <= 1; x += 0.125) {
        for (let y = 0; y <= 1; y += 0.125) {
          expect(holds(clampWindow({ x, y }, zoom, forearms), zoom, forearms), `forearms ${zoom} ${x} ${y}`).toBe(true);
          expect(holds(clampWindow({ x, y }, zoom, calves), zoom, calves), `calves ${zoom} ${x} ${y}`).toBe(true);
        }
      }
    }
  });

  it('and the window moves no further than it has to', () => {
    // Zoomed on the chest; the calves are chosen in the list.
    const before = { x: 0.5, y: 0.3 };
    const after = clampWindow(before, 1.8, calves);
    expect(after.x).toBe(0.5);
    // The window's lower edge is where the calves end, plus the margin.
    expect(after.y + 0.5 / 1.8).toBeCloseTo(calves.y1 + STAGE.keepMargin, 9);
    // A window that already holds the group is not moved at all.
    expect(clampWindow(after, 1.8, calves)).toEqual(after);
  });

  it('a group wider than the window is held by its middle', () => {
    const wide: Box = { x0: 0.1, y0: 0.4, x1: 0.9, y1: 0.5 };
    const centre = clampWindow({ x: 0.2, y: 0.45 }, 1.8, wide);
    expect(centre.x).toBeCloseTo(0.5, 9);
    expect(fitZoom(wide)).toBeCloseTo(1 / 0.84, 9);
  });

  it('still never leaves the picture for it', () => {
    const corner: Box = { x0: 0.0, y0: 0.0, x1: 0.1, y1: 0.1 };
    const rect = windowRect(clampWindow({ x: 0.5, y: 0.5 }, 1.8, corner), 1.8);
    expect(rect.x).toBeGreaterThanOrEqual(-1e-12);
    expect(rect.y).toBeGreaterThanOrEqual(-1e-12);
  });

  it('every group of the body fits the window at the largest zoom', () => {
    // The largest box a group has in the picture is under 1/1.8 minus the margins.
    expect(fitZoom(forearms)).toBe(1.8);
    expect(fitZoom(calves)).toBe(1.8);
  });
});

describe('two fingers', () => {
  it('what was under them stays under them', () => {
    // Fingers come down around a point of the stage; the window is unzoomed.
    const start = { x: 0.3, y: 0.7 };
    const held = pictureAt(start, { x: 0.5, y: 0.5 }, 1);
    expect(held).toEqual(start);
    // They spread to one and a half times the distance, without moving.
    const { zoom, centre } = pinchWindow(held, start, 1, 1.5);
    expect(zoom).toBe(1.5);
    expect(pictureAt(start, centre, zoom).x).toBeCloseTo(held.x, 12);
    expect(pictureAt(start, centre, zoom).y).toBeCloseTo(held.y, 12);
    // And when their middle moves, the picture moves with it.
    const moved = pinchWindow(held, { x: 0.5, y: 0.5 }, 1, 1.5);
    expect(pictureAt({ x: 0.5, y: 0.5 }, moved.centre, moved.zoom).x).toBeCloseTo(held.x, 12);
  });

  it('cannot zoom past either end', () => {
    const held = { x: 0.5, y: 0.5 };
    expect(pinchWindow(held, held, 1, 4).zoom).toBe(1.8);
    expect(pinchWindow(held, held, 1.8, 0.1).zoom).toBe(1);
    expect(pinchWindow(held, held, 1.4, 1).zoom).toBe(1.4);
  });
});

describe('a box in the picture', () => {
  it('puts the point the camera looks at in the middle, and a point above it higher', () => {
    const box = pictureBox([[0, 0, -4], [0, 0.5, -4], [0.5, 0, -4]], 0.84);
    expect(box!.x0).toBeCloseTo(0.5, 9);
    expect(box!.y1).toBeCloseTo(0.5, 9);
    // Up in the camera's space is up in the picture: a smaller y.
    expect(box!.y0).toBeLessThan(0.5);
    // To the right is a larger x.
    expect(box!.x1).toBeGreaterThan(0.5);
  });

  it('the body takes 82 % of the stage\'s height', () => {
    // 1.75 m tall, seen level from the stage's distance.
    const half = 1.75 / 2;
    const box = pictureBox([[0, half, -STAGE.distance], [0, -half, -STAGE.distance]], 0.84)!;
    expect(box.y1 - box.y0).toBeCloseTo(0.82, 2);
  });

  it('leaves out what is behind the camera', () => {
    expect(pictureBox([[0, 0, 1]], 1)).toBeNull();
    expect(pictureBox([], 1)).toBeNull();
  });
});
