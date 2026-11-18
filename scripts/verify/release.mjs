import { readFileSync, writeFileSync } from 'node:fs';
import { URL_APP, check, summary, phone, onboard, clipped, smallTargets, launch, settle } from './lib.mjs';

/**
 * The V1 release smoke test, against the **production build**.
 *
 * Everything else in this directory proves a phase. This one proves the
 * thing a user actually receives: a cold load of the built bundle, real data
 * entered through every domain, a refresh, a backup round trip, and no
 * console errors anywhere along the way. A dev server proves none of that.
 */

// Chromium, or WebKit on GitHub (block 9, step 3).
const browser = await launch();

const TMP = process.env.RELEASE_TMP ?? '/tmp';

function watch(page, errors) {
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
}

const tab = async (page, name) => {
  await page.locator('.tab-bar__tab', { hasText: name }).click();
  await page.waitForTimeout(700);
  await settle(page);
};

/**
 * What the browser tells a page of its worker on a first visit — written
 * down, so that a notice that stands can be read against it.
 *
 * Before any script of the app: every state the installing worker reports,
 * with whether the page had a controller at that moment and whether that
 * controller was this very worker. `hold` keeps the page busy for so many
 * milliseconds from the moment the worker is found — the app has taken its
 * own listener by then — which is what a slow phone does to a first visit:
 * the worker installs, activates and claims the page while the page cannot
 * listen, and all of it is reported at once.
 */
async function recordWorker(ctx, { hold = 0 } = {}) {
  await ctx.addInitScript((holdMs) => {
    const container = navigator.serviceWorker;
    if (!container) return;
    const seen = { found: 0, states: [], held: false };
    window.__worker = seen;
    const register = container.register.bind(container);
    container.register = (...args) => {
      const pending = register(...args);
      void pending.then((registration) => {
        registration.addEventListener('updatefound', () => {
          seen.found += 1;
          const installing = registration.installing;
          installing?.addEventListener('statechange', () => {
            const controller = container.controller;
            seen.states.push({ state: installing.state, controlled: controller !== null, bySelf: controller === installing });
          });
          if (holdMs > 0) {
            setTimeout(() => {
              const end = performance.now() + holdMs;
              while (performance.now() < end) { /* the page is busy */ }
              seen.held = true;
            }, 0);
          }
        });
      }, () => {});
      return pending;
    };
  }, hold);
}
const workerSeen = (page) => page.evaluate(() => window.__worker ?? null);
/** One line of what was recorded, for a check's detail. */
function workerLine(seen) {
  if (!seen) return 'no worker in this browser';
  if (seen.found === 0) return 'no worker was found while the page listened';
  const installed = seen.states.find((entry) => entry.state === 'installed');
  const states = seen.states.map((entry) => `${entry.state}${entry.controlled ? (entry.bySelf ? ' (controlled, by this worker)' : ' (controlled, by another)') : ''}`).join(' → ');
  return `${seen.found} worker found; ${installed ? `"installed" reached a page ${installed.controlled ? 'already controlled' : 'without a controller'}` : '"installed" was not reported'}; ${states}`;
}

