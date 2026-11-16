/**
 * Camera rig: the one place a finger meets the body.
 *
 * Hand-rolled rather than OrbitControls, for reasons specific to this
 * feature: the body turns through a full unwrapped 360°, panning as a
 * gesture does not exist, and the same touch has to feed tap-versus-drag,
 * the pinch and the double tap.
 *
 * What it does (block 7B, contract §8 and §10):
 *
 * - **One finger turns.** Sideways it turns the body, up and down it tilts
 *   it. On release the body runs on at the finger's speed and runs out
 *   softly. A drag that *begins* up or down is the page's: the canvas lets
 *   the browser scroll it (`touch-action: pan-y`), so the rows under the
 *   body are reached with one thumb.
 * - **A tap selects and never turns.** It is reported with the place it
 *   landed on; the angle is left as it is.
 * - **Two fingers zoom**, between 1.0 and 1.8, and are never a tap and
 *   never a turn — not even after one of them has lifted. The zoom is a
 *   window on the picture (`framing.ts`); a chosen group stays inside it.
 * - **A double tap resets**: front, zoom 1.0, the tilt of the start. Its
 *   first tap selects like any tap, without waiting to see a second.
 * - **Every motion counts time, not frames** (`motion.ts`).
 * - **It can be held.** A host pauses the viewer; a coast then ends at
 *   once, a travel in flight is finished first, and nothing here asks for
 *   another frame until the pause is lifted.
 *
 * Under `prefers-reduced-motion` there is no coast and every travel is a
 * jump — drag, tap, pinch and the shortcuts keep working.
 */
import { useCallback, useEffect, useImperativeHandle, useRef, forwardRef, type MutableRefObject } from 'react';
import { Vector3, type Box3, type PerspectiveCamera } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { TapVsDrag } from './useTapVsDrag';
import { bodyMeasure, isMeasuring, type FrameActivity } from '../measure/measure';
import { STAGE, clampWindow, pictureAt, pictureBox, pinchWindow, windowRect, type Box, type Point } from './framing';
import {
  MOTION,
  coast,
  normalizeAngle,
  releaseVelocity,
  shortestDelta,
  stepMs,
  travel,
  zoomTo as zoomTowards,
  type FingerSample,
  type Moving,
} from './motion';

export type BodyView = 'front' | 'side' | 'back';

export const VIEW_AZIMUTH: Record<BodyView, number> = { front: 0, side: 90, back: 180 };

const TARGET = new Vector3(...STAGE.target);
const D2R = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Two taps are a double tap when the second lands this soon and this near. */
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 28;
/** The finger samples kept for the release speed: more than its window ever holds. */
const SAMPLES = 24;

