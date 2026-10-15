import 'fake-indexeddb/auto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setClock } from '../../core/clock';
import { addDays, type DateKey } from '../../core/dates';
import { canonical, canonicalJson } from '../../testing/canonical';
import { closeDatabase, deleteDatabase } from '../db';
import { gymSessionsRepository, gymSetsRepository } from '../repositories';
import { applyOnboarding } from './configurationService';
import { loadBossProgression } from './bossService';
import { loadHistory } from './historyService';
import {
  addSet,
  draftFromPlan,
  ensureExerciseCatalogue,
  loadGymHistory,
  openSessionForDay,
  recordBodyweight,
  startSessionFromDraft,
} from './gymService';
import { createTrainingPlan } from './trainingPlanService';

/**
 * Manual entry and plan entry are two doors into one room (WP2-1N).
 *
 * The same performed sets, on the same days, logged once through the free
 * session and once through a saved plan. Three things are proved, over
 * many runs with seeded record ids so a failure is reproducible:
 *
 * **A. The persisted inputs are identical** — every set row (date, exercise,
 * muscles, roles, load type, weight, reps, order) and every session row
 * (date, week), once the record ids and the plan provenance are removed.
 *
 * **B. Every discrete output is identical** — attendance and week states,
 * the Endurance state, the abstinence episode, Maintenance, the model and
 * origin, every count, every classification, every integer score, the
 * Boss rank and its changes, every day's status.
 *
 * **C. Every floating output is within `MAX_ULPS_FROM_ADDITION_ORDER`** —
 * and the reason there is a bound at all is proved by
 *
 * **D. the control**: two *manual* histories with the same sets and
 * different record ids differ by the same class of last-ULP effect. The
 * engine reads sets through the `by_date` index, whose order within a day
 * is the random record id, and `musclePerformance` sums a group's weighted
 * ratios in that order; floating-point addition is not associative. That is
 * a property of the engine, not of plans, recorded as technical debt in
 * HANDOVER.md and deliberately not changed here. If the control ever shows
 * no difference at all, the plan path must be exact — the tolerance exists
 * only because the control demonstrates the phenomenon without plans.
 */

/* ── Seeded ids ─────────────────────────────────────────────────────────── */

/** mulberry32: small, deterministic, good enough to shuffle an index order. */
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

type Uuid = `${string}-${string}-${string}-${string}-${string}`;

/** UUID-shaped ids from a seed, so `createId()` is deterministic per run. */
function seededUuid(seed: number): () => Uuid {
  const next = prng(seed);
  const hex = (length: number) =>
    Array.from({ length }, () => Math.floor(next() * 16).toString(16)).join('');
  return () => `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}` as Uuid;
}

let uuidSpy: ReturnType<typeof vi.spyOn> | null = null;
function seedIds(seed: number): void {
  const generator = seededUuid(seed);
  if (uuidSpy) uuidSpy.mockRestore();
  uuidSpy = vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(generator as never);
}

/* ── ULPs ───────────────────────────────────────────────────────────────── */

/**
 * The bounds for a floating output, in units in the last place (ULPs).
 *
 * Two, because the phenomenon has a source and a propagation:
 *
 * - **At the source** — a muscle group's weighted-mean ratio, and the means
 *   of those — the difference two IEEE-754 summations of the same terms can
 *   accumulate when the terms are added in a different order is one
 *   rounding. Observed maximum: 1 ULP (|Δ| = 2.2e-16 at a ratio of ~1.16).
 * - **Derived** from it — the percentage change `(ratio − 1) × 100`, the
 *   logistic curve, the 40/60 target, the day-by-day fold and the Boss
 *   ladder — that one rounding is amplified by cancellation and by the
 *   curve's slope. Observed maximum: 13 ULP of a 0–1000 performance score
 *   (|Δ| = 1.5e-12 at ~868). A *movement* is the difference of two nearly
 *   equal positions, so it is measured in ULPs of the position it moved
 *   from, not of the tiny result (observed: 2 ULP of the position).
 *
 * Neither is a product tolerance. A genuine change to a weight, a window,
 * a curve or a rule moves these values by a relative 1e-6 or more —
 * ten billion ULPs — and fails both bounds by nine orders of magnitude.
 * The observed maxima across all runs are printed by the suite and are
 * recorded in the WP2-1 closeout report.
 */
