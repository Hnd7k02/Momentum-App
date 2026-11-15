import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright-core';
import { CHROMIUM } from './lib.mjs';

/**
 * WP3, Stage 5b — a backup with Gym sets, made by the live build itself.
 *
 * No backup with a single Gym set exists in either repository, and the owner
 * attached none. So this script does what he would do: it opens the live
 * build (the default branch, `e30becd`, built in a worktree of its own and
 * served on its own port), walks its onboarding, and logs five weeks of
 * training through its own workout screen — one day at a time on a clock that
 * moves from 12 October to 15 November 2026 — and then taps "Backup
 * exportieren". Nothing is written to its database from outside: every
 * answer, session, set and weight entry is one the interface saved.
 *
 *   git worktree add <dir> e30becd && (cd <dir> && npm ci && npm run build)
 *   (cd <dir> && npx vite preview --port 4273 --strictPort) &
 *   LIVE_URL=http://127.0.0.1:4273/Momentum-App/ \
 *     OUT=docs/wp3/stage5b/momentum-pruefdaten-5b.json \
 *     node scripts/verify/stage5b-live-backup.mjs
 *
 * The file serves twice. It is the trial run of step 8 — the number report
 * reads it (`STAGE5B_BACKUP`) — and it is the import file of the owner's
 * iPhone check: loaded into the live app and into the preview it shows the
 * same five weeks under the old metric and under the new one.
 *
 * The plan is a push / pull / legs week — Wednesday, Friday, Sunday, in the
 * morning, the last session on the day the file was made, so that the
 * owner's check does not run into a training break — written so that the
 * cases the metric was changed for are each on screen once:
 *
 * - Bankdrücken     the reps rise at 60 kg (8, 9, 10), then the weight goes
 *                   to 62.5 kg and the reps fall back to 8 — the day the old
 *                   metric reads as a fall of a sixth
 * - Kniebeuge       a light day in the third week (8 × 80 kg between fives
 *                   at 102.5 and 105 kg) — the old metric's best day
 * - Latzug          a pyramid, 12 / 10 / 8 with the weight rising — the old
 *                   metric names the lightest set
 * - Pushdown Seil   a drop set after the work — the old metric names it
 * - Klimmzüge       body weight, with a second weight entry three weeks in
 * - a light first set before the bench and the squat, unmarked — the live
 *   build has no mark; the preview can set one
 *
 * Every figure is invented. It is a training diary nobody kept.
 */
const URL = process.env.LIVE_URL ?? 'http://127.0.0.1:4273/Momentum-App/';
const OUT = process.env.OUT ?? 'docs/wp3/stage5b/momentum-pruefdaten-5b.json';
const TZ = 'Europe/Zurich';

/* ── The plan ───────────────────────────────────────────────────────────── */

/** `[reps, kg]`; a bodyweight exercise's kg is what was added. */
const set = (reps, kg) => ({ reps, kg });
const sets = (kg, ...reps) => reps.map((count) => set(count, kg));

