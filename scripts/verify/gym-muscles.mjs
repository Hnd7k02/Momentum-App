import { chromium } from 'playwright-core';
import { URL_APP, check, summary, onboard, openMuscles, seed, seedTraining, seedMuscles } from './lib.mjs';

/**
 * The Muskelgruppen module in the real Gym workspace, Stage 4.
 *
 * The body, the ten analytics rows and their mini charts, sharing one
 * selection; the chunk that arrives only for Gym; the flat figure that takes
 * over when WebGL or the model is missing; and what the module does when
 * nobody is looking at it.
 *
 * Run against the production preview (`vite preview --port 4173`).
 */

const OUT = process.env.SHOTS ?? '';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/** Counts the animation frames that actually ran, not the ones requested. */
const INSTRUMENT = () => {
  const w = window;
  w.__probe = { contexts: 0, lost: 0, listeners: 0, raf: 0 };
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = getContext.call(this, type, ...rest);
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
  const raf = w.requestAnimationFrame.bind(w);
  w.requestAnimationFrame = (cb) => raf((t) => { w.__probe.raf += 1; cb(t); });
};

async function open(width, { reducedMotion = 'no-preference', init = null, height = 852 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, hasTouch: true, reducedMotion });
  await ctx.addInitScript(INSTRUMENT);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const chunks = [];
  page.on('request', (r) => { const u = r.url(); if (/BodyViewer|\.glb/.test(u)) chunks.push(u.split('/').pop()); });
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await onboard(page, { gym: 3, running: 2 });
  await seed(page, { days: 42 });
  await seedTraining(page, { days: 42 });
  await seedMuscles(page, { days: 42 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  return { ctx, page, chunks };
}

async function toGym(page, { wait = 4500 } = {}) {
  await page.getByRole('button', { name: 'Bereiche' }).click();
  await page.waitForTimeout(700);
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(900);
  // Since WP2-2 the Gym area opens on its hub; the module is one tap further.
  await openMuscles(page, { wait });
}

async function showModule(page) {
  await page.locator('.areas__scroll').evaluate((el) => {
    const m = document.querySelector('.muscle-module');
    el.scrollTop += m.getBoundingClientRect().top - el.getBoundingClientRect().top - 8;
  });
  await page.waitForTimeout(1200);
}

const rowOf = (page, name) => page.locator('.muscle-row').filter({ hasText: name }).first();
const selectedRow = (page) =>
  page.evaluate(() => document.querySelector('.muscle-row__button[aria-pressed="true"] .muscle-row__name')?.textContent ?? null);
const probe = (page) => page.evaluate(() => ({ ...window.__probe }));
/** Waits for the body to reach an angle, however long the software renderer takes. */
const waitForAzimuth = async (page, want, timeout = 25000) => {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeout) {
    last = Number(await page.locator('.body-viewer').getAttribute('data-azimuth'));
    if (Math.abs(((last - want + 540) % 360) - 180) <= 3) return last;
    await page.waitForTimeout(150);
  }
  return last;
};

const settle = async (page, quiet = 1200, timeout = 20000) => {
  const start = Date.now();
  let last = null, since = Date.now();
  while (Date.now() - start < timeout) {
    await page.waitForTimeout(120);
    const now = await page.locator('.body-viewer').getAttribute('data-azimuth');
    if (now !== last) { last = now; since = Date.now(); } else if (Date.now() - since >= quiet) return;
  }
};

