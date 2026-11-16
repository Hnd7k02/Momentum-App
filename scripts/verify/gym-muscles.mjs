import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, summary, onboard, openMuscles, seed, seedTraining, seedMuscles, fingerTurn } from './lib.mjs';

/**
 * The Muskelgruppen module in the real Gym workspace.
 *
 * The body, the ten analytics rows and their mini charts, sharing one
 * selection; the chunk that arrives only for Gym; the flat figure that takes
 * over when WebGL or the model is missing; and what the module does when
 * nobody is looking at it.
 *
 * And the stage of block 7B (contract §8, §11, §14): the body without a
 * card at 55 % of the screen with only the header, the range and the
 * metrics strip above it; a tap that never turns it; its still standing in
 * the same place while it loads; a sheet that stands only over a body that
 * is still, and under which no frame arises; a lost graphics context that
 * ends with the body or the flat figure, never with an empty field; and
 * the measuring display, off until its user switches it on.
 *
 * Run against the production preview (`vite preview --port 4173`).
 */

const OUT = process.env.SHOTS ?? '';
const browser = await chromium.launch({ executablePath: CHROMIUM });

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
  // What is drawn: every draw call to a canvas that is in the document.
  w.__probe.draws = 0;
  if (w.WebGL2RenderingContext) {
    const draw = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      if (this.canvas && this.canvas.isConnected) w.__probe.draws += 1;
      return draw.apply(this, args);
    };
  }
};

async function open(width, { reducedMotion = 'no-preference', init = null, height = 852, serviceWorkers = 'allow' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, hasTouch: true, reducedMotion, serviceWorkers });
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

/**
 * Where the body stands in its stage, read off the drawn picture: the first
 * and the last row and column of the stage that carry it, in CSS pixels of
 * the stage. The body is lighter than the stage's dark ground, so a pixel
 * counts when it is clearly lighter than the ground — which leaves out the
 * faint glow under the feet. `selector` is what is pictured: the canvas, or
 * the stage with the still in it.
 */
