import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, onboard, summary } from './lib.mjs';

/**
 * WP3, Stage 5b — "line or bars": the pictures of the question the contract
 * left to this stage (§6, D163).
 *
 * Three real series of the strength profile (`fixtures/trainingProfile.ts`,
 * written as a file by `STAGE5B_PROFILE=<file> npx vitest run stage5bReport`)
 * in the exercise detail, at 393 and 320:
 *
 *   Bankdrücken             double progression — a rep more each week, then
 *                           +2.5 kg and back to 8
 *   Schrägbank Kurzhantel   a steady rise at fixed reps
 *   Cable Fly straight      six exercise-days, the last one light
 *
 * each drawn twice from the same days: with the bars of the production
 * build, and as the line proposed for the STOP (`ExerciseLineChart.tsx`),
 * which only the dev server loads, under `?chart=line`. One sheet per width
 * puts the two side by side.
 *
 *   npm run build && npx vite preview --port 4173 &   # the bars
 *   npx vite --port 5173 &                            # the line
 *   PROFILE=<file.json> OUT=docs/design/wp3/stage5b node scripts/verify/stage5b-chart-shots.mjs
 *
 * `CLOCK` is the day the screens are read on, by default the profile's
 * light day (2026-06-13), with the range at 90 days.
 */
const DEV_URL = process.env.DEV_URL ?? 'http://127.0.0.1:5173/Momentum-App/';
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
const MODES = [
  { key: 'balken', title: 'Balken (im Build)', url: URL_APP },
  { key: 'linie', title: 'Linie (Vorschlag)', url: `${DEV_URL}?chart=line` },
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
for (const mode of MODES) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: HEIGHT[width] ?? 852 }, deviceScaleFactor: 2, hasTouch: true, timezoneId: TZ, locale: 'de-CH' });
    await ctx.clock.setSystemTime(noon(CLOCK));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto(mode.url, { waitUntil: 'networkidle' });
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
      const row = page.locator('.gym-progress__row', { has: page.locator('.gym-progress__rowName', { hasText: new RegExp(`^${series.name}$`) }) }).first();
      await row.scrollIntoViewIfNeeded();
      await row.click();
      await page.locator('.gym-detail').waitFor();
      await page.waitForTimeout(900);
      const chart = page.locator('.gym-detail__chart');
      const card = page.locator('.card', { has: chart }).first();
      const kind = await page.evaluate(() => ({
        bars: document.querySelectorAll('.gym-detail__bar').length,
        line: document.querySelectorAll('.exercise-line__line').length,
      }));
      check(`${mode.key} ${width}: ${series.name} is drawn as ${mode.key === 'linie' ? 'a line' : 'bars'}`,
        mode.key === 'linie' ? kind.line === 1 && kind.bars === 0 : kind.bars > 1 && kind.line === 0, JSON.stringify(kind));
      const path = `${OUT}/chart-${mode.key}-${width}-${series.slug}.png`;
      await card.screenshot({ path });
      drawn[`${mode.key}-${width}-${series.slug}`] = path;
      // The whole screen once per mode and width, for the first series.
      if (series === SERIES[0]) await page.screenshot({ path: `${OUT}/detail-${mode.key}-${width}.png`, fullPage: false });
      await page.locator('.gym-detail .gym-session__back').click();
      await page.waitForTimeout(700);
    }
    check(`${mode.key} ${width}: no page error`, errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }
}

/* ── One sheet per width: bars beside the line ──────────────────────────── */

const dataUrl = (path) => `data:image/png;base64,${readFileSync(path).toString('base64')}`;
for (const width of WIDTHS) {
  const cell = (mode, series) => `<figure><img src="${dataUrl(drawn[`${mode.key}-${width}-${series.slug}`])}" width="${width - 32}"></figure>`;
  const html = `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; padding: 20px; background: #101014; color: #f2f2f5; font: 15px/1.35 -apple-system, 'Inter', 'Helvetica Neue', Arial, sans-serif; }
    h1 { font-size: 17px; margin: 0 0 4px; } p { margin: 0 0 16px; color: #b9b9c4; font-size: 13px; }
    table { border-collapse: separate; border-spacing: 14px 10px; margin: 0 -14px; }
    th { text-align: left; font-size: 13px; font-weight: 600; color: #b9b9c4; }
    td.name { font-size: 13px; font-weight: 600; padding-top: 6px; }
    td.name span { display: block; font-weight: 400; color: #b9b9c4; }
    figure { margin: 0; } img { display: block; border-radius: 18px; }
  </style>
  <h1>Übungsdetail bei ${width} px: Balken oder Linie</h1>
  <p>Dieselben Tage, dieselbe Kennzahl (bester Arbeitssatz). Stand ${CLOCK}, Zeitraum 90 Tage.</p>
  <table>
    <tr>${MODES.map((mode) => `<th>${mode.title}</th>`).join('')}</tr>
    ${SERIES.map((series) => `<tr><td class="name" colspan="2">${series.name}<span>${series.what}</span></td></tr><tr>${MODES.map((mode) => `<td>${cell(mode, series)}</td>`).join('')}</tr>`).join('')}
  </table>`;
  const ctx = await browser.newContext({ viewport: { width: 2 * width + 40, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: `${OUT}/linie-oder-balken-${width}.png`, fullPage: true });
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
