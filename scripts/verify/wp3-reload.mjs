import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { URL_APP, check, onboard, openMuscles, phone, seed, seedMuscles, seedTraining, summary } from './lib.mjs';

/**
 * WP3, B2 — screens reload when their inputs change, and the constant
 * loaders never go stale. On the real production build.
 *
 * The one generic assertion: after an input change or a write, what a
 * screen shows equals what a full page reload shows at that moment. Each
 * check captures the screen's text, reloads, re-navigates, captures again
 * and compares.
 *
 *   1  Muskelgruppen 7 / 30   the toggle shows the numbers the seeded
 *                              history implies, and 30 comes back exactly
 *   2  the hub after Fertig   the week line moves by one session and every
 *                              card equals a reload, without leaving the area
 *   3  the Boss card          after one answer on Heute
 *   4  the Laufen board       after a run logged on Heute, after its undo,
 *                              and after a target change made beside it
 *   5  a day change           Sunday 23:58 → Monday under a faked clock: the
 *                              hub's week is the new week with no input, and
 *                              Heute's date and Boss card equal a reload
 *
 * Plus, in place (the screen stays mounted while the write happens): the
 * hub's week line after the Gym target changes, the Laufen board after the
 * toast's undo, and Heute across a second midnight.
 *
 * Tests 1–4 run on a fixed day (`CLOCK=YYYY-MM-DD`, default 2026-10-14) in
 * Europe/Berlin, so no check depends on the weekday. Screenshots go to
 * docs/design/wp3/stage1/.
 */
const OUT = process.env.OUT ?? 'docs/design/wp3/stage1';
mkdirSync(OUT, { recursive: true });
const CLOCK = process.env.CLOCK ?? '2026-10-14';
const TZ = 'Europe/Berlin';
const SIZES = [
  [393, 852],
  [430, 932],
  [320, 693],
];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/* ── helpers ─────────────────────────────────────────────────────────── */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const short = (value, n = 260) => {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

/** Where two captures first part, quoted from both sides. */
function diff(now, reload, [left, right] = ['shown', 'reload']) {
  const a = JSON.stringify(now);
  const b = JSON.stringify(reload);
  if (a === b) return 'identical';
  let i = 0;
  while (i < a.length && a[i] === b[i]) i += 1;
  const from = Math.max(0, i - 60);
  return `differs at ${i}: ${left} «${a.slice(from, i + 100)}» | ${right} «${b.slice(from, i + 100)}»`;
}

/** The Berlin wall-clock noon of a day, as an instant with its own offset. */
function berlinNoon(day) {
  for (const offset of ['+02:00', '+01:00']) {
    const instant = new Date(`${day}T12:00:00${offset}`);
    const hour = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(instant);
    if (hour === '12') return instant;
  }
  throw new Error(`no Berlin noon for ${day}`);
}

/**
 * Reads until two consecutive reads agree and the read is `ready`. A loader
 * keeps its previous value while it reloads, so one read is not enough to
 * know a screen has finished moving.
 */
async function settle(read, { ready = () => true, gap = 450, tries = 24 } = {}) {
  let previous;
  let last;
  for (let i = 0; i < tries; i += 1) {
    last = await read();
    if (ready(last)) {
      if (previous !== undefined && same(previous, last)) return last;
      previous = last;
    } else {
      previous = undefined;
    }
    await sleep(gap);
  }
  return last;
}

/** A full reload, then the navigation that brings the same screen back, then the read. */
async function afterReload(page, read, opts = {}, navigate = null) {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  if (navigate) await navigate();
  return settle(read, opts);
}

const tab = async (page, name) => {
  await page.locator('.tab-bar button', { hasText: name }).click();
  await page.waitForTimeout(800);
};
const openGymArea = async (page) => {
  await tab(page, 'Bereiche');
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(1300);
};
const hash = (page) => page.evaluate(() => location.hash);
const pageNow = (page) =>
  page.evaluate(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  });

const idbAll = (page, store) =>
  page.evaluate(async (s) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  }, store);
