import { useState } from 'react';
import { BOSS } from '../../core/config/constants';
import type { BossWeights as BossWeightMap } from '../../core/boss';
import { isOfferedDomain, type OfferedDomainType } from '../../core/domains';
import type { DomainType } from '../../core/model';
import { Card, EmptyState, Sheet } from '../../components';
import { InfoIcon, MinusIcon, PlusIcon } from '../../components/Icons';
import { useT } from '../../i18n/I18nProvider';
import { DOMAIN_NAME_KEYS } from '../../i18n/domainNames';
import type { BossWeighting } from '../../storage/services/configurationService';
import { wholePercents } from './wholePercents';
import './bossWeights.css';

/**
 * How much each area counts towards the Boss Rank.
 *
 * The control is **parts, not percentages**. Percentages that have to total
 * exactly 100 are a spreadsheet: every adjustment forces a compensating one
 * somewhere else, and on a phone that is four sliders fighting each other.
 * Parts are what the user actually means — "gym matters twice as much as
 * Laufen" — and the share is arithmetic.
 *
 * The arithmetic is not hidden, which is the other half of the rule. Each row
 * shows its parts *and* the percentage they work out to, the total is stated
 * underneath, and it is always 100 % because it cannot be anything else. There
 * is no save button and no invalid state to save: every reachable combination
 * of parts resolves.
 *
 * Changing this appends a config snapshot, so it applies from today forward
 * and cannot reach a day already lived. The screen says so.
 */

const MIN_PARTS = 1;
const MAX_PARTS = 10;

export function BossWeights({
  weighting: all,
  onChange,
  infoOpen: initialInfoOpen = false,
}: {
  weighting: BossWeighting[];
  onChange(weights: BossWeightMap): void;
  /** Start with the explanation open — for a screen that arrives to explain,
      and for rendering the control with everything it can say in view. */
  infoOpen?: boolean;
}) {
  const t = useT();
  const [infoOpen, setInfoOpen] = useState(initialInfoOpen);
  // The areas a user can have; Food's days replay, but it is never offered
  // or shown (D139).
  const weighting = all.filter((entry): entry is BossWeighting & { domain: OfferedDomainType } =>
    isOfferedDomain(entry.domain),
  );

  if (weighting.length === 0) {
    return (
      <Card>
        <EmptyState title={t('rank.weights')} body={t('rank.weights.none')} />
      </Card>
    );
  }

  const set = (domain: DomainType, parts: number) => {
    const next: BossWeightMap = {};
    for (const entry of weighting) {
      next[entry.domain] = entry.domain === domain ? parts : entry.parts;
    }
    onChange(next);
  };

  // Whole percentages that add to exactly 100: a column that totals 99
  // would undermine the whole control.
  const percents = wholePercents(weighting.map((entry) => entry.share));

  return (
    <Card>
      {/*
        Three regions, each with its own room: what the control is, the rows,
        and what the rows add up to. The forward-only rule is true but not
        needed to use the control, so it sits one tap away with the rest of
        the explanation rather than under the total.
      */}
      <div className="boss-weights__intro">
        <p className="boss-weights__explain">{t('rank.weights.explain')}</p>
        <button
          type="button"
          className="boss-weights__info"
          aria-label={t('common.moreInfo')}
          aria-haspopup="dialog"
          onClick={() => setInfoOpen(true)}
        >
          <InfoIcon size={20} />
        </button>
      </div>

      {weighting.map((entry, index) => {
        const name = t(DOMAIN_NAME_KEYS[entry.domain]);
        return (
          <div key={entry.domain} className="boss-weights__row">
            <span className="boss-weights__body">
              <span className="boss-weights__name">{name}</span>
              <span className="boss-weights__parts">
                {entry.parts === 1
                  ? t('rank.weights.partOne')
                  : t('rank.weights.parts', { count: entry.parts })}
              </span>
            </span>

            <span
              className={`boss-weights__share boss-weights__share--${entry.domain}`}
              /* The number is the outcome of the two buttons beside it, so it
                 is announced when it changes rather than read only on focus. */
              aria-live="polite"
            >
              {t('rank.weights.share', { percent: percents[index] ?? 0 })}
            </span>

            <span className="boss-weights__stepper">
              <button
                type="button"
                className="boss-weights__step"
                aria-label={t('rank.weights.less', { domain: name })}
                disabled={entry.parts <= MIN_PARTS}
                onClick={() => set(entry.domain, entry.parts - 1)}
              >
                <MinusIcon size={18} />
              </button>
              <button
                type="button"
                className="boss-weights__step"
                aria-label={t('rank.weights.more', { domain: name })}
                disabled={entry.parts >= MAX_PARTS}
                onClick={() => set(entry.domain, entry.parts + 1)}
              >
                <PlusIcon size={18} />
              </button>
            </span>
          </div>
        );
      })}

      <p className="boss-weights__total">
        {t('rank.weights.total', { percent: 100 })}
        {/* No domain can be squeezed out entirely, however low it is set. */}
        {weighting.length > 1 ? ` · ${Math.round(BOSS.MIN_WEIGHT * 100)} % min` : ''}
      </p>

      <Sheet open={infoOpen} title={t('rank.weights')} onClose={() => setInfoOpen(false)}>
        <div className="metric-sheet__body">
          <p>{t('rank.weights.explain')}</p>
          <p>{t('rank.weights.forward')}</p>
        </div>
      </Sheet>
    </Card>
  );
}
