import { MUSCLE_LABEL_KEYS, MUSCLE_STATE_KEYS } from '../../components/BodyRenderer';
import { IDENTITY_COLOR, IDENTITY_SELECTION_RING_ALPHA, IDENTITY_UNTRAINED_ALPHA, mutedIdentity } from '../body';
import type { MuscleGroup } from '../../core/model';
import { diffInDays, type DateKey } from '../../core/dates';
import { useT } from '../../i18n/I18nProvider';
import type { Translator } from '../../i18n';
import type { MuscleAnalyticsView } from './muscleAnalytics';
import { Sparkline } from './Sparkline';
import { shownChangeText } from './muscleState';

/**
 * The ten muscle groups as one analytical list.
 *
 * Each row answers three questions in the order they are asked: which muscle
 * (the identity dot and the name), when it was last worked and by what, which
 * way it is going (the mini chart), and how far (the number and its state).
 *
 * **Two colour systems, never mixed.** The dot and the chart carry the
 * group's identity colour, which says *which muscle this is* and never
 * changes with performance. The number and the badge carry the state colour,
 * which says *how it is going*. Both come from `features/body/tokens.ts`;
 * there is no chart palette.
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
        const sub = lastTrainedText(view.lastTrainedAt, today, t);
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
              <span
                className="muscle-row__dot"
                aria-hidden="true"
                style={{
                  background: identity,
                  boxShadow: on
                    ? `0 0 0 3px ${mutedIdentity(IDENTITY_COLOR[view.id], IDENTITY_SELECTION_RING_ALPHA)}`
                    : 'none',
                }}
              />
              <span className="muscle-row__text">
                <span className="muscle-row__name">{t(MUSCLE_LABEL_KEYS[view.id])}</span>
                {sub ? <span className="muscle-row__sub">{sub}</span> : null}
              </span>

              {/* No trend is no chart: an untrained group and one waiting for
                  a baseline have nothing to draw, and drawing a flat line
                  there would state a result they do not have. */}
              <span className="muscle-row__chart" aria-hidden="true">
                {view.trend.length > 0 ? (
                  <Sparkline trend={view.trend} color={mutedIdentity(IDENTITY_COLOR[view.id])} />
                ) : null}
              </span>

              {/*
                The number where there is one, the state in words where there
                is not. Both are read in the state colour, and neither leaves
                the colour to carry the meaning on its own: a percentage says
                which way it went by its sign, and a group with no number says
                so in words.
              */}
              <span className={`muscle-row__right muscle-row__right--${view.state}`}>
                {delta === null ? (
                  <span className="muscle-row__badge">{t(MUSCLE_STATE_KEYS[view.state])}</span>
                ) : (
                  <span className="muscle-row__delta">{delta}</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
