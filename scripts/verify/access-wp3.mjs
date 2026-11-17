import { chromium } from 'playwright-core';
import {
  CHROMIUM, URL_APP, check, summary, onboard, seed, seedTraining, seedMuscles, openGymHub, openMuscles,
  openGroupSheet, closeGroupSheet, openSheetExercise, closeExercise, textContrast, smallTargets, clipped,
} from './lib.mjs';

/**
 * Block 9, step 8 — contract §12, what a browser can show of it (D146,
 * D147, D182, D185).
 *
 * One device with a month behind it, at 393 and 320:
 *
 *   less transparency   asked for through Chromium's own media emulation
 *                       ("prefers-reduced-transparency: reduce"), on every
 *                       screen with glass — Heute, Verlauf, Rang, Bereiche,
 *                       the Gym hub, a metric's sheet, Muskelgruppen with its
 *                       sheet, an exercise's detail, a workout: nothing on
 *                       screen blurs what lies under it, every card, sheet
 *                       and bar is solid, and every text still reads at
 *                       4.5:1 on its pixels (3:1 large)
 *   less motion         Muskelgruppen with a sheet: once it stands, nothing
 *                       is still on its way — no animation runs and no
 *                       transition is under way
 *   the page's zoom     is locked nowhere: the viewport allows it and the
 *                       document lets two fingers zoom
 *   the new screens     Muskelgruppen, its sheet, an exercise's detail and
 *                       the picker: every control a 44px target, nothing
 *                       cut off sideways, at both widths
 *   the way a screen    the ten rows each say group, figure and state; the
 *   reader takes        sheet is a named dialog, its chart carries its
 *                       description, closing it gives the focus back to its
 *                       row; the body is no obstacle — nothing in it takes
 *                       the focus without a name
 *
 * Chromium only: the media emulation and the accessibility tree are read
 * through its protocol. The phone itself is the owner's checklist.
 */

const browser = await chromium.launch({ executablePath: CHROMIUM });
const WIDTHS = (process.env.WIDTHS ?? '393,320').split(',').map(Number);
const HEIGHT = { 393: 852, 320: 693, 360: 780, 430: 932 };
const ALL_STATES = /Verbessert|Gehalten|Zurückgegangen|Noch nicht trainiert|Zu wenig Vergleichsdaten/;
const tab = (page, name) => page.locator('.tab-bar__tab', { hasText: name });

async function device(width, { reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: HEIGHT[width] ?? 852 }, deviceScaleFactor: 1, hasTouch: true, locale: 'de-CH', timezoneId: 'Europe/Zurich', reducedMotion });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await onboard(page, { gym: 3, running: 2 });
  await seed(page, { days: 30 });
  await seedTraining(page, { days: 40 });
  await seedMuscles(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return { ctx, page, errors };
}

/** What on screen still blurs, and what is not solid, among the surfaces that are glass by default. */
const glass = (page) =>
  page.evaluate(() => {
    const blurred = [];
    const seeThrough = [];
    for (const el of document.querySelectorAll('body *')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || box.bottom < 0 || box.top > innerHeight) continue;
      const cs = getComputedStyle(el);
      const filter = cs.backdropFilter || cs.webkitBackdropFilter || 'none';
      if (filter !== 'none') blurred.push(`${el.className || el.tagName}: ${filter}`);
      if (el.matches('.card, .sheet, .tab-bar, .gym-session__bar')) {
        const m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor);
        const alpha = m ? Number(m[1].split(',')[3] ?? 1) : 1;
        if (alpha < 1 && !el.closest('[data-world="gym"].stage, .body-stage')) seeThrough.push(`${String(el.className).slice(0, 40)}: ${cs.backgroundColor}`);
      }
    }
    return { blurred: [...new Set(blurred)].slice(0, 6), seeThrough: [...new Set(seeThrough)].slice(0, 6) };
  });

