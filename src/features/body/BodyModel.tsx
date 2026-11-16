/**
 * The body mesh: loads the GLB, resolves the muscle contract, answers taps.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Box3, Group, Mesh, MeshStandardMaterial, Raycaster, Vector2 } from 'three';
import { addAfterEffect, useThree } from '@react-three/fiber';
import { isLoaded, useGLTF } from './useGLTF';
import type { MuscleGroup } from '../../core/model';
import type { BodyTap } from './CameraRig';
import { INERT_REGION, resolveMuscleMeshes, type MuscleMeshes } from './muscleMeshMap';
import { groupAtTap } from './picking';
import { useMuscleHighlight, type MuscleVisual } from './useMuscleHighlight';
import { BODY_INERT_COLOR, BODY_LOOK, type BodyLook } from './tokens';
import { FROM_MEMORY, bodyMeasure, isMeasuring, resourceFacts, resourceSince, type FrameActivity } from '../measure/measure';

/**
 * Where the shipped model lives, under whatever base the app is served from
 * — `/Momentum-App/` on the production site, another for a preview build. An
 * absolute `/models/…` would break under either.
 */
export const BODY_MODEL_URL = `${import.meta.env.BASE_URL}models/momentum-body.glb`;

/** Each group's box in the world: what a zoom keeps in its window. */
export type RegionBoxes = Map<MuscleGroup, Box3>;

export type BodyModelProps = {
  /** Defaults to BODY_MODEL_URL. Override for a versioned or injected asset. */
  modelUrl?: string;
  visuals?: Partial<Record<MuscleGroup, MuscleVisual>>;
  selected?: MuscleGroup | null;
  tinted?: boolean;
  /** The model is in the scene, compiled and about to be drawn for the first time. */
  onReady?: (meshes: MuscleMeshes, boxes: RegionBoxes) => void;
  onError?: (error: Error) => void;
  /** Registers the tap handler with the parent so CameraRig can drive it. */
  registerPick?: (pick: (tap: BodyTap) => MuscleGroup | null) => void;
  /** A look's surface values; absent is the app's own (`BODY_LOOK`). */
  surface?: BodyLook['surface'];
  /** What each frame is drawn for, for the measuring display. */
  activity?: MutableRefObject<FrameActivity>;
  /** The viewer is held: a change of colour is shown at once, in the one frame it gets. */
  still?: MutableRefObject<boolean>;
};

