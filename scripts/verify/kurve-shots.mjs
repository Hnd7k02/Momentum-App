import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { readBody, stillPicture } from './body-tones.mjs';
import { CHROMIUM, URL_APP, onboard, openExerciseAnywhere } from './lib.mjs';

/**
 * Not a suite: an import file on the real screen — the body, the ten rows
 * and one exercise detail (block "Kurve").
 *
 * The production build under `URL_APP` imports `FILE` through its own
 * "Backup importieren" on the day `DAY`, as the owner does, and is looked
 * at where the block changes or asks something: the 3D body in
 * Muskelgruppen at 30 and 90 days from the front and from the back (the
 * strength of its tints), the ten rows with their lines, and the detail of
 * one exercise with its line (the two scales of 12 %).
 *
 *   npm run build && npx vite preview --port 4173 &
 *   LABEL=vorher node scripts/verify/kurve-shots.mjs      # before a change
 *   LABEL=nachher node scripts/verify/kurve-shots.mjs     # after it
 *
 * Pictures go to `<OUT>/<LABEL>-<name>.png`. Where a picture exists under
 * both labels of `PAIR` ("vorher,nachher"), the two are set side by side as
 * `<OUT>/vergleich-<name>.png`.
 *
 * `HELD=<file>` imports a second file in which every group is held (the
 * same sessions, nothing changing) and measures the first against it the
 * way `farbregeln.mjs` measures a tint (`body-tones.mjs`): per zone, the
 * median difference of every lit pixel in ΔE. `<OUT>/<LABEL>-koerper.json`
 * has the numbers and the figure each zone's group prints.
 */
const FILE = process.env.FILE ?? 'docs/wp3/stage5b/momentum-pruefdaten-5b.json';
const HELD = process.env.HELD ?? null;
const OUT = process.env.OUT ?? 'docs/design/wp3/kurve';
const LABEL = process.env.LABEL ?? 'nachher';
const PAIR = (process.env.PAIR ?? 'vorher,nachher').split(',');
const EXERCISE = process.env.EXERCISE ?? 'Bankdrücken';
const TZ = 'Europe/Zurich';
mkdirSync(OUT, { recursive: true });

const lastSession = (file) => JSON.parse(readFileSync(file, 'utf8')).data.gymSessions.map((session) => session.date).sort().pop();
const DAY = process.env.DAY ?? lastSession(FILE);

function localInstant(day, hour) {
  for (const offset of ['+02:00', '+01:00']) {
    const instant = new Date(`${day}T${String(hour).padStart(2, '0')}:00:00${offset}`);
    const read = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(instant);
    if (Number(read) === hour) return instant;
  }
  throw new Error(`no ${hour}:00 on ${day}`);
}

const clean = (text) => (text ?? '').replace(/\s+/g, ' ').trim();
const tab = (page, name) => page.locator('.tab-bar button', { hasText: name });

const browser = await chromium.launch({ executablePath: CHROMIUM });

/** A device that has imported `file` on `DAY`, standing in Muskelgruppen. */
async function device(file) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, timezoneId: TZ, locale: 'de-CH' });
  await ctx.clock.setSystemTime(localInstant(DAY, 10));
  const page = await ctx.newPage();
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await onboard(page, { gym: 3, running: 0 });
  await tab(page, 'Bereiche').click();
  await page.waitForTimeout(700);
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.getByRole('button', { name: 'Ersetzen' }).click();
  await page.locator('.backup__status--ok').waitFor();
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await tab(page, 'Bereiche').click();
  await page.waitForTimeout(600);
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(1200);
  const rating = clean(await page.locator('[data-metric="gym-rating"]').first().textContent());
  await page.getByRole('button', { name: 'Muskelgruppen öffnen' }).click();
  await page.locator('.body-viewer canvas').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(3000);
  return { ctx, page, rating };
}

const range = async (page, days) => {
  await page.locator('.progress__ranges button', { hasText: new RegExp(`^${days} Tage$`) }).click();
  await page.waitForTimeout(1500);
};

async function rows(page) {
  const out = {};
  for (const row of await page.locator('.muscle-row').all()) {
    out[clean(await row.locator('.muscle-row__name').textContent())] = clean(await row.locator('.muscle-row__right').textContent());
  }
  return out;
}

