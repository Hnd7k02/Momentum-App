import { nowIso, today } from '../../core/clock';
import { isSameWeek, type DateKey } from '../../core/dates';
import { catalogueRecords } from '../../core/gym/catalogue';
import { bodyweightOn, effectiveLoadGrams, type BodyweightPoint } from '../../core/gym/load';
import {
  exerciseDays,
  gymPerformance,
  gymPerformanceOverSpan,
  latestComparisons,
  type ExerciseComparison,
  type ExerciseDay,
  type ExerciseDayInput,
  type GymPerformance,
  type SetInput,
} from '../../core/gym/performance';
import { createId } from '../../core/ids';
import type {
  ExerciseLoadType,
  ExerciseRecord,
  GymSessionExerciseSnapshot,
  GymSessionRecord,
  GymSetRecord,
  MuscleGroup,
  SessionExerciseSource,
  TrainingPlanRecord,
} from '../../core/model';
import { ensureCurrentSnapshot } from '../configService';
import {
  exercisesRepository,
  gymSessionsRepository,
  gymSetsRepository,
  weightEntriesRepository,
} from '../repositories';
import { EditWindowError } from './checkInService';

/**
 * Everything the Gym screens read and write.
 *
 * The rules that are not the UI's to know live here: which exercises exist,
 * what a session contains, and when a set may still be changed. The
 * arithmetic lives one layer further down in `core/gym/performance.ts` and
 * touches no storage at all.
 */

/* ── The catalogue ──────────────────────────────────────────────────────── */

/**
 * Seeds the built-in exercises the first time Gym is opened.
 *
 * Idempotent, and it never overwrites: an exercise the user has renamed keeps
 * its name, because the record belongs to them once it exists. Only genuinely
 * missing ids are written, which is also how a later release adds one.
 */
