import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { dayClosed, daySettled, snapshotOn, weekWindows } from '../../core/config/closure';
import { addDays, type DateKey } from '../../core/dates';
import { closeDatabase, deleteDatabase } from '../db';
import { configSnapshotsRepository, questionsRepository } from '../repositories';
import { loadBossProgression, type BossProgression } from './bossService';
import { logSession, saveAdherence, saveAnswer } from './checkInService';
import { applyOnboarding, loadConfiguration, type OnboardingSelection } from './configurationService';

/**
 * No drop at midnight that a backfill then reverses (WP3, P8 — D132–D136).
 *
 * The brief's requirement, per mechanism: a day is charged as missed only
 * once its window has passed — for streaks, cooling-off, abstinence,
 * attendance, and promotion and demotion alike. Each probe below names a day
 * under test and three clocks: `t0` the evening of that day, `t1` the next
 * evening — the day is yesterday, and the backfill is still legal — and `t2`
 * the evening after, when it is not. Every write goes through the real
 * services, so the write rule itself decides what is legal.
 *
 * Three things are checked for every probe:
 *
 * 1. The backfill is accepted at `t1` and refused at `t2`.
 * 2. **Finality.** A day that is closed at `t1` keeps its Wellbeing and Food
 *    values, and a day that is settled at `t1` (closed, and its week judged)
 *    keeps every output — its history row, each domain's series, the Boss,
 *    the Gym and Running folds — in every later replay, backfill or not. A
 *    legal write can only reach days nothing has charged yet.
 * 3. **No disappearing rank change.** A promotion or demotion visible at
 *    `t1` is still there after the backfill and the day after.
 *
 * Each probe adds the check for its own mechanism: what must not move at
 * midnight, and that the charge does land once the window has passed — the
 * rules postpone a charge, they never drop one.
 */

const D0 = '2026-01-05' as DateKey; // a Monday
const D = (i: number) => addDays(D0, i);

function freezeAt(day: string, hour = 20): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

async function fresh(selection: OnboardingSelection): Promise<void> {
  await deleteDatabase();
  freezeAt(D0, 8);
  await applyOnboarding(selection);
  await loadConfiguration();
}

async function gym(day: DateKey): Promise<void> {
  freezeAt(day, 18);
  await logSession('gym', day, {}, day);
}

async function answerDay(day: DateKey, value: number, food = true, reference: DateKey = day): Promise<void> {
  freezeAt(reference, 20);
  for (const question of await questionsRepository.list()) await saveAnswer(day, question.id, value, reference);
  if (food) await saveAdherence(day, 7, null, reference);
}

interface Replay {
  clock: DateKey;
  boss: BossProgression;
}

async function replay(clock: DateKey): Promise<Replay> {
  freezeAt(clock, 21);
  return { clock, boss: await loadBossProgression(clock) };
}

async function attempt(clock: DateKey, write: (reference: DateKey) => Promise<void>): Promise<'accepted' | 'refused'> {
  freezeAt(clock, 20);
  try {
    await write(clock);
    return 'accepted';
  } catch {
    return 'refused';
  }
}

const round = (value: number | null | undefined) =>
  value === null || value === undefined ? null : Math.round(value * 1e9) / 1e9;

/** The days closed and settled at `clock`, read from the stored snapshots. */
async function finalDays(clock: DateKey, dates: readonly DateKey[]) {
  const snapshots = await configSnapshotsRepository.list();
  const weekWindowOf = weekWindows(snapshots);
  const closed = dates.filter(
    (date) => dayClosed(date, clock, snapshotOn(snapshots, date), weekWindowOf(date)) === true,
  );
  const settled = dates.filter(
    (date) => daySettled(date, clock, snapshotOn(snapshots, date), weekWindowOf(date)) === true,
  );
  return { closed, settled };
}

/** What a closed day must keep: its Wellbeing and Food values. */
function dailyOutputs(boss: BossProgression, date: DateKey) {
  const index = boss.history.days.findIndex((day) => day.date === date);
  return ['mental', 'food'].map((name) => round(boss.domains.find((entry) => entry.domain === name)?.series[index]));
}

