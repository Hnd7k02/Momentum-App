import { chromium } from 'playwright-core';
import { URL_APP, check, summary, onboard, seed, seedTraining, seedMuscles, openMuscles } from './lib.mjs';

/**
 * How much of the body each region offers a finger, measured, not assumed.
 *
 * Taps a 12px grid over the whole canvas at 393, 430 and 320, front and
 * back, and counts which regions respond. A miss leaves the selection alone,
 * so only a CHANGE of selection is a hit. The approved decision for 320px is
 * 9 of 10 — the triceps below the probe — and this re-measures it rather
 * than restating it.
 */
/** `STEP=8 WIDTHS=430` for a finer probe of one width. */
const STEP = Number(process.env.STEP ?? 12);
const WIDTHS = (process.env.WIDTHS ?? '393,430,320').split(',').map(Number);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const results = {};
for (const [width, height] of [[393, 852], [430, 932], [320, 693]].filter(([w]) => WIDTHS.includes(w))) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, hasTouch: true });
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
  await page.waitForTimeout(600);
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(900);
  await openMuscles(page);
  await page.locator('.areas__scroll').evaluate((el) => { const m = document.querySelector('.muscle-module'); el.scrollTop += m.getBoundingClientRect().top - el.getBoundingClientRect().top - 8; });
  await page.waitForTimeout(1200);
  const box = await page.locator('.body-viewer canvas').boundingBox();
  const tally = new Map();
  const current = () => page.evaluate(() => document.querySelector('.muscle-row__button[aria-pressed="true"] .muscle-row__name')?.textContent ?? null);
  for (const view of ['Vorne', 'Hinten']) {
    await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: view }).click();
    await page.waitForTimeout(3500);
    let prev = await current();
    for (let y = 6; y < box.height; y += STEP) {
      for (let x = 6; x < box.width; x += STEP) {
        await page.mouse.click(box.x + x, box.y + y);
        const cur = await current();
        if (cur !== prev) { const hit = cur ?? prev; tally.set(hit, (tally.get(hit) ?? 0) + 1); }
        prev = cur;
      }
    }
  }
  const line = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
  results[width] = { reachable: tally.size, canvas: `${Math.round(box.width)}×${Math.round(box.height)}`, cells: line };
  console.log(`--- ${width}px, canvas ${results[width].canvas}, ${STEP}px grid: ${tally.size}/10 · ${line}`);
  await ctx.close();
}
await browser.close();
if (results[393]) check('393: every region is reachable by a direct tap', results[393].reachable === 10, `${results[393].reachable}/10`);
if (results[430]) check('430: every region is reachable by a direct tap', results[430].reachable === 10, `${results[430].reachable}/10`);
if (results[320]) check('320: measured against the accepted 9/10', results[320].reachable >= 9, `${results[320].reachable}/10 — ${results[320].cells}`);
process.exit(summary() ? 0 : 1);