async function edgesOf(page, selector) {
  const target = page.locator(selector).first();
  const box = await target.boundingBox();
  const png = await target.screenshot({ type: 'png' });
  return page.evaluate(async ({ png, cssHeight }) => {
    const blob = new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bitmap.width; c.height = bitmap.height;
    const g = c.getContext('2d');
    g.drawImage(bitmap, 0, 0);
    const scale = bitmap.height / cssHeight;
    // Below the row of buttons, which are lighter than the ground as well.
    const from = Math.round(40 * scale);
    const d = g.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let top = -1, bottom = -1, left = bitmap.width, right = -1;
    for (let y = from; y < bitmap.height; y += 1) {
      let hits = 0;
      for (let x = 0; x < bitmap.width; x += 1) {
        const i = (y * bitmap.width + x) * 4;
        if (d[i] + d[i + 1] + d[i + 2] > 270) { hits += 1; if (x < left) left = x; if (x > right) right = x; }
      }
      if (hits > 2 * scale) { if (top < 0) top = y; bottom = y; }
    }
    return { top: top / scale, bottom: bottom / scale, left: left / scale, right: right / scale };
  }, { png: png.toString('base64'), cssHeight: box.height });
}
const bodyEdges = (page) => edgesOf(page, '.body-viewer canvas');
const stageEdges = (page) => edgesOf(page, '.body-stage');

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
  check('one with too little to compare says that instead', (await text('Waden'))?.includes('Zu wenig Vergleichsdaten') && !/%/.test(await text('Waden')), await text('Waden'));
  // The colour rules (contract §7), on all ten rows: the state follows the
  // printed figure, and a group that prints none shows a chip and no line.
  const shownRows = await page.locator('.muscle-row').evaluateAll((els) => els.map((row) => {
    const right = row.querySelector('.muscle-row__right');
    return {
      name: row.querySelector('.muscle-row__name')?.textContent.trim(),
      state: [...(right?.classList ?? [])].find((c) => c.startsWith('muscle-row__right--'))?.slice('muscle-row__right--'.length) ?? null,
      delta: row.querySelector('.muscle-row__delta')?.textContent ?? null,
      word: row.querySelector('.muscle-row__state')?.textContent.trim() ?? null,
      badge: row.querySelector('.muscle-row__badge')?.textContent.trim() ?? null,
      marks: row.querySelectorAll('.muscle-row__chart polyline, .muscle-row__chart circle').length,
      sub: row.querySelector('.muscle-row__sub')?.textContent.trim() ?? null,
      days: row.querySelector('.muscle-row__days')?.textContent.trim() ?? null,
    };
  }));
  const shownOf = (delta) => { const m = /^([+\u2212]?)(\d+)\u00a0%$/.exec(delta ?? ''); return m ? (m[1] === '\u2212' ? -Number(m[2]) : Number(m[2])) : Number.NaN; };
  const wordOf = { improved: 'Verbessert', unchanged: 'Gehalten', declined: 'Zurückgegangen', awaitingBaseline: 'Zu wenig Vergleichsdaten', noData: 'Noch nicht trainiert' };
  const offRule = shownRows.filter((row) => {
    if (row.delta === null) return !((row.state === 'awaitingBaseline' || row.state === 'noData') && row.badge === wordOf[row.state] && row.marks === 0);
    const shown = shownOf(row.delta);
    // The band is one-sided since STOP Kurve (D180): a rise from +2 %, a fall from −3 %.
    const want = shown >= 2 ? 'improved' : shown <= -3 ? 'declined' : 'unchanged';
    return !(Number.isInteger(shown) && row.state === want && row.word === wordOf[want] && row.badge === null);
  });
  check('in each of the ten rows the state fits the printed figure: −2 to +1 held, otherwise the direction', shownRows.length === 10 && offRule.length === 0, JSON.stringify(offRule));
  // seedMuscles: the biceps have two exercise days (hammer curls), the calves one.
  const fewDays = shownRows.filter((row) => row.name === 'Bizeps' || row.name === 'Waden');
  check('a group with fewer than three exercise days shows the chip and no line, and says how many it has',
    fewDays.length === 2 && fewDays.every((row) => row.state === 'awaitingBaseline' && row.badge === 'Zu wenig Vergleichsdaten' && row.delta === null && row.marks === 0)
      && /^2\sÜbungstage$/.test(fewDays.find((row) => row.name === 'Bizeps')?.days ?? '') && /^1\sÜbungstag$/.test(fewDays.find((row) => row.name === 'Waden')?.days ?? '')
      && shownRows.filter((row) => row.days !== null).length === 2,
    JSON.stringify(fewDays));
  check('a measured group shows its percentage, signed', /[+\u2212]?\d+\s%/.test(await text('Brust')), await text('Brust'));
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
  // A tap never turns the body (block 7B, contract §8). The trapezius is
  // seen from the front and belongs to the back, whose row would turn the
  // body round: a tap on it selects the back and leaves the angle alone.
  {
    await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: 'Vorne' }).click();
    await settle(page);
    let onBack = null;
    for (const [fx, fy] of [[0.44, 0.235], [0.56, 0.235], [0.43, 0.245], [0.57, 0.245], [0.45, 0.225], [0.55, 0.225], [0.42, 0.25], [0.58, 0.25]]) {
      await page.waitForTimeout(400);
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      await page.waitForTimeout(500);
      if ((await selectedRow(page)) === 'Rücken') { onBack = [fx, fy]; break; }
    }
    check('from the front a tap on the trapezius selects the back', onBack !== null, String(onBack));
    await settle(page);
    check('and the body does not turn for it: the angle stays 0', (await page.locator('.body-viewer').getAttribute('data-azimuth')) === '0', await page.locator('.body-viewer').getAttribute('data-azimuth'));
    // The same group chosen in the list does turn the body.
    await rowOf(page, 'Rücken').locator('button').click();
    await page.waitForTimeout(400);
    await rowOf(page, 'Rücken').locator('button').click();
    await showModule(page);
    check('the same group chosen in its row turns the body to it', Math.abs((await waitForAzimuth(page, 180)) - 180) <= 3);
    await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: 'Vorne' }).click();
    await settle(page);
    await page.mouse.click(box.x + box.width * spot[0], box.y + box.height * spot[1]);
    await page.waitForTimeout(600);
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
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
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
  check('the credits sheet names the source, the licence and what was made of it',
    /MakeHuman/.test(credit) && /CC0 1\.0/.test(credit) && /geformt/.test(credit), credit.slice(0, 120));
  check('and no longer names the model it replaced', !/patmateee|CC BY/.test(credit), credit.slice(0, 120));
  const links = await sheet.locator('a').evaluateAll((els) => els.map((a) => [a.getAttribute('href'), a.target, a.rel]));
  check('and links to the model and the licence, safely', links.length === 2 && links.every(([href, target, rel]) => /^https?:\/\//.test(href) && target === '_blank' && /noopener/.test(rel)), JSON.stringify(links));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await openMuscles(page, { wait: 3000 });
  check('the licence is nowhere near the body itself', !/CC0|CC BY|MakeHuman/.test((await page.locator('.muscle-module').textContent()) ?? ''));
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
  // Scrolling the page is not the body's business. Until the end of block
  // 7B the renderer measured the canvas again after every scroll, for an
  // event system the viewer does not use, and drew a frame for its new
  // place: one frame every time the page came to rest.
  await page.evaluate(() => { window.__probe.raf = 0; window.__probe.draws = 0; });
  for (const top of [40, 90, 0]) {
    await page.evaluate((y) => { document.querySelector('.areas__scroll').scrollTop = y; }, top);
    await page.waitForTimeout(400);
  }
  const scrolled = await probe(page);
  check('scrolling the page with the body in view draws no frame of it', scrolled.raf === 0 && scrolled.draws === 0, `${scrolled.raf} frames, ${scrolled.draws} draw calls`);

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
  // The frame in flight when the tab was hidden may still land; after that
  // nothing does. (Until block 7B this read "fewer than a quarter of the
  // frames of a watched second" — with one animation frame a drawn frame,
  // where there were two, a quarter of a slow second is two frames, and the
  // check is now the stricter one: none.)
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__probe.raf = 0; window.__probe.draws = 0; });
  await page.waitForTimeout(1000);
  const hiddenFrames = (await probe(page)).raf;
  check('a rotation in a hidden tab stops running frames',
    hiddenFrames === 0 && visibleFrames > 2 && (await probe(page)).draws === 0, `${hiddenFrames} hidden vs ${visibleFrames} watched`);
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
  await page.waitForTimeout(600);
  await page.evaluate(() => { window.__probe.raf = 0; window.__probe.draws = 0; });
  await page.waitForTimeout(1000);
  const awayFrames = (await probe(page)).raf;
  const stuckAt = await page.locator('.body-viewer').getAttribute('data-azimuth');
  check('a body scrolled out of view stops running frames', awayFrames === 0 && (await probe(page)).draws === 0, `${awayFrames} away vs ${visibleFrames} watched`);
  await showModule(page);
  const back = await waitForAzimuth(page, 0);
  check('and scrolling back finishes what it was doing', Math.abs(((back + 180) % 360) - 180) <= 3, `stopped at ${stuckAt}, finished at ${back}`);

  // Leaving Gym and coming back.
  let p = await probe(page);
  check('one canvas, one live context and one set of pointer handlers', (await page.locator('canvas').count()) === 1 && p.contexts - p.lost === 1 && p.listeners === 4, JSON.stringify(p));
  // The area switch is on the hub, one step back from the module.
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
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

