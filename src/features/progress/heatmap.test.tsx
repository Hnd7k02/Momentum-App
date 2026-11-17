import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { translate } from '../../i18n';
import { I18nProvider } from '../../i18n/I18nProvider';
import { Heatmap, type HeatmapRow } from './Heatmap';

/**
 * The history grid's two kinds of tappable row.
 *
 * A domain row expands to reveal its questions; a question row opens that
 * question's own history. Both are buttons, both name themselves the same
 * way, and neither puts the counts into its name — those are the description,
 * so a screen reader hears what the row *is* before it hears its statistics.
 */

const days = ['2026-03-01', '2026-03-02', '2026-03-03'] as const;

const render = (rows: HeatmapRow[]) =>
  renderToStaticMarkup(
    <I18nProvider language="de" setLanguage={() => undefined}>
      <Heatmap rows={rows} days={[...days]} />
    </I18nProvider>,
  );

describe('a question row', () => {
  const rows: HeatmapRow[] = [
    {
      key: 'mental',
      label: 'Wellbeing',
      values: [80, 60, null],
      children: [
        {
          key: 'q1',
          label: 'Wie gut hast du geschlafen?',
          values: [80, 60, null],
          onOpen: () => undefined,
        },
      ],
    },
  ];

  it('is a button when it has somewhere to go', () => {
    const html = render(rows);
    // The domain row is on screen and expandable; the question row appears
    // once it is expanded, which server rendering cannot do — so the
    // assertion is on the affordance the component offers, not on state.
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('heatmap__header--tappable');
  });

  it('is plain markup when it has nowhere to go', () => {
    const html = render([{ key: 'overall', label: 'Gesamt', values: [80, 60, null] }]);
    expect(html).not.toContain('heatmap__header--tappable');
    expect(html).toContain('Gesamt');
  });

  it('keeps the counts as a description rather than part of the name', () => {
    const html = render(rows);
    expect(html).toContain('aria-describedby');
    expect(html).toContain(
      translate('de', 'heatmap.rowSummary', { recorded: 2, total: 3, missing: 1 }),
    );
  });

  it('still carries every value in the table, dates included', () => {
    const html = render(rows);
    expect(html).toContain(translate('de', 'heatmap.tableCaption', { count: 3 }));
    expect(html).toContain(translate('de', 'score.none'));
  });
});

describe('a day still open (block 9, step 6a, D194)', () => {
  const rows: HeatmapRow[] = [
    { key: 'overall', label: 'Gesamt', values: [80, 60, null], provisional: [null, null, 71] },
    { key: 'gym', label: 'Gym', values: [40, 40, null], provisional: [null, null, 100] },
  ];

  it('draws what it holds so far as a hollow bar in its band, and says "vorläufig" in the table', () => {
    const html = render(rows);
    expect(html).toContain('heatmap__bar heatmap__bar--provisional heatmap__bar--good');
    expect(html).toContain('heatmap__bar heatmap__bar--provisional heatmap__bar--strong');
    expect(html).toContain(`<td>${translate('de', 'heatmap.provisional', { value: '71 %' })}</td>`);
    expect(html).toContain('71 % (vorläufig)');
  });

  it('names the hollow bar in the legend, only where one is drawn', () => {
    expect(render(rows)).toContain(translate('de', 'heatmap.provisionalLegend'));
    const none = rows.map((row) => ({ ...row, provisional: [null, null, null] }));
    expect(render(none)).not.toContain(translate('de', 'heatmap.provisionalLegend'));
    expect(render(none)).not.toContain('heatmap__bar--provisional');
  });

  it('keeps it out of the row\'s average and its count: those are the final days', () => {
    const html = render([rows[1]!]);
    expect(html).toContain('>40 %<'); // the mean of 40 and 40, not of 40, 40 and 100
    expect(html).toContain(translate('de', 'heatmap.rowSummary', { recorded: 2, total: 3, missing: 1 }));
  });

  it('never stands where the day has its own value', () => {
    const html = render([{ key: 'gym', label: 'Gym', values: [40, 40, 90], provisional: [null, null, 100] }]);
    expect(html).not.toContain('heatmap__bar--provisional');
    expect(html).not.toContain('vorläufig');
  });
});
