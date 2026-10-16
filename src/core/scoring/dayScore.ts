import { adherencePercent } from '../food/adherence';
import type { DateKey, DayEditState } from '../dates';
import type { QuestionCategory, QuestionType, ScoringModel, StoredDomainType } from '../model';
import { scaleValueToPercent } from './scale';

/**
 * Scoring a single day (§11).
 *
 * Pure functions over an explicit description of what was due and what was
 * answered. Nothing here reads storage, so every rule below is testable in
 * isolation — and the historical reconstruction that feeds it can resolve
 * each past day against the configuration that was actually in force then.
 */

/**
 * - `neutral` — nothing was due. Excluded from every average, never scored.
 * - `open`    — something was due and is still answerable inside the edit
 *               window. Also excluded: an open day never hurts the user.
 * - `scored`  — the day counts. Anything left unanswered on a closed day is
 *               a miss and scores zero.
 */
export type DayStatus = 'neutral' | 'open' | 'scored';

export interface DueQuestion {
  id: string;
  type: QuestionType;
  /** The category the question was in *on this day*, from that day's snapshot. */
  category: QuestionCategory;
}

export interface MentalDayInput {
  /** Questions that were active on this day, from that day's configuration. */
  due: DueQuestion[];
  /** Answers keyed by question id. Missing means unanswered. */
  answers: Map<string, boolean | number>;
  /**
   * The arithmetic this day was lived under, read from its own snapshot.
   *
   * Never today's model: a day already scored keeps the model it was scored
   * by, which is what makes the change forward-only.
   */
  model: ScoringModel;
}

/**
 * A domain judged on sessions against a weekly quota.
 *
 * RC2 had exactly one of these and named it `sports`. Iteration 2 has Gym and
 * Running, which are two independent quotas rather than one shared one, so
 * the input is a list keyed by domain — and the legacy `sports` domain is
 * simply one more entry in it, scored by the same rule it always was.
 */
export interface WeeklyDayInput {
  domain: StoredDomainType;
  /** The target in force for the week this day belongs to. */
  target: number;
  /** Sessions logged in that whole week. */
  sessionsInWeek: number;
  /** A week still running cannot have missed its target yet. */
  weekInProgress: boolean;
  /**
   * P8 (D134): the target is judged when the week is over. While such a
   * week is still in progress and anything has been logged, it counts as
   * met; nothing logged is still no data. Absent on every week before P8,
   * which reports its running progress as it always did.
   */
  judgedAtClose?: boolean;
}

/**
 * Food for one day: the 1–10 adherence the user recorded, or nothing.
 *
 * One item, due every day the domain is enabled — the same daily obligation
 * Wellbeing has, with one question instead of several. There is no target in
 * here and no calorie arithmetic; see `core/food/adherence.ts`.
 */
export interface FoodDayInput {
  /** Exactly what the user entered, or `null` if they have not yet. */
  adherence: number | null;
}

export interface DayInput {
  date: DateKey;
  editState: DayEditState;
  /** `null` when the domain is disabled or was never enabled. */
  mental: MentalDayInput | null;
  /** Every weekly-quota domain enabled on this day. Empty when none are. */
  weekly: WeeklyDayInput[];
  /** `null` when Food is disabled or was never enabled. */
  food: FoodDayInput | null;
}

export interface DomainScore {
  domain: StoredDomainType;
  /** `null` means no data — excluded from the mean, never counted as zero. */
  score: number | null;
  itemsDue: number;
  itemsAnswered: number;
}

export interface DayScore {
  date: DateKey;
  status: DayStatus;
  /**
   * The overall score, or `null` for a neutral or open day.
   *
   * On a closed day this divides by the items that were **due**, so an
   * unanswered item is a miss. That is the honest reading for history.
   */
  score: number | null;
  /**
   * The same day scored over the items the user actually **reported**.
   *
   * History wants "you missed two of three". The rating wants "of what you
   * told me, how did it go" — because dividing by items due conflates not
   * doing a thing with not saying so, and would make honestly logging partial
   * progress cost more than staying silent.
   */
  recordedScore: number | null;
  domains: DomainScore[];
  /** How much of the day was reported, for weighting the rating. */
  dueItems: number;
  answeredItems: number;
  /** Per-question percentages, for the Progress drill-down. */
  questionScores: Map<string, number>;
}

/** One answered item as a percentage: yes = 100, no = 0, a scale = value × 10. */
export function itemPercent(type: QuestionType, value: boolean | number): number {
  if (type === 'boolean') return value ? 100 : 0;
  return scaleValueToPercent(Number(value));
}

interface MentalResult {
  score: number | null;
  recorded: number | null;
  answered: number;
  questionScores: Map<string, number>;
}