const MAX_ULPS_AT_SOURCE = 2;
const MAX_ULPS_DERIVED = 16;

/** How many seeded runs each comparison is made over. */
const RUNS = Number(process.env.EQUIVALENCE_RUNS ?? 20);

const f64 = new Float64Array(1);
const i64 = new BigInt64Array(f64.buffer);

/** A double as an integer on which adjacent doubles are adjacent integers. */
function ordered(value: number): bigint {
  f64[0] = value;
  const bits = i64[0]!;
  return bits < 0n ? -(bits & 0x7fffffffffffffffn) : bits;
}

function ulpDistance(a: number, b: number): number {
  if (a === b) return 0;
  const distance = ordered(a) - ordered(b);
  return Number(distance < 0n ? -distance : distance);
}

/** One unit in the last place at a given magnitude. */
function ulpOf(magnitude: number): number {
  const exponent = Math.floor(Math.log2(Math.abs(magnitude)));
  return 2 ** (exponent - 52);
}

/** A ratio is where the summation order lands; everything else is derived from one. */
const isSource = (path: string): boolean => /\.ratio$/.test(path);

/**
 * A movement is `position[t] − position[t−1]`: two nearly equal numbers,
 * each carrying the same last-ULP effect, whose difference is tiny. Counted
 * in ULPs of that difference the effect looks enormous; counted in ULPs of
 * the position it is what it is. The reference is the position on the same
 * point (`progress` on the Boss ladder, `rating` on a rating point).
 */
function referencePath(path: string): string | null {
  if (/\.boss\.points\[\d+\](\.contributions\[\d+\])?\.movement$/.test(path)) return path.replace(/\.movement$/, '.progress');
  if (/\.gymState\.detail\[\d+\]\.movement$/.test(path)) return path.replace(/\.movement$/, '.rating');
  return null;
}

function ulpsBetween(path: string, a: number, b: number, reference: Map<string, unknown>): number {
  const scalePath = referencePath(path);
  if (scalePath === null) return ulpDistance(a, b);
  const scale = reference.get(scalePath);
  if (typeof scale !== 'number' || scale === 0) return ulpDistance(a, b);
  return Math.abs(a - b) / ulpOf(scale);
}

/* ── The workouts ───────────────────────────────────────────────────────── */

function freezeAt(day: string, hour = 18): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

const START = '2026-01-05' as DateKey; // a Monday
const kg = (value: number) => Math.round(value * 1000);

interface Performed {
  date: DateKey;
  sets: { exerciseId: string; reps: number; weightKg: number }[];
}

/**
 * Twelve weeks of three sessions, rising loads, a bodyweight exercise, then
 * a twelve-day break and a return — enough to take the Endurance Phase
 * through its four weeks and to open an abstinence episode on both paths.
 */
function schedule(): Performed[] {
  const days: Performed[] = [];
  for (let week = 0; week < 12; week += 1) {
    if (week === 9) continue; // the break: no session for twelve days
    for (const offset of [0, 2, 4]) {
      const date = addDays(START, week * 7 + offset);
      const bump = week * 1.25;
      days.push({
        date,
        sets: [
          { exerciseId: 'ex_bench_press', reps: 8, weightKg: 60 + bump },
          { exerciseId: 'ex_bench_press', reps: 8, weightKg: 62.5 + bump },
          { exerciseId: 'ex_incline_press', reps: 10, weightKg: 24 + bump / 2 },
          { exerciseId: 'ex_cable_lateral_raise', reps: 15, weightKg: 7.5 },
          { exerciseId: 'ex_triceps_pushdown', reps: 12, weightKg: 25 + bump / 2 },
          { exerciseId: 'ex_dip', reps: 10, weightKg: offset === 4 ? 5 : 0 },
        ],
      });
    }
  }
  return days;
}

