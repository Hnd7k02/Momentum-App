import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, chooseQuestions, clipped, passOpening, smallTargets, summary } from './lib.mjs';

/**
 * Block 7E — the onboarding, every way through it, in the real build
 * (D190, D191), and the rehearsal of the preview.
 *
 *   A  Mind alone           the opening page — one line and a faint
 *                           «Screen antippen», no button, no marks, no way
 *                           back (D192, D193): every point of the screen
 *                           lands on the page, which takes the tap; a tap in
 *                           a corner, on the line and on the hint goes on,
 *                           and so does a keyboard on the hint,
 *                           whose focus goes on to «Los geht’s» — then the
 *                           areas with nothing chosen and «Weiter» held
 *                           until a world is (D192);
 *                           the three starter questions, one per category,
 *                           reach storage; Gym and Laufen stay off
 *   B  Gym alone            five sessions and two runs; no question step,
 *                           no question stored
 *   C  Mind and Gym         every starter taken off: «Weiter» waits with the
 *                           owner's words; one question of the library and
 *                           one of the user's own carry the step; three runs
 *   D  Mind taken off       from the question step back to the areas, Mind
 *                           off, and on without a question
 *   every step, every path  no page wider than the screen, nothing cut off
 *                           sideways, every control a 44px target, at most
 *                           one dark surface and it Gym or the rank, the
 *                           hero one picture with nothing to operate
 *   E  the rehearsal        only in a preview build (a database of its own):
 *                           Bereiche → Einstellungen → «Einführung ansehen»
 *                           opens on the same opening page, every point of
 *                           it taking the tap, and
 *                           walks the flow as a new device does, other
 *                           choices made, and every store of the database
 *                           is the same before and after — finished, and
 *                           left by Back; the live build has no such row
 *
 * Needs two builds served:
 *
 *   npm run build && npx vite preview --port 4173 &
 *   VITE_MOMENTUM_DB=momentum-preview npx vite build --outDir dist-preview
 *   npx vite preview --outDir dist-preview --port 4174 &
 *   node scripts/verify/onboarding-7e.mjs
 *
 * `URL_PREVIEW=<url>` points E at another preview build; `WIDTHS=393` runs
 * the paths at one width.
 */
const URL_PREVIEW = process.env.URL_PREVIEW ?? 'http://127.0.0.1:4174/Momentum-App/';
const WIDTHS = (process.env.WIDTHS ?? '320,360,393,430').split(',').map(Number);
const HEIGHT = { 320: 693, 360: 780, 393: 852, 430: 932 };
const STARTERS = ['Wie gut hat dein Alltag heute funktioniert?', 'Wie gut hast du geschlafen?', 'Wie war deine Stimmung heute?'];

const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];

async function device(url, width, { stay = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height: HEIGHT[width] ?? 852 },
    deviceScaleFactor: 1,
    hasTouch: true,
    locale: 'de-CH',
    timezoneId: 'Europe/Berlin',
    serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('.onboarding').waitFor({ state: 'visible' });
  if (!stay) await passOpening(page);
  return { ctx, page };
}

