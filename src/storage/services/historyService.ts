import { today } from '../../core/clock';
import {
  compareDateKeys,
  daysBetween,
  dayEditState,
  endOfWeek,
  startOfWeek,
  weekKeyOf,
  type DateKey,
} from '../../core/dates';
import type {
  AppConfigSnapshot,
  ConfigSnapshotRecord,
  QuestionCategory,
  QuestionStatus,
  QuestionType,
  ScoringModel,
  StoredDomainType,
} from '../../core/model';
import type { WeekKey } from '../../core/dates';
import { WEEKLY_DOMAIN_TYPES, weeklyTargetsIn } from '../../core/domains';
import { pausedFlags } from '../../core/pause';
import { editWindowOf, weekInProgress, weekWindows } from '../../core/config/closure';
import {
  scoreDay,
  type DayScore,
  type DueQuestion,
  type FoodDayInput,
  type WeeklyDayInput,
} from '../../core/scoring/dayScore';
import {
  answersRepository,
  configSnapshotsRepository,
  foodDaysRepository,
  gymSessionsRepository,
  pausePeriodsRepository,
  questionsRepository,
  runsRepository,
  sportsSessionsRepository,
} from '../repositories';

/**
 * Reconstructs the past.
 *
 * Every day is scored against the configuration that was in force on that
 * day, resolved from the snapshot log — which is the entire reason those
 * snapshots exist. Raising the sports target in April cannot change what
 * January scored, and a question archived last week still counts for the
 * days it was actually asked.
 */

export interface HistoryQuestionRow {
  id: string;
  text: string;
  /** Carried so the drill-down can read a scale answer back as 1–10. */
  type: QuestionType;
  category: QuestionCategory;
  status: QuestionStatus;
  /** One entry per day in the range, aligned with `days`. */
  scores: (number | null)[];
}

/** One weekly-quota domain's week: what was asked, and what happened. */
export interface HistoryWeekDomain {
  domain: StoredDomainType;
  target: number;
  sessions: number;
  met: boolean;
}

export interface HistoryWeek {
  weekKey: WeekKey;
  /**
   * RC2's generic Sport quota for this week, or `null` if it was off.
   *
   * Kept as its own field rather than folded into `domains` because the
   * legacy progression is replayed from exactly these numbers, and it must
   * keep producing the rating a user already saw.
   */
  target: number | null;
  sessions: number;
  met: boolean;
  inProgress: boolean;
  /** Every weekly-quota domain enabled that week, legacy Sport included. */
  domains: HistoryWeekDomain[];
}

export interface History {
  from: DateKey;
  to: DateKey;
  days: DayScore[];
  /** Convenience series aligned with `days`, for the trend and the heatmap. */
  overall: (number | null)[];
  mental: (number | null)[];
  sports: (number | null)[];
  gym: (number | null)[];
  running: (number | null)[];
  food: (number | null)[];
  /**
   * Whether each day fell inside a declared pause, aligned with `days`.
   *
   * **The one canonical answer.** Every consumer — the legacy fold, the four
   * domain ledgers, both training services — reads this rather than resolving
   * date overlap again, because a second implementation of "is this date
   * covered" is exactly the kind of arithmetic that goes quietly different.
   */
  paused: boolean[];
  /** Every question that was due at some point in the range. */
  questions: HistoryQuestionRow[];
  /** Whether anything at all was recorded on each day, aligned with `days`.
   *  A missed day scores zero, which reads as data — this says it was not. */
  activity: boolean[];
  /** Every Monday-to-Sunday week the range touches, oldest first. */
  weeks: HistoryWeek[];
  /** True when the range contains nothing to show at all. */
  empty: boolean;
}

/**
 * The configuration in force on a day, or `null` if the day predates any.
 *
 * There is deliberately no fallback to the earliest snapshot here. A day
 * before the user ever configured anything had nothing due, so it is neutral
 * — not a day of missed questions. Falling back would score every day before
 * onboarding as a zero and fill a new user's first screen with red.
 */
function resolveSnapshot(
  snapshots: ConfigSnapshotRecord[],
  date: DateKey,
): AppConfigSnapshot | null {
  let match: ConfigSnapshotRecord | undefined;
  for (const snapshot of snapshots) {
    if (compareDateKeys(snapshot.effectiveFrom, date) <= 0) match = snapshot;
    else break;
  }
  return match?.config ?? null;
}

function mentalDueOn(config: AppConfigSnapshot): DueQuestion[] {
  const domain = config.domains.find((entry) => entry.type === 'mental');
  if (!domain || !domain.enabled) return [];
  return config.questions
    .filter((question) => question.domainId === domain.id && question.status === 'active')
    .map((question) => ({
      id: question.id,
      type: question.type,
      // A snapshot older than category scoring carries no category. Those
      // days are scored flat, which never reads it; "eigene" is a placeholder
      // that nothing looks at rather than a claim about the question.
      category: question.category ?? ('eigene' as const),
    }));
}

