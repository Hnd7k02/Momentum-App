import { describe, expect, it } from 'vitest';
import type { GymMetric } from '../../core/gym/metric';
import {
  exerciseDays,
  gymPerformance,
  gymPerformanceOverSpan,
  latestComparisons,
  percentChange,
  type ExerciseDayInput,
  type SetInput,
} from '../../core/gym/performance';
import type { MuscleGroup } from '../../core/model';
import type { GymHistory } from '../../storage/services/gymService';
import { toMuscleAnalytics } from './muscleAnalytics';
import { exerciseChanges, rangeWeeks, toMuscleSheet, weekNumber } from './muscleSheet';
import { shownPerformance } from './muscleState';

/**
 * The muscle sheet's view model (block 7C, contract §9).
 *
 * What is held here: the sheet shows the group's own state and figure — the
 * one the row shows — its line ends on that figure, an exercise's change is
 * the one that enters the group's figure, "uneinheitlich" is said only
 * beside a figure, and the weeks of the range are whole weeks.
 */

/** The Stage 5b metric: the best working set by strength score, the median of the last days against the first. */
const METRIC: GymMetric = { repsDivisor: 30, comparison: 'median' };

let ids = 0;
const set = (reps: number, kg: number, extra: Partial<SetInput> = {}): SetInput => ({
  id: `s${(ids += 1)}`,
  reps,
  weightGrams: Math.round(kg * 1000),
  order: ids,
  ...extra,
});

const day = (
  date: string,
  exerciseId: string,
  muscles: MuscleGroup[],
  primary: MuscleGroup[],
  sets: SetInput[],
): ExerciseDayInput => ({ date, exerciseId, muscles, primaryMuscles: primary, sets });

/** A history the way `loadGymRange()` builds one, under the Stage 5b metric. */
function historyOf(inputs: ExerciseDayInput[]): GymHistory {
  const days = exerciseDays(inputs, METRIC);
  return {
    days,
    comparisons: latestComparisons(days),
    recent: gymPerformance(days),
    overall: gymPerformanceOverSpan(days, METRIC),
    names: new Map(),
    awaitingBodyweight: [],
    warmUpOnly: [],
    metric: METRIC,
  };
}

const bench = (date: string, sets: SetInput[]) => day(date, 'ex_bench', ['chest', 'triceps', 'shoulders'], ['chest'], sets);
const incline = (date: string, sets: SetInput[]) => day(date, 'ex_incline', ['chest', 'shoulders'], ['chest'], sets);
const curl = (date: string, sets: SetInput[]) => day(date, 'ex_curl', ['biceps', 'forearms'], ['biceps'], sets);

/**
 * The bench press of the check data, four days (9 × 60, 10 × 60, 8 × 62.5,
 * 9 × 62.5 kg), an incline press that falls, and a curl on two days.
 * The range is the 30 days up to Sunday 15 November 2026.
 */
const FROM = '2026-10-17';
const TO = '2026-11-15';
const INPUTS: ExerciseDayInput[] = [
  bench('2026-10-21', [set(12, 40, { warmUp: true }), set(9, 60), set(8, 60)]),
  incline('2026-10-21', [set(10, 30)]),
  bench('2026-10-28', [set(10, 60), set(9, 60)]),
  curl('2026-10-30', [set(10, 14)]),
  bench('2026-11-04', [set(8, 62.5)]),
  incline('2026-11-04', [set(8, 30)]),
  curl('2026-11-06', [set(10, 14)]),
  bench('2026-11-11', [set(9, 62.5), set(8, 62.5)]),
];

function sheet(muscle: MuscleGroup, inputs: ExerciseDayInput[] = INPUTS, lastTrained: Partial<Record<MuscleGroup, string>> | null = null) {
  const history = historyOf(inputs);
  const shown = shownPerformance(history.days, history.overall);
  return { history, shown, view: toMuscleSheet({ muscle, history, shown, sets: inputs, from: FROM, to: TO, lastTrained }) };
}

