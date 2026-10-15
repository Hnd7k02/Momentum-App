import { ChevronRightIcon } from '../../components/Icons';
import { useT } from '../../i18n/I18nProvider';
import type { RunningWorkout } from '../../storage/services/gymService';
import './runningWorkout.css';

/** "60 % erledigt", or "2 Übungen · 5 Sätze" for a workout without a plan. */
export function useRunningWorkoutDetail(): (workout: RunningWorkout) => string {
  const t = useT();
  return (workout) => {
    if (workout.kind === 'plan' && workout.percent !== null) {
      return t('workout.running.percent', { percent: workout.percent });
    }
    const exercises =
      workout.exercises === 1
        ? t('workout.running.exerciseOne')
        : t('workout.running.exercises', { count: workout.exercises });
    const sets = workout.sets === 1 ? t('workout.running.setOne') : t('workout.running.sets', { count: workout.sets });
    return `${exercises} · ${sets}`;
  };
}

/**
 * A workout under way, at the top of Heute (WP3, P7).
 *
 * It is shown while today's session has a saved set and was neither
 * finished with "Fertig" nor recorded before the app knew the difference.
 * One tap continues it. The Gym companion's place is held by a plain
 * placeholder until the art arrives (P12).
 */
export function RunningWorkoutCard({
  workout,
  onContinue,
}: {
  workout: RunningWorkout;
  onContinue(): void;
}) {
  const t = useT();
  const detail = useRunningWorkoutDetail()(workout);
  return (
    <button
      type="button"
      className="running-workout"
      aria-label={t('workout.running.label', { detail })}
      onClick={onContinue}
    >
      <span className="running-workout__companion" aria-hidden="true" data-companion="gym" />
      <span className="running-workout__body" aria-hidden="true">
        <span className="running-workout__title">{t('workout.running.title')}</span>
        <span className="running-workout__detail">{detail}</span>
        {workout.kind === 'plan' && workout.percent !== null ? (
          <span className="running-workout__track">
            <span className="running-workout__fill" style={{ width: `${workout.percent}%` }} />
          </span>
        ) : null}
      </span>
      <ChevronRightIcon size={18} />
    </button>
  );
}
