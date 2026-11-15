/**
 * The training diary of the import files, as a plan.
 *
 * `stage5b-live-backup.mjs` types this plan into the live build, day by day,
 * and exports the backup the owner loads at a STOP. The first five weeks are
 * the ones written by hand for Stage 5b, set for set, so the file of that
 * stage (`docs/wp3/stage5b/momentum-pruefdaten-5b.json`) is exactly what this
 * module gives for its dates — a test holds that. From the sixth week on the
 * same diary goes on by the one rule it was written to: **a rep more every
 * week, and at the top of the range the weight goes up and the reps go back
 * to the bottom.** Nothing else happens in the continuation: no light day,
 * no missed week.
 *
 * Two readers, one plan: the generator of an import file that ends on a
 * later day (block "Kurve", `docs/wp3/kurve/`), and the long test profile
 * the curve's design is measured on
 * (`src/storage/services/fixtures/progressionProfile.ts`). Pure data and
 * arithmetic: no clock, no browser, no randomness.
 *
 * A push / pull / legs week — Wednesday, Friday, Sunday — whose first five
 * weeks hold each case the Stage 5b metric was changed for:
 *
 * - Bankdrücken     the reps rise at 60 kg (8, 9, 10), then the weight goes
 *                   to 62.5 kg and the reps fall back to 8
 * - Kniebeuge       a light day in the third week (8 × 80 kg between fives
 *                   at 102.5 and 105 kg)
 * - Latzug          a pyramid, 12 / 10 / 8 with the weight rising
 * - Pushdown Seil   a drop set after the work
 * - Klimmzüge       body weight, with a second weight entry three weeks in
 * - a light first set before the bench and the squat, unmarked
 *
 * Every figure is invented. It is a training diary nobody kept.
 */

/** `[reps, kg]`; a bodyweight exercise's kg is what was added. */
const set = (reps, kg) => ({ reps, kg });
const sets = (kg, ...reps) => reps.map((count) => set(count, kg));

export const EXERCISES = {
  bench: { id: 'ex_bench_press', search: 'Bench Press', name: 'Bankdrücken' },
  press: { id: 'ex_overhead_press', search: 'Overhead Press', name: 'Overhead Press' },
  incline: { id: 'ex_incline_press', search: 'Incline Dumbbell Press', name: 'Schrägbank Kurzhantel' },
  pushdown: { id: 'ex_triceps_pushdown', search: 'Triceps Pushdown', name: 'Pushdown Seil' },
  pullUp: { id: 'ex_pull_up', search: 'Pull-Up', name: 'Klimmzüge', bodyweight: true },
  row: { id: 'ex_barbell_row', search: 'Barbell Row', name: 'Langhantelrudern' },
  pulldown: { id: 'ex_lat_pulldown', search: 'Lat Pulldown', name: 'Latzug' },
  curl: { id: 'ex_biceps_curl', search: 'Biceps Curl', name: 'Bizeps-Curls' },
  squat: { id: 'ex_squat', search: 'Back Squat', name: 'Kniebeuge' },
  rdl: { id: 'ex_romanian_deadlift', search: 'Romanian Deadlift', name: 'Rumänisches Kreuzheben' },
  legPress: { id: 'ex_leg_press', search: 'Leg Press', name: 'Beinpresse' },
  calf: { id: 'ex_calf_raise', search: 'Calf Raise', name: 'Wadenheben' },
};

/* ── The five weeks written by hand (Stage 5b) ──────────────────────────── */

