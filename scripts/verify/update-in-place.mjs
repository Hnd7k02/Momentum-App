import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { CHROMIUM, check, summary } from './lib.mjs';

/**
 * Block 9, steps 4 and 5 — the update and the way back, in one browser.
 *
 * One address, one database, one service worker: the live state `e30becd`
 * is served first, then this build under the same address, then the live
 * state again — as the owner's phone meets them.
 *
 *   A  the update in place   the live build holds the profile (imported
 *                            through its own "Backup importieren") and its
 *                            worker controls the page. This build replaces
 *                            it at the address: the page still runs the live
 *                            build, the new worker waits, "Neue Version
 *                            verfügbar" appears, and only "Neu laden" goes
 *                            on — one reload, no more. Then this build runs,
 *                            nothing of the live build is left in the cache,
 *                            every collection holds every record it held,
 *                            the three eras are written on the update day,
 *                            and a second load writes nothing.
 *   B  the live build again  on the data this build has loaded: what it
 *                            opens, shows and writes — described, not judged
 *                            (step 5).
 *   C  the clean way back    the data deleted, the live build, the backup
 *                            from before the update imported: two exports in
 *                            a row are the same file, and the same data as
 *                            the backup.
 *   D  a backup of this build, imported by the live build — what it does
 *                            (step 6).
 *
 * Needs both builds: this one in `dist` (`npm run build`; `NEW_DIST` names
 * another directory) and the live state in `LIVE_DIR` (`run-all.mjs` builds
 * it). It serves them itself, on
 * `PORT` (4295), one after the other.
 */
const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const LIVE_DIR = process.env.LIVE_DIR ?? join(tmpdir(), 'momentum-live-e30becd');
const PORT = Number(process.env.UPDATE_PORT ?? 4295);
const ADDRESS = `http://127.0.0.1:${PORT}/Momentum-App/`;
const PROFILE = join(ROOT, '.github/fixtures/wp3-update/live-profile.json');
const UPDATE_DAY = '2026-11-18';
const TMP = process.env.RELEASE_TMP ?? tmpdir();

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const assetsOf = (dist) => readdirSync(join(dist, 'assets')).filter((name) => /\.(js|css)$/.test(name));
const NEW_DIST = resolve(process.env.NEW_DIST ?? join(ROOT, 'dist'));
const LIVE_ASSETS = assetsOf(join(LIVE_DIR, 'dist'));
const NEW_ASSETS = assetsOf(NEW_DIST);
const NEW_INDEX = NEW_ASSETS.find((name) => /^index-.*\.js$/.test(name));

/* ── One address, two builds ───────────────────────────────────────────── */

let server = null;
async function serve(which) {
  await stop();
  const cwd = which === 'live' ? LIVE_DIR : ROOT;
  const outDir = which === 'live' ? [] : ['--outDir', NEW_DIST];
  server = spawn('npx', ['vite', 'preview', ...outDir, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd, detached: true, stdio: 'ignore' });
  for (let i = 0; i < 200; i += 1) {
    try { if ((await fetch(ADDRESS)).ok) return; } catch { /* not yet */ }
    await sleep(150);
  }
  throw new Error(`the ${which} build did not come up on ${PORT}`);
}
async function stop() {
  if (!server) return;
  const child = server;
  server = null;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { /* gone */ }
  for (let i = 0; i < 60; i += 1) {
    try { await fetch(ADDRESS); } catch { return; }
    await sleep(100);
  }
}
process.on('exit', () => { if (server) try { process.kill(-server.pid, 'SIGKILL'); } catch { /* gone */ } });

/* ── Reading a device ──────────────────────────────────────────────────── */

/** Every store of the database, as rows. */
const dump = (page) =>
  page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const out = {};
    for (const name of db.objectStoreNames) {
      out[name] = await new Promise((res, rej) => { const r = db.transaction([name], 'readonly').objectStore(name).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    }
    db.close();
    return out;
  });

const cached = (page) =>
  page.evaluate(async () => {
    const out = [];
    for (const key of await caches.keys()) {
      for (const request of await (await caches.open(key)).keys()) out.push(new URL(request.url).pathname);
    }
    return out;
  });

