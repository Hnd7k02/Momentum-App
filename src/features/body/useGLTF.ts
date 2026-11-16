/**
 * Minimal GLTF loading hook.
 *
 * drei's useGLTF would do this, but drei is not a dependency (see
 * docs/design/muscle-map/momentum-muscle-map-handoff/HANDOFF.txt §8) and this
 * is the only thing we'd want from it. No Draco or KTX2 setup: the asset uses
 * KHR_mesh_quantization, which GLTFLoader decodes in core with no decoder
 * file — that is the whole reason we picked it for an offline-first PWA.
 */
import { useEffect, useState } from 'react';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

const cache = new Map<string, Promise<GLTF>>();

export function loadGLTF(url: string): Promise<GLTF> {
  let hit = cache.get(url);
  if (!hit) {
    hit = new GLTFLoader().loadAsync(url);
    // Don't cache a rejection: a failed load must be retryable when the user
    // comes back online.
    hit.catch(() => cache.delete(url));
    cache.set(url, hit);
  }
  return hit;
}

/** Whether the model was asked for before: a later viewer fetches nothing. */
export function isLoaded(url: string): boolean {
  return cache.has(url);
}

/** Frees the cached model. Call when leaving the Gym section for good. */
export function clearGLTF(url: string): void {
  cache.delete(url);
}

export type GLTFLoad = {
  gltf: GLTF | null;
  /** A rejected fetch or parse. The caller decides what to show instead. */
  error: Error | null;
};

/**
 * The loaded model, or the reason there is none. A failed network fetch used
 * to be swallowed here and left a blank canvas; it is now returned so the
 * viewer can fall back, while the cache above still forgets the rejection so
 * the next mount tries again.
 */
export function useGLTF(url: string): GLTFLoad {
  const [state, setState] = useState<GLTFLoad>({ gltf: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ gltf: null, error: null });
    loadGLTF(url).then(
      (gltf) => {
        if (!cancelled) setState({ gltf, error: null });
      },
      (reason: unknown) => {
        if (cancelled) return;
        setState({ gltf: null, error: reason instanceof Error ? reason : new Error(String(reason)) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