/**
 * Wellbeing for one day (§11, D18).
 *
 * Two numbers come out of this, and they answer different questions:
 *
 * - **`score`** is for history. On a closed day it divides by the items that
 *   were **due**, so an unanswered item is a miss and drags the day down.
 * - **`recorded`** is for the rating. It divides by the items actually
 *   **answered**, because dividing by items due conflates not doing a thing
 *   with not saying so, and would make honestly logging partial progress cost
 *   more than staying silent.
 *
 * ### `flat`
 *
 * One mean over every question. What RC2 and iteration 2 up to phase 2 did,
 * and what every day scored under those builds keeps.
 *
 * ### `categoryMean`
 *
 * The mean **within** each category, then the equal-weighted mean of those.
 * Six questions about the household cannot outweigh the one that asks how the
 * user actually feels, and adding a seventh cannot quietly change what the
 * others are worth.
 *
 * The two numbers treat an absent category differently, and deliberately:
 *
 * - For **`recorded`**, a category with nothing answered has no data and
 *   leaves the denominator with it. It never contributes a zero it did not
 *   earn — which is the whole reason the rating uses this number.
 * - For **`score`** on a closed day, every category with something due
 *   participates, and one where nothing was answered contributes 0, because
 *   those items were genuinely missed. That is the flat model's own rule,
 *   applied per category rather than changed.
 *
 * The second is harsher than the flat model for a user who answers one
 * category and skips the others — three categories where only Mental was
 * answered read (0 + 0 + 80) / 3 rather than 80 × 4 / 7. That is the
 * arithmetic equal weighting asks for, in both directions.
 */
function scoreMental(input: MentalDayInput, countUnansweredAsMissed: boolean): MentalResult {
  const questionScores = new Map<string, number>();
  if (input.due.length === 0) {
    return { score: null, recorded: null, answered: 0, questionScores };
  }

  /** Every due question's percentage, or `undefined` where unanswered. */
  const percents = new Map<string, number>();
  let answered = 0;
  for (const question of input.due) {
    const value = input.answers.get(question.id);
    if (value === undefined) continue;
    const percent = itemPercent(question.type, value);
    questionScores.set(question.id, percent);
    percents.set(question.id, percent);
    answered += 1;
  }

  if (input.model === 'flat') {
    const total = [...percents.values()].reduce((sum, value) => sum + value, 0);
    const recorded = answered === 0 ? null : total / answered;
    if (answered === 0 && !countUnansweredAsMissed) {
      return { score: null, recorded, answered, questionScores };
    }
    const denominator = countUnansweredAsMissed ? input.due.length : answered;
    return { score: total / denominator, recorded, answered, questionScores };
  }

  // Grouped in the order the categories appear, which keeps the arithmetic
  // independent of how the questions happen to be sorted.
  const groups = new Map<QuestionCategory, DueQuestion[]>();
  for (const question of input.due) {
    const list = groups.get(question.category);
    if (list) list.push(question);
    else groups.set(question.category, [question]);
  }

  const recordedMeans: number[] = [];
  const dueMeans: number[] = [];
  for (const questions of groups.values()) {
    let total = 0;
    let count = 0;
    for (const question of questions) {
      const percent = percents.get(question.id);
      if (percent === undefined) continue;
      total += percent;
      count += 1;
    }
    // Nothing answered in this category: no data for the rating, and a genuine
    // miss for history on a closed day.
    if (count > 0) recordedMeans.push(total / count);
    dueMeans.push(total / questions.length);
  }

  const recorded =
    recordedMeans.length === 0
      ? null
      : recordedMeans.reduce((sum, value) => sum + value, 0) / recordedMeans.length;

  if (answered === 0 && !countUnansweredAsMissed) {
    return { score: null, recorded, answered, questionScores };
  }

  const score = countUnansweredAsMissed
    ? dueMeans.reduce((sum, value) => sum + value, 0) / dueMeans.length
    : recorded;

  return { score, recorded, answered, questionScores };
}

/**
 * Sports for one day: the week's progress towards its target, capped at 100.
 *
 * A week still in progress with nothing logged has no data yet rather than a
 * score of zero — the same principle as an open day. Once anything is logged
 * the week reports its running progress — before P8 — or, on a day lived
 * under P8 (`judgedAtClose`), reads as met until the week can no longer be
 * written (D134). A finished week reports the truth even when that truth is
 * zero.
 */
function scoreWeekly(input: WeeklyDayInput): number | null {
  if (input.weekInProgress && input.sessionsInWeek === 0) return null;
  // Judged once its Sunday can no longer be written; until then, met.
  if (input.weekInProgress && input.judgedAtClose === true) return 100;
  const target = Math.max(1, input.target);
  return Math.min(100, (input.sessionsInWeek / target) * 100);
}

