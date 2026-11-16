import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, MeshBasicMaterial } from 'three';
import { BODY_GROUND } from './tokens';

/**
 * The ground under the body's feet (block 7B, contract §8): a small contact
 * shadow and a faint glow.
 *
 * One flat disc in the scene, on the floor, whose colour fades from a dark
 * middle through the glow's violet to nothing at its rim. It is geometry
 * with a colour at each corner — a gradient the graphics chip interpolates,
 * never a blur and never a texture (D146) — and it is in the scene, not a
 * layer of the page: it turns and tilts with the body and leaves the
 * picture with the feet when a zoom looks elsewhere. It costs one draw
 * call and 336 triangles, and it answers no tap. Seen from below the floor —
 * the camera can tilt that far — it is not drawn: a floor between the eye and
 * the feet would darken the feet.
 */

const SEGMENTS = 48;
/** Just under the soles, so the feet stand on it and never in it. */
const HEIGHT = -0.002;

/**
 * The colour at a distance from the middle: the shadow over the glow, each
 * fading evenly to its own rim — as one colour and one opacity.
 */
function groundAt(distance: number, shadow: Color, glow: Color): [number, number, number, number] {
  const shadowAlpha = BODY_GROUND.shadowStrength * Math.max(0, 1 - distance / BODY_GROUND.shadowRadius);
  const glowAlpha = BODY_GROUND.glowStrength * Math.max(0, 1 - distance / BODY_GROUND.glowRadius);
  const alpha = 1 - (1 - shadowAlpha) * (1 - glowAlpha);
  if (alpha <= 0) return [glow.r, glow.g, glow.b, 0];
  // The shadow lies over the glow: what shows of the glow is what the shadow lets through.
  const fromGlow = (glowAlpha * (1 - shadowAlpha)) / alpha;
  const fromShadow = shadowAlpha / alpha;
  return [
    glow.r * fromGlow + shadow.r * fromShadow,
    glow.g * fromGlow + shadow.g * fromShadow,
    glow.b * fromGlow + shadow.b * fromShadow,
    alpha,
  ];
}

function groundGeometry(): BufferGeometry {
  const shadow = new Color(BODY_GROUND.shadow);
  const glow = new Color(BODY_GROUND.glow);
  // Rings where the gradient bends: inside the shadow, at its rim, and out to the glow's.
  const radii = [0, BODY_GROUND.shadowRadius * 0.5, BODY_GROUND.shadowRadius, (BODY_GROUND.shadowRadius + BODY_GROUND.glowRadius) / 2, BODY_GROUND.glowRadius];
  const positions: number[] = [0, HEIGHT, 0];
  const colors: number[] = [...groundAt(0, shadow, glow)];
  for (const radius of radii.slice(1)) {
    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const angle = (segment / SEGMENTS) * 2 * Math.PI;
      positions.push(Math.cos(angle) * radius, HEIGHT, Math.sin(angle) * radius);
      colors.push(...groundAt(radius, shadow, glow));
    }
  }
  const index: number[] = [];
  const at = (ring: number, segment: number) => 1 + (ring - 1) * SEGMENTS + (segment % SEGMENTS);
  for (let segment = 0; segment < SEGMENTS; segment += 1) {
    // The middle fan, wound so the disc faces up.
    index.push(0, at(1, segment + 1), at(1, segment));
    for (let ring = 1; ring < radii.length - 1; ring += 1) {
      index.push(at(ring, segment), at(ring, segment + 1), at(ring + 1, segment + 1));
      index.push(at(ring, segment), at(ring + 1, segment + 1), at(ring + 1, segment));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 4));
  geometry.setIndex(index);
  return geometry;
}

export function BodyGround({ visible }: { visible: boolean }) {
  const geometry = useMemo(groundGeometry, []);
  const material = useMemo(
    () => new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  // No raycast: the ground is not part of the body and answers no tap.
  return <mesh geometry={geometry} material={material} visible={visible} raycast={() => null} renderOrder={1} />;
}