/**
 * Whether Food was switched on for a day, from that day's own snapshot.
 *
 * A day before the user enabled Food has no food obligation at all — not an
 * unrated one. That is what keeps switching Food on in June from filling the
 * spring with misses it was never asked about.
 */
function foodEnabledIn(config: AppConfigSnapshot): boolean {
  const domain = config.domains.find((entry) => entry.type === 'food');
  return Boolean(domain?.enabled);
}

/**
 * Which arithmetic a day was lived under.
 *
 * Read from the day's own snapshot and never from today's configuration —
 * that is the whole of the forward-only rule. A snapshot with no model was
 * written before the change and is flat, which is what those days were.
 */
function scoringModelOf(config: AppConfigSnapshot): ScoringModel {
  return config.scoring.model ?? 'flat';
}

export async function loadHistory(
  from: DateKey,
  to: DateKey,
  reference: DateKey = today(),
): Promise<History> {
  const dates = daysBetween(from, to);
  if (dates.length === 0) {
    return {
      from,
      to,
      days: [],
      overall: [],
      mental: [],
      sports: [],
      gym: [],
      running: [],
      food: [],
      paused: [],
      questions: [],
      activity: [],
      weeks: [],
      empty: true,
    };
  }

  // Sessions are counted by week, and the range's edge days belong to weeks
  // that reach beyond it — so the query has to cover those whole weeks.
  const [snapshots, answers, sessions, gymSessions, runs, foodDays, pauses, liveQuestions] =
    await Promise.all([
      configSnapshotsRepository.list(),
      answersRepository.listByDateRange(from, to),
      sportsSessionsRepository.listByDateRange(startOfWeek(from), endOfWeek(to)),
      gymSessionsRepository.listByDateRange(startOfWeek(from), endOfWeek(to)),
      runsRepository.listByDateRange(startOfWeek(from), endOfWeek(to)),
      // Adherence is a daily rating, so unlike a session it needs no week
      // either side of the range.
      foodDaysRepository.listByDateRange(from, to),
      // Pauses are few and the overlap test is cheap; loading all of them
      // keeps one open-ended legacy row from being missed by a range query.
      pausePeriodsRepository.getAll(),
      questionsRepository.list(),
    ]);

  const adherenceByDate = new Map(foodDays.map((day) => [day.date, day.adherence]));
  const paused = pausedFlags(pauses, dates);

  // Snapshots store questions sorted by id, which is meaningless to a reader.
  // The drill-down follows the order the questions appear in Areas.
  const displayOrder = new Map(liveQuestions.map((question, index) => [question.id, index]));
  // The live record, for the facts a snapshot does not carry: which category
  // the question belongs to now, and whether it is still being asked.
  const liveById = new Map(liveQuestions.map((question) => [question.id, question]));

  const answersByDate = new Map<DateKey, Map<string, boolean | number>>();
  for (const answer of answers) {
    let day = answersByDate.get(answer.date);
    if (!day) {
      day = new Map();
      answersByDate.set(answer.date, day);
    }
    day.set(answer.questionId, answer.value);
  }

  /**
   * Sessions per week, per domain. Every weekly-quota domain counts its own:
   * Gym and Running are independent targets, so a run can never help a gym
   * week and vice versa.
   */
  const sessionsByWeek = new Map<StoredDomainType, Map<WeekKey, number>>();
  for (const domain of WEEKLY_DOMAIN_TYPES) sessionsByWeek.set(domain, new Map());
  const countSession = (domain: StoredDomainType, weekKey: WeekKey) => {
    const counts = sessionsByWeek.get(domain)!;
    counts.set(weekKey, (counts.get(weekKey) ?? 0) + 1);
  };
  for (const session of sessions) countSession('sports', session.weekKey);
  for (const session of gymSessions) countSession('gym', session.weekKey);
  for (const run of runs) countSession('running', run.weekKey);

  const sessionsIn = (domain: StoredDomainType, weekKey: WeekKey): number =>
    sessionsByWeek.get(domain)?.get(weekKey) ?? 0;

  const questionText = new Map<string, string>();
  const questionOrder: string[] = [];
  /** What was due on each day, kept so a question can be told apart from
   *  one that simply did not exist yet. */
  const dueByDate = new Map<DateKey, Set<string>>();

  /*
   * Each week's era, from the snapshot in force on its Monday (D132): a week
   * of the P8 era stays in progress until its Sunday can no longer be
   * written — Monday midnight — and is judged only then; a week before it is
   * judged at Sunday midnight, as it always was.
   */
  const weekWindowOf = weekWindows(snapshots);

  const days: DayScore[] = dates.map((date) => {
    const config = resolveSnapshot(snapshots, date);
    const due = config ? mentalDueOn(config) : [];
    dueByDate.set(date, new Set(due.map((question) => question.id)));

    if (config) {
      for (const question of config.questions) {
        if (!questionText.has(question.id)) questionOrder.push(question.id);
        // The latest wording wins, so a renamed question reads consistently.
        questionText.set(question.id, question.text);
      }
    }

    const weekKey = weekKeyOf(date);
    // A week that has not finished yet cannot have missed its target.
    const weekWindow = weekWindowOf(date);
    const inProgress = weekInProgress(date, reference, weekWindow);
    const weekly: WeeklyDayInput[] = config
      ? weeklyTargetsIn(config).map(({ domain, target }) => ({
          domain,
          target,
          sessionsInWeek: sessionsIn(domain, weekKey),
          weekInProgress: inProgress,
          // P8 (D134): the target is judged when the week is over.
          ...(weekWindow === null ? {} : { judgedAtClose: true }),
        }))
      : [];

    const food: FoodDayInput | null =
      config && foodEnabledIn(config)
        ? { adherence: adherenceByDate.get(date) ?? null }
        : null;

    return scoreDay({
      date,
      // The window of the day's own era: 3 before P8, 1 from it (D132).
      editState: dayEditState(date, reference, editWindowOf(config)),
      mental: config
        ? {
            due,
            answers: answersByDate.get(date) ?? new Map(),
            model: scoringModelOf(config),
          }
        : null,
      weekly,
      food,
    });
  });

  const domainSeries = (domain: StoredDomainType) =>
    days.map((day) => {
      if (day.status === 'open' || day.status === 'neutral') return null;
      return day.domains.find((entry) => entry.domain === domain)?.score ?? null;
    });

  const everDue = new Set<string>();
  for (const ids of dueByDate.values()) for (const id of ids) everDue.add(id);

  const questions: HistoryQuestionRow[] = questionOrder
    .filter((id) => everDue.has(id))
    .sort(
      (a, b) =>
        (displayOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (displayOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
    )
    .map((id) => ({
      id,
      text: questionText.get(id) ?? '',
      type: liveById.get(id)?.type ?? ('boolean' as QuestionType),
      category: liveById.get(id)?.category ?? ('eigene' as QuestionCategory),
      status: liveById.get(id)?.status ?? ('archived' as QuestionStatus),
      scores: days.map((day) => {
        // Not asked that day — paused, archived, or not yet created. That is
        // absent, which is a different thing from a zero.
        if (!dueByDate.get(day.date)?.has(id)) return null;
        if (day.status === 'open' || day.status === 'neutral') return null;
        // Due, the day is closed, and nothing was recorded: a genuine miss.
        return day.questionScores.get(id) ?? 0;
      }),
    }));

  /*
   * Weeks, for the training streak and for XP. The target is resolved at the
   * week's Monday: a mid-week change takes effect from the following week
   * rather than retroactively rewriting the days already lived in this one.
   */
  /*
   * The first day of the range that falls in each week, remembered as the
   * days are walked. Searching the range for it per week instead is a scan
   * inside a loop — quadratic in the length of the history, and measurably
   * the whole cost of a replay by the two-year mark.
   */
  const weekKeys: WeekKey[] = [];
  const firstDateInWeek = new Map<WeekKey, DateKey>();
  for (const date of dates) {
    const weekKey = weekKeyOf(date);
    if (!firstDateInWeek.has(weekKey)) {
      firstDateInWeek.set(weekKey, date);
      weekKeys.push(weekKey);
    }
  }
  const weeks: HistoryWeek[] = weekKeys.map((weekKey) => {
    const monday = startOfWeek(firstDateInWeek.get(weekKey) ?? from);
    const config = resolveSnapshot(snapshots, monday);
    const perDomain: HistoryWeekDomain[] = config
      ? weeklyTargetsIn(config).map(({ domain, target }) => {
          const count = sessionsIn(domain, weekKey);
          return { domain, target, sessions: count, met: count >= target };
        })
      : [];
    const legacy = perDomain.find((entry) => entry.domain === 'sports');
    return {
      weekKey,
      target: legacy?.target ?? null,
      sessions: legacy?.sessions ?? 0,
      met: legacy?.met ?? false,
      inProgress: weekInProgress(monday, reference, weekWindowOf(monday)),
      domains: perDomain,
    };
  });

  const sessionDates = new Set<DateKey>([
    ...sessions.map((session) => session.date),
    ...gymSessions.map((session) => session.date),
    ...runs.map((run) => run.date),
  ]);
  const activity = dates.map(
    (date) =>
      (answersByDate.get(date)?.size ?? 0) > 0 ||
      sessionDates.has(date) ||
      adherenceByDate.has(date),
  );

  const overall = days.map((day) => day.score);
  return {
    from,
    to,
    days,
    overall,
    mental: domainSeries('mental'),
    sports: domainSeries('sports'),
    gym: domainSeries('gym'),
    running: domainSeries('running'),
    food: domainSeries('food'),
    paused,
    questions,
    activity,
    weeks,
    empty: overall.every((value) => value === null),
  };
}
