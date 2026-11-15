import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { GYM_CURVE_CONFIRMED, GYM_METRIC } from '../../core/config/constants';
import { addDays, type DateKey } from '../../core/dates';
import { gymCurveOf } from '../../core/gym/metric';
import { closeDatabase, deleteDatabase } from '../db';
import { ensureFoodRetired, ensureGymMetricEra, ensureSessionWindowEra } from '../configService';
import { configSnapshotsRepository } from '../repositories';
import { importBackup } from './backupService';
import { loadBossProgression, type BossProgression } from './bossService';
import { loadConfiguration } from './configurationService';
import { withoutGymCurveValue } from './fixtures/legacyGymMetric';
import { at } from './fixtures/profiles';
import {
  PROGRESSION_START,
  PROGRESSION_WEEKS,
  holdingProfile,
  progressionLast,
  progressionProfile,
} from './fixtures/progressionProfile';
import { dayOutputs } from './fixtures/replayOutputs';

/**
 * The aim of the block "Kurve", as a test (D177).
 *
 * > Whoever trains as in the import file — a rep more every week and then
 * > more weight — does not stand lower after the update than before.
 *
 * **Before** is the same history had Stage 5b never been: the best set by
 * `reps × load`, a window's last day against its first, the curve of the
 * constants. **After** is this build: the best working set, the median, and
 * the curve at the value its snapshots name. Both take the update on the
 * same day, with the one-day window and Food off as every update brings
 * them.
 *
 * **The reading** (`docs/design/wp3/kurve.md`, section 1) is the strictest
 * of the three the design weighed: *on every day from the update* — not on
 * average and not where the rating settles — for a history of five weeks or
 * more, which is what the import file is. This file holds it on the import
 * file itself and on the same diary continued for forty weeks, with the
 * update on every day from the sixth week to the twenty-seventh; and it
 * holds, as numbers, what the same value does to a person who is not
 * improving, and where the reading ends — an update inside the first five
 * weeks.
 *
 * Every number here is the replay's own. `kurveReport.test.ts` prints the
 * same replays as tables for every candidate; this file pins the built one.
 */

const IMPORT_FILE = readFileSync(
  new URL('../../../docs/wp3/stage5b/momentum-pruefdaten-5b.json', import.meta.url),
  'utf8',
);
/** The import file's last day, and the day the owner loads it. */
const FILE_DAY = '2026-11-15' as DateKey;

/** One day of the Gym rating as the Gym screen states it. */
interface GymDay {
  date: DateKey;
  rating: number;
  target: number | null;
  performance: number | null;
}

function gymDays(boss: BossProgression): GymDay[] {
  const detail = new Map(boss.gym.detail.map((point) => [point.date, point]));
  return boss.history.days.map((day, index) => ({
    date: day.date,
    rating: boss.gym.points[index]!.rating,
    target: detail.get(day.date)?.target ?? null,
    performance: detail.get(day.date)?.performance ?? null,
  }));
}

/** The level, the target and the rating as printed: whole points, and the rating to a tenth. */
const printed = (day: GymDay): [number | null, number | null, number] => [
  day.performance === null ? null : Math.round(day.performance),
  day.target === null ? null : Math.round(day.target),
  Math.round(day.rating * 10) / 10,
];

type Build = 'before' | 'stage5b' | 'after';

async function importAt(backup: string, clock: DateKey): Promise<void> {
  await closeDatabase();
  await deleteDatabase();
  setClock({ now: () => at(clock) });
  const result = await importBackup(backup);
  if (!result.ok) throw new Error(result.details.join('; '));
}

/**
 * `backup` replayed on `clock`, the update loaded on `update`: had Stage 5b
 * never been (`before`), as Stage 5b built it — the metric, the curve of
 * the constants — (`stage5b`), or by this build (`after`).
 */
async function replay(backup: string, clock: DateKey, update: DateKey, build: Build): Promise<BossProgression> {
  await importAt(backup, clock);
  await ensureSessionWindowEra(update);
  await ensureFoodRetired(update);
  if (build !== 'before') {
    await ensureGymMetricEra(update);
    if (build === 'stage5b') await withoutGymCurveValue();
  }
  return loadBossProgression(clock);
}

/** The lowest `after − before` of the Gym rating on the days from `update` to `horizon` days on, and where. */
function lowestDifference(before: GymDay[], after: GymDay[], update: DateKey, horizon: number): { delta: number; day: number } {
  const start = before.findIndex((day) => day.date === update);
  expect(start).toBeGreaterThanOrEqual(0);
  let lowest = { delta: Infinity, day: 0 };
  for (let index = start; index <= Math.min(before.length - 1, start + horizon); index += 1) {
    const delta = after[index]!.rating - before[index]!.rating;
    if (delta < lowest.delta) lowest = { delta, day: index - start };
  }
  return lowest;
}

