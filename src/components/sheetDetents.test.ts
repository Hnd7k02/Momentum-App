import { describe, expect, it } from 'vitest';
import { SHEET_DRAG, SHEET_Y, dragIsSheets, releaseSpeed, releaseTarget } from './sheetDetents';

/**
 * A sheet with two heights (block 7C, contract §9): where a released sheet
 * comes to rest, and who a drag belongs to. The offsets are those of an
 * iPhone 15 Pro: 852 px high, the upper detent 784 px tall, the lower one
 * 216 px further down.
 */
const LOWER = 216;
const CLOSED = 784;
const at = (offset: number, velocity = 0) => releaseTarget({ offset, lower: LOWER, closed: CLOSED, velocity });

describe('let go slowly, the sheet takes the nearer detent', () => {
  it('between the two detents the middle decides', () => {
    expect(at(0)).toBe('upper');
    expect(at(LOWER / 2 - 1)).toBe('upper');
    expect(at(LOWER / 2)).toBe('lower');
    expect(at(LOWER)).toBe('lower');
  });

  it('goes away only when it was pulled well below the lower detent', () => {
    const edge = LOWER + (CLOSED - LOWER) * SHEET_DRAG.closeShare;
    expect(at(edge)).toBe('lower');
    expect(at(edge + 1)).toBe('closed');
    expect(at(CLOSED)).toBe('closed');
    // A little below the lower detent springs back.
    expect(at(LOWER + 40)).toBe('lower');
  });
});

describe('a flick goes one step in its direction', () => {
  const down = SHEET_DRAG.flick + 0.1;
  const up = -down;

  it('down from the upper detent is the lower one, not away', () => {
    expect(at(20, down)).toBe('lower');
    expect(at(LOWER - SHEET_DRAG.slop - 1, down)).toBe('lower');
  });

  it('down from the lower detent, or from below it, is away', () => {
    expect(at(LOWER, down)).toBe('closed');
    expect(at(LOWER + 30, down)).toBe('closed');
    expect(at(LOWER - SHEET_DRAG.slop, down)).toBe('closed');
  });

  it('up from the lower detent is the upper one', () => {
    expect(at(LOWER, up)).toBe('upper');
    expect(at(LOWER - 30, up)).toBe('upper');
  });

  it('up from below the lower detent stops at it', () => {
    expect(at(LOWER + SHEET_DRAG.slop + 1, up)).toBe('lower');
    expect(at(CLOSED - 50, up)).toBe('lower');
  });

  it('a finger at exactly the flick speed is not a flick', () => {
    expect(at(LOWER + 40, SHEET_DRAG.flick)).toBe('lower');
    expect(at(LOWER - 40, -SHEET_DRAG.flick)).toBe('lower');
  });
});

describe('the finger\'s speed at release', () => {
  it('is read over its last movements', () => {
    const samples = [
      { at: 0, y: 100 },
      { at: 400, y: 110 },
      { at: 420, y: 130 },
      { at: 440, y: 150 },
      { at: 460, y: 170 },
    ];
    // The slow start 400 ms ago is not part of it: 40 px in 40 ms.
    expect(releaseSpeed(samples, 465)).toBeCloseTo(1, 6);
  });

  it('is nothing for a finger that rested before it lifted', () => {
    const samples = [
      { at: 0, y: 100 },
      { at: 20, y: 160 },
    ];
    expect(releaseSpeed(samples, 20 + SHEET_DRAG.velocityRestMs + 1)).toBe(0);
    expect(releaseSpeed(samples, 20 + SHEET_DRAG.velocityRestMs)).toBeCloseTo(3, 6);
  });

  it('is nothing with a single sample, or none', () => {
    expect(releaseSpeed([{ at: 0, y: 5 }], 1)).toBe(0);
    expect(releaseSpeed([], 1)).toBe(0);
  });

  it('is negative upwards', () => {
    expect(releaseSpeed([{ at: 0, y: 200 }, { at: 50, y: 100 }], 55)).toBeCloseTo(-2, 6);
  });
});

describe('who a drag belongs to', () => {
  const drag = (over: Partial<Parameters<typeof dragIsSheets>[0]>) =>
    dragIsSheets({ detent: 'upper', onContent: true, contentAtStart: true, dx: 0, dy: 10, ...over });

  it('on the lower detent every vertical drag is the sheet\'s — up raises it before anything scrolls', () => {
    expect(drag({ detent: 'lower', dy: -10 })).toBe(true);
    expect(drag({ detent: 'lower', dy: 10 })).toBe(true);
    expect(drag({ detent: 'lower', dy: -10, contentAtStart: false })).toBe(true);
  });

  it('on the upper detent the content scrolls', () => {
    expect(drag({ dy: -10 })).toBe(false);
    expect(drag({ dy: -10, contentAtStart: false })).toBe(false);
    expect(drag({ dy: 10, contentAtStart: false })).toBe(false);
  });

  it('at the content\'s very start a drag down takes the sheet with it', () => {
    expect(drag({ dy: 10, contentAtStart: true })).toBe(true);
  });

  it('the grabber and the header always move the sheet', () => {
    expect(drag({ onContent: false, dy: -10 })).toBe(true);
    expect(drag({ onContent: false, dy: 10, contentAtStart: false })).toBe(true);
  });

  it('a drag that begins sideways is nobody\'s', () => {
    expect(drag({ detent: 'lower', dx: 12, dy: 5 })).toBe(false);
    expect(drag({ onContent: false, dx: -12, dy: 5 })).toBe(false);
  });
});

describe('where the sheet stands, as CSS', () => {
  it('nothing at the upper detent, its whole height when it is gone', () => {
    expect(SHEET_Y.upper).toBe('0px');
    expect(SHEET_Y.closed).toBe('100%');
  });

  it('the lower detent is the difference of the two heights, from the tokens', () => {
    expect(SHEET_Y.lower).toContain('--sheet-detent-lower');
    expect(SHEET_Y.lower).toContain('--sheet-detent-upper');
  });
});
