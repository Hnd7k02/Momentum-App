import { readFileSync, writeFileSync } from 'node:fs';
import { URL_APP, check, summary, phone, onboard, clipped, smallTargets, launch, settle, storedPlans, openGymHub } from './lib.mjs';

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
 * controller was this very worker. A worker claims its page as it
 * activates, and WebKit can tell a page of the claim before the page has
 * heard that the worker is installed: run 48 on GitHub recorded exactly
 * that under the one notice that stood — one worker found, "installed"
 * reaching a page already controlled, by this worker. `busy` keeps the
 * page at work in short pieces while the worker installs, as a slow phone
 * is; whether that meets the case more often is what the note at the end
 * of the suite says, not something the suite assumes.
 */
async function recordWorker(ctx, { busy = false } = {}) {
  await ctx.addInitScript((busyPage) => {
    const container = navigator.serviceWorker;
    if (!container) return;
    const seen = { found: 0, states: [] };
    window.__worker = seen;
    const register = container.register.bind(container);
    container.register = (...args) => {
      const pending = register(...args);
      void pending.then((registration) => {
        registration.addEventListener('updatefound', () => {
          seen.found += 1;
          const installing = registration.installing;
          if (!installing) return;
          let settled = false;
          installing.addEventListener('statechange', () => {
            const controller = container.controller;
            seen.states.push({ state: installing.state, controlled: controller !== null, bySelf: controller === installing });
            if (installing.state === 'activated' || installing.state === 'redundant') settled = true;
          });
          if (!busyPage) return;
          const until = performance.now() + 8000;
          const work = () => {
            const end = performance.now() + 40;
            while (performance.now() < end) { /* the page is at work */ }
            if (!settled && performance.now() < until) setTimeout(work, 0);
          };
          setTimeout(work, 0);
        });
      }, () => {});
      return pending;
    };
  }, busy);
}
const workerSeen = (page) => page.evaluate(() => window.__worker ?? null).catch(() => null);
/** Whether "installed" was reported to a page that already had a controller. */
const claimedFirst = (seen) => Boolean(seen?.states.find((entry) => entry.state === 'installed')?.controlled);
/** One line of what was recorded, for a check's detail. */
function workerLine(seen) {
  if (!seen) return 'no worker in this browser';
  if (seen.found === 0) return 'no worker was found while the page listened';
  const installed = seen.states.find((entry) => entry.state === 'installed');
  const states = seen.states.map((entry) => `${entry.state}${entry.controlled ? (entry.bySelf ? ' (controlled, by this worker)' : ' (controlled, by another)') : ''}`).join(' → ');
  return `${seen.found} worker found; ${installed ? `"installed" reached a page ${installed.controlled ? 'already controlled' : 'without a controller'}` : '"installed" was not reported'}; ${states}`;
}
/** Every first visit of this suite that was recorded: how the browser told it. */
const firstVisits = { walked: [], plain: [], busy: [] };
const tally = (kind, seen, notices) => firstVisits[kind].push({ found: seen?.found ?? 0, claimedFirst: claimedFirst(seen), notice: notices > 0 });

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
  // The one thing a new device holds before its introduction (D205).
  const seeded = await storedPlans(page);
  check('a new device holds Push A and Push B, six built-in exercises each, and no other plan',
    JSON.stringify(seeded.map((plan) => plan.name)) === '["Push A","Push B"]' &&
      seeded.every((plan) => plan.exercises.length === 6 && plan.exercises.every((line) => line.exerciseId.startsWith('ex_'))),
    JSON.stringify(seeded.map((plan) => [plan.name, plan.exercises.length])));
  const beside = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('momentum');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const counts = {};
    for (const name of [...db.objectStoreNames]) {
      counts[name] = await new Promise((res, rej) => {
        const r = db.transaction([name], 'readonly').objectStore(name).count();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }
    db.close();
    return counts;
  });
  const others = Object.entries(beside).filter(([name, count]) => count > 0 && !['settings', 'exercises', 'gymPlans'].includes(name));
  check('and nothing else beside its settings and the exercise catalogue: no area, question, session, set or snapshot',
    others.length === 0 && beside.settings === 1, JSON.stringify(beside));
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

  await onboard(page, { gym: 3, running: 2, starterPlans: true });
  check('onboarding lands on Today, with no dead end',
    await page.getByRole('heading', { name: 'Heute' }).isVisible());
  check('the introduction made no plan and took none: Push A and Push B, as before it (D205)',
    JSON.stringify((await storedPlans(page)).map((plan) => plan.name)) === '["Push A","Push B"]');

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
  // With plans on the device «Session eintragen» asks which — the two
  // starter plans (D205) — and a free session is one of the answers.
  await page.locator('.week__log', { hasText: 'Session eintragen' }).click();
  await page.waitForTimeout(700);
  const offered = (await page.getByRole('dialog').textContent().catch(() => '')) ?? '';
  check('«Session eintragen» offers Push A, Push B and a free session',
    offered.includes('Push A') && offered.includes('Push B') && offered.includes('Freie Session'), offered.slice(0, 160));
  await page.getByRole('button', { name: 'Freie Session' }).click();
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

  // Gym › Trainingspläne: the two starter plans, once (D205).
  const plansCard = page.locator('.plans__slots').locator('xpath=..');
  const planRows = async () => {
    await openGymHub(page);
    await page.locator('.plans__slots').waitFor({ state: 'visible' });
    return ((await plansCard.textContent()) ?? '').replace(/\s+/g, ' ');
  };
  let listed = await planRows();
  check('Gym › Trainingspläne lists Push A and Push B, six exercises each, two of five',
    /Push A\s*6 Übungen/.test(listed) && /Push B\s*6 Übungen/.test(listed) && listed.includes('2 von 5 Plänen'), listed.slice(0, 200));
  await plansCard.getByRole('button', { name: /Push A/ }).click();
  await page.getByRole('button', { name: 'Plan löschen' }).click();
  await page.getByRole('button', { name: 'Wirklich löschen?' }).click();
  await page.waitForTimeout(600);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  listed = await planRows();
  check('a deleted starter plan stays gone after a reload, and the other stays',
    !listed.includes('Push A') && listed.includes('Push B') && listed.includes('1 von 5 Plänen') &&
      JSON.stringify((await storedPlans(page)).map((plan) => plan.name)) === '["Push B"]', listed.slice(0, 200));
  await tab(page, 'Heute');

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
  const seen = await workerSeen(page);
  tally('walked', seen, notices.size);
  check(`${width}px: no notice stands — no update offered on a first visit, no change that did not take — and no page error`,
    notices.size === 0 && widthErrors.length === 0,
    notices.size === 0 && widthErrors.length === 0 ? '' : `${[...notices, ...widthErrors].slice(0, 4).join(' | ')} — ${workerLine(seen)}`);
  await ctx.close();
}