/* ── The stage (block 7B, contract §8) ─────────────────────────────────── */
for (const [width, height] of [[320, 693], [360, 780], [393, 852], [430, 932]]) {
  const { ctx, page } = await open(width, { height });
  await toGym(page);
  const stage = await page.evaluate(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
    const stageEl = document.querySelector('.body-stage');
    const scroll = document.querySelector('.areas__scroll');
    // Everything that stands above the stage, inside the screen.
    const above = [...document.querySelectorAll('.screen > header, .areas__scroll > *, .areas__scroll > * > *')]
      .filter((el) => el !== stageEl && !el.contains(stageEl) && !stageEl.contains(el) && el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().bottom <= stageEl.getBoundingClientRect().top + 1)
      .map((el) => el.className.toString().split(' ')[0] || el.tagName);
    let framed = false;
    for (let el = stageEl; el && el !== scroll; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (el.classList.contains('card') || el.hasAttribute('data-card') || style.borderRadius !== '0px' && el !== stageEl || /blur/.test(style.backdropFilter || style.webkitBackdropFilter || '')) framed = true;
    }
    const title = document.querySelector('.gym-muscles__title');
    const strip = document.querySelector('.muscle-strip');
    const cells = [...document.querySelectorAll('.muscle-strip__cell')].map((cell) => ({
      width: cell.getBoundingClientRect().width,
      label: cell.querySelector('.muscle-strip__label')?.textContent.trim(),
      value: cell.querySelector('.muscle-strip__value')?.textContent.trim(),
      sub: cell.querySelector('.muscle-strip__sub')?.textContent.trim(),
      cut: [...cell.querySelectorAll('span')].some((el) => el.scrollWidth > el.clientWidth + 1),
      sizes: ['label', 'value', 'sub'].map((part) => getComputedStyle(cell.querySelector(`.muscle-strip__${part}`)).fontSize),
    }));
    return {
      stage: box(stageEl), viewport: [window.innerWidth, window.innerHeight], above, framed,
      title: { size: getComputedStyle(title).fontSize, text: title.textContent.trim() },
      strip: box(strip), cells,
      canvas: box(document.querySelector('.body-viewer canvas')),
      views: box(document.querySelector('.body-viewer__views')), reset: box(document.querySelector('.body-viewer__reset')),
      viewTargets: [...document.querySelectorAll('.body-viewer__view')].map((el) => { const r = el.getBoundingClientRect(); const before = getComputedStyle(el, '::before'); return r.height - 2 * parseFloat(before.top); }),
    };
  });
  const share = stage.stage.height / stage.viewport[1];
  check(`${width}: the body's stage takes 55 % of the screen's height`, share >= 0.5499, `${Math.round(stage.stage.height)}px of ${stage.viewport[1]}px, ${(share * 100).toFixed(1)} %`);
  check(`${width}: it runs from edge to edge and the canvas fills it`, stage.stage.x === 0 && Math.abs(stage.stage.width - width) < 0.5 && Math.abs(stage.canvas.width - width) < 0.5 && Math.abs(stage.canvas.height - stage.stage.height) < 0.5,
    `${stage.stage.x}, ${stage.stage.width}×${stage.stage.height}, canvas ${stage.canvas.width}×${stage.canvas.height}`);
  check(`${width}: it stands on the ground, without a card and without glass`, stage.framed === false);
  check(`${width}: above it stand the header, the range and the metrics strip, and nothing else`,
    JSON.stringify(stage.above) === JSON.stringify(['screen__header', 'progress__ranges', 'muscle-strip', 'muscle-strip__cell', 'muscle-strip__cell', 'muscle-strip__cell'])
      || JSON.stringify(stage.above) === JSON.stringify(['screen__header', 'progress__ranges', 'segmented', 'muscle-strip', 'muscle-strip__cell', 'muscle-strip__cell', 'muscle-strip__cell']),
    stage.above.join(' | '));
  check(`${width}: the header's title is 17px`, stage.title.size === '17px' && stage.title.text === 'Muskelgruppen', `${stage.title.size} ${stage.title.text}`);
  const [trend, rated, strongest] = stage.cells;
  check(`${width}: the strip has three cells, the first 1.35 times as wide as the others`,
    stage.cells.length === 3 && Math.abs(trend.width / rated.width - 1.35) < 0.02 && Math.abs(rated.width - strongest.width) < 0.6,
    stage.cells.map((cell) => cell.width.toFixed(1)).join(' : '));
  check(`${width}: each cell is a label in 11px, a value in the strip's figure step and a line beneath`,
    stage.cells.every((cell) => JSON.stringify(cell.sizes) === JSON.stringify(['11px', '20px', '11px'])), JSON.stringify(stage.cells.map((cell) => cell.sizes)));
  check(`${width}: nothing in the strip is cut — "Leistungstrend" fits`, stage.cells.every((cell) => !cell.cut) && trend.label === 'Leistungstrend', JSON.stringify(stage.cells.filter((cell) => cell.cut)));
  check(`${width}: the trend with its state, the rated groups of ten, and the group that rose most with its change`,
    /^[+−]?\d+ %$/.test(trend.value) && ['Verbessert', 'Gehalten', 'Zurückgegangen'].includes(trend.sub)
      && /^\d+ \/ 10$/.test(rated.value) && rated.label === 'Gewertet' && rated.sub === 'Gruppen'
      && strongest.label === 'Stärkster' && /^\+\d+ %$/.test(strongest.value) && strongest.sub.length > 0,
    JSON.stringify(stage.cells.map(({ label, value, sub }) => [label, value, sub])));
  // The strip counts nothing: its figures are the rows'.
  const printed = await page.locator('.muscle-row').evaluateAll((rows) => rows.map((row) => ({
    name: row.querySelector('.muscle-row__name')?.textContent.trim(),
    delta: row.querySelector('.muscle-row__delta')?.textContent ?? null,
  })));
  const figures = printed.filter((row) => row.delta !== null);
  const value = (delta) => Number(delta.replace('−', '-').replace('+', '').replace(/ %$/, ''));
  const best = figures.filter((row) => value(row.delta) >= 2).sort((a, b) => value(b.delta) - value(a.delta))[0];
  check(`${width}: "Gewertet" is the number of rows that print a figure`, rated.value === `${figures.length} / 10`, `${rated.value} · ${figures.length} rows`);
  check(`${width}: "Stärkster" is the row with the largest rise`, best !== undefined && strongest.sub === best.name && strongest.value === best.delta, `${strongest.sub} ${strongest.value} · rows: ${best?.name} ${best?.delta}`);
  check(`${width}: the views stand at the top of the stage on the leading side, the reset on the trailing one, each inside it`,
    stage.views.x >= 15 && stage.views.y >= stage.stage.y && stage.reset.x + stage.reset.width <= width && stage.views.x + stage.views.width < stage.reset.x && stage.views.bottom < stage.stage.y + 60,
    `views ${Math.round(stage.views.x)}–${Math.round(stage.views.x + stage.views.width)}, reset from ${Math.round(stage.reset.x)}`);
  check(`${width}: the views and the reset are 44px targets`, stage.viewTargets.every((h) => h >= 44) && stage.reset.width >= 44 && stage.reset.height >= 44, `${stage.viewTargets.join(',')} · ${stage.reset.width}×${stage.reset.height}`);
  check(`${width}: the page does not scroll sideways`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  // Head and feet stay clear of the stage's edge, from the front, the side and the back.
  const edges = {};
  for (const view of ['Vorne', 'Seite', 'Hinten']) {
    await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: view }).click();
    await settle(page);
    edges[view] = await bodyEdges(page);
  }
  check(`${width}: head and feet touch the stage's edge in no view, and the head stands under the row of buttons`,
    Object.values(edges).every((edge) => edge.top >= 40 && edge.bottom <= stage.stage.height - 4),
    Object.entries(edges).map(([view, edge]) => `${view}: head at ${edge.top.toFixed(0)}px, feet at ${edge.bottom.toFixed(0)}px of ${Math.round(stage.stage.height)}px`).join(' | '));
  await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: 'Vorne' }).click();
  await settle(page);
  // The rows are reached with one thumb: a drag that begins up or down on the body scrolls the page.
  check(`${width}: a drag that begins up or down on the body is the page's to scroll`, (await page.locator('.body-viewer canvas').evaluate((c) => getComputedStyle(c).touchAction)) === 'pan-y');
  if (OUT) await page.screenshot({ path: `${OUT}/stage-${width}.png` });
  await ctx.close();
}

