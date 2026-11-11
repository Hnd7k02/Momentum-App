import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, onboard, openMuscles, phone, seed, summary, textContrast } from './lib.mjs';

/**
 * The colour rules of the muscle status (contract §7), on the production
 * build, on a fixed day.
 *
 * One seeded history per case, each group trained by exercises of its own so
 * that its change is known by hand:
 *
 *   rule     every one of the ten rows: the state fits the printed figure
 *            (−2 … +2 held, from ±3 the direction); a group with too little
 *            to compare shows the chip and no line; "n von 10" counts
 *            exactly the rows with a figure; the trend above is their mean
 *            and carries its state; the hub's card says the same
 *   range    Muskelgruppen offers 30 and 90 days and opens on 30; at 90 a
 *            group appears that 30 no longer reaches; Verlauf keeps 7 and 30
 *   neutral  "Gehalten" is the text colour and never the warning yellow —
 *            row, list, detail, hub marker
 *   legend   ⓘ in the header (44px, named) opens the sheet with the
 *            contract's sentence word for word and the five states; the row
 *            of five states stands under the body
 *   words    "Leistungstrend", "Zu wenig Vergleichsdaten"; none of the
 *            replaced words anywhere on the Gym screens
 *
 * `SHOTS=<dir>` (default docs/design/wp3/farbregeln) receives the
 * screenshots of the block at 320, 360, 393 and 430 and the five pictures of
 * the body; `WIDTHS=393` narrows the run. `CLOCK=YYYY-MM-DD`, default
 * 2026-11-11.
 */
const OUT = process.env.SHOTS ?? 'docs/design/wp3/farbregeln';
mkdirSync(OUT, { recursive: true });
const CLOCK = process.env.CLOCK ?? '2026-11-11';
const TZ = 'Europe/Berlin';
const WIDTHS = (process.env.WIDTHS ?? '320,360,393,430').split(',').map(Number);
const HEIGHT = { 320: 693, 360: 780, 393: 852, 430: 932 };
const NBSP = ' ';
const MINUS = '−';

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const short = (value, n = 240) => {
  const s = typeof value === 'string' ? value : (JSON.stringify(value) ?? String(value));
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

function berlinNoon(day) {
  for (const offset of ['+02:00', '+01:00']) {
    const instant = new Date(`${day}T12:00:00${offset}`);
    const hour = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(instant);
    if (hour === '12') return instant;
  }
  throw new Error(`no Berlin noon for ${day}`);
}

/* ── the histories ───────────────────────────────────────────────────── */

const GROUPS = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'core', 'quadriceps', 'hamstringsGlutes', 'calves', 'forearms'];
const NAME = {
  chest: 'Brust', back: 'Rücken', shoulders: 'Schultern', biceps: 'Bizeps', triceps: 'Trizeps', core: 'Rumpf',
  quadriceps: 'Quadrizeps', hamstringsGlutes: 'Beinbeuger und Gesäss', calves: 'Waden', forearms: 'Unterarme',
};

/** One exercise of one group: the days it was done (days back) and the kg of its one set of 10. */
const lift = (group, days, kgs, tag = '') => ({ group, id: `fx_${group}${tag}`, name: `${NAME[group]}-Übung${tag ? ` ${tag}` : ''}`, days, kgs });

/**
 * Mixed: every state, and both edges of the band. Ten reps a set, so a
 * change is the change of the weight.
 *
 * The groups at the edges make their whole change on the last day, because
 * the two figures on screen compare different things: a group's row
 * compares the last day of the range with the first, the exercise list and
 * the detail the last day with the one before. With the change on the last
 * day both read the same number, and the band can be held on both.
 */
const MIXED = [
  lift('chest', [26, 20, 14, 8, 2], [100, 102, 105, 107, 109]),      // +9 %  improved
  lift('back', [19, 12, 5], [55, 55, 55]),                            //  0 %  held
  lift('shoulders', [22, 13, 4], [100, 100, 103]),                    // +3 %  improved, at the edge
  lift('biceps', [21, 11, 3], [50, 50, 51]),                          // +2 %  held, at the edge
  lift('triceps', [23, 12, 6], [50, 50, 49]),                         // −2 %  held, at the edge
  lift('core', [24, 15, 7], [100, 100, 97]),                          // −3 %  declined, at the edge
  lift('quadriceps', [25, 18, 10, 1], [100, 98, 95, 92]),             // −8 %  declined
  lift('hamstringsGlutes', [16, 9], [100, 120]),                      // two exercise days: too little
  lift('calves', [75, 60, 45], [100, 105, 110]),                      // outside 30 days; +10 % at 90
  lift('forearms', [17], [20], 'A'), lift('forearms', [10], [22], 'B'), lift('forearms', [3], [24], 'C'), // three days, none twice
];
const EXPECT_30 = {
  chest: [9, 'improved'], back: [0, 'unchanged'], shoulders: [3, 'improved'], biceps: [2, 'unchanged'],
  triceps: [-2, 'unchanged'], core: [-3, 'declined'], quadriceps: [-8, 'declined'],
  hamstringsGlutes: [null, 'awaitingBaseline'], calves: [null, 'noData'], forearms: [null, 'awaitingBaseline'],
};
/** The mean of the seven rated ratios at 30 days, as the screen prints it. */
const MEAN_30 = ((1.09 + 1 + 1.03 + 1.02 + 0.98 + 0.97 + 0.92) / 7 - 1) * 100;

