/**
 * Every tunable number in Momentum lives here.
 *
 * Scoring, rating and rank behaviour will need tuning once the app has been
 * used for real, and hunting constants through feature code is how tuning
 * turns into regressions. Nothing outside this file should hard-code a
 * threshold, a weight or a window length.
 */

/**
 * Days after a day on which it may still be written (P8, D132): today and
 * yesterday. Written into every snapshot this build appends as
 * `scoring.editWindowDays`, and read back per day by the replay, so a day
 * lived under the old window keeps it (D132).
 */
export const EDIT_WINDOW_DAYS = 1;

/**
 * The window every snapshot before P8 carries (`editWindowDays: 3`), and the
 * one a snapshot without the field is read with. Never written again, and
 * never `EDIT_WINDOW_DAYS`: a snapshot restored without the field must not
 * silently take today's window.
 */
export const LEGACY_EDIT_WINDOW_DAYS = 3;

/**
 * Days after a day on which a session, set, run or weight entry may still be
 * written for it (P8: today and yesterday), and so how long a week stays in
 * progress after its Sunday. Written as `scoring.sessionWindowDays`; a
 * snapshot without it is the pre-P8 era — sessions within their ISO week, the
 * week judged at Sunday midnight, abstinence and D126 as they were (D132).
 */
export const SESSION_WINDOW_DAYS = 1;

/** Scale questions are answered on this inclusive integer range. */
export const SCALE_MIN = 1;
export const SCALE_MAX = 10;

/**
 * The four statuses every "how is it going" reading resolves to (D123).
 *
 * One vocabulary for the 1–10 answer, the 0–100 scores, the history grid
 * and the muscle map: `weak`, `mixed`, `good`, `strong`. The colour for each
 * is defined once, in `src/styles/tokens.css` as `--status-*`, and the label
 * once, in the string layer as `status.*`. Absence is not a status: a day
 * with no data is `empty`, kept apart from all four and never a fifth band.
 */
export const STATUS_IDS = ['weak', 'mixed', 'good', 'strong'] as const;

export type StatusId = (typeof STATUS_IDS)[number];

interface StatusBand {
  readonly id: StatusId;
  readonly from: number;
  readonly to: number;
}

/**
 * The fixed 1–10 mapping (D13 of iteration 2, re-banded by D123), and the
 * only one there is.
 *
 * ```
 *   1 2 3 4   weak
 *   5 6       mixed
 *   7 8       good
 *   9 10      strong
 * ```
 *
 * `from` is inclusive and `to` exclusive, so the boundaries are unambiguous
 * and the last band takes SCALE_MAX with it. The same bands drive colour,
 * label and summary text everywhere a 1–10 value appears, so the three can
 * never disagree — and colour is never the only carrier: the band is spelled
 * out in words wherever it is shown.
 *
 * This is presentation only. The answer itself, its percentage (value × 10)
 * and everything scored from it are untouched by the banding.
 */
export const SCALE_BANDS = [
  { id: 'weak', from: 1.0, to: 5.0 },
  { id: 'mixed', from: 5.0, to: 7.0 },
  { id: 'good', from: 7.0, to: 9.0 },
  { id: 'strong', from: 9.0, to: 10.0001 },
] as const satisfies readonly StatusBand[];

export type ScaleBandId = (typeof SCALE_BANDS)[number]['id'];

/**
 * Performance bands for day and domain scores (percentages, 0–100).
 * Used by the heatmap and the trend annotations. Colour is never the only
 * carrier of meaning, so each band also has a label key in the string layer.
 * The thresholds are RC2's and unchanged; D123 only named them.
 */
export const SCORE_BANDS = [
  { id: 'weak', from: 0, to: 40 },
  { id: 'mixed', from: 40, to: 65 },
  { id: 'good', from: 65, to: 85 },
  { id: 'strong', from: 85, to: 100.0001 },
] as const satisfies readonly StatusBand[];

export type ScoreBandId = (typeof SCORE_BANDS)[number]['id'];

