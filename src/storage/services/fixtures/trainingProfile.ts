import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION } from '../../../core/backup/format';
import { equalWeights } from '../../../core/boss';
import {
  GYM_METRIC,
  GYM_SCORING_MODEL,
  RUNNING_SCORING_MODEL,
  SCORING_MODEL,
} from '../../../core/config/constants';
import { SCHEMA_VERSION, type GymWindowComparison } from '../../../core/model';
import { addDays, weekKeyOf, type DateKey } from '../../../core/dates';

/**
 * A training history written the way a person trains, for WP3 Stage 5b
 * (D150, D151): sixteen weeks of a four-day split, every exercise with
 * several sets, each following one pattern the owner named or the November
 * review computed.
 *
 * Deterministic by construction: fixed dates, no clock, no randomness.
 *
 * | exercise | pattern |
 * |---|---|
 * | Bankdrücken | double progression in 8–12 reps: a rep more each week, then +2.5 kg and back to 8 |
 * | Overhead Press | double progression in 6–10 reps |
 * | Schrägbank Kurzhantel | a steady rise at fixed reps |
 * | Seitheben | nothing changes |
 * | Pushdown Seil | the work unchanged; from week 4 a drop set after it |
 * | Langhantelrudern | a pyramid whose heaviest set rises |
 * | Latzug | a light set before the work — marked as a warm-up once marking exists |
 * | Bizeps-Curls | a light set before the work, never marked |
 * | Klimmzüge | bodyweight, over a bodyweight that falls; added weight from week 8 |
 * | Kniebeuge, Beinpresse, Beinbeuger | a whole light week (week 9) in a rise, a rise and a slow fall |
 * | Wadenheben | one day with warm-up sets only (week 12) |
 * | Cable Fly | six exercise-days in thirty, the last one light |
 * | Face Pulls | four exercise-days in thirty, the last one light |
 *
 * Two profiles are made from it:
 *
 * - `metricCrossingProfile()` — a device as the live build left it (the
 *   three-day window, Food on, no warm-up marks, no metric) that loads the
 *   update on a Monday in week 11: from that day the one-day window, Food
 *   off and the Stage 5b metric, all in one snapshot, and warm-up sets
 *   marked from then on.
 * - `strengthProfile()` — a device set up under this version: the metric
 *   from its first day, warm-up sets marked from its first day.
 *
 * Frozen into the golden baseline once Stage 5b computed them; like every
 * profile here, never regenerated to make a test pass.
 */

export const TRAINING_START = '2026-03-02' as DateKey; // a Monday
export const TRAINING_WEEKS = 16;
export const TRAINING_DAYS = TRAINING_WEEKS * 7;
export const TRAINING_LAST = addDays(TRAINING_START, TRAINING_DAYS - 1);

/** The Monday of week 11: the day the crossing profile loads the update. */
export const METRIC_FROM_DAY = 77;
export const METRIC_FROM = addDays(TRAINING_START, METRIC_FROM_DAY);

/** The week every leg exercise is trained light. */
export const LIGHT_WEEK = 9;
/** The Saturday of week 14: the single light day of Cable Fly and Face Pulls. */
export const LIGHT_DAY_INDEX = 14 * 7 + 5;
export const LIGHT_DAY = addDays(TRAINING_START, LIGHT_DAY_INDEX);
/** The week Wadenheben holds warm-up sets only. */
export const WARM_UP_ONLY_WEEK = 12;

type Muscle =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'core' | 'quadriceps' | 'hamstringsGlutes' | 'calves' | 'forearms';

interface Lift {
  exerciseId: string;
  muscles: Muscle[];
  primary: Muscle[];
  loadType: 'external' | 'bodyweight' | 'assisted';
  /** `[reps, kilograms, warm-up?]`, in the order they were done. */
  sets: [reps: number, kg: number, warmUp?: boolean][];
}

const half = (value: number): number => Math.round(value * 2) / 2;

