/**
 * Camera rig: finger-drag orbit with inertia, plus front/side/back presets.
 *
 * Hand-rolled rather than OrbitControls, for three reasons specific to this
 * feature: the body must rotate through a full unwrapped 360° (OrbitControls
 * wraps azimuth and fights preset animation), panning must not exist at all,
 * and the same gesture has to feed tap-vs-drag. It is ~80 lines and removes a
 * dependency we would otherwise be configuring against its own defaults.
 *
 * Two things the approved spec asks of the rig beyond the gesture
 * (docs/design/muscle-map/momentum-muscle-map-handoff/HANDOFF.txt §11):
 * the field of view adapts to the viewer's real height, so the body keeps
 * its framing in a shorter card, and under `prefers-reduced-motion` there is
 * no inertia coast and a preset settles at once — drag, tap and the
 * shortcuts keep working.
 */
import { useCallback, useEffect, useImperativeHandle, useRef, forwardRef, type MutableRefObject } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { TapVsDrag } from './useTapVsDrag';
import { bodyMeasure, isMeasuring, type FrameActivity } from '../measure/measure';

export type BodyView = 'front' | 'side' | 'back';

export const VIEW_AZIMUTH: Record<BodyView, number> = { front: 0, side: 90, back: 180 };

const TARGET = new Vector3(0, 0.92, 0);
const DISTANCE = 4.05;
const PITCH_MIN = -22;
const PITCH_MAX = 30;
const YAW_PER_PX = 0.55;
const PITCH_PER_PX = 0.22;
const FRICTION = 0.93;
const D2R = Math.PI / 180;
/** fov 27 at 400 px of height, adapted per height and clamped. */
const FOV_AT_400 = 27;
const FOV_MIN = 22;
const FOV_MAX = 40;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** The fov for a viewer of this height, per HANDOFF.txt §11. */
export function fovForHeight(heightPx: number): number {
  return clamp(FOV_AT_400 * (400 / Math.max(1, heightPx)), FOV_MIN, FOV_MAX);
}

