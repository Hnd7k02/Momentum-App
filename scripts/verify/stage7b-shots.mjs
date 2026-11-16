import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, onboard, seed, seedTraining, seedMuscles, openMuscles, openGymHub } from './lib.mjs';

/**
 * Not a suite: the pictures of block 7B (`docs/design/wp3/stage7b/`).
 *
 * Muskelgruppen at 320, 360, 393 and 430: at the top, with a group chosen,
 * with nothing trained, while the body loads, zoomed, with the flat figure
 * standing in, and with the measuring display switched on.
 *
 *   LABEL=nachher OUT=docs/design/wp3/stage7b node scripts/verify/stage7b-shots.mjs
 *   LABEL=vorher URL_APP=http://127.0.0.1:4174/Momentum-App/ … node scripts/verify/stage7b-shots.mjs
 *
 * `LABEL=vorher` pictures a build from before the block — the four states
 * it has: top, chosen, empty, loading. Where both labels exist for a state,
 * `PAIR=1` sets the two side by side as `vergleich-<state>-<width>.png`.
 *
 * Runs against a production preview, alone, like every script that draws
 * the body. It is not part of a run of all suites.
 */
const OUT = process.env.OUT ?? 'docs/design/wp3/stage7b';
const LABEL = process.env.LABEL ?? 'nachher';
const WIDTHS = (process.env.WIDTHS ?? '320,360,393,430').split(',').map(Number);
const HEIGHT = { 320: 693, 360: 780, 393: 852, 430: 932 };
const AFTER = LABEL !== 'vorher';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROMIUM });
const file = (state, width) => `${OUT}/${LABEL}-${state}-${width}.png`;

async function boot(width, { data = true, init = null, serviceWorkers = 'allow' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: HEIGHT[width] }, deviceScaleFactor: 2, hasTouch: true, serviceWorkers });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on('pageerror', (error) => console.log('  pageerror:', error.message));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await onboard(page, { gym: 3, running: 2 });
  if (data) {
    await seed(page, { days: 42 });
    await seedTraining(page, { days: 42 });
    await seedMuscles(page, { days: 42 });
  }
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return { ctx, page };
}

/** Bereiche → Gym → Muskelgruppen: the one way both builds have. */
async function toMuscles(page, { wait = 6000 } = {}) {
  await openGymHub(page);
  await openMuscles(page, { wait });
}

/** Until the body's picture has stopped changing. */
async function still(page) {
  let previous = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const frame = await page.screenshot();
    if (previous !== null && frame.equals(previous)) return;
    previous = frame;
    await page.waitForTimeout(350);
  }
}

for (const width of WIDTHS) {
  // At the top, and with a group chosen by a tap on the body.
  {
    const { ctx, page } = await boot(width);
    await toMuscles(page);
    await still(page);
    await page.screenshot({ path: file('oben', width) });
    const box = await page.locator('.body-viewer canvas').boundingBox();
    // The chest: a third of the way down the body, on its middle axis.
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * (AFTER ? 0.33 : 0.3));
    await page.waitForTimeout(900);
    await still(page);
    await page.screenshot({ path: file('gewaehlt', width) });
    if (AFTER) {
      // Zoomed on the chest, with two fingers.
      const client = await ctx.newCDPSession(page);
      const cx = box.x + box.width * 0.5;
      const cy = box.y + box.height * 0.36;
      const points = (spread) => [{ x: cx - spread / 2, y: cy, id: 0 }, { x: cx + spread / 2, y: cy, id: 1 }];
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(60) });
      for (let i = 1; i <= 8; i += 1) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(60 + i * 10) });
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(600);
      await still(page);
      await page.screenshot({ path: file('gezoomt', width) });
    }
    await ctx.close();
  }
  // Nothing trained yet.
  {
    const { ctx, page } = await boot(width, { data: false });
    await toMuscles(page);
    await still(page);
    await page.screenshot({ path: file('leer', width) });
    await ctx.close();
  }
  // While the body loads: the model is held back on its way.
  {
    const { ctx, page } = await boot(width, { serviceWorkers: 'block' });
    await page.route(/momentum-body\.glb/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 6000));
      await route.continue().catch(() => undefined);
    });
    await openGymHub(page);
    await openMuscles(page, { wait: 2500 });
    await page.screenshot({ path: file('laden', width) });
    await ctx.close();
  }
  if (!AFTER) continue;
  // The flat figure, where no 3D can be drawn.
  {
    const { ctx, page } = await boot(width, {
      init: () => {
        const real = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
          return /webgl/.test(String(type)) ? null : real.call(this, type, ...rest);
        };
      },
    });
    await toMuscles(page, { wait: 3000 });
    await page.screenshot({ path: file('ersatz', width) });
    await ctx.close();
  }
  // The measuring display, switched on in the settings, after a turn.
  {
    const { ctx, page } = await boot(width);
    await page.getByRole('button', { name: 'Bereiche' }).click();
    await page.waitForTimeout(500);
    const toggle = page.getByRole('switch', { name: 'Messanzeige beim Körper' });
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: file('schalter', width) });
    await page.goto('about:blank');
    await page.goto(URL_APP, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await toMuscles(page);
    const box = await page.locator('.body-viewer canvas').boundingBox();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
    await page.mouse.down();
    for (let i = 1; i <= 40; i += 1) await page.mouse.move(box.x + box.width * 0.3 + (i % 20) * 6, box.y + box.height * 0.5);
    await page.mouse.up();
    await page.waitForTimeout(3500);
    await page.locator('[data-readout]').evaluate((el) => {
      const scroll = document.querySelector('.areas__scroll');
      scroll.scrollTop += el.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 8;
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: file('messanzeige', width) });
    await ctx.close();
  }
}

// Before and after, side by side.
if (process.env.PAIR) {
  const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
  for (const width of WIDTHS) {
    for (const state of ['oben', 'gewaehlt', 'leer', 'laden']) {
      const before = `${OUT}/vorher-${state}-${width}.png`;
      const after = `${OUT}/nachher-${state}-${width}.png`;
      if (!existsSync(before) || !existsSync(after)) continue;
      const src = (path) => `data:image/png;base64,${readFileSync(path).toString('base64')}`;
      await page.setViewportSize({ width: width * 2 + 60, height: HEIGHT[width] + 70 });
      await page.setContent(`<body style="margin:0;background:#17171d;color:#f2f2f7;font:600 15px system-ui">
        <div style="display:flex;gap:20px;padding:20px">
          ${[['vorher', before], ['nachher', after]].map(([label, path]) => `<figure style="margin:0"><figcaption style="padding:0 0 8px">${label}</figcaption><img src="${src(path)}" width="${width}" height="${HEIGHT[width]}" style="display:block;border-radius:12px"></figure>`).join('')}
        </div></body>`);
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}/vergleich-${state}-${width}.png` });
    }
  }
}

await browser.close();
