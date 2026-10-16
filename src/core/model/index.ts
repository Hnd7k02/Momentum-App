import type { WeightUnit } from '../gym/weight';
import type { DateKey, WeekKey } from '../dates/types';
import type { RankId } from '../config/constants';

/**
 * Schema v1.
 *
 * Two rules shape these records, both aimed at versions 2 and 3:
 *
 * 1. Domains are *records*, not hard-coded screens. Adding a `food` domain
 *    later means inserting a row, not migrating Mental Wellbeing history.
 * 2. A sports session already has a place to hang workout detail
 *    (`detail`), so version 2 can attach exercises, sets and weights as an
 *    additive write rather than a migration.
 */
export const SCHEMA_VERSION = 5;

/**
 * The domains a user can have active.
 *
 * `mental` keeps its stored name even though the product calls it Mind (D143):
 * renaming a discriminator that every answer row references is a data
 * migration in exchange for a label, and the label belongs in the string
 * layer. Display name changes; the type does not.
 */
export type DomainType = 'mental' | 'gym' | 'running' | 'food';

/**
 * The generic weekly-sport domain RC2 shipped.
 *
 * It is not a domain a user can hold any more — §4 of iteration 2 leaves no
 * active generic Sport rank — but records carrying it exist on real devices
 * and are never rewritten without the user saying what they were (D-legacy).
 * It stays in the stored union so those records keep type-checking.
 */
export type LegacyDomainType = 'sports';

export type StoredDomainType = DomainType | LegacyDomainType;

/** Mental Wellbeing carries no configuration of its own — its questions are
 *  records in their own right. */
export type MentalDomainSettings = Record<string, never>;

/**
 * A weekly quota: the user aims for `targetPerWeek` sessions and logs them on
 * whatever days they happen. This is the shape any future domain with a
 * weekly target reuses — no fixed training days, no per-item schedules.
 */
export interface SportsDomainSettings {
  targetPerWeek: number;
}

/** Gym and Running each own a weekly quota; never a combined sport target. */
export interface GymDomainSettings {
  targetPerWeek: number;
}

export interface RunningDomainSettings {
  targetPerWeek: number;
}

/**
 * Food has no weekly quota — one adherence rating per calendar day.
 *
 * `focus` is the user's own sentence for what they are trying to eat like,
 * in their words. It is deliberately **not** a calorie or macro target: what
 * those targets should be is a product decision that is still open, and a
 * number invented here would be indistinguishable from one that had been
 * decided. Adherence asks how closely the day matched the intention the user
 * wrote down, which is answerable without either.
 *
 * Absent on a snapshot written before the question was asked, and absent on
 * one where the user left it blank. Food scores identically either way.
 */
export interface FoodDomainSettings {
  focus?: string;
}

