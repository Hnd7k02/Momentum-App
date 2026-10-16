import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { PAUSE, RATING, TRAINING_RATING } from '../../core/config/constants';
import { addDays } from '../../core/dates';
import { closeDatabase, deleteDatabase } from '../db';
import { pausePeriodsRepository, questionsRepository, restDaysRepository } from '../repositories';
import { loadBossProgression } from './bossService';
import { loadDay, logSession, saveAdherence, saveAnswer } from './checkInService';
import { applyOnboarding } from './configurationService';
import { loadHistory } from './historyService';
import {
  createPause,
  deletePause,
  endPauseEarly,
  loadPauses,
  PauseError,
  updatePause,
} from './pauseService';
import { loadProgression } from './ratingService';

/**
 * Pause periods end to end.
 *
 * One sentence governs every case below: a pause suspends the *penalty for
 * absence* and nothing else. It creates no activity, keeps no streak alive,
 * credits no attendance, withholds no XP, resets no episode and rewrites no
 * day that has already been lived.
 */

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

/** A Monday. */
const START = '2026-01-05';
/** Six weeks of diligence before anything interesting happens. */
const ACTIVE = 42;

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

async function buildActive(setup: Setup) {
  await applyOnboarding({
    questions: setup.wellbeing ? [{ text: 'A', type: 'boolean', category: 'eigene' }] : [],
    ...(setup.gym ? { gymTargetPerWeek: 2 } : {}),
    ...(setup.running ? { runningTargetPerWeek: 2 } : {}),
    ...(setup.food ? { food: true } : {}),
  });
  const questions = await questionsRepository.listActive();
  for (let index = 0; index < ACTIVE; index += 1) {
    const date = addDays(START, index);
    freezeAt(date);
    for (const question of questions) await saveAnswer(date, question.id, true, date);
    if (setup.food) await saveAdherence(date, 8, null, date);
    if (setup.gym && (index % 7 === 0 || index % 7 === 3)) await logSession('gym', date, {}, date);
    if (setup.running && (index % 7 === 1 || index % 7 === 4)) {
      await logSession('running', date, { distanceMetres: 5000, durationMinutes: 27 }, date);
    }
  }
}

/** Declares a pause as of `on`, which must be today or later. */
async function pauseFrom(on: string, days: number) {
  freezeAt(on);
  return createPause({ from: on, to: addDays(on, days - 1) }, on);
}

const at = async (reference: string) => {
  freezeAt(reference);
  return loadBossProgression(reference);
};

const ledger = (boss: Awaited<ReturnType<typeof loadBossProgression>>, domain: string) =>
  boss.domains.find((entry) => entry.domain === domain)!;

const charges = (boss: Awaited<ReturnType<typeof loadBossProgression>>, domain: string) =>
  ledger(boss, domain).points.map((point) => point.decay).filter((value) => value > 0);

/* ── Creation and validation, through the service ───────────────────────── */

