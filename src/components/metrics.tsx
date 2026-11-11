import type { ReactNode } from 'react';
import { ChevronRightIcon } from './Icons';
import { Sheet } from './index';
import './metrics.css';

/**
 * The metric primitives: a tile on the overview, the bar inside it, the board
 * that arranges tiles, and the sheet a tile opens.
 *
 * One rule shapes all four. **A tile states; a sheet explains.** The overview
 * is a dashboard, so a tile carries a title, one primary value, an optional
 * bar and at most one short supporting line — never a paragraph. Everything
 * that used to sit under the value as methodology copy lives in the sheet,
 * once, and is reached by tapping the tile. The copy is not duplicated in
 * both places: what the tile shows is what the sheet's header repeats, and
 * what the sheet explains the tile does not attempt.
 *
 * These components compute nothing. Every number arrives already derived;
 * a tile is the same value the service produced, printed.
 */

/**
 * The bar. An image with a name, never the only carrier of its number — the
 * figure it draws is always printed beside it by the tile or the sheet.
 * Inset with the content, thin, fully rounded, neutral on a neutral track
 * (D154); `overflow: hidden` on it is the mask that rounds the fill's end.
 *
 * `met` marks the one bar that carries a colour (D160): a weekly target
 * that has been reached. The figure beside it says so in numbers.
 */
export function MetricBar({
  percent,
  label,
  met = false,
}: {
  percent: number;
  label: string;
  met?: boolean;
}) {
  return (
    <span className={`metric-bar ${met ? 'metric-bar--met' : ''}`.trim()} role="img" aria-label={label}>
      <span
        className="metric-bar__fill"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </span>
  );
}

/**
 * The primary value and the scale it sits on, in **one** element.
 *
 * "2" and "von 3 Sessions" are set at different sizes on a compact tile, but
 * they are one text node to a screen reader and to a test — the value is
 * never split into two facts.
 */
function MetricValue({ value, scale }: { value: ReactNode; scale?: string }) {
  return (
    <span className="metric-tile__value">
      <span className="metric-tile__number">{value}</span>
      {scale ? <span className="metric-tile__scale"> {scale}</span> : null}
    </span>
  );
}

export interface MetricBarSpec {
  percent: number;
  /** What the bar says out loud: the full figure it draws. */
  label: string;
  /** A weekly target that has been reached: the one coloured bar (D160). */
  met?: boolean;
}

/**
 * One tile on the board.
 *
 * The whole tile is the tap target when it has a sheet to open, and the
 * title is the control: the button is the heading's text, and a pseudo
 * element stretches its hit area over the tile. That keeps the heading a
 * heading and the tile a plain box in the accessibility tree, rather than
 * wrapping headings and images in a button — which is invalid — or laying
 * an unnamed overlay across content a screen reader would then miss.
 *
 * `span` is a preference, not an obligation: a tile stays full width when
 * its content would be cramped at ~175px, and the board collapses to one
 * column below 360px whatever the tile asked for.
 */
export function MetricTile({
  id,
  title,
  value,
  scale,
  kicker,
  leading,
  bar,
  line,
  span = 'full',
  primary = false,
  onOpen,
  className = '',
}: {
  /** A stable hook for the verification suites: `data-metric`. */
  id: string;
  title: string;
  value: ReactNode;
  scale?: string;
  /** A short line above the value, on a hero tile. */
  kicker?: ReactNode;
  /** Something before the value — an emblem on a hero tile. */
  leading?: ReactNode;
  bar?: MetricBarSpec;
  /** At most one short supporting line. */
  line?: ReactNode;
  span?: 'full' | 'half';
  /**
   * The tile that carries its screen's one main number (D160): its figure
   * takes the extra-large step, every other tile's the large one.
   */
  primary?: boolean;
  /** Opens the detail sheet. Without it the tile is not a control. */
  onOpen?: () => void;
  className?: string;
}) {
  const classes = ['card', 'metric-tile', `metric-tile--${span}`];
  if (primary) classes.push('metric-tile--primary');
  if (leading) classes.push('metric-tile--hero');
  if (onOpen) classes.push('metric-tile--openable');
  if (className) classes.push(className);

  const body = (
    <>
      {kicker ? <span className="metric-tile__kicker">{kicker}</span> : null}
      <MetricValue value={value} scale={scale} />
      {bar ? <MetricBar percent={bar.percent} label={bar.label} met={bar.met} /> : null}
      {line ? <span className="metric-tile__line">{line}</span> : null}
    </>
  );

  return (
    <div data-card data-metric={id} className={classes.join(' ')}>
      <h3 className="metric-tile__title">
        {onOpen ? (
          <button
            type="button"
            className="metric-tile__open"
            aria-haspopup="dialog"
            onClick={onOpen}
          >
            {title}
            <ChevronRightIcon size={16} className="metric-tile__chevron" />
          </button>
        ) : (
          title
        )}
      </h3>
      {leading ? (
        <div className="metric-tile__hero">
          <span className="metric-tile__leading">{leading}</span>
          <div className="metric-tile__heroBody">{body}</div>
        </div>
      ) : (
        body
      )}
    </div>
  );
}

/** The board: two columns, one gap, and the tiles decide their own span. */
export function MetricBoard({ children }: { children: ReactNode }) {
  return <div className="metric-board">{children}</div>;
}

/**
 * The detail surface a tile opens. Built on the one sheet primitive the app
 * already has — focus capture, Escape, the grabber, the scrolling body — so
 * every metric explains itself the same way and no card grows a modal of its
 * own. The header restates the tile's value so the number is in view while
 * its explanation is read; the children are that explanation, in full.
 */
export function MetricDetailSheet({
  open,
  title,
  value,
  scale,
  bar,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  value: ReactNode;
  scale?: string;
  bar?: MetricBarSpec;
  onClose(): void;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <div className="metric-sheet__figure">
        <MetricValue value={value} scale={scale} />
        {bar ? <MetricBar percent={bar.percent} label={bar.label} met={bar.met} /> : null}
      </div>
      <div className="metric-sheet__body">{children}</div>
    </Sheet>
  );
}
