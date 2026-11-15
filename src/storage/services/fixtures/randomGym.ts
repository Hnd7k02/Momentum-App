import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION } from '../../../core/backup/format';
import {
  GYM_SCORING_MODEL,
  RUNNING_SCORING_MODEL,
  SCORING_MODEL,
} from '../../../core/config/constants';
import { SCHEMA_VERSION } from '../../../core/model';
import { addDays, weekKeyOf, type DateKey } from '../../../core/dates';

/**
 * Seeded Gym histories for the proofs of WP3 Stage 5b (D150).
 *
 * The fixture profiles in `profiles.ts` log one set per exercise and day, so
 * they cannot tell one exercise-day metric from another (Gate G). These can:
 * several sets per exercise and day with changing reps, light sets before
 * and after the heavy ones, sets that score nothing, two sessions on one
 * day, a bodyweight and an assisted exercise over a changing bodyweight, a
 * row from before roles existed, a break long enough for abstinence, and a
 * turn of the year inside the range. Record ids are drawn from the seed and
 * are not in any order, as on a device.
 *
 * **A profile is a function of its seed and nothing else.** The files under
 * `.github/fixtures/stage5b/` were written from these profiles by the engine
 * as it stood before Stage 5b, so this generator is frozen with them: a
 * change here changes the histories and makes those files meaningless. Add
 * a new generator for a new question; do not edit this one.
 *
 * Every snapshot is written by hand and carries no exercise-day metric — the
 * histories lie wholly before that era, which is the point of them.
 */

export const RANDOM_GYM_START = '2025-10-06' as DateKey; // a Monday
export const RANDOM_GYM_DAYS = 150;
export const RANDOM_GYM_LAST = addDays(RANDOM_GYM_START, RANDOM_GYM_DAYS - 1);

/** mulberry32, as `planEquivalence.test.ts` has it. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PoolExercise {
  id: string;
  muscles: string[];
  /** Absent: a row from before roles and load types existed. */
  primary?: string[];
  loadType?: 'external' | 'bodyweight' | 'assisted';
  /** The first working load in kilograms, and what a week adds to it. */
  base: number;
  perWeek: number;
}

const POOL: PoolExercise[] = [
  { id: 'ex_bench_press', muscles: ['chest', 'triceps', 'shoulders'], primary: ['chest'], loadType: 'external', base: 60, perWeek: 0.75 },
  { id: 'ex_squat', muscles: ['quadriceps', 'hamstringsGlutes', 'core'], primary: ['quadriceps'], loadType: 'external', base: 80, perWeek: 1.25 },
  { id: 'ex_deadlift', muscles: ['back', 'hamstringsGlutes', 'forearms'], primary: ['back', 'hamstringsGlutes'], loadType: 'external', base: 100, perWeek: 1.5 },
  { id: 'ex_lat_pulldown', muscles: ['back', 'biceps'], primary: ['back'], loadType: 'external', base: 50, perWeek: 0.5 },
  { id: 'ex_biceps_curl', muscles: ['biceps'], primary: ['biceps'], loadType: 'external', base: 12, perWeek: 0.1 },
  { id: 'ex_overhead_press', muscles: ['shoulders', 'triceps', 'core'], primary: ['shoulders'], loadType: 'external', base: 40, perWeek: 0.4 },
  { id: 'ex_calf_raise', muscles: ['calves'], primary: ['calves'], loadType: 'external', base: 70, perWeek: -0.5 },
  { id: 'ex_pull_up', muscles: ['back', 'biceps'], primary: ['back'], loadType: 'bodyweight', base: 0, perWeek: 0.5 },
  { id: 'ex_assisted_dip', muscles: ['triceps', 'chest', 'shoulders'], primary: ['triceps'], loadType: 'assisted', base: 30, perWeek: -0.75 },
  // Logged before roles and load types existed: no `primaryMuscles`, no `loadType`.
  { id: 'ex_old_row', muscles: ['back', 'biceps', 'forearms'], base: 45, perWeek: 0.6 },
];

