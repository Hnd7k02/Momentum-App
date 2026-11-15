import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, clipped, onboard, openMuscles, phone, seedLegacyFood, seedMuscles, smallTargets, summary, textContrast } from './lib.mjs';

/**
 * WP3, Stage 5b — the warm-up mark and the exercise-day metric, on the real
 * production build (D150, D151).
 *
 *   A  the mark, in kg      the set's number is a named toggle with a 44px
 *                           target; marked, the set says "Aufwärmsatz" in a
 *                           word above a row that keeps one line; it is
 *                           stored and survives a reload; "Bester
 *                           Arbeitssatz" never names it, however heavy;
 *                           removing it and undoing brings it back marked;
 *                           "Satz hinzufügen" after it adds a working set
 *   B  the same row in lb   one line, nothing cut off, at every width
 *   C  warm-up sets only    the workout counts for the week; the exercise
 *                           has no value and no zero; Muskelgruppen says
 *                           that only warm-up sets were logged
 *   D  yesterday            a set of yesterday can be marked; the day
 *                           before is not offered at all
 *   E  the update           a device as the live build left it (Food on,
 *                           the three-day window, no metric): one load
 *                           writes one snapshot with all three eras, the
 *                           earlier one untouched; a second load writes
 *                           nothing
 *   F  the build            draws bars: the line proposed at STOP 5b is not
 *                           in the bundle
 *
 * Every context runs on a fixed clock (CLOCK=YYYY-MM-DD, default
 * 2026-11-18, a Wednesday) in Europe/Berlin, at 320, 360, 393 and 430.
 * Screenshots of the set row go to docs/design/wp3/stage5b/.
 */
const OUT = process.env.OUT ?? 'docs/design/wp3/stage5b';
mkdirSync(OUT, { recursive: true });
const TZ = 'Europe/Berlin';
const SIZES = (process.env.WIDTHS ? process.env.WIDTHS.split(',').map(Number) : [320, 360, 393, 430]).map((width) => [
  width,
  { 320: 693, 360: 780, 393: 852, 430: 932 }[width] ?? 852,
]);
const browser = await chromium.launch({ executablePath: CHROMIUM });

function berlinNoon(day) {
  for (const offset of ['+02:00', '+01:00']) {
    const instant = new Date(`${day}T12:00:00${offset}`);
    const hour = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(instant);
    if (hour === '12') return instant;
  }
  throw new Error(`no Berlin noon for ${day}`);
}
const CLOCK_DAY = process.env.CLOCK ?? '2026-11-18';
const dayOffset = (days, from = CLOCK_DAY) => {
  const d = new Date(`${from}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const short = (value, n = 300) => {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s && s.length > n ? `${s.slice(0, n)}…` : s;
};
async function until(read, ok, { timeout = 8000, gap = 200 } = {}) {
  const started = Date.now();
  let value = await read();
  while (!ok(value) && Date.now() - started < timeout) {
    await sleep(gap);
    value = await read();
  }
  return value;
}
const textOf = async (locator) =>
  (await locator.count()) > 0 ? ((await locator.first().textContent()) ?? '').replace(/\s+/g, ' ').trim() : null;
const idb = (page, store) =>
  page.evaluate(async (s) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const rows = await new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    db.close();
    return rows;
  }, store);
async function replaceAll(page, store, records) {
  await page.evaluate(async ([s, rows]) => {
    const db = await new Promise((res, rej) => { const q = indexedDB.open('momentum'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    await new Promise((res, rej) => {
      const tx = db.transaction([s], 'readwrite');
      tx.objectStore(s).clear();
      for (const row of rows) tx.objectStore(s).put(row);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, [store, records]);
}

async function layoutChecks(page, label) {
  const clip = await clipped(page);
  check(`${label}: nothing is clipped`, clip.length === 0, clip.slice(0, 3).join('; '));
  const small = await smallTargets(page);
  check(`${label}: every control is a real target`, small.length === 0, small.slice(0, 4).join('; '));
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${label}: the page is no wider than the screen`, wide <= 0, `${wide}px`);
}

