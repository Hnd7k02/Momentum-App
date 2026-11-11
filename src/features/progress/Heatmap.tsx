import { useId, useState } from 'react';
import { SCORE_BANDS, type ScoreBandId } from '../../core/config/constants';
import { STATUS_LABEL_KEYS } from '../../core/scoring/scale';
import type { DateKey } from '../../core/dates';
import { ChevronDownIcon, ChevronRightIcon } from '../../components/Icons';
import { formatDayAndMonth } from '../../i18n/format';
import { percentText } from '../../i18n/typography';
import { useI18n, useT } from '../../i18n/I18nProvider';

export interface HeatmapRow {
  key: string;
  label: string;
  values: (number | null)[];
  /** Rows nested under this one, revealed on tap. */
  children?: HeatmapRow[];
  /** Set on a row that opens something of its own — a question's history. */
  onOpen?: () => void;
}

export function bandOf(value: number): ScoreBandId {
  for (const band of SCORE_BANDS) {
    if (value >= band.from && value < band.to) return band.id;
  }
  return 'strong';
}

export function summarise(values: (number | null)[]) {
  const scored = values.filter((value): value is number => value !== null);
  return {
    recorded: scored.length,
    total: values.length,
    missing: values.length - scored.length,
    average: scored.length
      ? Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length)
      : null,
  };
}

/**
 * Thirty days, one strip per row.
 *
 * The value is the **height** of each bar, not its colour: the four bands sit
 * at similar luminance, so hue alone would leave a weak day and a strong one
 * confusable. Colour reinforces a reading that height already carries, and
 * an empty day is simply an unfilled track rather than another colour.
 *
 * The strip is decorative to assistive technology. Thirty bars have no
 * interaction, so making each one a stop would be thirty tab stops and
 * thirty announcements to say what one sentence says — and the dates, which
 * are the part a screen reader actually needs, are not in the shape at all.
 * The numbers live in the table at the bottom of this file instead.
 */
function Strip({ values }: { values: (number | null)[] }) {
  return (
    <div className="heatmap__strip" aria-hidden="true">
      {values.map((value, index) => (
        <span key={index} className="heatmap__cell">
          {value === null ? (
            <span className="heatmap__empty" />
          ) : (
            <span
              className={`heatmap__bar heatmap__bar--${bandOf(value)}`}
              // A floor of 8% so a genuine zero still reads as a recorded day
              // rather than as no data at all.
              style={{ height: `${Math.max(8, value)}%` }}
            />
          )}
        </span>
      ))}
    </div>
  );
}

