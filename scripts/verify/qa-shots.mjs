import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, onboard, seed, seedTraining, seedMuscles, openMuscles, openGroupSheet, closeGroupSheet } from './lib.mjs';

/**
 * The committed QA screenshots for the muscle map: the real Gym screen at
 * 393, 430 and 320, named `<width>-<letter>-<slug>.png` so the QA file can
 * point at them. Full viewports, never crops.
 */
const OUT = process.env.OUT ?? 'docs/design/muscle-map/qa';
const browser = await chromium.launch({ executablePath: CHROMIUM });

async function open(width, height, init = null) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await onboard(page, { gym: 3, running: 2 });
  await seed(page, { days: 42 });
  await seedTraining(page, { days: 42 });
  await seedMuscles(page, { days: 42 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Bereiche' }).click();
  await page.waitForTimeout(700);
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(900);
  await openMuscles(page);
  return { ctx, page };
}
const scrollTo = async (page, selector, offset = 8) => {
  await page.locator('.areas__scroll').evaluate((el, { selector, offset }) => { const m = document.querySelector(selector); el.scrollTop += m.getBoundingClientRect().top - el.getBoundingClientRect().top - offset; }, { selector, offset });
  await page.waitForTimeout(900);
};
const waitForAzimuth = async (page, want) => {
  for (let i = 0; i < 160; i += 1) {
    const now = Number(await page.locator('.body-viewer').getAttribute('data-azimuth'));
    if (Math.abs(((now - want + 540) % 360) - 180) <= 3) return;
    await page.waitForTimeout(150);
  }
};
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

for (const [width, height] of [[393, 852], [430, 932]]) {
  const { ctx, page } = await open(width, height);
  await shot(page, `${width}-A-gym-workspace`);
  await scrollTo(page, '.muscle-module');
  await shot(page, `${width}-B-muskelgruppen`);
  // A row opens its group's sheet (block 7C); the page brings the body
  // under the header by itself, and Escape closes the sheet again.
  await openGroupSheet(page, 'Brust');
  await shot(page, `${width}-C-measured-selected`);
  await closeGroupSheet(page);
  await openGroupSheet(page, 'Schultern');
  await shot(page, `${width}-D-nodata-selected`);
  await closeGroupSheet(page);
  await scrollTo(page, '.muscle-module');
  const pills = page.getByRole('group', { name: 'Ansicht' });
  await pills.getByRole('button', { name: 'Vorne' }).click();
  await waitForAzimuth(page, 0);
  await shot(page, `${width}-E-front`);
  await pills.getByRole('button', { name: 'Seite' }).click();
  await waitForAzimuth(page, 90);
  await shot(page, `${width}-F-side`);
  await pills.getByRole('button', { name: 'Hinten' }).click();
  await waitForAzimuth(page, 180);
  await shot(page, `${width}-G-back`);
  await pills.getByRole('button', { name: 'Vorne' }).click();
  await waitForAzimuth(page, 0);
  await scrollTo(page, '.muscle-rows', 24);
  await shot(page, `${width}-H-sparklines`);
  // Laufen lives on the Gym hub, not on the muscle destination (WP2-2).
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await page.waitForTimeout(900);
  await scrollTo(page, '.areas__running');
  await shot(page, `${width}-J-laufen`);
  await ctx.close();

  const fb = await open(width, height, () => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(String(type)) ? null : real.call(this, type, ...rest); };
  });
  await scrollTo(fb.page, '.muscle-module');
  await shot(fb.page, `${width}-I-svg-fallback`);
  await fb.ctx.close();
}

{
  const { ctx, page } = await open(320, 693);
  await shot(page, '320-A-gym-workspace');
  await scrollTo(page, '.muscle-module');
  await shot(page, '320-B-muskelgruppen');
  await scrollTo(page, '.muscle-rows', 24);
  await shot(page, '320-H-sparklines');
  await openGroupSheet(page, 'Trizeps');
  await waitForAzimuth(page, 180);
  await shot(page, '320-K-triceps-row-selected');
  await ctx.close();
}
await browser.close();
console.log('screenshots written to', OUT);
