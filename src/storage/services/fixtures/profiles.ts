import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION } from '../../../core/backup/format';
import {
  GYM_SCORING_MODEL,
  RUNNING_SCORING_MODEL,
  SCORING_MODEL,
} from '../../../core/config/constants';
import { SCHEMA_VERSION } from '../../../core/model';
import { addDays, weekKeyOf, type DateKey } from '../../../core/dates';
import { weightsForSnapshot } from '../../../core/boss';

/**
 * Synthetic backup profiles for replay tests.
 *
 * Deterministic by construction: fixed dates, no clock, no randomness. A
 * profile is a backup file as a string, so a test imports it exactly the way
 * a user would restore one.
 */

export const DAYS = 90;
export const START = '2026-06-01' as DateKey; // a Monday
export const LAST = addDays(START, DAYS - 1);

export function at(day: string, hour = 21): Date {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, date, hour, 0, 0);
}

export interface ProfileOptions {
  /** Days of history; ninety unless a scenario needs more. */
  days?: number;
  /** Inclusive day-index ranges with no Gym sessions and no runs at all. */
  gymBreak?: readonly [number, number] | null;
  runBreak?: readonly [number, number] | null;
}

const inBreak = (range: readonly [number, number] | null | undefined, index: number): boolean =>
  range !== null && range !== undefined && index >= range[0] && index <= range[1];

/**
 * Four domains, ninety days, every current model in force from day one.
 *
 * With no options this is byte for byte the profile `domainOutputs.test.ts`
 * pinned before the domain terminal existed — the fingerprint there is what
 * proves it. The options exist for the Stage 2 baseline, which needs an
 * abstinence long enough for the training decay schedule to actually run.
 */