const localToday = (page) =>
  page.evaluate(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

/** The muscle destination: the active range, the ten rows, the overall tile, the exercises. */
const readMuscles = (page) =>
  page.evaluate(() => {
    const n = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const rows = [...document.querySelectorAll('.muscle-row')].map((row) => {
      const right = row.querySelector('.muscle-row__right');
      const sub = row.querySelector('.muscle-row__sub');
      return {
        name: n(row.querySelector('.muscle-row__name')?.textContent),
        sub: sub ? n(sub.textContent) : null,
        right: n(right?.textContent),
        state: [...(right?.classList ?? [])].find((c) => c.startsWith('muscle-row__right--'))?.slice('muscle-row__right--'.length) ?? null,
        delta: row.querySelector('.muscle-row__delta') !== null,
      };
    });
    const overall = document.querySelector('[data-metric="gym-overall"]');
    return {
      range: [...document.querySelectorAll('.segmented__option[aria-pressed="true"]')].map((b) => n(b.textContent)),
      rows,
      overall: overall ? n(overall.textContent) : null,
      exercises: [...document.querySelectorAll('.gym-progress__row')].map((b) => ({
        name: n(b.querySelector('.gym-progress__rowName')?.textContent),
        change: n(b.querySelector('.gym-progress__change')?.textContent),
      })),
    };
  });
const musclesReady = (m) => m.rows.length === 10 && m.range.length === 1;

/** The hub: the Training card, the muscle entry card, the rating board. */
const readHub = (page) =>
  page.evaluate(() => {
    const n = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const q = (s) => document.querySelector(s);
    return {
      hash: location.hash,
      week: n(q('.gym-hub__week')?.textContent),
      last: q('.gym-hub__last') ? n(q('.gym-hub__last').textContent) : null,
      training: n(q('.gym-hub__training')?.textContent),
      muscles: n(q('.gym-hub__muscles')?.textContent),
      markers: [...document.querySelectorAll('.gym-hub__previewState')].map(
        (el) => [...el.classList].find((c) => c.startsWith('gym-hub__previewState--'))?.slice('gym-hub__previewState--'.length) ?? null,
      ),
      metrics: [...document.querySelectorAll('.areas__scroll [data-metric^="gym-"]')].map((el) => [el.getAttribute('data-metric'), n(el.textContent)]),
      overviewEmpty: q('.gym-overview__empty') ? n(q('.gym-overview__empty').textContent) : null,
    };
  });
const hubReady = (h) => h.week !== '' && h.muscles !== '' && (h.metrics.length > 0 || h.overviewEmpty !== null);

/** The Laufen block inside the Gym area: the board and the domain card under it. */
const readRunning = (page) =>
  page.evaluate(() => {
    const n = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const block = document.querySelector('.areas__running');
    return {
      metrics: [...document.querySelectorAll('.areas__running [data-metric^="running-"]')].map((el) => [el.getAttribute('data-metric'), n(el.textContent)]),
      empty: document.querySelector('.areas__running .running-overview__empty') ? n(document.querySelector('.areas__running .running-overview__empty').textContent) : null,
      text: n(block?.textContent),
    };
  });
const runningReady = (r) => r.text !== '' && (r.metrics.length > 0 || r.empty !== null);

/** Heute: the date, the Boss card, the training weeks. */
const readToday = (page) =>
  page.evaluate(() => {
    const n = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const boss = document.querySelector('.boss-summary');
    return {
      date: n(document.querySelector('.today__date')?.textContent),
      boss: boss ? n(boss.textContent) : null,
      bossFill: boss?.querySelector('.boss-summary__fill')?.style.width ?? null,
      weeks: [...document.querySelectorAll('.week__value')].map((el) => n(el.textContent)),
    };
  });
const todayReady = (t) => t.date !== '' && t.boss !== null;

/** "2 von 3 Sessions diese Woche", "3 Sessions diese Woche · Ziel erreicht", "Noch keine Session erfasst." → a count. */
const weekCount = (line) => {
  if (/^Noch keine Session erfasst\.$/.test(line)) return 0;
  const m = /^(\d+) (von \d+ )?Sessions? diese Woche/.exec(line);
  return m ? Number(m[1]) : Number.NaN;
};

const row = (m, name) => m.rows.find((r) => r.name === name) ?? null;

/** Scrolls the area's own scroller so `selector` sits at its top. */
const scrollTo = (page, selector) =>
  page.locator(selector).first().evaluate((el) => {
    const scroller = el.closest('.areas__scroll');
    if (!scroller) return;
    scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 8;
  });
const scrollTop = (page) => page.evaluate(() => { const s = document.querySelector('.areas__scroll'); if (s) s.scrollTop = 0; });

/** One free workout with one set of Bankdrücken, 8 × 60 kg, closed with Fertig. */
async function logBench(page, label) {
  const chooser = page.locator('[role="dialog"]').filter({ has: page.getByRole('button', { name: 'Freie Session' }) });
  if ((await chooser.count()) > 0) {
    await chooser.getByRole('button', { name: 'Freie Session' }).click();
    await page.waitForTimeout(900);
  }
  check(`${label}: the workout screen is open`, (await page.locator('.gym-session').count()) === 1);
  await page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('textbox', { name: 'Suchen' }).fill('Bankdrücken');
  await page.waitForTimeout(350);
  await page.locator('.gym-picker__row').filter({ has: page.locator('.gym-picker__name', { hasText: /^Bankdrücken$/ }) }).first().click();
  await page.waitForTimeout(900);
  const set = page.locator('.gym-session .gym-set').first();
  await set.locator('input').nth(0).fill('8');
  await set.locator('input').nth(0).blur();
  await page.waitForTimeout(400);
  await set.locator('input').nth(1).fill('60');
  await set.locator('input').nth(1).blur();
  await page.waitForTimeout(900);
  const day = await localToday(page);
  const sets = (await idbAll(page, 'gymSets')).filter((s) => s.date === day && s.exerciseId === 'ex_bench_press');
  check(`${label}: one set of 8 × 60 kg is stored for today`, sets.length === 1 && sets[0].reps === 8 && sets[0].weightGrams === 60000, short(sets.map((s) => [s.reps, s.weightGrams])));
  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.waitForTimeout(1300);
}

async function boot(width, height) {
  const ctx = await browser.newContext({ ...phone, viewport: { width, height }, timezoneId: TZ });
  await ctx.clock.setSystemTime(berlinNoon(CLOCK));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await onboard(page, { gym: 3, running: 2 });
  await seed(page, { days: 42 });
  await seedTraining(page, { days: 42 });
  await seedMuscles(page, { days: 42 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return { ctx, page, errors };
}

/* ── 1 + 2 at every width; 3 + 4 at 393 ──────────────────────────────── */

for (const [width, height] of SIZES) {
  const W = `${width}`;
  const { ctx, page, errors } = await boot(width, height);

  /* 1 — Muskelgruppen 7 / 30 ─────────────────────────────────────────── */
  await page.getByRole('button', { name: 'Gym öffnen' }).click();
  await page.waitForTimeout(1500);
  await openMuscles(page, { wait: 4500 });
  const m30 = await settle(() => readMuscles(page), { ready: musclesReady });
  check(`${W}: Muskelgruppen opens on 30 Tage with ten rows`, same(m30.range, ['30 Tage']) && m30.rows.length === 10, short(m30.range));
  await scrollTo(page, '.muscle-rows');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/wp3-reload-${W}-muscles-30.png` });
  await scrollTop(page);

  await page.getByRole('button', { name: '7 Tage' }).click();
  await page.waitForTimeout(900);
  const m7 = await settle(() => readMuscles(page), { ready: (m) => musclesReady(m) && same(m.range, ['7 Tage']) });
  check(`${W}: 7 Tage is the pressed range`, same(m7.range, ['7 Tage']), short(m7.range));
  check(`${W}: the 7-day rows are not the 30-day rows`, !same(m7.rows, m30.rows), diff(m7.rows, m30.rows, ['7 Tage', '30 Tage']));

  // seedMuscles: calves trained once, 8 days ago — inside 30 days, outside 7.
  const calves30 = row(m30, 'Waden');
  const calves7 = row(m7, 'Waden');
  check(`${W}: Waden at 30 days — trained 8 days ago, awaiting a baseline`, calves30?.state === 'awaitingBaseline' && calves30?.sub === 'Vor 8 Tagen' && calves30?.right === 'Noch kein Vergleich', short(calves30));
  check(`${W}: Waden at 7 days — not trained in the range (no data, no recency)`, calves7?.state === 'noData' && calves7?.sub === null && calves7?.right === 'Noch nicht trainiert' && calves7?.delta === false, short(calves7));
  // Biceps: curls 15 and 6 days ago — a comparison at 30, one day at 7.
  const biceps30 = row(m30, 'Bizeps');
  const biceps7 = row(m7, 'Bizeps');
  check(`${W}: Bizeps has a figure at 30 days and only one day at 7`, biceps30?.delta === true && biceps7?.state === 'awaitingBaseline' && biceps7?.sub === 'Vor 6 Tagen', `${short(biceps30)} | ${short(biceps7)}`);
  // Back: pulldowns 19, 12 and 5 days ago — measured at 30, one day at 7.
  const back30 = row(m30, 'Rücken');
  const back7 = row(m7, 'Rücken');
  check(`${W}: Rücken has a figure at 30 days and only one day at 7`, back30?.delta === true && back7?.state === 'awaitingBaseline' && back7?.sub === 'Vor 5 Tagen', `${short(back30)} | ${short(back7)}`);
  // Shoulders: nothing, in either range.
  check(`${W}: Schultern has no data in either range`, row(m30, 'Schultern')?.state === 'noData' && row(m7, 'Schultern')?.state === 'noData');

  const counted = (m) => Number(/(\d+) von 10 Gruppen gewertet/.exec(m.overall ?? '')?.[1] ?? Number.NaN);
  const withDelta = (m) => m.rows.filter((r) => r.delta).length;
  check(`${W}: the overall tile counts fewer groups at 7 days than at 30`, counted(m7) < counted(m30), `${m30.overall} → ${m7.overall}`);
  check(`${W}: in each range the tile counts exactly the rows that carry a figure`, counted(m30) === withDelta(m30) && counted(m7) === withDelta(m7), `30: ${counted(m30)}/${withDelta(m30)} · 7: ${counted(m7)}/${withDelta(m7)}`);
  const names30 = m30.exercises.map((e) => e.name);
  const names7 = m7.exercises.map((e) => e.name);
  check(`${W}: the 7-day exercise list is a strict subset of the 30-day one`, names7.length < names30.length && names7.every((name) => names30.includes(name)), `${names30.join('|')} → ${names7.join('|')}`);

  await scrollTo(page, '.muscle-rows');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/wp3-reload-${W}-muscles-7.png` });
  await scrollTop(page);

  await page.getByRole('button', { name: '30 Tage' }).click();
  await page.waitForTimeout(900);
  const m30again = await settle(() => readMuscles(page), { ready: (m) => musclesReady(m) && same(m.range, ['30 Tage']) });
  check(`${W}: back on 30 Tage the 30-day rows return exactly`, same(m30again.rows, m30.rows), diff(m30again.rows, m30.rows, ['30 again', '30 first']));
  check(`${W}: and the overall tile and the exercise list with them`, m30again.overall === m30.overall && same(m30again.exercises, m30.exercises), diff([m30again.overall, m30again.exercises], [m30.overall, m30.exercises], ['30 again', '30 first']));

  // A fresh load of each range shows the same thing the toggle did.
  const r30 = await afterReload(page, () => readMuscles(page), { ready: (m) => musclesReady(m) && same(m.range, ['30 Tage']) }, () => page.waitForTimeout(3500));
  check(`${W}: 30 Tage equals a full reload`, same(r30, m30), diff(m30, r30));
  await page.getByRole('button', { name: '7 Tage' }).click();
  await page.waitForTimeout(900);
  const r7 = await settle(() => readMuscles(page), { ready: (m) => musclesReady(m) && same(m.range, ['7 Tage']) });
  check(`${W}: 7 Tage equals a full reload, toggled to 7`, same(r7, m7), diff(m7, r7));

  /* 2 — the hub after Fertig ─────────────────────────────────────────── */
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.waitForTimeout(1300);
  const hubBefore = await settle(() => readHub(page), { ready: hubReady });
  check(`${W}: Zurück lands on the hub`, hubBefore.hash === '#/areas/gym', hubBefore.hash);
  const before = weekCount(hubBefore.week);
  check(`${W}: the week line reads as a count`, Number.isFinite(before), hubBefore.week);

  await page.getByRole('button', { name: 'Training erfassen' }).click();
  await page.waitForTimeout(1000);
  await logBench(page, W);
  const hubAfter = await settle(() => readHub(page), { ready: hubReady });
  check(`${W}: Fertig returns to the hub, not elsewhere`, hubAfter.hash === '#/areas/gym' && (await page.locator('.gym-session').count()) === 0, hubAfter.hash);
  check(`${W}: the week line moved by exactly one session`, weekCount(hubAfter.week) === before + 1, `${hubBefore.week} → ${hubAfter.week}`);
  check(`${W}: the Training card says a session is logged today`, hubAfter.last === 'Heute bereits eine Session erfasst.', String(hubAfter.last));
  const gymSessionsToday = (await idbAll(page, 'gymSessions')).filter((s) => s.date === CLOCK).length;
  check(`${W}: the stored week gained exactly that one session today`, gymSessionsToday === 1, String(gymSessionsToday));
  await scrollTop(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/wp3-reload-${W}-hub-after-fertig.png` });

  const hubReload = await afterReload(page, () => readHub(page), { ready: hubReady });
  check(`${W}: after Fertig the Training card equals a reload`, hubAfter.training === hubReload.training, diff(hubAfter.training, hubReload.training));
  check(`${W}: after Fertig the muscle entry card equals a reload`, hubAfter.muscles === hubReload.muscles && same(hubAfter.markers, hubReload.markers), diff([hubAfter.muscles, hubAfter.markers], [hubReload.muscles, hubReload.markers]));
  check(`${W}: after Fertig the Gym-Rating board equals a reload`, hubAfter.metrics.some(([id]) => id === 'gym-rating') && same(hubAfter.metrics, hubReload.metrics) && hubAfter.overviewEmpty === hubReload.overviewEmpty, diff(hubAfter.metrics, hubReload.metrics));

  if (width === 393) {
    /* in place — the Gym target changes under the mounted hub ───────── */
    const target = /von (\d+) Sessions/.exec(hubReload.week)?.[1] ?? '3';
    const next = target === '4' ? '5' : '4';
    const gymBubbles = page.locator('.bubble-row[aria-label="Gym-Sessions pro Woche"]');
    check(`${W}: the Gym target picker is on the Gym area`, (await gymBubbles.count()) === 1);
    await gymBubbles.getByRole('button', { name: `${next} pro Woche` }).click();
    await page.waitForTimeout(900);
    const hubTarget = await settle(() => readHub(page), { ready: hubReady });
    check(`${W}: a new Gym target reaches the mounted week line`, hubTarget.week.includes(`von ${next} Sessions`), `${hubReload.week} → ${hubTarget.week}`);
    const hubTargetReload = await afterReload(page, () => readHub(page), { ready: hubReady });
    check(`${W}: and the hub then equals a reload`, same(hubTarget, hubTargetReload), diff(hubTarget, hubTargetReload));
    console.log(`INFO  ${W}: the Gym target change ${same(hubTarget.metrics, hubReload.metrics) ? 'left the Gym-Rating board as it was' : 'moved the Gym-Rating board'} — ${short(hubReload.metrics.map(([id, t]) => `${id}: ${t}`), 400)} → ${short(hubTarget.metrics.map(([id, t]) => `${id}: ${t}`), 400)}`);

    /* 3 — the Boss card after one answer ───────────────────────────── */
    await tab(page, 'Heute');
    const todayBefore = await settle(() => readToday(page), { ready: todayReady });
    const answersBefore = (await idbAll(page, 'answers')).filter((a) => a.date === CLOCK).length;
    await page.locator('.answer-scale__row').first().locator('[role="radio"]').nth(9).click();
    await page.waitForTimeout(600);
    const answersAfter = (await idbAll(page, 'answers')).filter((a) => a.date === CLOCK).length;
    check(`${W}: one answer is stored for today`, answersAfter === answersBefore + 1, `${answersBefore} → ${answersAfter}`);
    const todayAnswered = await settle(() => readToday(page), { ready: todayReady });
    const bossReload = await afterReload(page, () => readToday(page), { ready: todayReady });
    check(`${W}: after an answer the Boss card equals a reload`, todayAnswered.boss === bossReload.boss && todayAnswered.bossFill === bossReload.bossFill, diff([todayAnswered.boss, todayAnswered.bossFill], [bossReload.boss, bossReload.bossFill]));
    const bossMoved = todayBefore.boss !== todayAnswered.boss || todayBefore.bossFill !== todayAnswered.bossFill;
    console.log(`INFO  ${W}: the answer ${bossMoved ? 'moved' : 'did not visibly move'} the Boss card — «${todayBefore.boss} / ${todayBefore.bossFill}» → «${todayAnswered.boss} / ${todayAnswered.bossFill}»`);

    /* 4 — the Laufen board after a run ─────────────────────────────── */
    const runsToday = async () => (await idbAll(page, 'runs')).filter((r) => r.date === CLOCK).length;
    const runs0 = await runsToday();
    const todayBeforeRun = await settle(() => readToday(page), { ready: todayReady });
    await page.getByRole('button', { name: 'Lauf eintragen' }).click();
    await page.waitForTimeout(800);
    check(`${W}: Lauf eintragen stores one run`, (await runsToday()) === runs0 + 1, `${runs0} → ${await runsToday()}`);
    // In place: Heute stays mounted while the run is written.
    const todayRun = await settle(() => readToday(page), { ready: todayReady });
    const todayRunReload = await afterReload(page, () => readToday(page), { ready: todayReady });
    check(`${W}: after a run the mounted Boss card equals a reload`, todayRun.boss === todayRunReload.boss && todayRun.bossFill === todayRunReload.bossFill, diff([todayRun.boss, todayRun.bossFill], [todayRunReload.boss, todayRunReload.bossFill]));
    check(`${W}: and so do Heute's training weeks`, same(todayRun.weeks, todayRunReload.weeks), diff(todayRun.weeks, todayRunReload.weeks));
    console.log(`INFO  ${W}: the run ${todayBeforeRun.boss !== todayRun.boss || todayBeforeRun.bossFill !== todayRun.bossFill ? 'moved' : 'did not visibly move'} the Boss card — «${todayBeforeRun.boss} / ${todayBeforeRun.bossFill}» → «${todayRun.boss} / ${todayRun.bossFill}»`);
    await openGymArea(page);
    const run1 = await settle(() => readRunning(page), { ready: runningReady });
    check(`${W}: the Laufen board is on the Gym area with its tiles`, run1.metrics.length > 0, short(run1.metrics));
    const run1Reload = await afterReload(page, () => readRunning(page), { ready: runningReady });
    check(`${W}: after a run the Laufen board equals a reload`, same(run1, run1Reload), diff(run1, run1Reload));

    /* in place — the run's undo, pressed while the board is mounted ─── */
    await tab(page, 'Heute');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Lauf eintragen' }).click();
    await page.waitForTimeout(600);
    check(`${W}: a second run is stored`, (await runsToday()) === runs0 + 2, String(await runsToday()));
    await tab(page, 'Bereiche');
    await page.getByRole('radio', { name: 'Gym' }).click();
    const toastShown = (await page.locator('.toast__action', { hasText: 'Rückgängig' }).count()) === 1;
    if (toastShown) await page.locator('.toast').hover();
    await page.waitForTimeout(1300);
    const run2 = await settle(() => readRunning(page), { ready: runningReady });
    check(`${W}: the undo is still offered on the Gym area`, toastShown && (await page.locator('.toast__action', { hasText: 'Rückgängig' }).count()) === 1);
    check(`${W}: the mounted board shows the second run`, !same(run2, run1Reload), diff(run2, run1Reload, ['two runs', 'one run']));
    if (toastShown) {
      await page.locator('.toast__action', { hasText: 'Rückgängig' }).click();
      await page.waitForTimeout(900);
      check(`${W}: Rückgängig removes the second run`, (await runsToday()) === runs0 + 1, String(await runsToday()));
      const run3 = await settle(() => readRunning(page), { ready: runningReady });
      check(`${W}: after the undo the mounted board is the one-run board again`, same(run3, run1Reload), diff(run3, run1Reload, ['after undo', 'one run']));
      const run3Reload = await afterReload(page, () => readRunning(page), { ready: runningReady });
      check(`${W}: and it equals a reload`, same(run3, run3Reload), diff(run3, run3Reload));
    }

    /* in place — the Laufen target, changed beside the board ───────── */
    const runBubbles = page.locator('.areas__running .bubble-row[aria-label="Läufe pro Woche"]');
    check(`${W}: the Laufen target picker sits in the Laufen block`, (await runBubbles.count()) === 1);
    const runBefore = await settle(() => readRunning(page), { ready: runningReady });
    await runBubbles.getByRole('button', { name: '3 pro Woche' }).click();
    await page.waitForTimeout(900);
    const run4 = await settle(() => readRunning(page), { ready: runningReady });
    check(`${W}: the new Laufen target is shown`, run4.text !== runBefore.text, diff(runBefore.text, run4.text, ['before', 'after']));
    const run4Reload = await afterReload(page, () => readRunning(page), { ready: runningReady });
    check(`${W}: after a target change the Laufen board equals a reload`, same(run4, run4Reload), diff(run4, run4Reload));
    console.log(`INFO  ${W}: the target change ${same(run4.metrics, runBefore.metrics) ? 'left the board tiles as they were' : 'moved the board tiles'} — ${short(runBefore.metrics.map(([id, t]) => `${id}: ${t}`), 400)} → ${short(run4.metrics.map(([id, t]) => `${id}: ${t}`), 400)}`);
  }

  check(`${W}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ── 5 — a day change under a faked clock ────────────────────────────── */
{
  const W = '393 Berlin';
  const ctx = await browser.newContext({ ...phone, timezoneId: TZ });
  // Sunday 18.10.2026, two minutes before midnight, summer time.
  await ctx.clock.install({ time: '2026-10-18T23:58:00+02:00' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await onboard(page, { gym: 3, running: 2 });
  check(`${W}: the page starts on Sunday 18.10`, (await pageNow(page)).startsWith('2026-10-18 23:5'), await pageNow(page));

  await page.getByRole('button', { name: 'Session eintragen' }).click();
  await page.waitForTimeout(1000);
  await logBench(page, W);
  await page.getByRole('button', { name: 'Gym öffnen' }).click();
  await page.waitForTimeout(1500);
  const sunday = await settle(() => readHub(page), { ready: hubReady });
  const sundayRunning = await settle(() => readRunning(page), { ready: (r) => r.text !== '' });
  const beforeMidnight = await pageNow(page);
  check(`${W}: the setup finished before midnight`, beforeMidnight.startsWith('2026-10-18 23:'), beforeMidnight);
  check(`${W}: on Sunday the week line says one session`, sunday.week === '1 von 3 Sessions diese Woche' && sunday.last === 'Heute bereits eine Session erfasst.', `${sunday.week} | ${sunday.last}`);

  // Past midnight into Monday 19.10 — with no input of any kind.
  await ctx.clock.runFor('05:00');
  await page.waitForTimeout(1500);
  const afterMidnight = await pageNow(page);
  check(`${W}: the clock is now on Monday 19.10`, afterMidnight.startsWith('2026-10-19 00:0'), afterMidnight);
  const monday = await settle(() => readHub(page), { ready: hubReady });
  check(`${W}: with no input the week line describes the new week`, monday.week === '0 von 3 Sessions diese Woche', `${sunday.week} → ${monday.week}`);
  check(`${W}: and the last session is yesterday's, by date`, monday.last !== null && monday.last.startsWith('Letzte Session:') && /18\. Oktober/.test(monday.last), String(monday.last));
  const mondayRunning = await settle(() => readRunning(page), { ready: (r) => r.text !== '' });
  await page.screenshot({ path: `${OUT}/wp3-reload-393-hub-after-midnight.png` });
  const mondayReload = await afterReload(page, () => readHub(page), { ready: hubReady });
  check(`${W}: after midnight the hub equals a reload`, same(monday, mondayReload), diff(monday, mondayReload));
  const mondayRunningReload = await settle(() => readRunning(page), { ready: (r) => r.text !== '' });
  check(`${W}: after midnight the Laufen block equals a reload`, same(mondayRunning, mondayRunningReload), diff(mondayRunning, mondayRunningReload));
  console.log(`INFO  ${W}: across midnight the Gym board went «${short(sunday.metrics.length ? sunday.metrics : sunday.overviewEmpty, 200)}» → «${short(monday.metrics.length ? monday.metrics : monday.overviewEmpty, 200)}»; Laufen «${short(sundayRunning.metrics.length ? sundayRunning.metrics : sundayRunning.empty, 120)}» → «${short(mondayRunning.metrics.length ? mondayRunning.metrics : mondayRunning.empty, 120)}»`);

  await tab(page, 'Heute');
  const heute = await settle(() => readToday(page), { ready: todayReady });
  check(`${W}: Heute shows Monday, 19 October`, heute.date === 'Montag, 19. Oktober', heute.date);
  check(`${W}: Heute's Gym week is the new week`, heute.weeks[0] === '0 / 3 Trainings', short(heute.weeks));
  const heuteReload = await afterReload(page, () => readToday(page), { ready: todayReady });
  check(`${W}: Heute's date label equals a reload`, heute.date === heuteReload.date, diff(heute.date, heuteReload.date));
  check(`${W}: Heute's Boss card equals a reload`, heute.boss === heuteReload.boss && heute.bossFill === heuteReload.bossFill, diff([heute.boss, heute.bossFill], [heuteReload.boss, heuteReload.bossFill]));
  check(`${W}: Heute's training weeks equal a reload`, same(heute.weeks, heuteReload.weeks), diff(heute.weeks, heuteReload.weeks));

  // In place: Heute stays on screen across the next midnight, again with no input.
  const msToTuesday = await page.evaluate(() => {
    const next = new Date();
    next.setHours(24, 0, 30, 0);
    return next.getTime() - Date.now();
  });
  await ctx.clock.fastForward(msToTuesday);
  await page.waitForTimeout(1500);
  check(`${W}: the clock is now on Tuesday 20.10`, (await pageNow(page)).startsWith('2026-10-20 00:00'), await pageNow(page));
  const tuesday = await settle(() => readToday(page), { ready: (t) => todayReady(t) && t.date !== heuteReload.date });
  check(`${W}: a mounted Heute moves to Tuesday by itself`, tuesday.date === 'Dienstag, 20. Oktober', `${heuteReload.date} → ${tuesday.date}`);
  const tuesdayReload = await afterReload(page, () => readToday(page), { ready: todayReady });
  check(`${W}: and equals a reload — date, Boss card, weeks`, same(tuesday, tuesdayReload), diff(tuesday, tuesdayReload));
  await page.screenshot({ path: `${OUT}/wp3-reload-393-today-after-midnight.png` });

  check(`${W}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