const PLAN_EXERCISES = ['ex_bench_press', 'ex_incline_press', 'ex_cable_lateral_raise', 'ex_triceps_pushdown', 'ex_dip'];
const REFERENCE = addDays(START, 12 * 7 + 3);

async function fresh(seed: number): Promise<void> {
  await closeDatabase();
  await deleteDatabase();
  seedIds(seed);
  freezeAt(START, 8);
  await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
  await ensureExerciseCatalogue();
  await recordBodyweight(80, START, START);
}

async function manual(): Promise<void> {
  for (const day of schedule()) {
    freezeAt(day.date);
    const session = await openSessionForDay(day.date);
    for (const set of day.sets) {
      await addSet({ sessionId: session.id, exerciseId: set.exerciseId, reps: set.reps, weightGrams: kg(set.weightKg) });
    }
  }
}

async function planned(): Promise<void> {
  const plan = await createTrainingPlan({
    name: 'Push',
    exercises: PLAN_EXERCISES.map((exerciseId) => ({ exerciseId })),
  });
  for (const day of schedule()) {
    freezeAt(day.date);
    const draft = draftFromPlan(plan);
    let sessionId: string | null = null;
    for (const set of day.sets) {
      // The session comes into being with the first set, as the screen does it.
      if (sessionId === null) sessionId = (await startSessionFromDraft(draft, day.date)).id;
      await addSet({ sessionId, exerciseId: set.exerciseId, reps: set.reps, weightGrams: kg(set.weightKg) });
    }
  }
}

/* ── What is compared ───────────────────────────────────────────────────── */

/** Random ids and plan provenance are the only things allowed to differ. */
function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value instanceof Map) return new Map([...value].map(([k, v]) => [k, scrub(v)]));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'id' || key === 'sessionId' || key === 'planId') continue;
      out[key] = scrub(entry);
    }
    return out;
  }
  return value;
}

interface Outputs {
  /** A: the persisted scoring inputs, canonical. */
  inputs: { sets: string; sessions: string };
  /** B: every discrete output, exact. */
  discrete: unknown;
  /** B + C: every leaf of every derived output, by path. */
  leaves: Map<string, unknown>;
}

function flatten(value: unknown, path: string, into: Map<string, unknown>): void {
  if (Array.isArray(value)) value.forEach((entry, index) => flatten(entry, `${path}[${index}]`, into));
  else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) flatten(entry, `${path}.${key}`, into);
  } else into.set(path, value);
}

