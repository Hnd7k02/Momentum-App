import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { URL_APP, check, clipped, onboard, openMuscles, phone, smallTargets, summary } from './lib.mjs';

/**
 * WP3, Stage 2 — the workout flow, on the real production build.
 *
 *   P6   a free workout is a draft: opening and leaving writes nothing, a
 *        picked exercise is a pending row (no 0×0 set), picked exercises
 *        stay until the workout is left, the first saved set creates one
 *        bare session (B7)
 *   P5   "Übung hinzufügen" in a bar at the foot of the workout, at the top
 *        and at the end of the scroll; removing an exercise is a worded
 *        control unlike a set's minus (B8); both removals undo exactly —
 *        same rows, same place — with the toast above the bar; an extra in
 *        a plan session stays an extra and the plan never changes
 *   race a weight typed right after the reps is stored too
 *   P7   going back leaves the workout running: Heute shows it at the top
 *        (plan as %, extras excluded; free as counts) under one accessible
 *        name, one tap continues it, the hub's Training card says the same;
 *        "Fertig" stores finishedAt and the widget goes
 *   P4   kg | lb in Einstellungen: 135 lb and 45 lb round-trip through
 *        grams, best set, last time, bodyweight and the exercise detail in
 *        lb, an untouched field keeps its grams, 62.5 kg unchanged
 *
 * Every context runs on a fixed clock (CLOCK=YYYY-MM-DD, default
 * 2026-10-14, a Wednesday) in Europe/Berlin. Screenshots of every touched
 * screen at 393, 430 and 320 go to docs/design/wp3/stage2/.
 */
const OUT = process.env.OUT ?? 'docs/design/wp3/stage2';
mkdirSync(OUT, { recursive: true });
const TZ = 'Europe/Berlin';
const SIZES = [
  [393, 852],
  [430, 932],
  [320, 693],
];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