const PUSH = [
  { bench: [set(10, 40), ...sets(60, 8, 8, 7)], press: sets(40, 6, 6, 5), incline: sets(22, 10, 9, 8), pushdown: [...sets(25, 10, 9, 9), set(13, 20)] },
  { bench: [set(10, 40), ...sets(60, 9, 9, 8)], press: sets(40, 7, 6, 6), incline: sets(22, 11, 10, 9), pushdown: [...sets(25, 11, 10, 9), set(13, 20)] },
  { bench: [set(10, 40), ...sets(60, 10, 10, 9)], press: sets(40, 8, 7, 7), incline: sets(22, 12, 11, 10), pushdown: [...sets(25, 12, 11, 10), set(14, 20)] },
  { bench: [set(10, 40), ...sets(62.5, 8, 7, 7)], press: sets(42.5, 6, 6, 5), incline: sets(24, 9, 8, 8), pushdown: [...sets(27.5, 9, 9, 8), set(15, 20)] },
  { bench: [set(10, 40), ...sets(62.5, 9, 8, 8)], press: sets(42.5, 7, 6, 6), incline: sets(24, 10, 9, 8), pushdown: [...sets(27.5, 10, 9, 9), set(15, 20)] },
];
const PULL = [
  { pullUp: sets(0, 6, 5, 5), row: sets(60, 8, 8, 8), pulldown: [set(12, 50), set(10, 57.5), set(8, 65)], curl: sets(12, 12, 11, 10) },
  { pullUp: sets(0, 7, 6, 5), row: sets(60, 9, 9, 8), pulldown: [set(12, 50), set(10, 57.5), set(9, 65)], curl: sets(12, 12, 12, 11) },
  { pullUp: sets(0, 8, 6, 6), row: sets(60, 10, 10, 9), pulldown: [set(12, 52.5), set(10, 60), set(8, 67.5)], curl: sets(14, 10, 9, 8) },
  { pullUp: sets(0, 8, 7, 6), row: sets(65, 8, 7, 7), pulldown: [set(12, 52.5), set(10, 60), set(9, 67.5)], curl: sets(14, 11, 10, 9) },
  { pullUp: sets(0, 9, 7, 7), row: sets(65, 8, 8, 8), pulldown: [set(12, 55), set(10, 62.5), set(8, 70)], curl: sets(14, 12, 10, 10) },
];
const LEGS = [
  { squat: [set(8, 60), ...sets(100, 5, 5, 5)], rdl: sets(80, 8, 8, 8), legPress: sets(140, 10, 10, 9), calf: sets(60, 15, 14, 12) },
  { squat: [set(8, 60), ...sets(102.5, 5, 5, 5)], rdl: sets(80, 9, 9, 8), legPress: sets(140, 11, 10, 10), calf: sets(60, 15, 15, 13) },
  { squat: sets(80, 8, 8, 8), rdl: sets(80, 10, 9, 9), legPress: sets(140, 12, 11, 10), calf: sets(65, 13, 12, 12) },
  { squat: [set(8, 60), ...sets(105, 5, 5, 4)], rdl: sets(85, 8, 8, 7), legPress: sets(150, 9, 9, 8), calf: sets(65, 14, 13, 12) },
  { squat: [set(8, 60), ...sets(107.5, 5, 5, 5)], rdl: sets(85, 9, 8, 8), legPress: sets(150, 10, 9, 9), calf: sets(65, 15, 14, 13) },
];

/** The weeks written by hand. From this week on the rule below writes. */
export const WRITTEN_WEEKS = PUSH.length;

/* ── From the sixth week: the rule ──────────────────────────────────────── */

/**
 * Double progression, one exercise: where its heaviest set stood in the
 * last week written by hand, the range its reps move in, and what the
 * weight goes up by at the top of the range. `shape` writes the day's sets
 * round that heaviest set.
 */
const RULES = {
  bench: { kg: 62.5, reps: 9, lo: 8, hi: 10, step: 2.5, shape: (kg, r) => [set(10, 40), ...sets(kg, r, r - 1, r - 1)] },
  press: { kg: 42.5, reps: 7, lo: 6, hi: 8, step: 2.5, shape: (kg, r) => sets(kg, r, r - 1, r - 1) },
  incline: { kg: 24, reps: 10, lo: 9, hi: 12, step: 2, shape: (kg, r) => sets(kg, r, r - 1, r - 2) },
  // The drop set follows the work at a distance: 20 kg under 30, 22.5 from 30, 25 from 35.
  pushdown: { kg: 27.5, reps: 10, lo: 9, hi: 12, step: 2.5, shape: (kg, r) => [...sets(kg, r, r - 1, r - 1), set(15, 20 + 2.5 * Math.floor((kg - 25) / 5))] },
  // What is added to the body weight: nothing up to twelve reps, then 5 kg and back to eight.
  pullUp: { kg: 0, reps: 9, lo: 8, hi: 12, step: 5, shape: (kg, r) => sets(kg, r, r - 2, r - 2) },
  row: { kg: 65, reps: 8, lo: 8, hi: 10, step: 5, shape: (kg, r) => sets(kg, r, r, r - 1) },
  // A pyramid: twelve and ten on the way up, the heaviest set last.
  pulldown: { kg: 70, reps: 8, lo: 8, hi: 9, step: 2.5, shape: (kg, r) => [set(12, kg - 15), set(10, kg - 7.5), set(r, kg)] },
  curl: { kg: 14, reps: 12, lo: 10, hi: 12, step: 2, shape: (kg, r) => sets(kg, r, r - 2, r - 2) },
  // Fives throughout: the range is one rep wide, so the weight goes up every week.
  squat: { kg: 107.5, reps: 5, lo: 5, hi: 5, step: 2.5, shape: (kg, r) => [set(8, 60), ...sets(kg, r, r, r)] },
  rdl: { kg: 85, reps: 9, lo: 8, hi: 10, step: 5, shape: (kg, r) => sets(kg, r, r - 1, r - 1) },
  legPress: { kg: 150, reps: 10, lo: 9, hi: 12, step: 10, shape: (kg, r) => sets(kg, r, r - 1, r - 1) },
  calf: { kg: 65, reps: 15, lo: 13, hi: 15, step: 5, shape: (kg, r) => sets(kg, r, r - 1, r - 2) },
};

