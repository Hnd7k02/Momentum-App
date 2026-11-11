import { describe, expect, it } from 'vitest';
import { exerciseDays, gymPerformanceOverSpan, type ExerciseDayInput } from '../../core/gym/performance';
import { createTranslator } from '../../i18n';
import { de } from '../../i18n/de';
import { muscleGap, muscleGapText } from './muscleGap';

/**
 * Why Muskelgruppen has nothing to show (STOP 6b).
 *
 * The screen reads 7 or 30 days back from today. A device whose last Gym
 * session lay 40 days back showed a year's figure on the hub and, here,
 * "Noch nicht trainiert — nach deiner ersten Session …": the first-session
 * text for someone with months of sessions. These hold the four absences
 * apart, and that each says what is missing.
 */

const TODAY = '2026-11-11';

const day = (date: string, weightGrams: number, exerciseId = 'ex_squat'): ExerciseDayInput => ({
  date,
  exerciseId,
  muscles: ['quadriceps'],
  primaryMuscles: ['quadriceps'],
  sets: [{ id: `${exerciseId}-${date}`, reps: 5, weightGrams, order: 0 }],
});

const historyOf = (inputs: ExerciseDayInput[], awaitingBodyweight: string[] = []) => {
  const days = exerciseDays(inputs);
  return { days, overall: gymPerformanceOverSpan(days), awaitingBodyweight };
};

const text = (gap: NonNullable<ReturnType<typeof muscleGap>>, rangeDays = 30) =>
  muscleGapText(gap, { t: createTranslator('de'), language: 'de', rangeDays });

describe('an empty range is not "never trained"', () => {
  it('says "never" only when no session was ever logged', () => {
    const gap = muscleGap(historyOf([]), null, TODAY, 30);
    expect(gap).toEqual({ kind: 'never' });
    expect(text(gap!)).toEqual({ title: de['gymHub.muscles.none'], hint: de['gymHub.muscles.noneHint'] });
  });

  it('names the last session when it lies before the range, and how long ago it was', () => {
    // 2 October to 11 November: 40 days. The 30-day range begins on 13 October.
    const gap = muscleGap(historyOf([]), '2026-10-02', TODAY, 30);
    expect(gap).toEqual({ kind: 'outsideRange', lastSession: '2026-10-02', daysAgo: 40 });
    const said = text(gap!);
    expect(said.title).toBe('Kein Training in den letzten 30 Tagen');
    expect(said.hint).toBe('Letzte Session: Freitag, 2. Oktober, vor 40 Tagen. Die Muskelgruppen zeigen nur den gewählten Zeitraum.');
    // Never the first-session text for someone who has trained.
    expect(said.hint).not.toContain('ersten Session');
  });

  it('counts the range as the loader does: today and the days before it', () => {
    // 30 days back from 11 November begin on 13 October.
    expect(muscleGap(historyOf([]), '2026-10-12', TODAY, 30)?.kind).toBe('outsideRange');
    expect(muscleGap(historyOf([]), '2026-10-13', TODAY, 30)?.kind).toBe('unscored');
    // The 7-day range begins on 5 November: a session of 4 November is
    // outside it, though well inside the 30 days.
    const seven = muscleGap(historyOf([]), '2026-11-04', TODAY, 7);
    expect(seven).toEqual({ kind: 'outsideRange', lastSession: '2026-11-04', daysAgo: 7 });
    expect(text(seven!, 7).title).toBe('Kein Training in den letzten 7 Tagen');
  });

  it('says that nothing can be scored when a session lies in the range but no set counts', () => {
    const gap = muscleGap(historyOf([]), '2026-11-10', TODAY, 30);
    expect(gap).toEqual({ kind: 'unscored', bodyweightMissing: false });
    expect(text(gap!)).toEqual({
      title: 'Noch nichts auszuwerten',
      hint: 'In den letzten 30 Tagen ist eine Session eingetragen, aber kein Satz mit Wiederholungen und Gewicht.',
    });
  });

  it('names the missing bodyweight when that is what keeps the sets from counting', () => {
    const gap = muscleGap(historyOf([], ['ex_pull_up']), '2026-11-10', TODAY, 30);
    expect(gap).toEqual({ kind: 'unscored', bodyweightMissing: true });
    expect(text(gap!).hint).toBe(de['gym.bodyweight.needed']);
  });
});

describe('trained in the range', () => {
  it('explains a missing comparison: one day per exercise is a value, not a change', () => {
    const history = historyOf([day('2026-11-09', 100000)]);
    expect(history.overall.measured).toHaveLength(0);
    const gap = muscleGap(history, '2026-11-09', TODAY, 30);
    expect(gap).toEqual({ kind: 'noComparison' });
    expect(text(gap!)).toEqual({
      title: de['gym.progress.noBaseline'],
      hint: 'Ein Vergleich braucht dieselbe Übung an zwei Trainingstagen in den letzten 30 Tagen.',
    });
  });

  it('has nothing to explain once a group is measured', () => {
    const history = historyOf([day('2026-11-02', 100000), day('2026-11-09', 105000)]);
    expect(history.overall.measured.length).toBeGreaterThan(0);
    expect(muscleGap(history, '2026-11-09', TODAY, 30)).toBeNull();
  });
});
