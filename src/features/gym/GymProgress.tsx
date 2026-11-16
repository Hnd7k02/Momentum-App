import { useCallback, useMemo, useRef, useState } from 'react';
import { MUSCLE_GROUPS, type MuscleGroup } from '../../core/model';
import { Button, LoadFailure, LoadingBlocks, Sheet } from '../../components';
import './gymHub.css';
import { MetricDetailSheet } from '../../components/metrics';
import { PlusIcon } from '../../components/Icons';
import { MUSCLE_LABEL_KEYS, type MuscleView } from '../../components/BodyRenderer';
import { addDays, type DateKey } from '../../core/dates';
import type { ExerciseDayInput } from '../../core/gym/performance';
import { useI18n, useT } from '../../i18n/I18nProvider';
import { useBackLayer } from '../../app/backLayer';
import { useToday } from '../../app/useToday';
import { exerciseHistory, type GymHistory } from '../../storage/services/gymService';
import { ExerciseDetail } from './ExerciseDetail';
import { useExerciseNamer } from './exerciseNames';
import { MuscleModule } from './MuscleModule';
import { MuscleDot } from './MuscleRows';
import { MuscleSheet } from './MuscleSheet';
import { MuscleStrip } from './MuscleStrip';
import { toMuscleAnalytics } from './muscleAnalytics';
import { MUSCLE_STATE_KEYS } from '../../components/BodyRenderer';
import { changeWords } from './changeWords';
import { muscleGap, muscleGapText } from './muscleGap';
import { exerciseChanges, toMuscleSheet } from './muscleSheet';
import { NOTHING_SHOWN, shownChangeText, shownPerformance } from './muscleState';
import './gym.css';

/**
 * Muskelgruppen, below its range: the metrics strip, the body on its stage,
 * the ten rows — and the sheet of a group (block 7C, contract §9).
 *
 * ```
 *   Gym overall → muscle groups → the group's sheet → an exercise → best set per day
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
 *
 * **A tap opens the group's sheet** — on a muscle of the body or on a row.
 * The selection *is* the open sheet: there is one group chosen while its
 * sheet stands and none once it has gone, and the body, the row and the
 * sheet read the one `shownPerformance()`. Nothing stands under the ten rows
 * any more but the way to the hub: the exercises of a group are in its
 * sheet, each with the figure that enters the group's.
 *
 * **Back walks step by step** (`backLayer.ts`): from an exercise to the
 * sheet it was opened from, from the sheet to this screen — by the button
 * and by the browser's Back alike, and the address never changes. The
 * exercise detail lies on top of this screen instead of replacing it, so
 * the body beneath is never taken down and stays exactly as it stood.
 */

export function GymProgress({
  history,
  sets,
  lastTrained,
  rangeDays,
  onRange,
  latestSession,
  loading = false,
  failed = false,
  onRetry,
  onStartTraining,
}: {
  /** The range's history; `null` while it loads and when the load failed. */
  history: GymHistory | null;
  /** The range's exercise-days with all of their sets, for the work volume (D152); `null` with `history`. */
  sets: readonly ExerciseDayInput[] | null;
  /** Each group's latest day before the range; `null` where it was not read. */
  lastTrained: Partial<Record<MuscleGroup, DateKey>> | null;
  /** The range the history was loaded for: what "in den letzten N Tagen" means. */
  rangeDays: number;
  /** Changes the screen's range — from the sheet, which shows the same one. */
  onRange(days: number): void;
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

  /** The group whose sheet stood last: where focus returns, and what a leaving sheet still shows. */
  const opened = useRef<MuscleGroup | null>(null);
  if (selected !== null) opened.current = selected;

  // Back closes what lies on top, one layer at a time: the exercise, then
  // the sheet — and never leaves the screen for either (`backLayer.ts`).
  useBackLayer(selected !== null, () => setSelected(null));
  useBackLayer(openExercise !== null, () => setOpenExercise(null));

  /** The row of a group: where the sheet came from, whichever way it was opened. */
  const rowOf = useCallback(
    (muscle: MuscleGroup | null): HTMLElement | null =>
      muscle === null ? null : document.querySelector<HTMLElement>(`.muscle-row__button[data-muscle="${muscle}"]`),
    [],
  );

  /**
   * The open group as its sheet shows it — from the very values the row and
   * the body read. The sheet computes nothing of its own.
   */
  const sheet = useMemo(
    () =>
      selected === null || !history || !shown || !sets
        ? null
        : toMuscleSheet({
            muscle: selected,
            history,
            shown,
            sets,
            from: addDays(today, -(rangeDays - 1)),
            to: today,
            lastTrained,
          }),
    [selected, history, shown, sets, today, rangeDays, lastTrained],
  );

  /** One figure for one exercise, here and in the sheet (D176). */
  const changes = useMemo(() => (history ? exerciseChanges(history) : null), [history]);
  const exerciseName = useCallback(
    (id: string) => namer.name(id, history?.names.get(id) ?? id),
    [namer, history],
  );

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
  /** A group can be opened once there is something to open: its figures. */
  const open = (muscle: MuscleGroup) => {
    if (history !== null) setSelected(muscle);
  };
  const sheetGroup = selected ?? opened.current;
  const sheetView = sheetGroup === null ? null : (analytics?.find((view) => view.id === sheetGroup) ?? null);

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
        /* A tap on a muscle and a tap on a row both open the group's sheet
           (contract §9). The body's own tap never turns it; a row's does,
           when the group faces away. */
        onSelect={open}
        onOpen={open}
      />

      {/*
        The group's sheet. Its title is the group's name with the group's
        dot; it stands over the body — solid, with a clear scrim, so the
        window above it shows the body — at two heights, and is out of the
        way while an exercise lies on top of it.
      */}
      <Sheet
        open={selected !== null}
        title={sheetGroup === null ? '' : t(MUSCLE_LABEL_KEYS[sheetGroup])}
        lead={
          sheetGroup === null ? undefined : (
            <MuscleDot id={sheetGroup} untrained={sheetView?.dataState === 'no-history'} />
          )
        }
        onClose={() => setSelected(null)}
        returnFocus={() => rowOf(opened.current)}
        detents
        overBody
        suspended={openExercise !== null}
      >
        {sheet ? (
          <MuscleSheet
            view={sheet}
            rangeDays={rangeDays}
            onRange={onRange}
            exerciseName={exerciseName}
            onOpenExercise={setOpenExercise}
            onStartTraining={onStartTraining}
          />
        ) : null}
      </Sheet>

      {/* One exercise, on top of the screen and of the sheet it was opened
          from. Back — its button, and the browser's — leads to the sheet. */}
      {openExercise !== null && history ? (
        <ExerciseDetail
          name={exerciseName(openExercise)}
          days={exerciseHistory(history, openExercise)}
          change={changes?.get(openExercise) ?? null}
          comparison={history?.metric?.comparison ?? 'firstLast'}
          rangeDays={rangeDays}
          onClose={() => setOpenExercise(null)}
        />
      ) : null}
    </>
  );
}
