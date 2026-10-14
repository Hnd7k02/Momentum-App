import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { URL_APP, check, clipped, onboard, phone, summary } from './lib.mjs';

/**
 * WP3, B3 — one "today" across local midnight and DST, on the real
 * production build, under a faked page clock.
 *
 * Heute used to read the day once while it rendered and keep it for as long
 * as it stayed mounted: an app left open over midnight went on showing
 * yesterday, and the first answer of the morning was written under it. Now
 * the day is held in one place (src/app/useToday.ts) and moved on by a timer
 * at the next local midnight, by the page coming back into view, and at the
 * start of any pointer or key input.
 *
 *   1  ordinary midnight     Berlin, 23:58 → 00:03 with no input: the label
 *                            moves, and the first answer is stored under the
 *                            new day with no jump of the label
 *   2  suspended timer       Date moves to the next morning but no timer
 *                            fires; a tap / a click / an arrow key on the
 *                            still-showing evening screen must not store
 *                            anything under the evening's day
 *   3  back in view          visibilitychange, focus and pageshow each move
 *                            the label with no tap; a write then lands on the
 *                            day shown
 *   4  DST end (Berlin)      the night into the 25-hour Sunday, the 25-hour
 *                            day itself in place, and the night after it in
 *                            a fresh context
 *   5  DST start (Berlin)    the night into the 23-hour Sunday, and the
 *                            23-hour day in place (a 24-hour timer would
 *                            leave Monday showing Sunday until 01:00)
 *   6  a missing midnight    São Paulo, 03.11.2018 → 04.11.2018, where clocks
 *                            jumped from 00:00 to 01:00
 *
 * Onboarding runs through lib.mjs `onboard()` unchanged: under
 * `clock.install` the page clock flows with real time, so its transitions
 * finish on their own and no local variant is needed. Every clock instant is
 * written with the offset of the context's zone.
 *
 * Screenshots go to docs/design/wp3/stage1/: Heute before and after
 * midnight at 393×852, and after midnight at 430×932 and 320×693.
 */
const OUT = process.env.OUT ?? 'docs/design/wp3/stage1';
mkdirSync(OUT, { recursive: true });
const BERLIN = 'Europe/Berlin';
const SAO_PAULO = 'America/Sao_Paulo';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/* ── helpers ─────────────────────────────────────────────────────────── */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const short = (value, n = 300) => {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

/** The page's own wall clock, with its UTC offset — the faked one. */
const pageNow = (page) =>
  page.evaluate(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? '+' : '-';
    const abs = Math.abs(off);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  });
const pageEpoch = (page) => page.evaluate(() => Date.now());

/** Heute's date label, or null while Heute is in its loading state. */
const label = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('.today__date');
    return el ? (el.textContent ?? '').replace(/\s+/g, ' ').trim() : null;
  });

/**
 * Polls the label — reading only, never an input event — until it equals
 * `expected`. Returns every distinct value seen on the way.
 */
async function waitForLabel(page, expected, { timeout = 9000, gap = 200 } = {}) {
  const seen = [];
  const end = Date.now() + timeout;
  let last;
  for (;;) {
    last = await label(page);
    if (seen[seen.length - 1] !== last) seen.push(last);
    if (last === expected) return { ok: true, last, seen };
    if (Date.now() > end) return { ok: false, last, seen };
    await sleep(gap);
  }
}

const idbAll = (page, store) =>
  page.evaluate(async (s) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  }, store);
const answers = async (page) =>
  (await idbAll(page, 'answers')).map((a) => ({ date: a.date, q: a.questionId, value: a.value }));
const answeredOnScreen = (page) => page.locator('.check-in--answered').count();
const scaleButton = (page, value) => page.getByRole('radio', { name: new RegExp(`^${value} von 10`) }).first();

/** Onboard (Wellbeing only, two scale questions), then a full reload onto Heute. */
async function setUp(page) {
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await onboard(page, { gym: 0, running: 0, food: false, wellbeing: true });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.locator('.today__date').waitFor({ timeout: 10000 });
  await scaleButton(page, 7).waitFor({ timeout: 10000 });
}

/**
 * One scenario in its own context. A thrown error is a FAIL with its
 * message, never a crash of the suite; page errors are a check of their own.
 */