/** The body from the front and from the back, each once it stands still. */
async function body(page) {
  const viewer = page.locator('.body-viewer').first();
  await viewer.scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Vorne', exact: true }).click();
  await page.waitForTimeout(1200);
  const front = await stillPicture(page, viewer);
  const views = await page.locator('.body-viewer__views').first().boundingBox();
  const controls = views && front.box
    ? [(views.x - front.box.x) / front.box.width, (views.y - front.box.y) / front.box.height, (views.x + views.width - front.box.x) / front.box.width, (views.y + views.height - front.box.y) / front.box.height]
    : null;
  await page.getByRole('button', { name: 'Hinten', exact: true }).click();
  await page.waitForTimeout(1200);
  const back = await stillPicture(page, viewer);
  if (!front.still || !back.still) throw new Error('the body did not come to rest');
  return { front: front.frame, back: back.frame, controls };
}

const save = (name, png) => writeFileSync(`${OUT}/${LABEL}-${name}.png`, png);
const written = [];

const main = await device(FILE);
const numbers = { file: FILE, day: DAY, label: LABEL, rating: main.rating, ranges: {} };
const bodies = {};
for (const days of [30, 90]) {
  await range(main.page, days);
  bodies[days] = await body(main.page);
  save(`koerper-${days}-vorne`, bodies[days].front);
  save(`koerper-${days}-hinten`, bodies[days].back);
  written.push(`koerper-${days}-vorne`, `koerper-${days}-hinten`);
  numbers.ranges[days] = { rows: await rows(main.page) };
  const list = main.page.locator('.muscle-rows').first();
  await list.scrollIntoViewIfNeeded();
  await main.page.waitForTimeout(500);
  save(`zeilen-${days}`, await list.screenshot());
  written.push(`zeilen-${days}`);
}

// One exercise's detail at 30 days: the head, and the line on its scale.
await range(main.page, 30);
// Since block 7C an exercise is opened from the sheet of its group, and its
// detail carries one change at its head instead of a value at the line's end (D176).
await openExerciseAnywhere(main.page, EXERCISE);
numbers.detail = {
  exercise: EXERCISE,
  head: [
    ...(await main.page.locator('.gym-detail__head, .gym-detail__caption').allTextContents()),
    ...(await main.page.locator('.gym-detail__figure').allTextContents()),
  ].map(clean),
  axis: (await main.page.locator('.gym-detail .exercise-line__label').allTextContents()).map(clean),
  endValue: clean(await main.page.locator('.gym-detail .exercise-line__value').first().textContent({ timeout: 1000 }).catch(() => '')),
};
save('uebungsdetail', await main.page.screenshot());
written.push('uebungsdetail');

/* ── Against the same sessions with every group held ────────────────────── */

if (HELD) {
  const held = await device(HELD);
  for (const days of [30, 90]) {
    await range(held.page, days);
    const reference = await body(held.page);
    const front = await readBody(held.page, bodies[days].front, bodies[days].controls, reference.front);
    const back = await readBody(held.page, bodies[days].back, null, reference.back);
    const zone = (read, name) => ({ dE: read[name].dE, dA: read[name].dA, dL: read[name].dL, pixels: read[name].pixels });
    numbers.ranges[days].againstHeld = {
      sameFrame: front.sameFrame && back.sameFrame,
      front: { chest: zone(front, 'upper'), quadriceps: zone(front, 'thigh'), calves: zone(front, 'calf'), feet: zone(front, 'foot') },
      back: { back: zone(back, 'upper'), hamstringsGlutes: zone(back, 'thigh'), calves: zone(back, 'calf') },
    };
    numbers.ranges[days].heldRows = await rows(held.page);
  }
  await held.ctx.close();
}
writeFileSync(`${OUT}/${LABEL}-koerper.json`, `${JSON.stringify(numbers, null, 1)}\n`);
await main.ctx.close();

/* ── Side by side, where both labels exist ──────────────────────────────── */

const sheetCtx = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 });
for (const name of written) {
  const files = PAIR.map((label) => `${OUT}/${label}-${name}.png`);
  if (!files.every((file) => existsSync(file))) continue;
  const page = await sheetCtx.newPage();
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:20px;background:#0f0f14;color:#f2f2f7;font:15px/1.4 system-ui">
    <div style="display:flex;gap:16px;align-items:flex-start">${files.map((file, index) => `
      <figure style="margin:0"><figcaption style="font-size:13px;margin:0 0 6px">${PAIR[index]}</figcaption>
      <img src="data:image/png;base64,${readFileSync(file).toString('base64')}" style="width:393px;display:block;border-radius:10px"></figure>`).join('')}
    </div></body>`;
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(200);
  writeFileSync(`${OUT}/vergleich-${name}.png`, await page.screenshot({ fullPage: true }));
  await page.close();
  console.log(`written: vergleich-${name}.png`);
}
await browser.close();
console.log(JSON.stringify(numbers, null, 1));
