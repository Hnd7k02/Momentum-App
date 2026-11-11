import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DateKey } from '../../core/dates';
import { LANGUAGES, translate } from '../../i18n';
import { I18nProvider } from '../../i18n/I18nProvider';
import type { HistoryQuestionRow } from '../../storage/services/historyService';
import { QuestionDetail } from './QuestionDetail';

/**
 * The question drill-down, rendered.
 *
 * What is checked is what the screen has to *say* rather than how it is
 * built: the values read back as the answers the user gave, the picture has
 * a semantic alternative carrying the dates it cannot, and the way to today's
 * check-in appears only when there is a check-in to reach.
 */

const days: DateKey[] = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04'];

function row(overrides: Partial<HistoryQuestionRow> = {}): HistoryQuestionRow {
  return {
    id: 'q1',
    text: 'Wie gut hast du geschlafen?',
    type: 'scale',
    category: 'gesundheit',
    status: 'active',
    scores: [30, null, 70, 100],
    ...overrides,
  };
}

const render = (props: Parameters<typeof QuestionDetail>[0], language: 'de' | 'en' = 'de') =>
  renderToStaticMarkup(
    <I18nProvider language={language} setLanguage={() => undefined}>
      <QuestionDetail {...props} />
    </I18nProvider>,
  );

const noop = () => undefined;

describe('what the drill-down shows', () => {
  it('names the question and the part of life it belongs to', () => {
    const html = render({ question: row(), days, onClose: noop });
    expect(html).toContain('Wie gut hast du geschlafen?');
    expect(html).toContain(translate('de', 'category.gesundheit'));
  });

  it('reads a scale answer back as the number the user chose, not a percentage', () => {
    // The value is 10; 100 % is the right unit for comparing days against each
    // other and the wrong one for reading back what you said.
    const html = render({ question: row(), days, onClose: noop });
    expect(html).toContain('>10<');
    // In either spelling of the space: the figure is printed with a no-break
    // space since STOP 6b, and the plain one must not come back unnoticed.
    expect(html).not.toContain('100\u00A0%');
    expect(html).not.toContain('100 %');
  });

  it('reads a yes/no answer back as yes or no', () => {
    const html = render({
      question: row({ type: 'boolean', scores: [100, 0, null, 100] }),
      days,
      onClose: noop,
    });
    expect(html).toContain(translate('de', 'answer.yes'));
    expect(html).toContain(translate('de', 'answer.no'));
  });

  it('counts the days it has and the days it has not', () => {
    const html = render({ question: row(), days, onClose: noop });
    expect(html).toContain(translate('de', 'questionDetail.answered', { recorded: 3, total: 4 }));
  });

  it('says there is nothing rather than drawing an empty chart', () => {
    const html = render({
      question: row({ scores: [null, null, null, null] }),
      days,
      onClose: noop,
    });
    expect(html).toContain(translate('de', 'questionDetail.noData'));
  });

  it('says when a question is paused or archived', () => {
    expect(render({ question: row({ status: 'paused' }), days, onClose: noop })).toContain(
      translate('de', 'questionDetail.paused'),
    );
    expect(render({ question: row({ status: 'archived' }), days, onClose: noop })).toContain(
      translate('de', 'questionDetail.archived'),
    );
  });
});

describe('the way back to today', () => {
  it('is offered while the question is being asked', () => {
    const html = render({ question: row(), days, onClose: noop, onAnswerToday: noop });
    expect(html).toContain(translate('de', 'questionDetail.answerToday'));
  });

  it('is not offered when there is nothing to answer', () => {
    // A drill-down is for looking. Sending someone to a check-in for a
    // question nobody is asking is a dead end.
    const html = render({ question: row({ status: 'archived' }), days, onClose: noop });
    expect(html).not.toContain(translate('de', 'questionDetail.answerToday'));
  });
});

describe('the layer a screen reader consumes', () => {
  it('hides the chart and carries the same facts in words', () => {
    const html = render({ question: row(), days, onClose: noop });
    expect(html).toContain('aria-hidden="true"');
    // The label states the range, how much was answered and the average.
    expect(html).toContain(translate('de', 'questionDetail.tableCaption', { count: 4 }));
  });

  it('gives every day a row, including the ones with no answer', () => {
    const html = render({ question: row(), days, onClose: noop });
    const rows = html.split('<tr').length - 1;
    // A header row plus one per day.
    expect(rows).toBe(days.length + 1);
    expect(html).toContain(translate('de', 'score.none'));
  });

  it('works in both languages', () => {
    for (const language of LANGUAGES) {
      const html = render({ question: row(), days, onClose: noop }, language);
      expect(html).toContain(translate(language, 'questionDetail.average'));
      expect(html).toContain(translate(language, 'questionDetail.day'));
    }
  });
});

describe('the 1-10 palette, where a 1-10 value appears', () => {
  it('bands every value by the fixed mapping', () => {
    // 1–4 weak, 5–6 mixed, 7–8 good, 9–10 strong (D123). The class is the
    // band, so the colour cannot disagree with the number.
    const cases: [number, string][] = [
      [10, 'weak'],
      [40, 'weak'],
      [50, 'mixed'],
      [60, 'mixed'],
      [70, 'good'],
      [80, 'good'],
      [90, 'strong'],
      [100, 'strong'],
    ];
    for (const [percent, band] of cases) {
      const html = render({ question: row({ scores: [percent] }), days: [days[0]!], onClose: noop });
      expect(html, `${percent / 10} should be ${band}`).toContain(
        `question-detail__bar question-detail__bar--${band}`,
      );
    }
  });

  it('never lets colour be the only thing carrying the value', () => {
    // The number is in the markup next to every band class.
    const html = render({ question: row({ scores: [60] }), days: [days[0]!], onClose: noop });
    expect(html).toContain('>6<');
  });
});
