import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RANKS } from '../../core/config/constants';
import { rankById } from '../../core/ranks';
import { displayedRankProgress, rankLadder } from '../../core/ranks/progress';
import { translate } from '../../i18n';
import { I18nProvider } from '../../i18n/I18nProvider';
import type { BossWeighting } from '../../storage/services/configurationService';
import { BossWeights } from './BossWeights';
import { RankBadge } from './RankBadge';
import { RankProgressBar } from './RankScreen';
import { wholePercents } from './wholePercents';

const render = (node: React.ReactNode, language: 'de' | 'en' = 'de') =>
  renderToStaticMarkup(
    <I18nProvider language={language} setLanguage={() => undefined}>
      {node}
    </I18nProvider>,
  );

/**
 * The bar, the badge and the weighting control, rendered.
 *
 * Every case here is a place where two things on screen could say different
 * things about the same fact.
 */

describe('the progress bar', () => {
  it('fills to the percentage its own progress reports', () => {
    const progress = displayedRankProgress(672, rankById('veteran'));
    const html = render(<RankProgressBar progress={progress} />);
    expect(html).toContain(`width:${progress.percent}%`);
  });

  it('labels the track with the sentence printed under it', () => {
    const progress = displayedRankProgress(672, rankById('veteran'));
    const html = render(<RankProgressBar progress={progress} />);
    const sentence = translate('de', 'rank.boss.toNext', {
      points: progress.remaining ?? 0,
      rank: 'Master',
    });
    // Once as the image's name, once as visible text: the same words.
    expect(html.split(sentence).length - 1).toBe(2);
  });

  it('says the ladder is finished instead of counting to nothing', () => {
    const html = render(<RankProgressBar progress={displayedRankProgress(980, rankById('legend'))} />);
    expect(html).toContain(translate('de', 'rank.boss.maxed'));
    expect(html).not.toContain(translate('de', 'rank.boss.toNext', { points: 0, rank: 'Legend' }));
  });

  it('says the threshold is reached instead of counting to nothing while a rank waits', () => {
    // 700 as Veteran: Master's threshold is met, remaining is 0, and the
    // caption must not say "Noch 0 bis Master" above a 0/7 indicator.
    const progress = displayedRankProgress(700, rankById('veteran'));
    expect(progress.remaining).toBe(0);
    const html = render(<RankProgressBar progress={progress} reached />);
    expect(html).toContain(translate('de', 'rank.boss.thresholdReached'));
    expect(html).not.toContain(translate('de', 'rank.boss.toNext', { points: 0, rank: 'Master' }));
    // Below the threshold the distance stays, pending dates or not.
    const below = render(<RankProgressBar progress={displayedRankProgress(690, rankById('veteran'))} />);
    expect(below).toContain(translate('de', 'rank.boss.toNext', { points: 10, rank: 'Master' }));
  });

  it('reads empty, not negative, for a rank held by hysteresis', () => {
    const html = render(<RankProgressBar progress={displayedRankProgress(690, rankById('master'))} />);
    expect(html).toContain('width:0%');
    // And it counts to the rank above the one being held.
    expect(html).toContain('Champion');
  });
});

describe('the mystery treatment', () => {
  it('fogs an unearned rank and leaves an earned one alone', () => {
    expect(render(<RankBadge rankId="legend" size={34} mystery />)).toContain('badge-svg--mystery');
    expect(render(<RankBadge rankId="legend" size={34} />)).not.toContain('badge-svg--mystery');
  });

  it('keeps the silhouette, which is what makes the ladder browsable', () => {
    const html = render(<RankBadge rankId="champion" size={148} mystery />);
    // The crest path is still drawn; only its colour and ornament change.
    expect(html).toContain('<path');
  });

  it('withholds the emblem colour rather than only dimming it', () => {
    const earned = render(<RankBadge rankId="champion" size={148} />);
    const locked = render(<RankBadge rankId="champion" size={148} mystery />);
    // Champion's gold is gone entirely from the fogged badge.
    expect(earned).not.toBe(locked);
    expect(locked).toContain('#b9bcc6');
  });

  it('uses no filter, so eight of them cost eight cheap paints', () => {
    expect(render(<RankBadge rankId="legend" size={34} mystery />)).not.toContain('filter=');
  });

  it('stays decorative, because the name is always beside it', () => {
    expect(render(<RankBadge rankId="legend" size={34} mystery />)).toContain('aria-hidden="true"');
  });
});

describe('the ladder', () => {
  it('fogs exactly the ranks above the peak', () => {
    const ladder = rankLadder(rankById('veteran'));
    expect(ladder.filter((entry) => !entry.earned).map((entry) => entry.rank.id)).toEqual([
      'master',
      'champion',
      'legend',
    ]);
    expect(ladder).toHaveLength(RANKS.length);
  });
});

