import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS, type MuscleGroup } from '../../core/model';
import {
  exerciseDays,
  gymPerformanceOverSpan,
  percentChange,
  type ExerciseDay,
  type MusclePerformance,
} from '../../core/gym/performance';
import {
  HELD_DOWN_TO_PERCENT,
  HELD_UP_TO_PERCENT,
  MIN_EXERCISE_DAYS,
  UNEVEN_BEYOND_POINTS,
  exerciseDayCounts,
  exerciseGroups,
  isUneven,
  muscleStateOf,
  roundShown,
  shownChangeText,
  shownPercent,
  shownPerformance,
  shownTrend,
  shownTrendOfChange,
} from './muscleState';

/**
 * The one place a number becomes a state (contract §7, §14).
 *
 * Three rules are held here at their edges: the rounding (half away from
 * zero, both ways), the band (the state follows the shown whole percent:
 * −2 … +1 is held — one-sided since STOP Kurve, D180), and how much there
 * must be to compare (three exercise days in the range and an exercise on
 * two days). Presentation only — the ratio itself is untouched.
 */

const measured = (ratio: number): MusclePerformance =>
  ({ muscle: 'calves', status: 'measured', ratio, exercises: 1, compared: 1, latestScore: 1 }) as MusclePerformance;

const NBSP = '\u00A0';
const MINUS = '\u2212';

describe('the rounding: half away from zero, in both directions', () => {
  it.each([
    [-3.5, -4],
    [-3, -3],
    [-2.5, -3],
    [-2.49, -2],
    [-2, -2],
    [-0.5, -1],
    [-0.49, 0],
    [0, 0],
    [0.49, 0],
    [0.5, 1],
    [2, 2],
    [2.49, 2],
    [2.5, 3],
    [3, 3],
    [11.5, 12],
  ])('%s %% is shown as %s %%', (change, shown) => {
    expect(roundShown(change)).toBe(shown);
  });

  it('rounds a fall exactly as it rounds a rise of the same size', () => {
    for (const change of [0.5, 1.5, 2.5, 3.5, 7.5, 12.5]) {
      expect(roundShown(-change)).toBe(-roundShown(change)!);
    }
  });

  it('never yields a negative zero', () => {
    expect(Object.is(roundShown(-0.3), 0)).toBe(true);
    expect(Object.is(roundShown(-0), 0)).toBe(true);
    expect(shownChangeText(-0.3)).toBe(`0${NBSP}%`);
  });

  it('reads a ratio that is +2.5 % in floating point as +2.5 %', () => {
    // 41/40: `(1.025 − 1) × 100` is 2.4999999999999911, and it is +3 %.
    expect((1.025 - 1) * 100).toBeLessThan(2.5);
    expect(shownPercent(41 / 40)).toBe(3);
    expect(shownPercent(39 / 40)).toBe(-3);
    // Well inside the band it stays inside.
    expect(shownPercent(1.0249)).toBe(2);
    expect(shownPercent(0.9751)).toBe(-2);
  });

  it('has nothing to show where there is no ratio', () => {
    expect(shownPercent(null)).toBeNull();
    expect(shownTrend(null)).toBeNull();
    expect(shownTrendOfChange(null)).toBeNull();
    expect(shownChangeText(null)).toBeNull();
  });
});

