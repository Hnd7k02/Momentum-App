import { useMemo } from 'react';
import { MUSCLE_GROUPS } from '../../core/model';
import type { DateKey } from '../../core/dates';
import { useToday } from '../../app/useToday';
import { percentChange } from '../../core/gym/performance';
import { Section } from '../../components';
import { ChevronRightIcon } from '../../components/Icons';
import { useT } from '../../i18n/I18nProvider';
import type { GymHistory } from '../../storage/services/gymService';
import type { MuscleState } from '../../components/BodyRenderer';
import { muscleGap } from './muscleGap';
import { muscleStateOf } from './muscleState';
import bodyPreview from './assets/body-preview.webp';
import './gymHub.css';

/**
 * The door to muscle-group progress, on the Gym hub (WP2-2).
 *
 * A whole card that is one button, so the destination is obvious and the
 * tap target is the card. The figure inside it is a still of the approved
 * body — `momentum-body.glb`, rendered once through the real viewer in its
 * neutral tint and saved as a small image (`tools/render-body-preview.mjs`).
 * It is a picture of the destination, not a second body: it has no regions,
 * takes no colour and answers no tap of its own. What the data says is
 * carried by the text and, as an accent, by ten small markers in the
 * groups' order, each in the state the module shows — grey before the first
 * workout, so nothing reads as progress that is not. All of it is hidden
 * from assistive technology; the button's name and the lines of text carry
 * the facts. The 3D body is **not** here: it loads only in the destination
 * this card opens.
 *
 * Nothing is computed: the states and the overall figure are the ones
 * `GymProgress` shows, from the same loaded history.
 */
export function MuscleEntryCard({
  history,
  rangeDays,
  latestSession = null,
  onOpen,
}: {
  /** `null` while loading; a history with no days when the range holds none. */
  history: GymHistory | null;
  rangeDays: number;
  /** The day of the latest Gym session of all, `null` before the first. */
  latestSession?: DateKey | null;
  onOpen(): void;
}) {
  const t = useT();
  const today = useToday();
  const states: { muscle: (typeof MUSCLE_GROUPS)[number]; state: MuscleState }[] = useMemo(
    () =>
      (history?.overall.muscles ?? MUSCLE_GROUPS.map((muscle) => ({ muscle, status: 'noData' as const, ratio: null, exercises: 0, compared: 0, latestScore: null }))).map(
        (entry) => ({ muscle: entry.muscle, state: muscleStateOf(entry) }),
      ),
    [history],
  );

  const trained = states.filter((view) => view.state !== 'noData').length;
  const measured = history?.overall.measured.length ?? 0;
  const change = percentChange(history?.overall.ratio ?? null);
  const hasData = (history?.days.length ?? 0) > 0;

  // An empty range is "never trained" only before the first session; with
  // one behind it the card says that the range is empty and how long ago
  // the last session was (STOP 6b). The reasons are `muscleGap`'s.
  const gap = history ? muscleGap(history, latestSession, today, rangeDays) : null;
  const summary = !hasData
    ? gap?.kind === 'outsideRange'
      ? t('gymHub.muscles.outside', { days: rangeDays })
      : gap?.kind === 'unscored'
        ? t('gymHub.muscles.unscored')
        : t('gymHub.muscles.none')
    : measured > 0
      ? t('gymHub.muscles.summary', { count: measured, total: MUSCLE_GROUPS.length })
      : t('gymHub.muscles.trained', { count: trained, total: MUSCLE_GROUPS.length });
  const overall =
    hasData && measured > 0 && change !== null
      ? t('gymHub.muscles.overall', {
          change:
            Math.round(change) === 0
              ? t('gym.change.unchanged')
              : Math.round(change) > 0
                ? t('gym.change.improved', { percent: Math.round(change) })
                : t('gym.change.declined', { percent: Math.round(change) }),
        })
      : null;
  // The figure's colour follows the figure as printed (B6): green for a
  // rounded rise, red for a rounded fall, the text colour when it is held.
  const overallTone =
    change === null || Math.round(change) === 0
      ? ''
      : Math.round(change) > 0
        ? 'gym-hub__musclesOverall--improved'
        : 'gym-hub__musclesOverall--declined';

  return (
    // No section label: the card names itself, and it is the section's only
    // card, so a grey "Muskelgruppen" above a bold one was the same word twice.
    <Section>
      <button
        type="button"
        className="card gym-hub__muscles"
        data-card
        aria-label={t('gymHub.muscles.open')}
        onClick={onOpen}
      >
        <span className="gym-hub__preview" aria-hidden="true">
          <img className="gym-hub__previewBody" src={bodyPreview} alt="" width={240} height={472} decoding="async" />
          <span className="gym-hub__previewStates">
            {states.map(({ muscle, state }) => (
              <i key={muscle} className={`gym-hub__previewState gym-hub__previewState--${state}`} />
            ))}
          </span>
        </span>
        <span className="gym-hub__musclesBody">
          <span className="gym-hub__musclesTitle">{t('gymHub.muscles.title')}</span>
          <span className="gym-hub__musclesSummary">{summary}</span>
          {overall ? (
            <span className={`gym-hub__musclesOverall ${overallTone}`.trim()}>{overall}</span>
          ) : null}
          <span className="gym-hub__musclesRange">
            {hasData
              ? t('gymHub.muscles.range', { days: rangeDays })
              : gap?.kind === 'outsideRange'
                ? t('gymHub.muscles.outsideShort', { count: gap.daysAgo })
                : gap?.kind === 'unscored'
                  ? t('gymHub.muscles.range', { days: rangeDays })
                  : t('gymHub.muscles.noneHint')}
          </span>
        </span>
        <span className="gym-hub__chevron" aria-hidden="true">
          <ChevronRightIcon size={20} />
        </span>
      </button>
    </Section>
  );
}