describe('the Boss weighting control', () => {
  const weighting = (parts: number[]): BossWeighting[] => {
    const total = parts.reduce((sum, value) => sum + value, 0);
    const domains = ['mental', 'gym', 'running'] as const;
    return parts.map((value, index) => ({
      domain: domains[index]!,
      parts: value,
      share: value / total,
    }));
  };

  const percents = (html: string) =>
    [...html.matchAll(/boss-weights__share[^>]*>([^<]*)</g)].map((match) =>
      Number(match[1]!.replace(/[^0-9]/g, '')),
    );

  it('always totals a hundred, including where the shares do not divide', () => {
    for (const parts of [[1, 1, 1], [3, 1], [4, 4, 1], [2, 2, 3], [1, 9]]) {
      const html = render(<BossWeights weighting={weighting(parts)} onChange={() => undefined} />);
      expect(percents(html).reduce((sum, value) => sum + value, 0), JSON.stringify(parts)).toBe(100);
    }
  });

  it('prints the shares the one helper works out, which the area list reads too', () => {
    // Parts 4 : 3 : 2 after Food left (D139): 44.4, 33.3 and 22.2. Rounded
    // one by one they read 44, 33, 22 — 99 — and the list beside this card
    // used to say so while the card said 45.
    expect(wholePercents([4 / 9, 3 / 9, 2 / 9])).toEqual([45, 33, 22]);
    expect(percents(render(<BossWeights weighting={weighting([4, 3, 2])} onChange={() => undefined} />))).toEqual(
      wholePercents([4 / 9, 3 / 9, 2 / 9]),
    );
    for (const shares of [[1 / 3, 1 / 3, 1 / 3], [0.75, 0.25], [1], [0.05, 0.475, 0.475]]) {
      expect(wholePercents(shares).reduce((sum, value) => sum + value, 0), JSON.stringify(shares)).toBe(100);
    }
  });

  it('keeps three equal areas within a point of each other', () => {
    // 33.33 cannot be a whole percentage. What "equal" can mean is that no
    // row differs from another by more than the rounding.
    const values = percents(
      render(<BossWeights weighting={weighting([1, 1, 1])} onChange={() => undefined} />),
    );
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it('shows the parts as well as the share, so nothing is normalised in secret', () => {
    const html = render(<BossWeights weighting={weighting([3, 1])} onChange={() => undefined} />);
    expect(html).toContain(translate('de', 'rank.weights.parts', { count: 3 }));
    expect(html).toContain(translate('de', 'rank.weights.partOne'));
    expect(html).toContain(translate('de', 'rank.weights.total', { percent: 100 }));
  });

  it('says the change is forward only, one tap away', () => {
    // The sentence is true but not needed to use the control, so it lives in
    // the explanation the info control opens — offered on the card, said in
    // full in the sheet, and nowhere else.
    const closed = render(<BossWeights weighting={weighting([1, 1])} onChange={() => undefined} />);
    expect(closed).toContain(translate('de', 'common.moreInfo'));
    expect(closed).not.toContain(translate('de', 'rank.weights.forward'));
    const open = render(
      <BossWeights weighting={weighting([1, 1])} onChange={() => undefined} infoOpen />,
    );
    expect(open).toContain(translate('de', 'rank.weights.forward'));
  });

  it('names both steppers after the area they move', () => {
    const html = render(<BossWeights weighting={weighting([1, 1])} onChange={() => undefined} />);
    expect(html).toContain(
      translate('de', 'rank.weights.more', { domain: translate('de', 'domain.gym') }),
    );
    expect(html).toContain(
      translate('de', 'rank.weights.less', { domain: translate('de', 'domain.mental') }),
    );
  });

  it('cannot be pushed below one part', () => {
    const html = render(<BossWeights weighting={weighting([1, 4])} onChange={() => undefined} />);
    // The "less" button for the area already at one part is disabled.
    expect(html).toContain('disabled=""');
  });

  it('says what to do when there is nothing to weigh', () => {
    const html = render(<BossWeights weighting={[]} onChange={() => undefined} />);
    expect(html).toContain(translate('de', 'rank.weights.none'));
  });

  it('works in both languages', () => {
    for (const language of ['de', 'en'] as const) {
      const html = render(
        <BossWeights weighting={weighting([2, 1])} onChange={() => undefined} infoOpen />,
        language,
      );
      expect(html).toContain(translate(language, 'rank.weights.forward'));
      expect(html).toContain(translate(language, 'rank.weights.total', { percent: 100 }));
    }
  });
});
