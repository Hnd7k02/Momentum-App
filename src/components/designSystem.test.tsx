import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Trend } from '../core/trends';
import { I18nProvider } from '../i18n/I18nProvider';
import { TrendCurve } from '../features/progress/TrendCurve';
import { Sparkline } from '../features/gym/Sparkline';
import { Figure, LoadingBlocks, splitFigure } from './index';
import { MetricBar, MetricTile } from './metrics';

/**
 * The building blocks Stage 6b added or redrew, rendered (contract §3, §6,
 * §11). Each case is a rule of the visual contract that lives in markup
 * rather than in a stylesheet, where a search could not hold it.
 */

const render = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <I18nProvider language="de" setLanguage={() => undefined}>
      {node}
    </I18nProvider>,
  );
/** The text a reader — or a screen reader — gets, with the markup gone. */
const textOf = (html: string) => html.replace(/<[^>]+>/g, '');

describe('a figure and its unit (contract §3)', () => {
  it('finds the seam after the number the text begins with', () => {
    expect(splitFigure('830 von 1000', { figure: 830 })).toEqual(['830', ' von 1000']);
    expect(splitFigure('0 / 3 Trainings', { figure: '0 / 3' })).toEqual(['0 / 3', ' Trainings']);
    expect(splitFigure('830 of 1000', { figure: 830 })).toEqual(['830', ' of 1000']);
  });

  it('finds the seam before the unit the text ends with', () => {
    expect(splitFigure('8 × 60 kg', { unit: 'kg' })).toEqual(['8 × 60 ', 'kg']);
    expect(splitFigure('5 × 135 lb', { unit: 'lb' })).toEqual(['5 × 135 ', 'lb']);
  });

  it('leaves a text whole that does not begin or end that way', () => {
    // A state in words is not a number with a unit: "Noch keine Serie".
    expect(splitFigure('Noch keine Serie', { figure: 0 })).toEqual(['Noch keine Serie', null]);
    expect(splitFigure('830', { figure: 830 })).toEqual(['830', null]);
    expect(splitFigure('8 × 60 kg', { unit: 'lb' })).toEqual(['8 × 60 kg', null]);
    expect(splitFigure('kg', { unit: 'kg' })).toEqual(['kg', null]);
    expect(splitFigure('8 × 60', { unit: '' })).toEqual(['8 × 60', null]);
  });

  it('never changes the text: the two halves are the whole', () => {
    for (const [text, seam] of [
      ['830 von 1000', { figure: 830 }],
      ['12 × 102.5 kg', { unit: 'kg' }],
      ['Gehalten', { figure: 5 }],
    ] as const) {
      const [head, rest] = splitFigure(text, seam);
      expect(head + (rest ?? '')).toBe(text);
      expect(textOf(render(<Figure text={text} {...seam} />))).toBe(text);
    }
  });

  it('sets the unit apart for the eye only', () => {
    expect(render(<Figure text="830 von 1000" figure={830} />)).toBe('830<span class="figure__unit"> von 1000</span>');
    expect(render(<Figure text="Gehalten" figure={5} />)).toBe('Gehalten');
  });

  it('prints a tile\'s rating as a number and its scale, one run of text', () => {
    const html = render(<MetricTile id="t" title="Gym-Rating" value="830" scale="von 1000" primary />);
    expect(html).toContain('metric-tile--primary');
    expect(textOf(html)).toContain('830 von 1000');
  });
});

describe('a bar that shows a value is neutral (D154, D160)', () => {
  it('carries no area and no tone of its own', () => {
    const html = render(<MetricBar percent={40} label="2 von 5" />);
    expect(html).toContain('class="metric-bar"');
    expect(html).not.toMatch(/metric-bar--(gym|running|accent|met)/);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="2 von 5"');
  });

  it('is marked only when a weekly target has been met', () => {
    expect(render(<MetricBar percent={100} label="3 von 3" met />)).toContain('class="metric-bar metric-bar--met"');
  });

  it('never draws past its track', () => {
    expect(render(<MetricBar percent={140} label="7 von 5" />)).toContain('width:100%');
    expect(render(<MetricBar percent={-5} label="0" />)).toContain('width:0%');
  });
});

