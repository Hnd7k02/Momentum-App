import { chromium } from 'playwright-core';
import { check, summary } from './lib.mjs';

/**
 * The 3D body viewer, Stage 2, in isolation.
 *
 * Runs against the DEV server (`npx vite --port 5173`), because the harness
 * page `#/dev/body` exists only there — and because the dev server is where
 * React StrictMode double-invokes effects, which is the lifecycle this suite
 * is meant to prove clean. What it proves: one canvas, one WebGL context, the
 * three shortcuts and free rotation with the angle as the state, raycast
 * selection of every region, selection reaching the material, mount →
 * unmount → mount leaving exactly one live viewer, an idle demand loop
 * requesting no frames, the DPR cap, host-sized framing at 320/393/430 with
 * no clipping, reduced motion, localisation and the load-failure fallback.
 */

const URL_DEV = process.env.BODY_URL ?? 'http://127.0.0.1:5173/Momentum-App/#/dev/body';
const OUT = process.env.BODY_SHOTS ?? '';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

/**
 * Instrumentation, installed before any script runs: how many WebGL
 * contexts were created and lost, how many pointer listeners are live on
 * canvases, and how many animation frames were requested since the last
 * reset. None of it changes behaviour.
 */
const INSTRUMENT = () => {
  const w = window;
  w.__probe = { contexts: 0, lost: 0, listeners: 0, raf: 0 };
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = getContext.call(this, type, ...rest);
    // Only canvases in the document: the viewer's capability probe uses a
    // detached one and releases it itself.
    if (ctx && /webgl/.test(String(type)) && !this.__counted && this.isConnected) {
      this.__counted = true;
      w.__probe.contexts += 1;
      this.addEventListener('webglcontextlost', () => { w.__probe.lost += 1; });
    }
    return ctx;
  };
  const add = HTMLCanvasElement.prototype.addEventListener;
  const remove = HTMLCanvasElement.prototype.removeEventListener;
  HTMLCanvasElement.prototype.addEventListener = function (type, ...rest) {
    if (/^pointer/.test(type)) w.__probe.listeners += 1;
    return add.call(this, type, ...rest);
  };
  HTMLCanvasElement.prototype.removeEventListener = function (type, ...rest) {
    if (/^pointer/.test(type)) w.__probe.listeners -= 1;
    return remove.call(this, type, ...rest);
  };
  // Frames that actually FIRE. R3F requests the next frame at the top of its
  // loop and cancels it once it finds nothing to do, so counting requests
  // would blame the loop for a frame that never ran.
  const raf = w.requestAnimationFrame.bind(w);
  w.requestAnimationFrame = (cb) => raf((t) => { w.__probe.raf += 1; cb(t); });
};

async function open(width, { reducedMotion = 'no-preference', url = URL_DEV } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height: 852 }, deviceScaleFactor: 3, hasTouch: true, reducedMotion,
  });
  await ctx.addInitScript(INSTRUMENT);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  return { ctx, page };
}

const probe = (page) => page.evaluate(() => ({ ...window.__probe }));
const resetRaf = (page) => page.evaluate(() => { window.__probe.raf = 0; });
const angle = async (page) => Number(await page.locator('[data-angle]').textContent());
const azimuthAttr = async (page) => Number(await page.locator('.body-viewer').getAttribute('data-azimuth'));
const readout = async (page, sel) => (await page.locator(sel).textContent())?.trim();
const canvasBox = (page) => page.locator('.body-viewer canvas').boundingBox();
/**
 * Waits until the reported angle has stopped changing. Under software
 * rendering a preset animation can take a couple of seconds, so a fixed wait
 * would read a mid-animation angle.
 *
 * The angle alone is not enough: it is a whole number, and the end of an
 * inertia coast (×0.93 a frame) can take longer than the quiet window to
 * cross the next half degree when frames are slow, so a coasting camera
 * read as settled. The loop only renders while something moves, so the
 * camera is at rest when no frame has fired for the window either.
 */
