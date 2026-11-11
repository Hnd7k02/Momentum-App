import { addDays, diffInDays, type DateKey } from '../../core/dates';
import type { Language, Translator } from '../../i18n';
import { formatDayAndMonth, formatWeekday } from '../../i18n/format';
import type { GymHistory } from '../../storage/services/gymService';
import { MIN_EXERCISE_DAYS, shownPerformance } from './muscleState';

/**
 * Why Muskelgruppen has nothing to show, or nothing to compare — said to
 * the user in so many words (contract §11: an empty state says what is
 * missing).
 *
 * The destination looks at the selected range only, 30 or 90 days back from
 * today, while the Gym rating and "Leistung seit Jahresbeginn" on the hub
 * look at the whole history. So a user who last trained six weeks ago sees
 * a year's figure on the hub and ten untrained groups here. That is what
 * the data says for the range; what was wrong is that the screen answered
 * it with "Noch nicht trainiert — nach deiner ersten Session …", which is
 * true only of someone who never logged a session (STOP 6b, found by
 * importing a live backup whose last session lay 40 days back).
 *
 * Five different absences, kept apart because each is missing something
 * else:
 *
 * - `never` — no Gym session was ever logged.
 * - `outsideRange` — sessions exist, the latest one before the range.
 * - `unscored` — a session lies inside the range, but none of its sets can
 *   be scored: no reps or no weight, or a bodyweight exercise without a
 *   recorded bodyweight.
 * - `noComparison` — trained and scored inside the range, but no exercise
 *   has a second day yet, so no group has a change to state.
 * - `tooFewDays` — an exercise has its second day, but no group has the
 *   three exercise days a trend needs (contract §7); `most` is the largest
 *   count any group has reached.
 *
 * Nothing here computes a score. It reads what the history already says
 * (`days`, `awaitingBodyweight`), what the screen shows for it
 * (`shownPerformance`) and one stored fact, the date of the latest session.
 */
export type MuscleGap =
  | { kind: 'never' }
  | { kind: 'outsideRange'; lastSession: DateKey; daysAgo: number }
  | { kind: 'unscored'; bodyweightMissing: boolean }
  | { kind: 'noComparison' }
  | { kind: 'tooFewDays'; most: number };

export function muscleGap(
  history: Pick<GymHistory, 'days' | 'overall' | 'awaitingBodyweight'>,
  /** The date of the most recent Gym session of all, `null` before the first. */
  latestSession: DateKey | null,
  today: DateKey,
  rangeDays: number,
): MuscleGap | null {
  if (history.days.length > 0) {
    const shown = shownPerformance(history.days, history.overall);
    if (shown.rated.length > 0) return null;
    // No group states a trend. Either nothing can be compared at all, or
    // what can be compared rests on fewer than three exercise days.
    const compared = shown.muscles.filter((entry) => entry.compared);
    if (compared.length === 0) return { kind: 'noComparison' };
    return { kind: 'tooFewDays', most: Math.max(...compared.map((entry) => entry.exerciseDays)) };
  }
  if (latestSession === null) return { kind: 'never' };
  // The range as the loader reads it: today and the `rangeDays - 1` before.
  const from = addDays(today, -(rangeDays - 1));
  if (latestSession < from) {
    return { kind: 'outsideRange', lastSession: latestSession, daysAgo: diffInDays(latestSession, today) };
  }
  return { kind: 'unscored', bodyweightMissing: history.awaitingBodyweight.length > 0 };
}

/** The gap as two lines: what the state is, and what is missing. */
export function muscleGapText(
  gap: MuscleGap,
  { t, language, rangeDays }: { t: Translator; language: Language; rangeDays: number },
): { title: string; hint: string } {
  switch (gap.kind) {
    case 'never':
      return { title: t('gymHub.muscles.none'), hint: t('gymHub.muscles.noneHint') };
    case 'outsideRange':
      return {
        title: t('gymHub.muscles.outside', { days: rangeDays }),
        hint: t('gymHub.muscles.outsideHint', {
          date: `${formatWeekday(language, gap.lastSession)}, ${formatDayAndMonth(language, gap.lastSession)}`,
          count: gap.daysAgo,
        }),
      };
    case 'unscored':
      return {
        title: t('gymHub.muscles.unscored'),
        hint: gap.bodyweightMissing
          ? t('gym.bodyweight.needed')
          : t('gymHub.muscles.unscoredHint', { days: rangeDays }),
      };
    case 'noComparison':
      return { title: t('gym.progress.noBaseline'), hint: t('gym.progress.noBaselineHint', { days: rangeDays }) };
    case 'tooFewDays':
      return {
        title: t('gym.progress.noBaseline'),
        hint: exerciseDaysText(gap.most, true, { t, rangeDays }),
      };
  }
}

/**
 * What a group with too little to compare is missing, as one sentence
 * (contract §7, §9): how many exercise days the range holds and from when a
 * trend appears — or, with the days there, that no exercise has a second
 * day yet.
 */
export function exerciseDaysText(
  exerciseDays: number,
  /** Whether one of the group's exercises was recorded on two days. */
  compared: boolean,
  { t, rangeDays }: { t: Translator; rangeDays: number },
): string {
  const count = t(exerciseDays === 1 ? 'muscle.exerciseDays.countOne' : 'muscle.exerciseDays.count', {
    count: exerciseDays,
    days: rangeDays,
  });
  if (exerciseDays < MIN_EXERCISE_DAYS) return `${count} ${t('muscle.exerciseDays.fromThird')}`;
  return compared ? count : `${count} ${t('muscle.exerciseDays.needsSecondDay')}`;
}
