import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, onboard, setLanguage } from './lib.mjs';

/**
 * Not a suite: the pictures of block 7D (`docs/design/wp3/stage7d/`).
 *
 * The exercise picker in a workout at 320, 360, 393 and 430: without a
 * query — the top of the list and, scrolled, a heading further down — and
 * with "bauch", "zieh", "maschine", "eigengewicht", "kabel brust" and a word
 * nothing answers; once on the English screen ("abs"); once from the plan
 * editor ("bauch"); and the form of an own exercise opened from an empty
 * search, with the word as its name.
 *
 *   OUT=<dir> WIDTHS=393 node scripts/verify/stage7d-shots.mjs
 *
 * Against the production preview (`vite preview --port 4173`).
 */
const OUT = process.env.OUT ?? 'docs/design/wp3/stage7d';
const WIDTHS = (process.env.WIDTHS ?? '320,360,393,430').split(',').map(Number);
const HEIGHT = { 320: 693, 360: 780, 393: 852, 430: 932 };
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROMIUM });
let written = 0;

async function device(width, { language = 'de' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: HEIGHT[width] ?? 852 }, deviceScaleFactor: 2, hasTouch: true, locale: 'de-CH' });
  const page = await ctx.newPage();
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await onboard(page, { gym: 3, running: 0 });
  if (language !== 'de') {
    await setLanguage(page, language);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
  }
  return { ctx, page };
}
const shot = async (page, name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  written += 1;
};
const fill = async (page, query, label = 'Suchen') => {
  await page.getByRole('textbox', { name: label }).fill(query);
  await page.waitForTimeout(400);
};

for (const width of WIDTHS) {
  const { ctx, page } = await device(width);
  await page.getByRole('button', { name: 'Session eintragen' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
  await page.locator('.gym-picker__row').first().waitFor();
  await page.waitForTimeout(500);
  await shot(page, `auswahl-ohne-suche-${width}`);
  // Further down: where one group ends and the next begins.
  await page.locator('.gym-picker__group', { hasText: 'Rumpf' }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(300);
  await shot(page, `auswahl-ohne-suche-rumpf-${width}`);
  // Back to the field, as a finger scrolls back to type.
  await page.locator('#exercise-search').evaluate((el) => {
    for (let box = el.parentElement; box; box = box.parentElement) if (box.scrollTop > 0) box.scrollTop = 0;
  });
  await page.waitForTimeout(300);
  for (const [query, slug] of [['bauch', 'bauch'], ['zieh', 'zieh'], ['maschine', 'maschine'], ['eigengewicht', 'eigengewicht'], ['kabel brust', 'kabel-brust'], ['Zercher', 'ohne-treffer']]) {
    await fill(page, query);
    await shot(page, `auswahl-${slug}-${width}`);
  }
  // Nothing found: the own exercise, with the word as its name.
  await page.locator('.sheet__footer').getByRole('button', { name: 'Eigene Übung' }).click();
  await page.waitForTimeout(500);
  await shot(page, `auswahl-eigene-uebung-${width}`);
  await ctx.close();
}

/* ── Once in English, once from the plan editor ───────────────────────── */
{
  const { ctx, page } = await device(393, { language: 'en' });
  await page.getByRole('button', { name: 'Log a session' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Add an exercise/ }).first().click();
  await page.locator('.gym-picker__row').first().waitFor();
  await fill(page, 'abs', 'Search');
  await shot(page, 'auswahl-englisch-abs-393');
  await fill(page, '', 'Search');
  await shot(page, 'auswahl-englisch-ohne-suche-393');
  await ctx.close();
}
{
  const { ctx, page } = await device(393);
  await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.waitForTimeout(500);
  await page.getByLabel('Name des Plans').fill('Rumpf');
  await page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
  await page.locator('.gym-picker__row').first().waitFor();
  await fill(page, 'bauch');
  await shot(page, 'auswahl-plan-bauch-393');
  await ctx.close();
}

await browser.close();
console.log(`${written} pictures written to ${OUT}`);
