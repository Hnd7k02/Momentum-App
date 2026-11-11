import { useState } from 'react';
import { TREND_RANGES } from '../../core/config/constants';
import { LoadFailure, LoadingBlocks, Segmented } from '../../components';
import { ChevronLeftIcon } from '../../components/Icons';
import { useT } from '../../i18n/I18nProvider';
import { GymProgress } from './GymProgress';
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
 * and their detail — reused whole, over the same loaded history and the
 * same range control. This is the only screen that renders the 3D body,
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
  const [range, setRange] = useState<number>(TREND_RANGES[TREND_RANGES.length - 1]!);
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
      </header>

      <div className="areas__scroll" data-terminal="gym" data-section="muscles">
        <div className="progress__ranges">
          <Segmented<string>
            label={t('gym.progress.title')}
            value={String(range)}
            onChange={(next) => setRange(Number(next))}
            options={TREND_RANGES.map((days) => ({
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
    </div>
  );
}
