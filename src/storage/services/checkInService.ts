import { nowIso, today } from '../../core/clock';
import { checkInWritable, sessionWritable, snapshotOn, weekWindows } from '../../core/config/closure';
import {
  addDays,
  compareDateKeys,
  weekKeyOf,
  type DateKey,
  type DayEditState,
  type WeekKey,
} from '../../core/dates';
import { WEEKLY_DOMAIN_TYPES, weeklyTargetOf } from '../../core/domains';
import { needsLegacySportChoice } from '../../core/migration/legacySport';
import { isPausedOn } from '../../core/pause';
import { isValidAdherence } from '../../core/food';
import { createId } from '../../core/ids';
import { isValidScaleValue } from '../../core/scoring/scale';
import type {
  AnswerRecord,
  AnswerValue,
  AppConfigSnapshot,
  ConfigSnapshotRecord,
  DomainRecord,
  FoodEntryRecord,
  QuestionRecord,
  StoredDomainType,
} from '../../core/model';
import { weekProgress, type WeekProgress } from '../../domains/sports/weekProgress';
import { ensureCurrentSnapshot } from '../configService';
import {
  answersRepository,
  configSnapshotsRepository,
  domainsRepository,
  foodDaysRepository,
  foodEntriesRepository,
  gymSessionsRepository,
  pausePeriodsRepository,
  questionsRepository,
  runsRepository,
  settingsRepository,
  sportsSessionsRepository,
} from '../repositories';

/**
 * The daily check-in.
 *
 * Everything the Today screen reads and writes goes through here, including
 * the one write rule that must not be re-implemented in a component (D133):
 * an answer, a Food rating, a session or a run may be written for today and
 * yesterday, on a day of the P8 era — for a session also in a week whose
 * Sunday can still be written. Older days are closed and read-only. The rule
 * itself lives in `core/config/closure.ts`, beside the closure it guarantees.
 *
 * Training is plural now. Gym and Running are separate quotas with separate
 * logs, and RC2's generic Sport is a third that the product no longer creates
 * but still has to show a migrated user who chose to keep it. All three are
 * the same shape here, so the Today screen has one card to render rather than
 * three cases to branch on.
 */

/** Thrown when a write targets a day the user may no longer change. */
export class EditWindowError extends Error {
  constructor(
    readonly date: DateKey,
    readonly state: DayEditState,
  ) {
    super(`Day ${date} is ${state} and cannot be edited`);
    this.name = 'EditWindowError';
  }
}

export class InvalidAnswerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAnswerError';
  }
}

export interface CheckInItem {
  question: QuestionRecord;
  /** `null` until the question has been answered on this day. */
  answer: AnswerRecord | null;
}

export interface MentalDayView {
  items: CheckInItem[];
  answeredCount: number;
  /** Every active question answered — the day's check-in is complete. */
  complete: boolean;
}

/**
 * One logged training session, whichever log it lives in.
 *
 * A view type rather than a record: Gym sets and run distances belong to
 * their own screens, and the Today card only ever needs "when, and roughly
 * what". Phases 4 and 5 add the detail behind this, not instead of it.
 */
export interface TrainingSession {
  id: string;
  domain: StoredDomainType;
  date: DateKey;
  performedAt: string;
  note: string | null;
  durationMinutes: number | null;
  /**
   * Measured distance in whole metres, for a run. `null` everywhere else, and
   * `null` on a run the user logged without one — which is allowed, and leaves
   * that run counting for attendance and nothing more.
   */
  distanceMetres: number | null;
  /** Carried over from RC2's Sport log, so a screen can say so. */
  legacyCarryOver: boolean;
}

export interface TrainingDayView {
  domain: StoredDomainType;
  weekKey: WeekKey;
  progress: WeekProgress;
  /** This week's sessions, oldest first. */
  sessions: TrainingSession[];
  /** Sessions logged on the day being viewed. */
  sessionsToday: TrainingSession[];
  /**
   * The days a session of this domain may still be written for, oldest
   * first: today and yesterday, where the write rule allows it and the
   * domain was enabled on the day (D133). The run sheet offers exactly
   * these, and a session dated on any other day is read-only.
   */
  writableDays: DateKey[];
}