async function lessTransparency(page, width, name) {
  const facts = await glass(page);
  const rows = await textContrast(page);
  const below = rows.filter((row) => row.ratio < (row.large ? 3 : 4.5));
  check(`${width} ${name}: with less transparency nothing blurs and every surface is solid`,
    facts.blurred.length === 0 && facts.seeThrough.length === 0, JSON.stringify(facts).slice(0, 300));
  check(`${width} ${name}: and every text reads at 4.5:1 on its pixels (${rows.length} runs)`,
    rows.length > 0 && below.length === 0, below.map((row) => `${row.className} "${row.text}" ${row.ratio}`).join(' | ').slice(0, 300));
}

for (const width of WIDTHS) {
  /* ── Less transparency, every screen with glass ───────────────────────── */
  {
    const { ctx, page, errors } = await device(width);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
    check(`${width}: the page reports less transparency`, await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches));

    await tab(page, 'Heute').click();
    await page.waitForTimeout(800);
    await lessTransparency(page, width, 'Heute');
    await tab(page, 'Verlauf').click();
    await page.waitForTimeout(1200);
    await lessTransparency(page, width, 'Verlauf');
    await tab(page, 'Rang').click();
    await page.waitForTimeout(1000);
    await lessTransparency(page, width, 'Rang');
    await tab(page, 'Bereiche').click();
    await page.waitForTimeout(800);
    await lessTransparency(page, width, 'Bereiche (Mind)');
    await openGymHub(page, { wait: 1500 });
    await lessTransparency(page, width, 'Gym hub');
    await page.locator('[data-metric="gym-rating"]').first().click();
    await page.waitForTimeout(700);
    await lessTransparency(page, width, 'a metric\'s sheet');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    await openMuscles(page, { wait: 3500 });
    await lessTransparency(page, width, 'Muskelgruppen');
    await openGroupSheet(page, 'Brust');
    await lessTransparency(page, width, 'the muscle sheet');
    await openSheetExercise(page, /^Bankdrücken/);
    await lessTransparency(page, width, 'an exercise\'s detail');
    await closeExercise(page);
    await closeGroupSheet(page);
    await tab(page, 'Heute').click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Session eintragen' }).click();
    await page.waitForTimeout(700);
    const free = page.locator('[role="dialog"]').getByRole('button', { name: 'Freie Session' });
    if ((await free.count()) > 0) { await free.click(); await page.waitForTimeout(700); }
    await page.locator('.gym-session__bar').waitFor({ timeout: 5000 });
    await lessTransparency(page, width, 'a workout');
    check(`${width}: no page errors under less transparency`, errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  /* ── Less motion, Muskelgruppen with a sheet ──────────────────────────── */
  {
    const { ctx, page, errors } = await device(width, { reducedMotion: 'reduce' });
    await openGymHub(page, { wait: 1200 });
    await openMuscles(page, { wait: 3500 });
    await openGroupSheet(page, 'Rücken', { wait: 50 });
    const moving = await page.evaluate(() =>
      document.getAnimations().filter((animation) => animation.playState === 'running').map((animation) => animation.animationName ?? animation.transitionProperty ?? animation.constructor.name));
    check(`${width}: with less motion, once the sheet stands nothing is on its way`, moving.length === 0, moving.slice(0, 5).join(', '));
    await closeGroupSheet(page);

    /* The page's zoom is locked nowhere. */
    const zoom = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '';
      const touch = [document.documentElement, document.body, document.getElementById('root')].map((el) => getComputedStyle(el).touchAction);
      return { meta, touch };
    });
    check(`${width}: the page's zoom is locked nowhere — not by the viewport, not by the document`,
      !/user-scalable\s*=\s*(no|0)/i.test(zoom.meta) && !/maximum-scale\s*=\s*1(\.0)?\b/.test(zoom.meta) && zoom.touch.every((value) => !/none|pan-x pan-y/.test(value)),
      JSON.stringify(zoom));

    /* 44px and nothing cut off on the new screens. */
    const targets = async (name) => {
      const small = (await smallTargets(page, { height: 44, width: 44 })).filter((entry) => !/^bubble /.test(entry));
      const cut = await clipped(page);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 0.5);
      check(`${width} ${name}: every control a 44px target, nothing cut off sideways, no wider than the screen`,
        small.length === 0 && cut.length === 0 && !wide, JSON.stringify({ small: small.slice(0, 4), cut: cut.slice(0, 3), wide }));
    };
    await targets('Muskelgruppen');
    await openGroupSheet(page, 'Brust');
    await targets('the muscle sheet');
    await openSheetExercise(page, /^Bankdrücken/);
    await targets('an exercise\'s detail');
    await closeExercise(page);
    await closeGroupSheet(page);
    await tab(page, 'Heute').click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Session eintragen' }).click();
    await page.waitForTimeout(700);
    const free = page.locator('[role="dialog"]').getByRole('button', { name: 'Freie Session' });
    if ((await free.count()) > 0) { await free.click(); await page.waitForTimeout(700); }
    await page.locator('.gym-session__bar').getByRole('button', { name: /Übung hinzufügen/ }).click();
    await page.waitForTimeout(600);
    await page.getByRole('textbox', { name: 'Suchen' }).fill('bauch');
    await page.waitForTimeout(400);
    await targets('the picker');
    check(`${width}: no page errors with less motion`, errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }
}

