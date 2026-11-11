/**
 * BodyViewer — the interactive 3D body for Momentum's Gym section.
 *
 * Owns: rendering, highlighting, camera, selection reporting.
 * Owns nothing else. Percentages, progress, history, ranking and all Gym
 * business logic stay in core/gym; this component receives derived state and
 * emits `onSelectMuscle`. The approved behaviour it implements is
 * docs/design/muscle-map/momentum-muscle-map-handoff/HANDOFF.txt.
 *
 * Lazy-load it — three.js must not sit in the initial bundle. `./index.ts`
 * exports the lazy boundary the host is meant to use.
 *
 * It sizes from its host: the shell is as wide as the card and keeps a
 * square-ish aspect (see bodyViewer.css), and the rig adapts the field of
 * view to whatever height that produces.
 */
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, PMREMGenerator, SRGBColorSpace, type Texture } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { MuscleGroup } from '../../core/model';
import { useT } from '../../i18n/I18nProvider';
import { BodyModel } from './BodyModel';
import { CameraRig, VIEW_AZIMUTH, type BodyView, type CameraRigHandle } from './CameraRig';
import { REGION_FACING } from './muscleMeshMap';
import type { MuscleVisual } from './useMuscleHighlight';
import { BODY_LIGHT } from './tokens';
import './bodyViewer.css';

export type { BodyView, MuscleVisual };

export type BodyViewerProps = {
  /** Override the GLB location (versioned asset, tests, injected blob). */
  modelUrl?: string;
  /** Per-muscle colour + strength, already derived by the Gym domain. */
  visuals?: Partial<Record<MuscleGroup, MuscleVisual>>;
  selectedMuscle?: MuscleGroup | null;
  onSelectMuscle?: (muscle: MuscleGroup) => void;
  /** Data colours off = neutral premium body. Selection still highlights. */
  tinted?: boolean;
  /** The named view the current angle falls into, whenever it changes. */
  onViewChange?: (view: BodyView) => void;
  /**
   * The authoritative rotation in degrees, 0–359, throttled while moving and
   * always once on the settled frame — the React form of `body-rotate`.
   */
  onRotate?: (angle: number, view: BodyView) => void;
  /** Rendered instead of the canvas when WebGL is unavailable or the load fails. */
  fallback?: React.ReactNode;
};

const VIEW_LABEL_KEYS = {
  front: 'body.view.front',
  side: 'body.view.side',
  back: 'body.view.back',
} as const;

/**
 * Cheap capability probe. Runs once per page — a `useState` initialiser is
 * called twice under StrictMode, and each probe would otherwise hold a
 * WebGL context it never used, counting toward the browser's limit. The
 * probe's own context is released the moment it has answered. A failure
 * here means we never mount Canvas.
 */
let webglSupport: boolean | null = null;
function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    const gl = window.WebGLRenderingContext ? canvas.getContext('webgl2') : null;
    webglSupport = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

function viewFor(azimuth: number): BodyView {
  if (azimuth < 45 || azimuth > 315) return 'front';
  if (azimuth > 135 && azimuth < 225) return 'back';
  return 'side';
}

