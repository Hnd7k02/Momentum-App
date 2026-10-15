import { useMemo, useState } from 'react';
import { MUSCLE_GROUPS, type MuscleGroup } from '../../core/model';
import { Card, EmptyState, Section } from '../../components';
import './gymHub.css';
import { MetricDetailSheet, MetricTile } from '../../components/metrics';
import { ChevronRightIcon } from '../../components/Icons';
import { MUSCLE_LABEL_KEYS, type MuscleView } from '../../components/BodyRenderer';
import { percentChange } from '../../core/gym/performance';
import { useT } from '../../i18n/I18nProvider';
import { exerciseHistory, type GymHistory } from '../../storage/services/gymService';
import { ExerciseDetail } from './ExerciseDetail';
import { useExerciseNamer } from './exerciseNames';
import { MuscleModule } from './MuscleModule';
import { toMuscleAnalytics } from './muscleAnalytics';
import { muscleStateOf, shownTrend } from './muscleState';
import './gym.css';
import { useWeights } from '../../app/useWeights';

/**
 * Gym's detail, below the overview.
 *
 * ```
 *   Gym overall → muscle groups → exercises → best set per day
 * ```
 *
 * Four different numbers live on these screens and confusing them would make
 * all four useless, so each is labelled in its own terms: the **Gym rating**
 * is on the overview above and is 40 % attendance and 60 % development;
 * **group progress** and **exercise progress** here are percentages of change
 * against a previous performance; and the raw **reps × kg** is always shown
 * as reps × kg. No number is presented as a score out of a hundred, because
 * none of them is.
 */

// The state mapping lives in its own module so the adapters can share it
// without importing a screen; re-exported here for the callers that had it.
export { muscleStateOf };

const changeText = (
  ratio: number | null,
  t: (key: 'gym.change.improved' | 'gym.change.declined' | 'gym.change.unchanged', params?: Record<string, string | number>) => string,
): string | null => {
  const change = percentChange(ratio);
  if (change === null) return null;
  const rounded = Math.round(change);
  if (rounded === 0) return t('gym.change.unchanged');
  return rounded > 0
    ? t('gym.change.improved', { percent: rounded })
    : t('gym.change.declined', { percent: rounded });
};

