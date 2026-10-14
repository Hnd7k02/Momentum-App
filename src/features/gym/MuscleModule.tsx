import { Suspense, useMemo } from 'react';
import type { MuscleGroup } from '../../core/model';
import { useToday } from '../../app/useToday';
import type { MusclePerformance } from '../../core/gym/performance';
import { BodyRenderer, type MuscleView } from '../../components/BodyRenderer';
import { BodyBoundary, BodyViewer, toBodyVisuals, visualsByMuscle } from '../body';
import type { MuscleAnalyticsView } from './muscleAnalytics';
import { MuscleRows } from './MuscleRows';
import './muscleModule.css';

/**
 * Muskelgruppen: the body and the ten group rows, as one module.
 *
 * **It owns no selection.** The Gym screen holds the one selected group and
 * hands it here; the 3D body, the flat figure that stands in for it and the
 * rows all read that one value, so the body, the list and the exercises
 * below can never disagree about what is selected.
 *
 * A tap on the body **selects**; it never clears. A miss already does
 * nothing, and making a second tap on the same muscle undo the first turned
 * a small aiming error into a lost selection. The rows keep their toggle,
 * where tapping the highlighted row again is a deliberate act.
 *
 * It computes nothing: the visuals are `toBodyVisuals()` and the rows are
 * `toMuscleAnalytics()`, both over what the screen already loaded.
 *
 * The 3D body is behind `React.lazy`, so three.js reaches a device only when
 * this module renders — entering Mental or Ernährung never fetches it. Where
 * WebGL is missing, the chunk cannot be fetched or the viewer throws, the
 * SVG figure takes its place with the same states and the same selection,
 * and the rows below are untouched either way.
 */
export function MuscleModule({
  muscles,
  analytics,
  views,
  selected,
  onSelect,
  onToggle,
}: {
  /** Already derived by the Gym domain for the range on screen. */
  muscles: readonly MusclePerformance[];
  /** The rows' view model, over the same range. */
  analytics: readonly MuscleAnalyticsView[];
  /** The same groups in the SVG figure's shape, for the stand-in. */
  views: readonly MuscleView[];
  selected: MuscleGroup | null;
  /** A tap on the body: select, never clear. */
  onSelect: (muscle: MuscleGroup) => void;
  /** A tap on a row: the list's own semantics, which include deselecting. */
  onToggle: (muscle: MuscleGroup) => void;
}) {
  // "Vor 3 Tagen" counts from the day the app shows, which moves (B3).
  const today = useToday();
  const visuals = useMemo(() => visualsByMuscle(toBodyVisuals(muscles)), [muscles]);

  // One figure, whichever way it is drawn: the SVG stands in for the canvas
  // rather than sitting beside it, and brings no second list with it.
  const figure = (
    <div className="muscle-module__figure">
      <BodyRenderer muscles={views} parts="figure" selected={selected} size={132} />
    </div>
  );

  return (
    <div className="muscle-module">
      <BodyBoundary fallback={figure}>
        {/* The placeholder holds the body's box, so the card does not jump
            when the chunk arrives. */}
        <Suspense fallback={<div className="muscle-module__placeholder" aria-hidden="true" />}>
          <BodyViewer
            visuals={visuals}
            selectedMuscle={selected}
            onSelectMuscle={onSelect}
            fallback={figure}
          />
        </Suspense>
      </BodyBoundary>

      <MuscleRows views={analytics} today={today} selected={selected} onSelect={onToggle} />
    </div>
  );
}