/** Walks the live build's onboarding — it has to be done before Bereiche opens — and imports `file`. */
async function liveDeviceWith(page, file) {
  await page.goto(ADDRESS, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Los geht/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: /Wie gut hast du gesch/ }).first().click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Starten' }).click();
  await page.getByRole('button', { name: 'Bereiche' }).click();
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.getByRole('button', { name: 'Ersetzen' }).click();
  await page.locator('.backup__status--ok').waitFor();
  await page.reload({ waitUntil: 'networkidle' });
}

/** The data, as an export carries it, through the build's own "Backup exportieren". */
async function exportThroughScreen(page, name) {
  await page.getByRole('button', { name: 'Bereiche' }).click();
  await sleep(600);
  const download = page.waitForEvent('download');
  await page.getByText('Backup exportieren').click();
  const file = await download;
  const path = join(TMP, `${name}.json`);
  await file.saveAs(path);
  return JSON.parse(readFileSync(path, 'utf8'));
}

const withoutInstant = ({ exportedAt: _at, ...rest }) => rest;
const ids = (rows) => (rows ?? []).map((row) => row.id ?? row.date ?? JSON.stringify(row)).sort();

/* ── A: the update in place, with the worker ───────────────────────────── */

const browser = await chromium.launch({ executablePath: CHROMIUM });
const report = {};
{
  await serve('live');
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, locale: 'de-CH', timezoneId: 'Europe/Zurich', acceptDownloads: true });
  await ctx.clock.setSystemTime(new Date(`${UPDATE_DAY}T12:00:00+01:00`));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await liveDeviceWith(page, PROFILE);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  const controlled = await page.evaluate(() => navigator.serviceWorker.controller !== null);
  check('A: the live build holds the profile, and its worker controls the page', controlled);
  const before = await dump(page);
  const beforeCache = await cached(page);
  check('A: the live build cached its own files', LIVE_ASSETS.every((name) => beforeCache.some((path) => path.endsWith(name))), `${beforeCache.length} cached`);

  // This build takes the address.
  await serve('new');
  let navigations = 0;
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations += 1; });
  await page.reload({ waitUntil: 'networkidle' });
  navigations = 0;
  const notice = page.getByText('Neue Version verfügbar');
  await notice.waitFor({ timeout: 30000 }).catch(() => undefined);
  const waiting = await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting));
  const stillLive = await page.evaluate(() => [...document.scripts].some((script) => /index-/.test(script.src)) && !document.documentElement.innerHTML.includes('Let’s get it started'));
  check('A: the new worker waits, the page still runs the live build, and the notice says so',
    (await notice.isVisible()) && waiting && stillLive, JSON.stringify({ notice: await notice.isVisible(), waiting }));
  const unchangedWhileWaiting = JSON.stringify(await dump(page)) === JSON.stringify(before);
  check('A: while it waits, nothing is written', unchangedWhileWaiting);

  await page.getByRole('button', { name: 'Neu laden' }).click();
  await page.waitForLoadState('networkidle');
  await sleep(4000);
  check('A: "Neu laden" reloads exactly once', navigations === 1, String(navigations));
  const running = await page.evaluate(() => [...document.scripts].map((script) => script.src).find((src) => /index-/.test(src)) ?? null);
  check('A: then this build runs', running !== null && running.endsWith(NEW_INDEX), String(running));
  const afterCache = await cached(page);
  const leftover = afterCache.filter((path) => LIVE_ASSETS.some((name) => path.endsWith(name)) && !NEW_ASSETS.some((name) => path.endsWith(name)));
  check('A: and nothing of the live build is left in the cache', leftover.length === 0 && NEW_ASSETS.every((name) => afterCache.some((path) => path.endsWith(name))), leftover.join(', '));

  const after = await dump(page);
  const lost = Object.entries(before).flatMap(([name, rows]) => {
    const now = ids(after[name]);
    return ids(rows).filter((id) => !now.includes(id)).map((id) => `${name}:${id}`);
  });
  check('A: every collection holds every record it held', lost.length === 0, lost.slice(0, 5).join(', '));
  const unchanged = ['answers', 'gymSessions', 'gymSets', 'runs', 'weightEntries', 'foodDays', 'foodEntries', 'questions']
    .filter((name) => name in before)
    .filter((name) => JSON.stringify(ids(after[name])) !== JSON.stringify(ids(before[name])) || JSON.stringify(after[name]) !== JSON.stringify(before[name]));
  check('A: and every answer, session, set, run, weight and Food rating is as it was', unchanged.length === 0, unchanged.join(', '));
  // The starter plans (D205): the first load adds Push A and Push B, with
  // the catalogue they are made of, to a device that has neither — and
  // every plan and exercise it held is as it was.
  const kept = (name) => {
    const held = new Set(ids(before[name] ?? []));
    return JSON.stringify(after[name].filter((row) => held.has(row.id))) === JSON.stringify(before[name] ?? []);
  };
  const heldPlans = new Set(ids(before.gymPlans ?? []));
  const newPlans = after.gymPlans.filter((plan) => !heldPlans.has(plan.id)).map((plan) => plan.name).sort();
  const hadStarter = (before.gymPlans ?? []).some((plan) => plan.name === 'Push A' || plan.name === 'Push B');
  check('A: every plan and exercise it held is as it was, and the first load added Push A and Push B, once',
    kept('gymPlans') && kept('exercises') && !hadStarter && JSON.stringify(newPlans) === '["Push A","Push B"]' &&
      typeof after.settings[0]?.starterPlansSeededAt === 'string',
    JSON.stringify({ plans: after.gymPlans.map((plan) => plan.name), added: newPlans }));
  const added = after.configSnapshots.filter((snapshot) => !before.configSnapshots.some((old) => old.id === snapshot.id));
  const inForce = [...after.configSnapshots].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom) || a.createdAt.localeCompare(b.createdAt)).filter((s) => s.effectiveFrom <= UPDATE_DAY).at(-1);
  check('A: the first load wrote the three eras, dated on the update day',
    added.length > 0 && added.every((snapshot) => snapshot.effectiveFrom === UPDATE_DAY) &&
      inForce.config.scoring.sessionWindowDays === 1 && inForce.config.scoring.gymMetric !== undefined &&
      inForce.config.domains.some((domain) => domain.type === 'food' && !domain.enabled),
    JSON.stringify({ added: added.length, window: inForce.config.scoring.sessionWindowDays, metric: Boolean(inForce.config.scoring.gymMetric) }));
  report.added = added.length;

  await page.reload({ waitUntil: 'networkidle' });
  await sleep(1500);
  check('A: a second load writes nothing', JSON.stringify(await dump(page)) === JSON.stringify(after));
  check('A: no page error', errors.length === 0, errors.slice(0, 2).join(' | '));

  /* ── B: the live build on data this build has loaded ─────────────────── */
  await page.evaluate(async () => {
    for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
    for (const key of await caches.keys()) await caches.delete(key);
  });
  await serve('live');
  const liveErrors = [];
  page.on('pageerror', (error) => liveErrors.push(String(error)));
  await page.goto(ADDRESS, { waitUntil: 'networkidle' });
  await sleep(2000);
  const back = await dump(page);
  const heute = (await page.locator('main, .screen').first().textContent().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400);
  const wrote = Object.keys(back).filter((name) => JSON.stringify(back[name]) !== JSON.stringify(after[name]));
  const newSnapshots = (back.configSnapshots ?? []).filter((snapshot) => !after.configSnapshots.some((old) => old.id === snapshot.id));
  report.liveOnNewData = {
    opens: liveErrors.length === 0 && heute.length > 0,
    errors: liveErrors.slice(0, 3),
    shows: heute,
    foodShown: heute.includes('Ernährung'),
    wroteStores: wrote,
    newSnapshots: newSnapshots.map((snapshot) => ({ effectiveFrom: snapshot.effectiveFrom, window: snapshot.config.scoring.sessionWindowDays ?? null, metric: snapshot.config.scoring.gymMetric ? 'yes' : 'no', food: snapshot.config.domains.find((domain) => domain.type === 'food')?.enabled ?? null })),
  };
  check('B: the live build opens the data this build has loaded (what it shows and writes is in the report)', report.liveOnNewData.opens, JSON.stringify(report.liveOnNewData).slice(0, 300));
  await ctx.close();
}

