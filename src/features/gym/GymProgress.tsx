import { useMemo, useState } from 'react';
import { MUSCLE_GROUPS, type MuscleGroup } from '../../core/model';
import { Button, Card, EmptyState, LoadFailure, LoadingBlocks, Section } from '../../components';
import './gymHub.css';
import { MetricDetailSheet } from '../../components/metrics';
import { ChevronRightIcon, PlusIcon } from '../../components/Icons';
import { MUSCLE_LABEL_KEYS, type MuscleView } from '../../components/BodyRenderer';
import type { DateKey } from '../../core/dates';
import { useI18n, useT } from '../../i18n/I18nProvider';
import { useToday } from '../../app/useToday';
import { exerciseHistory, type GymHistory } from '../../storage/services/gymService';
import { ExerciseDetail } from './ExerciseDetail';
import { useExerciseNamer } from './exerciseNames';
import { MuscleModule } from './MuscleModule';
import { MuscleStrip } from './MuscleStrip';
import { toMuscleAnalytics } from './muscleAnalytics';
import { MUSCLE_STATE_KEYS } from '../../components/BodyRenderer';
import { changeWords } from './changeWords';
import { exerciseDaysText, muscleGap, muscleGapText } from './muscleGap';
import { NOTHING_SHOWN, exerciseGroups, shownChangeText, shownPerformance } from './muscleState';
import { percentChange } from '../../core/gym/performance';
import './gym.css';

/**
 * Muskelgruppen, below its range: the metrics strip, the body on its stage,
 * the ten rows and the exercises.
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
 *
 * **It is there before its history** (block 7B, contract §11). The stage
 * stands from the first render, with the body's still in it, while the
 * history loads beside the viewer's code and the model — the strip and the
 * rows hold their places as calm surfaces until it arrives. A history that
 * could not be loaded says so in the rows' place; the body stays.
 */

