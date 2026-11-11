import { mkdirSync, writeFileSync } from 'node:fs';
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
 * screenshots of the block at 320, 360, 393 and 430 and the pictures of the
 * body; `WIDTHS=393` narrows the run. `CLOCK=YYYY-MM-DD`, default
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
        days: row.querySelector('.muscle-row__days')?.textContent ?? null,
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

/**
 * Everything on the page that can carry a colour, as the browser computed
 * it: text, background (a gradient included), all four borders, outline,
 * shadow, SVG fill and stroke — of every element and of its `::before` and
 * `::after`, the tab bar and an open sheet included. Returned as the list
 * of distinct values, so that a check can look for one colour in any of
 * them, and the number of elements read, so that it cannot pass on nothing.
 */
const coloursOnScreen = (page) =>
  page.evaluate(() => {
    const props = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderRightColor', 'borderBottomColor',
      'borderLeftColor', 'outlineColor', 'boxShadow', 'fill', 'stroke', 'textDecorationColor', 'caretColor'];
    const seen = new Set();
    let elements = 0;
    for (const el of document.querySelectorAll('body *')) {
      elements += 1;
      for (const pseudo of [null, '::before', '::after']) {
        const s = getComputedStyle(el, pseudo);
        if (pseudo && (s.content === 'none' || s.content === 'normal')) continue;
        for (const prop of props) seen.add(s[prop]);
      }
    }
    return { values: [...seen], elements };
  });
/** Every colour written in a computed value, whatever its alpha: `rgb()`, `rgba()` and `color(srgb …)`. */
const coloursIn = (value) => [
  ...[...String(value).matchAll(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]),
  ...[...String(value).matchAll(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/g)].map((m) => [Number(m[1]) * 255, Number(m[2]) * 255, Number(m[3]) * 255]),
];
/**
 * The values among `drawn` that carry one of `colours` — as a solid colour,
 * at any transparency, or as a stop of a gradient or a shadow. Compared by
 * the three channels, so a yellow at 30 % is still the yellow.
 */
const carrying = (drawn, colours) => {
  const wanted = colours.flatMap(coloursIn);
  return drawn.values.filter((value) =>
    coloursIn(value).some(([r, g, b]) => wanted.some(([wr, wg, wb]) => Math.abs(r - wr) <= 1 && Math.abs(g - wg) <= 1 && Math.abs(b - wb) <= 1)));
};

const scrollTo = (page, selector, offset = 8) =>
  page.locator(selector).first().evaluate((el, offset) => {
    const scroller = el.closest('.areas__scroll') ?? el.closest('.gym-session__scroll');
    if (scroller) scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - offset;
  }, offset);
const scrollTop = (page) => page.evaluate(() => { for (const s of document.querySelectorAll('.areas__scroll')) s.scrollTop = 0; });
// The screens as JPEG, like the Stage 6b set; the body's pictures stay PNG, because their pixels are read.
const shot = (page, width, name) => page.screenshot({ path: `${OUT}/${width}-${name}.jpg`, type: 'jpeg', quality: 82 });

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
/**
 * `textContrast` leaves out a run that is not wholly in view or lies under
 * another element, so "nothing is too faint" proves nothing by itself. A
 * check names the runs it is about — by the class of their element (a `dt`
 * or `dd` by its tag) and the start of their text, so that a row's
 * "Gehalten" cannot stand in for the legend's — and holds that each was
 * measured, with its ratio.
 */
const measured = (runs, wanted) =>
  wanted.map(([className, start]) => runs.find((r) => r.className.startsWith(className) && r.text.startsWith(start)) ?? null);
