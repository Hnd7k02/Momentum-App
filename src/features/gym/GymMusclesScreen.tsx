import { useState } from 'react';
import { MUSCLE_TREND_RANGES } from '../../core/config/constants';
import { LoadFailure, LoadingBlocks, Segmented, Sheet } from '../../components';
import { MUSCLE_STATE_KEYS } from '../../components/BodyRenderer';
import { ChevronLeftIcon, InfoIcon } from '../../components/Icons';
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

/**
 * Muskelgruppen — the Gym area's second destination (`#/areas/gym/muscles`).
 *
 * The progress hierarchy the Gym workspace used to carry below its board:
 * the overall development, the body and the ten group rows, the exercises
 * and their detail — reused whole, over the same loaded history. Its range
 * is 30 days, the default, or 90 (contract §7); Verlauf keeps 7 and 30.
 * Behind ⓘ in the header is the legend: what the colour measures, and the
 * five states with their rule in words. This is the only screen that renders the 3D body,
 * behind the same lazy boundary as before; the hub above it never does.
 *
 * It exists before the first workout: with no history the body is drawn
 * untrained and the rows say so, and nothing is coloured as if progress
 * existed.
 */
export function GymMusclesScreen({ onBack }: { onBack(): void }) {
  const t = useT();
  // Muskelgruppen is a Gym screen (WP3 Stage 6).
  useWorld('gym');
  const [range, setRange] = useState<number>(MUSCLE_TREND_RANGES[0]);
  const [legendOpen, setLegendOpen] = useState(false);
  const { history: gym, latestSession, loading, failed, reload } = useGymHistoryState(range);
  // The empty state's one action: the same flow as the hub's "Training
  // erfassen" — the day's session continued, a plan chosen or a free
  // session — and what it writes reaches this screen through the store's
  // change version. "Pläne verwalten" lives on the hub, one step back.
  const date = useToday();
  const launcher = useTrainingLauncher({ date, onClosed: () => undefined, onManagePlans: onBack });

  // The workout is a screen of its own, on top of this one.
  if (launcher.open) return <>{launcher.overlay}</>;

  return (
    <div className="screen">
      <header className="screen__header gym-session__header">
        <button
          type="button"
          className="button button--quiet gym-session__back"
          onClick={onBack}
          aria-label={t('common.back')}
        >
          <ChevronLeftIcon />
        </button>
        <h1 className="screen__title">{t('gymHub.muscles.title')}</h1>
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

      <div className="areas__scroll" data-terminal="gym" data-section="muscles">
        <div className="progress__ranges">
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
        {/* The overall figure and the body's card hold their places while
            the history loads (contract §11). */}
        {gym ? (
          <GymProgress
            history={gym}
            rangeDays={range}
            latestSession={latestSession}
            onStartTraining={() => launcher.start()}
          />
        ) : loading ? (
          <LoadingBlocks heights={[130, 520]} />
        ) : failed ? (
          // A load that failed says so and can be tried again (contract
          // §11); it used to leave the screen empty under the range control.
          <LoadFailure title={t('error.muscles.title')} onRetry={reload} />
        ) : null}
      </div>
      {launcher.overlay}

      {/* The legend (contract §7): the sentence word for word, then the five
          states, each with its mark, its name and its rule in words. */}
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