/** Every store of a database, as one comparable text. */
const dump = (page, name) =>
  page.evaluate(async (name) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const out = {};
    for (const store of [...db.objectStoreNames].sort()) {
      out[store] = await new Promise((res, rej) => { const r = db.transaction([store]).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    }
    db.close();
    return JSON.stringify(out);
  }, name);

const stored = (page, name = 'momentum') =>
  page.evaluate(async (name) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (store) => new Promise((res, rej) => { const r = db.transaction([store]).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const domains = (await all('domains')).filter((d) => d.enabled).map((d) => ({ type: d.type, target: d.settings?.targetPerWeek ?? null }));
    const questions = (await all('questions')).sort((a, b) => a.order - b.order).map((q) => q.text);
    db.close();
    return { domains: domains.sort((a, b) => a.type.localeCompare(b.type)), questions };
  }, name);

const step = (page) => page.locator('.onboarding').getAttribute('data-step');
const next = (page) => page.getByRole('button', { name: 'Weiter', exact: true }).click();
const area = (page, name) => page.locator('.world-tile--choice').filter({ has: page.locator('.world-tile__name', { hasText: new RegExp(`^${name}$`) }) });
const target = (page, group, count) => page.getByRole('group', { name: group }).getByRole('button', { name: `${count} pro Woche`, exact: true });

/** The checks every step of every path is held to. */
async function look(page, label) {
  const facts = await page.evaluate(() => {
    const dark = [...document.querySelectorAll('.onboarding [data-world="gym"], .onboarding .rank-stage')].filter(
      (element) => !element.parentElement?.closest('[data-world="gym"]'),
    );
    const hero = document.querySelector('.onboarding-hero');
    // What is drawn dark, not only what is declared so (block 9): a surface
    // painted dark by a stylesheet counts as one, wherever it stands.
    const luminance = (css) => {
      const m = css.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/);
      if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return null;
      const channel = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * channel(Number(m[1])) + 0.7152 * channel(Number(m[2])) + 0.0722 * channel(Number(m[3]));
    };
    const painted = [...document.querySelectorAll('.onboarding *')].filter((element) => {
      const box = element.getBoundingClientRect();
      if (box.width * box.height < 2000) return false;
      const value = luminance(getComputedStyle(element).backgroundColor);
      return value !== null && value < 0.06;
    });
    const paintedTop = painted.filter((element) => !painted.some((other) => other !== element && other.contains(element)));
    const surfaces = new Set([...dark, ...paintedTop.map((element) => element.closest('[data-world="gym"], .rank-stage') ?? element)]);
    return {
      wider: document.documentElement.scrollWidth > window.innerWidth + 0.5,
      dark: surfaces.size,
      darkKinds: [...surfaces].every((element) => element.getAttribute('data-world') === 'gym' || element.classList.contains('rank-stage')),
      heroOperable: hero ? hero.querySelectorAll('button, a[href], input, [tabindex], [role="button"]').length : 0,
      heroRole: hero ? hero.getAttribute('role') : 'img',
    };
  });
  const cut = await clipped(page);
  // 44px both ways (contract §12). A target cell of the seven is excused
  // its width only — it is its share of the row (D163) — never its height.
  const small = (await smallTargets(page, { height: 44, width: 44 })).filter((entry) => {
    const size = / (\d+)x(\d+)$/.exec(entry);
    return !(/^bubble /.test(entry) && size && Number(size[2]) >= 44);
  });
  const ok = !facts.wider && facts.dark <= 1 && facts.darkKinds && facts.heroOperable === 0 && facts.heroRole === 'img' && cut.length === 0 && small.length === 0;
  return ok ? null : `${label}: ${JSON.stringify({ ...facts, cut, small })}`;
}

/**
 * A tap anywhere on the opening page goes on (D193), and the page is what
 * takes it: every point of a grid over the viewport, its edges included,
 * the line in the middle and the hint as much as the empty ground, lands
 * on the opening page and on nothing laid over it. Returns the points that
 * land anywhere else. The taps themselves are proved by real taps.
 */
const missesOfTheScreen = (page) =>
  page.evaluate(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    // The edges in whole pixels: the first and the last row and column of
    // the viewport (a fraction beyond the last is rounded out of it).
    const xs = [0, ...Array.from({ length: 7 }, (_, i) => ((i + 1) * width) / 8), width - 1];
    const ys = [0, ...Array.from({ length: 15 }, (_, i) => ((i + 1) * height) / 16), height - 1];
    const title = document.querySelector('.onboarding__openingTitle')?.getBoundingClientRect();
    const hint = document.querySelector('.onboarding__tap')?.getBoundingClientRect();
    const points = xs.flatMap((x) => ys.map((y) => [x, y]));
    if (title) points.push([title.left + title.width / 2, title.top + title.height / 2], [title.left + 2, title.top + 2]);
    if (hint) points.push([hint.left + hint.width / 2, hint.top + hint.height / 2]);
    return points
      .filter(([x, y]) => !document.elementFromPoint(x, y)?.closest('.onboarding[data-step="opening"]'))
      .map(([x, y]) => `${Math.round(x)},${Math.round(y)} → ${document.elementFromPoint(x, y)?.className ?? 'nothing'}`);
  });