async function newPage(width, height, day = CLOCK_DAY) {
  const ctx = await browser.newContext({ ...phone, viewport: { width, height }, timezoneId: TZ });
  await ctx.clock.setSystemTime(berlinNoon(day));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

const tab = (page, name) => page.locator('.tab-bar button', { hasText: name });
const exerciseCard = (page, name) =>
  page.locator('.gym-session .card').filter({ has: page.locator('.gym-exercise__name', { hasText: new RegExp(`^${name}`) }) });
const rows = (page, name) => exerciseCard(page, name).locator('.gym-set:not(.gym-set--pending)');
const mark = (page, name, number) => page.getByRole('button', { name: `Aufwärmsatz: Satz ${number} von ${name}`, exact: true });
const bestLine = (page, name) => textOf(exerciseCard(page, name).locator('.gym-exercise__best'));

async function pick(page, name) {
  await page.locator('.gym-session__bar').getByRole('button', { name: /Übung hinzufügen/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('textbox', { name: 'Suchen' }).fill(name);
  await page.waitForTimeout(350);
  await page.locator('.gym-picker__row').filter({ has: page.locator('.gym-picker__name', { hasText: new RegExp(`^${name}$`) }) }).first().click();
  await page.waitForTimeout(900);
}

async function logPending(page, name, reps, weight) {
  const row = exerciseCard(page, name).locator('.gym-set--pending');
  await row.locator('input').nth(0).fill(String(reps));
  await row.locator('input').nth(0).blur();
  await page.waitForTimeout(300);
  await row.locator('input').nth(1).fill(String(weight));
  await row.locator('input').nth(1).blur();
  await page.waitForTimeout(1200);
}

/** Types new values into a saved set's two fields, at a person's pace. */
async function editSet(page, name, index, reps, weight) {
  const row = rows(page, name).nth(index);
  await row.locator('input').nth(0).fill(String(reps));
  await row.locator('input').nth(0).blur();
  await page.waitForTimeout(700);
  await row.locator('input').nth(1).fill(String(weight));
  await row.locator('input').nth(1).blur();
  await page.waitForTimeout(900);
}

async function addSet(page, name) {
  await exerciseCard(page, name).getByRole('button', { name: `Satz zu ${name} hinzufügen` }).click();
  await page.waitForTimeout(900);
}

async function openWorkout(page) {
  await page.getByRole('button', { name: 'Session eintragen' }).click();
  await page.waitForTimeout(700);
  const free = page.locator('[role="dialog"]').getByRole('button', { name: 'Freie Session' });
  if ((await free.count()) > 0) {
    await free.click();
    await page.waitForTimeout(700);
  }
  await page.locator('.gym-session__bar').waitFor({ timeout: 5000 });
}

const finish = async (page) => {
  await page.locator('.gym-session').getByRole('button', { name: 'Fertig', exact: true }).click();
  await page.waitForTimeout(1200);
};

const benchSets = async (page) =>
  (await idb(page, 'gymSets'))
    .filter((set) => set.exerciseId === 'ex_bench_press')
    .sort((a, b) => a.order - b.order);

/**
 * The set row, measured: the mark's target, the row on one line, the word
 * above it, and no field cutting off what it holds.
 */
async function rowGeometry(page, name, index) {
  return rows(page, name).nth(index).evaluate((row) => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, mid: (r.top + r.bottom) / 2 };
    };
    const button = row.querySelector('.gym-set__mark');
    const before = getComputedStyle(button, '::before');
    const grow = (v) => (v.endsWith('px') && parseFloat(v) < 0 ? -parseFloat(v) : 0);
    const mark = box(button);
    const inputs = [...row.querySelectorAll('input')];
    const remove = row.querySelector('.gym-set__remove');
    const tag = row.querySelector('.gym-set__tag');
    const card = box(row.closest('.card'));
    return {
      target: {
        width: mark.width + grow(before.left) + grow(before.right),
        height: mark.height + grow(before.top) + grow(before.bottom),
        // Where the target ends on the right, and where the first field begins.
        right: mark.right + grow(before.right),
        fieldLeft: box(inputs[0]).left,
      },
      mids: [mark.mid, ...inputs.map((input) => box(input).mid), box(remove).mid],
      lefts: [mark.left, ...inputs.map((input) => box(input).left), box(remove).left],
      cut: inputs.map((input) => input.scrollWidth - input.clientWidth),
      values: inputs.map((input) => input.value),
      units: [...row.querySelectorAll('.gym-set__unit')].map((unit) => unit.textContent),
      inside: box(row).left >= card.left - 0.5 && box(remove).right <= card.right + 0.5,
      tag: tag
        ? { text: tag.textContent, bottom: box(tag).bottom, top: box(tag).top, rowTop: box(inputs[0]).top, fontSize: parseFloat(getComputedStyle(tag).fontSize), lines: tag.getClientRects().length }
        : null,
      pressed: button.getAttribute('aria-pressed'),
    };
  });
}

