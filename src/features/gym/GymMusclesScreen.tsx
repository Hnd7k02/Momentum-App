import { useState } from 'react';
import { TREND_RANGES } from '../../core/config/constants';
import { Segmented } from '../../components';
import { ChevronLeftIcon } from '../../components/Icons';
import { useT } from '../../i18n/I18nProvider';
import { GymProgress } from './GymProgress';
import { useGymHistory } from './useGymHistory';
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
  const gym = useGymHistory(range);

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
        {gym ? <GymProgress history={gym} /> : null}
      </div>
    </div>
  );
}