const lowest = (runs) => runs.reduce((min, r) => (min === null || r.ratio < min ? r.ratio : min), null);
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
      // Where the figure's text ends, against the chevron beside it and the card around it.
      overallFits: (() => {
        if (!overall) return null;
        const range = document.createRange();
        range.selectNodeContents(overall);
        const text = range.getBoundingClientRect();
        const chevron = document.querySelector('.gym-hub__muscles .gym-hub__chevron').getBoundingClientRect();
        const card = document.querySelector('.gym-hub__muscles').getBoundingClientRect();
        return { textRight: Math.round(text.right), chevronLeft: Math.round(chevron.left), cardRight: Math.round(card.right), ok: text.right <= chevron.left + 0.5 && text.right <= card.right - 12 };
      })(),
      markers: [...document.querySelectorAll('.gym-hub__previewState')].map((el) => [...el.classList].find((c) => c.startsWith('gym-hub__previewState--'))?.split('--')[1] ?? null),
      markerColours: [...document.querySelectorAll('.gym-hub__previewState')].map((el) => getComputedStyle(el).backgroundColor),
    };
  });
  const T = await tokens(page);
  check(`${W}: the hub counts the seven groups whose row will print a figure`, hub.summary === '7 von 10 gewertet', hub.summary);
  check(`${W}: the hub says "Leistungstrend", held, in the text colour`,
    hub.overall === 'Leistungstrend Gehalten' && !/--(improved|declined)/.test(hub.overallClass ?? '') && hub.overallColor === T['--text-primary'], short(hub));
  check(`${W}: the figure ends before the chevron and inside the card`, hub.overallFits?.ok === true, short(hub.overallFits));
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
    rows.find((r) => r.name === NAME.hamstringsGlutes)?.sub === 'Vor 9 Tagen' && rows.find((r) => r.name === NAME.hamstringsGlutes)?.days === `2${NBSP}Übungstage`
      && rows.find((r) => r.name === NAME.forearms)?.sub === 'Vor 3 Tagen' && rows.find((r) => r.name === NAME.forearms)?.days === `3${NBSP}Übungstage`
      && rows.filter((r) => r.days !== null).length === 2,
    short(rows.map((r) => [r.name, r.sub, r.days])));
  const daysLines = await page.locator('.muscle-row__days').evaluateAll((els) => els.map((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const recency = el.previousElementSibling?.getBoundingClientRect();
    return { lines: range.getClientRects().length, below: Boolean(recency) && el.getBoundingClientRect().top >= recency.bottom - 0.5 };
  }));
  check(`${W}: the count stands on one line of its own, under the recency`, daysLines.length === 2 && daysLines.every((d) => d.lines === 1 && d.below), short(daysLines));
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
  // The scan must be able to see: the three yellows are real, distinct
  // colours here, and the colours it is expected to find are found.
  // …and it sees a yellow that is not a plain colour: at 30 %, in a gradient, in a shadow.
  const [yr, yg, yb] = coloursIn(T['--status-mixed'])[0] ?? [];
  const disguised = { elements: 1, values: [`rgba(${yr}, ${yg}, ${yb}, 0.3)`, `linear-gradient(rgb(0, 0, 0), rgba(${yr}, ${yg}, ${yb}, 0.5))`, `rgb(${yr}, ${yg}, ${yb}) 0px 0px 4px 0px`, `color(srgb ${yr / 255} ${yg / 255} ${yb / 255} / 0.4)`] };
  check(`${W}: the scan for yellow reads the page: ${drawn.elements} elements, and finds the green and the red that are there`,
    new Set(yellows).size === 3 && yellows.every((c) => coloursIn(c).length === 1) && drawn.elements > 150
      && carrying(drawn, [T['--status-strong-ink']]).length > 0 && carrying(drawn, [T['--status-weak-ink']]).length > 0 && carrying(drawn, [T['--sky-tint']]).length > 0
      && carrying(disguised, yellows).length === 4 && carrying(disguised, [T['--status-strong-ink']]).length === 0,
    `${drawn.elements} elements, ${drawn.values.length} values, yellows ${yellows.join(' ')}`);
  check(`${W}: nothing on Muskelgruppen is drawn in the warning yellow — text, fills, borders, shadows, gradients, pseudo-elements`,
    carrying(drawn, yellows).length === 0, carrying(drawn, yellows).join(' | '));

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
  const upperRuns = await textContrast(page);
  const upperNamed = measured(upperRuns, [
    ['muscle-legend__item', 'Verbessert'], ['muscle-legend__item', 'Gehalten'], ['muscle-legend__item', 'Zurückgegangen'],
    ['muscle-legend__item', 'Zu wenig Vergleichsdaten'], ['muscle-legend__item', 'Noch nicht trainiert'],
    ['muscle-row__name', 'Brust'], ['muscle-row__delta', `+9${NBSP}%`], ['muscle-row__state', 'Verbessert'],
    ['muscle-row__delta', `0${NBSP}%`], ['muscle-row__state', 'Gehalten'], ['muscle-row__sub', 'Vor 2 Tagen'],
  ]);
  check(`${W}: the five items of the legend row and the first rows were measured (${upperRuns.length} runs, lowest ${lowest(upperRuns)})`,
    upperRuns.length >= 12 && upperNamed.every(Boolean), upperNamed.map((r, i) => (r ? r.ratio : `missing #${i}`)).join(' '));
  check(`${W}: every text at the rows reads at 4.5:1 (3:1 large)`, tooFaint(upperRuns).length === 0, tooFaint(upperRuns).join(' | '));
  // The lower rows carry the two chips and the red figures; bring them into
  // view, clear of the tab bar, and measure those too.
  await scrollTo(page, '.muscle-row:nth-child(6)', 12);
  await page.waitForTimeout(400);
  const lowerRuns = await textContrast(page);
  const lowerNamed = measured(lowerRuns, [
    ['muscle-row__badge', 'Zu wenig Vergleichsdaten'], ['muscle-row__badge', 'Noch nicht trainiert'],
    ['muscle-row__delta', `${MINUS}3${NBSP}%`], ['muscle-row__delta', `${MINUS}8${NBSP}%`], ['muscle-row__state', 'Zurückgegangen'],
    ['muscle-row__name', 'Waden'], ['muscle-row__sub', 'Vor 9 Tagen'], ['muscle-row__sub muscle-row__days', `2${NBSP}Übungstage`],
  ]);
  check(`${W}: both kinds of chip, the red figures and the count of exercise days were measured (${lowerRuns.length} runs, lowest ${lowest(lowerRuns)})`,
    lowerNamed.every(Boolean), lowerNamed.map((r, i) => (r ? `${r.text} ${r.ratio}` : `missing #${i}`)).join(' · '));
  check(`${W}: the blue chip is the sky ink on the sky tint, measured on its pixels`,
    Boolean(lowerNamed[0]) && lowerNamed[0].ratio >= 4.5, short(lowerNamed[0]));
  check(`${W}: every text at the lower rows reads at 4.5:1 (3:1 large)`, tooFaint(lowerRuns).length === 0, tooFaint(lowerRuns).join(' | '));
  await shot(page, width, 'muskelgruppen-30-zeilen-unten');
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
  const sheetRuns = await textContrast(page);
  const sheetNamed = measured(sheetRuns, [
    ['muscle-legend-sheet__lead', 'Die Farbe zeigt'],
    ['DT', 'Verbessert'], ['DD', 'Ab +3'], ['DT', 'Gehalten'], ['DD', `${MINUS}2`], ['DT', 'Zurückgegangen'], ['DD', `Ab ${MINUS}3`],
    ['DT', 'Zu wenig Vergleichsdaten'], ['DD', 'Weniger als drei'], ['DT', 'Noch nicht trainiert'], ['DD', 'Kein Satz im Zeitraum'],
    ['muscle-legend-sheet__note', 'Ein Übungstag ist'],
  ]);
  check(`${W}: every line of the legend sheet was measured (${sheetRuns.length} runs, lowest ${lowest(sheetRuns)})`,
    sheetNamed.every(Boolean) && sheetRuns.some((r) => r.text === 'Legende'), sheetNamed.map((r, i) => (r ? r.ratio : `missing #${i}`)).join(' '));
  check(`${W}: every text in the legend sheet reads at 4.5:1 (3:1 large)`, tooFaint(sheetRuns).length === 0, tooFaint(sheetRuns).join(' | '));
  const sheetDrawn = await coloursOnScreen(page);
  check(`${W}: nothing in the legend sheet is drawn in the warning yellow`,
    sheetDrawn.elements > drawn.elements && carrying(sheetDrawn, yellows).length === 0, `${sheetDrawn.elements} elements · ${carrying(sheetDrawn, yellows).join(' | ')}`);
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
  check(`${W}: nothing on the exercise detail is drawn in the warning yellow`,
    detailDrawn.elements > 40 && carrying(detailDrawn, yellows).length === 0, `${detailDrawn.elements} elements · ${carrying(detailDrawn, yellows).join(' | ')}`);
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
  // Choosing a row turned the body to that group; the picture is of the front.
  if ((await page.locator('.body-viewer canvas').count()) > 0) {
    await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: 'Vorne', exact: true }).click();
    await page.waitForTimeout(2500);
  }
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

