import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, summary, phone, onboard, clipped, smallTargets, inSheet, openMuscles } from './lib.mjs';

/**
 * Phase 4.1: the Gym scoring model on the screen.
 *
 * What phase 4 verified was the pipeline reaching the progress hierarchy.
 * What this verifies is the *rating* — the 40/60 headline, the year-to-date
 * performance beneath it, attendance beside that, and the three states a Gym
 * user can be in that did not exist before: inside the Endurance Phase, out
 * of it, and on a break long enough to decay.
 */

const browser = await chromium.launch({
  executablePath: CHROMIUM,
});

const pad = (n, l = 2) => String(n).padStart(l, '0');

/**
 * Writes gym sessions and sets straight into IndexedDB.
 *
 * The fixture is anchored to **ISO weeks**, because that is what the ledger
 * counts: `metWeeks` complete Monday-to-Sunday weeks with a session on the
 * Monday, Wednesday and Friday of each, ending with the last complete week
 * that finishes at least `silentDays` before today (at least one day, so the
 * running week is never seeded). Counting 7-day blocks back from the run
 * date instead meant that from Thursday to Sunday a block straddled two ISO
 * weeks, the "middle week" deleted by `weekKey` was not the seed's middle
 * block, and the Endurance balance read 1.0 where the assertion said 1.5 —
 * correctly, for the input it had been given.
 */
