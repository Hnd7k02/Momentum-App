import { chromium } from 'playwright-core';
import { URL_APP, check, summary, onboard, openMuscles, seed, seedTraining, seedMuscles } from './lib.mjs';

/**
 * Release evidence for the muscle map, Stage 5: what the network actually
 * carries per route from a cold boot, whether the installed worker keeps Gym
 * working offline, what the mini charts actually draw, and what assistive
 * technology is told. Prints the raw observations, then judges them.
 */
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function fresh({ serviceWorkers = 'allow', init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, serviceWorkers });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const log = [];
  page.on('response', (r) => { const u = r.url(); if (/BodyViewer|\.glb|sw\.js/.test(u)) log.push(`${r.status()} ${u.replace(URL_APP, '/')}`); });
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await onboard(page, { gym: 3, running: 2 });
  await seed(page, { days: 42 });
  await seedTraining(page, { days: 42 });
  await seedMuscles(page, { days: 42 });
  return { ctx, page, log };
}

/* ── 1. Cold boot, no worker: what each route fetches ─────────────────── */
{
  const { ctx, page, log } = await fresh({ serviceWorkers: 'block' });
  // A cold boot: cleared storage of everything but the seeded database.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  log.length = 0;
  const table = [];
  const visit = async (label, act) => { log.length = 0; await act(); await page.waitForTimeout(1500); table.push([label, log.filter((l) => /BodyViewer/.test(l)).join(', ') || 'none', log.filter((l) => /\.glb/.test(l)).join(', ') || 'none']); };
  await visit('Heute (boot)', async () => {});
  await visit('Verlauf', () => page.getByRole('button', { name: 'Verlauf' }).click());
  await visit('Rang', () => page.getByRole('button', { name: 'Rang' }).click());
  await visit('Bereiche → Mind', () => page.getByRole('button', { name: 'Bereiche' }).click());
  await visit('Bereiche → Gym (hub)', async () => { await page.getByRole('radio', { name: 'Gym' }).click(); await page.waitForTimeout(2000); });
  await visit('Gym → Muskelgruppen', async () => { await openMuscles(page, { wait: 3500 }); });
  console.log('\n[network per route, cold boot, no worker]');
  for (const [route, chunk, glb] of table) console.log(`  ${route.padEnd(22)} | ${chunk.padEnd(52)} | ${glb}`);
  const before = table.slice(0, 5);
  check('no route before Muskelgruppen — the Gym hub included — fetches the viewer chunk or the model', before.every(([, c, g]) => c === 'none' && g === 'none'), before.map((r) => r.join(' | ')).join(' ; '));
  const gym = table[5];
  check('Muskelgruppen fetches the viewer chunk, its CSS and the model, each 200', /200 .*BodyViewer-.*\.js/.test(gym[1]) && /200 .*BodyViewer-.*\.css/.test(gym[1]) && /200 .*momentum-body\.glb/.test(gym[2]), `${gym[1]} | ${gym[2]}`);
  await ctx.close();
}