/** Rating engine — an internal 0–1000 number that drives the current rank. */
export const RATING = {
  MIN: 0,
  MAX: 1000,
  /** Day-one value. Not 0 (a punishing first impression), not the midpoint
   *  (which would guarantee a decline in week one). */
  START: 250,
  /** During the first N days of use the rating may rise but never fall. */
  CALIBRATION_DAYS: 14,
  /** Half-life in days of the exponentially weighted moving average. */
  HALF_LIFE_DAYS: 14,
  /** Streak bonus: total contribution is capped and each further day adds less. */
  STREAK_BONUS_CAP: 50,
  STREAK_BONUS_PER_DAY: 4,
  /** Inactivity decay per day, by how long the inactivity has lasted. */
  DECAY: {
    GRACE_DAYS: 2,
    SMALL_UNTIL_DAY: 7,
    SMALL_PER_DAY: 1.5,
    LARGE_PER_DAY: 3,
    /** A single inactivity episode can never cost more than this. */
    MAX_PER_EPISODE: 60,
  },
} as const;

/** Eight ranks, no divisions. Names stay English in every language. */
export const RANKS = [
  { id: 'rookie', name: 'Rookie', min: 0 },
  { id: 'challenger', name: 'Challenger', min: 120 },
  { id: 'contender', name: 'Contender', min: 260 },
  { id: 'elite', name: 'Elite', min: 410 },
  { id: 'veteran', name: 'Veteran', min: 560 },
  { id: 'master', name: 'Master', min: 700 },
  { id: 'champion', name: 'Champion', min: 830 },
  { id: 'legend', name: 'Legend', min: 950 },
] as const;

export type RankId = (typeof RANKS)[number]['id'];

/** The rating must fall this far below a threshold before a demotion sticks. */
export const RANK_DEMOTION_HYSTERESIS = 15;

/**
 * And it must stay there this many scored days running.
 *
 * Promotion was immediate under the legacy walk, because reaching a rank is
 * an achievement the moment it happens; from the confirmation era on it has
 * to be held (below). Demotion has to be a trend: a dip that recovers within
 * a couple of days was never a change in standing, and §13 requires that a
 * single bad day cannot cost a tier — including through its after-effects.
 */
export const RANK_DEMOTION_SUSTAIN_DAYS = 3;

/**
 * A Boss promotion must be confirmed (D126).
 *
 * From the confirmation era on, the next rank is awarded only once the Boss
 * rating has been at or above its threshold on this many **eligible**
 * evaluations in a row — past, scored, unpaused days. Open, neutral and
 * paused days are transparent to the count; a scored day below the threshold
 * resets it. Today never counts: it is not final yet. Demotion is untouched.
 */
export const RANK_PROMOTION_CONFIRMATION_DAYS = 7;

/** Lifetime XP. Never decreases, never spendable, never purchasable. */
export const XP = {
  PER_ANSWERED_ITEM: 5,
  PER_COMPLETED_DAY: 20,
  PER_SPORTS_SESSION: 25,
  PER_WEEKLY_TARGET_MET: 60,
} as const;

/** Trend ranges offered on the Progress screen. 90 is reserved for later. */
export const TREND_RANGES = [7, 30] as const;
export const HEATMAP_DAYS = 30;
/** Window of the rolling average used to suppress daily noise in the curve. */
export const TREND_SMOOTHING_DAYS = 7;

/**
 * How far the smoothed value must move before the trend is called rising or
 * falling. Inside this band it is steady — the screen answers a directional
 * question, and calling every wobble a direction would make it meaningless.
 */
export const TREND_STEADY_BAND = 2;

/** Below this many scored days there is no trend to state, and the screen
 *  says so rather than drawing a line through nothing. */
export const TREND_MIN_SCORED_DAYS = 5;

/** A run of days with no data at least this long is worth annotating. */
export const INACTIVITY_ANNOTATION_DAYS = 4;

/**
 * Sports. The target is capped at seven — one session per day — because the
 * picker shows every choice as a bubble and a weekly quota above "every day"
 * stops describing a week.
 */
export const SPORTS = {
  MIN_TARGET_PER_WEEK: 1,
  MAX_TARGET_PER_WEEK: 7,
  DEFAULT_TARGET_PER_WEEK: 3,
} as const;

/**
 * Gym and Running each own a weekly quota (§4 of iteration 2).
 *
 * Deliberately two constants rather than one shared `SPORTS`: the product
 * decision is that the two targets move independently, and a single constant
 * is how they would quietly become coupled again.
 */
