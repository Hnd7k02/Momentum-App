import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { readBody, stillPicture } from './body-tones.mjs';
import { CHROMIUM } from './lib.mjs';

/**
 * Not a suite: the pictures and the measures of the tint's strength (block
 * "Kurve", point 9 of its design).
 *
 * The strength of a tint on the 3D body grows evenly from the end of the
 * held band to an upper end and stays there (contract §7). This script
 * shows what another upper end does, on the dev harness — the app's own
 * scale is not touched by it:
 *
 *   npx vite --port 5173 &
 *   node scripts/verify/kurve-tint-shots.mjs
 *
 * `#/dev/body?tintTo=<percent>&deltas=<group>:<change>,…` draws the named
 * groups at those changes, each in the state the app gives that change, and
 * every other group held.
 *
 * - **The pictures.** For every history in `GROUPS_FILE` (by default `<OUT>/gruppen.json`) — the groups' changes
 *   as the real replay gives them (`kurveReport.test.ts` writes the file) —
 *   one sheet: the body from the front and from the back under each
 *   candidate, today's first.
 * - **The measures**, as `farbregeln.mjs` takes them (`body-tones.mjs`): the
 *   chest at +3, +5, +7 and +10 % and the quadriceps at the same falls,
 *   every other group held, against the figure in which all are held — the
 *   median difference of every lit pixel of the zone, in ΔE, and how far it
 *   moved towards green or red (a*).
 *
 * Writes `<OUT>/farbstaerke-<history>.png`, `<OUT>/farbstaerke-stufen.png`
 * and `<OUT>/farbstaerke.json`.
 */
const BASE = process.env.BODY_URL ?? 'http://127.0.0.1:5173/Momentum-App/';
const OUT = process.env.OUT ?? 'docs/design/wp3/kurve';
const CANDIDATES = (process.env.CANDIDATES ?? '12,10,8,7,6').split(',').map(Number);
/** The app's upper end, for the caption of the first column. */
const TODAY = Number(process.env.TODAY ?? 12);
const STEPS = [3, 5, 7, 10];
// `GROUPS_FILE`, not `GROUPS`: bash keeps a variable of that name for itself.
const GROUPS = JSON.parse(readFileSync(process.env.GROUPS_FILE ?? `${OUT}/gruppen.json`, 'utf8'));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, locale: 'de-CH' });

const url = (to, deltas) =>
  `${BASE}?world=gym&tintTo=${to}&deltas=${Object.entries(deltas).map(([id, change]) => `${id}:${change}`).join(',')}#/dev/body`;

/** The body of the harness page, front and back, once it stands still. */
async function shots(to, deltas) {
  const page = await ctx.newPage();
  await page.goto(url(to, deltas), { waitUntil: 'networkidle' });
  await page.locator('.body-viewer canvas').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const viewer = page.locator('.body-viewer').first();
  const front = await stillPicture(page, viewer);
  const views = await page.locator('.body-viewer__views').first().boundingBox();
  const controls = views && front.box
    ? [(views.x - front.box.x) / front.box.width, (views.y - front.box.y) / front.box.height, (views.x + views.width - front.box.x) / front.box.width, (views.y + views.height - front.box.y) / front.box.height]
    : null;
  await page.getByRole('button', { name: 'Hinten', exact: true }).click();
  await page.waitForTimeout(1200);
  const back = await stillPicture(page, viewer);
  if (!front.still || !back.still) throw new Error(`the body did not come to rest at tintTo=${to}`);
  return { page, front: front.frame, back: back.frame, controls };
}

/** One sheet: a row of pictures per view, a column per candidate. */
async function sheet(file, title, columns) {
  const page = await ctx.newPage();
  const cell = (png) => `<img src="data:image/png;base64,${png.toString('base64')}" style="width:196px;display:block;border-radius:10px">`;
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:20px;background:#0f0f14;color:#f2f2f7;font:15px/1.4 system-ui">
    <h1 style="font-size:17px;margin:0 0 14px">${title}</h1>
    <div style="display:flex;gap:12px">${columns.map((column) => `
      <figure style="margin:0">
        <figcaption style="font-size:13px;margin:0 0 6px;white-space:nowrap">${column.caption}</figcaption>
        ${cell(column.front)}<div style="height:8px"></div>${cell(column.back)}
      </figure>`).join('')}
    </div></body>`;
  // A low viewport: the full-page picture is then as high as the sheet, and no higher.
  await page.setViewportSize({ width: 40 + columns.length * 208, height: 100 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  writeFileSync(`${OUT}/${file}`, await page.screenshot({ fullPage: true }));
  await page.close();
}

const caption = (to) => (to === TODAY ? `volle Stärke ab ${to} % (heute)` : `volle Stärke ab ${to} %`);
const result = { candidates: CANDIDATES, histories: {}, steps: {} };

/* ── The histories ──────────────────────────────────────────────────────── */

for (const history of GROUPS) {
  const columns = [];
  for (const to of CANDIDATES) {
    const shot = await shots(to, history.groups);
    columns.push({ caption: caption(to), front: shot.front, back: shot.back });
    await shot.page.close();
  }
  await sheet(`farbstaerke-${history.id}.png`, history.title, columns);
  result.histories[history.id] = { title: history.title, groups: history.groups };
  console.log(`written: farbstaerke-${history.id}.png`);
}

/* ── The steps, measured ────────────────────────────────────────────────── */

const held = await shots(TODAY, {});
const stepColumns = [];
for (const to of CANDIDATES) {
  result.steps[to] = {};
  for (const step of STEPS) {
    const shot = await shots(to, { chest: step, quadriceps: -step });
    const read = await readBody(held.page, shot.front, shot.controls, held.front);
    const strength = Math.min(1, 0.3 + (Math.max(0, step - 2.5) / (to - 2.5)) * 0.7);
    result.steps[to][step] = {
      strength: Math.round(strength * 1000) / 1000,
      chest: { dE: read.upper.dE, dA: read.upper.dA },
      quadriceps: { dE: read.thigh.dE, dA: read.thigh.dA },
      calvesHeld: { dE: read.calf.dE },
      sameFrame: read.sameFrame,
    };
    if (step === 3 || step === 7) stepColumns.push({ caption: `${caption(to)}: ±${step} %`, front: shot.front, back: shot.back });
    await shot.page.close();
    console.log(`tintTo ${to}, ±${step} %: strength ${strength.toFixed(3)}, chest ΔE ${read.upper.dE} (a* ${read.upper.dA}), quadriceps ΔE ${read.thigh.dE} (a* ${read.thigh.dA})`);
  }
}
await sheet('farbstaerke-stufen.png', 'Brust +3 % und +7 %, Quadrizeps −3 % und −7 %, alles andere gehalten', stepColumns);
await held.page.close();

writeFileSync(`${OUT}/farbstaerke.json`, `${JSON.stringify(result, null, 1)}\n`);
await browser.close();
console.log(`written: ${OUT}/farbstaerke.json`);
