import { nowIso, today } from '../../core/clock';
import { snapshotOn } from '../../core/config/closure';
import { type DateKey } from '../../core/dates';
import { catalogueRecords } from '../../core/gym/catalogue';
import { bodyweightOn, effectiveLoadGrams, type BodyweightPoint } from '../../core/gym/load';
import { gymMetricKey, gymMetricOf, type GymMetric } from '../../core/gym/metric';
import {
  bestSet,
  bestWorkingSet,
  exerciseDays,
  gymPerformance,
  gymPerformanceOverSpan,
  isScorableSet,
  latestComparisons,
  type BestSet,
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
  configSnapshotsRepository,
  exercisesRepository,
  gymSessionsRepository,
  gymSetsRepository,
  settingsRepository,
  weightEntriesRepository,
} from '../repositories';
import { assertSessionWritable, sessionWritableOn } from './checkInService';

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
  // The same rule as a set (D133): a bodyweight set replays the latest entry
  // on or before its own day, so an entry dated into a closed day would
  // change how sets already judged replay.
  await assertEditable(date, reference);
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
  return (await bodyweightEntryFor(date))?.kg ?? null;
}

/** The weight entry in force on `date` — its kilograms and the day it was entered. */
export async function bodyweightEntryFor(
  date: DateKey = today(),
): Promise<{ date: DateKey; kg: number } | null> {
  const entry = await weightEntriesRepository.latestOnOrBefore(date);
  return entry ? { date: entry.date, kg: entry.kg } : null;
}

/* ── A session and what it contains ─────────────────────────────────────── */