function checkRow(label, geometry, { marked }) {
  check(`${label}: the mark is a target of 44px each way`, geometry.target.width >= 44 && geometry.target.height >= 44, short(geometry.target));
  check(`${label}: and its target stops where the first field begins`, geometry.target.right <= geometry.target.fieldLeft + 0.5, short(geometry.target));
  const spread = Math.max(...geometry.mids) - Math.min(...geometry.mids);
  check(`${label}: mark, both fields and the minus stand on one line`, spread <= 1.5, `centres ${geometry.mids.map((v) => v.toFixed(1)).join(', ')}`);
  check(`${label}: in reading order, none wrapped beneath another`, geometry.lefts.every((left, index) => index === 0 || left > geometry.lefts[index - 1]), short(geometry.lefts));
  check(`${label}: no field cuts off what it holds`, geometry.cut.every((px) => px <= 0), `${geometry.values.join(' | ')} over by ${geometry.cut.join(', ')}px`);
  check(`${label}: the row stays inside its card`, geometry.inside);
  if (marked) {
    check(`${label}: a marked set says "Aufwärmsatz" in a word`, geometry.tag?.text === 'Aufwärmsatz' && geometry.pressed === 'true', short(geometry.tag));
    check(`${label}: on one line of its own, above the fields, at 11px or more`,
      geometry.tag !== null && geometry.tag.lines === 1 && geometry.tag.bottom <= geometry.tag.rowTop + 0.5 && geometry.tag.fontSize >= 11, short(geometry.tag));
  } else {
    check(`${label}: an unmarked set carries no word and is not pressed`, geometry.tag === null && geometry.pressed === 'false', short(geometry.tag));
  }
}

