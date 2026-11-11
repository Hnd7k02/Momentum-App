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
 * At the end the same device is looked at 45 days on, with nothing logged
 * since: the Gym hub and Muskelgruppen with an empty range, which must say
 * why it is empty and what is missing (STOP 6b).
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
const HEIGHT = { 320: 693, 360: 780, 393: 852, 430: 932, 440: 956 };
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
/**
 * The weekly-target bubbles (STOP 6b): seven in one row at every width, each
 * a circle, each a target 44px high and as wide as its share of the row —
 * the `::before` counts, as it does for a tap.
 */
async function bubbles(page, W) {
  const rows = await page.evaluate(() => [...document.querySelectorAll('.bubble-row')].map((row) => {
    const grow = (value) => (value.endsWith('px') && parseFloat(value) < 0 ? -parseFloat(value) : 0);
    const items = [...row.querySelectorAll('.bubble')].map((bubble) => {
      const box = bubble.getBoundingClientRect();
      const before = getComputedStyle(bubble, '::before');
      return {
        top: Math.round(box.top),
        round: Math.abs(box.width - box.height) < 0.6,
        targetW: box.width + grow(before.left) + grow(before.right),
        targetH: box.height + grow(before.top) + grow(before.bottom),
      };
    });
    const round1 = (value) => Math.round(value * 10) / 10;
    return {
      count: items.length,
      lines: new Set(items.map((item) => item.top)).size,
      round: items.every((item) => item.round),
      pitch: round1(row.getBoundingClientRect().width / Math.max(1, items.length)),
      targetW: round1(Math.min(...items.map((item) => item.targetW))),
      targetH: round1(Math.min(...items.map((item) => item.targetH))),
    };
  }));
  check(`${W}: the seven target bubbles stand in one row`, rows.length > 0 && rows.every((row) => row.count === 7 && row.lines === 1), short(rows));
  check(`${W}: each bubble is round, and a target 44px high and its share of the row wide`,
    rows.length > 0 && rows.every((row) => row.round && row.targetH >= 43.5 && row.targetW >= Math.min(44, row.pitch) - 0.5), short(rows));
}

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
      // No box in this app scrolls sideways on purpose, so nothing is exempt:
      // a scroll port that scrolls down computes `overflow-x: auto` unless it
      // says `clip`, and would then hide a row wider than its sheet from
      // every other check here. That is a failure of its own.
      // (A text field scrolls its own content; that is the field, not the screen.)
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && !el.matches('textarea, input, select')) {
        out.push(`${String(el.className || el.tagName).slice(0, 40)} can scroll sideways (${el.scrollWidth} in ${el.clientWidth})`);
      }
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
    // A Swiss phone, for everything the app formats itself. The native date
    // fields of the pause form keep headless Chromium's own format; on the
    // device they are the system's.
    locale: 'de-CH',
  });
  await ctx.clock.setSystemTime(berlinNoon(CLOCK_DAY));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  /* ── Onboarding: seven steps, all light ───────────────────────────────── */
  const step = async (slug) => { if (wants('onboarding')) await look(page, width, `onboarding-${slug}`, null); };
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
  if (wants('onboarding')) await bubbles(page, `${width} onboarding`);
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
    await bubbles(page, `${width} Bereiche Gym`);
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
    // The bars (contract §6): neutral, the latest in the colour of its
    // change and never out of view; they start at zero, so a bar's height
    // is its day's share of the largest day; zero and the largest value are
    // named on the left, each on its line; the first and the last date
    // stand beneath.
    const bars = await page.evaluate(() => {
      const box = document.querySelector('.gym-detail__bars');
      const plot = box.getBoundingClientRect();
      const inner = { top: plot.top + box.clientTop, bottom: plot.top + box.clientTop + box.clientHeight };
      const all = [...document.querySelectorAll('.gym-detail__bar')];
      const middle = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return (r.top + r.bottom) / 2;
      };
      const fill = (el) => getComputedStyle(el).backgroundColor;
      const latest = all[all.length - 1];
      // The table beside the chart names every day's best set, newest
      // first: "8 × 60 kg" is 480 kg-reps, the value its bar stands for.
      const scores = [...document.querySelectorAll('.gym-detail .visually-hidden tbody td')]
        .map((el) => el.textContent.match(/([\d.]+)\s*×\s*([\d.]+)/))
        .map((m) => (m ? Number(m[1]) * Number(m[2]) : null))
        .reverse();
      return {
        count: all.length,
        heights: all.map((bar) => Math.round((bar.getBoundingClientRect().height / (inner.bottom - inner.top)) * 1000) / 10),
        scores,
        tallest: Math.round(Math.min(...all.map((bar) => bar.getBoundingClientRect().top)) * 10) / 10,
        baseline: Math.round(inner.bottom * 10) / 10,
        bottoms: Math.round(Math.max(...all.map((bar) => Math.abs(bar.getBoundingClientRect().bottom - inner.bottom))) * 10) / 10,
        max: middle('.gym-detail__axisMax'),
        zero: middle('.gym-detail__axisZero'),
        zeroText: document.querySelector('.gym-detail__axisZero')?.textContent ?? null,
        latestIsLast: latest.classList.contains('gym-detail__bar--latest'),
        coloured: all.filter((bar) => fill(bar) !== fill(all[0])).length,
        latestRight: latest.getBoundingClientRect().right,
        plotRight: plot.right,
        dates: [...document.querySelectorAll('.gym-detail__dates span')].map((span) => span.textContent),
      };
    });
    const peak = Math.max(...bars.scores.filter((score) => score !== null));
    const offScale = bars.scores.length === bars.count
      ? bars.heights.map((height, index) => Math.abs(height - Math.max(8, (bars.scores[index] / peak) * 100)))
      : [Infinity];
    check(`${width}: the bars start at zero — every bar is its day's share of the largest (${bars.count} days)`,
      bars.count > 1 && bars.bottoms <= 0.6 && Math.max(...offScale) <= 1.5,
      short({ heights: bars.heights, scores: bars.scores, off: Math.max(...offScale), bottoms: bars.bottoms }));
    check(`${width}: a fall of a tenth is drawn as a tenth, not as a collapse`,
      Math.min(...bars.heights) >= Math.round((Math.min(...bars.scores) / peak) * 100) - 2, short(bars.heights));
    check(`${width}: the bars' largest value is named at the top of the tallest bar, and zero on the baseline`,
      bars.max !== null && Math.abs(bars.max - bars.tallest) <= 2 && bars.zeroText === '0' && bars.zero !== null && Math.abs(bars.zero - bars.baseline) <= 2,
      short({ max: bars.max, tallest: bars.tallest, zero: bars.zero, baseline: bars.baseline, zeroText: bars.zeroText }));
    check(`${width}: only the latest bar carries a colour, and it is in view`,
      bars.latestIsLast && bars.coloured === 1 && bars.latestRight <= bars.plotRight + 0.5, short(bars));
    check(`${width}: the first and the last date stand beneath the bars`, bars.dates.length === 2 && bars.dates[0] !== bars.dates[1], short(bars.dates));
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
  // Whichever area Bereiche comes back on, the screen is drawn in that
  // area's world and the status bar with it — never one in the other's.
  const backOnGym = (await page.getByRole('radio', { name: 'Gym' }).getAttribute('aria-checked')) === 'true';
  check(`${width}: back in Bereiche the screen is drawn in the world of the area on show (${backOnGym ? 'Gym' : 'Mind'})`,
    (await world(page)) === (backOnGym ? 'gym' : null) && (await themeColour(page)) === (backOnGym ? darkBar : lightBar),
    `${await world(page)} · ${await themeColour(page)}`);
  await page.getByRole('radio', { name: 'Mind' }).click();
  await page.waitForTimeout(700);
  check(`${width}: choosing Mind turns the whole screen back`, (await world(page)) === null && (await themeColour(page)) === lightBar);

  /* ── The same device, 45 days on and nothing logged since (STOP 6b) ───── */
  if (wants('leer')) {
    // Muskelgruppen reads 30 days back; the year's figures on the hub read
    // further. With the last session before the range the screen used to
    // say "Noch nicht trainiert — nach deiner ersten Session …" to someone
    // with months of sessions. It says why now, and what is missing.
    await ctx.clock.setSystemTime(new Date(berlinNoon(CLOCK_DAY).getTime() + 45 * 86_400_000));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1300);
    await tab(page, 'Bereiche');
    await page.getByRole('radio', { name: 'Gym' }).click();
    await page.waitForTimeout(1800);
    await look(page, width, 'gym-uebersicht-ohne-training', 'gym');
    const entry = ((await page.locator('.gym-hub__muscles').innerText()) ?? '').replace(/\s+/g, ' ');
    check(`${width}: the hub's muscle card names the empty range and the last session, not "never trained"`,
      /Kein Training in den letzten 30 Tagen/.test(entry) && /Letzte Session vor \d+ Tagen/.test(entry) && !/Noch nicht trainiert|ersten Session/.test(entry), entry);
    await openMuscles(page, { wait: 4500 });
    await look(page, width, 'muskelgruppen-leer', 'gym');
    const empty = await page.evaluate(() => ({
      said: (document.querySelector('.gym-progress__noData')?.innerText ?? '').replace(/\s+/g, ' '),
      status: document.querySelector('.gym-progress__noData')?.getAttribute('role'),
      primaries: [...document.querySelectorAll('.button--primary')].filter((el) => el.getBoundingClientRect().width > 0).map((el) => el.textContent.trim()),
      rows: [...document.querySelectorAll('.muscle-row')].map((el) => el.innerText.replace(/\s+/g, ' ')),
      overall: document.querySelectorAll('[data-metric="gym-overall"]').length,
    }));
    check(`${width}: an empty range says why, and when the last session was`,
      /^Kein Training in den letzten 30 Tagen Letzte Session: \S+, \d+\. \S+, vor \d+ Tagen\. Die Muskelgruppen zeigen nur den gewählten Zeitraum\.$/.test(empty.said)
        && empty.status === 'status' && !/ersten Session/.test(empty.said), empty.said);
    check(`${width}: it offers the one thing that is missing — exactly one primary action`,
      empty.primaries.length === 1 && empty.primaries[0] === 'Training erfassen', short(empty.primaries));
    check(`${width}: nothing is drawn as progress: ten untrained rows, no overall figure`,
      empty.rows.length === 10 && empty.rows.every((row) => /Noch nicht trainiert/.test(row)) && empty.overall === 0, short(empty.rows.slice(0, 2)));
    // The range it names is the one on show.
    await page.getByRole('button', { name: '7 Tage' }).click();
    await page.waitForTimeout(1500);
    const seven = ((await page.locator('.gym-progress__noData').innerText()) ?? '').replace(/\s+/g, ' ');
    check(`${width}: and it names the range on show`, /^Kein Training in den letzten 7 Tagen /.test(seven), seven);
    // The action is the hub's own flow: with a plan saved, the chooser.
    await page.getByRole('button', { name: 'Training erfassen' }).click();
    await page.waitForTimeout(900);
    check(`${width}: "Training erfassen" opens the same start as on the hub`,
      (await page.locator('[role="dialog"]').count()) === 1 && (await page.getByText('Training starten').count()) > 0,
      String(await page.locator('[role="dialog"]').count()));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    await page.locator('.gym-session__back').first().click();
    await page.waitForTimeout(700);
  }

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