/** What a day's food entries add up to. Shown, never scored. */
export interface FoodTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface FoodDayView {
  /** The 1–10 the user chose, or `null` if they have not rated the day. */
  adherence: number | null;
  note: string | null;
  /** What the user is aiming at, in their words. Empty is allowed. */
  focus: string | null;
  /** Everything logged on this day, oldest first. */
  entries: FoodEntryRecord[];
  /**
   * The day's totals.
   *
   * Informational, and that is a rule rather than a phase-6 shortcut: what a
   * person's calorie and macro targets should be has not been decided, so
   * nothing here reaches the score. Food is ranked on `adherence`.
   */
  totals: FoodTotals;
}

export interface DayView {
  date: DateKey;
  editState: DayEditState;
  editable: boolean;
  /** `null` when Wellbeing is disabled or was never enabled. */
  mental: MentalDayView | null;
  /** One entry per enabled weekly-quota domain, in display order. */
  training: TrainingDayView[];
  /** `null` when Food is disabled or was never enabled. */
  food: FoodDayView | null;
  /**
   * Whether the migrated user still owes an answer about their RC2 Sport
   * sessions.
   *
   * Today is where the retired domain shows a week with no way to log into
   * it, which is exactly where "what were these?" occurs to somebody — so the
   * card points at the answer rather than leaving the question to be found by
   * accident. It is a pointer, not a prompt: nothing here can apply a choice.
   */
  legacySportChoicePending: boolean;
  /**
   * Whether this day falls inside a declared pause.
   *
   * Today says so in one restrained line and changes nothing else: every
   * card stays live, every control stays enabled, and anything logged counts
   * exactly as it would outside a pause. A pause suspends the cost of being
   * away — it is not a state the app enters.
   */
  paused: boolean;
  /** True when nothing is set up — the day has nothing to ask. */
  empty: boolean;
}

/**
 * The one write rule, for a check-in answer or a Food rating (D133): today
 * or yesterday, on a day of the P8 era. A day lived before the update keeps
 * its own window for scoring but is never reopened by a write — so nothing
 * can be written for a day once it may have been charged.
 */
async function assertEditable(date: DateKey, reference: DateKey, domain: StoredDomainType): Promise<void> {
  const dayConfig = snapshotOn(await configSnapshotsRepository.list(), date);
  if (!checkInWritable(date, reference, dayConfig)) {
    throw new EditWindowError(date, date > reference ? 'future' : 'closed');
  }
  assertEnabledOn(dayConfig, domain, date);
}

/**
 * A backfill may not reach a day on which its domain was not enabled (D133,
 * STOP 3a question 10): it would date the domain's start before the user
 * switched it on, and score a day that was never asked for.
 */
function assertEnabledOn(dayConfig: AppConfigSnapshot | null, domain: StoredDomainType, date: DateKey): void {
  if (!enabledIn(dayConfig, domain)) throw new InvalidAnswerError(`${domain} was not enabled on ${date}`);
}

/** Whether a snapshot has the domain switched on. */
function enabledIn(config: AppConfigSnapshot | null, domain: StoredDomainType): boolean {
  return config?.domains.some((entry) => entry.type === domain && entry.enabled) ?? false;
}

/** Whether a session, set, run or weight entry may be written for `date` (D133). */
export async function sessionWritableOn(date: DateKey, reference: DateKey): Promise<boolean> {
  const snapshots = await configSnapshotsRepository.list();
  return sessionWritable(date, reference, snapshotOn(snapshots, date), weekWindows(snapshots)(date));
}

/**
 * The one write rule for sessions, sets, runs and weight entries (D133):
 * today or yesterday, on a day of the P8 era, in a week whose Sunday can
 * still be written. `domain` adds the check that the domain was enabled on
 * that day.
 */
export async function assertSessionWritable(
  date: DateKey,
  reference: DateKey,
  domain?: StoredDomainType,
): Promise<void> {
  const snapshots = await configSnapshotsRepository.list();
  const dayConfig = snapshotOn(snapshots, date);
  if (!sessionWritable(date, reference, dayConfig, weekWindows(snapshots)(date))) {
    throw new EditWindowError(date, date > reference ? 'future' : 'closed');
  }
  if (domain) assertEnabledOn(dayConfig, domain, date);
}

const minutesFromSeconds = (seconds: number | null): number | null =>
  seconds === null ? null : Math.round(seconds / 60);

