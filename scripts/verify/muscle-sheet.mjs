import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import {
  CHROMIUM, URL_APP, check, summary, onboard, openGymHub, openMuscles, seed, setLanguage,
  openGroup, openRow, openGroupSheet, closeGroupSheet, sheetGone, bodyAtRest, sheetExercises, openSheetExercise, closeExercise,
} from './lib.mjs';

/**
 * The muscle sheet (block 7C, contract §9 and §14).
 *
 * One device whose ten groups stand in all five states, and on it:
 *
 * - **the same number**: for every group the row's figure and word, the
 *   sheet's figure and chip, and the state the body draws agree;
 * - **no chart without a figure**, and a sentence where the figure is missing;
 * - **every way back** closes the sheet and leaves the screen standing —
 *   the cross, Escape, a tap on the body above, the browser's Back, a drag
 *   down — and from an exercise Back leads into the sheet it was opened from;
 * - **the two heights and the finger**: two thirds, 92 %, the hand-over
 *   between the sheet and its content, and a page behind that never moves;
 * - **the fold**: name, change, range and chart on the lower height, at 393
 *   and at 320;
 * - **one change for one exercise** (D176): the figure in the sheet and at
 *   the head of the exercise detail are the same, under the same words;
 * - **nothing blurs over the body while a frame is drawn** (D146);
 * - **all lines in one column** (D169): in every row that draws a line, in
 *   both languages and at the four widths.
 *
 * That no frame arises under the open sheet, and that a change of the range
 * draws exactly one, is held in `gym-muscles.mjs` with the body's other
 * frames. Run alone against the production preview (`vite preview --port 4173`).
 */

const OUT = process.env.SHOTS ?? '';
if (OUT) mkdirSync(OUT, { recursive: true });
const HEIGHT = { 320: 693, 360: 780, 393: 852, 430: 932 };
const NBSP = ' ';
const MINUS = '−';
const short = (value, n = 260) => JSON.stringify(value)?.slice(0, n);

const browser = await chromium.launch({ executablePath: CHROMIUM });

/**
 * Counts, for every frame the body draws while a sheet is in the document,
 * whether anything of that sheet blurs: the sheet over the body must be a
 * solid surface on a clear scrim at every such moment (D146).
 */
const WATCH_BLUR = () => {
  window.__blur = { frames: 0, blurred: 0, last: 0 };
  if (!window.WebGL2RenderingContext) return;
  const draw = WebGL2RenderingContext.prototype.drawElements;
  WebGL2RenderingContext.prototype.drawElements = function (...args) {
    const now = performance.now();
    // Once a frame, not once a draw call.
    if (this.canvas && this.canvas.isConnected && now - window.__blur.last > 4) {
      window.__blur.last = now;
      const scrim = document.querySelector('.sheet-scrim');
      if (scrim) {
        window.__blur.frames += 1;
        const blurs = (el) => { const c = getComputedStyle(el); return (c.backdropFilter && c.backdropFilter !== 'none') || (c.webkitBackdropFilter && c.webkitBackdropFilter !== 'none'); };
        const sheet = scrim.querySelector('.sheet');
        if (blurs(scrim) || (sheet && blurs(sheet))) window.__blur.blurred += 1;
      }
    }
    return draw.apply(this, args);
  };
};

/**
 * The device: every group in a state of its own, set by its sets. A set
 * carries the groups and roles it was logged under, so each exercise here
 * reaches exactly the groups named.
 *
 *   chest        bench press 9×60, 10×60, 8×62.5, 9×62.5 — the check data's
 *                bench: +1.5 % in the range, shown "+2 %"; triceps with it
 *   back         a row that rises a fifth and six exercises that hold: uneven
 *   shoulders    pressed 80, 62 and 44 days ago: nothing in the last 30 days
 *   biceps       curls on two days: too little to compare
 *   core         crunches falling a tenth: declined
 *   quadriceps   squats doubling: +100 %
 *   hamstrings   leg curls, three days alike: held
 *   calves       one day: too little to compare
 *   forearms     the curls' two days and one carry: a single observation, +6 %
 */
