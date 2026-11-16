import { chromium } from 'playwright-core';
import { CHROMIUM, check, summary } from './lib.mjs';

/**
 * The 3D body viewer, in isolation.
 *
 * Runs against the DEV server (`npx vite --port 5173`), because the harness
 * page `#/dev/body` exists only there — and because the dev server is where
 * React StrictMode double-invokes effects, which is the lifecycle this suite
 * is meant to prove clean. What it proves: one canvas, one WebGL context, the
 * three shortcuts and free rotation with the angle as the state, selection
 * of every region, selection reaching the material, mount → unmount → mount
 * leaving exactly one live viewer, an idle demand loop requesting no frames,
 * the DPR cap, framing at 320/393/430 with no clipping, reduced motion,
 * localisation and the load-failure fallback.
 *
 * And the rules of block 7B (contract §8, §10, §14):
 *
 * - **A tap never turns the body.** After each tap of the two grid passes
 *   the angle is the pass's view; a selection made in the list turns the
 *   body when the group faces away.
 * - **The motion counts time, not frames.** A flick with a known speed runs
 *   on by the angle the equation gives, and the same flick and the same
 *   travel take the same time and end on the same angle when every second
 *   and every third animation frame is withheld.
 * - **Twelve pixels of tolerance**, measured against the drawn silhouette;
 *   the neutral zone selects nothing, and gives way at its edge.
 * - **Zoom between 1.0 and 1.8** by two fingers, which are never a tap and
 *   never a turn; the page itself is not zoomed. **A double tap and ↺
 *   reset** the view, the zoom and the tilt, and leave the selection.
 * - **The pause**: a coast ends at once, a travel is finished first, held
 *   the viewer draws nothing by itself and exactly one frame for a change.
 * - **A lost context** ends with the body again, never with a blank canvas.
 *
 * A finger's speed is read from the times its events carry, and a browser
 * driven over a wire delivers them late and unevenly. So every gesture
 * whose speed matters is sent with the times written on its events
 * (`Input.dispatchMouseEvent`'s `timestamp`): 40 pixels in 80 ms are then
 * 500 pixels a second on every machine.
 */

const URL_DEV = process.env.BODY_URL ?? 'http://127.0.0.1:5173/Momentum-App/#/dev/body';
const OUT = process.env.BODY_SHOTS ?? '';

const browser = await chromium.launch({
  executablePath: CHROMIUM,
});

/**
 * Instrumentation, installed before any script runs: how many WebGL
 * contexts were created and lost, how many pointer listeners are live on
 * canvases, how many animation frames fired, and how many draw calls went
 * to a canvas in the document. None of it changes behaviour — except
 * `__rafSkip`, which a check sets to withhold animation frames: with 1,
 * every callback waits one frame longer, which halves the rate.
 */
const INSTRUMENT = () => {
  const w = window;
  w.__probe = { contexts: 0, lost: 0, listeners: 0, raf: 0, draws: 0 };
  w.__rafSkip = 0;
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
  w.requestAnimationFrame = (cb) => {
    let wait = w.__rafSkip;
    const fire = (t) => {
      if (wait > 0) { wait -= 1; return raf(fire); }
      w.__probe.raf += 1;
      return cb(t);
    };
    return raf(fire);
  };
  // What is drawn: every draw call to a canvas that is in the document.
  if (w.WebGL2RenderingContext) {
    const draw = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      if (this.canvas && this.canvas.isConnected) w.__probe.draws += 1;
      return draw.apply(this, args);
    };
  }
};

/** Every uncaught error of every page this suite opened. */
const pageErrors = [];

async function open(width, { reducedMotion = 'no-preference', url = URL_DEV, height = 852, deviceScaleFactor = 3 } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor, hasTouch: true, reducedMotion,
  });
  await ctx.addInitScript(INSTRUMENT);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { pageErrors.push(e.message); console.log('  pageerror:', e.message); });
  await page.goto(url, { waitUntil: 'networkidle' });
  const client = await ctx.newCDPSession(page);
  return { ctx, page, client };
}

const probe = (page) => page.evaluate(() => ({ ...window.__probe }));
/** The canvases in the document whose WebGL context is alive. */
const liveContexts = (page) => page.evaluate(() => [...document.querySelectorAll('canvas')].filter((canvas) => {
  const gl = canvas.getContext('webgl2');
  return gl !== null && !gl.isContextLost();
}).length);
const resetRaf = (page) => page.evaluate(() => { window.__probe.raf = 0; window.__probe.draws = 0; });
const angle = async (page) => Number(await page.locator('[data-angle]').textContent());
const azimuthAttr = async (page) => Number(await page.locator('.body-viewer').getAttribute('data-azimuth'));
const zoomAttr = async (page) => Number(await page.locator('.body-viewer').getAttribute('data-zoom'));
const readout = async (page, sel) => (await page.locator(sel).textContent())?.trim();
const selected = (page) => readout(page, '[data-selected-readout]');
const canvasBox = (page) => page.locator('.body-viewer canvas').boundingBox();
const pills = (page) => page.getByRole('group', { name: 'Ansicht' });
const held = async (page) => (await page.locator('.body-viewer').getAttribute('data-held')) !== null;
/**
 * Waits until the reported angle has stopped changing. Under software
 * rendering a frame can take a tenth of a second, so a fixed wait would read
 * a mid-animation angle.
 *
 * The angle alone is not enough: it is a whole number, and the end of a
 * coast can take longer than the quiet window to cross the next half degree.
 * The loop only renders while something moves, so the camera is at rest when
 * no frame has fired for the window either.
 */
async function settle(page, quietMs = 1200, timeout = 20000) {
  const start = Date.now();
  const state = async () => `${await page.locator('[data-angle]').textContent()}|${await zoomAttr(page)}|${(await probe(page)).raf}`;
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
async function waitForModel(page, { timeout = 20000 } = {}) {
  const box = await canvasBox(page);
  const start = Date.now();
  while (Date.now() - start < timeout) {
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.33);
    await page.waitForTimeout(150);
    if ((await selected(page)) !== '–') return true;
    await page.waitForTimeout(350);
  }
  return false;
}

/** A tap at a share of the canvas, after clearing the selection: what it selected, or `null`. */
async function tapAt(page, fx, fy) {
  const box = await canvasBox(page);
  return tapPx(page, box.width * fx, box.height * fy);
}