/** The exercises of one training day, or `null` on a rest day. */
function workout(index: number): Lift[] | null {
  const week = Math.floor(index / 7);
  const weekday = index % 7; // 0 is Monday
  const light = week === LIGHT_WEEK ? 0.8 : 1;
  const lifts: Lift[] = [];

  if (weekday === 0) {
    // Push. Bankdrücken: 8, 9, 10, 11, 12 reps, then +2.5 kg and 8 again.
    const benchReps = 8 + (week % 5);
    const bench = 80 + 2.5 * Math.floor(week / 5);
    lifts.push({
      exerciseId: 'ex_bench_press', muscles: ['chest', 'triceps', 'shoulders'], primary: ['chest'], loadType: 'external',
      sets: [[10, 40, true], [5, 60, true], [benchReps, bench], [benchReps, bench], [benchReps - 1, bench]],
    });
    const incline = 24 + Math.floor(week / 2);
    lifts.push({
      exerciseId: 'ex_incline_press', muscles: ['chest', 'shoulders', 'triceps'], primary: ['chest'], loadType: 'external',
      sets: [[10, incline], [10, incline], [10, incline]],
    });
    lifts.push({
      exerciseId: 'ex_lateral_raise', muscles: ['shoulders'], primary: ['shoulders'], loadType: 'external',
      sets: [[15, 10], [15, 10], [15, 10]],
    });
    // The work never changes; from week 4 a drop set follows it, which by
    // `reps × load` outscores it (15 × 22.5 against 8 × 35).
    lifts.push({
      exerciseId: 'ex_triceps_pushdown', muscles: ['triceps'], primary: ['triceps'], loadType: 'external',
      sets: [[8, 35], [8, 35], [8, 35], ...(week >= 4 ? ([[15, 22.5], [20, 15]] as [number, number][]) : [])],
    });
  }

  if (weekday === 1) {
    // Pull. Klimmzüge: a rep more every three weeks; from week 8 with 5 kg.
    const added = week >= 8 ? 5 : 0;
    const pullReps = week >= 8 ? 6 + Math.floor((week - 8) / 3) : 6 + Math.floor(week / 3);
    lifts.push({
      exerciseId: 'ex_pull_up', muscles: ['back', 'biceps'], primary: ['back'], loadType: 'bodyweight',
      sets: [[pullReps, added], [pullReps - 1, added], [pullReps - 2, added]],
    });
    // A pyramid: by `reps × load` its best set is always 12 × 50 or 10 × 60.
    const top = 80 + 2.5 * Math.floor(week / 3);
    lifts.push({
      exerciseId: 'ex_barbell_row', muscles: ['back', 'biceps', 'forearms'], primary: ['back'], loadType: 'external',
      sets: [[12, 50], [10, 60], [8, 70], [6, top]],
    });
    const pulldown = 55 + 2.5 * Math.floor(week / 4);
    lifts.push({
      exerciseId: 'ex_lat_pulldown', muscles: ['back', 'biceps'], primary: ['back'], loadType: 'external',
      sets: [[12, 30, true], [10, pulldown], [10, pulldown], [9, pulldown]],
    });
    const curl = week >= 8 ? 15 : 14;
    lifts.push({
      exerciseId: 'ex_biceps_curl', muscles: ['biceps'], primary: ['biceps'], loadType: 'external',
      sets: [[15, 6], [10, curl], [10, curl], [9, curl]],
    });
  }

  if (weekday === 3) {
    // Legs, with the whole of week 9 light.
    const squat = half((100 + 2.5 * week) * light);
    lifts.push({
      exerciseId: 'ex_squat', muscles: ['quadriceps', 'hamstringsGlutes', 'core'], primary: ['quadriceps'], loadType: 'external',
      sets: [[5, squat], [5, squat], [5, squat], [5, squat], [5, squat]],
    });
    const press = half((160 + 5 * Math.floor(week / 2)) * light);
    lifts.push({
      exerciseId: 'ex_leg_press', muscles: ['quadriceps', 'hamstringsGlutes'], primary: ['quadriceps'], loadType: 'external',
      sets: [[12, press], [12, press], [11, press]],
    });
    const curlReps = 12 - Math.floor(week / 5);
    lifts.push({
      exerciseId: 'ex_leg_curl', muscles: ['hamstringsGlutes'], primary: ['hamstringsGlutes'], loadType: 'external',
      sets: [[curlReps, half(45 * light)], [curlReps, half(45 * light)], [curlReps - 1, half(45 * light)]],
    });
    lifts.push({
      exerciseId: 'ex_calf_raise', muscles: ['calves'], primary: ['calves'], loadType: 'external',
      // One week of warm-up sets only: no exercise-day under the Stage 5b metric.
      sets: week === WARM_UP_ONLY_WEEK ? [[15, 30, true], [15, 30, true]] : [[15, 60], [15, 60], [14, 60]],
    });
  }

  if (weekday === 5) {
    // Upper. Overhead Press: 6, 7, 8, 9, 10 reps, then +2.5 kg and 6 again.
    const ohpReps = 6 + (week % 5);
    const ohp = 50 + 2.5 * Math.floor(week / 5);
    lifts.push({
      exerciseId: 'ex_overhead_press', muscles: ['shoulders', 'triceps', 'core'], primary: ['shoulders'], loadType: 'external',
      sets: [[ohpReps, ohp], [ohpReps - 1, ohp], [ohpReps - 1, ohp]],
    });
    // Four exercise-days in the thirty before the light day, itself the last.
    if (week >= 11 && week <= 14) {
      const pull = index === LIGHT_DAY_INDEX ? 20 : 25;
      lifts.push({
        exerciseId: 'ex_face_pull', muscles: ['shoulders', 'back'], primary: ['shoulders'], loadType: 'external',
        sets: [[15, pull], [15, pull], [15, pull]],
      });
    }
  }

  // Six exercise-days in the thirty before the light day, itself the last:
  // the Tuesdays and Saturdays of weeks 12 to 14.
  if ((weekday === 1 || weekday === 5) && week >= 12 && week <= 14) {
    const fly = index === LIGHT_DAY_INDEX ? 16 : 20;
    lifts.push({
      exerciseId: 'ex_chest_fly', muscles: ['chest'], primary: ['chest'], loadType: 'external',
      sets: [[12, fly], [12, fly], [12, fly]],
    });
  }

  return lifts.length > 0 ? lifts : null;
}