describe('the band: the state follows the shown figure', () => {
  it('is one-sided: a rise counts from +2 %, a fall from −3 % (D180)', () => {
    // Until STOP Kurve it was two whole percent wide on either side (D153).
    expect([HELD_DOWN_TO_PERCENT, HELD_UP_TO_PERCENT]).toEqual([2, 1]);
  });

  it.each([
    [-12, `${MINUS}12${NBSP}%`, 'declined'],
    [-3, `${MINUS}3${NBSP}%`, 'declined'],
    [-2.5, `${MINUS}3${NBSP}%`, 'declined'],
    [-2.4, `${MINUS}2${NBSP}%`, 'unchanged'],
    [-2, `${MINUS}2${NBSP}%`, 'unchanged'],
    [-1.5, `${MINUS}2${NBSP}%`, 'unchanged'],
    [-1, `${MINUS}1${NBSP}%`, 'unchanged'],
    [-0.3, `0${NBSP}%`, 'unchanged'],
    [0, `0${NBSP}%`, 'unchanged'],
    [0.4, `0${NBSP}%`, 'unchanged'],
    [1, `+1${NBSP}%`, 'unchanged'],
    [1.4, `+1${NBSP}%`, 'unchanged'],
    [1.5, `+2${NBSP}%`, 'improved'],
    [2, `+2${NBSP}%`, 'improved'],
    [2.4, `+2${NBSP}%`, 'improved'],
    [2.5, `+3${NBSP}%`, 'improved'],
    [3, `+3${NBSP}%`, 'improved'],
    [26, `+26${NBSP}%`, 'improved'],
  ])('a change of %s %% prints "%s" and reads %s', (change, text, trend) => {
    expect(shownChangeText(change)).toBe(text);
    expect(shownTrendOfChange(change)).toBe(trend);
  });

  it('figure and state can never part: every shown figure has exactly one state', () => {
    for (let basis = -2000; basis <= 2000; basis += 1) {
      const change = basis / 100;
      const shown = roundShown(change)!;
      const expected = shown >= 2 ? 'improved' : shown <= -3 ? 'declined' : 'unchanged';
      expect(shownTrendOfChange(change), `${change} %`).toBe(expected);
    }
  });

  it('reads a ratio by the same band', () => {
    expect(shownTrend(1.004)).toBe('unchanged');
    expect(shownTrend(1.014)).toBe('unchanged');
    expect(shownTrend(1.02)).toBe('improved');
    expect(shownTrend(0.98)).toBe('unchanged');
    expect(shownTrend(1.03)).toBe('improved');
    expect(shownTrend(0.97)).toBe('declined');
  });

  it('one rep more at the same weight is progress at every rep count, and one rep less a decline only up to ten reps', () => {
    // The strength score of Stage 5b: load × (1 + reps ÷ 30). The owner's aim
    // at STOP Kurve was the left column, up to twelve reps; the right column
    // is what the old band did too.
    const step = (from: number, to: number): number => ((30 + to) / (30 + from) - 1) * 100;
    for (let reps = 1; reps <= 20; reps += 1) {
      expect(shownTrendOfChange(step(reps, reps + 1)), `${reps} → ${reps + 1}`).toBe('improved');
    }
    for (let reps = 2; reps <= 10; reps += 1) {
      expect(shownTrendOfChange(step(reps, reps - 1)), `${reps} → ${reps - 1}`).toBe('declined');
    }
    for (let reps = 11; reps <= 20; reps += 1) {
      expect(shownTrendOfChange(step(reps, reps - 1)), `${reps} → ${reps - 1}`).toBe('unchanged');
    }
    // The two steps the old band told apart: ten to eleven read "+3 %", eleven to twelve "Gehalten".
    expect([shownChangeText(step(10, 11)), shownChangeText(step(11, 12))]).toEqual([`+3${NBSP}%`, `+2${NBSP}%`]);
  });
});

describe('enough to compare: three exercise days and an exercise on two days', () => {
  it('needs three exercise days', () => {
    expect(MIN_EXERCISE_DAYS).toBe(3);
  });

  it('a compared group with two exercise days has too little, whatever its ratio', () => {
    expect(muscleStateOf(measured(1.2), 2)).toBe('awaitingBaseline');
    expect(muscleStateOf(measured(0.8), 2)).toBe('awaitingBaseline');
    expect(muscleStateOf(measured(1), 2)).toBe('awaitingBaseline');
    expect(muscleStateOf(measured(1.2), 0)).toBe('awaitingBaseline');
  });

  it('with three it states the direction of its figure', () => {
    expect(muscleStateOf(measured(1.2), 3)).toBe('improved');
    expect(muscleStateOf(measured(0.8), 3)).toBe('declined');
    // The band is one-sided (D180): +1 % and −2 % are held, +2 % is a rise, −3 % a fall.
    expect(muscleStateOf(measured(1.01), 3)).toBe('unchanged');
    expect(muscleStateOf(measured(1.02), 3)).toBe('improved');
    expect(muscleStateOf(measured(0.98), 3)).toBe('unchanged');
    expect(muscleStateOf(measured(1.03), 3)).toBe('improved');
    expect(muscleStateOf(measured(0.97), 3)).toBe('declined');
  });

  it('no exercise with two days is too little, however many exercise days there are', () => {
    const noBaseline: MusclePerformance = { ...measured(1), status: 'insufficientBaseline', ratio: null };
    expect(muscleStateOf(noBaseline, 1)).toBe('awaitingBaseline');
    expect(muscleStateOf(noBaseline, 3)).toBe('awaitingBaseline');
    expect(muscleStateOf(noBaseline, 9)).toBe('awaitingBaseline');
  });

  it('an untrained group is untrained, not "too little"', () => {
    expect(muscleStateOf({ ...measured(1), status: 'noData', ratio: null }, 0)).toBe('noData');
  });
});

