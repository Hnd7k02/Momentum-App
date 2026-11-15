import type { ExerciseDay } from '../../core/gym/performance';
import { formatDayAndMonth } from '../../i18n/format';
import { useI18n } from '../../i18n/I18nProvider';
import { signedPercentText } from '../../i18n/typography';
import { roundShown, trendOfShown } from './muscleState';
import './exerciseLineChart.css';

/**
 * The exercise detail's days as a line (contract §6; the owner's choice at
 * STOP 5b, D175).
 *
 * Until Stage 5b the detail drew bars from zero (D163). Under the Stage 5b
 * metric a day differs from the next by two or three percent, so the bars
 * of a season stood almost level and the plot said little. The line is
 * drawn from the same days: **each day's value as its change since the
 * first day shown**, and the zero line is that first day.
 *
 * - **A small change still looks small** (D160, D163). The scale is the one
 *   the muscle rows share — 8 % reaches the edge, 12 % until STOP Kurve
 *   (D180) — and never a scale from the smallest day to the largest, which
 *   made a fall of a tenth look like a collapse. A series that goes beyond
 *   8 % widens the scale in steps of four, so nothing is cut off and
 *   nothing stands at the edge unless it is there.
 * - A series that only rises is drawn above its zero line and one that only
 *   falls below it; one that does both has the zero line in the middle.
 * - The line is the neutral data ink at 1.5px with round ends. Only the end
 *   point carries a colour: the state of the end value by the one band
 *   (`muscleState.ts`), the data ink when it is held. The value stands
 *   beside it, right of the plot, as a row's figure stands right of its
 *   line; the first and the last date stand beneath.
 * - **One day is a dot and no value**: one observation is not a change, and
 *   the chart does not print one. No day draws nothing — the detail shows
 *   its empty state instead of this chart.
 *
 * The end value compares the last day with the first day *shown*; the
 * figures above the chart compare the last day with the one before. Both
 * are true statements about named days, and neither is the window
 * comparison the rating runs (D150): this chart is a picture of the days
 * and computes nothing that is scored.
 */

/** The change, in percent, that reaches the edge of the plot at the least. */
export const LINE_SCALE = 8;

/** What the reach grows by when a change goes beyond it. */
const LINE_STEP = 4;

/** Each day's change against the first day of the list, in percent, oldest first. */
export function lineValues(days: readonly ExerciseDay[]): number[] {
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const first = ordered[0]?.best.score ?? 0;
  return ordered.map((day) => (first > 0 ? (day.best.score / first - 1) * 100 : 0));
}

/** How far the plot reaches from its zero line: the shared scale, or the next step above the largest change. */
export function lineReach(values: readonly number[]): number {
  const largest = values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  return Math.max(LINE_SCALE, Math.ceil(largest / LINE_STEP - 1e-9) * LINE_STEP);
}

/**
 * The plot's range: from zero to the reach on each side the values go to.
 * A series that only rises is drawn above its zero line and one that only
 * falls below it, as the contract's sheet chart is; one that does both has
 * the zero line in the middle.
 */
export function lineRange(values: readonly number[]): { low: number; high: number } {
  const reach = lineReach(values);
  const low = values.some((value) => value < 0) ? -reach : 0;
  const high = values.some((value) => value > 0) || low === 0 ? reach : 0;
  return { low, high };
}

/**
 * Where a change stands in the plot, as a share of its height from the top:
 * 0 is the upper edge, 1 the lower. Linear in the change — twice the change
 * is twice the distance from the zero line.
 */
export function lineY(value: number, range: { low: number; high: number }): number {
  return (range.high - Math.max(range.low, Math.min(range.high, value))) / (range.high - range.low);
}

export function ExerciseLineChart({ days }: { /** Newest first, as the detail has them. */ days: ExerciseDay[] }) {
  const { language } = useI18n();
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const values = lineValues(days);
  const range = lineRange(values);
  const { low, high } = range;
  const y = (value: number): number => lineY(value, range);
  const x = (index: number): number => (values.length === 1 ? 0.5 : index / (values.length - 1));
  const end = values[values.length - 1] ?? 0;
  /** One day is not a change: its dot is neutral and no value stands beside it. */
  const compared = values.length > 1;
  const shown = roundShown(end) ?? 0;
  const state = compared ? trendOfShown(shown) : 'unchanged';
  const inset = (share: number): string => `calc(3px + (100% - 6px) * ${share.toFixed(4)})`;
  const zero = y(0);

  return (
    <div className="gym-detail__chart exercise-line" aria-hidden="true">
      <div className="exercise-line__axis">
        {high > 0 ? <span className="exercise-line__label" style={{ top: inset(0) }}>{signedPercentText(high)}</span> : null}
        <span className="exercise-line__label" style={{ top: inset(zero) }}>{signedPercentText(0)}</span>
        {low < 0 ? <span className="exercise-line__label" style={{ top: inset(1) }}>{signedPercentText(low)}</span> : null}
        {/* Sizes the column: the widest label it holds. */}
        <span className="exercise-line__sizer">{signedPercentText(low < 0 ? low : high)}</span>
      </div>
      <div className="gym-detail__plot">
        <div className="exercise-line__plot">
          {high > 0 ? <span className="exercise-line__bound" style={{ top: inset(0) }} /> : null}
          {low < 0 ? <span className="exercise-line__bound" style={{ top: inset(1) }} /> : null}
          <span className="exercise-line__zero" style={{ top: inset(zero) }} />
          <svg className="exercise-line__svg" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
            {compared ? (
              <polyline
                className="exercise-line__line"
                points={values.map((value, index) => `${(x(index) * 100).toFixed(2)},${(y(value) * 100).toFixed(2)}`).join(' ')}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>
          <span
            className={`exercise-line__end exercise-line__end--${state}`}
            style={{ left: inset(x(values.length - 1)), top: inset(y(end)) }}
          />
        </div>
        {ordered.length > 0 ? (
          <div className="gym-detail__dates">
            <span>{formatDayAndMonth(language, ordered[0]!.date)}</span>
            {ordered.length > 1 ? <span>{formatDayAndMonth(language, ordered[ordered.length - 1]!.date)}</span> : null}
          </div>
        ) : null}
      </div>
      {/* The end value, beside the end point and clear of the line. */}
      {compared ? (
        <div className="exercise-line__endColumn">
          <span className={`exercise-line__value exercise-line__value--${state}`} style={{ top: inset(y(end)) }}>
            {signedPercentText(shown)}
          </span>
          <span className="exercise-line__sizer">{signedPercentText(shown)}</span>
        </div>
      ) : null}
    </div>
  );
}