/* ── 393: composition, rows, charts, selection ─────────────────────────── */
{
  const { ctx, page, chunks } = await open(393);
  check('nothing 3D is fetched while the app is anywhere but Gym', chunks.length === 0, chunks.join(','));
  await page.getByRole('button', { name: 'Bereiche' }).click();
  await page.waitForTimeout(900);
  check('and not on Bereiche → Mind', chunks.length === 0, chunks.join(','));
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(2000);
  check('and not on the Gym hub itself (WP2-2)', chunks.length === 0, chunks.join(','));
  await openMuscles(page);
  check('Muskelgruppen fetches the viewer chunk and the model, and only then',
    chunks.some((c) => /^BodyViewer.*\.js$/.test(c)) && chunks.includes('momentum-body.glb'), chunks.join(','));
  await showModule(page);

  check('the module carries one body and one list', (await page.locator('.body-viewer canvas').count()) === 1 && (await page.locator('.muscle-rows').count()) === 1);
  check('there is no second legend from the flat figure', (await page.locator('.body-renderer__legend').count()) === 0);
  const rows = page.locator('.muscle-row');
  check('all ten groups have a row', (await rows.count()) === 10, String(await rows.count()));
  const names = (await page.locator('.muscle-row__name').allTextContents()).map((s) => s.trim());
  check('in domain order, translated', JSON.stringify(names) === JSON.stringify(['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Rumpf', 'Quadrizeps', 'Beinbeuger und Gesäss', 'Waden', 'Unterarme']), names.join(' | '));

  /* Charts, per data state. The fixture puts one of each on screen. */
  const chartOf = async (name) => rowOf(page, name).locator('.muscle-row__chart').evaluate((el) => ({
    polyline: el.querySelectorAll('polyline').length,
    dots: el.querySelectorAll('circle').length,
    points: el.querySelector('polyline')?.getAttribute('points') ?? null,
  }));
  const chest = await chartOf('Brust');
  check('a measured group draws a line with a dot on the latest point', chest.polyline === 1 && chest.dots === 1, JSON.stringify(chest));
  check('and the line has more than two points to make a shape from', (chest.points?.split(' ').length ?? 0) >= 3, String(chest.points?.split(' ').length));
  const shoulders = await chartOf('Schultern');
  check('a group with no history draws nothing at all', shoulders.polyline === 0 && shoulders.dots === 0, JSON.stringify(shoulders));
  const calves = await chartOf('Waden');
  check('a group still waiting for a baseline draws nothing either', calves.polyline === 0 && calves.dots === 0, JSON.stringify(calves));
  const forearms = await chartOf('Unterarme');
  check('a single observation is one dot and no line', forearms.polyline === 0 && forearms.dots === 1, JSON.stringify(forearms));
  const back = await chartOf('Rücken');
  const flatYs = (back.points ?? '').split(' ').map((p) => p.split(',')[1]);
  check('a series whose points are all equal draws flat down the middle', back.polyline === 1 && flatYs.length > 1 && flatYs.every((y) => y === '12.0'), JSON.stringify(back.points));

  /* Row text: state, delta, recency. */
  const text = async (name) => (await rowOf(page, name).textContent())?.replace(/\s+/g, ' ').trim();
  check('an untrained group says so in words, with no number', (await text('Schultern'))?.includes('Noch nicht trainiert') && !/%/.test(await text('Schultern')), await text('Schultern'));
  check('one waiting for a baseline says that instead', (await text('Waden'))?.includes('Noch kein Vergleich'), await text('Waden'));
  check('a measured group shows its percentage, signed', /[+-]?\d+ %/.test(await text('Brust')), await text('Brust'));
  check('rows say when the group was last trained', /(Heute|Gestern|Vor \d+ Tagen)/.test(await text('Brust')), await text('Brust'));
  check('a group with no number says its state in words instead', /Noch nicht trainiert/.test(await text('Schultern')) && !/%/.test(await text('Schultern')), await text('Schultern'));
  check('no row shows a technical id', !(await page.locator('.muscle-rows').textContent())?.includes('ex_'));
  check('and no row counts its own observations at the user', !/\d+ von \d+ (Beobachtungen|Messungen)/.test(await page.locator('.muscle-rows').textContent() ?? ''));

  /* One selection, both ways. */
  await rowOf(page, 'Brust').locator('button').click();
  await page.waitForTimeout(900);
  check('a row tap selects it', (await selectedRow(page)) === 'Brust');
  check('and the exercises below follow the selected group', (await page.locator('.section__label').allTextContents()).some((s) => s.includes('Übungen · Brust')));
  await rowOf(page, 'Rücken').locator('button').click();
  await showModule(page);
  const facing = await waitForAzimuth(page, 180);
  check('selecting a group that faces away turns the body to it', Math.abs(facing - 180) <= 3, String(facing));
  await rowOf(page, 'Rücken').locator('button').click();
  await page.waitForTimeout(700);
  check('tapping the selected row again clears it, as the list always did', (await selectedRow(page)) === null);

  const box = await page.locator('.body-viewer canvas').boundingBox();
  await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: 'Vorne' }).click();
  await settle(page);
  // Find a point that hits a region, then tap it twice.
  let hit = null, spot = null;
  for (const [fx, fy] of [[0.5, 0.3], [0.5, 0.42], [0.5, 0.55], [0.45, 0.62], [0.5, 0.68]]) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await page.waitForTimeout(500);
    const now = await selectedRow(page);
    if (now) { hit = now; spot = [fx, fy]; break; }
  }
  check('a tap on the body selects the group it landed on, and its row', hit !== null, String(hit));
  if (spot) {
    await page.mouse.click(box.x + box.width * spot[0], box.y + box.height * spot[1]);
    await page.waitForTimeout(700);
    check('a second tap on the same region keeps it selected rather than clearing it', (await selectedRow(page)) === hit, `${hit} → ${await selectedRow(page)}`);
  }
  if (OUT) {
    await showModule(page);
    await page.screenshot({ path: `${OUT}/muscles-393-measured-selected.png` });
  }
  await rowOf(page, 'Schultern').locator('button').click();
  await settle(page);
  check('selecting an untrained group still reads as selected in the list', (await selectedRow(page)) === 'Schultern');
  if (OUT) { await showModule(page); await page.screenshot({ path: `${OUT}/muscles-393-nodata-selected.png` }); }
  await rowOf(page, 'Schultern').locator('button').click();
  await page.waitForTimeout(600);
  if (OUT) { await showModule(page); await page.screenshot({ path: `${OUT}/muscles-393.png` }); }

  /* Laufen moved in — on the Gym hub, beneath the board; Verlauf keeps its row and loses the board. */
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.waitForTimeout(1200);
  check('Laufen sits inside the Gym workspace', (await page.locator('.areas__running').count()) === 1 && (await page.locator('.areas__running').textContent())?.includes('Laufen'));
  check('with its rating board and its weekly target',
    (await page.locator('.areas__running [data-metric="running-rating"]').count()) === 1 &&
    (await page.locator('.areas__running .areas__domainName').allTextContents()).map((s) => s.trim()).includes('Laufen'),
    (await page.locator('.areas__running .areas__domainName').allTextContents()).join(','));
  await page.getByRole('button', { name: 'Verlauf' }).click();
  await page.waitForTimeout(1400);
  const labels = (await page.locator('.heatmap__label').allTextContents()).map((s) => s.trim());
  check('Verlauf keeps the Laufen row in the history grid', labels.includes('Laufen'), labels.join(' | '));
  check('and no longer carries the Running board', (await page.locator('[data-metric="running-rating"]').count()) === 0);

  /* Credits. */
  await page.getByRole('button', { name: 'Bereiche' }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /3D-Körpermodell/ }).click();
  await page.waitForTimeout(700);
  const sheet = page.locator('.sheet');
  const credit = (await sheet.textContent())?.replace(/\s+/g, ' ') ?? '';
  check('the credits sheet names the author, the licence and the modification',
    /patmateee/.test(credit) && /CC BY 4\.0/.test(credit) && /bearbeitet/.test(credit), credit.slice(0, 120));
  const links = await sheet.locator('a').evaluateAll((els) => els.map((a) => [a.getAttribute('href'), a.target, a.rel]));
  check('and links to the model and the licence, safely', links.length === 2 && links.every(([href, target, rel]) => /^https?:\/\//.test(href) && target === '_blank' && /noopener/.test(rel)), JSON.stringify(links));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await openMuscles(page, { wait: 3000 });
  check('the licence is nowhere near the body itself', !(await page.locator('.muscle-module').textContent())?.includes('CC BY'));
  await ctx.close();
}

/* ── Widths ────────────────────────────────────────────────────────────── */
for (const [width, height] of [[430, 932], [320, 693]]) {
  const { ctx, page } = await open(width, { height });
  await toGym(page);
  await showModule(page);
  check(`${width}: the page does not scroll sideways`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  const clipped = await page.locator('.muscle-row__name, .muscle-row__delta, .muscle-row__badge, .muscle-row__sub').evaluateAll((els) =>
    els.filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).map((el) => el.className + ':' + el.textContent));
  check(`${width}: no row text is cut off`, clipped.length === 0, clipped.join(' | '));
  // A row with nothing to plot has no chart box at all; the rest keep their floor.
  const charts = await page.locator('.muscle-row__chart').evaluateAll((els) =>
    els.filter((el) => el.childElementCount > 0).map((el) => Math.round(el.getBoundingClientRect().width)));
  check(`${width}: every chart that exists keeps its floor of 56px`, charts.length >= 6 && charts.every((w) => w >= 56), charts.join(','));
  const drawn = await page.locator('.muscle-row__chart svg polyline, .muscle-row__chart svg circle').count();
  check(`${width}: the charts are actually drawn`, drawn >= 6, String(drawn));
  const tall = await page.locator('.muscle-row__button').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
  check(`${width}: every row clears 44px`, tall.every((h) => h >= 44), tall.join(','));
  // Every row selectable, including the one the body cannot offer at 320.
  const misses = [];
  for (const name of ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Rumpf', 'Quadrizeps', 'Beinbeuger und Gesäss', 'Waden', 'Unterarme']) {
    await rowOf(page, name).locator('button').click();
    await page.waitForTimeout(450);
    if ((await selectedRow(page)) !== name) misses.push(name);
    await rowOf(page, name).locator('button').click();
    await page.waitForTimeout(250);
  }
  check(`${width}: all ten groups can be selected from their row`, misses.length === 0, misses.join(','));
  // Start from a known state: nothing selected, body facing front.
  if ((await selectedRow(page)) !== null) {
    await rowOf(page, await selectedRow(page)).locator('button').click();
    await page.waitForTimeout(400);
  }
  await showModule(page);
  await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: 'Vorne' }).click();
  await waitForAzimuth(page, 0);
  await rowOf(page, 'Trizeps').locator('button').click();
  await page.waitForTimeout(400);
  // The row list is long, so selecting from its foot can scroll the body out
  // of view — where it deliberately stops rendering. Bring it back, then look.
  await showModule(page);
  const reached = await waitForAzimuth(page, 180);
  check(`${width}: selecting the triceps row turns the body to the back`, Math.abs(reached - 180) <= 3, String(reached));
  await rowOf(page, 'Trizeps').locator('button').click();
  await page.waitForTimeout(400);
  if (OUT) {
    await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: 'Vorne' }).click();
    await waitForAzimuth(page, 0);
    await showModule(page);
    await page.screenshot({ path: `${OUT}/muscles-${width}.png` });
  }
  await ctx.close();
}

