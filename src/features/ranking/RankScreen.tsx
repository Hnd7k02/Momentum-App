import { useCallback, useEffect, useState } from 'react';
import { RATING } from '../../core/config/constants';
import type { BossWeights as BossWeightMap } from '../../core/boss';
import { rankById } from '../../core/ranks';
import { displayedRankProgress, rankLadder, type RankProgress } from '../../core/ranks/progress';
import { confirmationIndicator, thresholdReached } from '../../core/ranks/confirmation';
import { isOfferedDomain, type OfferedDomainType } from '../../core/domains';
import { Card, EmptyState, LoadFailure, Section, StaleNotice } from '../../components';
import { RankIcon } from '../../components/Icons';
import { formatDayAndMonth, formatNumber } from '../../i18n/format';
import { useI18n, useT } from '../../i18n/I18nProvider';
import { DOMAIN_NAME_KEYS } from '../../i18n/domainNames';
import { wholePercents } from './wholePercents';
import { settingsRepository } from '../../storage/repositories';
import { loadBossProgression } from '../../storage/services/bossService';
import {
  bossWeightingOf,
  type AppConfiguration,
} from '../../storage/services/configurationService';
import { useLoadable } from '../../app/useLoadable';
import { useToday } from '../../app/useToday';
import { BossWeights } from './BossWeights';
import { RankBadge } from './RankBadge';
import './rank.css';

/**
 * The Rank screen.
 *
 * The Boss is the screen's subject: one rank for everything the user does,
 * weighted the way they set it — and the only rank there is. A domain has a
 * rating and a share of the Boss, never a rank, a badge or a ladder of its
 * own. There is one emblem family and there never will be a second.
 *
 * Every bar and every sentence beside it comes from `rankProgress`, which is
 * the whole reason that function exists: fill and copy describing different
 * things is the defect this screen used to have.
 */

/**
 * One bar, and the sentence that describes it.
 *
 * They take the same `RankProgress`, so they cannot disagree — and the bar is
 * an image labelled with that same sentence, because a bar with no words is a
 * shape a screen reader cannot read.
 */
export function RankProgressBar({
  progress,
  className = '',
  reached = false,
}: {
  progress: RankProgress;
  className?: string;
  /** The next threshold is reached and the rank is waiting to be confirmed. */
  reached?: boolean;
}) {
  const t = useT();
  const label =
    progress.next && progress.remaining !== null
      ? reached
        ? t('rank.boss.thresholdReached')
        : t('rank.boss.toNext', { points: progress.remaining, rank: progress.next.name })
      : t('rank.boss.maxed');

  return (
    <div className={`rank-progress ${className}`.trim()}>
      <div className="rank-progress__track" role="img" aria-label={label}>
        <span className="rank-progress__fill" style={{ width: `${progress.percent}%` }} />
      </div>
      <p className="rank-progress__caption">{label}</p>
    </div>
  );
}