describe('the same number as the row and the body', () => {
  it('state, figure and exercise days are the shown group, not a second computation', () => {
    const history = historyOf(INPUTS);
    const shown = shownPerformance(history.days, history.overall);
    const rows = toMuscleAnalytics(history, shown);
    for (const entry of shown.muscles) {
      const view = toMuscleSheet({ muscle: entry.muscle, history, shown, sets: INPUTS, from: FROM, to: TO });
      const row = rows.find((candidate) => candidate.id === entry.muscle)!;
      expect(view.state).toBe(entry.state);
      expect(view.change).toBe(entry.change);
      expect(view.state).toBe(row.state);
      expect(view.change).toBe(row.delta);
      expect(view.exerciseDays).toBe(row.exerciseDays);
    }
  });

  it('the line ends on the figure, and is the row\'s line without its cap', () => {
    const { view, history, shown } = sheet('chest');
    expect(view.change).not.toBeNull();
    expect(view.trend.length).toBeGreaterThan(1);
    expect(view.trend[view.trend.length - 1]!.value).toBe(view.change);
    const row = toMuscleAnalytics(history, shown).find((candidate) => candidate.id === 'chest')!;
    expect(view.trend.slice(-row.trend.length)).toEqual(row.trend);
  });

  it('a group without a figure has no line, whatever the domain could compute', () => {
    // The curl was done twice: a ratio exists, two exercise days are too few.
    const { view, history } = sheet('biceps');
    expect(history.overall.muscles.find((entry) => entry.muscle === 'biceps')).toMatchObject({ status: 'measured' });
    expect(view).toMatchObject({ state: 'awaitingBaseline', change: null, trend: [], exerciseDays: 2, compared: true });
    expect(sheet('calves').view).toMatchObject({ state: 'noData', change: null, trend: [], exercises: [], records: [] });
  });
});

describe('the change of one exercise in the range (D176)', () => {
  it('is the comparison the group\'s figure is formed from: the median of the last days against the first', () => {
    const changes = exerciseChanges(historyOf(INPUTS));
    // Bench: scores 78, 80, 79.1667 and 81.25 (load × (1 + reps ÷ 30)); four
    // days compare the two last with the two first.
    const expected = ((79.16666666666667 + 81.25) / 2 / ((78 + 80) / 2) - 1) * 100;
    expect(changes.get('ex_bench')).toBeCloseTo(expected, 9);
    expect(changes.get('ex_bench')).toBeCloseTo(1.53, 2);
    // Two days: the last against the first. 30 kg × (1 + 8/30) against 30 × (1 + 10/30).
    expect(changes.get('ex_incline')).toBeCloseTo((38 / 40 - 1) * 100, 9);
    expect(changes.get('ex_curl')).toBe(0);
  });

  it('is not the comparison with the day before, nor the last day against the first', () => {
    const history = historyOf(INPUTS);
    const inRange = exerciseChanges(history).get('ex_bench')!;
    const sincePrevious = percentChange(history.comparisons.get('ex_bench')!.ratio)!;
    expect(sincePrevious).toBeCloseTo((81.25 / 79.16666666666667 - 1) * 100, 9); // +2.6 %
    expect((81.25 / 78 - 1) * 100).toBeCloseTo(4.17, 2); // the line's end
    expect(inRange).not.toBeCloseTo(sincePrevious, 1);
  });

  it('an exercise on a single day has none', () => {
    const changes = exerciseChanges(historyOf([bench('2026-11-11', [set(9, 62.5)])]));
    expect(changes.get('ex_bench')).toBeNull();
  });

  it('before the Stage 5b metric it is the last day against the first', () => {
    const days = exerciseDays([bench('2026-10-21', [set(5, 60)]), bench('2026-10-28', [set(5, 70)]), bench('2026-11-04', [set(5, 66)])]);
    const legacy = { days, metric: null };
    expect(exerciseChanges(legacy).get('ex_bench')).toBeCloseTo(10, 9);
  });

  it('the group\'s figure is the weighted mean of its exercises\' changes', () => {
    const { view } = sheet('chest');
    const byId = new Map(view.exercises.map((exercise) => [exercise.id, exercise]));
    // Bench and incline both have the chest as their one primary: equal weight.
    const mean = (byId.get('ex_bench')!.change! + byId.get('ex_incline')!.change!) / 2;
    expect(view.change).toBeCloseTo(mean, 9);
  });
});