/* ── No WebGL, a chunk that will not load, reduced motion ──────────────── */
{
  const { ctx, page } = await open(393, {
    init: () => {
      const real = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        return /webgl/.test(String(type)) ? null : real.call(this, type, ...rest);
      };
    },
  });
  await toGym(page, { wait: 3000 });
  await showModule(page);
  check('without WebGL the flat figure takes the body\'s place', (await page.locator('.muscle-module__figure svg').count()) > 0 && (await page.locator('canvas').count()) === 0);
  check('the rows and their charts are still there', (await page.locator('.muscle-row').count()) === 10 && (await page.locator('.muscle-row__chart svg polyline').count()) > 0);
  check('and the flat figure brings no second list with it', (await page.locator('.body-renderer__legend').count()) === 0);
  await rowOf(page, 'Brust').locator('button').click();
  await page.waitForTimeout(600);
  check('the fallback shares the one selection', (await selectedRow(page)) === 'Brust' && (await page.locator('.body-renderer__muscle--selected').count()) > 0);
  check('and the exercises still follow it', (await page.locator('.section__label').allTextContents()).some((s) => s.includes('Übungen · Brust')));
  if (OUT) { await showModule(page); await page.screenshot({ path: `${OUT}/muscles-393-fallback.png` }); }
  await ctx.close();
}
{
  // No worker here: an installed one would answer for the chunk out of its
  // own cache, which is the one case this test is not about.
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await onboard(page, { gym: 3, running: 2 });
  await seed(page, { days: 42 });
  await seedMuscles(page, { days: 42 });
  // The chunk is unreachable from here on: the lazy import rejects. The
  // installed worker would otherwise answer from its cache, which is exactly
  // the case this test is not about.
  await page.route(/BodyViewer-.*\.js/, (route) => route.abort());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  await toGym(page, { wait: 4000 });
  await showModule(page);
  check('a viewer chunk that cannot be fetched degrades to the flat figure', (await page.locator('.muscle-module__figure svg').count()) > 0);
  check('and the rest of the Gym screen keeps working', (await page.locator('.muscle-row').count()) === 10 && (await page.locator('[data-metric="gym-overall"]').count()) === 1);
  await ctx.close();
}
{
  // A renderer that throws on construction: a failure *inside* the viewer,
  // after the chunk arrived, which only an error boundary can catch.
  const { ctx, page } = await open(393, {
    init: () => {
      const real = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (!/webgl/.test(String(type))) return real.call(this, type, ...rest);
        // Passes the capability probe, then fails the moment three touches it.
        return this.isConnected ? { getParameter() { throw new Error('forced failure'); }, getExtension: () => null } : real.call(this, type, ...rest);
      };
    },
  });
  await toGym(page, { wait: 4000 });
  await showModule(page);
  check('a viewer that throws after mounting degrades to the flat figure', (await page.locator('.muscle-module__figure svg').count()) > 0);
  check('and takes nothing else down with it', (await page.locator('.muscle-row').count()) === 10 && (await page.locator('[data-metric="gym-overall"]').count()) === 1);
  await ctx.close();
}
{
  const { ctx, page } = await open(393, { reducedMotion: 'reduce' });
  await toGym(page);
  await showModule(page);
  const box = await page.locator('.body-viewer canvas').boundingBox();
  const start = await page.locator('.body-viewer').getAttribute('data-azimuth');
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25 + 100, box.y + box.height * 0.5, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const landed = await page.locator('.body-viewer').getAttribute('data-azimuth');
  await page.waitForTimeout(700);
  check('reduced motion: a drag lands where the finger left it and does not coast', landed === (await page.locator('.body-viewer').getAttribute('data-azimuth')) && landed !== start, `${start} → ${landed}`);
  await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: 'Hinten' }).click();
  await page.waitForTimeout(200);
  check('reduced motion: a shortcut settles at once', (await page.locator('.body-viewer').getAttribute('data-azimuth')) === '180', await page.locator('.body-viewer').getAttribute('data-azimuth'));
  await rowOf(page, 'Brust').locator('button').click();
  await page.waitForTimeout(300);
  check('reduced motion: selection still works from the rows', (await selectedRow(page)) === 'Brust');
  await ctx.close();
}