/* ── A cold load of the built bundle ────────────────────────────────────── */
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const errors = [];
  watch(page, errors);

  const response = await page.goto(URL_APP, { waitUntil: 'networkidle' });
  check('the production build is served', response?.status() === 200, String(response?.status()));
  await page.waitForTimeout(800);

  // A new device opens on the onboarding's opening page (D192).
  check('the app renders on a cold load',
    await page.locator('.onboarding').isVisible());
  check('every asset loads from the project base path',
    errors.filter((e) => e.startsWith('requestfailed')).length === 0,
    errors.filter((e) => e.startsWith('requestfailed')).slice(0, 2).join(' | '));
  check('nothing errors on the console during boot', errors.length === 0,
    errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ── The whole journey, then a refresh ──────────────────────────────────── */
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const errors = [];
  watch(page, errors);
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  await onboard(page, { gym: 3, running: 2 });
  check('onboarding lands on Today, with no dead end',
    await page.getByRole('heading', { name: 'Heute' }).isVisible());

  // Mind.
  const yes = page.locator('.answer-boolean__option--yes');
  for (let i = 0; i < (await yes.count()); i += 1) {
    await yes.nth(i).click();
    await page.waitForTimeout(220);
  }
  const scale = page.locator('.check-in .answer-scale__value', { hasText: /^8$/ });
  for (let i = 0; i < (await scale.count()); i += 1) {
    await scale.nth(i).click();
    await page.waitForTimeout(220);
  }

  // Training: one gym session and one run.
  // A workout is stored with its first saved set (D128), so log one.
  await page.locator('.week__log', { hasText: 'Session eintragen' }).click();
  await page.waitForTimeout(900);
  await page.locator('.gym-session__bar').getByRole('button', { name: 'Übung hinzufügen' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('textbox', { name: 'Suchen' }).fill('Bankdrücken');
  await page.waitForTimeout(350);
  await page.locator('.gym-picker__row', { hasText: 'Bankdrücken' }).first().click();
  await page.waitForTimeout(700);
  // A barbell set is complete once its load is known.
  const pendingFields = page.locator('.gym-set--pending input');
  await pendingFields.nth(0).fill('8');
  await pendingFields.nth(0).blur();
  await pendingFields.nth(1).fill('60');
  await pendingFields.nth(1).blur();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.waitForTimeout(700);
  await page.locator('.week__log', { hasText: 'Lauf eintragen' }).click();
  await page.waitForTimeout(900);

  check('the day reports every daily obligation, not just one domain',
    /\d+ von \d+ beantwortet|Für heute erledigt/.test(
      (await page.locator('.today__progress').textContent()) ?? '',
    ));

  const stored = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('momentum');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const count = (store) =>
      new Promise((res, rej) => {
        const r = db.transaction([store], 'readonly').objectStore(store).count();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    return {
      answers: await count('answers'),
      foodDays: await count('foodDays'),
      foodEntries: await count('foodEntries'),
      gym: await count('gymSessions'),
      runs: await count('runs'),
    };
  });
  check('every domain wrote real data', stored.answers > 0 && stored.gym >= 1 && stored.runs >= 1, JSON.stringify(stored));
  check('and nothing wrote Food data, which nothing creates any more (D140)',
    stored.foodDays === 0 && stored.foodEntries === 0, JSON.stringify(stored));

  // The refresh: a PWA that forgets on reload is not persistent.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  check('a refresh keeps the user out of onboarding',
    (await page.locator('.onboarding').count()) === 0);
  check('and the day is still there after the refresh',
    (await page.locator('.check-in--answered').count()) > 0);

  // Every screen, with real data in it.
  for (const name of ['Verlauf', 'Rang', 'Bereiche', 'Heute']) {
    await tab(page, name);
    check(`${name} renders with real data`,
      (await page.locator('.screen__title').count()) > 0);
  }

  check('no console error anywhere in the journey', errors.length === 0,
    errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ── Backup: export, re-import, and refuse a broken file ────────────────── */
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const errors = [];
  watch(page, errors);
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await onboard(page, { gym: 3, running: 0 });

  // The default onboarding questions are scale questions, so answering only
  // the yes/no controls would leave the profile empty and make the checks
  // below vacuous. Answer whatever is actually there.
  const yes = page.locator('.answer-boolean__option--yes');
  for (let i = 0; i < (await yes.count()); i += 1) {
    await yes.nth(i).click();
    await page.waitForTimeout(220);
  }
  const scales = page.locator('.check-in .answer-scale__value', { hasText: /^8$/ });
  for (let i = 0; i < (await scales.count()); i += 1) {
    await scales.nth(i).click();
    await page.waitForTimeout(220);
  }
  const wrote = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('momentum');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return new Promise((res, rej) => {
      const r = db.transaction(['answers'], 'readonly').objectStore('answers').count();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  });
  check('the profile has answers before the backup is taken', wrote > 0, String(wrote));

  await tab(page, 'Bereiche');
  const download = page.waitForEvent('download');
  await page.getByText('Backup exportieren').click();
  const file = await download;
  const path = `${TMP}/momentum-release-backup.json`;
  await file.saveAs(path);
  const contents = readFileSync(path, 'utf8');
  const parsed = JSON.parse(contents);
  check('the export is a readable backup file',
    parsed.format === 'momentum-backup' && typeof parsed.schemaVersion === 'number');
  check('and carries every collection, Food’s included — the format is unchanged (D140)',
    ['foodDays', 'foodEntries', 'pausePeriods'].every((key) => Object.keys(parsed.data).includes(key)));
  check('with the user’s real answers in it', parsed.data.answers.length > 0);

  // A broken file must be refused, not half-applied.
  const broken = `${TMP}/momentum-broken.json`;
  writeFileSync(broken, '{"format":"momentum-backup","formatVersion":1,"data":{"answers":"nope"}}');
  await page.locator('input[type="file"]').setInputFiles(broken);
  await page.waitForTimeout(900);
  check('a malformed backup is refused',
    await page.locator('.backup__status--error').isVisible());
  const survived = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('momentum');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return new Promise((res, rej) => {
      const r = db.transaction(['answers'], 'readonly').objectStore('answers').count();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  });
  check('and the existing profile is untouched by the refusal', survived > 0, String(survived));

  // The real file restores.
  await page.locator('input[type="file"]').setInputFiles(path);
  await page.waitForTimeout(900);
  const confirm = page.getByRole('button', { name: 'Ersetzen' });
  if (await confirm.count()) {
    await confirm.click();
    await page.waitForTimeout(1500);
  }
  check('a real backup restores without losing the profile',
    await page.locator('.backup__status--ok').isVisible());
  check('no console error during the backup round trip', errors.length === 0,
    errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ── Every width, with a full profile ───────────────────────────────────── */
for (const width of [320, 360, 393, 430, 1280]) {
  const ctx = await browser.newContext({ ...phone, viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  const widthErrors = [];
  page.on('pageerror', (error) => widthErrors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') widthErrors.push(message.text()); });
  const notices = new Set();
  await recordWorker(ctx);
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await onboard(page, { gym: 3, running: 2 });

  for (const name of ['Heute', 'Verlauf', 'Rang', 'Bereiche']) {
    await tab(page, name);
    const clip = await clipped(page);
    check(`${name} is not clipped at ${width}px`, clip.length === 0, clip.slice(0, 2).join('; '));
    for (const text of await page.locator('.update-banner').allTextContents()) notices.add(`${name}: ${text}`);
    const small = await smallTargets(page);
    check(`${name} keeps its targets at ${width}px`, small.length === 0, small.slice(0, 2).join('; '));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(`${name} does not scroll sideways at ${width}px`, overflow <= 1, `${overflow}px`);
  }
  // A first visit offers no update, and every change of the journey was
  // stored: neither notice stands (block 9 — WebKit on GitHub showed one).
  check(`${width}px: no notice stands — no update offered on a first visit, no change that did not take — and no page error`,
    notices.size === 0 && widthErrors.length === 0,
    notices.size === 0 && widthErrors.length === 0 ? '' : `${[...notices, ...widthErrors].slice(0, 4).join(' | ')} — ${workerLine(await workerSeen(page))}`);
  await ctx.close();
}

/* ── A first visit on a busy page ───────────────────────────────────────── */
/*
 * The notice of the block above came and went in WebKit on GitHub: one
 * first visit in a few dozen. This one is made to meet it. The page is held
 * busy while its first worker installs, activates and claims it, and only
 * then hears of any of it — and a first visit offers no update, however
 * late the page learns that its worker is installed.
 */
{
  const HOLD = Number(process.env.RELEASE_HOLD ?? 6000);
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await recordWorker(ctx, { hold: HOLD });
  await page.goto(URL_APP, { waitUntil: 'load' });
  // The worker is found, the page is held, and then it hears the rest.
  await page.waitForFunction(() => window.__worker?.held === true, null, { timeout: HOLD + 30000 }).catch(() => null);
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30000 }).catch(() => null);
  await page.waitForTimeout(1500);
  const seen = await workerSeen(page);
  const notices = await page.locator('.update-banner').allTextContents();
  check('a first visit on a busy page: the worker was found, and the page was held while it installed',
    seen !== null && seen.found === 1 && seen.held === true, workerLine(seen));
  check('a first visit on a busy page offers no update — however late the page hears that its worker is installed',
    notices.length === 0 && errors.length === 0, `${notices.length > 0 ? `${notices.join(' | ')} — ` : ''}${workerLine(seen)}${errors.length > 0 ? ` — ${errors[0]}` : ''}`);
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