/* ── First visits, one after another ────────────────────────────────────── */
/*
 * The notice of the block above came and went in WebKit on GitHub: one
 * first visit in a few dozen, and never one in Chromium. Five walks do not
 * meet it often enough to say anything, so the first visit is made again
 * and again — a new browser profile each time, every other page at work
 * while its worker installs, the introduction walked to Heute — and none
 * of them is offered an update. How
 * often the browser told a page of the claim before the install is a note
 * under the checks: it is the case the app has to bear, and whether a run
 * met it is worth knowing when the run is green.
 */
{
  const VISITS = Number(process.env.RELEASE_FIRST_VISITS ?? 20);
  const offered = [];
  const unclaimed = [];
  const errors = [];
  for (let visit = 1; visit <= VISITS; visit += 1) {
    const busy = visit % 2 === 0;
    const ctx = await browser.newContext(phone);
    const page = await ctx.newPage();
    page.on('pageerror', (error) => errors.push(`visit ${visit}: ${error}`));
    await recordWorker(ctx, { busy });
    await page.goto(URL_APP, { waitUntil: 'load' });
    const claimed = await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30000 }).then(() => true, () => false);
    // The notice stands in the app, not over the introduction: it is read
    // where a user who has just set up meets it, on Heute (run 49 counted
    // the case eleven times on the opening page and could show no notice).
    await onboard(page, { gym: 3, running: 2 });
    await page.waitForTimeout(500);
    const seen = await workerSeen(page);
    const notices = await page.locator('.update-banner').allTextContents();
    tally(busy ? 'busy' : 'plain', seen, notices.length);
    if (!claimed) unclaimed.push(`visit ${visit}: ${workerLine(seen)}`);
    if (notices.length > 0) offered.push(`visit ${visit}${busy ? ' (busy)' : ''}: ${notices.join(' | ')} — ${workerLine(seen)}`);
    await ctx.close();
  }
  check(`${VISITS} first visits: each page is taken over by its worker`, unclaimed.length === 0, unclaimed.slice(0, 2).join(' || '));
  check(`${VISITS} first visits: none is offered an update — however early the browser tells the page whose it is`,
    offered.length === 0 && errors.length === 0, [...offered, ...errors].slice(0, 2).join(' || '));
}

// For the job's log, green or not: how the browser told the first visits.
{
  const count = (list) => `${list.filter((visit) => visit.claimedFirst).length} of ${list.length}`;
  const all = [...firstVisits.walked, ...firstVisits.plain, ...firstVisits.busy];
  console.log(`NOTE  first visits: "installed" reached a page already controlled in ${count(all)} — walked ${count(firstVisits.walked)}, plain ${count(firstVisits.plain)}, a page at work ${count(firstVisits.busy)}; a notice stood in ${all.filter((visit) => visit.notice).length}, of them after such a report ${all.filter((visit) => visit.notice && visit.claimedFirst).length}; the worker was found in ${all.filter((visit) => visit.found > 0).length}`);
}

await browser.close();
process.exit(summary() ? 0 : 1);
