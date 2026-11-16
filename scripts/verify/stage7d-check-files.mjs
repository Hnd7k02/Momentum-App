import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, onboard, openMuscles } from './lib.mjs';

/**
 * Not a suite: the import files of the check at STOP 7D, and their proof.
 *
 * Block 7D is about a device that already exists: a user who trains, has a
 * plan and an exercise of their own, and opens the new build. So the file of
 * this STOP is **made by the live build** (the default branch, `e30becd`,
 * with the 49 exercises it ships), not by the build under test:
 *
 * 1. the live build, on a clock that reads that day at noon in Zurich,
 *    imports the training diary of the earlier STOPs for that day
 *    (`docs/wp3/stage7b/`, typed through the live build's own interface),
 *    then — through its interface again — makes a plan "Oberkörper" of
 *    Bankdrücken, Latzug and an exercise of the user's own, "Zercher
 *    Squat", and exports its backup through "Backup exportieren";
 * 2. the build before this block (`BEFORE_URL`) and the build under test
 *    (`URL_APP`) each import the file on an empty device of that day, and
 *    must show the same Gym rating, the same ten rows and the same plan —
 *    the catalogue may not move a figure — while the build under test
 *    offers every exercise of its catalogue and the user's own beside them,
 *    and finds the user's own by its name. Otherwise the script throws and
 *    the file is not to be handed over.
 *
 *   (cd <live worktree> && npx vite preview --port 4273 --strictPort) &
 *   LIVE_URL=http://127.0.0.1:4273/Momentum-App/ BEFORE_URL=<7C build> URL_APP=<7D build> \
 *     DAYS=2026-11-17,2026-11-18 OUT=docs/wp3/stage7d node scripts/verify/stage7d-check-files.mjs
 */
const LIVE_URL = process.env.LIVE_URL ?? 'http://127.0.0.1:4273/Momentum-App/';
const BEFORE_URL = process.env.BEFORE_URL ?? 'http://127.0.0.1:4173/Momentum-App/';
const DAYS = (process.env.DAYS ?? '').split(',').filter(Boolean);
const OUT = process.env.OUT ?? 'docs/wp3/stage7d';
const DIARY = process.env.DIARY ?? 'docs/wp3/stage7b';
const TZ = 'Europe/Zurich';
if (DAYS.length === 0) throw new Error('DAYS=<yyyy-mm-dd>[,<yyyy-mm-dd>…] is required');
mkdirSync(OUT, { recursive: true });

