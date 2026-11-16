import { describe, expect, it } from 'vitest';
import { FOCUS, STAGE, clampWindow, clampZoom, fitZoom, focusOn, pictureAt, pictureBox, pinchWindow, windowRect, type Box } from './framing';
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

describe('a group above its sheet (block 7C, contract §9)', () => {
  /** The strip that is free above the sheet on an iPhone: about four tenths of the stage, from its top. */
  const STRIP = { top: 0, bottom: 0.42 };
  /** Where a point of the picture stands on the stage. */
  const onStage = (point: { x: number; y: number }, centre: { x: number; y: number }, zoom: number) => ({
    x: 0.5 + (point.x - centre.x) * zoom,
    y: 0.5 + (point.y - centre.y) * zoom,
  });
  const middle = (box: Box) => ({ x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 });

  it('puts the group in the middle of the strip', () => {
    const chest: Box = { x0: 0.34, y0: 0.26, x1: 0.66, y1: 0.36 };
    const { zoom, centre } = focusOn(chest, STRIP);
    const at = onStage(middle(chest), centre, zoom);
    expect(at.x).toBeCloseTo(0.5, 9);
    expect(at.y).toBeCloseTo(0.21, 9);
  });

  it('shows it as large as it fits, with its margin', () => {
    const chest: Box = { x0: 0.3, y0: 0.26, x1: 0.7, y1: 0.36 };
    const { zoom, centre } = focusOn(chest, STRIP);
    const room = 1 - 2 * FOCUS.margin;
    // The width is what limits the chest: 0.4 of the picture across the stage.
    expect(zoom).toBeCloseTo(room / 0.4, 9);
    const top = onStage({ x: chest.x0, y: chest.y0 }, centre, zoom);
    const bottom = onStage({ x: chest.x1, y: chest.y1 }, centre, zoom);
    expect(top.x).toBeCloseTo(FOCUS.margin, 9);
    expect(bottom.x).toBeCloseTo(1 - FOCUS.margin, 9);
    // And it stands wholly in the strip.
    expect(top.y).toBeGreaterThan(STRIP.top);
    expect(bottom.y).toBeLessThan(STRIP.bottom);
  });

  it('a tall group is limited by the strip\'s height', () => {
    const thighs: Box = { x0: 0.36, y0: 0.5, x1: 0.64, y1: 0.72 };
    const { zoom, centre } = focusOn(thighs, STRIP);
    expect(zoom).toBeCloseTo((0.42 * (1 - 2 * FOCUS.margin)) / 0.22, 9);
    const top = onStage({ x: thighs.x0, y: thighs.y0 }, centre, zoom);
    const bottom = onStage({ x: thighs.x1, y: thighs.y1 }, centre, zoom);
    expect(top.y).toBeCloseTo(0.42 * FOCUS.margin, 9);
    expect(bottom.y).toBeCloseTo(0.42 * (1 - FOCUS.margin), 9);
  });

  it('never shows a group larger than its largest zoom', () => {
    const small: Box = { x0: 0.48, y0: 0.3, x1: 0.52, y1: 0.32 };
    expect(focusOn(small, STRIP).zoom).toBe(FOCUS.zoomMax);
  });

  it('does not make the body smaller for a group taller than the strip: its middle stands in the strip\'s middle', () => {
    const back: Box = { x0: 0.3, y0: 0.22, x1: 0.7, y1: 0.7 };
    const { zoom, centre } = focusOn(back, STRIP);
    expect(zoom).toBe(1);
    expect(onStage(middle(back), centre, zoom).y).toBeCloseTo(0.21, 9);
  });

  it('may leave the picture: a group at the feet is lifted into the strip', () => {
    const calves: Box = { x0: 0.38, y0: 0.78, x1: 0.62, y1: 0.9 };
    const { zoom, centre } = focusOn(calves, STRIP);
    const rect = windowRect(centre, zoom);
    // The window ends below the picture — under the sheet, where nobody sees it.
    expect(rect.y + rect.height).toBeGreaterThan(1);
    expect(onStage(middle(calves), centre, zoom).y).toBeCloseTo(0.21, 9);
  });

  it('follows a strip that does not begin at the stage\'s top', () => {
    const chest: Box = { x0: 0.34, y0: 0.26, x1: 0.66, y1: 0.36 };
    const { zoom, centre } = focusOn(chest, { top: 0.1, bottom: 0.5 });
    expect(onStage(middle(chest), centre, zoom).y).toBeCloseTo(0.3, 9);
  });

  it('a strip with no room keeps the body at its size', () => {
    const chest: Box = { x0: 0.34, y0: 0.26, x1: 0.66, y1: 0.36 };
    expect(focusOn(chest, { top: 0.4, bottom: 0.4 }).zoom).toBe(1);
  });
});
