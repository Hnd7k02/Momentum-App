import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, onboard, openGymHub, openMuscles, openGroupSheet, closeGroupSheet, openExerciseAnywhere, closeExercise, summary } from './lib.mjs';

/**
 * Block 9, step 6a — a workout saved today stands in every chart at once
 * (D194).
 *
 * The owner, at STOP 7D: "Ein eingetragenes Training erscheint im
 * Entwicklungs-Chart erst am nächsten Tag. Es soll sofort nach dem Speichern
 * erscheinen." The cause was found in Verlauf: D111 holds a day open while
 * a daily question is unanswered, and an open day was no data in its grid —
 * so a workout logged before the questions appeared once they were answered,
 * or once the day closed two days later. The rule stays; Verlauf shows what
 * the open day holds as provisional.
 *
 * One device, the check file of block 7D imported on Monday 23 November
 * 2026 at ten — its last session six days before, so this week holds none
 * yet. Then one workout today, before any question is answered, and every
 * chart that shows a development is read again:
 *
 *   Muskelgruppen   the chest row says "Heute"; the chest's sheet draws its
 *                   line to today, with one measurement more
 *   Übungsdetail    Bankdrücken lists today first and its line ends today
 *   Gym-Rating      the hub counts the workout, and its rating tile shows
 *                   the rating with it at once, saying "Vorläufig · der Tag
 *                   ist noch offen" — the rating itself does not count an
 *                   open day (D111); once today's questions are answered
 *                   the day is complete and the tile shows that same value
 *                   as the rating, nothing provisional left
 *   Verlauf         the grid's Gym and overall cells for today stand as
 *                   provisional, hollow, "vorläufig" in the table and the
 *                   legend, and give way to the day's own values once it is
 *                   complete; the curve — RC2's overall fold, which counts
 *                   a day as far as its questions are answered — moves once
 *                   they are, on the same day
 *   Fragenverlauf   a question answered today, the other one still open:
 *                   its history shows today's answer as provisional
 *
 * And the past: every grid cell before this week's Monday, and every day of
 * Bankdrücken before today, reads the same before and after.
 */

const DAY = '2026-11-23';
const FILE = 'docs/wp3/stage7d/momentum-pruefdaten-7d-2026-11-17.json';
const DAY_LABEL = '23. November';
/** A percentage as the app prints it: a no-break space before the sign (D163). */
const PERCENT = '\\d+\u00A0%';

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, hasTouch: true, timezoneId: 'Europe/Zurich', locale: 'de-CH' });
await ctx.clock.setSystemTime(new Date(`${DAY}T10:00:00+01:00`));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const clean = (text) => (text ?? '').replace(/\s+/g, ' ').trim();
const tab = (name) => page.locator('.tab-bar__tab', { hasText: name });

