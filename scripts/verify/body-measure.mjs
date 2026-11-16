import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, onboard, seed, seedTraining, seedMuscles, fingerTurn } from './lib.mjs';

/**
 * Not a suite: the measuring display, read in the headless browser
 * (block 7B, D181).
 *
 * Does what the owner does on the phone — switches the display on in the
 * settings, starts the app again, opens Muskelgruppen, turns the body for
 * ten seconds, lets go, waits two seconds and copies the values — and
 * prints what was copied. Twice: the first load after a start and the
 * second. Then once more in a browser without the app's offline store, so
 * that code and model come over the network.
 *
 * **These numbers say nothing about an iPhone.** The headless browser draws
 * with a software renderer on a server's processor; they are a comparison
 * value between two builds, and the record of what the display prints.
 *
 *   WIDTH=393 HEIGHT=852 TURN_MS=10000 SHOTS=<dir> node scripts/verify/body-measure.mjs
 *
 * Runs against the production preview (`vite preview --port 4173`), alone,
 * like every suite that draws the body. No exit code.
 */
const WIDTH = Number(process.env.WIDTH ?? 393);
const HEIGHT = Number(process.env.HEIGHT ?? 852);
const TURN_MS = Number(process.env.TURN_MS ?? 10000);
const OUT = process.env.SHOTS ?? '';

const browser = await chromium.launch({ executablePath: CHROMIUM });

async function start({ serviceWorkers }) {
  const ctx = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 3, hasTouch: true, serviceWorkers,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();
  page.on('pageerror', (error) => console.log('  pageerror:', error.message));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await onboard(page, { gym: 3, running: 2 });
  await seed(page, { days: 42 });
  await seedTraining(page, { days: 42 });
  await seedMuscles(page, { days: 42 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  // The switch, as its user finds it: Bereiche, at the foot, under Einstellungen.
  await page.getByRole('button', { name: 'Bereiche' }).click();
  await page.waitForTimeout(600);
  await page.getByRole('switch', { name: 'Messanzeige beim Körper' }).click();
  await page.waitForTimeout(200);
  return { ctx, page };
}

/**
 * Starts the app again and goes to Muskelgruppen the way a finger does.
 * From the app's own address, as the home screen starts it: a reload would
 * start on Muskelgruppen itself, where the last visit ended, and load the
 * body before the visit that is to be measured.
 */
async function visit(page) {
  await page.goto('about:blank');
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Bereiche' }).click();
  await page.waitForTimeout(600);
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Muskelgruppen öffnen' }).click();
  await page.locator('[data-readout]').waitFor({ timeout: 20000 });
  // Until the first picture is there: the display's first line carries a number.
  await page.waitForFunction(() => /\d\s*ms/.test(document.querySelector('[data-readout] dd')?.textContent ?? ''), null, { timeout: 30000 });
  await page.waitForTimeout(800);
}

/** Turns the body with a finger that keeps moving: back and forth, for `ms` (`fingerTurn`). */
const turn = (page, ms) => fingerTurn(page, { ms });

async function measure(page, label) {
  await visit(page);
  await turn(page, TURN_MS);
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: 'Werte kopieren' }).click();
  await page.waitForTimeout(300);
  const text = await page.evaluate(() => navigator.clipboard.readText());
  console.log(`\n=== ${label} (${WIDTH}×${HEIGHT}) ===\n${text}`);
  if (OUT) {
    await page.locator('[data-readout]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/messanzeige-${WIDTH}-${label.replace(/\W+/g, '-').toLowerCase()}.png` });
  }
  return text;
}

{
  const { ctx, page } = await start({ serviceWorkers: 'allow' });
  await measure(page, 'erstes Laden');
  await measure(page, 'zweites Laden');
  await ctx.close();
}
{
  const { ctx, page } = await start({ serviceWorkers: 'block' });
  await measure(page, 'ohne Offline-Speicher');
  await ctx.close();
}
await browser.close();
