// @vitest-environment happy-dom
import { act, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount, type Mounted } from '../test/dom';
import { FakeHistory } from '../test/history';
import { layerDepth, resetBackLayers, useBackLayer } from './backLayer';

/**
 * A layer Back closes, without a new place in the address (block 7C).
 *
 * The test DOM does not walk its history, so a small one stands in
 * (`test/history.ts`).
 */
let history: FakeHistory;
const realHistory = window.history;

beforeEach(() => {
  history = new FakeHistory();
  Object.defineProperty(window, 'history', { value: history, configurable: true });
  resetBackLayers();
});

let mounted: Mounted | null = null;
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  await landed();
  Object.defineProperty(window, 'history', { value: realHistory, configurable: true });
});

/** Lets the microtask that reconciles, and any traversal it asked for, land. */
async function landed(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
  }
}

let setSheet: (open: boolean) => void = () => undefined;
let setDetail: (open: boolean) => void = () => undefined;
let backs: string[] = [];

/** A sheet and a detail opened from it, as Muskelgruppen holds them. */
function Host() {
  const [sheet, setSheetState] = useState(false);
  const [detail, setDetailState] = useState(false);
  setSheet = setSheetState;
  setDetail = setDetailState;
  useBackLayer(sheet, () => {
    backs.push('sheet');
    setSheetState(false);
  });
  useBackLayer(detail, () => {
    backs.push('detail');
    setDetailState(false);
  });
  return <p id="state">{`${sheet ? 'sheet' : ''}${detail ? '+detail' : ''}`}</p>;
}

const shown = () => document.getElementById('state')!.textContent;

async function start(): Promise<void> {
  backs = [];
  mounted = await mount(<Host />);
}

describe('a layer that opens', () => {
  it('adds one entry with the address it lies on', async () => {
    await start();
    await act(async () => setSheet(true));
    await landed();
    expect(history.length).toBe(2);
    expect(history.url).toBe('#/areas/gym/muscles');
    expect(layerDepth(history.state)).toBe(1);
  });

  it('keeps what the entry beneath says of itself', async () => {
    history.replaceState({ pushed: true }, '');
    await start();
    await act(async () => setSheet(true));
    await landed();
    expect(history.state).toEqual({ pushed: true, layer: 1 });
  });
});

describe('Back', () => {
  it('closes the layer and leaves the place', async () => {
    await start();
    await act(async () => setSheet(true));
    await landed();
    history.back();
    await landed();
    expect(shown()).toBe('');
    expect(backs).toEqual(['sheet']);
    expect(history.index).toBe(0);
    expect(history.url).toBe('#/areas/gym/muscles');
  });

  it('walks back step by step: the detail, then the sheet, then nothing more of ours', async () => {
    await start();
    await act(async () => setSheet(true));
    await landed();
    await act(async () => setDetail(true));
    await landed();
    expect(history.length).toBe(3);
    expect(layerDepth(history.state)).toBe(2);

    history.back();
    await landed();
    expect(shown()).toBe('sheet');
    expect(backs).toEqual(['detail']);
    expect(layerDepth(history.state)).toBe(1);

    history.back();
    await landed();
    expect(shown()).toBe('');
    expect(backs).toEqual(['detail', 'sheet']);
    expect(history.index).toBe(0);
  });
});

describe('a layer closed some other way', () => {
  it('takes its entry with it, and Back is not told', async () => {
    await start();
    await act(async () => setSheet(true));
    await landed();
    await act(async () => setSheet(false));
    await landed();
    expect(history.index).toBe(0);
    expect(backs).toEqual([]);
    expect(shown()).toBe('');
  });

  it('the detail closed by its own button leaves the sheet and the sheet\'s entry', async () => {
    await start();
    await act(async () => setSheet(true));
    await landed();
    await act(async () => setDetail(true));
    await landed();
    await act(async () => setDetail(false));
    await landed();
    expect(shown()).toBe('sheet');
    expect(history.index).toBe(1);
    expect(layerDepth(history.state)).toBe(1);
    // And Back from there closes the sheet.
    history.back();
    await landed();
    expect(shown()).toBe('');
    expect(history.index).toBe(0);
  });

  it('two that close at once go back two, in one step', async () => {
    await start();
    await act(async () => setSheet(true));
    await landed();
    await act(async () => setDetail(true));
    await landed();
    await act(async () => {
      setDetail(false);
      setSheet(false);
    });
    await landed();
    expect(history.index).toBe(0);
    expect(backs).toEqual([]);
  });

  it('a screen that goes with its layers open takes their entries along', async () => {
    await start();
    await act(async () => setSheet(true));
    await landed();
    await act(async () => setDetail(true));
    await landed();
    await mounted!.unmount();
    mounted = null;
    await landed();
    expect(history.index).toBe(0);
  });
});

describe('opening again', () => {
  it('a layer reopened before its entry is gone is not closed by that step back', async () => {
    await start();
    await act(async () => setSheet(true));
    await landed();
    // Closed and opened again within one task: the step back for the first
    // is on its way while the second is open.
    await act(async () => setSheet(false));
    await act(async () => setSheet(true));
    await landed();
    expect(shown()).toBe('sheet');
    expect(backs).toEqual([]);
    expect(layerDepth(history.state)).toBe(1);
    // One entry for one layer: Back closes it and lands on the place.
    history.back();
    await landed();
    expect(shown()).toBe('');
    expect(layerDepth(history.state)).toBe(0);
  });

  it('one layer that closes while another opens reuses the entry', async () => {
    await start();
    await act(async () => setSheet(true));
    await landed();
    await act(async () => {
      setSheet(false);
      setDetail(true);
    });
    await landed();
    expect(history.length).toBe(2);
    expect(history.index).toBe(1);
    expect(shown()).toBe('+detail');
    history.back();
    await landed();
    expect(shown()).toBe('');
  });
});

describe('an entry whose layer is gone', () => {
  it('opens nothing when it is reached again', async () => {
    await start();
    await act(async () => setSheet(true));
    await landed();
    history.back();
    await landed();
    history.forward();
    await landed();
    expect(layerDepth(history.state)).toBe(1);
    expect(shown()).toBe('');
    // A sheet opened there takes that entry rather than adding a second.
    await act(async () => setSheet(true));
    await landed();
    expect(history.length).toBe(2);
    history.back();
    await landed();
    expect(shown()).toBe('');
    expect(history.index).toBe(0);
  });
});

describe('layerDepth', () => {
  it('reads only a whole positive number', () => {
    expect(layerDepth(null)).toBe(0);
    expect(layerDepth(undefined)).toBe(0);
    expect(layerDepth({ pushed: true })).toBe(0);
    expect(layerDepth({ layer: 2 })).toBe(2);
    expect(layerDepth({ layer: 0 })).toBe(0);
    expect(layerDepth({ layer: '1' })).toBe(0);
    expect(layerDepth({ layer: 1.5 })).toBe(0);
  });
});
