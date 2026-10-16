import { today } from '../../core/clock';
import { checkInWritable, sessionWritable, snapshotOn, weekWindows } from '../../core/config/closure';
import {
  addDays,
  compareDateKeys,
  weekKeyOf,
  type DateKey,
  type DayEditState,
  type WeekKey,
} from '../../core/dates';
import { WEEKLY_DOMAIN_TYPES, weeklyTargetIn, weeklyTargetOf } from '../../core/domains';
import { needsLegacySportChoice } from '../../core/migration/legacySport';
import { isPausedOn } from '../../core/pause';
import { isValidScaleValue } from '../../core/scoring/scale';
import type {
  AnswerRecord,
  AnswerValue,
  AppConfigSnapshot,
  ConfigSnapshotRecord,
  DomainRecord,
  QuestionRecord,
  StoredDomainType,
} from '../../core/model';
import { weekProgress, type WeekProgress } from '../../domains/sports/weekProgress';
import { ensureCurrentSnapshot } from '../configService';
import {
  answersRepository,
  configSnapshotsRepository,
  domainsRepository,
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
 * an answer, a session or a run may be written for today and yesterday, on a
 * day of the P8 era — for a session also in a week whose Sunday can still be
 * written. Older days are closed and read-only. The rule itself lives in
 * `core/config/closure.ts`, beside the closure it guarantees.
 *
 * Nothing here writes Food (D140): Food left the product in WP3 Stage 4, its
 * data is kept and replayed, and no path creates or deletes any of it.
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

export interface DayView {
  date: DateKey;
  editState: DayEditState;
  editable: boolean;
  /** `null` when Wellbeing is disabled or was never enabled. */
  mental: MentalDayView | null;
  /** One entry per enabled weekly-quota domain, in display order. */
  training: TrainingDayView[];
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
 * The one write rule, for a check-in answer (D133): today or yesterday, on a
 * day of the P8 era. A day lived before the update keeps
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
  // A day before today states its week against the target it was lived
  // under, from its own snapshot — so a domain switched off this morning
  // still shows yesterday's card (D133); today reads the live record.
  const dayConfig = compareDateKeys(date, reference) < 0 ? snapshotOn(snapshots, date) : undefined;
  const target =
    dayConfig !== undefined
      ? dayConfig
        ? weeklyTargetIn(dayConfig, type)
        : null
      : domain
        ? weeklyTargetOf(domain)
        : null;
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
   * would take an answer nothing scores and withhold one that is. A day
   * before the app was set up had nothing due at all. Today reads the live
   * configuration, which today's snapshot follows.
   */
  const past = compareDateKeys(date, reference) < 0;
  // A domain switched off this morning was still due yesterday: a past day
  // follows its own snapshot alone; the live record supplies only its id.
  const shownOnDay = (domain: DomainRecord | null | undefined): domain is DomainRecord =>
    Boolean(domain) && (past ? enabledIn(dayConfig, domain!.type) : domain!.enabled);

  const mentalDomain = domains.find((domain) => domain.type === 'mental') ?? null;

  let mental: MentalDayView | null = null;
  if (shownOnDay(mentalDomain)) {
    const active =
      past && dayConfig
        ? questionsAskedIn(dayConfig, mentalDomain.id, await questionsRepository.list())
        : (await questionsRepository.listActive()).filter((question) => question.domainId === mentalDomain.id);
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
    if (past && !enabledIn(dayConfig, type)) continue;
    const view = await trainingWeekOf(type, domains, date, reference, snapshots);
    if (view) training.push(view);
  }

  // Food is not shown on any day, not even on a yesterday that still had it
  // due (D141): it left the product, nothing can rate it, and a card or a
  // count for it would ask for an answer nobody can give.

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
    legacySportChoicePending: needsLegacySportChoice(settings.legacySportMigration),
    paused: isPausedOn(pauses, date),
    empty: mental === null && training.length === 0,
  };
}

/**
 * Whether yesterday still owes a daily answer that can be given (D138): a
 * question unanswered on a day the write rule still opens. Heute says so in
 * one quiet line; nothing is scored from it.
 */
export async function yesterdayOutstanding(reference: DateKey = today()): Promise<boolean> {
  const day = await loadDay(addDays(reference, -1), reference);
  if (!day.editable) return false;
  return day.mental !== null && day.mental.answeredCount < day.mental.items.length;
}

/**
 * The questions a snapshot asked in a domain, as their live records in the
 * order Areas shows them. The wording is the record's — the latest wording
 * wins, as in the history — but whether it was asked and how it is answered
 * (its type) come from the day, which is how the replay scores it.
 */
function questionsAskedIn(
  config: AppConfigSnapshot,
  domainId: string,
  live: readonly QuestionRecord[],
): QuestionRecord[] {
  const asked = new Map(
    config.questions
      .filter((question) => question.domainId === domainId && question.status === 'active')
      .map((question) => [question.id, question]),
  );
  return live.flatMap((question) => {
    const onDay = asked.get(question.id);
    return onDay ? [{ ...question, type: onDay.type }] : [];
  });
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
  // Today's configuration is brought up to date first, so a snapshot that
  // lags behind a change is repaired by the answer, never held against it.
  const snapshot = await ensureCurrentSnapshot();
  // The question as the day asked it (D133): today, as Heute shows it — the
  // live record, which today's snapshot now follows; a past day, as its own
  // snapshot asked it, since the replay scores it by that. A type changed
  // today must not decide how yesterday's answer is read, and a question
  // yesterday did not ask takes no answer for it.
  const asked =
    date === reference
      ? question
      : snapshotOn(await configSnapshotsRepository.list(), date)?.questions.find(
          (entry) => entry.id === questionId && entry.status === 'active',
        );
  if (!asked) throw new InvalidAnswerError(`Question ${questionId} was not asked on ${date}`);
  return answersRepository.save({
    date,
    questionId,
    domainId: question.domainId,
    value: validate({ ...question, type: asked.type }, value),
    valueType: asked.type,
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
  // The retired Sport log takes nothing new, ever (CLAUDE.md, D112) — and a
  // daily domain has no sessions: Mind or Food here would land in that same
  // retired log (D140).
  if (domain === 'sports') throw new InvalidAnswerError('The retired Sport log takes no new session');
  if (domain !== 'gym' && domain !== 'running') throw new InvalidAnswerError(`${domain} takes no sessions`);
  // The day's snapshot decides whether the domain was on (D133): a run for
  // yesterday stays writable after the domain was switched off this morning.
  await assertSessionWritable(date, reference, domain);
  const record = await domainsRepository.findByType(domain);
  if (!record) throw new InvalidAnswerError(`${domain} is not enabled`);
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
  // A Gym session goes only in its workout, set by set, each removal undoable
  // and the session back with the same id (D131, D137) — never from here,
  // which would delete the session and leave its sets counting (D142).
  if (domain === 'gym') throw new InvalidAnswerError('A Gym session is removed in its workout');
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
