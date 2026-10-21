/**
 * WP3 Stage 6 — the frame cost of glass over the 3D canvas, measured.
 *
 * The brief asks for the cost to be measured before anything blurs over the
 * body. This drives the body round by pointer drag on Muskelgruppen and
 * records every animation frame's duration under four arrangements:
 *
 *   card-glass     the design as built: the card holding the canvas is
 *                  glass, the view pills over the canvas are solid
 *   no-glass       the same card with its blur switched off (the baseline)
 *   pills-glass    the view pills over the canvas blurred as well
 *   layer-glass    a blurred layer over the lower half of the canvas, the
 *                  shape of a sheet standing over the body (Stage 7)
 *
 * Each arrangement runs twice, interleaved, and the table reports the median
 * and 95th-percentile frame time and the share of frames over 16.7 ms and
 * 33.3 ms.
 *
 * What this can and cannot say: headless Chromium here renders WebGL on
 * SwiftShader, on the CPU, and composites blur on the CPU too. The absolute
 * numbers are nothing like an iPhone's GPU; the *relative* cost of adding a
 * blur layer over a repainting canvas is what this measures, and a layer
 * that is free here is not proven free on the phone — only one that is
 * expensive here is proven worth avoiding. The iPhone confirms the rest.
 *
 *   node scripts/verify/stage6-blur-cost.mjs            (preview on 4173)
 */
import { chromium } from 'playwright-core';
import { URL_APP, phone, onboard, seedMuscles, openMuscles } from './lib.mjs';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ ...phone, viewport: { width: 393, height: 852 } });
const page = await ctx.newPage();
await page.goto(URL_APP, { waitUntil: 'networkidle' });
await onboard(page, { gym: 3, running: 0 });
await seedMuscles(page);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
await page.waitForTimeout(600);
await page.getByRole('radio', { name: 'Gym' }).click();
await page.waitForTimeout(1200);
await openMuscles(page, { wait: 6000 });
await page.locator('.body-viewer canvas').waitFor({ timeout: 20000 });
await page.waitForTimeout(1500);

const ARRANGEMENTS = {
  'card-glass': '',
  'no-glass': '.card { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }',
  'pills-glass':
    '.body-viewer__views { background: rgba(255,255,255,0.08) !important; backdrop-filter: saturate(160%) blur(18px); -webkit-backdrop-filter: saturate(160%) blur(18px); }',
  'layer-glass':
    '.body-viewer::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 50%; pointer-events: none; background: rgba(255,255,255,0.07); backdrop-filter: saturate(160%) blur(18px); -webkit-backdrop-filter: saturate(160%) blur(18px); }',
};

async function arrange(css) {
  await page.evaluate((text) => {
    let style = document.getElementById('blur-cost');
    if (!style) {
      style = document.createElement('style');
      style.id = 'blur-cost';
      document.head.appendChild(style);
    }
    style.textContent = text;
  }, css);
  await page.waitForTimeout(400);
}

/** Frame durations while the body is dragged round for `ms`. */
async function frames(ms) {
  const box = await page.locator('.body-viewer canvas').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height * 0.45;
  const collecting = page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const deltas = [];
        let last = performance.now();
        const start = last;
        const tick = (now) => {
          deltas.push(now - last);
          last = now;
          if (now - start < duration) requestAnimationFrame(tick);
          else resolve(deltas.slice(1));
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await page.mouse.move(cx - 90, cy);
    await page.mouse.down();
    for (let i = 1; i <= 18; i += 1) await page.mouse.move(cx - 90 + i * 10, cy + Math.sin(i / 3) * 4);
    await page.mouse.up();
  }
  return collecting;
}

const stats = (deltas) => {
  const sorted = [...deltas].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return {
    frames: sorted.length,
    median: at(0.5),
    p95: at(0.95),
    over16: deltas.filter((d) => d > 16.7).length / deltas.length,
    over33: deltas.filter((d) => d > 33.4).length / deltas.length,
  };
};

const results = {};
for (let round = 0; round < 2; round += 1) {
  for (const [name, css] of Object.entries(ARRANGEMENTS)) {
    await arrange(css);
    const deltas = await frames(3000);
    (results[name] ??= []).push(...deltas);
  }
}
await arrange('');

const ua = await page.evaluate(() => navigator.userAgent);
const gl = await page.evaluate(() => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  const info = context?.getExtension('WEBGL_debug_renderer_info');
  return info ? context.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log(`renderer: ${gl}`);
console.log(`agent:    ${ua}`);
console.log('');
console.log('arrangement    frames   median    p95    >16.7ms   >33.3ms');
for (const [name, deltas] of Object.entries(results)) {
  const s = stats(deltas);
  console.log(
    `${name.padEnd(14)} ${String(s.frames).padStart(6)} ${s.median.toFixed(1).padStart(8)} ${s.p95.toFixed(1).padStart(7)} ${(s.over16 * 100).toFixed(0).padStart(8)}% ${(s.over33 * 100).toFixed(0).padStart(8)}%`,
  );
}
await browser.close();
