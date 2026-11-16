/**
 * How the body moves, as arithmetic (block 7B, contract §10).
 *
 * **By time, not by frames.** Until this block the coast multiplied its
 * speed by 0.93 a frame and a camera travel closed 18 % of its gap a frame:
 * at half the frame rate the same motion took twice as long, and on a
 * display that draws 120 frames a second half as long. Both are now the
 * exact solution of their equation over the time that passed — a coast is a
 * speed that decays exponentially, a travel is a critically damped spring —
 * so sixty steps of a sixtieth and thirty of a thirtieth land on the same
 * angle to the last bit that matters, and so does one step of a second.
 *
 * Nothing here knows a camera, a finger or a clock. The rig holds the
 * state, measures the time and applies the angle; these functions say where
 * a motion is after `ms` more. That is what the unit test holds
 * (`motion.test.ts`), and what `body.mjs` holds once more in a browser
 * whose frames are throttled.
 */

/**
 * The values of the motion, in one place and by name. Turning is meant to
 * feel dynamic and organic (D155): momentum on release, a soft run-out, no
 * hard stop.
 */
export const MOTION = {
  /** How far a finger turns the body: degrees per pixel, sideways and up and down. */
  yawPerPx: 0.55,
  pitchPerPx: 0.22,
  /** The tilt's range and where it starts, in degrees. Positive looks from above. */
  pitchMin: -22,
  pitchMax: 30,
  pitchStart: 8,

  /**
   * The coast. After a release the body turns on at the finger's speed,
   * and the speed falls to 1/e in this time: 0.28 s, so a flick of 400°
   * a second carries the body about 110° further and takes a good second
   * to come to rest. (The old rule, on a 60 Hz display, was 0.23 s.)
   */
  coastTimeMs: 280,
  /** Below this speed the eye sees no turning, and the coast ends: degrees per second. */
  coastStopDegPerS: 3,
  /** A slower release is a finger that stopped: it throws nothing. */
  coastStartDegPerS: 25,
  /** The fastest coast a flick may start, so a wild swipe is not three turns. */
  coastMaxDegPerS: 720,
  /** The finger's speed is read over its last samples within this time … */
  velocityWindowMs: 90,
  /** … and a finger that rested this long before lifting has no speed. */
  velocityRestMs: 80,

  /**
   * A camera travel — to a view, to a group chosen in the list, back to
   * the start — is a critically damped spring: it starts gently, never
   * overshoots and runs out softly. This is its rate, per second; at 15 a
   * half turn is within a degree after half a second and at rest after
   * about 0.7 s.
   */
  travelRate: 15,
  /** A travel has arrived within this of its goal and slower than this. */
  travelStopDeg: 0.05,
  travelStopDegPerS: 1.5,

  /** The zoom of the body: between these, and how fast it returns on reset. */
  zoomMin: 1,
  zoomMax: 1.8,
  zoomRate: 15,
  zoomStop: 0.002,
  zoomStopPerS: 0.02,

  /**
   * The longest step a single frame may take. A frame that comes later —
   * the tab was hidden, the phone was busy — moves the body as far as a
   * tenth of a second does and no further: it carries on from where it
   * was, it does not jump to where it would have been.
   */
  maxStepMs: 100,
} as const;

/** A motion's state: where it is and how fast it moves, per second. */
export interface Moving {
  value: number;
  velocity: number;
}

/** The time a frame may account for: never negative, never more than `maxStepMs`. */
export function stepMs(elapsedMs: number): number {
  if (!(elapsedMs > 0)) return 0;
  return Math.min(elapsedMs, MOTION.maxStepMs);
}

/**
 * A coast after `ms`: the speed decays exponentially with `coastTimeMs`,
 * and the angle is its exact integral. It ends at the moment the speed
 * reaches `coastStopDegPerS` — the exact moment, not the first frame after
 * it — so the angle a coast ends on does not depend on how many frames it
 * was drawn in.
 */
