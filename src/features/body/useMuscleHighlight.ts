/**
 * Highlight + data tint for the body's muscle regions.
 *
 * One code path serves both jobs on purpose. "Selected" and "shows Gym data"
 * are the same channel at different strengths, so they can never disagree
 * about what a region looks like.
 *
 * No postprocessing. An OutlinePass would cost a full-screen pass, a second
 * render target and MSAA on a body of eleven primitives — measure before
 * paying that. Each region gets its own material instance once and we animate
 * colour, emissive and a Fresnel rim on it.
 *
 * The material treatment is the approved one from HANDOFF.txt §13, ported
 * from body-viewer.js `regionMaterial()` / `#retarget` / `#ease`: three
 * coupled parts — colour pulled toward the state ink, an emissive glow, and a
 * view-dependent rim added to the emissive output through a small
 * onBeforeCompile patch with its own varyings. Every constant comes from
 * tokens.ts.
 */
import { useEffect, useRef, useCallback } from 'react';
import { Color, MeshStandardMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import type { MuscleGroup } from '../../core/model';
import type { MuscleMeshes } from './muscleMeshMap';
import { BODY_BASE_COLOR, BODY_UNLIT, NEUTRAL_HIGHLIGHT, REGION_MATERIAL } from './tokens';

export type MuscleVisual = {
  /** 0–1, already normalised by the Gym domain. Drives tint strength. */
  intensity?: number;
  /** Pre-resolved colour token from the Gym state palette. */
  tint?: string;
};

export type HighlightOptions = {
  meshes: MuscleMeshes | null;
  visuals?: Partial<Record<MuscleGroup, MuscleVisual>>;
  selected?: MuscleGroup | null;
  /** Off = neutral body, no data colours. Highlight still works. */
  tinted?: boolean;
  /** Ask the render loop for a frame; pairs with frameloop="demand". */
  invalidate: () => void;
};

/** The two uniforms the rim patch adds; shared by reference with the shader. */
type RimUniforms = { uRim: { value: number }; uRimColor: { value: Color } };

type Slot = {
  material: MeshStandardMaterial;
  rim: RimUniforms;
  target: Color;
  targetEmissive: Color;
  targetEmissiveIntensity: number;
  targetRim: number;
  targetRimColor: Color;
};

const BLACK = BODY_UNLIT;

/** Below this the eye cannot tell, and continuing to lerp would never settle. */
const COLOR_EPSILON = 0.002;
const SCALAR_EPSILON = 0.002;

function colorDistance(a: Color, b: Color): number {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

/**
 * Region material: standard PBR plus a view-dependent rim term added to the
 * emissive output. The rim keeps the body plastic — the tint reads as light
 * on a surface instead of a flat fill, and region edges fall off smoothly.
 * Own varyings (vRimN, vRimP) so the patch never depends on three's internal
 * varying names. Verbatim from body-viewer.js `regionMaterial()`.
 */
export function regionMaterial(): { material: MeshStandardMaterial; rim: RimUniforms } {
  const material = new MeshStandardMaterial({
    color: BODY_BASE_COLOR,
    roughness: REGION_MATERIAL.roughness,
    metalness: REGION_MATERIAL.metalness,
  });
  const rim: RimUniforms = { uRim: { value: 0 }, uRimColor: { value: new Color(BLACK) } };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = rim.uRim;
    shader.uniforms.uRimColor = rim.uRimColor;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vRimN;\nvarying vec3 vRimP;\nvoid main() {')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n\tvRimN = normalize( normalMatrix * objectNormal );\n\tvRimP = ( modelViewMatrix * vec4( transformed, 1.0 ) ).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform float uRim;\nuniform vec3 uRimColor;\nvarying vec3 vRimN;\nvarying vec3 vRimP;\nvoid main() {',
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n\tfloat rimF = pow( 1.0 - abs( dot( normalize( vRimN ), normalize( -vRimP ) ) ), 2.6 );\n\ttotalEmissiveRadiance += uRimColor * uRim * rimF;',
      );
  };
  return { material, rim };
}

/** What one region should look like: the whole decision, as data. */
export interface RegionTarget {
  color: string;
  emissive: string;
  emissiveIntensity: number;
  rim: number;
  rimColor: string;
}

/** Mixes the grey toward a hue without a renderer, for `color` below. */
function lerpHex(from: string, to: string, amount: number): string {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const mix = (shift: number) => {
    const x = (a >> shift) & 255;
    const y = (b >> shift) & 255;
    return Math.round(x + (y - x) * amount);
  };
  const hex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${hex(mix(16))}${hex(mix(8))}${hex(mix(0))}`;
}

/**
 * The approved treatment, as a pure function of one region's visual and
 * whether it is selected — colour toward the state ink, an emissive glow,
 * and a Fresnel rim, each at the strength `REGION_MATERIAL` names (§13).
 *
 * **A region with nothing to say still shows that it was chosen.** With no
 * tint at all, or an intensity of zero — which is every untrained group,
 * since `stateIntensity()` returns 0 there — the performance channel is
 * silent, and multiplying the selected treatment by it left a successful tap
 * looking like a miss. Such a region keeps its neutral grey and its
 * `noData` meaning, and gains the existing neutral selection rim instead. It
 * is never tinted as though it had improved or declined.
 */
export function regionTargets(
  visual: MuscleVisual | undefined,
  selected: boolean,
  tinted = true,
): RegionTarget {
  const { resting, selected: chosen } = REGION_MATERIAL;
  const amount = visual?.intensity == null ? 1 : Math.max(0, Math.min(1, visual.intensity));
  if (!tinted || !visual?.tint || amount === 0) {
    return {
      color: BODY_BASE_COLOR,
      emissive: selected ? NEUTRAL_HIGHLIGHT : BLACK,
      emissiveIntensity: selected ? 0.1 : 0,
      rim: selected ? chosen.rim * 0.6 : 0,
      rimColor: selected ? NEUTRAL_HIGHLIGHT : BLACK,
    };
  }
  // intensity carries the magnitude of the change (core/gym decides it).
  // Resting emissive and rim scale with it; the selected rim does not.
  return {
    color: lerpHex(BODY_BASE_COLOR, visual.tint, (selected ? chosen.mix : resting.mix) * amount),
    emissive: visual.tint,
    emissiveIntensity: (selected ? chosen.emissiveIntensity : resting.emissiveIntensity) * amount,
    rim: selected ? chosen.rim : resting.rim * amount,
    rimColor: visual.tint,
  };
}

export function useMuscleHighlight({
  meshes,
  visuals,
  selected,
  tinted = true,
  invalidate,
}: HighlightOptions): void {
  const slots = useRef<Map<MuscleGroup, Slot>>(new Map());

  /** See CameraRig: an invalidate() inside useFrame is swallowed by that frame. */
  const pending = useRef(false);
  const keepAlive = useCallback(() => {
    if (pending.current) return;      // coalesce: one wake per frame, not one per slot
    pending.current = true;
    requestAnimationFrame(() => {
      pending.current = false;
      invalidate();
    });
  }, [invalidate]);

  // One material instance per region, created once, disposed on unmount.
  useEffect(() => {
    if (!meshes) return;
    const created = new Map<MuscleGroup, Slot>();
    for (const [id, mesh] of meshes) {
      const { material, rim } = regionMaterial();
      material.name = id;
      mesh.material = material;
      created.set(id, {
        material,
        rim,
        target: new Color(BODY_BASE_COLOR),
        targetEmissive: new Color(BLACK),
        targetEmissiveIntensity: 0,
        targetRim: 0,
        targetRimColor: new Color(BLACK),
      });
    }
    slots.current = created;
    invalidate();
    return () => {
      for (const slot of created.values()) slot.material.dispose();
      slots.current = new Map();
    };
  }, [meshes, invalidate]);

  // Recompute targets when data or selection changes; the frame loop eases to
  // them. Mirrors body-viewer.js #retarget.
  useEffect(() => {
    for (const [id, slot] of slots.current) {
      const next = regionTargets(visuals?.[id], id === selected, tinted);
      slot.target.set(next.color);
      slot.targetEmissive.set(next.emissive);
      slot.targetEmissiveIntensity = next.emissiveIntensity;
      slot.targetRimColor.set(next.rimColor);
      slot.targetRim = next.rim;
    }
    invalidate();
  }, [visuals, selected, tinted, meshes, invalidate]);

  useFrame((_, delta) => {
    // Frame-rate independent easing, so a 120 Hz iPad and a throttled
    // background tab settle in the same wall-clock time.
    const k = 1 - Math.exp(-delta * REGION_MATERIAL.easeRate);
    let moving = false;
    for (const slot of slots.current.values()) {
      const m = slot.material;
      // Snap when close. Comparing lerped colours for exact equality can never
      // settle, which would pin the render loop on forever.
      if (colorDistance(m.color, slot.target) > COLOR_EPSILON) {
        m.color.lerp(slot.target, k);
        moving = true;
      } else if (!m.color.equals(slot.target)) {
        m.color.copy(slot.target);
      }
      if (colorDistance(m.emissive, slot.targetEmissive) > COLOR_EPSILON) {
        m.emissive.lerp(slot.targetEmissive, k);
        moving = true;
      } else if (!m.emissive.equals(slot.targetEmissive)) {
        m.emissive.copy(slot.targetEmissive);
      }
      const de = slot.targetEmissiveIntensity - m.emissiveIntensity;
      if (Math.abs(de) > SCALAR_EPSILON) {
        m.emissiveIntensity += de * k;
        moving = true;
      } else if (de !== 0) {
        m.emissiveIntensity = slot.targetEmissiveIntensity;
      }
      const dr = slot.targetRim - slot.rim.uRim.value;
      if (Math.abs(dr) > SCALAR_EPSILON) {
        slot.rim.uRim.value += dr * k;
        moving = true;
      } else if (dr !== 0) {
        slot.rim.uRim.value = slot.targetRim;
      }
      const rc = slot.rim.uRimColor.value;
      if (colorDistance(rc, slot.targetRimColor) > COLOR_EPSILON) {
        rc.lerp(slot.targetRimColor, k);
        moving = true;
      } else if (!rc.equals(slot.targetRimColor)) {
        rc.copy(slot.targetRimColor);
      }
    }
    if (moving) keepAlive();
  });
}