/* ── The way a screen reader takes, at 393 ──────────────────────────────── */
{
  const { ctx, page, errors } = await device(393);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const tree = async () => {
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    return nodes.filter((node) => !node.ignored).map((node) => ({
      role: node.role?.value, name: node.name?.value ?? '', description: node.description?.value ?? '',
      focusable: (node.properties ?? []).some((p) => p.name === 'focusable' && p.value?.value === true),
    }));
  };
  await openGymHub(page, { wait: 1200 });
  await openMuscles(page, { wait: 3500 });
  const rows = (await tree()).filter((node) => node.role === 'button' && /^(Brust|Rücken|Schultern|Bizeps|Trizeps|Rumpf|Quadrizeps|Beinbeuger und Gesäss|Waden|Unterarme)\b/.test(node.name));
  const said = rows.map((row) => `${row.name} ${row.description}`);
  check('the ten rows each say their group, their figure or what is missing, and their state in words',
    rows.length === 10 && said.every((text) => ALL_STATES.test(text) && (/[+−]?\d+\s%/.test(text) || /Zu wenig Vergleichsdaten|Noch nicht trainiert/.test(text))),
    said.slice(0, 3).join(' | '));
  const nameless = (await tree()).filter((node) => node.focusable && !node.name.trim() && !['RootWebArea', 'WebArea', 'dialog', 'main'].includes(node.role));
  check('the body is no obstacle: nothing on the screen takes the focus without a name', nameless.length === 0, JSON.stringify(nameless.slice(0, 4)));

  await page.locator('.muscle-row__button[data-muscle="chest"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('.sheet--detents').waitFor({ state: 'visible' });
  await page.waitForTimeout(900);
  const sheet = await tree();
  const dialog = sheet.find((node) => node.role === 'dialog' && /Brust/.test(node.name));
  const chart = sheet.find((node) => node.role === 'img' && /Leistungstrend Brust/.test(`${node.name} ${node.description}`));
  check('the sheet is a dialog named for its group', Boolean(dialog), JSON.stringify(sheet.filter((n) => n.role === 'dialog')));
  check('its chart carries its description', Boolean(chart), JSON.stringify(sheet.filter((n) => n.role === 'img').slice(0, 3)));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-muscle') ?? document.activeElement?.className ?? null);
  check('closing it gives the focus back to its row', focused === 'chest', String(focused));
  check('no page errors on the way a screen reader takes', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