describe('the exercises of a group', () => {
  it('are the exercises the group is counted for, each with its days', () => {
    const { view } = sheet('chest');
    expect(view.exercises.map((exercise) => [exercise.id, exercise.days])).toEqual([
      ['ex_bench', 4],
      ['ex_incline', 2],
    ]);
    // The shoulders are secondary in both and are counted for both.
    expect(sheet('shoulders').view.exercises.map((exercise) => exercise.id)).toEqual(['ex_bench', 'ex_incline']);
    expect(sheet('triceps').view.exercises.map((exercise) => exercise.id)).toEqual(['ex_bench']);
  });

  it('carry their best working set of the range — by the metric, never a warm-up', () => {
    const { view } = sheet('chest');
    const benchRow = view.exercises.find((exercise) => exercise.id === 'ex_bench')!;
    // 9 × 62.5 kg scores 81.25 and is the best of the four days.
    expect(benchRow.best).toMatchObject({ date: '2026-11-11', set: { reps: 9, weightGrams: 62_500 } });
    const inclineRow = view.exercises.find((exercise) => exercise.id === 'ex_incline')!;
    expect(inclineRow.best).toMatchObject({ date: '2026-10-21', set: { reps: 10, weightGrams: 30_000 } });
  });

  it('take the later of two days that are level', () => {
    const { view } = sheet('biceps');
    expect(view.exercises[0]!.best.date).toBe('2026-11-06');
  });

  it('what was recorded is listed newest first: exercise, day, best working set', () => {
    const { view } = sheet('biceps');
    expect(view.records).toEqual([
      { exerciseId: 'ex_curl', date: '2026-11-06', set: expect.objectContaining({ reps: 10, weightGrams: 14_000 }) },
      { exerciseId: 'ex_curl', date: '2026-10-30', set: expect.objectContaining({ reps: 10, weightGrams: 14_000 }) },
    ]);
  });
});

describe('"uneinheitlich" in the sheet', () => {
  it('is said where the exercises lie more than ten shown points apart', () => {
    // Bench +20 %, incline −5 %: a group of about +8 %.
    const inputs = [
      bench('2026-10-21', [set(5, 50)]),
      incline('2026-10-21', [set(10, 40)]),
      bench('2026-11-04', [set(5, 60)]),
      incline('2026-11-04', [set(10, 38)]),
    ];
    const { view } = sheet('chest', inputs);
    expect(view.exercises.map((exercise) => Math.round(exercise.change!))).toEqual([20, -5]);
    expect(view.change).toBeCloseTo(7.5, 9);
    expect(view.uneven).toBe(true);
  });

  it('is not said of the check data: +2 % and −5 % are seven points', () => {
    expect(sheet('chest').view.uneven).toBe(false);
  });

  it('is not said of a single exercise', () => {
    expect(sheet('triceps').view.uneven).toBe(false);
  });

  it('is never said beside a chip: a group without a figure states no mean to qualify', () => {
    // Two exercises on two days each, far apart — but both days are the
    // same two calendar days, and the group's figure exists. Take one
    // exercise away from a day and the group has too little to compare.
    const inputs = [
      curl('2026-10-30', [set(10, 10)]),
      curl('2026-11-06', [set(10, 14)]),
    ];
    const { view } = sheet('biceps', inputs);
    expect(view.state).toBe('awaitingBaseline');
    expect(view.exercises[0]!.change).toBeCloseTo(40, 9);
    expect(view.uneven).toBe(false);
  });
});

