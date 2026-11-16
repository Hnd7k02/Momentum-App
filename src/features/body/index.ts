import { lazy } from 'react';
import { bodyMeasure, isMeasuring, resourceFacts, resourceSince } from '../measure/measure';

/** The viewer's chunk as a build names it, and its source on the dev server. */
const VIEWER_CHUNK = /BodyViewer[^/]*\.(?:js|tsx)(?:\?|$)/;

/**
 * The lazy boundary for the 3D body. Everything behind it — three, the
 * React renderer, the viewer — lands in its own chunk that only a host which
 * renders `BodyViewer` ever fetches. Import from here, never from
 * `./BodyViewer` directly, or the chunk boundary is gone.
 */
export const BodyViewer = lazy(() =>
  import('./BodyViewer').then((module) => {
    // The measuring display's first moment (block 7B): the viewer's code is
    // here, and the browser's record of the request says where it came from.
    if (isMeasuring()) {
      bodyMeasure.codeReady(performance.now(), resourceFacts(resourceSince(VIEWER_CHUNK, bodyMeasure.since ?? 0)));
    }
    return module;
  }),
);
export { BodyBoundary } from './BodyBoundary';
export type { BodyStageState, BodyView, BodyViewerProps, MuscleVisual } from './BodyViewer';
export { BODY_REGIONS, REGION_FACING } from './muscleMeshMap';
export { toBodyVisuals, visualsByMuscle, type BodyMuscleVisual } from './bodyVisuals';
export * from './tokens';
