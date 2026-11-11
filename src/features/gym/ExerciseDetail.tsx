import { MUSCLE_LABEL_KEYS } from '../../components/BodyRenderer';
import { Card, EmptyState, Figure, Section } from '../../components';
import { ChevronLeftIcon, ProgressIcon } from '../../components/Icons';
import { percentChange, type ExerciseComparison, type ExerciseDay } from '../../core/gym/performance';
import { formatDayAndMonth, formatWeekday } from '../../i18n/format';
import { useI18n, useT } from '../../i18n/I18nProvider';
import { useWeights } from '../../app/useWeights';
import { changeWords } from './changeWords';
import './gym.css';
import { useWorld } from '../../app/world';

/**
 * One exercise, over time.
 *
 * The series is the **exercise-day metric** — the best set of each training
 * day — and not every raw set. Plotting every set would draw the shape of a
 * session's warm-up ramp rather than the shape of progress, and the warm-up
 * is the part that is supposed to be easy. The sets of each day are
 * underneath, where they answer "how did I get there".
 */

/**
 * A bar's height in percent of the plot: the day's score over the largest
 * day's, **from zero** (STOP 6b; contract §6).
 *
 * A scale from the smallest day to the largest made a fall of a tenth look
 * like a collapse, which is the very thing the shared scale of the muscle
 * rows was introduced to end (D160): a small change must look small. So a
 * day at 90 % of the best day is a bar at 90 % of the height. The floor of
 * 8 % only keeps a very small day a visible bar; it is the floor these bars
 * had before Stage 6b.
 */
export function barHeight(score: number, peak: number): number {
  return peak > 0 ? Math.max(BAR_FLOOR, (score / peak) * 100) : BAR_FLOOR;
}
const BAR_FLOOR = 8;
/**
 * From this many training days the bars stand closer together, so that a
 * season of one exercise still fits a 320px phone with its latest bar — the
 * one that carries the state — in view.
 */
const DENSE_FROM = 24;