function Row({
  row,
  depth = 0,
  open,
  onToggle,
}: {
  row: HeatmapRow;
  depth?: number;
  open: Set<string>;
  onToggle(key: string): void;
}) {
  const t = useT();
  const uid = useId();
  const childrenId = `${uid}-children`;
  const summaryId = `${uid}-summary`;
  const { average, recorded, total, missing } = summarise(row.values);
  const expandable = Boolean(row.children?.length);
  const openable = !expandable && typeof row.onOpen === 'function';
  const expanded = open.has(row.key);

  const header = (
    <>
      <span className="heatmap__label">{row.label}</span>
      <span className="heatmap__average">
        {average === null ? t('score.none') : percentText(average)}
      </span>
      {/* The shape of the strip, in one sentence, for anyone not seeing it.
          On the expandable rows it is the button's *description*, not part of
          its name: the name says which row this opens, and the counts are
          what you get for waiting. */}
      <span className="visually-hidden">
        {t('heatmap.rowSummary', { recorded, total, missing })}
      </span>
    </>
  );

  return (
    <div className={`heatmap__row heatmap__row--depth${depth}`}>
      {expandable ? (
        <button
          type="button"
          className="heatmap__header heatmap__header--tappable"
          aria-expanded={expanded}
          aria-controls={childrenId}
          aria-describedby={summaryId}
          onClick={() => onToggle(row.key)}
        >
          <span className="heatmap__label">{row.label}</span>
          <span className="heatmap__average">
            {average === null ? t('score.none') : percentText(average)}
          </span>
          <ChevronDownIcon size={16} className={expanded ? 'heatmap__chevron--open' : undefined} />
        </button>
      ) : openable ? (
        /*
         * A question row opens that question's own history. It is a button
         * rather than a tap target on the strip, because the strip is
         * decorative — and its accessible name is the question plus its
         * average, with the counts as the description, exactly like the
         * expandable rows above. Two kinds of row, one way of reading them.
         */
        <button
          type="button"
          className="heatmap__header heatmap__header--tappable"
          aria-describedby={summaryId}
          onClick={row.onOpen}
        >
          <span className="heatmap__label">{row.label}</span>
          <span className="heatmap__average">
            {average === null ? t('score.none') : percentText(average)}
          </span>
          <ChevronRightIcon size={16} />
        </button>
      ) : (
        <div className="heatmap__header">{header}</div>
      )}
      {expandable || openable ? (
        <span className="visually-hidden" id={summaryId}>
          {t('heatmap.rowSummary', { recorded, total, missing })}
        </span>
      ) : null}
      <Strip values={row.values} />
      {expandable ? (
        <div id={childrenId}>
          {expanded
            ? row.children?.map((child) => (
                <Row
                  key={child.key}
                  row={child}
                  depth={depth + 1}
                  open={open}
                  onToggle={onToggle}
                />
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The same data as the strips, as a table nobody sees.
 *
 * This is the semantic alternative rather than an addition: the strips are
 * `aria-hidden`, so nothing is announced twice. A table is what lets a screen
 * reader move by row and column and ask "what was the 3rd of September" — a
 * question the bars cannot answer at any level of ARIA decoration, because
 * they never carried the dates.
 *
 * It lists exactly the rows the strips are showing, so expanding a domain
 * expands both.
 */
function DataTable({ rows, days }: { rows: HeatmapRow[]; days: DateKey[] }) {
  const t = useT();
  const { language } = useI18n();

  return (
    /*
     * The wrapper carries the hiding, not the table.
     *
     * `.visually-hidden` clamps to a 1px box, and a `display: table` element
     * ignores that — its box is sized by its content, so thirty-one columns
     * of dates make a very wide absolutely-positioned element that only
     * `clip-path` was keeping off the screen. A block wrapper takes the
     * clamp, and its `overflow: hidden` contains the table inside it.
     */
    <div className="visually-hidden">
      <table>
        <caption>{t('heatmap.tableCaption', { count: days.length })}</caption>
        <thead>
          <tr>
            <th scope="col">{t('heatmap.tableRowHeader')}</th>
            {days.map((day) => (
              <th key={day} scope="col">
                {formatDayAndMonth(language, day)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              {row.values.map((value, index) => (
                // Rounded, like every value the screen shows. Unrounded, a
                // reader hears "70.83333333333333 Prozent".
                <td key={index}>
                  {value === null ? t('score.none') : percentText(Math.round(value))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Heatmap({ rows, days }: { rows: HeatmapRow[]; days: DateKey[] }) {
  const t = useT();
  // Held here rather than per row, so the table and the strips can never
  // disagree about which rows are on screen.
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const shown = rows.flatMap((row) =>
    open.has(row.key) && row.children ? [row, ...row.children] : [row],
  );

  return (
    <div className="heatmap">
      {rows.map((row) => (
        <Row key={row.key} row={row} open={open} onToggle={toggle} />
      ))}

      <DataTable rows={shown} days={days} />

      <p className="heatmap__range">{t('heatmap.range', { count: days.length })}</p>

      {/* Colour is explained in words; nothing here depends on telling two
          hues apart. */}
      <ul className="heatmap__legend">
        {SCORE_BANDS.map((band) => (
          <li key={band.id} className="heatmap__legendItem">
            <span className={`heatmap__swatch heatmap__swatch--${band.id}`} aria-hidden="true" />
            {t(STATUS_LABEL_KEYS[band.id])}
          </li>
        ))}
        <li className="heatmap__legendItem">
          <span className="heatmap__swatch heatmap__swatch--none" aria-hidden="true" />
          {t('score.none')}
        </li>
      </ul>
    </div>
  );
}
