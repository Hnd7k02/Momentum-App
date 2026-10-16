import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { EDIT_WINDOW_DAYS } from '../../core/config/constants';
import { addDays } from '../../core/dates';
import type { DomainType } from '../../core/model';
import { closeDatabase, deleteDatabase } from '../db';
import { loadBossProgression, type BossProgression } from './bossService';
import { rankForRating } from '../../core/ranks';
import { logSession, type SessionInput } from './checkInService';
import { applyOnboarding, setBossWeights, type OnboardingSelection } from './configurationService';
import { enableLegacyFood, logLegacyFoodEntry, rateLegacyFood } from './fixtures/legacyFood';

/**
 * Food and the Boss Rank, on the days Food was switched on.
 *
 * The Boss reads a ladder position and knows nothing about how a domain
 * produced it, so the cases below are not about Food's arithmetic — they are
 * about the three properties that adding a fourth domain must not break:
 * an unstarted domain contributes nothing, enabling one creates and destroys
 * no progress, and a weight change applies forward only.
 *
 * Food left the product in WP3 Stage 4 (D139), and these cases stay: every
 * day it was switched on still replays by them. The history is seeded the
 * way the old build left it on disk (`fixtures/legacyFood.ts`), and nothing
 * here switches Food off — the switch-off and the Boss across it are pinned
 * in `foodRetirement.test.ts`.
 */

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

/** A Monday. */
const START = '2026-01-05';
const WEEKS = 8;
const END = addDays(START, WEEKS * 7 - 1);