/** Every group trained three times and unchanged within the band. */
const HELD = GROUPS.map((group, i) => lift(group, [24 - i, 14 - (i % 5), 4 + (i % 3)], [100, 100, 100 + ((i % 5) - 2)]));

/** Held everywhere, and the smallest improvement and decline beside it. */
const EDGE = GROUPS.map((group, i) => {
  const last = { chest: 103, back: 103, quadriceps: 97, hamstringsGlutes: 97 }[group] ?? 100;
  return lift(group, [24 - i, 14 - (i % 5), 4 + (i % 3)], [100, 100, last]);
});

async function seedLifts(page, lifts) {
  return page.evaluate(async ({ lifts }) => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (db, s) => new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const putAll = (db, s, recs) => new Promise((res, rej) => { const tx = db.transaction([s], 'readwrite'); for (const r of recs) tx.objectStore(s).put(r); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    const key = (d) => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const shift = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
    const isoWeek = (d) => { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3); const y = t.getFullYear(); const f = new Date(y, 0, 4, 12); f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3); return `${pad(y, 4)}-W${pad(1 + Math.round((t - f) / (7 * 86400000)))}`; };

    const db = await open();
    const snaps = await all(db, 'configSnapshots');
    const stamp = new Date().toISOString();
    const sessions = new Map();
    const sets = [];
    for (const { group, id, days, kgs } of lifts) {
      days.forEach((back, i) => {
        const at = shift(-back);
        const date = key(at);
        const sessionId = `fx-gym-${date}`;
        if (!sessions.has(sessionId)) {
          sessions.set(sessionId, { id: sessionId, date, weekKey: isoWeek(at), performedAt: new Date(shift(-back).setHours(18, 0, 0, 0)).toISOString(),
            planId: null, note: null, legacyCarryOver: false, configSnapshotId: snaps[0].id, createdAt: stamp, updatedAt: stamp });
        }
        sets.push({ id: `fx-set-${id}-${date}`, sessionId, exerciseId: id, date, weightGrams: Math.round(kgs[i] * 1000), reps: 10,
          order: 0, muscles: [group], primaryMuscles: [group], loadType: 'external', createdAt: stamp });
      });
    }
    const catalogue = lifts.map(({ group, id, name }) => ({
      id, name, muscles: [group], primaryMuscles: [group], builtIn: false, loadType: 'external',
      durationSeconds: null, attributes: {}, createdAt: stamp, updatedAt: stamp,
    }));
    await putAll(db, 'gymSessions', [...sessions.values()]);
    await putAll(db, 'gymSets', sets);
    await putAll(db, 'exercises', catalogue);
    return { sessions: sessions.size, sets: sets.length };
  }, { lifts });
}

async function boot(width, lifts, { sessions = true } = {}) {
  const ctx = await browser.newContext({ ...phone, viewport: { width, height: HEIGHT[width] ?? 852 }, deviceScaleFactor: 2, timezoneId: TZ });
  await ctx.clock.setSystemTime(berlinNoon(CLOCK));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await onboard(page, { gym: 3, running: 2 });
  // `seed` also writes Gym sessions without sets into the last days; an
  // empty range has to be empty of those too.
  if (sessions) await seed(page, { days: 30 });
  if (lifts) await seedLifts(page, lifts);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return { ctx, page, errors };
}

const toHub = async (page) => {
  await page.getByRole('button', { name: 'Gym öffnen' }).click();
  await page.waitForTimeout(1500);
};