export async function ensureExerciseCatalogue(): Promise<ExerciseRecord[]> {
  const existing = await exercisesRepository.getAll();
  const known = new Set(existing.map((exercise) => exercise.id));
  const missing = catalogueRecords(nowIso()).filter((record) => !known.has(record.id));
  if (missing.length > 0) await exercisesRepository.putMany(missing);
  return [...existing, ...missing].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listExercises(): Promise<ExerciseRecord[]> {
  return (await exercisesRepository.getAll()).sort((a, b) => a.name.localeCompare(b.name));
}

export interface NewExerciseInput {
  name: string;
  muscles: MuscleGroup[];
  /** Defaults to the first listed group, which is the picker's own ordering. */
  primaryMuscles?: MuscleGroup[];
  loadType?: ExerciseLoadType;
}

/** A user's own exercise. Its id is generated once and never changes. */
export async function createExercise(input: NewExerciseInput): Promise<ExerciseRecord> {
  const stamp = nowIso();
  const primary =
    input.primaryMuscles && input.primaryMuscles.length > 0
      ? input.primaryMuscles.filter((muscle) => input.muscles.includes(muscle))
      : input.muscles.slice(0, 1);
  const record: ExerciseRecord = {
    id: createId('ex'),
    name: input.name.trim(),
    muscles: input.muscles,
    primaryMuscles: primary,
    builtIn: false,
    loadType: input.loadType ?? 'external',
    durationSeconds: null,
    attributes: {},
    createdAt: stamp,
    updatedAt: stamp,
  };
  await exercisesRepository.put(record);
  return record;
}

/**
 * Remaps one exercise's muscle groups and roles.
 *
 * **Only a custom exercise.** A built-in's mapping belongs to the catalogue
 * (D93): it ships with the app, it is the same on every device, and letting
 * one user's edit of "Bench Press" silently diverge from the catalogue would
 * make the built-in id mean two different things. A user who wants their own
 * mapping makes their own exercise, which is one tap and keeps both histories
 * honest.
 *
 * The change applies **forward only**, and not by special handling: every set
 * already recorded carries the mapping it was logged under, so a workout
 * already done cannot be reinterpreted by this at all (D87).
 */
export class BuiltInExerciseError extends Error {
  constructor(readonly exerciseId: string) {
    super(`${exerciseId} is a built-in exercise; its mapping is the catalogue's`);
    this.name = 'BuiltInExerciseError';
  }
}

export async function remapExercise(
  exerciseId: string,
  muscles: MuscleGroup[],
  primaryMuscles: MuscleGroup[],
): Promise<ExerciseRecord | undefined> {
  const exercise = await exercisesRepository.get(exerciseId);
  if (!exercise) return undefined;
  if (exercise.builtIn) throw new BuiltInExerciseError(exerciseId);
  const next: ExerciseRecord = {
    ...exercise,
    muscles,
    primaryMuscles: primaryMuscles.filter((muscle) => muscles.includes(muscle)),
    updatedAt: nowIso(),
  };
  await exercisesRepository.put(next);
  return next;
}

/* ── Bodyweight ─────────────────────────────────────────────────────────── */

/**
 * Records what the user weighs on a day.
 *
 * A bodyweight exercise cannot be scored without this, and the entry is a
 * dated fact of its own rather than a property of the session: the same
 * measurement serves every set on that day and every set after it until the
 * next one. One entry per day — weighing yourself twice on a Tuesday replaces
 * Tuesday's number rather than creating a second history.
 */
export async function recordBodyweight(kg: number, date: DateKey = today(), reference: DateKey = today()) {
  // The same weekly rule as a set: a bodyweight set replays the latest entry
  // on or before its own day, so an entry dated into a closed week would
  // change how that week's sets replay.
  assertEditable(date, reference);
  const existing = (await weightEntriesRepository.listByDateRange(date, date))[0];
  const stamp = nowIso();
  const record = {
    id: existing?.id ?? createId('wt'),
    date,
    kg,
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  };
  await weightEntriesRepository.put(record);
  return record;
}

/** The bodyweight in force on a day, in kilograms, or `null` if none is. */
export async function bodyweightFor(date: DateKey = today()): Promise<number | null> {
  const entry = await weightEntriesRepository.latestOnOrBefore(date);
  return entry?.kg ?? null;
}

/* ── A session and what it contains ─────────────────────────────────────── */

export interface SessionExercise {
  exercise: ExerciseRecord;
  sets: GymSetRecord[];
  /** The best set of this exercise on this day, if any set is scorable. */
  bestScore: number | null;
  /**
   * Where the session says the exercise came from, when the session owns a
   * snapshot; `null` for a session that renders from its sets alone.
   */
  source: SessionExerciseSource | null;
  /**
   * The most recent earlier day this exercise was recorded, and its sets in
   * order — what the user did last time. `null` when there is no earlier
   * day. The session on screen is never its own "last time".
   */
  lastRecorded: LastRecorded | null;
}

export interface LastRecorded {
  date: DateKey;
  sets: { reps: number; weightGrams: number }[];
}

export interface GymSessionView {
  session: GymSessionRecord;
  exercises: SessionExercise[];
  /** Whether the session may still be changed, by the app's existing rule. */
  editable: boolean;
}

/**
 * The same rule sessions already follow, applied to what is inside them.
 *
 * A training session is a diary entry rather than a daily check-in, so it is
 * editable for the week it belongs to — `checkInService` established that and
 * a set is part of a session, not a thing with a policy of its own.
 */
function assertEditable(date: DateKey, reference: DateKey): void {
  if (!isSameWeek(date, reference)) throw new EditWindowError(date, 'closed');
}

export async function loadSession(
  sessionId: string,
  reference: DateKey = today(),
): Promise<GymSessionView | null> {
  const session = await gymSessionsRepository.get(sessionId);
  if (!session) return null;
  const [sets, exercises, bodyweight] = await Promise.all([
    gymSetsRepository.listBySession(sessionId),
    listExercises(),
    // The weight in force on the session's own day, never today's: a session
    // opened in the edit window still reads the body it was performed with.
    weightEntriesRepository.latestOnOrBefore(session.date),
  ]);
  const grouped = groupSets(sets, exercises, toGrams(bodyweight?.kg ?? null), session.exercises);
  return {
    session,
    exercises: await withLastRecorded(grouped, session.id, session.date),
    editable: isSameWeek(session.date, reference),
  };
}

/* ── A planned workout before it is a session ──────────────────────────── */

/**
 * What the user chose to do today, before any of it has happened.
 *
 * Choosing a plan is not a workout. The draft is the plan's lines — plus any
 * exercise added on the spot — held by the screen and written nowhere: no
 * session row exists, so nothing has been credited for attendance, until
 * the first set is actually saved (`startSessionFromDraft`). A reload before
 * that forgets the choice, which is correct: there was nothing to remember.
 */
export interface SessionDraft {
  /** Provenance only. Never used to resolve the draft's contents. */
  planId: string | null;
  exercises: GymSessionExerciseSnapshot[];
}

/** A draft from a saved plan: its lines, in its order, all marked `plan`. */
export function draftFromPlan(plan: TrainingPlanRecord): SessionDraft {
  return {
    planId: plan.id,
    exercises: [...plan.exercises]
      .sort((a, b) => a.order - b.order)
      .map((line, index) => ({
        exerciseId: line.exerciseId,
        name: line.name,
        order: index,
        source: 'plan' as const,
      })),
  };
}

/** The draft as the session screen shows it: every exercise, no set yet. */
export async function loadDraftView(
  draft: SessionDraft,
  date: DateKey = today(),
): Promise<Omit<GymSessionView, 'session'>> {
  const exercises = await listExercises();
  const grouped = groupSets([], exercises, null, draft.exercises);
  return {
    exercises: await withLastRecorded(grouped, null, date),
    editable: true,
  };
}

/**
 * Persists the draft as the day's session, the moment there is something
 * real to persist.
 *
 * Called by the screen together with the first saved set, never on its
 * own. The session is the day's existing one if there is one — one session
 * per calendar day, and a second plan never overwrites a snapshot already
 * written — otherwise a new one carrying the draft as its own snapshot.
 * Calling it twice for the same day returns the same session and writes
 * the snapshot once, so a retry cannot duplicate anything.
 */
export async function startSessionFromDraft(
  draft: SessionDraft,
  date: DateKey = today(),
  reference: DateKey = today(),
): Promise<GymSessionRecord> {
  const session = await openSessionForDay(date, reference);
  if (session.exercises !== undefined) return session;
  const next: GymSessionRecord = {
    ...session,
    planId: session.planId ?? draft.planId,
    exercises: draft.exercises.map((entry, index) => ({ ...entry, order: index })),
    updatedAt: nowIso(),
  };
  await gymSessionsRepository.put(next);
  return next;
}

/**
 * Adds an exercise to a session's own snapshot, as an extra.
 *
 * A session without a snapshot renders from its sets and needs no entry; a
 * session that already names the exercise keeps the entry it has. The saved
 * plan is never touched from here — an extra belongs to the day it was done.
 */
export async function addSessionExercise(
  sessionId: string,
  exerciseId: string,
  reference: DateKey = today(),
): Promise<GymSessionRecord> {
  const session = await gymSessionsRepository.get(sessionId);
  if (!session) throw new Error(`Unknown session ${sessionId}`);
  if (session.exercises === undefined) return session;
  if (session.exercises.some((entry) => entry.exerciseId === exerciseId)) return session;
  assertEditable(session.date, reference);
  const exercise = await exercisesRepository.get(exerciseId);
  const next: GymSessionRecord = {
    ...session,
    exercises: [
      ...session.exercises,
      {
        exerciseId,
        name: exercise?.name ?? exerciseId,
        order: session.exercises.length,
        source: 'extra',
      },
    ],
    updatedAt: nowIso(),
  };
  await gymSessionsRepository.put(next);
  return next;
}

/**
 * What the user did the last time they recorded an exercise, per exercise.
 *
 * Read from the sets, never invented: an exercise with no earlier day has
 * `null`. The session being viewed is excluded so that a workout in
 * progress is never its own "last time".
 */
async function withLastRecorded(
  entries: SessionExercise[],
  excludeSessionId: string | null,
  before: DateKey,
): Promise<SessionExercise[]> {
  return Promise.all(
    entries.map(async (entry) => ({
      ...entry,
      lastRecorded: await lastRecordedFor(entry.exercise.id, excludeSessionId, before),
    })),
  );
}

export async function lastRecordedFor(
  exerciseId: string,
  excludeSessionId: string | null,
  before: DateKey = today(),
): Promise<LastRecorded | null> {
  const sets = (await gymSetsRepository.listByExercise(exerciseId)).filter(
    (set) => set.sessionId !== excludeSessionId && set.date <= before && set.reps > 0,
  );
  if (sets.length === 0) return null;
  const latest = sets.reduce((max, set) => (set.date > max ? set.date : max), sets[0]!.date);
  return {
    date: latest,
    sets: sets
      .filter((set) => set.date === latest)
      .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
      .map((set) => ({ reps: set.reps, weightGrams: set.weightGrams })),
  };
}

/** Kilograms as whole grams, or `null`. One place, so rounding is one rule. */
function toGrams(kg: number | null): number | null {
  return kg === null || !Number.isFinite(kg) || kg <= 0 ? null : Math.round(kg * 1000);
}

/**
 * The exercises of a session, in order.
 *
 * With a snapshot, the session's own list is the order and every entry is
 * present whether or not it has a set yet; a set whose exercise the snapshot
 * does not name is appended, so nothing recorded can ever be hidden.
 * Without one — every session before WP2-1, and every free session — the
 * order is the order the sets were added in, exactly as it always was.
 */
function groupSets(
  sets: GymSetRecord[],
  exercises: ExerciseRecord[],
  bodyweightGrams: number | null,
  snapshot: readonly GymSessionExerciseSnapshot[] | undefined,
): SessionExercise[] {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const order: string[] = [];
  const grouped = new Map<string, GymSetRecord[]>();
  const sources = new Map<string, SessionExerciseSource>();
  const snapshotNames = new Map<string, string>();
  for (const entry of [...(snapshot ?? [])].sort((a, b) => a.order - b.order)) {
    if (grouped.has(entry.exerciseId)) continue;
    grouped.set(entry.exerciseId, []);
    order.push(entry.exerciseId);
    sources.set(entry.exerciseId, entry.source);
    snapshotNames.set(entry.exerciseId, entry.name);
  }
  for (const set of [...sets].sort((a, b) => a.order - b.order)) {
    const list = grouped.get(set.exerciseId);
    if (list) list.push(set);
    else {
      grouped.set(set.exerciseId, [set]);
      order.push(set.exerciseId);
    }
  }

  return order.map((exerciseId) => {
    const list = grouped.get(exerciseId)!;
    const best = bestScoreOf(list, bodyweightGrams);
    return {
      exercise:
        byId.get(exerciseId) ??
        /* An exercise that has been deleted still has to render its history:
           the sets know their own muscles, and the snapshot its name, so
           nothing is lost. */
        ({
          id: exerciseId,
          name: snapshotNames.get(exerciseId) ?? exerciseId,
          muscles: list[0]?.muscles ?? [],
          ...(list[0]?.primaryMuscles === undefined
            ? {}
            : { primaryMuscles: list[0].primaryMuscles }),
          builtIn: false,
          loadType: list[0]?.loadType ?? 'external',
          durationSeconds: null,
          attributes: {},
          createdAt: '',
          updatedAt: '',
        } satisfies ExerciseRecord),
      sets: list,
      bestScore: best,
      source: snapshot === undefined ? null : (sources.get(exerciseId) ?? 'extra'),
      lastRecorded: null,
    };
  });
}

/**
 * A stored set as the pure pipeline wants it: reps and the **effective load**.
 *
 * The load is resolved here rather than in `core/gym/performance.ts` because
 * resolving it needs the user's dated bodyweight history, which is storage's
 * business. A set whose load cannot be resolved — a pull-up before the user
 * ever weighed themselves, an assistance heavier than they are — comes back
 * `null` and is dropped, exactly as a zero-rep set already is. Dropped is not
 * scored zero: it describes no work anyone can measure, and this app does not
 * turn "we cannot tell" into "you failed".
 */
const toSetInput = (set: GymSetRecord, bodyweightGrams: number | null): SetInput | null => {
  const load = effectiveLoadGrams({
    ...(set.loadType === undefined ? {} : { loadType: set.loadType }),
    weightGrams: set.weightGrams,
    bodyweightGrams,
  });
  if (load === null) return null;
  return { id: set.id, reps: set.reps, weightGrams: load, order: set.order };
};

function bestScoreOf(sets: GymSetRecord[], bodyweightGrams: number | null): number | null {
  let best: number | null = null;
  for (const set of sets) {
    const input = toSetInput(set, bodyweightGrams);
    if (!input || input.reps <= 0 || input.weightGrams <= 0) continue;
    const score = input.reps * input.weightGrams;
    if (best === null || score > best) best = score;
  }
  return best;
}

export interface AddSetInput {
  sessionId: string;
  exerciseId: string;
  reps: number;
  /**
   * What the user entered: the bar for an external lift, the added weight for
   * a bodyweight one, the assistance for an assisted one. Which of the three
   * it is comes from the exercise's load type, and is recorded on the set.
   */
  weightGrams: number;
}

/**
 * Adds one set.
 *
 * The muscle groups are copied from the exercise **now** and stored on the
 * set, so remapping an exercise later changes what it counts towards from
 * that point forward and cannot reach into a workout already done.
 */
export async function addSet(
  input: AddSetInput,
  reference: DateKey = today(),
): Promise<GymSetRecord> {
  const session = await gymSessionsRepository.get(input.sessionId);
  if (!session) throw new Error(`Unknown session ${input.sessionId}`);
  assertEditable(session.date, reference);

  const [exercise, existing] = await Promise.all([
    exercisesRepository.get(input.exerciseId),
    gymSetsRepository.listBySession(input.sessionId),
  ]);

  const record: GymSetRecord = {
    id: createId('set'),
    sessionId: input.sessionId,
    exerciseId: input.exerciseId,
    date: session.date,
    weightGrams: Math.max(0, Math.round(input.weightGrams)),
    reps: Math.max(0, Math.round(input.reps)),
    order: existing.length,
    muscles: exercise?.muscles ?? [],
    // Roles and load type are copied **now**, for the same reason the groups
    // are: remapping or reclassifying an exercise later changes what it counts
    // for from that point forward and cannot reach a workout already done.
    primaryMuscles: exercise?.primaryMuscles ?? exercise?.muscles.slice(0, 1) ?? [],
    loadType: exercise?.loadType ?? 'external',
    createdAt: nowIso(),
  };
  await gymSetsRepository.put(record);
  return record;
}

export async function updateSet(
  id: string,
  patch: { reps?: number; weightGrams?: number },
  reference: DateKey = today(),
): Promise<GymSetRecord | undefined> {
  const set = await gymSetsRepository.get(id);
  if (!set) return undefined;
  assertEditable(set.date, reference);
  const next: GymSetRecord = {
    ...set,
    reps: patch.reps === undefined ? set.reps : Math.max(0, Math.round(patch.reps)),
    weightGrams:
      patch.weightGrams === undefined ? set.weightGrams : Math.max(0, Math.round(patch.weightGrams)),
  };
  await gymSetsRepository.put(next);
  return next;
}

export async function removeSet(id: string, reference: DateKey = today()): Promise<void> {
  const set = await gymSetsRepository.get(id);
  if (!set) return;
  assertEditable(set.date, reference);
  await gymSetsRepository.remove(id);
}

/** Removes an exercise and every set of it, within the session's own week. */
export async function removeExerciseFromSession(
  sessionId: string,
  exerciseId: string,
  reference: DateKey = today(),
): Promise<void> {
  const sets = await gymSetsRepository.listBySession(sessionId);
  for (const set of sets.filter((entry) => entry.exerciseId === exerciseId)) {
    assertEditable(set.date, reference);
    await gymSetsRepository.remove(set.id);
  }
  // The session's own snapshot forgets it too, so a planned exercise the
  // user removed does not come back as an empty line. The plan is untouched.
  const session = await gymSessionsRepository.get(sessionId);
  if (session?.exercises?.some((entry) => entry.exerciseId === exerciseId)) {
    assertEditable(session.date, reference);
    await gymSessionsRepository.put({
      ...session,
      exercises: session.exercises
        .filter((entry) => entry.exerciseId !== exerciseId)
        .map((entry, index) => ({ ...entry, order: index })),
      updatedAt: nowIso(),
    });
  }
}

/**
 * Opens today's session, creating one if there is not already one.
 *
 * Several sessions on one day are legitimate — the weekly quota counts them —
 * but tapping "log a session" twice in a minute means one workout, so the
 * most recent session for the day is reused rather than doubled.
 */
export async function openSessionForDay(
  date: DateKey = today(),
  reference: DateKey = today(),
): Promise<GymSessionRecord> {
  const existing = await gymSessionsRepository.listByDate(date);
  const last = existing[existing.length - 1];
  if (last) return last;
  assertEditable(date, reference);
  const snapshot = await ensureCurrentSnapshot();
  return gymSessionsRepository.create({ date, configSnapshotId: snapshot.id });
}

/** The day's session if one exists — read only, never created. */
export async function existingSessionForDay(date: DateKey = today()): Promise<GymSessionRecord | null> {
  const existing = await gymSessionsRepository.listByDate(date);
  return existing[existing.length - 1] ?? null;
}

/** The most recent session of all, for the hub to name; `null` before the first. */
export async function latestGymSession(): Promise<GymSessionRecord | null> {
  const all = await gymSessionsRepository.getAll();
  return all[all.length - 1] ?? null;
}

/* ── Performance, replayed ──────────────────────────────────────────────── */

export interface GymHistory {
  /** Every exercise-day in the window, oldest first. */
  days: ExerciseDay[];
  /** The latest comparison per exercise. */
  comparisons: Map<string, ExerciseComparison>;
  /** Recent progress: day against previous day. */
  recent: GymPerformance;
  /** The long view: each exercise across its whole span in the window. */
  overall: GymPerformance;
  /** Names for whatever the screens need to label, by exercise id. */
  names: Map<string, string>;
  /** Exercises whose sets could not be scored for want of a bodyweight. */
  awaitingBodyweight: string[];
}

/**
 * Every exercise-day in a range, with each set's load already resolved.
 *
 * Split out of `loadGymHistory` because the rating replay needs the same
 * exercise-days over a much longer range than any screen shows, and reading
 * the sets twice would be the expensive half of the work done twice.
 */
async function buildExerciseDays(
  from: DateKey,
  to: DateKey,
  exercises: ExerciseRecord[],
): Promise<{ days: ExerciseDay[]; awaitingBodyweight: string[] }> {
  const [sets, weights] = await Promise.all([
    gymSetsRepository.listByDateRange(from, to),
    weightEntriesRepository.getAll(),
  ]);

  /*
   * Every bodyweight the user has ever recorded, not merely those inside the
   * range: a set logged in March is loaded with the last measurement on or
   * before it, and that measurement may well be from February. Filtering to
   * the range would silently drop the baseline and make the same March
   * replay differently depending on which window it was asked about.
   */
  const points: BodyweightPoint[] = [];
  for (const entry of weights) {
    const grams = toGrams(entry.kg);
    if (grams !== null) points.push({ date: entry.date, grams });
  }

  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  /** One lookup per date rather than per set; the history is walked a lot. */
  const bodyweightCache = new Map<DateKey, number | null>();
  const bodyweightFor = (date: DateKey): number | null => {
    const cached = bodyweightCache.get(date);
    if (cached !== undefined) return cached;
    const value = bodyweightOn(points, date);
    bodyweightCache.set(date, value);
    return value;
  };

  const awaiting = new Set<string>();
  const buckets = new Map<string, ExerciseDayInput>();
  for (const set of sets) {
    const key = `${set.date}#${set.exerciseId}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      const exercise = byId.get(set.exerciseId);
      // The set carries the mapping it was logged under; the catalogue is
      // consulted only when a legacy row has none of its own.
      const muscles = set.muscles.length > 0 ? set.muscles : (exercise?.muscles ?? []);
      const primary = set.primaryMuscles ?? undefined;
      bucket = {
        date: set.date,
        exerciseId: set.exerciseId,
        muscles,
        // Absent stays absent. A phase-4 set recorded no roles, and filling
        // them in from today's catalogue would reinterpret a workout already
        // done — the one thing D87 exists to prevent.
        ...(primary === undefined ? {} : { primaryMuscles: primary }),
        sets: [],
      };
      buckets.set(key, bucket);
    }
    const input = toSetInput(set, bodyweightFor(set.date));
    if (input) (bucket.sets as SetInput[]).push(input);
    else if (set.loadType === 'bodyweight' || set.loadType === 'assisted') {
      awaiting.add(set.exerciseId);
    }
  }

  return { days: exerciseDays([...buckets.values()]), awaitingBodyweight: [...awaiting] };
}

/**
 * The Gym pipeline, run over a date range.
 *
 * Replayed from sets on every load, like everything else derived in this app.
 * Nothing about a past workout is stored as a score, so an edit inside the
 * edit window simply produces a different answer next time — and an edit is
 * the only thing that can.
 */
export async function loadGymHistory(from: DateKey, to: DateKey): Promise<GymHistory> {
  const exercises = await listExercises();
  const { days, awaitingBodyweight } = await buildExerciseDays(from, to, exercises);
  return {
    days,
    comparisons: latestComparisons(days),
    recent: gymPerformance(days),
    overall: gymPerformanceOverSpan(days),
    names: new Map(exercises.map((exercise) => [exercise.id, exercise.name])),
    awaitingBodyweight,
  };
}

/** The exercise-days a rating replay needs, over its own long range. */
export async function loadExerciseDays(from: DateKey, to: DateKey): Promise<ExerciseDay[]> {
  const exercises = await listExercises();
  return (await buildExerciseDays(from, to, exercises)).days;
}

/** Every recorded day of one exercise, newest first, for its detail screen. */
export function exerciseHistory(history: GymHistory, exerciseId: string): ExerciseDay[] {
  return history.days
    .filter((day) => day.exerciseId === exerciseId)
    .sort((a, b) => b.date.localeCompare(a.date));
}