beforeEach(async () => {
  await deleteDatabase();
  freezeAt(START);
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

async function rate(date: string, adherence: number) {
  freezeAt(date);
  await rateLegacyFood(date, adherence);
}

/** Onboarding as chosen, on a device that also had Food switched on from START. */
async function onboardWithFood(selection: OnboardingSelection) {
  await applyOnboarding(selection);
  await enableLegacyFood(START);
}

async function train(domain: 'gym' | 'running', date: string, input: SessionInput = {}) {
  freezeAt(date);
  await logSession(domain, date, input, date);
}

/** Two gym sessions and two runs a week, over the whole fixture. */
async function trainEveryWeek(domains: readonly ('gym' | 'running')[]) {
  for (let week = 0; week < WEEKS; week += 1) {
    const monday = addDays(START, week * 7);
    for (const offset of [0, 3]) {
      if (domains.includes('gym')) await train('gym', addDays(monday, offset));
      if (domains.includes('running')) {
        await train('running', addDays(monday, offset + 1), {
          distanceMetres: 5000,
          durationMinutes: 27 + week * 0.1,
        });
      }
    }
  }
}

/** A rated food day, every day of the fixture. */
async function rateEveryDay(value = 8) {
  for (let index = 0; index < WEEKS * 7; index += 1) {
    await rate(addDays(START, index), value);
  }
}

/** Today plus the days still inside the edit window — the open tail. */
const EDIT_WINDOW = EDIT_WINDOW_DAYS + 1;

/** Everything before the open tail: the days that are settled for good. */
const closedPrefix = <T>(values: readonly T[]): T[] => values.slice(0, -EDIT_WINDOW);

const load = async (reference = END): Promise<BossProgression> => {
  freezeAt(reference);
  return loadBossProgression(reference);
};

const domainOf = (boss: BossProgression, domain: DomainType) =>
  boss.domains.find((entry) => entry.domain === domain)!;

const contributions = (boss: BossProgression) => {
  const last = boss.points[boss.points.length - 1]!;
  return new Map(last.contributions.map((entry) => [entry.domain, entry.weight]));
};

/* ── An enabled but unused domain ───────────────────────────────────────── */

describe('Food switched on and never rated', () => {
  it('contributes nothing, and its weight leaves the denominator with it', async () => {
    await onboardWithFood({ questions: [], gymTargetPerWeek: 2 });
    await trainEveryWeek(['gym']);

    const boss = await load();
    expect(domainOf(boss, 'food').started).toBe(false);
    const shares = contributions(boss);
    expect(shares.has('food')).toBe(false);
    // Gym carries the whole Boss, rather than being halved by an empty area.
    expect(shares.get('gym')).toBeCloseTo(1, 10);
  });

  it('is not a zero: every closed day matches a profile that never enabled Food', async () => {
    const run = async (food: boolean) => {
      await deleteDatabase();
      freezeAt(START);
      await applyOnboarding({ questions: [], gymTargetPerWeek: 2 });
      if (food) await enableLegacyFood(START);
      await trainEveryWeek(['gym']);
      return load();
    };

    const withFood = await run(true);
    const without = await run(false);

    // Bit-for-bit over every day that is closed. The tail is the edit window,
    // which the next case is about.
    expect(closedPrefix(withFood.points.map((point) => point.progress))).toEqual(
      closedPrefix(without.points.map((point) => point.progress)),
    );
    expect(closedPrefix(domainOf(withFood, 'gym').series)).toEqual(
      closedPrefix(domainOf(without, 'gym').series),
    );
  });

  it('leaves the day open while it can still be rated, as an unanswered question does', async () => {
    // Not a Food rule and not a leak: a day with something still answerable
    // is open for *every* domain, which is how Wellbeing has always behaved.
    // Postponing a day can only ever delay it counting, never cost anything,
    // and it resolves the moment the day is rated or closes.
    await onboardWithFood({ questions: [], gymTargetPerWeek: 2 });
    await trainEveryWeek(['gym']);

    const boss = await load();
    const tail = boss.history.days.slice(-EDIT_WINDOW);
    expect(tail.every((day) => day.status === 'open')).toBe(true);
    expect(boss.history.days.slice(0, -EDIT_WINDOW).every((day) => day.status === 'scored')).toBe(
      true,
    );

    // Rating those days closes them again for everyone.
    for (const day of tail) await rate(day.date, 7);
    const settled = await load();
    expect(settled.history.days.every((day) => day.status === 'scored')).toBe(true);
  });
});

/* ── Food alone ─────────────────────────────────────────────────────────── */

describe('Food as the only domain', () => {
  it('drives the Boss on its own', async () => {
    await onboardWithFood({ questions: [] });
    await rateEveryDay(9);

    const boss = await load();
    const food = domainOf(boss, 'food');
    expect(food.started).toBe(true);
    expect(contributions(boss).get('food')).toBeCloseTo(1, 10);
    expect(boss.progress).toBeGreaterThan(0);
  });

  it('falls when the days are bad and rises when they are good', async () => {
    await onboardWithFood({ questions: [] });
    for (let index = 0; index < WEEKS * 7; index += 1) {
      await rate(addDays(START, index), index < (WEEKS * 7) / 2 ? 9 : 2);
    }
    const boss = await load();
    const points = boss.points;
    const half = Math.floor(points.length / 2);
    expect(points[half]!.progress).toBeGreaterThan(points[points.length - 1]!.progress);
  });
});

/* ── Food beside the training domains ───────────────────────────────────── */

describe('Food alongside training', () => {
  it('shares the Boss equally with Gym by default', async () => {
    await onboardWithFood({ questions: [], gymTargetPerWeek: 2 });
    await trainEveryWeek(['gym']);
    await rateEveryDay();

    const shares = contributions(await load());
    expect(shares.get('food')).toBeCloseTo(0.5, 10);
    expect(shares.get('gym')).toBeCloseTo(0.5, 10);
  });

  it('shares the Boss equally with Running by default', async () => {
    await onboardWithFood({ questions: [], runningTargetPerWeek: 2 });
    await trainEveryWeek(['running']);
    await rateEveryDay();

    const shares = contributions(await load());
    expect(shares.get('food')).toBeCloseTo(0.5, 10);
    expect(shares.get('running')).toBeCloseTo(0.5, 10);
  });

  it('takes a third each beside Gym and Running', async () => {
    await onboardWithFood({ questions: [], gymTargetPerWeek: 2, runningTargetPerWeek: 2 });
    await trainEveryWeek(['gym', 'running']);
    await rateEveryDay();

    const boss = await load();
    const shares = contributions(boss);
    for (const domain of ['gym', 'running', 'food'] as const) {
      expect(shares.get(domain)).toBeCloseTo(1 / 3, 10);
    }
    expect(boss.domains.filter((entry) => entry.started)).toHaveLength(3);
  });
});

/* ── The promise the product owner asked for explicitly ─────────────────── */

describe('adding Food changes nothing about Gym or Running', () => {
  it('leaves both ratings, ranks and peaks bit-for-bit identical', async () => {
    const scenario = async (food: boolean) => {
      await deleteDatabase();
      freezeAt(START);
      await applyOnboarding({ questions: [], gymTargetPerWeek: 2, runningTargetPerWeek: 2 });
      if (food) await enableLegacyFood(START);
      await trainEveryWeek(['gym', 'running']);
      if (food) await rateEveryDay(3);
      const boss = await load();
      return {
        gym: domainOf(boss, 'gym'),
        running: domainOf(boss, 'running'),
        gymState: boss.gym,
        runningState: boss.running,
      };
    };

    const without = await scenario(false);
    const withFood = await scenario(true);

    for (const key of ['gym', 'running'] as const) {
      expect(withFood[key].momentum).toBeCloseTo(without[key].momentum, 10);
      expect(withFood[key].peakMomentum).toBeCloseTo(without[key].peakMomentum, 10);
      expect(withFood[key].series).toEqual(without[key].series);
    }
    // Deliberately a *poor* run of food days above: if Food leaked into the
    // training ratings at all, these would be lower.
    expect(withFood.gymState.rating).toBeCloseTo(without.gymState.rating, 10);
    expect(withFood.runningState.rating).toBeCloseTo(without.runningState.rating, 10);
  });

  it('cannot reach a single day that was lived before it was switched on', async () => {
    const switchOn = addDays(START, 21);

    const run = async (food: boolean) => {
      await deleteDatabase();
      freezeAt(START);
      await applyOnboarding({ questions: [], gymTargetPerWeek: 2 });
      await trainEveryWeek(['gym']);
      if (food) {
        freezeAt(switchOn);
        await enableLegacyFood(switchOn);
        await rate(switchOn, 10);
      }
      return load();
    };

    const withFood = await run(true);
    const without = await run(false);

    const index = withFood.history.days.findIndex((day) => day.date === switchOn);
    expect(index).toBeGreaterThan(0);

    // Every Boss value before the switch-on day is unchanged, to the last bit.
    // An upgrade, or a new area, neither creates progress nor destroys it.
    expect(withFood.points.slice(0, index).map((point) => point.progress)).toEqual(
      without.points.slice(0, index).map((point) => point.progress),
    );
    // And Food appears in the weighting only from that day.
    expect(
      withFood.points
        .slice(0, index)
        .every((point) => !point.contributions.some((entry) => entry.domain === 'food')),
    ).toBe(true);
    expect(
      withFood.points[index]!.contributions.some((entry) => entry.domain === 'food'),
    ).toBe(true);
  });
});

/* ── Weights ────────────────────────────────────────────────────────────── */

describe('weighting Food', () => {
  it('honours unequal weights', async () => {
    await onboardWithFood({ questions: [], gymTargetPerWeek: 2 });
    freezeAt(START);
    await setBossWeights({ gym: 3, food: 1 });
    await trainEveryWeek(['gym']);
    await rateEveryDay();

    const shares = contributions(await load());
    expect(shares.get('gym')).toBeCloseTo(0.75, 10);
    expect(shares.get('food')).toBeCloseTo(0.25, 10);
  });

  it('applies a weight change forward only, never to a day already lived', async () => {
    await onboardWithFood({ questions: [], gymTargetPerWeek: 2 });
    await trainEveryWeek(['gym']);
    await rateEveryDay();

    const before = await load();
    const midpoint = Math.floor(before.points.length / 2);
    const historicalProgress = before.points[midpoint]!.progress;
    const historicalShares = before.points[midpoint]!.contributions.map((entry) => ({
      domain: entry.domain,
      weight: entry.weight,
    }));

    // Long after those days were lived.
    freezeAt(END);
    await setBossWeights({ gym: 9, food: 1 });
    const after = await load();

    expect(after.points[midpoint]!.progress).toBeCloseTo(historicalProgress, 10);
    expect(
      after.points[midpoint]!.contributions.map((entry) => ({
        domain: entry.domain,
        weight: entry.weight,
      })),
    ).toEqual(historicalShares);
    // And today does move.
    expect(contributions(after).get('gym')).toBeCloseTo(0.9, 10);
  });

  it('never lets a domain be weighted out of existence without switching it off', async () => {
    await onboardWithFood({ questions: [], gymTargetPerWeek: 2 });
    freezeAt(START);
    await setBossWeights({ gym: 1000, food: 0.0001 });
    await trainEveryWeek(['gym']);
    await rateEveryDay();

    const share = contributions(await load()).get('food') ?? 0;
    expect(share).toBeGreaterThan(0);
  });
});

/* ── D110: contribution is normalized performance, never event count ────── */

describe('what the Boss actually averages', () => {
  it('averages ladder positions, never events', async () => {
    await onboardWithFood({ questions: [], gymTargetPerWeek: 2 });
    await trainEveryWeek(['gym']);
    await rateEveryDay();

    const boss = await load();
    const last = boss.points[boss.points.length - 1]!;
    for (const entry of last.contributions) {
      const ledger = domainOf(boss, entry.domain);
      // The contribution *is* the domain's position on the shared 0–8 ladder.
      // Nothing counts sessions, runs, ratings or food rows.
      expect(entry.progress).toBeCloseTo(ledger.series[ledger.series.length - 1]!, 10);
      expect(entry.progress).toBeGreaterThanOrEqual(0);
      expect(entry.progress).toBeLessThanOrEqual(8);
    }
  });

  it('is unmoved by training beyond the weekly target', async () => {
    const run = async (perWeek: number) => {
      await deleteDatabase();
      freezeAt(START);
      await applyOnboarding({ questions: [], gymTargetPerWeek: 2 });
      for (let week = 0; week < WEEKS; week += 1) {
        const monday = addDays(START, week * 7);
        for (let index = 0; index < perWeek; index += 1) {
          await train('gym', addDays(monday, index));
        }
      }
      return load();
    };

    const met = await run(2);
    const doubled = await run(4);

    // Four sessions against a target of two is the same attendance as two.
    // Extra events buy no Boss progress, which is what stops a domain
    // dominating by being logged more often.
    expect(domainOf(doubled, 'gym').series).toEqual(domainOf(met, 'gym').series);
    expect(doubled.points.map((point) => point.progress)).toEqual(
      met.points.map((point) => point.progress),
    );
  });

  it('is unmoved by how many things were logged on a rated Food day', async () => {
    const run = async (entriesPerDay: number) => {
      await deleteDatabase();
      freezeAt(START);
      await onboardWithFood({ questions: [] });
      for (let index = 0; index < WEEKS * 7; index += 1) {
        const date = addDays(START, index);
        freezeAt(date);
        for (let n = 0; n < entriesPerDay; n += 1) {
          await logLegacyFoodEntry(date, { label: `Mahlzeit ${n}`, kcal: 400 });
        }
        await rateLegacyFood(date, 8);
      }
      return load();
    };

    const sparse = await run(1);
    const busy = await run(6);

    // Six meals is not six times the day. The rating is the whole of it.
    expect(domainOf(busy, 'food').series).toEqual(domainOf(sparse, 'food').series);
    expect(busy.points.map((point) => point.progress)).toEqual(
      sparse.points.map((point) => point.progress),
    );
  });

  it('gives a daily domain and a weekly one equal shares at equal performance', async () => {
    // Food is answered 56 times over the fixture and Gym is trained 16 times.
    // Both are performing perfectly against their own expectations, so the
    // Boss must weigh them equally rather than by how often they were logged.
    await onboardWithFood({ questions: [], gymTargetPerWeek: 2 });
    await trainEveryWeek(['gym']);
    await rateEveryDay(10);

    const shares = contributions(await load());
    expect(shares.get('food')).toBeCloseTo(0.5, 10);
    expect(shares.get('gym')).toBeCloseTo(0.5, 10);
  });

  it('keeps lifetime XP out of the Boss rank entirely', async () => {
    await onboardWithFood({ questions: [], gymTargetPerWeek: 2 });
    await trainEveryWeek(['gym']);
    await rateEveryDay();

    const boss = await load();
    // XP answers "how much have I done" and is reported beside the Boss, not
    // inside it: the rank comes from the ladder series alone. If XP ever
    // entered the rank, this rating would not be reproducible from the
    // points.
    const last = boss.points[boss.points.length - 1]!;
    expect(boss.progress).toBeCloseTo(last.progress, 10);
    expect(boss.rank.id).toBe(rankForRating(last.rating).id);
    expect(boss.lifetimeXp).toBeGreaterThan(0);
  });
});