/** Every training log, behind one interface. */
async function loadWeek(domain: StoredDomainType, weekKey: WeekKey): Promise<TrainingSession[]> {
  if (domain === 'gym') {
    return (await gymSessionsRepository.listByWeek(weekKey)).map((session) => ({
      id: session.id,
      domain,
      date: session.date,
      performedAt: session.performedAt,
      note: session.note,
      durationMinutes: null,
      distanceMetres: null,
      legacyCarryOver: session.legacyCarryOver,
    }));
  }
  if (domain === 'running') {
    return (await runsRepository.listByWeek(weekKey)).map((run) => ({
      id: run.id,
      domain,
      date: run.date,
      performedAt: run.performedAt,
      note: run.note,
      durationMinutes: minutesFromSeconds(run.durationSeconds),
      distanceMetres: run.distanceMetres,
      legacyCarryOver: run.legacyCarryOver,
    }));
  }
  return (await sportsSessionsRepository.listByWeek(weekKey)).map((session) => ({
    id: session.id,
    domain: 'sports',
    date: session.date,
    performedAt: session.performedAt,
    note: session.note,
    durationMinutes: session.durationMinutes,
    distanceMetres: null,
    legacyCarryOver: false,
  }));
}

/**
 * One training domain's week as Today shows it: the sessions logged in the
 * ISO week of `date` against the domain's current weekly target, or `null`
 * when the domain is not tracked.
 */
async function trainingWeekOf(
  type: StoredDomainType,
  domains: readonly DomainRecord[],
  date: DateKey,
  reference: DateKey,
  snapshots: readonly ConfigSnapshotRecord[],
): Promise<TrainingDayView | null> {
  const domain = domains.find((entry) => entry.type === type);
  const target = domain ? weeklyTargetOf(domain) : null;
  if (!domain || target === null) return null;
  const weekKey = weekKeyOf(date);
  const sessions = await loadWeek(type, weekKey);
  const weekWindowOf = weekWindows(snapshots);
  const writableDays = [addDays(reference, -1), reference].filter((day) => {
    const dayConfig = snapshotOn(snapshots, day);
    return sessionWritable(day, reference, dayConfig, weekWindowOf(day)) && enabledIn(dayConfig, type);
  });
  return {
    domain: type,
    weekKey,
    progress: weekProgress(sessions.length, target, weekKey),
    sessions,
    sessionsToday: sessions.filter((session) => session.date === date),
    writableDays,
  };
}

/**
 * The week of one training domain, read exactly as Today reads it (WP3, B4).
 *
 * The Gym hub said "0 Sessions diese Woche · Ziel erreicht" after a first
 * session because it read the week from the rating ledger, and the ledger
 * gives the week a domain starts in no target at all (D127). The week line is
 * a count against the target the user set, not a scoring input, so every
 * screen that states it reads this.
 */
export async function loadTrainingWeek(
  type: StoredDomainType,
  date: DateKey = today(),
  reference: DateKey = today(),
): Promise<TrainingDayView | null> {
  const [domains, snapshots] = await Promise.all([domainsRepository.list(), configSnapshotsRepository.list()]);
  return trainingWeekOf(type, domains, date, reference, snapshots);
}

/**
 * Reads everything due on a day.
 *
 * Active questions are due, full stop — there is no schedule to evaluate.
 * A disabled domain is absent rather than empty, so scoring and the UI both
 * distinguish "nothing due" from "nothing tracked".
 */