/** The ten rows, as printed. */
const readRows = (page) =>
  page.evaluate(() => {
    const n = (s) => (s ?? '').replace(/[ \t\n]+/g, ' ').trim();
    return [...document.querySelectorAll('.muscle-row')].map((row) => {
      const right = row.querySelector('.muscle-row__right');
      const delta = row.querySelector('.muscle-row__delta');
      const badge = row.querySelector('.muscle-row__badge');
      const dot = row.querySelector('.muscle-row__dot');
      return {
        name: n(row.querySelector('.muscle-row__name')?.textContent),
        sub: n(row.querySelector('.muscle-row__sub')?.textContent) || null,
        state: [...(right?.classList ?? [])].find((c) => c.startsWith('muscle-row__right--'))?.slice('muscle-row__right--'.length) ?? null,
        delta: delta ? delta.textContent : null,
        deltaColor: delta ? getComputedStyle(delta).color : null,
        word: n(row.querySelector('.muscle-row__state')?.textContent) || null,
        badge: badge ? n(badge.textContent) : null,
        badgeBackground: badge ? getComputedStyle(badge).backgroundColor : null,
        badgeColor: badge ? getComputedStyle(badge).color : null,
        line: row.querySelector('.muscle-row__spark') !== null,
        end: [...(row.querySelector('.muscle-row__sparkEnd')?.classList ?? [])].find((c) => c.startsWith('muscle-row__sparkEnd--'))?.slice('muscle-row__sparkEnd--'.length) ?? null,
        dotAlpha: dot ? getComputedStyle(dot).backgroundColor : null,
      };
    });
  });

/** "+12 %", "−3 %", "0 %" → 12, −3, 0. */
const parseShown = (text) => {
  const m = new RegExp(`^([+${MINUS}]?)(\\d+)${NBSP}%$`).exec(text ?? '');
  if (!m) return Number.NaN;
  return m[1] === MINUS ? -Number(m[2]) : Number(m[2]);
};
const stateOfShown = (shown) => (shown >= 3 ? 'improved' : shown <= -3 ? 'declined' : 'unchanged');
const WORD = {
  improved: 'Verbessert', unchanged: 'Gehalten', declined: 'Zurückgegangen',
  awaitingBaseline: 'Zu wenig Vergleichsdaten', noData: 'Noch nicht trainiert',
};
const signed = (value) => `${value > 0 ? '+' : value < 0 ? MINUS : ''}${Math.abs(value)}${NBSP}%`;

/** Resolves the tokens the checks compare computed colours with. */
const tokens = (page) =>
  page.evaluate(() => {
    const probe = document.createElement('span');
    document.querySelector('.screen').appendChild(probe);
    const colour = (name) => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color; };
    const out = Object.fromEntries(
      ['--text-primary', '--text-secondary', '--status-strong-ink', '--status-weak-ink', '--status-mixed', '--status-mixed-ink',
        '--status-mixed-tint', '--sky-ink', '--sky-tint', '--data-ink', '--surface-secondary', '--status-strong', '--status-weak', '--sky-fill']
        .map((name) => [name, colour(name)]),
    );
    probe.remove();
    return out;
  });

/** Every colour drawn on the screen: text, background, border, SVG fill and stroke. */
const coloursOnScreen = (page) =>
  page.evaluate(() => {
    const seen = new Set();
    for (const el of document.querySelectorAll('.screen *')) {
      const s = getComputedStyle(el);
      for (const value of [s.color, s.backgroundColor, s.borderTopColor, s.fill, s.stroke]) seen.add(value);
    }
    return [...seen];
  });

const scrollTo = (page, selector, offset = 8) =>
  page.locator(selector).first().evaluate((el, offset) => {
    const scroller = el.closest('.areas__scroll') ?? el.closest('.gym-session__scroll');
    if (scroller) scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - offset;
  }, offset);
const scrollTop = (page) => page.evaluate(() => { for (const s of document.querySelectorAll('.areas__scroll')) s.scrollTop = 0; });
const shot = (page, width, name) => page.screenshot({ path: `${OUT}/${width}-${name}.png` });

