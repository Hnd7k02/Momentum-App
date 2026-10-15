import 'fake-indexeddb/auto';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { addDays, type DateKey } from '../../core/dates';
import { closeDatabase, deleteDatabase } from '../db';
import { importBackup } from './backupService';
import { loadBossProgression, type BossProgression } from './bossService';
import { loadGymHistory, type GymHistory } from './gymService';
import { percentChange } from '../../core/gym/performance';
import { muscleStateOf } from '../../features/gym/GymProgress';
import { LAST, at, currentProfile } from './fixtures/profiles';

/**
 * The regression boundary for presentation work.
 *
 * The domain terminal, the charts and the widget boards are layout. This
 * file is what makes that claim checkable: every number the layers above
 * could show — the Boss series, each domain's ledger and series, the Gym and
 * Running rating states, every day's score, every question's row — is
 * serialised from three profiles at a fixed clock and hashed. The hashes
 * were captured **before** the terminal existed. A presentation change that
 * moves one of them has changed a domain output, and is a regression unless
 * approved on its own.
 *
 * Re-pinned once, in Stage 2 of the Overall-rank update (commit 3), when the
 * domain rank, peak rank, rank changes and per-domain XP left the ledger and
 * therefore this serialisation. Every value that remained was proved
 * unchanged by the value-level baseline in `stage2Baseline.test.ts` before
 * the hashes below were updated.
 *
 * Three profiles, because each covers what the others cannot: the real RC2
 * export (one day, real shapes), the synthetic RC2 history (120 legacy days
 * through the era transition), and a four-domain profile under the current
 * scoring models with gym sets, timed runs and food ratings, so the
 * performance model, the bands and the daily Food fold are all inside the
 * hash.
 */

const fixture = (name: string) =>
  readFileSync(new URL(`../../../.github/fixtures/${name}`, import.meta.url), 'utf8');

/** Every number the presentation layer could ever show, in one object. */
function outputsOf(boss: BossProgression) {
  const round = (value: number | null) => (value === null ? null : Math.round(value * 1e9) / 1e9);
  return {
    era: boss.era,
    origin: boss.origin,
    rank: boss.rank.id,
    peakRank: boss.peakRank.id,
    progress: round(boss.progress),
    lifetimeXp: boss.lifetimeXp,
    points: boss.points.map((p) => [round(p.progress), round(p.rating), round(p.movement)]),
    changes: boss.changes.map((c) => [c.date, c.kind, c.to]),
    domains: boss.domains.map((d) => ({
      domain: d.domain, momentum: round(d.momentum), peakMomentum: round(d.peakMomentum),
      progress: round(d.progress), started: d.started, series: d.series.map(round), active: d.active,
    })),
    gym: {
      rating: round(boss.gym.rating), sessionsThisWeek: boss.gym.sessionsThisWeek, weeklyTarget: boss.gym.weeklyTarget,
      endurance: { progress: round(boss.gym.endurance.progress), unlocked: boss.gym.endurance.unlocked },
      ytdChange: round(boss.gym.ytdChange), performance: { score: round(boss.gym.performance.score), components: boss.gym.performance.components },
      decayFraction: round(boss.gym.decayFraction), maintenance: boss.gym.maintenance,
      abstinence: boss.gym.abstinence?.days ?? null,
    },
    running: {
      rating: round(boss.running.rating), sessionsThisWeek: boss.running.sessionsThisWeek, weeklyTarget: boss.running.weeklyTarget,
      endurance: { progress: round(boss.running.endurance.progress), unlocked: boss.running.endurance.unlocked },
      ytdChange: round(boss.running.ytdChange), performance: { score: round(boss.running.performance.score), components: boss.running.performance.components },
      decayFraction: round(boss.running.decayFraction), maintenance: boss.running.maintenance,
      abstinence: boss.running.abstinence?.days ?? null,
      attendanceOnlyRuns: boss.running.attendanceOnlyRuns,
    },
    history: {
      days: boss.history.days.map((d) => [d.date, d.status, round(d.score), round(d.recordedScore), d.dueItems, d.answeredItems]),
      overall: boss.history.overall.map(round), mental: boss.history.mental.map(round), gym: boss.history.gym.map(round),
      running: boss.history.running.map(round), food: boss.history.food.map(round), sports: boss.history.sports.map(round),
      paused: boss.history.paused, activity: boss.history.activity,
      questions: boss.history.questions.map((q) => [q.id, q.category, q.status, q.scores.map(round)]),
      weeks: boss.history.weeks.map((w) => [w.weekKey, w.target, w.sessions, w.met, w.domains.map((d) => [d.domain, d.target, d.sessions, d.met])]),
    },
    legacy: boss.legacy.points.map((p) => round(p.rating)),
  };
}

/**
 * The golden baseline (WP3, frozen on e30becd).
 *
 * Every serialised output is compared, value by value, with the files in
 * `.github/fixtures/wp3-golden/`. The hashes below say *whether* anything
 * moved; this says *what* moved, so a failure names the value and its path.
 * The files are re-frozen only as a deliberate commit at a stage's STOP,
 * with the moved values summarised in that stage's report:
 *
 *   WP3_GOLDEN_DIR=.github/fixtures/wp3-golden npx vitest run src/storage/services/domainOutputs.test.ts
 *
 * Setting `WP3_GOLDEN_DIR` writes the current outputs there instead of
 * comparing, so the command above re-freezes and `git diff` shows the moves.
 */
const GOLDEN_DIR = new URL('../../../.github/fixtures/wp3-golden/', import.meta.url);

