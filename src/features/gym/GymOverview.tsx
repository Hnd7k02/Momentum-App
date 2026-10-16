import { useState } from 'react';
import { RATING, TRAINING_RATING } from '../../core/config/constants';
import { Card, Section } from '../../components';
import { MetricBoard, MetricDetailSheet, MetricTile } from '../../components/metrics';
import { useT } from '../../i18n/I18nProvider';
import type { GymRatingState } from '../../storage/services/gymRatingService';
import './gym.css';

/**
 * The top of Gym, in the order the product asks for.
 *
 * ```
 *   1  Gym rating          the headline — the hero tile
 *   2  Performance YTD     the secondary headline — full width
 *   3  Attendance          the explanatory metric — compact, beside the
 *                          Endurance Phase while that is still in force
 *   4  everything else     further down, in Progress
 * ```
 *
 * Two rules shape it beyond the ordering.
 *
 * **Attendance and performance stay separately inspectable.** They are the
 * two halves of the rating, they can disagree, and a user who trains
 * faithfully through a plateau should be able to see *which* half moved
 * rather than being handed one number and left to guess.
 *
 * **A tile states; a sheet explains.** The overview is a dashboard. Each
 * tile carries its title, its value, its bar and at most one line; the
 * methodology behind it — how the 40/60 is made, what a missed Endurance
 * week costs, why extra sessions buy nothing — lives in the sheet the tile
 * opens, once, and nowhere else on this screen.
 *
 * **This component computes nothing.** Every figure arrives from
 * `storage/services/gymRatingService`, which arrives from `core/gym/*`. A
 * number here and a number on the Progress screen cannot disagree, because
 * there is only one place either of them could have come from.
 */

/** A percentage change, spoken. `null` becomes the "no baseline" phrase. */
function changeText(
  change: number | null,
  t: ReturnType<typeof useT>,
): string {
  if (change === null) return t('gym.performance.none');
  const rounded = Math.round(change);
  if (rounded === 0) return t('gym.change.unchanged');
  return rounded > 0
    ? t('gym.change.improved', { percent: rounded })
    : t('gym.change.declined', { percent: rounded });
}

type Detail = 'rating' | 'ytd' | 'attendance' | 'endurance' | 'decay';