/**
 * Food for one day, under the same two-numbers rule as everything else.
 *
 * - **`score`** is for history, so on a closed day an unrecorded rating is a
 *   miss and scores zero — the day was asked for and nothing came back.
 * - **`recorded`** is for the rating, so an unrecorded day is *no data* and
 *   leaves the denominator entirely. Anything else would make honestly
 *   admitting a bad day cost more than saying nothing.
 *
 * This is the existing rule applied unchanged, not a Food-specific one.
 */
function scoreFood(
  input: FoodDayInput,
  countUnrecordedAsMissed: boolean,
): { score: number | null; recorded: number | null; answered: number } {
  if (input.adherence === null) {
    return { score: countUnrecordedAsMissed ? 0 : null, recorded: null, answered: 0 };
  }
  const percent = adherencePercent(input.adherence);
  return { score: percent, recorded: percent, answered: 1 };
}

export function scoreDay(input: DayInput): DayScore {
  const closed = input.editState === 'closed';
  const domains: DomainScore[] = [];
  const recordedDomains: (number | null)[] = [];
  let questionScores = new Map<string, number>();

  let mentalHasDue = false;
  let mentalIncomplete = false;
  let dueItems = 0;
  let answeredItems = 0;

  if (input.mental) {
    mentalHasDue = input.mental.due.length > 0;
    const result = scoreMental(input.mental, closed);
    questionScores = result.questionScores;
    mentalIncomplete = mentalHasDue && result.answered < input.mental.due.length;
    dueItems = input.mental.due.length;
    answeredItems = result.answered;
    recordedDomains.push(result.recorded);
    domains.push({
      domain: 'mental',
      score: result.score,
      itemsDue: input.mental.due.length,
      itemsAnswered: result.answered,
    });
  }

  for (const weekly of input.weekly) {
    const score = scoreWeekly(weekly);
    recordedDomains.push(score);
    domains.push({
      domain: weekly.domain,
      score,
      itemsDue: weekly.target,
      itemsAnswered: weekly.sessionsInWeek,
    });
  }

  /*
   * Food is a daily obligation, so an unrecorded day inside the edit window
   * leaves the day open exactly as an unanswered question does.
   *
   * It deliberately does *not* add to the day-level `dueItems` and
   * `answeredItems`. Those weight the legacy fold by how much of the
   * *check-in* was reported, which is a Wellbeing quantity; Gym and Running
   * do not contribute to them either, for the same reason.
   */
  let foodDue = false;
  let foodIncomplete = false;
  if (input.food) {
    foodDue = true;
    const result = scoreFood(input.food, closed);
    foodIncomplete = result.answered === 0;
    recordedDomains.push(result.recorded);
    domains.push({
      domain: 'food',
      score: result.score,
      itemsDue: 1,
      itemsAnswered: result.answered,
    });
  }

  const recordedScored = recordedDomains.filter((value): value is number => value !== null);
  const recordedScore = recordedScored.length
    ? recordedScored.reduce((sum, value) => sum + value, 0) / recordedScored.length
    : null;

  const nothingDue = !mentalHasDue && input.weekly.length === 0 && !foodDue;
  if (nothingDue) {
    return {
      date: input.date,
      status: 'neutral',
      score: null,
      recordedScore,
      domains,
      dueItems,
      answeredItems,
      questionScores,
    };
  }

  // Still inside the edit window with work outstanding: the day is open, and
  // an open day is never counted against the user.
  if (!closed && (mentalIncomplete || foodIncomplete)) {
    return {
      date: input.date,
      status: 'open',
      score: null,
      recordedScore,
      domains,
      dueItems,
      answeredItems,
      questionScores,
    };
  }

  /**
   * The overall score is the unweighted mean of the domain scores, so a
   * domain with five questions cannot outweigh one with one. Domains with no
   * data are excluded from the denominator entirely.
   */
  const scored = domains.filter((domain) => domain.score !== null);
  if (scored.length === 0) {
    return {
      date: input.date,
      status: closed && (mentalHasDue || foodDue) ? 'scored' : 'neutral',
      score: closed && (mentalHasDue || foodDue) ? 0 : null,
      recordedScore,
      domains,
      dueItems,
      answeredItems,
      questionScores,
    };
  }

  const overall = scored.reduce((sum, domain) => sum + (domain.score ?? 0), 0) / scored.length;
  return {
    date: input.date,
    status: 'scored',
    score: overall,
    recordedScore,
    domains,
    dueItems,
    answeredItems,
    questionScores,
  };
}