/* ── the body: its pictures, and what their pixels say ───────────────── */

/**
 * The zones a picture of the body is read in, as shares of the frame: the
 * middle sixth of its width — the trunk and the legs, without the
 * shoulders, arms and hands beside them — and three bands of its height.
 * From the front they are the chest, the quadriceps and the calves; from
 * the back the upper back, the hamstrings and the calves.
 */
const ZONES = { upper: [0.26, 0.36], thigh: [0.5, 0.68], calf: [0.72, 0.84] };
const ZONE_X = [0.42, 0.58];

/**
 * The picture of the body as numbers (contract §7, §8). Every pixel that is
 * not the dark card is classified in CIELAB: green or red by its a*, white
 * by its lightness, dimmed below it. With a second picture from the same
 * angle, each zone reports how the lit pixels of the two differ: the share
 * that moved by more than 3 ΔE, and the median — over **all** lit pixels
 * of the zone, moved or not — of the difference and of its three parts:
 * lightness (dL), green–red (dA) and blue–yellow (dB). Read from the PNG
 * the suite saves, so what is measured is what is shown.
 */
const readBody = (page, png, against = null) =>
  page.evaluate(async ({ png, against, zones, zoneX }) => {
    const load = async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      return { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, w: canvas.width, h: canvas.height };
    };
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const lab = (r, g, b) => {
      const R = lin(r), G = lin(g), B = lin(b);
      const fx = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
      const fy = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
      const fz = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
      return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
    };
    const median = (values) => { const s = [...values].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    const round = (v) => (v === null ? null : Math.round(v * 10) / 10);

    const a = await load(png);
    const count = { body: 0, green: 0, red: 0, white: 0, dimmed: 0 };
    let lightness = 0;
    for (let y = 0; y < a.h; y += 2) {
      for (let x = 0; x < a.w; x += 2) {
        const i = (y * a.w + x) * 4;
        const [L, A] = lab(a.data[i], a.data[i + 1], a.data[i + 2]);
        if (L < 45) continue; // the card behind the body
        count.body += 1;
        lightness += L;
        if (A < -5) count.green += 1;
        else if (A > 5) count.red += 1;
        else if (L > 88) count.white += 1;
        else if (L < 80) count.dimmed += 1;
      }
    }
    const share = (n, of) => Math.round((n / Math.max(1, of)) * 1000) / 1000;
    const out = {
      body: count.body, green: share(count.green, count.body), red: share(count.red, count.body),
      white: share(count.white, count.body), dimmed: share(count.dimmed, count.body),
      lightness: round(lightness / Math.max(1, count.body)),
    };
    if (!against) return out;

    const b = await load(against);
    if (b.w !== a.w || b.h !== a.h) return { ...out, sameFrame: false };
    const result = { ...out, sameFrame: true };
    for (const [name, [from, to]] of Object.entries(zones)) {
      const dE = [], dL = [], dA = [], dB = [];
      let moved = 0;
      for (let y = Math.round(a.h * from); y < Math.round(a.h * to); y += 2) {
        for (let x = Math.round(a.w * zoneX[0]); x < Math.round(a.w * zoneX[1]); x += 2) {
          const i = (y * a.w + x) * 4;
          const p = lab(a.data[i], a.data[i + 1], a.data[i + 2]);
          const q = lab(b.data[i], b.data[i + 1], b.data[i + 2]);
          if (p[0] < 45 || q[0] < 45) continue; // lit body in both pictures
          const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
          dE.push(d); dL.push(p[0] - q[0]); dA.push(p[1] - q[1]); dB.push(p[2] - q[2]);
          if (d > 3) moved += 1;
        }
      }
      result[name] = { pixels: dE.length, moved: share(moved, dE.length), dE: round(median(dE)), dL: round(median(dL)), dA: round(median(dA)), dB: round(median(dB)) };
    }
    return result;
  }, { png: png.toString('base64'), against: against ? against.toString('base64') : null, zones: ZONES, zoneX: ZONE_X });

