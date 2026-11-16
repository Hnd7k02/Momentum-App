import { useEffect, useRef } from 'react';
import { MUSCLE_LABEL_KEYS, MUSCLE_STATE_KEYS } from '../../components/BodyRenderer';
import { Card, EmptyState, Figure, Section } from '../../components';
import { ChevronLeftIcon, ProgressIcon } from '../../components/Icons';
import type { GymWindowComparison } from '../../core/model';
import type { ExerciseDay } from '../../core/gym/performance';
import { formatDayAndMonth, formatWeekday } from '../../i18n/format';
import { useI18n, useT } from '../../i18n/I18nProvider';
import { signedPercentText } from '../../i18n/typography';
import { useWeights } from '../../app/useWeights';
import { ExerciseLineChart, lineValues } from './ExerciseLineChart';
import { roundShown, shownChangeText, shownTrendOfChange } from './muscleState';
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
 *
 * **One exercise has one change** (D176, block 7C): its change in the range
 * the screen shows — the comparison its muscle groups' figures are formed
 * from (`exerciseChanges`), and the very number its row in the muscle sheet
 * carries. It stands at the head with its state and with what it is a
 * change of, in the words the sheet uses. Until this block the head named
 * the last day against the one before "Veränderung" and the line ended on a
 * third, unnamed figure, the last day against the first; "Zuletzt" and
 * "Davor" are now two sets and no percentage stands between them. Since
 * STOP 7C the line is that one change day by day, so it ends on the figure
 * at the head (`exerciseLine`), and one recorded day draws no chart but a
 * sentence (D170).
 *
 * It lies **on top of** Muskelgruppen rather than in its place: the body
 * beneath stays as it stood, held, and the sheet it was opened from is
 * there again when this goes. Focus comes here when it opens and returns to
 * where it was.
 */

export function ExerciseDetail({
  name,
  days,
  change,
  comparison = 'firstLast',
  rangeDays,
  onClose,
}: {
  name: string;
  /** Newest first. */
  days: ExerciseDay[];
  /** The exercise's change in the range, raw; `null` with nothing to compare. */
  change: number | null;
  /** The comparison the range's figures are under (`GymHistory.metric`); the line follows it. */
  comparison?: GymWindowComparison;
  /** The range the days were loaded for: what "letzte N Tage" means. */
  rangeDays: number;
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
  // Figure, word and colour from the one rule (`muscleState.ts`): an
  // exercise's change reads by the same rounding and the same band as its
  // group's. The group's rule on how much there must be to compare does not
  // apply to one exercise: two days are a change.
  const figure = shownChangeText(change);
  const trend = shownTrendOfChange(change);

  // A screen of its own, on top of the one it was opened from.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  /*
   * What the line draws, for the table that says the same in words: at each
   * day the exercise's change in the range up to that day, newest first
   * like `days`. The first day is what the others are measured against and
   * has none.
   */
  const upToDay = lineValues(days, comparison).reverse();

  return (
    <div className="screen gym-detail" ref={root} role="dialog" aria-modal="true" aria-label={name} tabIndex={-1}>
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
              {/* The exercise's one change (D176): figure, state and what it
                  is a change of — the sheet's own head, in the sheet's own
                  words. */}
              <div className="gym-detail__head">
                {figure !== null && trend !== null ? (
                  <>
                    <span className={`gym-detail__change gym-detail__change--${trend}`}>{figure}</span>
                    <span className={`state-chip state-chip--${trend}`}>{t(MUSCLE_STATE_KEYS[trend])}</span>
                  </>
                ) : (
                  <span className="state-chip state-chip--awaitingBaseline">{t('gym.progress.noBaseline')}</span>
                )}
              </div>
              <p className="gym-detail__caption">{t('muscleSheet.caption', { days: rangeDays })}</p>
              {/* Two sets, and no percentage between them. */}
              <div className="gym-detail__figures">
                <div className="gym-detail__figure">
                  <span className="gym-detail__label">{t('gym.detail.latest')}</span>
                  <span className="gym-detail__value">{latest ? score(latest) : '–'}</span>
                </div>
                <div className="gym-detail__figure gym-detail__figure--muted">
                  <span className="gym-detail__label">{t('gym.detail.previous')}</span>
                  <span className="gym-detail__value">{days[1] ? score(days[1]) : '–'}</span>
                </div>
              </div>
              <p className="gym-detail__note">{t('gym.progress.explainMetric')}</p>
            </Card>

            <Section label={t('gym.detail.history')}>
              <Card>
                {/*
                  The line is decorative and the table below carries the
                  same days in words — each with its best working set and
                  the change in the range up to it, which is what the line
                  draws. One picture, one semantic alternative. One day
                  draws no chart (D170): a sentence says the line begins
                  with the second.
                */}
                {days.length > 1 ? (
                  <>
                    <ExerciseLineChart days={days} comparison={comparison} state={trend} />
                    {/* What the line draws — and that it ends on the figure above. */}
                    <p className="gym-detail__lineNote">{t('gym.detail.lineNote')}</p>
                  </>
                ) : (
                  <p className="gym-detail__lineNote gym-detail__lineNote--one">{t('gym.detail.oneDay')}</p>
                )}

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
                              : signedPercentText(roundShown(upToDay[index] ?? 0) ?? 0)}
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
