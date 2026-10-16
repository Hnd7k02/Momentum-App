import { useState } from 'react';
import { RATING } from '../../core/config/constants';
import type { DomainType } from '../../core/model';
import { MetricDetailSheet, MetricTile } from '../../components/metrics';
import { useT } from '../../i18n/I18nProvider';
import { useDomainStanding } from './useDomainStanding';

/**
 * A domain's standing, as the hero of its terminal.
 *
 * The domain's rating on the shared 0–1000 scale, in the tile shape the
 * training terminals already open with — so Mind answers "where do I stand
 * here" the way Gym and Running do. Nothing here is computed: the
 * ledger arrives from the Boss replay and is printed. There is no domain
 * rank to show; the Boss is the only rank.
 */
export function DomainStandingTile({ domain, id }: { domain: DomainType; id: string }) {
  const t = useT();
  const standing = useDomainStanding(domain);
  const [open, setOpen] = useState(false);
  if (!standing) return null;

  const value = Math.round(standing.momentum);
  const label = t('areas.standing.value', { value });
  const bar = { percent: Math.round((value / RATING.MAX) * 100), label, tone: 'accent' as const };

  if (!standing.started) {
    return (
      <MetricTile
        id={id}
        title={t('areas.standing')}
        value={<span className="metric-tile__state">{t('rank.domain.notStarted')}</span>}
      />
    );
  }

  return (
    <>
      <MetricTile
        id={id}
        title={t('areas.standing')}
        value={label}
        bar={bar}
        line={t('areas.standing.summary')}
        onOpen={() => setOpen(true)}
      />
      <MetricDetailSheet
        open={open}
        title={t('areas.standing')}
        value={label}
        bar={bar}
        onClose={() => setOpen(false)}
      >
        <p>{t('rank.domains.explain')}</p>
        <p>{t('rank.explainCurrent')}</p>
      </MetricDetailSheet>
    </>
  );
}
