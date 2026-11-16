import { useEffect, useRef, type MutableRefObject } from 'react';
import { addAfterEffect, useFrame, useThree } from '@react-three/fiber';
import type { Material, Mesh, Texture } from 'three';
import { bodyMeasure, isMeasuring, type FrameActivity } from '../measure/measure';

/**
 * The measuring display's eye inside the canvas (block 7B, D181).
 *
 * Mounted last, so it runs after the camera and the materials have said
 * what this frame is for. It tells the recorder that a frame was drawn and
 * why, notices when the body comes to rest, and reads what the renderer
 * says about the picture — after the render, which is when the renderer
 * knows. It asks for no frame: both callbacks run only in frames that
 * something else asked for. With the display switched off it is not
 * mounted at all.
 */

/** The texture slots of a standard material; the body uses none of them today. */
const TEXTURE_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'envMap'] as const;

export function FrameProbe({ activity }: { activity: MutableRefObject<FrameActivity> }) {
  const { gl, scene, size } = useThree();
  const drawn = useRef(false);
  const wasActive = useRef(false);
  const last = useRef({ calls: -1, triangles: -1, textures: -1, width: -1, height: -1 });
  const gpu = useRef<string | null | undefined>(undefined);

  useFrame(() => {
    if (!isMeasuring()) return;
    const { rotating, coasting, easing } = activity.current;
    const now = performance.now();
    bodyMeasure.rendered(now, { rotating, selfDriven: coasting || easing });
    drawn.current = true;
    const active = rotating || coasting || easing;
    if (wasActive.current && !active) bodyMeasure.settled(now);
    wasActive.current = active;
  });

  useEffect(() => {
    // After the render: `gl.info.render` is what this frame drew.
    return addAfterEffect(() => {
      if (!drawn.current || !isMeasuring()) return;
      drawn.current = false;
      const { render, memory } = gl.info;
      const seen = last.current;
      if (
        seen.calls === render.calls && seen.triangles === render.triangles && seen.textures === memory.textures &&
        seen.width === size.width && seen.height === size.height
      ) return;
      last.current = { calls: render.calls, triangles: render.triangles, textures: memory.textures, width: size.width, height: size.height };

      const textures = new Set<Texture>();
      if (scene.environment) textures.add(scene.environment);
      scene.traverse((object) => {
        const material = (object as Mesh).material as Material | Material[] | undefined;
        for (const one of Array.isArray(material) ? material : material ? [material] : []) {
          for (const slot of TEXTURE_SLOTS) {
            const texture = (one as unknown as Record<string, Texture | null | undefined>)[slot];
            if (texture) textures.add(texture);
          }
        }
      });
      if (gpu.current === undefined) {
        try {
          const context = gl.getContext();
          const names = context.getExtension('WEBGL_debug_renderer_info');
          gpu.current = names ? String(context.getParameter(names.UNMASKED_RENDERER_WEBGL)) : null;
        } catch {
          gpu.current = null;
        }
      }
      bodyMeasure.rendererFacts({
        calls: render.calls,
        triangles: render.triangles,
        textures: memory.textures,
        textureSizes: [...textures].map((texture) => {
          const image = texture.image as { width?: number; height?: number } | undefined;
          return `${image?.width ?? '?'}\u00A0×\u00A0${image?.height ?? '?'}`;
        }),
        pixelRatio: gl.getPixelRatio(),
        screenPixelRatio: window.devicePixelRatio,
        bufferWidth: gl.domElement.width,
        bufferHeight: gl.domElement.height,
        stageWidth: size.width,
        stageHeight: size.height,
        gpu: gpu.current ?? null,
      });
    });
  }, [gl, scene, size]);

  return null;
}