async function scenario(name, { tz, time, viewport }, body) {
  const ctx = await browser.newContext({ ...phone, ...(viewport ? { viewport } : {}), timezoneId: tz });
  await ctx.clock.install({ time });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  try {
    await body({ ctx, page, W: name });
  } catch (error) {
    check(`${name}: the scenario ran to the end`, false, short(String(error?.stack ?? error), 600));
  }
  check(`${name}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/** Precondition: the setup finished before the boundary the scenario crosses. */
async function startsOn(page, W, prefix, expectedLabel) {
  const at = await pageNow(page);
  check(`${W}: the page clock is at ${prefix}… after setup`, at.startsWith(prefix), at);
  const shown = await waitForLabel(page, expectedLabel);
  check(`${W}: Heute shows ${expectedLabel}`, shown.ok, short(shown.seen));
}

/** Moves the faked clock to `target` (an instant with offset) by jumping. */
async function fastForwardTo(ctx, page, target) {
  const ms = Date.parse(target) - (await pageEpoch(page));
  if (ms <= 0) throw new Error(`fastForwardTo ${target}: already ${ms} ms past it`);
  await ctx.clock.fastForward(ms);
}

/* ── 1 — an ordinary midnight, Berlin ────────────────────────────────── */
await scenario('1 Berlin 14→15.10', { tz: BERLIN, time: '2026-10-14T23:58:00+02:00' }, async ({ ctx, page, W }) => {
  await setUp(page);
  await startsOn(page, W, '2026-10-14 23:5', 'Mittwoch, 14. Oktober');
  check(`${W}: nothing is stored before midnight`, (await answers(page)).length === 0, short(await answers(page)));
  await page.screenshot({ path: `${OUT}/wp3-midnight-393-before.png` });

  // Past midnight, with no input of any kind: only the timer may move it.
  await ctx.clock.runFor('05:00');
  const at = await pageNow(page);
  check(`${W}: the page clock is now just after midnight on 15.10`, at.startsWith('2026-10-15 00:0'), at);
  const moved = await waitForLabel(page, 'Donnerstag, 15. Oktober');
  check(`${W}: with no input the label reads Donnerstag, 15. Oktober`, moved.ok, short(moved.seen));
  const controls = await page.locator('.answer-scale__value').count();
  check(`${W}: the new day offers its questions (2 × 10 scale buttons)`, controls === 20, String(controls));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/wp3-midnight-393-after.png` });

  for (const [width, height] of [[430, 932], [320, 693]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(600);
    check(`${W} ${width}: the label still reads Donnerstag, 15. Oktober`, (await label(page)) === 'Donnerstag, 15. Oktober', String(await label(page)));
    const cut = await clipped(page);
    check(`${W} ${width}: nothing on Heute is clipped`, cut.length === 0, cut.slice(0, 3).join('; '));
    await page.screenshot({ path: `${OUT}/wp3-midnight-${width}-after.png` });
  }
  await page.setViewportSize(phone.viewport);
  await page.waitForTimeout(600);

  // The first answer of the morning.
  await scaleButton(page, 7).tap();
  const samples = [];
  for (let i = 0; i < 8; i += 1) {
    await sleep(200);
    samples.push(await label(page));
  }
  check(`${W}: after the answer the label stays on 15. Oktober (no jump)`, samples.every((s) => s === 'Donnerstag, 15. Oktober'), short(samples));
  const stored = await answers(page);
  check(`${W}: the answer is stored under 2026-10-15`, stored.length === 1 && stored[0].date === '2026-10-15' && stored[0].value === 7, short(stored));
  check(`${W}: nothing is stored under 2026-10-14`, stored.every((a) => a.date !== '2026-10-14'), short(stored));
  check(`${W}: the screen shows the one stored answer`, (await answeredOnScreen(page)) === 1, String(await answeredOnScreen(page)));
});

/* ── 2 — a suspended timer: Date moves, no timer fires ───────────────── */
/*
 * Each variant: [slug, wording, the input, an optional preparation made
 * before the clock moves, the value the same input stores on a current
 * screen]. The last is the control: repeated once the screen shows the new
 * day, the same input must store that value under 15.10 — otherwise "nothing
 * was stored" would only prove the input never landed.
 */
