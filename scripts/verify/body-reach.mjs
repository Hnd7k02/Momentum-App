import { chromium } from 'playwright-core';
import { URL_APP, check, summary, onboard, seed, seedTraining, seedMuscles, openMuscles } from './lib.mjs';

/**
 * How much of the body each region offers a finger, measured, not assumed.
 *
 * Taps a 12px grid over the whole canvas at 393, 430 and 320, front and
 * back, and counts which regions respond. A miss leaves the selection alone,
 * so only a CHANGE of selection is a hit. The approved decision for 320px is
 * 9 of 10, and this re-measures it rather than restating it. It was taken
 * with the triceps below the probe; measured on a body that stands still
 * (WP3 Stage 4), the triceps are reached and the forearms are the region
 * the 12px pitch misses at 320. The count is the decision, and it holds.
 *
 * A tap that selects a region on the far side turns the body round
 * (`BodyViewer.tsx`: the turn-into-view rule fires for taps too until
 * Stage 7). Left alone, the rest of a "front" pass taps a body swinging
 * between 48° and 125° — every selection change in a 393 front pass was
 * measured off 0° — and what it reaches depends on frame timing: four runs
 * of one build gave 10/10/9, 9/10/8, 10/9/9 and 10/9/8. Two things turned
 * it. The view pills sit over the top of the canvas, so the grid's first
 * rows tapped "Seite" and "Hinten"; a cell whose topmost element is not the
 * canvas is not body a finger can reach, and is skipped. And a hit on the
 * far side turns the body to it: as `body.mjs` does since STOP 3b, the body
 * is put back to the pass's view, and the next tap waits until it is there.
 * The pill is pressed as a finger presses it, without Playwright scrolling
 * it into view first: that scroll moved the canvas from under the grid.
 */
/** `STEP=8 WIDTHS=430` for a finer probe of one width. */
const STEP = Number(process.env.STEP ?? 12);
const WIDTHS = (process.env.WIDTHS ?? '393,430,320').split(',').map(Number);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const results = {};
/** The regions whose REGION_FACING is 180°, by the names their rows show. */
const FACES_BACK = new Set(['Rücken', 'Beinbeuger und Gesäss', 'Trizeps', 'Waden']);
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
  let box = await page.locator('.body-viewer canvas').boundingBox();
  const tally = new Map();
  /** A view pill pressed in place — `locator.click()` would scroll the module first. */
  const press = (view) => page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: view }).evaluate((el) => el.click());
  const current = () => page.evaluate(() => document.querySelector('.muscle-row__button[aria-pressed="true"] .muscle-row__name')?.textContent ?? null);
  const azimuth = async () => Number(await page.locator('.body-viewer').getAttribute('data-azimuth'));
  /** Back to the pass's view, and not one tap before the body is there. */
  const reface = async (view, facing) => {
    for (let tries = 0; tries < 3; tries += 1) {
      await press(view);
      for (let waited = 0; waited < 6000 && (await azimuth()) !== facing; waited += 100) await page.waitForTimeout(100);
      await page.waitForTimeout(150);
      if ((await azimuth()) === facing) return;
    }
  };
  for (const [view, facing] of [['Vorne', 0], ['Hinten', 180]]) {
    await press(view);
    await page.waitForTimeout(3500);
    box = await page.locator('.body-viewer canvas').boundingBox();
    let prev = await current();
    for (let y = 6; y < box.height; y += STEP) {
      for (let x = 6; x < box.width; x += STEP) {
        const onCanvas = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.tagName === 'CANVAS', [box.x + x, box.y + y]);
        if (!onCanvas) continue;
        await page.mouse.click(box.x + x, box.y + y);
        const cur = await current();
        if (cur !== prev) {
          const hit = cur ?? prev;
          tally.set(hit, (tally.get(hit) ?? 0) + 1);
          if (cur !== null && FACES_BACK.has(cur) !== (facing === 180)) await reface(view, facing);
        }
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
