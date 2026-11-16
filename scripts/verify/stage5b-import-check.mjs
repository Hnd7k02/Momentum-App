import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, onboard, summary } from './lib.mjs';

/**
 * WP3, Stage 5b — the import file, as the owner will see it.
 *
 * The owner loads `docs/wp3/stage5b/momentum-pruefdaten-5b.json` into the
 * live app and into the preview and compares the two. This script does that
 * first, on a clock, so that the figures in the STOP report are read off the
 * two builds and not worked out beside them:
 *
 * - the live build (`e30becd`, served from a worktree — see
 *   `stage5b-live-backup.mjs`) imports the file through its own "Backup
 *   importieren" and shows the five weeks by the old metric;
 * - the build under test imports the same file the same way. That first load
 *   is the update: one snapshot from that day carries the one-day window, the
 *   end of Food and the new metric, and nothing before it moves.
 *
 * Read off each: the Gym rating, the ten muscle rows at both ranges, the
 * exercise list and the detail of Bankdrücken and Kniebeuge.
 *
 *   LIVE_URL=http://127.0.0.1:4273/Momentum-App/ DAYS=2026-11-15,2026-11-18 \
 *     OUT=<dir> node scripts/verify/stage5b-import-check.mjs
 *
 * It writes `<OUT>/import-check.json` and screenshots, and checks what must
 * hold whatever the day: the import is accepted by both, both hold the same
 * sets, the new build wrote exactly one snapshot, and the day of the weight
 * increase is a fall of a sixth in the live build and of a hundredth here.
 */
const LIVE_URL = process.env.LIVE_URL ?? 'http://127.0.0.1:4273/Momentum-App/';
const FILE = process.env.FILE ?? 'docs/wp3/stage5b/momentum-pruefdaten-5b.json';
const OUT = process.env.OUT ?? 'docs/design/wp3/stage5b';
const DAYS = (process.env.DAYS ?? '2026-11-15').split(',');
const TZ = 'Europe/Zurich';
mkdirSync(OUT, { recursive: true });