async function settle(page, quietMs = 1500, timeout = 20000) {
  const start = Date.now();
  const state = async () => `${await page.locator('[data-angle]').textContent()}|${(await probe(page)).raf}`;
  let last = await state();
  let quietSince = Date.now();
  while (Date.now() - start < timeout) {
    await page.waitForTimeout(100);
    const now = await state();
    if (now !== last) { last = now; quietSince = Date.now(); }
    else if (Date.now() - quietSince >= quietMs) return;
  }
}

/** Waits until the model is in and picks: a tap on the chest selects it. */
async function waitForModel(page, { timeout = 15000 } = {}) {
  const box = await canvasBox(page);
  const start = Date.now();
  while (Date.now() - start < timeout) {
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3);
    await page.waitForTimeout(150);
    if ((await readout(page, '[data-selected-readout]')) !== '–') return true;
    await page.waitForTimeout(350);
  }
  return false;
}

async function tapAt(page, fx, fy) {
  const box = await canvasBox(page);
  await page.getByRole('button', { name: 'clear selection' }).click();
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(120);
  const hit = await readout(page, '[data-selected-readout]');
  return hit === '–' ? null : hit;
}

async function drag(page, px, { steps = 12 } = {}) {
  const box = await canvasBox(page);
  const y = box.y + box.height * 0.5;
  const x0 = box.x + box.width * (px > 0 ? 0.2 : 0.8);
  await page.mouse.move(x0, y);
  await page.mouse.down();
  await page.mouse.move(x0 + px, y, { steps });
  await page.mouse.up();
}

/** Mean colour of a canvas screenshot region, from a PNG buffer via the page. */
async function sampleRows(page, rows, columns = [0, 1]) {
  // Draw the composited screenshot into a 2D canvas inside the page and read
  // the rows back; the WebGL canvas itself has no preserved buffer to read.
  const shot = await page.locator('.body-viewer canvas').screenshot({ type: 'png' });
  return page.evaluate(async ({ png, rows, columns }) => {
    const blob = new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bitmap.width; c.height = bitmap.height;
    const g = c.getContext('2d');
    g.drawImage(bitmap, 0, 0);
    const out = {};
    for (const [name, [y0, y1]] of Object.entries(rows)) {
      const top = Math.round(y0 * bitmap.height), bottom = Math.max(top + 1, Math.round(y1 * bitmap.height));
      const left = Math.round(columns[0] * bitmap.width), right = Math.max(left + 1, Math.round(columns[1] * bitmap.width));
      const d = g.getImageData(left, top, right - left, bottom - top).data;
      let dark = 0, r = 0, gsum = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) dark += 1;
        r += d[i]; gsum += d[i + 1]; b += d[i + 2];
      }
      const n = d.length / 4;
      out[name] = dark / n;
      out[name + 'Rgb'] = [r / n, gsum / n, b / n];
    }
    return { width: bitmap.width, height: bitmap.height, ...out };
  }, { png: shot.toString('base64'), rows, columns });
}

async function shot(page, name) {
  if (!OUT) return;
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
}

