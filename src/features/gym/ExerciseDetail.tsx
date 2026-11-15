import { MUSCLE_LABEL_KEYS } from '../../components/BodyRenderer';
import { Card, EmptyState, Figure, Section } from '../../components';
import { ChevronLeftIcon, ProgressIcon } from '../../components/Icons';
import { percentChange, type ExerciseComparison, type ExerciseDay } from '../../core/gym/performance';
import { formatDayAndMonth, formatWeekday } from '../../i18n/format';
import { useI18n, useT } from '../../i18n/I18nProvider';
import { signedPercentText } from '../../i18n/typography';
import { useWeights } from '../../app/useWeights';
import { changeWords } from './changeWords';
import { ExerciseLineChart, lineValues } from './ExerciseLineChart';
import { roundShown } from './muscleState';
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
  /*
   * What the line draws, for the table that says the same in words: each
   * day's change since the first day shown, newest first like `days`. The
   * first day is what the others are measured against and has none.
   */
  const sinceFirst = lineValues(days).reverse();

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
              <p className="gym-detail__note">{t('gym.progress.explainMetric')}</p>
            </Card>

            <Section label={t('gym.detail.history')}>
              <Card>
                {/*
                  The line is decorative and the table below carries the
                  same days in words — each with its best working set and
                  its change since the first day shown, which is what the
                  line draws. One picture, one semantic alternative.
                */}
                <ExerciseLineChart days={days} />

                <div className="visually-hidden">
                  <table>
                    <caption>{t('gym.detail.tableCaption')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('gym.detail.day')}</th>
                        <th scope="col">{t('gym.detail.value')}</th>
                        <th scope="col">{t('gym.detail.sinceFirst')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((day, index) => (
                        <tr key={day.date}>
                          <th scope="row">{formatDayAndMonth(language, day.date)}</th>
                          <td>{scoreText(day)}</td>
                          <td>
                            {index === days.length - 1
                              ? t('gym.detail.firstDay')
                              : signedPercentText(roundShown(sinceFirst[index] ?? 0) ?? 0)}
                          </td>
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
