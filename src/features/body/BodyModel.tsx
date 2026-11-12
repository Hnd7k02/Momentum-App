/**
 * The body mesh: loads the GLB, resolves the muscle contract, raycasts taps.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Mesh, MeshStandardMaterial, Raycaster, Vector2 } from 'three';
import { useThree } from '@react-three/fiber';
import { useGLTF } from './useGLTF';
import type { MuscleGroup } from '../../core/model';
import { INERT_REGION, resolveMuscleMeshes, type MuscleMeshes } from './muscleMeshMap';
import { useMuscleHighlight, type MuscleVisual } from './useMuscleHighlight';
import { BODY_DIMMED_COLOR, type BodyLook } from './tokens';

/**
 * Where the shipped model lives, under whatever base the app is served from
 * — `/Momentum-App/` on the production site, another for a preview build. An
 * absolute `/models/…` would break under either.
 */
export const BODY_MODEL_URL = `${import.meta.env.BASE_URL}models/momentum-body.glb`;

export type BodyModelProps = {
  /** Defaults to BODY_MODEL_URL. Override for a versioned or injected asset. */
  modelUrl?: string;
  visuals?: Partial<Record<MuscleGroup, MuscleVisual>>;
  selected?: MuscleGroup | null;
  tinted?: boolean;
  onReady?: (meshes: MuscleMeshes) => void;
  onError?: (error: Error) => void;
  /** Registers the tap handler with the parent so CameraRig can drive it. */
  registerPick?: (pick: (ndc: { x: number; y: number }) => MuscleGroup | null) => void;
  /** A look's surface values; absent leaves every material as approved. */
  surface?: BodyLook['surface'];
};

export function BodyModel({
  modelUrl = BODY_MODEL_URL,
  visuals,
  selected,
  tinted,
  onReady,
  onError,
  registerPick,
  surface,
}: BodyModelProps) {
  const { camera, invalidate, gl, scene } = useThree();
  const root = useRef<Group>(null);
  const [meshes, setMeshes] = useState<MuscleMeshes | null>(null);
  const { gltf, error } = useGLTF(modelUrl);
  const raycaster = useMemo(() => new Raycaster(), []);

  // A fetch or parse failure is the viewer's to show, not ours to hide.
  useEffect(() => {
    if (error) onError?.(error);
  }, [error, onError]);

  useEffect(() => {
    if (!gltf) return;
    let cancelled = false;
    // The inert primitive (head, hands, feet) keeps a material of its own so
    // it can never be tinted, as in body-viewer.js. Created here, with the
    // scene, and disposed with it.
    const inert: MeshStandardMaterial[] = [];
    try {
      const resolved = resolveMuscleMeshes(gltf.scene);
      gltf.scene.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh || mesh.userData.muscle) return;
        const material = new MeshStandardMaterial({
          color: BODY_DIMMED_COLOR,
          roughness: surface?.inertRoughness ?? 0.8,
          metalness: 0,
        });
        if (surface?.environment !== undefined) material.envMapIntensity = surface.environment;
        // A model may bring a baked shade as a vertex colour (tools/body).
        // Conditional on purpose: without the attribute it would render black.
        material.vertexColors = mesh.geometry.hasAttribute('color');
        material.name = INERT_REGION;
        mesh.material = material;
        inert.push(material);
      });
      // Compile before the model enters the scene: without this the first
      // frame stalls on shader compilation, which is very visible on iOS.
      gl.compileAsync(gltf.scene, camera, scene).then(() => {
        if (cancelled) return;
        setMeshes(resolved);
        onReady?.(resolved);
        invalidate();
      });
    } catch (e) {
      onError?.(e as Error);
    }
    return () => {
      cancelled = true;
      for (const material of inert) material.dispose();
    };
  }, [gltf, gl, camera, scene, onReady, onError, invalidate, surface]);

  useMuscleHighlight({ meshes, visuals, selected, tinted, invalidate, surface });

  const pick = useCallback(
    (ndc: { x: number; y: number }): MuscleGroup | null => {
      if (!root.current || !meshes) return null;
      raycaster.setFromCamera(new Vector2(ndc.x, ndc.y), camera);
      // Sorted near → far, so the first hit carrying a muscle is the visible
      // one. This is what stops a tap on the quad selecting the hamstring
      // behind it.
      const hits = raycaster.intersectObject(root.current, true);
      for (const hit of hits) {
        const id = hit.object.userData.muscle as MuscleGroup | null | undefined;
        if (id) return id;
      }
      return null;
    },
    [camera, meshes, raycaster],
  );

  useEffect(() => {
    registerPick?.(pick);
  }, [pick, registerPick]);

  if (!gltf) return null;
  return (
    <group ref={root}>
      <primitive object={gltf.scene} />
    </group>
  );
}
