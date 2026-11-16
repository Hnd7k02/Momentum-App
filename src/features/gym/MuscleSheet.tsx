import { MUSCLE_TREND_RANGES } from '../../core/config/constants';
import type { DateKey } from '../../core/dates';
import type { BestSet } from '../../core/gym/performance';
import { Button, Figure, Segmented } from '../../components';
import { MUSCLE_LABEL_KEYS, MUSCLE_STATE_KEYS } from '../../components/BodyRenderer';
import { ChevronRightIcon, PlusIcon } from '../../components/Icons';
import { formatDayAndMonth, formatNumber, formatWeekdayShort } from '../../i18n/format';
import { useI18n, useT } from '../../i18n/I18nProvider';
import { useWeights } from '../../app/useWeights';
import { GRAMS_PER_POUND } from '../../core/gym/weight';
import { LinePlot } from './ExerciseLineChart';
import { exerciseDaysText } from './muscleGap';
import type { MuscleSheetView, SheetWeek } from './muscleSheet';
import { shownChangeText, shownTrendOfChange, type ShownTrend } from './muscleState';
import { SPARK_SCALE } from './Sparkline';
import './muscleSheet.css';

/**
 * The muscle sheet's content (block 7C, contract §9, mock-up 2): one group
 * in the range the screen shows, in the order the contract names — the
 * change with its state, what it is a change of, the range, the line, the
 * exercises with their best working set and their change, and the work
 * volume week by week.
 *
 * **It shows the row's number and computes none.** Everything arrives in
 * `view` (`muscleSheet.ts`); this file chooses words, sizes and places.
 *
 * Three states, kept apart as everywhere (contract §7, §11):
 *
 * - **A figure**: the line, the exercises, the volume.
 * - **Too little to compare**: no chart. A sentence says how many exercise
 *   days there are and from when a trend appears; "Erfasst" lists what was
 *   recorded — each day leading to its exercise, as a row of the exercises
 *   does; the volume follows.
 * - **Not trained in the range**: a sentence says what is missing and when
 *   the group was last trained, and the one action that supplies it.
 *
 * The range is the screen's own: changed here, it is changed everywhere.
 */

/** The plot's range: the rows' scale, on the side the line goes to (contract §6). */
export function sheetChartRange(values: readonly number[]): { low: number; high: number } {
  const low = values.some((value) => value < 0) ? -SPARK_SCALE : 0;
  const high = values.some((value) => value > 0) || low === 0 ? SPARK_SCALE : 0;
  return { low, high };
}

/** From how many weeks on the bars stand on an axis instead of each carrying its value. */
export const VOLUME_AXIS_FROM_WEEKS = 6;

