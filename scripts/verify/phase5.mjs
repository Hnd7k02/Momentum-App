import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, summary, phone, onboard, clipped, smallTargets } from './lib.mjs';
import { inSheet } from './lib.mjs';

/**
 * Phase 5: Running on the screen.
 *
 * The rating headline, the year-to-date pace beneath it, attendance beside
 * that, and the three states a runner can be in that did not exist before:
 * inside the Endurance Phase, out of it, and on a break long enough to decay.
 * Plus the entry flow, which has to stay one tap while making distance
 * available to anyone who wants it.
 */

const browser = await chromium.launch({
  executablePath: CHROMIUM,
});

/**
 * Writes runs straight into IndexedDB. `metWeeks` weeks of two runs each at
 * an improving pace, then `silentDays` of nothing.
 */
async function seedRuns(page, { metWeeks, silentDays = 0, distanceMetres = 5000, secondDistance = null }) {
  return page.evaluate(
    async ({ metWeeks, silentDays, distanceMetres, secondDistance }) => {
      const open = () =>
        new Promise((res, rej) => {
          const r = indexedDB.open('momentum');
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      const all = (db, s) =>
        new Promise((res, rej) => {
          const r = db.transaction([s], 'readonly').objectStore(s).getAll();
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      const putAll = (db, s, recs) =>
        new Promise((res, rej) => {
          const tx = db.transaction([s], 'readwrite');
          for (const r of recs) tx.objectStore(s).put(r);
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
      const p = (n, l = 2) => String(n).padStart(l, '0');
      const key = (d) => `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      const shift = (n) => {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() + n);
        return d;
      };
      const isoWeek = (d) => {
        const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
        t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3);
        const y = t.getFullYear();
        const f = new Date(y, 0, 4, 12);
        f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3);
        return `${p(y, 4)}-W${p(1 + Math.round((t - f) / (7 * 86400000)))}`;
      };

      const db = await open();
      const snaps = await all(db, 'configSnapshots');
      const settings = await all(db, 'settings');
      const totalDays = metWeeks * 7 + silentDays;
      const origin = key(shift(-(totalDays + 2)));
      await putAll(db, 'configSnapshots', snaps.map((s, i) => (i === 0 ? { ...s, effectiveFrom: origin } : s)));
      await putAll(db, 'settings', [{ ...settings[0], firstUseDate: origin }]);

      const runs = [];
      let index = 0;
      for (let week = 0; week < metWeeks; week += 1) {
        for (const [slot, offset] of [[0, 0], [1, 3]]) {
          const at = shift(-(totalDays - (week * 7 + offset)));
          const date = key(at);
          // Pace improves week by week; a second distance if one was asked for.
          const metres = secondDistance !== null && slot === 1 ? secondDistance : distanceMetres;
          const minPerKm = 6.0 - week * 0.15;
          runs.push({
            id: `seedrun-${index}`,
            date,
            weekKey: isoWeek(at),
            performedAt: new Date(at.setHours(7, 0, 0, 0)).toISOString(),
            source: 'manual',
            externalId: null,
            distanceMetres: metres,
            durationSeconds: Math.round((metres / 1000) * minPerKm * 60),
            elevationMetres: null,
            steps: null,
            note: null,
            legacyCarryOver: false,
            configSnapshotId: snaps[0].id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          index += 1;
        }
      }
      await putAll(db, 'runs', runs);
      return runs.length;
    },
    { metWeeks, silentDays, distanceMetres, secondDistance },
  );
}

async function ready(opts = {}, seed = null) {
  const ctx = await browser.newContext({ ...phone, ...opts });
  const page = await ctx.newPage();
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await onboard(page, { gym: 0, running: 2 });
  if (seed) {
    await seedRuns(page, seed);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);
  }
  return { ctx, page };
}

/**
 * Where Running's board lives: inside the Gym workspace under Bereiche, in
 * its own Laufen section. Verlauf keeps the daily Laufen row and nothing else.
 */
async function openProgress(page) {
  await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
  await page.waitForTimeout(700);
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(2500);
  await page.locator('[data-metric="running-rating"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
}

/* ── Logging stays one tap, distance is optional ────────────────────────── */
{
  const { ctx, page } = await ready();

  check('a run is logged in one tap', await page.getByRole('button', { name: 'Lauf eintragen' }).isVisible());
  await page.getByRole('button', { name: 'Lauf eintragen' }).click();
  await page.waitForTimeout(900);

  // The run exists with no distance and no duration at all.
  const saved = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('momentum');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows = await new Promise((res, rej) => {
      const r = db.transaction(['runs'], 'readonly').objectStore('runs').getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return rows.map((x) => ({ d: x.distanceMetres, t: x.durationSeconds }));
  });
  check('and saves with neither distance nor duration',
    saved.length === 1 && saved[0].d === null && saved[0].t === null, JSON.stringify(saved));

  // Open its detail sheet and add a distance.
  await page.locator('.training-session, .today__session, button').filter({ hasText: /km|Lauf/ }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  const sheetOpen = await page.getByText('Distanz', { exact: true }).isVisible().catch(() => false);
  check('the run detail offers a distance field', sheetOpen);
  if (sheetOpen) {
    check('and says supplying it is optional',
      await page.getByText(/Optional\. Mit Distanz und Dauer/).isVisible());
    check('the unit is metric',
      (await page.locator('#session-distance').getAttribute('placeholder')) === 'km');
    await page.locator('#session-distance').fill('5');
    await page.locator('#session-duration').fill('30');
    await page.waitForTimeout(400);
    check('and derived pace is shown once both are given',
      await page.getByText(/Tempo 6:00 min\/km/).isVisible());
    const clip = await clipped(page);
    check('the run sheet is not clipped', clip.length === 0, clip.slice(0, 2).join('; '));
    const small = await smallTargets(page);
    check('the run sheet keeps its targets', small.length === 0, small.slice(0, 2).join('; '));
  }
  await ctx.close();
}

/* ── Inside the Endurance Phase ─────────────────────────────────────────── */
{
  const { ctx, page } = await ready({}, { metWeeks: 2 });
  await openProgress(page);

  check('the Running rating is the headline', await page.locator('[data-metric="running-rating"] .metric-tile__value').isVisible());
  const rating = await page.locator('[data-metric="running-rating"] .metric-tile__value').textContent();
  check('and is stated out of 1000', /von 1000/.test(rating ?? ''), rating?.trim());

  check('the Endurance Phase is named', await page.getByText('Ausdauerphase').first().isVisible());
  check('the phase is said to be in progress, in words', await page.getByText('Ausdauerphase läuft').isVisible());
  check('it says the rating is calculating anyway',
    await inSheet(page, 'running-endurance', (sheet) =>
      sheet.getByText(/Rating wird bereits normal berechnet/).isVisible()));
  check('the rating tile carries no rank — the Boss is the only rank',
    (await page.locator('[data-metric="running-rating"] .metric-tile__kicker').count()) === 0 &&
      (await page.locator('[data-metric="running-rating"] .badge-svg').count()) === 0);

  check('year-to-date pace is a visible secondary headline',
    await page.getByText('Tempo seit Jahresbeginn').isVisible());
  check('attendance is visible and separate', await page.getByText('Anwesenheit').first().isVisible());
  check('attendance counts runs against the target',
    /von 2 Läufen/.test((await page.locator('[data-metric="running-attendance"] .metric-tile__value').textContent()) ?? ''));

  const ytdSheet = await inSheet(page, 'running-ytd', async (sheet) => ({
    comparable: await sheet.getByText(/Nur Läufe mit ähnlicher Distanz/).isVisible(),
    text: await sheet.locator('.sheet__body').textContent(),
  }));
  check('it explains that only similar distances are compared', ytdSheet.comparable);

  const body = [
    ...(await page.locator('[data-metric] .metric-tile__line').allTextContents()),
    ytdSheet.text ?? '',
  ];
  check('no grid mechanics leak into the copy',
    !body.some((text) => /Band|Anker|Logarith|ANCHOR|WIDTH/i.test(text)),
    body.find((text) => /Band|Anker|Logarith/i.test(text)) ?? '');

  let clip = await clipped(page);
  check('the Endurance state is not clipped', clip.length === 0, clip.slice(0, 2).join('; '));
  let small = await smallTargets(page);
  check('its targets hold', small.length === 0, small.slice(0, 2).join('; '));
  await ctx.close();
}

/* ── A mature, unlocked runner with two distance ranges ─────────────────── */
{
  const { ctx, page } = await ready({}, { metWeeks: 6, distanceMetres: 5000, secondDistance: 10000 });
  await openProgress(page);

  check('the Endurance Phase is gone once complete',
    !(await page.getByText('Ausdauerphase läuft').isVisible().catch(() => false)));
  check('and the rating tile still carries no rank',
    (await page.locator('[data-metric="running-rating"] .metric-tile__kicker').count()) === 0);
  check('the 40/60 split is explained',
    await inSheet(page, 'running-rating', (sheet) =>
      sheet.getByText(/40 % Anwesenheit und 60 % Tempoentwicklung/).isVisible()));

  const ranges = await page.locator('.running-range').count();
  check('the two distance ranges are listed separately', ranges === 2, String(ranges));
  const labels = await page.locator('.running-range__label').allTextContents();
  check('and are labelled in kilometres, not band numbers',
    labels.every((l) => /km/.test(l)), labels.join(' | '));

  const ytd = await page.locator('[data-metric="running-ytd"] .metric-tile__value').textContent();
  check('the year-to-date figure is a real percentage', /%|Gehalten/.test(ytd ?? ''), ytd?.trim());

  const clip = await clipped(page);
  check('the mature Running state is not clipped', clip.length === 0, clip.slice(0, 2).join('; '));
  await ctx.close();
}

/* ── A break long enough to decay ───────────────────────────────────────── */
{
  const { ctx, page } = await ready({}, { metWeeks: 6, silentDays: 16 });
  await openProgress(page);

  check('a running break is surfaced', await page.getByText('Laufpause').isVisible());
  check('it says how long the break has been',
    /\d+ Tage ohne Lauf/.test((await page.getByText(/Tage ohne Lauf/).textContent()) ?? ''));
  check('it says what has been reduced',
    await page.getByText(/deines Fortschritts abgebaut/).isVisible());
  const breakSheet = await inSheet(page, 'running-decay', async (sheet) => ({
    untouched: await sheet.getByText(/aufgezeichneten Läufe und deine Tempowerte bleiben unverändert/).isVisible(),
    floor: await sheet.getByText(/Untergrenze/).isVisible(),
    resume: await sheet.getByText(/gespeicherter Lauf beendet die Pause sofort/).isVisible(),
  }));
  check('it says what has not been touched', breakSheet.untouched);
  check('it says the rating has a floor', breakSheet.floor);
  check('it says how to stop it', breakSheet.resume);
  await ctx.close();
}

/* ── Four widths, and long German labels ────────────────────────────────── */
for (const width of [320, 360, 393, 430]) {
  const { ctx, page } = await ready(
    { viewport: { width, height: 780 } },
    { metWeeks: 6, silentDays: 16, distanceMetres: 5000, secondDistance: 10000 },
  );
  await openProgress(page);

  const clip = await clipped(page);
  check(`the Running overview is not clipped at ${width}px`, clip.length === 0, clip.slice(0, 2).join('; '));
  const small = await smallTargets(page);
  check(`its targets hold at ${width}px`, small.length === 0, small.slice(0, 2).join('; '));
  const noScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  check(`the page does not scroll sideways at ${width}px`, noScroll);
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