/* ── Hidden, off-screen, and leaving and coming back ───────────────────── */
{
  const { ctx, page } = await open(393);
  await toGym(page);
  await showModule(page);
  await settle(page);
  await page.evaluate(() => { window.__probe.raf = 0; });
  await page.waitForTimeout(1000);
  check('an idle body runs no frames at all', (await probe(page)).raf === 0, String((await probe(page)).raf));

  // What a rotation costs while it is being watched, for comparison.
  await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: 'Seite' }).click();
  await page.evaluate(() => { window.__probe.raf = 0; });
  await page.waitForTimeout(1000);
  const visibleFrames = (await probe(page)).raf;
  await waitForAzimuth(page, 90);

  // Hidden: start a rotation, then hide the tab before it finishes.
  await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: 'Hinten' }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.__probe.raf = 0;
  });
  await page.waitForTimeout(1000);
  const hiddenFrames = (await probe(page)).raf;
  check('a rotation in a hidden tab all but stops running frames',
    hiddenFrames < visibleFrames / 4, `${hiddenFrames} hidden vs ${visibleFrames} watched`);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    window.__probe.raf = 0;
  });
  await settle(page);
  check('and coming back finishes it', (await page.locator('.body-viewer').getAttribute('data-azimuth')) === '180', await page.locator('.body-viewer').getAttribute('data-azimuth'));

  // Off-screen: the same again, but scrolled away rather than hidden — and
  // from 180 to 0, so finishing is something the angle can show.
  await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: 'Vorne' }).click();
  await page.locator('.areas__scroll').evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__probe.raf = 0; });
  await page.waitForTimeout(1000);
  const awayFrames = (await probe(page)).raf;
  const stuckAt = await page.locator('.body-viewer').getAttribute('data-azimuth');
  check('a body scrolled out of view all but stops running frames', awayFrames < visibleFrames / 4, `${awayFrames} away vs ${visibleFrames} watched`);
  await showModule(page);
  const back = await waitForAzimuth(page, 0);
  check('and scrolling back finishes what it was doing', Math.abs(((back + 180) % 360) - 180) <= 3, `stopped at ${stuckAt}, finished at ${back}`);

  // Leaving Gym and coming back.
  let p = await probe(page);
  check('one canvas, one live context and one set of pointer handlers', (await page.locator('canvas').count()) === 1 && p.contexts - p.lost === 1 && p.listeners === 4, JSON.stringify(p));
  // The area switch is on the hub, one step back from the module.
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.waitForTimeout(900);
  await page.getByRole('radio', { name: 'Mind' }).click();
  await page.waitForTimeout(1200);
  p = await probe(page);
  check('leaving Gym takes the body down and releases its context and handlers', (await page.locator('canvas').count()) === 0 && p.contexts - p.lost === 0 && p.listeners === 0, JSON.stringify(p));
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(900);
  await openMuscles(page, { wait: 3500 });
  await showModule(page);
  p = await probe(page);
  check('coming back gives exactly one of each again, not two', (await page.locator('canvas').count()) === 1 && p.contexts - p.lost === 1 && p.listeners === 4, JSON.stringify(p));
  await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: 'Seite' }).click();
  await settle(page);
  check('and the body still turns', (await page.locator('.body-viewer').getAttribute('data-azimuth')) === '90', await page.locator('.body-viewer').getAttribute('data-azimuth'));
  await ctx.close();
}