/** The sets of one exercise in `week`, counted from 0, once the hand-written weeks are over. */
function ruled(key, week) {
  const rule = RULES[key];
  let { kg, reps } = rule;
  for (let step = WRITTEN_WEEKS; step <= week; step += 1) {
    if (reps < rule.hi) reps += 1;
    else {
      kg += rule.step;
      reps = rule.lo;
    }
  }
  return rule.shape(kg, reps);
}

const SESSIONS = [
  { kind: 'push', weekday: 2, written: PUSH, exercises: ['bench', 'press', 'incline', 'pushdown'] },
  { kind: 'pull', weekday: 4, written: PULL, exercises: ['pullUp', 'row', 'pulldown', 'curl'] },
  { kind: 'legs', weekday: 6, written: LEGS, exercises: ['squat', 'rdl', 'legPress', 'calf'] },
];

function workoutOf(session, week) {
  if (week < WRITTEN_WEEKS) return session.written[week];
  return Object.fromEntries(session.exercises.map((key) => [key, ruled(key, week)]));
}

/* ── The calendar ───────────────────────────────────────────────────────── */

/** The first day of the Stage 5b file: a Monday, so its week has its target from its first day. */
export const FIRST_DAY = '2026-10-12';
/** The last day of the Stage 5b file: the Sunday of the fifth week, and its last session. */
export const STAGE5B_LAST_DAY = '2026-11-15';

export function dayOffset(day, days) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The training of the days from `first` — a Monday — to `last`, as a map
 * from day to workout (`{ bench: [{ reps, kg }, …], … }`, in the order the
 * exercises are done).
 *
 * Wednesday is push, Friday pull, Sunday legs. **The last session is on the
 * last day**, so that a file made on it does not open on a training break:
 * when `last` is not one of the three, the session that would have come
 * next is done on it.
 */
export function trainingBetween(first, last) {
  const training = new Map();
  let next = { week: 0, session: 0 };
  for (let week = 0; ; week += 1) {
    let done = false;
    for (const [index, session] of SESSIONS.entries()) {
      const day = dayOffset(first, week * 7 + session.weekday);
      if (day > last) {
        done = true;
        break;
      }
      training.set(day, workoutOf(session, week));
      next = index === SESSIONS.length - 1 ? { week: week + 1, session: 0 } : { week, session: index + 1 };
    }
    if (done) break;
  }
  if (!training.has(last)) training.set(last, workoutOf(SESSIONS[next.session], next.week));
  return training;
}

/**
 * The body weight entered on the day of a pull session; the later one
 * replaces nothing. Keyed by the day's distance from the first day, so a
 * file that begins on another Monday carries the same two entries.
 */
export const BODY_WEIGHT_ON_DAY = { 4: 78.4, 25: 77.6 };

/** Two daily answers, invented: sleep and mood, each between 5 and 9. `index` counts days from the first. */
export function answersOn(index) {
  const sleep = 6 + ((index * 5 + 2) % 4) - (index % 9 === 4 ? 1 : 0);
  const mood = 6 + ((index * 3 + 1) % 4) - (index % 11 === 7 ? 1 : 0);
  return [sleep, mood];
}