export function GymProgress({ history }: { history: GymHistory }) {
  const t = useT();
  const weights = useWeights();
  const namer = useExerciseNamer();
  const [selected, setSelected] = useState<MuscleGroup | null>(null);
  const [openExercise, setOpenExercise] = useState<string | null>(null);
  const [overallOpen, setOverallOpen] = useState(false);

  /** The rows' view model: states, deltas, recency and the trends. */
  const analytics = useMemo(() => toMuscleAnalytics(history), [history]);

  const views: MuscleView[] = useMemo(
    () =>
      history.overall.muscles.map((entry) => ({
        muscle: entry.muscle,
        state: muscleStateOf(entry),
        detail: changeText(entry.ratio, t as never),
      })),
    [history, t],
  );

  /** The exercises that reached the selected group, newest comparison first. */
  const exercises = useMemo(() => {
    const ids = new Set(
      history.days
        .filter((day) => selected === null || day.muscles.includes(selected))
        .map((day) => day.exerciseId),
    );
    return [...ids]
      .map((id) => ({
        id,
        name: namer.name(id, history.names.get(id) ?? id),
        comparison: history.comparisons.get(id),
        latest: exerciseHistory(history, id)[0] ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [history, selected, namer]);

  if (openExercise) {
    return (
      <ExerciseDetail
        name={namer.name(openExercise, history.names.get(openExercise) ?? openExercise)}
        days={exerciseHistory(history, openExercise)}
        comparison={history.comparisons.get(openExercise)}
        onClose={() => setOpenExercise(null)}
      />
    );
  }

  /*
   * Before the first workout the destination still exists (WP2-2): the body
   * in its untrained state and the ten rows saying so. No overall figure —
   * there is nothing to state — and no exercise list. Nothing is coloured
   * as if progress existed; every group is `noData`, which is the truth.
   */
  if (history.days.length === 0) {
    return (
      <Section label={t('gym.progress.muscles')}>
        <Card>
          <p className="gym-progress__noData" role="status">
            <span className="gym-progress__noDataState">{t('gymHub.muscles.none')}</span>{' '}
            <span className="gym-progress__noDataHint">{t('gymHub.muscles.noneHint')}</span>
          </p>
          <MuscleModule
            muscles={history.overall.muscles}
            analytics={analytics}
            views={views}
            selected={selected}
            onSelect={(muscle) => setSelected(muscle)}
            onToggle={(muscle) => setSelected((current) => (current === muscle ? null : muscle))}
          />
        </Card>
      </Section>
    );
  }

  const overall = changeText(history.overall.ratio, t as never);

  return (
    <>
      {/*
        The overall development, as one tile: the figure, how many groups it
        rests on, and a sheet for what the figure is and is not. The one
        place the two numbers could be confused — this percentage and the
        rating it feeds — is said plainly there, not paraphrased here.
      */}
      <MetricTile
        id="gym-overall"
        title={t('gym.progress.overall')}
        value={
          overall ?? (
            <span className="metric-tile__state">{t('gym.progress.noBaseline')}</span>
          )
        }
        line={t('gym.progress.groupsCounted', {
          count: history.overall.measured.length,
          total: MUSCLE_GROUPS.length,
        })}
        onOpen={() => setOverallOpen(true)}
        className="gym-progress__overall"
      />
      <MetricDetailSheet
        open={overallOpen}
        title={t('gym.progress.overall')}
        value={overall ?? t('gym.progress.noBaseline')}
        scale={t('gym.progress.groupsCounted', {
          count: history.overall.measured.length,
          total: MUSCLE_GROUPS.length,
        })}
        onClose={() => setOverallOpen(false)}
      >
        <p>{t('gym.progress.explainGroups')}</p>
        <p>{t('gym.progress.explainMetric', { unit: weights.unitLabel })}</p>
        <p>{t('gym.progress.ratingNote')}</p>
        <p className="metric-sheet__note">{t('gym.tombstone.boundary')}</p>
      </MetricDetailSheet>

      <Section label={t('gym.progress.muscles')}>
        <Card>
          <MuscleModule
            muscles={history.overall.muscles}
            analytics={analytics}
            views={views}
            selected={selected}
            /* The body selects; the rows keep their toggle. */
            onSelect={(muscle) => setSelected(muscle)}
            onToggle={(muscle) => setSelected((current) => (current === muscle ? null : muscle))}
          />
        </Card>
      </Section>

      <Section
        label={
          selected
            ? `${t('gym.progress.exercises')} · ${t(MUSCLE_LABEL_KEYS[selected])}`
            : t('gym.progress.exercises')
        }
      >
        <Card>
          {exercises.length === 0 ? (
            <EmptyState title={t('gym.progress.exercises')} body={t('gym.progress.noData')} />
          ) : (
            exercises.map((entry) => {
              const change = changeText(entry.comparison?.ratio ?? null, t as never);
              // The colour follows the rounded figure, as the text does (B6).
              const kind =
                !entry.comparison || entry.comparison.kind === 'noBaseline'
                  ? 'noBaseline'
                  : (shownTrend(entry.comparison.ratio) ?? 'noBaseline');
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="gym-progress__row"
                  aria-describedby={`${entry.id}-change`}
                  onClick={() => setOpenExercise(entry.id)}
                >
                  <span className="gym-progress__rowBody">
                    <span className="gym-progress__rowName">{entry.name}</span>
                    <span className="gym-progress__rowMuscles">
                      {(entry.latest?.muscles ?? [])
                        .map((muscle) => t(MUSCLE_LABEL_KEYS[muscle]))
                        .join(' · ')}
                    </span>
                  </span>
                  <span
                    id={`${entry.id}-change`}
                    className={`gym-progress__change gym-progress__change--${kind}`}
                  >
                    {change ?? t('gym.progress.noBaseline')}
                  </span>
                  <ChevronRightIcon size={18} />
                </button>
              );
            })
          )}
        </Card>
      </Section>
    </>
  );
}
