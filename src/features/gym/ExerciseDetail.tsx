import { MUSCLE_LABEL_KEYS } from '../../components/BodyRenderer';
import { Card, EmptyState, Section } from '../../components';
import { ChevronLeftIcon, ProgressIcon } from '../../components/Icons';
import { percentChange, type ExerciseComparison, type ExerciseDay } from '../../core/gym/performance';
import { formatDayAndMonth, formatWeekday } from '../../i18n/format';
import { useI18n, useT } from '../../i18n/I18nProvider';
import { useWeights } from '../../app/useWeights';
import { roundShown, shownTrend } from './muscleState';
import './gym.css';

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
  const { language } = useI18n();
  const weights = useWeights();
  /** The day's score, rendered as the set that produced it, in the user's unit. */
  const scoreText = (day: ExerciseDay): string =>
    t('gym.bestSetValue', {
      reps: day.best.set.reps,
      weight: weights.format(day.best.set.weightGrams),
      unit: weights.unitLabel,
    });

  const latest = days[0] ?? null;
  const change = percentChange(comparison?.ratio ?? null);
  const shown =
    !comparison || comparison.kind === 'noBaseline' ? null : shownTrend(comparison.ratio);
  const oldest = days[days.length - 1] ?? null;
  const peak = days.reduce((max, day) => Math.max(max, day.best.score), 0);

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
                  <span className="gym-detail__value">{latest ? scoreText(latest) : '–'}</span>
                </div>
                <div className="gym-detail__figure gym-detail__figure--muted">
                  <span className="gym-detail__label">{t('gym.detail.previous')}</span>
                  <span className="gym-detail__value">
                    {days[1] ? scoreText(days[1]) : t('gym.progress.noBaseline')}
                  </span>
                </div>
                <div className="gym-detail__figure">
                  <span className="gym-detail__label">{t('gym.detail.change')}</span>
                  {/* Text and colour from the one rounded figure (WP3, B6): a
                      +0.4 % change is "Gehalten", not a green "+0 %". */}
                  <span className={`gym-detail__value gym-detail__value--${shown ?? 'noBaseline'}`}>
                    {shown === null || change === null
                      ? t('gym.progress.noBaseline')
                      : shown === 'unchanged'
                        ? t('gym.change.unchanged')
                        : t(shown === 'improved' ? 'gym.change.improved' : 'gym.change.declined', {
                            percent: roundShown(change) ?? 0,
                          })}
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
                  {[...days].reverse().map((day) => (
                    <span key={day.date} className="gym-detail__cell">
                      <span
                        className="gym-detail__bar"
                        style={{
                          height: `${peak > 0 ? Math.max(8, (day.best.score / peak) * 100) : 8}%`,
                        }}
                      />
                    </span>
                  ))}
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

                {oldest ? (
                  <p className="gym-detail__note">
                    {formatDayAndMonth(language, oldest.date)} – {' '}
                    {formatDayAndMonth(language, latest!.date)}
                  </p>
                ) : null}
              </Card>
            </Section>

            <Section label={t('gym.detail.sets')}>
              <Card>
                {days.slice(0, 8).map((day) => (
                  <div key={day.date} className="gym-detail__row">
                    <span className="gym-detail__rowDay">
                      {formatWeekday(language, day.date)} ·{' '}
                      {formatDayAndMonth(language, day.date)}
                    </span>
                    <span className="gym-detail__rowValue">{scoreText(day)}</span>
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