/** What a settled day must keep: everything. */
function settledOutputs(boss: BossProgression, date: DateKey) {
  const index = boss.history.days.findIndex((day) => day.date === date);
  const row = boss.history.days[index]!;
  return {
    row: [row.status, round(row.score), round(row.recordedScore), row.dueItems, row.answeredItems],
    domains: boss.domains.map((entry) => [entry.domain, round(entry.series[index])]),
    boss: round(boss.points[index]?.rating),
    gym: round(boss.gym.points[index]?.rating),
    running: round(boss.running.points[index]?.rating),
  };
}

const changesOf = (boss: BossProgression) => boss.changes.map((change) => `${change.date} ${change.kind} ${change.to}`);
const pendingOf = (boss: BossProgression) => boss.pending?.eligibleDates ?? [];

interface Probe {
  name: string;
  setup(): Promise<void>;
  day: DateKey;
  t0: DateKey;
  t1: DateKey;
  t2: DateKey;
  backfill(reference: DateKey): Promise<void>;
  /** The probe's own mechanism: what may not move at midnight, and what lands later. */
  check(runs: { t0: Replay; t1: Replay; t1b: Replay; t2: Replay; t2b: Replay }): void;
}

const gymOnly: OnboardingSelection = { questions: [], gymTargetPerWeek: 3 };
const mixed: OnboardingSelection = {
  questions: [
    { text: 'A', type: 'scale', category: 'mental' },
    { text: 'B', type: 'scale', category: 'gesundheit' },
  ],
  gymTargetPerWeek: 3,
  food: true,
};
const mindOnly: OnboardingSelection = { questions: mixed.questions };
const mwf = (week: number) => [D(week * 7), D(week * 7 + 2), D(week * 7 + 4)];
const indexOf = (run: Replay, date: DateKey) => run.boss.history.days.findIndex((day) => day.date === date);

/** Attendance at its target, on the fold's 0–1000 scale. */
const MET = 1000;

/** The week's attendance, as the training fold took it on each of its days. */
const attendanceOn = (run: Replay, dates: readonly DateKey[]) =>
  dates.map((date) => {
    const point = run.boss.gym.detail.find((entry) => entry.date === date);
    return point?.skipped === false ? point.attendance : null;
  });

