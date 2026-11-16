import { describe, expect, it } from 'vitest';
import { MOTION, coast, coastDistance, releaseVelocity, shortestDelta, stepMs, travel, zoomTo, type Moving } from './motion';

/**
 * The body's motion counts time, not frames (block 7B, contract §10).
 *
 * The same release and the same travel are run here at 120, 60, 30 and 12
 * frames a second and as one single step, and must end on the same angle
 * after the same time. The tolerances are named where they are used: a
 * millionth of a degree for the angle, one frame for the moment a motion
 * is noticed to have ended.
 */

/** Runs `step` over `ms` in frames of `frameMs`; returns the state and when it ended. */
function run<T extends Moving & { done: boolean }>(
  start: Moving,
  frameMs: number,
  ms: number,
  step: (state: Moving, dt: number) => T,
): { state: Moving; endedAt: number | null } {
  let state: Moving = start;
  let endedAt: number | null = null;
  let elapsed = 0;
  // A whole number of frames; the remainder is a last, shorter one.
  while (elapsed < ms - 1e-9) {
    const dt = Math.min(frameMs, ms - elapsed);
    const next = step(state, dt);
    elapsed += dt;
    state = { value: next.value, velocity: next.velocity };
    if (next.done) {
      endedAt = elapsed;
      break;
    }
  }
  return { state, endedAt };
}

/** A millionth of a degree: far below anything a screen can show. */
const ANGLE_TOLERANCE = 1e-6;

describe('the coast after a release', () => {
  const release: Moving = { value: 37, velocity: 400 };
  const coasting = (state: Moving, dt: number) => coast(state, dt);

  it('sixty steps of 16.67 ms and thirty of 33.33 ms end on the same angle', () => {
    const sixty = run(release, 1000 / 60, 1000, coasting).state;
    const thirty = run(release, 1000 / 30, 1000, coasting).state;
    expect(Math.abs(sixty.value - thirty.value)).toBeLessThan(ANGLE_TOLERANCE);
    expect(Math.abs(sixty.velocity - thirty.velocity)).toBeLessThan(ANGLE_TOLERANCE);
    // And both are where the equation says a second after the release.
    const tau = MOTION.coastTimeMs / 1000;
    expect(sixty.value).toBeCloseTo(37 + 400 * tau * (1 - Math.exp(-1 / tau)), 6);
  });

  it('comes to rest on the same angle at any frame rate, and in one single step', () => {
    const rest = 37 + coastDistance(400);
    for (const frameMs of [1000 / 120, 1000 / 60, 1000 / 30, 1000 / 12, 10_000]) {
      const { state, endedAt } = run(release, frameMs, 10_000, coasting);
      expect(Math.abs(state.value - rest), `${frameMs} ms`).toBeLessThan(ANGLE_TOLERANCE);
      expect(state.velocity).toBe(0);
      expect(endedAt).not.toBeNull();
    }
    // 400° a second carry the body 111° further.
    expect(coastDistance(400)).toBeCloseTo(0.28 * (400 - 3), 6);
  });

  it('takes the same time at any frame rate, to within the one frame in which the end is noticed', () => {
    const seconds = (MOTION.coastTimeMs / 1000) * Math.log(400 / MOTION.coastStopDegPerS);
    for (const frameMs of [1000 / 120, 1000 / 60, 1000 / 30, 1000 / 12]) {
      const { endedAt } = run(release, frameMs, 10_000, coasting);
      expect(endedAt! / 1000, `${frameMs} ms`).toBeGreaterThanOrEqual(seconds - 1e-9);
      expect(endedAt! / 1000, `${frameMs} ms`).toBeLessThan(seconds + frameMs / 1000);
    }
    // The old rule — ×0.93 a frame — ran twice as long at half the rate.
    const framesOld = Math.log(0.02 / (400 / 60)) / Math.log(0.93);
    expect(framesOld / 30 / (framesOld / 60)).toBe(2);
  });

  it('turns the way the finger went, and a release without speed does not move', () => {
    expect(coastDistance(-400)).toBeCloseTo(-coastDistance(400), 9);
    expect(coast({ value: 10, velocity: 0 }, 16)).toEqual({ value: 10, velocity: 0, done: true });
    expect(coast({ value: 10, velocity: 2 }, 16)).toEqual({ value: 10, velocity: 0, done: true });
  });

  it('never stops hard: the speed only ever falls, and the last step is the smallest', () => {
    let state: Moving = release;
    let previous = Number.POSITIVE_INFINITY;
    for (let frame = 0; frame < 400; frame += 1) {
      const next = coast(state, 1000 / 60);
      const moved = Math.abs(next.value - state.value);
      expect(moved).toBeLessThanOrEqual(previous + 1e-12);
      previous = moved;
      state = next;
      if (next.done) break;
    }
    // The body stops while it moves a twentieth of a degree a frame.
    expect(previous).toBeLessThan(MOTION.coastStopDegPerS / 60 + 1e-9);
  });
});