/** Shortest signed way from one angle to another, so we never spin the long way. */
export function shortestDelta(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export type CameraRigHandle = {
  /** Animate to a named view. */
  goTo: (view: BodyView) => void;
  /** Rotate to an absolute azimuth by the shortest path (for list selections). */
  faceAzimuth: (deg: number) => void;
  /** Current azimuth, normalised to 0–360. */
  azimuth: () => number;
};

export type CameraRigProps = {
  /** Called on a gesture the rig judged to be a tap, with canvas-space NDC. */
  onTap?: (ndc: { x: number; y: number }) => void;
  onAzimuthChange?: (deg: number) => void;
  enabled?: boolean;
  /** What each frame is drawn for, for the measuring display. */
  activity?: MutableRefObject<FrameActivity>;
};

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export const CameraRig = forwardRef<CameraRigHandle, CameraRigProps>(function CameraRig(
  { onTap, onAzimuthChange, enabled = true, activity },
  ref,
) {
  const { camera, gl, size, invalidate } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(8);
  const velocity = useRef(0);
  const yawTo = useRef<number | null>(null);
  const gestures = useRef(new TapVsDrag());
  const lastEmitted = useRef<number>(-1);
  const lastEmitAt = useRef(0);
  const wakePending = useRef(false);
  const reduced = useRef(false);
  /** A finger moved the camera since the last frame. */
  const dragged = useRef(false);

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

  // The framing rule: fov follows the real height of the viewer, so a
  // shorter card widens the view instead of cropping the body. R3F already
  // keeps the aspect current on resize; this adds the fov on top of it.
  useEffect(() => {
    const perspective = camera as PerspectiveCamera;
    if (!perspective.isPerspectiveCamera) return;
    perspective.fov = fovForHeight(size.height);
    perspective.updateProjectionMatrix();
    invalidate();
  }, [camera, size.height, invalidate]);

  /**
   * Requests the NEXT frame from outside the current one.
   *
   * Calling invalidate() synchronously inside useFrame is swallowed by the
   * frame already in flight, so a demand loop stops after one step and the
   * body freezes mid-coast. Deferring by one rAF is what keeps inertia and
   * preset animation alive without falling back to frameloop="always".
   */
  const keepAlive = useCallback(() => {
    if (wakePending.current) return;   // coalesce; never stack rAF callbacks
    wakePending.current = true;
    requestAnimationFrame(() => {
      wakePending.current = false;
      invalidate();
    });
  }, [invalidate]);

  useImperativeHandle(ref, () => ({
    goTo(view) {
      // Land on the nearest multiple of 360 plus the preset, so "front" from
      // 350° turns 10° forward instead of 350° backward.
      const want = VIEW_AZIMUTH[view];
      yawTo.current = Math.round((yaw.current - want) / 360) * 360 + want;
      velocity.current = 0;
      invalidate();
    },
    faceAzimuth(deg) {
      yawTo.current = yaw.current + shortestDelta(((yaw.current % 360) + 360) % 360, deg);
      velocity.current = 0;
      invalidate();
    },
    azimuth: () => ((yaw.current % 360) + 360) % 360,
  }));

  const element = gl.domElement;

  useEffect(() => {
    if (!enabled) return;
    const tap = gestures.current;

    const onDown = (e: PointerEvent) => {
      tap.down(e);
      velocity.current = 0;
      yawTo.current = null;
      try {
        element.setPointerCapture(e.pointerId);
      } catch {
        /* Safari can refuse capture mid-gesture; dragging still works. */
      }
      element.style.cursor = 'grabbing';
    };

    const onMove = (e: PointerEvent) => {
      const d = tap.move(e);
      if (!d) return;
      // Only claim the gesture once it is clearly a drag, so a tap still
      // scrolls the page if the user meant to scroll.
      if (!tap.isDown || Math.abs(d.dx) + Math.abs(d.dy) > 0) e.preventDefault();
      yaw.current += d.dx * YAW_PER_PX;
      velocity.current = d.dx * YAW_PER_PX;
      pitch.current = clamp(pitch.current - d.dy * PITCH_PER_PX, PITCH_MIN, PITCH_MAX);
      dragged.current = true;
      if (isMeasuring()) bodyMeasure.requested(performance.now());
      invalidate();
    };

    const onUp = (e: PointerEvent) => {
      const wasTap = tap.up(e);
      try {
        element.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      element.style.cursor = 'grab';
      // Inertia is a motion effect: with reduced motion the body stops where
      // the finger lifted.
      if (reduced.current) velocity.current = 0;
      // Request a frame on release. While the finger was down the coast branch
      // was skipped (isDown), so the demand loop is idle right now — without
      // this, inertia never starts and the body stops dead on lift.
      invalidate();
      if (!wasTap || !onTap) return;
      velocity.current = 0;
      const r = element.getBoundingClientRect();
      onTap({
        x: ((e.clientX - r.left) / r.width) * 2 - 1,
        y: -((e.clientY - r.top) / r.height) * 2 + 1,
      });
    };

    const onCancel = () => {
      tap.cancel();
      element.style.cursor = 'grab';
      invalidate();
    };

    element.style.cursor = 'grab';
    element.style.touchAction = 'none';
    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove, { passive: false });
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onCancel);
    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onCancel);
    };
  }, [element, enabled, onTap, invalidate]);

  const applyCamera = useCallback(() => {
    const y = yaw.current * D2R;
    const p = pitch.current * D2R;
    const radius = DISTANCE * Math.cos(p);
    camera.position.set(
      TARGET.x + radius * Math.sin(y),
      TARGET.y + DISTANCE * Math.sin(p),
      TARGET.z + radius * Math.cos(y),
    );
    camera.lookAt(TARGET);
  }, [camera]);

  useFrame(() => {
    let moving = false;
    if (yawTo.current !== null) {
      const d = yawTo.current - yaw.current;
      if (reduced.current || Math.abs(d) < 0.4) {
        // A preset settles at once under reduced motion; otherwise it snaps
        // only inside the last fraction of a degree.
        yaw.current = yawTo.current;
        yawTo.current = null;
      } else {
        yaw.current += d * 0.18;
      }
      moving = true;
    } else if (!gestures.current.isDown && Math.abs(velocity.current) > 0.02) {
      yaw.current += velocity.current;
      velocity.current *= FRICTION;
      moving = true;
    }
    applyCamera();
    if (moving) keepAlive();
    if (activity) {
      // A frame drawn for a finger that moved, or for the camera's own motion.
      activity.current.rotating = moving || dragged.current;
      activity.current.coasting = moving;
      dragged.current = false;
    }

    // Report the angle sparingly: it drives host state, and emitting every
    // frame re-renders the surrounding screen while the body is still spinning.
    // The `settled` case is what guarantees the final resting angle is always
    // published, even though the throttle suppressed everything before it.
    if (!onAzimuthChange) return;
    const deg = Math.round(((yaw.current % 360) + 360) % 360);
    const settled = !moving && !gestures.current.isDown;
    const now = performance.now();
    if (deg !== lastEmitted.current && (settled || now - lastEmitAt.current > 200)) {
      lastEmitted.current = deg;
      lastEmitAt.current = now;
      onAzimuthChange(deg);
    }
  });

  return null;
});