/** Where a tap landed: in the canvas's own CSS pixels, with the canvas's size. */
export interface BodyTap {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CameraRigHandle = {
  /** Travel to a named view. */
  goTo: (view: BodyView) => void;
  /** Turn to an absolute azimuth by the shortest path (for a selection made in the list). */
  faceAzimuth: (deg: number) => void;
  /** Current azimuth, normalised to 0–360. */
  azimuth: () => number;
  /** The current zoom, 1.0–1.8. */
  zoom: () => number;
  /** Back to the start: front, zoom 1.0, the first tilt. The selection is the host's and stays. */
  reset: () => void;
  /**
   * The host asks for stillness. A coast ends now; a travel in flight is
   * finished first — or, with `now`, jumps to its goal, for a viewer that
   * cannot draw its way there. Returns whether the camera already rests.
   */
  hold: (now?: boolean) => boolean;
};

export type CameraRigProps = {
  /** A gesture the rig judged to be a tap, and where it landed. */
  onTap?: (tap: BodyTap) => void;
  onAzimuthChange?: (deg: number) => void;
  /** The zoom as it changes, throttled like the azimuth and always once at rest. */
  onZoomChange?: (zoom: number) => void;
  enabled?: boolean;
  /** What each frame is drawn for, for the measuring display and for the pause. */
  activity?: MutableRefObject<FrameActivity>;
  /** The chosen group's box in the world, which a zoom keeps in its window; `null` with nothing chosen. */
  keepInView?: MutableRefObject<Box3 | null>;
  /**
   * The viewer is held and draws nothing: a finger then moves nothing
   * either — it would turn a body nobody sees turning. A tap is still a tap.
   */
  frozen?: MutableRefObject<boolean>;
};

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export const CameraRig = forwardRef<CameraRigHandle, CameraRigProps>(function CameraRig(
  { onTap, onAzimuthChange, onZoomChange, enabled = true, activity, keepInView, frozen },
  ref,
) {
  const { camera, gl, invalidate } = useThree();
  const yaw = useRef<Moving>({ value: 0, velocity: 0 });
  const pitch = useRef<Moving>({ value: MOTION.pitchStart, velocity: 0 });
  const zoom = useRef<Moving>({ value: 1, velocity: 0 });
  /** The window's centre in the picture; only read while the zoom is above 1. */
  const centre = useRef<Point>({ x: 0.5, y: 0.5 });
  const yawTo = useRef<number | null>(null);
  const pitchTo = useRef<number | null>(null);
  const zoomTo = useRef<number | null>(null);
  const coasting = useRef(false);
  /** When the motion was last advanced; `null` while nothing moves. */
  const steppedAt = useRef<number | null>(null);

  const gestures = useRef(new TapVsDrag());
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  /** A gesture a second finger joined stays a pinch until every finger has lifted. */
  const pinching = useRef(false);
  const pinch = useRef<{ held: Point; zoom: number; distance: number } | null>(null);
  const samples = useRef<FingerSample[]>([]);
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null);
  /** A finger moved the camera since the last frame. */
  const dragged = useRef(false);

  const lastAzimuth = useRef(-1);
  const lastZoom = useRef(-1);
  const lastEmitAt = useRef(0);
  const wakePending = useRef(false);
  const reduced = useRef(false);
  const applied = useRef({ zoom: 0, x: 0, y: 0 });

  // Read the preference once and follow it; the rig checks the ref, never
  // the media query, on the hot path.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia(REDUCED_MOTION);
    const apply = () => {
      reduced.current = query.matches;
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  // One framing for every stage: the angle of view is fixed (`framing.ts`).
  // R3F keeps the aspect current on resize; nothing else depends on the size.
  useEffect(() => {
    const perspective = camera as PerspectiveCamera;
    if (!perspective.isPerspectiveCamera) return;
    perspective.fov = STAGE.fov;
    perspective.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate]);

  /**
   * Asks for the NEXT frame from inside the current one. Deferred by one
   * animation frame and coalesced, so a motion keeps the demand loop alive
   * without ever stacking callbacks — and stops asking the moment it rests.
   */
  const keepAlive = useCallback(() => {
    if (wakePending.current) return;
    wakePending.current = true;
    requestAnimationFrame(() => {
      wakePending.current = false;
      invalidate();
    });
  }, [invalidate]);

  /** Starts a motion from outside a frame: it counts time from now. */
  const begin = useCallback(() => {
    if (steppedAt.current === null) steppedAt.current = performance.now();
    invalidate();
  }, [invalidate]);

  const travelTo = useCallback(
    (target: number) => {
      coasting.current = false;
      if (reduced.current) {
        yaw.current = { value: target, velocity: 0 };
        yawTo.current = null;
        invalidate();
        return;
      }
      // The speed the body has is kept: the travel takes it over (`motion.ts`).
      yawTo.current = target;
      begin();
    },
    [begin, invalidate],
  );

  const reset = useCallback(() => {
    coasting.current = false;
    const front = Math.round(yaw.current.value / 360) * 360;
    if (reduced.current) {
      yaw.current = { value: front, velocity: 0 };
      pitch.current = { value: MOTION.pitchStart, velocity: 0 };
      zoom.current = { value: 1, velocity: 0 };
      yawTo.current = pitchTo.current = zoomTo.current = null;
      invalidate();
      return;
    }
    yawTo.current = front;
    pitchTo.current = MOTION.pitchStart;
    zoomTo.current = 1;
    begin();
  }, [begin, invalidate]);

  useImperativeHandle(
    ref,
    () => ({
      goTo(view) {
        // Land on the nearest multiple of 360 plus the preset, so "front" from
        // 350° turns 10° forward instead of 350° backward.
        const want = VIEW_AZIMUTH[view];
        travelTo(Math.round((yaw.current.value - want) / 360) * 360 + want);
      },
      faceAzimuth(deg) {
        travelTo(yaw.current.value + shortestDelta(normalizeAngle(yaw.current.value), deg));
      },
      azimuth: () => normalizeAngle(yaw.current.value),
      zoom: () => zoom.current.value,
      reset,
      hold(now = false) {
        coasting.current = false;
        if (yawTo.current === null) yaw.current.velocity = 0;
        if (now) {
          if (yawTo.current !== null) yaw.current = { value: yawTo.current, velocity: 0 };
          if (pitchTo.current !== null) pitch.current = { value: pitchTo.current, velocity: 0 };
          if (zoomTo.current !== null) zoom.current = { value: zoomTo.current, velocity: 0 };
          yawTo.current = pitchTo.current = zoomTo.current = null;
        }
        // One frame shows where the body stopped, and ends the loop.
        invalidate();
        return yawTo.current === null && pitchTo.current === null && zoomTo.current === null;
      },
    }),
    [travelTo, reset, invalidate],
  );

  const element = gl.domElement;

  useEffect(() => {
    if (!enabled) return;
    const tap = gestures.current;
    const held = pointers.current;

    /** A point of the page, as a point of the stage: 0–1, y down. */
    const onStage = (x: number, y: number, rect: DOMRect): Point => ({
      x: (x - rect.left) / rect.width,
      y: (y - rect.top) / rect.height,
    });
    const twoFingers = () => {
      const [a, b] = [...held.values()];
      if (!a || !b) return null;
      return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };

    const onDown = (e: PointerEvent) => {
      held.set(e.pointerId, { x: e.clientX, y: e.clientY });
      tap.down(e);
      // A finger on the body takes it over: whatever was moving stops here.
      coasting.current = false;
      yaw.current.velocity = 0;
      yawTo.current = pitchTo.current = zoomTo.current = null;
      if (held.size === 1) {
        samples.current = [{ at: e.timeStamp, x: e.clientX }];
      } else {
        // A second finger: from here on this is a pinch, never a tap and
        // never a turn (`TapVsDrag` has already dropped the tap).
        pinching.current = true;
        const fingers = twoFingers();
        if (fingers && fingers.distance > 0) {
          const rect = element.getBoundingClientRect();
          pinch.current = {
            held: pictureAt(onStage(fingers.x, fingers.y, rect), centre.current, zoom.current.value),
            zoom: zoom.current.value,
            distance: fingers.distance,
          };
        }
      }
      try {
        element.setPointerCapture(e.pointerId);
      } catch {
        /* Safari can refuse capture mid-gesture; dragging still works. */
      }
      element.style.cursor = 'grabbing';
      invalidate();
    };

    const onMove = (e: PointerEvent) => {
      const known = held.get(e.pointerId);
      if (known) {
        known.x = e.clientX;
        known.y = e.clientY;
      }
      if (pinching.current) {
        const fingers = twoFingers();
        const start = pinch.current;
        // One finger left of a pinch moves nothing.
        if (!fingers || !start || frozen?.current) return;
        e.preventDefault();
        const rect = element.getBoundingClientRect();
        const next = pinchWindow(start.held, onStage(fingers.x, fingers.y, rect), start.zoom, fingers.distance / start.distance);
        zoom.current = { value: next.zoom, velocity: 0 };
        centre.current = next.centre;
        dragged.current = true;
        if (isMeasuring()) bodyMeasure.requested(performance.now());
        invalidate();
        return;
      }
      const d = tap.move(e);
      if (!d || frozen?.current) return;
      e.preventDefault();
      yaw.current.value += d.dx * MOTION.yawPerPx;
      pitch.current.value = clamp(pitch.current.value - d.dy * MOTION.pitchPerPx, MOTION.pitchMin, MOTION.pitchMax);
      const list = samples.current;
      list.push({ at: e.timeStamp, x: e.clientX });
      if (list.length > SAMPLES) list.shift();
      dragged.current = true;
      if (isMeasuring()) bodyMeasure.requested(performance.now());
      invalidate();
    };

    const onUp = (e: PointerEvent) => {
      held.delete(e.pointerId);
      const wasTap = tap.up(e);
      try {
        element.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      if (held.size === 0) element.style.cursor = 'grab';
      if (pinching.current) {
        // The pinch is over when the last finger has lifted; until then the
        // one that is left neither turns nor zooms.
        pinch.current = null;
        if (held.size === 0) {
          pinching.current = false;
          tap.cancel();
        }
        invalidate();
        return;
      }
      if (!wasTap) {
        // The body runs on at the finger's speed — a motion effect, so not
        // under reduced motion, where it stops where the finger lifted.
        const velocity = reduced.current || frozen?.current ? 0 : releaseVelocity(samples.current, e.timeStamp);
        if (velocity !== 0) {
          yaw.current.velocity = velocity;
          coasting.current = true;
          steppedAt.current = performance.now();
        }
        invalidate();
        return;
      }
      invalidate();
      const now = performance.now();
      const before = lastTap.current;
      const near = before !== null && Math.hypot(e.clientX - before.x, e.clientY - before.y) <= DOUBLE_TAP_PX;
      if (before && near && now - before.at <= DOUBLE_TAP_MS && !frozen?.current) {
        // The second tap of a double tap resets and selects nothing: the
        // first has already selected, at once, like any tap.
        lastTap.current = null;
        reset();
        return;
      }
      lastTap.current = { at: now, x: e.clientX, y: e.clientY };
      const rect = element.getBoundingClientRect();
      onTap?.({ x: e.clientX - rect.left, y: e.clientY - rect.top, width: rect.width, height: rect.height });
    };

    const onCancel = (e: PointerEvent) => {
      // The browser took the gesture — a drag that began up or down scrolls
      // the page — or the system did. Nothing was thrown and nothing tapped.
      held.delete(e.pointerId);
      if (held.size === 0) {
        tap.cancel();
        pinching.current = false;
        pinch.current = null;
        element.style.cursor = 'grab';
      }
      invalidate();
    };

    element.style.cursor = 'grab';
    // Sideways and two fingers are the body's; up and down is the page's.
    element.style.touchAction = 'pan-y';
    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove, { passive: false });
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onCancel);
    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onCancel);
      held.clear();
      tap.cancel();
      pinching.current = false;
      pinch.current = null;
    };
  }, [element, enabled, onTap, invalidate, reset, frozen]);

  const corners = useRef(Array.from({ length: 8 }, () => new Vector3()));

  /** The chosen group's box in the picture, as the camera stands now. */
  const keepBox = useCallback((): Box | null => {
    const box = keepInView?.current;
    if (!box || box.isEmpty()) return null;
    const { min, max } = box;
    const points: [number, number, number][] = [];
    let index = 0;
    for (const x of [min.x, max.x]) {
      for (const y of [min.y, max.y]) {
        for (const z of [min.z, max.z]) {
          const corner = corners.current[index]!.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
          points.push([corner.x, corner.y, corner.z]);
          index += 1;
        }
      }
    }
    return pictureBox(points, (camera as PerspectiveCamera).aspect);
  }, [camera, keepInView]);

  const applyCamera = useCallback(() => {
    const y = yaw.current.value * D2R;
    const p = pitch.current.value * D2R;
    const radius = STAGE.distance * Math.cos(p);
    camera.position.set(
      TARGET.x + radius * Math.sin(y),
      TARGET.y + STAGE.distance * Math.sin(p),
      TARGET.z + radius * Math.cos(y),
    );
    camera.lookAt(TARGET);
    camera.updateMatrixWorld();

    const perspective = camera as PerspectiveCamera;
    if (!perspective.isPerspectiveCamera) return;
    const z = zoom.current.value;
    if (z <= 1 + 1e-4) {
      centre.current = { x: 0.5, y: 0.5 };
      if (applied.current.zoom !== 1) {
        perspective.clearViewOffset();
        applied.current = { zoom: 1, x: 0.5, y: 0.5 };
      }
      return;
    }
    const next = clampWindow(centre.current, z, keepBox());
    centre.current = next;
    if (applied.current.zoom === z && applied.current.x === next.x && applied.current.y === next.y) return;
    const rect = windowRect(next, z);
    // Shares of the picture, not pixels: a resize needs no new numbers.
    perspective.setViewOffset(1, 1, rect.x, rect.y, rect.width, rect.height);
    applied.current = { zoom: z, x: next.x, y: next.y };
  }, [camera, keepBox]);

  useFrame(() => {
    const now = performance.now();
    const dt = steppedAt.current === null ? 0 : stepMs(now - steppedAt.current);
    const down = gestures.current.isDown || pointers.current.size > 0;
    let moving = false;

    if (yawTo.current !== null) {
      const next = travel(yaw.current, yawTo.current, dt);
      yaw.current = { value: next.value, velocity: next.velocity };
      if (next.done) yawTo.current = null;
      else moving = true;
    } else if (coasting.current && !down) {
      const next = coast(yaw.current, dt);
      yaw.current = { value: next.value, velocity: next.velocity };
      if (next.done) coasting.current = false;
      else moving = true;
    }
    if (pitchTo.current !== null) {
      const next = travel(pitch.current, pitchTo.current, dt);
      pitch.current = { value: next.value, velocity: next.velocity };
      if (next.done) pitchTo.current = null;
      else moving = true;
    }
    if (zoomTo.current !== null) {
      const next = zoomTowards(zoom.current, zoomTo.current, dt);
      zoom.current = { value: next.value, velocity: next.velocity };
      if (next.done) zoomTo.current = null;
      else moving = true;
    }

    applyCamera();
    steppedAt.current = moving ? now : null;
    if (moving) keepAlive();
    if (activity) {
      // A frame drawn for a finger that moved, or for the camera's own motion.
      activity.current.rotating = moving || dragged.current;
      activity.current.coasting = moving;
      dragged.current = false;
    }

    // Report the angle and the zoom sparingly: they drive host state, and
    // emitting every frame would re-render the screen while the body turns.
    // The settled frame is always reported, whatever the throttle held back.
    const settled = !moving && !down;
    const due = settled || now - lastEmitAt.current > 200;
    if (!due) return;
    const deg = Math.round(normalizeAngle(yaw.current.value)) % 360;
    const scale = Math.round(zoom.current.value * 100) / 100;
    if (onAzimuthChange && deg !== lastAzimuth.current) {
      lastAzimuth.current = deg;
      lastEmitAt.current = now;
      onAzimuthChange(deg);
    }
    if (onZoomChange && scale !== lastZoom.current) {
      lastZoom.current = scale;
      lastEmitAt.current = now;
      onZoomChange(scale);
    }
  });

  return null;
});
