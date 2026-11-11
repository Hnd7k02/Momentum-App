import { useId, useMemo } from 'react';
import { STATUS_LABEL_KEYS, scaleBandOf } from '../../core/scoring/scale';
import type { DateKey } from '../../core/dates';
import { Button, Card, EmptyState, Section } from '../../components';
import { ChevronLeftIcon, ProgressIcon } from '../../components/Icons';
import { CATEGORY_LABEL_KEYS } from '../../domains/mental/questionLibrary';
import { formatDayAndMonth, formatWeekday } from '../../i18n/format';
import { percentText } from '../../i18n/typography';
import { useI18n, useT } from '../../i18n/I18nProvider';
import type { HistoryQuestionRow } from '../../storage/services/historyService';
import './questionDetail.css';

/**
 * One question, on its own.
 *
 * Tapping a question in Verlauf asks "how has *this* been going", and the
 * answer is a different screen from Today: Today is for acting, and sending
 * someone here to look at a trend and landing them on a check-in answers a
 * question they did not ask. Answering today is offered as a secondary
 * action, and only while the question is actually being asked.
 *
 * The values are the answers themselves — 1 to 10, or yes and no — not the
 * percentages the history grid works in. A percentage is the right unit for
 * comparing a day against a week; it is the wrong one for reading back what
 * you said.
 */

interface Point {
  date: DateKey;
  /** Percentage, as history stores it. */
  percent: number;
}

export interface QuestionDetailProps {
  question: HistoryQuestionRow;
  days: DateKey[];
  onClose(): void;
  /** Absent when the question is not being asked today. */
  onAnswerToday?: (() => void) | undefined;
}