describe('a camera travel', () => {
  const start: Moving = { value: 0, velocity: 0 };
  const toBack = (state: Moving, dt: number) => travel(state, 180, dt);

  it('sixty steps of 16.67 ms and thirty of 33.33 ms are at the same angle', () => {
    // Stopped after 300 ms, in mid-travel, where a difference would show.
    const sixty = run(start, 1000 / 60, 300, toBack).state;
    const thirty = run(start, 1000 / 30, 300, toBack).state;
    const one = run(start, 300, 300, toBack).state;
    expect(Math.abs(sixty.value - thirty.value)).toBeLessThan(ANGLE_TOLERANCE);
    expect(Math.abs(sixty.value - one.value)).toBeLessThan(ANGLE_TOLERANCE);
    expect(sixty.value).toBeGreaterThan(100);
    expect(sixty.value).toBeLessThan(180);
  });

  it('arrives exactly, at the same time at any frame rate, to within one frame', () => {
    const ends: number[] = [];
    for (const frameMs of [1000 / 120, 1000 / 60, 1000 / 30, 1000 / 12]) {
      const { state, endedAt } = run(start, frameMs, 5000, toBack);
      expect(state.value).toBe(180);
      expect(state.velocity).toBe(0);
      ends.push(endedAt!);
      expect(endedAt!, `${frameMs} ms`).toBeLessThan(ends[0]! + frameMs + 1e-6);
    }
    // A half turn rests after about 0.7 s; the old rule took 31 frames, so
    // half a second at 60 frames a second and a full one at 30.
    expect(ends[0]!).toBeGreaterThan(600);
    expect(ends[0]!).toBeLessThan(800);
  });

  it('starts gently, never overshoots and runs out softly', () => {
    let state: Moving = start;
    const steps: number[] = [];
    for (let frame = 0; frame < 200; frame += 1) {
      const next = travel(state, 180, 1000 / 60);
      expect(next.value).toBeLessThanOrEqual(180);
      expect(next.value).toBeGreaterThanOrEqual(state.value);
      steps.push(next.value - state.value);
      state = next;
      if (next.done) break;
    }
    const largest = Math.max(...steps);
    // The first frame moves less than a third of the largest step. (The old
    // rule moved furthest in its first frame: 18 % of the way, 32° here.)
    expect(steps[0]!).toBeLessThan(largest / 3);
    expect(steps[0]!).toBeLessThan(6);
    // And the last frames barely move: no hard stop.
    expect(steps[steps.length - 2]!).toBeLessThan(0.05);
  });

  it('takes over the speed the body already has', () => {
    // A travel that begins while the body still turns the other way does
    // not set its speed to nothing: a millisecond later it still turns
    // that way, a little slower — one motion, no jolt.
    const first = travel({ value: 90, velocity: -300 }, 180, 1);
    expect(first.velocity).toBeLessThan(0);
    expect(first.velocity).toBeGreaterThan(-300);
    expect(first.value).toBeLessThan(90);
    const { state } = run({ value: 90, velocity: -300 }, 1000 / 60, 5000, (s, dt) => travel(s, 180, dt));
    expect(state.value).toBe(180);
  });

  it('the zoom returns the same way, in its own units', () => {
    const sixty = run({ value: 1.8, velocity: 0 }, 1000 / 60, 200, (s, dt) => zoomTo(s, 1, dt)).state;
    const thirty = run({ value: 1.8, velocity: 0 }, 1000 / 30, 200, (s, dt) => zoomTo(s, 1, dt)).state;
    expect(Math.abs(sixty.value - thirty.value)).toBeLessThan(1e-9);
    const { state } = run({ value: 1.8, velocity: 0 }, 1000 / 60, 5000, (s, dt) => zoomTo(s, 1, dt));
    expect(state.value).toBe(1);
  });
});