/* ── 393: mount, shortcuts, rotation, selection, lifecycle ─────────────── */
{
  const { ctx, page } = await open(393);
  await page.waitForTimeout(800);
  check('the harness renders the viewer with exactly one canvas', (await page.locator('.body-viewer canvas').count()) === 1);
  const loaded = await waitForModel(page);
  check('the model loads and the first tap on the chest selects it', loaded && (await readout(page, '[data-selected-readout]')) === 'chest', await readout(page, '[data-selected-readout]'));
  let p = await probe(page);
  check('StrictMode\'s double mount leaves one canvas and one live WebGL context', (await page.locator('canvas').count()) === 1 && p.contexts - p.lost === 1, JSON.stringify(p));
  check('and exactly one set of pointer handlers (down, move, up, cancel)', p.listeners === 4, String(p.listeners));

  const box = await canvasBox(page);
  const dpr = await page.locator('.body-viewer canvas').evaluate((c) => c.width / c.clientWidth);
  check('the effective pixel ratio is capped at 2 on a 3× screen', Math.abs(dpr - 2) < 0.05, String(dpr));
  check('the viewer is as wide as its host and not viewport-tall', Math.abs(box.width - (await page.locator('[data-host]').boundingBox()).width) < 1 && box.height < 500 && box.height > 300, `${box.width}×${box.height}`);
  check('the document does not scroll sideways', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  const fov = await page.evaluate(() => Number(document.querySelector('.body-viewer').getAttribute('data-azimuth')));
  check('the viewer boots facing front at azimuth 0', fov === 0 && (await readout(page, '[data-view-readout]')) === 'front');
  await shot(page, 'body-393-front');

  // Shortcuts, in both directions, each landing on its exact azimuth.
  const pills = page.getByRole('group', { name: 'Ansicht' });
  check('the view group and its pills are localised (de)', (await pills.getByRole('button').allTextContents()).join('|') === 'Vorne|Seite|Hinten');
  await pills.getByRole('button', { name: 'Seite' }).click();
  await settle(page);
  check('Seite animates to 90° and the pill reflects the angle', (await angle(page)) === 90 && (await azimuthAttr(page)) === 90 && (await pills.getByRole('button', { name: 'Seite' }).getAttribute('aria-pressed')) === 'true', String(await angle(page)));
  await shot(page, 'body-393-side');
  await pills.getByRole('button', { name: 'Hinten' }).click();
  await settle(page);
  check('Hinten animates to 180°', (await angle(page)) === 180 && (await readout(page, '[data-view-readout]')) === 'back', String(await angle(page)));
  await shot(page, 'body-393-back');
  await pills.getByRole('button', { name: 'Vorne' }).click();
  await settle(page);
  check('Vorne returns to 0° the short way', (await angle(page)) === 0, String(await angle(page)));

  // Free rotation: the angle is the state, the pills only report it.
  await drag(page, 40);
  await settle(page);
  const dragged = await angle(page);
  check('a 40px drag rotates the body freely (22° plus inertia) and the angle is reported', dragged > 22 && dragged < 70, String(dragged));
  check('the pill lights from the angle, not from a press', (await readout(page, '[data-view-readout]')) === 'side' && (await pills.getByRole('button', { name: 'Seite' }).getAttribute('aria-pressed')) === 'true');
  await page.locator('[data-muscle="shoulders"]').click();
  await settle(page);
  check('a list selection under 70° away does not move the camera', (await angle(page)) === dragged, `${dragged} → ${await angle(page)}`);
  await page.locator('[data-muscle="back"]').click();
  await settle(page);
  check('a list selection facing away rotates the body to it', (await angle(page)) === 180, String(await angle(page)));
  await page.locator('[data-muscle="chest"]').click();
  await settle(page);
  check('and back again for a front-facing group', (await angle(page)) === 0, String(await angle(page)));

  // Selection through the material: the chest's pixels change when it is selected.
  await page.getByRole('button', { name: 'clear selection' }).click();
  await settle(page); await page.waitForTimeout(600);
  const before = await sampleRows(page, { chest: [0.27, 0.32] }, [0.42, 0.58]);
  await page.locator('[data-muscle="chest"]').click();
  await settle(page); await page.waitForTimeout(600);
  const after = await sampleRows(page, { chest: [0.27, 0.32] }, [0.42, 0.58]);
  const shift = Math.hypot(...before.chestRgb.map((v, i) => v - after.chestRgb[i]));
  check('selecting a region changes the colour drawn there', shift > 6, `Δrgb ${shift.toFixed(1)} (${before.chestRgb.map(Math.round)} → ${after.chestRgb.map(Math.round)})`);
  check('the selected state reaches the row semantics', (await page.locator('[data-muscle="chest"]').getAttribute('aria-pressed')) === 'true');
  await shot(page, 'body-393-selected');

  // Every region can be hit by a raycast, front and back.
  //
  // A selected group facing more than 70° away is turned into view
  // (BodyViewer.tsx), and a tap selects as a list press does: the trapezius
  // seen from the front is `back`, and tapping it turns the body round. So
  // after a hit on the far side the body is put back to the pass's view
  // before the next tap — otherwise the rest of the "front" pass taps a body
  // facing away, and the chest is reached or not depending on timing.
  const FACES_BACK = new Set(['back', 'hamstringsGlutes', 'triceps', 'calves']); // REGION_FACING 180
  const hits = new Set();
  const grid = [];
  for (const fy of [0.13, 0.2, 0.27, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82, 0.9]) for (const fx of [0.3, 0.34, 0.37, 0.4, 0.44, 0.5, 0.56, 0.6, 0.63, 0.66, 0.7]) grid.push([fx, fy]);
  for (const [view, facing] of [['Vorne', 0], ['Hinten', 180]]) {
    await pills.getByRole('button', { name: view }).click();
    await settle(page);
    for (const [fx, fy] of grid) {
      const h = await tapAt(page, fx, fy);
      if (!h) continue;
      hits.add(h);
      for (let tries = 0; FACES_BACK.has(h) !== (facing === 180) && tries < 3; tries += 1) {
        await pills.getByRole('button', { name: view }).click();
        await settle(page);
        if ((await azimuthAttr(page)) === facing) break;
      }
    }
  }
  check('all ten regions are reachable by a tap, front and back', hits.size === 10, [...hits].sort().join(','));
  check('a tap that hits nothing leaves the selection alone', (await tapAt(page, 0.05, 0.05)) === null && (await (async () => { await page.locator('[data-muscle="calves"]').click(); const b = await canvasBox(page); await page.mouse.click(b.x + 4, b.y + 4); await page.waitForTimeout(120); return readout(page, '[data-selected-readout]'); })()) === 'calves');

  // Idle: a demand loop runs no frame once everything has settled.
  await settle(page);
  await page.waitForTimeout(1500);
  await resetRaf(page);
  await page.waitForTimeout(1000);
  p = await probe(page);
  check('the idle viewer runs zero animation frames in a second', p.raf === 0, String(p.raf));

  // Lifecycle: mount → unmount → mount.
  await page.getByRole('button', { name: 'unmount', exact: true }).click();
  await page.waitForTimeout(900);
  p = await probe(page);
  check('unmount removes the canvas, releases the WebGL context and every pointer handler', (await page.locator('canvas').count()) === 0 && p.contexts - p.lost === 0 && p.listeners === 0, JSON.stringify(p));
  await page.getByRole('button', { name: 'mount', exact: true }).click();
  await page.waitForTimeout(800);
  const again = await waitForModel(page);
  p = await probe(page);
  check('mount again gives exactly one canvas, one context, one handler set — and a working viewer', again && (await page.locator('canvas').count()) === 1 && p.contexts - p.lost === 1 && p.listeners === 4, JSON.stringify(p));
  await page.getByRole('button', { name: 'remount' }).click();
  await page.waitForTimeout(800);
  await waitForModel(page);
  p = await probe(page);
  check('a keyed remount is just as clean', (await page.locator('canvas').count()) === 1 && p.contexts - p.lost === 1 && p.listeners === 4, JSON.stringify(p));
  await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: 'Seite' }).click();
  await settle(page);
  check('and still rotates', (await angle(page)) === 90, String(await angle(page)));
  await ctx.close();
}

