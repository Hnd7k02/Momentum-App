import { MUSCLE_LABEL_KEYS, MUSCLE_STATE_KEYS } from '../../components/BodyRenderer';
import { IDENTITY_COLOR, IDENTITY_UNTRAINED_ALPHA, mutedIdentity } from '../body';
import type { MuscleGroup } from '../../core/model';
import { diffInDays, type DateKey } from '../../core/dates';
import { useT } from '../../i18n/I18nProvider';
import type { Translator } from '../../i18n';
import type { MuscleAnalyticsView } from './muscleAnalytics';
import { useMediaQuery } from '../../app/useMediaQuery';
import { SPARK_WIDTH, SPARK_WIDTH_NARROW, Sparkline } from './Sparkline';
import { shownChangeText } from './muscleState';

/**
 * The ten muscle groups as one analytical list.
 *
 * Each row answers three questions in the order they are asked: which muscle
 * (the identity dot and the name), when it was last worked and by what, which
 * way it is going (the mini chart), and how far (the number and its state).
 *
 * **Two colour systems, never mixed** (D154). The dot carries the group's
 * identity colour, which says *which muscle this is* and never changes with
 * performance — and the dot is the only place it appears. The number, the
 * badge and the end point of the chart carry the state colour, which says
 * *how it is going*; the chart's line is the neutral data ink. A chosen row
 * is marked by the accent, like every selection.
 *
 * The rows own no state: the selected group comes from the Gym screen and
 * goes back to it, so the body above and the exercises below always agree
 * with the list.
 */

/**
 * When this group was last worked: "Heute", "Gestern", "Vor N Tagen", or
 * nothing at all where it never was. Terse on purpose — it sits under the
 * muscle's name in a row that also carries a chart and a number, and a
 * sentence there would wrap on a phone.
 */
export function lastTrainedText(
  lastTrainedAt: DateKey | null,
  today: DateKey,
  t: Translator,
): string | null {
  if (lastTrainedAt === null) return null;
  // Both sides are already the local calendar day the set was logged under,
  // so this is a difference of two dates and never a conversion of a moment.
  const days = diffInDays(lastTrainedAt, today);
  if (days <= 0) return t('muscle.lastTrained.today');
  if (days === 1) return t('muscle.lastTrained.yesterday');
  return t('muscle.lastTrained.days', { count: days });
}

export function MuscleRows({
  views,
  today,
  selected,
  onSelect,
}: {
  views: readonly MuscleAnalyticsView[];
  today: DateKey;
  selected: MuscleGroup | null;
  onSelect: (muscle: MuscleGroup) => void;
}) {
  const t = useT();
  // Where the row wraps (`muscleModule.css`), the chart is the narrow one:
  // drawn at 64 units, not the 80-unit chart squeezed (contract §6).
  const narrow = useMediaQuery('(max-width: 360px)');

  return (
    <ul className="muscle-rows">
      {views.map((view) => {
        const identity = mutedIdentity(
          IDENTITY_COLOR[view.id],
          view.dataState === 'no-history' ? IDENTITY_UNTRAINED_ALPHA : 1,
        );
        const on = selected === view.id;
        /*
         * One supporting line, and it is when — the approved row carries the
         * recency and nothing else. Which exercise produced the latest day is
         * derived and available on the view, but it belongs where it can be
         * read against the others: the Übungen list below already answers
         * "what did I do for this muscle", for whichever group is selected.
         */
        const recency = lastTrainedText(view.lastTrainedAt, today, t);
        // A group with too little to compare also says how much there is:
        // "Vor 2 Tagen · 2 Übungstage" (contract §7). The full sentence
        // stands with the group's exercises once the row is chosen.
        const sub =
          view.state === 'awaitingBaseline' && recency
            ? `${recency} · ${t(view.exerciseDays === 1 ? 'muscle.exerciseDays.shortOne' : 'muscle.exerciseDays.short', { count: view.exerciseDays })}`
            : recency;
        // Sign, number and colour from the one rounded figure (B6).
        const delta = shownChangeText(view.delta);

        return (
          <li key={view.id} className="muscle-row">
            <button
              type="button"
              className="muscle-row__button"
              aria-pressed={on}
              onClick={() => onSelect(view.id)}
            >
              <span className="muscle-row__dot" aria-hidden="true" style={{ background: identity }} />
              <span className="muscle-row__text">
                <span className="muscle-row__name">{t(MUSCLE_LABEL_KEYS[view.id])}</span>
                {sub ? <span className="muscle-row__sub">{sub}</span> : null}
              </span>

              {/* No trend is no chart: an untrained group and one with too
                  little to compare have nothing to draw, and drawing a line
                  there would state a result they do not have. */}
              <span className="muscle-row__chart" aria-hidden="true">
                {view.trend.length > 0 ? (
                  <Sparkline
                    trend={view.trend}
                    state={view.state}
                    width={narrow ? SPARK_WIDTH_NARROW : SPARK_WIDTH}
                  />
                ) : null}
              </span>

              {/*
                The number with its state in words beneath it where there is
                one, the state as a chip where there is not. A rise or a fall
                is read in its status colour, a held figure in the text
                colour (contract §7), and the number is never left to carry
                the meaning alone (contract §12): the word says it again.
              */}
              <span className={`muscle-row__right muscle-row__right--${view.state}`}>
                {delta === null ? (
                  <span className="muscle-row__badge">{t(MUSCLE_STATE_KEYS[view.state])}</span>
                ) : (
                  <>
                    <span className="muscle-row__delta">{delta}</span>
                    <span className="muscle-row__state">{t(MUSCLE_STATE_KEYS[view.state])}</span>
                  </>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