export function QuestionDetail({ question, days, onClose, onAnswerToday }: QuestionDetailProps) {
  const t = useT();
  const { language } = useI18n();
  const uid = useId();

  const points = useMemo<Point[]>(
    () =>
      question.scores
        .map((percent, index) => ({ date: days[index]!, percent }))
        .filter((point): point is Point => point.percent !== null),
    [question, days],
  );

  const isScale = question.type === 'scale';
  /** A scale answer is its percentage divided by ten, exactly. */
  const valueOf = (percent: number) => (isScale ? percent / 10 : percent === 100);

  const readValue = (percent: number): string => {
    if (!isScale) return percent === 100 ? t('answer.yes') : t('answer.no');
    const value = percent / 10;
    return t('answer.scaleValue', {
      value,
      band: t(STATUS_LABEL_KEYS[scaleBandOf(value)]),
    });
  };

  const average =
    points.length === 0
      ? null
      : points.reduce((sum, point) => sum + point.percent, 0) / points.length;
  const latest = points[points.length - 1] ?? null;

  const chartId = `${uid}-chart`;

  return (
    <div className="screen question-detail">
      <header className="screen__header question-detail__header">
        <button
          type="button"
          className="button button--quiet question-detail__back"
          onClick={onClose}
          aria-label={t('common.back')}
        >
          <ChevronLeftIcon />
        </button>
        <div>
          <p className="question-detail__category">{t(CATEGORY_LABEL_KEYS[question.category])}</p>
          <h1 className="screen__title question-detail__title">{question.text}</h1>
        </div>
      </header>

      <div className="question-detail__scroll">
        {question.status !== 'active' ? (
          <p className="question-detail__status" role="status">
            {question.status === 'paused' ? t('questionDetail.paused') : t('questionDetail.archived')}
          </p>
        ) : null}

        {points.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ProgressIcon size={26} />}
              title={t('questionDetail.history')}
              body={t('questionDetail.noData')}
            />
          </Card>
        ) : (
          <>
            <Card>
              <div className="question-detail__figures">
                <div className="question-detail__figure">
                  <span className="question-detail__figureLabel">{t('questionDetail.current')}</span>
                  <span
                    className={
                      isScale && latest
                        ? `question-detail__figureValue question-detail__figureValue--${scaleBandOf(latest.percent / 10)}`
                        : 'question-detail__figureValue'
                    }
                  >
                    {latest === null
                      ? t('score.none')
                      : isScale
                        ? String(latest.percent / 10)
                        : latest.percent === 100
                          ? t('answer.yes')
                          : t('answer.no')}
                  </span>
                </div>
                <div className="question-detail__figure question-detail__figure--muted">
                  <span className="question-detail__figureLabel">{t('questionDetail.average')}</span>
                  <span className="question-detail__figureValue">
                    {average === null
                      ? t('score.none')
                      : isScale
                        ? (Math.round(average) / 10).toFixed(1)
                        : percentText(Math.round(average))}
                  </span>
                </div>
              </div>
              <p className="question-detail__meta">
                {t('questionDetail.answered', {
                  recorded: points.length,
                  total: days.length,
                })}
                {' · '}
                {t('questionDetail.range', { count: days.length })}
              </p>
            </Card>

            <Section label={t('questionDetail.history')} labelHidden>
              <Card>
                {/*
                  The bars are decorative, exactly as on the history grid: the
                  value is the height, and the dates the chart cannot carry
                  live in the table below. One picture, one semantic
                  alternative, nothing announced twice.
                */}
                <div className="question-detail__chart" aria-hidden="true">
                  {question.scores.map((percent, index) => (
                    <span key={index} className="question-detail__cell">
                      {percent === null ? (
                        <span className="question-detail__empty" />
                      ) : (
                        <span
                          className={
                            isScale
                              ? `question-detail__bar question-detail__bar--${scaleBandOf(percent / 10)}`
                              : `question-detail__bar question-detail__bar--${percent === 100 ? 'strong' : 'weak'}`
                          }
                          style={{ height: `${Math.max(8, percent)}%` }}
                        />
                      )}
                    </span>
                  ))}
                </div>

                <p className="visually-hidden" id={chartId}>
                  {t('questionDetail.chartLabel', {
                    from: points[0] ? readValue(points[0].percent) : t('score.none'),
                    to: latest ? readValue(latest.percent) : t('score.none'),
                    recorded: points.length,
                    total: days.length,
                    average:
                      average === null
                        ? t('score.none')
                        : isScale
                          ? (Math.round(average) / 10).toFixed(1)
                          : percentText(Math.round(average)),
                  })}
                </p>

                <div className="visually-hidden">
                  <table>
                    <caption>{t('questionDetail.tableCaption', { count: days.length })}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('questionDetail.day')}</th>
                        <th scope="col">{t('questionDetail.value')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((day, index) => {
                        const percent = question.scores[index] ?? null;
                        return (
                          <tr key={day}>
                            <th scope="row">{formatDayAndMonth(language, day)}</th>
                            <td>{percent === null ? t('score.none') : readValue(percent)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </Section>

            <Section label={t('questionDetail.history')}>
              <Card>
                {/* Newest first: the recent days are the ones anyone opens
                    this screen to look at. */}
                {[...points].reverse().slice(0, 14).map((point) => (
                  <div key={point.date} className="question-detail__row">
                    <span className="question-detail__rowDay">
                      {formatWeekday(language, point.date)} · {formatDayAndMonth(language, point.date)}
                    </span>
                    <span
                      className={
                        isScale
                          ? `question-detail__rowValue question-detail__rowValue--${scaleBandOf(point.percent / 10)}`
                          : 'question-detail__rowValue'
                      }
                    >
                      {isScale
                        ? String(valueOf(point.percent))
                        : point.percent === 100
                          ? t('answer.yes')
                          : t('answer.no')}
                    </span>
                  </div>
                ))}
              </Card>
            </Section>
          </>
        )}

        {onAnswerToday ? (
          <div className="question-detail__action">
            <Button variant="secondary" block onClick={onAnswerToday}>
              {t('questionDetail.answerToday')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