/* ── 430 and 320: framing without clipping ─────────────────────────────── */
for (const width of [430, 320]) {
  const { ctx, page } = await open(width);
  await page.waitForTimeout(800);
  await waitForModel(page);
  await page.getByRole('button', { name: 'clear selection' }).click();
  const box = await canvasBox(page);
  const host = await page.locator('[data-host]').boundingBox();
  check(`${width}: the viewer fills its host and the page does not scroll sideways`, Math.abs(box.width - host.width) < 1 && (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), `${box.width}/${host.width}`);
  const pills = page.getByRole('group', { name: 'Ansicht' });
  const pillBox = await pills.boundingBox();
  check(`${width}: the view pills sit inside the viewer`, pillBox.x >= box.x && pillBox.x + pillBox.width <= box.x + box.width + 0.5);
  const results = {};
  for (const view of ['Vorne', 'Seite', 'Hinten']) {
    await pills.getByRole('button', { name: view }).click();
    await settle(page);
    const s = await sampleRows(page, { top: [0, 0.02], bottom: [0.98, 1], middle: [0.45, 0.55] });
    results[view] = s;
    await shot(page, `body-${width}-${view.toLowerCase()}`);
  }
  check(`${width}: the body is drawn and neither head nor feet touch the frame at front, side or back`,
    Object.values(results).every((s) => s.middle > 0.05 && s.top === 0 && s.bottom === 0),
    Object.entries(results).map(([v, s]) => `${v}: top ${s.top.toFixed(3)} mid ${s.middle.toFixed(3)} bottom ${s.bottom.toFixed(3)}`).join(' | '));
  await ctx.close();
}

