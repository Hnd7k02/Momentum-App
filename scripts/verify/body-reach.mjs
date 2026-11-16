import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, summary, onboard, seed, seedTraining, seedMuscles, openMuscles, openGymHub } from './lib.mjs';

/**
 * How much of the body each region offers a finger, measured, not assumed.
 *
 * Taps a 12px grid over the whole stage at 320, 360, 393 and 430, from the
 * front and from the back, and counts which regions respond. A miss leaves
 * the selection alone, so only a CHANGE of selection is a hit.
 *
 * **What block 7B changed here** (contract §8):
 *
 * - The goal is 10 of 10 at every width, 320 included. The accepted value
 *   for 320px used to be 9 of 10; a tap now reaches a group from up to
 *   twelve pixels beside it, which is what the narrow forearms needed.
 * - Each pass is also held to its own groups: from the front the six that
 *   face the front, from the back the four that face the back, every one.
 * - **A tap never turns the body.** Until block 7B a tap that selected a
 *   group on the far side turned the body to it, and this suite put the
 *   body back to the pass's view after each such hit — four runs of one
 *   build had given four results without that. Nothing is put back any
 *   more: after every tap the angle must be the pass's view, and a single
 *   tap that finds the body turned fails the suite.
 *
 * The grid covers the body and 24px to either side of it. A cell under the
 * buttons at the top of the stage is not body a finger can reach, and is
 * left out. **Two taps in a row are never a double tap** — which would set
 * the view back, and in the pass from the back turn the body to the front.
 * The columns are walked every third one, so two taps usually lie three
 * steps apart; where the cells between them were left out they can lie
 * nearer (at 320 the buttons leave two columns of the top rows, 24px
 * apart), and then the second waits until it is too late to be the second
 * tap of a pair.
 */
/** `STEP=8 WIDTHS=430` for a finer probe of one width. */
const STEP = Number(process.env.STEP ?? 12);
const WIDTHS = (process.env.WIDTHS ?? '393,430,360,320').split(',').map(Number);
const browser = await chromium.launch({ executablePath: CHROMIUM });
const results = {};
/** A second tap this near the one before it waits this long: no double tap (28px, 320 ms). */
const PAIR_PX = 40;
const PAIR_MS = 420;
/** Which way each region faces (`REGION_FACING`), by the names their rows show. */
const FACING = {
  Vorne: ['Brust', 'Rumpf', 'Quadrizeps', 'Bizeps', 'Unterarme', 'Schultern'],
  Hinten: ['Rücken', 'Beinbeuger und Gesäss', 'Trizeps', 'Waden'],
};
for (const [width, height] of [[393, 852], [430, 932], [360, 780], [320, 693]].filter(([w]) => WIDTHS.includes(w))) {
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
  await openGymHub(page);
  await openMuscles(page);
  await page.waitForFunction(() => document.querySelector('.body-stage')?.getAttribute('data-stage') === 'shown', null, { timeout: 30000 });
  await page.waitForTimeout(800);
  let box = await page.locator('.body-viewer canvas').boundingBox();
  const tally = new Map();
  /** The same hits, by the view they were tapped in. */
  const byView = { Vorne: new Map(), Hinten: new Map() };
  let taps = 0;
  let turned = 0;
  let last = null;
  /** A view pill pressed in place — `locator.click()` would scroll the stage first. */
  const press = (view) => page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: view }).evaluate((el) => el.click());
  const current = () => page.evaluate(() => document.querySelector('.muscle-row__button[aria-pressed="true"] .muscle-row__name')?.textContent ?? null);
  const azimuth = async () => Number(await page.locator('.body-viewer').getAttribute('data-azimuth'));
  for (const [view, facing] of [['Vorne', 0], ['Hinten', 180]]) {
    await press(view);
    for (let waited = 0; waited < 12000 && (await azimuth()) !== facing; waited += 100) await page.waitForTimeout(100);
    await page.waitForTimeout(600);
    box = await page.locator('.body-viewer canvas').boundingBox();
    let prev = await current();
    // The body stands on the stage's middle axis and is about 0.36 of the
    // stage's height wide; the grid covers it and 24px to either side.
    const half = box.height * 0.18 + 24;
    const columns = [];
    for (let x = 6; x < box.width; x += STEP) if (Math.abs(x - box.width / 2) <= half) columns.push(x);
    for (let y = 6; y < box.height; y += STEP) {
      // Every third column, three times over: two taps in a row are then
      // three steps apart, unless the cells between them were left out.
      for (let offset = 0; offset < 3; offset += 1) {
        for (let index = offset; index < columns.length; index += 3) {
          const x = columns[index];
          const onCanvas = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.tagName === 'CANVAS', [box.x + x, box.y + y]);
          if (!onCanvas) continue;
          if (last && Math.hypot(x - last.x, y - last.y) < PAIR_PX) {
            const since = Date.now() - last.at;
            if (since < PAIR_MS) await page.waitForTimeout(PAIR_MS - since);
          }
          await page.mouse.click(box.x + x, box.y + y);
          last = { x, y, at: Date.now() };
          taps += 1;
          const after = await page.evaluate(() => ({
            row: document.querySelector('.muscle-row__button[aria-pressed="true"] .muscle-row__name')?.textContent ?? null,
            azimuth: Number(document.querySelector('.body-viewer').getAttribute('data-azimuth')),
          }));
          if (after.row !== prev) {
            const hit = after.row ?? prev;
            tally.set(hit, (tally.get(hit) ?? 0) + 1);
            byView[view].set(hit, (byView[view].get(hit) ?? 0) + 1);
          }
          prev = after.row;
          if (after.azimuth !== facing) turned += 1;
        }
      }
    }
    // And once more after the last tap has had time to do anything at all.
    await page.waitForTimeout(900);
    if ((await azimuth()) !== facing) turned += 1;
  }
  const line = (hits) => [...hits.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
  results[width] = {
    reachable: tally.size,
    canvas: `${Math.round(box.width)}×${Math.round(box.height)}`,
    cells: line(tally),
    taps,
    turned,
    missing: Object.fromEntries(Object.entries(FACING).map(([view, names]) => [view, names.filter((name) => !byView[view].has(name))])),
    views: Object.fromEntries(Object.entries(byView).map(([view, hits]) => [view, `${hits.size} · ${line(hits)}`])),
  };
  console.log(`--- ${width}px, stage ${results[width].canvas}, ${STEP}px grid, ${taps} taps: ${tally.size}/10 · ${results[width].cells}`);
  for (const [view, text] of Object.entries(results[width].views)) console.log(`    ${view}: ${text}`);
  await ctx.close();
}
await browser.close();
for (const width of WIDTHS) {
  const result = results[width];
  if (!result) continue;
  check(`${width}: every region is reachable by a tap on the body — 10 of 10`, result.reachable === 10, `${result.reachable}/10 — ${result.cells}`);
  check(`${width}: from the front every group that faces the front, from the back every group that faces the back`,
    result.missing.Vorne.length === 0 && result.missing.Hinten.length === 0,
    `front misses ${result.missing.Vorne.join(', ') || 'none'} · back misses ${result.missing.Hinten.join(', ') || 'none'}`);
  check(`${width}: no tap turned the body`, result.turned === 0, `${result.taps} taps, ${result.turned} met a body that had turned`);
}
process.exit(summary() ? 0 : 1);