export default function BodyViewer({
  modelUrl,
  visuals,
  selectedMuscle = null,
  onSelectMuscle,
  tinted = true,
  onViewChange,
  onRotate,
  fallback = null,
}: BodyViewerProps) {
  const t = useT();
  const [supported] = useState(hasWebGL);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<BodyView>('front');
  const rig = useRef<CameraRigHandle>(null);
  const shell = useRef<HTMLDivElement>(null);
  const pick = useRef<((ndc: { x: number; y: number }) => MuscleGroup | null) | null>(null);
  // The studio environment is generated once per renderer and must be freed
  // with it: React unmounting the canvas does not release a GPU texture.
  const environment = useRef<Texture | null>(null);
  const rotate = useRef(onRotate);
  rotate.current = onRotate;
  // Nothing to draw for a body nobody can see. The demand loop already
  // sleeps when the body is still; this covers the other case — an animation
  // running while the tab is in the background or the card has been scrolled
  // away — by stopping the loop outright rather than letting it burn frames.
  const [live, setLive] = useState(true);
  const invalidate = useRef<(() => void) | null>(null);

  const registerPick = useCallback((fn: (ndc: { x: number; y: number }) => MuscleGroup | null) => {
    pick.current = fn;
  }, []);

  const onTap = useCallback(
    (ndc: { x: number; y: number }) => {
      const hit = pick.current?.(ndc);
      // A miss does nothing. An accidental deselect is far more annoying than
      // a missed tap, so we never clear the selection from a stray tap.
      if (hit) onSelectMuscle?.(hit);
    },
    [onSelectMuscle],
  );

  const onAzimuthChange = useCallback(
    (deg: number) => {
      // Imperative, not state: the angle changes every frame while spinning and
      // must not re-render the surrounding screen. Exposed for tests and CSS.
      shell.current?.setAttribute('data-azimuth', String(deg));
      const next = viewFor(deg);
      rotate.current?.(deg, next);
      setView((prev) => (prev === next ? prev : next));
    },
    [],
  );

  const onError = useCallback(() => setFailed(true), []);

  useEffect(() => {
    onViewChange?.(view);
  }, [view, onViewChange]);

  useEffect(
    () => () => {
      environment.current?.dispose();
      environment.current = null;
    },
    [],
  );

  // One observer and one listener, both removed on unmount, so leaving Gym
  // and coming back leaves exactly one of each rather than two.
  useEffect(() => {
    const element = shell.current;
    let onScreen = true;
    const apply = () => setLive(onScreen && !document.hidden);
    const onVisibility = () => apply();
    document.addEventListener('visibilitychange', onVisibility);
    let observer: IntersectionObserver | null = null;
    if (element && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (!entry) return;
          onScreen = entry.isIntersecting;
          apply();
        },
        { threshold: 0 },
      );
      observer.observe(element);
    }
    apply();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
    };
  }, []);

  // Waking is one frame, not a loop: the demand loop goes back to sleep by
  // itself once whatever was moving has settled.
  useEffect(() => {
    if (live) invalidate.current?.();
  }, [live]);

  // Bring a selection made in the list into view when it faces away. Only when
  // the selected group is on the far side — otherwise the body twitches on
  // every list tap.
  useEffect(() => {
    if (!selectedMuscle || !rig.current) return;
    const want = REGION_FACING[selectedMuscle];
    const current = rig.current.azimuth();
    let d = (want - current) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    if (Math.abs(d) > 70) rig.current.faceAzimuth(want);
  }, [selectedMuscle]);

  if (!supported || failed) return <>{fallback}</>;

  return (
    <div className="body-viewer" ref={shell} data-azimuth="0" data-view={view}>
      <Canvas
        // iPhone reports 3; capping at 2 saves ~55% of the fill rate with no
        // visible difference at this size.
        dpr={[1, 2]}
        // A static body must not burn 60fps. Every interaction invalidates.
        frameloop={live ? 'demand' : 'never'}
        camera={{ fov: 27, near: 0.1, far: 40, position: [0, 0.92, 4.05] }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={(state) => {
          const { gl, scene } = state;
          invalidate.current = state.invalidate;
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = ACESFilmicToneMapping;
          // Studio lighting with ZERO bytes over the wire: RoomEnvironment is
          // code, not an asset. No remote HDRI, no CDN — HANDOFF.txt §12.
          const pmrem = new PMREMGenerator(gl);
          environment.current?.dispose();
          environment.current = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
          scene.environment = environment.current;
          pmrem.dispose();
        }}
      >
        <hemisphereLight args={[BODY_LIGHT.sky, BODY_LIGHT.ground, 1.35]} />
        <directionalLight position={[-1.7, 2.6, 2.4]} intensity={2.15} />
        <directionalLight position={[2.4, 0.9, 1.5]} intensity={0.75} color={BODY_LIGHT.fill} />
        <directionalLight position={[0.4, 1.9, -2.8]} intensity={1.05} />
        <CameraRig ref={rig} onTap={onTap} onAzimuthChange={onAzimuthChange} />
        <Suspense fallback={null}>
          <BodyModel
            modelUrl={modelUrl}
            visuals={visuals}
            selected={selectedMuscle}
            tinted={tinted}
            registerPick={registerPick}
            onError={onError}
          />
        </Suspense>
      </Canvas>

      <div className="body-viewer__views" role="group" aria-label={t('body.view')}>
        {(Object.keys(VIEW_AZIMUTH) as BodyView[]).map((v) => (
          <button
            key={v}
            type="button"
            className="body-viewer__view"
            aria-pressed={view === v}
            onClick={() => {
              rig.current?.goTo(v);
              setView(v);
            }}
          >
            {t(VIEW_LABEL_KEYS[v])}
          </button>
        ))}
      </div>
    </div>
  );
}