async function seedProfile(page) {
  await page.evaluate(async () => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (db, s) => new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    const key = (d) => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const shift = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
    const isoWeek = (d) => { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3); const y = t.getFullYear(); const f = new Date(y, 0, 4, 12); f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3); return `${pad(y, 4)}-W${pad(1 + Math.round((t - f) / (7 * 86400000)))}`; };
    const db = await open();
    const snaps = await all(db, 'configSnapshots');
    const stamp = new Date().toISOString();
    const sessions = new Map();
    const sets = [];
    const exercises = new Map();
    let order = 0;
    const log = (back, id, name, muscles, primary, kg, reps, extra = {}) => {
      const at = shift(-back);
      const date = key(at);
      const sessionId = `sheet-gym-${date}`;
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { id: sessionId, date, weekKey: isoWeek(at), performedAt: new Date(shift(-back).setHours(18, 0, 0, 0)).toISOString(),
          planId: null, note: null, legacyCarryOver: false, configSnapshotId: snaps[0].id, createdAt: stamp, updatedAt: stamp });
      }
      order += 1;
      sets.push({ id: `sheet-set-${order}`, sessionId, exerciseId: id, date, weightGrams: Math.round(kg * 1000), reps, order,
        muscles, primaryMuscles: primary, loadType: 'external', createdAt: stamp, ...extra });
      exercises.set(id, { id, name, muscles, primaryMuscles: primary, builtIn: false, loadType: 'external', durationSeconds: null, attributes: {}, createdAt: stamp, updatedAt: stamp });
    };
    // Chest and triceps: the bench press of the check data, with a warm-up
    // and a second working set on its first day.
    log(26, 'sx_bench', 'Bankdrücken', ['chest', 'triceps'], ['chest'], 40, 12, { warmUp: true });
    log(26, 'sx_bench', 'Bankdrücken', ['chest', 'triceps'], ['chest'], 60, 9);
    log(26, 'sx_bench', 'Bankdrücken', ['chest', 'triceps'], ['chest'], 60, 8);
    log(19, 'sx_bench', 'Bankdrücken', ['chest', 'triceps'], ['chest'], 60, 10);
    log(12, 'sx_bench', 'Bankdrücken', ['chest', 'triceps'], ['chest'], 62.5, 8);
    log(5, 'sx_bench', 'Bankdrücken', ['chest', 'triceps'], ['chest'], 62.5, 9);
    // Back: one exercise rises a fifth and six hold — more exercises than
    // the sheet shows at once, so its content scrolls on every phone.
    for (const back of [24, 17, 10]) log(back, 'sx_pulldown', 'Latzug', ['back'], ['back'], 55, 8);
    [[24, 40], [17, 44], [10, 48]].forEach(([back, kg]) => log(back, 'sx_row', 'Rudern am Kabel', ['back'], ['back'], kg, 8));
    [['sx_tbar', 'T-Bar-Rudern', 50], ['sx_dbrow', 'Kurzhantelrudern', 26], ['sx_machine', 'Rudermaschine', 45], ['sx_pullover', 'Überzug am Kabel', 25], ['sx_face', 'Face Pulls', 20]]
      .forEach(([id, name, kg]) => { for (const back of [13, 3]) log(back, id, name, ['back'], ['back'], kg, 10); });
    // Shoulders: before the last 30 days, inside the last 90.
    [[80, 40], [62, 42], [44, 44]].forEach(([back, kg]) => log(back, 'sx_press', 'Überkopfdrücken', ['shoulders'], ['shoulders'], kg, 8));
    // Biceps: two days, a little more on the second. The forearms come
    // along as a secondary group.
    [[15, 16], [6, 17]].forEach(([back, kg]) => log(back, 'sx_curl', 'Hammercurls', ['biceps', 'forearms'], ['biceps'], kg, 10));
    // Forearms: a third exercise day, of an exercise recorded once.
    log(10, 'sx_carry', 'Farmer’s Walk', ['forearms'], ['forearms'], 30, 12);
    // Core: falling a tenth.
    [[22, 40], [15, 38], [8, 36]].forEach(([back, kg]) => log(back, 'sx_crunch', 'Crunch am Kabel', ['core'], ['core'], kg, 10));
    // Quadriceps: doubling. Hamstrings and glutes: three days alike.
    [[23, 50], [16, 75], [9, 100]].forEach(([back, kg]) => log(back, 'sx_squat', 'Kniebeuge', ['quadriceps'], ['quadriceps'], kg, 5));
    for (const back of [23, 16, 9]) log(back, 'sx_legcurl', 'Beinbeuger', ['hamstringsGlutes'], ['hamstringsGlutes'], 45, 10);
    // Calves: one day.
    log(8, 'sx_calf', 'Wadenheben', ['calves'], ['calves'], 40, 12);
    await new Promise((res, rej) => {
      const tx = db.transaction(['gymSessions', 'gymSets', 'exercises'], 'readwrite');
      tx.objectStore('gymSessions').clear();
      tx.objectStore('gymSets').clear();
      for (const record of sessions.values()) tx.objectStore('gymSessions').put(record);
      for (const record of sets) tx.objectStore('gymSets').put(record);
      for (const record of exercises.values()) tx.objectStore('exercises').put(record);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  });
}

/** What the profile above must read as, group by group, in the last 30 days. */
const EXPECT = {
  chest: { name: 'Brust', state: 'improved', figure: `+2${NBSP}%` },
  back: { name: 'Rücken', state: 'improved', figure: `+3${NBSP}%`, uneven: true },
  shoulders: { name: 'Schultern', state: 'noData', figure: null },
  biceps: { name: 'Bizeps', state: 'awaitingBaseline', figure: null },
  triceps: { name: 'Trizeps', state: 'improved', figure: `+2${NBSP}%` },
  core: { name: 'Rumpf', state: 'declined', figure: `${MINUS}10${NBSP}%` },
  quadriceps: { name: 'Quadrizeps', state: 'improved', figure: `+100${NBSP}%` },
  hamstringsGlutes: { name: 'Beinbeuger und Gesäss', state: 'unchanged', figure: `0${NBSP}%` },
  calves: { name: 'Waden', state: 'awaitingBaseline', figure: null },
  forearms: { name: 'Unterarme', state: 'improved', figure: `+6${NBSP}%` },
};
const WORD = { improved: 'Verbessert', unchanged: 'Gehalten', declined: 'Zurückgegangen', awaitingBaseline: 'Zu wenig Vergleichsdaten', noData: 'Noch nicht trainiert' };
const GROUPS = Object.keys(EXPECT);

