import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, onboard, openGymHub, openMuscles, seed, seedSheetProfile, sheetGone } from './lib.mjs';

/**
 * What the camera's travel to a group costs under the rising sheet — the
 * measurement behind D185's choice (block 7C, step 3).
 *
 * Nothing may blur over the body while a frame is drawn (D146). The prompt
 * named two ways to keep that while the muscle sheet opens, and asked for
 * both to be measured:
 *
 *   solid   the sheet and its scrim are solid surfaces while the camera
 *           travels — what was built, and kept for good;
 *   first   the camera is at its goal before the sheet reaches the body —
 *           here: nothing at all lies over the body while it travels, which
 *           is the least this way can cost.
 *
 * And, to say what the rule is for:
 *
 *   glass   the sheet as every other sheet is — glass over a blurred,
 *           dimmed scrim — over the body while it travels. Forbidden; drawn
 *           here only to be measured.
 *
 * For each, two readings. The suite's own: the frames from the tap to the
 * moment the body is held, the time that took, and the longest and the
 * median time between two frames. And the measuring display's (D181),
 * switched on as its user switches it on and read after the last close:
 * its lines under "Drehen", which count every frame the camera's own
 * motion asked for — the way to the group and the way back.
 *
 * This is a headless browser with a software renderer: the numbers say
 * which way is dearer and by how much, not what a phone draws. Not a
 * check; it prints.
 *
 *   RUNS=3 node scripts/verify/stage7c-travel-cost.mjs
 *
 * Against the production preview (`vite preview --port 4173`), alone.
 */

const RUNS = Number(process.env.RUNS ?? 3);
const browser = await chromium.launch({ executablePath: CHROMIUM });

const PROBE = () => {
  window.__frames = [];
  if (!window.WebGL2RenderingContext) return;
  let inFrame = false;
  const draw = WebGL2RenderingContext.prototype.drawElements;
  WebGL2RenderingContext.prototype.drawElements = function (...args) {
    if (this.canvas && this.canvas.isConnected && !inFrame) {
      inFrame = true;
      window.__frames.push(performance.now());
      setTimeout(() => { inFrame = false; }, 0);
    }
    return draw.apply(this, args);
  };
};

const WAYS = {
  solid: '',
  first: '.sheet-scrim--clear { visibility: hidden !important; }',
  glass: `.sheet-scrim--clear { background: var(--scrim) !important; -webkit-backdrop-filter: blur(2px) !important; backdrop-filter: blur(2px) !important; }
          .sheet--solid { background: var(--glass-fill-strong) !important; -webkit-backdrop-filter: saturate(160%) blur(var(--glass-blur)) !important; backdrop-filter: saturate(160%) blur(var(--glass-blur)) !important; }`,
};

const median = (list) => { const sorted = [...list].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0; };

const ctx = await browser.newContext({
  viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true,
  permissions: ['clipboard-read', 'clipboard-write'],
});
await ctx.addInitScript(PROBE);
const page = await ctx.newPage();
await page.goto(URL_APP, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await onboard(page, { gym: 3, running: 2 });
await seed(page, { days: 90 });
await seedSheetProfile(page);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
// The display, switched on where its user finds the switch.
await page.getByRole('button', { name: 'Bereiche' }).click();
await page.waitForTimeout(600);
await page.getByRole('switch', { name: 'Messanzeige beim Körper' }).click();
await page.waitForTimeout(200);

/** A new visit: the display counts from the moment Muskelgruppen is opened. */
async function visit() {
  await page.goto('about:blank');
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await openGymHub(page);
  await openMuscles(page, { wait: 4500 });
  await page.locator('[data-readout]').waitFor({ timeout: 20000 });
}

/** The display's lines under "Drehen", as "Werte kopieren" hands them over. */
async function turningLines() {
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: 'Werte kopieren' }).click();
  await page.waitForTimeout(300);
  const text = await page.evaluate(() => navigator.clipboard.readText());
  const lines = text.split('\n');
  const from = lines.findIndex((line) => /^Drehen/.test(line.trim()));
  const block = [];
  for (let index = from + 1; index < lines.length && lines[index].trim() !== '' && !/^(Leerlauf|Zeichnen|Gerät|Laden)\b/.test(lines[index].trim()); index += 1) block.push(lines[index].trim());
  return block;
}

const display = {};
console.log(`way     frames  to rest   longest  median   (393 × 852 at 3×, ${RUNS} runs each, software renderer)`);
for (const [way, css] of Object.entries(WAYS)) {
  await visit();
  const style = css ? await page.addStyleTag({ content: css }) : null;
  const runs = [];
  for (let run = 0; run < RUNS; run += 1) {
    const box = await page.locator('.body-viewer canvas').boundingBox();
    await page.evaluate(() => { window.__frames.length = 0; window.__t0 = performance.now(); });
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.33);
    await page.waitForFunction(() => document.querySelector('.body-viewer')?.hasAttribute('data-held'), null, { timeout: 20000 });
    const result = await page.evaluate(() => {
      const frames = window.__frames;
      const gaps = frames.slice(1).map((at, index) => at - frames[index]);
      return { frames: frames.length, toRest: (frames[frames.length - 1] ?? window.__t0) - window.__t0, gaps };
    });
    runs.push(result);
    await page.keyboard.press('Escape');
    await sheetGone(page);
    await page.waitForFunction(() => { const v = document.querySelector('.body-viewer'); return !v.hasAttribute('data-held') && v.dataset.zoom === '1'; }, null, { timeout: 20000 });
    await page.waitForTimeout(600);
  }
  const frames = median(runs.map((r) => r.frames));
  const toRest = median(runs.map((r) => r.toRest));
  const longest = median(runs.map((r) => Math.max(0, ...r.gaps)));
  const middle = median(runs.flatMap((r) => r.gaps));
  console.log(`${way.padEnd(7)} ${String(frames).padStart(6)}  ${`${Math.round(toRest)} ms`.padStart(8)}  ${`${Math.round(longest)} ms`.padStart(7)}  ${`${Math.round(middle)} ms`.padStart(6)}`);
  display[way] = await turningLines();
  if (style) await style.evaluate((el) => el.remove());
}
console.log('\nThe measuring display, "Drehen", after the same travels (there and back):');
for (const [way, lines] of Object.entries(display)) console.log(`${way.padEnd(7)} ${lines.join(' · ')}`);
await browser.close();
