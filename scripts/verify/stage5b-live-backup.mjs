import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright-core';
import { CHROMIUM } from './lib.mjs';
import { BODY_WEIGHT_ON_DAY, EXERCISES, FIRST_DAY, STAGE5B_LAST_DAY, answersOn, dayOffset, trainingBetween } from './pruefdaten-plan.mjs';

/**
 * WP3, Stage 5b — a backup with Gym sets, made by the live build itself.
 *
 * No backup with a single Gym set exists in either repository, and the owner
 * attached none. So this script does what he would do: it opens the live
 * build (the default branch, `e30becd`, built in a worktree of its own and
 * served on its own port), walks its onboarding, and logs weeks of training
 * through its own workout screen — one day at a time on a clock that moves
 * from `FIRST` to `LAST` — and then taps "Backup exportieren". Nothing is
 * written to its database from outside: every answer, session, set and
 * weight entry is one the interface saved.
 *
 *   git worktree add <dir> e30becd && (cd <dir> && npm ci && npm run build)
 *   (cd <dir> && npx vite preview --port 4273 --strictPort) &
 *   LIVE_URL=http://127.0.0.1:4273/Momentum-App/ \
 *     OUT=docs/wp3/stage5b/momentum-pruefdaten-5b.json \
 *     node scripts/verify/stage5b-live-backup.mjs
 *
 * **`FIRST`, `LAST` and `OUT` are its parameters.** Without them it makes the
 * file of Stage 5b: 12 October to 15 November 2026, five weeks, 194 sets.
 * With a later `LAST` it makes the same diary carried on by its own rule to
 * that day — the import file of a later STOP (block "Kurve":
 * `LAST=<the day of the STOP> OUT=docs/wp3/kurve/momentum-pruefdaten-kurve.json`).
 * `FIRST` is a Monday.
 *
 * The file serves twice. It is the trial run of a number report — the report
 * of Stage 5b reads it (`STAGE5B_BACKUP`) — and it is the import file of the
 * owner's iPhone check: loaded into the live app and into the preview it
 * shows the same weeks under the old rules and under the new ones.
 *
 * The plan is `pruefdaten-plan.mjs`: a push / pull / legs week — Wednesday,
 * Friday, Sunday, in the morning, **the last session on the day the file was
 * made**, so that the owner's check does not open on a training break —
 * whose first five weeks hold each case the Stage 5b metric was changed
 * for, and which goes on from the sixth by double progression.
 *
 * Every figure is invented. It is a training diary nobody kept.
 *
 * **The update profile** (block 9, step 4): three switches add what a device
 * on the live build holds besides and the update has to carry — `FOOD=1`
 * switches Ernährung on in the onboarding, writes a Vorsatz and rates every
 * day on its own card; `RUNS=1` gives Laufen a target of two and logs a run
 * on Tuesdays and Saturdays, with distance and time in its sheet; `PLAN=1`
 * saves a training plan on the first day and starts one workout a week from
 * it. Without them the script does exactly what it did for Stage 5b.
 *
 *   FIRST=2026-09-28 LAST=2026-11-17 FOOD=1 RUNS=1 PLAN=1 \
 *     OUT=.github/fixtures/wp3-update/live-profile.json node scripts/verify/stage5b-live-backup.mjs
 */
const URL = process.env.LIVE_URL ?? 'http://127.0.0.1:4273/Momentum-App/';
const OUT = process.env.OUT ?? 'docs/wp3/stage5b/momentum-pruefdaten-5b.json';
const TZ = 'Europe/Zurich';
const WITH_FOOD = process.env.FOOD === '1';
const WITH_RUNS = process.env.RUNS === '1';
const WITH_PLAN = process.env.PLAN === '1';

/* ── The plan ───────────────────────────────────────────────────────────── */