/** The catalogue of the build under test, read from its source: every entry offered. */
const OFFERED = readFileSync('src/core/gym/catalogue.ts', 'utf8')
  .split('\n')
  .filter((line) => /^\s*\{ id: 'ex_/.test(line) && !/deprecated: true/.test(line)).length;
const OWN = 'Zercher Squat';
const PLAN = 'Oberkörper';
const PLAN_EXERCISES = [['Bankdr', 'Bankdrücken'], ['Latzug', 'Latzug']];

/** The instant at which `TZ` reads `day` at `hour`:`minute`. */
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

const clean = (text) => (text ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
/** The rating's figure out of the hub's headline ("Gym-Rating821 von 1000…"). */
const figure = (text) => /(\d+)\s*von/.exec(text)?.[1] ?? text;
const tab = (page, name) => page.locator('.tab-bar button', { hasText: name });
const browser = await chromium.launch({ executablePath: CHROMIUM });

/** The live build's onboarding (iteration 2): Wellbeing and Gym, three a week. */
async function onboardLive(page) {
  await page.getByRole('button', { name: /Los geht/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: /^Sport/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  for (const question of [/Wie gut hast du gesch/, /Wie war deine Stimmung/]) {
    await page.getByRole('button', { name: question }).first().click();
  }
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.locator('.card').nth(0).getByRole('button', { name: '3 pro Woche' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Starten' }).click();
  await page.waitForTimeout(900);
}

async function device(url, day, hour, minute, setup) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, timezoneId: TZ, locale: 'de-CH' });
  await ctx.clock.setSystemTime(localInstant(day, hour, minute));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await setup(page);
  return { ctx, page, errors };
}

/** Imports a file through the build's own "Backup importieren" and confirms the replacement. */
async function importFile(page, file) {
  await tab(page, 'Bereiche').click();
  await page.waitForTimeout(700);
  await page.locator('input[type="file"]').setInputFiles(file);
  const confirm = page.getByRole('button', { name: 'Ersetzen' });
  await confirm.waitFor();
  await confirm.click();
  await page.locator('.backup__status--ok').waitFor();
  const status = clean(await page.locator('.backup__status--ok').textContent());
  await page.waitForTimeout(1000);
  // As the owner's next visit: the app starts again from what was imported.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return status;
}

async function gymHub(page) {
  await tab(page, 'Bereiche').click();
  await page.waitForTimeout(600);
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(1500);
}

async function pick(page, query, name) {
  await page.getByRole('textbox', { name: 'Suchen' }).fill(query);
  await page.waitForTimeout(400);
  await page.locator('.gym-picker__row').filter({ has: page.locator('.gym-picker__name', { hasText: new RegExp(`^${name}$`) }) }).first().click();
  await page.waitForTimeout(600);
}

/** The plans as the hub lists them, with their exercises in order, read from the editor. */
async function plansOf(page) {
  await gymHub(page);
  const plan = page.locator('button, [role="button"]', { hasText: PLAN }).first();
  await plan.click();
  await page.waitForTimeout(700);
  // The live build opens the plan's editor, a later one its view with an "Bearbeiten".
  const edit = page.getByRole('button', { name: 'Bearbeiten' });
  if (await edit.count()) {
    await edit.first().click();
    await page.waitForTimeout(600);
  }
  const lines = (await page.locator('.plan-editor__name').allTextContents()).map(clean);
  return lines;
}

for (const day of DAYS) {
  const diary = `${DIARY}/momentum-pruefdaten-7b-${day}.json`;
  const file = `${OUT}/momentum-pruefdaten-7d-${day}.json`;

  /* ── 1. The live build: the diary, a plan, an exercise of one's own, the export ── */
  const live = await device(LIVE_URL, day, 12, 0, onboardLive);
  await importFile(live.page, diary);
  await gymHub(live.page);
  await live.page.getByRole('button', { name: 'Neuer Plan' }).click();
  await live.page.waitForTimeout(500);
  await live.page.getByLabel('Name des Plans').fill(PLAN);
  for (const [query, name] of PLAN_EXERCISES) {
    await live.page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
    await live.page.locator('.gym-picker__row').first().waitFor();
    await pick(live.page, query, name);
  }
  // The user's own exercise, made from the plan's picker as a user makes it.
  await live.page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
  await live.page.locator('.gym-picker__row').first().waitFor();
  await live.page.getByRole('button', { name: 'Eigene Übung' }).click();
  await live.page.waitForTimeout(400);
  await live.page.locator('#exercise-name').fill(OWN);
  const muscles = live.page.getByRole('group', { name: 'Muskelgruppen' }).first();
  await muscles.getByRole('button', { name: 'Quadrizeps' }).click();
  await muscles.getByRole('button', { name: 'Rumpf' }).click();
  await live.page.getByRole('group', { name: /Hauptmuskel/ }).getByRole('button', { name: 'Quadrizeps' }).click();
  await live.page.locator('.sheet__footer').getByRole('button', { name: 'Hinzufügen' }).click();
  await live.page.waitForTimeout(700);
  const madeLines = (await live.page.locator('.plan-editor__name').allTextContents()).map(clean);
  await live.page.getByRole('button', { name: 'Plan sichern' }).click();
  await live.page.waitForTimeout(800);
  if (JSON.stringify(madeLines) !== JSON.stringify(['Bankdrücken', 'Latzug', OWN])) throw new Error(`${day}: the plan was made with ${madeLines.join(' | ')}`);
  const liveRating = clean(await live.page.locator('[data-metric="gym-rating"]').first().textContent().catch(() => ''));

  await live.page.reload({ waitUntil: 'networkidle' });
  await live.page.waitForTimeout(1000);
  await tab(live.page, 'Bereiche').click();
  await live.page.waitForTimeout(700);
  const download = live.page.waitForEvent('download');
  await live.page.getByText('Backup exportieren').click();
  await (await download).saveAs(file);
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(file, `${JSON.stringify(backup, null, 1)}\n`);
  if (live.errors.length) throw new Error(`${day}: page errors on the live build: ${live.errors.join(' | ')}`);
  await live.ctx.close();
  const own = backup.data.exercises.filter((exercise) => exercise.builtIn === false);
  if (own.length !== 1 || own[0].name !== OWN) throw new Error(`${day}: the file holds ${own.length} exercises of the user's own`);
  if (backup.data.gymPlans.length !== 1) throw new Error(`${day}: the file holds ${backup.data.gymPlans.length} plans`);

  /* ── 2. Read back: the build before the block and the build under test ── */
  const seen = {};
  for (const [label, url] of [['vorher', BEFORE_URL], ['7d', URL_APP]]) {
    const read = await device(url, day, 12, 30, (page) => onboard(page, { gym: 3, running: 0 }));
    const status = await importFile(read.page, file);
    await gymHub(read.page);
    const rating = clean(await read.page.locator('[data-metric="gym-rating"]').first().textContent());
    await openMuscles(read.page, { wait: 4500 });
    const rows = {};
    for (const row of await read.page.locator('.muscle-row').all()) {
      rows[clean(await row.locator('.muscle-row__name').textContent())] = clean(await row.locator('.muscle-row__right').textContent());
    }
    const strip = clean(await read.page.locator('.muscle-strip').innerText());
    const plan = await plansOf(read.page);
    // The picker of the plan: every exercise on offer, and the user's own found by its name.
    await read.page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
    await read.page.locator('.gym-picker__row').first().waitFor();
    await read.page.waitForTimeout(400);
    const offered = await read.page.locator('.gym-picker__row').count();
    await read.page.getByRole('textbox', { name: 'Suchen' }).fill('zercher');
    await read.page.waitForTimeout(400);
    const found = (await read.page.locator('.gym-picker__name').allTextContents()).map(clean);
    const stored = await read.page.evaluate(async () => {
      const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const all = (store) => new Promise((res, rej) => { const r = db.transaction([store], 'readonly').objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const out = { exercises: await all('exercises'), sets: (await all('gymSets')).length, sessions: (await all('gymSessions')).length };
      db.close();
      return out;
    });
    if (read.errors.length) throw new Error(`${day} ${label}: page errors: ${read.errors.join(' | ')}`);
    await read.ctx.close();
    seen[label] = { status, rating, rows, strip, plan, offered, found, stored };
  }

  const { vorher, '7d': neu } = seen;
  const fail = (what) => { throw new Error(`${day}: ${what}`); };
  if (Object.keys(neu.rows).length !== 10) fail(`ten rows expected, ${Object.keys(neu.rows).length} found`);
  if (neu.rating !== vorher.rating) fail(`the Gym rating reads ${neu.rating} on the build under test, ${vorher.rating} before it`);
  for (const [name, right] of Object.entries(vorher.rows)) if (neu.rows[name] !== right) fail(`"${name}" reads "${neu.rows[name]}", before the block "${right}"`);
  if (neu.strip !== vorher.strip) fail(`the strip reads "${neu.strip}", before the block "${vorher.strip}"`);
  for (const [label, entry] of Object.entries(seen)) {
    if (JSON.stringify(entry.plan) !== JSON.stringify(['Bankdrücken', 'Latzug', OWN])) fail(`${label}: the plan reads ${entry.plan.join(' | ')}`);
    if (!entry.found.includes(OWN)) fail(`${label}: «zercher» does not find the user's own exercise: ${entry.found.join(' | ')}`);
    if (entry.stored.sets !== backup.data.gymSets.length || entry.stored.sessions !== backup.data.gymSessions.length) fail(`${label}: ${entry.stored.sets} sets and ${entry.stored.sessions} sessions after the import`);
  }
  if (neu.offered !== OFFERED + 1) fail(`the picker offers ${neu.offered} exercises, the catalogue ${OFFERED} and the user's own one`);
  // Every stored entry of the file stands as it was, byte for byte.
  const byId = new Map(neu.stored.exercises.map((exercise) => [exercise.id, exercise]));
  for (const exercise of backup.data.exercises) {
    if (JSON.stringify(byId.get(exercise.id)) !== JSON.stringify(exercise)) fail(`${exercise.id} changed: ${JSON.stringify(byId.get(exercise.id))}`);
  }

  console.log(`\n=== ${day} → ${file}`);
  console.log(`${backup.data.gymSessions.length} sessions · ${backup.data.gymSets.length} sets · ${backup.data.exercises.length} exercises stored (one the user's own) · ${backup.data.gymPlans.length} plan`);
  console.log(`live build: rating ${figure(liveRating) || '(not on the hub)'}`);
  console.log(`before the block: ${vorher.status} · rating ${figure(vorher.rating)} · ${vorher.offered} exercises offered`);
  console.log(`build under test: ${neu.status} · rating ${figure(neu.rating)} · ${neu.offered} exercises offered (${OFFERED} of the catalogue and the user's own) · ${neu.stored.exercises.length} stored`);
  console.log(`plan: ${neu.plan.join(' · ')}`);
  console.log(`strip: ${neu.strip}`);
  for (const [name, right] of Object.entries(neu.rows)) console.log(`  ${name.padEnd(24)} ${right}`);
}
await browser.close();
console.log(`\n${DAYS.length} file(s) made by the live build and read back: the same rating, rows and plan before and after the block.`);
