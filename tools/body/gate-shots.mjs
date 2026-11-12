#!/usr/bin/env node
/**
 * Stills of a body through the real viewer, on the dev harness.
 *
 *   npx vite --port 5173 &
 *   node tools/body/gate-shots.mjs <out-dir> '<json list of shots>'
 *
 * A shot is { name, model?, key?, world?, fixture?, width?, view?, azimuth?, tint?, pills? }:
 *   model    a path the dev server can reach, e.g. tools/body/out/athletisch-a.glb;
 *            absent is the app's own model
 *   key      another strength of the key light, to try one; absent is the app's
 *   world    'gym' | 'light': the stage of that world, sized as in Muskelgruppen
 *   fixture  mixed | empty | held | edge (BodyDevPage.tsx)
 *   width    the viewport's width in px (393)
 *   view     front | side | back, or azimuth in degrees for anything between
 *   tint     false shows the body without data colours
 *
 * The picture is the stage alone, at two device pixels per px.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { CHROMIUM } from '../../scripts/verify/lib.mjs';

const [outDir, list] = process.argv.slice(2);
if (!outDir || !list) {
  console.error("usage: node tools/body/gate-shots.mjs <out-dir> '<json list of shots>'");
  process.exit(2);
}
const shots = JSON.parse(list);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
for (const shot of shots) {
  const width = shot.width ?? 393;
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error('page error:', error.message));
  const query = new URLSearchParams();
  for (const key of ['model', 'key', 'world', 'fixture']) if (shot[key]) query.set(key, String(shot[key]));
  await page.goto(`http://127.0.0.1:5173/Momentum-App/?${query}#/dev/body`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.body-viewer canvas', { timeout: 60000 });
  await page.waitForTimeout(2200);
  if (shot.tint === false) {
    await page.click('[data-action="toggle-tint"]');
    await page.waitForTimeout(500);
  }
  if (shot.view && shot.view !== 'front') {
    await page.click(`.body-viewer__view >> nth=${['front', 'side', 'back'].indexOf(shot.view)}`);
    await page.waitForTimeout(900);
  }
  if (shot.azimuth) {
    // The rig turns 0.55° for each px of a drag; with reduced motion it does not coast.
    const box = await page.locator('.body-viewer canvas').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const px = -shot.azimuth / 0.55;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let step = 1; step <= 12; step++) await page.mouse.move(cx + (px * step) / 12, cy);
    await page.mouse.up();
    await page.waitForTimeout(900);
  }
  if (shot.pills === false) {
    await page.evaluate(() => { document.querySelector('.body-viewer__views').style.visibility = 'hidden'; });
  }
  await page.waitForTimeout(400);
  const angle = await page.locator('[data-angle]').textContent();
  await page.locator('[data-host]').screenshot({ path: `${outDir}/${shot.name}.png` });
  console.log(`${shot.name}.png  ${width}px  ${angle}°`);
  await context.close();
}
await browser.close();
