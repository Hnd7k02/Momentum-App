import { describe, expect, it, vi } from 'vitest';
import { BodyMeasure, FAST_FRAME_MS, FROM_MEMORY, IDLE_AFTER_MS, NO_RESOURCE, deviceFacts, resourceFacts } from './measure';

/**
 * The measuring display's arithmetic (block 7B, D181): what counts as a
 * frame of a rotation, what counts as idle, and where a file came from.
 * The display is how the first numbers from a phone enter this project, so
 * what it calls a number is held here, without a clock and without a
 * browser.
 */

/** A recorder that has been opened and has drawn its first picture. */
function opened(at = 0): BodyMeasure {
  const measure = new BodyMeasure();
  measure.opened(at);
  return measure;
}

/** Draws `count` self-driven frames `step` ms apart, starting at `from`; returns the last time. */
function turn(measure: BodyMeasure, from: number, count: number, step: number): number {
  let now = from;
  for (let index = 0; index < count; index += 1) {
    measure.rendered(now, { rotating: true, selfDriven: true });
    now += step;
  }
  return now - step;
}

describe('the load, from opening Muskelgruppen to the first picture', () => {
  it('counts each moment from the opening, and says nothing before it is reached', () => {
    const measure = opened(1000);
    expect(measure.snapshot(1000).load).toMatchObject({ code: null, model: null, firstFrame: null });
    measure.codeReady(1240, { source: 'cache', bytes: 861_000, viaWorker: true });
    measure.modelReady(1420, { source: 'network', bytes: 706_392, viaWorker: false });
    measure.firstFrame(1810);
    const { load } = measure.snapshot(5000);
    expect(load.code).toBe(240);
    expect(load.model).toBe(420);
    expect(load.firstFrame).toBe(810);
    expect(load.codeSource.source).toBe('cache');
    expect(load.modelSource).toEqual({ source: 'network', bytes: 706_392, viaWorker: false });
  });

  it('keeps the first of each moment: a second model or a second first picture changes nothing', () => {
    const measure = opened(0);
    measure.codeReady(100, NO_RESOURCE);
    measure.codeReady(900, NO_RESOURCE);
    measure.modelReady(200, NO_RESOURCE);
    measure.modelReady(950, NO_RESOURCE);
    measure.firstFrame(300);
    measure.firstFrame(990);
    expect(measure.snapshot(1000).load).toMatchObject({ code: 100, model: 200, firstFrame: 300 });
  });

  it('starts over when the screen is opened again', () => {
    const measure = opened(0);
    measure.codeReady(100, NO_RESOURCE);
    measure.firstFrame(300);
    turn(measure, 400, 30, 16);
    measure.opened(10_000);
    const snapshot = measure.snapshot(10_000);
    expect(snapshot.load).toMatchObject({ code: null, model: null, firstFrame: null });
    expect(snapshot.rotation.frames).toBe(0);
    expect(snapshot.displayHz).toBeNull();
  });

  it('tells its readers at the first picture, and only then', () => {
    const measure = opened(0);
    const seen = vi.fn();
    measure.subscribe(seen);
    measure.codeReady(100, NO_RESOURCE);
    measure.modelReady(200, NO_RESOURCE);
    measure.rendered(250, { rotating: false, selfDriven: false });
    expect(seen).not.toHaveBeenCalled();
    measure.firstFrame(300);
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

describe('where a file came from, by the browser\'s own record', () => {
  it('bytes over the wire are the network', () => {
    expect(resourceFacts({ transferSize: 236_000, encodedBodySize: 235_700, decodedBodySize: 861_000, workerStart: 0, duration: 412.4 })).toEqual({
      source: 'network', bytes: 236_000, viaWorker: false, fetchMs: 412.4,
    });
  });

  it('no bytes over the wire is a cache, and a worker\'s answer is named as one', () => {
    expect(resourceFacts({ transferSize: 0, encodedBodySize: 706_392, decodedBodySize: 706_392, workerStart: 12.5, duration: 3 })).toEqual({
      source: 'cache', bytes: 706_392, viaWorker: true, fetchMs: 3,
    });
  });

  it('a request the browser kept no record of has no known source; only a file that was not requested was there already', () => {
    expect(resourceFacts(null).source).toBe('unknown');
    expect(FROM_MEMORY.source).toBe('memory');
  });

  it('a browser that does not report the transfer leaves the source unknown — it is never guessed', () => {
    const entry = { encodedBodySize: 0, decodedBodySize: 0, workerStart: 0 } as unknown as PerformanceResourceTiming;
    expect(resourceFacts(entry).source).toBe('unknown');
  });
});

describe('the frames of a rotation', () => {
  it('measures the mean rate, the share of fast frames and the longest one', () => {
    const measure = opened(0);
    measure.firstFrame(0);
    // 61 frames a sixtieth apart: 60 intervals.
    let last = turn(measure, 1000, 61, 1000 / 60);
    // Then two slow ones.
    measure.rendered((last += 40), { rotating: true, selfDriven: true });
    measure.rendered((last += 60), { rotating: true, selfDriven: true });
    const { rotation } = measure.snapshot(last);
    expect(rotation.frames).toBe(62);
    expect(rotation.meanFps).toBeCloseTo((1000 * 62) / (1000 + 100), 3);
    expect(rotation.fastShare).toBeCloseTo(60 / 62, 6);
    expect(rotation.longestMs).toBeCloseTo(60, 6);
    expect(FAST_FRAME_MS).toBe(25);
  });

  it('a finger resting on the body is a pause, not a slow frame', () => {
    const measure = opened(0);
    measure.firstFrame(0);
    // Dragging: each frame is asked for by a pointer move soon after the last.
    let now = 1000;
    const drag = () => {
      for (let index = 0; index < 20; index += 1) {
        measure.rendered(now, { rotating: true, selfDriven: false });
        // The move that asks for the next frame — after the last one, none.
        if (index < 19) measure.requested(now + 6);
        now += 16;
      }
    };
    drag();
    // The finger rests for 400 ms: no move, no request, no frame. Then it moves on.
    now += 400;
    measure.requested(now - 4);
    drag();
    const { rotation } = measure.snapshot(now);
    // 19 intervals before the pause and 19 after it; the pause itself is none.
    expect(rotation.frames).toBe(38);
    expect(rotation.longestMs).toBeCloseTo(16, 6);
    expect(rotation.fastShare).toBe(1);
  });

  it('a frame that was asked for promptly and drawn late does count', () => {
    const measure = opened(0);
    measure.firstFrame(0);
    measure.rendered(1000, { rotating: true, selfDriven: false });
    measure.requested(1005);
    // The renderer needs 70 ms for this one: asked for promptly, drawn late.
    measure.rendered(1070, { rotating: true, selfDriven: false });
    const { rotation } = measure.snapshot(1070);
    expect(rotation.frames).toBe(1);
    expect(rotation.longestMs).toBeCloseTo(70, 6);
    expect(rotation.fastShare).toBe(0);
  });

  it('a slow renderer is not mistaken for a pausing finger: prompt counts from the end of the frame', () => {
    const measure = opened(0);
    measure.firstFrame(0);
    // Each frame takes 110 ms to draw; the finger's next move is handled
    // the moment the frame is done — 115 ms after the frame began.
    let now = 1000;
    for (let index = 0; index < 10; index += 1) {
      measure.rendered(now, { rotating: true, selfDriven: false });
      measure.drawn(now + 110);
      measure.requested(now + 115);
      now += 120;
    }
    const { rotation } = measure.snapshot(now);
    expect(rotation.frames).toBe(9);
    expect(rotation.meanFps).toBeCloseTo(1000 / 120, 3);
    expect(rotation.fastShare).toBe(0);
    // Without the end of the frame the same moves would have looked 115 ms late.
    const blind = opened(0);
    blind.firstFrame(0);
    now = 1000;
    for (let index = 0; index < 10; index += 1) {
      blind.rendered(now, { rotating: true, selfDriven: false });
      blind.requested(now + 115);
      now += 120;
    }
    expect(blind.snapshot(now).rotation.frames).toBe(0);
  });

  it('frames that only ease a colour are no rotation', () => {
    const measure = opened(0);
    measure.firstFrame(0);
    let now = 1000;
    for (let index = 0; index < 30; index += 1) {
      measure.rendered(now, { rotating: false, selfDriven: true });
      now += 16;
    }
    const snapshot = measure.snapshot(now);
    expect(snapshot.rotation.frames).toBe(0);
    expect(snapshot.rotation.meanFps).toBeNull();
    // They do show the display's rate.
    expect(snapshot.displayHz).toBeCloseTo(62.5, 3);
  });

  it('reads the display\'s rate off the shortest regular interval, whatever was dropped', () => {
    const measure = opened(0);
    measure.firstFrame(0);
    let now = 1000;
    // A 120 Hz display on which every third frame takes two refreshes.
    for (let index = 0; index < 90; index += 1) {
      measure.rendered(now, { rotating: true, selfDriven: true });
      now += index % 3 === 2 ? 2000 / 120 : 1000 / 120;
    }
    expect(measure.snapshot(now).displayHz).toBeCloseTo(120, 0);
    // Too few frames say nothing.
    const short = opened(0);
    turn(short, 0, 5, 16);
    expect(short.snapshot(100).displayHz).toBeNull();
  });
});

describe('idle', () => {
  it('counts the frames of the last second once the body has rested for one', () => {
    const measure = opened(0);
    measure.firstFrame(0);
    const last = turn(measure, 1000, 60, 16);
    measure.rendered(last + 16, { rotating: false, selfDriven: false });
    measure.settled(last + 16);
    // Half a second later it has not rested long enough to say.
    expect(measure.snapshot(last + 516).idleFrames).toBeNull();
    // After a full second: nothing was drawn in it.
    expect(measure.snapshot(last + 16 + IDLE_AFTER_MS).idleFrames).toBe(0);
    measure.dispose();
  });

  it('shows a frame that was drawn while nothing moved', () => {
    const measure = opened(0);
    measure.firstFrame(0);
    measure.rendered(1000, { rotating: true, selfDriven: false });
    measure.settled(1000);
    // Two frames nobody asked for, long after the body came to rest.
    measure.rendered(4000, { rotating: false, selfDriven: false });
    measure.rendered(4300, { rotating: false, selfDriven: false });
    expect(measure.snapshot(4600).idleFrames).toBe(2);
    expect(measure.snapshot(5200).idleFrames).toBe(1);
    expect(measure.snapshot(5400).idleFrames).toBe(0);
    measure.dispose();
  });

  it('says nothing before the first picture', () => {
    const measure = opened(0);
    expect(measure.snapshot(60_000).idleFrames).toBeNull();
  });

  it('tells its readers when a motion ends and once more a second later, by a timer of its own', () => {
    vi.useFakeTimers();
    try {
      const measure = opened(0);
      measure.firstFrame(0);
      const seen = vi.fn();
      measure.subscribe(seen);
      turn(measure, 1000, 30, 16);
      expect(seen).not.toHaveBeenCalled();
      measure.settled(1500);
      expect(seen).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(IDLE_AFTER_MS);
      expect(seen).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(200);
      expect(seen).toHaveBeenCalledTimes(2);
      // And never again by itself.
      vi.advanceTimersByTime(60_000);
      expect(seen).toHaveBeenCalledTimes(2);
      // A second motion ending before the second is up moves the one timer.
      measure.settled(2000);
      vi.advanceTimersByTime(600);
      measure.settled(2600);
      vi.advanceTimersByTime(600);
      expect(seen).toHaveBeenCalledTimes(4);
      vi.advanceTimersByTime(600);
      expect(seen).toHaveBeenCalledTimes(5);
      measure.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('who is asking', () => {
  it('reads an iPhone and the system number its browser reports', () => {
    const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1';
    expect(deviceFacts(safari)).toEqual({ device: 'iPhone', system: 'iOS 18.6', browser: 'Safari 26.1' });
    // The app from the home screen names no browser.
    const standalone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
    expect(deviceFacts(standalone)).toEqual({ device: 'iPhone', system: 'iOS 17.5.1', browser: null });
  });

  it('reads the other devices a check may run on', () => {
    expect(deviceFacts('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'))
      .toEqual({ device: 'Android', system: 'Android 15', browser: 'Chrome 131' });
    expect(deviceFacts('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'))
      .toEqual({ device: 'Mac', system: 'macOS 10.15.7', browser: 'Safari 18.1' });
    expect(deviceFacts('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36').device).toBe('X11');
  });
});
