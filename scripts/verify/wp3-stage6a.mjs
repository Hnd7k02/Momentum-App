/**
 * WP3 Stage 6a — the two design variants, as screenshots (P11).
 *
 * One seeded device, five screens, both variants: Heute, Bereiche → Mind,
 * the Gym hub, a workout with two exercises and a set, and Muskelgruppen.
 * Variant A is the build as it stands; variant B is switched on with
 * `data-variant="b"` on `<html>` before the app starts, which is the only
 * way it is ever switched on. The owner chooses at STOP 6a.
 *
 *   OUT=docs/design/wp3/stage6a node scripts/verify/wp3-stage6a.mjs
 *
 * Besides the pictures it checks what a picture cannot show: the world
 * attribute follows the screen (Heute light, Gym dark, back again), the
 * status-bar colour follows the world, a sheet opened from a Gym screen is
 * drawn in the Gym world, and no document is wider than its viewport.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { URL_APP, check, summary, phone, onboard, seed, seedTraining, seedMuscles, openMuscles, clipped, textContrast } from './lib.mjs';

const OUT = process.env.OUT ?? 'docs/design/wp3/stage6a';
const WIDTHS = (process.env.WIDTHS ?? '393').split(',').map(Number);
const VARIANTS = (process.env.VARIANTS ?? 'a,b').split(',');
mkdirSync(OUT, { recursive: true });

const HEIGHT = { 393: 852, 430: 932, 320: 693 };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const shot = (page, variant, width, slug) =>
  page.screenshot({ path: `${OUT}/wp3-stage6a-${variant}-${width}-${slug}.png` });
const tab = (page, name) => page.locator('.tab-bar button', { hasText: name }).click();
const world = (page) => page.evaluate(() => document.documentElement.getAttribute('data-world'));
const themeColour = (page) =>
  page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null);
const short = (value) => JSON.stringify(value)?.slice(0, 120);

/*
 * Text over glass (Stage 6, "measured in the browser on both backgrounds").
 * Body text reads at 4.5:1 and large text at 3:1 against the pixels it is
 * drawn on; tertiary captions are reported, not held, because the light
 * theme already carries them below 4.5:1 by design — that is a question for
 * STOP 6a, not a regression of this stage.
 */
const measured = {};
async function holdText(page, W, variant, width, screen) {
  const rows = await textContrast(page);
  (measured[`${variant}-${width}`] ??= {})[screen] = rows;
  const held = rows.filter((r) => !r.tertiary);
  const below = held.filter((r) => r.ratio < (r.large ? 3 : 4.5));
  const worst = held.reduce((min, r) => Math.min(min, r.ratio), Infinity);
  const tertiary = rows.filter((r) => r.tertiary).reduce((min, r) => Math.min(min, r.ratio), Infinity);
  check(`${W} ${screen}: text over glass reads (${held.length} runs, lowest ${worst}, captions ${tertiary})`,
    below.length === 0, below.map((r) => `${r.className} "${r.text}" ${r.ratio}`).join(' | ').slice(0, 240));
}