/* ── 2. The worker: install online, then use Gym offline ──────────────── */
{
  const { ctx, page, log } = await fresh();
  await page.reload({ waitUntil: 'networkidle' });
  // Let the worker install and finish precaching before going dark.
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(4000);
  const installed = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = names.find((n) => n.startsWith('momentum-'));
    if (!cache) return { cache: null, entries: [] };
    const keys = await (await caches.open(cache)).keys();
    return { cache, entries: keys.map((k) => new URL(k.url).pathname) };
  });
  console.log('\n[worker precache]', installed.cache, installed.entries.length, 'entries');
  const has = (re) => installed.entries.some((p) => re.test(p));
  check('the worker precached the model, the viewer chunk and its CSS', has(/\/models\/momentum-body\.glb$/) && has(/BodyViewer-.*\.js$/) && has(/BodyViewer-.*\.css$/), installed.entries.filter((p) => /Body|glb/.test(p)).join(', '));
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' }).catch(() => null);
  await page.waitForTimeout(2000);
  const offlineTitle = await page.locator('.screen__title').textContent().catch(() => null);
  check('offline, the shell still loads from the worker', offlineTitle?.trim() === 'Heute', String(offlineTitle));
  log.length = 0;
  await page.getByRole('button', { name: 'Bereiche' }).click();
  await page.waitForTimeout(700);
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(900);
  await openMuscles(page, { wait: 5000 });
  console.log('[offline Gym responses]', log.join(' | ') || '(served by the worker without a network response event)');
  check('offline, Gym still shows the 3D body and its rows', (await page.locator('.body-viewer canvas').count()) === 1 && (await page.locator('.muscle-row').count()) === 10, `canvas ${await page.locator('canvas').count()}, rows ${await page.locator('.muscle-row').count()}, figure ${await page.locator('.muscle-module__figure').count()}`);
  await ctx.setOffline(false);
  await ctx.close();
}

