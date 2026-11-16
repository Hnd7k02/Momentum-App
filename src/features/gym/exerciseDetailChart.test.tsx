import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../../i18n/I18nProvider';
import { exerciseDays, type ExerciseDay } from '../../core/gym/performance';
import { ExerciseDetail } from './ExerciseDetail';
import { exerciseChanges } from './muscleSheet';

/**
 * The exercise detail draws a line (contract §6; the owner's choice at
 * STOP 5b, D175), and says the same days in words for a screen reader.
 *
 * Rendered with the real component: what is in the picture — a line or a
 * single dot, the labels of the scale, the state of its end point — and
 * that no bar is left of the chart it replaced.
 *
 * Since block 7C an exercise has one change (D176): the one in the range,
 * at the head of the detail with its state and its name. No percentage
 * stands between "Zuletzt" and "Davor", and none at the end of the line.
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

function render(days: ExerciseDay[], rangeDays = 30): string {
  return renderToStaticMarkup(
    <I18nProvider language="de" setLanguage={() => undefined}>
      <ExerciseDetail
        name="Bankdrücken"
        // Newest first, as `exerciseHistory` hands them over.
        days={[...days].reverse()}
        // The one figure of the exercise, as the screen hands it over.
        change={exerciseChanges({ days, metric: METRIC }).get('ex_bench_press') ?? null}
        rangeDays={rangeDays}
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

  it('names the scale on the left: eight percent at the least, and zero', () => {
    // Twelve until STOP Kurve (D180). The series ends at +6.9 %, inside eight.
    const html = render(progression);
    const labels = [...html.matchAll(/class="exercise-line__label"[^>]*>([^<]+)</g)].map((match) => match[1]);
    expect(labels).toEqual([`+8${NBSP}%`, `0${NBSP}%`]);
  });

  it('carries one change at its head: the one in the range, with its state and its name', () => {
    const html = render(progression);
    // Five days compare the two last with the two first: the median of
    // 79.17 and 81.25 against the median of 76 and 78, +4.2 %.
    expect(html).toMatch(new RegExp(`class="gym-detail__change gym-detail__change--improved">\\+4${NBSP}%<`));
    expect(html).toContain('class="state-chip state-chip--improved">Verbessert<');
    expect(text(html)).toContain('Bester Arbeitssatz · letzte 30 Tage');
    expect(text(render(progression, 90))).toContain('Bester Arbeitssatz · letzte 90 Tage');
  });

  it('stands no percentage between "Zuletzt" and "Davor", and none under the bare word "Veränderung"', () => {
    const html = render(progression);
    const figures = [...html.matchAll(/class="gym-detail__label">([^<]+)</g)].map((match) => match[1]);
    expect(figures).toEqual(['Zuletzt', 'Davor']);
    expect(text(html)).toMatch(/Zuletzt 9 × 62\.5 kg Davor 8 × 62\.5 kg/);
    // "Veränderung" is said once, and with what it compares: in the table
    // that reads the line out.
    expect(count(text(html), 'Veränderung')).toBe(1);
    expect(text(html)).toContain('Veränderung seit dem ersten Tag');
    // The comparison with the day before (+2.6 %, once shown as "+3 %") is gone.
    expect(count(html, `+3${NBSP}%`)).toBe(1); // the table's row for 21 October
  });

  it('its end point carries the state of that one change, and no figure stands at the line', () => {
    const html = render(progression);
    expect(html).toContain('exercise-line__end exercise-line__end--improved');
    // The last day stands 6.9 % above the first: the line shows it, and
    // until block 7C "+7 %" stood beside it as a second, unnamed number.
    expect(html).not.toContain('exercise-line__value');
    expect(html).not.toContain('exercise-line__endColumn');
    expect(text(html)).toContain('Die Linie zeigt jeden Tag im Vergleich zum ersten Tag im Zeitraum.');
  });

  it('the end point follows the figure, not the height of the last day', () => {
    // 100, 90, 104, 96 kg at five reps: the last day lies 4 % under the
    // first, and the two last days lie 5.3 % over the two first.
    const html = render(bench(['2026-10-14', 5, 100], ['2026-10-21', 5, 90], ['2026-10-28', 5, 104], ['2026-11-04', 5, 96]));
    expect(html).toMatch(new RegExp(`class="gym-detail__change gym-detail__change--improved">\\+5${NBSP}%<`));
    expect(html).toContain('exercise-line__end exercise-line__end--improved');
    // A series that goes both ways has the zero line in the middle.
    const labels = [...html.matchAll(/class="exercise-line__label"[^>]*>([^<]+)</g)].map((match) => match[1]);
    expect(labels).toEqual([`+12${NBSP}%`, `0${NBSP}%`, `−12${NBSP}%`]);
  });

  it('widens the scale where a series goes further, both ways when it does both', () => {
    const wide = render(bench(['2026-10-14', 8, 60], ['2026-10-21', 8, 55], ['2026-10-28', 8, 75]));
    const labels = [...wide.matchAll(/class="exercise-line__label"[^>]*>([^<]+)</g)].map((match) => match[1]);
    // −8.3 % and +25 %: the reach is 28 — the next step of four — above and below the zero line.
    expect(labels).toEqual([`+28${NBSP}%`, `0${NBSP}%`, `−28${NBSP}%`]);
  });

  it('draws one day as a dot and prints no change for it', () => {
    const html = render(bench(['2026-11-11', 9, 62.5]));
    expect(count(html, '<polyline')).toBe(0);
    expect(count(html, 'exercise-line__end ')).toBe(1);
    expect(html).toContain('exercise-line__end exercise-line__end--unchanged');
    expect(html).not.toContain('exercise-line__value');
    // No figure at the head either: the chip says why.
    expect(html).not.toContain('gym-detail__change');
    expect(html).toContain('class="state-chip state-chip--awaitingBaseline">Zu wenig Vergleichsdaten<');
    expect(text(html)).toMatch(/Zuletzt 9 × 62\.5 kg Davor –/);
    expect(text(html)).not.toContain('Die Linie zeigt');
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