/* ── Exercise days, counted from the history ─────────────────────────────── */

const set = (reps: number, kg: number, order = 0) => ({ id: `set_${reps}x${kg}_${order}`, reps, weightGrams: kg * 1000, order });
const day = (
  date: string,
  exerciseId: string,
  muscles: MuscleGroup[],
  primary: MuscleGroup[] | undefined,
  kg: number,
) => ({
  date,
  exerciseId,
  muscles,
  ...(primary === undefined ? {} : { primaryMuscles: primary }),
  sets: [set(5, kg)],
});
const daysOf = (inputs: ReturnType<typeof day>[]): ExerciseDay[] => exerciseDays(inputs);

describe('exercise days', () => {
  it('counts one exercise on one day, for every group it gives a weight', () => {
    // The contract's example: bench and incline on Monday, bench on Thursday.
    const days = daysOf([
      day('2026-06-01', 'bench', ['chest', 'triceps'], ['chest'], 60),
      day('2026-06-01', 'incline', ['chest', 'shoulders'], ['chest'], 40),
      day('2026-06-04', 'bench', ['chest', 'triceps'], ['chest'], 62.5),
    ]);
    const counts = exerciseDayCounts(days);
    expect(counts.chest).toBe(3); // three exercise days on two calendar days
    expect(counts.triceps).toBe(2);
    expect(counts.shoulders).toBe(1);
    expect(counts.calves).toBe(0);
    expect(Object.keys(counts).sort()).toEqual([...MUSCLE_GROUPS].sort());
  });

  it('reads the roles the sets were logged under, and a pre-roles day as it was logged', () => {
    const days = daysOf([
      // No roles recorded: every listed group shares the exercise.
      day('2026-06-01', 'row', ['back', 'biceps'], undefined, 50),
      // A role naming a group the exercise does not list adds none.
      day('2026-06-02', 'curl', ['biceps'], ['biceps', 'forearms'], 15),
    ]);
    const counts = exerciseDayCounts(days);
    expect(counts.back).toBe(1);
    expect(counts.biceps).toBe(2);
    expect(counts.forearms).toBe(0);
  });

  it('follows the domain when an exercise\'s mapping changes inside the range', () => {
    // The press was logged for chest and triceps three times, then for the
    // chest alone. `musclePerformance()` reads an exercise's groups from its
    // latest day: the triceps are untrained there, and have no exercise days
    // here either — never "untrained, with three exercise days".
    const dropped = daysOf([
      day('2026-06-01', 'press', ['chest', 'triceps'], ['chest'], 60),
      day('2026-06-03', 'press', ['chest', 'triceps'], ['chest'], 61),
      day('2026-06-05', 'press', ['chest', 'triceps'], ['chest'], 62),
      day('2026-06-08', 'press', ['chest'], ['chest'], 63),
    ]);
    expect(gymPerformanceOverSpan(dropped).muscles.find((m) => m.muscle === 'triceps')?.status).toBe('noData');
    expect(exerciseDayCounts(dropped)).toMatchObject({ chest: 4, triceps: 0 });

    // The other way round: the triceps were added on the last day. The
    // domain lets the whole span of the press speak for them, and the count
    // is the days that figure rests on — never a figure on days that were
    // not counted for it.
    const added = daysOf([
      day('2026-06-01', 'press', ['chest'], ['chest'], 60),
      day('2026-06-03', 'press', ['chest'], ['chest'], 61),
      day('2026-06-05', 'press', ['chest', 'triceps'], ['chest'], 62),
    ]);
    expect(gymPerformanceOverSpan(added).muscles.find((m) => m.muscle === 'triceps')?.status).toBe('measured');
    expect(exerciseDayCounts(added)).toMatchObject({ chest: 3, triceps: 3 });
    expect(shownPerformance(added, gymPerformanceOverSpan(added)).muscles.find((m) => m.muscle === 'triceps'))
      .toMatchObject({ state: 'improved', exerciseDays: 3, compared: true });
  });

  it('never parts from the domain: every count is the days of the exercises the domain gives the group', () => {
    // Every pairing of two mappings over three days of one exercise, with
    // and without roles, beside a second exercise that reaches the triceps
    // on its own. The expected count is worked out here, independently:
    // the days of every exercise whose LATEST mapping names the group.
    const mappings: [MuscleGroup[], MuscleGroup[] | undefined][] = [
      [['chest'], ['chest']],
      [['chest', 'triceps'], ['chest']],
      [['chest', 'triceps'], undefined],
      [['triceps', 'shoulders'], ['triceps']],
      [['back', 'biceps', 'forearms'], ['back']],
    ];
    let pairings = 0;
    for (const [early, earlyPrimary] of mappings) {
      for (const [late, latePrimary] of mappings) {
        pairings += 1;
        const history = daysOf([
          day('2026-06-01', 'lift', early, earlyPrimary, 50),
          day('2026-06-03', 'lift', early, earlyPrimary, 52),
          day('2026-06-05', 'lift', late, latePrimary, 54),
          day('2026-06-02', 'pushdown', ['triceps'], ['triceps'], 30),
          day('2026-06-04', 'pushdown', ['triceps'], ['triceps'], 31),
        ]);
        const counts = exerciseDayCounts(history);
        const groups = exerciseGroups(history);
        expect([...groups.get('lift')!].sort(), `${early} → ${late}`).toEqual([...late].sort());
        const domain = gymPerformanceOverSpan(history);
        for (const muscle of MUSCLE_GROUPS) {
          const expected = (late.includes(muscle) ? 3 : 0) + (muscle === 'triceps' ? 2 : 0);
          expect(counts[muscle], `${muscle}: ${early} → ${late}`).toBe(expected);
          // And the domain agrees on who is trained at all.
          const status = domain.muscles.find((entry) => entry.muscle === muscle)!.status;
          expect(counts[muscle] > 0, `${muscle}: ${early} → ${late}`).toBe(status !== 'noData');
        }
      }
    }
    expect(pairings).toBe(25);
  });

  it('a set that cannot be scored is not an exercise day', () => {
    const days = exerciseDays([
      { date: '2026-06-01', exerciseId: 'bench', muscles: ['chest'], primaryMuscles: ['chest'], sets: [set(0, 60)] },
    ]);
    expect(exerciseDayCounts(days).chest).toBe(0);
  });
});

