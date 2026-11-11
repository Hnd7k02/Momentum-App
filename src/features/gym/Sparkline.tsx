import type { MuscleState } from '../../components/BodyRenderer';
import type { MuscleTrendPoint } from './muscleAnalytics';

/**
 * The row's mini chart: 80 × 24, axis-less, no grid, no fill, just the line
 * and a dot on the latest point.
 *
 * Geometry and scale are the approved ones, ported verbatim from the
 * handoff's `spark80()` (see `demo.js` / the design canvas): the points are
 * spread evenly across 74 px with a 3 px margin either side, and the
 * vertical domain is the **displayed series' own minimum and maximum**
 * mapped into 16 px. So each row scales to itself — this says which way a
 * muscle is going, not how it compares with the muscle above it, and the
 * delta beside it carries the magnitude.
 *
 * Two consequences worth stating, both from the approved function:
 *
 * - A series whose points are all equal has no span to scale into, and
 *   draws flat down the middle rather than dividing by zero or filling the
 *   box.
 * - A single observation draws its dot and no line: one point is a value,
 *   not yet a direction.
 *
 * Nothing here transforms the numbers it is given. The mapping is to SVG
 * coordinates and lives only in this file; `MuscleTrendPoint.value` stays
 * the raw percentage everywhere else.
 */

export const SPARK_WIDTH = 80;
export const SPARK_HEIGHT = 24;
const INSET = 3;
const SPAN_X = SPARK_WIDTH - INSET * 2;
const TOP = 4;
const BOTTOM = 20;
/** Below this the series counts as flat and is drawn down the middle. */
const FLAT = 0.0001;

export function sparkPoints(values: readonly number[]): { x: number; y: number }[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const flat = max - min < FLAT;
  return values.map((value, index) => ({
    x: (values.length === 1 ? 0.5 : index / (values.length - 1)) * SPAN_X + INSET,
    y: flat ? (TOP + BOTTOM) / 2 : BOTTOM - ((value - min) / span) * (BOTTOM - TOP),
  }));
}

export function Sparkline({
  trend,
  state,
}: {
  trend: readonly MuscleTrendPoint[];
  /**
   * How the group is doing, from `muscleStateOf`: the end point carries its
   * status colour, the neutral data ink when it is held. The line itself is
   * always neutral (D154) — a muscle's identity colour is its dot, never
   * its chart.
   */
  state: MuscleState;
}) {
  const points = sparkPoints(trend.map((point) => point.value));
  const last = points[points.length - 1];
  return (
    <svg
      className="muscle-row__spark"
      width={SPARK_WIDTH}
      height={SPARK_HEIGHT}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      fill="none"
      /* Everything it shows is in the row's own text: the muscle, its state
         and its number. Reading ten polylines out loud would add nothing. */
      aria-hidden="true"
      focusable="false"
    >
      {points.length > 1 ? (
        <polyline
          className="muscle-row__sparkLine"
          points={points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {last ? (
        <circle
          className={`muscle-row__sparkEnd muscle-row__sparkEnd--${state}`}
          cx={last.x.toFixed(1)}
          cy={last.y.toFixed(1)}
          r="2.1"
        />
      ) : null}
    </svg>
  );
}