describe('a long step after a pause', () => {
  it('counts for a tenth of a second and no more: the body carries on, it does not jump', () => {
    expect(stepMs(16.67)).toBe(16.67);
    expect(stepMs(100)).toBe(100);
    expect(stepMs(5000)).toBe(MOTION.maxStepMs);
    expect(stepMs(60_000)).toBe(MOTION.maxStepMs);
    // Five seconds in a hidden tab, in the middle of a coast.
    const before: Moving = { value: 20, velocity: 400 };
    const after = coast(before, stepMs(5000));
    const unclamped = coast(before, 5000);
    expect(after.done).toBe(false);
    expect(after.value - before.value).toBeCloseTo(coast(before, 100).value - before.value, 9);
    // Without the limit the body would have been at rest 111° away.
    expect(unclamped.done).toBe(true);
    expect(after.value - before.value).toBeLessThan((unclamped.value - before.value) / 3);
  });

  it('a clock that stood still or ran backwards moves nothing', () => {
    expect(stepMs(0)).toBe(0);
    expect(stepMs(-40)).toBe(0);
    expect(stepMs(Number.NaN)).toBe(0);
    const state: Moving = { value: 20, velocity: 400 };
    expect(coast(state, 0).value).toBe(20);
    expect(travel({ value: 20, velocity: 0 }, 90, 0).value).toBe(20);
  });
});

describe('the speed a finger lets go with', () => {
  /** A finger moving `pxPerMs` for 200 ms, sampled every `every` ms. */
  const drag = (pxPerMs: number, every: number) =>
    Array.from({ length: Math.floor(200 / every) + 1 }, (_, index) => ({ at: 1000 + index * every, x: index * every * pxPerMs }));

  it('is the same whether the finger was sampled 60 or 120 times a second', () => {
    const slow = releaseVelocity(drag(0.5, 1000 / 60), 1205);
    const fast = releaseVelocity(drag(0.5, 1000 / 120), 1205);
    // 0.5 px a millisecond is 500 px a second, 275° a second.
    expect(slow).toBeCloseTo(275, 6);
    expect(fast).toBeCloseTo(275, 6);
  });

  it('a finger that rested before it lifted throws nothing', () => {
    const samples = drag(0.5, 16);
    const last = samples[samples.length - 1]!.at;
    expect(releaseVelocity(samples, last + MOTION.velocityRestMs)).not.toBe(0);
    expect(releaseVelocity(samples, last + MOTION.velocityRestMs + 1)).toBe(0);
  });

  it('a slow release throws nothing, and a wild one is held to the limit', () => {
    // 0.04 px a millisecond: 22° a second.
    expect(releaseVelocity(drag(0.04, 16), 1200)).toBe(0);
    expect(releaseVelocity(drag(5, 16), 1200)).toBe(MOTION.coastMaxDegPerS);
    expect(releaseVelocity(drag(-5, 16), 1200)).toBe(-MOTION.coastMaxDegPerS);
  });

  it('reads the end of the drag, not its beginning', () => {
    // Fast for 150 ms, then nearly still for the last 100: nothing to throw.
    const samples = [
      ...Array.from({ length: 10 }, (_, index) => ({ at: 1000 + index * 16, x: index * 16 })),
      ...Array.from({ length: 7 }, (_, index) => ({ at: 1160 + index * 16, x: 150 + index * 0.2 })),
    ];
    expect(releaseVelocity(samples, 1260)).toBe(0);
  });

  it('one sample, or none, is no speed', () => {
    expect(releaseVelocity([], 1000)).toBe(0);
    expect(releaseVelocity([{ at: 1000, x: 5 }], 1001)).toBe(0);
  });
});

describe('angles', () => {
  it('never turn the long way', () => {
    expect(shortestDelta(350, 0)).toBe(10);
    expect(shortestDelta(10, 350)).toBe(-20);
    expect(shortestDelta(0, 180)).toBe(180);
    expect(shortestDelta(90, 90)).toBe(0);
  });
});