describe('declaring a pause', () => {
  beforeEach(async () => {
    await applyOnboarding({ questions: [{ text: 'A', type: 'boolean', category: 'eigene' }] });
  });

  it('can begin today', async () => {
    freezeAt(START);
    const record = await createPause({ from: START, to: addDays(START, 6) }, START);
    expect(record.from).toBe(START);
    expect((await loadPauses(START)).pausedToday).toBe(true);
  });

  it('can begin in the future, and is not active yet', async () => {
    freezeAt(START);
    await createPause({ from: addDays(START, 10), to: addDays(START, 15) }, START);
    const overview = await loadPauses(START);
    expect(overview.pausedToday).toBe(false);
    expect(overview.upcoming).not.toBeNull();
  });

  it('cannot begin in the past', async () => {
    freezeAt(addDays(START, 10));
    await expect(
      createPause({ from: START, to: addDays(START, 5) }, addDays(START, 10)),
    ).rejects.toBeInstanceOf(PauseError);
    expect(await pausePeriodsRepository.getAll()).toHaveLength(0);
  });

  it('requires an end date in the normal product flow', async () => {
    freezeAt(START);
    await expect(createPause({ from: START, to: null }, START)).rejects.toBeInstanceOf(PauseError);
  });

  it('accepts 28 days and rejects 29', async () => {
    freezeAt(START);
    await createPause({ from: START, to: addDays(START, PAUSE.MAX_DAYS - 1) }, START);
    await expect(
      createPause(
        { from: addDays(START, 40), to: addDays(START, 40 + PAUSE.MAX_DAYS) },
        START,
      ),
    ).rejects.toBeInstanceOf(PauseError);
    expect(await pausePeriodsRepository.getAll()).toHaveLength(1);
  });

  it('rejects an overlapping pause', async () => {
    freezeAt(START);
    await createPause({ from: addDays(START, 5), to: addDays(START, 10) }, START);
    await expect(
      createPause({ from: addDays(START, 8), to: addDays(START, 12) }, START),
    ).rejects.toBeInstanceOf(PauseError);
    expect(await pausePeriodsRepository.getAll()).toHaveLength(1);
  });

  it('lets a future pause be edited and deleted', async () => {
    freezeAt(START);
    const record = await createPause({ from: addDays(START, 10), to: addDays(START, 15) }, START);
    const moved = await updatePause(
      record.id,
      { from: addDays(START, 12), to: addDays(START, 14), reason: 'Ferien' },
      START,
    );
    expect(moved.from).toBe(addDays(START, 12));
    expect(moved.reason).toBe('Ferien');
    await deletePause(record.id, START);
    expect(await pausePeriodsRepository.getAll()).toHaveLength(0);
  });

  it('refuses to move or delete a pause that has begun', async () => {
    freezeAt(START);
    const record = await createPause({ from: START, to: addDays(START, 10) }, START);
    const later = addDays(START, 3);
    freezeAt(later);
    await expect(
      updatePause(record.id, { from: later, to: addDays(later, 2) }, later),
    ).rejects.toBeInstanceOf(PauseError);
    await expect(deletePause(record.id, later)).rejects.toBeInstanceOf(PauseError);
    expect((await pausePeriodsRepository.getAll())[0]!.from).toBe(START);
  });

  it('ends a running pause early, from today and never earlier', async () => {
    freezeAt(START);
    const record = await createPause({ from: START, to: addDays(START, 20) }, START);
    const later = addDays(START, 5);
    freezeAt(later);
    await expect(
      endPauseEarly(record.id, addDays(START, 2), later),
    ).rejects.toBeInstanceOf(PauseError);
    const ended = await endPauseEarly(record.id, later, later);
    expect(ended.to).toBe(later);
  });
});

/* ── The general cooling-off model ──────────────────────────────────────── */

describe('a pause and the general model', () => {
  it('costs a Wellbeing day nothing while paused', async () => {
    await buildActive({ wellbeing: true });
    const silenceStarts = addDays(START, ACTIVE);
    await pauseFrom(silenceStarts, 21);

    const boss = await at(addDays(START, ACTIVE + 20));
    expect(charges(boss, 'mental')).toEqual([]);
  });

  it('costs a Food day nothing while paused', async () => {
    await buildActive({ food: true });
    const silenceStarts = addDays(START, ACTIVE);
    await pauseFrom(silenceStarts, 21);

    const boss = await at(addDays(START, ACTIVE + 20));
    expect(charges(boss, 'food')).toEqual([]);
  });

  it('freezes the clock rather than resetting it, and resumes where it left off', async () => {
    await buildActive({ wellbeing: true });
    /*
     * Five silent days, a fortnight paused, then silence again. The first day
     * after the pause is the sixth of the episode — 1.5, not 0. If the pause
     * reset the clock it would be day 1 and cost nothing, which would make a
     * one-day pause a reset button held just short of every threshold.
     */
    const silenceStarts = addDays(START, ACTIVE);
    await pauseFrom(addDays(silenceStarts, 5), 14);

    const boss = await at(addDays(silenceStarts, 30));
    const booked = charges(boss, 'mental');
    // Days 1-2 grace, days 3-5 at 1.5, then fourteen paused days costing
    // nothing, then days 6 and 7 at 1.5 and day 8 onwards at 3.
    expect(booked.slice(0, 3)).toEqual([1.5, 1.5, 1.5]);
    expect(booked.slice(3, 5)).toEqual([1.5, 1.5]);
    expect(booked.slice(5, 7)).toEqual([3, 3]);
  });

  it('does not let the paused stretch add to the episode total', async () => {
    await buildActive({ wellbeing: true });
    const silenceStarts = addDays(START, ACTIVE);
    await pauseFrom(addDays(silenceStarts, 5), 14);

    const boss = await at(addDays(silenceStarts, 100));
    const total = charges(boss, 'mental').reduce((sum, value) => sum + value, 0);
    // The cap belongs to the episode, and the pause neither raises nor
    // resets it: one episode still costs at most 60.
    expect(total).toBe(RATING.DECAY.MAX_PER_EPISODE);
  });

  it('scores and rewards a day logged inside a pause exactly as usual', async () => {
    await buildActive({ wellbeing: true, food: true });
    const silenceStarts = addDays(START, ACTIVE);
    await pauseFrom(silenceStarts, 21);

    // A day the user did turn up for, in the middle of the pause.
    const inside = addDays(silenceStarts, 10);
    freezeAt(inside);
    const questions = await questionsRepository.listActive();
    for (const question of questions) await saveAnswer(inside, question.id, true, inside);
    await saveAdherence(inside, 9, null, inside);

    const reference = addDays(silenceStarts, 20);
    const history = await loadHistory(START, reference, reference);
    const day = history.days.find((entry) => entry.date === inside)!;
    expect(day.domains.find((entry) => entry.domain === 'food')?.score).toBe(90);
    expect(day.domains.find((entry) => entry.domain === 'mental')?.score).toBe(100);

    const boss = await at(reference);
    const point = ledger(boss, 'food').points.find((entry) => entry.date === inside)!;
    // A recorded day moves the rating; it is not frozen by the pause.
    expect(point.decay).toBe(0);
    // And the day earned its XP like any other: the Boss total counts it.
    expect(boss.lifetimeXp).toBeGreaterThan(0);
  });
});