const meanOfLast = (days: GymDay[], count: number): number =>
  days.slice(-count).reduce((sum, day) => sum + day.rating, 0) / count;

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

describe('the value the aim was measured with', () => {
  it('is the one this build writes: every three points of improvement multiply the odds by four', () => {
    // The numbers below are the numbers of this value. Another value is
    // another set of numbers — and the owner's to confirm (STOP Kurve).
    expect(GYM_METRIC.curveDecadePercent).toBe(3);
    expect(typeof GYM_CURVE_CONFIRMED).toBe('boolean');
  });
});

describe('the import file, imported and loaded once', () => {
  it('stands at 833.1 where it stood at 831.7: level 952 for 884, target 971 for 930', async () => {
    // Before: the file as the live build left it, before any load.
    await importAt(IMPORT_FILE, FILE_DAY);
    const before = await loadBossProgression();
    const old = gymDays(before);
    expect(old[old.length - 1]!.date).toBe(FILE_DAY);
    expect(printed(old[old.length - 1]!)).toEqual([884, 930, 831.7]);

    // After: the same database, loaded once by this build.
    await loadConfiguration();
    const snapshots = await configSnapshotsRepository.list();
    expect(snapshots.map((snapshot) => snapshot.effectiveFrom)).toEqual(['2026-10-12', FILE_DAY]);
    expect(gymCurveOf(snapshots[1]!.config)).toBe(3);
    const after = await loadBossProgression();
    const fresh = gymDays(after);
    expect(printed(fresh[fresh.length - 1]!)).toEqual([952, 971, 833.1]);

    // Not lower — and no day before the update is anything but what it was.
    expect(fresh[fresh.length - 1]!.rating).toBeGreaterThan(old[old.length - 1]!.rating);
    for (let index = 0; index < old.length - 1; index += 1) {
      expect(dayOutputs(after, index), old[index]!.date).toEqual(dayOutputs(before, index));
    }
    // The Boss follows: 759.5 for 758.8.
    const boss = (progression: BossProgression) => Math.round(progression.points[progression.points.length - 1]!.rating * 10) / 10;
    expect([boss(before), boss(after)]).toEqual([758.8, 759.5]);
  });

  it('which the curve as Stage 5b built it did not: 828.0, level 711, target 826', async () => {
    const before = gymDays(await replay(IMPORT_FILE, FILE_DAY, FILE_DAY, 'before'));
    const stage5b = gymDays(await replay(IMPORT_FILE, FILE_DAY, FILE_DAY, 'stage5b'));
    const after = gymDays(await replay(IMPORT_FILE, FILE_DAY, FILE_DAY, 'after'));
    const last = before.length - 1;
    // The update's other two steps move nothing on that day: "before" is the live build's number.
    expect(printed(before[last]!)).toEqual([884, 930, 831.7]);
    expect(printed(stage5b[last]!)).toEqual([711, 826, 828]);
    expect(printed(after[last]!)).toEqual([952, 971, 833.1]);
    expect(stage5b[last]!.rating).toBeLessThan(before[last]!.rating);
    expect(after[last]!.rating).toBeGreaterThan(before[last]!.rating);
  });
});