describe('what the screen shows for a range', () => {
  const days = daysOf([
    // Chest: bench on three days, +10 % over the span → improved, 3 exercise days.
    day('2026-06-01', 'bench', ['chest'], ['chest'], 60),
    day('2026-06-04', 'bench', ['chest'], ['chest'], 62),
    day('2026-06-08', 'bench', ['chest'], ['chest'], 66),
    // Quadriceps: squat on two days, +20 % — a ratio, but two exercise days.
    day('2026-06-02', 'squat', ['quadriceps'], ['quadriceps'], 100),
    day('2026-06-09', 'squat', ['quadriceps'], ['quadriceps'], 120),
    // Back: three different exercises once each — three exercise days, none on two days.
    day('2026-06-02', 'row', ['back'], ['back'], 50),
    day('2026-06-05', 'pulldown', ['back'], ['back'], 55),
    day('2026-06-09', 'pullover', ['back'], ['back'], 20),
    // Biceps: curl on three days, +1 % → held.
    day('2026-06-03', 'curl', ['biceps'], ['biceps'], 100),
    day('2026-06-06', 'curl', ['biceps'], ['biceps'], 100),
    day('2026-06-10', 'curl', ['biceps'], ['biceps'], 101),
    // Calves: raise on three days, −10 % → declined.
    day('2026-06-03', 'raise', ['calves'], ['calves'], 100),
    day('2026-06-06', 'raise', ['calves'], ['calves'], 95),
    day('2026-06-10', 'raise', ['calves'], ['calves'], 90),
  ]);
  const performance = gymPerformanceOverSpan(days);
  const shown = shownPerformance(days, performance);
  const of = (muscle: MuscleGroup) => shown.muscles.find((entry) => entry.muscle === muscle)!;

  it('gives every group its state by the one rule', () => {
    expect(of('chest')).toMatchObject({ state: 'improved', exerciseDays: 3, compared: true });
    expect(of('quadriceps')).toMatchObject({ state: 'awaitingBaseline', exerciseDays: 2, compared: true, change: null });
    expect(of('back')).toMatchObject({ state: 'awaitingBaseline', exerciseDays: 3, compared: false, change: null });
    expect(of('biceps')).toMatchObject({ state: 'unchanged', exerciseDays: 3 });
    expect(of('calves')).toMatchObject({ state: 'declined', exerciseDays: 3 });
    expect(of('core')).toMatchObject({ state: 'noData', exerciseDays: 0, change: null });
    for (const entry of shown.muscles) {
      const domain = performance.muscles.find((m) => m.muscle === entry.muscle)!;
      expect(entry.state).toBe(muscleStateOf(domain, entry.exerciseDays));
    }
  });

  it('"gewertet" is exactly the groups that print a figure', () => {
    expect(shown.rated).toEqual(['chest', 'biceps', 'calves']);
    expect(shown.muscles.filter((entry) => entry.change !== null).map((entry) => entry.muscle)).toEqual(shown.rated);
    // The domain compared four groups; one of them rests on two exercise days.
    expect(performance.measured).toEqual(['chest', 'biceps', 'quadriceps', 'calves']);
  });

  it('the trend above is the equal-weighted mean of the rated groups, with a state by the band', () => {
    const ratios = [66 / 60, 101 / 100, 90 / 100];
    const mean = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
    expect(shown.ratio).toBeCloseTo(mean, 12);
    expect(shown.change).toBeCloseTo((mean - 1) * 100, 10);
    expect(shown.trend).toBe(shownTrend(mean));
    expect(shown.trend).toBe('unchanged'); // +0.33 %
    // The domain's own mean includes the squat's +20 % and is untouched.
    expect(performance.ratio).toBeCloseTo((mean * 3 + 1.2) / 4, 12);
  });

  it('with no rated group there is no trend and no figure', () => {
    const few = daysOf([
      day('2026-06-02', 'squat', ['quadriceps'], ['quadriceps'], 100),
      day('2026-06-09', 'squat', ['quadriceps'], ['quadriceps'], 120),
    ]);
    const none = shownPerformance(few, gymPerformanceOverSpan(few));
    expect(none.rated).toEqual([]);
    expect(none.ratio).toBeNull();
    expect(none.change).toBeNull();
    expect(none.trend).toBeNull();
  });

  it('does not change what it is given', () => {
    const before = JSON.stringify(performance);
    shownPerformance(days, performance);
    expect(JSON.stringify(performance)).toBe(before);
  });
});