const SUSPENDED = [
  ['tap', 'a tap', async (page) => scaleButton(page, 7).tap({ timeout: 5000 }), null, 7],
  ['click', 'a mouse click', async (page) => scaleButton(page, 7).click({ timeout: 5000 }), null, 7],
  // A keyboard user whose focus was left on the first value overnight; the
  // arrow key selects the next one through the group's own key handler.
  ['key', 'an arrow key', async (page) => page.keyboard.press('ArrowRight'), async (page) => scaleButton(page, 1).focus(), 2],
];
for (const [slug, what, act, prepare, controlValue] of SUSPENDED) {
  await scenario(`2${slug} suspended timer`, { tz: BERLIN, time: '2026-10-14T22:00:00+02:00' }, async ({ ctx, page, W }) => {
    await setUp(page);
    await startsOn(page, W, '2026-10-14 22:', 'Mittwoch, 14. Oktober');
    if (prepare) await prepare(page);

    // The phone slept: the wall clock is on the next morning, the midnight
    // timer has not run.
    await ctx.clock.setSystemTime(new Date('2026-10-15T07:30:00+02:00'));
    const at = await pageNow(page);
    check(`${W}: Date now reads 15.10 07:30`, at.startsWith('2026-10-15 07:3'), at);
    const stale = await label(page);
    check(`${W}: (precondition) the screen still shows the evening's day`, stale === 'Mittwoch, 14. Oktober', String(stale));

    await act(page);
    await page.waitForTimeout(1500);
    const stored = await answers(page);
    check(`${W}: ${what} on the stale screen stores nothing under 2026-10-14`, stored.every((a) => a.date !== '2026-10-14'), short(stored));
    const after = await waitForLabel(page, 'Donnerstag, 15. Oktober');
    check(`${W}: afterwards the label shows Donnerstag, 15. Oktober`, after.ok, short(after.seen));
    await page.waitForTimeout(600);
    const on15 = stored.filter((a) => a.date === '2026-10-15');
    console.log(`INFO  ${W}: ${what} stored ${on15.length ? `an answer under 2026-10-15 (${short(on15)})` : 'nothing'}; all answers ${short(stored)}`);
    const shownAnswered = await answeredOnScreen(page);
    check(`${W}: the screen agrees with storage (${on15.length} answered)`, shownAnswered === on15.length, `screen ${shownAnswered}, stored ${on15.length}`);

    // Control: the same input on the screen that now shows 15.10 does write.
    if (prepare) await prepare(page);
    await act(page);
    await page.waitForTimeout(1500);
    const control = await answers(page);
    check(`${W}: (control) ${what} on the current screen stores ${controlValue} under 2026-10-15`, control.some((a) => a.date === '2026-10-15' && a.value === controlValue), short(control));
    check(`${W}: (control) still nothing under 2026-10-14`, control.every((a) => a.date !== '2026-10-14'), short(control));
  });
}

/* ── 3 — back in view: visibilitychange, focus, pageshow ─────────────── */
await scenario('3 back in view', { tz: BERLIN, time: '2026-10-14T22:00:00+02:00' }, async ({ ctx, page, W }) => {
  await setUp(page);
  await startsOn(page, W, '2026-10-14 22:', 'Mittwoch, 14. Oktober');
  const steps = [
    ['visibilitychange', '2026-10-16T08:00:00+02:00', 'Mittwoch, 14. Oktober', 'Freitag, 16. Oktober', () => document.dispatchEvent(new Event('visibilitychange'))],
    ['focus', '2026-10-17T08:00:00+02:00', 'Freitag, 16. Oktober', 'Samstag, 17. Oktober', () => window.dispatchEvent(new Event('focus'))],
    ['pageshow', '2026-10-18T08:00:00+02:00', 'Samstag, 17. Oktober', 'Sonntag, 18. Oktober', () => window.dispatchEvent(new Event('pageshow'))],
  ];
  for (const [event, time, from, to, fire] of steps) {
    await ctx.clock.setSystemTime(new Date(time));
    await page.waitForTimeout(400);
    const stale = await label(page);
    check(`${W}: (precondition) before ${event} the label still reads ${from}`, stale === from, String(stale));
    await page.evaluate(fire);
    const moved = await waitForLabel(page, to);
    check(`${W}: ${event} alone moves the label to ${to}`, moved.ok, short(moved.seen));
  }
  await page.waitForTimeout(500);
  await scaleButton(page, 6).tap();
  await page.waitForTimeout(1200);
  const stored = await answers(page);
  check(`${W}: an answer after the move is stored under 2026-10-18`, stored.length === 1 && stored[0].date === '2026-10-18', short(stored));
});

/* ── 4 — DST end, Berlin: the 25-hour Sunday ─────────────────────────── */
await scenario('4a DST end 24→25.10', { tz: BERLIN, time: '2026-10-24T23:58:00+02:00' }, async ({ ctx, page, W }) => {
  await setUp(page);
  await startsOn(page, W, '2026-10-24 23:5', 'Samstag, 24. Oktober');
  await ctx.clock.runFor('05:00');
  const at = await pageNow(page);
  check(`${W}: the page clock is on 25.10 summer time`, at.startsWith('2026-10-25 00:0') && at.endsWith('+02:00'), at);
  const moved = await waitForLabel(page, 'Sonntag, 25. Oktober');
  check(`${W}: with no input the label reads Sonntag, 25. Oktober`, moved.ok, short(moved.seen));

  // In place, through the 25-hour day: still Sunday a minute before its end,
  // Monday a minute after.
  await fastForwardTo(ctx, page, '2026-10-25T23:59:00+01:00');
  await page.waitForTimeout(800);
  const late = await pageNow(page);
  check(`${W}: the page clock is at 25.10 23:59 winter time`, late.startsWith('2026-10-25 23:59') && late.endsWith('+01:00'), late);
  const sunday = await label(page);
  check(`${W}: 24 h 59 min into the day the label still reads Sonntag, 25. Oktober`, sunday === 'Sonntag, 25. Oktober', String(sunday));
  await ctx.clock.runFor('02:00');
  const monday = await waitForLabel(page, 'Montag, 26. Oktober');
  check(`${W}: in place, the end of the 25-hour day moves the label to Montag, 26. Oktober`, monday.ok, `${await pageNow(page)} ${short(monday.seen)}`);
});

