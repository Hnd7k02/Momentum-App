import { chromium } from 'playwright-core';
import { CHROMIUM } from '../scripts/verify/lib.mjs';
import { writeFileSync } from 'node:fs';

/**
 * The Gym hub's body preview, rendered from the approved model.
 *
 * `src/features/gym/assets/body-preview.webp` is a still of
 * `public/models/momentum-body.glb`, drawn once through the real
 * `BodyViewer` in its neutral tint on the dev harness (`#/dev/body`) with a
 * transparent background, turned a little towards three-quarter, cropped to
 * the figure and encoded as WebP in the browser. It is presentation only —
 * a picture of the destination — and it is regenerated from here whenever
 * the model changes, never drawn by hand:
 *
 *   npx vite --port 5173 &
 *   node tools/render-body-preview.mjs
 *
 * Arguments: [out-path-without-extension] [azimuth°] [width px] [quality].
 * A `.png` twin is written beside the WebP for inspection; do not commit it.
 */
const OUT = process.argv[2] ?? 'src/features/gym/assets/body-preview';
const AZIMUTH = Number(process.argv[3] ?? 25);
const TARGET_WIDTH = Number(process.argv[4] ?? 240);
const QUALITY = Number(process.argv[5] ?? 0.8);

const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 3, reducedMotion: 'reduce' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('pageerror', e));
await page.goto('http://127.0.0.1:5173/Momentum-App/#/dev/body', { waitUntil: 'networkidle' });
await page.waitForSelector('.body-viewer canvas', { timeout: 30000 });
await page.waitForTimeout(2500);
await page.click('[data-action="toggle-tint"]');
await page.waitForTimeout(500);

// Rotate by dragging: 0.55° per px, reduced motion → no coast.
if (AZIMUTH !== 0) {
  const box = await page.locator('.body-viewer canvas').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const px = -AZIMUTH / 0.55;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(cx + (px * i) / 10, cy);
  await page.mouse.up();
  await page.waitForTimeout(800);
}
console.log('angle readout', await page.locator('[data-angle]').textContent(), await page.locator('[data-view-readout]').textContent());

await page.evaluate(() => {
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
  document.querySelector('[data-host]').style.background = 'transparent';
  document.querySelector('.body-viewer__views').style.visibility = 'hidden';
});
await page.waitForTimeout(600);
const canvas = page.locator('.body-viewer canvas');
const raw = await canvas.screenshot({ omitBackground: true, type: 'png' });
console.log('raw png bytes', raw.length);

const result = await page.evaluate(async ({ b64, targetWidth, quality }) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 8) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  const pad = Math.round((maxX - minX) * 0.04);
  minX = Math.max(0, minX - pad); maxX = Math.min(w - 1, maxX + pad);
  minY = Math.max(0, minY - pad); maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const scale = targetWidth / cw;
  const out = document.createElement('canvas');
  out.width = Math.round(cw * scale); out.height = Math.round(ch * scale);
  const og = out.getContext('2d');
  og.imageSmoothingQuality = 'high';
  og.drawImage(c, minX, minY, cw, ch, 0, 0, out.width, out.height);
  return { webp: out.toDataURL('image/webp', quality), png: out.toDataURL('image/png'), bbox: { minX, minY, cw, ch }, size: { w: out.width, h: out.height } };
}, { b64: raw.toString('base64'), targetWidth: TARGET_WIDTH, quality: QUALITY });

const webp = Buffer.from(result.webp.split(',')[1], 'base64');
const png = Buffer.from(result.png.split(',')[1], 'base64');
writeFileSync(`${OUT}.webp`, webp);
writeFileSync(`${OUT}.png`, png);
console.log(JSON.stringify({ bbox: result.bbox, size: result.size, webpBytes: webp.length, pngBytes: png.length }));
await browser.close();
