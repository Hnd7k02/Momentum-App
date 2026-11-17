import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, chooseQuestions, clipped, smallTargets, summary } from './lib.mjs';

/**
 * Block 7E — the onboarding, every way through it, in the real build
 * (D190, D191), and the rehearsal of the preview.
 *
 *   A  Mind alone           the three starter questions, one per category,
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

async function device(url, width) {
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
    return {
      wider: document.documentElement.scrollWidth > window.innerWidth + 0.5,
      dark: dark.length,
      darkKinds: dark.every((element) => element.getAttribute('data-world') === 'gym' || element.classList.contains('rank-stage')),
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

/* ── A–D, at every width ───────────────────────────────────────────────── */

for (const width of WIDTHS) {
  const W = `${width}`;
  const problems = [];

  // A: Mind alone, as it opens.
  {
    const { ctx, page } = await device(URL_APP, width);
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
    await area(page, 'Mind').click();
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
  check('E: «Einführung ansehen» opens the onboarding at its first slide, in the light world',
    (await step(page)) === 'momentum' && (await page.evaluate(() => document.documentElement.getAttribute('data-world'))) === null);
  // Other choices than the device's: Mind off, Gym at six, three runs.
  await page.getByRole('button', { name: /Los geht/ }).click();
  await next(page);
  await next(page);
  await area(page, 'Gym').click();
  await area(page, 'Mind').click();
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
