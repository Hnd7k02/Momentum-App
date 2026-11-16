import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The work volume is shown and never scored (D152).
 *
 * It enters no rating, no Boss share, no state and no colour. That is not a
 * property a number can be tested for, so it is held where it can be: in
 * the sources. Nothing that scores, replays or turns a number into a state
 * or a tint may import `core/gym/volume` or name what it exports — the way
 * `foodRetirement.test.ts` holds that nothing creates Food data.
 */

const SRC = fileURLToPath(new URL('../../', import.meta.url));

/** Every source file that ships: no tests, no test fixtures. */
function shippedSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== 'fixtures' && entry !== 'test') shippedSources(path, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

/** An import of the module, or a use of one of its names. */
const READS_VOLUME = /core\/gym\/volume|\.\/volume'|workVolumeByWeek|exerciseDayVolume|isWorkingSet|WeekVolume/;

/**
 * What scores, replays, ranks, or makes a number a state or a colour.
 * `core/gym/` itself is listed file by file below: the volume lives there.
 */
const SCORING = [
  /^core\/scoring\//,
  /^core\/rating\//,
  /^core\/ranks\//,
  /^core\/boss\//,
  /^core\/ledger\//,
  /^core\/decay\//,
  /^core\/running\//,
  /^core\/config\//,
  /^core\/streaks\//,
  /^core\/trends\//,
  /^core\/pause\//,
  // Every service that replays a rating, the Boss or the history.
  /^storage\/services\/(gymRatingService|runningRatingService|bossService|historyService|checkInService|ratingService|promotionConfirmationService)\.ts$/,
  // The one place a number becomes a state, and everything that tints the body.
  /^features\/gym\/muscleState\.ts$/,
  /^features\/gym\/muscleAnalytics\.ts$/,
  /^features\/body\//,
  /^components\/BodyRenderer\//,
];

/** The files of `core/gym/` that form the metric the rating reads. */
const GYM_SCORING = /^core\/gym\/(performance|metric|load|muscles)\.ts$/;

describe('the work volume is never scored (D152)', () => {
  const sources = shippedSources(SRC).map((path) => ({ path: path.slice(SRC.length), text: readFileSync(path, 'utf8') }));

  it('is read by nothing that scores, ranks, replays or colours', () => {
    const readers = sources
      .filter(({ path }) => SCORING.some((pattern) => pattern.test(path)) || GYM_SCORING.test(path))
      .filter(({ text }) => READS_VOLUME.test(text))
      .map(({ path }) => path);
    expect(readers).toEqual([]);
  });

  it('looked at the files it names', () => {
    // A pattern that matches no file would hold nothing.
    for (const pattern of [...SCORING, GYM_SCORING]) {
      expect(sources.some(({ path }) => pattern.test(path)), String(pattern)).toBe(true);
    }
    expect(sources.length).toBeGreaterThan(100);
  });

  it('exists, and is read by something that only shows it', () => {
    expect(sources.some(({ path }) => path === 'core/gym/volume.ts')).toBe(true);
  });
});
