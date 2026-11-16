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
import { CHROMIUM, URL_APP, check, summary, phone, seed, seedTraining, seedMuscles, openMuscles, clipped, textContrast, openGroupSheet, closeGroupSheet, sheetExercises, openSheetExercise, closeExercise } from './lib.mjs';

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
 * The weekly-target bubbles (STOP 6b): seven in one row at every width. The
 * button is the target — its own box, 44px high at least and its share of
 * the row wide, touching its neighbours — and the circle drawn inside it is
 * round and fits.
 */
async function bubbles(page, W) {
  const rows = await page.evaluate(() => [...document.querySelectorAll('.bubble-row')].map((row) => {
    const round1 = (value) => Math.round(value * 10) / 10;
    const items = [...row.querySelectorAll('.bubble')].map((bubble) => {
      const box = bubble.getBoundingClientRect();
      const circle = getComputedStyle(bubble, '::before');
      return { box, circleW: parseFloat(circle.width), circleH: parseFloat(circle.height) };
    });
    return {
      count: items.length,
      lines: new Set(items.map((item) => Math.round(item.box.top))).size,
      pitch: round1(row.getBoundingClientRect().width / Math.max(1, items.length)),
      targetW: round1(Math.min(...items.map((item) => item.box.width))),
      targetH: round1(Math.min(...items.map((item) => item.box.height))),
      // Between two neighbours' targets: nothing dead, nothing shared.
      seam: round1(Math.max(...items.slice(1).map((item, index) => Math.abs(item.box.left - items[index].box.right)))),
      circle: round1(Math.min(...items.map((item) => item.circleW))),
      round: items.every((item) => Math.abs(item.circleW - item.circleH) < 0.6),
      fits: items.every((item) => item.circleW <= item.box.width + 0.1 && item.circleH <= item.box.height + 0.1 && item.circleW >= 28),
    };
  }));
  check(`${W}: the seven target bubbles stand in one row`, rows.length > 0 && rows.every((row) => row.count === 7 && row.lines === 1), short(rows));
  check(`${W}: each bubble is a target 44px high and its share of the row wide, around a round circle`,
    rows.length > 0 && rows.every((row) => row.round && row.fits && row.targetH >= 43.9 && row.targetW >= Math.min(44, row.pitch) - 0.1), short(rows));
  check(`${W}: neighbouring targets touch — no dead strip, no overlap`, rows.length > 0 && rows.every((row) => row.seam <= 0.1), short(rows));
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
  // A second exercise for the back, which rises while the pulldown holds:
  // the back's two exercises then lie twenty points apart, and its sheet
  // says "uneinheitlich" (contract §7; block 7C). Only the back: the sets
  // carry their own mapping.
  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const q = indexedDB.open('momentum'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    const key = (d) => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const shift = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
    const now = new Date().toISOString();
    const tx = db.transaction(['gymSets', 'exercises'], 'readwrite');
    [[19, 40], [12, 44], [5, 48]].forEach(([back, kg]) => {
      const date = key(shift(-back));
      tx.objectStore('gymSets').put({ id: `design-row-${date}`, sessionId: `mus-gym-${date}`, exerciseId: 'ex_design_row', date,
        weightGrams: kg * 1000, reps: 8, order: 1, muscles: ['back'], primaryMuscles: ['back'], loadType: 'external', createdAt: now });
    });
    tx.objectStore('exercises').put({ id: 'ex_design_row', name: 'Rudern am Kabel', muscles: ['back'], primaryMuscles: ['back'], builtIn: false,
      loadType: 'external', durationSeconds: null, attributes: {}, createdAt: now, updatedAt: now });
    await new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  });
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

    /* The picker of block 7D (D171): the long list under its headings, a
       search, and the empty state — each measured like every screen. */
    await page.locator('.gym-session__bar').getByRole('button', { name: /Übung hinzufügen/ }).click();
    await page.locator('.gym-picker__row').first().waitFor();
    await page.waitForTimeout(500);
    await look(page, width, 'uebung-waehlen', 'gym');
    const picker = await page.evaluate(() => ({
      headings: document.querySelectorAll('.gym-picker__group').length,
      hint: document.querySelector('.gym-picker__hint')?.textContent ?? null,
      hintSize: parseFloat(getComputedStyle(document.querySelector('.gym-picker__hint')).fontSize),
      headingSize: parseFloat(getComputedStyle(document.querySelector('.gym-picker__group')).fontSize),
    }));
    check(`${width} picker: one heading per group and a hint in everyday words, nothing under 11px`,
      picker.headings === 10 && /Name, Muskel, Gerät oder Bewegung/.test(picker.hint ?? '') && picker.hintSize >= 11 && picker.headingSize >= 11, short(picker));
    await page.getByRole('textbox', { name: 'Suchen' }).fill('maschine');
    await page.waitForTimeout(400);
    await look(page, width, 'uebung-suche', 'gym');
    await page.getByRole('textbox', { name: 'Suchen' }).fill('xylophon');
    await page.waitForTimeout(400);
    await look(page, width, 'uebung-leer', 'gym');
    const empty = await page.evaluate(() => ({
      text: document.querySelector('.gym-picker__empty')?.textContent ?? null,
      primaries: document.querySelectorAll('.sheet .button--primary').length,
    }));
    check(`${width} picker: nothing found says what was searched, with "Eigene Übung" the one primary action`,
      /Keine Übung passt zu «xylophon»/.test(empty.text ?? '') && empty.primaries === 1, short(empty));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

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
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
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
    await page.getByRole('button', { name: 'Zurück', exact: true }).first().click();
    await page.waitForTimeout(700);
    await scrollTop(page, '.areas__scroll');
  }

  /* ── Muskelgruppen, the exercise list, one exercise ───────────────────── */
  if (wants('muskeln')) {
    await scrollTop(page, '.areas__scroll');
    await openMuscles(page);
    await look(page, width, 'muskelgruppen', 'gym');
    // The stage of block 7B (contract §8): the header, the metrics strip and
    // the buttons at the top of the stage are among the runs just measured
    // on their rendered pixels — each named here, so that a text that
    // slipped out of the measurement fails as loudly as one that is too pale.
    {
      const runs = Object.entries(measured[width] ?? {}).find(([name]) => name.endsWith('-muskelgruppen'))?.[1] ?? [];
      const of = (part) => runs.filter((run) => String(run.className).includes(part));
      const stageText = {
        title: of('gym-muscles__title'),
        labels: of('muscle-strip__label'),
        values: of('muscle-strip__value'),
        subs: of('muscle-strip__sub'),
        views: of('body-viewer__view'),
      };
      const all = Object.values(stageText).flat();
      check(`${width} muskelgruppen: the header, the three cells of the strip and the three view buttons were measured, each at 4.5:1`,
        stageText.title.length === 1 && stageText.labels.length === 3 && stageText.values.length >= 2 && stageText.subs.length >= 2 && stageText.views.length === 3
          && all.every((run) => run.ratio >= (run.large ? LARGE : BODY)),
        `${Object.entries(stageText).map(([part, list]) => `${part} ${list.length}`).join(', ')} · lowest ${Math.min(...all.map((run) => run.ratio))}`);
      const strip = await page.evaluate(() => {
        const el = document.querySelector('.muscle-strip');
        const r = el.getBoundingClientRect();
        return {
          left: r.left, right: window.innerWidth - r.right,
          cut: [...el.querySelectorAll('span')].filter((span) => span.scrollWidth > span.clientWidth + 1).map((span) => span.textContent.trim()),
          label: el.querySelector('.muscle-strip__label')?.textContent.trim(),
        };
      });
      check(`${width} muskelgruppen: the strip stands inside the side margins and nothing in it is cut — "Leistungstrend" fits`,
        strip.left >= 15.5 && strip.right >= 15.5 && strip.cut.length === 0 && strip.label === 'Leistungstrend', JSON.stringify(strip));
    }
    await scrollTo(page, page.locator('.muscle-rows'), '.areas__scroll', 16);
    await look(page, width, 'muskelgruppen-zeilen', 'gym');
    /*
     * The muscle sheet (block 7C, contract §9): in both heights and in each
     * state of its content — every text at 4.5:1 on its pixels, none under
     * 11px, nothing sideways. Until block 7C a row was a toggle and a list
     * of every exercise stood under the rows; the pictures `-auswahl` and
     * `-uebungen` showed those and are replaced by the sheet's.
     */
    await openGroupSheet(page, 'Brust');
    await look(page, width, 'muskel-sheet', 'gym');
    // Above the fold on the lower height: the name, the change, the range
    // and the whole chart with its dates (contract §9).
    const fold = await page.evaluate(() => {
      const sheet = document.querySelector('.sheet--detents');
      const bottom = (selector) => sheet.querySelector(selector)?.getBoundingClientRect().bottom ?? Infinity;
      return {
        screen: document.documentElement.clientHeight,
        sheetTop: sheet.getBoundingClientRect().top,
        title: bottom('.sheet__title'),
        change: bottom('.muscle-sheet__change'),
        range: bottom('.segmented'),
        chart: bottom('.exercise-line .gym-detail__dates'),
      };
    });
    check(`${width} muskel-sheet: it opens on two thirds of the screen`, Math.abs(fold.sheetTop - fold.screen / 3) <= 2, short(fold));
    check(`${width} muskel-sheet: name, change, range and chart stand above the fold on the lower height`,
      [fold.title, fold.change, fold.range, fold.chart].every((edge) => edge <= fold.screen + 0.5), short(fold));
    const benchInSheet = (await sheetExercises(page)).find((entry) => entry.name === 'Bankdrücken') ?? null;

    await page.locator('.sheet__grabber').click();
    await page.waitForTimeout(700);
    const upper = await page.evaluate(() => {
      const sheet = document.querySelector('.sheet--detents');
      return { top: sheet.getBoundingClientRect().top, screen: document.documentElement.clientHeight };
    });
    check(`${width} muskel-sheet: the grabber takes it to 92 % of the screen`, Math.abs(upper.top - upper.screen * 0.08) <= 2, short(upper));
    await look(page, width, 'muskel-sheet-gross', 'gym');
    // Thirteen weeks of work volume stand in the width, on an axis.
    await page.locator('.sheet--detents .segmented__option', { hasText: '90' }).click();
    await page.waitForTimeout(1200);
    const weeks = await page.evaluate(() => {
      const plot = document.querySelector('.sheet--detents .muscle-volume__plot');
      const slots = [...document.querySelectorAll('.sheet--detents .muscle-volume__slot')].map((slot) => slot.getBoundingClientRect());
      return plot === null
        ? null
        : { count: slots.length, left: Math.min(...slots.map((r) => r.left)), right: Math.max(...slots.map((r) => r.right)), narrowest: Math.min(...slots.map((r) => r.width)), view: document.documentElement.clientWidth };
    });
    check(`${width} muskel-sheet 90: twelve or thirteen weeks stand in the width, each with room for its bar`,
      weeks !== null && weeks.count >= 12 && weeks.count <= 13 && weeks.left >= 15.5 && weeks.right <= weeks.view - 15.5 && weeks.narrowest >= 8, short(weeks));
    await look(page, width, 'muskel-sheet-90', 'gym');
    await page.locator('.sheet--detents .segmented__option', { hasText: '30' }).click();
    await page.waitForTimeout(1200);
    await closeGroupSheet(page);

    // The first group the rows show in each state: which groups those are
    // depends on what this device has logged on its way here.
    const firstIn = (state) =>
      page.evaluate((state) => document.querySelector(`.muscle-row__right--${state}`)?.closest('.muscle-row')?.querySelector('.muscle-row__name')?.textContent ?? null, state);
    for (const [group, slug, words] of [
      ['Rücken', 'muskel-sheet-uneinheitlich', /uneinheitlich/],
      [await firstIn('awaitingBaseline'), 'muskel-sheet-wenig', /Zu wenig Vergleichsdaten.*Übungstage? in den letzten 30 Tagen.*Erfasst/s],
      // "Noch nicht trainiert" is looked at further down, 45 days on: this
      // device has trained all ten groups by now.
    ]) {
      if (group === null) {
        check(`${width} ${slug}: a group in that state is on the screen`, false, 'none of the ten rows');
        continue;
      }
      await openGroupSheet(page, group);
      const text = (await page.locator('.sheet--detents').innerText()).replace(/\s+/g, ' ');
      check(`${width} ${slug}: the sheet of ${group} is in that state`, words.test(text), text.slice(0, 160));
      if (slug !== 'muskel-sheet-uneinheitlich') {
        check(`${width} ${slug}: no chart without a figure`, (await page.locator('.sheet--detents .exercise-line').count()) === 0);
      }
      await look(page, width, slug, 'gym');
      await closeGroupSheet(page);
    }

    // The exercise detail, from the sheet of its group.
    await openGroupSheet(page, 'Brust');
    await openSheetExercise(page, 'Bankdrücken');
    await look(page, width, 'uebungsdetail', 'gym');
    // The line (contract §6; the owner's choice at STOP 5b, D175): each day
    // stands at the exercise's change in the range up to that day — the
    // comparison of its one figure, the median of the last days against the
    // median of the first, as if the range had ended that day (the owner's
    // correction at STOP 7C; until then: its change since the first day
    // shown) — on a scale that
    // reaches 8 % at the least — 12 % until STOP Kurve (D180) — and is
    // never cut off; the zero line is
    // there and named; the line is neutral and only its end point carries
    // a colour — the state of the end value, which stands beside it; the
    // first and the last date stand beneath.
    //
    // Until STOP 5b the detail drew bars, and these five checks held them
    // to the same five things: from zero, a fall of a tenth as a tenth, the
    // scale named on the left, one colour on the latest and in view, the
    // two dates. None is dropped; each states what the line does.
    const line = await page.evaluate(() => {
      // The detail's own chart: the sheet it was opened from is still in the
      // document, out of sight, with a chart of its own.
      const detail = document.querySelector('.gym-detail');
      const plot = detail.querySelector('.exercise-line__plot');
      const svg = detail.querySelector('.exercise-line__svg').getBoundingClientRect();
      const poly = detail.querySelector('.exercise-line__line');
      const points = poly ? poly.getAttribute('points').trim().split(/\s+/).map((pair) => pair.split(',').map(Number)) : [];
      const middle = (el) => { const r = el.getBoundingClientRect(); return (r.top + r.bottom) / 2; };
      const css = (el, prop) => getComputedStyle(el)[prop];
      // A token's colour as the Gym world resolves it on this screen.
      const token = (name) => {
        const probe = document.createElement('span');
        probe.style.color = `var(${name})`;
        plot.appendChild(probe);
        const colour = getComputedStyle(probe).color;
        probe.remove();
        return colour;
      };
      const end = detail.querySelector('.exercise-line__end');
      const endBox = end.getBoundingClientRect();
      const value = detail.querySelector('.exercise-line__value');
      // The table beside the chart names every day's best working set,
      // newest first; a day's value is that set's strength score (D150):
      // "8 × 60 kg" is 60 × (30 + 8) = 2280.
      const scores = [...document.querySelectorAll('.gym-detail .visually-hidden tbody tr')]
        .map((tr) => tr.querySelector('td').textContent.match(/([\d.]+)\s*×\s*([\d.]+)/))
        .map((m) => (m ? Number(m[2]) * (30 + Number(m[1])) : null))
        .reverse();
      return {
        bars: detail.querySelectorAll('.gym-detail__bar, .gym-detail__bars').length,
        points,
        scores,
        labels: [...detail.querySelectorAll('.exercise-line__label')].map((el) => ({ text: el.textContent, y: middle(el) })),
        svg: { top: svg.top, height: svg.height, left: svg.left, width: svg.width },
        zeroY: detail.querySelector('.exercise-line__zero').getBoundingClientRect().top,
        bounds: [...detail.querySelectorAll('.exercise-line__bound')].map((el) => el.getBoundingClientRect().top),
        stroke: poly ? css(poly, 'stroke') : null,
        strokeWidth: poly ? css(poly, 'strokeWidth') : null,
        ink: token('--data-ink'),
        strong: token('--status-strong'),
        weak: token('--status-weak'),
        end: { cls: end.className, fill: css(end, 'backgroundColor'), x: (endBox.left + endBox.right) / 2, y: (endBox.top + endBox.bottom) / 2, right: endBox.right, size: endBox.width },
        value: value ? { text: value.textContent, cls: value.className, left: value.getBoundingClientRect().left, y: middle(value) } : null,
        plotRight: plot.getBoundingClientRect().right,
        dates: [...detail.querySelectorAll('.gym-detail__dates span')].map((span) => span.textContent),
      };
    });
    const percent = (text) => Number(text.replace('−', '-').replace(/[^\d.+-]/g, ''));
    // The comparison of the Stage 5b metric, worked out here from the sets
    // the table names: half the days, rounded down, three at most, at each
    // end; the median of each end.
    const median = (values) => { const sorted = [...values].sort((a, b) => a - b); const middle = sorted.length >> 1; return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };
    const changes = line.scores.map((_, index) => {
      if (index === 0) return 0;
      const upTo = line.scores.slice(0, index + 1);
      const ends = Math.min(3, Math.floor(upTo.length / 2));
      return (median(upTo.slice(-ends)) / median(upTo.slice(0, ends)) - 1) * 100;
    });
    const high = Math.max(0, ...line.labels.map((label) => percent(label.text)));
    const low = Math.min(0, ...line.labels.map((label) => percent(label.text)));
    const expectedY = (change) => ((high - change) / (high - low)) * 100;
    const offLine = line.points.length === changes.length
      ? line.points.map(([x, y], index) => Math.max(Math.abs(y - expectedY(changes[index])), Math.abs(x - (index / (changes.length - 1)) * 100)))
      : [Infinity];
    check(`${width}: the line stands on its days — every point is the change in the range up to its day (${line.points.length} days), and no bar is left`,
      line.points.length > 1 && line.bars === 0 && Math.max(...offLine) <= 0.6,
      short({ points: line.points.slice(0, 4), changes: changes.slice(0, 4).map((v) => Math.round(v * 10) / 10), off: Math.max(...offLine), bars: line.bars }));
    const furthest = Math.max(...changes.map(Math.abs));
    const reach = Math.max(high, -low);
    check(`${width}: a small change looks small — the scale reaches 8 % at the least, widens in steps of four and cuts no day off`,
      reach >= 8 && reach % 4 === 0 && reach === Math.max(8, Math.ceil(furthest / 4 - 1e-9) * 4) &&
        line.points.every(([, y]) => y >= -0.01 && y <= 100.01),
      short({ reach, furthest: Math.round(furthest * 10) / 10, labels: line.labels.map((label) => label.text) }));
    const zeroLabel = line.labels.find((label) => percent(label.text) === 0);
    const named = line.bounds.every((top) => line.labels.some((label) => percent(label.text) !== 0 && Math.abs(label.y - top) <= 2));
    check(`${width}: the zero line is there and named, and the scale's reach is named on its line`,
      Boolean(zeroLabel) && Math.abs(zeroLabel.y - line.zeroY) <= 2 && line.bounds.length >= 1 && named,
      short({ zero: zeroLabel, zeroY: line.zeroY, bounds: line.bounds, labels: line.labels }));
    /*
     * One exercise has one change (D176, block 7C): the one in the range,
     * at the head of the detail with its state and its name — the very
     * figure its row in the sheet carries. Until block 7C the head named
     * the last day against the one before "Veränderung", and the line's
     * end value, the last day against the first, stood beside the line
     * without a name; this check held that end value and its state. The
     * end point now carries the state of the one figure, and no figure
     * stands at the line.
     */
    const head = await page.evaluate(() => {
      const change = document.querySelector('.gym-detail__change');
      return {
        text: change?.textContent ?? null,
        state: [...(change?.classList ?? [])].find((c) => c.startsWith('gym-detail__change--'))?.split('--')[1] ?? null,
        chip: document.querySelector('.gym-detail__head .state-chip')?.textContent ?? null,
        caption: document.querySelector('.gym-detail__caption')?.textContent ?? null,
        labels: [...document.querySelectorAll('.gym-detail__label')].map((label) => label.textContent),
      };
    });
    check(`${width}: the exercise's one change stands at the head with its state and its name — ${head.text}, the sheet's own figure`,
      head.text !== null && head.text === benchInSheet?.change && head.state === benchInSheet?.state && head.chip === benchInSheet?.word &&
        head.caption === 'Bester Arbeitssatz · letzte 30 Tage' && head.labels.join('|') === 'Zuletzt|Davor',
      short({ head, sheet: benchInSheet }));
    const endFill = { improved: line.strong, declined: line.weak, unchanged: line.ink }[head.state];
    const lastPoint = line.points[line.points.length - 1] ?? [0, 0];
    check(`${width}: the line is the neutral ink at 1.5px, and only its end point carries a colour — the state of that one change — in view, with no figure beside it`,
      line.stroke === line.ink && line.strokeWidth === '1.5px' &&
        line.end.cls.includes(`exercise-line__end--${head.state}`) && line.end.fill === endFill && Math.abs(line.end.size - 6) <= 0.5 &&
        Math.abs(line.end.y - (line.svg.top + (lastPoint[1] / 100) * line.svg.height)) <= 1.5 &&
        line.end.right <= line.plotRight + 0.5 &&
        line.value === null,
      short({ stroke: line.stroke, ink: line.ink, width: line.strokeWidth, end: line.end, value: line.value, plotRight: line.plotRight }));
    check(`${width}: the first and the last date stand beneath the line`, line.dates.length === 2 && line.dates[0] !== line.dates[1], short(line.dates));
    // Since STOP 7C the line is the one change day by day, so it ends on it.
    check(`${width}: the line ends on the exercise's one change — ${head.text} at the head, ${Math.round(changes[changes.length - 1] * 10) / 10} % at its end`,
      head.text !== null && percent(head.text) === Math.sign(changes[changes.length - 1]) * Math.round(Math.abs(changes[changes.length - 1]) + 1e-9),
      short({ head: head.text, end: changes[changes.length - 1] }));
    await page.locator('.gym-detail .gym-session__scroll').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(400);
    await look(page, width, 'uebungsdetail-tage', 'gym');
    await closeExercise(page);
    check(`${width}: back from the exercise leads into the sheet it was opened from`, (await page.locator('.sheet--detents').count()) === 1 && (await page.locator('.sheet-scrim[data-suspended]').count()) === 0);
    await closeGroupSheet(page);
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
      /Kein Training in den letzten 30 Tagen/.test(entry) && /Letzte Session vor \d+ Tagen/.test(entry) && !/Noch nicht trainiert|ersten Session|Ab dem dritten Übungstag/.test(entry), entry);
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
        && empty.status === 'status' && !/ersten Session|Ab dem dritten Übungstag/.test(empty.said), empty.said);
    check(`${width}: it offers the one thing that is missing — exactly one primary action`,
      empty.primaries.length === 1 && empty.primaries[0] === 'Training erfassen', short(empty.primaries));
    check(`${width}: nothing is drawn as progress: ten untrained rows, no overall figure`,
      empty.rows.length === 10 && empty.rows.every((row) => /Noch nicht trainiert/.test(row)) && empty.overall === 0, short(empty.rows.slice(0, 2)));
    // The sheet of a group the range holds nothing of (block 7C, contract
    // §9, §11): a sentence says what is missing and when the group was last
    // trained, with the one action that supplies it — and no chart.
    await openGroupSheet(page, 'Brust');
    const untrained = (await page.locator('.sheet--detents').innerText()).replace(/\s+/g, ' ');
    check(`${width} muskel-sheet-nicht-trainiert: the sheet says what is missing, when the group was last trained, and offers the one action`,
      /Noch nicht trainiert.*Kein Satz für diese Gruppe in den letzten 30 Tagen\. Zuletzt trainiert am \S+, \d+\. \S+\..*Training erfassen/s.test(untrained) &&
        (await page.locator('.sheet--detents .button--primary').count()) === 1, untrained.slice(0, 200));
    check(`${width} muskel-sheet-nicht-trainiert: no chart without a figure, and no work volume without work`,
      (await page.locator('.sheet--detents .exercise-line').count()) === 0 && (await page.locator('.sheet--detents .muscle-volume').count()) === 0);
    await look(page, width, 'muskel-sheet-nicht-trainiert', 'gym');
    await closeGroupSheet(page);
    // The other range reaches it: the session of 45 days ago lies inside
    // the last 90 days, so the rows carry figures again and nothing is
    // called empty (contract §7: 30 and 90 days).
    await page.getByRole('button', { name: '90 Tage', exact: true }).click();
    await page.waitForTimeout(2500);
    const ninety = await page.evaluate(() => ({
      empty: document.querySelectorAll('.gym-progress__noData').length,
      figures: document.querySelectorAll('.muscle-row__delta').length,
      overall: (document.querySelector('[data-metric="gym-overall"]')?.textContent ?? '').replace(/\s+/g, ' '),
      primaries: [...document.querySelectorAll('.button--primary')].filter((el) => el.getBoundingClientRect().width > 0).length,
      range: [...document.querySelectorAll('.progress__ranges .segmented__option')].map((el) => `${el.textContent.trim()}${el.getAttribute('aria-pressed') === 'true' ? '*' : ''}`),
    }));
    check(`${width}: at 90 days the session of 45 days ago appears: rows with figures, a trend, nothing called empty`,
      ninety.empty === 0 && ninety.figures > 0 && /^Leistungstrend/.test(ninety.overall) && ninety.primaries === 0
        && JSON.stringify(ninety.range) === JSON.stringify(['30 Tage', '90 Tage*']), short(ninety));
    await look(page, width, 'muskelgruppen-90-tage', 'gym');
    // Back on 30 days, the default, the range is empty again and says so.
    await page.getByRole('button', { name: '30 Tage', exact: true }).click();
    await page.waitForTimeout(1500);
    const thirty = ((await page.locator('.gym-progress__noData').innerText()) ?? '').replace(/\s+/g, ' ');
    check(`${width}: and it names the range on show`, /^Kein Training in den letzten 30 Tagen /.test(thirty), thirty);
    // The action is the hub's own flow: with a plan saved, the chooser.
    await page.getByRole('button', { name: 'Training erfassen' }).click();
    await page.waitForTimeout(900);
    check(`${width}: "Training erfassen" opens the same start as on the hub`,
      (await page.locator('[role="dialog"]').count()) === 1 && (await page.getByText('Training starten').count()) > 0,
      String(await page.locator('[role="dialog"]').count()));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    await page.locator('.gym-muscles__back').first().click();
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