export const GYM = {
  MIN_TARGET_PER_WEEK: 1,
  MAX_TARGET_PER_WEEK: 7,
  DEFAULT_TARGET_PER_WEEK: 3,
  /** Saved training plans a user may hold at once (WP2-1). */
  MAX_PLANS: 5,
} as const;

export const RUNNING = {
  MIN_TARGET_PER_WEEK: 1,
  MAX_TARGET_PER_WEEK: 7,
  DEFAULT_TARGET_PER_WEEK: 2,
} as const;

/**
 * Boss Rank.
 *
 * The Boss is a weighted mean of how far each active domain has climbed the
 * one shared ladder, so it needs no thresholds of its own — it borrows
 * `RANKS`. The only tunable is how small a weight the user may give a domain
 * before it stops meaning anything.
 */
export const BOSS = {
  /** No domain may end up counting for less than this share of the Boss. */
  MIN_WEIGHT: 0.05,
  /** Weight picker granularity, in relative-importance steps. */
  WEIGHT_STEP: 0.5,
} as const;

/**
 * The Wellbeing scoring model this build writes into new config snapshots.
 *
 * Changing it changes what *future* days mean and nothing else: every day
 * already lived resolves to the snapshot it was lived under, which records
 * the model it was scored by.
 */
export const SCORING_MODEL = 'categoryMean' as const;

/**
 * The Gym scoring model this build writes into new config snapshots.
 *
 * Same rule as `SCORING_MODEL`: it decides what *future* days mean and
 * nothing else. Every day already lived resolves to the snapshot it was lived
 * under, and a snapshot with no `gymModel` predates this change — those days
 * keep the attendance-only level the user actually saw.
 */
export const GYM_SCORING_MODEL = 'attendancePerformance' as const;

/**
 * The Running scoring model this build writes into new config snapshots.
 *
 * Same era rule as `GYM_SCORING_MODEL`: a snapshot with no `runningModel`
 * predates phase 5 and its days replay as attendance against the weekly quota,
 * which is what those days actually were.
 */
export const RUNNING_SCORING_MODEL = 'attendancePerformance' as const;

/** Onboarding recommends three to five questions. */
export const RECOMMENDED_QUESTION_COUNT = { min: 3, max: 5 } as const;

/**
 * The training-domain rating model.
 *
 * Introduced for Gym in phase 4.1 and adopted unchanged by Running in phase 5,
 * which is why it is no longer named after either of them. A training rank is
 * **40 % attendance and 60 % personal development**, and it is emphatically
 * not a measure of absolute strength or absolute speed — those are Tombstones.
 * Every number below is relative to the user's own history, so someone lifting
 * light weights or running modest paces reaches the same ranks as anyone else
 * by turning up and improving.
 */
export const TRAINING_RATING = {
  /** The 40/60 split of the target rating. The two must sum to 1. */
  ATTENDANCE_WEIGHT: 0.4,
  PERFORMANCE_WEIGHT: 0.6,

  /** The rolling short-term window, in days, ending on the calculation date. */
  TREND_WINDOW_DAYS: 60,
  /** Trend and year-to-date contribute equally to the Performance Score. */
  TREND_WEIGHT: 0.5,
  YTD_WEIGHT: 0.5,

  /**
   * The performance curve, as one parameter.
   *
   * `score / (1000 − score) = ODDS_PER_DECADE ^ (change% / DECADE_PERCENT)`,
   * so every ten points of improvement multiplies the odds by four: 0 % is
   * evens and scores 500, +10 % is 4:1 and scores 800, −10 % is 1:4 and
   * scores 200. See `core/scoring/performanceCurve.ts` for the derivation and the fit.
   */
  CURVE_ODDS_PER_DECADE: 4,
  CURVE_DECADE_PERCENT: 10,

  /** How much of the remaining gap to the target one update closes. */
  BASE_MOVEMENT: 0.1,
  /**
   * At or below this rating the full base movement applies, and above it the
   * *upward* step is scaled by the remaining headroom. Downward movement is
   * never slowed: a high rank is harder to climb, not protected from falling.
   */
  MOVEMENT_FULL_SPEED_BELOW: 500,

  /** Net completed weeks the Endurance Phase asks for before a first promotion. */
  ENDURANCE_WEEKS_REQUIRED: 4,
  ENDURANCE_WEEK_MET: 1,
  ENDURANCE_WEEK_MISSED: -0.5,

  /** Consecutive days with no saved session that make one abstinence block. */
  ABSTINENCE_BLOCK_DAYS: 7,

  /** Gym training age at which Maintenance becomes a legitimate state. */
  MAINTENANCE_MIN_MONTHS: 12,
  /**
   * How close to 0 % counts as "unchanged" for Maintenance, in percentage
   * points. Aggregating ratios over groups leaves float dust well below
   * 1e-9 %; a quarter of a point is far under one rep or one micro-plate on
   * any real best set, so it can only ever absorb noise.
   */
  MAINTENANCE_TOLERANCE_PERCENT: 0.25,
} as const;