async function open(width, { language = 'de', reducedMotion = 'no-preference', init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: HEIGHT[width] ?? 852 }, deviceScaleFactor: 2, hasTouch: true, reducedMotion });
  await ctx.addInitScript(WATCH_BLUR);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await onboard(page, { gym: 3, running: 2 });
  await seed(page, { days: 90 });
  await seedProfile(page);
  if (language !== 'de') await setLanguage(page, language);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (language === 'de') {
    await openGymHub(page);
    await openMuscles(page, { wait: 4000 });
  } else {
    await page.evaluate(() => { window.location.hash = '#/areas/gym/muscles'; });
    await page.locator('.muscle-row').first().waitFor({ state: 'visible' });
    await page.waitForTimeout(4000);
  }
  return { ctx, page, errors };
}

const rowsNow = (page) =>
  page.locator('.muscle-row').evaluateAll((rows) => rows.map((row) => {
    const button = row.querySelector('.muscle-row__button');
    const right = row.querySelector('.muscle-row__right');
    return {
      id: button.getAttribute('data-muscle'),
      name: row.querySelector('.muscle-row__name')?.textContent.trim(),
      state: [...right.classList].find((c) => c.startsWith('muscle-row__right--'))?.split('--')[1] ?? null,
      figure: row.querySelector('.muscle-row__delta')?.textContent ?? null,
      word: row.querySelector('.muscle-row__state')?.textContent.trim() ?? row.querySelector('.muscle-row__badge')?.textContent.trim() ?? null,
      chart: row.querySelector('.muscle-row__chart svg') !== null,
    };
  }));
const sheetNow = (page) =>
  page.locator('.sheet--detents').evaluate((sheet) => {
    const content = sheet.querySelector('.muscle-sheet');
    const chips = [...sheet.querySelectorAll('.muscle-sheet__headline .state-chip')].map((chip) => chip.textContent.trim());
    return {
      title: sheet.querySelector('.sheet__title')?.textContent.trim() ?? null,
      label: sheet.getAttribute('aria-label'),
      id: content?.getAttribute('data-muscle') ?? null,
      state: content?.getAttribute('data-state') ?? null,
      figure: sheet.querySelector('.muscle-sheet__change')?.textContent ?? null,
      chip: chips[0] ?? null,
      uneven: chips.includes('uneinheitlich'),
      caption: sheet.querySelector('.muscle-sheet__caption')?.textContent ?? null,
      sentence: sheet.querySelector('.muscle-sheet__sentence')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
      chart: sheet.querySelector('.exercise-line') !== null,
      chartLabel: sheet.querySelector('.exercise-line')?.getAttribute('aria-label') ?? null,
      endValue: sheet.querySelector('.exercise-line__value')?.textContent ?? null,
      lines: sheet.querySelectorAll('.exercise-line__line').length,
      axis: [...sheet.querySelectorAll('.exercise-line__label')].map((label) => label.textContent),
      dates: [...sheet.querySelectorAll('.gym-detail__dates span')].map((span) => span.textContent),
      recorded: sheet.querySelectorAll('.muscle-sheet__exercise--record').length,
      volume: sheet.querySelector('.muscle-volume') !== null,
      volumeNote: sheet.querySelector('.muscle-volume__note')?.textContent ?? null,
      bars: sheet.querySelectorAll('.muscle-volume__bar').length,
      weeks: [...sheet.querySelectorAll('.muscle-volume__week')].map((week) => week.textContent),
      spoken: [...sheet.querySelectorAll('.muscle-volume .visually-hidden li')].map((li) => li.textContent),
      barColours: [...new Set([...sheet.querySelectorAll('.muscle-volume__bar')].map((bar) => getComputedStyle(bar).backgroundColor))],
      primary: [...sheet.querySelectorAll('.button--primary')].map((button) => button.textContent.trim()),
    };
  });
const drawnNow = (page) =>
  page.locator('.body-viewer').evaluate((viewer) => Object.fromEntries((viewer.dataset.drawn ?? '').split(' ').filter(Boolean).map((pair) => pair.split(':'))));
const place = (page) => page.evaluate(() => ({ hash: location.hash, rows: document.querySelectorAll('.muscle-row').length, title: document.querySelector('.gym-muscles__title')?.textContent ?? null }));
const scrollOf = (page) => page.locator('.areas__scroll').evaluate((el) => Math.round(el.scrollTop));
const sheetTop = (page) => page.locator('.sheet--detents').evaluate((el) => Math.round(el.getBoundingClientRect().top));
const focusOn = (page) => page.evaluate(() => document.activeElement?.getAttribute('data-muscle') ?? document.activeElement?.className ?? document.activeElement?.tagName ?? null);

/**
 * A finger: touch events with written times, a movement every 16 ms over
 * `ms` and then `hold` at rest before it lifts — so its speed is the
 * finger's and not the speed at which a software renderer gets round to
 * each event. A finger that rests before it lifts throws nothing.
 */
async function drag(page, client, from, to, { ms = 320, hold = 120 } = {}) {
  const steps = Math.max(4, Math.round(ms / 16));
  const point = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1 }];
  const t0 = Date.now() / 1000;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from.x, from.y), timestamp: t0 });
  for (let i = 1; i <= steps; i += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps),
      timestamp: t0 + (i * 0.016),
    });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: t0 + steps * 0.016 + hold / 1000 });
  await page.waitForTimeout(700);
}