/* ── A session logged late in the evening is today's ───────────────────── */
{
  const { ctx, page } = await open(393);
  await page.evaluate(async () => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (db, s) => new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const put = (db, s, rec) => new Promise((res, rej) => { const tx = db.transaction([s], 'readwrite'); tx.objectStore(s).put(rec); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    const db = await open();
    const snaps = await all(db, 'configSnapshots');
    const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    // 23:29 local, the day it was logged — the moment is late, the day is today.
    const late = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 29).toISOString();
    await put(db, 'gymSessions', { id: `late-${date}`, date, weekKey: 'x', performedAt: late, planId: null, note: null, legacyCarryOver: false, configSnapshotId: snaps[0].id, createdAt: late, updatedAt: late });
    await put(db, 'gymSets', { id: `late-set-${date}`, sessionId: `late-${date}`, exerciseId: 'ex_lateral_raise', date, weightGrams: 12000, reps: 12, order: 0, muscles: ['shoulders'], primaryMuscles: ['shoulders'], loadType: 'external', createdAt: late });
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  await toGym(page);
  await showModule(page);
  const shoulders = (await rowOf(page, 'Schultern').textContent())?.replace(/\s+/g, ' ') ?? '';
  check('a set logged at 23:29 reads as trained today, not yesterday', /Heute/.test(shoulders), shoulders);
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