export interface TrainingProfileOptions {
  /**
   * The day index from which warm-up sets are logged with their mark. The
   * marked warm-up sets of Bankdrücken are not logged at all before it —
   * the owner did not log his warm-ups — and the light set before the work
   * of Latzug is logged unmarked. `0` marks from the first day.
   */
  marksFrom: number;
  /**
   * `null`: a device set up under this version, with the Stage 5b metric in
   * its first snapshot. A day index: a device as the live build left it,
   * that loads the update on that day.
   */
  updateOn: number | null;
  /** The window comparison written into the marker; the constant by default. */
  comparison?: GymWindowComparison;
  /** Leave the Stage 5b marker out of the update snapshot (for "what if not"). */
  withoutMetric?: boolean;
}

function trainingProfile(options: TrainingProfileOptions): string {
  const stamp = `${TRAINING_START}T06:00:00.000Z`;
  const ids = { mental: 'dom_tp_mental', gym: 'dom_tp_gym', food: 'dom_tp_food' };
  const legacy = options.updateOn !== null;
  const update = options.updateOn ?? 0;

  const questions = [0, 1, 2].map((index) => ({
    id: `q_tp_${index}`,
    domainId: ids.mental,
    text: `Frage ${index}`,
    type: index === 1 ? ('boolean' as const) : ('scale' as const),
    category: index < 2 ? ('alltag' as const) : ('gesundheit' as const),
    inverted: false,
    status: 'active' as const,
    order: index,
    createdAt: stamp,
    updatedAt: stamp,
    archivedAt: null,
  }));

  const answers: unknown[] = [];
  const foodDays: unknown[] = [];
  const gymSessions: unknown[] = [];
  const gymSets: unknown[] = [];

  for (let index = 0; index < TRAINING_DAYS; index += 1) {
    const date = addDays(TRAINING_START, index);
    const weekKey = weekKeyOf(date);
    const at = (hour: string) => `${date}T${hour}:00:00.000Z`;
    const snapshotId = legacy && index >= update ? 'cfg_tp_update' : 'cfg_tp';

    if (index % 11 !== 10) {
      for (const question of questions) {
        answers.push({
          id: `${date}#${question.id}`, date, questionId: question.id, domainId: ids.mental,
          value: question.type === 'scale' ? 5 + ((index + question.order * 2) % 5) : index % 4 !== 0,
          valueType: question.type, sensitivity: 'private' as const, configSnapshotId: snapshotId,
          createdAt: at('20'), updatedAt: at('20'),
        });
      }
      if (legacy && index < update) {
        foodDays.push({
          id: date, date, adherence: 6 + (index % 4), note: null, sensitivity: 'private' as const,
          configSnapshotId: snapshotId, createdAt: at('21'), updatedAt: at('21'),
        });
      }
    }

    const lifts = workout(index);
    if (!lifts) continue;
    const sessionId = `gym_tp_${date}`;
    gymSessions.push({
      id: sessionId, date, weekKey, performedAt: at('18'), planId: null,
      // "Fertig" is recorded since WP3: absent on a session of the live build.
      ...(legacy && index < update ? {} : { finishedAt: at('19') }),
      note: null, legacyCarryOver: false, configSnapshotId: snapshotId, createdAt: at('18'), updatedAt: at('19'),
    });
    let order = 0;
    for (const lift of lifts) {
      for (const [reps, kg, warmUp] of lift.sets) {
        const marked = warmUp === true && index >= options.marksFrom;
        // Before marking existed the owner logged no warm-ups for the bench;
        // the light set before the work of Latzug he logged, unmarked.
        if (warmUp === true && !marked && lift.exerciseId !== 'ex_lat_pulldown') continue;
        gymSets.push({
          id: `set_tp_${date}_${String(order).padStart(2, '0')}`,
          sessionId,
          exerciseId: lift.exerciseId,
          date,
          weightGrams: Math.round(kg * 1000),
          reps,
          order,
          muscles: [...lift.muscles],
          primaryMuscles: [...lift.primary],
          loadType: lift.loadType,
          ...(marked ? { warmUp: true as const } : {}),
          createdAt: at('18'),
        });
        order += 1;
      }
    }
  }

  // A bodyweight that falls a kilogram every four weeks.
  const weightEntries = [0, 28, 56, 84].map((index, step) => {
    const date = addDays(TRAINING_START, index);
    return { id: `wt_tp_${date}`, date, kg: 82 - step, createdAt: `${date}T07:00:00.000Z`, updatedAt: `${date}T07:00:00.000Z` };
  });

  const domainRecords = [
    { id: ids.mental, type: 'mental' as const, enabled: true, settings: {} },
    { id: ids.gym, type: 'gym' as const, enabled: true, settings: { targetPerWeek: 4 } },
    ...(legacy ? [{ id: ids.food, type: 'food' as const, enabled: true, settings: {} }] : []),
  ];
  const questionSnapshots = questions.map((q) => ({
    id: q.id, domainId: q.domainId, text: q.text, type: q.type, status: q.status, category: q.category,
  }));
  const models = { model: SCORING_MODEL, gymModel: GYM_SCORING_MODEL, runningModel: RUNNING_SCORING_MODEL };
  const metric = { ...GYM_METRIC, ...(options.comparison ? { comparison: options.comparison } : {}) };
  const p8 = { editWindowDays: 1, scaleMin: 1, scaleMax: 10, ...models, sessionWindowDays: 1 };

  const configSnapshots: unknown[] = [];
  if (legacy) {
    // As the live build wrote it: the three-day window, Food on, no marker.
    configSnapshots.push({
      id: 'cfg_tp',
      effectiveFrom: TRAINING_START,
      createdAt: stamp,
      config: {
        boss: { weights: equalWeights(['mental', 'gym', 'food']) },
        domains: domainRecords,
        questions: questionSnapshots,
        scoring: { editWindowDays: 3, scaleMin: 1, scaleMax: 10, ...models },
      },
    });
    // What the first load of the update writes that day: the one-day window
    // (D132), Food off with the Boss shared over what remains (D139), and
    // the Stage 5b metric (D150) — one snapshot.
    const from = addDays(TRAINING_START, update);
    configSnapshots.push({
      id: 'cfg_tp_update',
      effectiveFrom: from,
      createdAt: `${from}T06:00:00.000Z`,
      config: {
        boss: { weights: equalWeights(['mental', 'gym']) },
        domains: domainRecords.map((domain) => (domain.type === 'food' ? { ...domain, enabled: false } : domain)),
        questions: questionSnapshots,
        scoring: options.withoutMetric ? p8 : { ...p8, gymMetric: metric },
      },
    });
  } else {
    configSnapshots.push({
      id: 'cfg_tp',
      effectiveFrom: TRAINING_START,
      createdAt: stamp,
      config: {
        boss: { weights: equalWeights(['mental', 'gym']) },
        domains: domainRecords,
        questions: questionSnapshots,
        scoring: { ...p8, gymMetric: metric },
      },
    });
  }

  return JSON.stringify({
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: stamp,
    app: { name: 'Momentum', version: '0.1.0' },
    data: {
      settings: {
        id: 'settings', language: 'de', firstUseDate: TRAINING_START, onboardingCompletedAt: stamp,
        acknowledgedRankId: null, legacySportMigration: 'none',
        promotionConfirmation: { from: TRAINING_START, targetRankId: null, eligibleDates: [] },
        createdAt: stamp, updatedAt: stamp,
      },
      domains: domainRecords.map((domain, order) => ({
        ...domain,
        // The live record of Food is off once the update has loaded.
        ...(domain.type === 'food' ? { enabled: false } : {}),
        order, createdAt: stamp, updatedAt: stamp,
      })),
      questions,
      answers,
      sportsSessions: [],
      configSnapshots,
      rankEvents: [], profile: null, exercises: [], gymPlans: [], gymSessions, gymSets, runs: [],
      foodEntries: [], foodDays, weightEntries, restDays: [], pausePeriods: [], tombstones: [],
    },
  });
}