await page.goto(URL_APP, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await onboard(page, { gym: 3, running: 0 });
await tab('Bereiche').click();
await page.waitForTimeout(700);
await page.locator('input[type="file"]').setInputFiles(FILE);
await page.getByRole('button', { name: 'Ersetzen' }).click();
await page.locator('.backup__status--ok').waitFor();
await page.waitForTimeout(800);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

/** Verlauf: the curve's figures and the grid's table, day by day. */
async function verlauf() {
  await tab('Verlauf').click();
  await page.waitForTimeout(1500);
  return page.evaluate(() => {
    const table = document.querySelector('.heatmap table');
    const head = [...table.querySelectorAll('thead th')].slice(1).map((th) => th.textContent.trim());
    const rows = Object.fromEntries([...table.querySelectorAll('tbody tr')].map((tr) => [tr.querySelector('th').textContent.trim(), [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())]));
    return {
      current: document.querySelector('.trend__figures .trend__figureValue')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
      days: head,
      rows,
      hollow: document.querySelectorAll('.heatmap__bar--provisional').length,
      legend: [...document.querySelectorAll('.heatmap__legendItem')].map((li) => li.textContent.trim()),
    };
  });
}

/** Gym: the hub, Muskelgruppen, the chest's sheet and Bankdrücken. */
async function gym() {
  await openGymHub(page, { wait: 1500 });
  const rating = clean(await page.locator('[data-metric="gym-rating"]').first().textContent());
  const ratingValue = Number(/Gym-Rating(\d+)/.exec(rating)?.[1] ?? NaN);
  const hub = clean(await page.locator('.screen').first().textContent());
  await openMuscles(page, { wait: 3500 });
  const chestRow = clean(await page.locator('.muscle-row__button[data-muscle="chest"]').textContent());
  await openGroupSheet(page, 'Brust');
  const chestChart = await page.locator('.sheet--detents [role="img"]').first().getAttribute('aria-label');
  await closeGroupSheet(page);
  await openExerciseAnywhere(page, 'Bankdrücken');
  const benchDays = (await page.locator('.gym-detail table tbody tr').allTextContents()).map(clean);
  const benchText = clean(await page.locator('.gym-detail').first().textContent());
  await closeExercise(page);
  await closeGroupSheet(page).catch(() => undefined);
  return { rating, ratingValue, attendance: /(\d) von 3 Sessions diese Woche/.exec(hub)?.[1] ?? null, chestRow, chestChart, benchDays, benchText };
}

const before = { verlauf: await verlauf(), gym: await gym() };

// One workout today, before any question is answered: Bankdrücken, 8 × 90 kg.
await tab('Heute').click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Session eintragen' }).click();
await page.waitForTimeout(700);
const free = page.locator('[role="dialog"]').getByRole('button', { name: 'Freie Session' });
if ((await free.count()) > 0) { await free.click(); await page.waitForTimeout(700); }
await page.locator('.gym-session__bar').getByRole('button', { name: /Übung hinzufügen/ }).click();
await page.waitForTimeout(500);
await page.getByRole('textbox', { name: 'Suchen' }).fill('Bankdrücken');
await page.waitForTimeout(350);
await page.locator('.gym-picker__row').filter({ has: page.locator('.gym-picker__name', { hasText: /^Bankdrücken$/ }) }).first().click();
await page.waitForTimeout(900);
const pending = page.locator('.gym-session .card').filter({ has: page.locator('.gym-exercise__name', { hasText: /^Bankdrücken/ }) }).locator('.gym-set--pending');
await pending.locator('input').nth(0).fill('8');
await pending.locator('input').nth(0).blur();
await page.waitForTimeout(300);
await pending.locator('input').nth(1).fill('90');
await pending.locator('input').nth(1).blur();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Fertig' }).click();
await page.waitForTimeout(1500);

const after = { gym: await gym(), verlauf: await verlauf() };

/* ── Gym ──────────────────────────────────────────────────────────────── */

check('Muskelgruppen: the chest row says it was trained today', /^Brust ?Heute/.test(after.gym.chestRow), `${before.gym.chestRow} → ${after.gym.chestRow}`);
const measurements = (label) => Number(/(\d+) Messwerte/.exec(label ?? '')?.[1] ?? NaN);
check(`Muskelgruppen: the chest's sheet draws its line to ${DAY_LABEL}, with one measurement more`,
  (after.gym.chestChart ?? '').includes(`bis ${DAY_LABEL}`) && measurements(after.gym.chestChart) === measurements(before.gym.chestChart) + 1,
  `${before.gym.chestChart} → ${after.gym.chestChart}`);
check(`Übungsdetail: Bankdrücken lists ${DAY_LABEL} first, and its line ends on it`,
  after.gym.benchDays[0]?.startsWith(DAY_LABEL) && after.gym.benchText.includes(`${DAY_LABEL}Jeder Punkt`),
  `${after.gym.benchDays[0]} | ${after.gym.benchText.slice(0, 220)}`);
check('Übungsdetail: every day before today reads as it did', JSON.stringify(after.gym.benchDays.slice(1)) === JSON.stringify(before.gym.benchDays),
  `${before.gym.benchDays.join(' / ')} → ${after.gym.benchDays.slice(1).join(' / ')}`);
check('Gym-Rating: the hub counts the workout, and its tile shows the rating with it at once, as provisional',
  Number(after.gym.attendance) === Number(before.gym.attendance) + 1 && after.gym.ratingValue !== before.gym.ratingValue &&
    after.gym.rating.includes('Vorläufig · der Tag ist noch offen') && !before.gym.rating.includes('Vorläufig'),
  `${before.gym.attendance} → ${after.gym.attendance}; ${before.gym.rating} → ${after.gym.rating}`);

/* ── Verlauf ──────────────────────────────────────────────────────────── */

const todayIndex = after.verlauf.days.indexOf(DAY_LABEL);
const gymToday = after.verlauf.rows.Gym?.[todayIndex];
const overallToday = after.verlauf.rows.Gesamt?.[todayIndex];
check('Verlauf: before the workout, this week holds no session and today\'s Gym has no data', before.verlauf.rows.Gym?.[todayIndex] === 'Keine Daten',
  JSON.stringify({ gym: before.verlauf.rows.Gym?.[todayIndex], hollow: before.verlauf.hollow }));
const provisional = new RegExp(`^${PERCENT} \\(vorläufig\\)$`);
check('Verlauf: right after the workout, today stands in the Gym and overall rows as provisional', provisional.test(gymToday ?? '') && provisional.test(overallToday ?? ''),
  `${gymToday} | ${overallToday}`);
check('Verlauf: drawn hollow, and the legend says what a hollow bar is', after.verlauf.hollow >= 2 && after.verlauf.legend.includes('Vorläufig: der Tag ist noch offen'),
  JSON.stringify({ hollow: after.verlauf.hollow, legend: after.verlauf.legend }));
// This week began today: every day before it reads exactly as before.
const monday = todayIndex;
const pastRows = (v) => Object.fromEntries(Object.entries(v.rows).map(([name, cells]) => [name, cells.slice(0, monday)]));
check('Verlauf: every day before this week reads as it did', monday > 0 && JSON.stringify(pastRows(after.verlauf)) === JSON.stringify(pastRows(before.verlauf)));

/* ── A question answered today, the other one open ───────────────────── */

await tab('Heute').click();
await page.waitForTimeout(800);
const scales = page.locator('.answer-scale');
await scales.nth(0).locator('.answer-scale__value', { hasText: /^7$/ }).click();
await page.waitForTimeout(800);
const half = await verlauf();
await page.locator('.heatmap__header--tappable', { hasText: 'Mind' }).click();
await page.waitForTimeout(400);
const firstQuestion = page.locator('.heatmap__row--depth1 .heatmap__header--tappable').first();
await firstQuestion.click();
await page.waitForTimeout(800);
const detail = clean(await page.locator('.question-detail').textContent());
const detailTable = await page.locator('.question-detail table tbody tr').evaluateAll((rows) => rows.map((row) => row.textContent.replace(/\s+/g, ' ').trim()));
check('Fragenverlauf: the answer given today stands as provisional while the other question is open',
  detailTable.some((row) => row.startsWith(DAY_LABEL) && row.includes('(vorläufig)')) && detail.includes('vorläufig'),
  `${detailTable.at(-1)} | ${half.rows.Mind?.[todayIndex]}`);
await page.locator('.question-detail__back').click();
await page.waitForTimeout(600);

// Both answered: the day is complete, and its own values stand.
await tab('Heute').click();
await page.waitForTimeout(800);
await page.locator('.answer-scale').nth(1).locator('.answer-scale__value', { hasText: /^7$/ }).click();
await page.waitForTimeout(800);
const complete = await verlauf();
const todayCells = (v) => Object.values(v.rows).map((cells) => cells[todayIndex]);
check('Verlauf: once today is complete its own values stand in today\'s column, none of them provisional',
  new RegExp(`^${PERCENT}$`).test(complete.rows.Gym?.[todayIndex] ?? '') && new RegExp(`^${PERCENT}$`).test(complete.rows.Gesamt?.[todayIndex] ?? '') &&
    todayCells(complete).every((cell) => !cell.includes('vorläufig')),
  JSON.stringify({ today: todayCells(complete), hollow: complete.hollow }));
check('Verlauf: the curve moves once today\'s questions are answered, on the same day', complete.current !== after.verlauf.current,
  `${before.verlauf.current} → ${after.verlauf.current} → ${complete.current}`);
const settled = await gym();
check('Gym-Rating: once today is complete the tile shows the value it showed as provisional, as the rating',
  settled.ratingValue === after.gym.ratingValue && !settled.rating.includes('Vorläufig'),
  `${after.gym.rating} → ${settled.rating}`);

check('no page error', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
process.exit(summary() ? 0 : 1);