const PROBES: Probe[] = [
  {
    name: "a Sunday's session logged on Monday, one short of the target",
    async setup() {
      await fresh(gymOnly);
      for (let week = 0; week < 4; week += 1) for (const day of mwf(week)) await gym(day);
      await gym(D(28));
      await gym(D(30));
    },
    day: D(34),
    t0: D(34),
    t1: D(35),
    t2: D(36),
    backfill: (reference) => logSession('gym', D(34), {}, reference).then(() => undefined),
    check({ t0, t1, t2, t2b }) {
      // Monday midnight judges nothing: the week can still take Sunday.
      expect(t1.boss.lifetimeXp).toBe(t0.boss.lifetimeXp);
      expect(t1.boss.legacy.trainingStreak.current).toBe(t0.boss.legacy.trainingStreak.current);
      expect(t1.boss.gym.endurance.progress).toBe(t0.boss.gym.endurance.progress);
      expect(round(t1.boss.gym.rating)).toBe(round(t0.boss.gym.rating));
      // Tuesday judges it, once: met with the backfill, two of three without.
      expect(t2b.boss.lifetimeXp).toBeGreaterThan(t2.boss.lifetimeXp);
      expect(t2b.boss.legacy.trainingStreak.current).toBeGreaterThan(t2.boss.legacy.trainingStreak.current);
      expect(t2b.boss.gym.endurance.progress).toBeGreaterThan(t2.boss.gym.endurance.progress);
    },
  },
  {
    name: "a Sunday's session logged on Monday, in an empty week",
    async setup() {
      await fresh(gymOnly);
      for (const day of mwf(0)) await gym(day);
    },
    day: D(13),
    t0: D(13),
    t1: D(14),
    t2: D(15),
    backfill: (reference) => logSession('gym', D(13), {}, reference).then(() => undefined),
    check({ t0, t1, t2, t2b }) {
      // An empty week still in progress is no data, through Monday.
      const week = Array.from({ length: 7 }, (_, offset) => D(7 + offset));
      expect(attendanceOn(t1, week)).toEqual(week.map(() => null));
      expect(round(t1.boss.gym.rating)).toBe(round(t0.boss.gym.rating));
      expect(t1.boss.gym.endurance.progress).toBe(t0.boss.gym.endurance.progress);
      // Judged on Tuesday: a missed week costs, a backfilled one costs less.
      expect(t2.boss.gym.rating).toBeLessThan(t1.boss.gym.rating);
      expect(t2b.boss.gym.rating).toBeGreaterThan(t2.boss.gym.rating);
    },
  },
  {
    name: "a Sunday's session logged on Monday, with Wellbeing and Food scored every day",
    async setup() {
      await fresh(mixed);
      for (let index = 0; index <= 15; index += 1) await answerDay(D(index), 7);
      for (const day of mwf(0)) await gym(day);
    },
    day: D(13),
    t0: D(13),
    t1: D(14),
    t2: D(15),
    backfill: (reference) => logSession('gym', D(13), {}, reference).then(() => undefined),
    check({ t0, t1, t2, t2b }) {
      expect(round(t1.boss.gym.rating)).toBe(round(t0.boss.gym.rating));
      expect(t1.boss.legacy.trainingStreak.current).toBe(t0.boss.legacy.trainingStreak.current);
      expect(t2b.boss.gym.rating).toBeGreaterThan(t2.boss.gym.rating);
    },
  },
  {
    name: 'the seventh silent day, backfilled the next day',
    async setup() {
      await fresh(gymOnly);
      for (let week = 0; week < 4; week += 1) for (const day of mwf(week)) await gym(day);
      await gym(D(28));
      await gym(D(30));
    },
    day: D(37),
    t0: D(37),
    t1: D(38),
    t2: D(39),
    backfill: (reference) => logSession('gym', D(37), {}, reference).then(() => undefined),
    check({ t0, t1, t1b, t2, t2b }) {
      expect(t0.boss.gym.abstinence?.days).toBe(7);
      // Carried, not charged — and said to be pending — on both evenings.
      for (const run of [t0, t1]) {
        expect(run.boss.gym.decayFraction).toBe(0);
        expect(run.boss.gym.decayPending).toBe(true);
      }
      expect(round(t1.boss.gym.rating)).toBe(round(t0.boss.gym.rating));
      expect(t1b.boss.gym.decayPending).toBeUndefined();
      // The charge lands once day seven has closed, and only without the session.
      expect(t2.boss.gym.decayFraction).toBeGreaterThan(0);
      expect(t2b.boss.gym.decayFraction).toBe(0);
      expect(t2b.boss.gym.rating).toBeGreaterThan(t2.boss.gym.rating);
    },
  },
  {
    name: 'the third unanswered day, answered the next day',
    async setup() {
      await fresh(mixed);
      for (let index = 0; index <= 14; index += 1) await answerDay(D(index), 7);
      await gym(D(14));
    },
    day: D(17),
    t0: D(17),
    t1: D(18),
    t2: D(19),
    backfill: (reference) => answerDay(D(17), 7, true, reference),
    check({ t1, t1b, t2 }) {
      const status = (run: Replay, date: DateKey) => run.boss.history.days[indexOf(run, date)]?.status;
      // The day before yesterday has closed and is charged; yesterday is not.
      expect(status(t1, D(16))).toBe('scored');
      expect(status(t1, D(17))).toBe('open');
      // Not folded: Wellbeing and Food skip it rather than charge it.
      for (const name of ['mental', 'food']) {
        const ledger = t1.boss.domains.find((entry) => entry.domain === name)!;
        expect(ledger.points[indexOf(t1, D(17))]?.skipped, name).toBe(true);
      }
      expect(status(t1b, D(17))).toBe('scored');
      // Without the answers, it is charged the day after: folded, with
      // nothing answered.
      expect(status(t2, D(17))).toBe('scored');
      expect(t2.boss.history.days[indexOf(t2, D(17))]?.answeredItems).toBe(0);
      for (const name of ['mental', 'food']) {
        const ledger = t2.boss.domains.find((entry) => entry.domain === name)!;
        expect(ledger.points[indexOf(t2, D(17))]?.skipped, name).toBe(false);
      }
    },
  },
  {
    name: 'the first unanswered day, answered the next day',
    async setup() {
      await fresh(mixed);
      for (let index = 0; index <= 14; index += 1) await answerDay(D(index), 7);
      await gym(D(14));
    },
    day: D(15),
    t0: D(15),
    t1: D(16),
    t2: D(17),
    backfill: (reference) => answerDay(D(15), 7, true, reference),
    check({ t0, t1, t2, t2b }) {
      // Neither the streak nor cooling-off moves at midnight.
      expect(t1.boss.legacy.checkInStreak.current).toBe(t0.boss.legacy.checkInStreak.current);
      const mental = (run: Replay) => round(run.boss.domains.find((entry) => entry.domain === 'mental')?.momentum);
      const food = (run: Replay) => round(run.boss.domains.find((entry) => entry.domain === 'food')?.momentum);
      expect(mental(t1)).toBe(mental(t0));
      expect(food(t1)).toBe(food(t0));
      // The day after, the unanswered day breaks the streak; the answered one does not.
      expect(t2b.boss.legacy.checkInStreak.current).toBeGreaterThan(t2.boss.legacy.checkInStreak.current);
    },
  },
  {
    name: 'D126: a low day corrected the next day',
    async setup() {
      await fresh(mindOnly);
      for (let index = 0; index <= 17; index += 1) await answerDay(D(index), 5, false);
      await answerDay(D(18), 1, false);
    },
    day: D(18),
    t0: D(18),
    t1: D(19),
    t2: D(20),
    backfill: (reference) => answerDay(D(18), 5, false, reference),
    check({ t0, t1, t1b }) {
      // The low day is not yet eligible either way, so nothing is reset at
      // midnight and the correction changes nothing that was counted.
      for (const run of [t0, t1, t1b]) {
        expect(pendingOf(run.boss).every((date) => date < D(18))).toBe(true);
      }
      if (t0.boss.pending && t1.boss.pending && t0.boss.pending.targetRankId === t1.boss.pending.targetRankId) {
        expect(t1.boss.pending.eligibleDates.slice(0, t0.boss.pending.eligibleDates.length)).toEqual(
          t0.boss.pending.eligibleDates,
        );
      }
      expect(pendingOf(t1b.boss)).toEqual(pendingOf(t1.boss));
    },
  },
  {
    name: 'D126: the seventh eligible day is yesterday, so the promotion waits a day',
    async setup() {
      await fresh(mindOnly);
      for (let index = 0; index <= 23; index += 1) await answerDay(D(index), 5, false);
    },
    day: D(23),
    t0: D(23),
    t1: D(24),
    t2: D(25),
    backfill: (reference) => answerDay(D(23), 1, false, reference),
    check({ t0, t1, t1b, t2 }) {
      // Six days counted and yesterday the seventh: it does not count while
      // it can still be written, so no promotion yet — and a correction of
      // it changes nothing that was counted.
      expect(t1.boss.rank.id).toBe(t0.boss.rank.id);
      expect(t1.boss.pending?.eligibleDates).toHaveLength(6);
      expect(t1.boss.pending?.eligibleDates.every((date) => date < D(23))).toBe(true);
      expect(pendingOf(t1b.boss)).toEqual(pendingOf(t1.boss));
      expect(changesOf(t1b.boss)).toEqual(changesOf(t1.boss));
      // A day later it has closed: the promotion lands, dated on the day it was earned.
      expect(changesOf(t2.boss)).toContain(`${D(23)} promotion ${t1.boss.pending?.targetRankId}`);
    },
  },
  {
    name: "a partly filled week: Tuesday's session logged on Wednesday",
    async setup() {
      await fresh(gymOnly);
      for (const day of mwf(0)) await gym(day);
      await gym(D(7));
    },
    day: D(8),
    t0: D(8),
    t1: D(9),
    t2: D(10),
    backfill: (reference) => logSession('gym', D(8), {}, reference).then(() => undefined),
    check({ t0, t1, t1b }) {
      // The week is judged when it is over: until then every day of it
      // counts the target as met, so no day enters at the running count.
      expect(attendanceOn(t0, [D(7), D(8)])).toEqual([MET, MET]);
      expect(attendanceOn(t1, [D(7), D(8), D(9)])).toEqual([MET, MET, MET]);
      expect(attendanceOn(t1b, [D(7), D(8), D(9)])).toEqual([MET, MET, MET]);
    },
  },
  {
    name: 'a partly filled week, with a day closing at midnight',
    async setup() {
      await fresh(mixed);
      for (let index = 0; index <= 10; index += 1) if (index !== 9) await answerDay(D(index), 7);
      for (const day of mwf(0)) await gym(day);
      await gym(D(7));
    },
    day: D(10),
    t0: D(10),
    t1: D(11),
    t2: D(12),
    backfill: (reference) => logSession('gym', D(10), {}, reference).then(() => undefined),
    check({ t1, t1b }) {
      const week = [D(7), D(8), D(9), D(10), D(11)];
      for (const run of [t1, t1b]) {
        for (const value of attendanceOn(run, week)) expect([null, MET]).toContain(value);
      }
    },
  },
];