/** The same at a place in the canvas's own CSS pixels. */
async function tapPx(page, x, y) {
  const box = await canvasBox(page);
  await page.getByRole('button', { name: 'clear selection' }).click();
  // Not a double tap with the tap before it.
  await page.waitForTimeout(360);
  await page.mouse.click(box.x + x, box.y + y);
  await page.waitForTimeout(120);
  const hit = await selected(page);
  return hit === '–' ? null : hit;
}

/** A slow drag: the finger rests before it lifts, so nothing is thrown. */
async function drag(page, px, { steps = 12, dy = 0, at = [null, 0.5] } = {}) {
  const box = await canvasBox(page);
  const y = box.y + box.height * at[1];
  const x0 = box.x + box.width * (at[0] ?? (px > 0 ? 0.2 : 0.8));
  await page.mouse.move(x0, y);
  await page.mouse.down();
  await page.mouse.move(x0 + px, y + dy, { steps });
  await page.waitForTimeout(160);
  await page.mouse.up();
}

/** Seconds since the epoch, for an event's `timestamp`. */
const stamp = () => Date.now() / 1000;

/**
 * A flick with the times written on its events: `px` in `ms`, in steps of
 * equal time, released 5 ms after the last move.
 */
async function flick(page, client, px, { ms = 80, steps = 8, at = [null, 0.5] } = {}) {
  const box = await canvasBox(page);
  const y = box.y + box.height * at[1];
  const x0 = box.x + box.width * (at[0] ?? (px > 0 ? 0.3 : 0.7));
  const t0 = stamp();
  const mouse = (type, x, t, down) => client.send('Input.dispatchMouseEvent', {
    type, x, y, timestamp: t, button: type === 'mouseMoved' && !down ? 'none' : 'left', buttons: down ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1,
  });
  await mouse('mouseMoved', x0, t0 - 0.02, false);
  await mouse('mousePressed', x0, t0, true);
  for (let i = 1; i <= steps; i += 1) await mouse('mouseMoved', x0 + (px * i) / steps, t0 + (ms / 1000) * (i / steps), true);
  await mouse('mouseReleased', x0 + px, t0 + ms / 1000 + 0.005, false);
}

/** Two taps at one place, `gap` ms apart by the times on their events. */
async function doubleTap(page, client, x, y, gap = 150) {
  const box = await canvasBox(page);
  const t0 = stamp();
  for (const [index, t] of [[1, t0], [2, t0 + gap / 1000]]) {
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x + x, y: box.y + y, timestamp: t, button: 'left', buttons: 1, clickCount: index });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x + x, y: box.y + y, timestamp: t + 0.04, button: 'left', buttons: 0, clickCount: index });
  }
}

/**
 * Two fingers on the canvas, spread from `from` to `to` pixels apart around
 * a share of the canvas. `moveBy` shifts their middle on the way; `leave`
 * keeps one finger down and drags it afterwards.
 */
async function pinch(page, client, { at = [0.5, 0.4], from, to, steps = 8, moveBy = 0, thenDrag = 0 }) {
  const box = await canvasBox(page);
  const cx = box.x + box.width * at[0];
  const cy = box.y + box.height * at[1];
  const points = (spread, shift) => [
    { x: cx - spread / 2 + shift, y: cy, id: 0 },
    { x: cx + spread / 2 + shift, y: cy, id: 1 },
  ];
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from, 0) });
  for (let i = 1; i <= steps; i += 1) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(from + ((to - from) * i) / steps, (moveBy * i) / steps) });
  }
  if (thenDrag) {
    // One finger lifts; the other stays and moves on.
    const stay = points(to, moveBy)[1];
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [stay] });
    for (let i = 1; i <= 6; i += 1) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...stay, x: stay.x + (thenDrag * i) / 6 }] });
    }
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/**
 * The drawn picture as numbers: the canvas's screenshot, read back inside
 * the page. `rows` are bands of the canvas by share of its height; for each
 * the share of pixels that are not the page's white and their mean colour.
 */
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

/**
 * The body's silhouette, in the canvas's CSS pixels: for each row asked
 * for, the runs of pixels that are clearly not the page's white — which is
 * the body, and under its feet the ground.
 */
async function silhouette(page, ys) {
  const box = await canvasBox(page);
  const shot = await page.locator('.body-viewer canvas').screenshot({ type: 'png' });
  return page.evaluate(async ({ png, ys, cssHeight }) => {
    const blob = new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bitmap.width; c.height = bitmap.height;
    const g = c.getContext('2d');
    g.drawImage(bitmap, 0, 0);
    const scale = bitmap.height / cssHeight;
    return ys.map((y) => {
      const row = Math.min(bitmap.height - 1, Math.max(0, Math.round(y * scale)));
      const d = g.getImageData(0, row, bitmap.width, 1).data;
      const runs = [];
      let start = -1;
      for (let x = 0; x <= bitmap.width; x += 1) {
        const body = x < bitmap.width && (d[x * 4] < 200 || d[x * 4 + 1] < 200 || d[x * 4 + 2] < 200);
        if (body && start < 0) start = x;
        if (!body && start >= 0) { if (x - start > 2 * scale) runs.push([start / scale, x / scale]); start = -1; }
      }
      return runs;
    });
  }, { png: shot.toString('base64'), ys, cssHeight: box.height });
}

/**
 * Down the arm on the left of the picture, row by row from `yFrom` to
 * `yTo`: the middle of the outermost run of the silhouette and how light
 * the picture is there. The rows end where the arm does.
 */
async function armTones(page, yFrom, yTo, within) {
  const box = await canvasBox(page);
  const shot = await page.locator('.body-viewer canvas').screenshot({ type: 'png' });
  return page.evaluate(async ({ png, yFrom, yTo, within, cssHeight }) => {
    const blob = new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bitmap.width; c.height = bitmap.height;
    const g = c.getContext('2d');
    g.drawImage(bitmap, 0, 0);
    const scale = bitmap.height / cssHeight;
    const out = [];
    for (let y = yFrom; y <= yTo; y += 1) {
      const row = Math.min(bitmap.height - 1, Math.round(y * scale));
      const d = g.getImageData(0, row, Math.round(within * scale), 1).data;
      let start = -1, end = -1;
      for (let x = 0; x < d.length / 4; x += 1) {
        const body = d[x * 4] < 200 || d[x * 4 + 1] < 200 || d[x * 4 + 2] < 200;
        if (body && start < 0) start = x;
        if (!body && start >= 0) { end = x; break; }
      }
      if (start < 0) break;
      if (end < 0) end = d.length / 4;
      if (end - start < 3 * scale) break;
      const mid = Math.round((start + end) / 2);
      out.push({ y, x: mid / scale, light: (d[mid * 4] + d[mid * 4 + 1] + d[mid * 4 + 2]) / 3 });
    }
    return out;
  }, { png: shot.toString('base64'), yFrom, yTo, within, cssHeight: box.height });
}

