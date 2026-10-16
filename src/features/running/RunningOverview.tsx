import { useState } from 'react';
import { RATING, TRAINING_RATING } from '../../core/config/constants';
import { bandRange } from '../../core/running/performance';
import { Card, Section } from '../../components';
import { MetricBoard, MetricDetailSheet, MetricTile } from '../../components/metrics';
import { useT } from '../../i18n/I18nProvider';
import type { RunningRatingState } from '../../storage/services/runningRatingService';
import './running.css';

/**
 * The top of Running, in the same order Gym uses.
 *
 * ```
 *   1  Running rating     the headline — the hero tile
 *   2  Pace year to date  the secondary headline — full width
 *   3  Attendance         the explanatory metric — compact beside the
 *                         Endurance Phase while that is still in force
 *   4  distance ranges    below, as rows
 * ```
 *
 * The two halves of the rating stay separately inspectable, because they can
 * disagree: a runner who turns up faithfully through a plateau should be able
 * to see *which* half moved. And as on Gym, a tile states and a sheet
 * explains — the methodology copy lives in the sheet, once.
 *
 * **No grid mechanics reach this screen.** Band indices, the anchor and the
 * logarithm are model internals; what a user is told is that runs of a
 * similar distance are compared with each other, which is the part that
 * affects what they do. Every figure arrives already computed.
 */

const changeText = (change: number | null, t: ReturnType<typeof useT>): string => {
  if (change === null) return t('running.performance.none');
  const rounded = Math.round(change);
  if (rounded === 0) return t('gym.change.unchanged');
  return rounded > 0
    ? t('gym.change.improved', { percent: rounded })
    : t('gym.change.declined', { percent: rounded });
};

type Detail = 'rating' | 'ytd' | 'attendance' | 'endurance' | 'decay';