/* ── Reduced motion: no coast, presets settle at once, arbitrary angles ─── */
{
  const { ctx, page } = await open(393, { reducedMotion: 'reduce' });
  await page.waitForTimeout(800);
  await waitForModel(page);
  await page.getByRole('button', { name: 'clear selection' }).click();
  await drag(page, 100);
  await page.waitForTimeout(400);
  const a1 = await angle(page);
  await page.waitForTimeout(600);
  check('reduced motion: a 100px drag lands on exactly 55° and does not coast', a1 === 55 && (await angle(page)) === 55, `${a1} → ${await angle(page)}`);
  await drag(page, -100);
  await drag(page, 418, { steps: 20 });
  await page.waitForTimeout(400);
  const arbitrary = await angle(page);
  check('an arbitrary angle (230°) is held as the state', Math.abs(arbitrary - 230) <= 1, String(arbitrary));
  const s = await sampleRows(page, { top: [0, 0.02], bottom: [0.98, 1], middle: [0.45, 0.55], left: [0, 1] });
  check('at 230° the body is drawn and nothing touches the top or bottom edge', s.middle > 0.05 && s.top === 0 && s.bottom === 0, `top ${s.top} mid ${s.middle} bottom ${s.bottom}`);
  await shot(page, 'body-393-230');
  const pills = page.getByRole('group', { name: 'Ansicht' });
  await pills.getByRole('button', { name: 'Seite' }).click();
  await page.waitForTimeout(120);
  check('reduced motion: a shortcut settles at once', (await angle(page)) === 90, String(await angle(page)));
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3);
  await page.waitForTimeout(150);
  check('reduced motion: taps still select', (await readout(page, '[data-selected-readout]')) !== '–', await readout(page, '[data-selected-readout]'));
  await ctx.close();
}

/* ── English, and the fallback when the model cannot be fetched ────────── */
{
  const { ctx, page } = await open(393, { url: `${URL_DEV.replace('#', '?lang=en#')}` });
  await page.waitForTimeout(800);
  const pills = page.getByRole('group', { name: 'View' });
  check('the view group and its pills are localised (en)', (await pills.getByRole('button').allTextContents()).join('|') === 'Front|Side|Back');
  await ctx.close();
}
{
  const { ctx, page } = await open(393, { url: `${URL_DEV.replace('#', '?model=missing#')}` });
  await page.waitForTimeout(2500);
  check('a model that fails to load shows the fallback instead of a blank canvas', (await page.locator('[data-fallback]').count()) === 1 && (await page.locator('canvas').count()) === 0);
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
