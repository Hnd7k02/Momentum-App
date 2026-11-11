#!/usr/bin/env node
/**
 * Stills of a body GLB through preview.html — a tool, not part of the app.
 *
 *   npx vite --port 5173 &
 *   node tools/body/render.mjs <glb under the repo> <out.png> [json of preview.html's hash]
 *
 * Chromium comes from the image, as in scripts/verify (lib.mjs names it once).
 */
import { chromium } from 'playwright-core';

const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const BASE = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5173/Momentum-App/';
const [glb, out, extra = '{}'] = process.argv.slice(2);
if (!glb || !out) {
  console.error('usage: node tools/body/render.mjs <glb> <out.png> [json]');
  process.exit(2);
}
const options = { glb: `${BASE}${glb}`, ...JSON.parse(extra) };
const views = options.views ?? [{ yaw: 0 }];
const width = (options.w ?? 400) * views.length;
const height = options.h ?? 780;

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.error('page:', m.text()); });
page.on('pageerror', (e) => console.error('page error:', String(e)));
await page.goto(`${BASE}tools/body/preview.html#${encodeURIComponent(JSON.stringify(options))}`);
await page.waitForFunction('window.__done === true', null, { timeout: 120000 });
await page.locator('canvas').screenshot({ path: out, omitBackground: !options.bg });
console.log(out, JSON.stringify(await page.evaluate(() => window.__info)));
await browser.close();
