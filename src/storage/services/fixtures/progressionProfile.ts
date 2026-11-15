import { readFileSync } from 'node:fs';
import {
  EXERCISES,
  FIRST_DAY,
  STAGE5B_LAST_DAY,
  answersOn,
  dayOffset,
  trainingBetween,
  type PlannedWorkout,
} from '../../../../scripts/verify/pruefdaten-plan.mjs';
import { addDays, diffInDays, weekKeyOf, type DateKey } from '../../../core/dates';

/**
 * The import file of Stage 5b, lived on by its own rule (block "Kurve").
 *
 * The owner's aim for the curve names a way of training — "one rep more
 * every week and then more weight, as in the import file" — and the import
 * file holds five weeks of it. Where a rating settles under that training
 * cannot be read off five weeks. This profile is the same diary, longer:
 *
 * - **its first five weeks are the import file itself**, byte for byte what
 *   the live build exported (`docs/wp3/stage5b/momentum-pruefdaten-5b.json`):
 *   its settings, its one snapshot, its questions, every answer and set;
 * - **from the sixth week** the plan the file was typed from goes on
 *   (`scripts/verify/pruefdaten-plan.mjs`): a rep more every week, and at the
 *   top of the range the weight up and the reps back to the bottom — push,
 *   pull and legs on Wednesday, Friday and Sunday, two answers a day. No
 *   light day and no missed week: the strictest form of the training the
 *   aim is about.
 *
 * The added records have the shape the live build writes — a session
 * without `finishedAt`, a set without a warm-up mark, the file's own
 * snapshot id — so the profile is a device as the live build left it,
 * however many weeks it holds. A test or the number report then loads the
 * update on the day it chooses.
 *
 * Deterministic: fixed dates, no clock, no randomness.
 */

export const PROGRESSION_START = FIRST_DAY as DateKey; // a Monday
/** The last day the import file itself holds. */
export const PROGRESSION_WRITTEN_LAST = STAGE5B_LAST_DAY as DateKey;
/** Forty weeks: into July, across a turn of the year. */
export const PROGRESSION_WEEKS = 40;

const IMPORT_FILE = readFileSync(
  new URL('../../../../docs/wp3/stage5b/momentum-pruefdaten-5b.json', import.meta.url),
  'utf8',
);

interface FileExercise {
  id: string;
  muscles: string[];
  primaryMuscles?: string[];
  loadType?: string;
}

interface ImportFile {
  data: {
    domains: { id: string; type: string }[];
    questions: { id: string; domainId: string; order: number }[];
    answers: unknown[];
    exercises: FileExercise[];
    gymSessions: unknown[];
    gymSets: unknown[];
    weightEntries: { date: string }[];
    configSnapshots: { id: string }[];
  };
}

/** The last day of a profile of `weeks` weeks: a Sunday, and a session day. */
export function progressionLast(weeks: number = PROGRESSION_WEEKS): DateKey {
  return addDays(PROGRESSION_START, weeks * 7 - 1);
}

/** Appends the answers and, where the day has a workout, the session and its sets, as the live build writes them. */
function writeDay(data: ImportFile['data'], date: DateKey, workout: PlannedWorkout | undefined, tag: string): void {
  const snapshotId = data.configSnapshots[0]!.id;
  const index = diffInDays(PROGRESSION_START, date);
  const at = (time: string) => `${date}T${time}.000Z`;

  const values = answersOn(index);
  for (const [order, question] of [...data.questions].sort((a, b) => a.order - b.order).entries()) {
    data.answers.push({
      id: `${date}#${question.id}`, date, questionId: question.id, domainId: question.domainId,
      value: values[order], valueType: 'scale', sensitivity: 'private', configSnapshotId: snapshotId,
      createdAt: at('07:10:00'), updatedAt: at('07:10:00'),
    });
  }

  if (!workout) return;
  const catalogue = new Map(data.exercises.map((exercise) => [exercise.id, exercise]));
  const sessionId = `gym_${tag}_${date}`;
  data.gymSessions.push({
    id: sessionId, date, weekKey: weekKeyOf(date), performedAt: at('06:10:00'), planId: null, note: null,
    legacyCarryOver: false, configSnapshotId: snapshotId, createdAt: at('06:10:00'), updatedAt: at('06:10:00'),
  });
  let order = 0;
  for (const [key, sets] of Object.entries(workout)) {
    const exercise = catalogue.get(EXERCISES[key]!.id);
    if (!exercise) throw new Error(`the import file's catalogue has no ${EXERCISES[key]!.id}`);
    for (const planned of sets) {
      data.gymSets.push({
        id: `set_${tag}_${date}_${String(order).padStart(2, '0')}`,
        sessionId,
        exerciseId: exercise.id,
        date,
        weightGrams: Math.round(planned.kg * 1000),
        reps: planned.reps,
        order,
        muscles: [...exercise.muscles],
        ...(exercise.primaryMuscles === undefined ? {} : { primaryMuscles: [...exercise.primaryMuscles] }),
        ...(exercise.loadType === undefined ? {} : { loadType: exercise.loadType }),
        createdAt: at('06:20:00'),
      });
      order += 1;
    }
  }
}

