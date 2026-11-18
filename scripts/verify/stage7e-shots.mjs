import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, chooseQuestions, passOpening, setLanguage } from './lib.mjs';

/**
 * Not a suite: the pictures of block 7E (`docs/design/wp3/stage7e/`).
 *
 * The onboarding, step by step, as a new user walks it with both worlds
 * chosen: the three slides, the areas, the Mind questions, the weekly
 * targets and the summary. Every step at 393; the first slide and the
 * weekly targets at 320 and 430 as well (`ALL=1` pictures every step at
 * every width). Since STOP 7E-a2 (D191) also the question step as it
 * opens — with no question chosen since D197 — and,
 * given `URL_PREVIEW`, the preview's row «Einführung ansehen».
 *
 *   OUT=docs/design/wp3/stage7e-b node scripts/verify/stage7e-shots.mjs
 *
 * It types nothing into the database: the flow is walked by its own
 * buttons, and a new browser context is a new device.
 */
const OUT = process.env.OUT ?? 'docs/design/wp3/stage7e';
const WIDTHS = (process.env.WIDTHS ?? '393,320,430').split(',').map(Number);
const HEIGHT = { 320: 693, 360: 780, 393: 852, 430: 932 };
const ALL = process.env.ALL === '1';
const LANGUAGE = process.env.LANGUAGE ?? 'de';
/** The steps pictured at every width; the rest at 393 only. */
const EVERYWHERE = new Set(['0-auftakt', '1-momentum', '6-wochenziele']);
const URL_PREVIEW = process.env.URL_PREVIEW ?? null;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROMIUM });
const report = [];

for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: HEIGHT[width] ?? 852 },
    deviceScaleFactor: 2,
    hasTouch: true,
    locale: LANGUAGE === 'de' ? 'de-CH' : 'en-GB',
    serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (error) => console.log('  pageerror:', error.message));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.locator('.onboarding').waitFor({ state: 'visible' });
  // A new device starts in German; the language is the stored setting.
  if (LANGUAGE !== 'de') {
    await setLanguage(page, LANGUAGE);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.onboarding').waitFor({ state: 'visible' });
  }

  const shot = async (slug) => {
    await page.evaluate(() => document.fonts.ready);
    // A step is pictured from its top, wherever the last tap left it.
    await page.evaluate(() => document.querySelector('.onboarding__body')?.scrollTo(0, 0));
    await page.waitForTimeout(350);
    // What the picture cannot say: whether the step fits the screen, runs
    // wider than it, and which face its text is set in.
    const facts = await page.evaluate(() => {
      const body = document.querySelector('.onboarding__body');
      const title = document.querySelector('.onboarding__title');
      return {
        wider: document.documentElement.scrollWidth > window.innerWidth,
        scrolls: body ? body.scrollHeight - body.clientHeight : 0,
        face: title ? getComputedStyle(title).fontFamily.split(',')[0] : null,
        loaded: [...document.fonts].filter((face) => face.status === 'loaded').map((face) => face.family),
      };
    });
    report.push({ width, slug, ...facts });
    if (!ALL && width !== 393 && !EVERYWHERE.has(slug)) return;
    await page.screenshot({ path: `${OUT}/${width}-${slug}.png` });
  };
  const next = (name = 'Weiter') => page.getByRole('button', { name, exact: true }).click();

  // The opening page before the first slide (D192).
  await shot('0-auftakt');
  await passOpening(page);
  await shot('1-momentum');
  await page.getByRole('button', { name: /Los geht|Get started/ }).click();
  await shot('2-welten');
  await next(LANGUAGE === 'de' ? 'Weiter' : 'Continue');
  await shot('3-rang');
  await next(LANGUAGE === 'de' ? 'Weiter' : 'Continue');
  // The areas as they open, with nothing chosen (D192); then both worlds.
  await shot('4a-bereiche-leer');
  await page.getByRole('button', { name: /^Mind/ }).click();
  await page.getByRole('button', { name: /^Gym/ }).click();
  await shot('4-bereiche');
  await next(LANGUAGE === 'de' ? 'Weiter' : 'Continue');
  // The questions open with none chosen since D197: the start is the empty step.
  await shot('5a-fragen-start');
  await chooseQuestions(page, [/Wie gut hast du gesch|How well did you sleep/, /Wie war deine Stimmung|How was your mood/, /frischen Luft|get outside/]);
  await shot('5-fragen');
  await next(LANGUAGE === 'de' ? 'Weiter' : 'Continue');
  // No target chosen, «Weiter» held (D197); then three sessions and two runs.
  await shot('6a-wochenziele-leer');
  await page
    .getByRole('group', { name: /Gym-Sessions pro Woche|Gym sessions per week/ })
    .getByRole('button', { name: /^3 (pro Woche|per week)$/ })
    .click();
  await page
    .getByRole('group', { name: /Läufe pro Woche|Runs per week/ })
    .getByRole('button', { name: /^2 (pro Woche|per week)$/ })
    .click();
  await shot('6-wochenziele');
  await next(LANGUAGE === 'de' ? 'Weiter' : 'Continue');
  await shot('7-zusammenfassung');
  await ctx.close();
}

// The preview's one extra: the row that opens the onboarding as a rehearsal.
if (URL_PREVIEW) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, locale: 'de-CH', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(URL_PREVIEW, { waitUntil: 'networkidle' });
  await passOpening(page);
  await page.getByRole('button', { name: /Los geht/ }).click();
  for (let index = 0; index < 2; index += 1) await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.getByRole('button', { name: /^Mind/ }).click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await chooseQuestions(page, [/Wie gut hast du gesch/]);
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.getByRole('button', { name: 'Starten' }).click();
  await page.locator('.tab-bar').waitFor();
  await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Einführung ansehen/ }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/393-8-vorschau-einfuehrung.png` });
  await ctx.close();
}

await browser.close();
console.table(report.map(({ loaded, ...row }) => ({ ...row, loaded: loaded.join(' ') })));
