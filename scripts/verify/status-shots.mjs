import { chromium } from 'playwright-core';
import { URL_APP, onboard, openMuscles, seed, seedTraining, seedMuscles, phone } from './lib.mjs';

/**
 * Evidence screenshots for the status palette (D123): the 1–10 picker on
 * Today, the Verlauf grid with its legend, a question's history, and the
 * Gym muscle map, all at 393px. Full viewports, never crops.
 */
const OUT = process.env.OUT ?? 'docs/design/status-palette';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext(phone);
const page = await ctx.newPage();
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });

await page.goto(URL_APP, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await onboard(page, { gym: 3, running: 2 });
await seed(page, { days: 42 });
await seedTraining(page, { days: 42 });
await seedMuscles(page, { days: 42 });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Today: pick a 6 (mixed) on the first scale question, a 10 on the next.
// An answered question folds away 620 ms later but stays in the page, so
// each pick names its question rather than taking the first match.
const scale = (question, value) =>
  page.getByRole('radiogroup', { name: question }).getByRole('radio', { name: new RegExp(`^${value} von 10`) });
const six = scale(/Wie gut hast du gesch/, 6);
await six.scrollIntoViewIfNeeded();
await six.click();
await page.waitForTimeout(500);
await shot('393-A-today-scale-6');
const ten = scale(/Wie war deine Stimmung/, 10);
await ten.click();
await page.waitForTimeout(500);
await shot('393-B-today-scale-10');

// Verlauf: grid and legend.
await page.locator('.tab-bar button', { hasText: 'Verlauf' }).click();
await page.waitForTimeout(800);
await shot('393-D-verlauf');
await page.locator('.heatmap__legend').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await shot('393-E-verlauf-legend');
await page.getByRole('button', { name: /Mind/ }).first().click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: /Wie gut hast du gesch/ }).first().click();
await page.waitForTimeout(600);
await shot('393-F-question-detail');
await page.getByRole('button', { name: 'Zurück' }).click();
await page.waitForTimeout(400);

// Bereiche → Gym → Muskelgruppen: the muscle map and its rows, on its own
// destination since WP2-2.
await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
await page.waitForTimeout(700);
await page.getByRole('radio', { name: 'Gym' }).click();
await page.waitForTimeout(900);
await openMuscles(page);
await page.locator('.areas__scroll').evaluate((el) => { const m = document.querySelector('.muscle-module'); if (m) el.scrollTop += m.getBoundingClientRect().top - el.getBoundingClientRect().top - 8; });
await page.waitForTimeout(900);
await shot('393-G-muscle-map');

await ctx.close();
await browser.close();
console.log('screenshots written to', OUT);