export interface SessionExercise {
  exercise: ExerciseRecord;
  sets: GymSetRecord[];
  /**
   * The exercise-day value of this exercise on this day, under the metric in
   * force on the day the screen is read — the best working set since Stage
   * 5b (D150), the best set before it — or `null` when no set provides one.
   */
  bestScore: number | null;
  /**
   * The set that provides it, for a screen to name: the same set the metric
   * took, so the workout never names a best set of its own reckoning. A
   * warm-up set is never it (D151).
   */
  bestSetId: string | null;
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

/**
 * What the user did the last time they *worked* at an exercise: the most
 * recent earlier day with a working set, and that day's working sets in
 * order. Warm-up sets are not a mark to train against (D151), so they are
 * left out — and a day that held only warm-up sets is passed over for the
 * day before it, exactly as it is no exercise-day for the metric.
 */
export interface LastRecorded {
  date: DateKey;
  sets: { reps: number; weightGrams: number }[];
}

export interface GymSessionView {
  session: GymSessionRecord;
  exercises: SessionExercise[];
  /** Whether the session may still be changed, by the app's existing rule. */
  editable: boolean;
  /**
   * Whether the hint that says where the warm-up mark is still stands under
   * the sets: until the user has marked a set once (D175).
   */
  warmUpHint: boolean;
}

/**
 * The one write rule (D133), applied to what is inside a session: today or
 * yesterday, on a day of the P8 era, in a week that is still in progress. A
 * set is part of a session, not a thing with a policy of its own.
 */
async function assertEditable(date: DateKey, reference: DateKey): Promise<void> {
  await assertSessionWritable(date, reference);
}

export async function loadSession(
  sessionId: string,
  reference: DateKey = today(),
): Promise<GymSessionView | null> {
  const session = await gymSessionsRepository.get(sessionId);
  if (!session) return null;
  const [sets, exercises, bodyweight, snapshots, settings] = await Promise.all([
    gymSetsRepository.listBySession(sessionId),
    listExercises(),
    // The weight in force on the session's own day, never today's: a session
    // opened in the edit window still reads the body it was performed with.
    weightEntriesRepository.latestOnOrBefore(session.date),
    configSnapshotsRepository.list(),
    settingsRepository.get(),
  ]);
  // The best set is named by the metric the screens read today (D150), the
  // one the exercise detail and Muskelgruppen name the same day by.
  const metric = gymMetricOf(snapshotOn(snapshots, reference));
  const grouped = groupSets(sets, exercises, toGrams(bodyweight?.kg ?? null), session.exercises, metric);
  return {
    session,
    exercises: await withLastRecorded(grouped, session.id, session.date),
    editable: await sessionWritableOn(session.date, reference),
    warmUpHint: settings?.warmUpMarkUsed !== true,
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
  reference: DateKey = today(),
): Promise<Omit<GymSessionView, 'session'>> {
  const exercises = await listExercises();
  const grouped = groupSets([], exercises, null, draft.exercises, null);
  return {
    exercises: await withLastRecorded(grouped, null, date),
    // A draft keeps the day it was opened for; once that day can no longer
    // be written, neither can its first set (D133).
    editable: await sessionWritableOn(date, reference),
    // A draft has no stored set, so there is nothing to mark yet (D175).
    warmUpHint: false,
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
  await assertEditable(session.date, reference);
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
    (set) =>
      set.sessionId !== excludeSessionId && set.date <= before && set.reps > 0 && set.warmUp !== true,
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
  metric: GymMetric | null,
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
  for (const set of [...sets].sort(bySetOrder)) {
    const list = grouped.get(set.exerciseId);
    if (list) list.push(set);
    else {
      grouped.set(set.exerciseId, [set]);
      order.push(set.exerciseId);
    }
  }

  return order.map((exerciseId) => {
    const list = grouped.get(exerciseId)!;
    const best = bestOfDay(list, bodyweightGrams, metric);
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
      bestScore: best?.score ?? null,
      bestSetId: best?.set.id ?? null,
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
  return {
    id: set.id,
    reps: set.reps,
    weightGrams: load,
    order: set.order,
    // Only on a marked set: an unmarked one keeps the shape it always had.
    ...(set.warmUp === true ? { warmUp: true as const } : {}),
  };
};

/**
 * The exercise-day value of one exercise's sets on one day, by the same
 * functions the replay uses — never a reckoning of the screen's own.
 */
function bestOfDay(
  sets: GymSetRecord[],
  bodyweightGrams: number | null,
  metric: GymMetric | null,
): BestSet | null {
  const inputs: SetInput[] = [];
  for (const set of sets) {
    const input = toSetInput(set, bodyweightGrams);
    if (input) inputs.push(input);
  }
  return metric === null ? bestSet(inputs) : bestWorkingSet(inputs, metric.repsDivisor);
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
  await assertEditable(session.date, reference);

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
    // After the highest order, not at the count: with a set removed, the
    // count is an order a remaining set already has.
    order: existing.reduce((max, set) => Math.max(max, set.order), -1) + 1,
    muscles: exercise?.muscles ?? [],
    // Roles and load type are copied **now**, for the same reason the groups
    // are: remapping or reclassifying an exercise later changes what it counts
    // for from that point forward and cannot reach a workout already done.
    primaryMuscles: exercise?.primaryMuscles ?? exercise?.muscles.slice(0, 1) ?? [],
    loadType: exercise?.loadType ?? 'external',
    createdAt: nowIso(),
  };
  await gymSetsRepository.put(record);
  // A new set reopens a finished workout (STOP 2, decision 2): it is running
  // again until "Fertig". Correcting a set already there does not reopen it.
  if (typeof session.finishedAt === 'string') {
    await gymSessionsRepository.put({ ...session, finishedAt: null, updatedAt: nowIso() });
  }
  return record;
}

/**
 * Another set of an exercise, the same as the one before it — what "+ Satz"
 * does, because the next set is almost always the same one again. The set
 * before is read when this runs, so an edit saved a moment earlier is
 * copied too. With no set before it, nothing is added: a 0×0 set is never
 * stored (D128).
 *
 * Reps and weight are copied; **the warm-up mark is not** (D151). A new set
 * is a working set until the user marks it — the set after the last warm-up
 * is usually the first set of the work.
 */
export async function repeatLastSet(
  sessionId: string,
  exerciseId: string,
  reference: DateKey = today(),
): Promise<GymSetRecord | null> {
  const sets = (await gymSetsRepository.listBySession(sessionId))
    .filter((set) => set.exerciseId === exerciseId)
    .sort(bySetOrder);
  const last = sets[sets.length - 1];
  if (!last) return null;
  return addSet({ sessionId, exerciseId, reps: last.reps, weightGrams: last.weightGrams }, reference);
}

/** A session's sets in the order they were done: by order, then by when they were stored. */
function bySetOrder(a: GymSetRecord, b: GymSetRecord): number {
  return a.order - b.order || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

/**
 * Changes one set, wherever a set may still be changed (D133).
 *
 * `warmUp` sets or takes off the warm-up mark (D151): a fact on the set,
 * written as `true` and removed again — never stored as `false`, so a set
 * whose mark was taken off is the record it was before. Correcting or
 * marking a set does not reopen a finished workout; only a new set does.
 */
export async function updateSet(
  id: string,
  patch: { reps?: number; weightGrams?: number; warmUp?: boolean },
  reference: DateKey = today(),
): Promise<GymSetRecord | undefined> {
  const set = await gymSetsRepository.get(id);
  if (!set) return undefined;
  await assertEditable(set.date, reference);
  const next: GymSetRecord = {
    ...set,
    reps: patch.reps === undefined ? set.reps : Math.max(0, Math.round(patch.reps)),
    weightGrams:
      patch.weightGrams === undefined ? set.weightGrams : Math.max(0, Math.round(patch.weightGrams)),
  };
  if (patch.warmUp === true) next.warmUp = true;
  else if (patch.warmUp === false) delete next.warmUp;
  await gymSetsRepository.put(next);
  // The first mark ever ends the hint that says where the mark is (D175).
  if (patch.warmUp === true) await settingsRepository.noteWarmUpMarkUsed();
  return next;
}

/**
 * Sets the warm-up mark of a set, or takes it off (D151).
 *
 * Decided from the set as it is stored when this runs, not from the render
 * the tap came from — the rule every workout action follows (D131).
 */
export async function toggleWarmUp(
  id: string,
  reference: DateKey = today(),
): Promise<GymSetRecord | undefined> {
  const set = await gymSetsRepository.get(id);
  if (!set) return undefined;
  return updateSet(id, { warmUp: set.warmUp !== true }, reference);
}

/** What removing a set took away: the set as stored, and the session if it went too. */
export interface RemovedSet {
  set: GymSetRecord;
  /** The session, as it was, when this was its last set (D137); otherwise `null`. */
  session: GymSessionRecord | null;
}

/**
 * Removes a set and returns what went, for an undo to put back. A session the
 * user empties goes with its last set (D137): a session without sets should
 * not exist, so it no longer counts towards the week either. A session that
 * was stored empty before P6 is not touched by anything here.
 */
export async function removeSet(
  id: string,
  reference: DateKey = today(),
): Promise<RemovedSet | undefined> {
  const set = await gymSetsRepository.get(id);
  if (!set) return undefined;
  await assertEditable(set.date, reference);
  await gymSetsRepository.remove(id);
  return { set, session: await removeIfEmptied(set.sessionId) };
}

/** Whether a workout on `date` may still take a set (D133) — for a draft's editable flag. */
export function workoutWritable(date: DateKey, reference: DateKey = today()): Promise<boolean> {
  return sessionWritableOn(date, reference);
}

/**
 * Brings back a session the user emptied, same id and same fields (D137) —
 * when the workout screen saves the next set into it. A session already back
 * (an undo got there first) is returned as it is.
 */
export async function reinstateSession(
  record: GymSessionRecord,
  reference: DateKey = today(),
): Promise<GymSessionRecord> {
  const existing = await gymSessionsRepository.get(record.id);
  if (existing) return existing;
  await assertSessionWritable(record.date, reference, 'gym');
  await gymSessionsRepository.put(record);
  return record;
}

/** Deletes a session the user has just emptied, returning it as it was. */
async function removeIfEmptied(sessionId: string): Promise<GymSessionRecord | null> {
  if ((await gymSetsRepository.listBySession(sessionId)).length > 0) return null;
  const session = await gymSessionsRepository.get(sessionId);
  if (!session) return null;
  await gymSessionsRepository.remove(sessionId);
  return session;
}

/**
 * Puts a removed set back exactly as it was — same id, same order, same
 * facts — for the workout's undo (WP3, P5). A session that went with it is
 * put back first, same id and same fields (D137). Within the write window.
 */
export async function restoreSet(
  record: GymSetRecord,
  reference: DateKey = today(),
  removedSession: GymSessionRecord | null = null,
): Promise<void> {
  await assertEditable(record.date, reference);
  const session = await gymSessionsRepository.get(record.sessionId);
  if (!session) {
    if (removedSession?.id !== record.sessionId) throw new Error(`Unknown session ${record.sessionId}`);
    await gymSessionsRepository.put(removedSession);
  }
  await gymSetsRepository.put(record);
}

/**
 * Puts a removed exercise back: its sets exactly as they were, and — in a
 * session that owns its structure — its line at the place it had (WP3, P5).
 */
export async function restoreExercise(
  sessionId: string,
  sets: readonly GymSetRecord[],
  line: GymSessionExerciseSnapshot | null,
  reference: DateKey = today(),
  removedSession: GymSessionRecord | null = null,
): Promise<void> {
  let session = await gymSessionsRepository.get(sessionId);
  if (!session) {
    // The session went with this exercise's last set (D137): it comes back
    // first, as it was, and the line and sets go back into it.
    if (removedSession?.id !== sessionId) throw new Error(`Unknown session ${sessionId}`);
    await assertEditable(removedSession.date, reference);
    await gymSessionsRepository.put(removedSession);
    session = removedSession;
  }
  await assertEditable(session.date, reference);
  for (const set of sets) await gymSetsRepository.put(set);
  if (line && session.exercises && !session.exercises.some((entry) => entry.exerciseId === line.exerciseId)) {
    const at = Math.min(Math.max(line.order, 0), session.exercises.length);
    const exercises = [...session.exercises];
    exercises.splice(at, 0, line);
    await gymSessionsRepository.put({
      ...session,
      exercises: exercises.map((entry, index) => ({ ...entry, order: index })),
      updatedAt: nowIso(),
    });
  }
}

/** What removing an exercise took away: its sets as stored, its line, and the session if it went too. */
export interface RemovedExercise {
  sets: GymSetRecord[];
  /** The session's own line for it, with the place it had; `null` in a bare session. */
  line: GymSessionExerciseSnapshot | null;
  /** The session, as it was without this line, when no set was left in it (D137). */
  session: GymSessionRecord | null;
}

/**
 * Removes an exercise and every set of it, while their day can still be
 * written (D133), and returns exactly what went, for an undo to put back
 * (D131). Every rule is checked before anything is deleted, so a refusal
 * removes nothing.
 */
export async function removeExerciseFromSession(
  sessionId: string,
  exerciseId: string,
  reference: DateKey = today(),
): Promise<RemovedExercise> {
  const [session, all] = await Promise.all([
    gymSessionsRepository.get(sessionId),
    gymSetsRepository.listBySession(sessionId),
  ]);
  const sets = all.filter((set) => set.exerciseId === exerciseId).sort(bySetOrder);
  const line = session?.exercises?.find((entry) => entry.exerciseId === exerciseId) ?? null;
  for (const set of sets) await assertEditable(set.date, reference);
  if (session && line) await assertEditable(session.date, reference);

  for (const set of sets) await gymSetsRepository.remove(set.id);
  // The session's own snapshot forgets it too, so a planned exercise the
  // user removed does not come back as an empty line. The plan is untouched.
  if (session?.exercises && line) {
    await gymSessionsRepository.put({
      ...session,
      exercises: session.exercises
        .filter((entry) => entry.exerciseId !== exerciseId)
        .map((entry, index) => ({ ...entry, order: index })),
      updatedAt: nowIso(),
    });
  }
  // Only a removal that took sets can empty a session; one that removed a
  // line without sets leaves the session as it was.
  return { sets, line, session: sets.length > 0 ? await removeIfEmptied(sessionId) : null };
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
  // Checked first: a caller writes into what this returns, so an existing
  // session of a closed day is refused like a new one (D133).
  await assertSessionWritable(date, reference, 'gym');
  const existing = await gymSessionsRepository.listByDate(date);
  const last = existing[existing.length - 1];
  if (last) return last;
  const snapshot = await ensureCurrentSnapshot();
  // Started in the app, so it is running until "Fertig" says otherwise (P7).
  return gymSessionsRepository.create({ date, configSnapshotId: snapshot.id, finishedAt: null });
}

/**
 * Records that the user finished the workout (WP3, P7): "Fertig" was tapped.
 * A fact about the session, read by nothing that scores. A session outside
 * the edit window is left as it is.
 */
export async function finishSession(
  sessionId: string,
  reference: DateKey = today(),
): Promise<GymSessionRecord | undefined> {
  const session = await gymSessionsRepository.get(sessionId);
  if (!session || !(await sessionWritableOn(session.date, reference))) return session;
  // A session recorded before the field is finished already, and its
  // absence is the era (D129): "Fertig" on it is not a time to record.
  if (session.finishedAt === undefined) return session;
  const next: GymSessionRecord = { ...session, finishedAt: nowIso(), updatedAt: nowIso() };
  await gymSessionsRepository.put(next);
  return next;
}

/** Today's workout while it is under way, as Heute and the Gym hub state it. */
export interface RunningWorkout {
  sessionId: string;
  /**
   * `plan`: a session with planned exercises, stated as the share of them
   * that has a saved set. `free`: everything else, stated as counts.
   */
  kind: 'plan' | 'free';
  /** Planned exercises with at least one saved set (plan only). */
  done: number;
  /** Planned exercises still in the session (plan only; extras excluded). */
  planned: number;
  /** done ÷ planned as a whole percent (plan only, else `null`). */
  percent: number | null;
  /** Exercises with at least one saved set. */
  exercises: number;
  /** Saved sets. */
  sets: number;
}

/**
 * The day's workout if it is running: it has at least one saved set and was
 * started under P7 without being finished (`finishedAt === null`). A session
 * from before the field existed is finished; so is one the user tapped
 * "Fertig" on. Read only.
 */
export async function loadRunningWorkout(date: DateKey = today()): Promise<RunningWorkout | null> {
  const session = await existingSessionForDay(date);
  if (!session || session.finishedAt !== null) return null;
  const sets = await gymSetsRepository.listBySession(session.id);
  if (sets.length === 0) return null;
  const trained = new Set(sets.map((set) => set.exerciseId));
  // Each planned exercise once, as the workout shows it: a plan may list one
  // twice, and the screen groups by exercise.
  const planned = [
    ...new Set((session.exercises ?? []).filter((entry) => entry.source === 'plan').map((entry) => entry.exerciseId)),
  ];
  if (planned.length === 0) {
    return { sessionId: session.id, kind: 'free', done: 0, planned: 0, percent: null, exercises: trained.size, sets: sets.length };
  }
  const done = planned.filter((exerciseId) => trained.has(exerciseId)).length;
  return {
    sessionId: session.id,
    kind: 'plan',
    done,
    planned: planned.length,
    percent: Math.round((done / planned.length) * 100),
    exercises: trained.size,
    sets: sets.length,
  };
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
  /**
   * Exercises that were logged in the range with sets that would score, all
   * of them marked as warm-ups — so they have no exercise-day there (D151).
   * For a screen to say why a range with sets in it has nothing to
   * evaluate; never a result. Always empty under the metric before Stage
   * 5b, which does not read the mark.
   */
  warmUpOnly: string[];
  /**
   * The metric everything above was computed under: the one in force on the
   * day the range ends (D150), or `null` for the metric before Stage 5b.
   * A screen that derives more from `days` — a trend over a prefix, say —
   * hands this on and never chooses one itself.
   */
  metric: GymMetric | null;
}

/**
 * The sets of a range, read once, with what resolving their loads needs.
 *
 * Reading is the expensive half of a replay, so it happens here a single
 * time whatever is derived from it afterwards: the screens need the
 * exercise-days under one metric, the rating replay under each metric its
 * history was lived in (D150).
 */
interface SetsInRange {
  /** In the order the `by_date` index returned them: by date, then record id. */
  sets: GymSetRecord[];
  byId: Map<string, ExerciseRecord>;
  bodyweightFor(date: DateKey): number | null;
}

async function readSetsInRange(
  from: DateKey,
  to: DateKey,
  exercises: ExerciseRecord[],
): Promise<SetsInRange> {
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

  /** One lookup per date rather than per set; the history is walked a lot. */
  const bodyweightCache = new Map<DateKey, number | null>();
  const bodyweightFor = (date: DateKey): number | null => {
    const cached = bodyweightCache.get(date);
    if (cached !== undefined) return cached;
    const value = bodyweightOn(points, date);
    bodyweightCache.set(date, value);
    return value;
  };

  return { sets, byId: new Map(exercises.map((exercise) => [exercise.id, exercise])), bodyweightFor };
}

/**
 * One bucket per exercise and day, in the order the sets are given, each
 * set's load resolved.
 *
 * The order given is part of the result: the buckets stand in the order of
 * their first set, and a bucket takes its groups and roles from that set.
 */
function bucketSets(
  read: SetsInRange,
  sets: readonly GymSetRecord[],
): { inputs: ExerciseDayInput[]; awaitingBodyweight: string[] } {
  const awaiting = new Set<string>();
  const buckets = new Map<string, ExerciseDayInput>();
  for (const set of sets) {
    const key = `${set.date}#${set.exerciseId}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      const exercise = read.byId.get(set.exerciseId);
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
    const input = toSetInput(set, read.bodyweightFor(set.date));
    if (input) (bucket.sets as SetInput[]).push(input);
    else if (set.loadType === 'bodyweight' || set.loadType === 'assisted') {
      awaiting.add(set.exerciseId);
    }
  }
  return { inputs: [...buckets.values()], awaitingBodyweight: [...awaiting] };
}

/** Code-unit order: the same on every device, whatever its locale collates. */
const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The order the Stage 5b metric reads sets in (D150): by day, exercise, the
 * set's place in its workout, when it was stored, and last its id. Nothing
 * in it depends on the record ids until two sets agree in everything else,
 * so the same sets on another device are read in the same order.
 */
function byDayExerciseAndOrder(a: GymSetRecord, b: GymSetRecord): number {
  return (
    compareText(a.date, b.date) ||
    compareText(a.exerciseId, b.exerciseId) ||
    a.order - b.order ||
    compareText(a.createdAt, b.createdAt) ||
    compareText(a.id, b.id)
  );
}

/** The exercise-days of a range, as one metric values them. */
export interface MetricExerciseDays {
  days: ExerciseDay[];
  /** Exercises whose sets could not be scored for want of a bodyweight. */
  awaitingBodyweight: string[];
  /** Exercises with scorable sets in the range, every one a warm-up (D151). */
  warmUpOnly: string[];
}

/**
 * The exercise-days of a range under any metric, from one read.
 *
 * `under(null)` is the metric before Stage 5b, built exactly as it always
 * was: buckets in the order of the set index, the best set by
 * `reps × load`. `under(metric)` is the Stage 5b metric: the same sets read
 * in the fixed order, the best working set by the strength score. Each is
 * built once and remembered, so asking again costs nothing.
 */
export interface ExerciseDaySource {
  under(metric: GymMetric | null): MetricExerciseDays;
}

function exerciseDaySource(read: SetsInRange): ExerciseDaySource {
  const built = new Map<string, MetricExerciseDays>();
  return {
    under(metric) {
      const key = gymMetricKey(metric);
      let value = built.get(key);
      if (!value) {
        if (metric === null) {
          const { inputs, awaitingBodyweight } = bucketSets(read, read.sets);
          value = { days: exerciseDays(inputs), awaitingBodyweight, warmUpOnly: [] };
        } else {
          const { inputs, awaitingBodyweight } = bucketSets(read, [...read.sets].sort(byDayExerciseAndOrder));
          const days = exerciseDays(inputs, metric);
          const worked = new Set(days.map((day) => day.exerciseId));
          const warmUpOnly = new Set<string>();
          for (const input of inputs) {
            if (worked.has(input.exerciseId)) continue;
            if (input.sets.some((set) => set.warmUp === true && isScorableSet(set))) warmUpOnly.add(input.exerciseId);
          }
          value = {
            days,
            awaitingBodyweight: [...awaitingBodyweight].sort(compareText),
            warmUpOnly: [...warmUpOnly].sort(compareText),
          };
        }
        built.set(key, value);
      }
      return value;
    },
  };
}

/**
 * The Gym pipeline, run over a date range.
 *
 * Replayed from sets on every load, like everything else derived in this app.
 * Nothing about a past workout is stored as a score, so an edit inside the
 * edit window simply produces a different answer next time — and an edit is
 * the only thing that can.
 *
 * **Computed under the metric in force on `to`** (D150) — today, for every
 * screen: the whole range is read in that day's metric, the sets before an
 * era boundary included, so the figures of one screen are never in two
 * units. The windows a past day of the *rating* was scored with are that
 * day's own and are not read here.
 */
export async function loadGymHistory(from: DateKey, to: DateKey): Promise<GymHistory> {
  const [exercises, snapshots] = await Promise.all([listExercises(), configSnapshotsRepository.list()]);
  const metric = gymMetricOf(snapshotOn(snapshots, to));
  const { days, awaitingBodyweight, warmUpOnly } = exerciseDaySource(await readSetsInRange(from, to, exercises)).under(metric);
  return {
    days,
    comparisons: latestComparisons(days),
    recent: gymPerformance(days),
    overall: gymPerformanceOverSpan(days, metric),
    names: new Map(exercises.map((exercise) => [exercise.id, exercise.name])),
    awaitingBodyweight,
    warmUpOnly,
    metric,
  };
}

/** The exercise-days a rating replay needs over its own long range, under each metric it asks for. */
export async function loadExerciseDaySource(from: DateKey, to: DateKey): Promise<ExerciseDaySource> {
  const exercises = await listExercises();
  return exerciseDaySource(await readSetsInRange(from, to, exercises));
}

/** Every recorded day of one exercise, newest first, for its detail screen. */
export function exerciseHistory(history: GymHistory, exerciseId: string): ExerciseDay[] {
  return history.days
    .filter((day) => day.exerciseId === exerciseId)
    .sort((a, b) => b.date.localeCompare(a.date));
}