async function outputs(): Promise<Outputs> {
  freezeAt(REFERENCE, 9);
  const sessions = await gymSessionsRepository.getAll();
  const sets = await gymSetsRepository.getAll();
  const boss = await loadBossProgression(REFERENCE);
  const history = await loadHistory(START, REFERENCE);
  const gym = await loadGymHistory(START, REFERENCE);
  const gymLedger = boss.domains.find((domain) => domain.domain === 'gym')!;
  const byDate = (a: { date: string; exerciseId: string }, b: { date: string; exerciseId: string }) =>
    a.date.localeCompare(b.date) || a.exerciseId.localeCompare(b.exerciseId);

  const inputs = {
    // Every set row, in a stable order, without the random ids: date,
    // exercise, muscles, primary muscles, load type, weight, reps, order.
    sets: canonicalJson(
      scrub([...sets].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.exerciseId.localeCompare(b.exerciseId))),
    ),
    // Every session row: date and week — which is the attendance input — and
    // the count. The snapshot and planId are provenance and are left out.
    sessions: canonicalJson(sessions.map((session) => [session.date, session.weekKey, session.legacyCarryOver]).sort()),
  };

  const derived = {
    // `days` comes back in index order — date, then the random id — so its
    // array order is not an output; it is sorted, and its numbers compared.
    gymHistory: { ...gym, days: [...gym.days].sort(byDate) },
    gymState: boss.gym,
    gymLedger,
    boss: { era: boss.era, origin: boss.origin, rank: boss.rank.id, peakRank: boss.peakRank.id, progress: boss.progress, lifetimeXp: boss.lifetimeXp, points: boss.points, changes: boss.changes },
    history: { days: history.days, gym: history.gym, overall: history.overall, weeks: history.weeks },
  };

  const discrete = {
    sessionsPerWeek: history.weeks.map((week) => [week.weekKey, week.domains.map((d) => [d.domain, d.sessions, d.target, d.met])]),
    weekly: history.days.map((day) => [day.date, day.status, day.dueItems, day.answeredItems]),
    gym: {
      model: boss.gym.model,
      origin: boss.gym.origin,
      ageMonths: boss.gym.ageMonths,
      sessionsThisWeek: boss.gym.sessionsThisWeek,
      weeklyTarget: boss.gym.weeklyTarget,
      endurance: boss.gym.endurance,
      promotionUnlocked: boss.gym.promotionUnlocked,
      abstinence: boss.gym.abstinence,
      maintenance: boss.gym.maintenance,
      components: boss.gym.performance.components,
      perDay: boss.gym.detail.map((point) => [point.date, point.decaying, point.maintenance, point.skipped, point.target === null]),
    },
    ledger: { domain: gymLedger.domain, started: gymLedger.started, active: gymLedger.active },
    // A rank change is a date, a direction and a rank; the rating it was
    // crossed at is a float and is compared with the other floats below.
    boss: { era: boss.era, origin: boss.origin, rank: boss.rank.id, peakRank: boss.peakRank.id, lifetimeXp: boss.lifetimeXp, changes: boss.changes.map((change) => [change.date, change.kind, change.to]) },
    performance: {
      comparisons: [...gym.comparisons.values()].sort(byDate).map((c) => [c.exerciseId, c.date, c.kind, c.current, c.previous, c.previousDate, c.delta]),
      bestSets: [...gym.days].sort(byDate).map((day) => [day.date, day.exerciseId, day.best.score, day.muscles, day.primaryMuscles ?? null]),
      muscles: gym.overall.muscles.map((m) => [m.muscle, m.status, m.exercises, m.compared, m.latestScore]),
      measured: gym.overall.measured,
      awaitingBaseline: gym.overall.awaitingBaseline,
      untrained: gym.overall.untrained,
      awaitingBodyweight: gym.awaitingBodyweight,
    },
  };

  const leaves = new Map<string, unknown>();
  flatten(canonical(scrub(derived)), '', leaves);
  return { inputs, discrete: canonical(scrub(discrete)), leaves };
}

/* ── The comparison ─────────────────────────────────────────────────────── */

interface Delta {
  path: string;
  a: number;
  b: number;
  ulps: number;
}

/** The worst delta at the source and the worst derived one, per comparison. */
interface Worst {
  source: Delta;
  derived: Delta;
}

const none = (): Delta => ({ path: '', a: 0, b: 0, ulps: 0 });

/** Exact for everything that is not a non-integer number; ULPs for those. */
function compare(a: Outputs, b: Outputs, label: string): Worst {
  expect(b.inputs.sets, `${label}: set rows`).toBe(a.inputs.sets);
  expect(b.inputs.sessions, `${label}: session rows`).toBe(a.inputs.sessions);

  // Discrete outputs, exactly — reported by path so a failure names the field.
  const discreteA = new Map<string, unknown>();
  const discreteB = new Map<string, unknown>();
  flatten(a.discrete, '', discreteA);
  flatten(b.discrete, '', discreteB);
  const differing = [...new Set([...discreteA.keys(), ...discreteB.keys()])]
    .filter((path) => JSON.stringify(discreteA.get(path)) !== JSON.stringify(discreteB.get(path)))
    .map((path) => `${path}: ${JSON.stringify(discreteA.get(path))} vs ${JSON.stringify(discreteB.get(path))}`);
  expect(differing.join('\n'), `${label}: discrete outputs`).toBe('');
  expect([...b.leaves.keys()], `${label}: output shape`).toEqual([...a.leaves.keys()]);

  const worst: Worst = { source: none(), derived: none() };
  for (const [path, left] of a.leaves) {
    const right = b.leaves.get(path);
    if (typeof left === 'number' && typeof right === 'number' && !(Number.isInteger(left) && Number.isInteger(right))) {
      const ulps = ulpsBetween(path, left, right, a.leaves);
      const family = isSource(path) ? 'source' : 'derived';
      if (ulps > worst[family].ulps) worst[family] = { path, a: left, b: right, ulps };
    } else {
      expect(right, `${label}: ${path}`).toEqual(left);
    }
  }
  return worst;
}