export interface RandomGymOptions {
  /**
   * The day index from which a P8 snapshot is in force (one-day window,
   * `sessionWindowDays`), or `null` for a history wholly before P8.
   */
  p8From?: number | null;
}

/** One seeded profile, as a backup file. */
export function randomGymProfile(seed: number, options: RandomGymOptions = {}): string {
  const next = prng(seed);
  const pick = (count: number): number => Math.floor(next() * count);
  const hex = (length: number): string =>
    Array.from({ length }, () => Math.floor(next() * 16).toString(16)).join('');
  const stamp = `${RANDOM_GYM_START}T06:00:00.000Z`;
  const ids = { mental: 'dom_rg_mental', gym: 'dom_rg_gym' };

  const questions = [0, 1].map((index) => ({
    id: `q_rg_${index}`,
    domainId: ids.mental,
    text: `Frage ${index}`,
    type: index === 0 ? ('scale' as const) : ('boolean' as const),
    category: 'alltag' as const,
    inverted: false,
    status: 'active' as const,
    order: index,
    createdAt: stamp,
    updatedAt: stamp,
    archivedAt: null,
  }));

  // A break of twelve to nineteen days with no session, somewhere after the
  // Endurance Phase has had time to complete.
  const breakFrom = 70 + pick(30);
  const breakDays = 12 + pick(8);

  const answers: unknown[] = [];
  const gymSessions: unknown[] = [];
  const gymSets: unknown[] = [];
  const weightEntries: unknown[] = [];

  // The bodyweight: first measured a few days in, so the earliest pull-ups
  // have none; then again every three weeks or so, drifting.
  let bodyweight = 78 + pick(8);
  let nextWeighIn = 3 + pick(6);

  for (let index = 0; index < RANDOM_GYM_DAYS; index += 1) {
    const date = addDays(RANDOM_GYM_START, index);
    const weekKey = weekKeyOf(date);
    const day = (hour: string) => `${date}T${hour}:00:00.000Z`;
    const week = Math.floor(index / 7);

    if (next() > 0.12) {
      for (const question of questions) {
        answers.push({
          id: `${date}#${question.id}`, date, questionId: question.id, domainId: ids.mental,
          value: question.type === 'scale' ? 3 + pick(8) : next() > 0.3,
          valueType: question.type, sensitivity: 'private' as const, configSnapshotId: 'cfg_rg',
          createdAt: day('20'), updatedAt: day('20'),
        });
      }
    }

    if (index === nextWeighIn) {
      bodyweight += (pick(5) - 2) * 0.5;
      weightEntries.push({ id: `wt_${hex(10)}`, date, kg: bodyweight, createdAt: day('07'), updatedAt: day('07') });
      nextWeighIn = index + 14 + pick(14);
    }

    const inBreak = index >= breakFrom && index < breakFrom + breakDays;
    // About three and a half sessions a week, and now and then a second one
    // on the same day.
    const sessionsToday = inBreak ? 0 : next() < 0.5 ? (next() < 0.06 ? 2 : 1) : 0;
    for (let session = 0; session < sessionsToday; session += 1) {
      const sessionId = `gym_${hex(12)}`;
      const hour = session === 0 ? '18' : '20';
      gymSessions.push({
        id: sessionId, date, weekKey, performedAt: day(hour), planId: null, note: null,
        legacyCarryOver: false, configSnapshotId: 'cfg_rg', createdAt: day(hour), updatedAt: day(hour),
      });
      const count = 3 + pick(3);
      const chosen: PoolExercise[] = [];
      while (chosen.length < count) {
        const candidate = POOL[pick(POOL.length)]!;
        if (!chosen.includes(candidate)) chosen.push(candidate);
      }
      let order = 0;
      for (const exercise of chosen) {
        // The day's working load: the plan's, with a light or a heavy day
        // now and then, in half kilograms.
        const swing = next() < 0.15 ? -0.2 : next() < 0.1 ? 0.08 : 0;
        const working = Math.max(0, Math.round((exercise.base + exercise.perWeek * week) * (1 + swing) * 2) / 2);
        const sets = 1 + pick(5);
        const style = pick(4); // 0 straight, 1 ramp up, 2 drop after, 3 reps falling
        const topReps = 4 + pick(10);
        for (let set = 0; set < sets; set += 1) {
          let load = working;
          let reps = topReps;
          if (style === 1) {
            // Lighter sets first, the working load on the last.
            load = Math.round(working * (0.5 + (0.5 * (set + 1)) / sets) * 2) / 2;
            reps = topReps + (sets - 1 - set) * 2;
          } else if (style === 2 && set === sets - 1 && sets > 1) {
            load = Math.round(working * 0.6 * 2) / 2;
            reps = topReps + 5;
          } else if (style === 3) {
            reps = Math.max(0, topReps - set * 2);
          }
          // A set that scores nothing: no reps entered, or no load on the bar.
          if (next() < 0.03) reps = 0;
          if (next() < 0.02 && exercise.loadType !== 'bodyweight') load = 0;
          gymSets.push({
            id: `set_${hex(12)}`,
            sessionId,
            exerciseId: exercise.id,
            date,
            weightGrams: Math.round(load * 1000),
            reps,
            order,
            muscles: [...exercise.muscles],
            ...(exercise.primary === undefined ? {} : { primaryMuscles: [...exercise.primary] }),
            ...(exercise.loadType === undefined ? {} : { loadType: exercise.loadType }),
            createdAt: day(hour),
          });
          order += 1;
        }
      }
    }
  }

  const domainSnapshots = [
    { id: ids.mental, type: 'mental' as const, enabled: true, settings: {} },
    { id: ids.gym, type: 'gym' as const, enabled: true, settings: { targetPerWeek: 3 } },
  ];
  const scoring = {
    editWindowDays: 3, scaleMin: 1, scaleMax: 10,
    model: SCORING_MODEL, gymModel: GYM_SCORING_MODEL, runningModel: RUNNING_SCORING_MODEL,
  };
  const config = {
    boss: { weights: { mental: 0.5, gym: 0.5 } },
    domains: domainSnapshots,
    questions: questions.map((q) => ({ id: q.id, domainId: q.domainId, text: q.text, type: q.type, status: q.status, category: q.category })),
    scoring,
  };
  const configSnapshots: unknown[] = [{ id: 'cfg_rg', effectiveFrom: RANDOM_GYM_START, createdAt: stamp, config }];
  const p8From = options.p8From ?? null;
  if (p8From !== null) {
    const from = addDays(RANDOM_GYM_START, p8From);
    configSnapshots.push({
      id: 'cfg_rg_p8',
      effectiveFrom: from,
      createdAt: `${from}T06:00:00.000Z`,
      config: { ...config, scoring: { ...scoring, editWindowDays: 1, sessionWindowDays: 1 } },
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
        id: 'settings', language: 'de', firstUseDate: RANDOM_GYM_START, onboardingCompletedAt: stamp,
        acknowledgedRankId: null, legacySportMigration: 'none', createdAt: stamp, updatedAt: stamp,
      },
      domains: domainSnapshots.map((domain, order) => ({ ...domain, order, createdAt: stamp, updatedAt: stamp })),
      questions,
      answers,
      sportsSessions: [],
      configSnapshots,
      rankEvents: [], profile: null, exercises: [], gymPlans: [], gymSessions, gymSets, runs: [],
      foodEntries: [], foodDays: [], weightEntries, restDays: [], pausePeriods: [], tombstones: [],
    },
  });
}

/**
 * The profiles the proofs run over: two wholly before P8 and two that cross
 * into it at day 63 (a Monday), so the days judged by either week rule are
 * both in the files.
 */
export const RANDOM_GYM_PROFILES: { name: string; seed: number; p8From: number | null }[] = [
  { name: 'seed-11', seed: 11, p8From: null },
  { name: 'seed-29', seed: 29, p8From: null },
  { name: 'seed-47-p8', seed: 47, p8From: 63 },
  { name: 'seed-83-p8', seed: 83, p8From: 63 },
];

/** A day in the middle of the range, after the P8 crossing, and the last day. */
export const RANDOM_GYM_CLOCKS = [addDays(RANDOM_GYM_START, 96), RANDOM_GYM_LAST];