/**
 * Primary and secondary muscle influence (D92).
 *
 * One exercise is worth 100 %, however many groups it touches. Primaries
 * share the first number, secondaries the second, and each share is split
 * equally inside its role.
 */
export const MUSCLE_ROLE_WEIGHTS = {
  PRIMARY: 0.7,
  SECONDARY: 0.3,
} as const;

/**
 * Inactivity decay, by training age. Approved for Gym in phase 4.1 and adopted
 * unchanged by Running in phase 5 (D96).
 *
 * Each phase is one number: the share of the rank progress held at the start
 * of the abstinence episode that each completed 7-day block removes. They are
 * **cumulative against that baseline and never compounded against the
 * remainder**, so the 25 % phase runs 80 → 60 → 40 → 20 → 0, not 80 → 60 →
 * 45 → 33.75.
 *
 * `fromMonth` is inclusive and phases are non-overlapping: a user whose Gym
 * training age is 2 completed months is in their third month and decays at
 * 25 % a block.
 */
/**
 * Pause periods: the one approved limit.
 *
 * A pause is for a holiday, an illness or an injury, so it is bounded by
 * design — 28 days is long enough for any of those and short enough that it
 * cannot become a way of living. There is deliberately no quota, no annual
 * allowance and no cooldown: one limit, stated plainly.
 */
export const PAUSE = {
  MAX_DAYS: 28,
} as const;

export const TRAINING_DECAY_PHASES = [
  { id: 'early', fromMonth: 0, perBlock: 0.5 },
  { id: 'settling', fromMonth: 2, perBlock: 0.25 },
  { id: 'established', fromMonth: 4, perBlock: 0.2 },
  { id: 'mature', fromMonth: 12, perBlock: 0.1 },
] as const;

export type TrainingDecayPhaseId = (typeof TRAINING_DECAY_PHASES)[number]['id'];

/**
 * **The Running distance grid (D103). Part of the scoring-model contract.**
 *
 * Two runs are directly comparable when their measured distances differ by no
 * more than 10 %. Comparability is symmetric but *not* transitive, so it
 * cannot itself define a grouping; a run's identity is instead the fixed,
 * half-open multiplicative band it falls in:
 *
 * ```
 *   band(d) = floor( ln(d / ANCHOR) / ln(WIDTH) )
 * ```
 *
 * Because a band spans `[a, 1.10a)`, any two runs sharing one are within 10 %
 * of each other by construction — and because the band depends on nothing but
 * the run's own distance, adding, editing, removing or expiring any other run
 * can never change it.
 *
 * `ANCHOR` is the minimax grid offset over 3 km, 5 km, 10 km, 15 km, the half
 * marathon and the marathon: every one of those sits at least 18 % of a band
 * (±1.73 % of distance) away from a boundary. The obvious round anchors are
 * far worse — 3000 puts 3 km *exactly* on a boundary.
 *
 * **Do not re-tune either constant after release.** They are not preferences;
 * they define what a stored run's identity *is*, and moving them would
 * silently repartition every user's history. A change here is a new scoring
 * era and needs the snapshot marker to say so.
 */
export const RUNNING_BANDS = {
  ANCHOR_METRES: 972.42,
  WIDTH: 1.1,
  /** Below this, a run counts for attendance but yields no performance. */
  MIN_PERFORMANCE_METRES: 3000,
} as const;