async function shot(page, name) {
  if (!OUT) return;
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
}

/** Records when the reported angle changes, so a motion's duration can be read off. */
const watchAngle = (page) => page.evaluate(() => {
  window.__turns = [];
  window.__frames = [];
  const viewer = document.querySelector('.body-viewer');
  window.__watch?.disconnect();
  window.__watch = new MutationObserver(() => window.__turns.push([performance.now(), Number(viewer.getAttribute('data-azimuth'))]));
  window.__watch.observe(viewer, { attributes: true, attributeFilter: ['data-azimuth'] });
});

/* ── 393: mount, shortcuts, rotation, selection, lifecycle ─────────────── */
{
  const { ctx, page, client } = await open(393);
  await page.waitForTimeout(800);
  check('the harness renders the viewer with exactly one canvas', (await page.locator('.body-viewer canvas').count()) === 1);
  const loaded = await waitForModel(page);
  check('the model loads and the first tap on the chest selects it', loaded && (await selected(page)) === 'chest', await selected(page));
  check('and the stage says the body is shown', (await readout(page, '[data-stage-readout]')) === 'shown', await readout(page, '[data-stage-readout]'));
  let p = await probe(page);
  check('StrictMode\'s double mount leaves one canvas and one live WebGL context', (await page.locator('canvas').count()) === 1 && p.contexts - p.lost === 1, JSON.stringify(p));
  check('and exactly one set of pointer handlers (down, move, up, cancel)', p.listeners === 4, String(p.listeners));

  const box = await canvasBox(page);
  const dpr = await page.locator('.body-viewer canvas').evaluate((c) => c.width / c.clientWidth);
  check('the effective pixel ratio is capped at 2 on a 3× screen', Math.abs(dpr - 2) < 0.05, String(dpr));
  check('the viewer is as wide as its host and not viewport-tall', Math.abs(box.width - (await page.locator('[data-host]').boundingBox()).width) < 1 && box.height < 500 && box.height > 300, `${box.width}×${box.height}`);
  check('the document does not scroll sideways', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check('the viewer boots facing front at azimuth 0 and zoom 1', (await azimuthAttr(page)) === 0 && (await zoomAttr(page)) === 1 && (await readout(page, '[data-view-readout]')) === 'front');
  await shot(page, 'body-393-front');

  // Shortcuts, in both directions, each landing on its exact azimuth.
  check('the view group and its pills are localised (de)', (await pills(page).getByRole('button').allTextContents()).join('|') === 'Vorne|Seite|Hinten');
  check('and back to the start is a named button', (await page.getByRole('button', { name: 'Ansicht zurücksetzen' }).count()) === 1);
  await pills(page).getByRole('button', { name: 'Seite' }).click();
  await settle(page);
  check('Seite animates to 90° and the pill reflects the angle', (await angle(page)) === 90 && (await azimuthAttr(page)) === 90 && (await pills(page).getByRole('button', { name: 'Seite' }).getAttribute('aria-pressed')) === 'true', String(await angle(page)));
  await shot(page, 'body-393-side');
  await pills(page).getByRole('button', { name: 'Hinten' }).click();
  await settle(page);
  check('Hinten animates to 180°', (await angle(page)) === 180 && (await readout(page, '[data-view-readout]')) === 'back', String(await angle(page)));
  await shot(page, 'body-393-back');
  await pills(page).getByRole('button', { name: 'Vorne' }).click();
  await settle(page);
  check('Vorne returns to 0° the short way', (await angle(page)) === 0, String(await angle(page)));

  // Free rotation: the angle is the state, the pills only report it.
  await drag(page, 40);
  await settle(page);
  const dragged = await angle(page);
  check('a 40px drag that rests before it lifts turns the body 22° and throws nothing', dragged === 22, String(dragged));
  await page.locator('[data-muscle="shoulders"]').click();
  await settle(page);
  check('a list selection under 70° away does not move the camera', (await angle(page)) === dragged, `${dragged} → ${await angle(page)}`);
  await page.getByRole('button', { name: 'clear selection' }).click();
  // 40px in 80 ms are 500px a second: 275° a second, which carry the body
  // 0.28 s × (275 − 3) = 76° further (`motion.ts`).
  await flick(page, client, 40);
  await settle(page);
  const thrown = await angle(page);
  check('a 40px flick turns the body 22° more and runs on by the 76° its speed gives: 120°', Math.abs(thrown - 120) <= 1, String(thrown));
  check('the pill lights from the angle, not from a press', (await readout(page, '[data-view-readout]')) === 'side' && (await pills(page).getByRole('button', { name: 'Seite' }).getAttribute('aria-pressed')) === 'true');
  // At 120° the back is 60° away: within the 70° that are still in view.
  await page.locator('[data-muscle="back"]').click();
  await settle(page);
  check('a list selection 60° away does not move the camera either', (await angle(page)) === thrown, `${thrown} → ${await angle(page)}`);
  await page.getByRole('button', { name: 'clear selection' }).click();
  await pills(page).getByRole('button', { name: 'Vorne' }).click();
  await settle(page);
  await page.locator('[data-muscle="back"]').click();
  await settle(page);
  check('a list selection facing away rotates the body to it', (await angle(page)) === 180, String(await angle(page)));
  await page.locator('[data-muscle="chest"]').click();
  await settle(page);
  check('and back again for a front-facing group', (await angle(page)) === 0, String(await angle(page)));

  // Selection through the material: the chest's pixels change when it is selected.
  await page.getByRole('button', { name: 'clear selection' }).click();
  await settle(page); await page.waitForTimeout(600);
  const before = await sampleRows(page, { chest: [0.30, 0.34] }, [0.42, 0.58]);
  await page.locator('[data-muscle="chest"]').click();
  await settle(page); await page.waitForTimeout(600);
  const after = await sampleRows(page, { chest: [0.30, 0.34] }, [0.42, 0.58]);
  const shift = Math.hypot(...before.chestRgb.map((v, i) => v - after.chestRgb[i]));
  check('selecting a region changes the colour drawn there', shift > 6, `Δrgb ${shift.toFixed(1)} (${before.chestRgb.map(Math.round)} → ${after.chestRgb.map(Math.round)})`);
  check('the selected state reaches the row semantics', (await page.locator('[data-muscle="chest"]').getAttribute('aria-pressed')) === 'true');
  await shot(page, 'body-393-selected');

  // Every region can be hit, front and back — and no tap turns the body.
  //
  // Until block 7B a tap that selected a group on the far side turned the
  // body to it (the trapezius seen from the front is `back`), and this pass
  // put the body back to its view after every such tap. A tap no longer
  // turns the body, so nothing is put back: after each tap the angle must
  // be the pass's view, and that is the check.
  //
  // A grid point under the buttons at the top of the stage is not body a
  // finger can reach; it is left out.
  const hits = new Set();
  const seenFrom = { Vorne: new Set(), Hinten: new Set() };
  const farSide = { Vorne: null, Hinten: null };
  let taps = 0;
  let turned = 0;
  const grid = [];
  for (const fy of [0.15, 0.22, 0.29, 0.36, 0.44, 0.52, 0.6, 0.68, 0.76, 0.84, 0.91]) for (const fx of [0.3, 0.34, 0.37, 0.4, 0.44, 0.5, 0.56, 0.6, 0.63, 0.66, 0.7]) grid.push([fx, fy]);
  const FACES_BACK = new Set(['back', 'hamstringsGlutes', 'triceps', 'calves']); // REGION_FACING 180
  for (const [view, facing] of [['Vorne', 0], ['Hinten', 180]]) {
    await pills(page).getByRole('button', { name: view }).click();
    await settle(page);
    const b = await canvasBox(page);
    for (const [fx, fy] of grid) {
      const onCanvas = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.tagName === 'CANVAS', [b.x + b.width * fx, b.y + b.height * fy]);
      if (!onCanvas) continue;
      const h = await tapAt(page, fx, fy);
      taps += 1;
      if (h) {
        hits.add(h); seenFrom[view].add(h);
        if (FACES_BACK.has(h) !== (facing === 180)) farSide[view] = h;
      }
      if ((await azimuthAttr(page)) !== facing) turned += 1;
    }
    await page.waitForTimeout(700);
    if ((await azimuthAttr(page)) !== facing) turned += 1;
  }
  check('a tap never turns the body: after each tap of both passes the angle is the pass\'s view', taps > 150 && turned === 0, `${taps} taps, ${turned} met a body that had turned`);
  check('also a tap on a group that faces the other way, which until block 7B turned the body round', farSide.Vorne !== null || farSide.Hinten !== null,
    `from the front ${farSide.Vorne ?? 'none'}, from the back ${farSide.Hinten ?? 'none'}`);
  check('all ten regions are reachable by a tap, front and back', hits.size === 10,
    `${[...hits].sort().join(',')} — front: ${[...seenFrom.Vorne].sort().join(',')} · back: ${[...seenFrom.Hinten].sort().join(',')}`);
  check('a tap that hits nothing leaves the selection alone', (await tapAt(page, 0.04, 0.6)) === null && (await (async () => { await page.locator('[data-muscle="calves"]').click(); await settle(page); const b = await canvasBox(page); await page.mouse.click(b.x + 6, b.y + b.height * 0.6); await page.waitForTimeout(120); return selected(page); })()) === 'calves');

  // Idle: a demand loop runs no frame once everything has settled.
  await page.getByRole('button', { name: 'clear selection' }).click();
  await pills(page).getByRole('button', { name: 'Vorne' }).click();
  await settle(page);
  await page.waitForTimeout(1500);
  await resetRaf(page);
  await page.waitForTimeout(1000);
  p = await probe(page);
  check('the idle viewer runs zero animation frames in a second, and draws nothing', p.raf === 0 && p.draws === 0, `${p.raf} frames, ${p.draws} draw calls`);
  // A render of the host with nothing changed is nothing to draw. Found
  // with the measuring display at the end of block 7B: a prop that is a new
  // value on every render — a function written in the element — is a
  // changed prop to the renderer, and a changed prop on anything in the
  // scene draws a frame; and the renderer's root wrote to its store on
  // every render of the canvas. One frame for every render of the screen.
  await resetRaf(page);
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole('button', { name: 'render again', exact: true }).click();
    await page.waitForTimeout(250);
  }
  p = await probe(page);
  check('a render of its host with nothing changed draws no frame', p.raf === 0 && p.draws === 0, `${p.raf} frames, ${p.draws} draw calls after three renders`);

  /* ── What a tap means: twelve pixels, and the neutral zone ──────────── */
  {
    const b = await canvasBox(page);
    // The arm on the left of the picture at the height of the forearm: the
    // row where a tap inside the outermost run of the silhouette is the
    // forearm.
    let row = null;
    for (const fy of [0.5, 0.53, 0.47, 0.56, 0.44]) {
      const [runs] = await silhouette(page, [b.height * fy]);
      if (runs.length < 3) continue;
      const [left, right] = runs[0];
      if ((await tapPx(page, (left + right) / 2, b.height * fy)) === 'forearms') { row = { y: b.height * fy, left, right }; break; }
    }
    check('the forearm\'s outline is found on the drawn picture', row !== null);
    if (row) {
      const width = row.right - row.left;
      check('a tap 9px beside the forearm selects the forearm', (await tapPx(page, row.left - 9, row.y)) === 'forearms', `the forearm is ${width.toFixed(1)}px wide there`);
      check('and one 16px beside it selects nothing', (await tapPx(page, row.left - 16, row.y)) === null);
      // Down the arm: the forearm of this fixture is untrained and dimmed,
      // the hand has the neutral zone's lighter tone. Where the tone of the
      // arm's middle jumps is the wrist — read off the drawn picture.
      const arm = await armTones(page, row.y, b.height * 0.8, b.width * 0.42);
      const base = arm.slice(0, 4).reduce((sum, at) => sum + at.light, 0) / Math.max(1, Math.min(4, arm.length));
      const wrist = arm.find((at) => at.light > base + 22) ?? null;
      const tip = arm[arm.length - 1] ?? null;
      check('the wrist and the hand are found under the forearm', wrist !== null && tip !== null && tip.y - wrist.y > 18,
        wrist && tip ? `wrist at ${wrist.y.toFixed(0)}px, the hand ends at ${tip.y.toFixed(0)}px` : `${arm.length} rows of arm`);
      if (wrist && tip && tip.y - wrist.y > 18) {
        const at = (y) => arm.reduce((best, entry) => (Math.abs(entry.y - y) < Math.abs(best.y - y) ? entry : best), arm[0]);
        const middle = at((wrist.y + tip.y) / 2 + 3);
        check('a tap in the middle of the hand selects nothing', (await tapPx(page, middle.x, middle.y)) === null, `${(middle.y - wrist.y).toFixed(0)}px below the wrist`);
        const near = at(wrist.y + 6);
        check('the neutral zone gives way at its edge: a tap on the hand 6px below the wrist selects the forearm', (await tapPx(page, near.x, near.y)) === 'forearms');
      }
    }
    // The head: the first run of the picture from the top, on the middle axis.
    let crown = null;
    for (let y = 30; y < b.height * 0.3; y += 2) {
      const [runs] = await silhouette(page, [y]);
      const mid = runs.find(([l, r]) => l < b.width / 2 && r > b.width / 2);
      if (mid) { crown = { y, x: (mid[0] + mid[1]) / 2 }; break; }
    }
    check('a tap in the middle of the head selects nothing', crown !== null && (await tapPx(page, crown.x, crown.y + 20)) === null, crown ? `crown at ${crown.y}px` : 'no head found');
  }

  /* ── Zoom: two fingers, 1.0 to 1.8, never a tap and never a turn ────── */
  {
    await page.getByRole('button', { name: 'clear selection' }).click();
    await pills(page).getByRole('button', { name: 'Vorne' }).click();
    await settle(page);
    // A band across the chest, where the fingers will be: how much of it is body.
    const before = await sampleRows(page, { chest: [0.35, 0.37] });
    await pinch(page, client, { at: [0.5, 0.36], from: 60, to: 90 });
    await settle(page);
    check('two fingers spread to one and a half times their distance zoom to 1.5', Math.abs((await zoomAttr(page)) - 1.5) < 0.02, String(await zoomAttr(page)));
    await pinch(page, client, { at: [0.5, 0.36], from: 40, to: 240 });
    await settle(page);
    check('and no spread zooms past 1.8', (await zoomAttr(page)) === 1.8, String(await zoomAttr(page)));
    check('the page itself is not zoomed', (await page.evaluate(() => window.visualViewport?.scale ?? 1)) === 1);
    check('two fingers are never a tap: nothing is selected', (await selected(page)) === '–', await selected(page));
    check('and never a turn: the angle is the one before', (await azimuthAttr(page)) === 0, String(await azimuthAttr(page)));
    const zoomed = await sampleRows(page, { chest: [0.35, 0.37] });
    // What was under the fingers stays under them, 1.8 times as wide.
    check('the picture under the fingers is 1.8 times as large', Math.abs(zoomed.chest / before.chest - 1.8) < 0.15, `the body fills ${before.chest.toFixed(3)} of the chest's row, then ${zoomed.chest.toFixed(3)}: ×${(zoomed.chest / before.chest).toFixed(2)}`);
    await shot(page, 'body-393-zoomed');
    // A chosen group stays in the window: the calves, chosen in the list.
    await page.locator('[data-muscle="calves"]').click();
    await settle(page);
    check('choosing the calves in the list turns the body to them', (await azimuthAttr(page)) === 180, String(await azimuthAttr(page)));
    let calves = false;
    for (const [fx, fy] of grid) {
      if (fy < 0.3) continue;
      const b = await canvasBox(page);
      await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
      await page.waitForTimeout(380);
      // The calves stay selected only where the tap landed on them; another group replaces them.
      if ((await selected(page)) !== 'calves') { await page.locator('[data-muscle="calves"]').click(); await page.waitForTimeout(200); continue; }
      const direct = await silhouette(page, [b.height * fy]);
      if (direct[0].some(([l, r]) => l <= b.width * fx && r >= b.width * fx)) { calves = true; break; }
    }
    check('and the window moves so that the chosen group is in it, at the same zoom', calves && (await zoomAttr(page)) === 1.8, `zoom ${await zoomAttr(page)}`);
    await shot(page, 'body-393-zoomed-calves');
    // One finger of a pinch that stays down does not turn the body.
    const at = await azimuthAttr(page);
    await pinch(page, client, { at: [0.5, 0.5], from: 80, to: 80, thenDrag: 90 });
    await settle(page);
    check('a finger that stays down after a pinch does not turn the body', (await azimuthAttr(page)) === at, `${at} → ${await azimuthAttr(page)}`);
    await pinch(page, client, { at: [0.5, 0.5], from: 240, to: 40 });
    await settle(page);
    check('two fingers closing zoom back out, to 1.0 and no further', (await zoomAttr(page)) === 1, String(await zoomAttr(page)));
  }

  /* ── Reset: the double tap and the button ───────────────────────────── */
  {
    const b = await canvasBox(page);
    await pills(page).getByRole('button', { name: 'Vorne' }).click();
    await settle(page);
    await page.getByRole('button', { name: 'clear selection' }).click();
    const crownOf = async () => {
      for (let y = 20; y < b.height * 0.4; y += 1) {
        const [runs] = await silhouette(page, [y]);
        if (runs.some(([l, r]) => l < b.width / 2 && r > b.width / 2)) return y;
      }
      return null;
    };
    const crown0 = await crownOf();
    // Turn, tilt and zoom.
    await drag(page, 120, { dy: 90 });
    await pinch(page, client, { at: [0.5, 0.4], from: 60, to: 96 });
    await settle(page);
    const moved = { azimuth: await azimuthAttr(page), zoom: await zoomAttr(page), crown: await crownOf() };
    check('turned, tilted and zoomed, the view is somewhere else', moved.azimuth === 66 && moved.zoom > 1.5 && moved.crown !== crown0, JSON.stringify(moved));
    await page.getByRole('button', { name: 'Ansicht zurücksetzen' }).click();
    await settle(page);
    check('the button sets it back: front, zoom 1.0, the tilt of the start', (await azimuthAttr(page)) === 0 && (await zoomAttr(page)) === 1 && Math.abs((await crownOf()) - crown0) <= 1,
      `${await azimuthAttr(page)}°, zoom ${await zoomAttr(page)}, crown ${await crownOf()} (start ${crown0})`);
    // The double tap: its first tap selects like any tap, and the pair resets.
    await drag(page, -150, { dy: -60 });
    await pinch(page, client, { at: [0.5, 0.4], from: 60, to: 90 });
    await settle(page);
    await page.getByRole('button', { name: 'clear selection' }).click();
    await page.waitForTimeout(400);
    const spot = [b.width * 0.5, b.height * 0.36];
    await doubleTap(page, client, spot[0], spot[1]);
    await page.waitForTimeout(150);
    const afterFirst = await selected(page);
    await settle(page);
    check('a double tap sets the view back as well', (await azimuthAttr(page)) === 0 && (await zoomAttr(page)) === 1 && Math.abs((await crownOf()) - crown0) <= 1,
      `${await azimuthAttr(page)}°, zoom ${await zoomAttr(page)}`);
    check('its first tap selects like any tap, and the selection stays', afterFirst !== '–' && (await selected(page)) === afterFirst, `${afterFirst} → ${await selected(page)}`);
    // Two taps that are not a pair are two taps.
    await drag(page, 60);
    await settle(page);
    const off = await azimuthAttr(page);
    await doubleTap(page, client, spot[0], spot[1], 500);
    await settle(page);
    check('two taps half a second apart are two taps, not a reset', (await azimuthAttr(page)) === off && off !== 0, `${off} → ${await azimuthAttr(page)}`);
    await page.getByRole('button', { name: 'Ansicht zurücksetzen' }).click();
    await settle(page);
    await page.getByRole('button', { name: 'clear selection' }).click();
  }

  /* ── The pause ──────────────────────────────────────────────────────── */
  {
    const pause = page.getByRole('button', { name: 'pause', exact: true });
    const resume = page.getByRole('button', { name: 'resume', exact: true });
    // Held at rest: at once, and then nothing is drawn.
    await pause.click();
    await page.waitForTimeout(600);
    check('a viewer at rest is held as soon as its host asks', await held(page));
    await resetRaf(page);
    await page.waitForTimeout(1000);
    p = await probe(page);
    check('held, it runs no frame and draws nothing by itself', p.raf === 0 && p.draws === 0, `${p.raf} frames, ${p.draws} draw calls`);
    // What it shows changes: exactly one frame, and the colour is there in it.
    const beforeHeld = await sampleRows(page, { chest: [0.30, 0.34] }, [0.42, 0.58]);
    await resetRaf(page);
    await page.locator('[data-muscle="chest"]').click();
    await page.waitForTimeout(1200);
    p = await probe(page);
    const afterHeld = await sampleRows(page, { chest: [0.30, 0.34] }, [0.42, 0.58]);
    const heldShift = Math.hypot(...beforeHeld.chestRgb.map((v, i) => v - afterHeld.chestRgb[i]));
    check('a selection made while it is held is drawn in exactly one frame', p.draws === 12 && p.raf === 0, `${p.draws} draw calls (12 are one frame), ${p.raf} animation frames`);
    check('and that one frame shows the whole change, not the start of an easing', heldShift > 6, `Δrgb ${heldShift.toFixed(1)}`);
    // A travel asked for meanwhile waits for the pause to end.
    await page.locator('[data-muscle="back"]').click();
    await page.waitForTimeout(900);
    check('a selection that faces away does not turn a held body', (await azimuthAttr(page)) === 0 && (await held(page)), String(await azimuthAttr(page)));
    await resume.click();
    await settle(page);
    check('the travel begins when the pause has ended', (await azimuthAttr(page)) === 180 && !(await held(page)), String(await azimuthAttr(page)));
    // A coast ends at once.
    await page.getByRole('button', { name: 'clear selection' }).click();
    await pills(page).getByRole('button', { name: 'Vorne' }).click();
    await settle(page);
    // 100px in 60 ms are more than the fastest coast there is, 720° a
    // second: 55° under the finger, then 0.28 s × (720 − 3) = 201° more,
    // over a second and a half. The pause is asked for from inside the page
    // the moment the finger has lifted — a click over the wire would arrive
    // when a software renderer has drawn most of the coast.
    await flick(page, client, 100, { ms: 60, steps: 6 });
    await page.evaluate(() => document.querySelector('[data-action="toggle-pause"]').click());
    await page.waitForTimeout(900);
    const stoppedAt = await azimuthAttr(page);
    check('a coast ends at once when the host asks for the pause', (await held(page)) && stoppedAt >= 55 && stoppedAt < 200, `stopped at ${stoppedAt}° of the 256° the flick would have run`);
    await page.waitForTimeout(600);
    check('and stays where it stopped', (await azimuthAttr(page)) === stoppedAt);
    await resume.click();
    await settle(page);
    check('lifting the pause does not start the coast again', (await azimuthAttr(page)) === stoppedAt, `${stoppedAt} → ${await azimuthAttr(page)}`);
    // A travel in flight is finished first.
    await pills(page).getByRole('button', { name: 'Vorne' }).click();
    await settle(page);
    await page.locator('[data-muscle="back"]').click();
    await page.waitForTimeout(60);
    await pause.click();
    await settle(page);
    check('a travel the host asked for is finished before the pause takes hold', (await azimuthAttr(page)) === 180 && (await held(page)), `${await azimuthAttr(page)}°, held ${await held(page)}`);
    await resume.click();
    await page.getByRole('button', { name: 'clear selection' }).click();
    await pills(page).getByRole('button', { name: 'Vorne' }).click();
    await settle(page);
  }

  /* ── A lost context ─────────────────────────────────────────────────── */
  {
    const lose = () => page.evaluate(() => {
      const canvas = document.querySelector('.body-viewer canvas');
      window.__lose = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
      window.__lose.loseContext();
    });
    // The browser gives the context back: the same canvas draws again.
    // Lost with the body turned away and zoomed: the still that stands in
    // shows it from the front, so the view goes back to the start at once
    // and the body returns where its still stood.
    await pills(page).getByRole('button', { name: 'Hinten' }).click();
    await settle(page);
    await pinch(page, client, { from: 60, to: 140 });
    await settle(page);
    const turned = { azimuth: await azimuthAttr(page), zoom: await zoomAttr(page) };
    await lose();
    await page.waitForTimeout(300);
    check('a lost context is noticed: the stage says so', (await readout(page, '[data-stage-readout]')) === 'lost', await readout(page, '[data-stage-readout]'));
    check('lost while turned and zoomed, the view is back at the start at once — where the still shows the body',
      turned.azimuth === 180 && turned.zoom > 1.2 && (await azimuthAttr(page)) === 0 && (await zoomAttr(page)) === 1
        && (await pills(page).getByRole('button', { name: 'Vorne' }).getAttribute('aria-pressed')) === 'true',
      `${turned.azimuth}° ×${turned.zoom} → ${await azimuthAttr(page)}° ×${await zoomAttr(page)}`);
    // While the still stands in, a finger moves nothing: there is no body
    // to see turning. The handlers are not even there.
    check('while the still stands in, no pointer handler is on the canvas', (await probe(page)).listeners === 0, String((await probe(page)).listeners));
    await drag(page, 80);
    await page.waitForTimeout(300);
    check('and a drag turns nothing', (await azimuthAttr(page)) === 0, `${await azimuthAttr(page)}°`);
    await page.evaluate(() => window.__lose.restoreContext());
    await page.waitForTimeout(2500);
    p = await probe(page);
    const first = p.contexts;
    check('when the browser gives it back, the same canvas shows the body again', (await readout(page, '[data-stage-readout]')) === 'shown' && (await page.locator('canvas').count()) === 1 && (await liveContexts(page)) === 1, `${await readout(page, '[data-stage-readout]')} ${JSON.stringify(p)}`);
    check('from the front, unzoomed, with its handlers back', (await azimuthAttr(page)) === 0 && (await zoomAttr(page)) === 1 && (await probe(page)).listeners === 4, `${await azimuthAttr(page)}° ×${await zoomAttr(page)}, ${(await probe(page)).listeners} handlers`);
    const again = await sampleRows(page, { middle: [0.4, 0.6] });
    check('and the body is really drawn', again.middle > 0.05, String(again.middle));
    check('it still answers a tap', (await tapAt(page, 0.5, 0.36)) === 'chest');
    // The browser does not give it back: a new canvas takes its place.
    await page.getByRole('button', { name: 'clear selection' }).click();
    await lose();
    await page.waitForTimeout(5000);
    p = await probe(page);
    check('when it stays lost, a new canvas takes its place and shows the body', (await readout(page, '[data-stage-readout]')) === 'shown' && (await page.locator('canvas').count()) === 1 && p.contexts === first + 1 && (await liveContexts(page)) === 1, `${await readout(page, '[data-stage-readout]')} ${JSON.stringify(p)}`);
    const replaced = await sampleRows(page, { middle: [0.4, 0.6] });
    check('drawn, and answering a tap', replaced.middle > 0.05 && (await tapAt(page, 0.5, 0.36)) === 'chest', String(replaced.middle));
    check('with one set of pointer handlers, not two', (await probe(page)).listeners === 4, String((await probe(page)).listeners));
    await page.getByRole('button', { name: 'clear selection' }).click();
  }

  // Lifecycle: mount → unmount → mount.
  await page.getByRole('button', { name: 'unmount', exact: true }).click();
  await page.waitForTimeout(900);
  p = await probe(page);
  // Every context this page made has been lost again: the one the viewer
  // had is released with it.
  check('unmount removes the canvas, releases the WebGL context and every pointer handler', (await page.locator('canvas').count()) === 0 && p.lost >= p.contexts && p.listeners === 0, JSON.stringify(p));
  const base = p.contexts;
  await page.getByRole('button', { name: 'mount', exact: true }).click();
  await page.waitForTimeout(800);
  const again = await waitForModel(page);
  p = await probe(page);
  check('mount again gives exactly one canvas, one new context, one handler set — and a working viewer', again && (await page.locator('canvas').count()) === 1 && p.contexts - base === 1 && (await liveContexts(page)) === 1 && p.listeners === 4, JSON.stringify(p));
  await page.getByRole('button', { name: 'remount' }).click();
  await page.waitForTimeout(800);
  await waitForModel(page);
  p = await probe(page);
  check('a keyed remount is just as clean', (await page.locator('canvas').count()) === 1 && (await liveContexts(page)) === 1 && p.listeners === 4, JSON.stringify(p));
  await pills(page).getByRole('button', { name: 'Seite' }).click();
  await settle(page);
  check('and still rotates', (await angle(page)) === 90, String(await angle(page)));
  await ctx.close();
}