/* ── Training ───────────────────────────────────────────────────────────── */

describe('a pause and the training model', () => {
  it('does not advance the Gym abstinence clock, and triggers no decay', async () => {
    await buildActive({ gym: true });
    const silenceStarts = addDays(START, ACTIVE);
    await pauseFrom(silenceStarts, PAUSE.MAX_DAYS);

    const boss = await at(addDays(silenceStarts, PAUSE.MAX_DAYS - 1));
    expect(boss.gym.decayFraction).toBe(0);
    expect(charges(boss, 'gym')).toEqual([]);
  });

  it('does not advance the Running clock either', async () => {
    await buildActive({ running: true });
    const silenceStarts = addDays(START, ACTIVE);
    await pauseFrom(silenceStarts, PAUSE.MAX_DAYS);

    const boss = await at(addDays(silenceStarts, PAUSE.MAX_DAYS - 1));
    expect(boss.running.decayFraction).toBe(0);
    expect(charges(boss, 'running')).toEqual([]);
  });

  it('resumes the Gym clock from its pre-pause count, never from zero', async () => {
    await buildActive({ gym: true });
    const silenceStarts = addDays(START, ACTIVE);
    // Five silent days, then a fortnight paused, then silence again.
    await pauseFrom(addDays(silenceStarts, 5), 14);

    const paused = await at(addDays(silenceStarts, 18));
    expect(paused.gym.decayFraction).toBe(0);

    /*
     * Day 20 of the sequence is the sixth inactive day and day 21 the
     * seventh, which is where the approved model starts to decay. If the
     * pause had reset the clock, decay would still be six days away.
     */
    const resumed = await at(addDays(silenceStarts, 19 + 2));
    expect(resumed.gym.decayFraction).toBeGreaterThan(0);
  });

  it('holds the rating instead of making it worse — the whole point', async () => {
    /*
     * The defect this pins, found by measurement during implementation:
     * suppressing only the abstinence decay made a pause **strictly worse
     * than no pause at all**. The decay branch is rank-floored; the ordinary
     * attendance target is not. So a paused week of zero attendance dragged
     * the rating towards zero (899 → 98) while an unpaused one stopped at
     * the floor (899 → 560). A pause that punishes is not a pause.
     *
     * The fix is not to credit attendance. It is to decline to score a
     * paused week nobody trained in — "no data", exactly as the app already
     * treats a day before the domain existed.
     */
    const run = async (paused: boolean) => {
      await deleteDatabase();
      freezeAt(START);
      await buildActive({ gym: true });
      const silence = addDays(START, ACTIVE);
      if (paused) await pauseFrom(silence, PAUSE.MAX_DAYS);
      return at(addDays(silence, PAUSE.MAX_DAYS - 1));
    };

    const settled = await (async () => {
      await deleteDatabase();
      freezeAt(START);
      await buildActive({ gym: true });
      return at(addDays(START, ACTIVE - 1));
    })();

    const withPause = await run(true);
    const without = await run(false);

    // Held exactly where the last trained week left it.
    expect(withPause.gym.rating).toBeCloseTo(settled.gym.rating, 6);
    // And strictly better than not pausing, which is the minimum a pause owes.
    expect(withPause.gym.rating).toBeGreaterThan(without.gym.rating);
  });

  it('never punishes honest partial effort during a pause', async () => {
    /*
     * The defect this pins, found by measurement during the release pass.
     * Attendance is a measure of the absence a pause exists to excuse, so a
     * paused week with one session of two read as 50 % and pulled the rating
     * down hard: over a 28-day pause from 899.58, logging nothing held
     * 899.58 while logging one session a week gave 520.91 — 378 points and a
     * rank for turning up. That is D35's rule ("reporting must never cost
     * more than silence") failing inside this feature.
     *
     * The floor is one-sided, so real work still counts.
     */
    const run = async (offsets: readonly number[]) => {
      await deleteDatabase();
      freezeAt(START);
      await buildActive({ gym: true });
      const silence = addDays(START, ACTIVE);
      await pauseFrom(silence, PAUSE.MAX_DAYS);
      for (const offset of offsets) {
        const date = addDays(silence, offset);
        freezeAt(date);
        await logSession('gym', date, {}, date);
      }
      return at(addDays(silence, PAUSE.MAX_DAYS - 1));
    };

    const nothing = await run([]);
    const partial = await run([1, 8, 15, 22]);
    const full = await run([1, 4, 8, 11, 15, 18, 22, 25]);

    // Turning up a little costs exactly nothing once a week is judged: the
    // last judged day (Sunday 8 March, judged on the 10th) is identical.
    const judged = (boss: typeof nothing) => boss.gym.points.find((point) => point.date === '2026-03-08')!.rating;
    expect(judged(partial)).toBeCloseTo(judged(nothing), 6);
    // The last week is still in progress on its Sunday, and its target is
    // judged when it is over (D134): until then a session in it counts as
    // met. So turning up never costs, and for now even shows.
    expect(partial.gym.rating).toBeGreaterThanOrEqual(nothing.gym.rating);
    // And turning up properly still climbs — a pause is not a ceiling.
    expect(full.gym.rating).toBeGreaterThan(nothing.gym.rating);
    expect(judged(full)).toBeGreaterThan(judged(nothing));
  });

  it('is not attendance, and is not a saved session', async () => {
    await buildActive({ gym: true });
    const silenceStarts = addDays(START, ACTIVE);
    await pauseFrom(silenceStarts, PAUSE.MAX_DAYS);

    const reference = addDays(silenceStarts, 20);
    const day = await loadDay(reference, reference);
    const gym = day.training.find((entry) => entry.domain === 'gym')!;
    // No fabricated sessions, and the week reads as what it was.
    expect(gym.sessions).toHaveLength(0);
    expect(gym.progress.completed).toBe(0);
    expect(gym.progress.met).toBe(false);

    const history = await loadHistory(START, reference, reference);
    const week = history.weeks[history.weeks.length - 1]!;
    expect(week.domains.find((entry) => entry.domain === 'gym')?.sessions).toBe(0);
  });

  it('still lets a session be logged, scored and counted during a pause', async () => {
    await buildActive({ gym: true });
    const silenceStarts = addDays(START, ACTIVE);
    await pauseFrom(silenceStarts, 21);

    const inside = addDays(silenceStarts, 9);
    freezeAt(inside);
    await logSession('gym', inside, {}, inside);

    const reference = addDays(silenceStarts, 12);
    const day = await loadDay(reference, reference);
    expect(day.training.find((entry) => entry.domain === 'gym')!.sessions).toHaveLength(1);

    const boss = await at(reference);
    // A saved session ends any episode outright, pause or no pause.
    expect(boss.gym.abstinence?.days ?? 0).toBeLessThan(TRAINING_RATING.ABSTINENCE_BLOCK_DAYS);
  });

  it('never charges a day by both models', async () => {
    await buildActive({ wellbeing: true, food: true, gym: true, running: true });
    const silenceStarts = addDays(START, ACTIVE);
    await pauseFrom(silenceStarts, PAUSE.MAX_DAYS);

    const boss = await at(addDays(silenceStarts, PAUSE.MAX_DAYS - 1));
    // Nothing decays at all while paused, by either mechanism.
    for (const domain of ['mental', 'food', 'gym', 'running'] as const) {
      expect(charges(boss, domain)).toEqual([]);
    }
    expect(boss.gym.decayFraction).toBe(0);
    expect(boss.running.decayFraction).toBe(0);
  });
});