export async function loadDay(date: DateKey = today(), reference: DateKey = today()): Promise<DayView> {
  const [domains, answers, settings, pauses, snapshots] = await Promise.all([
    domainsRepository.list(),
    answersRepository.listByDate(date),
    settingsRepository.getOrCreate(),
    pausePeriodsRepository.getAll(),
    configSnapshotsRepository.list(),
  ]);
  const dayConfig = snapshotOn(snapshots, date);

  /*
   * A day before today shows what was due on it (D138): the domains enabled
   * and the questions asked in its own snapshot, exactly as the replay
   * scores it. A question added this morning was not asked yesterday and one
   * archived this morning still was, so offering today's list for yesterday
   * would take an answer nothing scores and withhold one that is. Today
   * reads the live configuration, which today's snapshot follows.
   */
  const pastConfig = compareDateKeys(date, reference) < 0 ? dayConfig : null;
  const enabledOnDay = (type: StoredDomainType): boolean => pastConfig === null || enabledIn(pastConfig, type);

  const mentalDomain = domains.find((domain) => domain.type === 'mental') ?? null;

  let mental: MentalDayView | null = null;
  if (mentalDomain?.enabled && enabledOnDay('mental')) {
    const active =
      pastConfig === null
        ? (await questionsRepository.listActive()).filter((question) => question.domainId === mentalDomain.id)
        : questionsAskedIn(pastConfig, mentalDomain.id, await questionsRepository.list());
    const byQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
    const items: CheckInItem[] = active.map((question) => ({
      question,
      answer: byQuestion.get(question.id) ?? null,
    }));
    const answeredCount = items.filter((item) => item.answer !== null).length;
    mental = {
      items,
      answeredCount,
      complete: items.length > 0 && answeredCount === items.length,
    };
  }

  const training: TrainingDayView[] = [];
  for (const type of WEEKLY_DOMAIN_TYPES) {
    if (!enabledOnDay(type)) continue;
    const view = await trainingWeekOf(type, domains, date, reference, snapshots);
    if (view) training.push(view);
  }

  const foodDomain = domains.find((entry) => entry.type === 'food');
  let food: FoodDayView | null = null;
  if (foodDomain?.enabled && enabledOnDay('food')) {
    const [rating, entries] = await Promise.all([
      foodDaysRepository.get(date),
      foodEntriesRepository.listByDate(date),
    ]);
    const ordered = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    food = {
      adherence: rating?.adherence ?? null,
      note: rating?.note ?? null,
      focus: focusOf(foodDomain) ?? null,
      entries: ordered,
      totals: foodTotals(ordered),
    };
  }

  // What the day view offers is the write rule, not the scoring window: a
  // day lived before the update may still be open for scoring and already
  // read-only (D133).
  const writable = checkInWritable(date, reference, dayConfig);
  const editState: DayEditState = writable ? 'open' : date > reference ? 'future' : 'closed';
  return {
    date,
    editState,
    editable: writable,
    mental,
    training,
    food,
    legacySportChoicePending: needsLegacySportChoice(settings.legacySportMigration),
    paused: isPausedOn(pauses, date),
    empty: mental === null && training.length === 0 && food === null,
  };
}

/**
 * Whether yesterday still owes a daily answer that can be given (D138): a
 * question or the Food rating unanswered on a day the write rule still
 * opens. Heute says so in one quiet line; nothing is scored from it.
 */
export async function yesterdayOutstanding(reference: DateKey = today()): Promise<boolean> {
  const day = await loadDay(addDays(reference, -1), reference);
  if (!day.editable) return false;
  const questions = day.mental !== null && day.mental.answeredCount < day.mental.items.length;
  const food = day.food !== null && day.food.adherence === null;
  return questions || food;
}

/**
 * The questions a snapshot asked in a domain, as their live records in the
 * order Areas shows them. A question's wording and scale come from its
 * record; whether it was asked comes from the day.
 */
function questionsAskedIn(
  config: AppConfigSnapshot,
  domainId: string,
  live: readonly QuestionRecord[],
): QuestionRecord[] {
  const asked = new Set(
    config.questions
      .filter((question) => question.domainId === domainId && question.status === 'active')
      .map((question) => question.id),
  );
  return live.filter((question) => asked.has(question.id));
}

/** The user's own sentence for what they are eating towards, if they wrote one. */
function focusOf(domain: { settings: unknown }): string | null {
  const settings = domain.settings as { focus?: unknown };
  return typeof settings.focus === 'string' && settings.focus.trim() !== ''
    ? settings.focus
    : null;
}

function foodTotals(entries: readonly FoodEntryRecord[]): FoodTotals {
  const sum = (pick: (entry: FoodEntryRecord) => number | null): number =>
    Math.round(entries.reduce((total, entry) => total + (pick(entry) ?? 0), 0));
  return {
    kcal: sum((entry) => entry.kcal),
    proteinG: sum((entry) => entry.proteinG),
    carbsG: sum((entry) => entry.carbsG),
    fatG: sum((entry) => entry.fatG),
  };
}

function validate(question: QuestionRecord, value: AnswerValue): AnswerValue {
  if (question.type === 'boolean') {
    if (typeof value !== 'boolean') {
      throw new InvalidAnswerError('A yes/no question takes a boolean answer');
    }
    return value;
  }
  if (!isValidScaleValue(value) || !Number.isInteger(value)) {
    throw new InvalidAnswerError('A scale question takes a whole number from 1 to 10');
  }
  return value;
}

/**
 * Writes one answer. Saving is the whole interaction — there is no confirm
 * step, so this has to be safe to call on every tap.
 */
export async function saveAnswer(
  date: DateKey,
  questionId: string,
  value: AnswerValue,
  reference: DateKey = today(),
): Promise<AnswerRecord> {
  await assertEditable(date, reference, 'mental');
  const question = await questionsRepository.get(questionId);
  if (!question) throw new InvalidAnswerError(`Unknown question ${questionId}`);
  const snapshot = await ensureCurrentSnapshot();
  return answersRepository.save({
    date,
    questionId,
    domainId: question.domainId,
    value: validate(question, value),
    valueType: question.type,
    configSnapshotId: snapshot.id,
  });
}