export function currentProfile(options: ProfileOptions = {}): string {
  const days = options.days ?? DAYS;
  const stamp = `${START}T06:00:00.000Z`;
  const ids = { mental: 'dom_fp_mental', gym: 'dom_fp_gym', running: 'dom_fp_running', food: 'dom_fp_food' };
  const questions = [0, 1, 2, 3].map((index) => ({
    id: `q_fp_${index}`,
    domainId: ids.mental,
    text: `Frage ${index}`,
    type: index % 2 === 0 ? ('scale' as const) : ('boolean' as const),
    category: index < 2 ? ('alltag' as const) : ('gesundheit' as const),
    inverted: false,
    status: 'active' as const,
    order: index,
    createdAt: stamp,
    updatedAt: stamp,
    archivedAt: null,
  }));

  const answers = [];
  const gymSessions = [];
  const gymSets = [];
  const runs = [];
  const foodDays = [];
  for (let index = 0; index < days; index += 1) {
    const date = addDays(START, index);
    const weekKey = weekKeyOf(date);
    const day = (hour: string) => `${date}T${hour}:00:00.000Z`;
    if (index % 9 !== 0) {
      for (const question of questions) {
        answers.push({
          id: `${date}#${question.id}`, date, questionId: question.id, domainId: ids.mental,
          value: question.type === 'scale' ? 4 + ((index + question.order) % 7) : index % 3 !== 0,
          valueType: question.type, sensitivity: 'private' as const, configSnapshotId: 'cfg_fp',
          createdAt: day('20'), updatedAt: day('20'),
        });
      }
      foodDays.push({
        id: date, date, adherence: 5 + (index % 5), note: null, sensitivity: 'private' as const,
        configSnapshotId: 'cfg_fp', createdAt: day('21'), updatedAt: day('21'),
      });
    }
    // Three sessions most weeks, one week in five with only one — so
    // attendance, the Endurance Phase and a setback are all in the hash.
    const weekOfYear = Math.floor(index / 7);
    if (
      !inBreak(options.gymBreak, index) &&
      (index % 7 === 0 || (weekOfYear % 5 !== 3 && (index % 7 === 2 || index % 7 === 4)))
    ) {
      const id = `gym_${date}`;
      gymSessions.push({
        id, date, weekKey, performedAt: day('18'), planId: null, note: null, legacyCarryOver: false,
        configSnapshotId: 'cfg_fp', createdAt: day('18'), updatedAt: day('18'),
      });
      for (const [order, exercise, muscles, primary] of [
        [0, 'ex_squat', ['quadriceps', 'hamstringsGlutes', 'core'], ['quadriceps']],
        [1, 'ex_bench_press', ['chest', 'triceps', 'shoulders'], ['chest']],
      ] as const) {
        gymSets.push({
          id: `set_${date}_${order}`, sessionId: id, exerciseId: exercise, date,
          weightGrams: (60 + order * 10 + Math.floor(index / 14) * 2500 / 1000) * 1000,
          reps: 5 + (index % 3), order, muscles: [...muscles], primaryMuscles: [...primary],
          loadType: 'external' as const, createdAt: day('18'),
        });
      }
    }
    if (!inBreak(options.runBreak, index) && (index % 7 === 1 || index % 7 === 5)) {
      const metres = index % 14 === 1 ? 10000 : 5000;
      runs.push({
        id: `run_${date}`, date, weekKey, performedAt: day('07'), source: 'manual' as const, externalId: null,
        distanceMetres: metres, durationSeconds: Math.round((metres / 1000) * (360 - Math.floor(index / 10) * 4)),
        elevationMetres: null, steps: null, note: null, legacyCarryOver: false,
        configSnapshotId: 'cfg_fp', createdAt: day('07'), updatedAt: day('07'),
      });
    }
  }

  const domainSnapshots = [
    { id: ids.mental, type: 'mental' as const, enabled: true, settings: {} },
    { id: ids.gym, type: 'gym' as const, enabled: true, settings: { targetPerWeek: 3 } },
    { id: ids.running, type: 'running' as const, enabled: true, settings: { targetPerWeek: 2 } },
    { id: ids.food, type: 'food' as const, enabled: true, settings: {} },
  ];

  return JSON.stringify({
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: stamp,
    app: { name: 'Momentum', version: '0.1.0' },
    data: {
      settings: {
        id: 'settings', language: 'de', firstUseDate: START, onboardingCompletedAt: stamp,
        acknowledgedRankId: null, legacySportMigration: 'none', createdAt: stamp, updatedAt: stamp,
      },
      domains: domainSnapshots.map((domain, order) => ({ ...domain, order, createdAt: stamp, updatedAt: stamp })),
      questions,
      answers,
      sportsSessions: [],
      configSnapshots: [{
        id: 'cfg_fp',
        effectiveFrom: START,
        createdAt: stamp,
        config: {
          boss: { weights: { mental: 0.4, gym: 0.3, running: 0.2, food: 0.1 } },
          domains: domainSnapshots,
          questions: questions.map((q) => ({ id: q.id, domainId: q.domainId, text: q.text, type: q.type, status: q.status, category: q.category })),
          scoring: {
            editWindowDays: 3, scaleMin: 1, scaleMax: 10,
            model: SCORING_MODEL, gymModel: GYM_SCORING_MODEL, runningModel: RUNNING_SCORING_MODEL,
          },
        },
      }],
      rankEvents: [], profile: null, exercises: [], gymPlans: [], gymSessions, gymSets, runs,
      foodEntries: [], foodDays, weightEntries: [], restDays: [], pausePeriods: [], tombstones: [],
    },
  });
}

/**
 * The same four domains over 180 days, with two real training breaks.
 *
 * Gym stops for four weeks from day 60 (the Endurance Phase is long complete
 * by then, so the abstinence schedule runs through several blocks), and
 * Running stops for twenty days from day 120. Both resume afterwards, so the
 * fold has to end an episode and start counting again from what the decay
 * left. This is the profile the Stage 2 decay differential needs at the
 * service level, where the day inputs are derived rather than hand-built.
 */
export const BREAK_DAYS = 180;
export const BREAK_LAST = addDays(START, BREAK_DAYS - 1);

export function trainingBreakProfile(): string {
  return currentProfile({ days: BREAK_DAYS, gymBreak: [60, 87], runBreak: [120, 139] });
}

/*
 * WP3 Stage 3 (P8). Two profiles frozen into the golden baseline before any
 * Stage 3b code, so the Stage 3b report can name every value P8 moves.
 *
 * A P8 snapshot is the profile's own configuration again with the one-day
 * window (`editWindowDays: 1`) and the P8 marker (`sessionWindowDays: 1`),
 * effective from a fixed day. Before Stage 3b nothing reads either field, so
 * the frozen files are the pre-P8 replay of exactly the data Stage 3b will
 * replay under P8 from that day on.
 */