function berlinNoon(day) {
  for (const offset of ['+02:00', '+01:00']) {
    const instant = new Date(`${day}T12:00:00${offset}`);
    const hour = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(instant);
    if (hour === '12') return instant;
  }
  throw new Error(`no Berlin noon for ${day}`);
}
const CLOCK_DAY = process.env.CLOCK ?? '2026-10-14';
const dayOffset = (days) => {
  const d = new Date(`${CLOCK_DAY}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const short = (value, n = 300) => {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s && s.length > n ? `${s.slice(0, n)}…` : s;
};
const shotPath = (width, slug) => `${OUT}/wp3-stage2-${width}-${slug}.png`;

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
    return new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  }, store);
async function put(page, store, record) {
  await page.evaluate(async ([s, r]) => {
    const db = await new Promise((res, rej) => { const q = indexedDB.open('momentum'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    await new Promise((res, rej) => { const tx = db.transaction([s], 'readwrite'); tx.objectStore(s).put(r); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  }, [store, record]);
}

async function layoutChecks(page, label) {
  const clip = await clipped(page);
  check(`${label}: nothing is clipped`, clip.length === 0, clip.slice(0, 3).join('; '));
  const small = await smallTargets(page);
  check(`${label}: every control is a real target`, small.length === 0, small.slice(0, 4).join('; '));
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
const gymSection = (page) => page.locator('section[aria-label="Gym"]');
const exerciseCard = (page, name) =>
  page.locator('.gym-session .card').filter({ has: page.locator('.gym-exercise__name', { hasText: new RegExp(`^${name}`) }) });
const cardNames = (page) =>
  page.locator('.gym-session .gym-exercise__name').evaluateAll((els) => els.map((el) => el.firstChild?.textContent?.trim() ?? ''));

async function pick(page, name) {
  await page.locator('.gym-session__bar').getByRole('button', { name: /Übung hinzufügen/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('textbox', { name: 'Suchen' }).fill(name);
  await page.waitForTimeout(350);
  await page.locator('.gym-picker__row').filter({ has: page.locator('.gym-picker__name', { hasText: new RegExp(`^${name}$`) }) }).first().click();
  await page.waitForTimeout(900);
}

/** Types into a pending row and leaves it, at a person's pace. */
async function logPending(page, name, reps, weight) {
  const row = exerciseCard(page, name).locator('.gym-set--pending');
  await row.locator('input').nth(0).fill(String(reps));
  await row.locator('input').nth(0).blur();
  await page.waitForTimeout(300);
  if (weight !== null) {
    await row.locator('input').nth(1).fill(String(weight));
    await row.locator('input').nth(1).blur();
  }
  await page.waitForTimeout(1200);
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

const back = (page) => page.locator('.gym-session .gym-session__back').first().click();
// The bar is drawn only once the workout has loaded: before it, an empty
// list of cards would read as "nothing kept" without having been checked.


for (const [width, height] of SIZES) {
  const W = `${width}`;

  /* ── A: a free workout — P6, P5, race, P7 (free) ───────────────────── */
  {
    const { ctx, page, errors } = await newPage(width, height);
    await onboard(page, { gym: 3, running: 0 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(900);

    /* P6 — open and leave. */
    await openWorkout(page);
    check(`${W}: P6 opening a free workout stores no session`, (await idb(page, 'gymSessions')).length === 0);
    const bar = await page.locator('.gym-session__bar').boundingBox();
    check(`${W}: P5 the bar sits at the foot of the screen`, bar !== null && Math.abs(bar.y + bar.height - height) <= 1, short(bar));
    await page.screenshot({ path: shotPath(width, 'workout-empty') });
    await layoutChecks(page, `${W} empty workout`);

    await pick(page, 'Bankdrücken');
    await pick(page, 'Kniebeuge');
    await pick(page, 'Bankdrücken');
    check(`${W}: P6 picking stores nothing`, (await idb(page, 'gymSessions')).length === 0 && (await idb(page, 'gymSets')).length === 0);
    check(`${W}: P6 picked exercises wait in pending rows, picked twice is once`,
      (await page.locator('.gym-set--pending').count()) === 2 && JSON.stringify(await cardNames(page)) === '["Bankdrücken","Kniebeuge"]',
      short(await cardNames(page)));
    check(`${W}: P6 no "Noch keine Sätze." under a pending row`, (await page.locator('.gym-session').getByText('Noch keine Sätze.').count()) === 0);
    await page.screenshot({ path: shotPath(width, 'workout-picked') });
    await layoutChecks(page, `${W} picked workout`);

    await back(page);
    await page.waitForTimeout(1200);
    const weekAfterLeave = await textOf(gymSection(page).locator('.week__value'));
    check(`${W}: P6 B7 leaving without a set counts nothing`, /^0 \/ 3/.test(weekAfterLeave ?? '') && (await idb(page, 'gymSessions')).length === 0, String(weekAfterLeave));
    check(`${W}: P7 no running workout on Heute`, (await page.locator('.running-workout').count()) === 0);

    /* P6 — the first saved set creates one bare session. */
    await openWorkout(page);
    check(`${W}: P6 a workout left is forgotten: the picked exercises are gone`, (await cardNames(page)).length === 0, short(await cardNames(page)));
    await pick(page, 'Bankdrücken');
    await pick(page, 'Kniebeuge');
    await logPending(page, 'Bankdrücken', 8, 60);
    const sessions = await idb(page, 'gymSessions');
    const sets = await idb(page, 'gymSets');
    check(`${W}: P6 the first saved set creates one bare session, running`,
      sessions.length === 1 && sessions[0].exercises === undefined && sessions[0].finishedAt === null, short(sessions));
    check(`${W}: P6 and stores that set only`, sets.length === 1 && sets[0].reps === 8 && sets[0].weightGrams === 60000, short(sets.map((s) => [s.reps, s.weightGrams])));
    check(`${W}: P6 the unlogged Kniebeuge stays on the page, in its place`,
      JSON.stringify(await cardNames(page)) === '["Bankdrücken","Kniebeuge"]' && (await exerciseCard(page, 'Kniebeuge').locator('.gym-set--pending').count()) === 1,
      short(await cardNames(page)));

    /* The race — reps then weight at once. */
    await exerciseCard(page, 'Bankdrücken').getByRole('button', { name: 'Satz zu Bankdrücken hinzufügen' }).click();
    await page.waitForTimeout(900);
    const second = exerciseCard(page, 'Bankdrücken').locator('.gym-set:not(.gym-set--pending)').nth(1);
    await second.locator('input').nth(0).fill('6');
    await second.locator('input').nth(1).fill('65');
    await second.locator('input').nth(1).blur();
    const raced = await until(
      async () => (await idb(page, 'gymSets')).map((s) => [s.reps, s.weightGrams]).sort((a, b) => a[0] - b[0]),
      (rows) => JSON.stringify(rows) === '[[6,65000],[8,60000]]',
      { timeout: 4000 },
    );
    check(`${W}: race a weight typed right after the reps is stored too`, JSON.stringify(raced) === '[[6,65000],[8,60000]]', short(raced));

    /* P5 — two different controls (B8). */
    const controls = await exerciseCard(page, 'Bankdrücken').evaluate((card) => ({
      exercise: { text: card.querySelector('.gym-exercise__remove')?.textContent?.trim(), svg: Boolean(card.querySelector('.gym-exercise__remove svg')) },
      set: { text: card.querySelector('.gym-set__remove')?.textContent?.trim(), svg: Boolean(card.querySelector('.gym-set__remove svg')) },
    }));
    check(`${W}: P5 B8 removing an exercise is a worded control, a set keeps its minus`,
      controls.exercise.text === 'Entfernen' && !controls.exercise.svg && controls.set.svg && !controls.set.text, short(controls));

    /* P5 — remove a set, undo. */
    const before = await idb(page, 'gymSets');
    await page.getByRole('button', { name: 'Satz 2 von Bankdrücken entfernen' }).click();
    await page.locator('.toast').waitFor({ timeout: 3000 }).catch(() => undefined);
    check(`${W}: P5 removing a set offers an undo`, (await textOf(page.locator('.toast__message'))) === 'Satz 2 von Bankdrücken entfernt.' && (await idb(page, 'gymSets')).length === 1,
      String(await textOf(page.locator('.toast__message'))));
    const toastBox = await page.locator('.toast').boundingBox();
    const barBox = await page.locator('.gym-session__bar').boundingBox();
    check(`${W}: P5 the toast sits above the bar and never covers it`, toastBox !== null && barBox !== null && toastBox.y + toastBox.height <= barBox.y, short({ toast: toastBox, bar: barBox }));
    await page.screenshot({ path: shotPath(width, 'workout-undo') });
    await layoutChecks(page, `${W} workout with the undo toast`);
    await page.locator('.toast').getByRole('button', { name: 'Rückgängig' }).click();
    const restored = await until(() => idb(page, 'gymSets'), (rows) => rows.length === 2);
    const same = (a, b) => JSON.stringify([...a].sort((x, y) => x.id.localeCompare(y.id))) === JSON.stringify([...b].sort((x, y) => x.id.localeCompare(y.id)));
    check(`${W}: P5 undo puts the set back exactly`, same(restored, before), short(restored.map((s) => [s.id, s.reps])));

    /* P5 — remove an exercise, undo. */
    await page.getByRole('button', { name: 'Bankdrücken aus der Session entfernen' }).click();
    await page.locator('.toast').waitFor({ timeout: 3000 }).catch(() => undefined);
    const gone = await idb(page, 'gymSets');
    check(`${W}: P5 removing an exercise removes its sets and its card, with an undo`,
      gone.length === 0 && JSON.stringify(await cardNames(page)) === '["Kniebeuge"]' && (await textOf(page.locator('.toast__message'))) === 'Bankdrücken entfernt.',
      short({ sets: gone.length, cards: await cardNames(page) }));
    await page.locator('.toast').getByRole('button', { name: 'Rückgängig' }).click();
    const back2 = await until(() => idb(page, 'gymSets'), (rows) => rows.length === 2);
    await page.waitForTimeout(600);
    check(`${W}: P5 undo puts the exercise back: its sets exactly, its card in its place`,
      same(back2, before) && JSON.stringify(await cardNames(page)) === '["Bankdrücken","Kniebeuge"]', short({ sets: back2.length, cards: await cardNames(page) }));

    /* P5 — the bar at the end of the scroll as well. */
    await page.locator('.gym-session__scroll').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(300);
    const barEnd = await page.locator('.gym-session__bar').boundingBox();
    check(`${W}: P5 the bar stays in reach at the end of the scroll`, barEnd !== null && Math.abs(barEnd.y + barEnd.height - height) <= 1, short(barEnd));

    /* P7 — leave running, continue from Heute and from the hub. */
    await back(page);
    await page.waitForTimeout(1200);
    await page.locator('.today__scroll').evaluate((el) => { el.scrollTop = 0; });
    await page.waitForTimeout(300);
    const widget = page.locator('.running-workout');
    check(`${W}: P7 going back leaves the workout running on Heute, under one name`,
      (await widget.count()) === 1 && (await widget.getAttribute('aria-label')) === 'Training läuft, 1 Übung · 2 Sätze – fortsetzen',
      String(await widget.getAttribute('aria-label').catch(() => null)));
    const order = await page.evaluate(() => {
      const w = document.querySelector('.running-workout')?.getBoundingClientRect();
      const b = document.querySelector('.boss-summary')?.getBoundingClientRect();
      return w && b ? { widgetBottom: w.bottom, bossTop: b.top } : null;
    });
    check(`${W}: P7 the widget comes first, 28px above the Boss card`, order !== null && Math.abs(order.bossTop - order.widgetBottom - 28) <= 1, short(order));
    await page.screenshot({ path: shotPath(width, 'heute-running-free') });
    await layoutChecks(page, `${W} Heute with a running workout`);
    await widget.click();
    await page.locator('.gym-session__bar').waitFor({ timeout: 5000 });
    check(`${W}: P7 one tap continues the same workout`, JSON.stringify(await cardNames(page)) === '["Bankdrücken"]', short(await cardNames(page)));
    await back(page);
    await page.waitForTimeout(900);

    await page.getByRole('button', { name: 'Gym öffnen' }).click();
    await page.waitForTimeout(1200);
    const hubLine = await textOf(page.locator('.gym-hub__last'));
    check(`${W}: P7 the hub's Training card says the same`, hubLine === 'Training läuft · 1 Übung · 2 Sätze', String(hubLine));
    check(`${W}: P7 and offers to continue`, (await page.getByRole('button', { name: 'Training fortsetzen' }).count()) === 1);
    await page.screenshot({ path: shotPath(width, 'hub-running') });
    await layoutChecks(page, `${W} hub with a running workout`);

    await page.getByRole('button', { name: 'Training fortsetzen' }).click();
    await page.locator('.gym-session__bar').waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: 'Fertig' }).click();
    await page.waitForTimeout(1500);
    const finished = (await idb(page, 'gymSessions'))[0];
    check(`${W}: P7 "Fertig" records when it finished`, typeof finished?.finishedAt === 'string', short(finished?.finishedAt));
    const hubAfter = await until(() => textOf(page.locator('.gym-hub__last')), (v) => v === 'Heute bereits eine Session erfasst.');
    check(`${W}: P7 the hub no longer says it is running`, hubAfter === 'Heute bereits eine Session erfasst.', String(hubAfter));
    await tab(page, 'Heute').click();
    await page.waitForTimeout(900);
    check(`${W}: P7 the widget is gone after "Fertig"`, (await page.locator('.running-workout').count()) === 0);

    check(`${W} A: no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* ── B: a plan workout — P7 %, P5 extras ───────────────────────────── */
  {
    const { ctx, page, errors } = await newPage(width, height);
    await onboard(page, { gym: 3, running: 0 });
    const plan = {
      id: 'wp3-stage2-plan', kind: 'userTrainingPlan', version: 1, name: 'Push',
      exercises: [
        { exerciseId: 'ex_bench_press', name: 'Bankdrücken', order: 0 },
        { exerciseId: 'ex_incline_press', name: 'Schrägbankdrücken', order: 1 },
        { exerciseId: 'ex_triceps_pushdown', name: 'Trizepsdrücken', order: 2 },
      ],
      createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z',
    };
    await put(page, 'gymPlans', plan);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await page.getByRole('button', { name: 'Session eintragen' }).click();
    await page.waitForTimeout(700);
    await page.locator('.plan-chooser .row').filter({ hasText: 'Push' }).first().click();
    await page.locator('.gym-session__bar').waitFor({ timeout: 5000 });
    const planned = await cardNames(page);
    await logPending(page, planned[0], 8, 60);
    await pick(page, 'Frontheben');
    await logPending(page, 'Frontheben', 10, 8);
    check(`${W}: P5 an exercise added to a plan session is an extra`, (await exerciseCard(page, 'Frontheben').locator('.gym-exercise__source').count()) === 1);
    const plans = await idb(page, 'gymPlans');
    check(`${W}: P5 the plan itself never changes`, JSON.stringify(plans.find((p) => p.id === plan.id)) === JSON.stringify(plan), short(plans));

    await back(page);
    await page.waitForTimeout(1200);
    await page.locator('.today__scroll').evaluate((el) => { el.scrollTop = 0; });
    await page.waitForTimeout(300);
    const label = await page.locator('.running-workout').getAttribute('aria-label').catch(() => null);
    check(`${W}: P7 a plan reads as the share of planned exercises done, extras excluded`, label === 'Training läuft, 33 % erledigt – fortsetzen', String(label));
    await page.screenshot({ path: shotPath(width, 'heute-running-plan') });
    await layoutChecks(page, `${W} Heute with a running plan`);
    await page.locator('.running-workout').click();
    await page.locator('.gym-session__bar').waitFor({ timeout: 5000 });
    await logPending(page, planned[1], 10, 40);
    await back(page);
    await page.waitForTimeout(1200);
    const label2 = await page.locator('.running-workout').getAttribute('aria-label').catch(() => null);
    check(`${W}: P7 it moves with the next planned exercise`, label2 === 'Training läuft, 67 % erledigt – fortsetzen', String(label2));
    check(`${W} B: no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* ── C: kg | lb — P4 ───────────────────────────────────────────────── */
  {
    const before = dayOffset(-2);
    const { ctx, page, errors } = await newPage(width, height, before);
    await onboard(page, { gym: 3, running: 0 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await tab(page, 'Bereiche').click();
    await page.waitForTimeout(700);
    await page.locator('.areas__scroll').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(400);
    const unit = page.getByRole('group', { name: 'Gewichtseinheit' });
    check(`${W}: P4 Einstellungen offers kg | lb, kg first`, (await unit.getByRole('button', { name: 'kg', exact: true }).getAttribute('aria-pressed')) === 'true');
    await unit.getByRole('button', { name: 'lb', exact: true }).click();
    await page.waitForTimeout(600);
    const settings = (await idb(page, 'settings'))[0];
    check(`${W}: P4 the choice is a setting, not a snapshot`, settings?.weightUnit === 'lb', short(settings?.weightUnit));
    await unit.scrollIntoViewIfNeeded();
    await page.screenshot({ path: shotPath(width, 'settings-unit') });
    await layoutChecks(page, `${W} Einstellungen`);

    // Two days ago: 5 × 45 lb.
    await tab(page, 'Heute').click();
    await page.waitForTimeout(800);
    await openWorkout(page);
    await pick(page, 'Bankdrücken');
    await logPending(page, 'Bankdrücken', 5, 45);
    check(`${W}: P4 45 lb is stored as 20 412 g`, (await idb(page, 'gymSets'))[0]?.weightGrams === 20412, short((await idb(page, 'gymSets'))[0]?.weightGrams));
    await page.getByRole('button', { name: 'Fertig' }).click();
    await page.waitForTimeout(1200);

    // Today: last time in lb, 135 lb, best set, bodyweight.
    await ctx.clock.setSystemTime(berlinNoon(CLOCK_DAY));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await openWorkout(page);
    await pick(page, 'Bankdrücken');
    const last = await textOf(exerciseCard(page, 'Bankdrücken').locator('.gym-exercise__last'));
    check(`${W}: P4 the last-time line reads in lb`, /· 5 × 45 lb$/.test(last ?? ''), String(last));
    await logPending(page, 'Bankdrücken', 5, 135);
    const today = (await idb(page, 'gymSets')).filter((s) => s.date === CLOCK_DAY);
    check(`${W}: P4 135 lb is stored as 61 235 g`, today[0]?.weightGrams === 61235, short(today.map((s) => s.weightGrams)));
    const shown = await exerciseCard(page, 'Bankdrücken').locator('.gym-set:not(.gym-set--pending) input').nth(1).inputValue();
    check(`${W}: P4 and reads back as 135`, shown === '135', shown);
    const best = await textOf(exerciseCard(page, 'Bankdrücken').locator('.gym-exercise__best'));
    check(`${W}: P4 the best set reads in lb`, best === 'Bester Satz · 5 × 135 lb', String(best));

    await pick(page, 'Klimmzüge');
    const bodyweight = page.getByLabel('Körpergewicht in Pfund');
    await bodyweight.fill('176.4');
    await page.getByRole('button', { name: 'Gewicht sichern' }).click();
    await page.waitForTimeout(900);
    const entries = await idb(page, 'weightEntries');
    check(`${W}: P4 a bodyweight typed in lb is stored in kg`, entries.length === 1 && entries[0].kg === 80.014, short(entries.map((e) => e.kg)));
    check(`${W}: P4 and reads back in lb`, (await bodyweight.inputValue()) === '176.4', await bodyweight.inputValue());
    await page.screenshot({ path: shotPath(width, 'workout-lb') });
    await layoutChecks(page, `${W} workout in lb`);
    await page.getByRole('button', { name: 'Fertig' }).click();
    await page.waitForTimeout(1200);

    // The exercise detail in lb.
    await tab(page, 'Bereiche').click();
    await page.waitForTimeout(600);
    await page.getByRole('radio', { name: 'Gym', exact: true }).click();
    await page.waitForTimeout(900);
    await openMuscles(page, { wait: 3500 });
    const row = page.locator('.gym-progress__row').filter({ has: page.locator('.gym-progress__rowName', { hasText: /^Bankdrücken$/ }) });
    await row.first().click();
    await page.waitForTimeout(900);
    const figures = await page.locator('.gym-detail__figure .gym-detail__value').allTextContents();
    check(`${W}: P4 the exercise detail reads in lb`, figures[0]?.trim() === '5 × 135 lb' && figures[1]?.trim() === '5 × 45 lb', short(figures));
    await page.screenshot({ path: shotPath(width, 'exercise-detail-lb') });
    await layoutChecks(page, `${W} exercise detail in lb`);
    await page.locator('.gym-detail .gym-session__back').click();
    await page.waitForTimeout(600);

    // Back to kg: 62.5 kg unchanged.
    await page.goto(`${URL_APP}#/areas/mental`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await page.locator('.areas__scroll').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(300);
    await page.getByRole('group', { name: 'Gewichtseinheit' }).getByRole('button', { name: 'kg', exact: true }).click();
    await page.waitForTimeout(500);
    await tab(page, 'Heute').click();
    await page.waitForTimeout(800);
    await openWorkout(page);
    await exerciseCard(page, 'Bankdrücken').getByRole('button', { name: 'Satz zu Bankdrücken hinzufügen' }).click();
    await page.waitForTimeout(900);
    const third = exerciseCard(page, 'Bankdrücken').locator('.gym-set:not(.gym-set--pending)').nth(1);
    await third.locator('input').nth(1).fill('62.5');
    await third.locator('input').nth(1).blur();
    await page.waitForTimeout(1000);
    const kgSets = (await idb(page, 'gymSets')).filter((s) => s.date === CLOCK_DAY && s.exerciseId === 'ex_bench_press').map((s) => s.weightGrams).sort((a, b) => a - b);
    check(`${W}: P4 62.5 kg is 62 500 g`, JSON.stringify(kgSets) === '[61235,62500]', short(kgSets));
    check(`${W}: P4 and reads 62.5`, (await third.locator('input').nth(1).inputValue()) === '62.5');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await page.waitForTimeout(1000);

    // In lb, 62.5 kg reads 137.8 — and 137.8 lb would be 62 505 g. A field
    // only visited, or the same value typed with a comma, is not an edit (D130).
    await page.goto(`${URL_APP}#/areas/mental`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await page.locator('.areas__scroll').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(300);
    await page.getByRole('group', { name: 'Gewichtseinheit' }).getByRole('button', { name: 'lb', exact: true }).click();
    await page.waitForTimeout(500);
    await tab(page, 'Heute').click();
    await page.waitForTimeout(800);
    await openWorkout(page);
    const offGrid = exerciseCard(page, 'Bankdrücken').locator('.gym-set:not(.gym-set--pending)').nth(1).locator('input').nth(1);
    check(`${W}: P4 62.5 kg reads 137.8 lb`, (await offGrid.inputValue()) === '137.8', await offGrid.inputValue());
    await offGrid.focus();
    await offGrid.blur();
    await offGrid.fill('137,8');
    await offGrid.blur();
    await page.waitForTimeout(1000);
    const kept = (await idb(page, 'gymSets')).filter((s) => s.date === CLOCK_DAY && s.exerciseId === 'ex_bench_press').map((s) => s.weightGrams).sort((a, b) => a - b);
    check(`${W}: P4 an untouched weight keeps its grams, typed again with a comma too`, JSON.stringify(kept) === '[61235,62500]', short(kept));
    check(`${W} C: no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}

await browser.close();
process.exit(summary() ? 0 : 1);