/** The import file continued to `weeks` weeks, as a backup file. Five weeks is the file itself. */
export function progressionProfile(weeks: number = PROGRESSION_WEEKS): string {
  const backup = JSON.parse(IMPORT_FILE) as ImportFile;
  const last = progressionLast(weeks);
  if (last <= PROGRESSION_WRITTEN_LAST) return JSON.stringify(backup);

  const training = trainingBetween(PROGRESSION_START, last);
  for (let date = addDays(PROGRESSION_WRITTEN_LAST, 1); date <= last; date = addDays(date, 1)) {
    writeDay(backup.data, date, training.get(dayOffset(date, 0)), 'pp');
  }
  return JSON.stringify(backup);
}

/* ── The same person, holding ───────────────────────────────────────────── */

/**
 * What a person who holds does from week to week, in reps on the working
 * sets: two good weeks, two weak ones, two as planned — an ordinary up and
 * down, one rep either way. Each exercise is somewhere else in it.
 */
const WAVE = [0, 1, 1, 0, -1, -1, 0, 0];

export interface HoldingOptions {
  /** `false`: every week exactly the same sets. Default: the ordinary up and down. */
  wave?: boolean;
  /** From this week on (counted from 0) every working set has one rep less, for good. */
  lessFrom?: number;
  /** One session of this week is trained light: every working set at four fifths of its weight. */
  lightDayInWeek?: number;
  /** All three sessions of this week are trained light. */
  lightWeek?: number;
}

/**
 * The other side of the curve, as a diary (block "Kurve"): the person of the
 * import file who **makes no progress** — the sets of its fifth week, every
 * week, for `weeks` weeks — with what `options` adds: an ordinary up and
 * down of one rep, a rep less from some week on, a single light day, a whole
 * light week. Settings, questions and the snapshot are the import file's;
 * every session and set is written here, and of the file's two weight
 * entries only the first is kept — a body weight that changes changes what
 * a pull-up is worth, and this person holds.
 *
 * It measures what a steeper curve costs someone who is not improving, the
 * way `progressionProfile()` measures what it gives someone who is.
 */
export function holdingProfile(weeks: number = PROGRESSION_WEEKS, options: HoldingOptions = {}): string {
  const backup = JSON.parse(IMPORT_FILE) as ImportFile;
  const { data } = backup;
  const last = progressionLast(weeks);
  // The answers of the first five weeks stay; every session and set is the diary's.
  data.gymSessions = [];
  data.gymSets = [];
  // One body weight throughout: the first one measured.
  data.weightEntries = [...data.weightEntries].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 1);

  // The fifth week of the plan: the sets this person repeats.
  const written = trainingBetween(PROGRESSION_START, PROGRESSION_WRITTEN_LAST);
  const base = [2, 4, 6].map((weekday) => written.get(dayOffset(PROGRESSION_START, 4 * 7 + weekday))!);
  const phase = new Map(Object.keys(EXERCISES).map((key, index) => [key, (index * 3) % WAVE.length]));

  for (let date = PROGRESSION_START; date <= last; date = addDays(date, 1)) {
    const index = diffInDays(PROGRESSION_START, date);
    const week = Math.floor(index / 7);
    const session = [2, 4, 6].indexOf(index % 7);
    let workout: PlannedWorkout | undefined;
    if (session !== -1) {
      const light = options.lightWeek === week || (options.lightDayInWeek === week && session === 2);
      workout = Object.fromEntries(
        Object.entries(base[session]!).map(([key, sets]) => {
          const heaviest = Math.max(...sets.map((entry) => entry.kg));
          const shift =
            (options.wave === false ? 0 : WAVE[(week + phase.get(key)!) % WAVE.length]!) -
            (options.lessFrom !== undefined && week >= options.lessFrom ? 1 : 0);
          return [
            key,
            sets.map((entry) =>
              entry.kg !== heaviest
                ? entry
                : { reps: entry.reps + shift, kg: light ? Math.round(entry.kg * 0.8 * 2) / 2 : entry.kg },
            ),
          ];
        }),
      );
    }
    if (date > PROGRESSION_WRITTEN_LAST) writeDay(data, date, workout, 'hp');
    else if (workout) {
      // Inside the import file's five weeks its answers are kept, so only the session is written.
      const answers = data.answers;
      data.answers = [];
      writeDay(data, date, workout, 'hp');
      data.answers = answers;
    }
  }
  return JSON.stringify(backup);
}