/* ── A–D, at every width ───────────────────────────────────────────────── */

for (const width of WIDTHS) {
  const W = `${width}`;
  const problems = [];

  // A: Mind alone, as it opens.
  {
    const { ctx, page } = await device(URL_APP, width, { stay: true });
    const opening = await page.evaluate(() => {
      const hint = document.querySelector('.onboarding__tap');
      const style = hint ? getComputedStyle(hint) : null;
      const probe = document.createElement('span');
      probe.style.color = 'var(--text-tertiary)';
      document.body.append(probe);
      const tertiary = getComputedStyle(probe).color;
      probe.remove();
      return {
        step: document.querySelector('.onboarding')?.getAttribute('data-step'),
        heading: document.querySelector('.onboarding h1')?.textContent,
        buttons: [...document.querySelectorAll('button')].map((button) => button.textContent.trim()),
        marks: document.querySelectorAll('.onboarding__steps, .onboarding__dot').length,
        hint: style ? { color: style.color === tertiary, size: style.fontSize, weight: style.fontWeight, background: style.backgroundColor } : null,
        page: (() => {
          const root = getComputedStyle(document.querySelector('.onboarding'));
          return { cursor: root.cursor, highlight: root.webkitTapHighlightColor };
        })(),
      };
    });
    check(`${W} A: the flow opens on one line and a faint «Screen antippen» — no button, no marks, no way back (D192, D193)`,
      opening.step === 'opening' && opening.heading === 'Let\u2019s get it started' && JSON.stringify(opening.buttons) === '["Screen antippen"]' && opening.marks === 0,
      JSON.stringify(opening));
    check(`${W} A: the hint is the faintest grey of the contract, 13px regular, on no surface of its own`,
      opening.hint?.color === true && opening.hint.size === '13px' && opening.hint.weight === '400' && opening.hint.background === 'rgba(0, 0, 0, 0)',
      JSON.stringify(opening.hint));
    check(`${W} A: the page shows a hand to a pointer and no browser's tap highlight over the whole screen`,
      opening.page.cursor === 'pointer' && opening.page.highlight === 'rgba(0, 0, 0, 0)', JSON.stringify(opening.page));
    const misses = await missesOfTheScreen(page);
    check(`${W} A: every point of the screen lands on the opening page, which takes the tap — edges, line and hint included (D193)`,
      misses.length === 0, misses.slice(0, 4).join(' | '));
    problems.push(await look(page, `${W} A opening`));
    // A real tap where nothing is drawn, on the line and on the hint, each
    // from a fresh opening page.
    const { width: vw, height: vh } = page.viewportSize();
    const where = await page.evaluate(() => {
      const centre = (selector) => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)];
      };
      return { line: centre('.onboarding__openingTitle'), hint: centre('.onboarding__tap') };
    });
    const taps = {
      'top left': [2, 2], 'top right': [vw - 3, 2], 'bottom left': [2, vh - 3], 'bottom right': [vw - 3, vh - 3],
      'top middle': [Math.round(vw / 2), Math.round(vh / 8)],
      'the line': where.line,
      'between the line and the hint': [Math.round(vw / 2), Math.round((where.line[1] + where.hint[1]) / 2)],
      'the hint': where.hint,
    };
    const refused = [];
    for (const [name, [x, y]] of Object.entries(taps)) {
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator('.onboarding[data-step="opening"]').waitFor({ state: 'visible' });
      await page.touchscreen.tap(x, y);
      const reached = await page.locator('.onboarding[data-step="momentum"]').waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false);
      if (!reached) refused.push(`${name} ${x},${y}`);
    }
    check(`${W} A: a tap in each corner, at the top, on the line, below it and on the hint goes on to the first slide`, refused.length === 0, refused.join(' | '));
    // A keyboard: the control is reached by Tab and goes on by Enter, and
    // the focus goes on to the first slide's button.
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.onboarding[data-step="opening"]').waitFor({ state: 'visible' });
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    await page.keyboard.press('Enter');
    await page.locator('.onboarding[data-step="momentum"]').waitFor({ state: 'visible' });
    const after = await page.evaluate(() => document.activeElement?.textContent?.trim());
    check(`${W} A: a keyboard reaches the control by Tab, goes on by Enter, and its focus goes on to «Los geht’s»`,
      focused === 'Screen antippen' && after === 'Los geht\u2019s', `${focused} → ${after}`);
    check(`${W} A: the first slide is still step one of the marks`,
      (await page.locator('.onboarding__steps').getAttribute('aria-label')) === 'Schritt 1 von 5');
    problems.push(await look(page, `${W} A momentum`));
    // The hero's chart gives the slide what it lacks, down to 64px, and the
    // slide scrolls only when the chart has reached that floor (useFitPlot)
    // — at the phone's height, and again on a screen 200px shorter, which
    // the chart has to refit to.
    const fits = () => page.evaluate(() => {
      const slide = document.querySelector('.onboarding__body');
      const plot = document.querySelector('.onboarding-hero__plot');
      const over = slide.scrollHeight - slide.clientHeight;
      const height = plot.getBoundingClientRect().height;
      return { over, height: Math.round(height), fitted: plot.style.getPropertyValue('--plot-height') !== '', ok: over <= 0.5 || height <= 64.5 };
    });
    const tall = await fits();
    await page.setViewportSize({ width, height: (HEIGHT[width] ?? 852) - 200 });
    await page.waitForTimeout(300);
    const short = await fits();
    await page.setViewportSize({ width, height: HEIGHT[width] ?? 852 });
    await page.waitForTimeout(300);
    const back = await fits();
    check(`${W} A: the slide scrolls only once the hero's chart is at its floor — tall, 200px shorter (fitted), and back`,
      tall.ok && short.ok && short.fitted && short.height < tall.height && back.ok && back.height === tall.height,
      JSON.stringify({ tall, short, back }));
    await page.getByRole('button', { name: /Los geht/ }).click();
    problems.push(await look(page, `${W} A worlds`));
    await next(page);
    problems.push(await look(page, `${W} A rank`));
    await next(page);
    const empty = await page.locator('.world-tile--choice[aria-pressed="true"]').count();
    check(`${W} A: the areas open with nothing chosen, and «Weiter» waits for a world (D192)`,
      empty === 0 && (await page.getByRole('button', { name: 'Weiter', exact: true }).isDisabled()) &&
        (await page.locator('.onboarding__note').textContent())?.trim() === 'Wähle mindestens einen Bereich.');
    problems.push(await look(page, `${W} A domains, none chosen`));
    await area(page, 'Mind').click();
    problems.push(await look(page, `${W} A domains`));
    await next(page);
    const chosen = await page.locator('.category-group .question-pick[aria-pressed="true"] .question-pick__text').allTextContents();
    check(`${W} A: Mind opens with the three starter questions chosen, one per category`, JSON.stringify(chosen) === JSON.stringify(STARTERS), chosen.join(' | '));
    problems.push(await look(page, `${W} A questions`));
    await next(page);
    check(`${W} A: Mind alone goes from the questions straight to the summary`, (await step(page)) === 'summary');
    problems.push(await look(page, `${W} A summary`));
    await page.getByRole('button', { name: 'Starten' }).click();
    await page.locator('.tab-bar').waitFor();
    const result = await stored(page);
    check(`${W} A: storage holds the three starter questions and Mind alone`,
      JSON.stringify(result.questions) === JSON.stringify(STARTERS) && JSON.stringify(result.domains.map((d) => d.type)) === '["mental"]',
      JSON.stringify(result));
    if (width === 393) {
      await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
      await page.waitForTimeout(600);
      check('the live build has no rehearsal of the onboarding', (await page.getByRole('button', { name: /Einführung ansehen/ }).count()) === 0);
    }
    await ctx.close();
  }

  // B: Gym alone, five sessions and two runs.
  {
    const { ctx, page } = await device(URL_APP, width);
    await page.getByRole('button', { name: /Los geht/ }).click();
    await next(page);
    await next(page);
    await area(page, 'Gym').click();
    await next(page);
    check(`${W} B: Gym alone skips the questions`, (await step(page)) === 'sport');
    await target(page, 'Gym-Sessions pro Woche', 5).click();
    await target(page, 'Läufe pro Woche', 2).click();
    problems.push(await look(page, `${W} B sport`));
    await next(page);
    const tiles = await page.locator('.summary__list .world-tile__name').allTextContents();
    check(`${W} B: the summary shows the Gym tile and no Mind tile`, JSON.stringify(tiles) === '["Gym"]', tiles.join(' | '));
    problems.push(await look(page, `${W} B summary`));
    await page.getByRole('button', { name: 'Starten' }).click();
    await page.locator('.tab-bar').waitFor();
    const result = await stored(page);
    check(`${W} B: storage holds Gym at five, Laufen at two, and no question`,
      JSON.stringify(result) === JSON.stringify({ domains: [{ type: 'gym', target: 5 }, { type: 'running', target: 2 }], questions: [] }),
      JSON.stringify(result));
    await ctx.close();
  }

  // C: Mind and Gym; every starter off, then one of the library and one of the user's own.
  {
    const { ctx, page } = await device(URL_APP, width);
    await page.getByRole('button', { name: /Los geht/ }).click();
    await next(page);
    await next(page);
    await area(page, 'Mind').click();
    await area(page, 'Gym').click();
    await next(page);
    await chooseQuestions(page, []);
    const button = page.getByRole('button', { name: 'Weiter', exact: true });
    check(`${W} C: with no question «Weiter» waits`, await button.isDisabled());
    check(`${W} C: and says «Wähl mindestens eine Frage oder nimm Mind ab.»`,
      (await page.locator('.onboarding__note').textContent())?.trim() === 'Wähl mindestens eine Frage oder nimm Mind ab.');
    problems.push(await look(page, `${W} C questions, none`));
    await chooseQuestions(page, [/Hast du heute aufgeräumt/]);
    await page.getByRole('button', { name: /Eigene Frage/ }).click();
    await page.locator('#question-text').fill('Habe ich heute gelesen?');
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
    await page.waitForTimeout(400);
    check(`${W} C: one of the library and one of the user's own: two chosen, «Weiter» free`,
      (await page.locator('.onboarding__note').textContent())?.trim() === '2 ausgewählt' && !(await button.isDisabled()));
    await next(page);
    await target(page, 'Läufe pro Woche', 3).click();
    await next(page);
    problems.push(await look(page, `${W} C summary`));
    await page.getByRole('button', { name: 'Starten' }).click();
    await page.locator('.tab-bar').waitFor();
    const result = await stored(page);
    check(`${W} C: storage holds the two questions, Mind, Gym at three and Laufen at three`,
      JSON.stringify(result) === JSON.stringify({
        domains: [{ type: 'gym', target: 3 }, { type: 'mental', target: null }, { type: 'running', target: 3 }],
        questions: ['Hast du heute aufgeräumt?', 'Habe ich heute gelesen?'],
      }),
      JSON.stringify(result));
    await ctx.close();
  }

  // D: Mind taken off from the question step.
  {
    const { ctx, page } = await device(URL_APP, width);
    await page.getByRole('button', { name: /Los geht/ }).click();
    await next(page);
    await next(page);
    await area(page, 'Mind').click();
    await area(page, 'Gym').click();
    await next(page);
    await chooseQuestions(page, []);
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await area(page, 'Mind').click();
    await next(page);
    check(`${W} D: with Mind off the questions are skipped`, (await step(page)) === 'sport');
    await next(page);
    await page.getByRole('button', { name: 'Starten' }).click();
    await page.locator('.tab-bar').waitFor();
    const result = await stored(page);
    check(`${W} D: storage holds Gym alone, at its default`,
      JSON.stringify(result) === JSON.stringify({ domains: [{ type: 'gym', target: 3 }], questions: [] }), JSON.stringify(result));
    await ctx.close();
  }

  const found = problems.filter(Boolean);
  check(`${W}: every step of every path — not wider than the screen, nothing cut, 44px targets, at most one dark surface (Gym or the rank), the hero a picture with nothing to operate`,
    found.length === 0, found.join(' || '));
}