interface DomainBase {
  id: string;
  enabled: boolean;
  /** Display order in Today and Areas. */
  order: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * A domain carries its own configuration, so a version 3 food domain is a new
 * member of this union plus a settings type — no change to the records that
 * Mental Wellbeing history already depends on.
 */
export type DomainRecord =
  | (DomainBase & { type: 'mental'; settings: MentalDomainSettings })
  | (DomainBase & { type: 'gym'; settings: GymDomainSettings })
  | (DomainBase & { type: 'running'; settings: RunningDomainSettings })
  | (DomainBase & { type: 'food'; settings: FoodDomainSettings })
  | (DomainBase & { type: 'sports'; settings: SportsDomainSettings });

/** Default configuration for a newly enabled domain. */
export type DomainSettingsFor<T extends StoredDomainType> = Extract<
  DomainRecord,
  { type: T }
>['settings'];

export type QuestionType = 'boolean' | 'scale';

/**
 * `paused` questions stop being asked but stay visible in Areas.
 * `archived` questions disappear from Areas — their history is never deleted.
 */
export type QuestionStatus = 'active' | 'paused' | 'archived';

/**
 * A Mental Wellbeing question. Asked once per calendar day, every day.
 *
 * Questions carry no schedule of their own: anything that is genuinely a
 * weekly quota belongs to a domain with a weekly target, the way Sports
 * works, rather than to a question pretending to be due on some days and not
 * on others. That keeps the daily check-in a single unambiguous act and
 * keeps "was this due?" out of the scoring path entirely.
 */
/**
 * Which part of life a question belongs to (D17).
 *
 * The daily Wellbeing score averages within a category before averaging
 * across categories, so six Alltag questions cannot drown out the one that
 * asks how the user actually feels.
 */
export type QuestionCategory = 'alltag' | 'gesundheit' | 'mental' | 'eigene';

export const QUESTION_CATEGORIES: QuestionCategory[] = [
  'alltag',
  'gesundheit',
  'mental',
  'eigene',
];

export interface QuestionRecord {
  id: string;
  domainId: string;
  /** The literal sentence asked, e.g. "Hast du dein Bett gemacht?". */
  text: string;
  type: QuestionType;
  category: QuestionCategory;
  /**
   * A question where a high answer is bad — "Wie gestresst war ich?" (D14).
   *
   * Colour band and score contribution are computed on `11 - value`, so an
   * inverted question cannot silently report stress as wellbeing.
   */
  inverted: boolean;
  status: QuestionStatus;
  order: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

/** `true`/`false` for boolean questions, 1–10 for scale questions. */
export type AnswerValue = boolean | number;

/**
 * One answer per question per calendar day — the id enforces it, so a question
 * can never be asked twice on the same day.
 */
/**
 * How private a record is (D47).
 *
 * No user-facing effect in this iteration. It exists now so that a later
 * social layer can default Wellbeing and Food to private without a migration
 * over records written before the question was asked.
 */
export type Sensitivity = 'normal' | 'private';

export interface AnswerRecord {
  id: string;
  date: DateKey;
  questionId: string;
  domainId: string;
  value: AnswerValue;
  valueType: QuestionType;
  sensitivity: Sensitivity;
  /** The configuration in force when this answer was written (§18). */
  configSnapshotId: string;
  createdAt: string;
  updatedAt: string;
}

export function answerId(date: DateKey, questionId: string): string {
  return `${date}#${questionId}`;
}

/**
 * Version 2 workout detail. Nothing in version 1 writes or reads this; it
 * exists so that attaching exercises later needs no schema migration.
 */
export interface SessionDetail {
  kind: string;
  [key: string]: unknown;
}

export interface SportsSessionRecord {
  id: string;
  domainId: string;
  /** Local day the session belongs to. */
  date: DateKey;
  /** Monday-to-Sunday week the session counts towards. */
  weekKey: WeekKey;
  performedAt: string;
  activityType: string | null;
  note: string | null;
  durationMinutes: number | null;
  detail: SessionDetail | null;
  configSnapshotId: string;
  createdAt: string;
  updatedAt: string;
}

/** A question as it stood when a snapshot was taken. */
export interface QuestionConfigSnapshot {
  id: string;
  domainId: string;
  text: string;
  type: QuestionType;
  status: QuestionStatus;
  /**
   * Absent on every snapshot written before category scoring existed.
   *
   * Those days are scored by the flat model, which never looks at a category,
   * so the absence costs nothing — and reading it as "Eigene" where anything
   * does look would be inventing a fact rather than recovering one.
   */
  category?: QuestionCategory;
}

/**
 * How a day's Wellbeing score is computed (D18).
 *
 * - `flat`         — the mean over every answered question, divided by the
 *                    questions due. What RC2 and iteration 2 up to phase 2 did.
 * - `categoryMean` — the mean within each category, then the equal-weighted
 *                    mean of those. Six questions about the household cannot
 *                    outweigh the one that asks how the user feels.
 *
 * It is written into the config snapshot rather than inferred, because the
 * replay has to know which arithmetic a *past* day was lived under and no
 * amount of looking at the shape of the data can tell it that. A snapshot
 * with no `model` was written before the change and is `flat`.
 */
export type ScoringModel = 'flat' | 'categoryMean';

/**
 * How a Gym day's rating level is produced (D90).
 *
 * - `attendance` — sessions against the weekly quota, folded by the shared
 *   rating engine. What phase 4 shipped, and what every day lived before the
 *   gym scoring model landed was scored by.
 * - `attendancePerformance` — 40 % attendance + 60 % personal performance,
 *   moved towards by a gap step rather than an EWMA.
 *
 * **Absent means `attendance`.** A snapshot with no `gymModel` was written
 * before this change, and the days it covers keep the number the user saw —
 * the same era rule that `model` above follows, and `boss` before it.
 */
export type GymScoringModel = 'attendance' | 'attendancePerformance';

/**
 * How a Running day's rating level is produced (D104).
 *
 * The same two eras as Gym, for the same reason: `attendance` is runs against
 * the weekly quota folded by the shared rating engine, which is what every day
 * before phase 5 actually was; `attendancePerformance` is 40 % attendance and
 * 60 % pace development at a comparable distance.
 *
 * **Absent means `attendance`.** A snapshot with no `runningModel` predates
 * the change, and the days it covers keep the number the user saw.
 */
export type RunningScoringModel = 'attendance' | 'attendancePerformance';

export type DomainConfigSnapshot = {
  [T in StoredDomainType]: {
    id: string;
    type: T;
    enabled: boolean;
    settings: DomainSettingsFor<T>;
  };
}[StoredDomainType];

/**
 * Boss weights as they stood when the snapshot was taken (D2, D3).
 *
 * This is the whole of the forward-only rule. Because the replay evaluates
 * every day against the snapshot in force on that day, editing weights today
 * changes what today and later days mean and cannot touch what January meant.
 * There is nothing to recalculate and nothing stored that could drift.
 *
 * Weights are over enabled domains and sum to 1. A snapshot written before
 * iteration 2 has no `boss` field at all, and the replay reads that absence
 * as "RC2 era": one undivided progression, which is exactly what it was.
 */
export interface BossConfigSnapshot {
  weights: Partial<Record<DomainType, number>>;
}

/**
 * The scoring-relevant configuration in force from `effectiveFrom` onwards.
 *
 * Version 1 deliberately uses snapshots rather than a bitemporal revision
 * system: a new snapshot is appended whenever scoring-relevant configuration
 * changes, and any past day is evaluated against the latest snapshot whose
 * `effectiveFrom` is on or before it. If the sports target rises in April,
 * January is still scored against the old target.
 */
export interface AppConfigSnapshot {
  domains: DomainConfigSnapshot[];
  questions: QuestionConfigSnapshot[];
  scoring: {
    editWindowDays: number;
    scaleMin: number;
    scaleMax: number;
    /** Absent means `flat`: the snapshot predates category scoring. */
    model?: ScoringModel;
    /** Absent means `attendance`: the snapshot predates Gym performance scoring. */
    gymModel?: GymScoringModel;
    /** Absent means `attendance`: the snapshot predates Running performance scoring. */
    runningModel?: RunningScoringModel;
    /**
     * P8 (D132): days after a day on which a session may still be written
     * for it. Its presence is the P8 era — one write window for everything,
     * a week judged once its Sunday can no longer be written, an abstinence
     * charge carried while its day can still be written, and a rank moved
     * only by settled days (D134–D136). Absent means the era before:
     * sessions within their ISO week, the week judged at Sunday midnight.
     * Never backfilled.
     */
    sessionWindowDays?: number;
  };
  /** Absent on every snapshot RC2 wrote. Absence means the RC2 era. */
  boss?: BossConfigSnapshot;
}

/** The sports target a given snapshot was taken under, or null if the domain
 *  was not enabled then. */
export function sportsTargetOf(snapshot: AppConfigSnapshot): number | null {
  const sports = snapshot.domains.find((domain) => domain.type === 'sports');
  return sports && sports.enabled ? sports.settings.targetPerWeek : null;
}

export interface ConfigSnapshotRecord {
  id: string;
  effectiveFrom: DateKey;
  createdAt: string;
  config: AppConfigSnapshot;
}

export type Language = 'de' | 'en';

export interface SettingsRecord {
  /** Singleton. */
  id: 'settings';
  language: Language;
  /** The first day the app was used — the origin of every history range. */
  firstUseDate: DateKey;
  /**
   * The unit weights are shown and typed in (WP3, P4). A display
   * preference, never a config snapshot: sets stay integer grams and weight
   * entries kilograms whatever it says, so nothing scored can read it.
   * Absent means kilograms, which is what every record before it meant.
   */
  weightUnit?: WeightUnit;
  onboardingCompletedAt: string | null;
  /**
   * The highest rank the user has already been shown.
   *
   * Rank itself is derived and never stored; this records only that the
   * promotion has been seen, so the reveal plays once instead of on every
   * visit to the screen.
   */
  acknowledgedRankId?: RankId | null;
  /**
   * The Boss promotion-confirmation era and its pending state (D126).
   *
   * **Absent means the feature is not active yet**, and every day is walked
   * by the legacy rank rule. The ensure step writes it once, on the first
   * load after the update, with `from` set to the *next* local day — the
   * activation day stays legacy, so a promotion it awards is kept — and it
   * is never overwritten.
   *
   * The pending part is persisted because the product model asks for the
   * unique qualifying dates to be on record, but it is **not a source of
   * truth**: every Boss replay recomputes the canonical state from stored
   * history, the pauses, the Boss points, `from` and today, and writes it
   * back only when it differs. Two replays of the same history write the
   * same bytes.
   */
  promotionConfirmation?: PromotionConfirmationState;
  /**
   * What became of the RC2 generic Sport domain.
   *
   * - `none`      — nothing to decide: a fresh install, or no legacy data.
   * - `pending`   — legacy Sport data exists and the user has not been asked.
   * - `gym` / `running` — the user said what those sessions were.
   * - `kept`      — kept as read-only legacy history; Gym and Running start empty.
   *
   * There is deliberately no default that resolves itself. Until the user
   * answers, nothing about their history is reinterpreted.
   */
  legacySportMigration?: LegacySportMigration;
  /**
   * How much each domain counts towards the Boss Rank (D2).
   *
   * Stored here because it is one global setting spanning every domain rather
   * than a property of any one of them. It is *copied into every config
   * snapshot*, and the replay reads the snapshot — so this record holds the
   * weights in force today and has no say over what any past day was worth.
   *
   * Absent means "equal shares", which is also what a first run gets.
   */
  bossWeights?: Partial<Record<DomainType, number>>;
  createdAt: string;
  updatedAt: string;
}

export type LegacySportMigration = 'none' | 'pending' | 'gym' | 'running' | 'kept';

/**
 * The persisted shape of the Boss promotion confirmation (D126).
 *
 * `eligibleDates` is logically a set, serialised as a sorted, deduplicated
 * array; the count the interface shows is its length, never a counter.
 * `targetRankId` scopes those dates to exactly one target rank and is `null`
 * at the top of the ladder.
 */
export interface PromotionConfirmationState {
  /** First day of the confirmation era. Days before it are legacy. */
  from: DateKey;
  targetRankId: RankId | null;
  eligibleDates: DateKey[];
}

export type RankEventKind = 'promotion' | 'demotion';

/**
 * Rank changes are derived from the rating, but the crossings are logged so
 * the Rank screen can show history and play a promotion reveal exactly once.
 */
export interface RankEventRecord {
  id: string;
  date: DateKey;
  kind: RankEventKind;
  fromRankId: RankId | null;
  toRankId: RankId;
  rating: number;
  /** Set once the promotion reveal has been shown, so it never replays. */
  acknowledgedAt: string | null;
  createdAt: string;
}

/* ── Iteration 2 records ───────────────────────────────────────────────── */

/**
 * The ten muscle groups (D21).
 *
 * Gym performance is equal-weighted across whichever of these are active —
 * ten per cent each when all ten are — so a muscle never counts for more
 * because more exercises happen to be attached to it.
 */
export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'core'
  | 'quadriceps'
  | 'hamstringsGlutes'
  | 'calves'
  | 'forearms';

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'core',
  'quadriceps',
  'hamstringsGlutes',
  'calves',
  'forearms',
];

/**
 * How an exercise is loaded, which decides what `weightGrams` on its sets
 * means and how the effective load is reconstructed (D91).
 *
 * - `external`   — the load is the weight on the bar. `weightGrams` is it.
 * - `bodyweight` — the load is the user's body plus anything added.
 *                  `weightGrams` is the *added* weight, and may be zero.
 * - `assisted`   — the load is the user's body minus the machine's help.
 *                  `weightGrams` is the *assistance*, and is subtracted.
 *
 * The bodyweight itself is never stored on the set: it is a dated fact of its
 * own in `weightEntries`, and replaying it forward from the entries in force
 * on the set's day is what keeps a measurement taken next month out of last
 * month's arithmetic.
 */
export type ExerciseLoadType = 'external' | 'bodyweight' | 'assisted';

/**
 * An exercise. One per muscle group ships as prototype content (D22), but the
 * shape is many-per-muscle from the start so adding a catalogue later is data,
 * not a migration.
 *
 * `durationSeconds` is still unused and still deliberate (D23): a plank is
 * scored on reps × load like everything else until there is a product
 * decision that says otherwise.
 */
export interface ExerciseRecord {
  /**
   * Stable for the life of the exercise.
   *
   * A built-in carries a readable, permanent id (`ex_bench_press`); a custom
   * one gets a generated id. Historical comparison joins on this and never on
   * the name, so renaming "Bench Press" to "Flachbank" compares like with
   * like rather than starting a new history.
   */
  id: string;
  /**
   * Every muscle group the exercise counts towards, most relevant first.
   *
   * Explicit, never inferred from the name. An exercise in two groups
   * contributes to both; see `core/gym/performance.ts` for why that cannot
   * amplify its weight.
   */
  muscles: MuscleGroup[];
  /**
   * The subset of `muscles` the exercise trains *primarily* (D92).
   *
   * Primaries share 70 % of the exercise's influence and the rest share 30 %,
   * so a compound movement does not gain total weight by touching more of the
   * body. Absent on a record written before roles existed, which is read as
   * the equal weighting those records were logged under.
   */
  primaryMuscles?: MuscleGroup[];
  /** Exercise names stay English in both language modes, like rank names. */
  name: string;
  /** Ships with the app rather than created by the user. */
  builtIn: boolean;
  /** Absent on a record written before load types existed: `external`. */
  loadType?: ExerciseLoadType;
  durationSeconds: number | null;
  /** Reserved for equipment constraints, favourites and injury constraints. */
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type TrainingGoal = 'hypertrophy' | 'strength' | 'mixed';
export type PlanFocus = 'fullBody' | 'upper' | 'lower';
export type TrainingVolume = 'low' | 'medium' | 'high';

/**
 * The generated-plan shape iteration 2 reserved the `gymPlans` store for.
 *
 * Nothing ever wrote one: the store stayed empty on every device and in
 * every backup. It is kept as a type so a backup that somehow carries one
 * still round-trips — preserved, never shown, never read as a training plan.
 */
export interface LegacyGymPlanRecord {
  id: string;
  daysPerWeek: number;
  focus: PlanFocus;
  goal: TrainingGoal;
  volume: TrainingVolume;
  muscles: MuscleGroup[];
  /** Generated plans stay editable; nothing changes one without the user. */
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The discriminator every user training plan carries (WP2-1). */
export const TRAINING_PLAN_KIND = 'userTrainingPlan';
export const TRAINING_PLAN_VERSION = 1;

/**
 * One line of a training plan: which exercise, and where in the list.
 *
 * `name` is a snapshot of the display name at the time the line was added.
 * It is never joined on; it is the fallback a plan renders when the id can
 * no longer be resolved, so a plan is readable whatever became of the
 * catalogue or of a custom exercise since.
 */
export interface TrainingPlanExercise {
  exerciseId: string;
  name: string;
  order: number;
}

/**
 * A training plan the user built: a named, ordered list of exercises they
 * train together (WP2-1).
 *
 * The plan is configuration, not history. A session started from it copies
 * its lines into the session's own snapshot (`GymSessionRecord.exercises`)
 * and never reads them back through the plan, so editing, reordering or
 * deleting a plan cannot reach a workout already done.
 *
 * `kind` and `version` are explicit because the store this lives in was
 * declared for a different, never-written shape: a record without the
 * discriminator is not a training plan and is never shown as one.
 */
export interface TrainingPlanRecord {
  id: string;
  kind: typeof TRAINING_PLAN_KIND;
  version: typeof TRAINING_PLAN_VERSION;
  name: string;
  exercises: TrainingPlanExercise[];
  createdAt: string;
  updatedAt: string;
}

/** Whatever the `gymPlans` store may hold. Only the training plan is live. */
export type GymPlanStoreRecord = TrainingPlanRecord | LegacyGymPlanRecord;

export function isTrainingPlan(record: unknown): record is TrainingPlanRecord {
  if (typeof record !== 'object' || record === null) return false;
  const candidate = record as Partial<TrainingPlanRecord>;
  return (
    candidate.kind === TRAINING_PLAN_KIND &&
    candidate.version === TRAINING_PLAN_VERSION &&
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.exercises)
  );
}

/** Where a session's exercise came from: the plan it was started from, or added on the day. */
export type SessionExerciseSource = 'plan' | 'extra';

/**
 * One exercise of a session, as the session itself remembers it (WP2-1).
 *
 * Written once when a planned workout is first persisted, and appended to
 * when an exercise is added during the session. It carries the display
 * name as it stood, so the session renders identically whatever later
 * happens to the plan or the exercise record; it is never resolved through
 * `planId`, which is provenance and nothing more.
 *
 * Only the *structure* lives here — which exercises, in what order, from
 * where. What was lifted is in the sets, exactly as before, and scoring
 * reads only those.
 */
export interface GymSessionExerciseSnapshot {
  exerciseId: string;
  name: string;
  order: number;
  source: SessionExerciseSource;
}

export interface GymSessionRecord {
  id: string;
  date: DateKey;
  weekKey: WeekKey;
  performedAt: string;
  /** Informational provenance only. Session contents are never resolved through it. */
  planId: string | null;
  /**
   * The session's own ordered exercise snapshot.
   *
   * **Absent on a session that was not started from a plan** — every session
   * logged before WP2-1, and every free session after it — and those render
   * from their sets, as they always have. Present means the session owns its
   * structure, including exercises that have no set yet.
   */
  exercises?: GymSessionExerciseSnapshot[];
  /**
   * When the user tapped "Fertig" (WP3, P7) — a fact; a later "Fertig"
   * overwrites it.
   *
   * - a timestamp — finished then;
   * - `null` — started under P7 and not finished yet (left by going back);
   * - **absent — recorded before the field existed, and treated as
   *   finished.** The absence is the era, never something to backfill.
   *
   * Nothing in scoring or replay reads it. It decides only whether Heute and
   * the Gym hub offer to continue today's workout.
   */
  finishedAt?: string | null;
  note: string | null;
  /**
   * A session carried over from RC2's generic Sport domain.
   *
   * It counts for attendance, consistency and XP, and contributes no
   * strength, volume or muscle performance — RC2 never recorded any.
   */
  legacyCarryOver: boolean;
  configSnapshotId: string;
  createdAt: string;
  updatedAt: string;
}

/** One set. Never averaged: the primary metric is the best set of the day. */
export interface GymSetRecord {
  id: string;
  sessionId: string;
  exerciseId: string;
  date: DateKey;
  /**
   * What the user entered for this set, in whole grams, read through
   * `loadType`: the bar for an external lift, the added weight for a
   * bodyweight one, the assistance for an assisted one.
   *
   * `reps × weight` is compared against a previous workout's, and a
   * comparison of floating-point products is a comparison that can call two
   * identical sets different. Integers cannot drift. Grams also give the
   * precision a 0.5 kg micro-plate needs with room to spare, and leave the
   * displayed unit — kg today, pounds later — entirely to the interface.
   */
  weightGrams: number;
  reps: number;
  order: number;
  /**
   * The muscle groups this set counted towards, as they stood when it was
   * logged.
   *
   * Recorded here rather than looked up, so correcting an exercise's mapping
   * changes what it counts for *from now on* and cannot reach into a workout
   * already done. The same rule as every other configuration change in the
   * app, applied to the one Gym fact that depends on configuration.
   */
  muscles: MuscleGroup[];
  /**
   * The primary groups the set counted towards, as they stood when it was
   * logged. Recorded for the same reason `muscles` is: a mapping corrected
   * today applies forward and cannot reach a workout already done.
   *
   * **Absent marks the era before roles.** A set written by phase 4 has no
   * roles because none were recorded, and it replays under the equal
   * weighting it was actually logged under rather than under a split
   * reconstructed from today's catalogue.
   */
  primaryMuscles?: MuscleGroup[];
  /**
   * How this set was loaded, recorded rather than looked up.
   *
   * Absent means `external`, which is what every set written before load
   * types existed was.
   */
  loadType?: ExerciseLoadType;
  createdAt: string;
}

/** Where a run came from. The seam Strava plugs into, with no Strava in it. */
export type RunSource = 'manual' | 'imported';

export interface RunRecord {
  id: string;
  date: DateKey;
  weekKey: WeekKey;
  performedAt: string;
  source: RunSource;
  /** Set only for imported runs, so one import is one session, never two. */
  externalId: string | null;
  distanceMetres: number | null;
  durationSeconds: number | null;
  elevationMetres: number | null;
  steps: number | null;
  note: string | null;
  legacyCarryOver: boolean;
  configSnapshotId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FoodEntryRecord {
  id: string;
  date: DateKey;
  /** Null for a free entry the user typed rather than picked. */
  foodId: string | null;
  label: string;
  grams: number | null;
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  /** Optional breakdown; informational only and never scored (D36). */
  detail: Record<string, number> | null;
  sensitivity: Sensitivity;
  configSnapshotId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * One day's nutrition adherence, on the 1–10 scale the user actually saw.
 *
 * **The stored number is the number the user chose.** Not a percentage, not
 * a distance from a target, not anything derived — so a day recorded today
 * still reads back as that same 1–10 in a year, whatever the scoring layer
 * above it has become. Everything else about Food's score is computed from
 * this on every replay, like every other derived value in the app.
 *
 * The id *is* the date: one rating per calendar day, enforced by the key
 * rather than by a rule somebody has to remember. Re-rating a day inside the
 * edit window replaces it, which is a correction, not a second reading.
 */
export interface FoodDayRecord {
  id: string;
  date: DateKey;
  /** 1–10, exactly as entered. */
  adherence: number;
  note: string | null;
  sensitivity: Sensitivity;
  /** The configuration in force when this rating was written (§18). */
  configSnapshotId: string;
  createdAt: string;
  updatedAt: string;
}

/** One rating per calendar day — the id enforces it. */
export function foodDayId(date: DateKey): string {
  return date;
}

export interface WeightEntryRecord {
  id: string;
  date: DateKey;
  kg: number;
  createdAt: string;
  updatedAt: string;
}

export type NutritionGoal = 'cut' | 'balanced' | 'bulk';
export type BiologicalSex = 'female' | 'male' | 'unspecified';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high' | 'veryHigh';
export type WorkType = 'desk' | 'mixed' | 'physical';

/**
 * The local profile (D33). Separate from settings because it is the user's
 * data rather than an app preference, and it belongs in a backup as such.
 */
export interface ProfileRecord {
  id: 'profile';
  birthYear: number | null;
  sex: BiologicalSex;
  heightCm: number | null;
  activityLevel: ActivityLevel;
  workType: WorkType;
  sleepHours: number | null;
  healthNotes: string | null;
  goal: NutritionGoal;
  targetWeightKg: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A day the user declared a rest day.
 *
 * **Deprecated as a product concept (D115).** It was never shipped, never
 * reachable and never approved, and the Gym/Running abstinence model made its
 * job redundant: recovery inside a week is already free, and the only effect
 * it could still have is a self-declared exemption from absence the model has
 * judged real. Nothing creates one; a pause (D116) covers the case, and
 * generically. The store and this type stay only so backups keep round
 * tripping — a later schema cleanup may remove them deliberately.
 */
export interface RestDayRecord {
  id: string;
  date: DateKey;
  domainType: Extract<DomainType, 'gym' | 'running'>;
  createdAt: string;
}

/**
 * Holiday, illness, injury — a bounded, prospective suspension of inactivity
 * penalties (D116).
 *
 * Inactivity decay stops and the inactivity clock freezes without resetting.
 * Nothing else changes: logging works, a day logged inside a pause scores and
 * earns XP exactly as it would outside one, and streaks break as they
 * normally would. **XP is untouched** — an earlier comment here claimed "XP
 * does not accrue", which was never implemented and never decided, and D116
 * supersedes it.
 *
 * `to` is nullable so a file written before the rule existed still reads
 * back. No product flow creates an open-ended pause: that would be an
 * indefinite rating freeze.
 */
export interface PausePeriodRecord {
  id: string;
  from: DateKey;
  /** Null while the pause is still open-ended. */
  to: DateKey | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TombstoneId =
  | 'firstFullWeek'
  | 'thirtyDayStreak'
  | 'hundredSets'
  | 'firstPromotion'
  | 'fiftyKilometres';

export interface TombstoneUnlockRecord {
  id: TombstoneId;
  unlockedOn: DateKey;
  createdAt: string;
}
