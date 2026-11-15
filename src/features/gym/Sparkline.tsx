import type { MuscleState } from '../../components/BodyRenderer';
import type { MuscleTrendPoint } from './muscleAnalytics';

/**
 * The row's mini chart: 80 × 24 (64 × 24 on a narrow phone), a fine zero
 * line, the trend as a neutral line and a dot on the latest point.
 *
 * **Every row of a list shares one scale** (contract §6, D160): −8 % to
 * +8 %, with the zero line in the middle. The rows used to scale each to
 * its own minimum and maximum, so +1 % climbed as steeply as +60 % and the
 * ten charts could not be read against each other. Now a small change looks
 * small. What goes beyond 8 % stands at the edge; the number beside the
 * chart says how far it went.
 *
 * The scale was ±12 % until STOP Kurve (D180). Under the metric of Stage 5b
 * a month of training reads +3 to +7 % in a group, which on a scale to 12 %
 * used a quarter to somewhat over half of the nine pixels above the zero
 * line — 2¼ to 5¼: right, and too quiet to tell the rows apart. The owner
 * took the scale to 8 %, the change at which a tint on the body is full
 * (D179), so the body and the rows speak on one scale; +3 % and +7 % now
 * stand 3.4 and 7.9 pixels above the line.
 *
 * Three consequences worth stating:
 *
 * - A series whose points are all equal is flat at its own value — on the
 *   zero line when that value is 0 %, which is what "held" looks like.
 * - A single observation draws its dot and no line: one point is a value,
 *   not yet a direction. The dot stands where its value is.
 * - No observation draws nothing at all, and the row gives the chart's room
 *   to words instead.
 *
 * The line is the neutral data ink; the end point carries the status colour
 * of the group's state, and the data ink when it is held (D154). A muscle's
 * identity colour is the dot before its name and never its chart.
 *
 * Nothing here transforms the numbers it is given. The mapping is to SVG
 * coordinates and lives only in this file; `MuscleTrendPoint.value` stays
 * the raw percentage everywhere else.
 */

export const SPARK_WIDTH = 80;
/** The chart's width where the row has to wrap (contract §6). */
export const SPARK_WIDTH_NARROW = 64;
export const SPARK_HEIGHT = 24;
/** The change, in percent, that reaches the edge of the chart either way. */
export const SPARK_SCALE = 8;
/** The end point's radius; the line stays this far inside the box. */
const INSET = 3;

/** Where a change of `value` percent stands on the shared scale. */
export function sparkY(value: number): number {
  const clamped = Math.max(-SPARK_SCALE, Math.min(SPARK_SCALE, value));
  return SPARK_HEIGHT / 2 - (clamped / SPARK_SCALE) * (SPARK_HEIGHT / 2 - INSET);
}

export function sparkPoints(
  values: readonly number[],
  width: number = SPARK_WIDTH,
): { x: number; y: number }[] {
  const span = width - INSET * 2;
  return values.map((value, index) => ({
    x: (values.length === 1 ? 0.5 : index / (values.length - 1)) * span + INSET,
    y: sparkY(value),
  }));
}

export function Sparkline({
  trend,
  state,
  width = SPARK_WIDTH,
}: {
  trend: readonly MuscleTrendPoint[];
  /**
   * How the group is doing, from `muscleStateOf`: the end point carries its
   * status colour, the neutral data ink when it is held. The line itself is
   * always neutral.
   */
  state: MuscleState;
  /** 80, or 64 where the row wraps on a narrow phone. */
  width?: number;
}) {
  const points = sparkPoints(trend.map((point) => point.value), width);
  const last = points[points.length - 1];
  const zero = SPARK_HEIGHT / 2;
  return (
    <svg
      className="muscle-row__spark"
      width={width}
      height={SPARK_HEIGHT}
      viewBox={`0 0 ${width} ${SPARK_HEIGHT}`}
      fill="none"
      /* Everything it shows is in the row's own text: the muscle, its state
         and its number. Reading ten polylines out loud would add nothing. */
      aria-hidden="true"
      focusable="false"
    >
      <line className="muscle-row__sparkZero" x1="0" x2={width} y1={zero} y2={zero} />
      {points.length > 1 ? (
        <polyline
          className="muscle-row__sparkLine"
          points={points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {last ? (
        <circle
          className={`muscle-row__sparkEnd muscle-row__sparkEnd--${state}`}
          cx={last.x.toFixed(1)}
          cy={last.y.toFixed(1)}
          r={INSET}
        />
      ) : null}
    </svg>
  );
}
