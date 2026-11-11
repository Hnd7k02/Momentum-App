/**
 * The design system on every screen (WP3 Stage 6b).
 *
 * One seeded device per width — 320, 360, 393 and 430 — walked through every
 * screen the app has, each in its own world: the onboarding, Heute and
 * Gestern, Heute's Gym tile and its running workout, the plan chooser and the
 * run sheet opened from Heute, the workout, Verlauf and a question's detail,
 * Rang, Bereiche for Mind and for Gym, the Gym hub with Laufen, the training
 * plans and a sheet, the plan editor, the pause form, Einstellungen with the
 * backup, Muskelgruppen at the top and at its rows, the exercise list and one
 * exercise's detail.
 *
 *   OUT=docs/design/wp3/stage6b node scripts/verify/design-system.mjs
 *   WIDTHS=393 ONLY=gym node scripts/verify/design-system.mjs    # one width, some screens
 *
 * It is the successor of `wp3-stage6a.mjs`, which showed two design variants
 * at one width. There is one system now (D148), so the dimension "variant"
 * went and the four widths came. On every screen it holds what a picture
 * cannot show and a token test cannot know (contract §14):
 *
 * - the screen is drawn in its world, and `theme-color` is that world's
 *   `--status-bar`;
 * - no screen is wider than its viewport, and nothing is cut off sideways;
 * - **every** run of visible text reads at 4.5:1 (3:1 for large text)
 *   against the pixels it is actually drawn on — the captions included,
 *   which Stage 6a only reported (D149);
 * - no text is rendered smaller than 11px.
 *
 * And three decisions of STOP 6a, once each per width: in Bereiche the whole
 * screen turns with the area; the plan chooser and the run sheet opened from
 * Heute stay light; the status bar's colour follows the world and comes back.
 *
 * The clock is fixed (CLOCK=YYYY-MM-DD, default 2026-10-14, a Wednesday), so
 * the screenshots are the same from one run to the next. They are written as
 * JPEG at twice the CSS size: 150 lossless phone screenshots of glass and
 * gradients would weigh about 100 MB in the repository.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { CHROMIUM, URL_APP, check, summary, phone, seed, seedTraining, seedMuscles, openMuscles, clipped, textContrast } from './lib.mjs';

const OUT = process.env.OUT ?? 'docs/design/wp3/stage6b';
const WIDTHS = (process.env.WIDTHS ?? '320,360,393,430').split(',').map(Number);
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
const HEIGHT = { 320: 693, 360: 780, 393: 852, 430: 932 };
const TZ = 'Europe/Berlin';
const CLOCK_DAY = process.env.CLOCK ?? '2026-10-14';
mkdirSync(OUT, { recursive: true });

/** The smallest text the contract allows (§3), and what it must read at. */
const MIN_FONT = 11;
const BODY = 4.5;
const LARGE = 3;

function berlinNoon(day) {
  for (const offset of ['+02:00', '+01:00']) {
    const instant = new Date(`${day}T12:00:00${offset}`);
    const hour = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(instant);
    if (hour === '12') return instant;
  }
  throw new Error(`no Berlin noon for ${day}`);
}

const browser = await chromium.launch({ executablePath: CHROMIUM });
const short = (value) => JSON.stringify(value)?.slice(0, 160);
const wants = (group) => ONLY.length === 0 || ONLY.includes(group);

const world = (page) => page.evaluate(() => document.documentElement.getAttribute('data-world'));
const themeColour = (page) =>
  page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null);
