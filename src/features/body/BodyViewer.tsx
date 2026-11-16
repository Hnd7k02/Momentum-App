/**
 * BodyViewer — the interactive 3D body for Momentum's Gym section.
 *
 * Owns: rendering, highlighting, camera, selection reporting.
 * Owns nothing else. Percentages, progress, history, ranking and all Gym
 * business logic stay in core/gym; this component receives derived state and
 * emits `onSelectMuscle`.
 *
 * Lazy-load it — three.js must not sit in the initial bundle. `./index.ts`
 * exports the lazy boundary the host is meant to use.
 *
 * It fills the box its host gives it — the stage in Muskelgruppen, as tall
 * as 55 % of the screen — and frames the body the same way in every one
 * (`framing.ts`).
 *
 * What block 7B added (contract §8):
 *
 * - **It knows where a selection comes from.** One it reported itself — a
 *   tap on the body — never turns the body. One the host made, in the list,
 *   turns the body to the group when the group faces away.
 * - **It says what stands in the stage**: nothing yet (`loading`), the body
 *   (`shown`), nothing again while a lost graphics context is replaced
 *   (`lost`), or the flat figure (`flat`). The host shows the body's still
 *   whenever the canvas has nothing to show, so the stage is never empty.
 * - **It can be held.** A host pauses it, and so does any sheet about to
 *   stand over it (`app/stillness.ts`, D146): a coast ends at once, a
 *   camera travel in flight is finished, and then no frame arises by
 *   itself. Held, it draws exactly one frame whenever what it has to show
 *   changes. The pause ends before a new travel begins: one asked for
 *   meanwhile starts when the pause is lifted.
 * - **A lost context is not a blank canvas.** It waits a moment for the
 *   browser to give the context back, draws again if it does, replaces the
 *   canvas if it does not, and stands the flat figure in when that fails.
 */
import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Canvas, addAfterEffect, useThree } from '@react-three/fiber';
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  NoToneMapping,
  PMREMGenerator,
  SRGBColorSpace,
  type Box3,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { MuscleGroup } from '../../core/model';
import { stillness } from '../../app/stillness';
import { ResetIcon } from '../../components/Icons';
import { useT } from '../../i18n/I18nProvider';
import { BodyGround } from './BodyGround';
import { BodyModel, type RegionBoxes } from './BodyModel';
import { CameraRig, VIEW_AZIMUTH, type BodyTap, type BodyView, type CameraRigHandle } from './CameraRig';
import { FrameProbe } from './FrameProbe';
import { STAGE } from './framing';
import { shortestDelta } from './motion';
import { FROM_MEMORY, bodyMeasure, idleActivity, isMeasuring, type FrameActivity } from '../measure/measure';
import { REGION_FACING, type MuscleMeshes } from './muscleMeshMap';
import type { MuscleVisual } from './useMuscleHighlight';
import { BODY_LIGHT, BODY_LOOK, type BodyLook } from './tokens';
import './bodyViewer.css';

export type { BodyView, MuscleVisual };

/** What stands in the stage. */
export type BodyStageState = 'loading' | 'shown' | 'lost' | 'flat';