const EXERCISES = {
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

const FIRST = '2026-10-12'; // a Monday: the week has its target from its first day
const LAST = '2026-11-15'; // the Sunday of the fifth week, and its last session
/** A body weight is entered on the day of a pull session; the later one replaces nothing. */
const BODY_WEIGHT = { '2026-10-16': 78.4, '2026-11-06': 77.6 };

const dayOffset = (day, days) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const TRAINING = new Map();
for (let week = 0; week < 5; week += 1) {
  TRAINING.set(dayOffset(FIRST, week * 7 + 2), PUSH[week]);
  TRAINING.set(dayOffset(FIRST, week * 7 + 4), PULL[week]);
  TRAINING.set(dayOffset(FIRST, week * 7 + 6), LEGS[week]);
}

/** Two daily answers, invented: sleep and mood, each between 5 and 9. */
function answersOn(index) {
  const sleep = 6 + ((index * 5 + 2) % 4) - (index % 9 === 4 ? 1 : 0);
  const mood = 6 + ((index * 3 + 1) % 4) - (index % 11 === 7 ? 1 : 0);
  return [sleep, mood];
}

/* ── The clock ──────────────────────────────────────────────────────────── */

/** The instant at which `TZ` reads `day` at `hour`:`minute` — summer time ends on 25 October. */
function localInstant(day, hour, minute = 0) {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  for (const offset of ['+02:00', '+01:00']) {
    const instant = new Date(`${day}T${hh}:${mm}:00${offset}`);
    const read = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(instant);
    if (Number(read) === hour) return instant;
  }
  throw new Error(`no ${hh}:${mm} on ${day} in ${TZ}`);
}

/* ── Driving the live build ─────────────────────────────────────────────── */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(read, ok, { timeout = 10000, gap = 120 } = {}) {
  const started = Date.now();
  let value = await read();
  while (!ok(value) && Date.now() - started < timeout) {
    await sleep(gap);
    value = await read();
  }
  return value;
}
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const kgText = (kg) => String(kg);

const idb = (page, store) =>
  page.evaluate(async (name) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const rows = await new Promise((res, rej) => { const r = db.transaction([name], 'readonly').objectStore(name).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    db.close();
    return rows;
  }, store);

async function onboard(page) {
  await page.getByRole('button', { name: /Los geht/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  // Wellbeing starts chosen; Sport adds Gym and Running, and only Gym gets a target.
  await page.getByRole('button', { name: /^Sport/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  for (const question of [/Wie gut hast du gesch/, /Wie war deine Stimmung/]) {
    await page.getByRole('button', { name: question }).first().click();
  }
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.locator('.card').nth(0).getByRole('button', { name: '3 pro Woche' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Starten' }).click();
  await page.getByRole('button', { name: 'Session eintragen' }).waitFor();
}

async function answer(page, values) {
  const scales = page.locator('.answer-scale');
  await until(() => scales.count(), (count) => count === values.length);
  for (const [index, value] of values.entries()) {
    const option = scales.nth(index).locator('.answer-scale__value', { hasText: new RegExp(`^${value}$`) });
    await option.click();
    await until(() => option.getAttribute('aria-checked'), (checked) => checked === 'true');
  }
}

const card = (page, name) =>
  page.locator('.card', { has: page.locator('.gym-exercise__name', { hasText: new RegExp(`^${escape(name)}`) }) });

async function type(input, text) {
  await input.fill(text);
  await input.blur();
}

/** Adds `exercise` to the open workout and enters its sets, each as the interface takes it. */
async function logExercise(page, exercise, planned, day) {
  await page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
  await page.getByRole('textbox', { name: 'Suchen' }).fill(exercise.search);
  const row = page.locator('.gym-picker__row', {
    has: page.locator('.gym-picker__name', { hasText: new RegExp(`^${escape(exercise.name)}$`) }),
  });
  await row.first().click();
  const own = card(page, exercise.name);
  await own.waitFor();

  if (exercise.bodyweight && BODY_WEIGHT[day] !== undefined) {
    await page.locator('.gym-bodyweight__input').fill(kgText(BODY_WEIGHT[day]));
    await page.getByRole('button', { name: 'Gewicht sichern' }).click();
    await until(async () => (await idb(page, 'weightEntries')).filter((entry) => entry.date === day).length, (count) => count === 1);
  }

  const stored = async () =>
    (await idb(page, 'gymSets')).filter((record) => record.date === day && record.exerciseId === exercise.id).sort((a, b) => a.order - b.order);
  const rows = own.locator('.gym-set');
  for (const [index, wanted] of planned.entries()) {
    if (index > 0) {
      await own.getByRole('button', { name: new RegExp(`^Satz zu ${escape(exercise.name)} hinzufügen$`) }).click();
      await until(() => rows.count(), (count) => count === index + 1);
      await until(stored, (records) => records.length === index + 1);
    }
    const inputs = rows.nth(index).locator('input');
    const grams = Math.round(wanted.kg * 1000);
    // One field at a time, as a hand would: the screen reloads after every
    // write, and a field typed into before that reload is read back empty.
    // On a row that is not stored yet the weight is typed first — such a row
    // is saved by the field that completes it, and the reps complete it.
    const isStored = (await stored()).length > index;
    if ((!exercise.bodyweight || grams !== 0) && (await inputs.nth(1).inputValue()) !== kgText(wanted.kg)) {
      await type(inputs.nth(1), kgText(wanted.kg));
      if (isStored) await until(stored, (records) => records[index]?.weightGrams === grams);
      await page.waitForTimeout(160);
    }
    if (!isStored || (await inputs.nth(0).inputValue()) !== String(wanted.reps)) {
      await type(inputs.nth(0), String(wanted.reps));
    }
    const saved = await until(stored, (records) => records[index]?.reps === wanted.reps && records[index]?.weightGrams === grams);
    await page.waitForTimeout(160);
    if (saved[index]?.reps !== wanted.reps || saved[index]?.weightGrams !== grams) {
      throw new Error(`${day} ${exercise.name} set ${index + 1}: wanted ${wanted.reps} × ${wanted.kg}, stored ${JSON.stringify(saved[index])}`);
    }
  }
}

/* ── The run ────────────────────────────────────────────────────────────── */

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 1,
  hasTouch: true,
  acceptDownloads: true,
  timezoneId: TZ,
  locale: 'de-CH',
});
const errors = [];
const page = await ctx.newPage();
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(String(error)));

let plannedSets = 0;
let sessions = 0;
for (let index = 0, day = FIRST; day <= LAST; index += 1, day = dayOffset(day, 1)) {
  const training = TRAINING.get(day);
  // Every day is opened in the morning, a training day a little earlier.
  await ctx.clock.setSystemTime(localInstant(day, training ? 7 : 8, 10 + (index % 5) * 7));
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (index === 0) await onboard(page);
  await page.getByRole('button', { name: 'Session eintragen' }).waitFor();
  await answer(page, answersOn(index));

  if (training) {
    await page.getByRole('button', { name: 'Session eintragen' }).click();
    await page.getByRole('button', { name: /Übung hinzufügen/ }).first().waitFor();
    for (const [key, planned] of Object.entries(training)) {
      await logExercise(page, EXERCISES[key], planned, day);
      plannedSets += planned.length;
    }
    await page.getByRole('button', { name: 'Fertig' }).click();
    await page.getByRole('button', { name: /Session eintragen|Session öffnen|Training/ }).first().waitFor();
    sessions += 1;
  }
  const answers = (await idb(page, 'answers')).filter((record) => record.date === day).length;
  console.log(`${day}  ${training ? `${Object.keys(training).length} exercises` : 'no training'}  answers ${answers}`);
  if (answers !== 2) throw new Error(`${day}: ${answers} answers stored`);
}

/* ── The export, through the interface ──────────────────────────────────── */

await ctx.clock.setSystemTime(localInstant(LAST, 8, 30));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Bereiche' }).click();
const download = page.waitForEvent('download');
await page.getByText('Backup exportieren').click();
const file = await download;
mkdirSync(dirname(OUT), { recursive: true });
await file.saveAs(OUT);
const backup = JSON.parse(readFileSync(OUT, 'utf8'));
// One trailing newline, so the file is a text file to git.
writeFileSync(OUT, `${JSON.stringify(backup, null, 1)}\n`);

const count = (name) => backup.data[name]?.length ?? 0;
const report = {
  suggestedName: file.suggestedFilename(),
  format: backup.format,
  formatVersion: backup.formatVersion,
  schemaVersion: backup.schemaVersion,
  sessions: count('gymSessions'),
  sets: count('gymSets'),
  weights: count('weightEntries'),
  answers: count('answers'),
  snapshots: count('configSnapshots'),
  consoleErrors: errors.length,
};
console.log(JSON.stringify(report, null, 2));
if (errors.length) console.log(errors.slice(0, 5).join('\n'));
const ok =
  backup.format === 'momentum-backup' &&
  report.sessions === sessions &&
  report.sets === plannedSets &&
  report.weights === Object.keys(BODY_WEIGHT).length &&
  errors.length === 0;
await browser.close();
console.log(ok ? `written: ${OUT}` : 'the export does not hold what was entered');
process.exit(ok ? 0 : 1);
