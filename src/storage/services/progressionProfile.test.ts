import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  EXERCISES,
  FIRST_DAY,
  STAGE5B_LAST_DAY,
  WRITTEN_WEEKS,
  dayOffset,
  trainingBetween,
} from '../../../scripts/verify/pruefdaten-plan.mjs';
import { setClock } from '../../core/clock';
import { addDays, type DateKey } from '../../core/dates';
import { MUSCLE_GROUPS } from '../../core/model';
import { shownPerformance } from '../../features/gym/muscleState';
import { closeDatabase, deleteDatabase } from '../db';
import { gymSessionsRepository, gymSetsRepository } from '../repositories';
import { importBackup } from './backupService';
import { loadConfiguration } from './configurationService';
import { loadGymHistory } from './gymService';
import { at } from './fixtures/profiles';
import {
  PROGRESSION_START,
  PROGRESSION_WEEKS,
  PROGRESSION_WRITTEN_LAST,
  holdingProfile,
  progressionLast,
  progressionProfile,
} from './fixtures/progressionProfile';

/**
 * The plan the import files are typed from, and the two profiles of the
 * block "Kurve" that are written from it.
 *
 * `scripts/verify/pruefdaten-plan.mjs` is read twice: by the script that
 * types an import file into the live build, and by `progressionProfile()`,
 * the long profile the curve's design is measured on. What makes the two
 * one diary is held here: for the dates of the Stage 5b file the plan gives
 * exactly the sets that file holds, and from the sixth week it goes on by
 * the rule it names.
 */

const FILE = readFileSync(new URL('../../../docs/wp3/stage5b/momentum-pruefdaten-5b.json', import.meta.url), 'utf8');

interface FileSet {
  date: string;
  exerciseId: string;
  reps: number;
  weightGrams: number;
  order: number;
}
const fileSets = (JSON.parse(FILE) as { data: { gymSets: FileSet[] } }).data.gymSets;

/** A plan's sets as the records a workout of that day holds, in order. */
function planned(training: Map<string, Record<string, { reps: number; kg: number }[]>>): Omit<FileSet, never>[] {
  const out: FileSet[] = [];
  for (const [date, workout] of training) {
    let order = 0;
    for (const [key, sets] of Object.entries(workout)) {
      for (const set of sets) {
        out.push({ date, exerciseId: EXERCISES[key]!.id, reps: set.reps, weightGrams: Math.round(set.kg * 1000), order });
        order += 1;
      }
    }
  }
  return out;
}

const byDayAndOrder = (a: FileSet, b: FileSet): number => a.date.localeCompare(b.date) || a.order - b.order;
const bare = (set: FileSet): FileSet => ({ date: set.date, exerciseId: set.exerciseId, reps: set.reps, weightGrams: set.weightGrams, order: set.order });

describe('the plan the import files are typed from', () => {
  it('gives, for the dates of the Stage 5b file, exactly the sets that file holds', () => {
    const training = trainingBetween(FIRST_DAY, STAGE5B_LAST_DAY);
    expect(training.size).toBe(15);
    expect(planned(training).sort(byDayAndOrder)).toEqual(fileSets.map(bare).sort(byDayAndOrder));
  });

  it('trains on Wednesday, Friday and Sunday, and five weeks are written by hand', () => {
    expect(WRITTEN_WEEKS).toBe(5);
    const training = trainingBetween(FIRST_DAY, dayOffset(FIRST_DAY, 8 * 7 - 1));
    expect([...training.keys()].map((day) => new Date(`${day}T12:00:00Z`).getUTCDay())).toEqual(
      Array.from({ length: 8 }, () => [3, 5, 0]).flat(),
    );
  });

  it('goes on by its rule: a rep more every week, and at the top of the range the weight up and the reps back', () => {
    const training = trainingBetween(FIRST_DAY, dayOffset(FIRST_DAY, 12 * 7 - 1));
    /** The heaviest set of an exercise in each week, as "reps × kg". */
    const top = (key: string, weekday: number): string[] =>
      Array.from({ length: 12 }, (_, week) => {
        const sets = training.get(dayOffset(FIRST_DAY, week * 7 + weekday))![key]!;
        const heaviest = Math.max(...sets.map((set) => set.kg));
        const best = sets.filter((set) => set.kg === heaviest).reduce((a, b) => (b.reps > a.reps ? b : a));
        return `${best.reps} × ${best.kg}`;
      });
    // Bankdrücken: 8, 9, 10, then 2.5 kg more and 8 again — the five written weeks and the seven after them.
    expect(top('bench', 2)).toEqual([
      '8 × 60', '9 × 60', '10 × 60', '8 × 62.5', '9 × 62.5',
      '10 × 62.5', '8 × 65', '9 × 65', '10 × 65', '8 × 67.5', '9 × 67.5', '10 × 67.5',
    ]);
    // Schrägbank: up to twelve reps before the weight goes up.
    expect(top('incline', 2).slice(4)).toEqual(['10 × 24', '11 × 24', '12 × 24', '9 × 26', '10 × 26', '11 × 26', '12 × 26', '9 × 28']);
    // Kniebeuge: fives, 2.5 kg more every week.
    expect(top('squat', 6).slice(4)).toEqual(['5 × 107.5', '5 × 110', '5 × 112.5', '5 × 115', '5 × 117.5', '5 × 120', '5 × 122.5', '5 × 125']);
    // Klimmzüge: to twelve reps, then five kilograms on the belt and eight again.
    expect(top('pullUp', 4).slice(4)).toEqual(['9 × 0', '10 × 0', '11 × 0', '12 × 0', '8 × 5', '9 × 5', '10 × 5', '11 × 5']);
  });

  it('puts the last session on the last day, whatever weekday that is', () => {
    // A file made on a Monday: the push session that would have come on Wednesday is done that day.
    const monday = dayOffset(STAGE5B_LAST_DAY, 1);
    const training = trainingBetween(FIRST_DAY, monday);
    expect(training.size).toBe(16);
    expect(Object.keys(training.get(monday)!)).toEqual(['bench', 'press', 'incline', 'pushdown']);
    expect(training.get(monday)).toEqual(trainingBetween(FIRST_DAY, dayOffset(monday, 2)).get(dayOffset(monday, 2)));
    // A file made on a session day has no session added.
    expect(trainingBetween(FIRST_DAY, STAGE5B_LAST_DAY).size).toBe(15);
  });
});