export type BodyViewerProps = {
  /** Override the GLB location (versioned asset, tests, injected blob). */
  modelUrl?: string;
  /** Per-muscle colour + strength, already derived by the Gym domain. */
  visuals?: Partial<Record<MuscleGroup, MuscleVisual>>;
  selectedMuscle?: MuscleGroup | null;
  /**
   * A tap on the body chose a group. The viewer remembers that this
   * selection is its own and does not turn for it; a host that declines a
   * tap must not later select the same group by another way and expect the
   * body to turn to it.
   */
  onSelectMuscle?: (muscle: MuscleGroup) => void;
  /** Data colours off = one figure in the neutral tone. Selection still highlights. */
  tinted?: boolean;
  /** The named view the current angle falls into, whenever it changes. */
  onViewChange?: (view: BodyView) => void;
  /**
   * The authoritative rotation in degrees, 0–359, throttled while moving and
   * always once on the settled frame.
   */
  onRotate?: (angle: number, view: BodyView) => void;
  /** Rendered instead of the canvas when WebGL is unavailable or the body cannot be drawn. */
  fallback?: React.ReactNode;
  /**
   * Lights, tone mapping and surface. The app never passes it and gets
   * `BODY_LOOK`; the dev harness passes a candidate (block 7A).
   */
  look?: BodyLook;
  /**
   * The host holds the viewer: no frame arises by itself and the last one
   * stays. A coast ends at once; a travel in flight is finished first.
   */
  paused?: boolean;
  /** The pause holds (`true`) or was lifted (`false`). */
  onHeld?: (held: boolean) => void;
  /** What stands in the stage, whenever it changes. */
  onStateChange?: (state: BodyStageState) => void;
};

const TONE_MAPPING = { aces: ACESFilmicToneMapping, agx: AgXToneMapping, none: NoToneMapping } as const;

const VIEW_LABEL_KEYS = {
  front: 'body.view.front',
  side: 'body.view.side',
  back: 'body.view.back',
} as const;

/** How far a group may face away before a selection in the list turns the body to it: degrees. */
const TURN_TO_SELECTION_BEYOND = 70;
/** How long a lost context may take to come back before the canvas is replaced: ms. */
const CONTEXT_WAIT_MS = 1500;
/** Stable, so that neither is a new value on a render: see the canvas. */
const NOTHING = () => undefined;
const MEASURE = { scroll: false } as const;

/** How often a canvas is replaced before the flat figure stands in. */
const CANVAS_REPLACEMENTS = 2;

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

/**
 * The studio the body is lit in, with ZERO bytes over the wire:
 * RoomEnvironment is code, not an asset. Generated per renderer — and again
 * after a lost context came back, which took the texture with it.
 */
function createEnvironment(gl: WebGLRenderer, scene: Scene): Texture {
  const pmrem = new PMREMGenerator(gl);
  const room = new RoomEnvironment();
  const texture = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  scene.environment = texture;
  return texture;
}

/**
 * Held, the viewer draws one frame when what it has to show changes: a
 * colour, the selection, the model arriving, the stage's size, the screen
 * coming back. `advance` draws exactly one and starts no loop.
 */