/* ── C: the clean way back ─────────────────────────────────────────────── */
{
  await serve('live');
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, locale: 'de-CH', timezoneId: 'Europe/Zurich', acceptDownloads: true, serviceWorkers: 'block' });
  await ctx.clock.setSystemTime(new Date(`${UPDATE_DAY}T12:00:00+01:00`));
  const page = await ctx.newPage();
  await liveDeviceWith(page, PROFILE);
  const first = await exportThroughScreen(page, 'way-back-1');
  await page.reload({ waitUntil: 'networkidle' });
  const second = await exportThroughScreen(page, 'way-back-2');
  const original = JSON.parse(readFileSync(PROFILE, 'utf8'));
  check('C: the way back — two exports in a row are the same file', JSON.stringify(withoutInstant(first)) === JSON.stringify(withoutInstant(second)));
  check('C: and hold the data of the backup from before the update', JSON.stringify(first.data) === JSON.stringify(original.data),
    Object.keys(original.data).filter((name) => JSON.stringify(first.data[name]) !== JSON.stringify(original.data[name])).join(', '));
  await ctx.close();
}

/* ── D: a backup of this build, in the live build ──────────────────────── */
{
  await serve('new');
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, locale: 'de-CH', timezoneId: 'Europe/Zurich', acceptDownloads: true, serviceWorkers: 'block' });
  await ctx.clock.setSystemTime(new Date(`${UPDATE_DAY}T12:00:00+01:00`));
  const page = await ctx.newPage();
  await page.goto(ADDRESS, { waitUntil: 'networkidle' });
  await page.locator('.onboarding__tap').click();
  await page.getByRole('button', { name: /Los geht/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: /^Mind/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  // No question is chosen for the user since D197; the import replaces it.
  await page.getByRole('button', { name: /Wie gut hast du gesch/ }).first().click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Starten' }).click();
  await page.getByRole('button', { name: 'Bereiche' }).click();
  await page.locator('input[type="file"]').setInputFiles(PROFILE);
  await page.getByRole('button', { name: 'Ersetzen' }).click();
  await page.locator('.backup__status--ok').waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  const fromNew = await exportThroughScreen(page, 'from-new');
  await ctx.close();
  // A warm-up is the one new fact a set of this build can carry (D151): the
  // first working set marked as the owner would mark it.
  const marked = structuredClone(fromNew);
  marked.data.gymSets[0].warmUp = true;
  writeFileSync(join(TMP, 'from-new-marked.json'), JSON.stringify(marked));

  await serve('live');
  const old = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, locale: 'de-CH', timezoneId: 'Europe/Zurich', acceptDownloads: true, serviceWorkers: 'block' });
  await old.clock.setSystemTime(new Date(`${UPDATE_DAY}T13:00:00+01:00`));
  const livePage = await old.newPage();
  const liveErrors = [];
  livePage.on('pageerror', (error) => liveErrors.push(String(error)));
  await liveDeviceWith(livePage, join(TMP, 'from-new-marked.json')).catch((error) => liveErrors.push(String(error)));
  const status = await livePage.locator('.backup__status').first().textContent().catch(() => null);
  const held = await dump(livePage).catch(() => null);
  report.liveImportsNew = {
    accepted: held !== null && (held.gymSets ?? []).length === fromNew.data.gymSets.length,
    status,
    errors: liveErrors.slice(0, 3),
    snapshotsWithWindow: (held?.configSnapshots ?? []).filter((snapshot) => snapshot.config.scoring.sessionWindowDays !== undefined).length,
    warmUpKept: (held?.gymSets ?? []).filter((set) => set.warmUp === true).length,
  };
  check('D: the live build reads a backup of this build (what it keeps is in the report)', report.liveImportsNew.accepted, JSON.stringify(report.liveImportsNew).slice(0, 300));
  await old.close();
}

await stop();
await browser.close();
console.log(`REPORT ${JSON.stringify(report)}`);
process.exit(summary() ? 0 : 1);