function withP8Snapshot(profile: string, from: DateKey, extra?: (data: Record<string, unknown>) => void): string {
  const backup = JSON.parse(profile) as { data: Record<string, unknown> };
  const snapshots = backup.data.configSnapshots as { id: string; effectiveFrom: string; createdAt: string; config: { scoring: Record<string, unknown> } }[];
  const base = snapshots[snapshots.length - 1]!;
  snapshots.push({
    ...base,
    id: `${base.id}_p8`,
    effectiveFrom: from,
    createdAt: `${from}T06:00:00.000Z`,
    config: { ...base.config, scoring: { ...base.config.scoring, editWindowDays: 1, sessionWindowDays: 1 } },
  });
  extra?.(backup.data);
  return JSON.stringify(backup);
}

/** P8 from Monday 2026-07-27 (day 56), four days before the Gym break begins. */
export const P8_FROM = addDays(START, 56);

/**
 * The training-break profile crossing into P8. Its clocks each sit on one
 * rule: the gym break's seventh silent day as yesterday (day 66), the Monday
 * after an empty Gym week (day 70), an unanswered day aged two (day 74, for
 * day 72), the first week back with one session of three (day 89), and the
 * run break's seventh silent day as yesterday (day 125).
 */
export function p8CrossingProfile(): string {
  return withP8Snapshot(trainingBreakProfile(), P8_FROM);
}
export const P8_CROSSING_CLOCKS = [66, 70, 74, 89, 125].map((index) => addDays(START, index));

/** P8 from Monday 2026-06-08 (day 7) in the four-domain profile. */
export const P8_CONFIRMATION_FROM = addDays(START, 7);

/**
 * The four-domain profile with promotion confirmation active from its first
 * day (D126) and crossing into P8 at day 7, after its first promotion
 * (Challenger, 06-07) and before the next four (Contender 06-14, Elite
 * 06-21, Veteran 06-28, Master 07-09 under the pre-P8 rule). The clocks sit
 * on those promotions — the Sunday of the first, the Mondays after the next
 * two, the Friday after the last — and on the last day.
 */
export function confirmationProfile(): string {
  return withP8Snapshot(currentProfile(), P8_CONFIRMATION_FROM, (data) => {
    const settings = data.settings as Record<string, unknown>;
    settings.promotionConfirmation = { from: START, targetRankId: null, eligibleDates: [] };
  });
}
export const CONFIRMATION_CLOCKS = [13, 21, 28, 39, 89].map((index) => addDays(START, index));

/*
 * WP3 Stage 4 (P1). The confirmation profile — P8 from day 7, promotions
 * confirmed from day one — with Food switched off from day 45, frozen into
 * the golden baseline before any Stage 4 code.
 *
 * The switch-off snapshot is the configuration in force with Food's entry
 * disabled and the Boss weights worked out again over the remaining domains
 * from the user's parts (here 4 : 3 : 2 : 1, the parts the profile's own
 * shares come from), which is what Stage 4 writes on the first load after
 * the update. The replay already reads a disabled entry, so the frozen files
 * are what Stage 4 has to leave byte-identical: it changes what is written
 * and shown, never how a day is replayed.
 */
export const FOOD_OFF_FROM = addDays(START, 45);

export function foodOffProfile(): string {
  type Snapshot = {
    id: string;
    effectiveFrom: string;
    createdAt: string;
    config: { boss?: unknown; domains: { type: string; enabled: boolean }[] } & Record<string, unknown>;
  };
  const backup = JSON.parse(confirmationProfile()) as { data: Record<string, unknown> };
  const data = backup.data;
  const settings = data.settings as Record<string, unknown>;
  const parts = { mental: 4, gym: 3, running: 2, food: 1 };
  settings.bossWeights = parts;
  for (const domain of data.domains as { type: string; enabled: boolean }[]) {
    if (domain.type === 'food') domain.enabled = false;
  }
  const snapshots = data.configSnapshots as Snapshot[];
  const base = snapshots[snapshots.length - 1]!;
  snapshots.push({
    ...base,
    id: `${base.id}_foodoff`,
    effectiveFrom: FOOD_OFF_FROM,
    createdAt: `${FOOD_OFF_FROM}T06:00:00.000Z`,
    config: {
      ...base.config,
      boss: { weights: weightsForSnapshot(parts, ['mental', 'gym', 'running']) },
      domains: base.config.domains.map((domain) => (domain.type === 'food' ? { ...domain, enabled: false } : domain)),
    },
  });
  return JSON.stringify(backup);
}

/**
 * The day before the switch-off, the switch-off day, the day after, the day
 * the day before closes (two days on, P8), a week on, and the last day.
 */
export const FOOD_OFF_CLOCKS = [44, 45, 46, 47, 52, 89].map((index) => addDays(START, index));