/* ── E: the rehearsal of the preview ──────────────────────────────────── */

{
  const { ctx, page } = await device(URL_PREVIEW, 393);
  // A device with something on it: set up, and today's first question answered.
  await page.getByRole('button', { name: /Los geht/ }).click();
  await next(page);
  await next(page);
  await area(page, 'Mind').click();
  await area(page, 'Gym').click();
  await next(page);
  await next(page);
  await next(page);
  await page.getByRole('button', { name: 'Starten' }).click();
  await page.locator('.tab-bar').waitFor();
  await page.waitForTimeout(800);
  await page.getByRole('radio', { name: /^7 von 10/ }).first().click();
  await page.waitForTimeout(1200);
  const before = await dump(page, 'momentum-preview');
  check('E: the preview keeps its data in its own database', before.includes('Wie gut hast du geschlafen?') && before.includes('"answers":[{'));

  const openRehearsal = async () => {
    await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
    await page.waitForTimeout(700);
    const row = page.getByRole('button', { name: /Einführung ansehen/ });
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await page.locator('.onboarding').waitFor({ state: 'visible' });
  };

  await openRehearsal();
  check('E: «Einführung ansehen» opens the onboarding at its opening page, in the light world',
    (await step(page)) === 'opening' && (await page.evaluate(() => document.documentElement.getAttribute('data-world'))) === null);
  const rehearsalMisses = await missesOfTheScreen(page);
  check('E: in the rehearsal too, every point of the screen lands on the opening page (D193)',
    rehearsalMisses.length === 0, rehearsalMisses.slice(0, 4).join(' | '));
  await passOpening(page);
  // Other choices than the device's: Mind off, Gym at six, three runs.
  await page.getByRole('button', { name: /Los geht/ }).click();
  await next(page);
  await next(page);
  await area(page, 'Gym').click();
  await next(page);
  await target(page, 'Gym-Sessions pro Woche', 6).click();
  await target(page, 'Läufe pro Woche', 3).click();
  await next(page);
  await page.getByRole('button', { name: 'Starten' }).click();
  await page.locator('.tab-bar').waitFor();
  await page.waitForTimeout(800);
  check('E: walked to its end, it returns to the app', (await page.locator('.onboarding').count()) === 0);
  check('E: and every store is as it was, the answer of today included', (await dump(page, 'momentum-preview')) === before);

  // Left half way, by Back.
  await openRehearsal();
  await passOpening(page);
  await page.getByRole('button', { name: /Los geht/ }).click();
  await next(page);
  await page.goBack();
  await page.locator('.tab-bar').waitFor();
  await page.waitForTimeout(800);
  check('E: Back leaves the rehearsal and returns to the app', (await page.locator('.onboarding').count()) === 0);
  check('E: and leaves nothing of it behind', (await page.evaluate(() => document.documentElement.hasAttribute('data-onboarding'))) === false);
  check('E: every store is still as it was', (await dump(page, 'momentum-preview')) === before);
  check('E: and the live app\'s database was never opened by the preview',
    !(await page.evaluate(async () => (await indexedDB.databases()).some((db) => db.name === 'momentum'))));

  // A reload in the middle of it ends it, too.
  await openRehearsal();
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.tab-bar').waitFor();
  check('E: a reload ends the rehearsal and keeps the data', (await page.locator('.onboarding').count()) === 0 && (await dump(page, 'momentum-preview')) === before);
  await ctx.close();
}

check('no page error', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
process.exit(summary() ? 0 : 1);
