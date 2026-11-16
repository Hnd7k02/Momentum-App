import type { DateKey } from '../../core/dates';
import type { GymWindowComparison } from '../../core/model';
import type { ExerciseDay } from '../../core/gym/performance';
import { formatDayAndMonth } from '../../i18n/format';
import { useI18n } from '../../i18n/I18nProvider';
import { signedPercentText } from '../../i18n/typography';
import { exerciseLine } from './muscleSheet';
import type { ShownTrend } from './muscleState';
import './exerciseLineChart.css';

/**
 * The exercise detail's days as a line (contract §6; the owner's choice at
 * STOP 5b, D175).
 *
 * Until Stage 5b the detail drew bars from zero (D163). Under the Stage 5b
 * metric a day differs from the next by two or three percent, so the bars
 * of a season stood almost level and the plot said little. The line is
 * drawn from the same days: **at each day, the exercise's change in the
 * range up to that day** (`exerciseLine`, the owner's correction at STOP
 * 7C) — the comparison its one figure is, day by day, as the line of a
 * group is its figure day by day. It begins on the baseline of its first
 * day, at nought (D170), and it ends on the figure at the head of the
 * detail. Until STOP 7C each day stood at its change since the first day,
 * which under the Stage 5b metric is another comparison than the figure's;
 * before that era (`firstLast`) the two are one.
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
 *   point carries a colour: the state of the exercise's one figure — its
 *   change in the range — by the one band (`muscleState.ts`), the data ink
 *   when it is held. The first and the last date stand beneath.
 * - **No figure stands at the line's end** (D176). Until block 7C the end
 *   value stood there — the last day against the first day shown — beside
 *   a "Veränderung" above the chart that compared the last day with the
 *   one before: two numbers for one exercise, and only one of them named.
 * - **One day draws no chart** (D170): the detail says in a sentence that
 *   one day is recorded and the line begins with the second. No day draws
 *   nothing — the detail shows its empty state instead of this chart.
 *
 * This chart is a picture of the days and computes nothing that is scored.
 */

/** The change, in percent, that reaches the edge of the plot at the least. */
export const LINE_SCALE = 8;

/** What the reach grows by when a change goes beyond it. */
const LINE_STEP = 4;

/**
 * What the line draws, in percent, oldest first: at each day the
 * exercise's change in the range up to that day, by `comparison`, and the
 * first day at nought (`exerciseLine`). Under `firstLast` — the comparison
 * before the Stage 5b era, and the default here — that is each day against
 * the first.
 */
export function lineValues(days: readonly ExerciseDay[], comparison: GymWindowComparison = 'firstLast'): number[] {
  return exerciseLine(days, comparison).map((point) => point.value);
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

/**
 * A line of changes on a plot, as every large chart of Gym draws one: the
 * exercise detail's days and the muscle sheet's trend (block 7C).
 *
 * It draws what it is given and decides nothing: the values, the range they
 * stand in — anything beyond it stays at the edge — the state its end point
 * carries and the text that stands beside it. With words for a screen
 * reader it is a picture with a description; without, it is a picture of
 * what stands beside it and is hidden.
 *
 * Two or more values are a line. A single one is a dot where its value is:
 * one observation is a value, not yet a direction (contract §6).
 */
export function LinePlot({
  values,
  range,
  dates,
  endState,
  endText = null,
  label,
  variant,
}: {
  /** Oldest first, in percent. */
  values: readonly number[];
  range: { low: number; high: number };
  /** The first day drawn and, with more than one, the last. */
  dates: readonly DateKey[];
  /** What the end point says: a state's colour, or the data ink for held. */
  endState: ShownTrend;
  /** The figure beside the end point, on its height; `null` draws none. */
  endText?: string | null;
  label?: string;
  /** The sheet's chart is taller than the detail's. */
  variant?: 'sheet';
}) {
  const { language } = useI18n();
  const { low, high } = range;
  const y = (value: number): number => lineY(value, range);
  const x = (index: number): number => (values.length === 1 ? 0.5 : index / (values.length - 1));
  const end = values[values.length - 1] ?? 0;
  const inset = (share: number): string => `calc(3px + (100% - 6px) * ${share.toFixed(4)})`;
  const zero = y(0);
  const first = dates[0];
  const last = dates.length > 1 ? dates[dates.length - 1] : undefined;

  return (
    <div
      className={variant ? `gym-detail__chart exercise-line exercise-line--${variant}` : 'gym-detail__chart exercise-line'}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' as const })}
    >
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
            {values.length > 1 ? (
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
          {values.length > 0 ? (
            <span
              className={`exercise-line__end exercise-line__end--${endState}`}
              style={{ left: inset(x(values.length - 1)), top: inset(y(end)) }}
            />
          ) : null}
        </div>
        {first ? (
          <div className="gym-detail__dates">
            <span>{formatDayAndMonth(language, first)}</span>
            {last ? <span>{formatDayAndMonth(language, last)}</span> : null}
          </div>
        ) : null}
      </div>
      {/* The figure, beside the end point and clear of the line. */}
      {endText !== null ? (
        <div className="exercise-line__endColumn">
          <span className={`exercise-line__value exercise-line__value--${endState}`} style={{ top: inset(y(end)) }}>
            {endText}
          </span>
          <span className="exercise-line__sizer">{endText}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The exercise detail's chart: at each day the exercise's change in the
 * range up to that day, from the baseline of its first day.
 *
 * **Its end carries no figure** (D176). The exercise has one change — the
 * one in the range, which stands in the head of the detail and in the
 * muscle sheet (`exerciseChanges`) — and since STOP 7C the line's last
 * point is that very change, so a figure beside it would say it twice. Its
 * end point carries the state of that figure, as every end point carries
 * the state it stands for, and the data ink for a single day, which has
 * none.
 */
export function ExerciseLineChart({
  days,
  comparison = 'firstLast',
  state = null,
}: {
  /** Newest first, as the detail has them. */
  days: ExerciseDay[];
  /** The comparison the range's figures are under (`GymHistory.metric`). */
  comparison?: GymWindowComparison;
  /** The state of the exercise's change in the range; `null` with nothing to compare. */
  state?: ShownTrend | null;
}) {
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const values = lineValues(days, comparison);
  const dates = ordered.length === 0 ? [] : ordered.length === 1 ? [ordered[0]!.date] : [ordered[0]!.date, ordered[ordered.length - 1]!.date];
  return (
    <LinePlot
      values={values}
      range={lineRange(values)}
      dates={dates}
      endState={values.length > 1 ? (state ?? 'unchanged') : 'unchanged'}
    />
  );
}