describe('the weeks of a range', () => {
  it('are the whole weeks inside it and the running one', () => {
    // Saturday 17 October to Sunday 15 November 2026: the first two days
    // belong to week 42, which the range does not hold whole.
    expect(rangeWeeks('2026-10-17', '2026-11-15')).toEqual(['2026-W43', '2026-W44', '2026-W45', '2026-W46']);
    // A day later the running week has one day and is in.
    expect(rangeWeeks('2026-10-18', '2026-11-16')).toEqual(['2026-W43', '2026-W44', '2026-W45', '2026-W46', '2026-W47']);
  });

  it('a range that begins on a Monday holds its first week whole', () => {
    expect(rangeWeeks('2026-10-19', '2026-11-17')).toEqual(['2026-W43', '2026-W44', '2026-W45', '2026-W46', '2026-W47']);
  });

  it('are twelve or thirteen for 90 days, never more', () => {
    for (let offset = 0; offset < 14; offset += 1) {
      const to = `2026-11-${String(10 + offset).padStart(2, '0')}`;
      const fromDate = new Date(Date.UTC(2026, 10, 10 + offset - 89, 12));
      const from = fromDate.toISOString().slice(0, 10);
      const weeks = rangeWeeks(from, to);
      expect(weeks.length).toBeGreaterThanOrEqual(12);
      expect(weeks.length).toBeLessThanOrEqual(13);
    }
  });

  it('cross a year by the calendar week, not by the year', () => {
    expect(rangeWeeks('2026-12-21', '2027-01-06')).toEqual(['2026-W52', '2026-W53', '2027-W01']);
    expect(weekNumber('2026-W53')).toBe(53);
    expect(weekNumber('2027-W01')).toBe(1);
  });
});

describe('the work volume in the sheet', () => {
  it('stands week by week, by the group\'s share, with a gap where a week has no working set', () => {
    const { view } = sheet('chest');
    expect(view.weeks.map((week) => week.number)).toEqual([43, 44, 45, 46]);
    // Week 43: bench 9 × 60 + 8 × 60 (the warm-up is out) at 70 % and incline 10 × 30 at 70 %.
    expect(view.weeks[0]!.volume).toBeCloseTo((17 * 60_000 + 10 * 30_000) * 0.7, 6);
    // Week 44: bench 19 × 60.
    expect(view.weeks[1]!.volume).toBeCloseTo(19 * 60_000 * 0.7, 6);
    expect(view.weeks[2]!.volume).toBeCloseTo((8 * 62_500 + 8 * 30_000) * 0.7, 6);
    expect(view.weeks[3]!.volume).toBeCloseTo(17 * 62_500 * 0.7, 6);
    // The biceps were trained in weeks 44 and 45 only.
    expect(sheet('biceps').view.weeks.map((week) => week.volume === null)).toEqual([true, false, false, true]);
  });

  it('leaves out the days of a week the range holds only in part', () => {
    const inputs = [...INPUTS, bench('2026-10-17', [set(10, 100)])];
    const { view } = sheet('chest', inputs);
    expect(view.weeks.map((week) => week.number)).toEqual([43, 44, 45, 46]);
  });

  it('changes neither the state nor the figure of the group', () => {
    const light = sheet('chest').view;
    // The same days with five times the sets below the best one.
    const heavy = INPUTS.map((input) =>
      input.exerciseId === 'ex_bench' ? { ...input, sets: [...input.sets, set(5, 40), set(5, 40), set(5, 40), set(5, 40)] } : input,
    );
    const more = sheet('chest', heavy).view;
    expect(more.weeks[3]!.volume!).toBeGreaterThan(light.weeks[3]!.volume!);
    expect(more.state).toBe(light.state);
    expect(more.change).toBe(light.change);
    expect(more.exercises.map((exercise) => exercise.change)).toEqual(light.exercises.map((exercise) => exercise.change));
  });
});

describe('a group that was not trained in the range', () => {
  it('names its last day before the range where there is one', () => {
    expect(sheet('calves', INPUTS, { calves: '2026-09-30' }).view.lastTrainedBefore).toBe('2026-09-30');
    expect(sheet('calves', INPUTS, {}).view.lastTrainedBefore).toBeNull();
    expect(sheet('calves', INPUTS, null).view.lastTrainedBefore).toBeNull();
  });

  it('a trained group never says when it was last trained before the range', () => {
    expect(sheet('chest', INPUTS, { chest: '2026-09-30' }).view.lastTrainedBefore).toBeNull();
  });

  it('is "never trained" only where that was read and nothing was found', () => {
    expect(sheet('calves', INPUTS, {}).view.everTrained).toBe(false);
    expect(sheet('calves', INPUTS, { calves: '2026-09-30' }).view.everTrained).toBe(true);
    // Not read is not "never".
    expect(sheet('calves', INPUTS, null).view.everTrained).toBeNull();
    expect(sheet('chest', INPUTS, null).view.everTrained).toBe(true);
  });
});