export function GymProgress({
  history,
  rangeDays,
  latestSession,
  loading = false,
  failed = false,
  onRetry,
  onStartTraining,
}: {
  /** The range's history; `null` while it loads and when the load failed. */
  history: GymHistory | null;
  /** The range the history was loaded for: what "in den letzten N Tagen" means. */
  rangeDays: number;
  /** The day of the latest Gym session of all, `null` before the first. */
  latestSession: DateKey | null;
  loading?: boolean;
  failed?: boolean;
  /** Loads the history again after a failure. */
  onRetry?: () => void | Promise<void>;
  /** Starts a workout from the empty state (contract §11); absent, no button. */
  onStartTraining?: () => void;
}) {
  const t = useT();
  const { language } = useI18n();
  const today = useToday();
  const namer = useExerciseNamer();
  const [selected, setSelected] = useState<MuscleGroup | null>(null);
  const [openExercise, setOpenExercise] = useState<string | null>(null);
  const [overallOpen, setOverallOpen] = useState(false);

  /**
   * The range as the screen shows it: each group's state, which groups are
   * rated, and the trend above them — from the one rule (`muscleState.ts`).
   * The body, the flat figure, the rows, the count and the figure all read
   * this one value.
   */
  const shown = useMemo(() => (history ? shownPerformance(history.days, history.overall) : null), [history]);

  /** The rows' view model: states, deltas, recency and the trends. */
  const analytics = useMemo(() => (history && shown ? toMuscleAnalytics(history, shown) : null), [history, shown]);

  const views: MuscleView[] = useMemo(
    () =>
      (shown ?? NOTHING_SHOWN).muscles.map((entry) => ({
        muscle: entry.muscle,
        state: entry.state,
        detail: changeWords(entry.change, t)?.text ?? null,
      })),
    [shown, t],
  );

  /**
   * The exercises of the selected group, by name — by the membership the
   * state and the exercise days are counted with (`exerciseGroups`), so the
   * list under a chosen row is the evidence its figure rests on.
   */
  const exercises = useMemo(() => {
    if (!history) return [];
    const membership = exerciseGroups(history.days);
    const ids = new Set(
      history.days
        .filter((day) => selected === null || (membership.get(day.exerciseId)?.includes(selected) ?? false))
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

  if (openExercise && history) {
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
   * Why there is nothing here, or nothing to compare, in so many words
   * (contract §11). The range holds only the last 30 or 90 days, so "nothing
   * in the range" is not "never trained": the second names the last session
   * and says that only the range is shown (STOP 6b).
   */
  const gap = history ? muscleGap(history, latestSession, today, rangeDays) : null;
  const gapText = gap ? muscleGapText(gap, { t, language, rangeDays }) : null;
  const empty = history !== null && history.days.length === 0;
  /*
   * With nothing in the range the destination still exists (WP2-2): the body
   * in its untrained state and the ten rows saying so. No strip — a row of
   * three dashes says nothing (contract §11, mock-up 1) — no legend, since
   * nothing is coloured, and no exercise list. What is missing is a session,
   * so the one thing to do is offered where it is said: before the first
   * session and when the last one lies before the range.
   */
  const notice = gapText ? (
    <div className="gym-progress__gap">
      <p className="gym-progress__noData" role="status">
        <span className="gym-progress__noDataState">{gapText.title}</span>{' '}
        <span className="gym-progress__noDataHint">{gapText.hint}</span>
      </p>
      {empty && onStartTraining && (gap?.kind === 'never' || gap?.kind === 'outsideRange') ? (
        <div className="gym-progress__noDataAction">
          <Button variant="primary" block onClick={onStartTraining}>
            <PlusIcon size={18} />
            {t('gymHub.training.log')}
          </Button>
        </div>
      ) : null}
    </div>
  ) : null;

  /*
   * The trend of the rated groups, in the state the band gives it (contract
   * §7): the figure and its word stand together — "+2 % Gehalten" — and only
   * a rise or a fall is coloured. It heads the strip, and its sheet says
   * what the figure is and is not.
   */
  const rated = shown !== null && shown.rated.length > 0;
  const overall = shown ? shownChangeText(shown.change) : null;
  const overallValue =
    shown === null || overall === null || shown.trend === null ? null : (
      <span className={`gym-progress__trend gym-progress__trend--${shown.trend}`}>{overall}</span>
    );
  const overallState = shown === null || shown.trend === null ? undefined : t(MUSCLE_STATE_KEYS[shown.trend]);
  const counted = t('gym.progress.groupsCounted', {
    count: shown?.rated.length ?? 0,
    total: MUSCLE_GROUPS.length,
  });
  const chosen = selected === null ? null : (analytics?.find((view) => view.id === selected) ?? null);

  return (
    <>
      {/* The strip above the body (contract §4): the trend, how many groups
          it rests on, and the group that rose most. Its place is held while
          the history loads; with nothing rated it is not shown at all. */}
      {rated && shown ? (
        <MuscleStrip shown={shown} onExplain={() => setOverallOpen(true)} />
      ) : history === null && loading ? (
        <div className="muscle-strip muscle-strip--pending" aria-hidden="true">
          <LoadingBlocks heights={[58]} />
        </div>
      ) : null}
      <MetricDetailSheet
        open={overallOpen}
        title={t('gym.progress.overall')}
        value={overallValue ?? t('gym.progress.noBaseline')}
        scale={overallState ? `${overallState} · ${counted}` : counted}
        onClose={() => setOverallOpen(false)}
      >
        <p>{t('gym.progress.explainTrend')}</p>
        <p>{t('gym.progress.explainGroups')}</p>
        <p>{t('gym.progress.explainMetric')}</p>
        <p>{t('gym.progress.ratingNote')}</p>
        <p className="metric-sheet__note">{t('gym.tombstone.boundary')}</p>
      </MetricDetailSheet>

      <MuscleModule
        muscles={shown?.muscles ?? null}
        analytics={analytics}
        views={views}
        // Ten untrained groups: a row of five states would explain colours
        // that are not there (contract §11, mock-up 1).
        legend={history !== null && !empty}
        notice={notice}
        pending={
          loading ? (
            <LoadingBlocks heights={[560]} />
          ) : failed && onRetry ? (
            // A load that failed says so and can be tried again (contract
            // §11) — in the rows' place; the body above it stays.
            <LoadFailure title={t('error.muscles.title')} onRetry={onRetry} />
          ) : null
        }
        selected={selected}
        /* The body selects; the rows keep their toggle. */
        onSelect={(muscle) => setSelected(muscle)}
        onToggle={(muscle) => setSelected((current) => (current === muscle ? null : muscle))}
      />

      {history !== null && !empty ? (
        <Section
          label={
            selected
              ? `${t('gym.progress.exercises')} · ${t(MUSCLE_LABEL_KEYS[selected])}`
              : t('gym.progress.exercises')
          }
        >
          <Card>
            {/* The chosen group has too little to compare: one sentence says
                how many exercise days there are and from when a trend
                appears (contract §7). */}
            {chosen && chosen.state === 'awaitingBaseline' ? (
              <p className="gym-progress__tooFew" role="status">
                {exerciseDaysText(chosen.exerciseDays, chosen.compared, { t, rangeDays })}
              </p>
            ) : null}
            {exercises.length === 0 ? (
              <EmptyState title={t('gym.progress.exercises')} body={t('gym.progress.noData')} />
            ) : (
              exercises.map((entry) => {
                // Words and colour from the one rule: an exercise's change
                // reads by the band its group reads by (contract §7).
                const words =
                  !entry.comparison || entry.comparison.kind === 'noBaseline'
                    ? null
                    : changeWords(percentChange(entry.comparison.ratio), t);
                const change = words?.text ?? null;
                const kind = words?.trend ?? 'noBaseline';
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
      ) : null}
    </>
  );
}