/* ── Streaks, XP, Boss, and what a pause may never rewrite ──────────────── */

describe('what a pause deliberately does not do', () => {
  it('breaks a streak rather than bridging it', async () => {
    await buildActive({ wellbeing: true });
    const silenceStarts = addDays(START, ACTIVE);
    await pauseFrom(silenceStarts, 14);

    const before = await loadProgression(addDays(START, ACTIVE - 1));
    expect(before.checkInStreak.current).toBeGreaterThan(20);

    // One qualifying day after the pause: the streak is 1, not 43.
    const after = addDays(silenceStarts, 14);
    freezeAt(after);
    const questions = await questionsRepository.listActive();
    for (const question of questions) await saveAnswer(after, question.id, true, after);
    const resumed = await loadProgression(after);
    expect(resumed.checkInStreak.current).toBe(1);
  });

  it('creates no XP by itself, and takes none away', async () => {
    await buildActive({ wellbeing: true, gym: true });
    const beforeXp = (await loadProgression(addDays(START, ACTIVE - 1))).lifetimeXp;

    const silenceStarts = addDays(START, ACTIVE);
    await pauseFrom(silenceStarts, PAUSE.MAX_DAYS);

    const afterXp = (await loadProgression(addDays(silenceStarts, 20))).lifetimeXp;
    // Monotone: a pause neither manufactures XP nor withholds it.
    expect(afterXp).toBeGreaterThanOrEqual(beforeXp);
  });

  it('leaves peak rating and peak rank monotone', async () => {
    await buildActive({ wellbeing: true, food: true, gym: true });
    const silenceStarts = addDays(START, ACTIVE);
    await pauseFrom(silenceStarts, PAUSE.MAX_DAYS);

    const boss = await at(addDays(silenceStarts, 20));
    for (const domain of ['mental', 'food', 'gym'] as const) {
      const entry = ledger(boss, domain);
      expect(entry.peakMomentum).toBeGreaterThanOrEqual(entry.momentum);
    }
  });

  it('adds no Boss rule of its own — the Boss simply inherits', async () => {
    await buildActive({ wellbeing: true, gym: true });
    const silenceStarts = addDays(START, ACTIVE);
    await pauseFrom(silenceStarts, PAUSE.MAX_DAYS);

    const boss = await at(addDays(silenceStarts, 20));
    const last = boss.points[boss.points.length - 1]!;
    // Contributions are still ladder positions equal to each domain's own
    // series; nothing about a pause is applied to the Boss separately.
    for (const contribution of last.contributions) {
      const entry = ledger(boss, contribution.domain);
      expect(contribution.progress).toBeCloseTo(entry.series[entry.series.length - 1]!, 10);
    }
  });

  it('changes no historical rating when a future pause is created, edited or deleted', async () => {
    await buildActive({ wellbeing: true, food: true, gym: true, running: true });
    const reference = addDays(START, ACTIVE - 1);
    const before = await at(reference);
    const snapshot = before.domains.map((entry) => entry.series.join(','));

    // A pause declared for next month cannot reach a day already lived.
    freezeAt(reference);
    const record = await createPause(
      { from: addDays(reference, 10), to: addDays(reference, 20) },
      reference,
    );
    const withPause = await at(reference);
    expect(withPause.domains.map((entry) => entry.series.join(','))).toEqual(snapshot);

    freezeAt(reference);
    await updatePause(
      record.id,
      { from: addDays(reference, 12), to: addDays(reference, 18) },
      reference,
    );
    expect((await at(reference)).domains.map((entry) => entry.series.join(','))).toEqual(snapshot);

    freezeAt(reference);
    await deletePause(record.id, reference);
    expect((await at(reference)).domains.map((entry) => entry.series.join(','))).toEqual(snapshot);
  });

  it('replays a past paused stretch identically every time', async () => {
    await buildActive({ wellbeing: true, food: true });
    const silenceStarts = addDays(START, ACTIVE);
    await pauseFrom(silenceStarts, 14);

    const reference = addDays(silenceStarts, 40);
    const first = await at(reference);
    const second = await at(reference);
    expect(second.domains.map((entry) => entry.series)).toEqual(
      first.domains.map((entry) => entry.series),
    );
    expect(second.points.map((point) => point.progress)).toEqual(
      first.points.map((point) => point.progress),
    );
  });

  it('creates no rest day, by any flow', async () => {
    await buildActive({ wellbeing: true, gym: true });
    const silenceStarts = addDays(START, ACTIVE);
    const record = await pauseFrom(silenceStarts, 10);
    freezeAt(addDays(silenceStarts, 3));
    await endPauseEarly(record.id, addDays(silenceStarts, 3), addDays(silenceStarts, 3));
    await at(addDays(silenceStarts, 20));

    // Rest days are deprecated as a product concept. Nothing writes one.
    expect(await restDaysRepository.getAll()).toEqual([]);
  });
});
