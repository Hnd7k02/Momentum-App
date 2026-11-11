import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS, type MuscleGroup } from '../../core/model';
import { toDateKey } from '../../core/dates';
import {
  exerciseDays,
  gymPerformance,
  gymPerformanceOverSpan,
  latestComparisons,
  percentChange,
  type ExerciseDayInput,
} from '../../core/gym/performance';
import type { GymHistory } from '../../storage/services/gymService';
import { exerciseDayCounts, muscleStateOf } from './muscleState';
import { SPARKLINE_POINTS, muscleTrend, toMuscleAnalytics } from './muscleAnalytics';

/** A history the way loadGymHistory() builds one, from in-memory days. */
function historyOf(inputs: ExerciseDayInput[], names: Record<string, string> = {}): GymHistory {
  const days = exerciseDays(inputs);
  return {
    days,
    comparisons: latestComparisons(days),
    recent: gymPerformance(days),
    overall: gymPerformanceOverSpan(days),
    names: new Map(Object.entries(names)),
    awaitingBodyweight: [],
  };
}

const set = (reps: number, kg: number, order = 0) => ({ id: `set_${reps}x${kg}_${order}`, reps, weightGrams: kg * 1000, order });
const day = (
  date: string, exerciseId: string, muscles: MuscleGroup[], primary: MuscleGroup[], sets: ReturnType<typeof set>[],
): ExerciseDayInput => ({ date, exerciseId, muscles, primaryMuscles: primary, sets });

/**
 * Bench four times, squat twice, a leg extension and a curl once. Chest is
 * reached by bench only; the quadriceps have three exercise days, the
 * hamstrings and the core the squat's two.
 */
const INPUTS: ExerciseDayInput[] = [
  day('2026-06-01', 'ex_bench', ['chest', 'triceps', 'shoulders'], ['chest'], [set(5, 60), set(5, 62.5, 1)]),
  day('2026-06-03', 'ex_squat', ['quadriceps', 'hamstringsGlutes', 'core'], ['quadriceps'], [set(5, 80)]),
  day('2026-06-03', 'ex_legext', ['quadriceps'], ['quadriceps'], [set(10, 40)]),
  day('2026-06-05', 'ex_bench', ['chest', 'triceps', 'shoulders'], ['chest'], [set(6, 62.5)]),
  day('2026-06-08', 'ex_bench', ['chest', 'triceps', 'shoulders'], ['chest'], [set(5, 65)]),
  day('2026-06-10', 'ex_squat', ['quadriceps', 'hamstringsGlutes', 'core'], ['quadriceps'], [set(5, 85)]),
  day('2026-06-12', 'ex_bench', ['chest', 'triceps', 'shoulders'], ['chest'], [set(6, 65)]),
  day('2026-06-12', 'ex_curl', ['biceps', 'forearms'], ['biceps'], [set(10, 15)]),
];
const NAMES = { ex_bench: 'Bench Press', ex_squat: 'Squat', ex_legext: 'Leg Extension', ex_curl: 'Biceps Curl' };