await scenario('4b DST end 25→26.10', { tz: BERLIN, time: '2026-10-25T23:58:00+01:00' }, async ({ ctx, page, W }) => {
  await setUp(page);
  await startsOn(page, W, '2026-10-25 23:5', 'Sonntag, 25. Oktober');
  await ctx.clock.runFor('05:00');
  const at = await pageNow(page);
  check(`${W}: the page clock is on 26.10 winter time`, at.startsWith('2026-10-26 00:0') && at.endsWith('+01:00'), at);
  const moved = await waitForLabel(page, 'Montag, 26. Oktober');
  check(`${W}: with no input the label reads Montag, 26. Oktober`, moved.ok, short(moved.seen));
});

/* ── 5 — DST start, Berlin: the 23-hour Sunday ───────────────────────── */
await scenario('5 DST start 27→28.03.2027', { tz: BERLIN, time: '2027-03-27T23:58:00+01:00' }, async ({ ctx, page, W }) => {
  await setUp(page);
  await startsOn(page, W, '2027-03-27 23:5', 'Samstag, 27. März');
  await ctx.clock.runFor('05:00');
  const at = await pageNow(page);
  check(`${W}: the page clock is on 28.03 winter time`, at.startsWith('2027-03-28 00:0') && at.endsWith('+01:00'), at);
  const moved = await waitForLabel(page, 'Sonntag, 28. März');
  check(`${W}: with no input the label reads Sonntag, 28. März`, moved.ok, short(moved.seen));

  // In place, through the 23-hour day: a timer of 24 hours would fire at
  // 01:00 on Monday and leave Sunday showing for an hour.
  await fastForwardTo(ctx, page, '2027-03-28T23:59:00+02:00');
  await page.waitForTimeout(800);
  const late = await pageNow(page);
  check(`${W}: the page clock is at 28.03 23:59 summer time`, late.startsWith('2027-03-28 23:59') && late.endsWith('+02:00'), late);
  const sunday = await label(page);
  check(`${W}: 22 h 59 min into the day the label still reads Sonntag, 28. März`, sunday === 'Sonntag, 28. März', String(sunday));
  await ctx.clock.runFor('02:00');
  const monday = await waitForLabel(page, 'Montag, 29. März');
  check(`${W}: in place, the end of the 23-hour day moves the label to Montag, 29. März`, monday.ok, `${await pageNow(page)} ${short(monday.seen)}`);
});

/* ── 6 — a midnight that does not exist, São Paulo ───────────────────── */
await scenario('6 São Paulo 03→04.11.2018', { tz: SAO_PAULO, time: '2018-11-03T23:58:00-03:00' }, async ({ ctx, page, W }) => {
  await setUp(page);
  await startsOn(page, W, '2018-11-03 23:5', 'Samstag, 3. November');
  const before = await pageNow(page);
  check(`${W}: before midnight the zone is at -03:00`, before.endsWith('-03:00'), before);
  await ctx.clock.runFor('05:00');
  const at = await pageNow(page);
  // 23:58 -03:00 plus five minutes is 01:03 -02:00: 00:00–00:59 never existed.
  check(`${W}: the page clock skipped the missing hour (04.11 01:0x -02:00)`, at.startsWith('2018-11-04 01:0') && at.endsWith('-02:00'), at);
  const moved = await waitForLabel(page, 'Sonntag, 4. November');
  check(`${W}: with no input the label reads Sonntag, 4. November`, moved.ok, short(moved.seen));
  await scaleButton(page, 8).tap();
  await page.waitForTimeout(1200);
  const stored = await answers(page);
  check(`${W}: the answer is stored under 2018-11-04`, stored.length === 1 && stored[0].date === '2018-11-04', short(stored));
  check(`${W}: the label stays on Sonntag, 4. November`, (await label(page)) === 'Sonntag, 4. November', String(await label(page)));
});

await browser.close();
process.exit(summary() ? 0 : 1);