describe('"uneinheitlich": the exercises of a group more than ten shown points apart', () => {
  it('is not said at exactly ten points', () => {
    expect(isUneven([8, -2])).toBe(false);
    expect(isUneven([10, 0])).toBe(false);
    expect(isUneven([0, -10])).toBe(false);
  });

  it('is said from eleven points on', () => {
    expect(isUneven([9, -2])).toBe(true);
    expect(isUneven([11, 0])).toBe(true);
    expect(isUneven([1, -10])).toBe(true);
  });

  it('reads the figures as they are shown, not their decimals', () => {
    // +8.4 and −2.4 are 10.8 apart and stand on screen as +8 % and −2 %.
    expect(isUneven([8.4, -2.4])).toBe(false);
    // +8.5 and −2.5 round away from zero, to +9 % and −3 %.
    expect(isUneven([8.5, -2.5])).toBe(true);
    // 10.4 points on screen are ten.
    expect(isUneven([10.4, 0.4])).toBe(false);
    // The rounding is the one of every figure: 41/40 is +2.5 % and shows as +3 %.
    expect(isUneven([percentChange(41 / 40), -8])).toBe(true);
    expect(isUneven([percentChange(41 / 40), -7])).toBe(false);
  });

  it('is never said of a single exercise, nor of none', () => {
    expect(isUneven([40])).toBe(false);
    expect(isUneven([-40])).toBe(false);
    expect(isUneven([])).toBe(false);
  });

  it('leaves out an exercise with nothing to compare', () => {
    expect(isUneven([12, null])).toBe(false);
    expect(isUneven([null, null])).toBe(false);
    expect(isUneven([12, null, -1])).toBe(true);
  });

  it('looks at the widest pair among several', () => {
    expect(isUneven([3, 5, 9, 13])).toBe(false);
    expect(isUneven([3, 5, 9, 14])).toBe(true);
  });

  it('is the rule of the contract: ten points', () => {
    expect(UNEVEN_BEYOND_POINTS).toBe(10);
  });
});