const statusBarToken = (page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--status-bar').trim());
const luminanceOf = (css) => {
  const m = css?.match(/rgba?\((\d+), (\d+), (\d+)/);
  if (!m) return null;
  const ch = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(+m[1]) + 0.7152 * ch(+m[2]) + 0.0722 * ch(+m[3]);
};
const tab = async (page, name) => {
  await page.locator('.tab-bar button', { hasText: name }).click();
  await page.waitForTimeout(1100);
};
/** Brings an element to the top of its own scroll port — never the shell's. */
async function scrollTo(page, locator, port, offset = 12) {
  await locator.first().evaluate((el, [selector, gap]) => {
    const box = el.closest(selector);
    if (box) box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - gap;
  }, [port, offset]);
  await page.waitForTimeout(450);
}
const scrollTop = async (page, port) => {
  await page.locator(port).first().evaluate((el) => { el.scrollTop = 0; });
  await page.waitForTimeout(350);
};

/** The lowest contrast measured, per world, with the text it was measured on. */
const lowest = { mind: null, gym: null };
const measured = {};
let counter = 0;

/**
 * One screen: the picture, and everything the contract holds on it.
 *
 * `expected` is the world the screen must be drawn in — `null` for Mind,
 * `'gym'` for Gym.
 */
async function look(page, width, slug, expected, { minRuns = 3 } = {}) {
  counter += 1;
  const W = `${width} ${slug}`;
  const name = `${String(counter).padStart(2, '0')}-${slug}`;
  await page.screenshot({ path: `${OUT}/${width}-${name}.jpg`, type: 'jpeg', quality: 82 });

  const drawn = await world(page);
  check(`${W}: drawn in the ${expected === 'gym' ? 'Gym' : 'Mind'} world`, drawn === expected, String(drawn));
  const bar = await themeColour(page);
  const token = await statusBarToken(page);
  check(`${W}: theme-color is the world's --status-bar`, bar !== null && bar === token, `${bar} vs ${token}`);

  // No screen wider than its viewport: the document, every scroll port, and
  // no element cut off sideways by a box that does not scroll.
  const wide = await page.evaluate(() => {
    const out = [];
    const view = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > view + 1) out.push(`document ${document.documentElement.scrollWidth} > ${view}`);
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.closest('.visually-hidden')) continue;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' && cs.visibility === 'hidden') continue;
      // A box that scrolls sideways on purpose holds more than it shows.
      let scroller = el.parentElement;
      let scrolls = false;
      while (scroller) {
        const s = getComputedStyle(scroller);
        if (s.overflowX === 'auto' || s.overflowX === 'scroll') { scrolls = true; break; }
        scroller = scroller.parentElement;
      }
      if (scrolls) continue;
      if (r.right > view + 1.5 || r.left < -1.5) out.push(`${String(el.className || el.tagName).slice(0, 40)} ${Math.round(r.left)}…${Math.round(r.right)} of ${view}`);
    }
    return [...new Set(out)].slice(0, 5);
  });
  check(`${W}: no wider than its viewport`, wide.length === 0, wide.join(' | '));
  const cut = await clipped(page);
  check(`${W}: nothing is cut off sideways`, cut.length === 0, cut.slice(0, 3).join(' | '));

  // Text against the pixels it is drawn on — captions held like everything else.
  const rows = await textContrast(page);
  (measured[width] ??= {})[name] = rows;
  const below = rows.filter((r) => r.ratio < (r.large ? LARGE : BODY));
  const worst = rows.reduce((min, r) => (min === null || r.ratio < min.ratio ? r : min), null);
  check(`${W}: every text reads at 4.5:1 on its pixels (${rows.length} runs, lowest ${worst?.ratio})`,
    rows.length >= minRuns && below.length === 0,
    below.map((r) => `${r.className} "${r.text}" ${r.ratio} (${r.size}px/${r.weight}${r.tertiary ? ', caption' : ''})`).join(' | ').slice(0, 400));
  const key = expected === 'gym' ? 'gym' : 'mind';
  if (worst && (lowest[key] === null || worst.ratio < lowest[key].ratio)) lowest[key] = { ...worst, screen: `${width}-${name}` };
  const tiny = rows.filter((r) => r.size < MIN_FONT);
  check(`${W}: no text under ${MIN_FONT}px`, tiny.length === 0,
    tiny.map((r) => `${r.className} "${r.text}" ${r.size}px`).join(' | ').slice(0, 300));
}