/* ── 3. The mini charts, measured ─────────────────────────────────────── */
{
  const { ctx, page } = await fresh({ serviceWorkers: 'block' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Bereiche' }).click();
  await page.waitForTimeout(700);
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(900);
  await openMuscles(page);
  await page.locator('.areas__scroll').evaluate((el) => { const m = document.querySelector('.muscle-rows'); el.scrollTop += m.getBoundingClientRect().top - el.getBoundingClientRect().top - 8; });
  await page.waitForTimeout(600);
  const charts = await page.locator('.muscle-row').evaluateAll((rows) => rows.map((row) => {
    const name = row.querySelector('.muscle-row__name')?.textContent ?? '';
    const box = row.querySelector('.muscle-row__chart');
    const svg = box?.querySelector('svg');
    const line = svg?.querySelector('polyline');
    const dot = svg?.querySelector('circle');
    const bbox = line ? line.getBBox() : null;
    const right = row.querySelector('.muscle-row__delta, .muscle-row__badge');
    return {
      name,
      boxPx: box ? [Math.round(box.getBoundingClientRect().width), Math.round(box.getBoundingClientRect().height)] : null,
      stroke: line?.getAttribute('stroke') ?? dot?.getAttribute('fill') ?? null,
      strokeWidthPx: line ? parseFloat(getComputedStyle(line).strokeWidth) : null,
      lineBBox: bbox ? [Math.round(bbox.x * 10) / 10, Math.round(bbox.y * 10) / 10, Math.round(bbox.width * 10) / 10, Math.round(bbox.height * 10) / 10] : null,
      points: line ? line.getAttribute('points').split(' ').length : 0,
      dots: svg ? svg.querySelectorAll('circle').length : 0,
      rightText: right?.textContent?.trim() ?? '',
      rightColor: right ? getComputedStyle(right).color : null,
    };
  }));
  console.log('\n[mini charts at 393]');
  for (const c of charts) console.log(`  ${c.name.padEnd(22)} box ${String(c.boxPx).padEnd(8)} pts ${c.points} dots ${c.dots} line bbox ${String(c.lineBBox).padEnd(22)} stroke ${c.stroke} → ${c.rightText} ${c.rightColor}`);
  const measured = charts.filter((c) => c.points > 1);
  check('measured rows draw a line with a readable height, not a 1–2px mark', measured.every((c) => c.lineBBox[3] >= 4 || c.name === 'Rücken'), measured.map((c) => `${c.name} ${c.lineBBox[3]}px`).join(', '));
  check('the flat series is the one exception, drawn on purpose down the middle', charts.find((c) => c.name === 'Rücken')?.lineBBox[3] === 0 && charts.find((c) => c.name === 'Rücken')?.lineBBox[1] === 12);
  check('no line leaves its 80×24 box', measured.every((c) => c.lineBBox[0] >= 0 && c.lineBBox[1] >= 0 && c.lineBBox[0] + c.lineBBox[2] <= 80 && c.lineBBox[1] + c.lineBBox[3] <= 24));
  check('a single observation is a dot and nothing else', charts.filter((c) => ['Bizeps', 'Unterarme'].includes(c.name)).every((c) => c.points === 0 && c.dots === 1));
  check('groups with nothing to plot draw nothing', charts.filter((c) => ['Schultern', 'Waden'].includes(c.name)).every((c) => c.points === 0 && c.dots === 0));
  const strokes = charts.filter((c) => c.stroke).map((c) => c.stroke);
  check('every drawn chart has its own identity colour', new Set(strokes).size === strokes.length, strokes.join(' '));
  check('the number beside a chart is never in the chart\'s colour', charts.filter((c) => c.stroke && c.rightColor).every((c) => c.stroke.replace(/\s/g, '') !== c.rightColor.replace(/\s/g, '')));
  check('the stroke is thin and crisp, about 1.6px', measured.every((c) => c.strokeWidthPx > 1 && c.strokeWidthPx < 2.5), measured.map((c) => c.strokeWidthPx).join(','));

  /* ── 4. What assistive technology is told ───────────────────────────── */
  const a11y = await page.locator('.muscle-rows').evaluate((list) => {
    const buttons = [...list.querySelectorAll('button')];
    return {
      buttons: buttons.length,
      pressed: buttons.map((b) => b.getAttribute('aria-pressed')),
      names: buttons.map((b) => b.querySelector('.muscle-row__name')?.textContent?.trim()),
      hiddenCharts: [...list.querySelectorAll('svg')].every((s) => s.getAttribute('aria-hidden') === 'true'),
      chartWrappersHidden: [...list.querySelectorAll('.muscle-row__chart')].every((s) => s.getAttribute('aria-hidden') === 'true'),
      textOnly: buttons.map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
      heights: buttons.map((b) => Math.round(b.getBoundingClientRect().height)),
    };
  });
  console.log('\n[rows to assistive technology]', JSON.stringify({ buttons: a11y.buttons, hiddenCharts: a11y.hiddenCharts, textOnly: a11y.textOnly }, null, 0).slice(0, 600));
  check('all ten rows are buttons with a pressed state', a11y.buttons === 10 && a11y.pressed.every((p) => p === 'true' || p === 'false'));
  check('each row names its muscle and its number or state in text', a11y.textOnly.every((t) => /Brust|Rücken|Schultern|Bizeps|Trizeps|Rumpf|Quadrizeps|Beinbeuger|Waden|Unterarme/.test(t) && /%|Noch/.test(t)));
  check('the charts are hidden from the accessibility tree', a11y.hiddenCharts && a11y.chartWrappersHidden);
  check('every row keeps a 44px target', a11y.heights.every((h) => h >= 44), a11y.heights.join(','));
  const pills = await page.getByRole('group', { name: 'Ansicht' }).getByRole('button').allTextContents();
  check('the view controls carry translated labels', pills.join('|') === 'Vorne|Seite|Hinten');
  await page.locator('[data-muscle], .muscle-row__button').first().click();
  await page.waitForTimeout(500);
  check('a selected row is exposed as pressed', (await page.locator('.muscle-row__button[aria-pressed="true"]').count()) === 1);
  // The credits sheet: in the general section of the Gym area, under the hub.
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /3D-Körpermodell/ }).click();
  await page.waitForTimeout(600);
  const dialog = page.locator('[role="dialog"]');
  check('the credits sheet is a modal dialog with a name', (await dialog.count()) === 1 && (await dialog.getAttribute('aria-modal')) === 'true' && ((await dialog.getAttribute('aria-label')) || (await dialog.getAttribute('aria-labelledby'))) !== null);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  check('and Escape closes it', (await page.locator('[role="dialog"]').count()) === 0);
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
