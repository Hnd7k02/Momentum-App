import { MUSCLE_GROUPS } from '../../core/model';
import { MUSCLE_LABEL_KEYS, MUSCLE_STATE_KEYS } from '../../components/BodyRenderer';
import { useT } from '../../i18n/I18nProvider';
import { shownChangeText, type ShownMuscle, type ShownPerformance } from './muscleState';

/**
 * The metrics strip above the body (block 7B, contract §4, mock-up 1).
 *
 * Three cells, parted by a fine line, the first wider (1.35 : 1 : 1) so
 * that "Leistungstrend" fits a 320px phone: the performance trend with its
 * state, how many of the ten groups are rated, and the group that rose
 * most. Each cell is a label in 11px, a value in the strip's figure step
 * and a line beneath it.
 *
 * **It counts nothing.** The trend, its state and the rated groups are
 * `shownPerformance()`'s — what the rows, the body and the hub's card read
 * (`muscleState.ts`). The one thing chosen here is *which* rated group
 * stands in the third cell, and that is a choice among figures the rule
 * already made.
 *
 * It takes the place of the tile that carried the trend alone. What that
 * tile's tap explained is still one tap away: the first cell is a button
 * and opens the same sheet.
 *
 * It is not shown with nothing rated — a row of three dashes says nothing
 * (contract §11). The screen says in a sentence what is missing instead.
 */

/**
 * The group that rose most: of the rated groups that are *improved*, the
 * one with the largest change; of two equal ones the first in the domain's
 * order. `null` when no rated group improved — "strongest" is not the name
 * of the least decline.
 */
export function strongestOf(muscles: readonly ShownMuscle[]): ShownMuscle | null {
  let best: ShownMuscle | null = null;
  for (const entry of muscles) {
    if (entry.state !== 'improved' || entry.change === null) continue;
    if (best === null || entry.change > (best.change ?? Number.NEGATIVE_INFINITY)) best = entry;
  }
  return best;
}

export function MuscleStrip({
  shown,
  onExplain,
}: {
  /** The range as the screen shows it; the strip is rendered only with a rated group. */
  shown: ShownPerformance;
  /** Opens the sheet that says what the trend is and is not. */
  onExplain: () => void;
}) {
  const t = useT();
  const trend = shownChangeText(shown.change);
  const strongest = strongestOf(shown.muscles);
  const total = MUSCLE_GROUPS.length;

  return (
    <div className="muscle-strip" data-strip>
      {/* The trend, in the state the band gives it (contract §7): the figure
          and its word stand together, and only a rise or a fall is coloured. */}
      <button
        type="button"
        className="muscle-strip__cell muscle-strip__cell--open"
        data-metric="gym-overall"
        aria-haspopup="dialog"
        onClick={onExplain}
      >
        <span className="muscle-strip__label">{t('gym.progress.overall')}</span>
        <span className={`muscle-strip__value gym-progress__trend gym-progress__trend--${shown.trend ?? 'unchanged'}`}>
          {trend}
        </span>
        <span className="muscle-strip__sub">{shown.trend ? t(MUSCLE_STATE_KEYS[shown.trend]) : null}</span>
      </button>

      <div className="muscle-strip__cell" role="group" aria-label={t('gym.progress.groupsCounted', { count: shown.rated.length, total })}>
        <span className="muscle-strip__label" aria-hidden="true">{t('gym.strip.rated')}</span>
        <span className="muscle-strip__value" aria-hidden="true">
          {t('gym.strip.ratedValue', { count: shown.rated.length, total })}
        </span>
        <span className="muscle-strip__sub" aria-hidden="true">{t('gym.strip.ratedUnit')}</span>
      </div>

      {/* The change is the figure and the group stands beneath it: of the
          ten names only "Brust" fits this cell at the figure's size, and
          nothing in a cell is cut. */}
      <div className="muscle-strip__cell" data-strongest={strongest?.muscle ?? ''}>
        <span className="muscle-strip__label">{t('gym.strip.strongest')}</span>
        {strongest ? (
          <>
            <span className="muscle-strip__value gym-progress__trend gym-progress__trend--improved">
              {shownChangeText(strongest.change)}
            </span>
            <span className="muscle-strip__sub">{t(MUSCLE_LABEL_KEYS[strongest.muscle])}</span>
          </>
        ) : (
          <>
            <span className="muscle-strip__value" aria-hidden="true">–</span>
            <span className="muscle-strip__sub">{t('gym.strip.noneImproved')}</span>
          </>
        )}
      </div>
    </div>
  );
}