async function seedGym(page, { metWeeks, silentDays = 0, improving = true }) {
  return page.evaluate(
    async ({ metWeeks, silentDays, improving }) => {
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
      const shift = (n, from = new Date()) => {
        const d = new Date(from);
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

      // The last day that may hold a session, then back to the Sunday that
      // closes the last complete ISO week on or before it.
      const end = shift(-Math.max(1, silentDays));
      const lastSunday = shift(-(end.getDay() % 7), end);
      const firstMonday = shift(-6 - 7 * (metWeeks - 1), lastSunday);
      const origin = key(shift(-2, firstMonday));

      const db = await open();
      const snaps = await all(db, 'configSnapshots');
      const settings = await all(db, 'settings');
      await putAll(db, 'configSnapshots', snaps.map((s, i) => (i === 0 ? { ...s, effectiveFrom: origin } : s)));
      await putAll(db, 'settings', [{ ...settings[0], firstUseDate: origin }]);

      const sessions = [];
      const sets = [];
      let setIndex = 0;
      for (let week = 0; week < metWeeks; week += 1) {
        for (const offset of [0, 2, 4]) {
          const at = shift(week * 7 + offset, firstMonday);
          const date = key(at);
          const id = `seed-${date}`;
          sessions.push({
            id,
            date,
            weekKey: isoWeek(at),
            performedAt: new Date(at.setHours(18, 0, 0, 0)).toISOString(),
            planId: null,
            note: null,
            legacyCarryOver: false,
            configSnapshotId: snaps[0].id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          const kg = improving ? 100 + week * 10 : 100;
          sets.push({
            id: `seedset-${setIndex}`,
            sessionId: id,
            exerciseId: 'ex_squat',
            date,
            weightGrams: Math.round(kg * 1000),
            reps: 5,
            order: 0,
            muscles: ['quadriceps', 'hamstringsGlutes', 'core'],
            primaryMuscles: ['quadriceps'],
            loadType: 'external',
            createdAt: new Date().toISOString(),
          });
          setIndex += 1;
        }
      }
      await putAll(db, 'gymSessions', sessions);
      await putAll(db, 'gymSets', sets);
      return { sessions: sessions.length, sets: sets.length };
    },
    { metWeeks, silentDays, improving },
  );
}

/**
 * `CLOCK=YYYY-MM-DD` runs the suite as if today were that date: the page's
 * clock is shifted before it loads, timers keep running. For proving the
 * fixtures mean the same thing on any weekday; unset, today is today.
 */
async function ready(opts = {}, seedOpts = null) {
  const ctx = await browser.newContext({ ...phone, ...opts });
  if (process.env.CLOCK) await ctx.clock.setSystemTime(new Date(`${process.env.CLOCK}T12:00:00`));
  const page = await ctx.newPage();
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await onboard(page, { gym: 3, running: 0 });
  if (seedOpts) {
    await seedGym(page, seedOpts);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);
  }
  return { ctx, page };
}

async function openProgress(page) {
  await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
  await page.waitForTimeout(1400);
  // The Gym workspace is the Gym area of the domain terminal under Bereiche.
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(900);
}

/* ── The Endurance Phase, still in progress ─────────────────────────────── */
{
  const { ctx, page } = await ready({}, { metWeeks: 2 });
  await openProgress(page);

  check('the Gym rating is the headline', await page.locator('[data-metric="gym-rating"] .metric-tile__value').isVisible());
  const rating = await page.locator('[data-metric="gym-rating"] .metric-tile__value').textContent();
  check('and it is stated out of 1000', /von 1000/.test(rating ?? ''), rating?.trim());

  check('the Endurance Phase is named', await page.getByText('Ausdauerphase').first().isVisible());
  check('the phase is said to be in progress, in words',
    await page.getByText('Ausdauerphase läuft').isVisible());
  const progress = await page.locator('[data-metric="gym-endurance"] .metric-tile__value').textContent();
  check('endurance progress is stated in weeks', /von 4 Wochen/.test(progress ?? ''), progress?.trim());
  check('it is not mislabelled as performance',
    !/Leistungsentwicklung/.test((await page.locator('[data-metric="gym-endurance"] .metric-tile__line').textContent()) ?? ''));
  check('it says the rating is calculating anyway',
    await inSheet(page, 'gym-endurance', (sheet) =>
      sheet.getByText(/Rating wird bereits normal berechnet/).isVisible()));
  check('the rating tile carries no rank — the Boss is the only rank',
    (await page.locator('[data-metric="gym-rating"] .metric-tile__kicker').count()) === 0 &&
      (await page.locator('[data-metric="gym-rating"] .badge-svg').count()) === 0);

  check('the year-to-date performance is a visible secondary headline',
    await page.getByText('Leistung seit Jahresbeginn').isVisible());
  check('attendance is visible and separate',
    await page.getByText('Anwesenheit').first().isVisible());
  const attendance = await page.locator('[data-metric="gym-attendance"] .metric-tile__value').textContent();
  check('attendance is stated as sessions against the target',
    /von 3 Sessions/.test(attendance ?? ''), attendance?.trim());

  let clip = await clipped(page);
  check('the Endurance state is not clipped', clip.length === 0, clip.slice(0, 2).join('; '));
  let small = await smallTargets(page);
  check('its targets hold', small.length === 0, small.slice(0, 2).join('; '));
  await ctx.close();
}

/* ── A setback: a missed week costs half, and does not reset ────────────── */
{
  const { ctx, page } = await ready({}, { metWeeks: 3 });
  // Remove the middle week's sessions, which is the setback.
  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('momentum');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows = await new Promise((res, rej) => {
      const r = db.transaction(['gymSessions'], 'readonly').objectStore('gymSessions').getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const weeks = [...new Set(rows.map((s) => s.weekKey))].sort();
    const drop = rows.filter((s) => s.weekKey === weeks[1]).map((s) => s.id);
    await new Promise((res, rej) => {
      const tx = db.transaction(['gymSessions'], 'readwrite');
      for (const id of drop) tx.objectStore('gymSessions').delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  await openProgress(page);

  const progress = await page.locator('[data-metric="gym-endurance"] .metric-tile__value').textContent();
  check('a missed week costs half a week rather than the balance',
    /1\.5 von 4 Wochen/.test(progress ?? ''), progress?.trim());
  check('and the phase is still running', await page.getByText('Ausdauerphase läuft').isVisible());
  await ctx.close();
}

/* ── Unlocked: a mature Gym state ───────────────────────────────────────── */
{
  const { ctx, page } = await ready({}, { metWeeks: 6 });
  await openProgress(page);

  check('the Endurance Phase is gone once it is complete',
    !(await page.getByText('Ausdauerphase läuft').isVisible().catch(() => false)));
  check('and the rating tile still carries no rank',
    (await page.locator('[data-metric="gym-rating"] .metric-tile__kicker').count()) === 0);
  check('the 40/60 split is explained',
    await inSheet(page, 'gym-rating', (sheet) =>
      sheet.getByText(/40\s% Anwesenheit und 60\s% persönlicher Leistungsentwicklung/).isVisible()));

  const ytd = await page.locator('[data-metric="gym-ytd"] .metric-tile__value').textContent();
  check('the year-to-date figure is a real percentage', /%|Gehalten/.test(ytd ?? ''), ytd?.trim());

  await openMuscles(page, { wait: 1500 });
  check('the detail hierarchy is on Muskelgruppen',
    await page.locator('[data-metric="gym-overall"]').isVisible());
  check('and the muscle module is still there, with its ten rows',
    (await page.locator('.muscle-module').count()) === 1 && (await page.locator('.muscle-row').count()) === 10);

  let clip = await clipped(page);
  check('the mature Gym state is not clipped', clip.length === 0, clip.slice(0, 2).join('; '));
  await ctx.close();
}

/* ── A break long enough to decay ───────────────────────────────────────── */
{
  const { ctx, page } = await ready({}, { metWeeks: 6, silentDays: 16 });
  await openProgress(page);

  check('a training break is surfaced', await page.getByText('Trainingspause').isVisible());
  const days = await page.getByText(/Tage ohne Session/).textContent();
  check('it says how long the break has been', /\d+ Tage ohne Session/.test(days ?? ''), days?.trim());
  check('it says what has been reduced',
    await page.getByText(/deines Fortschritts abgebaut/).isVisible());
  const breakSheet = await inSheet(page, 'gym-decay', async (sheet) => ({
    untouched: await sheet.getByText(/aufgezeichneten Sätze und deine Leistungswerte bleiben unverändert/).isVisible(),
    floor: await sheet.getByText(/Untergrenze/).isVisible(),
    resume: await sheet.getByText(/gespeicherte Session beendet die Pause sofort/).isVisible(),
  }));
  check('it says what has not been touched', breakSheet.untouched);
  check('it says the rating has a floor', breakSheet.floor);
  check('it says how to stop it', breakSheet.resume);
  // The performance figures are untouched by the break — on Muskelgruppen, since WP2-2.
  await openMuscles(page, { wait: 1500 });
  check('the performance detail is still shown', await page.locator('[data-metric="gym-overall"]').isVisible());
  await ctx.close();
}

/* ── Bodyweight entry ───────────────────────────────────────────────────── */
{
  const { ctx, page } = await ready();
  await page.getByRole('button', { name: 'Session eintragen' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('textbox', { name: 'Suchen' }).fill('Pull-Up');
  await page.waitForTimeout(300);
  // Exact, because "Klimmzüge assistiert" is a different load type — the
  // search matched the stored English name, the row shows the German one.
  await page.locator('.gym-picker__name', { hasText: /^Klimmzüge$/ }).first().click();
  await page.waitForTimeout(800);

  check('a bodyweight exercise asks for a body weight',
    await page.getByText('Körpergewicht').first().isVisible());
  check('and says why it needs one',
    await page.getByText(/Für Körpergewichtsübungen brauchst du dein Körpergewicht/).isVisible());
  check('the set field is labelled as added weight, not weight',
    await page.getByText('Dein Körpergewicht plus, was du zusätzlich trägst.').isVisible());

  await page.locator('.gym-bodyweight__input').fill('85');
  await page.getByRole('button', { name: 'Gewicht sichern' }).click();
  await page.waitForTimeout(900);
  check('saving a body weight clears the warning',
    !(await page.getByText(/Ohne Eintrag werden diese Sätze nicht gewertet/).isVisible().catch(() => false)));

  const clip = await clipped(page);
  check('the bodyweight card is not clipped', clip.length === 0, clip.slice(0, 2).join('; '));
  const small = await smallTargets(page);
  check('the bodyweight card keeps its targets', small.length === 0, small.slice(0, 2).join('; '));
  await ctx.close();
}

/* ── The custom-exercise sheet: roles and load type ─────────────────────── */
{
  const { ctx, page } = await ready();
  await page.getByRole('button', { name: 'Session eintragen' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Eigene Übung' }).click();
  await page.waitForTimeout(400);

  check('a custom exercise can name its primary muscle',
    await page.getByText('Hauptmuskel', { exact: true }).isVisible());
  check('and the 70/30 split is explained',
    await page.getByText(/Hauptmuskeln teilen sich 70\s% der Übung/).isVisible());
  check('and it can say how it is loaded',
    await page.getByText('Belastungsart').isVisible());

  const clip = await clipped(page);
  check('the custom sheet is not clipped', clip.length === 0, clip.slice(0, 2).join('; '));
  const small = await smallTargets(page);
  check('the custom sheet keeps its targets', small.length === 0, small.slice(0, 2).join('; '));
  await ctx.close();
}

/* ── Four widths, and long German labels ────────────────────────────────── */
for (const width of [320, 360, 393, 430]) {
  const { ctx, page } = await ready({ viewport: { width, height: 780 } }, { metWeeks: 6, silentDays: 16 });
  await openProgress(page);

  const clip = await clipped(page);
  check(`the Gym overview is not clipped at ${width}px`, clip.length === 0, clip.slice(0, 2).join('; '));
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