const pressRange = async (page, label) => {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(1400);
};
const waitBody = async (page) => {
  await page.locator('.body-viewer canvas').first().waitFor({ timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
};
/** The runs of text below 4.5:1 (3:1 for large text), as `textContrast` measured them. */
const tooFaint = (runs) =>
  runs.filter((r) => r.ratio < (r.large ? 3 : 4.5)).map((r) => `${r.className} "${r.text}" ${r.ratio}`).slice(0, 4);
const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/* ── the rule, the range, the legend, the words: at every width ──────── */

for (const width of WIDTHS) {
  const W = `${width}`;
  const { ctx, page, errors } = await boot(width, MIXED);
  await toHub(page);

  /* The hub's card. */
  const hub = await page.evaluate(() => {
    const n = (s) => (s ?? '').replace(/[ \t\n]+/g, ' ').trim();
    const overall = document.querySelector('.gym-hub__musclesOverall');
    return {
      summary: n(document.querySelector('.gym-hub__musclesSummary')?.textContent),
      overall: overall ? overall.textContent : null,
      overallClass: overall ? overall.className : null,
      overallColor: overall ? getComputedStyle(overall).color : null,
      range: n(document.querySelector('.gym-hub__musclesRange')?.textContent),
      markers: [...document.querySelectorAll('.gym-hub__previewState')].map((el) => [...el.classList].find((c) => c.startsWith('gym-hub__previewState--'))?.split('--')[1] ?? null),
      markerColours: [...document.querySelectorAll('.gym-hub__previewState')].map((el) => getComputedStyle(el).backgroundColor),
    };
  });
  const T = await tokens(page);
  check(`${W}: the hub counts the seven groups whose row will print a figure`, hub.summary === '7 von 10 gewertet', hub.summary);
  check(`${W}: the hub says "Leistungstrend", held, in the text colour`,
    hub.overall === 'Leistungstrend Gehalten' && !/--(improved|declined)/.test(hub.overallClass ?? '') && hub.overallColor === T['--text-primary'], short(hub));
  check(`${W}: the hub's card stays on 30 days`, hub.range === 'Letzte 30 Tage', hub.range);
  check(`${W}: the hub's ten markers are the ten states`, JSON.stringify(hub.markers) === JSON.stringify(GROUPS.map((g) => EXPECT_30[g][1])), hub.markers.join(','));
  check(`${W}: no marker is the warning yellow`, !hub.markerColours.includes(T['--status-mixed']), hub.markerColours.join(' | '));
  check(`${W}: a held marker is the neutral data ink`, hub.markerColours[1] === T['--data-ink'], `${hub.markerColours[1]} vs ${T['--data-ink']}`);
  await scrollTo(page, '.gym-hub__muscles', 96);
  await page.waitForTimeout(300);
  await shot(page, width, 'hub');
  await scrollTop(page);

  /* Muskelgruppen, 30 days. */
  await openMuscles(page, { wait: 1200 });
  await waitBody(page);
  const ranges = await page.locator('.progress__ranges .segmented__option').evaluateAll((els) => els.map((el) => [el.textContent.trim(), el.getAttribute('aria-pressed')]));
  check(`${W}: Muskelgruppen offers 30 and 90 days and opens on 30`, JSON.stringify(ranges) === JSON.stringify([['30 Tage', 'true'], ['90 Tage', 'false']]), short(ranges));

  const rows = await readRows(page);
  check(`${W}: ten rows`, rows.length === 10, String(rows.length));
  let ruleHolds = true;
  const ruleDetail = [];
  for (const row of rows) {
    if (row.delta !== null) {
      const shown = parseShown(row.delta);
      const ok = Number.isInteger(shown) && row.state === stateOfShown(shown) && row.word === WORD[row.state] && row.badge === null;
      if (!ok) { ruleHolds = false; ruleDetail.push(short(row, 120)); }
    } else {
      const ok = (row.state === 'awaitingBaseline' || row.state === 'noData') && row.badge === WORD[row.state] && row.line === false;
      if (!ok) { ruleHolds = false; ruleDetail.push(short(row, 120)); }
    }
  }
  check(`${W}: in every row the state fits the printed figure (−2 … +2 held, from ±3 the direction)`, ruleHolds, ruleDetail.join(' ‖ '));
  for (const group of GROUPS) {
    const row = rows.find((r) => r.name === NAME[group]);
    const [figure, state] = EXPECT_30[group];
    check(`${W}: ${NAME[group]} reads ${figure === null ? WORD[state] : `${signed(figure)} ${WORD[state]}`}`,
      row?.state === state && (figure === null ? row.delta === null : row.delta === signed(figure)), short(row, 160));
  }
  const colourOf = { improved: T['--status-strong-ink'], declined: T['--status-weak-ink'], unchanged: T['--text-primary'] };
  check(`${W}: a rise is green, a fall red, a held figure the text colour`,
    rows.filter((r) => r.delta !== null).every((r) => r.deltaColor === colourOf[r.state]),
    rows.filter((r) => r.delta !== null).map((r) => `${r.name} ${r.state} ${r.deltaColor}`).join(' | '));
  const tooFew = rows.filter((r) => r.state === 'awaitingBaseline');
  check(`${W}: two groups have too little to compare: a blue chip, and no line`,
    tooFew.length === 2 && tooFew.every((r) => r.badge === 'Zu wenig Vergleichsdaten' && r.line === false && r.badgeBackground === T['--sky-tint'] && r.badgeColor === T['--sky-ink']),
    short(tooFew));
  check(`${W}: and each says how many exercise days there are`,
    rows.find((r) => r.name === NAME.hamstringsGlutes)?.sub === `Vor 9 Tagen · 2${NBSP}Übungstage` && rows.find((r) => r.name === NAME.forearms)?.sub === `Vor 3 Tagen · 3${NBSP}Übungstage`,
    short(tooFew.map((r) => r.sub)));
  const untrained = rows.find((r) => r.name === NAME.calves);
  check(`${W}: an untrained group has a neutral chip, a pale dot and no line`,
    untrained?.badge === 'Noch nicht trainiert' && untrained.line === false && untrained.badgeBackground === T['--surface-secondary'] && /rgba\(.*, 0\.4\)/.test(untrained.dotAlpha ?? ''),
    short(untrained));
  check(`${W}: every rated row draws its line, with the end point in the state's colour or neutral when held`,
    rows.filter((r) => r.delta !== null).every((r) => r.line && r.end === r.state), short(rows.filter((r) => r.delta !== null).map((r) => [r.name, r.line, r.end])));

  /* The figure above the rows. */
  const tile = await page.evaluate(() => {
    const n = (s) => (s ?? '').replace(/[ \t\n]+/g, ' ').trim();
    const el = document.querySelector('[data-metric="gym-overall"]');
    const trend = el?.querySelector('.gym-progress__trend');
    return {
      title: n(el?.querySelector('.metric-tile__title, h2, h3')?.textContent),
      number: trend ? trend.textContent : null,
      trendClass: trend?.className ?? null,
      color: trend ? getComputedStyle(trend).color : null,
      scale: n(el?.querySelector('.metric-tile__scale')?.textContent),
      line: n(el?.querySelector('.metric-tile__line')?.textContent),
      text: n(el?.textContent),
    };
  });
  const meanShown = Math.sign(MEAN_30) * Math.round(Math.abs(MEAN_30));
  check(`${W}: the figure above is called "Leistungstrend"`, tile.text.startsWith('Leistungstrend'), tile.text);
  check(`${W}: it is the mean of the rated groups, ${signed(meanShown)}, with its state in words`,
    tile.number === signed(meanShown) && tile.scale === WORD[stateOfShown(meanShown)], short(tile));
  check(`${W}: held, it is the text colour`, tile.color === T['--text-primary'] && /--unchanged/.test(tile.trendClass ?? ''), short(tile));
  const withFigure = rows.filter((r) => r.delta !== null).length;
  check(`${W}: "n von 10" names exactly the rows that print a figure`, tile.line === `${withFigure} von 10 Gruppen gewertet` && withFigure === 7, tile.line);

  /* Neutral: no yellow anywhere on this screen. */
  const drawn = await coloursOnScreen(page);
  const yellows = [T['--status-mixed'], T['--status-mixed-ink'], T['--status-mixed-tint']];
  check(`${W}: nothing on Muskelgruppen is drawn in the warning yellow`, !drawn.some((c) => yellows.includes(c)), drawn.filter((c) => yellows.includes(c)).join(' | '));

  /* The row of five states, under the body. */
  const legend = await page.locator('.muscle-legend__item').evaluateAll((els) => els.map((el) => el.textContent.trim()));
  check(`${W}: under the body stands the row of the five states`,
    JSON.stringify(legend) === JSON.stringify(['Verbessert', 'Gehalten', 'Zurückgegangen', 'Zu wenig Vergleichsdaten', 'Noch nicht trainiert']), legend.join(' | '));
  const legendBox = await page.evaluate(() => {
    const list = document.querySelector('.muscle-legend').getBoundingClientRect();
    const body = (document.querySelector('.body-viewer') ?? document.querySelector('.muscle-module__figure')).getBoundingClientRect();
    const first = document.querySelector('.muscle-row').getBoundingClientRect();
    return { belowBody: list.top >= body.bottom - 1, aboveRows: list.bottom <= first.top + 1, hidden: document.querySelector('.muscle-legend').getAttribute('aria-hidden') };
  });
  check(`${W}: between the body and the rows, and silent for assistive technology`, legendBox.belowBody && legendBox.aboveRows && legendBox.hidden === 'true', short(legendBox));
  check(`${W}: nothing is wider than the screen`, (await sideways(page)) <= 0, String(await sideways(page)));

  await shot(page, width, 'muskelgruppen-30-oben');
  await scrollTo(page, '.muscle-legend', 12);
  await page.waitForTimeout(400);
  await shot(page, width, 'muskelgruppen-30-zeilen');
  const contrastRows = tooFaint(await textContrast(page));
  check(`${W}: every text at the rows reads at 4.5:1 (3:1 large)`, contrastRows.length === 0, contrastRows.join(' | '));
  await scrollTop(page);

  /* ⓘ and the legend sheet. */
  const info = page.getByRole('button', { name: 'Legende öffnen' });
  const target = await info.evaluate((el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height, right: Math.round(window.innerWidth - r.right) }; });
  check(`${W}: ⓘ is in the header, named, a 44px target, and wholly on the screen`, target.w >= 44 && target.h >= 44 && target.right >= 0, short(target));
  const titleFits = await page.locator('.gym-muscles__title').evaluate((el) => el.scrollWidth <= el.clientWidth);
  check(`${W}: and the title beside it is not cut`, titleFits);
  await info.click();
  await page.waitForTimeout(700);
  const sheet = await page.evaluate(() => {
    const n = (s) => (s ?? '').replace(/[ \t\n]+/g, ' ').trim();
    const dialog = document.querySelector('[role="dialog"]');
    return {
      open: dialog !== null,
      name: dialog?.getAttribute('aria-label') ?? n(document.getElementById(dialog?.getAttribute('aria-labelledby') ?? '')?.textContent),
      lead: n(dialog?.querySelector('.muscle-legend-sheet__lead')?.textContent),
      states: [...(dialog?.querySelectorAll('.muscle-legend-sheet__state') ?? [])].map((el) => [n(el.querySelector('dt')?.textContent), n(el.querySelector('dd')?.textContent)]),
      note: n(dialog?.querySelector('.muscle-legend-sheet__note')?.textContent),
      overflow: dialog ? dialog.scrollWidth - dialog.clientWidth : null,
    };
  });
  check(`${W}: it opens a sheet named "Legende"`, sheet.open && sheet.name === 'Legende', short(sheet.name));
  check(`${W}: with the contract's sentence, word for word`,
    sheet.lead === 'Die Farbe zeigt, wie sich dein bester Arbeitssatz je Muskelgruppe im gewählten Zeitraum verändert hat. Sie misst Trainingsleistung, nicht Muskelmasse.', sheet.lead);
  check(`${W}: and the five states, each with its rule in words`,
    JSON.stringify(sheet.states) === JSON.stringify([
      ['Verbessert', `Ab +3${NBSP}%`],
      ['Gehalten', `${MINUS}2${NBSP}% bis +2${NBSP}%`],
      ['Zurückgegangen', `Ab ${MINUS}3${NBSP}%`],
      ['Zu wenig Vergleichsdaten', 'Weniger als drei Übungstage im Zeitraum, oder keine Übung an zwei Tagen'],
      ['Noch nicht trainiert', 'Kein Satz im Zeitraum'],
    ]), short(sheet.states, 400));
  check(`${W}: the sheet is not wider than the screen`, sheet.overflow !== null && sheet.overflow <= 0 && (await sideways(page)) <= 0, String(sheet.overflow));
  const contrastSheet = tooFaint(await textContrast(page));
  check(`${W}: every text in the legend sheet reads at 4.5:1 (3:1 large)`, contrastSheet.length === 0, contrastSheet.join(' | '));
  await shot(page, width, 'legende');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  const closed = await page.evaluate(() => ({ dialogs: document.querySelectorAll('[role="dialog"]').length, focus: document.activeElement?.getAttribute('aria-label') ?? null }));
  check(`${W}: Escape closes it and focus returns to ⓘ`, closed.dialogs === 0 && closed.focus === 'Legende öffnen', short(closed));

  /* A group with too little to compare, chosen: the sentence. */
  const pick = async (group) => {
    await page.locator('.muscle-row').filter({ has: page.locator('.muscle-row__name', { hasText: new RegExp(`^${NAME[group]}$`) }) }).locator('.muscle-row__button').click();
    await page.waitForTimeout(500);
    return page.locator('.gym-progress__tooFew').first().textContent().catch(() => null);
  };
  await scrollTo(page, '.muscle-legend', 12);
  const hamSentence = (await page.locator('.gym-progress__tooFew').count()) === 0 ? await pick('hamstringsGlutes') : null;
  check(`${W}: Beinbeuger, chosen, says what is missing`, hamSentence === '2 Übungstage in den letzten 30 Tagen. Ab dem dritten zeigt Momentum einen Leistungstrend.', String(hamSentence));
  const foreSentence = await pick('forearms');
  check(`${W}: Unterarme, with three days and no exercise twice, says that`, foreSentence === '3 Übungstage in den letzten 30 Tagen. Ein Leistungstrend braucht dieselbe Übung an zwei Tagen.', String(foreSentence));
  await pick('forearms'); // toggle off
  check(`${W}: with no group chosen the sentence is gone`, (await page.locator('.gym-progress__tooFew').count()) === 0);

  /* The exercise list and the detail: the same band. */
  const listed = await page.locator('.gym-progress__row').evaluateAll((els) => els.map((el) => {
    const change = el.querySelector('.gym-progress__change');
    return {
      name: el.querySelector('.gym-progress__rowName')?.textContent ?? '',
      text: change?.textContent ?? '',
      kind: [...(change?.classList ?? [])].find((c) => c.startsWith('gym-progress__change--'))?.split('--')[1] ?? null,
      color: change ? getComputedStyle(change).color : null,
    };
  }));
  const ex = (group) => listed.find((e) => e.name === `${NAME[group]}-Übung`);
  check(`${W}: an exercise at +2 % reads "Gehalten", in the text colour`, ex('biceps')?.text === 'Gehalten' && ex('biceps')?.kind === 'unchanged' && ex('biceps')?.color === T['--text-primary'], short(ex('biceps')));
  check(`${W}: one at ${MINUS}2 % too`, ex('triceps')?.text === 'Gehalten' && ex('triceps')?.kind === 'unchanged', short(ex('triceps')));
  check(`${W}: one at +3 % is "+3 %", green`, ex('shoulders')?.text === signed(3) && ex('shoulders')?.kind === 'improved' && ex('shoulders')?.color === T['--status-strong-ink'], short(ex('shoulders')));
  check(`${W}: one at ${MINUS}3 % is "${MINUS}3 %", red`, ex('core')?.text === signed(-3) && ex('core')?.kind === 'declined' && ex('core')?.color === T['--status-weak-ink'], short(ex('core')));
  check(`${W}: one recorded once has too little to compare`, listed.find((e) => e.name === 'Unterarme-Übung A')?.text === 'Zu wenig Vergleichsdaten', short(listed.find((e) => e.name === 'Unterarme-Übung A')));

  await page.locator('.gym-progress__row').filter({ has: page.locator('.gym-progress__rowName', { hasText: /^Bizeps-Übung$/ }) }).click();
  await page.waitForTimeout(900);
  const detail = await page.locator('.gym-detail__figure').nth(2).locator('.gym-detail__value').evaluate((el) => ({ text: el.textContent.trim(), cls: el.className, color: getComputedStyle(el).color }));
  check(`${W}: the exercise detail reads +2 % as "Gehalten", in the text colour`, detail.text === 'Gehalten' && /--unchanged/.test(detail.cls) && detail.color === T['--text-primary'], short(detail));
  const detailDrawn = await coloursOnScreen(page);
  check(`${W}: nothing on the exercise detail is drawn in the warning yellow`, !detailDrawn.some((c) => yellows.includes(c)), detailDrawn.filter((c) => yellows.includes(c)).join(' | '));
  await shot(page, width, 'uebungsdetail-gehalten');
  await page.locator('.gym-detail .gym-session__back').click();
  await page.waitForTimeout(700);
  await page.locator('.gym-progress__row').filter({ has: page.locator('.gym-progress__rowName', { hasText: /^Schultern-Übung$/ }) }).click();
  await page.waitForTimeout(900);
  const detailUp = await page.locator('.gym-detail__figure').nth(2).locator('.gym-detail__value').evaluate((el) => ({ text: el.textContent.trim(), cls: el.className }));
  check(`${W}: and +3 % as "+3 %", improved`, detailUp.text === signed(3) && /--improved/.test(detailUp.cls), short(detailUp));
  await shot(page, width, 'uebungsdetail-verbessert');
  await page.locator('.gym-detail .gym-session__back').click();
  await page.waitForTimeout(900);

  /* 90 days: what 30 no longer reaches. */
  await scrollTop(page);
  await pressRange(page, '90 Tage');
  await waitBody(page);
  const rows90 = await readRows(page);
  const calves90 = rows90.find((r) => r.name === NAME.calves);
  check(`${W}: at 90 days Waden appears: +10 %, improved, last trained 45 days ago`,
    calves90?.delta === signed(10) && calves90?.state === 'improved' && calves90?.sub === 'Vor 45 Tagen', short(calves90));
  check(`${W}: every other row reads as at 30 days`,
    JSON.stringify(rows90.filter((r) => r.name !== NAME.calves).map((r) => [r.name, r.delta, r.state])) === JSON.stringify(rows.filter((r) => r.name !== NAME.calves).map((r) => [r.name, r.delta, r.state])));
  const tile90 = await page.locator('[data-metric="gym-overall"] .metric-tile__line').textContent();
  check(`${W}: and eight groups are rated`, tile90?.trim() === '8 von 10 Gruppen gewertet', String(tile90));
  const sentence90 = await pick('hamstringsGlutes');
  check(`${W}: the sentence names the range on show`, sentence90 === '2 Übungstage in den letzten 90 Tagen. Ab dem dritten zeigt Momentum einen Leistungstrend.', String(sentence90));
  await pick('hamstringsGlutes');
  await scrollTop(page);
  await shot(page, width, 'muskelgruppen-90-oben');
  await scrollTo(page, '.muscle-legend', 12);
  await page.waitForTimeout(400);
  await shot(page, width, 'muskelgruppen-90-zeilen');
  await scrollTop(page);
  await pressRange(page, '30 Tage');
  const rowsBack = await readRows(page);
  check(`${W}: back on 30 days the 30-day rows return exactly`, JSON.stringify(rowsBack) === JSON.stringify(rows));

  /* No replaced word on the Gym screens. */
  const words = await page.evaluate(() => document.querySelector('.screen').textContent);
  check(`${W}: none of the replaced words on Muskelgruppen`, !/Gesamtentwicklung|Noch kein Vergleich|Kein Vergleich|Entwicklung|gewachsen/.test(words), words.match(/Gesamtentwicklung|Noch kein Vergleich|Kein Vergleich|Entwicklung|gewachsen/)?.[0] ?? '');

  /* Verlauf keeps 7 and 30. */
  await page.locator('.tab-bar button', { hasText: 'Verlauf' }).click();
  await page.waitForTimeout(900);
  const verlauf = await page.locator('.progress__ranges .segmented__option').evaluateAll((els) => els.map((el) => el.textContent.trim()));
  check(`${W}: Verlauf keeps 7 and 30 days`, JSON.stringify(verlauf) === JSON.stringify(['7 Tage', '30 Tage']), verlauf.join(' | '));

  check(`${W}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();

  /* An empty range: 45 days on with nothing logged — and 90 reaches it. */
  {
    const empty = await boot(width, MIXED.map((entry) => ({ ...entry, days: entry.days.map((d) => d + 45) })), { sessions: false });
    await toHub(empty.page);
    await openMuscles(empty.page, { wait: 1200 });
    await waitBody(empty.page);
    const said = (await empty.page.locator('.gym-progress__noData').textContent())?.replace(/\s+/g, ' ').trim() ?? '';
    check(`${W}: an empty 30-day range says why, and when the last session was`, /^Kein Training in den letzten 30 Tagen Letzte Session: .*, vor 46 Tagen\./.test(said), said);
    check(`${W}: with nothing coloured there is no row of states to explain`, (await empty.page.locator('.muscle-legend').count()) === 0);
    await shot(empty.page, width, 'muskelgruppen-leer');
    await pressRange(empty.page, '90 Tage');
    await waitBody(empty.page);
    const reached = await readRows(empty.page);
    check(`${W}: at 90 days the sessions of 46 days ago and before are there`, reached.filter((r) => r.delta !== null).length === 7 && (await empty.page.locator('.gym-progress__noData').count()) === 0, short(reached.map((r) => [r.name, r.delta])));
    check(`${W}: empty range: no page errors`, empty.errors.length === 0, empty.errors.join(' | '));
    await empty.ctx.close();
  }
}

/* ── the body: five pictures ─────────────────────────────────────────── */

if (!process.env.NO_BODY) {
  const bodyShot = async (page, name) => {
    const box = await page.locator('.body-viewer').first().boundingBox();
    if (!box) { check(`body ${name}: the 3D body is drawn`, false, 'no .body-viewer'); return; }
    await page.screenshot({ path: `${OUT}/koerper-${name}.png`, clip: box });
    check(`body ${name}: the 3D body is drawn`, box.width > 200 && box.height > 200, `${Math.round(box.width)}×${Math.round(box.height)}`);
  };
  const turn = async (page, label) => {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(3500);
  };
  for (const [name, lifts, back] of [['gemischt', MIXED, true], ['leer', null, false], ['gehalten', HELD, false], ['schwelle', EDGE, true]]) {
    const { ctx, page } = await boot(393, lifts);
    await toHub(page);
    await openMuscles(page, { wait: 1200 });
    await waitBody(page);
    if ((await page.locator('.body-viewer canvas').count()) === 0) {
      check(`body ${name}: WebGL is available to this run`, false, 'the flat figure stood in');
      await ctx.close();
      continue;
    }
    await scrollTo(page, '.muscle-module', 4);
    await page.waitForTimeout(600);
    await bodyShot(page, `${name}-vorne`);
    if (back) {
      await turn(page, 'Hinten');
      await bodyShot(page, `${name}-hinten`);
    }
    await ctx.close();
  }
}

await browser.close();
process.exit(summary() ? 0 : 1);