describe('the same diary, forty weeks of it', () => {
  const long = progressionProfile(PROGRESSION_WEEKS);
  const end = progressionLast(PROGRESSION_WEEKS);

  it(
    'is not lower on any day of the ninety after the update, whichever day from the sixth week to the twenty-seventh the update loads on',
    async () => {
      let lowest = { delta: Infinity, day: 0, update: '' };
      let updates = 0;
      for (let day = 35; day <= 189; day += 1) {
        const update = addDays(PROGRESSION_START, day);
        const before = gymDays(await replay(long, end, update, 'before'));
        const after = gymDays(await replay(long, end, update, 'after'));
        const found = lowestDifference(before, after, update, 90);
        if (found.delta < lowest.delta) lowest = { ...found, update };
        updates += 1;

        if (day === 35) {
          // The update on the day after the import file ends, as the report
          // states it: where the rating settles, and what Stage 5b's curve did.
          expect([Math.round(meanOfLast(before, 56) * 10) / 10, Math.round(meanOfLast(after, 56) * 10) / 10]).toEqual([930.7, 973.7]);
          const stage5b = gymDays(await replay(long, end, update, 'stage5b'));
          const atTen = lowestDifference(before, stage5b, update, 90);
          expect(atTen.delta).toBeLessThan(-40);
        }
      }
      expect(updates).toBe(155);
      // Never lower. The closest the two come is the update day itself, on
      // the 21st of November: two ten-thousandths of a point apart.
      expect(lowest.delta).toBeGreaterThanOrEqual(0);
      expect(lowest.delta).toBeLessThan(0.001);
      expect([lowest.update, lowest.day]).toEqual(['2026-11-21', 0]);
    },
    240_000,
  );

  it(
    'and where the reading ends: an update inside the first five weeks can stand lower for a while, by 14.4 points at most',
    async () => {
      // Both windows are two to five weeks old then, and the old metric's
      // first saw-tooth peak is the "before". No candidate the design
      // weighed meets the aim there (the steepest, 2, is 2.4 lower); the
      // number is held so that nobody takes the reading for more than it is.
      let lowest = { delta: Infinity, day: 0, update: '' };
      for (let day = 14; day < 35; day += 1) {
        const update = addDays(PROGRESSION_START, day);
        const before = gymDays(await replay(long, end, update, 'before'));
        const after = gymDays(await replay(long, end, update, 'after'));
        const found = lowestDifference(before, after, update, 90);
        if (found.delta < lowest.delta) lowest = { ...found, update };
      }
      expect(Math.round(lowest.delta * 10) / 10).toBe(-14.4);
      expect([lowest.update, lowest.day]).toEqual(['2026-10-26', 10]);
    },
    60_000,
  );
});

describe('the other side: the same person, not improving', () => {
  const weeks = PROGRESSION_WEEKS;
  const end = progressionLast(weeks);
  /** The week the event falls in, counted from 0, and its Monday as a day index. */
  const EVENT_WEEK = 20;
  const eventDay = EVENT_WEEK * 7;

  /** The diary under the old rules and under this build, each from its first day. */
  async function both(options: Parameters<typeof holdingProfile>[1]): Promise<{ before: GymDay[]; after: GymDay[] }> {
    const profile = holdingProfile(weeks, options);
    return {
      before: gymDays(await replay(profile, end, PROGRESSION_START, 'before')),
      after: gymDays(await replay(profile, end, PROGRESSION_START, 'after')),
    };
  }

  const lowestOf = (days: GymDay[], from: number, to: number): number =>
    Math.round(Math.min(...days.slice(from, to + 1).map((day) => day.rating)) * 10) / 10;

  it('the same sets every week: level 500 and rating 700.0, before and after', async () => {
    const { before, after } = await both({ wave: false });
    expect(printed(before[before.length - 1]!)).toEqual([500, 700, 700]);
    expect(printed(after[after.length - 1]!)).toEqual([500, 700, 700]);
  });

  it('an ordinary up and down of one rep: 682 to 734 where it was 675 to 716', async () => {
    const { before, after } = await both({});
    const span = (days: GymDay[]): [number, number] => {
      const ratings = days.slice(12 * 7).map((day) => day.rating);
      return [Math.round(Math.min(...ratings)), Math.round(Math.max(...ratings))];
    };
    expect(span(before)).toEqual([675, 716]);
    expect(span(after)).toEqual([682, 734]);
  });

  it('a single light day, and a whole light week: the rating does not move, where it fell to 636.6 and to 581.9', async () => {
    const day = await both({ wave: false, lightDayInWeek: EVENT_WEEK });
    expect(lowestOf(day.before, eventDay + 6, eventDay + 20)).toBe(636.6);
    expect(lowestOf(day.after, eventDay + 6, eventDay + 20)).toBe(700);
    const week = await both({ wave: false, lightWeek: EVENT_WEEK });
    expect(lowestOf(week.before, eventDay, eventDay + 27)).toBe(581.9);
    expect(lowestOf(week.after, eventDay, eventDay + 27)).toBe(700);
  });

  it('one rep less for good: down to 543.5, where it went down to 526.0', async () => {
    const { before, after } = await both({ wave: false, lessFrom: EVENT_WEEK });
    expect(lowestOf(before, eventDay, before.length - 1)).toBe(526);
    expect(lowestOf(after, eventDay, after.length - 1)).toBe(543.5);
    // Twelve weeks on: 616.0 for 604.9.
    const later = (days: GymDay[]) => Math.round(days[eventDay + 12 * 7]!.rating * 10) / 10;
    expect([later(before), later(after)]).toEqual([604.9, 616]);
  });
});