/* ── The motion counts time, not frames (contract §10, §14) ────────────── */
{
  // A small canvas at pixel ratio 1: the software renderer then draws a
  // frame within one or two of the display's refreshes, so withholding
  // every second and every third animation frame still leaves each frame
  // under the tenth of a second a single step may count for.
  const { ctx, page, client } = await open(150, { height: 420, deviceScaleFactor: 1 });
  await page.waitForTimeout(800);
  await waitForModel(page);
  await page.getByRole('button', { name: 'clear selection' }).click();
  const runs = [];
  for (const skip of [0, 1, 2]) {
    await pills(page).getByRole('button', { name: 'Vorne' }).click();
    await settle(page, 900);
    await page.evaluate((n) => { window.__rafSkip = n; }, skip);
    // A travel: Vorne → Hinten.
    await watchAngle(page);
    const t0 = await page.evaluate(() => { window.__probe.raf = 0; return performance.now(); });
    await pills(page).getByRole('button', { name: 'Hinten' }).click();
    await settle(page, 900);
    const travel = await page.evaluate((start) => ({ ms: window.__turns[window.__turns.length - 1][0] - start, end: window.__turns[window.__turns.length - 1][1], frames: window.__probe.raf }), t0);
    // A flick with a known speed: 30px in 60 ms, 275° a second, 16.5° + 76.2°.
    await pills(page).getByRole('button', { name: 'Vorne' }).click();
    await settle(page, 900);
    await watchAngle(page);
    const f0 = await page.evaluate(() => { window.__probe.raf = 0; return performance.now(); });
    await flick(page, client, 30, { ms: 60, steps: 6 });
    await settle(page, 900);
    const coast = await page.evaluate((start) => ({ ms: window.__turns[window.__turns.length - 1][0] - start, end: window.__turns[window.__turns.length - 1][1], frames: window.__probe.raf }), f0);
    runs.push({ skip, travel, coast });
    await page.evaluate(() => { window.__rafSkip = 0; });
  }
  const text = runs.map((r) => `every ${r.skip + 1}. frame: travel ${Math.round(r.travel.ms)} ms in ${r.travel.frames} frames → ${r.travel.end}°, coast ${Math.round(r.coast.ms)} ms in ${r.coast.frames} frames → ${r.coast.end}°`).join(' | ');
  const [full, half, third] = runs;
  // The software renderer needs two or three refreshes for a frame even of
  // this small canvas, so one withheld frame is less than half the rate —
  // but each step down draws clearly fewer frames in the same time.
  check('withholding animation frames really lowers the frame rate', half.travel.frames <= full.travel.frames * 0.85 && third.travel.frames <= full.travel.frames * 0.7 && third.travel.frames < half.travel.frames, text);
  check('and no frame of any run was longer than the tenth of a second a step may count for', runs.every((r) => r.travel.ms / r.travel.frames < 100 && r.coast.ms / r.coast.frames < 100), text);
  // The end of a motion is noticed in the frame after it, so two runs may
  // differ by a frame or two of the slower one; 120 ms covers that. The old
  // rule would have differed by the whole duration again.
  check('a travel ends on the same angle and takes the same time at a half and a third of the frame rate',
    runs.every((r) => r.travel.end === 180) && Math.abs(half.travel.ms - full.travel.ms) < 120 && Math.abs(third.travel.ms - full.travel.ms) < 160, text);
  check('a coast ends on the same angle — the 93° its speed gives — and takes the same time',
    runs.every((r) => Math.abs(r.coast.end - 93) <= 1) && Math.abs(half.coast.ms - full.coast.ms) < 120 && Math.abs(third.coast.ms - full.coast.ms) < 160, text);
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
  const pillBox = await pills(page).boundingBox();
  const resetBox = await page.getByRole('button', { name: 'Ansicht zurücksetzen' }).boundingBox();
  check(`${width}: the view pills and the reset sit inside the viewer, and apart`, pillBox.x >= box.x && resetBox.x + resetBox.width <= box.x + box.width + 0.5 && pillBox.x + pillBox.width <= resetBox.x,
    `pills to ${Math.round(pillBox.x + pillBox.width)}, reset from ${Math.round(resetBox.x)}`);
  check(`${width}: the reset is a 44px target`, resetBox.width >= 44 && resetBox.height >= 44, `${resetBox.width}×${resetBox.height}`);
  const results = {};
  for (const view of ['Vorne', 'Seite', 'Hinten']) {
    await pills(page).getByRole('button', { name: view }).click();
    await settle(page);
    // The ground under the feet fades out before the frame's last rows; the
    // band that must be empty is the frame's edge itself, 1 % of it.
    const s = await sampleRows(page, { top: [0, 0.01], bottom: [0.99, 1], middle: [0.45, 0.55] });
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
  const { ctx, page, client } = await open(393, { reducedMotion: 'reduce' });
  await page.waitForTimeout(800);
  await waitForModel(page);
  await page.getByRole('button', { name: 'clear selection' }).click();
  await flick(page, client, 100, { ms: 100, steps: 10 });
  await page.waitForTimeout(400);
  const a1 = await angle(page);
  await page.waitForTimeout(600);
  check('reduced motion: a 100px flick lands on exactly 55° and does not coast', a1 === 55 && (await angle(page)) === 55, `${a1} → ${await angle(page)}`);
  await drag(page, -100);
  await drag(page, 418, { steps: 20 });
  await page.waitForTimeout(400);
  const arbitrary = await angle(page);
  check('an arbitrary angle (230°) is held as the state', Math.abs(arbitrary - 230) <= 1, String(arbitrary));
  const s = await sampleRows(page, { top: [0, 0.01], bottom: [0.99, 1], middle: [0.45, 0.55], left: [0, 1] });
  check('at 230° the body is drawn and nothing touches the top or bottom edge', s.middle > 0.05 && s.top === 0 && s.bottom === 0, `top ${s.top} mid ${s.middle} bottom ${s.bottom}`);
  await shot(page, 'body-393-230');
  await pills(page).getByRole('button', { name: 'Seite' }).click();
  await page.waitForTimeout(150);
  check('reduced motion: a shortcut settles at once', (await angle(page)) === 90, String(await angle(page)));
  await pinch(page, client, { at: [0.5, 0.4], from: 60, to: 96 });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Ansicht zurücksetzen' }).click();
  await page.waitForTimeout(150);
  check('reduced motion: the reset jumps — front and zoom 1.0 at once', (await angle(page)) === 0 && (await zoomAttr(page)) === 1, `${await angle(page)}°, zoom ${await zoomAttr(page)}`);
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.33);
  await page.waitForTimeout(150);
  check('reduced motion: taps still select', (await selected(page)) !== '–', await selected(page));
  await ctx.close();
}

/* ── English, and the fallback when the model cannot be fetched ────────── */
{
  const { ctx, page } = await open(393, { url: `${URL_DEV.replace('#', '?lang=en#')}` });
  await page.waitForTimeout(800);
  const group = page.getByRole('group', { name: 'View' });
  check('the view group and its pills are localised (en)', (await group.getByRole('button').allTextContents()).join('|') === 'Front|Side|Back' && (await page.getByRole('button', { name: 'Reset view' }).count()) === 1);
  await ctx.close();
}
{
  const { ctx, page } = await open(393, { url: `${URL_DEV.replace('#', '?model=missing#')}` });
  await page.waitForTimeout(2500);
  check('a model that fails to load shows the fallback instead of a blank canvas', (await page.locator('[data-fallback]').count()) === 1 && (await page.locator('canvas').count()) === 0);
  await ctx.close();
}

check('no page of this suite threw an error nothing caught', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();
process.exit(summary() ? 0 : 1);
