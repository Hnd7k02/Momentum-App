import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import {
  CHROMIUM, URL_APP, onboard, seed, seedSheetProfile, openGymHub, openMuscles, openGroupSheet, closeGroupSheet, sheetExercises,
} from './lib.mjs';

/**
 * Not a suite: the import files of the check at STOP 7C, and their proof.
 *
 * The diary the earlier STOPs were checked on (`stage5b-live-backup.mjs`)
 * has every group rated and improved. Block 7C built a sheet that says five
 * things — a change, "uneinheitlich", too little to compare, not trained,
 * and a single observation — and a diary in which everything rises shows
 * one of them. So the file of this STOP is **the device the block's checks
 * and pictures run on** (`seedSheetProfile` in `lib.mjs`, with the one
 * exercise more that `stage7c-shots.mjs` adds), on the day it is made for,
 * exported by the build under test through its own "Backup exportieren".
 *
 * **Its rows were written into the database by this script, not typed
 * through the interface** — unlike the diary's. That is said beside the
 * files. What it is good for is Muskelgruppen and the Gym hub's card; Heute,
 * Verlauf and Rang show a device nobody lived on.
 *
 * For each day in `DAYS`:
 *
 * 1. a device on a clock that reads that morning in Zurich is set up,
 *    seeded, and its ten rows are read; then it exports its backup;
 * 2. a second, empty device on the same day imports the file through
 *    "Backup importieren" — and must show the same ten rows, and in the
 *    sheets the states the file is made for. Otherwise the script throws
 *    and the file is not to be handed over.
 *
 *   DAYS=2026-11-16,2026-11-17 OUT=docs/wp3/stage7c node scripts/verify/stage7c-check-files.mjs
 *
 * Against the production preview (`vite preview --port 4173`).
 */
const DAYS = (process.env.DAYS ?? '').split(',').filter(Boolean);
const OUT = process.env.OUT ?? 'docs/wp3/stage7c';
const TZ = 'Europe/Zurich';
if (DAYS.length === 0) throw new Error('DAYS=<yyyy-mm-dd>[,<yyyy-mm-dd>…] is required');
mkdirSync(OUT, { recursive: true });

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

const clean = (text) => (text ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const browser = await chromium.launch({ executablePath: CHROMIUM });

async function device(day, hour) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, timezoneId: TZ, locale: 'de-CH' });
  await ctx.clock.setSystemTime(localInstant(day, hour));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await onboard(page, { gym: 3, running: 2 });
  return { ctx, page, errors };
}

/** The ten rows as the screen prints them: name → what stands on the right. */
async function rowsOf(page) {
  await openGymHub(page);
  await openMuscles(page, { wait: 4500 });
  const rows = {};
  for (const row of await page.locator('.muscle-row').all()) {
    rows[clean(await row.locator('.muscle-row__name').textContent())] = clean(await row.locator('.muscle-row__right').textContent());
  }
  if (Object.keys(rows).length !== 10) throw new Error(`ten rows expected, ${Object.keys(rows).length} found`);
  const strip = clean(await page.locator('.muscle-strip').innerText());
  return { rows, strip };
}

/** What the sheets of the import must say: one per state the file is made for. */
const SHEETS = [
  { id: 'chest', name: 'Brust', must: [/\+2 %/, /Verbessert/, /Bankdrücken/, /Arbeitsvolumen pro Woche/, /nicht gewertet/] },
  { id: 'back', name: 'Rücken', must: [/uneinheitlich/, /mehr als zehn Prozentpunkte/] },
  { id: 'shoulders', name: 'Schultern', must: [/Noch nicht trainiert/, /Zuletzt trainiert am/, /Training erfassen/] },
  { id: 'biceps', name: 'Bizeps', must: [/Zu wenig Vergleichsdaten/, /Erfasst/, /Hammercurls/] },
  { id: 'core', name: 'Rumpf', must: [/−10 %/, /Zurückgegangen/] },
  { id: 'forearms', name: 'Unterarme', must: [/\+6 %/, /Verbessert/] },
  { id: 'triceps', name: 'Trizeps', must: [/Dips/, /Bankdrücken/] },
];

for (const day of DAYS) {
  const file = `${OUT}/momentum-pruefdaten-7c-${day}.json`;

  /* ── 1. The device, and its export ─────────────────────────────────────── */
  const made = await device(day, 8);
  await seed(made.page, { days: 90 });
  await seedSheetProfile(made.page, { divergent: true });
  await made.page.reload({ waitUntil: 'networkidle' });
  await made.page.waitForTimeout(1200);
  // The export first, from Bereiche where the app starts; the rows after it.
  await made.page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
  await made.page.waitForTimeout(700);
  const download = made.page.waitForEvent('download');
  await made.page.getByText('Backup exportieren').click();
  await (await download).saveAs(file);
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  // One trailing newline, so the file is a text file to git.
  writeFileSync(file, `${JSON.stringify(backup, null, 1)}\n`);
  const before = await rowsOf(made.page);
  if (made.errors.length) throw new Error(`${day}: page errors while making the file: ${made.errors.join(' | ')}`);
  await made.ctx.close();

  /* ── 2. Read back on an empty device ───────────────────────────────────── */
  const read = await device(day, 10);
  await read.page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
  await read.page.waitForTimeout(700);
  await read.page.locator('input[type="file"]').setInputFiles(file);
  const confirm = read.page.getByRole('button', { name: 'Ersetzen' });
  await confirm.waitFor();
  await confirm.click();
  await read.page.locator('.backup__status--ok').waitFor();
  const status = clean(await read.page.locator('.backup__status--ok').textContent());
  await read.page.waitForTimeout(1200);
  const after = await rowsOf(read.page);
  for (const [name, right] of Object.entries(before.rows)) {
    if (after.rows[name] !== right) throw new Error(`${day}: after the import "${name}" reads "${after.rows[name]}", the device it was made on read "${right}"`);
  }
  if (after.strip !== before.strip) throw new Error(`${day}: the strip reads "${after.strip}" after the import, "${before.strip}" before`);
  const sheets = {};
  for (const sheet of SHEETS) {
    await openGroupSheet(read.page, sheet.id);
    const text = clean(await read.page.locator('.sheet--detents').innerText());
    for (const want of sheet.must) {
      if (!want.test(text)) throw new Error(`${day}: the sheet of ${sheet.name} does not say ${want}: "${text.slice(0, 300)}"`);
    }
    sheets[sheet.name] = (await sheetExercises(read.page)).map((entry) => `${entry.name} ${entry.change ?? ''} ${entry.word ?? ''}`.trim());
    await closeGroupSheet(read.page);
  }
  if (read.errors.length) throw new Error(`${day}: page errors after the import: ${read.errors.join(' | ')}`);
  await read.ctx.close();

  const count = (name) => backup.data?.[name]?.length ?? 0;
  console.log(`\n=== ${day} → ${file}`);
  console.log(`format ${backup.formatVersion ?? backup.format ?? '?'} · ${count('gymSessions')} sessions · ${count('gymSets')} sets · ${count('answers')} answers · ${count('weightEntries')} weights`);
  console.log(`import: ${status}`);
  console.log(`strip: ${after.strip}`);
  for (const [name, right] of Object.entries(after.rows)) console.log(`  ${name.padEnd(24)} ${right}`);
  for (const [name, list] of Object.entries(sheets)) console.log(`  sheet ${name}: ${list.join(' · ') || '(no exercise with a change)'}`);
}
await browser.close();
console.log(`\n${DAYS.length} file(s) made and read back: every row the same after the import.`);