/* ── The still, while the body loads (contract §11) ────────────────────── */
{
  // No worker, so the model can be held back on its way.
  const { ctx, page } = await open(393, { serviceWorkers: 'block' });
  let release = () => undefined;
  const heldBack = new Promise((resolve) => { release = resolve; });
  await page.route(/momentum-body\.glb/, async (route) => { await heldBack; await route.continue(); });
  await page.getByRole('button', { name: 'Bereiche' }).click();
  await page.waitForTimeout(600);
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(800);
  await openMuscles(page, { wait: 2500 });
  const loading = await page.evaluate(() => {
    const stage = document.querySelector('.body-stage');
    const still = document.querySelector('.body-stage__still');
    const rect = (el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
    return { state: stage.getAttribute('data-stage'), still: still ? { loaded: still.complete && still.naturalWidth > 0, box: rect(still) } : null, stage: rect(stage), rows: document.querySelectorAll('.muscle-row').length };
  });
  check('while the model is on its way the stage says so and shows the body\'s still', loading.state === 'loading' && loading.still?.loaded === true, JSON.stringify(loading));
  check('the still stands on the stage\'s middle axis at the stage\'s full height', loading.still !== null && Math.abs(loading.still.box[3] - loading.stage[3]) < 0.5 && Math.abs(loading.still.box[0] + loading.still.box[2] / 2 - (loading.stage[0] + loading.stage[2] / 2)) < 0.5,
    JSON.stringify(loading.still?.box));
  check('the rows are there already: the history does not wait for the body', loading.rows === 10, String(loading.rows));
  const stillEdges = await stageEdges(page);
  if (OUT) await page.screenshot({ path: `${OUT}/stage-393-loading.png` });
  release();
  await page.waitForFunction(() => document.querySelector('.body-stage')?.getAttribute('data-stage') === 'shown', null, { timeout: 30000 });
  await settle(page);
  check('once the first picture is drawn the still is gone', (await page.locator('.body-stage__still').count()) === 0);
  const liveEdges = await stageEdges(page);
  check('and nothing jumped: the body stands where its still stood, to within two pixels',
    Math.abs(stillEdges.top - liveEdges.top) <= 2 && Math.abs(stillEdges.bottom - liveEdges.bottom) <= 2 && Math.abs(stillEdges.left - liveEdges.left) <= 2 && Math.abs(stillEdges.right - liveEdges.right) <= 2,
    `still ${JSON.stringify(stillEdges)} · body ${JSON.stringify(liveEdges)}`);
  await ctx.close();
}

/* ── A sheet stands over a still body, and nothing is drawn under it ───── */
{
  const { ctx, page } = await open(393);
  const client = await ctx.newCDPSession(page);
  await toGym(page);
  await settle(page);
  const box = await page.locator('.body-viewer canvas').boundingBox();
  const heldNow = async () => (await page.locator('.body-viewer').getAttribute('data-held')) !== null;
  check('with no sheet open the body is not held', !(await heldNow()));
  // Throw the body, and open the legend while it still turns. 100px in
  // 60 ms are more than the fastest coast there is, 720° a second: 55° under
  // the finger and 201° more over a second and a half. The legend's button
  // is pressed from inside the page the moment the finger has lifted — a
  // click over the wire would arrive when a software renderer has drawn
  // most of the coast.
  const t0 = Date.now() / 1000;
  const y = box.y + box.height * 0.5;
  const x0 = box.x + box.width * 0.3;
  const mouse = (type, x, t, down) => client.send('Input.dispatchMouseEvent', { type, x, y, timestamp: t, button: type === 'mouseMoved' && !down ? 'none' : 'left', buttons: down ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1 });
  await mouse('mousePressed', x0, t0, true);
  for (let i = 1; i <= 6; i += 1) await mouse('mouseMoved', x0 + (100 * i) / 6, t0 + 0.01 * i, true);
  await mouse('mouseReleased', x0 + 100, t0 + 0.065, false);
  await page.evaluate(() => document.querySelector('.gym-muscles__legendButton').click());
  await page.locator('.sheet').waitFor({ timeout: 5000 });
  const stopped = Number(await page.locator('.body-viewer').getAttribute('data-azimuth'));
  check('the legend stands only once the body is held', await heldNow());
  check('and the coast it interrupted ended at once, far short of where it would have run', stopped >= 55 && stopped < 200, `${stopped}° of 256°`);
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__probe.raf = 0; window.__probe.draws = 0; });
  await page.waitForTimeout(1200);
  let under = await probe(page);
  check('under the open sheet no frame arises and nothing is drawn', under.raf === 0 && under.draws === 0, `${under.raf} frames, ${under.draws} draw calls`);
  check('and the body stands where it stopped', Number(await page.locator('.body-viewer').getAttribute('data-azimuth')) === stopped);
  if (OUT) await page.screenshot({ path: `${OUT}/stage-393-legend.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  check('closing the sheet lifts the pause, and the coast does not start again', !(await heldNow()) && Number(await page.locator('.body-viewer').getAttribute('data-azimuth')) === stopped);
  // The sheet that says what the trend is: the strip's first cell.
  await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: 'Hinten' }).click();
  await page.locator('button[data-metric="gym-overall"]').click();
  await page.locator('.sheet').waitFor({ timeout: 8000 });
  check('the trend\'s explanation waits for a travel to finish and then stands over a held body', (await heldNow()) && (await page.locator('.body-viewer').getAttribute('data-azimuth')) === '180', await page.locator('.body-viewer').getAttribute('data-azimuth'));
  const explained = ((await page.locator('.sheet').textContent()) ?? '').replace(/\s+/g, ' ');
  check('what the old tile\'s tap explained is still there', /gehalten/.test(explained) && /Gruppen/.test(explained), explained.slice(0, 140));
  await page.evaluate(() => { window.__probe.raf = 0; window.__probe.draws = 0; });
  await page.waitForTimeout(1000);
  under = await probe(page);
  check('and nothing is drawn under it either', under.raf === 0 && under.draws === 0, `${under.raf} frames, ${under.draws} draw calls`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  check('after it the body answers again', !(await heldNow()));
  await ctx.close();
}

/* ── A lost graphics context (block 7B) ────────────────────────────────── */
{
  const { ctx, page } = await open(393);
  await toGym(page);
  await settle(page);
  const stageState = () => page.locator('.body-stage').getAttribute('data-stage');
  const lose = () => page.evaluate(() => {
    const canvas = document.querySelector('.body-viewer canvas');
    window.__lose = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
    window.__lose.loseContext();
  });
  await lose();
  await page.waitForTimeout(400);
  check('a lost context is not an empty field: the body\'s still stands in', (await stageState()) === 'lost' && (await page.locator('.body-stage__still').count()) === 1, await stageState());
  if (OUT) await page.screenshot({ path: `${OUT}/stage-393-context-lost.png` });
  await page.waitForFunction(() => document.querySelector('.body-stage')?.getAttribute('data-stage') === 'shown', null, { timeout: 30000 }).catch(() => undefined);
  await settle(page);
  let p = await probe(page);
  check('when the context does not come back, a new canvas shows the body again', (await stageState()) === 'shown' && (await page.locator('canvas').count()) === 1 && (await page.locator('.body-stage__still').count()) === 0, `${await stageState()} ${JSON.stringify(p)}`);
  const edges = await stageEdges(page);
  check('and the body is really drawn', edges.bottom - edges.top > 300, JSON.stringify(edges));
  await rowOf(page, 'Brust').locator('button').click();
  await page.waitForTimeout(500);
  check('the selection, the rows and the views still work', (await selectedRow(page)) === 'Brust' && (await page.locator('.body-viewer__view').count()) === 3);
  await ctx.close();
}
{
  // The device gives no context any more: after the loss none can be made.
  const { ctx, page } = await open(393, {
    init: () => {
      const real = HTMLCanvasElement.prototype.getContext;
      window.__noMore = false;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (window.__noMore && /webgl/.test(String(type))) return null;
        return real.call(this, type, ...rest);
      };
    },
  });
  await toGym(page);
  await settle(page);
  await page.evaluate(() => {
    const canvas = document.querySelector('.body-viewer canvas');
    const lose = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
    window.__noMore = true;
    lose.loseContext();
  });
  await page.waitForFunction(() => document.querySelector('.muscle-module__figure svg') !== null, null, { timeout: 30000 }).catch(() => undefined);
  check('where no new context can be made, the flat figure stands in', (await page.locator('.muscle-module__figure svg').count()) > 0 && (await page.locator('canvas').count()) === 0);
  check('with the rows and the strip beside it', (await page.locator('.muscle-row').count()) === 10 && (await page.locator('.muscle-strip').count()) === 1);
  await rowOf(page, 'Brust').locator('button').click();
  await page.waitForTimeout(500);
  check('and it shares the one selection', (await selectedRow(page)) === 'Brust' && (await page.locator('.body-renderer__muscle--selected').count()) > 0);
  if (OUT) await page.screenshot({ path: `${OUT}/stage-393-flat.png` });
  await ctx.close();
}

/* ── The measuring display (block 7B, D181) ────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript(INSTRUMENT);
  const page = await ctx.newPage();
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await onboard(page, { gym: 3, running: 2 });
  await seed(page, { days: 42 });
  await seedMuscles(page, { days: 42 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await toGym(page);
  check('the measuring display is off until its user switches it on', (await page.locator('[data-readout]').count()) === 0 && (await page.evaluate(() => Object.keys(localStorage).length)) === 0);
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await page.waitForTimeout(700);
  const toggle = page.getByRole('switch', { name: 'Messanzeige beim Körper' });
  await toggle.scrollIntoViewIfNeeded();
  const hint = ((await page.locator('.measure-setting').textContent()) ?? '').replace(/\s+/g, ' ');
  check('its switch stands in the settings, in everyday words', (await toggle.getAttribute('aria-checked')) === 'false' && /wie schnell der Körper lädt und wie flüssig er sich dreht/.test(hint) && !/WebGL|Frame|FPS|Render/i.test(hint), hint);
  await toggle.click();
  await page.waitForTimeout(300);
  const stored = await page.evaluate(async () => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const db = await open();
    const all = (store) => new Promise((res, rej) => { const r = db.transaction([store], 'readonly').objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const everything = {};
    for (const store of [...db.objectStoreNames]) everything[store] = await all(store);
    return { local: Object.entries(localStorage), inDatabase: /measure|Messanzeige/i.test(JSON.stringify(everything)) };
  });
  check('the switch lives in the browser\'s local storage, under one key, and nowhere in the app\'s data',
    stored.local.length === 1 && /^momentum\.bodyMeasure:/.test(stored.local[0][0]) && stored.local[0][1] === '1' && stored.inDatabase === false, JSON.stringify(stored));
  // It survives the reload it exists for.
  await page.goto('about:blank');
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await toGym(page, { wait: 1500 });
  await page.locator('[data-readout]').waitFor({ timeout: 20000 });
  await page.waitForFunction(() => /\d\s*ms/.test(document.querySelector('[data-readout] dd')?.textContent ?? ''), null, { timeout: 30000 });
  await settle(page);
  // Turn the body for a while, let go, wait, copy — with a finger that keeps
  // moving whatever the frames do (`fingerTurn`). Until the end of block 7B
  // this was sixty `mouse.move`s, each waiting for the one before: one hop
  // a frame, which the display read as sixty pauses, and said "noch nicht
  // gedreht". It was right; no finger moves like that.
  await fingerTurn(page, { ms: 2500 });
  await settle(page);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Werte kopieren' }).click();
  await page.waitForTimeout(400);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const line = (label) => copied.split('\n').find((l) => l.trim().startsWith(`${label}:`))?.split(': ').slice(1).join(': ') ?? null;
  check('after a reload it is still on, under the body and beside the canvas',
    (await page.locator('[data-readout]').count()) === 1 && (await page.evaluate(() => { const r = document.querySelector('[data-readout]').getBoundingClientRect(); const s = document.querySelector('.body-stage').getBoundingClientRect(); return r.top >= s.bottom - 1; })));
  check('it shows the load: the whole way, code, model and first picture, each in milliseconds and with its source',
    /^[\d']+ ms$/.test(line('Bis zum ersten Bild') ?? '') && /^[\d']+ ms · (aus dem Speicher der App|aus dem Speicher|aus dem Netz|schon geladen)/.test(line('Code') ?? '') && /^[\d']+ ms · (aus dem Speicher der App|aus dem Speicher|aus dem Netz|schon geladen)/.test(line('Modell') ?? '') && /^[\d']+ ms$/.test(line('Erstes Bild') ?? ''),
    [line('Bis zum ersten Bild'), line('Code'), line('Modell'), line('Erstes Bild')].join(' | '));
  check('the turning: mean frames per second, the share under 25 ms, the longest frame',
    /^[\d.]+ im Mittel$/.test(line('Bilder pro Sekunde') ?? '') && /^[\d.]+ %$/.test(line('Bilder unter 25 ms') ?? '') && /^[\d']+ ms$/.test(line('Längstes Bild') ?? '') && Number(line('Gemessene Bilder')) > 5,
    [line('Bilder pro Sekunde'), line('Bilder unter 25 ms'), line('Längstes Bild'), line('Gemessene Bilder')].join(' | '));
  check('the idle second: no frame in it', line('Bilder in der letzten Sekunde') === '0', String(line('Bilder in der letzten Sekunde')));
  // The panel is told when a motion has ended and looks again until a
  // second has passed without a frame: what stands on the screen is the
  // nought as well, not only what a copy reads afresh.
  const shownIdle = () => page.evaluate(() => [...document.querySelectorAll('[data-readout] dt')].find((dt) => /letzten Sekunde/.test(dt.textContent))?.nextElementSibling?.textContent ?? null);
  for (let waited = 0; waited < 4000 && (await shownIdle()) !== '0'; waited += 200) await page.waitForTimeout(200);
  check('and the panel on the screen says the same', (await shownIdle()) === '0', String(await shownIdle()));
  check('what is drawn: twelve draw calls, the triangles, the one texture and its size',
    line('Zeichenaufrufe') === '12' && line('Dreiecke') === "50'488" && line('Texturen') === '1 · 768 × 1024', [line('Zeichenaufrufe'), line('Dreiecke'), line('Texturen')].join(' | '));
  check('the pixel ratio used, the display\'s observed rate, device, system and the visible area',
    line('Pixeldichte') === '2 von 3' && /pro Sekunde, beobachtet$/.test(line('Bildrate des Bildschirms') ?? '') && (line('Gerät') ?? '').length > 3 && line('Sichtbarer Bereich') === '393 × 852 Punkte' && /^393 × 469 Punkte, 55 % der Höhe$/.test(line('Körperbühne') ?? ''),
    [line('Pixeldichte'), line('Bildrate des Bildschirms'), line('Gerät'), line('Sichtbarer Bereich'), line('Körperbühne')].join(' | '));
  check('the targets of the review hold where a headless browser can hold them: twelve draw calls, under 80 000 triangles, one texture no larger than 1024',
    Number(line('Zeichenaufrufe')) <= 12 && Number((line('Dreiecke') ?? '').replace(/'/g, '')) <= 80000 && (line('Texturen') ?? '').startsWith('1 '));
  // It asks for no frame itself: with the display on, an idle body still draws nothing.
  await page.evaluate(() => { window.__probe.raf = 0; window.__probe.draws = 0; });
  await page.waitForTimeout(1500);
  const idle = await probe(page);
  check('switched on, it asks for no frame: the idle body draws nothing', idle.raf === 0 && idle.draws === 0, `${idle.raf} frames, ${idle.draws} draw calls`);
  if (OUT) { await page.locator('[data-readout]').scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/stage-393-readout.png` }); }
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
