import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { RATING } from '../../core/config/constants';
import { addDays } from '../../core/dates';
import { closeDatabase, deleteDatabase } from '../db';
import { questionsRepository } from '../repositories';
import { loadBossProgression } from './bossService';
import { importBackup } from './backupService';
import { logSession, saveAnswer } from './checkInService';
import { applyOnboarding } from './configurationService';
import { enableLegacyFood, rateLegacyFood } from './fixtures/legacyFood';
import { loadProgression } from './ratingService';

/**
 * The approved general cooling-off model (D72), where it applies and where it
 * emphatically does not.
 *
 * The scope rule the decision states: the general formula governs any
 * domain-and-era segment that has no approved domain-specific decay model of
 * its own. So Wellbeing and Food are general; Gym and Running under the
 * performance model are their own; and a *historical* Gym or Running day is
 * scored by whatever was in force on that day, which for the pre-model era is
 * the general formula.
 *
 * Above all: no day may ever be charged by both (D96).
 */

const fixture = (name: string) =>
  readFileSync(new URL(`../../../.github/fixtures/${name}`, import.meta.url), 'utf8');

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

/** A Monday. */
const START = '2026-01-05';
/** Six weeks of everything, then five weeks of silence. */
const ACTIVE_DAYS = 42;
const REFERENCE = addDays(START, ACTIVE_DAYS + 35);