/**
 * The live build's device, loading the update on the Monday of week 11.
 * `options` are for the comparisons of the Stage 5b report: the same
 * history with the other window rule, or with no new metric at all.
 */
export function metricCrossingProfile(
  options: Pick<TrainingProfileOptions, 'comparison' | 'withoutMetric'> = {},
): string {
  return trainingProfile({ marksFrom: METRIC_FROM_DAY, updateOn: METRIC_FROM_DAY, ...options });
}

/**
 * The day before the update, the update day, the day after, a week on, and
 * a month on.
 */
export const METRIC_CROSSING_CLOCKS = [-1, 0, 1, 7, 30].map((offset) => addDays(METRIC_FROM, offset));

/** A device set up under this version: the Stage 5b metric and warm-up marks from day one. */
export function strengthProfile(options: Pick<TrainingProfileOptions, 'comparison'> = {}): string {
  return trainingProfile({ marksFrom: 0, updateOn: null, ...options });
}

/**
 * The Sunday that ends the light week, the single light day of Cable Fly
 * and Face Pulls, and the last day.
 */
export const STRENGTH_CLOCKS = [addDays(TRAINING_START, LIGHT_WEEK * 7 + 6), LIGHT_DAY, TRAINING_LAST];

/**
 * The live build's device loading the update on another day — for the
 * report's question of how much the day of the update matters. Warm-up
 * sets are marked from that day on.
 */
export function trainingProfileUpdatedOn(day: number): string {
  return trainingProfile({ marksFrom: day, updateOn: day });
}