describe('toMuscleAnalytics', () => {
  const history = historyOf(INPUTS, NAMES);
  const views = toMuscleAnalytics(history);
  const view = (id: MuscleGroup) => views.find((v) => v.id === id)!;

  it('covers all ten groups in domain order', () => {
    expect(views.map((v) => v.id)).toEqual([...MUSCLE_GROUPS]);
  });

  it('state and delta are the row\'s own: muscleStateOf() and percentChange() over the range\'s span figure', () => {
    const counts = exerciseDayCounts(history.days);
    for (const entry of history.overall.muscles) {
      const row = view(entry.muscle);
      expect(row.state).toBe(muscleStateOf(entry, counts[entry.muscle]));
      expect(row.exerciseDays).toBe(counts[entry.muscle]);
      // A figure only where the group states a trend (contract §7).
      const rated = row.state === 'improved' || row.state === 'unchanged' || row.state === 'declined';
      expect(row.delta).toBe(rated ? percentChange(entry.ratio) : null);
    }
  });

  it('a group with too little to compare has no figure and no line, whatever its ratio', () => {
    // The squat was done twice: the domain has a ratio for the hamstrings
    // and the core, on two exercise days.
    for (const id of ['hamstringsGlutes', 'core'] as const) {
      expect(history.overall.muscles.find((entry) => entry.muscle === id)).toMatchObject({ status: 'measured' });
      expect(view(id)).toMatchObject({
        state: 'awaitingBaseline', dataState: 'awaiting-baseline', delta: null, trend: [], observations: 0,
        exerciseDays: 2, compared: true, lastTrainedAt: '2026-06-10',
      });
      // The full series is still there for whoever asks for it.
      expect(muscleTrend(history.days, id)).toHaveLength(1);
    }
  });

  it('the trend is the over-span figure as of each training day, and its last point is the row delta', () => {
    const chest = view('chest');
    // 2026-06-01 has no baseline and yields no point; then three comparable days.
    expect(chest.trend.map((p) => p.date)).toEqual(['2026-06-05', '2026-06-08', '2026-06-12']);
    // 6 × 62.5 = 375 vs 5 × 62.5 = 312.5 on day one → +20 %; then 5 × 65 = 325 → +4 %; then 6 × 65 = 390 → +24.8 %.
    expect(chest.trend.map((p) => Math.round(p.value * 100) / 100)).toEqual([20, 4, 24.8]);
    expect(chest.trend[chest.trend.length - 1]!.value).toBe(chest.delta);
    expect(chest.dataState).toBe('measured');
    for (const v of views) {
      if (v.trend.length > 0) expect(v.trend[v.trend.length - 1]!.value).toBe(v.delta);
    }
  });

  it('is deterministic: the same history produces the same views, run after run', () => {
    const again = toMuscleAnalytics(historyOf(INPUTS, NAMES));
    expect(JSON.stringify(again)).toBe(JSON.stringify(views));
    expect(JSON.stringify(toMuscleAnalytics(history))).toBe(JSON.stringify(views));
  });

  it('a group nobody trained has no history and no fabricated points', () => {
    const calves = view('calves');
    expect(calves).toMatchObject({ state: 'noData', dataState: 'no-history', delta: null, lastTrainedAt: null, trend: [], observations: 0, latestExerciseLabel: null, latestExerciseIds: [] });
  });

  it('classifies all four data states', () => {
    expect(view('calves').dataState).toBe('no-history');
    // Curl once: trained, nothing to compare against — not "no history".
    expect(view('biceps')).toMatchObject({ state: 'awaitingBaseline', dataState: 'awaiting-baseline', delta: null, trend: [], observations: 0, exerciseDays: 1, compared: false, lastTrainedAt: '2026-06-12' });
    // Squat twice and a leg extension: three exercise days and one
    // comparable observation, a value but not a line.
    expect(view('quadriceps')).toMatchObject({ dataState: 'single-observation', observations: 1 });
    expect(view('quadriceps').trend).toHaveLength(1);
    expect(view('quadriceps').trend[0]).toEqual({ date: '2026-06-10', value: percentChange(425000 / 400000) });
    expect(view('chest').dataState).toBe('measured');
  });

  it('a row never contradicts itself when an exercise\'s mapping changes inside the range', () => {
    // The press counted for chest and triceps three times, then for the
    // chest alone. The domain reads an exercise by its latest mapping: the
    // triceps are untrained in this range — and the row says nothing else.
    const dropped = historyOf([
      day('2026-06-01', 'ex_press', ['chest', 'triceps'], ['chest'], [set(5, 60)]),
      day('2026-06-03', 'ex_press', ['chest', 'triceps'], ['chest'], [set(5, 61)]),
      day('2026-06-05', 'ex_press', ['chest', 'triceps'], ['chest'], [set(5, 62)]),
      day('2026-06-08', 'ex_press', ['chest'], ['chest'], [set(5, 63)]),
    ]);
    const triceps = toMuscleAnalytics(dropped).find((v) => v.id === 'triceps')!;
    expect(triceps).toMatchObject({
      state: 'noData', dataState: 'no-history', delta: null, exerciseDays: 0,
      lastTrainedAt: null, trend: [], latestExerciseLabel: null, latestExerciseIds: [],
    });
    expect(toMuscleAnalytics(dropped).find((v) => v.id === 'chest')).toMatchObject({ exerciseDays: 4, lastTrainedAt: '2026-06-08' });

    // The other way round: the triceps were added on the last day. The
    // domain's figure for them is the press's whole span; the row counts
    // the same days, and its recency is the press's latest day.
    const added = historyOf([
      day('2026-06-01', 'ex_press', ['chest'], ['chest'], [set(5, 60)]),
      day('2026-06-03', 'ex_press', ['chest'], ['chest'], [set(5, 61)]),
      day('2026-06-05', 'ex_press', ['chest', 'triceps'], ['chest'], [set(5, 62)]),
    ]);
    const gained = toMuscleAnalytics(added).find((v) => v.id === 'triceps')!;
    expect(gained).toMatchObject({ state: 'improved', exerciseDays: 3, lastTrainedAt: '2026-06-05', latestExerciseIds: ['ex_press'] });
    expect(gained.delta).toBe(percentChange(310000 / 300000));
    // Its line ends on its figure, like every row's.
    expect(gained.trend[gained.trend.length - 1]!.value).toBe(gained.delta);
    // In every history, with or without such a change: a recency exactly
    // when the group has exercise days, and "untrained" exactly when not.
    for (const history of [dropped, added, historyOf(INPUTS, NAMES)]) {
      for (const view of toMuscleAnalytics(history)) {
        expect(view.lastTrainedAt !== null, view.id).toBe(view.exerciseDays > 0);
        expect(view.state === 'noData', view.id).toBe(view.exerciseDays === 0);
      }
    }
  });

  it('gaps stay gaps: only training days appear, ascending, nothing between them', () => {
    const dates = view('chest').trend.map((p) => p.date);
    expect(dates).toEqual([...dates].sort());
    expect(dates).not.toContain('2026-06-03');
    expect(dates).not.toContain('2026-06-10');
    expect(view('chest').trend.every((p) => Number.isFinite(p.value))).toBe(true);
  });

  it('a late-evening or after-midnight local session belongs to its local day', () => {
    // 00:30 local in Europe/Berlin is still the previous day in UTC; the set
    // carries the local day the app wrote at logging time, and the adapter
    // reads that key and never re-buckets through toISOString().
    const logged = new Date(2026, 5, 15, 0, 30);
    const localDay = toDateKey(logged);
    expect(localDay).toBe('2026-06-15');
    expect(logged.toISOString().slice(0, 10)).toBe('2026-06-14');
    const late = historyOf([day(localDay, 'ex_curl', ['biceps', 'forearms'], ['biceps'], [set(10, 15)])]);
    expect(toMuscleAnalytics(late).find((v) => v.id === 'biceps')!.lastTrainedAt).toBe('2026-06-15');
  });

  it('lastTrainedAt is the latest day an exercise reaching the group was recorded', () => {
    expect(view('chest').lastTrainedAt).toBe('2026-06-12');
    expect(view('triceps').lastTrainedAt).toBe('2026-06-12');
    expect(view('quadriceps').lastTrainedAt).toBe('2026-06-10');
    expect(view('core').lastTrainedAt).toBe('2026-06-10');
    expect(view('forearms').lastTrainedAt).toBe('2026-06-12');
  });

  it('names the latest exercise only when the latest day had exactly one reaching the group', () => {
    expect(view('chest').latestExerciseLabel).toBe('Bench Press');
    expect(view('biceps').latestExerciseLabel).toBe('Biceps Curl');
    expect(view('quadriceps').latestExerciseLabel).toBe('Squat');
    // Two chest exercises on one day: no domain rule picks one, so null — but both ids are kept.
    const tie = historyOf([
      ...INPUTS,
      day('2026-06-12', 'ex_fly', ['chest'], ['chest'], [set(12, 12)]),
    ], { ...NAMES, ex_fly: 'Cable Fly' });
    const chest = toMuscleAnalytics(tie).find((v) => v.id === 'chest')!;
    expect(chest.latestExerciseLabel).toBeNull();
    expect(chest.latestExerciseIds).toEqual(['ex_bench', 'ex_fly']);
    // A name the catalogue no longer has falls back to the id, never to nothing.
    expect(toMuscleAnalytics(historyOf(INPUTS)).find((v) => v.id === 'chest')!.latestExerciseLabel).toBe('ex_bench');
  });

  it('caps the compact trend at the most recent valid points and keeps the full count', () => {
    const many: ExerciseDayInput[] = [];
    for (let i = 0; i < 20; i += 1) {
      const date = `2026-07-${String(i + 1).padStart(2, '0')}`;
      many.push(day(date, 'ex_bench', ['chest', 'triceps'], ['chest'], [set(5, 60 + i)]));
    }
    const chest = toMuscleAnalytics(historyOf(many)).find((v) => v.id === 'chest')!;
    expect(chest.observations).toBe(19);
    expect(chest.trend).toHaveLength(SPARKLINE_POINTS);
    expect(chest.trend[chest.trend.length - 1]!.date).toBe('2026-07-20');
    expect(muscleTrend(historyOf(many).days, 'chest')).toHaveLength(19);
    expect(chest.trend[chest.trend.length - 1]!.value).toBe(chest.delta);
  });

  it('does not mutate the history it reads', () => {
    const snapshot = JSON.stringify([...history.days]);
    const frozen = { ...history, days: history.days.map((d) => Object.freeze({ ...d, muscles: Object.freeze([...d.muscles]) })) } as GymHistory;
    toMuscleAnalytics(frozen);
    expect(JSON.stringify(history.days)).toBe(snapshot);
  });
});