export function GymOverview({
  state,
  started,
  enabled = true,
}: {
  state: GymRatingState;
  /** False until a session has actually been logged. */
  started: boolean;
  /** Switched on today; a switched-off domain has no weekly target either. */
  enabled?: boolean;
}) {
  const t = useT();
  const [detail, setDetail] = useState<Detail | null>(null);
  const close = () => setDetail(null);

  if (!started) {
    return (
      <Section label={t('gym.rating.title')}>
        <Card>
          <p className="gym-overview__empty">{t('gym.rating.notStarted')}</p>
        </Card>
      </Section>
    );
  }

  // The rating on its own 0–1000 scale. Gym has no rank of its own to
  // measure against; the Boss is the only rank.
  const ratingValue = Math.round(state.rating);
  const attendancePercent =
    state.weeklyTarget > 0
      ? Math.min(100, (state.sessionsThisWeek / state.weeklyTarget) * 100)
      : 0;
  const ratingLabel = t('gym.rating.value', { value: ratingValue });
  /*
   * A week with no ledger target is no data for the attendance half of the
   * rating — never "0 von 0". The minimum target is 1, so a zero target means
   * one of two things: the week the domain started in (D127), or a domain
   * that is switched off today.
   */
  const startWeek = state.weeklyTarget === 0;
  const noTargetLine = enabled ? t('gym.attendance.startWeek') : t('gym.attendance.off');
  const attendanceLabel = startWeek
    ? noTargetLine
    : t('gym.attendance.value', {
        sessions: state.sessionsThisWeek,
        target: state.weeklyTarget,
      });
  const enduranceLabel = t('gym.endurance.progress', {
    progress: state.endurance.progress.toFixed(1),
    required: state.endurance.required,
  });
  const locked = !state.endurance.unlocked;
  const onBreak =
    state.abstinence !== null &&
    state.abstinence.days >= TRAINING_RATING.ABSTINENCE_BLOCK_DAYS;
  const ytdText = changeText(state.ytdChange, t);
  /*
   * A charge that waits for its day to close (D135) is said, not hidden: the
   * days counter has passed a block, and the tile would otherwise read as if
   * nothing were coming.
   */
  const lostPercent = Math.round(state.decayFraction * 100);
  const decayLine = state.decayPending
    ? lostPercent > 0
      ? t('gym.decay.lostPending', { percent: lostPercent })
      : t('gym.decay.pending')
    : t('gym.decay.lost', { percent: lostPercent });

  const ratingBar = {
    percent: Math.round((ratingValue / RATING.MAX) * 100),
    label: ratingLabel,
    tone: 'gym' as const,
  };
  const attendanceBar = { percent: attendancePercent, label: attendanceLabel, tone: 'gym' as const };
  const enduranceBar = {
    percent: (state.endurance.progress / state.endurance.required) * 100,
    label: enduranceLabel,
    tone: 'gym' as const,
  };

  return (
    <>
      <MetricBoard>
        {/* 1 — the rating itself. */}
        <MetricTile
          id="gym-rating"
          title={t('gym.rating.title')}
          value={ratingLabel}
          bar={ratingBar}
          line={
            state.maintenance
              ? `${t('gym.maintenance.title')} · ${t('gym.rating.summary')}`
              : t('gym.rating.summary')
          }
          onOpen={() => setDetail('rating')}
        />

        {/* 2 — performance year to date, the visible secondary headline. */}
        <MetricTile
          id="gym-ytd"
          title={t('gym.ytd.title')}
          value={
            state.ytdChange === null ? (
              <span className="metric-tile__state">{ytdText}</span>
            ) : (
              ytdText
            )
          }
          line={t('gym.progress.groupsCounted', {
            count: state.ytd?.measured.length ?? 0,
            total: 10,
          })}
          onOpen={() => setDetail('ytd')}
        />

        {/*
          3 — attendance, inspectable on its own. Compact while the Endurance
          Phase sits beside it; the full width once that tile is gone, because
          one half tile next to nothing is a hole, not a board.
        */}
        <MetricTile
          id="gym-attendance"
          title={t('gym.attendance.title')}
          value={startWeek ? '–' : state.sessionsThisWeek}
          scale={startWeek ? undefined : t('gym.attendance.scale', { target: state.weeklyTarget })}
          bar={startWeek ? undefined : attendanceBar}
          line={startWeek ? noTargetLine : t('gym.attendance.thisWeek')}
          span={locked ? 'half' : 'full'}
          onOpen={() => setDetail('attendance')}
        />

        {/* The Endurance Phase, while it is still running. Never mislabelled as
            performance: it is attendance over weeks. */}
        {locked ? (
          <MetricTile
            id="gym-endurance"
            title={t('gym.endurance.title')}
            value={state.endurance.progress.toFixed(1)}
            scale={t('gym.endurance.scale', { required: state.endurance.required })}
            bar={enduranceBar}
            line={
              <span className="metric-tile__line--strong">{t('gym.endurance.locked')}</span>
            }
            span="half"
            onOpen={() => setDetail('endurance')}
          />
        ) : null}

        {/* Surfaced only while it is actually happening. */}
        {onBreak && state.abstinence ? (
          <MetricTile
            id="gym-decay"
            title={t('gym.decay.title')}
            value={t('gym.decay.days', { days: state.abstinence.days })}
            line={decayLine}
            onOpen={() => setDetail('decay')}
          />
        ) : null}
      </MetricBoard>

      <MetricDetailSheet
        open={detail === 'rating'}
        title={t('gym.rating.title')}
        value={ratingLabel}
        bar={ratingBar}
        onClose={close}
      >
        <p>{t('gym.rating.explain')}</p>
        <p>{t('gym.rating.movesGradually')}</p>
        {state.maintenance ? <p>{t('gym.maintenance.body')}</p> : null}
      </MetricDetailSheet>

      <MetricDetailSheet
        open={detail === 'ytd'}
        title={t('gym.ytd.title')}
        value={ytdText}
        scale={t('gym.progress.groupsCounted', {
          count: state.ytd?.measured.length ?? 0,
          total: 10,
        })}
        onClose={close}
      >
        <p>{t('gym.ytd.explain')}</p>
        {state.performance.score === null ? (
          <p className="metric-sheet__note">{t('gym.performance.needsSecond')}</p>
        ) : null}
        {state.performance.components.length === 1 ? (
          <p className="metric-sheet__note">
            {state.performance.components[0] === 'trend'
              ? t('gym.performance.onlyTrend')
              : t('gym.performance.onlyYtd')}
          </p>
        ) : null}
      </MetricDetailSheet>

      <MetricDetailSheet
        open={detail === 'attendance'}
        title={t('gym.attendance.title')}
        value={attendanceLabel}
        scale={t('gym.attendance.thisWeek')}
        bar={startWeek ? undefined : attendanceBar}
        onClose={close}
      >
        <p>{t('gym.attendance.explain')}</p>
      </MetricDetailSheet>

      <MetricDetailSheet
        open={detail === 'endurance'}
        title={t('gym.endurance.title')}
        value={enduranceLabel}
        scale={t('gym.endurance.locked')}
        bar={enduranceBar}
        onClose={close}
      >
        <p>{t('gym.endurance.explain')}</p>
        <p>{t('gym.endurance.stillCounts')}</p>
      </MetricDetailSheet>

      {state.abstinence ? (
        <MetricDetailSheet
          open={detail === 'decay'}
          title={t('gym.decay.title')}
          value={t('gym.decay.days', { days: state.abstinence.days })}
          scale={decayLine}
          onClose={close}
        >
          {state.decayPending === true ? <p>{t('gym.decay.pendingExplain')}</p> : null}
          <p>{t('gym.decay.explain')}</p>
          <p>{t('gym.decay.floor')}</p>
          <p>{t('gym.decay.resume')}</p>
        </MetricDetailSheet>
      ) : null}
    </>
  );
}