function goldenSlug(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

/**
 * JSON writes NaN and ±Infinity as `null`, which would let a figure that
 * became NaN pass against a baseline that froze a genuine `null`. Non-finite
 * numbers are therefore spelled out; the frozen files hold none, so they read
 * exactly as they were written.
 */
const spellNonFinite = (_key: string, value: unknown): unknown =>
  typeof value === 'number' && !Number.isFinite(value) ? `<${String(value)}>` : value;

function checkGolden(name: string, kind: 'boss' | 'gym', value: unknown): void {
  const dir = process.env.WP3_GOLDEN_DIR;
  const file = `${goldenSlug(name)}.${kind}.json`;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${file}`, JSON.stringify(value, spellNonFinite, 1) + '\n');
    return;
  }
  const frozen = JSON.parse(readFileSync(new URL(file, GOLDEN_DIR), 'utf8')) as unknown;
  // Round-tripped through JSON so `undefined` and key order read as the file does.
  expect(JSON.parse(JSON.stringify(value, spellNonFinite)), `${file} against the frozen baseline`).toEqual(frozen);
}

async function fingerprint(name = ''): Promise<{ md5: string; values: number }> {
  const boss = await loadBossProgression();
  const outputs = outputsOf(boss);
  checkGolden(name, 'boss', outputs);
  const json = JSON.stringify(outputs);
  return { md5: createHash('md5').update(json).digest('hex'), values: (json.match(/-?\d/g) ?? []).length };
}

/**
 * Everything the Gym workspace draws below the rating: the exercise-days,
 * the latest comparison per exercise, and both performance windows down to
 * every muscle group's status, ratio, counts and latest score — plus the two
 * presentation reductions the body map consumes, `muscleStateOf()` and
 * `percentChange()`, so the five-state mapping is inside the hash too.
 */
function gymOutputsOf(history: GymHistory) {
  const round = (value: number | null) => (value === null ? null : Math.round(value * 1e9) / 1e9);
  const performance = (p: GymHistory['overall']) => ({
    ratio: round(p.ratio),
    muscles: p.muscles.map((m) => [
      m.muscle, m.status, round(m.ratio), m.exercises, m.compared, round(m.latestScore),
      muscleStateOf(m), round(percentChange(m.ratio)),
    ]),
    measured: p.measured, awaitingBaseline: p.awaitingBaseline, untrained: p.untrained,
  });
  return {
    days: history.days.map((d) => [d.date, d.exerciseId, d.muscles, d.primaryMuscles ?? null, round(d.best.score), d.best.set]),
    comparisons: [...history.comparisons.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, c]) => [id, c.date, c.kind, round(c.current), round(c.previous), c.previousDate, round(c.ratio), round(c.delta)]),
    recent: performance(history.recent),
    overall: performance(history.overall),
    names: [...history.names.entries()].sort(([a], [b]) => a.localeCompare(b)),
    awaitingBodyweight: history.awaitingBodyweight,
  };
}

/** The windows the workspace offers, plus the whole synthetic span. */
const GYM_RANGES = [7, 30, 90] as const;

async function gymFingerprint(clock: DateKey, name = ''): Promise<{ md5: string; values: number }> {
  const outputs: Record<number, unknown> = {};
  for (const range of GYM_RANGES) {
    outputs[range] = gymOutputsOf(await loadGymHistory(addDays(clock, -(range - 1)), clock));
  }
  checkGolden(name, 'gym', outputs);
  const json = JSON.stringify(outputs);
  return { md5: createHash('md5').update(json).digest('hex'), values: (json.match(/-?\d/g) ?? []).length };
}

const PROFILES: { name: string; load(): string; clock: string; md5: string; gym: { md5: string; values: number } }[] = [
  { name: 'the real RC2 export', load: () => fixture('rc2-export.json'), clock: '2026-09-07', md5: '341b51f699f456012e841b5c9fd12506', gym: { md5: '61cc417e7c536cc66684c51e5bf011ce', values: 125 } },
  { name: 'the synthetic RC2 history', load: () => fixture('rc2-synthetic.json'), clock: '2026-08-31', md5: '31b13585fc3363808b315dc612eca9cf', gym: { md5: '61cc417e7c536cc66684c51e5bf011ce', values: 125 } },
  { name: 'a four-domain profile under the current models', load: currentProfile, clock: LAST, md5: '4a3145503723d3fec9761ec62ca8669a', gym: { md5: '58662df205f6d7bb5af3075d040bb0c6', values: 4212 } },
];

describe('domain outputs are the same before and after presentation work', () => {
  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  for (const profile of PROFILES) {
    it(`${profile.name} replays to the pinned fingerprint`, async () => {
      await deleteDatabase();
      setClock({ now: () => at(profile.clock) });
      const result = await importBackup(profile.load());
      if (!result.ok) throw new Error(result.details.join('; '));
      const { md5, values } = await fingerprint(profile.name);
      // Printed so a changed hash comes with the size of what it covers.
      console.log(`fingerprint: ${profile.name}: ${md5} over ${values} values`);
      expect(values).toBeGreaterThan(100);
      expect(md5).toBe(profile.md5);
    });

    /*
     * The Gym history is loaded by the workspace separately from the Boss
     * replay, so it is pinned separately. The RC2 profiles carry no gym
     * sets and pin the empty shape — that is the export-compatibility
     * check — and the four-domain profile is the one with every muscle
     * status, ratio and state inside the hash.
     */
    it(`${profile.name}: the Gym history replays to the pinned fingerprint`, async () => {
      await deleteDatabase();
      setClock({ now: () => at(profile.clock) });
      const result = await importBackup(profile.load());
      if (!result.ok) throw new Error(result.details.join('; '));
      const { md5, values } = await gymFingerprint(profile.clock as DateKey, profile.name);
      console.log(`gym fingerprint: ${profile.name}: ${md5} over ${values} values`);
      expect(values).toBe(profile.gym.values);
      expect(md5).toBe(profile.gym.md5);
    });
  }
});