describe('the profiles written from it', () => {
  beforeEach(async () => {
    await closeDatabase();
    await deleteDatabase();
  });

  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  it('the long profile is the import file itself for five weeks, record for record', () => {
    expect(JSON.parse(progressionProfile(5))).toEqual(JSON.parse(FILE));
    const long = JSON.parse(progressionProfile()) as { data: Record<string, unknown[]> };
    const file = JSON.parse(FILE) as { data: Record<string, unknown[]> };
    for (const store of ['answers', 'gymSessions', 'gymSets', 'weightEntries', 'configSnapshots', 'questions', 'domains']) {
      expect(long.data[store]!.slice(0, file.data[store]!.length), store).toEqual(file.data[store]);
    }
  });

  it('and then the plan, three sessions a week to its last day', async () => {
    const last = progressionLast();
    setClock({ now: () => at(last) });
    const result = await importBackup(progressionProfile());
    expect(result.ok).toBe(true);
    const sessions = (await gymSessionsRepository.listByDateRange(PROGRESSION_START, last)).map((session) => session.date).sort();
    expect(sessions).toHaveLength(PROGRESSION_WEEKS * 3);
    expect(sessions[sessions.length - 1]).toBe(last);
    const sets = await gymSetsRepository.getAll();
    const after = planned(trainingBetween(FIRST_DAY, last)).filter((set) => set.date > PROGRESSION_WRITTEN_LAST);
    expect(sets.filter((set) => set.date > PROGRESSION_WRITTEN_LAST).map((set) => bare(set as FileSet)).sort(byDayAndOrder)).toEqual(after.sort(byDayAndOrder));
    // A set of the continuation is a set as the live build writes it: no warm-up mark.
    expect(sets.some((set) => 'warmUp' in set)).toBe(false);
  });

  it('the holding profile without its up and down holds every group at exactly 0 %', async () => {
    const clock = addDays(PROGRESSION_START, 12 * 7 - 1) as DateKey;
    setClock({ now: () => at(clock) });
    const result = await importBackup(holdingProfile(12, { wave: false }));
    expect(result.ok).toBe(true);
    await loadConfiguration();
    for (const days of [30, 90]) {
      const history = await loadGymHistory(addDays(clock, -(days - 1)), clock);
      const shown = shownPerformance(history.days, history.overall);
      expect(shown.rated).toHaveLength(MUSCLE_GROUPS.length);
      for (const entry of shown.muscles) {
        expect(entry.change, `${entry.muscle} at ${days} days`).toBe(0);
        expect(entry.state).toBe('unchanged');
      }
    }
  });

  it('and with it, one rep either way and no trend: every working set stays within a rep of the fifth week', () => {
    const base = planned(trainingBetween(FIRST_DAY, STAGE5B_LAST_DAY)).filter((set) => set.date >= dayOffset(FIRST_DAY, 28));
    const waved = (JSON.parse(holdingProfile(16)) as { data: { gymSets: FileSet[] } }).data.gymSets;
    expect(waved).toHaveLength(base.length * 16);
    for (let week = 0; week < 16; week += 1) {
      const sets = waved.filter((set) => set.date >= dayOffset(FIRST_DAY, week * 7) && set.date < dayOffset(FIRST_DAY, (week + 1) * 7)).sort(byDayAndOrder);
      expect(sets).toHaveLength(base.length);
      base.sort(byDayAndOrder).forEach((set, index) => {
        expect(sets[index]!.exerciseId).toBe(set.exerciseId);
        expect(sets[index]!.weightGrams).toBe(set.weightGrams);
        expect(Math.abs(sets[index]!.reps - set.reps)).toBeLessThanOrEqual(1);
      });
    }
  });
});
