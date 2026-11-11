import type { Trend } from '../../core/trends';
import { useT } from '../../i18n/I18nProvider';

/**
 * The hero of the Progress screen.
 *
 * It answers a directional question, so it is drawn without a grid or tick
 * labels — a shape, not a trading terminal. The numbers that matter are
 * stated beside it in words and figures instead.
 *
 * That is also what makes it safe to treat as a single image: the direction,
 * the current value and the one before it are already real text next to the
 * chart, so a reader who never sees the path still has the answer. The label
 * here adds what only the shape knew — where the line started, and how far
 * it travelled in between.
 *
 * Drawn by the chart rules of the visual contract (§6):
 *
 * - the line is the neutral data ink, 1.5px with round ends, and there is no
 *   wash beneath it — a filled area gave the line a weight it does not have;
 * - a fine line marks where the range began, the zero the direction is read
 *   against: above it the curve has risen, below it fallen;
 * - the end point carries the status colour of the direction, the data ink
 *   when it is steady, and the value it stands at is printed beside it.
 *
 * The line is stretched to the card's width, so the end point and its label
 * are positioned over the drawing rather than inside it: a circle inside a
 * stretched SVG is an ellipse, and text inside one is distorted.
 */
export function TrendCurve({ trend, rangeDays }: { trend: Trend; rangeDays: number }) {
  const t = useT();

  const points = trend.points;
  const values = points.map((point) => point.smoothed);
  const known = values.filter((value): value is number => value !== null);
  if (known.length < 2) return null;

  const width = 320;
  const height = 96;
  const min = Math.min(...known);
  const max = Math.max(...known);
  // A flat line should read as flat, not be stretched to fill the box.
  const span = Math.max(12, max - min);
  const mid = (max + min) / 2;
  const low = mid - span / 2;

  const x = (index: number) =>
    points.length === 1 ? 0 : (index / (points.length - 1)) * width;
  const y = (value: number) => height - ((value - low) / span) * height;

  // Missing days break the line rather than being interpolated across.
  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((point, index) => {
    if (point.smoothed === null) {
      if (current.length > 1) segments.push(current.join(' '));
      current = [];
      return;
    }
    current.push(`${current.length === 0 ? 'M' : 'L'} ${x(index).toFixed(1)} ${y(point.smoothed).toFixed(1)}`);
  });
  if (current.length > 1) segments.push(current.join(' '));

  const lastIndex = points.reduce(
    (last, point, index) => (point.smoothed === null ? last : index),
    -1,
  );
  const lastValue = lastIndex >= 0 ? points[lastIndex]!.smoothed : null;

  const first = known[0]!;
  const direction = t(
    trend.direction === 'rising'
      ? 'progress.rising'
      : trend.direction === 'falling'
        ? 'progress.falling'
        : 'progress.steady',
  );

  // Where the end point stands, as a share of the drawing: it is laid over
  // the stretched line, so it is placed in percent, not in SVG units.
  const endLeft = lastValue === null ? 0 : (x(lastIndex) / width) * 100;
  const endTop = lastValue === null ? 0 : (y(lastValue) / height) * 100;
  // The label keeps clear of the line that runs into its point: above the
  // point when the line arrives from below, beneath it when it arrives from
  // above — and wherever there is room when the point is near an edge.
  const before = known.length > 1 ? known[known.length - 2]! : null;
  const arrivesFromAbove = before !== null && lastValue !== null && before > lastValue;
  const labelBelow = endTop < 22 ? true : endTop > 78 ? false : arrivesFromAbove;

  return (
    <div className="trend__plot">
      <svg
        className="trend__chart"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t('progress.chartLabel', {
          days: rangeDays,
          direction,
          from: Math.round(first),
          to: Math.round(known[known.length - 1]!),
          min: Math.round(min),
          max: Math.round(max),
        })}
      >
        {/* Where the range began: the zero the direction is read against. */}
        <line
          className="trend__zero"
          x1="0"
          x2={width}
          y1={y(first).toFixed(1)}
          y2={y(first).toFixed(1)}
          vectorEffect="non-scaling-stroke"
        />

        {segments.map((segment, index) => (
          <path
            key={index}
            className="trend__line"
            d={segment}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {lastValue !== null ? (
        <>
          <span
            className={`trend__end trend__end--${trend.direction}`}
            style={{ left: `${endLeft}%`, top: `${endTop}%` }}
            aria-hidden="true"
          />
          {/* The same figure the line below the chart states as "Aktuell";
              here it only says which point of the drawing that is. */}
          <span
            className={`trend__endValue ${labelBelow ? 'trend__endValue--below' : ''}`.trim()}
            style={{ top: `${endTop}%` }}
            aria-hidden="true"
          >
            {Math.round(lastValue)}
          </span>
        </>
      ) : null}
    </div>
  );
}