if (process.env.NO_BODY) {
  console.log('NO_BODY: the pictures of the body and their pixel checks were skipped.');
} else {
  const pictures = {};
  /**
   * A picture of the body once it stands still: the tints ease in and a
   * turn coasts, and the viewer has no "settled" signal, so the frame is
   * taken until two in a row are the same picture.
   */
  const bodyShot = async (page, name) => {
    const box = await page.locator('.body-viewer').first().boundingBox();
    check(`body ${name}: the 3D body is drawn`, Boolean(box) && box.width > 200 && box.height > 200, box ? `${Math.round(box.width)}×${Math.round(box.height)}` : 'no .body-viewer');
    if (!box) return;
    let previous = null;
    let frame = null;
    let still = false;
    for (let attempt = 0; attempt < 20 && !still; attempt += 1) {
      frame = await page.screenshot({ clip: box });
      still = previous !== null && frame.equals(previous);
      previous = frame;
      if (!still) await page.waitForTimeout(350);
    }
    check(`body ${name}: the picture was taken of a body that stands still`, still);
    writeFileSync(`${OUT}/koerper-${name}.png`, frame);
    pictures[name] = frame;
  };
  const turn = async (page, label) => {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(1200);
  };
  let probe = null;
  for (const [name, lifts] of [['gemischt', MIXED], ['leer', null], ['gehalten', HELD], ['schwelle', EDGE]]) {
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
    if (name !== 'leer') {
      await turn(page, 'Hinten');
      await bodyShot(page, `${name}-hinten`);
    }
    if (name === 'schwelle') {
      // The last page stays open: it decodes the pictures for the pixel checks.
      probe = { ctx, page };
    } else {
      await ctx.close();
    }
  }

  const NEEDED = ['leer-vorne', 'gehalten-vorne', 'gehalten-hinten', 'schwelle-vorne', 'schwelle-hinten', 'gemischt-vorne', 'gemischt-hinten'];
  const have = NEEDED.every((name) => pictures[name]);
  check('body: every picture was taken', have && probe !== null, Object.keys(pictures).join(', '));
  if (have && probe) {
    const read = (name, against = null) => readBody(probe.page, pictures[name], against ? pictures[against] : null);
    const empty = await read('leer-vorne');
    const held = await read('gehalten-vorne');
    const edge = await read('schwelle-vorne', 'gehalten-vorne');
    const edgeBack = await read('schwelle-hinten', 'gehalten-hinten');
    const mixed = await read('gemischt-vorne', 'gehalten-vorne');
    const mixedBack = await read('gemischt-hinten', 'gehalten-hinten');
    console.log('\n[the body, in numbers]', JSON.stringify({ empty, held, edge, edgeBack, mixed, mixedBack }));

    check('body, no data: a quiet grey figure — dimmed, with no white and no colour',
      empty.body > 3000 && empty.dimmed >= 0.6 && empty.white <= 0.08 && empty.green + empty.red <= 0.01, short(empty));
    check('body, held only: white — a trained muscle with no change — and no colour at all',
      held.body > 3000 && held.white >= 0.45 && held.green + held.red <= 0.01, short(held));
    check('body: an untrained figure is clearly darker than a held one',
      held.lightness - empty.lightness >= 8 && held.white >= empty.white + 0.4, `held L ${held.lightness}, empty L ${empty.lightness}`);

    // EDGE against HELD, same angle. The chest and the back are at +3 %,
    // the quadriceps and the hamstrings at −3 %, everything else is held in
    // both — the calves stand for "everything else".
    const same = (a) => a.sameFrame === true;
    // The zone also holds the strip under the chest that belongs to no group,
    // so not every pixel of it moves; the median over all of them still must.
    check('body, +3 % beside held: the chest has turned green — the median of every lit pixel of the zone, by a difference the eye can see (ΔE ≥ 5)',
      same(edge) && edge.upper.pixels >= 300 && edge.upper.moved >= 0.5 && edge.upper.dA <= -3 && edge.upper.dE >= 5, short(edge.upper));
    check('body, −3 % beside held: the quadriceps have turned red (ΔE ≥ 5)',
      same(edge) && edge.thigh.pixels >= 300 && edge.thigh.moved >= 0.6 && edge.thigh.dA >= 3 && edge.thigh.dE >= 5, short(edge.thigh));
    check('body, ±3 % beside held: the calves, held in both, are the same white',
      same(edge) && edge.calf.pixels >= 100 && edge.calf.moved <= 0.1 && edge.calf.dE <= 1.5, short(edge.calf));
    check('body, from the back: the back at +3 % has turned green, the hamstrings at −3 % red, the calves not at all',
      same(edgeBack) && edgeBack.upper.dA <= -3 && edgeBack.upper.dE >= 5 && edgeBack.thigh.dA >= 3 && edgeBack.thigh.dE >= 5 && edgeBack.calf.moved <= 0.1,
      short({ upper: edgeBack.upper, thigh: edgeBack.thigh, calf: edgeBack.calf }, 400));

    // MIXED against HELD. From the front: the chest at +9 %, the quadriceps
    // at −8 %, the calves untrained. From the back: the back held, the
    // hamstrings with too little to compare, the calves untrained.
    check('body, mixed: the untrained calves are dimmed — clearly darker than the same calves held, and no colour',
      same(mixed) && mixed.calf.pixels >= 100 && mixed.calf.moved >= 0.8 && mixed.calf.dL <= -8 && Math.abs(mixed.calf.dA) <= 3, short(mixed.calf));
    check('body, mixed: +9 % is greener than +3 %, and −8 % redder than −3 % — the strength grows with the change',
      mixed.upper.dA < edge.upper.dA - 1 && mixed.thigh.dA > edge.thigh.dA + 1, `chest ${mixed.upper.dA} vs ${edge.upper.dA} · thigh ${mixed.thigh.dA} vs ${edge.thigh.dA}`);
    check('body, mixed from the back: the held back is the same white as in the held figure',
      same(mixedBack) && mixedBack.upper.pixels >= 300 && mixedBack.upper.moved <= 0.1, short(mixedBack.upper));
    check('body, mixed from the back: the hamstrings, with too little to compare, are lightly blue — bluer than held, neither green nor red',
      same(mixedBack) && mixedBack.thigh.moved >= 0.6 && mixedBack.thigh.dB <= -4 && Math.abs(mixedBack.thigh.dA) < Math.abs(mixedBack.thigh.dB) && mixedBack.thigh.dE >= 4, short(mixedBack.thigh));
    check('body, mixed from the back: the untrained calves are dimmed there too',
      same(mixedBack) && mixedBack.calf.moved >= 0.8 && mixedBack.calf.dL <= -8, short(mixedBack.calf));
    await probe.ctx.close();
  } else if (probe) {
    await probe.ctx.close();
  }
}

await browser.close();
process.exit(summary() ? 0 : 1);