beforeEach(async () => {
  await deleteDatabase();
  freezeAt(START);
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

interface Setup {
  wellbeing?: boolean;
  food?: boolean;
  gym?: boolean;
  running?: boolean;
}

/** Builds a profile that is diligent for six weeks and then goes quiet. */
async function activeThenSilent(setup: Setup) {
  await applyOnboarding({
    questions: setup.wellbeing
      ? [{ text: 'A', type: 'boolean', category: 'eigene' }]
      : [],
    ...(setup.gym ? { gymTargetPerWeek: 2 } : {}),
    ...(setup.running ? { runningTargetPerWeek: 2 } : {}),
  });
  // Food's days replay by the general formula (D113); it left the product in
  // WP3 Stage 4 (D139), so its history is seeded as the old build stored it.
  if (setup.food) await enableLegacyFood(START);
  const questions = await questionsRepository.listActive();
  for (let index = 0; index < ACTIVE_DAYS; index += 1) {
    const date = addDays(START, index);
    freezeAt(date);
    for (const question of questions) await saveAnswer(date, question.id, true, date);
    if (setup.food) await rateLegacyFood(date, 8);
    if (setup.gym && (index % 7 === 0 || index % 7 === 3)) {
      await logSession('gym', date, {}, date);
    }
    if (setup.running && (index % 7 === 1 || index % 7 === 4)) {
      await logSession('running', date, { distanceMetres: 5000, durationMinutes: 27 }, date);
    }
  }
  freezeAt(REFERENCE);
  return loadBossProgression(REFERENCE);
}

const ledgerOf = (boss: Awaited<ReturnType<typeof loadBossProgression>>, domain: string) =>
  boss.domains.find((entry) => entry.domain === domain)!;

/** Every decay charge a ledger booked, in order. */
const chargesOf = (boss: Awaited<ReturnType<typeof loadBossProgression>>, domain: string) =>
  ledgerOf(boss, domain).points.map((point) => point.decay).filter((value) => value > 0);

/* ── Scope: the general model governs Wellbeing and Food ────────────────── */

describe('Wellbeing follows the approved general formula', () => {
  it('grants two grace days, then 1.5, then 3, capped at 60', async () => {
    const boss = await activeThenSilent({ wellbeing: true });
    const charges = chargesOf(boss, 'mental');
    expect(charges.slice(0, 5)).toEqual([1.5, 1.5, 1.5, 1.5, 1.5]);
    expect(charges.slice(5, 8)).toEqual([3, 3, 3]);
    expect(charges.reduce((sum, value) => sum + value, 0)).toBe(RATING.DECAY.MAX_PER_EPISODE);
  });
});

describe('Food follows the approved general formula', () => {
  it('decays on the same schedule, and by nothing else', async () => {
    const boss = await activeThenSilent({ food: true });
    const charges = chargesOf(boss, 'food');
    expect(charges.slice(0, 5)).toEqual([1.5, 1.5, 1.5, 1.5, 1.5]);
    expect(charges.slice(5, 8)).toEqual([3, 3, 3]);
    expect(charges.reduce((sum, value) => sum + value, 0)).toBe(RATING.DECAY.MAX_PER_EPISODE);
  });

  it('is not the training model D107 forbids it', async () => {
    const boss = await activeThenSilent({ food: true });
    // The training rule decays a *fraction of rank progress* in weekly
    // blocks; the general one removes fixed points a day. A Food day is
    // charged the general amounts above, and Food has no abstinence episode,
    // no Endurance Phase and no rank-progress fraction anywhere.
    const food = ledgerOf(boss, 'food');
    expect(food.points.every((point) => point.decay === 0 || [1.5, 3].includes(point.decay))).toBe(
      true,
    );
    expect(boss.gym.abstinence).not.toBeUndefined();
    expect((food as unknown as { abstinence?: unknown }).abstinence).toBeUndefined();
  });

  it('never turns an unrecorded day into a zero score', async () => {
    const boss = await activeThenSilent({ food: true });
    const food = ledgerOf(boss, 'food');
    // Silence costs the schedule and nothing more. A zero fed into the fold
    // would have cost far more than 60 points from a settled rating.
    const settled = Math.max(...food.points.map((point) => point.rating));
    expect(settled - food.momentum).toBeCloseTo(RATING.DECAY.MAX_PER_EPISODE, 6);
    expect(food.momentum).toBeGreaterThan(settled * 0.8);
  });
});

/* ── Isolation: never both models on one day ────────────────────────────── */

describe('a current-era training day is never charged twice', () => {
  it('books no general cooling-off against Gym', async () => {
    const boss = await activeThenSilent({ gym: true });
    // Gym's rating comes from computeTrainingRating, which never calls the
    // general model. Its abstinence rule is what handles the silence.
    expect(chargesOf(boss, 'gym')).toEqual([]);
    expect(boss.gym.abstinence).not.toBeNull();
    expect(boss.gym.decayFraction).toBeGreaterThan(0);
  });

  it('books no general cooling-off against Running', async () => {
    const boss = await activeThenSilent({ running: true });
    expect(chargesOf(boss, 'running')).toEqual([]);
    expect(boss.running.abstinence).not.toBeNull();
    expect(boss.running.decayFraction).toBeGreaterThan(0);
  });

  it('charges each domain by its own rule when all four are on', async () => {
    const boss = await activeThenSilent({
      wellbeing: true,
      food: true,
      gym: true,
      running: true,
    });
    // General for the two daily domains, training for the two weekly ones.
    expect(chargesOf(boss, 'mental').length).toBeGreaterThan(0);
    expect(chargesOf(boss, 'food').length).toBeGreaterThan(0);
    expect(chargesOf(boss, 'gym')).toEqual([]);
    expect(chargesOf(boss, 'running')).toEqual([]);
  });
});

/* ── Nothing monotone is allowed to fall ────────────────────────────────── */

describe('what cooling-off can never take away', () => {
  it('leaves peak rating, peak rank and lifetime XP where they were', async () => {
    const boss = await activeThenSilent({ wellbeing: true, food: true, gym: true });

    for (const domain of ['mental', 'food', 'gym'] as const) {
      const ledger = ledgerOf(boss, domain);
      expect(ledger.peakMomentum).toBeGreaterThanOrEqual(ledger.momentum);
    }

    // And the lifetime total is monotone across the silence: it is a count of
    // what was done, and nothing undoes it.
    const progression = await loadProgression(REFERENCE);
    freezeAt(addDays(START, ACTIVE_DAYS - 1));
    const atPeak = await loadProgression(addDays(START, ACTIVE_DAYS - 1));
    expect(progression.lifetimeXp).toBeGreaterThanOrEqual(atPeak.lifetimeXp);
    expect(progression.peak).toBeGreaterThanOrEqual(atPeak.peak);
    expect(progression.peakRank.index).toBeGreaterThanOrEqual(atPeak.peakRank.index);
  });
});

/* ── Historical replay is not renegotiated by centralising the code ─────── */

describe('a day already lived keeps the rules of its own day', () => {
  it('replays the RC2 fixtures to fixed numbers', async () => {
    /*
     * These are the numbers the accepted baseline produced. They are pinned
     * as literals because the whole promise of closing D72 was that ratifying
     * a formula already in force moves nothing: if centralising the
     * implementation changed one of them, approving the decision would have
     * been a silent rescoring of everybody's history.
     */
    freezeAt('2026-09-01');
    const imported = await importBackup(fixture('rc2-synthetic.json'));
    expect(imported.ok).toBe(true);

    const progression = await loadProgression('2026-09-01');
    expect(Number(progression.current.toFixed(6))).toBe(732.534291);
    expect(Number(progression.peak.toFixed(6))).toBe(749.502361);
    expect(progression.rank.id).toBe('master');
    expect(progression.lifetimeXp).toBe(4640);

    const boss = await loadBossProgression('2026-09-01');
    expect(Number(boss.progress.toFixed(6))).toBe(5.250264);
    expect(boss.rank.id).toBe('master');
  });

  it('scores the pre-model Gym era by the general formula, as that era did', async () => {
    // A migrated profile whose Gym days predate `gymModel`: those days were
    // folded by computeRating and must still be, or an upgrade would rewrite
    // training history that was already scored.
    freezeAt('2026-09-01');
    const imported = await importBackup(fixture('rc2-synthetic.json'));
    expect(imported.ok).toBe(true);

    const boss = await loadBossProgression('2026-09-01');
    expect(boss.gym.model).toBe('attendance');
    // The legacy prefix is the general fold, so any decay it booked is the
    // approved schedule's amounts and never a rank-progress fraction.
    const charges = chargesOf(boss, 'gym');
    expect(charges.every((value) => value === 1.5 || value === 3)).toBe(true);
  });
});