export function RunningOverview({
  state,
  started,
  enabled = true,
}: {
  state: RunningRatingState;
  started: boolean;
  /** Switched on today; a switched-off domain has no weekly target either. */
  enabled?: boolean;
}) {
  const t = useT();
  const [detail, setDetail] = useState<Detail | null>(null);
  const close = () => setDetail(null);

  if (!started) {
    return (
      <Section label={t('running.rating.title')}>
        <Card>
          <p className="running-overview__empty">{t('running.rating.notStarted')}</p>
        </Card>
      </Section>
    );
  }

  // The rating on its own 0–1000 scale; Running has no rank of its own.
  const ratingValue = Math.round(state.rating);
  const attendancePercent =
    state.weeklyTarget > 0
      ? Math.min(100, (state.sessionsThisWeek / state.weeklyTarget) * 100)
      : 0;
  const ratingLabel = t('running.rating.value', { value: ratingValue });
  /*
   * A week with no ledger target is no data for the attendance half of the
   * rating — never "0 von 0". The minimum target is 1, so a zero target means
   * one of two things: the week the domain started in (D127), or a domain
   * that is switched off today.
   */
  const startWeek = state.weeklyTarget === 0;
  const noTargetLine = enabled ? t('running.attendance.startWeek') : t('running.attendance.off');
  const attendanceLabel = startWeek
    ? noTargetLine
    : t('running.attendance.value', {
        sessions: state.sessionsThisWeek,
        target: state.weeklyTarget,
      });
  const enduranceLabel = t('running.endurance.progress', {
    progress: state.endurance.progress.toFixed(1),
    required: state.endurance.required,
  });
  const locked = !state.endurance.unlocked;
  const onBreak =
    state.abstinence !== null &&
    state.abstinence.days >= TRAINING_RATING.ABSTINENCE_BLOCK_DAYS;
  const ytdText = changeText(state.ytdChange, t);
  const counted = t('running.performance.counted', { count: state.ytd?.measured.length ?? 0 });
  // A charge waiting for its day to close is said, as on the Gym tile (D135).
  const pending = state.decayPending ?? null;
  const lostPercent = Math.round(state.decayFraction * 100);
  const decayLine = pending
    ? lostPercent > 0
      ? t('running.decay.lostPending', { percent: lostPercent })
      : t(pending.day === 'today' ? 'running.decay.pendingToday' : 'running.decay.pendingYesterday')
    : t('running.decay.lost', { percent: lostPercent });
  // While a charge waits the tile stays, even once a session today has ended
  // the run: yesterday's charge still lands unless yesterday is filled in.
  const showBreak = onBreak || pending !== null;
  const breakDays = state.abstinence?.days ?? pending?.days ?? 0;
  // A session today ended the run; what waits is yesterday's charge alone.
  const runEnded = state.abstinence === null && pending !== null;

  const ratingBar = {
    percent: Math.round((ratingValue / RATING.MAX) * 100),
    label: ratingLabel,
    tone: 'running' as const,
  };
  const attendanceBar = {
    percent: attendancePercent,
    label: attendanceLabel,
    tone: 'running' as const,
  };
  const enduranceBar = {
    percent: (state.endurance.progress / state.endurance.required) * 100,
    label: enduranceLabel,
    tone: 'running' as const,
  };

  return (
    <>
      <MetricBoard>
        {/* 1 — the rating. */}
        <MetricTile
          id="running-rating"
          title={t('running.rating.title')}
          value={ratingLabel}
          bar={ratingBar}
          line={
            state.maintenance
              ? `${t('gym.maintenance.title')} · ${t('running.rating.summary')}`
              : t('running.rating.summary')
          }
          onOpen={() => setDetail('rating')}
        />

        {/* 2 — pace year to date. */}
        <MetricTile
          id="running-ytd"
          title={t('running.ytd.title')}
          value={
            state.ytdChange === null ? (
              <span className="metric-tile__state">{ytdText}</span>
            ) : (
              ytdText
            )
          }
          line={counted}
          onOpen={() => setDetail('ytd')}
        />

        {/* 3 — attendance, inspectable on its own. */}
        <MetricTile
          id="running-attendance"
          title={t('running.attendance.title')}
          value={startWeek ? '–' : state.sessionsThisWeek}
          scale={startWeek ? undefined : t('running.attendance.scale', { target: state.weeklyTarget })}
          bar={startWeek ? undefined : attendanceBar}
          line={startWeek ? noTargetLine : t('running.attendance.thisWeek')}
          span={locked ? 'half' : 'full'}
          onOpen={() => setDetail('attendance')}
        />

        {/* The Endurance Phase, while it is still running. */}
        {locked ? (
          <MetricTile
            id="running-endurance"
            title={t('running.endurance.title')}
            value={state.endurance.progress.toFixed(1)}
            scale={t('running.endurance.scale', { required: state.endurance.required })}
            bar={enduranceBar}
            line={
              <span className="metric-tile__line--strong">
                {t('running.endurance.locked')}
              </span>
            }
            span="half"
            onOpen={() => setDetail('endurance')}
          />
        ) : null}

        {/* Surfaced only while it is actually happening. */}
        {showBreak ? (
          <MetricTile
            id="running-decay"
            title={t('running.decay.title')}
            value={t(runEnded ? 'running.decay.daysEnded' : 'running.decay.days', { days: breakDays })}
            line={decayLine}
            onOpen={() => setDetail('decay')}
          />
        ) : null}
      </MetricBoard>

      <MetricDetailSheet
        open={detail === 'rating'}
        title={t('running.rating.title')}
        value={ratingLabel}
        bar={ratingBar}
        onClose={close}
      >
        <p>{t('running.rating.explain')}</p>
        {state.maintenance ? <p>{t('running.maintenance.body')}</p> : null}
      </MetricDetailSheet>

      <MetricDetailSheet
        open={detail === 'ytd'}
        title={t('running.ytd.title')}
        value={ytdText}
        scale={counted}
        onClose={close}
      >
        <p>{t('running.ytd.explain')}</p>
        <p>{t('running.performance.comparable')}</p>
        {state.performance.score === null ? (
          <p className="metric-sheet__note">{t('running.performance.needsSecond')}</p>
        ) : null}
        {state.attendanceOnlyRuns > 0 ? (
          <p className="metric-sheet__note">
            {t('running.performance.attendanceOnly', { count: state.attendanceOnlyRuns })}
          </p>
        ) : null}
      </MetricDetailSheet>

      <MetricDetailSheet
        open={detail === 'attendance'}
        title={t('running.attendance.title')}
        value={attendanceLabel}
        scale={t('running.attendance.thisWeek')}
        bar={startWeek ? undefined : attendanceBar}
        onClose={close}
      >
        <p>{t('running.attendance.explain')}</p>
      </MetricDetailSheet>

      <MetricDetailSheet
        open={detail === 'endurance'}
        title={t('running.endurance.title')}
        value={enduranceLabel}
        scale={t('running.endurance.locked')}
        bar={enduranceBar}
        onClose={close}
      >
        <p>{t('running.endurance.explain')}</p>
        <p>{t('running.endurance.stillCounts')}</p>
      </MetricDetailSheet>

      {showBreak ? (
        <MetricDetailSheet
          open={detail === 'decay'}
          title={t('running.decay.title')}
          value={t(runEnded ? 'running.decay.daysEnded' : 'running.decay.days', { days: breakDays })}
          scale={decayLine}
          onClose={close}
        >
          {pending ? <p>{t('running.decay.pendingExplain')}</p> : null}
          <p>{t('running.decay.explain')}</p>
          <p>{t('running.decay.floor')}</p>
          {runEnded ? null : <p>{t('running.decay.resume')}</p>}
        </MetricDetailSheet>
      ) : null}

      {/* 4 — the distance ranges, in the user's own units. */}
      {state.ytd && state.ytd.comparisons.length > 0 ? (
        <Section label={t('running.progress.distances')}>
          <Card rows>
            {state.ytd.comparisons.map((entry) => {
              const range = bandRange(entry.band);
              const change =
                entry.ratio === null ? null : changeText((entry.ratio - 1) * 100, t);
              return (
                <div key={entry.band} className="running-range">
                  <span className="running-range__body">
                    <span className="running-range__label">
                      {t('running.progress.range', {
                        from: (range.from / 1000).toFixed(1),
                        to: (range.toExclusive / 1000).toFixed(1),
                      })}
                    </span>
                    <span className="running-range__meta">
                      {t('running.progress.runs', { count: entry.dates })}
                    </span>
                  </span>
                  <span className="running-range__change">
                    {change ?? t('running.progress.noBaseline')}
                  </span>
                </div>
              );
            })}
          </Card>
        </Section>
      ) : null}
    </>
  );
}