export function BodyModel({
  modelUrl = BODY_MODEL_URL,
  visuals,
  selected,
  tinted,
  onReady,
  onError,
  registerPick,
  surface = BODY_LOOK.surface,
  activity,
  still,
}: BodyModelProps) {
  const { camera, invalidate, gl, scene } = useThree();
  const root = useRef<Group>(null);
  const [meshes, setMeshes] = useState<MuscleMeshes | null>(null);
  /** The materials are compiled: the body may be drawn. */
  const [ready, setReady] = useState(false);
  // Whether the model had been asked for before this viewer did: then
  // nothing is fetched, and the measuring display says so.
  const wasLoaded = useRef(isLoaded(modelUrl));
  const { gltf, error } = useGLTF(modelUrl);
  const raycaster = useMemo(() => new Raycaster(), []);

  // A fetch or parse failure is the viewer's to show, not ours to hide.
  useEffect(() => {
    if (error) onError?.(error);
  }, [error, onError]);

  useEffect(() => {
    if (!gltf) return;
    // The inert primitive (head, hands, feet) keeps a material of its own so
    // it can never be tinted, as in body-viewer.js — and a tone of its own
    // (D166). Created here, with the scene, and disposed with it.
    const inert: MeshStandardMaterial[] = [];
    try {
      const resolved = resolveMuscleMeshes(gltf.scene);
      gltf.scene.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh || mesh.userData.muscle) return;
        const material = new MeshStandardMaterial({
          color: BODY_INERT_COLOR,
          roughness: surface.inertRoughness,
          metalness: 0,
        });
        material.envMapIntensity = surface.environment;
        // A model may bring a baked shade as a vertex colour (tools/body).
        // Conditional on purpose: without the attribute it would render black.
        material.vertexColors = mesh.geometry.hasAttribute('color');
        material.name = INERT_REGION;
        mesh.material = material;
        inert.push(material);
      });
      setReady(false);
      setMeshes(resolved);
    } catch (e) {
      onError?.(e as Error);
    }
    return () => {
      for (const material of inert) material.dispose();
    };
  }, [gltf, onError, surface]);

  // The region materials are made here, in the commit that set `meshes`.
  useMuscleHighlight({ meshes, visuals, selected, tinted, invalidate, surface, activity, still });

  /*
   * Compile before the body is shown, and compile what will be drawn: the
   * region materials exist by now (the hook above made them), so this is
   * every program the first picture needs. Until block 7B the model was
   * compiled with the materials the file brought, the regions got theirs
   * afterwards, and their program was compiled inside the first visible
   * frame — the stall this was written to avoid. The body stays hidden
   * until the compile is done, so no frame can draw it half-dressed.
   */
  useEffect(() => {
    if (!gltf || !meshes) return undefined;
    let cancelled = false;
    const show = () => {
      if (cancelled) return;
      gltf.scene.updateMatrixWorld(true);
      const boxes: RegionBoxes = new Map();
      for (const [id, mesh] of meshes) boxes.set(id, new Box3().setFromObject(mesh));
      setReady(true);
      onReady?.(meshes, boxes);
      invalidate();
    };
    gl.compileAsync(gltf.scene, camera, scene).then(show, show);
    return () => {
      cancelled = true;
    };
  }, [gltf, meshes, gl, camera, scene, onReady, invalidate]);

  // The measuring display (block 7B): when the model was there, and where
  // the browser says it came from — or that it was not fetched at all,
  // because an earlier viewer had asked for it — and when the first picture
  // with it had been drawn. Neither asks for a frame.
  useEffect(() => {
    if (!gltf || !isMeasuring()) return;
    const file = modelUrl.split('/').pop()?.split('?')[0] ?? modelUrl;
    const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const request = resourceSince(new RegExp(`${escaped}(?:\\?|$)`), bodyMeasure.since ?? 0);
    bodyMeasure.modelReady(performance.now(), request || !wasLoaded.current ? resourceFacts(request) : FROM_MEMORY);
  }, [gltf, modelUrl]);
  useEffect(() => {
    if (!ready || !isMeasuring()) return undefined;
    const stop = addAfterEffect(() => {
      bodyMeasure.firstFrame(performance.now());
      stop();
    });
    return stop;
  }, [ready]);

  /**
   * The group a tap means (`picking.ts`): the surface seen where it landed,
   * and failing that the nearest group within twelve pixels. A neutral
   * surface is a surface — it hides what is behind it.
   */
  const pick = useCallback(
    (tap: BodyTap): MuscleGroup | null => {
      const body = root.current;
      if (!body || !meshes || !ready) return null;
      const point = new Vector2();
      const look = (dx: number, dy: number): MuscleGroup | null => {
        point.set(((tap.x + dx) / tap.width) * 2 - 1, -((tap.y + dy) / tap.height) * 2 + 1);
        raycaster.setFromCamera(point, camera);
        // Sorted near → far: the first hit is the surface the eye sees.
        const first = raycaster.intersectObject(body, true)[0];
        return (first?.object.userData.muscle as MuscleGroup | null | undefined) ?? null;
      };
      return groupAtTap(look);
    },
    [camera, meshes, raycaster, ready],
  );

  useEffect(() => {
    registerPick?.(pick);
  }, [pick, registerPick]);

  if (!gltf) return null;
  return (
    <group ref={root} visible={ready}>
      <primitive object={gltf.scene} />
    </group>
  );
}
