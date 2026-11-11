import { describe, expect, it } from 'vitest';
import { exerciseDays, gymPerformanceOverSpan, type ExerciseDayInput } from '../../core/gym/performance';
import { createTranslator } from '../../i18n';
import { de } from '../../i18n/de';
import { exerciseDaysText, muscleGap, muscleGapText } from './muscleGap';
import { latestSessionDay } from './useGymHistory';

/**
 * Why Muskelgruppen has nothing to show (STOP 6b).
 *
 * The screen reads 30 or 90 days back from today. A device whose last Gym
 * session lay 40 days back showed a year's figure on the hub and, here,
 * "Noch nicht trainiert — nach deiner ersten Session …": the first-session
 * text for someone with months of sessions. These hold the five absences
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
    // The 90-day range begins on 14 August: the session of 2 October that
    // lies outside the 30 days is inside it, and one of 13 August is not.
    expect(muscleGap(historyOf([]), '2026-10-02', TODAY, 90)?.kind).toBe('unscored');
    expect(muscleGap(historyOf([]), '2026-08-14', TODAY, 90)?.kind).toBe('unscored');
    const ninety = muscleGap(historyOf([]), '2026-08-13', TODAY, 90);
    expect(ninety).toEqual({ kind: 'outsideRange', lastSession: '2026-08-13', daysAgo: 90 });
    expect(text(ninety!, 90).title).toBe('Kein Training in den letzten 90 Tagen');
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
      title: 'Zu wenig Vergleichsdaten',
      hint: 'Ein Leistungstrend braucht dieselbe Übung an zwei Tagen in den letzten 30 Tagen.',
    });
  });

  it('explains too few exercise days: a comparison on two days is not yet a trend (contract §7)', () => {
    const history = historyOf([day('2026-11-02', 100000), day('2026-11-09', 105000)]);
    // The domain has compared the group; the screen does not rate it yet.
    expect(history.overall.measured.length).toBeGreaterThan(0);
    const gap = muscleGap(history, '2026-11-09', TODAY, 30);
    expect(gap).toEqual({ kind: 'tooFewDays', most: 2 });
    expect(text(gap!)).toEqual({
      title: 'Zu wenig Vergleichsdaten',
      hint: '2 Übungstage in den letzten 30 Tagen. Ab dem dritten zeigt Momentum einen Leistungstrend.',
    });
    expect(text(gap!, 90).hint).toBe('2 Übungstage in den letzten 90 Tagen. Ab dem dritten zeigt Momentum einen Leistungstrend.');
  });

  it('has nothing to explain once a group states a trend', () => {
    const history = historyOf([day('2026-11-02', 100000), day('2026-11-05', 102000), day('2026-11-09', 105000)]);
    expect(muscleGap(history, '2026-11-09', TODAY, 30)).toBeNull();
  });
});

describe('what a group with too little to compare is missing', () => {
  const said = (exerciseDays: number, compared: boolean, rangeDays = 30) =>
    exerciseDaysText(exerciseDays, compared, { t: createTranslator('de'), rangeDays });

  it('names the exercise days in the range and from when a trend appears', () => {
    expect(said(1, false)).toBe('1 Übungstag in den letzten 30 Tagen. Ab dem dritten zeigt Momentum einen Leistungstrend.');
    expect(said(2, true)).toBe('2 Übungstage in den letzten 30 Tagen. Ab dem dritten zeigt Momentum einen Leistungstrend.');
    expect(said(2, true, 90)).toContain('in den letzten 90 Tagen');
  });

  it('with three days and no exercise on two of them, says that instead', () => {
    expect(said(3, false)).toBe('3 Übungstage in den letzten 30 Tagen. Ein Leistungstrend braucht dieselbe Übung an zwei Tagen.');
    expect(said(5, false)).not.toContain('Ab dem dritten');
  });

  it('says the same in English', () => {
    const en = createTranslator('en');
    expect(exerciseDaysText(2, true, { t: en, rangeDays: 30 })).toBe(
      '2 exercise days in the last 30 days. From the third, Momentum shows a performance trend.',
    );
    expect(exerciseDaysText(1, false, { t: en, rangeDays: 90 })).toContain('1 exercise day in the last 90 days.');
  });
});

describe('the latest session is the latest day', () => {
  it('takes the newest date, whatever order the sessions were entered in', () => {
    // Yesterday's session entered after today's: stored last, not latest.
    expect(latestSessionDay([{ date: '2026-11-11' }, { date: '2026-11-10' }], TODAY)).toBe('2026-11-11');
    expect(latestSessionDay([{ date: '2026-10-02' }, { date: '2026-09-28' }, { date: '2026-09-30' }], TODAY)).toBe('2026-10-02');
  });

  it('is null before the first session, and ignores a day after today', () => {
    expect(latestSessionDay([], TODAY)).toBeNull();
    expect(latestSessionDay([{ date: '2026-11-12' }], TODAY)).toBeNull();
    expect(latestSessionDay([{ date: '2026-11-12' }, { date: '2026-10-02' }], TODAY)).toBe('2026-10-02');
  });
});
