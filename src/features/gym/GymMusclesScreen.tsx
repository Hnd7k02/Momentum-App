import { useState } from 'react';
import { MUSCLE_TREND_RANGES } from '../../core/config/constants';
import { Segmented, Sheet } from '../../components';
import { MUSCLE_STATE_KEYS } from '../../components/BodyRenderer';
import { ChevronLeftIcon, ChevronRightIcon, InfoIcon } from '../../components/Icons';
import { useT } from '../../i18n/I18nProvider';
import { GymProgress } from './GymProgress';
import { LEGEND_STATES } from './MuscleModule';
import { useGymHistoryState } from './useGymHistory';
import { useTrainingLauncher } from './useTrainingLauncher';
import { useToday } from '../../app/useToday';
import '../areas/areas.css';
import '../progress/progress.css';
import './gymHub.css';
import { useWorld } from '../../app/world';
import { bodyMeasure, isMeasuring } from '../measure';

/**
 * Muskelgruppen — the Gym area's second destination (`#/areas/gym/muscles`).
 *
 * The body on its stage (block 7B, contract §8). Above it stand three
 * things and no more: the header in 17px with back, the title and ⓘ; the
 * range — 30 days, the default, or 90 (contract §7; Verlauf keeps 7 and
 * 30); and the metrics strip. Beneath it the five states, the ten rows, the
 * exercises and their detail. Behind ⓘ is the legend: what the colour
 * measures, and the five states with their rule in words. This is the only
 * screen that renders the 3D body, behind the same lazy boundary as before;
 * the hub never does.
 *
 * **Two ways lead here and one way back** (D161). Heute's Gym tile opens
 * this screen directly, and so does the hub's card. Back — the button and
 * the browser's own — returns to where the user came from; after a link
 * straight to this address it leads to the hub. The hub stays the place for
 * training, plans and running, and is one tap away from here whichever way
 * the user came: the row at the foot of the screen, and "Pläne verwalten"
 * in the plan chooser, lead to it and never back to Heute.
 *
 * It exists before the first workout: with no history the body is drawn
 * untrained and the rows say so, and nothing is coloured as if progress
 * existed.
 */
export function GymMusclesScreen({
  onBack,
  onOpenHub,
}: {
  /** Leaves the way the screen was entered: to Heute, or to the hub. */
  onBack(): void;
  /** Opens the Gym hub, wherever the user came from. */
  onOpenHub(): void;
}) {
  const t = useT();
  // Muskelgruppen is a Gym screen (WP3 Stage 6).
  useWorld('gym');
  // The measuring display counts from here (block 7B, D181): the screen is
  // open. During the first render, before the body below is asked for.
  useState(() => {
    if (isMeasuring()) bodyMeasure.opened(performance.now());
    return null;
  });
  const [range, setRange] = useState<number>(MUSCLE_TREND_RANGES[0]);
  const [legendOpen, setLegendOpen] = useState(false);
  const { history: gym, latestSession, loading, failed, reload } = useGymHistoryState(range);
  // The empty state's one action: the same flow as the hub's "Training
  // erfassen" — the day's session continued, a plan chosen or a free
  // session — and what it writes reaches this screen through the store's
  // change version. "Pläne verwalten" lives on the hub: it leads there, not
  // back to wherever this screen was opened from.
  const date = useToday();
  const launcher = useTrainingLauncher({ date, onClosed: () => undefined, onManagePlans: onOpenHub });

  // The workout is a screen of its own, on top of this one.
  if (launcher.open) return <>{launcher.overlay}</>;

  return (
    <div className="screen">
      <header className="screen__header gym-muscles__header">
        <button
          type="button"
          className="button button--quiet gym-muscles__back"
          onClick={onBack}
          aria-label={t('common.back')}
        >
          <ChevronLeftIcon />
        </button>
        <h1 className="gym-muscles__title">{t('gymHub.muscles.title')}</h1>
        <button
          type="button"
          className="button button--quiet gym-muscles__legendButton"
          onClick={() => setLegendOpen(true)}
          aria-label={t('muscle.legend.open')}
          aria-haspopup="dialog"
        >
          <InfoIcon size={22} />
        </button>
      </header>

      <div className="areas__scroll" data-terminal="gym" data-section="muscles" aria-busy={loading || undefined}>
        <div className="progress__ranges gym-muscles__ranges">
          <Segmented<string>
            label={t('gym.progress.title')}
            value={String(range)}
            onChange={(next) => setRange(Number(next))}
            options={MUSCLE_TREND_RANGES.map((days) => ({
              value: String(days),
              label: t('progress.rangeDays', { count: days }),
            }))}
          />
        </div>
        {/* The strip, the body and the rows. The stage is there from the
            first render; the strip and the rows hold their places while the
            history loads (contract §11), and a load that failed says so in
            the rows' place and can be tried again. */}
        <GymProgress
          history={gym}
          rangeDays={range}
          latestSession={latestSession}
          loading={loading}
          failed={failed}
          onRetry={reload}
          onStartTraining={() => launcher.start()}
        />

        {/* The hub is one tap from here, whichever way the user came (D161):
            training, plans and running live there. */}
        <button type="button" className="gym-muscles__toHub" onClick={onOpenHub}>
          <span className="gym-muscles__toHubText">
            <span className="gym-muscles__toHubName">{t('gymHub.muscles.toHub')}</span>
            <span className="gym-muscles__toHubHint">{t('gymHub.muscles.toHubHint')}</span>
          </span>
          <ChevronRightIcon size={18} />
        </button>
      </div>
      {launcher.overlay}

      {/* The legend (contract §7): the sentence word for word, then the five
          states, each with its mark, its name and its rule in words — which
          for a rise and a fall also say why the one counts sooner than the
          other (D180). */}
      <Sheet open={legendOpen} title={t('muscle.legend.title')} onClose={() => setLegendOpen(false)}>
        <div className="muscle-legend-sheet">
          <p className="muscle-legend-sheet__lead">{t('muscle.legend.lead')}</p>
          <dl className="muscle-legend-sheet__states">
            {LEGEND_STATES.map((state) => (
              <div key={state} className="muscle-legend-sheet__state">
                <dt>
                  <i className={`muscle-legend__mark muscle-legend__mark--${state}`} aria-hidden="true" />
                  {t(MUSCLE_STATE_KEYS[state])}
                </dt>
                <dd>{t(`muscle.legend.${state}`)}</dd>
              </div>
            ))}
          </dl>
          <p className="muscle-legend-sheet__note">{t('muscle.legend.exerciseDay')}</p>
        </div>
      </Sheet>
    </div>
  );
}
