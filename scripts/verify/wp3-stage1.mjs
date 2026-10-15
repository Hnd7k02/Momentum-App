import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { URL_APP, check, clipped, onboard, openMuscles, phone, seed, seedMuscles, smallTargets, summary } from './lib.mjs';

/**
 * WP3, Stage 1 — B4, B5, B6, B9, B10, B11, B12 on the real production
 * build, at 393, 430 and 320, plus the screenshot set for every screen the
 * stage touched.
 *
 *   B4   the hub's week line reads the same weekly count as Heute, on the
 *        day of the very first session
 *   B5   the muscle rows sit on the card's content edge: no list inset
 *   B6   a change that rounds to 0 % reads "0 %" / "Gehalten" in the
 *        neutral state — rows, hub markers, exercise list and detail
 *   B9   one-tap "Lauf eintragen" writes once per double tap, offers an
 *        undo toast above the tab bar, and the toast leaves on its own
 *   B10  28px between the Boss card and the next section label
 *   B11  a picker row never repeats a detail its group label contains
 *   B12  "Frontheben" exists, reads "vordere Schulter · Schultern", and a
 *        set logged under it is stored against the shoulders
 *
 * Every context runs on a fixed clock, so nothing depends on the weekday:
 * CLOCK=YYYY-MM-DD (default 2026-10-14, a Wednesday) is that day's noon in
 * Europe/Berlin; a full ISO instant with an offset is taken as given.
 * Screenshots go to docs/design/wp3/stage1/wp3-stage1-<width>-<slug>.png.
 */
const OUT = process.env.OUT ?? 'docs/design/wp3/stage1';
mkdirSync(OUT, { recursive: true });
const TZ = 'Europe/Berlin';
const SIZES = [
  [393, 852],
  [430, 932],
  [320, 693],
];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/**
 * The German names of every offered catalogue entry, read from the source
 * the build was made from, so B11 can say it looked at the whole list and
 * not merely at whatever rendered.
 */