const backup = JSON.parse(readFileSync(FILE, 'utf8'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(read, ok, { timeout = 10000, gap = 150 } = {}) {
  const started = Date.now();
  let value = await read();
  while (!ok(value) && Date.now() - started < timeout) {
    await sleep(gap);
    value = await read();
  }
  return value;
}
const clean = (text) => (text ?? '').replace(/\s+/g, ' ').trim();
const texts = async (locator) => (await locator.allTextContents()).map(clean);

function localInstant(day, hour) {
  for (const offset of ['+02:00', '+01:00']) {
    const instant = new Date(`${day}T${String(hour).padStart(2, '0')}:00:00${offset}`);
    const read = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(instant);
    if (Number(read) === hour) return instant;
  }
  throw new Error(`no ${hour}:00 on ${day}`);
}

const idb = (page, name, store) =>
  page.evaluate(async ([db, s]) => {
    const open = await new Promise((res, rej) => { const r = indexedDB.open(db); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const rows = await new Promise((res, rej) => { const r = open.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    open.close();
    return rows;
  }, [name, store]);

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

const tab = (page, name) => page.locator('.tab-bar button', { hasText: name });

/** Imports `FILE` through the build's own interface and confirms the replacement. */
async function importFile(page) {
  await tab(page, 'Bereiche').click();
  await page.waitForTimeout(700);
  await page.locator('input[type="file"]').setInputFiles(FILE);
  const confirm = page.getByRole('button', { name: 'Ersetzen' });
  await confirm.waitFor();
  await confirm.click();
  await page.locator('.backup__status--ok').waitFor();
  return clean(await page.locator('.backup__status--ok').textContent());
}

/** Bereiche → Gym, on the hub. */
async function openGymArea(page) {
  await tab(page, 'Bereiche').click();
  await page.waitForTimeout(600);
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(1200);
}

async function muscleRows(page) {
  await until(() => page.locator('.muscle-row').count(), (count) => count === 10);
  await page.waitForTimeout(700);
  const rows = {};
  for (const row of await page.locator('.muscle-row').all()) {
    const name = clean(await row.locator('.muscle-row__name').textContent());
    rows[name] = clean(await row.locator('.muscle-row__right').textContent());
  }
  return rows;
}

/** The group whose sheet lists each exercise the check opens (block 7C). */
const GROUP_OF = { 'Bankdrücken': 'Brust', Kniebeuge: 'Quadrizeps', Latzug: 'Rücken' };

/**
 * One exercise's detail. Until block 7C a list of every exercise stood
 * under the ten rows — the live build still has it — and since then an
 * exercise is opened from the sheet of its group.
 */
async function exerciseDetail(page, name) {
  const listed = page.locator('.gym-progress__row', { hasText: name });
  const fromSheet = (await listed.count()) === 0;
  let sheet = null;
  if (fromSheet) {
    await page.locator('.muscle-row__button').filter({ has: page.locator('.muscle-row__name', { hasText: new RegExp(`^${GROUP_OF[name]}$`) }) }).click();
    await page.locator('.sheet--detents').waitFor();
    await page.waitForFunction(() => document.querySelector('.body-viewer')?.hasAttribute('data-held') ?? true, null, { timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    sheet = clean(await page.locator('.sheet--detents').innerText());
    const row = page.locator('.sheet--detents .muscle-sheet__exercise', { hasText: name }).first();
    await row.scrollIntoViewIfNeeded();
    await row.click();
  } else {
    await listed.first().scrollIntoViewIfNeeded();
    await listed.first().click();
  }
  await page.locator('.gym-detail').waitFor();
  await page.waitForTimeout(600);
  const figures = [
    ...(await texts(page.locator('.gym-detail__head'))),
    ...(await texts(page.locator('.gym-detail__caption'))),
    ...(await texts(page.locator('.gym-detail__figure'))),
  ];
  const days = await page.evaluate(() =>
    [...document.querySelectorAll('.gym-detail .visually-hidden tbody tr')].map((tr) =>
      [...tr.querySelectorAll('th, td')].map((cell) => cell.textContent.replace(/\s+/g, ' ').trim()),
    ),
  );
  return { figures, days, sheet, fromSheet };
}

/** Leaves the detail: back to the list, or to the sheet and then out of it. */
async function leaveDetail(page, fromSheet) {
  await page.locator('.gym-detail .gym-session__back').click();
  await page.waitForTimeout(700);
  if (!fromSheet) return;
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.sheet-scrim'), null, { timeout: 5000 }).catch(() => undefined);
  await page.waitForFunction(() => { const v = document.querySelector('.body-viewer'); return !v || (!v.hasAttribute('data-held') && v.dataset.zoom === '1'); }, null, { timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(400);
}

async function read(build, day, label) {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, timezoneId: TZ, locale: 'de-CH' });
  await ctx.clock.setSystemTime(localInstant(day, 10));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(build.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await build.onboard(page);
  const status = await importFile(page);
  await page.waitForTimeout(1200);
  // A reload, as the owner's next visit is: nothing may be written by it.
  const before = await idb(page, build.db, 'configSnapshots');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const snapshots = await idb(page, build.db, 'configSnapshots');
  const stored = { sets: (await idb(page, build.db, 'gymSets')).length, sessions: (await idb(page, build.db, 'gymSessions')).length };

  await openGymArea(page);
  const rating = clean(await page.locator('[data-metric="gym-rating"]').first().textContent());
  await page.screenshot({ path: `${OUT}/import-${label}-${day}-hub.png` });

  await page.getByRole('button', { name: 'Muskelgruppen öffnen' }).click();
  await page.waitForTimeout(4500);
  const muscles = {};
  const overall = {};
  // The metrics strip above the body (block 7B): its three cells, where a build has it.
  const strip = {};
  // The live build offers 7 and 30 days, the build under test 30 and 90
  // (D164): 30 days is the one range the two can be compared on.
  const offered = (await texts(page.locator('.progress__ranges button'))).map((label) => Number.parseInt(label, 10));
  for (const range of offered) {
    await page.locator('.progress__ranges button', { hasText: new RegExp(`^${range} Tage$`) }).click();
    await page.waitForTimeout(1500);
    muscles[range] = await muscleRows(page);
    overall[range] = clean(await page.locator('[data-metric="gym-overall"]').first().textContent().catch(() => ''));
    strip[range] = await page.evaluate(() =>
      [...document.querySelectorAll('.muscle-strip__cell')].map((cell) =>
        [...cell.querySelectorAll('.muscle-strip__label, .muscle-strip__value, .muscle-strip__sub')]
          .map((part) => part.textContent.replace(/\s+/g, ' ').trim())
          .join(' | '),
      ),
    );
    await page.screenshot({ path: `${OUT}/import-${label}-${day}-muskeln-${range}.png`, fullPage: false });
  }
  await page.locator('.progress__ranges button', { hasText: /^30 Tage$/ }).click();
  await page.waitForTimeout(1500);
  const list = await texts(page.locator('.gym-progress__row'));
  const details = {};
  for (const name of ['Bankdrücken', 'Kniebeuge', 'Latzug']) {
    details[name] = await exerciseDetail(page, name);
    await page.screenshot({ path: `${OUT}/import-${label}-${day}-${name.toLowerCase().replace('ü', 'ue')}.png` });
    await leaveDetail(page, details[name].fromSheet);
  }
  await browser.close();
  return { status, snapshots, wroteOnReload: snapshots.length - before.length, stored, rating, muscles, overall, strip, list, details, errors };
}

const BUILDS = {
  live: { url: LIVE_URL, db: 'momentum', onboard: onboardLive },
  neu: { url: URL_APP, db: process.env.DB_NAME ?? 'momentum', onboard: (page) => onboard(page, { gym: 3, running: 0 }) },
};

const result = {};
for (const day of DAYS) {
  result[day] = {};
  for (const [label, build] of Object.entries(BUILDS)) {
    const seen = await read(build, day, label);
    result[day][label] = seen;
    const W = `${day} ${label}`;
    check(`${W}: the import is accepted`, seen.status.length > 0, seen.status);
    check(`${W}: every set and session of the file is there`,
      seen.stored.sets === backup.data.gymSets.length && seen.stored.sessions === backup.data.gymSessions.length, JSON.stringify(seen.stored));
    check(`${W}: a reload writes nothing`, seen.wroteOnReload === 0, String(seen.wroteOnReload));
    check(`${W}: no page error`, seen.errors.length === 0, seen.errors.slice(0, 2).join(' | '));
    console.log(`     rating: ${seen.rating}`);
    for (const range of Object.keys(seen.muscles)) console.log(`     ${range} Tage: ${JSON.stringify(seen.muscles[range])}  | ${seen.overall[range]}${seen.strip[range]?.length ? `  | strip: ${seen.strip[range].join(' · ')}` : ''}`);
    console.log(`     Bankdrücken: ${JSON.stringify(seen.details['Bankdrücken'])}`);
  }
  const { live, neu } = result[day];
  const scoring = (snapshot) => snapshot.config?.scoring ?? {};
  check(`${day}: the live build keeps the file's one snapshot, without the new metric`,
    live.snapshots.length === backup.data.configSnapshots.length && live.snapshots.every((s) => scoring(s).gymMetric === undefined),
    String(live.snapshots.length));
  const added = neu.snapshots.filter((s) => s.effectiveFrom === day);
  check(`${day}: the new build wrote one snapshot, from the day of the import, with all three eras`,
    neu.snapshots.length === backup.data.configSnapshots.length + 1 && added.length === 1 &&
      scoring(added[0]).gymMetric?.id === 'bestWorkingSet' && scoring(added[0]).sessionWindowDays !== undefined,
    JSON.stringify(added.map((s) => scoring(s))));
  check(`${day}: and left the earlier one as it was`,
    JSON.stringify(neu.snapshots.filter((s) => s.effectiveFrom !== day)) === JSON.stringify(backup.data.configSnapshots));
}

writeFileSync(`${OUT}/import-check.json`, `${JSON.stringify(result, null, 1)}\n`);
process.exit(summary() ? 0 : 1);