/**
 * Returns a question to unanswered — which is not the same as answering
 * "no". Only an explicit clear action reaches this; selecting an option
 * never removes an answer, so a stray second tap cannot destroy data.
 */
export async function clearAnswer(
  date: DateKey,
  questionId: string,
  reference: DateKey = today(),
): Promise<void> {
  await assertEditable(date, reference, 'mental');
  await answersRepository.clear(date, questionId);
}

export interface SessionInput {
  note?: string | null;
  durationMinutes?: number | null;
  /**
   * Measured distance in whole metres. Optional: a run saves without it, and
   * without a duration, because logging has to stay one tap. Supplying both
   * is what unlocks performance (D102).
   */
  distanceMetres?: number | null;
  /**
   * Moving a run to the day it actually happened: today or yesterday, across
   * a week boundary too (D133). A Gym session keeps its day.
   */
  date?: DateKey;
}

/** Whole metres, or `null`. One rounding rule, in one place. */
function metresFrom(value: number | null | undefined): number | null {
  if (value === undefined || value === null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

export async function logSession(
  domain: StoredDomainType,
  date: DateKey = today(),
  input: SessionInput = {},
  reference: DateKey = today(),
): Promise<TrainingSession> {
  await assertSessionWritable(date, reference, domain);
  const record = await domainsRepository.findByType(domain);
  if (!record || !record.enabled) {
    throw new InvalidAnswerError(`${domain} is not enabled`);
  }
  const snapshot = await ensureCurrentSnapshot();

  if (domain === 'gym') {
    const session = await gymSessionsRepository.create({
      date,
      note: input.note ?? null,
      configSnapshotId: snapshot.id,
    });
    return {
      id: session.id,
      domain,
      date: session.date,
      performedAt: session.performedAt,
      note: session.note,
      durationMinutes: null,
      distanceMetres: null,
      legacyCarryOver: false,
    };
  }

  if (domain === 'running') {
    const run = await runsRepository.create({
      date,
      note: input.note ?? null,
      durationSeconds:
        input.durationMinutes === undefined || input.durationMinutes === null
          ? null
          : Math.round(input.durationMinutes * 60),
      distanceMetres: metresFrom(input.distanceMetres),
      configSnapshotId: snapshot.id,
    });
    return {
      id: run.id,
      domain,
      date: run.date,
      performedAt: run.performedAt,
      note: run.note,
      durationMinutes: minutesFromSeconds(run.durationSeconds),
      distanceMetres: run.distanceMetres,
      legacyCarryOver: false,
    };
  }

  const session = await sportsSessionsRepository.create({
    domainId: record.id,
    date,
    note: input.note ?? null,
    durationMinutes: input.durationMinutes ?? null,
    configSnapshotId: snapshot.id,
  });
  return {
    id: session.id,
    domain: 'sports',
    date: session.date,
    performedAt: session.performedAt,
    note: session.note,
    durationMinutes: session.durationMinutes,
    distanceMetres: null,
    legacyCarryOver: false,
  };
}

export async function updateSession(
  domain: StoredDomainType,
  id: string,
  input: SessionInput,
  reference: DateKey = today(),
): Promise<void> {
  if (domain === 'gym') {
    const session = await gymSessionsRepository.get(id);
    if (!session) return;
    await assertSessionWritable(session.date, reference);
    // A Gym session keeps its day (D133, STOP 3a question 9): its sets carry
    // their own date, so moving the session alone would split its attendance
    // and its performance across two days, or two weeks.
    if (input.date !== undefined && input.date !== session.date) {
      throw new InvalidAnswerError('A Gym session keeps the day it was logged for');
    }
    await gymSessionsRepository.put({ ...session, note: input.note ?? null });
    return;
  }

  if (domain === 'running') {
    const run = await runsRepository.get(id);
    if (!run) return;
    await assertSessionWritable(run.date, reference);
    const date = input.date ?? run.date;
    // Between today and yesterday only, across a week boundary too (D133).
    if (date !== run.date) await assertSessionWritable(date, reference, 'running');
    await runsRepository.put({
      ...run,
      date,
      weekKey: weekKeyOf(date),
      note: input.note ?? null,
      durationSeconds:
        input.durationMinutes === undefined || input.durationMinutes === null
          ? null
          : Math.round(input.durationMinutes * 60),
      // Absent means the user cleared it; a run without a distance is still a
      // run, and simply stops carrying performance.
      distanceMetres: metresFrom(input.distanceMetres),
    });
    return;
  }

  const session = await sportsSessionsRepository.get(id);
  if (!session) return;
  await assertSessionWritable(session.date, reference);
  const date = input.date ?? session.date;
  if (date !== session.date) await assertSessionWritable(date, reference);
  await sportsSessionsRepository.update(id, {
    date,
    note: input.note ?? null,
    durationMinutes: input.durationMinutes ?? null,
  });
}

export async function deleteSession(
  domain: StoredDomainType,
  id: string,
  reference: DateKey = today(),
): Promise<void> {
  if (domain === 'gym') {
    const session = await gymSessionsRepository.get(id);
    if (!session) return;
    await assertSessionWritable(session.date, reference);
    await gymSessionsRepository.remove(id);
    return;
  }
  if (domain === 'running') {
    const run = await runsRepository.get(id);
    if (!run) return;
    await assertSessionWritable(run.date, reference);
    await runsRepository.remove(id);
    return;
  }
  const session = await sportsSessionsRepository.get(id);
  if (!session) return;
  await assertSessionWritable(session.date, reference);
  await sportsSessionsRepository.remove(id);
}

/* ── Food ──────────────────────────────────────────────────────────────── */

/**
 * Writes the day's adherence rating.
 *
 * Under exactly the same edit-window rule as a Wellbeing answer, because it
 * is the same kind of act: a judgement about a calendar day, correctable
 * while the day is still open and fixed once it closes. It is not a diary
 * entry, so it does not get the session rule.
 *
 * The number written is the number the user chose. Nothing here converts it
 * to a percentage, compares it to a target or looks at what was eaten.
 */
export async function saveAdherence(
  date: DateKey,
  adherence: number,
  note: string | null = null,
  reference: DateKey = today(),
): Promise<void> {
  await assertEditable(date, reference, 'food');
  if (!isValidAdherence(adherence)) {
    throw new InvalidAnswerError('Adherence is a whole number from 1 to 10');
  }
  const snapshot = await ensureCurrentSnapshot();
  await foodDaysRepository.save({
    date,
    adherence,
    note,
    configSnapshotId: snapshot.id,
  });
}

/** Clearing a rating returns the day to "not rated", never to a bad day. */
export async function clearAdherence(
  date: DateKey,
  reference: DateKey = today(),
): Promise<void> {
  await assertEditable(date, reference, 'food');
  await foodDaysRepository.clear(date);
}

export interface FoodEntryInput {
  /** The demo food this came from, or `null` for something typed by hand. */
  foodId: string | null;
  label: string;
  grams: number | null;
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

/**
 * Logs one thing eaten.
 *
 * The figures are copied onto the entry rather than referenced, so an entry
 * keeps saying what it said even if the catalogue behind it changes — the
 * same reason a gym set records the muscle groups it was logged under.
 */
export async function addFoodEntry(
  date: DateKey,
  input: FoodEntryInput,
  reference: DateKey = today(),
): Promise<FoodEntryRecord> {
  await assertEditable(date, reference, 'food');
  const label = input.label.trim();
  if (label === '') throw new InvalidAnswerError('A food entry needs a name');
  if (!Number.isFinite(input.kcal) || input.kcal < 0) {
    throw new InvalidAnswerError('A food entry needs a non-negative energy value');
  }
  const snapshot = await ensureCurrentSnapshot();
  const stamp = nowIso();
  const record: FoodEntryRecord = {
    id: createId('food'),
    date,
    foodId: input.foodId,
    label,
    grams: input.grams,
    kcal: Math.round(input.kcal),
    proteinG: input.proteinG,
    carbsG: input.carbsG,
    fatG: input.fatG,
    detail: null,
    // Food defaults to private, like Wellbeing (D47). Nothing reads it yet.
    sensitivity: 'private',
    configSnapshotId: snapshot.id,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await foodEntriesRepository.put(record);
  return record;
}

export async function removeFoodEntry(
  date: DateKey,
  id: string,
  reference: DateKey = today(),
): Promise<void> {
  await assertEditable(date, reference, 'food');
  const existing = await foodEntriesRepository.get(id);
  // A stale screen could ask to delete something from a day it is not on.
  if (!existing || existing.date !== date) return;
  await foodEntriesRepository.remove(id);
}