export function ExerciseDetail({
  name,
  days,
  comparison,
  onClose,
}: {
  name: string;
  /** Newest first. */
  days: ExerciseDay[];
  comparison: ExerciseComparison | undefined;
  onClose(): void;
}) {
  const t = useT();
  // The exercise detail is a Gym screen (WP3 Stage 6).
  useWorld('gym');
  const { language } = useI18n();
  const weights = useWeights();
  /** The day's score, rendered as the set that produced it, in the user's unit. */
  const scoreText = (day: ExerciseDay): string =>
    t('gym.bestSetValue', {
      reps: day.best.set.reps,
      weight: weights.format(day.best.set.weightGrams),
      unit: weights.unitLabel,
    });

  /** The same text, with its unit set smaller and secondary (contract §3). */
  const score = (day: ExerciseDay) => <Figure text={scoreText(day)} unit={weights.unitLabel} />;

  const latest = days[0] ?? null;
  const change = percentChange(comparison?.ratio ?? null);
  // Words and colour from the one rule (`muscleState.ts`): an exercise's
  // change reads by the same rounding and the same band as its group's, so
  // the list and the group never contradict each other. The group's rule on
  // how much there must be to compare does not apply to one exercise.
  const words = !comparison || comparison.kind === 'noBaseline' ? null : changeWords(change, t);
  const shown = words?.trend ?? null;
  const oldest = days[days.length - 1] ?? null;
  /*
   * The chart's scale runs from zero to the largest day (contract §6), and
   * the largest is named beside its line as the set that produced it — the
   * way this screen prints a day's value everywhere else.
   */
  const largest = days.reduce<ExerciseDay | null>(
    (top, day) => (top === null || day.best.score > top.best.score ? day : top),
    null,
  );
  const peak = largest?.best.score ?? 0;

  return (
    <div className="screen gym-detail">
      <header className="screen__header gym-session__header">
        <button
          type="button"
          className="button button--quiet gym-session__back"
          onClick={onClose}
          aria-label={t('common.back')}
        >
          <ChevronLeftIcon />
        </button>
        <div>
          <h1 className="screen__title gym-detail__title">{name}</h1>
          {latest ? (
            <p className="gym-session__date">
              {latest.muscles.map((muscle) => t(MUSCLE_LABEL_KEYS[muscle])).join(' · ')}
            </p>
          ) : null}
        </div>
      </header>

      <div className="gym-session__scroll">
        {days.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ProgressIcon size={26} />}
              title={t('gym.detail.history')}
              body={t('gym.progress.noData')}
            />
          </Card>
        ) : (
          <>
            <Card>
              <div className="gym-detail__figures">
                <div className="gym-detail__figure">
                  <span className="gym-detail__label">{t('gym.detail.latest')}</span>
                  <span className="gym-detail__value">{latest ? score(latest) : '–'}</span>
                </div>
                <div className="gym-detail__figure gym-detail__figure--muted">
                  <span className="gym-detail__label">{t('gym.detail.previous')}</span>
                  <span className="gym-detail__value">
                    {days[1] ? score(days[1]) : t('gym.progress.noBaseline')}
                  </span>
                </div>
                <div className="gym-detail__figure">
                  <span className="gym-detail__label">{t('gym.detail.change')}</span>
                  {/* Text and colour from the one rounded figure (WP3, B6) and
                      the band (contract §7): +2 % is "Gehalten", in the text
                      colour; from +3 % the figure is green. */}
                  <span className={`gym-detail__value gym-detail__value--${shown ?? 'noBaseline'}`}>
                    {words?.text ?? t('gym.progress.noBaseline')}
                  </span>
                </div>
              </div>
              <p className="gym-detail__note">{t('gym.progress.explainMetric', { unit: weights.unitLabel })}</p>
            </Card>

            <Section label={t('gym.detail.history')}>
              <Card>
                {/*
                  The bars are decorative and the table below carries the same
                  numbers with their dates, exactly as the Wellbeing history
                  does. One picture, one semantic alternative.
                */}
                <div className="gym-detail__chart" aria-hidden="true">
                  <div className="gym-detail__axis">
                    <span className="gym-detail__axisMax">{largest ? score(largest) : null}</span>
                    <span className="gym-detail__axisZero">0</span>
                  </div>
                  <div className="gym-detail__plot">
                    <div
                      className={`gym-detail__bars ${days.length > DENSE_FROM ? 'gym-detail__bars--dense' : ''}`.trim()}
                    >
                      {[...days].reverse().map((day, index) => {
                        // The last bar — the latest day — carries the state
                        // of the change the figures above state; the bars
                        // before it are neutral.
                        const isLatest = index === days.length - 1;
                        return (
                          <span
                            key={day.date}
                            className={`gym-detail__bar ${
                              isLatest ? `gym-detail__bar--latest gym-detail__bar--${shown ?? 'noBaseline'}` : ''
                            }`.trim()}
                            style={{ height: `${barHeight(day.best.score, peak)}%` }}
                          />
                        );
                      })}
                    </div>
                    {oldest ? (
                      <div className="gym-detail__dates">
                        <span>{formatDayAndMonth(language, oldest.date)}</span>
                        {days.length > 1 ? <span>{formatDayAndMonth(language, latest!.date)}</span> : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="visually-hidden">
                  <table>
                    <caption>{t('gym.detail.tableCaption')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('gym.detail.day')}</th>
                        <th scope="col">{t('gym.detail.value')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((day) => (
                        <tr key={day.date}>
                          <th scope="row">{formatDayAndMonth(language, day.date)}</th>
                          <td>{scoreText(day)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </Section>

            {/* The heading says what the list is: the last days, each with
                its best set — not the sets of one day. */}
            <Section label={t('gym.detail.recentDays')}>
              <Card>
                {days.slice(0, 8).map((day) => (
                  <div key={day.date} className="gym-detail__row">
                    <span className="gym-detail__rowDay">
                      {formatWeekday(language, day.date)} ·{' '}
                      {formatDayAndMonth(language, day.date)}
                    </span>
                    <span className="gym-detail__rowValue">{score(day)}</span>
                  </div>
                ))}
              </Card>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