const CATALOGUE_NAMES = readFileSync('src/core/gym/catalogue.ts', 'utf8')
  .split('\n')
  .filter((line) => /^\s*\{ id: 'ex_/.test(line) && !/deprecated: true/.test(line))
  .map((line) => /names: de\((['"])(.*?)\1/.exec(line)?.[2] ?? null)
  .filter(Boolean)
  .sort();

/* ── the clock ───────────────────────────────────────────────────────── */

/** The Berlin wall-clock noon of a day, as an instant with its own offset. */
function berlinNoon(day) {
  for (const offset of ['+02:00', '+01:00']) {
    const instant = new Date(`${day}T12:00:00${offset}`);
    const hour = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(instant);
    if (hour === '12') return { instant, iso: `${day}T12:00:00${offset}` };
  }
  throw new Error(`no Berlin noon for ${day}`);
}
const CLOCK_ENV = process.env.CLOCK ?? '2026-10-14';
const CLOCK = /^\d{4}-\d{2}-\d{2}$/.test(CLOCK_ENV)
  ? berlinNoon(CLOCK_ENV)
  : { instant: new Date(CLOCK_ENV), iso: CLOCK_ENV };
if (Number.isNaN(CLOCK.instant.getTime())) throw new Error(`CLOCK is not a date: ${CLOCK_ENV}`);
/** The Berlin calendar day of the clock, for the page-clock check. */
const CLOCK_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(CLOCK.instant);
console.log(`clock: ${CLOCK.iso} (${TZ}, day ${CLOCK_DAY})`);

/* ── helpers ─────────────────────────────────────────────────────────── */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const short = (value, n = 260) => {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

/** Reads until `ok` holds or the time is up; returns the last read. */
async function until(read, ok, { timeout = 8000, gap = 250 } = {}) {
  const started = Date.now();
  let value = await read();
  while (!ok(value) && Date.now() - started < timeout) {
    await sleep(gap);
    value = await read();
  }
  return value;
}

/** The trimmed text of the first match, or null when there is none. */
const textOf = async (locator) =>
  (await locator.count()) > 0 ? ((await locator.first().textContent()) ?? '').trim() : null;

const idb = (page, store) =>
  page.evaluate(async (s) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  }, store);

const shotPath = (width, slug) => `${OUT}/wp3-stage1-${width}-${slug}.png`;

/** clipped() and smallTargets() on the screen as it stands, both asserted empty. */
async function layoutChecks(page, label) {
  const clip = await clipped(page);
  check(`${label}: nothing is clipped`, clip.length === 0, clip.slice(0, 3).join('; '));
  const small = await smallTargets(page);
  check(`${label}: every control is a real target`, small.length === 0, small.slice(0, 4).join('; '));
}

async function newPage(width, height) {
  const ctx = await browser.newContext({ ...phone, viewport: { width, height }, timezoneId: TZ });
  // Before the first navigation, so the app never sees another day.
  await ctx.clock.setSystemTime(CLOCK.instant);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

async function pageDayCheck(page, label) {
  const day = await page.evaluate(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  check(`${label}: the page clock is on ${CLOCK_DAY}`, day === CLOCK_DAY, day);
}

const tab = (page, name) => page.locator('.tab-bar button', { hasText: name });

/** The Gym section on Heute: its label is hidden and names the region. */
const gymSection = (page) => page.locator('section[aria-label="Gym"]');
/** The Running section on Heute, by its visible label. */
const runningSection = (page) =>
  page.locator('section.section').filter({ has: page.locator('h2.section__label', { hasText: /^Laufen$/ }) });

/** Commits a value into a set field the way a user does: type, then leave. */
async function commitField(page, input, value) {
  await input.click();
  await input.fill(value);
  await input.blur();
  await page.waitForTimeout(700);
}

/** The exercise card of a session screen, by the exercise's shown name. */
const exerciseCard = (page, name) =>
  page.locator('.card').filter({ has: page.locator('.gym-exercise__name', { hasText: name }) });

async function openPicker(page) {
  await page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
  await page.waitForTimeout(500);
  await page.locator('.gym-picker__row').first().waitFor({ timeout: 5000 });
}

async function search(page, query) {
  await page.getByRole('textbox', { name: 'Suchen' }).fill(query);
  await page.waitForTimeout(350);
}

const pickerRows = (page) =>
  page.locator('.gym-picker__row').evaluateAll((rows) =>
    rows.map((row) => ({
      name: (row.querySelector('.gym-picker__name')?.textContent ?? '').trim(),
      groups: (row.querySelector('.gym-picker__groups')?.textContent ?? '').trim(),
    })),
  );

/**
 * Two gym days per group, written as a user's sessions and sets would be:
 * calves +0.4 % (Wadenheben 100 kg → 100.4 kg × 10), forearms −0.3 %
 * (Unterarm-Curls 100 kg → 99.7 kg × 10), nine and two days back. Both
 * round to 0 %. A day that already has a session gets the set in it.
 */
async function seedZeroChanges(page) {
  return page.evaluate(async () => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (db, s) => new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const putAll = (db, s, recs) => new Promise((res, rej) => { const tx = db.transaction([s], 'readwrite'); for (const r of recs) tx.objectStore(s).put(r); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    const removeAll = (db, s, ids) => new Promise((res, rej) => { const tx = db.transaction([s], 'readwrite'); for (const id of ids) tx.objectStore(s).delete(id); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    const key = (d) => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const shift = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
    const isoWeek = (d) => { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3); const y = t.getFullYear(); const f = new Date(y, 0, 4, 12); f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3); return `${pad(y, 4)}-W${pad(1 + Math.round((t - f) / (7 * 86400000)))}`; };

    const db = await open();
    const snaps = await all(db, 'configSnapshots');
    // seedMuscles() gives calves one calf-raise day and forearms two
    // hammer-curl days; those would sit inside the comparison, so they go.
    const stale = (await all(db, 'gymSets'))
      .filter((s) => s.exerciseId === 'ex_calf_raise' || s.exerciseId === 'ex_hammer_curl')
      .map((s) => s.id);
    await removeAll(db, 'gymSets', stale);

    const existing = await all(db, 'gymSessions');
    const sessions = [];
    const sets = [];
    const stamp = new Date().toISOString();
    const sessionFor = (back) => {
      const at = shift(-back);
      const date = key(at);
      const found = existing.find((s) => s.date === date) ?? sessions.find((s) => s.date === date);
      if (found) return found;
      const performedAt = new Date(shift(-back).setHours(18, 0, 0, 0)).toISOString();
      const session = { id: `wp3s1-gym-${date}`, date, weekKey: isoWeek(at), performedAt, planId: null, note: null,
        legacyCarryOver: false, configSnapshotId: snaps[0].id, createdAt: performedAt, updatedAt: performedAt };
      sessions.push(session);
      return session;
    };
    const log = (back, exerciseId, muscles, weightGrams) => {
      const session = sessionFor(back);
      sets.push({ id: `wp3s1-set-${exerciseId}-${session.date}`, sessionId: session.id, exerciseId, date: session.date,
        weightGrams, reps: 10, order: 0, muscles, primaryMuscles: muscles, loadType: 'external', createdAt: stamp });
    };
    log(9, 'ex_calf_raise', ['calves'], 100000);
    log(2, 'ex_calf_raise', ['calves'], 100400);
    log(9, 'ex_wrist_curl', ['forearms'], 100000);
    log(2, 'ex_wrist_curl', ['forearms'], 99700);
    if (sessions.length) await putAll(db, 'gymSessions', sessions);
    await putAll(db, 'gymSets', sets);
    return { removed: stale.length, sessions: sessions.length, sets: sets.length, days: [key(shift(-9)), key(shift(-2))] };
  });
}

/** The ten muscle rows as the screen shows them. */
const muscleRows = (page) =>
  page.locator('.muscle-row').evaluateAll((rows) =>
    rows.map((row) => {
      const right = row.querySelector('.muscle-row__right');
      const delta = row.querySelector('.muscle-row__delta');
      return {
        name: (row.querySelector('.muscle-row__name')?.textContent ?? '').trim(),
        state: [...(right?.classList ?? [])].find((c) => c.startsWith('muscle-row__right--'))?.slice('muscle-row__right--'.length) ?? null,
        delta: delta ? (delta.textContent ?? '').trim() : null,
        color: delta ? getComputedStyle(delta).color : null,
      };
    }),
  );

for (const [width, height] of SIZES) {
  const W = `${width}`;

  /* ── A: fresh install — B4, B11, B12 ──────────────────────────────── */
  {
    const { ctx, page, errors } = await newPage(width, height);
    await onboard(page, { gym: 3, running: 2 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await pageDayCheck(page, `${W} A`);

    // The first session, through Heute's quick log.
    await page.getByRole('button', { name: 'Session eintragen' }).click();
    await page.waitForTimeout(800);
    if ((await page.locator('[role="dialog"]').getByRole('button', { name: 'Freie Session' }).count()) > 0) {
      await page.locator('[role="dialog"]').getByRole('button', { name: 'Freie Session' }).click();
      await page.waitForTimeout(800);
    }
    check(`${W}: Session eintragen opens a free session`, (await page.locator('.gym-session').count()) === 1);

    /* B11 — the whole list, then the searched case. */
    await openPicker(page);
    const everyRow = await pickerRows(page);
    const repeats = everyRow.filter(({ groups }) => {
      const [first, ...rest] = groups.split(' · ');
      return first && rest.some((part) => part.toLowerCase().includes(first.toLowerCase()));
    });
    const shownNames = everyRow.map((r) => r.name).sort();
    const missing = CATALOGUE_NAMES.filter((name) => !shownNames.includes(name));
    check(`${W}: B11 the empty search lists every catalogue entry (${everyRow.length} rows, ${CATALOGUE_NAMES.length} in the catalogue)`,
      CATALOGUE_NAMES.length > 0 && missing.length === 0 && everyRow.length === CATALOGUE_NAMES.length,
      missing.length ? `missing: ${missing.join('|')}` : `${everyRow.length} vs ${CATALOGUE_NAMES.length}`);
    check(`${W}: B11 no row starts with a detail its group label already contains`, repeats.length === 0,
      repeats.slice(0, 4).map((r) => `${r.name}: ${r.groups}`).join(' | '));
    const bench = everyRow.find((r) => r.name === 'Bankdrücken');
    check(`${W}: B11 Bankdrücken does not say Brust twice`, bench?.groups === 'Brust · Trizeps · Schultern', bench?.groups ?? 'missing');

    await search(page, 'Beinbeuger');
    const legRows = await pickerRows(page);
    const legCurl = legRows.find((r) => r.name === 'Beinbeuger Maschine');
    check(`${W}: B11 Beinbeuger Maschine reads exactly "Beinbeuger und Gesäss"`, legCurl?.groups === 'Beinbeuger und Gesäss',
      legCurl ? legCurl.groups : `missing among ${legRows.map((r) => r.name).join('|')}`);
    await page.screenshot({ path: shotPath(width, 'picker-beinbeuger') });
    await layoutChecks(page, `${W} picker «Beinbeuger»`);

    /* B12 — the new catalogue entry is offered. */
    await search(page, 'Frontheben');
    const frontRows = await pickerRows(page);
    const front = frontRows.find((r) => r.name === 'Frontheben');
    check(`${W}: B12 Frontheben is offered as "vordere Schulter · Schultern"`, front?.groups === 'vordere Schulter · Schultern',
      front ? front.groups : `rows: ${frontRows.map((r) => `${r.name}=${r.groups}`).join('|')}`);
    await page.screenshot({ path: shotPath(width, 'picker-frontheben') });
    await layoutChecks(page, `${W} picker «Frontheben»`);

    /* B4 — Bankdrücken 8 × 60, Fertig. */
    await search(page, 'Bankdrücken');
    await page.locator('.gym-picker__row').filter({ has: page.locator('.gym-picker__name', { hasText: /^Bankdrücken$/ }) }).first().click();
    await page.waitForTimeout(900);
    const benchSet = exerciseCard(page, 'Bankdrücken').locator('.gym-set').first();
    await commitField(page, benchSet.locator('input').nth(0), '8');
    await commitField(page, benchSet.locator('input').nth(1), '60');
    const benchStored = (await idb(page, 'gymSets')).filter((s) => s.exerciseId === 'ex_bench_press');
    check(`${W}: B4 the first set is stored as 8 × 60 kg`, benchStored.length === 1 && benchStored[0].reps === 8 && benchStored[0].weightGrams === 60000,
      short(benchStored.map((s) => [s.reps, s.weightGrams])));
    await page.getByRole('button', { name: 'Fertig' }).click();
    await page.waitForTimeout(900);

    const heuteWeek = await until(() => textOf(gymSection(page).locator('.week__value')), (v) => /^1 \/ 3/.test(v ?? ''));
    check(`${W}: B4 Heute's Gym week reads 1 / 3`, /^1 \/ 3 /.test(heuteWeek ?? ''), String(heuteWeek));
    check(`${W}: B4 exactly one session is stored`, (await idb(page, 'gymSessions')).length === 1);

    await page.getByRole('button', { name: 'Gym öffnen' }).click();
    await page.waitForTimeout(1200);
    const hubWeek = await until(() => textOf(page.locator('.gym-hub__week')), (v) => v === '1 von 3 Sessions diese Woche');
    check(`${W}: B4 the hub's week line reads exactly "1 von 3 Sessions diese Woche"`, hubWeek === '1 von 3 Sessions diese Woche', String(hubWeek));
    check(`${W}: B4 the hub says today's session is logged`, (await textOf(page.locator('.gym-hub__last'))) === 'Heute bereits eine Session erfasst.',
      String(await textOf(page.locator('.gym-hub__last'))));
    await page.screenshot({ path: shotPath(width, 'hub-first-session') });
    await layoutChecks(page, `${W} hub after the first session`);

    /* B12 — log Frontheben 10 × 8 into today's free session. */
    await page.getByRole('button', { name: 'Training fortsetzen' }).click();
    await page.waitForTimeout(900);
    check(`${W}: B12 the hub continues today's session`, (await page.locator('.gym-session').count()) === 1 && (await exerciseCard(page, 'Bankdrücken').count()) === 1);
    await openPicker(page);
    await search(page, 'Frontheben');
    await page.locator('.gym-picker__row').filter({ has: page.locator('.gym-picker__name', { hasText: /^Frontheben$/ }) }).first().click();
    await page.waitForTimeout(900);
    const frontSet = exerciseCard(page, 'Frontheben').locator('.gym-set').first();
    check(`${W}: B12 Frontheben arrives with a set row`, (await frontSet.count()) === 1);
    const frontMuscles = await textOf(exerciseCard(page, 'Frontheben').locator('.gym-exercise__muscles'));
    check(`${W}: B12 the workout card describes it as "vordere Schulter · Schultern"`, frontMuscles === 'vordere Schulter · Schultern', String(frontMuscles));
    await commitField(page, frontSet.locator('input').nth(0), '10');
    await commitField(page, frontSet.locator('input').nth(1), '8');
    const frontStored = await until(
      async () => (await idb(page, 'gymSets')).filter((s) => s.exerciseId === 'ex_front_raise'),
      (rows) => rows.length === 1 && rows[0].reps === 10 && rows[0].weightGrams === 8000,
      { timeout: 3000 },
    );
    const fs0 = frontStored[0];
    check(`${W}: B12 the set is stored as 10 × 8 kg under ex_front_raise`, frontStored.length === 1 && fs0.reps === 10 && fs0.weightGrams === 8000,
      short(frontStored.map((s) => [s.reps, s.weightGrams])));
    check(`${W}: B12 the stored set counts for the shoulders, primary`,
      JSON.stringify(fs0?.muscles) === '["shoulders"]' && JSON.stringify(fs0?.primaryMuscles) === '["shoulders"]',
      short({ muscles: fs0?.muscles, primaryMuscles: fs0?.primaryMuscles }));
    await page.getByRole('button', { name: 'Fertig' }).click();
    await page.waitForTimeout(800);
    check(`${W}: B12 still one session for the day`, (await idb(page, 'gymSessions')).length === 1);

    check(`${W} A: no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* ── B: Heute with some history — B10, B9 ─────────────────────────── */
  {
    const { ctx, page, errors } = await newPage(width, height);
    await onboard(page, { gym: 3, running: 2 });
    await seed(page, { days: 14 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await pageDayCheck(page, `${W} B`);
    await page.locator('.boss-summary').waitFor({ timeout: 8000 });

    /* B10 — the gap under the Boss card. */
    const gap = await page.evaluate(() => {
      const boss = document.querySelector('.boss-summary').getBoundingClientRect();
      const labels = [...document.querySelectorAll('.today__scroll .section__label')]
        .map((el) => ({ text: el.textContent.trim(), top: el.getBoundingClientRect().top, h: el.getBoundingClientRect().height }))
        .filter((l) => l.h > 0 && l.top >= boss.bottom - 0.5)
        .sort((a, b) => a.top - b.top);
      return labels[0] ? { gap: labels[0].top - boss.bottom, label: labels[0].text } : null;
    });
    check(`${W}: B10 28px between the Boss card and the next section label`, gap !== null && Math.abs(gap.gap - 28) <= 1, short(gap));

    /* B9 — one write per double tap. */
    const runs0 = (await idb(page, 'runs')).length;
    check(`${W}: B9 no run before the first tap`, runs0 === 0, String(runs0));
    await page.getByRole('button', { name: 'Lauf eintragen' }).dblclick();
    await page.waitForTimeout(1200);
    const runs1 = await idb(page, 'runs');
    check(`${W}: B9 a double tap on Lauf eintragen stores exactly one run`, runs1.length === 1, String(runs1.length));
    const runWeek = await until(() => textOf(runningSection(page).locator('.week__value')), (v) => /^1 \/ 2/.test(v ?? ''));
    check(`${W}: B9 the running card counts it once`, /^1 \/ 2 /.test(runWeek ?? ''), String(runWeek));
    check(`${W}: B9 one toast`, (await page.locator('.toast').count()) === 1, String(await page.locator('.toast').count()));
    check(`${W}: B9 the toast says "Lauf eingetragen."`, (await textOf(page.locator('.toast__message'))) === 'Lauf eingetragen.', String(await textOf(page.locator('.toast__message'))));
    const undo = page.locator('.toast').getByRole('button', { name: 'Rückgängig' });
    check(`${W}: B9 the toast offers Rückgängig`, (await undo.count()) === 1);

    const placement = await page.evaluate(() => {
      const t = document.querySelector('.toast')?.getBoundingClientRect();
      const a = document.querySelector('.toast__action')?.getBoundingClientRect();
      const bar = document.querySelector('.tab-bar')?.getBoundingClientRect();
      if (!t || !a || !bar) return null;
      return { toastTop: t.top, toastBottom: t.bottom, toastLeft: t.left, toastRight: t.right, barTop: bar.top,
        actionW: a.width, actionH: a.height, vw: window.innerWidth };
    });
    check(`${W}: B9 the toast sits above the tab bar, not over it`, placement !== null && placement.toastBottom < placement.barTop, short(placement));
    check(`${W}: B9 the toast is inside the viewport`, placement !== null && placement.toastLeft >= 0 && placement.toastRight <= placement.vw, short(placement));
    check(`${W}: B9 the undo action is at least 44 × 44`, placement !== null && placement.actionW >= 44 && placement.actionH >= 44, short(placement));

    await undo.click();
    await page.waitForTimeout(1200);
    const runs2 = await idb(page, 'runs');
    check(`${W}: B9 Rückgängig removes the run`, runs2.length === 0, String(runs2.length));
    const runWeekAfterUndo = await until(() => textOf(runningSection(page).locator('.week__value')), (v) => /^0 \/ 2/.test(v ?? ''));
    check(`${W}: B9 the running card shows 0 again`, /^0 \/ 2 /.test(runWeekAfterUndo ?? ''), String(runWeekAfterUndo));
    check(`${W}: B9 the toast is gone after the undo`, (await page.locator('.toast').count()) === 0);

    // Once more, and then nobody touches it.
    await page.getByRole('button', { name: 'Lauf eintragen' }).click();
    // The finger is gone: no pointer rests where the toast appears.
    await page.mouse.move(Math.round(width / 2), 8);
    const shown = Date.now();
    await page.locator('.toast').waitFor({ timeout: 3000 }).catch(() => undefined);
    check(`${W}: B9 the second log shows the toast`, (await page.locator('.toast').count()) === 1);
    await page.locator('.today__scroll').evaluate((el) => { el.scrollTop = 0; });
    await page.waitForTimeout(250);
    await page.screenshot({ path: shotPath(width, 'heute-toast') });
    check(`${W}: B9 the toast was still up for the screenshot`, (await page.locator('.toast').count()) === 1);
    await layoutChecks(page, `${W} Heute with the toast`);
    await sleep(Math.max(0, 5600 - (Date.now() - shown)));
    check(`${W}: B9 after ~5.6 s untouched the toast is gone`, (await page.locator('.toast').count()) === 0, String(await page.locator('.toast').count()));
    const runs3 = await idb(page, 'runs');
    check(`${W}: B9 and the run stays`, runs3.length === 1, String(runs3.length));

    // The toast never floats beside a sheet: it is stacked under the sheet
    // layer, and opening a sheet dismisses it (review of Stage 1 — its undo
    // sat over the run sheet's Sichern and could delete the run being edited).
    await page.getByRole('button', { name: 'Lauf eintragen' }).click();
    await page.locator('.toast').waitFor({ timeout: 3000 }).catch(() => undefined);
    check(`${W}: B9 the third log shows the toast`, (await page.locator('.toast').count()) === 1);
    const layers = await page.evaluate(() => ({
      toast: Number(getComputedStyle(document.querySelector('.toast-anchor')).zIndex),
    }));
    await runningSection(page).locator('.row').last().click();
    await page.locator('.sheet').waitFor({ timeout: 3000 });
    const scrim = await page.evaluate(() => Number(getComputedStyle(document.querySelector('.sheet-scrim')).zIndex));
    check(`${W}: B9 the toast is stacked below the sheet layer`, layers.toast < scrim, short({ ...layers, scrim }));
    check(`${W}: B9 opening the run sheet dismisses the toast`, (await page.locator('.toast').count()) === 0, String(await page.locator('.toast').count()));
    const save = await page.locator('.sheet__footer button.button--primary').boundingBox();
    const onSave = save
      ? await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.sheet') !== null, [save.x + save.width / 2, save.y + save.height - 4])
      : false;
    check(`${W}: B9 nothing covers the sheet's Sichern`, onSave, short(save));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    check(`${W}: B9 both runs are still stored`, (await idb(page, 'runs')).length === 2, String((await idb(page, 'runs')).length));

    // From the keyboard: a held Enter repeats, a quick double press is two
    // presses. Either is one run (review of the Stage 1 fixes).
    const logButton = page.getByRole('button', { name: 'Lauf eintragen' });
    await logButton.focus();
    for (let i = 0; i < 20; i += 1) {
      await page.keyboard.down('Enter');
      await sleep(30);
    }
    await page.keyboard.up('Enter');
    await page.waitForTimeout(1200);
    check(`${W}: B9 a held Enter logs one run`, (await idb(page, 'runs')).length === 3, String((await idb(page, 'runs')).length));
    check(`${W}: B9 the log button keeps focus`, await logButton.evaluate((el) => el === document.activeElement));
    await page.keyboard.press('Enter');
    await sleep(120);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
    check(`${W}: B9 a quick double Enter logs one run`, (await idb(page, 'runs')).length === 4, String((await idb(page, 'runs')).length));

    // Opening a workout is a new task too: the toast goes, and the workout's
    // own sheets stack at the shell, above where a toast would be.
    await page.getByRole('button', { name: 'Lauf eintragen' }).click();
    await page.locator('.toast').waitFor({ timeout: 3000 }).catch(() => undefined);
    check(`${W}: B9 (precondition) the toast is up`, (await page.locator('.toast').count()) === 1);
    await page.getByRole('button', { name: 'Session eintragen' }).click();
    await page.waitForTimeout(700);
    if ((await page.locator('[role="dialog"]').getByRole('button', { name: 'Freie Session' }).count()) > 0) {
      await page.locator('[role="dialog"]').getByRole('button', { name: 'Freie Session' }).click();
    }
    await page.locator('.gym-session').waitFor({ timeout: 5000 });
    check(`${W}: B9 opening the workout dismisses the toast`, (await page.locator('.toast').count()) === 0, String(await page.locator('.toast').count()));
    await page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
    await page.locator('.sheet').waitFor({ timeout: 3000 });
    const shellLevel = await page.evaluate(() => document.querySelector('.sheet-scrim')?.parentElement === document.body);
    check(`${W}: B9 the workout's picker sheet stacks at the shell, not inside the workout`, shellLevel);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Fertig' }).click();
    await page.waitForTimeout(1000);

    /* B10 on a paused day: the pause line sits between the Boss card and
       the first section, and takes the same 28px rhythm on both sides. */
    await page.evaluate(async (from) => {
      const db = await new Promise((res, rej) => { const q = indexedDB.open('momentum'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
      await new Promise((res, rej) => {
        const tx = db.transaction(['pausePeriods'], 'readwrite');
        const stamp = new Date().toISOString();
        tx.objectStore('pausePeriods').put({ id: 'wp3-stage1-pause', from, to: from, reason: null, createdAt: stamp, updatedAt: stamp });
        tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
      });
      db.close();
    }, CLOCK_DAY);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.today__paused').waitFor({ timeout: 8000 });
    await page.locator('.boss-summary').waitFor({ timeout: 8000 });
    const pausedGaps = await page.evaluate(() => {
      const boss = document.querySelector('.boss-summary').getBoundingClientRect();
      const pause = document.querySelector('.today__paused').getBoundingClientRect();
      const next = [...document.querySelectorAll('.today__scroll .section__label')]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.height > 0 && r.top >= pause.bottom - 0.5)
        .sort((a, b) => a.top - b.top)[0];
      return { above: pause.top - boss.bottom, below: next ? next.top - pause.bottom : null };
    });
    check(`${W}: B10 on a paused day 28px between the Boss card and the pause line`, Math.abs(pausedGaps.above - 28) <= 1, short(pausedGaps));
    check(`${W}: B10 on a paused day 28px between the pause line and the next section label`, pausedGaps.below !== null && Math.abs(pausedGaps.below - 28) <= 1, short(pausedGaps));
    await page.locator('.today__scroll').evaluate((el) => { el.scrollTop = 0; });
    await page.waitForTimeout(250);
    await page.screenshot({ path: shotPath(width, 'heute-paused') });
    await layoutChecks(page, `${W} Heute on a paused day`);

    check(`${W} B: no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* ── A3: Fertig while the draft's first set is still saving ────────── */
  /*
   * The cursor is still in the kg field when "Fertig" is tapped: the blur
   * saves the set — and turns the draft into a session — a moment before the
   * tap lands. The workout closes once that write is stored and stays closed
   * (review of the Stage 1 fixes: a late session id reopened it, without the
   * set on screen).
   */
  {
    const { ctx, page, errors } = await newPage(width, height);
    await onboard(page, { gym: 3, running: 0 });
    await page.evaluate(async () => {
      const db = await new Promise((res, rej) => { const q = indexedDB.open('momentum'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
      await new Promise((res, rej) => {
        const tx = db.transaction(['gymPlans'], 'readwrite');
        tx.objectStore('gymPlans').put({ id: 'wp3-stage1-plan', kind: 'userTrainingPlan', version: 1, name: 'Push',
          exercises: [{ exerciseId: 'ex_bench_press', name: 'Bankdrücken', order: 0 }],
          createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z' });
        tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
      });
      db.close();
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await page.getByRole('button', { name: 'Session eintragen' }).click();
    await page.waitForTimeout(700);
    await page.locator('.plan-chooser .row').filter({ hasText: 'Push' }).first().click();
    await page.waitForTimeout(900);
    check(`${W}: A3 the plan draft is open`, (await page.locator('.gym-session').count()) === 1);
    const pendingRow = page.locator('.gym-set--pending').first();
    await pendingRow.locator('input').nth(0).fill('8');
    await pendingRow.locator('input').nth(1).fill('60');
    await page.getByRole('button', { name: 'Fertig' }).click();
    const closedAfter = await until(() => page.locator('.gym-session').count(), (n) => n === 0, { timeout: 2000, gap: 50 });
    const open = [];
    for (let i = 0; i < 8; i += 1) {
      await sleep(250);
      open.push(await page.locator('.gym-session').count());
    }
    check(`${W}: A3 the workout closes once the set is stored`, closedAfter === 0, String(closedAfter));
    check(`${W}: A3 and stays closed for the next 2 s`, open.every((n) => n === 0), short(open));
    const sessions = await idb(page, 'gymSessions');
    const sets = await idb(page, 'gymSets');
    check(`${W}: A3 the set typed before Fertig is stored, in one session`,
      sessions.length === 1 && sets.length === 1 && sets[0].reps === 8 && sets[0].weightGrams === 60000 && sets[0].sessionId === sessions[0].id,
      short({ sessions: sessions.length, sets: sets.map((x) => [x.reps, x.weightGrams]) }));
    const week = await until(() => textOf(gymSection(page).locator('.week__value')), (v) => /^1 \/ 3/.test(v ?? ''));
    check(`${W}: A3 Heute counts the session at once`, /^1 \/ 3 /.test(week ?? ''), String(week));
    check(`${W} A3: no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* ── A2: the start week on the Gym board — D127 ─────────────────────── */
  /*
   * Gym only, installed mid-week, one session: the board starts the same day
   * (no daily obligation holds it open), and the week has no ledger target.
   * The attendance tile says so instead of "0 von 0" (review of Stage 1).
   */
  if (new Date(`${CLOCK_DAY}T12:00:00Z`).getUTCDay() !== 1) {
    const { ctx, page, errors } = await newPage(width, height);
    await onboard(page, { gym: 3, running: 0, wellbeing: false });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await page.getByRole('button', { name: 'Gym öffnen' }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Training erfassen' }).click();
    await page.waitForTimeout(900);
    await openPicker(page);
    await search(page, 'Kniebeuge');
    const squat = (await pickerRows(page)).find((r) => r.name === 'Kniebeuge');
    check(`${W}: B11 Kniebeuge drops a two-part detail its groups both say`, squat?.groups === 'Quadrizeps · Beinbeuger und Gesäss · Rumpf', squat?.groups ?? 'missing');
    await page.locator('.gym-picker__row').filter({ has: page.locator('.gym-picker__name', { hasText: /^Kniebeuge$/ }) }).first().click();
    await page.waitForTimeout(900);
    const squatSet = exerciseCard(page, 'Kniebeuge').locator('.gym-set').first();
    await commitField(page, squatSet.locator('input').nth(0), '5');
    await commitField(page, squatSet.locator('input').nth(1), '80');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await page.waitForTimeout(1500);
    const hubWeek = await until(() => textOf(page.locator('.gym-hub__week')), (v) => v === '1 von 3 Sessions diese Woche');
    check(`${W}: D127 the Training card states the week against the user's target`, hubWeek === '1 von 3 Sessions diese Woche', String(hubWeek));
    const tile = page.locator('[data-metric="gym-attendance"]');
    await tile.waitFor({ timeout: 6000 }).catch(() => undefined);
    const shown = (await tile.count()) === 1
      ? {
          number: await textOf(tile.locator('.metric-tile__number')),
          scale: await tile.locator('.metric-tile__scale').count(),
          line: await textOf(tile.locator('.metric-tile__line')),
          bar: await tile.locator('[role="meter"], [role="progressbar"], .metric-bar').count(),
        }
      : null;
    check(`${W}: D127 the start week's attendance tile is no data — "–", no scale, no bar`,
      shown !== null && shown.number === '–' && shown.scale === 0 && shown.bar === 0, short(shown));
    check(`${W}: D127 it says "Startwoche · zählt ab Montag"`, shown?.line === 'Startwoche · zählt ab Montag', short(shown));
    check(`${W}: D127 nothing on the board reads "0 von 0"`, !/\b0 von 0\b/.test((await page.locator('.areas__scroll').textContent()) ?? ''));
    // The whole board in view: its rating tile at the top of the scroller.
    await page.evaluate(() => {
      const board = document.querySelector('[data-metric="gym-rating"]');
      const scroller = board?.closest('.areas__scroll');
      if (board && scroller) scroller.scrollTop += board.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 48;
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: shotPath(width, 'hub-start-week') });
    await layoutChecks(page, `${W} hub in the start week`);

    /*
     * A week on, Gym is switched off; a week after that it has no target
     * again — and the tile says the domain is off rather than calling it a
     * start week. The rating has started, so the board still shows.
     */
    const later = (days) => {
      const d = new Date(`${CLOCK_DAY}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + days);
      return berlinNoon(d.toISOString().slice(0, 10)).instant;
    };
    await ctx.clock.setSystemTime(later(7));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.getByRole('switch', { name: 'Gym', exact: true }).click();
    await page.waitForTimeout(1200);
    const nextWeek = await textOf(tile.locator('.metric-tile__line'));
    check(`${W}: D127 the week Gym is switched off keeps Monday's target`, nextWeek === 'Diese Woche', String(nextWeek));
    await ctx.clock.setSystemTime(later(14));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const offLine = await until(() => textOf(tile.locator('.metric-tile__line')), (v) => v === 'Ausgeschaltet · kein Wochenziel');
    check(`${W}: D127 a switched-off Gym says "Ausgeschaltet · kein Wochenziel"`, offLine === 'Ausgeschaltet · kein Wochenziel', String(offLine));
    check(`${W}: D127 and its number is no data`, (await textOf(tile.locator('.metric-tile__number'))) === '–', String(await textOf(tile.locator('.metric-tile__number'))));
    check(`${W}: D127 the Training card states no week while Gym is off`, (await page.locator('.gym-hub__week').count()) === 0, String(await textOf(page.locator('.gym-hub__week'))));
    // Framed on the attendance tile itself: with the Endurance Phase over it
    // spans the width and sits below the fold at 320.
    await page.evaluate(() => {
      const board = document.querySelector('[data-metric="gym-attendance"]');
      const scroller = board?.closest('.areas__scroll');
      if (board && scroller) scroller.scrollTop += board.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 48;
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: shotPath(width, 'hub-gym-off') });
    await layoutChecks(page, `${W} hub with Gym switched off`);
    check(`${W} A2: no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* ── C: a seeded profile — B5, B6 ──────────────────────────────────── */
  {
    const { ctx, page, errors } = await newPage(width, height);
    await onboard(page, { gym: 3, running: 2 });
    await seed(page, { days: 42 });
    await seedMuscles(page, { days: 42 });
    const seeded = await seedZeroChanges(page);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await pageDayCheck(page, `${W} C`);
    check(`${W}: B6 the two zero-change groups are seeded`, seeded.sets === 4, short(seeded));

    await page.getByRole('button', { name: 'Gym öffnen' }).click();
    await page.waitForTimeout(1800);
    // The hub's ten markers are the body's tint in miniature, in MUSCLE_GROUPS
    // order: calves is the ninth, forearms the tenth, back the second.
    const markers = await until(
      () => page.locator('.gym-hub__previewState').evaluateAll((els) => els.map((el) => [...el.classList].find((c) => c.startsWith('gym-hub__previewState--'))?.split('--')[1] ?? null)),
      (m) => m.length === 10 && m[8] !== 'noData',
    );
    check(`${W}: B6 the hub tints calves and forearms as held`, markers[8] === 'unchanged' && markers[9] === 'unchanged', markers.join(','));

    await openMuscles(page, { wait: 4500 });
    await page.locator('.muscle-row').first().waitFor({ timeout: 8000 });

    /* B5 — no list inset, at this width. */
    const inset = await page.evaluate(() => {
      const list = document.querySelector('.muscle-rows');
      const s = getComputedStyle(list);
      const card = list.closest('.card');
      const cs = getComputedStyle(card);
      const cr = card.getBoundingClientRect();
      const row = list.querySelector('.muscle-row').getBoundingClientRect();
      return {
        paddingInlineStart: s.paddingInlineStart,
        marginBlockStart: s.marginBlockStart,
        marginBlockEnd: s.marginBlockEnd,
        rowLeft: Math.round(row.left * 100) / 100,
        contentLeft: Math.round((cr.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft)) * 100) / 100,
      };
    });
    check(`${W}: B5 the muscle list has no start inset`, inset.paddingInlineStart === '0px', short(inset));
    check(`${W}: B5 the muscle list has no block margins`, inset.marginBlockStart === '0px' && inset.marginBlockEnd === '0px', short(inset));
    check(`${W}: B5 the first row starts on the card's content edge`, Math.abs(inset.rowLeft - inset.contentLeft) <= 1, short(inset));

    /* B6 — the rows. */
    const rows = await muscleRows(page);
    const calves = rows.find((r) => r.name === 'Waden');
    const forearms = rows.find((r) => r.name === 'Unterarme');
    const genuine = rows.find((r) => r.state === 'unchanged' && r.name !== 'Waden' && r.name !== 'Unterarme');
    check(`${W}: B6 Waden (+0.4 %) reads "0 %" as held`, calves?.delta === '0 %' && calves?.state === 'unchanged', short(calves));
    check(`${W}: B6 Unterarme (−0.3 %) reads "0 %" as held`, forearms?.delta === '0 %' && forearms?.state === 'unchanged', short(forearms));
    check(`${W}: B6 a genuinely unchanged group is on screen to compare with`, Boolean(genuine && genuine.delta === '0 %'), short(genuine ?? rows));
    if (genuine) {
      check(`${W}: B6 the held colour is the genuinely held one (${genuine.name})`,
        calves?.color === genuine.color && forearms?.color === genuine.color,
        `${calves?.color} | ${forearms?.color} | ${genuine.name} ${genuine.color}`);
    }
    await page.locator('.muscle-row').filter({ has: page.locator('.muscle-row__name', { hasText: /^Waden$/ }) })
      .evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: shotPath(width, 'muscles-zero') });
    await layoutChecks(page, `${W} muscle rows`);

    /* B6 — the exercise list, unfiltered. */
    const listRow = (name) =>
      page.locator('.gym-progress__row').filter({ has: page.locator('.gym-progress__rowName', { hasText: new RegExp(`^${name}$`) }) });
    const listed = async (name) => {
      const row = listRow(name);
      if ((await row.count()) === 0) return null;
      return row.first().evaluate((el) => {
        const change = el.querySelector('.gym-progress__change');
        return { text: (change?.textContent ?? '').trim(), kind: [...(change?.classList ?? [])].find((c) => c.startsWith('gym-progress__change--')) ?? null };
      });
    };
    const calfRow = await listed('Wadenheben');
    const wristRow = await listed('Unterarm-Curls Kurzhantel');
    check(`${W}: B6 Wadenheben reads Gehalten in the exercise list`, calfRow?.text === 'Gehalten' && calfRow?.kind === 'gym-progress__change--unchanged', short(calfRow));
    check(`${W}: B6 Unterarm-Curls Kurzhantel reads Gehalten in the exercise list`, wristRow?.text === 'Gehalten' && wristRow?.kind === 'gym-progress__change--unchanged', short(wristRow));
    if ((await listRow('Unterarm-Curls Kurzhantel').count()) > 0) {
      await listRow('Unterarm-Curls Kurzhantel').first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: shotPath(width, 'exercise-list') });
    await layoutChecks(page, `${W} exercise list`);

    /* B6 — the exercise detail, both cases. */
    for (const [name, shoot] of [['Wadenheben', true], ['Unterarm-Curls Kurzhantel', false]]) {
      if ((await listRow(name).count()) === 0) {
        check(`${W}: B6 ${name} detail opens`, false, 'no row in the exercise list');
        continue;
      }
      await listRow(name).first().click();
      await page.waitForTimeout(900);
      const title = await textOf(page.locator('.gym-detail__title'));
      const value = await page.locator('.gym-detail__figure').nth(2).locator('.gym-detail__value').evaluate((el) => ({
        text: (el.textContent ?? '').trim(),
        unchanged: el.classList.contains('gym-detail__value--unchanged'),
        classes: el.className,
      })).catch(() => null);
      check(`${W}: B6 ${name} detail opens`, title === name, String(title));
      check(`${W}: B6 ${name} detail's change reads Gehalten, neutral`, value?.text === 'Gehalten' && value?.unchanged === true, short(value));
      if (shoot) {
        await page.screenshot({ path: shotPath(width, 'exercise-detail') });
        await layoutChecks(page, `${W} exercise detail`);
      }
      await page.locator('.gym-detail .gym-session__back').click();
      await page.waitForTimeout(700);
    }

    check(`${W} C: no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}

await browser.close();
process.exit(summary() ? 0 : 1);