export function RankScreen({
  configuration,
  onSetBossWeights,
}: {
  configuration: AppConfiguration;
  onSetBossWeights(weights: BossWeightMap): void;
}) {
  const t = useT();
  const { language } = useI18n();

  /*
   * Rank reads the same replay as Progress, and adds one thing: whether this
   * is the first time the user is seeing this rank. That is resolved as part
   * of the load rather than in a follow-up effect, so the reveal is known on
   * the badge's very first frame.
   *
   * Recording the acknowledgement is a flourish, not the screen. If that one
   * write fails the reveal simply plays again next time; it must not turn a
   * working Rank screen into an error.
   */
  const date = useToday();
  const load = useCallback(async () => {
    const boss = await loadBossProgression(date);
    const settings = await settingsRepository.getOrCreate();
    const seen = settings.acknowledgedRankId ?? null;
    const seenIndex = seen ? rankById(seen).index : -1;
    const promoted = boss.rank.index > seenIndex;

    if (promoted) {
      try {
        await settingsRepository.acknowledgeRank(boss.rank.id);
      } catch {
        /* The badge still plays; the app simply forgets that it did. */
      }
    }
    return { boss, promoted };
  }, [date]);

  /*
   * Again when the day turns (WP3, B3) and when the Boss weights move on this
   * screen — `configuration` is replaced after that write — but not on the
   * store's change signal: the load itself records the acknowledgement, and
   * reloading on that write would end the badge's reveal a moment after it
   * started.
   */
  const { state, reload } = useLoadable(load, [date], [configuration]);
  const promoted = state.status === 'ready' && state.value.promoted;
  const [revealSpent, setRevealSpent] = useState(false);
  const reveal = promoted && !revealSpent;

  useEffect(() => {
    if (!reveal) return;
    const timer = window.setTimeout(() => setRevealSpent(true), 1000);
    return () => window.clearTimeout(timer);
  }, [reveal]);

  // Loading, failure and loaded stay three distinct states.
  if (state.status !== 'ready') {
    return (
      <div className="screen">
        <header className="screen__header">
          <h1 className="screen__title">{t('nav.rank')}</h1>
        </header>
        <div className="rank__scroll" aria-busy={state.status === 'loading'}>
          {state.status === 'failed' ? (
            <LoadFailure title={t('error.rank.title')} onRetry={reload} />
          ) : null}
        </div>
      </div>
    );
  }

  const boss = state.value.boss;
  const legacy = boss.legacy;
  const rating = boss.points[boss.points.length - 1]?.rating ?? RATING.START;
  const progress = displayedRankProgress(rating, boss.rank);
  const calibrating = legacy.points[legacy.points.length - 1]?.calibrating ?? false;
  const weighting = bossWeightingOf(configuration);
  // The same whole percentages the Gewichtung card prints, over the same rows.
  const offered = weighting.filter((entry) => isOfferedDomain(entry.domain));
  const percentOf = new Map(
    wholePercents(offered.map((entry) => entry.share)).map((percent, index) => [offered[index]!.domain, percent]),
  );
  const ladder = rankLadder(boss.peakRank);
  // Shown as soon as a promotion is pending, 0/7 included, so crossing a
  // threshold without an instant promotion is explained where it happens.
  const confirming = confirmationIndicator(rating, boss.pending);

  const streakLabel = (count: number, unit: 'days' | 'weeks') => {
    if (count === 0) return t('rank.noStreak');
    if (unit === 'days') return count === 1 ? t('rank.dayOne') : t('rank.days', { count });
    return count === 1 ? t('rank.weekOne') : t('rank.weeks', { count });
  };

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">{t('nav.rank')}</h1>
      </header>

      <div className="rank__scroll">
        {state.refreshFailed ? <StaleNotice onRetry={reload} /> : null}

        <Section>
          <div data-card className="rank-hero">
            {reveal ? <span className="rank-hero__flash" aria-hidden="true" /> : null}
            {reveal ? <span className="rank-hero__pill">{t('rank.newRank')}</span> : null}

            <RankBadge rankId={boss.rank.id} size={148} animate={reveal} />

            <div>
              <p className="rank-hero__kicker">{t('rank.boss')}</p>
              {/* Rank names stay English in every language. */}
              <p className="rank-hero__name">{boss.rank.name}</p>
              <p className="rank-hero__rating">
                {Math.round(rating)} / {RATING.MAX}
              </p>
            </div>

            <RankProgressBar
              progress={progress}
              className="rank-progress--hero"
              reached={thresholdReached(rating, boss.pending)}
            />

            {confirming ? (
              <p className="rank-hero__confirm" data-testid="rank-confirm">
                {t('rank.confirm', { count: confirming.count, required: confirming.required })}
              </p>
            ) : null}

            {calibrating ? (
              <p className="rank-hero__note">
                {t('rank.calibrating', { days: RATING.CALIBRATION_DAYS })}
              </p>
            ) : null}
          </div>
        </Section>

        {/* The three progression concepts, kept strictly distinct. */}
        <Section>
          <Card rows>
            <div className="standing">
              <RankBadge rankId={boss.rank.id} size={38} />
              <span className="standing__label">
                <span className="standing__name">{t('rank.current')}</span>
                <span className="standing__hint">{t('rank.explainCurrent')}</span>
              </span>
              <span className="standing__value">{boss.rank.name}</span>
            </div>
            <div className="standing">
              <RankBadge rankId={boss.peakRank.id} size={38} />
              <span className="standing__label">
                <span className="standing__name">{t('rank.peak')}</span>
                <span className="standing__hint">{t('rank.explainPeak')}</span>
              </span>
              <span className="standing__value">{boss.peakRank.name}</span>
            </div>
            <div className="standing">
              <span className="standing__mark" aria-hidden="true">
                XP
              </span>
              <span className="standing__label">
                <span className="standing__name">{t('rank.xp')}</span>
                <span className="standing__hint">{t('rank.explainXp')}</span>
              </span>
              <span className="standing__value">{formatNumber(language, boss.lifetimeXp)}</span>
            </div>
          </Card>
        </Section>

        {/*
          What each area brings to the Boss: its rating on the shared 0–1000
          scale and its share of the weighting. No rank, no badge, no ladder
          — those belong to the Boss above, and to nothing else.
        */}
        <Section label={t('rank.domains')}>
          <Card>
            <p className="rank-section__explain">{t('rank.domains.explain')}</p>
            {boss.domains
              // Food's days replay, but Food is never shown (D139).
              .filter(
                (domain): domain is typeof domain & { domain: OfferedDomainType } =>
                  isOfferedDomain(domain.domain) && Boolean(configuration.domains[domain.domain]?.enabled),
              )
              .map((domain) => {
                const value = Math.round(domain.momentum);
                const percent = percentOf.get(domain.domain) ?? 0;
                const label = t('areas.standing.value', { value });
                return (
                  <div key={domain.domain} className="domain-standing">
                    <span className="domain-standing__body">
                      <span className="domain-standing__name">{t(DOMAIN_NAME_KEYS[domain.domain])}</span>
                      <span className="domain-standing__meta">
                        {domain.started
                          ? `${label} · ${t('rank.weights.share', { percent })}`
                          : t('rank.domain.notStarted')}
                      </span>
                    </span>
                    {domain.started ? (
                      <span className="domain-standing__track" role="img" aria-label={label}>
                        <span
                          className="domain-standing__fill"
                          style={{ width: `${Math.round((value / RATING.MAX) * 100)}%` }}
                        />
                      </span>
                    ) : null}
                  </div>
                );
              })}
          </Card>
        </Section>

        <Section label={t('rank.weights')}>
          <BossWeights weighting={weighting} onChange={onSetBossWeights} />
        </Section>

        {/*
          Every rank, browsable. An unearned one keeps its name, its threshold
          and its silhouette; what it does not get is the emblem.
        */}
        <Section label={t('rank.ladder')}>
          <Card rows>
            {ladder.map(({ rank, earned }) => (
              <div
                key={rank.id}
                className={`ladder-row ${earned ? '' : 'ladder-row--locked'}`.trim()}
              >
                <RankBadge rankId={rank.id} size={34} mystery={!earned} />
                <span className="ladder-row__body">
                  <span className="ladder-row__name">{rank.name}</span>
                  <span className="ladder-row__from">
                    {t('rank.ladder.from', { points: rank.min })}
                  </span>
                </span>
                {/* Never colour alone: the state is a word. */}
                <span className={`badge ${earned ? 'badge--boolean' : 'badge--paused'}`}>
                  {earned ? t('rank.ladder.earned') : t('rank.ladder.locked')}
                </span>
              </div>
            ))}
          </Card>
        </Section>

        <Section label={t('rank.streaks')}>
          <Card>
            <div className="streaks">
              <div className="streak">
                <p className="streak__label">{t('rank.streakCheckIn')}</p>
                <p className="streak__value">{streakLabel(legacy.checkInStreak.current, 'days')}</p>
                <p className="streak__best">
                  {t('rank.streakBest', { count: legacy.checkInStreak.best })}
                </p>
              </div>
              <div className="streak">
                <p className="streak__label">{t('rank.streakTraining')}</p>
                <p className="streak__value">
                  {streakLabel(legacy.trainingStreak.current, 'weeks')}
                </p>
                <p className="streak__best">
                  {t('rank.streakBest', { count: legacy.trainingStreak.best })}
                </p>
              </div>
            </div>
          </Card>
        </Section>

        <Section label={t('rank.history')}>
          <Card rows>
            {boss.changes.length === 0 ? (
              <EmptyState icon={<RankIcon size={24} />} title={t('rank.historyEmpty')} />
            ) : (
              [...boss.changes]
                .reverse()
                .slice(0, 6)
                .map((change) => (
                  <div key={`${change.date}-${change.to}`} className="rank-change">
                    {/* The badge that was reached, with the direction kept as
                        a separate glyph — colour is never the only carrier. */}
                    <span className="rank-change__badge" aria-hidden="true">
                      <RankBadge rankId={change.to} size={32} />
                      <span className={`rank-change__mark rank-change__mark--${change.kind}`}>
                        {change.kind === 'promotion' ? '↑' : '↓'}
                      </span>
                    </span>
                    <span className="rank-change__body">
                      <span>{rankById(change.to).name}</span>
                      <span className="rank-change__date">
                        {t(change.kind === 'promotion' ? 'rank.promotion' : 'rank.demotion')} ·{' '}
                        {formatDayAndMonth(language, change.date)}
                      </span>
                    </span>
                  </div>
                ))
            )}
          </Card>
        </Section>
      </div>
    </div>
  );
}