describe('no drop at midnight that a backfill reverses (P8)', () => {
  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  for (const probe of PROBES) {
    it(probe.name, async () => {
      await probe.setup();
      const t0 = await replay(probe.t0);
      const t1 = await replay(probe.t1);
      const t2 = await replay(probe.t2);
      expect(await attempt(probe.t2, probe.backfill), 'the backfill the day after').toBe('refused');
      const dates = t1.boss.history.days.map((day) => day.date);
      const { closed, settled } = await finalDays(probe.t1, dates);
      expect(closed).not.toContain(probe.day);

      await probe.setup();
      expect(await attempt(probe.t1, probe.backfill), 'the backfill the next day').toBe('accepted');
      const t1b = await replay(probe.t1);
      const t2b = await replay(probe.t2);

      for (const run of [t1b, t2, t2b]) {
        for (const date of closed) {
          expect(dailyOutputs(run.boss, date), `${date} at ${run.clock}`).toEqual(dailyOutputs(t1.boss, date));
        }
        for (const date of settled) {
          expect(settledOutputs(run.boss, date), `${date} at ${run.clock}`).toEqual(settledOutputs(t1.boss, date));
        }
        for (const change of changesOf(t1.boss)) expect(changesOf(run.boss), run.clock).toContain(change);
      }
      probe.check({ t0, t1, t1b, t2, t2b });
    });
  }

  it('a demotion never fires on a day that can still be written, so a correction cannot take one back', async () => {
    // Climb on tens, then answer ones until the Boss is demoted. The first
    // clock that shows the demotion is `c`; yesterday is corrected at `c`.
    const setup = async () => {
      await fresh(mindOnly);
      for (let index = 0; index <= 40; index += 1) await answerDay(D(index), 10, false);
      for (let index = 41; index <= 90; index += 1) await answerDay(D(index), 1, false);
    };
    await setup();
    let c: DateKey | null = null;
    let demotion: string | null = null;
    for (let index = 42; index <= 91 && c === null; index += 1) {
      const run = await replay(D(index));
      demotion = changesOf(run.boss).find((change) => change.includes('demotion')) ?? null;
      if (demotion) c = D(index);
    }
    expect(c, 'a demotion within fifty days of ones').not.toBeNull();
    const at = c!;
    // Recorded on a closed day, never on yesterday or today.
    const demotedOn = demotion!.split(' ')[0]!;
    expect(demotedOn <= addDays(at, -2)).toBe(true);

    await setup();
    expect(await attempt(at, (reference) => answerDay(addDays(at, -1), 10, false, reference))).toBe('accepted');
    const corrected = await replay(at);
    expect(changesOf(corrected.boss)).toContain(demotion);
  });
});