describe('the row\'s trend line (contract §6)', () => {
  const trend = [0, 2, 5, 9].map((value, index) => ({ date: `2026-10-0${index + 1}`, value }));

  it('draws a zero line, a neutral line and one end point that carries the state', () => {
    const html = render(<Sparkline trend={trend} state="improved" />);
    expect(html.match(/<line /g)).toHaveLength(1);
    expect(html).toContain('class="muscle-row__sparkZero"');
    expect(html.match(/<polyline /g)).toHaveLength(1);
    expect(html.match(/<circle /g)).toHaveLength(1);
    expect(html).toContain('muscle-row__sparkEnd--improved');
    expect(html).toContain('r="3"');
    // Neither the line nor the dot is given a colour by the component: the
    // stylesheet's data ink and status colours do that.
    expect(html).not.toMatch(/stroke="|fill="(?!none)/);
    expect(html).toContain('aria-hidden="true"');
  });

  it('draws one observation as a dot on the zero line\'s scale, and no line', () => {
    const html = render(<Sparkline trend={trend.slice(0, 1)} state="unchanged" />);
    expect(html.match(/<polyline /g)).toBeNull();
    expect(html.match(/<circle /g)).toHaveLength(1);
    expect(html).toContain('cy="12.0"');
  });

  it('is 80 wide, and 64 where the row wraps', () => {
    expect(render(<Sparkline trend={trend} state="improved" />)).toContain('viewBox="0 0 80 24"');
    expect(render(<Sparkline trend={trend} state="improved" width={64} />)).toContain('viewBox="0 0 64 24"');
  });
});

describe('the trend curve on Verlauf (contract §6)', () => {
  const points = [300, 320, 360, 410, 480, 520].map((smoothed, index) => ({
    date: `2026-10-0${index + 1}`,
    value: smoothed,
    smoothed,
  }));
  const trend = (direction: Trend['direction'], series = points): Trend => ({
    points: series,
    current: series[series.length - 1]!.smoothed,
    previous: series[0]!.smoothed,
    delta: 0,
    direction,
    scoredDays: series.length,
    hasTrend: true,
    annotations: [],
  });

  it('has no wash beneath the line: no gradient, no filled path', () => {
    const html = render(<TrendCurve trend={trend('rising')} rangeDays={30} />);
    expect(html).not.toContain('linearGradient');
    expect(html).not.toContain('url(#');
    expect(html.match(/<path /g)).toHaveLength(1);
    expect(html).toContain('class="trend__line"');
    expect(html).toContain('fill="none"');
  });

  it('marks where the range began with a fine line, at the first value\'s height', () => {
    const html = render(<TrendCurve trend={trend('rising')} rangeDays={30} />);
    expect(html.match(/class="trend__zero"/g)).toHaveLength(1);
    // The first value is the lowest of this series: the foot of the box.
    expect(html).toMatch(/class="trend__zero" x1="0" x2="320" y1="96\.0" y2="96\.0"/);
  });

  it.each(['rising', 'falling', 'steady'] as const)('gives the end point the %s direction and prints its value', (direction) => {
    const html = render(<TrendCurve trend={trend(direction)} rangeDays={30} />);
    expect(html).toContain(`trend__end trend__end--${direction}`);
    expect(html).toMatch(/class="trend__endValue[^"]*"[^>]*>520</);
  });

  it('keeps the value clear of the line that runs into its point', () => {
    // Rising into the top right corner: there is no room above, so below.
    expect(render(<TrendCurve trend={trend('rising')} rangeDays={30} />)).toContain('trend__endValue--below');
    // Falling into the bottom right corner: above.
    const falling = [...points].reverse().map((point, index) => ({ ...point, date: `2026-10-0${index + 1}` }));
    expect(render(<TrendCurve trend={trend('falling', falling)} rangeDays={30} />)).not.toContain('trend__endValue--below');
  });

  it('is one image with a spoken description; what is laid over it is decoration', () => {
    const html = render(<TrendCurve trend={trend('rising')} rangeDays={30} />);
    expect(html).toContain('role="img"');
    expect(html).toMatch(/aria-label="[^"]+"/);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2);
  });

  it('draws nothing from fewer than two values', () => {
    expect(render(<TrendCurve trend={trend('steady', points.slice(0, 1))} rangeDays={30} />)).toBe('');
  });
});

describe('a screen that loads holds its layout (contract §11)', () => {
  it('stands calm surfaces where the cards will be, and says nothing', () => {
    const html = render(<LoadingBlocks heights={[84, 300]} />);
    expect(html).toBe(
      '<div class="loading-blocks" aria-hidden="true">' +
        '<div class="loading-block" style="height:84px"></div>' +
        '<div class="loading-block" style="height:300px"></div>' +
        '</div>',
    );
  });
});