async function pick(page, name) {
  await page.locator('.gym-session__bar').getByRole('button', { name: /Übung hinzufügen/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('textbox', { name: 'Suchen' }).fill(name);
  await page.waitForTimeout(350);
  await page
    .locator('.gym-picker__row')
    .filter({ has: page.locator('.gym-picker__name', { hasText: new RegExp(`^${name}$`) }) })
    .first()
    .click();
  await page.waitForTimeout(900);
}

async function logPending(page, name, reps, weight) {
  const card = page
    .locator('.gym-session .card')
    .filter({ has: page.locator('.gym-exercise__name', { hasText: new RegExp(`^${name}`) }) });
  const row = card.locator('.gym-set--pending');
  await row.locator('input').nth(0).fill(String(reps));
  await row.locator('input').nth(0).blur();
  await page.waitForTimeout(300);
  await row.locator('input').nth(1).fill(String(weight));
  await row.locator('input').nth(1).blur();
  await page.waitForTimeout(1200);
}

for (const variant of VARIANTS) {
  for (const width of WIDTHS) {
    const W = `${variant.toUpperCase()} ${width}`;
    const ctx = await browser.newContext({ ...phone, viewport: { width, height: HEIGHT[width] ?? 852 } });
    if (variant !== 'a') {
      await ctx.addInitScript((v) => {
        // At document start the root element may not exist yet.
        const set = () => document.documentElement?.setAttribute('data-variant', v);
        if (document.documentElement) set();
        else new MutationObserver((_, o) => { if (document.documentElement) { set(); o.disconnect(); } }).observe(document, { childList: true });
      }, variant);
    }
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto(URL_APP, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    await onboard(page, { gym: 3, running: 2 });
    await seed(page, { days: 30 });
    await seedTraining(page, { days: 40 });
    await seedMuscles(page);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    /* Heute: the shared screen, light, with its Gym tiles. */
    check(`${W}: Heute is drawn in the Mind world`, (await world(page)) === null, String(await world(page)));
    const lightBar = await themeColour(page);
    await shot(page, variant, width, 'heute');
    check(`${W}: Heute does not overflow`, (await clipped(page)).length === 0, short(await clipped(page)));
    await holdText(page, W, variant, width, 'heute');
    // The Gym tiles, further down: how a shared screen carries Gym.
    await page.locator('section[aria-label="Gym"]').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelector('.today__scroll')?.scrollBy(0, -24));
    await page.waitForTimeout(400);
    await shot(page, variant, width, 'heute-gym');
    await holdText(page, W, variant, width, 'heute-gym');

    /* The other shared screens, for the proposal on how they carry Gym. */
    await tab(page, 'Verlauf');
    await page.waitForTimeout(1200);
    check(`${W}: Verlauf stays light`, (await world(page)) === null);
    await shot(page, variant, width, 'verlauf');
    await holdText(page, W, variant, width, 'verlauf');
    await tab(page, 'Rang');
    await page.waitForTimeout(1200);
    check(`${W}: Rang stays light`, (await world(page)) === null);
    await shot(page, variant, width, 'rang');
    await holdText(page, W, variant, width, 'rang');

    /* Bereiche → Mind. */
    await tab(page, 'Bereiche');
    await page.waitForTimeout(900);
    await page.getByRole('radio', { name: 'Mind' }).click();
    await page.waitForTimeout(700);
    check(`${W}: Bereiche → Mind stays light`, (await world(page)) === null);
    await shot(page, variant, width, 'mind');
    check(`${W}: Mind does not overflow`, (await clipped(page)).length === 0, short(await clipped(page)));
    await holdText(page, W, variant, width, 'mind');

    /* Bereiche → Gym: the hub turns the display. */
    await page.getByRole('radio', { name: 'Gym' }).click();
    await page.waitForTimeout(1500);
    check(`${W}: the Gym hub is drawn in the Gym world`, (await world(page)) === 'gym');
    const darkBar = await themeColour(page);
    check(`${W}: the status-bar colour follows the world`, lightBar !== null && darkBar !== null && lightBar !== darkBar, `${lightBar} → ${darkBar}`);
    await shot(page, variant, width, 'gym-hub');
    check(`${W}: the hub does not overflow`, (await clipped(page)).length === 0, short(await clipped(page)));
    await holdText(page, W, variant, width, 'gym-hub');
    // Further down the hub: Laufen.
    const laufen = page.locator('.areas__running');
    if ((await laufen.count()) > 0) {
      await laufen.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.querySelector('.areas__scroll')?.scrollBy(0, -16));
      await page.waitForTimeout(400);
      await shot(page, variant, width, 'gym-laufen');
      await holdText(page, W, variant, width, 'gym-laufen');
      await page.evaluate(() => document.querySelector('.areas__scroll')?.scrollTo(0, 0));
      await page.waitForTimeout(300);
    }

    /* A sheet opened from the hub: a portal into <body>, still Gym. */
    await page.locator('[data-metric="gym-rating"] .metric-tile__open').click();
    await page.waitForTimeout(600);
    const sheetBg = await page.locator('.sheet').evaluate((el) => getComputedStyle(el).backgroundColor);
    check(`${W}: a sheet from a Gym screen is not white`, !/rgba?\(255, 255, 255(, 1)?\)/.test(sheetBg), sheetBg);
    await shot(page, variant, width, 'gym-sheet');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    /* The workout. */
    await page.getByRole('button', { name: 'Training erfassen' }).click();
    await page.waitForTimeout(700);
    const free = page.locator('[role="dialog"]').getByRole('button', { name: 'Freie Session' });
    if ((await free.count()) > 0) {
      await free.click();
      await page.waitForTimeout(700);
    }
    await page.locator('.gym-session__bar').waitFor({ timeout: 5000 });
    await pick(page, 'Bankdrücken');
    await pick(page, 'Kniebeuge');
    await logPending(page, 'Bankdrücken', 8, 60);
    check(`${W}: the workout is drawn in the Gym world`, (await world(page)) === 'gym');
    await shot(page, variant, width, 'session');
    check(`${W}: the workout does not overflow`, (await clipped(page)).length === 0, short(await clipped(page)));
    await holdText(page, W, variant, width, 'session');
    await page.locator('.gym-session .gym-session__back').first().click();
    await page.waitForTimeout(1200);

    /* Muskelgruppen. */
    await openMuscles(page);
    check(`${W}: Muskelgruppen is drawn in the Gym world`, (await world(page)) === 'gym');
    await shot(page, variant, width, 'muscles');
    check(`${W}: Muskelgruppen does not overflow`, (await clipped(page)).length === 0, short(await clipped(page)));
    await holdText(page, W, variant, width, 'muscles');
    // The rows, further down.
    await page.locator('.muscle-rows').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await shot(page, variant, width, 'muscles-rows');
    await holdText(page, W, variant, width, 'muscles-rows');
    // Below the rows: the exercises, and one exercise's detail.
    const rows = page.locator('.gym-progress__row');
    check(`${W}: Muskelgruppen lists the exercises`, (await rows.count()) > 0, String(await rows.count()));
    if ((await rows.count()) > 0) {
      await rows.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await shot(page, variant, width, 'gym-exercises');
      await rows.first().click();
      await page.waitForTimeout(1200);
      check(`${W}: the exercise detail is drawn in the Gym world`, (await world(page)) === 'gym');
      await shot(page, variant, width, 'exercise-detail');
      await holdText(page, W, variant, width, 'exercise-detail');
      await page.locator('.gym-detail .gym-session__back').first().click();
      await page.waitForTimeout(800);
    }

    /* Back to a shared screen: the world is given back. */
    await tab(page, 'Heute');
    await page.waitForTimeout(700);
    check(`${W}: Heute is light again after Gym`, (await world(page)) === null, String(await world(page)));
    check(`${W}: the status-bar colour is light again`, (await themeColour(page)) === lightBar, String(await themeColour(page)));

    check(`${W}: no page errors`, errors.length === 0, short(errors));
    await ctx.close();
  }
}

await browser.close();
writeFileSync(`${OUT}/text-contrast.json`, JSON.stringify(measured, null, 1));
process.exit(summary() ? 0 : 1);