const FIRST = process.env.FIRST ?? FIRST_DAY; // a Monday: the week has its target from its first day
const LAST = process.env.LAST ?? STAGE5B_LAST_DAY; // the day the file is made, and its last session
/** Day → workout, in `pruefdaten-plan.mjs`: the five weeks written by hand, then their rule. */
const TRAINING = trainingBetween(FIRST, LAST);
/** A body weight is entered on the day of a pull session; the later one replaces nothing. */
const BODY_WEIGHT = Object.fromEntries(
  Object.entries(BODY_WEIGHT_ON_DAY)
    .map(([offset, kg]) => [dayOffset(FIRST, Number(offset)), kg])
    .filter(([day]) => day <= LAST),
);
if (new Date(`${FIRST}T12:00:00Z`).getUTCDay() !== 1) throw new Error(`FIRST must be a Monday: ${FIRST}`);
for (const day of Object.keys(BODY_WEIGHT)) {
  if (!Object.values(TRAINING.get(day) ?? {}).length || !('pullUp' in TRAINING.get(day))) throw new Error(`no pull session on ${day} to enter a body weight on`);
}

/* ── The update profile's additions (block 9, step 4) ───────────────────── */

/** Food's 1–10 for the day of `index`: mostly 6 to 9, a lapse every ninth day. */
const foodOn = (index) => (index % 9 === 5 ? 4 : 6 + ((index * 7 + 3) % 4));
/** A run on Tuesday (5.2 km) and Saturday (8.1 km), a little quicker most weeks. */
function runOn(day, index) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const week = Math.floor(index / 7);
  if (weekday === 2) return { km: '5.2', minutes: String(30 - (week % 3)) };
  if (weekday === 6) return { km: '8.1', minutes: String(48 - (week % 4)) };
  return null;
}
/** The plan saved on the first day, and the weekday its workout is started from it. */
const PLAN = { name: 'Push', exercises: ['bench', 'press', 'pushdown'] };

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
  if (WITH_FOOD) await page.getByRole('button', { name: /^Ernährung/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  for (const question of [/Wie gut hast du gesch/, /Wie war deine Stimmung/]) {
    await page.getByRole('button', { name: question }).first().click();
  }
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.locator('.card').nth(0).getByRole('button', { name: '3 pro Woche' }).click();
  if (WITH_RUNS) await page.locator('.card').nth(1).getByRole('button', { name: '2 pro Woche' }).click();
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

/** Ernährung's Vorsatz, written once in its area. */
async function writeFoodFocus(page) {
  await page.getByRole('button', { name: 'Bereiche' }).click();
  await page.getByRole('radio', { name: 'Ernährung' }).click();
  await page.locator('.food-focus__input').fill('Zmittag selber kochen');
  await page.getByRole('button', { name: 'Vorsatz sichern' }).click();
  // The Vorsatz lives in the Food domain's settings.
  const focus = await until(
    async () => (await idb(page, 'domains')).find((domain) => domain.type === 'food')?.settings?.focus ?? '',
    (text) => text === 'Zmittag selber kochen',
  );
  if (focus !== 'Zmittag selber kochen') throw new Error(`the Vorsatz was not saved: ${JSON.stringify(focus)}`);
}

/** The plan, saved through the Gym hub's editor. */
async function savePlan(page) {
  await page.getByRole('button', { name: 'Bereiche' }).click();
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.getByLabel('Name des Plans').fill(PLAN.name);
  for (const key of PLAN.exercises) {
    await page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
    await page.getByRole('textbox', { name: 'Suchen' }).fill(EXERCISES[key].search);
    await page.locator('.gym-picker__row', { has: page.locator('.gym-picker__name', { hasText: new RegExp(`^${escape(EXERCISES[key].name)}$`) }) }).first().click();
  }
  await page.getByRole('button', { name: 'Plan sichern' }).click();
  await until(async () => (await idb(page, 'gymPlans')).length, (count) => count === 1);
}

/** A run, one tap on Heute, then its distance and time in its sheet. */
async function logRun(page, day, run) {
  const before = (await idb(page, 'runs')).length;
  await page.getByRole('button', { name: 'Lauf eintragen' }).click();
  const stored = await until(async () => (await idb(page, 'runs')).filter((entry) => entry.date === day), (rows) => rows.length === 1);
  if (stored.length !== 1 || (await idb(page, 'runs')).length !== before + 1) throw new Error(`${day}: the run was not stored`);
  await page.locator('.training-session, .today__session, button').filter({ hasText: /^Lauf/ }).first().click();
  await page.locator('#session-distance').waitFor();
  await page.locator('#session-distance').fill(run.km);
  await page.locator('#session-duration').fill(run.minutes);
  await page.getByRole('button', { name: 'Speichern' }).click();
  const saved = await until(async () => (await idb(page, 'runs')).find((entry) => entry.date === day), (entry) => entry?.distanceMetres > 0 && entry?.durationSeconds > 0);
  if (!(saved?.distanceMetres > 0)) throw new Error(`${day}: the run's distance was not saved`);
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
let runs = 0;
let days = 0;
for (let index = 0, day = FIRST; day <= LAST; index += 1, day = dayOffset(day, 1)) {
  const training = TRAINING.get(day);
  // Every day is opened in the morning, a training day a little earlier.
  await ctx.clock.setSystemTime(localInstant(day, training ? 7 : 8, 10 + (index % 5) * 7));
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (index === 0) {
    await onboard(page);
    if (WITH_FOOD) await writeFoodFocus(page);
    if (WITH_PLAN) await savePlan(page);
    if (WITH_FOOD || WITH_PLAN) await page.goto(URL, { waitUntil: 'networkidle' });
  }
  await page.getByRole('button', { name: 'Session eintragen' }).waitFor();
  await answer(page, WITH_FOOD ? [...answersOn(index), foodOn(index)] : answersOn(index));
  const run = WITH_RUNS ? runOn(day, index) : null;
  if (run) {
    await logRun(page, day, run);
    runs += 1;
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Session eintragen' }).waitFor();
  }

  if (training) {
    await page.getByRole('button', { name: 'Session eintragen' }).click();
    // With a plan saved, the button asks which workout: a free one here.
    const free = page.locator('[role="dialog"]').getByRole('button', { name: 'Freie Session' });
    if (WITH_PLAN && (await free.count().catch(() => 0)) > 0) await free.click();
    await page.getByRole('button', { name: /Übung hinzufügen/ }).first().waitFor();
    for (const [key, planned] of Object.entries(training)) {
      await logExercise(page, EXERCISES[key], planned, day);
      plannedSets += planned.length;
    }
    await page.getByRole('button', { name: 'Fertig' }).click();
    await page.getByRole('button', { name: /Session eintragen|Session öffnen|Training/ }).first().waitFor();
    sessions += 1;
  }
  days += 1;
  const answers = (await idb(page, 'answers')).filter((record) => record.date === day).length;
  console.log(`${day}  ${training ? `${Object.keys(training).length} exercises` : 'no training'}  answers ${answers}`);
  if (answers !== 2) throw new Error(`${day}: ${answers} answers stored`);
  if (WITH_FOOD) {
    const rated = (await idb(page, 'foodDays')).filter((record) => record.date === day).length;
    if (rated !== 1) throw new Error(`${day}: ${rated} Food ratings stored`);
  }
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
  runs: count('runs'),
  plans: count('gymPlans'),
  foodDays: count('foodDays'),
  consoleErrors: errors.length,
};
console.log(JSON.stringify(report, null, 2));
if (errors.length) console.log(errors.slice(0, 5).join('\n'));
const ok =
  backup.format === 'momentum-backup' &&
  report.sessions === sessions &&
  report.sets === plannedSets &&
  report.weights === Object.keys(BODY_WEIGHT).length &&
  (!WITH_RUNS || report.runs === runs) &&
  (!WITH_PLAN || report.plans === 1) &&
  (!WITH_FOOD || report.foodDays === days) &&
  errors.length === 0;
await browser.close();
console.log(ok ? `written: ${OUT}` : 'the export does not hold what was entered');
process.exit(ok ? 0 : 1);
