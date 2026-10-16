import { chromium } from 'playwright-core';
import { URL_APP, onboard, seed, seedTraining, seedMuscles, phone } from './lib.mjs';

/**
 * Evidence screenshots for Stage 2 of the Overall-rank update (D125): the
 * Rank screen with the area ratings, the Gym rating board without a badge,
 * Laufen's board, and the Mind standing tile — all at 393px.
 */
const OUT = process.env.OUT ?? 'docs/design/overall-rank';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext(phone);
const page = await ctx.newPage();
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const scrollTo = async (selector, offset = 8) => {
  await page.locator('.rank__scroll, .areas__scroll').first().evaluate((el, { selector, offset }) => {
    const m = document.querySelector(selector);
    if (m) el.scrollTop += m.getBoundingClientRect().top - el.getBoundingClientRect().top - offset;
  }, { selector, offset });
  await page.waitForTimeout(600);
};

await page.goto(URL_APP, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await onboard(page, { gym: 3, running: 2 });
await seed(page, { days: 42 });
await seedTraining(page, { days: 42 });
await seedMuscles(page, { days: 42 });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

await page.locator('.tab-bar button', { hasText: 'Rang' }).click();
await page.waitForTimeout(1400);
await shot('393-A-rang-hero');
await scrollTo('.domain-standing');
await shot('393-B-rang-bereiche');

await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
await page.waitForTimeout(700);
await shot('393-C-bereiche-mental-standing');
await page.getByRole('radio', { name: 'Gym' }).click();
await page.waitForTimeout(4500);
await shot('393-D-gym-rating-board');
await scrollTo('[data-metric="running-rating"]');
await shot('393-E-laufen-rating-board');
await page.locator('[data-metric="gym-rating"]').scrollIntoViewIfNeeded();
await page.locator('[data-metric="gym-rating"] button, [data-metric="gym-rating"]').first().click();
await page.waitForTimeout(700);
await shot('393-F-gym-rating-sheet');

await ctx.close();
await browser.close();
console.log('screenshots written to', OUT);
