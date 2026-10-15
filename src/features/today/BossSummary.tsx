import { useCallback } from 'react';
import { displayedRankProgress } from '../../core/ranks/progress';
import { confirmationIndicator, thresholdReached } from '../../core/ranks/confirmation';
import { ChevronRightIcon } from '../../components/Icons';
import { useT } from '../../i18n/I18nProvider';
import { RankBadge } from '../ranking/RankBadge';
import { loadBossProgression } from '../../storage/services/bossService';
import { useLoadable } from '../../app/useLoadable';
import { useDataVersion } from '../../app/useDataVersion';
import { useToday } from '../../app/useToday';
import './bossSummary.css';

/**
 * The Boss Rank on Today: four facts and a way through.
 *
 * Badge, rank, how far to the next one, and a tap that opens the Rank screen.
 * The weighting, the domain ranks and the history all live there — putting
 * them here would turn the screen a user opens to answer three questions into
 * a screen they open to read.
 *
 * It fails quietly. A replay that will not load must not take the daily
 * check-in down with it, so the card simply is not there.
 *
 * It reloads when the day turns and after any committed write (WP3, B2): an
 * answer, a session or a restored backup can all move the Boss.
 */
export function BossSummary({ onOpen }: { onOpen(): void }) {
  const t = useT();
  const date = useToday();
  const version = useDataVersion();
  const load = useCallback(() => loadBossProgression(date), [date]);
  const { state } = useLoadable(load, [date], [version]);

  if (state.status !== 'ready') return null;

  const boss = state.value;
  const rating = boss.points[boss.points.length - 1]?.rating ?? 0;
  const progress = displayedRankProgress(rating, boss.rank);
  const caption =
    progress.next && progress.remaining !== null
      ? thresholdReached(rating, boss.pending)
        ? t('rank.boss.thresholdReached')
        : t('rank.boss.toNext', { points: progress.remaining, rank: progress.next.name })
      : t('rank.boss.maxed');
  const confirming = confirmationIndicator(rating, boss.pending);

  return (
    <button type="button" data-card className="boss-summary" onClick={onOpen}>
      <RankBadge rankId={boss.rank.id} size={52} />
      <span className="boss-summary__body">
        <span className="boss-summary__kicker">{t('today.boss.title')}</span>
        <span className="boss-summary__name">{boss.rank.name}</span>
        {/* The bar repeats what the line under it says; the line is the
            accessible version, so the bar itself is decorative. */}
        <span className="boss-summary__track" aria-hidden="true">
          <span className="boss-summary__fill" style={{ width: `${progress.percent}%` }} />
        </span>
        <span className="boss-summary__caption">{caption}</span>
        {confirming ? (
          <span className="boss-summary__confirm">
            {t('rank.confirm', { count: confirming.count, required: confirming.required })}
          </span>
        ) : null}
      </span>
      <ChevronRightIcon size={18} />
    </button>
  );
}