export function coast(state: Moving, ms: number): Moving & { done: boolean } {
  const speed = Math.abs(state.velocity);
  const stop = MOTION.coastStopDegPerS;
  if (speed <= stop) return { value: state.value, velocity: 0, done: true };
  const tau = MOTION.coastTimeMs / 1000;
  const direction = Math.sign(state.velocity);
  // The time left until the speed has fallen to the threshold.
  const left = tau * Math.log(speed / stop);
  const seconds = ms / 1000;
  if (seconds >= left) {
    // ∫ v·e^(−t/τ) dt from 0 to `left` = τ·(v − stop).
    return { value: state.value + direction * tau * (speed - stop), velocity: 0, done: true };
  }
  const decay = Math.exp(-seconds / tau);
  return {
    value: state.value + state.velocity * tau * (1 - decay),
    velocity: state.velocity * decay,
    done: false,
  };
}

/** Where a coast that starts at `velocity` comes to rest, relative to its start: degrees. */
export function coastDistance(velocity: number): number {
  const speed = Math.abs(velocity);
  if (speed <= MOTION.coastStopDegPerS) return 0;
  return Math.sign(velocity) * (MOTION.coastTimeMs / 1000) * (speed - MOTION.coastStopDegPerS);
}

/**
 * A critically damped spring towards `target` after `ms`, as its closed
 * form: x(t) = target + (d + (v + ω·d)·t)·e^(−ω·t). Exact for any step, so
 * two half steps are one whole step. It has arrived when it is within
 * `stopDistance` of the goal and slower than `stopSpeed`; then it stands
 * exactly on the goal.
 */
export function spring(
  state: Moving,
  target: number,
  ms: number,
  rate: number,
  stopDistance: number,
  stopSpeed: number,
): Moving & { done: boolean } {
  const seconds = ms / 1000;
  const distance = state.value - target;
  const push = state.velocity + rate * distance;
  const decay = Math.exp(-rate * seconds);
  const value = target + (distance + push * seconds) * decay;
  const velocity = (state.velocity - rate * push * seconds) * decay;
  if (Math.abs(value - target) <= stopDistance && Math.abs(velocity) <= stopSpeed) {
    return { value: target, velocity: 0, done: true };
  }
  return { value, velocity, done: false };
}

/** A camera travel: the spring with the travel's own values. */
export function travel(state: Moving, target: number, ms: number): Moving & { done: boolean } {
  return spring(state, target, ms, MOTION.travelRate, MOTION.travelStopDeg, MOTION.travelStopDegPerS);
}

/** The zoom on its way back: the same spring, in the zoom's own units. */
export function zoomTo(state: Moving, target: number, ms: number): Moving & { done: boolean } {
  return spring(state, target, ms, MOTION.zoomRate, MOTION.zoomStop, MOTION.zoomStopPerS);
}

/** One sample of a finger: when, and where along the axis that turns the body. */
export interface FingerSample {
  at: number;
  x: number;
}

/**
 * The speed a finger lets go with, in degrees per second.
 *
 * Read from the events' own times over the last `velocityWindowMs` of the
 * drag — the distance between the first and the last sample of that window
 * over the time between them — never from one event's step, which on a
 * phone is a single noisy sample. A finger that rested before it lifted
 * throws nothing, and neither does one that was too slow.
 */
export function releaseVelocity(samples: readonly FingerSample[], releasedAt: number): number {
  const last = samples[samples.length - 1];
  if (!last || releasedAt - last.at > MOTION.velocityRestMs) return 0;
  let first = last;
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const sample = samples[index]!;
    if (last.at - sample.at > MOTION.velocityWindowMs) break;
    first = sample;
  }
  const ms = last.at - first.at;
  if (ms <= 0) return 0;
  const velocity = ((last.x - first.x) * MOTION.yawPerPx * 1000) / ms;
  if (Math.abs(velocity) < MOTION.coastStartDegPerS) return 0;
  return Math.max(-MOTION.coastMaxDegPerS, Math.min(MOTION.coastMaxDegPerS, velocity));
}

/** Shortest signed way from one angle to another, so the body never turns the long way. */
export function shortestDelta(from: number, to: number): number {
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

/** An angle in 0–360. */
export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}