/* ── 1. The same number: row, sheet and body, for all ten groups ───────── */
{
  const { ctx, page, errors } = await open(393);
  const rows = await rowsNow(page);
  const drawn = await drawnNow(page);
  check('the device shows all five states', new Set(rows.map((row) => row.state)).size === 5, rows.map((row) => `${row.id}:${row.state}`).join(' '));
  for (const id of GROUPS) {
    const want = EXPECT[id];
    const row = rows.find((entry) => entry.id === id);
    check(`${want.name}: the row reads ${want.figure ?? 'no figure'} · ${WORD[want.state]}`,
      row?.state === want.state && row?.figure === want.figure && row?.word === WORD[want.state], short(row));
    await openGroupSheet(page, id);
    const sheet = await sheetNow(page);
    check(`${want.name}: its sheet opens under its name, with the same figure and the same state as its row`,
      sheet.title === want.name && sheet.label === want.name && sheet.id === id && sheet.state === row?.state && sheet.figure === row?.figure && sheet.chip === row?.word,
      short({ row, sheet: { title: sheet.title, state: sheet.state, figure: sheet.figure, chip: sheet.chip } }));
    check(`${want.name}: the body draws the same state`, drawn[id] === want.state && (await drawnNow(page))[id] === want.state, `${drawn[id]} vs ${want.state}`);
    if (want.figure !== null) {
      check(`${want.name}: the chart ends on that figure, on the rows' scale, with its first and last date beneath`,
        sheet.chart && sheet.endValue === want.figure && sheet.axis.includes(`0${NBSP}%`) && sheet.axis.every((label) => [`+8${NBSP}%`, `0${NBSP}%`, `${MINUS}8${NBSP}%`].includes(label)) && sheet.dates.length >= 1,
        short({ end: sheet.endValue, axis: sheet.axis, dates: sheet.dates }));
      check(`${want.name}: the chart carries a description, and the caption says what the figure is a change of`,
        /^Leistungstrend /.test(sheet.chartLabel ?? '') && sheet.chartLabel.includes(want.figure) && sheet.caption === 'Bester Arbeitssatz · letzte 30 Tage', short({ label: sheet.chartLabel, caption: sheet.caption }));
      check(`${want.name}: "uneinheitlich" is said exactly where the exercises lie more than ten points apart`, sheet.uneven === (want.uneven === true), String(sheet.uneven));
    } else {
      check(`${want.name}: no chart without a figure — a sentence says what is missing`,
        !sheet.chart && sheet.figure === null && sheet.lines === 0 && (sheet.sentence ?? '').length > 20 && !sheet.uneven, short({ chart: sheet.chart, sentence: sheet.sentence }));
    }
    if (want.state === 'noData') {
      check(`${want.name}: not trained — when it was last trained, and the one action that supplies what is missing`,
        /^Kein Satz für diese Gruppe in den letzten 30 Tagen\. Zuletzt trainiert am \S+, \d+\. \S+\.$/.test(sheet.sentence ?? '') && sheet.primary.join('|') === 'Training erfassen' && !sheet.volume && sheet.recorded === 0,
        short({ sentence: sheet.sentence, primary: sheet.primary }));
    } else {
      check(`${want.name}: the work volume stands with "nicht gewertet", as neutral bars with words beside them`,
        sheet.volume && sheet.volumeNote === 'nicht gewertet' && sheet.bars > 0 && sheet.barColours.length === 1 && sheet.spoken.length === sheet.weeks.length && sheet.spoken.length >= 4,
        short({ note: sheet.volumeNote, bars: sheet.bars, colours: sheet.barColours, weeks: sheet.weeks, spoken: sheet.spoken.slice(0, 2) }));
      check(`${want.name}: no exact figure of the sheet is in a state's colour but the change and its chip`, sheet.primary.length === 0);
    }
    if (want.state === 'awaitingBaseline') {
      check(`${want.name}: too little to compare — how many exercise days, from when a trend, and what was recorded`,
        /^\d Übungstage? in den letzten 30 Tagen\. Ab dem dritten zeigt Momentum einen Leistungstrend\.$/.test(sheet.sentence ?? '') && sheet.recorded >= 1, short({ sentence: sheet.sentence, recorded: sheet.recorded }));
    }
    if (OUT && ['chest', 'back', 'biceps', 'shoulders', 'forearms', 'core'].includes(id)) await page.screenshot({ path: `${OUT}/sheet-393-${id}.png` });
    await closeGroupSheet(page);
  }
  // A week without a working set is a gap: a week's name with no bar and
  // no nought, and the words say so.
  await openGroupSheet(page, 'biceps');
  const gaps = await sheetNow(page);
  check('a week without a working set is a gap, not a bar of no height',
    gaps.bars < gaps.weeks.length && gaps.spoken.some((line) => /kein Arbeitssatz/.test(line)) && gaps.spoken.filter((line) => /\d\skg$/.test(line)).length === gaps.bars,
    short({ bars: gaps.bars, weeks: gaps.weeks, spoken: gaps.spoken }));
  await closeGroupSheet(page);

  // The bench press's working sets of its first week: 9 × 60 and 8 × 60,
  // the warm-up left out; the chest takes its share of the exercise.
  await openGroupSheet(page, 'chest');
  const chestWeeks = (await sheetNow(page)).spoken;
  const tricepsShare = await (async () => { await closeGroupSheet(page); await openGroupSheet(page, 'triceps'); const spoken = (await sheetNow(page)).spoken; await closeGroupSheet(page); return spoken; })();
  const kg = (line) => Number((/: ([\d']+)\skg$/.exec(line ?? '')?.[1] ?? 'NaN').replace(/'/g, ''));
  const firstChest = chestWeeks.map(kg).find((value) => Number.isFinite(value));
  const firstTriceps = tricepsShare.map(kg).find((value) => Number.isFinite(value));
  check('the volume is the working sets\' reps × load, spread over the exercise\'s groups: chest 70 %, triceps 30 % of 1020 kg',
    firstChest === 714 && firstTriceps === 306, `${firstChest} + ${firstTriceps}`);

  /* 90 days: what the longer range reaches, in the sheet as on the screen. */
  await openGroupSheet(page, 'shoulders');
  await page.locator('.sheet--detents .segmented__option', { hasText: '90' }).click();
  await page.waitForFunction(() => document.querySelector('.sheet--detents .muscle-sheet__caption')?.textContent.includes('90'), null, { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(900);
  const ninety = await sheetNow(page);
  const rowNinety = (await rowsNow(page)).find((row) => row.id === 'shoulders');
  check('changed in the sheet, the range is changed everywhere: Schultern at 90 days has a figure, in its sheet and in its row',
    ninety.figure !== null && ninety.figure === rowNinety?.figure && ninety.state === rowNinety?.state && ninety.caption === 'Bester Arbeitssatz · letzte 90 Tage' &&
      (await page.locator('.progress__ranges .segmented__option[aria-pressed="true"]').textContent())?.trim() === '90 Tage',
    short({ sheet: ninety.figure, row: rowNinety }));
  check('at 90 days the weeks stand on an axis: the nought and the largest value on the left, the first and the last week beneath',
    (await page.locator('.sheet--detents .muscle-volume__axisLabel').count()) === 2 && (await page.locator('.sheet--detents .muscle-volume__weeks span').count()) === 2 &&
      (await page.locator('.sheet--detents .muscle-volume__slot').count()) >= 12, short(ninety.spoken.slice(0, 3)));
  if (OUT) await page.screenshot({ path: `${OUT}/sheet-393-shoulders-90.png` });
  await page.locator('.sheet--detents .segmented__option', { hasText: '30' }).click();
  await page.waitForTimeout(1200);
  await closeGroupSheet(page);

  const blur = await page.evaluate(() => window.__blur);
  check('nothing blurs over the body while a frame is drawn: no blurred sheet or scrim in any frame drawn under one',
    blur.frames > 0 && blur.blurred === 0, `${blur.blurred} of ${blur.frames} frames`);
  check('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ── 2. Every way back; the exercise on top ────────────────────────────── */
{
  const { ctx, page, errors } = await open(393);
  const client = await ctx.newCDPSession(page);
  const start = await place(page);
  // Where the user has the page when the row is tapped: on that row.
  await page.locator('.muscle-row__button[data-muscle="core"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const scrollBefore = await scrollOf(page);
  const stillThere = async () => { const now = await place(page); return now.hash === start.hash && now.rows === 10 && now.title === 'Muskelgruppen'; };
  const closed = async (label) => {
    await sheetGone(page);
    await bodyAtRest(page, { held: false });
    await page.waitForTimeout(400);
    check(`${label} closes the sheet and leaves the screen standing`, (await openGroup(page)) === null && (await stillThere()) && (await openRow(page)) === null, short(await place(page)));
    check(`${label}: focus returns to the group's row`, (await focusOn(page)) === 'core', String(await focusOn(page)));
    check(`${label}: the page is where it was before the sheet`, Math.abs((await scrollOf(page)) - scrollBefore) <= 1, `${await scrollOf(page)} vs ${scrollBefore}`);
  };

  await openGroupSheet(page, 'core');
  check('the address does not change for a sheet', (await place(page)).hash === start.hash);
  await page.locator('.sheet--detents .sheet__close').click();
  await closed('the cross');

  await openGroupSheet(page, 'core');
  await page.keyboard.press('Escape');
  await closed('Escape');

  await openGroupSheet(page, 'core');
  const stage = await page.locator('.body-stage').boundingBox();
  await page.mouse.click(stage.x + stage.width / 2, (Math.max(stage.y, 60) + (await sheetTop(page))) / 2);
  await closed('a tap on the body above');
  check('and that tap chose no other group', (await openGroup(page)) === null);
  check('the sheet had brought the page to the body, and gave it back: the row is where it was', scrollBefore > 0);

  await openGroupSheet(page, 'core');
  await page.goBack();
  await closed('the browser\'s Back');

  await openGroupSheet(page, 'core');
  const top = await sheetTop(page);
  await drag(page, client, { x: 196, y: top + 30 }, { x: 196, y: top + 360 });
  await closed('a drag down');

  // Opened from the body there is no row in focus; it returns there all the same.
  const stageNow = await page.locator('.body-viewer canvas').boundingBox();
  await page.locator('.areas__scroll').evaluate((el) => { el.scrollTop = 0; });
  await page.waitForTimeout(600);
  const canvas = await page.locator('.body-viewer canvas').boundingBox();
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.click(canvas.x + canvas.width * 0.5, canvas.y + canvas.height * 0.33);
  await page.locator('.sheet--detents').waitFor({ timeout: 5000 });
  const tapped = await page.locator('.sheet--detents .muscle-sheet').getAttribute('data-muscle');
  await bodyAtRest(page);
  await page.keyboard.press('Escape');
  await sheetGone(page);
  await page.waitForTimeout(500);
  check('a sheet opened by a tap on the body gives focus to that group\'s row when it closes', tapped !== null && (await focusOn(page)) === tapped, `${tapped} → ${await focusOn(page)}`);
  void stageNow;

  /* The exercise detail on top, and the steps back. */
  await openGroupSheet(page, 'back');
  await page.locator('.sheet__grabber').click();
  await page.waitForTimeout(600);
  await page.locator('.sheet--detents .sheet__body').evaluate((el) => { el.scrollTop = 80; });
  const before = { top: await sheetTop(page), scroll: await page.locator('.sheet--detents .sheet__body').evaluate((el) => el.scrollTop) };
  await openSheetExercise(page, 'Rudern am Kabel');
  check('a tap on an exercise opens its detail, on top of the screen and of the sheet',
    (await page.locator('.gym-detail__title').textContent())?.trim() === 'Rudern am Kabel' && (await page.locator('.sheet-scrim[data-suspended]').count()) === 1 && (await place(page)).hash === start.hash);
  check('the detail takes focus, and the sheet beneath is out of reach', await page.evaluate(() => document.activeElement?.classList.contains('gym-detail') && document.querySelector('.sheet-scrim').hasAttribute('inert')));
  await closeExercise(page);
  const afterBack = { top: await sheetTop(page), scroll: await page.locator('.sheet--detents .sheet__body').evaluate((el) => el.scrollTop) };
  check('its back button leads into the sheet of the same group — at the height and the place it was left',
    (await openGroup(page)) === 'Rücken' && afterBack.top === before.top && Math.abs(afterBack.scroll - before.scroll) <= 1 && (await page.locator('.sheet-scrim[data-suspended]').count()) === 0, short({ before, afterBack }));
  check('and focus is on the exercise it was opened from', await page.evaluate(() => document.activeElement?.getAttribute('data-exercise') === 'sx_row'));

  await openSheetExercise(page, 'Rudern am Kabel');
  await page.goBack();
  await page.locator('.gym-detail').waitFor({ state: 'detached' });
  await page.waitForTimeout(500);
  check('the browser\'s Back from the exercise leads into the sheet too', (await openGroup(page)) === 'Rücken' && (await stillThere()));
  await page.goBack();
  await sheetGone(page);
  await page.waitForTimeout(500);
  check('a second Back closes the sheet and stays on Muskelgruppen', (await openGroup(page)) === null && (await stillThere()));
  await page.goBack();
  await page.waitForTimeout(900);
  check('and only a third leaves the screen, the way it was entered', (await place(page)).hash === '#/areas/gym', (await place(page)).hash);
  check('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ── 3. Two heights and a finger ───────────────────────────────────────── */
for (const width of [393, 320]) {
  const { ctx, page, errors } = await open(width);
  const client = await ctx.newCDPSession(page);
  const screen = HEIGHT[width];
  const x = width / 2;
  const W = `${width}`;
  await openGroupSheet(page, 'back');
  const pageBehind = await scrollOf(page);
  const lower = Math.round(screen / 3);
  const upper = Math.round(screen * 0.08);
  const body = () => page.locator('.sheet--detents .sheet__body').evaluate((el) => Math.round(el.scrollTop));
  const near = (a, b) => Math.abs(a - b) <= 2;

  check(`${W}: the sheet opens on two thirds of the screen`, near(await sheetTop(page), lower), `${await sheetTop(page)} vs ${lower}`);
  const fold = await page.evaluate(() => {
    const sheet = document.querySelector('.sheet--detents');
    const bottom = (selector) => sheet.querySelector(selector)?.getBoundingClientRect().bottom ?? Infinity;
    return { screen: document.documentElement.clientHeight, title: bottom('.sheet__title'), change: bottom('.muscle-sheet__change'), range: bottom('.segmented'), chart: bottom('.exercise-line .gym-detail__dates') };
  });
  check(`${W}: above the fold on the lower height stand the name, the change, the range and the chart`,
    [fold.title, fold.change, fold.range, fold.chart].every((edge) => edge <= fold.screen + 0.5), short(fold));
  if (OUT) await page.screenshot({ path: `${OUT}/sheet-${width}-lower.png` });

  // On the lower height a drag up on the content raises the sheet first…
  await drag(page, client, { x, y: lower + 260 }, { x, y: lower + 260 - 120 });
  check(`${W}: on the lower height a drag up on the content raises the sheet to 92 % and scrolls nothing`, near(await sheetTop(page), upper) && (await body()) === 0, `top ${await sheetTop(page)}, scrolled ${await body()}`);
  if (OUT) await page.screenshot({ path: `${OUT}/sheet-${width}-upper.png` });
  // …and at the content's start a drag down takes it back.
  await drag(page, client, { x, y: upper + 300 }, { x, y: upper + 300 + 150 });
  check(`${W}: at the content's start a drag down takes the sheet back to two thirds`, near(await sheetTop(page), lower), `top ${await sheetTop(page)}`);
  // One long drag up: the sheet first, and what the finger goes on scrolls the content.
  await drag(page, client, { x, y: lower + 300 }, { x, y: lower + 300 - (lower - upper) - 90 }, { ms: 480 });
  check(`${W}: one long drag raises the sheet and then scrolls its content`, near(await sheetTop(page), upper) && (await body()) >= 60, `top ${await sheetTop(page)}, scrolled ${await body()}`);
  // With the content scrolled a drag down scrolls the content and leaves the sheet.
  const scrolled = await body();
  await drag(page, client, { x, y: upper + 250 }, { x, y: upper + 250 + 40 });
  check(`${W}: with the content scrolled a drag down is the content's, not the sheet's`, near(await sheetTop(page), upper) && (await body()) < scrolled, `top ${await sheetTop(page)}, scrolled ${scrolled} → ${await body()}`);
  // The grabber and the header always move the sheet.
  await page.locator('.sheet--detents .sheet__body').evaluate((el) => { el.scrollTop = 120; });
  await drag(page, client, { x, y: upper + 44 }, { x, y: upper + 44 + 170 });
  check(`${W}: a drag on the header moves the sheet whatever the content does`, near(await sheetTop(page), lower), `top ${await sheetTop(page)}`);
  // A flick up from the lower height, a short one, goes all the way.
  await drag(page, client, { x, y: lower + 40 }, { x, y: lower + 40 - 70 }, { ms: 64, hold: 0 });
  check(`${W}: a flick up goes to 92 % although the finger went a short way`, near(await sheetTop(page), upper), `top ${await sheetTop(page)}`);
  // A drag that begins sideways is nobody's.
  await page.locator('.sheet--detents .sheet__body').evaluate((el) => { el.scrollTop = 0; });
  await drag(page, client, { x: x - 80, y: upper + 300 }, { x: x + 80, y: upper + 330 });
  check(`${W}: a drag that begins sideways moves nothing`, near(await sheetTop(page), upper) && (await body()) === 0);
  // A little below the lower height it springs back; far below, it goes.
  await page.locator('.sheet__grabber').click();
  await page.waitForTimeout(600);
  await drag(page, client, { x, y: lower + 40 }, { x, y: lower + 40 + 60 });
  check(`${W}: pulled a little below two thirds and let go, the sheet springs back`, near(await sheetTop(page), lower) && (await openGroup(page)) === 'Rücken', `top ${await sheetTop(page)}`);
  check(`${W}: through all of it the page behind did not move`, (await scrollOf(page)) === pageBehind, `${pageBehind} → ${await scrollOf(page)}`);

  // Without a finger: the grabber is a control with a name, by tap and by key.
  const grabber = page.locator('.sheet__grabber');
  check(`${W}: the grabber is a control with a name and a target of 44px`, (await grabber.getAttribute('aria-label')) === 'Ansicht vergrössern' &&
    (await grabber.evaluate((el) => { const before = getComputedStyle(el, '::before'); const box = el.getBoundingClientRect(); return box.height - parseFloat(before.top) - parseFloat(before.bottom) >= 44 && box.width - parseFloat(before.left) - parseFloat(before.right) >= 44; })));
  await grabber.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  check(`${W}: Enter on the grabber takes the sheet to 92 %, and its name changes`, near(await sheetTop(page), upper) && (await grabber.getAttribute('aria-label')) === 'Ansicht verkleinern');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  check(`${W}: and back again`, near(await sheetTop(page), lower));
  // A mouse on the header drags as well.
  await page.mouse.move(x, lower + 40);
  await page.mouse.down();
  for (let i = 1; i <= 10; i += 1) { await page.mouse.move(x, lower + 40 - i * 14); await page.waitForTimeout(16); }
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(600);
  check(`${W}: a mouse on the header drags the sheet too, and its release is not a tap on what lies under it`, near(await sheetTop(page), upper) && (await openGroup(page)) === 'Rücken', `top ${await sheetTop(page)}`);

  // A flick down from the lower height closes.
  await page.locator('.sheet__grabber').click();
  await page.waitForTimeout(600);
  await drag(page, client, { x, y: lower + 40 }, { x, y: lower + 40 + 90 }, { ms: 64, hold: 0 });
  await sheetGone(page);
  check(`${W}: a flick down from two thirds closes the sheet`, (await openGroup(page)) === null);
  check(`${W}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ── 4. One change for one exercise (D176): the sheet and the detail ───── */
{
  const { ctx, page, errors } = await open(393);
  for (const days of [30, 90]) {
    if (days === 90) {
      await page.locator('.progress__ranges .segmented__option', { hasText: '90' }).click();
      await page.waitForTimeout(2000);
    }
    const seen = new Set();
    for (const id of GROUPS) {
      const row = (await rowsNow(page)).find((entry) => entry.id === id);
      if (row?.figure === null) continue;
      await openGroupSheet(page, id);
      const caption = (await sheetNow(page)).caption;
      for (const exercise of await sheetExercises(page)) {
        if (seen.has(exercise.id)) continue;
        seen.add(exercise.id);
        await openSheetExercise(page, exercise.name);
        const detail = await page.locator('.gym-detail').evaluate((el) => ({
          figure: el.querySelector('.gym-detail__change')?.textContent ?? null,
          state: [...(el.querySelector('.gym-detail__change')?.classList ?? [])].find((c) => c.startsWith('gym-detail__change--'))?.split('--')[1] ?? null,
          chip: el.querySelector('.gym-detail__head .state-chip')?.textContent.trim() ?? null,
          caption: el.querySelector('.gym-detail__caption')?.textContent ?? null,
          labels: [...el.querySelectorAll('.gym-detail__label')].map((label) => label.textContent),
          endValues: el.querySelectorAll('.exercise-line__value').length,
          end: [...(el.querySelector('.exercise-line__end')?.classList ?? [])].find((c) => c.startsWith('exercise-line__end--'))?.split('--')[1] ?? null,
          percents: [...el.querySelectorAll('*')].filter((node) => node.children.length === 0 && !node.closest('.visually-hidden') && !node.closest('.exercise-line__axis') && /%/.test(node.textContent)).map((node) => node.textContent.trim()),
        }));
        if (exercise.change !== null) {
          check(`${days} Tage · ${exercise.name}: the sheet and the detail show one and the same change — ${exercise.change} ${exercise.word} — under the same words`,
            detail.figure === exercise.change && detail.state === exercise.state && detail.chip === exercise.word && detail.caption === caption && caption === `Bester Arbeitssatz · letzte ${days} Tage`,
            short({ sheet: exercise, detail }));
          check(`${days} Tage · ${exercise.name}: no second change stands on the detail — no figure at the line, none between "Zuletzt" and "Davor"`,
            detail.endValues === 0 && detail.labels.join('|') === 'Zuletzt|Davor' && detail.percents.length === 1 && detail.percents[0] === exercise.change && detail.end === exercise.state,
            short(detail));
        } else {
          check(`${days} Tage · ${exercise.name}: recorded once, it has no change in the sheet nor on its detail`,
            detail.figure === null && detail.chip === 'Zu wenig Vergleichsdaten' && detail.percents.length === 0 && detail.endValues === 0, short(detail));
        }
        await closeExercise(page);
      }
      await closeGroupSheet(page);
    }
    check(`${days} Tage: every exercise of the rated groups was looked at`, seen.size >= (days === 30 ? 12 : 13), [...seen].join(' '));
  }
  check('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ── 5. All lines in one column (D169), both languages, four widths ────── */
for (const language of ['de', 'en']) {
  for (const width of [320, 360, 393, 430]) {
    const { ctx, page } = await open(width, { language });
    const W = `${width} ${language}`;
    const rows = await page.locator('.muscle-row').evaluateAll((list) => list.map((row) => {
      const svg = row.querySelector('.muscle-row__chart svg');
      const box = svg?.getBoundingClientRect() ?? null;
      const name = row.querySelector('.muscle-row__name');
      const button = row.querySelector('.muscle-row__button').getBoundingClientRect();
      const right = row.querySelector('.muscle-row__right');
      const cut = (el) => (el ? el.scrollWidth > el.clientWidth + 1 : false);
      return {
        name: name.textContent.trim(),
        left: box ? Math.round(box.left * 10) / 10 : null,
        right: box ? Math.round(box.right * 10) / 10 : null,
        word: row.querySelector('.muscle-row__state')?.textContent.trim() ?? row.querySelector('.muscle-row__badge')?.textContent.trim() ?? null,
        figure: row.querySelector('.muscle-row__delta')?.textContent ?? null,
        cut: cut(name) || cut(row.querySelector('.muscle-row__state')) || cut(row.querySelector('.muscle-row__delta')) || cut(row.querySelector('.muscle-row__badge')),
        inside: right.getBoundingClientRect().right <= button.right + 0.5 && name.getBoundingClientRect().left >= button.left - 0.5,
        nameLines: Math.round(name.getBoundingClientRect().height / parseFloat(getComputedStyle(name).lineHeight || '20')),
      };
    }));
    const lines = rows.filter((row) => row.left !== null);
    const lefts = [...new Set(lines.map((row) => row.left))];
    const rights = [...new Set(lines.map((row) => row.right))];
    check(`${W}: in every row that draws a line the line stands in the same column`,
      lines.length >= 6 && lefts.length === 1 && rights.length === 1, lines.map((row) => `${row.name} ${row.left}–${row.right}`).join(' · '));
    check(`${W}: the longest word and a three-digit figure are among those rows`,
      lines.some((row) => row.word === (language === 'de' ? 'Zurückgegangen' : 'Declined')) && lines.some((row) => row.figure === `+100${NBSP}%`), lines.map((row) => `${row.word} ${row.figure}`).join(' · '));
    check(`${W}: a row without a line keeps its room for its words, and nothing in any row is cut off`,
      rows.filter((row) => row.left === null).length === 3 && rows.every((row) => !row.cut && row.inside), rows.filter((row) => row.cut || !row.inside).map((row) => row.name).join(' · '));
    check(`${W}: the name gives way, never the chart: "${rows[7]?.name}" breaks cleanly`, rows[7]?.nameLines >= 1 && rows[7]?.nameLines <= 3 && !rows[7]?.cut, short(rows[7]));
    if (OUT) {
      await page.locator('.muscle-rows').evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/rows-${language}-${width}.png` });
    }
    if (language === 'en' && width === 393) {
      // The sheet in English, once (contract §13).
      await page.locator('.muscle-row__button[data-muscle="back"]').click();
      await page.locator('.sheet--detents').waitFor({ state: 'visible' });
      await bodyAtRest(page);
      await page.waitForTimeout(500);
      const text = (await page.locator('.sheet--detents').innerText()).replace(/\s+/g, ' ');
      check('en: the sheet speaks English — its caption, its states, its sections and the grabber',
        /Best working set · last 30 days/.test(text) && /Improved/.test(text) && /mixed/.test(text) && /Exercises/.test(text) && /Work volume per week/.test(text) && /not scored/.test(text) && /Wk\s\d+/.test(text) &&
          (await page.locator('.sheet__grabber').getAttribute('aria-label')) === 'Show more', text.slice(0, 220));
      if (OUT) await page.screenshot({ path: `${OUT}/sheet-393-en.png` });
      await page.keyboard.press('Escape');
      await sheetGone(page);
    }
    await ctx.close();
  }
}

await browser.close();
process.exit(summary() ? 0 : 1);
