import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../../i18n/I18nProvider';
import { compareExerciseDays, exerciseDays, type ExerciseDay } from '../../core/gym/performance';
import { ExerciseDetail } from './ExerciseDetail';

/**
 * The exercise detail draws a line (contract §6; the owner's choice at
 * STOP 5b, D175), and says the same days in words for a screen reader.
 *
 * Rendered with the real component: what is in the picture — a line or a
 * single dot, the labels of the scale, the end value and its state — and
 * that no bar is left of the chart it replaced.
 */
const METRIC = { repsDivisor: 30, comparison: 'median' } as const;
const NBSP = '\u00A0';

/** One working set a day: `[date, reps, kg]`. */
const bench = (...sets: [string, number, number][]): ExerciseDay[] =>
  exerciseDays(
    sets.map(([date, reps, kg]) => ({
      date,
      exerciseId: 'ex_bench_press',
      muscles: ['chest'],
      primaryMuscles: ['chest'],
      sets: [{ id: `s-${date}`, reps, weightGrams: kg * 1000, order: 0 }],
    })),
    METRIC,
  );

function render(days: ExerciseDay[]): string {
  const comparisons = compareExerciseDays(days);
  return renderToStaticMarkup(
    <I18nProvider language="de" setLanguage={() => undefined}>
      <ExerciseDetail
        name="Bankdrücken"
        // Newest first, as `exerciseHistory` hands them over.
        days={[...days].reverse()}
        comparison={comparisons[comparisons.length - 1]}
        onClose={() => undefined}
      />
    </I18nProvider>,
  );
}

const count = (html: string, needle: string): number => html.split(needle).length - 1;
/** The markup's words. Only plain spaces are folded: a no-break space is part of a figure. */
const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/[ \t\n]+/g, ' ');

describe('the exercise detail draws its days as a line', () => {
  // The reps rise at 60 kg, then the weight goes up and the reps fall back.
  const progression = bench(
    ['2026-10-14', 8, 60],
    ['2026-10-21', 9, 60],
    ['2026-10-28', 10, 60],
    ['2026-11-04', 8, 62.5],
    ['2026-11-11', 9, 62.5],
  );

  it('one line through every day, and no bar', () => {
    const html = render(progression);
    expect(count(html, '<polyline')).toBe(1);
    const points = /<polyline[^>]*points="([^"]+)"/.exec(html)![1]!.split(' ');
    expect(points).toHaveLength(5);
    // The first day is the zero line of a series that only rises: the lower
    // edge of the plot, at the left.
    expect(points[0]).toBe('0.00,100.00');
    expect(html).not.toContain('gym-detail__bar');
    expect(html).not.toContain('gym-detail__axisMax');
  });

  it('names the scale on the left: twelve percent at the least, and zero', () => {
    const html = render(progression);
    const labels = [...html.matchAll(/class="exercise-line__label"[^>]*>([^<]+)</g)].map((match) => match[1]);
    expect(labels).toEqual([`+12${NBSP}%`, `0${NBSP}%`]);
  });

  it('ends in the state of its end value, with the value beside it', () => {
    const html = render(progression);
    // 9 × 62.5 against 8 × 60: 2437.5 ÷ 2280, +6.9 %, shown as +7 %.
    expect(html).toContain('exercise-line__end exercise-line__end--improved');
    expect(html).toMatch(new RegExp(`class="exercise-line__value exercise-line__value--improved"[^>]*>\\+7${NBSP}%<`));
    // The figures above compare the last two days, and say so in their own place.
    expect(text(html)).toContain(`Veränderung +3${NBSP}%`);
  });

  it('widens the scale where a series goes further, both ways when it does both', () => {
    const wide = render(bench(['2026-10-14', 8, 60], ['2026-10-21', 8, 55], ['2026-10-28', 8, 75]));
    const labels = [...wide.matchAll(/class="exercise-line__label"[^>]*>([^<]+)</g)].map((match) => match[1]);
    // −8.3 % and +25 %: the reach is 30, above and below the zero line.
    expect(labels).toEqual([`+30${NBSP}%`, `0${NBSP}%`, `−30${NBSP}%`]);
  });

  it('draws one day as a dot and prints no change for it', () => {
    const html = render(bench(['2026-11-11', 9, 62.5]));
    expect(count(html, '<polyline')).toBe(0);
    expect(count(html, 'exercise-line__end ')).toBe(1);
    expect(html).toContain('exercise-line__end exercise-line__end--unchanged');
    expect(html).not.toContain('exercise-line__value');
    expect(text(html)).toContain('Veränderung Zu wenig Vergleichsdaten');
  });

  it('is hidden from a screen reader, which gets the same days as a table', () => {
    const html = render(progression);
    expect(html).toMatch(/class="gym-detail__chart exercise-line" aria-hidden="true"/);
    const table = /<table>.*<\/table>/s.exec(html)![0];
    expect(text(table)).toContain('Tag Bester Arbeitssatz Veränderung seit dem ersten Tag');
    const rows = [...table.matchAll(/<tr><th scope="row">([^<]+)<\/th><td>([^<]+)<\/td><td>([^<]+)<\/td><\/tr>/g)].map(
      (match) => [match[1], match[2], match[3]],
    );
    expect(rows).toEqual([
      ['11. November', '9 × 62.5 kg', `+7${NBSP}%`],
      ['4. November', '8 × 62.5 kg', `+4${NBSP}%`],
      ['28. Oktober', '10 × 60 kg', `+5${NBSP}%`],
      ['21. Oktober', '9 × 60 kg', `+3${NBSP}%`],
      ['14. Oktober', '8 × 60 kg', 'Ausgangswert'],
    ]);
  });
});