for (const [width, height] of SIZES) {
  const W = `${width}`;

  /* ── A: the mark, in kg ───────────────────────────────────────────── */
  {
    const { ctx, page, errors } = await newPage(width, height);
    await onboard(page, { gym: 3, running: 0 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(900);

    await openWorkout(page);
    await pick(page, 'Bankdrücken');
    check(`${W}: A a row that is not a set yet has no mark`, (await exerciseCard(page, 'Bankdrücken').locator('.gym-set--pending button').count()) === 0);
    await logPending(page, 'Bankdrücken', 10, 40);
    await addSet(page, 'Bankdrücken');
    await editSet(page, 'Bankdrücken', 1, 8, '82.5');
    await addSet(page, 'Bankdrücken');
    check(`${W}: A three sets are stored, none marked`, (await benchSets(page)).length === 3 && (await benchSets(page)).every((set) => !('warmUp' in set)), short(await benchSets(page)));
    for (const number of [1, 2, 3]) {
      check(`${W}: A set ${number} has a named toggle, off`, (await mark(page, 'Bankdrücken', number).getAttribute('aria-pressed')) === 'false');
    }
    checkRow(`${W}: A an unmarked row`, await rowGeometry(page, 'Bankdrücken', 0), { marked: false });
    check(`${W}: A the line names the best working set`, /^Bester Arbeitssatz · 8 × 82[.,]5 kg$/.test((await bestLine(page, 'Bankdrücken')) ?? ''), String(await bestLine(page, 'Bankdrücken')));

    // Mark the first set.
    await mark(page, 'Bankdrücken', 1).click();
    await until(() => mark(page, 'Bankdrücken', 1).getAttribute('aria-pressed'), (value) => value === 'true');
    await page.waitForTimeout(500);
    const marked = await benchSets(page);
    check(`${W}: A the mark is stored on that set, and on no other`, marked[0]?.warmUp === true && !('warmUp' in marked[1]) && !('warmUp' in marked[2]), short(marked.map((set) => set.warmUp)));
    checkRow(`${W}: A the marked row`, await rowGeometry(page, 'Bankdrücken', 0), { marked: true });
    checkRow(`${W}: A the row beneath it`, await rowGeometry(page, 'Bankdrücken', 1), { marked: false });
    await layoutChecks(page, `${W}: A the workout with a marked set`);
    const contrast = (await textContrast(page)).filter((run) => run.text === 'Aufwärmsatz');
    check(`${W}: A the word reads at 4.5:1 on its pixels`, contrast.length === 1 && contrast[0].ratio >= 4.5, short(contrast.map((run) => run.ratio)));
    await exerciseCard(page, 'Bankdrücken').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/stage5b-${width}-kg-aufwaermsatz.png` });

    // The warm-up, however heavy, is never the best working set.
    await editSet(page, 'Bankdrücken', 0, 5, 100);
    check(`${W}: A a warm-up set heavier than the work is still not the best working set`,
      /^Bester Arbeitssatz · 8 × 82[.,]5 kg$/.test((await bestLine(page, 'Bankdrücken')) ?? '') && (await benchSets(page))[0]?.warmUp === true,
      String(await bestLine(page, 'Bankdrücken')));
    await editSet(page, 'Bankdrücken', 0, 10, 40);

    // Leaving and coming back: the mark is there.
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await page.locator('.running-workout').click();
    await page.locator('.gym-session__bar').waitFor({ timeout: 5000 });
    await page.waitForTimeout(600);
    check(`${W}: A after a reload the set is still marked, and says so`,
      (await mark(page, 'Bankdrücken', 1).getAttribute('aria-pressed')) === 'true' && (await textOf(rows(page, 'Bankdrücken').nth(0).locator('.gym-set__tag'))) === 'Aufwärmsatz');

    // Remove the marked set, and undo.
    await page.getByRole('button', { name: 'Satz 1 von Bankdrücken entfernen', exact: true }).click();
    await page.waitForTimeout(700);
    check(`${W}: A the marked set is removed`, (await benchSets(page)).length === 2);
    await page.locator('.toast').getByRole('button', { name: 'Rückgängig' }).click();
    await until(() => benchSets(page), (sets) => sets.length === 3);
    await page.waitForTimeout(500);
    const back = await benchSets(page);
    check(`${W}: A "Rückgängig" brings it back with its mark, in its place`,
      back.length === 3 && back[0]?.warmUp === true && back[0]?.reps === 10 && (await mark(page, 'Bankdrücken', 1).getAttribute('aria-pressed')) === 'true',
      short(back.map((set) => [set.reps, set.warmUp])));

    // "Satz hinzufügen" copies reps and weight, not the mark.
    await mark(page, 'Bankdrücken', 3).click();
    await until(() => mark(page, 'Bankdrücken', 3).getAttribute('aria-pressed'), (value) => value === 'true');
    await addSet(page, 'Bankdrücken');
    const added = await benchSets(page);
    check(`${W}: A "Satz hinzufügen" after a warm-up set adds a working set with its reps and weight`,
      added.length === 4 && added[3].reps === added[2].reps && added[3].weightGrams === added[2].weightGrams && !('warmUp' in added[3]) && added[2].warmUp === true,
      short(added.map((set) => [set.reps, set.weightGrams, set.warmUp])));
    await mark(page, 'Bankdrücken', 3).click();
    await until(() => mark(page, 'Bankdrücken', 3).getAttribute('aria-pressed'), (value) => value === 'false');
    await page.waitForTimeout(400);
    check(`${W}: A taking the mark off leaves the set without the field`, !('warmUp' in (await benchSets(page))[2]));

    await finish(page);
    const week = await textOf(page.locator('section[aria-label="Gym"] .week__value'));
    check(`${W}: A the workout counts for the week`, /^1 \/ 3/.test(week ?? ''), String(week));

    /* ── B: the same row in lb ─────────────────────────────────────── */
    await tab(page, 'Bereiche').click();
    await page.waitForTimeout(700);
    await page.locator('.areas__scroll').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(400);
    await page.getByRole('group', { name: 'Gewichtseinheit' }).getByRole('button', { name: 'lb', exact: true }).click();
    await page.waitForTimeout(600);
    await tab(page, 'Heute').click();
    await page.waitForTimeout(800);
    await openWorkout(page);
    await page.waitForTimeout(600);
    const pounds = await rowGeometry(page, 'Bankdrücken', 1);
    check(`${W}: B the row reads in lb`, pounds.units.join(' ') === 'Wdh. lb' && pounds.values[1] === '181.9', short([pounds.units, pounds.values]));
    checkRow(`${W}: B the marked row in lb`, await rowGeometry(page, 'Bankdrücken', 0), { marked: true });
    checkRow(`${W}: B a working row in lb`, pounds, { marked: false });
    // The widest weight of five characters, and two-digit reps.
    await editSet(page, 'Bankdrücken', 1, 12, '999.5');
    checkRow(`${W}: B a row holding 12 × 999.5 lb`, await rowGeometry(page, 'Bankdrücken', 1), { marked: false });
    await layoutChecks(page, `${W}: B the workout in lb`);
    await exerciseCard(page, 'Bankdrücken').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/stage5b-${width}-lb-aufwaermsatz.png` });
    check(`${W}: A, B no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* ── C: a workout of warm-up sets only ────────────────────────────── */
  {
    const { ctx, page, errors } = await newPage(width, height);
    await onboard(page, { gym: 3, running: 0 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await openWorkout(page);
    await pick(page, 'Kniebeuge');
    await logPending(page, 'Kniebeuge', 5, 60);
    await mark(page, 'Kniebeuge', 1).click();
    await until(() => bestLine(page, 'Kniebeuge'), (value) => value === 'Noch kein Arbeitssatz.');
    check(`${W}: C with only a warm-up set the exercise says there is no working set yet`, (await bestLine(page, 'Kniebeuge')) === 'Noch kein Arbeitssatz.', String(await bestLine(page, 'Kniebeuge')));
    await page.screenshot({ path: `${OUT}/stage5b-${width}-nur-aufwaermsatz.png` });
    await finish(page);
    const sessions = await idb(page, 'gymSessions');
    const week = await textOf(page.locator('section[aria-label="Gym"] .week__value'));
    check(`${W}: C the workout is stored and counts for the week`, sessions.length === 1 && /^1 \/ 3/.test(week ?? ''), `${sessions.length} session, ${week}`);

    await tab(page, 'Bereiche').click();
    await page.waitForTimeout(600);
    const gym = page.locator('.domain-switch button', { hasText: 'Gym' });
    if ((await gym.count()) > 0) await gym.click();
    await page.waitForTimeout(900);
    const card = await textOf(page.locator('.gym-hub__muscles'));
    check(`${W}: C the hub's card has nothing to evaluate, and no zero`, /Noch nichts auszuwerten/.test(card ?? '') && !/0\s?%/.test(card ?? ''), String(card));
    await openMuscles(page, { wait: 2500 });
    const said = await textOf(page.locator('.gym-progress__noData'));
    check(`${W}: C Muskelgruppen says that only warm-up sets were logged`,
      said === 'Noch nichts auszuwerten In den letzten 30 Tagen sind nur Aufwärmsätze eingetragen. Gewertet wird der beste Arbeitssatz.', String(said));
    const quads = await textOf(page.locator('.muscle-row').filter({ hasText: 'Quadrizeps' }));
    check(`${W}: C the group reads as not trained yet — no figure, no zero`, /Noch nicht trainiert/.test(quads ?? '') && !/%/.test(quads ?? ''), String(quads));
    await layoutChecks(page, `${W}: C Muskelgruppen with warm-up sets only`);
    check(`${W}: C no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}

/* ── D: yesterday can be marked, the day before is not offered ─────────── */
{
  const [width, height] = SIZES[SIZES.length > 2 ? 2 : 0];
  const monday = dayOffset(-2);
  const { ctx, page, errors } = await newPage(width, height, monday);
  await onboard(page, { gym: 3, running: 0 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await openWorkout(page);
  await pick(page, 'Bankdrücken');
  await logPending(page, 'Bankdrücken', 10, 40);
  await addSet(page, 'Bankdrücken');
  await finish(page);

  // The next day: yesterday's workout opens from the Gestern side.
  await ctx.clock.setSystemTime(berlinNoon(dayOffset(-1)));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.locator('.today__switch button', { hasText: 'Gestern' }).click();
  await page.waitForTimeout(700);
  await openWorkout(page);
  await page.waitForTimeout(600);
  check('D: yesterday\'s workout opens with its sets', (await rows(page, 'Bankdrücken').count()) === 2, String(await rows(page, 'Bankdrücken').count()));
  await mark(page, 'Bankdrücken', 1).click();
  await until(() => mark(page, 'Bankdrücken', 1).getAttribute('aria-pressed'), (value) => value === 'true');
  await page.waitForTimeout(400);
  const stored = await benchSets(page);
  check('D: a set of yesterday can be marked', stored[0]?.warmUp === true && stored[0]?.date === monday, short(stored.map((set) => [set.date, set.warmUp])));
  await page.locator('.gym-session .gym-session__back').first().click();
  await page.waitForTimeout(700);

  // Two days on: Monday is no longer offered, on either side.
  await ctx.clock.setSystemTime(berlinNoon(CLOCK_DAY));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.locator('.today__switch button', { hasText: 'Gestern' }).click();
  await page.waitForTimeout(700);
  await openWorkout(page);
  await page.waitForTimeout(600);
  const dated = await textOf(page.locator('.gym-session__date'));
  check('D: two days on, "Gestern" is the day after — the older workout is not reached', (await rows(page, 'Bankdrücken').count()) === 0 && !/16\. November/.test(dated ?? '') , String(dated));
  check('D: and its mark stands as it was set', (await benchSets(page))[0]?.warmUp === true);
  check('D: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ── E: the update, on a device as the live build left it ─────────────── */
{
  const [width, height] = SIZES[SIZES.length > 2 ? 2 : 0];
  const { ctx, page, errors } = await newPage(width, height);
  await onboard(page, { gym: 3, running: 2 });
  await seedMuscles(page);
  await seedLegacyFood(page, { days: 14, from: 2 });
  // As the live build wrote its snapshot: forty days ago, the three-day
  // window, no P8 marker, no exercise-day metric.
  const since = dayOffset(-40);
  const legacy = (await idb(page, 'configSnapshots')).map((snapshot) => {
    const { sessionWindowDays: _p8, gymMetric: _metric, ...scoring } = snapshot.config.scoring;
    return { ...snapshot, effectiveFrom: since, createdAt: `${since}T06:00:00.000Z`, config: { ...snapshot.config, scoring: { ...scoring, editWindowDays: 3 } } };
  });
  await replaceAll(page, 'configSnapshots', legacy);
  const settings = (await idb(page, 'settings'))[0];
  await replaceAll(page, 'settings', [{ ...settings, firstUseDate: since }]);
  check('E: the device holds one snapshot, with Food on and neither era', legacy.length === 1 && legacy[0].config.scoring.gymMetric === undefined && legacy[0].config.scoring.sessionWindowDays === undefined
    && legacy[0].config.domains.some((domain) => domain.type === 'food' && domain.enabled));

  // The first load of the update.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const after = (await idb(page, 'configSnapshots')).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const update = after[after.length - 1];
  check('E: one load writes one snapshot, effective today', after.length === 2 && update.effectiveFrom === CLOCK_DAY, short(after.map((snapshot) => snapshot.effectiveFrom)));
  check('E: and leaves the earlier one as it was', JSON.stringify(after[0]) === JSON.stringify(legacy[0]));
  check('E: it carries the one-day window (D132)', update.config.scoring.editWindowDays === 1 && update.config.scoring.sessionWindowDays === 1, short(update.config.scoring));
  check('E: Food off, the Boss shared over what remains (D139)',
    update.config.domains.some((domain) => domain.type === 'food' && domain.enabled === false) && !('food' in update.config.boss.weights), short(update.config.boss));
  check('E: and the exercise-day metric (D150)',
    JSON.stringify(update.config.scoring.gymMetric) === JSON.stringify({ id: 'bestWorkingSet', repsDivisor: 30, comparison: 'median' }), short(update.config.scoring.gymMetric));

  // A second load, and one the next day, write nothing.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  check('E: a second load writes nothing', JSON.stringify((await idb(page, 'configSnapshots')).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))) === JSON.stringify(after));
  await ctx.clock.setSystemTime(berlinNoon(dayOffset(1)));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  check('E: nor does a load the day after', (await idb(page, 'configSnapshots')).length === 2);

  // The screens read the new metric over the whole range: every row with a
  // figure still has one, and Muskelgruppen opens without an error.
  await tab(page, 'Bereiche').click();
  await page.waitForTimeout(600);
  const gym = page.locator('.domain-switch button', { hasText: 'Gym' });
  if ((await gym.count()) > 0) await gym.click();
  await page.waitForTimeout(900);
  await openMuscles(page, { wait: 3500 });
  const figures = await page.locator('.muscle-row .muscle-row__delta').allTextContents();
  check('E: Muskelgruppen shows figures for the history logged before the update', figures.length >= 4, short(figures));
  check('E: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ── F: the build draws bars ───────────────────────────────────────────── */
{
  const assets = readdirSync('dist/assets').filter((file) => /\.(js|css)$/.test(file));
  const hits = assets.filter((file) => /exercise-line|ExerciseLineChart/.test(readFileSync(`dist/assets/${file}`, 'utf8')));
  check('F: the line proposed at STOP 5b is not in the production bundle', assets.length > 0 && hits.length === 0, hits.join(', '));
}

await browser.close();
process.exit(summary() ? 0 : 1);
