import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, onboard, summary, openExerciseAnywhere, closeExercise, closeGroupSheet } from './lib.mjs';

/**
 * WP3, Stage 5b — the pictures of the exercise detail's line (contract §6;
 * the owner's choice at STOP 5b, D175).
 *
 * Three real series of the strength profile (`fixtures/trainingProfile.ts`,
 * written as a file by `STAGE5B_PROFILE=<file> npx vitest run stage5bReport`)
 * in the exercise detail of the production build, at 393 and 320:
 *
 *   Bankdrücken             double progression — a rep more each week, then
 *                           +2.5 kg and back to 8
 *   Schrägbank Kurzhantel   a steady rise at fixed reps
 *   Cable Fly straight      six exercise-days, the last one light
 *
 * One sheet per width holds the three charts; the whole screen of the first
 * series is kept beside it.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   PROFILE=<file.json> OUT=docs/design/wp3/stage5b node scripts/verify/stage5b-chart-shots.mjs
 *
 * Before the STOP this script drew the same three series twice — as the
 * bars of the build and as the line proposed on the dev server — and its
 * sheets `linie-oder-balken-*.png` are what the owner chose from. They stay
 * in `docs/design/wp3/stage5b/` as the record of that choice; the bars
 * themselves are gone, so they cannot be drawn again.
 *
 * `CLOCK` is the day the screens are read on, by default the profile's
 * light day (2026-06-13), with the range at 90 days.
 */
const PROFILE = process.env.PROFILE;
const OUT = process.env.OUT ?? 'docs/design/wp3/stage5b';
const CLOCK = process.env.CLOCK ?? '2026-06-13';
const WIDTHS = (process.env.WIDTHS ?? '393,320').split(',').map(Number);
const HEIGHT = { 320: 693, 360: 780, 393: 852, 430: 932 };
const TZ = 'Europe/Berlin';
if (!PROFILE) throw new Error('PROFILE=<the strength profile as a backup file> is required');
mkdirSync(OUT, { recursive: true });

const SERIES = [
  { name: 'Bankdrücken', slug: 'bankdruecken', what: 'Doppelte Progression' },
  { name: 'Schrägbank Kurzhantel', slug: 'schraegbank', what: 'Gleichmässiger Anstieg' },
  { name: 'Cable Fly straight', slug: 'cable-fly', what: 'Ein leichter Tag am Ende' },
];

const browser = await chromium.launch({ executablePath: CHROMIUM });

function noon(day) {
  for (const offset of ['+02:00', '+01:00']) {
    const instant = new Date(`${day}T12:00:00${offset}`);
    const hour = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(instant);
    if (hour === '12') return instant;
  }
  throw new Error(`no noon for ${day}`);
}
const tab = (page, name) => page.locator('.tab-bar button', { hasText: name });

const drawn = {};
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: HEIGHT[width] ?? 852 }, deviceScaleFactor: 2, hasTouch: true, timezoneId: TZ, locale: 'de-CH' });
  await ctx.clock.setSystemTime(noon(CLOCK));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await onboard(page, { gym: 3, running: 0 });

  // The profile, through "Backup importieren".
  await tab(page, 'Bereiche').click();
  await page.waitForTimeout(700);
  await page.locator('input[type="file"]').setInputFiles(PROFILE);
  await page.getByRole('button', { name: 'Ersetzen' }).click();
  await page.locator('.backup__status--ok').waitFor();
  await page.waitForTimeout(1200);

  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Muskelgruppen öffnen' }).click();
  await page.waitForTimeout(4000);
  await page.locator('.progress__ranges button', { hasText: /^90 Tage$/ }).click();
  await page.waitForTimeout(1500);

  for (const series of SERIES) {
    // Since block 7C an exercise is opened from the sheet of its group; the
    // sheet stays in the document under the detail, with a chart of its own.
    await openExerciseAnywhere(page, series.name);
    const chart = page.locator('.gym-detail .gym-detail__chart');
    const card = page.locator('.gym-detail .card', { has: chart }).first();
    const kind = await page.evaluate(() => ({
      bars: document.querySelectorAll('.gym-detail .gym-detail__bar').length,
      line: document.querySelectorAll('.gym-detail .exercise-line__line').length,
    }));
    check(`${width}: ${series.name} is drawn as a line`, kind.line === 1 && kind.bars === 0, JSON.stringify(kind));
    const path = `${OUT}/chart-${width}-${series.slug}.png`;
    await card.screenshot({ path });
    drawn[`${width}-${series.slug}`] = path;
    // The whole screen once per width, for the first series.
    if (series === SERIES[0]) await page.screenshot({ path: `${OUT}/uebungsdetail-linie-${width}-screen.png`, fullPage: false });
    await closeExercise(page);
    await closeGroupSheet(page);
  }
  check(`${width}: no page error`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ── One sheet per width: the three series ──────────────────────────────── */

const dataUrl = (path) => `data:image/png;base64,${readFileSync(path).toString('base64')}`;
for (const width of WIDTHS) {
  const html = `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; padding: 20px; background: #101014; color: #f2f2f5; font: 15px/1.35 -apple-system, 'Inter', 'Helvetica Neue', Arial, sans-serif; display: inline-block; }
    h1 { font-size: 17px; margin: 0 0 4px; } p { margin: 0 0 16px; color: #b9b9c4; font-size: 13px; }
    h2 { font-size: 13px; font-weight: 600; margin: 14px 0 6px; } h2 span { display: block; font-weight: 400; color: #b9b9c4; }
    img { display: block; border-radius: 18px; }
  </style>
  <h1>Übungsdetail bei ${width} px: die Linie</h1>
  <p>Jeder Tag als Veränderung seit dem ersten Tag im Zeitraum. Stand ${CLOCK}, 90 Tage.</p>
  ${SERIES.map((series) => `<h2>${series.name}<span>${series.what}</span></h2><img src="${dataUrl(drawn[`${width}-${series.slug}`])}" width="${width - 32}">`).join('')}`;
  const ctx = await browser.newContext({ viewport: { width: width + 40, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  const box = await page.locator('body').boundingBox();
  await page.screenshot({ path: `${OUT}/uebungsdetail-linie-${width}.png`, clip: { x: 0, y: 0, width: Math.ceil(box.width), height: Math.ceil(box.height) } });
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