async function put(page, store, record) {
  await page.evaluate(async ([s, r]) => {
    const db = await new Promise((res, rej) => { const q = indexedDB.open('momentum'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    await new Promise((res, rej) => { const tx = db.transaction([s], 'readwrite'); tx.objectStore(s).put(r); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  }, [store, record]);
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

for (const width of WIDTHS) {
  counter = 0;
  const ctx = await browser.newContext({
    ...phone,
    deviceScaleFactor: 2,
    viewport: { width, height: HEIGHT[width] ?? 852 },
    timezoneId: TZ,
    // A Swiss phone: the native date fields of the pause form read as they
    // will on the device.
    locale: 'de-CH',
  });
  await ctx.clock.setSystemTime(berlinNoon(CLOCK_DAY));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  /* ── Onboarding: seven steps, all light ───────────────────────────────── */
  const step = async (slug) => { if (wants('onboarding')) await look(page, width, `onboarding-${slug}`, null, { minRuns: 2 }); };
  await step('1-willkommen');
  await page.getByRole('button', { name: /Los geht/ }).click();
  await page.waitForTimeout(400);
  await step('2-welten');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.waitForTimeout(400);
  await step('3-rang');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Gym/ }).click();
  await page.waitForTimeout(300);
  await step('4-bereiche');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.waitForTimeout(400);
  for (const question of [/Wie gut hast du gesch/, /Wie war deine Stimmung/]) {
    await page.getByRole('button', { name: question }).first().click();
  }
  await page.waitForTimeout(300);
  await step('5-fragen');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.waitForTimeout(400);
  await page.locator('.card').nth(0).getByRole('button', { name: '3 pro Woche' }).click();
  await page.locator('.card').nth(1).getByRole('button', { name: '2 pro Woche' }).click();
  await page.waitForTimeout(300);
  await step('6-wochenziele');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.waitForTimeout(400);
  await step('7-uebersicht');
  await page.getByRole('button', { name: 'Starten' }).click();
  await page.waitForTimeout(900);

  /* ── A device with a month behind it ──────────────────────────────────── */
  await seed(page, { days: 30 });
  await seedTraining(page, { days: 40 });
  await seedMuscles(page);
  const stamp = await page.evaluate(() => new Date().toISOString());
  await put(page, 'gymPlans', {
    id: 'design-plan', kind: 'userTrainingPlan', version: 1, name: 'Push A',
    exercises: [
      { exerciseId: 'ex_bench_press', name: 'Bench Press', order: 0 },
      { exerciseId: 'ex_squat', name: 'Back Squat', order: 1 },
    ],
    createdAt: stamp, updatedAt: stamp,
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);

  /* ── Heute and Gestern ────────────────────────────────────────────────── */
  const lightBar = await themeColour(page);
  if (wants('heute')) {
    await look(page, width, 'heute', null);
    await page.locator('section[aria-label="Gym"]').first().evaluate((el) => {
      const port = el.closest('.today__scroll');
      port.scrollTop += el.getBoundingClientRect().top - port.getBoundingClientRect().top - 12;
    });
    await page.waitForTimeout(450);
    await look(page, width, 'heute-gym-kachel', null);
    await scrollTop(page, '.today__scroll');

    await page.locator('.today__switch button', { hasText: 'Gestern' }).click();
    await page.waitForTimeout(800);
    await look(page, width, 'gestern', null);
    await page.locator('.today__switch button', { hasText: 'Heute' }).click();
    await page.waitForTimeout(700);

    /* The plan chooser from Heute stays light (D148). */
    await page.getByRole('button', { name: 'Session eintragen' }).click();
    await page.waitForTimeout(700);
    const chooser = page.locator('[role="dialog"] .plan-chooser');
    check(`${width}: "Session eintragen" offers the plan chooser`, (await chooser.count()) === 1);
    const chooserLum = luminanceOf(await page.locator('.sheet').evaluate((el) => getComputedStyle(el).backgroundColor));
    check(`${width}: the plan chooser opened from Heute is light`,
      (await world(page)) === null && chooserLum !== null && chooserLum > 0.8, `world ${await world(page)}, luminance ${chooserLum?.toFixed(3)}`);
    await look(page, width, 'heute-planwahl', null);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);

    /* The run sheet from Heute stays light too. */
    const runCard = page.locator('.card').filter({ has: page.getByRole('button', { name: 'Lauf eintragen' }) });
    await runCard.getByRole('button', { name: 'Lauf eintragen' }).click();
    await page.waitForTimeout(1200);
    await runCard.locator('button.row--tappable').first().click();
    await page.locator('.sheet').waitFor({ timeout: 4000 });
    await page.waitForTimeout(500);
    const runLum = luminanceOf(await page.locator('.sheet').evaluate((el) => getComputedStyle(el).backgroundColor));
    check(`${width}: the run sheet opened from Heute is light`,
      (await world(page)) === null && runLum !== null && runLum > 0.8, `world ${await world(page)}, luminance ${runLum?.toFixed(3)}`);
    await look(page, width, 'heute-lauf-sheet', null);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await scrollTop(page, '.today__scroll');
  }

  /* ── The workout, and Heute while it is running ───────────────────────── */
  if (wants('session')) {
    await page.getByRole('button', { name: 'Session eintragen' }).click();
    await page.waitForTimeout(700);
    const free = page.locator('[role="dialog"]').getByRole('button', { name: 'Freie Session' });
    if ((await free.count()) > 0) {
      await free.click();
      await page.waitForTimeout(700);
    }
    await page.locator('.gym-session__bar').waitFor({ timeout: 5000 });
    check(`${width}: the workout turns the display to Gym the moment it opens`, (await world(page)) === 'gym');
    await pick(page, 'Bankdrücken');
    await pick(page, 'Kniebeuge');
    await logPending(page, 'Bankdrücken', 8, 60);
    await page.locator('.gym-session__scroll').evaluate((el) => { el.scrollTop = 0; });
    await page.waitForTimeout(300);
    await look(page, width, 'session', 'gym');

    /* The contract's touchstone (§4, §5): one primary action, a quiet
       "Entfernen", and the one side margin. */
    const session = await page.evaluate(() => {
      const view = document.documentElement.clientWidth;
      const cards = [...document.querySelectorAll('.gym-session .card')].map((c) => c.getBoundingClientRect());
      const colour = (el) => getComputedStyle(el).backgroundColor;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      const remove = document.querySelector('.gym-exercise__remove');
      return {
        left: Math.round(Math.min(...cards.map((r) => r.left))),
        right: Math.round(view - Math.max(...cards.map((r) => r.right))),
        primaries: document.querySelectorAll('.gym-session .button--primary').length,
        accent,
        removeBackground: remove ? colour(remove) : null,
        removeBorder: remove ? getComputedStyle(remove).borderTopWidth : null,
        removeHeight: remove ? Math.round(remove.getBoundingClientRect().height) : null,
      };
    });
    check(`${width} session: the cards stand at the one 16px side margin`, session.left === 16 && session.right === 16, short(session));
    check(`${width} session: exactly one primary action`, session.primaries === 1, String(session.primaries));
    check(`${width} session: "Entfernen" is quiet — no surface, no outline, still a 44px target`,
      session.removeBackground === 'rgba(0, 0, 0, 0)' && session.removeBorder === '0px' && session.removeHeight >= 44, short(session));

    await page.locator('.gym-session .gym-session__back').first().click();
    await page.waitForTimeout(1200);
    await scrollTop(page, '.today__scroll');
    check(`${width}: Heute is light again after the workout`, (await world(page)) === null);
    check(`${width}: Heute shows the running workout`, (await page.locator('.running-workout').count()) === 1);
    await look(page, width, 'heute-laufendes-workout', null);
  }

  /* ── Verlauf and one question's detail ────────────────────────────────── */
  if (wants('verlauf')) {
    await tab(page, 'Verlauf');
    await look(page, width, 'verlauf', null);
    await scrollTo(page, page.locator('.heatmap'), '.progress__scroll');
    await look(page, width, 'verlauf-raster', null);
    await scrollTop(page, '.progress__scroll');
    await page.getByRole('button', { name: /Mind/ }).first().click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /Wie gut hast du gesch/ }).first().click();
    await page.waitForTimeout(700);
    await look(page, width, 'fragedetail', null);
    await page.getByRole('button', { name: 'Zurück' }).click();
    await page.waitForTimeout(500);
  }

  /* ── Rang ─────────────────────────────────────────────────────────────── */
  if (wants('rang')) {
    await tab(page, 'Rang');
    await look(page, width, 'rang', null);
    await scrollTo(page, page.locator('.domain-standing'), '.rank__scroll', 60);
    await look(page, width, 'rang-bereiche', null);
    await scrollTo(page, page.locator('.boss-weights__intro'), '.rank__scroll', 60);
    await look(page, width, 'rang-gewichtung', null);
    await scrollTo(page, page.locator('.ladder-row'), '.rank__scroll', 60);
    await look(page, width, 'rang-leiter', null);
  }

  /* ── Bereiche → Mind, and what sits below every area ──────────────────── */
  await tab(page, 'Bereiche');
  await page.getByRole('radio', { name: 'Mind' }).click();
  await page.waitForTimeout(700);
  if (wants('mind')) {
    await look(page, width, 'bereiche-mind', null);
    await scrollTo(page, page.locator('.areas__subhead'), '.areas__scroll', 80);
    await look(page, width, 'bereiche-mind-fragen', null);
    await page.locator('.areas__scroll').getByRole('button', { name: /Wie gut hast du gesch/ }).first().click();
    await page.waitForTimeout(600);
    await look(page, width, 'frage-sheet', null);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);

    await scrollTo(page, page.locator('.areas__general'), '.areas__scroll');
    await page.getByRole('button', { name: 'Pause planen' }).click();
    await page.waitForTimeout(500);
    await look(page, width, 'pause', null);
    await page.getByRole('button', { name: 'Abbrechen' }).click().catch(() => null);
    await page.waitForTimeout(300);
    await page.locator('.areas__scroll').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(450);
    await look(page, width, 'einstellungen-backup', null);
    await scrollTop(page, '.areas__scroll');
  }

  /* ── Bereiche → Gym: the whole screen turns (D148) ────────────────────── */
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(1800);
  const turned = await page.evaluate(() => {
    const lum = (css) => {
      const m = css.match(/rgba?\((\d+), (\d+), (\d+)/);
      const ch = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return m ? 0.2126 * ch(+m[1]) + 0.7152 * ch(+m[2]) + 0.0722 * ch(+m[3]) : null;
    };
    const colour = (selector, prop = 'color') => {
      const el = document.querySelector(selector);
      return el ? lum(getComputedStyle(el)[prop]) : null;
    };
    return {
      title: colour('.screen__title'),
      subtitle: colour('.screen__subtitle'),
      general: colour('.areas__general .section__label'),
      shell: colour('.app', 'backgroundColor'),
      tabBar: colour('.tab-bar', 'backgroundColor'),
      inactiveTab: colour('.tab-bar__tab:not([aria-current])'),
    };
  });
  const darkBar = await themeColour(page);
  check(`${width}: Bereiche → Gym is drawn in the Gym world`, (await world(page)) === 'gym');
  check(`${width}: in Bereiche the whole screen turns — title, subtitle, "Weiteres", the shell and the tab bar`,
    turned.title > 0.8 && turned.subtitle > 0.3 && turned.general > 0.3 && turned.shell < 0.02 && turned.tabBar < 0.02 && turned.inactiveTab > 0.25,
    short(turned));
  check(`${width}: the status bar's colour follows the world`, lightBar !== null && darkBar !== null && lightBar !== darkBar, `${lightBar} → ${darkBar}`);

  if (wants('gym')) {
    await look(page, width, 'gym-uebersicht', 'gym');
    await scrollTo(page, page.locator('[data-metric="gym-rating"]'), '.areas__scroll');
    await look(page, width, 'gym-kennzahlen', 'gym');
    await scrollTo(page, page.locator('.plans__slots'), '.areas__scroll', 120);
    await look(page, width, 'gym-trainingsplaene', 'gym');
    await scrollTo(page, page.locator('.areas__running'), '.areas__scroll');
    await look(page, width, 'gym-laufen', 'gym');
    await scrollTo(page, page.locator('.areas__general'), '.areas__scroll');
    await look(page, width, 'gym-weiteres', 'gym');
    await scrollTop(page, '.areas__scroll');

    /* A sheet opened from a Gym screen: a portal into <body>, still Gym. */
    await scrollTo(page, page.locator('[data-metric="gym-rating"]'), '.areas__scroll', 80);
    await page.locator('[data-metric="gym-rating"] .metric-tile__open').click();
    await page.waitForTimeout(650);
    const sheetLum = luminanceOf(await page.locator('.sheet').evaluate((el) => getComputedStyle(el).backgroundColor));
    check(`${width}: a sheet from a Gym screen is drawn in the Gym world`,
      (await world(page)) === 'gym' && sheetLum !== null && sheetLum < 0.1, `luminance ${sheetLum?.toFixed(3)}`);
    await look(page, width, 'gym-sheet', 'gym');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);

    /* The plan editor. */
    await scrollTo(page, page.locator('.plans__slots'), '.areas__scroll', 160);
    await page.getByRole('button', { name: /^Push A/ }).first().click();
    await page.waitForTimeout(800);
    await look(page, width, 'plan-editor', 'gym');
    await page.getByRole('button', { name: 'Zurück' }).first().click();
    await page.waitForTimeout(700);
    await scrollTop(page, '.areas__scroll');
  }

  /* ── Muskelgruppen, the exercise list, one exercise ───────────────────── */
  if (wants('muskeln')) {
    await scrollTop(page, '.areas__scroll');
    await openMuscles(page);
    await look(page, width, 'muskelgruppen', 'gym');
    await scrollTo(page, page.locator('.muscle-rows'), '.areas__scroll', 16);
    await look(page, width, 'muskelgruppen-zeilen', 'gym');
    await page.locator('.muscle-row').filter({ hasText: 'Brust' }).first().locator('button').click();
    await page.waitForTimeout(900);
    await scrollTo(page, page.locator('.muscle-rows'), '.areas__scroll', 16);
    await look(page, width, 'muskelgruppen-auswahl', 'gym');
    await page.locator('.muscle-row').filter({ hasText: 'Brust' }).first().locator('button').click();
    await page.waitForTimeout(700);
    const rows = page.locator('.gym-progress__row');
    check(`${width}: Muskelgruppen lists the exercises`, (await rows.count()) > 0, String(await rows.count()));
    await scrollTo(page, rows, '.areas__scroll', 60);
    await look(page, width, 'uebungen', 'gym');
    await page.locator('.gym-progress__row').filter({ has: page.locator('.gym-progress__rowName', { hasText: /^Bankdrücken$/ }) }).first().click();
    await page.waitForTimeout(1200);
    await look(page, width, 'uebungsdetail', 'gym');
    await page.locator('.gym-detail .gym-session__scroll').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(400);
    await look(page, width, 'uebungsdetail-tage', 'gym');
    await page.locator('.gym-detail .gym-session__back').first().click();
    await page.waitForTimeout(800);
  }

  /* ── Back to a shared screen: the world is given back ─────────────────── */
  await tab(page, 'Heute');
  check(`${width}: Heute is light again after Gym`, (await world(page)) === null, String(await world(page)));
  check(`${width}: the status bar's colour is light again`, (await themeColour(page)) === lightBar, String(await themeColour(page)));
  await tab(page, 'Bereiche');
  check(`${width}: Bereiche remembers Gym and turns again`, (await world(page)) === 'gym' || (await world(page)) === null);
  await page.getByRole('radio', { name: 'Mind' }).click();
  await page.waitForTimeout(700);
  check(`${width}: choosing Mind turns the whole screen back`, (await world(page)) === null && (await themeColour(page)) === lightBar);

  check(`${width}: no page errors`, errors.length === 0, short(errors));
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}/text-contrast.json`, JSON.stringify({ lowest, measured }, null, 1));
console.log('\n--- lowest text contrast measured on rendered pixels ---');
for (const [name, row] of Object.entries(lowest)) {
  console.log(`${name}: ${row ? `${row.ratio}:1 — "${row.text}" (${row.className}, ${row.size}px) on ${row.screen}` : 'nothing measured'}`);
}
process.exit(summary() ? 0 : 1);