const observed = { control: [] as Worst[], plan: [] as Worst[] };

beforeAll(() => {
  // A control and a plan comparison per run, over independently seeded ids.
  // Everything is asserted per run; the maxima are reported at the end.
});

const worstOf = (deltas: Delta[]): Delta => deltas.reduce((max, d) => (d.ulps > max.ulps ? d : max), none());
const describeDelta = (d: Delta): string =>
  d.ulps === 0 ? '0 ULP' : `${d.ulps} ULP at ${d.path} (|Δ| = ${Math.abs(d.a - d.b)}, value ≈ ${d.a})`;

afterEach(() => {
  setClock(null);
});

afterAll(async () => {
  uuidSpy?.mockRestore();
  await closeDatabase();
  // Documented in the WP2-1 closeout report; printed so the number is never a memory.
  console.log(
    `[planEquivalence] ${RUNS} runs\n` +
      `  control (manual vs manual)  source ${describeDelta(worstOf(observed.control.map((w) => w.source)))}\n` +
      `                              derived ${describeDelta(worstOf(observed.control.map((w) => w.derived)))}\n` +
      `  plan    (manual vs plan)    source ${describeDelta(worstOf(observed.plan.map((w) => w.source)))}\n` +
      `                              derived ${describeDelta(worstOf(observed.plan.map((w) => w.derived)))}`,
  );
});

describe('manual entry versus plan entry', () => {
  for (let run = 1; run <= RUNS; run += 1) {
    const seedA = 1_000 + run;
    const seedB = 2_000 + run;
    const seedPlan = 3_000 + run;

    it(`run ${run}: identical inputs, identical discrete outputs, floating outputs within ${MAX_ULPS_AT_SOURCE}/${MAX_ULPS_DERIVED} ULP (seeds A=${seedA} B=${seedB} plan=${seedPlan})`, async () => {
      await fresh(seedA);
      await manual();
      const viaManualA = await outputs();
      expect(viaManualA.inputs.sets.length).toBeGreaterThan(1000);

      await fresh(seedB);
      await manual();
      const viaManualB = await outputs();

      await fresh(seedPlan);
      await planned();
      const viaPlan = await outputs();

      // The schedule did what it claims: the gate opened and a break was taken.
      const state = (viaPlan.discrete as { gym: { endurance: { unlocked: boolean }; abstinence: unknown } }).gym;
      expect(state.endurance.unlocked).toBe(true);
      expect(state.abstinence).not.toBeNull();

      const control = compare(viaManualA, viaManualB, `control seeds ${seedA}/${seedB}`);
      const plan = compare(viaManualA, viaPlan, `plan seeds ${seedA}/${seedPlan}`);
      observed.control.push(control);
      observed.plan.push(plan);

      for (const [label, worst] of [[`control seeds ${seedA}/${seedB}`, control], [`plan seeds ${seedA}/${seedPlan}`, plan]] as const) {
        expect(worst.source.ulps, `${label}: ${describeDelta(worst.source)}`).toBeLessThanOrEqual(MAX_ULPS_AT_SOURCE);
        expect(worst.derived.ulps, `${label}: ${describeDelta(worst.derived)}`).toBeLessThanOrEqual(MAX_ULPS_DERIVED);
      }
    }, 60_000);
  }

  it('the plan path is exact whenever the control shows no addition-order effect', () => {
    // The tolerance above is justified only by the control demonstrating the
    // phenomenon without plans. Where it does not, the plan path has no
    // excuse: it must match to the bit.
    const controlMax = Math.max(0, ...observed.control.flatMap((w) => [w.source.ulps, w.derived.ulps]));
    const planMax = Math.max(0, ...observed.plan.flatMap((w) => [w.source.ulps, w.derived.ulps]));
    expect(observed.control).toHaveLength(RUNS);
    if (controlMax === 0) expect(planMax).toBe(0);
  });
});
