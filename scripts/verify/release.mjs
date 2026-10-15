import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
import { URL_APP, check, summary, phone, onboard, clipped, smallTargets } from './lib.mjs';

/**
 * The V1 release smoke test, against the **production build**.
 *
 * Everything else in this directory proves a phase. This one proves the
 * thing a user actually receives: a cold load of the built bundle, real data
 * entered through every domain, a refresh, a backup round trip, and no
 * console errors anywhere along the way. A dev server proves none of that.
 */

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

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
};

/* ── A cold load of the built bundle ────────────────────────────────────── */
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const errors = [];
  watch(page, errors);

  const response = await page.goto(URL_APP, { waitUntil: 'networkidle' });
  check('the production build is served', response?.status() === 200, String(response?.status()));
  await page.waitForTimeout(800);

  check('the app renders on a cold load',
    await page.getByRole('button', { name: /Los geht/ }).isVisible());
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

  await onboard(page, { gym: 3, running: 2, food: true });
  check('onboarding lands on Today, with no dead end',
    await page.getByRole('heading', { name: 'Heute' }).isVisible());

  // Wellbeing.
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

  // Food: a rating and an entry.
  await page.locator('.food__scale .answer-scale__value', { hasText: /^7$/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Essen eintragen' }).click();
  await page.waitForTimeout(350);
  await page.locator('.sheet .row', { hasText: 'Banane' }).first().click();
  await page.waitForTimeout(600);

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
  check('every domain wrote real data', stored.answers > 0 && stored.foodDays === 1 &&
    stored.foodEntries === 1 && stored.gym >= 1 && stored.runs >= 1, JSON.stringify(stored));

  // The refresh: a PWA that forgets on reload is not persistent.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  check('a refresh keeps the user out of onboarding',
    (await page.getByRole('button', { name: /Los geht/ }).count()) === 0);
  check('and the day is still there after the refresh',
    await page.getByText(/von 10 ·/).first().isVisible());

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
  await onboard(page, { gym: 3, running: 0, food: true });

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
  await page.locator('.food__scale .answer-scale__value', { hasText: /^9$/ }).click();
  await page.waitForTimeout(600);

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
  check('and carries every collection, including this release’s',
    Object.keys(parsed.data).includes('foodDays') &&
      Object.keys(parsed.data).includes('pausePeriods'));
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
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await onboard(page, { gym: 3, running: 2, food: true });

  for (const name of ['Heute', 'Verlauf', 'Rang', 'Bereiche']) {
    await tab(page, name);
    const clip = await clipped(page);
    check(`${name} is not clipped at ${width}px`, clip.length === 0, clip.slice(0, 2).join('; '));
    const small = await smallTargets(page);
    check(`${name} keeps its targets at ${width}px`, small.length === 0, small.slice(0, 2).join('; '));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(`${name} does not scroll sideways at ${width}px`, overflow <= 1, `${overflow}px`);
  }
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
