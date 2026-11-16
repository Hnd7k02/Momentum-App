import type { MuscleGroup } from '../../core/model';
import type { ShownMuscle } from '../gym/muscleState';
import { BODY_REGIONS } from './muscleMeshMap';
import { STATE_COLOR, stateIntensity, type MuscleState } from './tokens';
import type { MuscleVisual } from './useMuscleHighlight';

/**
 * What the 3D body needs per muscle, from what the screen already shows.
 *
 * A pure mapping: the state and the change arrive from `shownPerformance()`
 * — the one place a number becomes a state — and this turns them into the
 * state's model colour, the neutral tone it stands on and the strength of
 * the tint, by the curve in tokens.ts. Nothing here reads history, chooses
 * a range, counts exercise days, finds a baseline or computes a ratio.
 * Every one of the ten regions is present in the result, so an untrained
 * group arrives as `noData` in the dimmed tone rather than as a hole.
 */
export interface BodyMuscleVisual {
  id: MuscleGroup;
  state: MuscleState;
  /** Percentage change, or `null` where the group states none. */
  delta: number | null;
  /** The state's model colour — what the region is tinted with. */
  tint: string;
  /** The neutral tone under the tint: white if trained, dimmed if not. */
  ground: string;
  /** 0–1, the magnitude of the change; 0 leaves the region its neutral tone. */
  intensity: number;
}

export function toBodyVisuals(muscles: readonly ShownMuscle[]): BodyMuscleVisual[] {
  const byMuscle = new Map(muscles.map((entry) => [entry.muscle, entry]));
  return BODY_REGIONS.map((id) => {
    const entry = byMuscle.get(id);
    const state: MuscleState = entry?.state ?? 'noData';
    const delta = entry?.change ?? null;
    return {
      id,
      state,
      delta,
      tint: STATE_COLOR[state].model,
      ground: STATE_COLOR[state].ground,
      intensity: stateIntensity(state, delta ?? 0),
    };
  });
}

/** The same visuals in the shape `BodyViewer`'s `visuals` prop takes. */
export function visualsByMuscle(
  visuals: readonly BodyMuscleVisual[],
): Partial<Record<MuscleGroup, MuscleVisual>> {
  const out: Partial<Record<MuscleGroup, MuscleVisual>> = {};
  for (const visual of visuals) {
    out[visual.id] = { tint: visual.tint, ground: visual.ground, intensity: visual.intensity };
  }
  return out;
}

/**
 * The state a region is drawn in, read back from what is drawn (block 7C,
 * contract §14): the tint and the ground the materials are given, and
 * whether the tint is there at all.
 *
 * The body, the row and the sheet must show one state, and a check in the
 * browser compares them. The row and the sheet say theirs in words; this is
 * what the body says, in the only terms it has — its colours — so the check
 * does not take the body's word from the very value it is checking against.
 * `null` where the body says nothing: before the history is there, every
 * region is one neutral figure.
 */
export function drawnState(visual: MuscleVisual | undefined, tinted: boolean): MuscleState | null {
  if (!tinted || !visual) return null;
  const strength = visual.intensity ?? 1;
  if (visual.tint && strength > 0) {
    for (const state of ['improved', 'declined', 'awaitingBaseline'] as const) {
      if (visual.tint === STATE_COLOR[state].model) return state;
    }
  }
  // No tint: a trained muscle stands in white, an untrained one dimmed.
  return visual.ground === STATE_COLOR.unchanged.ground ? 'unchanged' : 'noData';
}