function HeldFrame({
  holding,
  show,
}: {
  holding: boolean;
  /** Everything the picture depends on from outside; a change is a reason for a frame. */
  show: readonly [unknown, unknown, unknown, unknown, unknown, unknown];
}) {
  const advance = useThree((state) => state.advance);
  const size = useThree((state) => state.size);
  const [visuals, selected, tinted, ready, live, context] = show;
  useEffect(() => {
    if (holding) advance(performance.now() / 1000);
  }, [holding, advance, size.width, size.height, visuals, selected, tinted, ready, live, context]);
  return null;
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
  look = BODY_LOOK,
  paused = false,
  onHeld,
  onStateChange,
}: BodyViewerProps) {
  const t = useT();
  const [supported] = useState(hasWebGL);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<BodyView>('front');
  const rig = useRef<CameraRigHandle>(null);
  const shell = useRef<HTMLDivElement>(null);
  const pick = useRef<((tap: BodyTap) => MuscleGroup | null) | null>(null);
  // The studio environment is generated once per renderer and must be freed
  // with it: React unmounting the canvas does not release a GPU texture.
  const environment = useRef<Texture | null>(null);
  const three = useRef<{ gl: WebGLRenderer; scene: Scene } | null>(null);
  const rotate = useRef(onRotate);
  rotate.current = onRotate;
  // Nothing to draw for a body nobody can see. The demand loop already
  // sleeps when the body is still; this covers the other case — an animation
  // running while the tab is in the background or the stage has been scrolled
  // away — by stopping the loop outright rather than letting it burn frames.
  const [live, setLive] = useState(true);
  const liveNow = useRef(live);
  liveNow.current = live;
  const invalidate = useRef<(() => void) | null>(null);
  // What each frame is drawn for, written by the camera and the materials
  // and read by the probe: for the pause, and for the measuring display.
  const activity = useRef<FrameActivity>(idleActivity());
  useState(() => {
    // On a second visit the code is not fetched again: the lazy boundary
    // reported the first, and this is the moment it was there once more.
    if (isMeasuring()) bodyMeasure.codeReady(performance.now(), FROM_MEMORY);
    return null;
  });

  /* ── What stands in the stage ───────────────────────────────────────── */

  /** The model is compiled and in the scene. */
  const [ready, setReady] = useState(false);
  /** Its first picture has been drawn. */
  const [shown, setShown] = useState(false);
  /** The graphics context is gone and has not come back yet. */
  const [lost, setLost] = useState(false);
  /** Counts the canvases this viewer has had: a lost context that stays lost gets a new one. */
  const [generation, setGeneration] = useState(0);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  /** Counts the contexts that came back, so a held viewer draws once for each. */
  const [restored, setRestored] = useState(0);
  const boxes = useRef<RegionBoxes | null>(null);
  const keepInView = useRef<Box3 | null>(null);

  const state: BodyStageState = !supported || failed ? 'flat' : lost ? 'lost' : shown ? 'shown' : 'loading';
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const onReady = useCallback((_: MuscleMeshes, regionBoxes: RegionBoxes) => {
    boxes.current = regionBoxes;
    setReady(true);
  }, []);

  // The first picture: after the first render that had the model in it.
  useEffect(() => {
    if (!ready || shown) return undefined;
    const stop = addAfterEffect(() => {
      setShown(true);
      stop();
    });
    return stop;
  }, [ready, shown]);

  /* ── Selection: where it comes from decides whether the body turns ──── */

  const selectedNow = useRef(selectedMuscle);
  selectedNow.current = selectedMuscle;
  /** The group this viewer's own tap just asked the host to select. */
  const tapped = useRef<MuscleGroup | null>(null);

  const registerPick = useCallback((fn: (tap: BodyTap) => MuscleGroup | null) => {
    pick.current = fn;
  }, []);

  const onTap = useCallback(
    (tap: BodyTap) => {
      const hit = pick.current?.(tap);
      // A miss does nothing. An accidental deselect is far more annoying than
      // a missed tap, so we never clear the selection from a stray tap.
      if (!hit) return;
      // Remembered only where the selection will change: the mark is used up
      // by the change it announces, and a tap on the chosen group changes
      // nothing.
      if (hit !== selectedNow.current) tapped.current = hit;
      onSelectMuscle?.(hit);
    },
    [onSelectMuscle],
  );

  /** The selection the effect below last saw: only a change of it may turn the body. */
  const seen = useRef<MuscleGroup | null>(null);
  useEffect(() => {
    const own = tapped.current !== null && tapped.current === selectedMuscle;
    tapped.current = null;
    // A zoom keeps the chosen group in its window (`framing.ts`). Its box is
    // known once the model is there, which is why this also runs then.
    keepInView.current = selectedMuscle ? (boxes.current?.get(selectedMuscle) ?? null) : null;
    invalidate.current?.();
    const changed = seen.current !== selectedMuscle;
    seen.current = selectedMuscle;
    // The model arriving — or arriving again, after a lost context — is no
    // new selection and turns nothing.
    if (!changed || !selectedMuscle || !rig.current) return;
    // A tap on the body selects and never turns it (contract §8): the
    // finger is on the group, so the group is in view.
    if (own) return;
    // A selection made in the list turns the body to the group when it
    // faces away. Only then — otherwise the body twitches on every row.
    const want = REGION_FACING[selectedMuscle];
    if (Math.abs(shortestDelta(rig.current.azimuth(), want)) > TURN_TO_SELECTION_BEYOND) rig.current.faceAzimuth(want);
  }, [selectedMuscle, ready]);

  const onAzimuthChange = useCallback((deg: number) => {
    // Imperative, not state: the angle changes every frame while spinning and
    // must not re-render the surrounding screen. Exposed for tests and CSS.
    shell.current?.setAttribute('data-azimuth', String(deg));
    const next = viewFor(deg);
    rotate.current?.(deg, next);
    setView((prev) => (prev === next ? prev : next));
  }, []);

  const onZoomChange = useCallback((zoom: number) => {
    shell.current?.setAttribute('data-zoom', String(zoom));
  }, []);

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

  /* ── The pause ──────────────────────────────────────────────────────── */

  // A sheet about to stand over the body asks for the same pause a host does.
  const sheetWaits = useSyncExternalStore(stillness.subscribe, stillness.isWanted, () => false);
  const pauseWanted = paused || sheetWaits;
  const pauseWantedNow = useRef(pauseWanted);
  pauseWantedNow.current = pauseWanted;
  /** The pause holds: nothing moves, and no frame arises by itself. */
  const [holding, setHolding] = useState(false);
  const still = useRef(false);
  still.current = holding;

  useEffect(() => {
    if (!pauseWanted) {
      setHolding(false);
      return;
    }
    const camera = rig.current;
    // No camera yet, or a stage nobody sees: nothing can be drawn, so it
    // holds now — a travel jumps to its goal, since it cannot be drawn there.
    if (!camera || !liveNow.current) {
      camera?.hold(true);
      setHolding(true);
      return;
    }
    // A coast ends here. With nothing on its way the pause holds at once;
    // a travel and a colour finish first, and the frame they end in says so.
    if (camera.hold() && !activity.current.easing) setHolding(true);
  }, [pauseWanted, live]);

  const onRest = useCallback(() => {
    if (pauseWantedNow.current) setHolding(true);
  }, []);

  const canDraw = supported && !failed;
  // Whatever can draw by itself tells the sheets when it will not.
  const mover = useRef<ReturnType<typeof stillness.join> | null>(null);
  useEffect(() => {
    const joined = stillness.join();
    mover.current = joined;
    return () => {
      joined.leave();
      mover.current = null;
    };
  }, []);
  useEffect(() => {
    // The flat figure draws nothing by itself: it never keeps a sheet waiting.
    mover.current?.rest(holding || !canDraw);
    onHeld?.(holding);
  }, [holding, canDraw, onHeld]);

  /* ── A lost context ─────────────────────────────────────────────────── */

  useEffect(() => {
    if (!canvas) return undefined;
    const onLost = (event: Event) => {
      // Without this the browser never gives the context back.
      event.preventDefault();
      // The still that stands in shows the body as it stands at the start,
      // and a canvas that replaces this one starts there in any case. So the
      // view goes back there now, at once: the body returns where its still
      // stood, whichever way it returns.
      rig.current?.reset(true);
      setLost(true);
    };
    const onRestored = () => {
      // The context is back and empty: the studio's texture went with it.
      const current = three.current;
      if (current) {
        environment.current?.dispose();
        environment.current = createEnvironment(current.gl, current.scene);
      }
      setLost(false);
      setRestored((count) => count + 1);
      invalidate.current?.();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [canvas]);

  // A context that does not come back by itself — on a phone, after the app
  // lay in the background — is replaced: a new canvas, with a new context.
  // And where that is lost as well, the flat figure stands in. Counted from
  // the moment the stage can be seen: a hidden page runs no timers.
  const replacements = useRef(0);
  useEffect(() => {
    if (!lost || !live) return undefined;
    const timer = window.setTimeout(() => {
      if (replacements.current >= CANVAS_REPLACEMENTS) {
        setFailed(true);
        return;
      }
      replacements.current += 1;
      setReady(false);
      setShown(false);
      setLost(false);
      setCanvas(null);
      setGeneration((count) => count + 1);
    }, CONTEXT_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [lost, live]);

  // While the context is away nothing of the body is on the canvas.
  useEffect(() => {
    if (lost) setShown(false);
  }, [lost]);

  useEffect(() => {
    if (!isMeasuring()) return;
    if (!supported) bodyMeasure.failed('unsupported');
    else if (failed) bodyMeasure.failed('loadFailed');
    else if (lost) bodyMeasure.failed('contextLost');
  }, [supported, failed, lost]);

  if (!canDraw) return <>{fallback}</>;

  return (
    <div
      className="body-viewer"
      ref={shell}
      data-azimuth="0"
      data-zoom="1"
      data-view={view}
      data-state={state}
      data-held={holding ? '' : undefined}
    >
      <Canvas
        key={generation}
        // Two frames nobody asked for, taken away (block 7B, found with the
        // measuring display). The renderer's root sets "pointer missed" in
        // its store on every render of this element as long as there is
        // none, and any change to that store draws a frame: a handler that
        // does nothing ends that. And it measures the canvas again after
        // every scroll of the page, for an event system this viewer does
        // not use — the rig reads the canvas's place when a finger lands —
        // and a new place is a new size, which draws a frame too.
        onPointerMissed={NOTHING}
        resize={MEASURE}
        // iPhone reports 3; capping at 2 saves ~55% of the fill rate with no
        // visible difference at this size.
        dpr={[1, 2]}
        // A static body must not burn 60fps. Every interaction invalidates.
        // Held or unseen, the loop is off: nothing arises by itself.
        frameloop={live && !holding ? 'demand' : 'never'}
        camera={{ fov: STAGE.fov, near: 0.1, far: 40, position: [0, STAGE.target[1], STAGE.distance] }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={(root) => {
          const { gl, scene } = root;
          invalidate.current = root.invalidate;
          three.current = { gl, scene };
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = TONE_MAPPING[look.toneMapping];
          gl.toneMappingExposure = look.exposure;
          environment.current?.dispose();
          environment.current = createEnvironment(gl, scene);
          setCanvas(gl.domElement);
        }}
      >
        <hemisphereLight args={[BODY_LIGHT.sky, BODY_LIGHT.ground, look.hemisphere]} />
        <directionalLight position={[...look.key.position]} intensity={look.key.intensity} />
        <directionalLight position={[...look.fill.position]} intensity={look.fill.intensity} color={BODY_LIGHT.fill} />
        <directionalLight position={[...look.back.position]} intensity={look.back.intensity} />
        <CameraRig
          ref={rig}
          // A finger moves the body it can see. While the still stands in —
          // before the first picture, and while a context is away — a drag
          // would turn a body nobody sees turning, and a tap has nothing
          // to meet.
          enabled={state === 'shown'}
          onTap={onTap}
          onAzimuthChange={onAzimuthChange}
          onZoomChange={onZoomChange}
          activity={activity}
          keepInView={keepInView}
          frozen={still}
        />
        <Suspense fallback={null}>
          <BodyModel
            modelUrl={modelUrl}
            visuals={visuals}
            selected={selectedMuscle}
            tinted={tinted}
            registerPick={registerPick}
            onReady={onReady}
            onError={onError}
            surface={look.surface}
            activity={activity}
            still={still}
          />
        </Suspense>
        <BodyGround visible={ready} />
        <HeldFrame holding={holding} show={[visuals, selectedMuscle, tinted, ready, live, restored]} />
        {/* Last, so it reads what the camera and the materials said of this frame. */}
        <FrameProbe activity={activity} onRest={onRest} />
      </Canvas>

      {/* Fixed surfaces at the top of the stage (contract §8): the three
          views on one side, back to the start on the other. Solid, never
          glass: they stand over a canvas that can move (D146). */}
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
      <button
        type="button"
        className="body-viewer__reset"
        aria-label={t('body.reset')}
        onClick={() => {
          rig.current?.reset();
          setView('front');
        }}
      >
        <ResetIcon size={18} />
      </button>
    </div>
  );
}