export function MuscleSheet({
  view,
  rangeDays,
  onRange,
  exerciseName,
  onOpenExercise,
  onStartTraining,
}: {
  view: MuscleSheetView;
  rangeDays: number;
  onRange(days: number): void;
  /** An exercise's name as the app shows it. */
  exerciseName(id: string): string;
  onOpenExercise(id: string): void;
  /** Starts a workout from the sheet of a group that was not trained; absent, no button. */
  onStartTraining?: () => void;
}) {
  const t = useT();
  const { language } = useI18n();
  const weights = useWeights();
  const group = t(MUSCLE_LABEL_KEYS[view.muscle]);
  const change = shownChangeText(view.change);
  const rated = change !== null;

  const setText = (set: BestSet['set']): string =>
    t('gym.bestSetValue', { reps: set.reps, weight: weights.format(set.weightGrams), unit: weights.unitLabel });
  const dayText = (day: DateKey): string => `${formatWeekdayShort(language, day)}, ${formatDayAndMonth(language, day)}`;

  const range = (
    <Segmented<string>
      label={t('gym.progress.title')}
      value={String(rangeDays)}
      onChange={(next) => onRange(Number(next))}
      options={MUSCLE_TREND_RANGES.map((days) => ({ value: String(days), label: t('progress.rangeDays', { count: days }) }))}
    />
  );

  const values = view.trend.map((point) => point.value);
  const first = view.trend[0];
  const last = view.trend[view.trend.length - 1];
  const chartLabel =
    !rated || !first || !last
      ? undefined
      : view.trend.length === 1
        ? t('muscleSheet.chartOne', { group, date: formatDayAndMonth(language, first.date), value: change })
        : t('muscleSheet.chart', {
            group,
            first: formatDayAndMonth(language, first.date),
            last: formatDayAndMonth(language, last.date),
            count: view.trend.length,
            value: change,
          });

  const exercises = [...view.exercises]
    .map((exercise) => ({ ...exercise, name: exerciseName(exercise.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="muscle-sheet" data-muscle={view.muscle} data-state={view.state}>
      {/* The change and its state; or the state alone, where there is no figure. */}
      <div className="muscle-sheet__head">
        <div className="muscle-sheet__headline">
          {rated ? (
            <span className={`muscle-sheet__change muscle-sheet__change--${view.state}`}>{change}</span>
          ) : null}
          <span className={`state-chip state-chip--${view.state}`}>{t(MUSCLE_STATE_KEYS[view.state])}</span>
          {view.uneven ? <span className="state-chip state-chip--neutral">{t('muscleSheet.uneven')}</span> : null}
        </div>
        {rated ? (
          <p className="muscle-sheet__caption">{t('muscleSheet.caption', { days: rangeDays })}</p>
        ) : view.state === 'awaitingBaseline' ? (
          <p className="muscle-sheet__sentence" role="status">
            {exerciseDaysText(view.exerciseDays, view.compared, { t, rangeDays })}
          </p>
        ) : (
          <p className="muscle-sheet__sentence" role="status">
            {t('muscleSheet.untrained', { days: rangeDays })}{' '}
            {view.lastTrainedBefore
              ? t('muscleSheet.untrainedLast', { date: dayText(view.lastTrainedBefore) })
              : view.everTrained === false
                ? t('muscleSheet.untrainedNever')
                : null}
          </p>
        )}
      </div>

      {range}

      {/* No figure, no chart (contract §6): a line here would state the
          trend the chip says is not there. */}
      {rated && first ? (
        <LinePlot
          variant="sheet"
          values={values}
          range={sheetChartRange(values)}
          dates={last && last !== first ? [first.date, last.date] : [first.date]}
          endState={view.state as ShownTrend}
          endText={change}
          label={chartLabel}
        />
      ) : null}

      {rated && exercises.length > 0 ? (
        <section className="muscle-sheet__section" aria-label={t('gym.progress.exercises')}>
          <h3 className="muscle-sheet__label">{t('gym.progress.exercises')}</h3>
          {/* What the word beside the figure means, where it stands. */}
          {view.uneven ? <p className="muscle-sheet__note">{t('muscleSheet.unevenHint')}</p> : null}
          <ul className="muscle-sheet__list">
            {exercises.map((exercise) => {
              const figure = shownChangeText(exercise.change);
              const trend = shownTrendOfChange(exercise.change);
              return (
                <li key={exercise.id}>
                  <button
                    type="button"
                    className="muscle-sheet__exercise"
                    data-exercise={exercise.id}
                    onClick={() => onOpenExercise(exercise.id)}
                  >
                    <span className="muscle-sheet__exerciseText">
                      <span className="muscle-sheet__exerciseName">{exercise.name}</span>
                      <span className="muscle-sheet__exerciseSet">
                        {t('gym.detail.value')} <Figure text={setText(exercise.best.set)} unit={weights.unitLabel} />
                      </span>
                    </span>
                    {/* The exercise's change in the range — the one that
                        enters the group's figure (D176) — with its state
                        in words beneath, as in the ten rows. */}
                    {figure !== null && trend !== null ? (
                      <span className={`muscle-sheet__exerciseRight muscle-sheet__exerciseRight--${trend}`}>
                        <span className="muscle-sheet__exerciseChange">{figure}</span>
                        <span className="muscle-sheet__exerciseState">{t(MUSCLE_STATE_KEYS[trend])}</span>
                      </span>
                    ) : (
                      <span className="muscle-sheet__exerciseRight muscle-sheet__exerciseRight--none">
                        <span className="muscle-sheet__exerciseState">{t('muscle.exerciseDays.shortOne')}</span>
                      </span>
                    )}
                    <ChevronRightIcon size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {view.state === 'awaitingBaseline' && view.records.length > 0 ? (
        <section className="muscle-sheet__section" aria-label={t('muscleSheet.recorded')}>
          <h3 className="muscle-sheet__label">{t('muscleSheet.recorded')}</h3>
          <ul className="muscle-sheet__list">
            {view.records.map((record) => (
              <li key={`${record.exerciseId}-${record.date}`}>
                {/* A day of an exercise leads to that exercise, like a row
                    of the list it stands in for: its days are there. */}
                <button
                  type="button"
                  className="muscle-sheet__exercise muscle-sheet__exercise--record"
                  data-exercise={record.exerciseId}
                  onClick={() => onOpenExercise(record.exerciseId)}
                >
                  <span className="muscle-sheet__exerciseText">
                    <span className="muscle-sheet__exerciseName">{exerciseName(record.exerciseId)}</span>
                    <span className="muscle-sheet__exerciseSet">{dayText(record.date)}</span>
                  </span>
                  <span className="muscle-sheet__recordSet">
                    <Figure text={setText(record.set)} unit={weights.unitLabel} />
                  </span>
                  <ChevronRightIcon size={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view.state === 'noData' ? (
        onStartTraining ? (
          <Button variant="primary" block onClick={onStartTraining}>
            <PlusIcon size={18} />
            {t('gymHub.training.log')}
          </Button>
        ) : null
      ) : (
        <VolumeBars weeks={view.weeks} />
      )}
    </div>
  );
}

/**
 * Work volume per week (D152, contract §6): neutral bars from zero, shown
 * and never scored — so **no bar carries a state's colour, not even the
 * last**. A week without a working set of the group is a gap, never a bar
 * of no height with a nought above it.
 *
 * With few weeks each bar carries its value and its calendar week, as in
 * the mock-up. From six on — 90 days are twelve or thirteen — the values no
 * longer fit above the bars, and the bars stand on the contract's axis: the
 * nought and the largest value on the left, each on its line, the first and
 * the last week beneath. Either way the same weeks stand in words for a
 * screen reader.
 */
export function VolumeBars({ weeks }: { weeks: readonly SheetWeek[] }) {
  const t = useT();
  const { language } = useI18n();
  const weights = useWeights();
  /** Gram-reps as a whole number in the user's unit: "3'980". */
  const amount = (volume: number): string =>
    formatNumber(language, Math.round(volume / (weights.unit === 'lb' ? GRAMS_PER_POUND : 1000)));
  const largest = weeks.reduce((max, week) => Math.max(max, week.volume ?? 0), 0);
  const share = (volume: number): string => `${((volume / largest) * 100).toFixed(2)}%`;
  const axis = weeks.length >= VOLUME_AXIS_FROM_WEEKS;
  const firstWeek = weeks[0];
  const lastWeek = weeks[weeks.length - 1];

  return (
    <section className="muscle-sheet__section muscle-volume" aria-label={t('muscleSheet.volume')}>
      <div className="muscle-volume__head">
        <h3 className="muscle-sheet__label">{t('muscleSheet.volume')}</h3>
        <span className="muscle-volume__note">{t('muscleSheet.volumeNote')}</span>
      </div>

      {largest === 0 ? (
        <p className="muscle-sheet__sentence">{t('muscleSheet.volumeNone')}</p>
      ) : (
        <>
          {/* The picture; the list beneath says the same in words. */}
          {axis ? (
            <div className="muscle-volume__chart muscle-volume__chart--axis" aria-hidden="true">
              <div className="muscle-volume__axis">
                <span className="muscle-volume__axisLabel muscle-volume__axisLabel--top">
                  <Figure text={`${amount(largest)} ${weights.unitLabel}`} unit={weights.unitLabel} />
                </span>
                <span className="muscle-volume__axisLabel muscle-volume__axisLabel--zero">0</span>
              </div>
              <div className="muscle-volume__plotColumn">
                <div className="muscle-volume__plot">
                  <span className="muscle-volume__bound" />
                  {weeks.map((week) => (
                    <span key={week.week} className="muscle-volume__slot">
                      {week.volume !== null ? <span className="muscle-volume__bar" style={{ height: share(week.volume) }} /> : null}
                    </span>
                  ))}
                </div>
                {firstWeek && lastWeek ? (
                  <div className="muscle-volume__weeks">
                    <span>{t('muscleSheet.week', { week: firstWeek.number })}</span>
                    <span>{t('muscleSheet.week', { week: lastWeek.number })}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="muscle-volume__chart" aria-hidden="true">
              {weeks.map((week) => (
                <div key={week.week} className="muscle-volume__column">
                  <div className="muscle-volume__track">
                    {week.volume !== null ? (
                      <>
                        <span className="muscle-volume__value">
                          <Figure text={`${amount(week.volume)} ${weights.unitLabel}`} unit={weights.unitLabel} />
                        </span>
                        <span className="muscle-volume__bar" style={{ height: share(week.volume) }} />
                      </>
                    ) : null}
                  </div>
                  <span className="muscle-volume__week">{t('muscleSheet.week', { week: week.number })}</span>
                </div>
              ))}
            </div>
          )}
          <ul className="visually-hidden">
            {weeks.map((week) => (
              <li key={week.week}>
                {week.volume === null
                  ? t('muscleSheet.volumeGap', { week: week.number })
                  : t('muscleSheet.volumeWeek', { week: week.number, value: amount(week.volume), unit: weights.unitLabel })}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
