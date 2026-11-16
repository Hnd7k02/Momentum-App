import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, onboard, openMuscles, phone, seed, summary, textContrast, openGymHub, openGroupSheet, closeGroupSheet, sheetExercises, openSheetExercise, closeExercise } from './lib.mjs';
import { readBody } from './body-tones.mjs';

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
 * change is the change of the weight — under the strength score of Stage 5b
 * too, where ten reps multiply every weight by the same 40 (D150).
 *
 * **The band is one-sided since STOP Kurve (D180)**: −2 to +1 is held, a
 * rise counts from +2 % and a fall from −3 %. Until then it was −2 to +2,
 * and this fixture had its rising edge at +3 % (improved) and +2 % (held);
 * the falling edge is where it was.
 *
 * The groups at the edges make their whole change on the last day, because
 * the two figures on screen compare different things: a group's row
 * compares the end of the range with its beginning, the exercise list and
 * the detail the last day with the one before. With the change on the last
 * day of three both read the same number, and the band can be held on both.
 *
 * **How a row compares its range is the device's rule** (`BY_RULE` below).
 * With three exercise days the two rules are one comparison; the chest with
 * five days and the quadriceps with four are where they part.
 */
const MIXED = [
  lift('chest', [26, 20, 14, 8, 2], [100, 102, 105, 107, 109]),      // +7 %  improved (median; +9 % last against first)
  lift('back', [19, 12, 5], [55, 55, 55]),                            //  0 %  held
  lift('shoulders', [22, 13, 4], [100, 100, 102]),                    // +2 %  improved, at the edge
  lift('biceps', [21, 11, 3], [50, 50, 50.5]),                        // +1 %  held, at the edge
  lift('triceps', [23, 12, 6], [50, 50, 49]),                         // −2 %  held, at the edge
  lift('core', [24, 15, 7], [100, 100, 97]),                          // −3 %  declined, at the edge
  lift('quadriceps', [25, 18, 10, 1], [100, 98, 95, 92]),             // −6 %  declined (median; −8 % last against first)
  lift('hamstringsGlutes', [16, 9], [100, 120]),                      // two exercise days: too little
  lift('calves', [75, 60, 45], [100, 105, 110]),                      // outside 30 days; +10 % at 90
  lift('forearms', [17], [20], 'A'), lift('forearms', [10], [22], 'B'), lift('forearms', [3], [24], 'C'), // three days, none twice
];
/**
 * The two rules a window can be compared by (D150), each worked out by hand
 * for the chest and the quadriceps:
 *
 * - `median` — the median of the last k exercise days against the median of
 *   the first k, k = min(3, ⌊days ÷ 2⌋). The chest's five days: 107 and 109
 *   against 100 and 102, 108 ÷ 101, +7 %. The quadriceps' four: 95 and 92
 *   against 100 and 98, 93.5 ÷ 99, −6 %.
 * - `firstLast` — the last day against the first, the rule before Stage 5b
 *   and the one the switch returns to if the owner declines the median at
 *   STOP 5b: 109 ÷ 100, +9 %, and 92 ÷ 100, −8 %.
 *
 * Until Stage 5b this suite stated +9 % and −8 %. Which rule runs is read
 * off the device — the snapshot its onboarding wrote — so the suite holds
 * the figures of the rule the build ships, and a build without the field is
 * the old rule.
 */
const BY_RULE = {
  median: { chest: 7, quadriceps: -6, chestRatio: 108 / 101, quadricepsRatio: 93.5 / 99 },
  firstLast: { chest: 9, quadriceps: -8, chestRatio: 1.09, quadricepsRatio: 0.92 },
};
const RULE = await (async () => {
  const { ctx, page } = await boot(393, null, { sessions: false });
  const comparison = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const rows = await new Promise((res, rej) => { const r = db.transaction(['configSnapshots'], 'readonly').objectStore('configSnapshots').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    db.close();
    const latest = rows.sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1)).at(-1);
    return latest?.config?.scoring?.gymMetric?.comparison ?? null;
  });
  await ctx.close();
  return comparison === 'median' ? 'median' : 'firstLast';
})();
console.log(`a window is compared by: ${RULE}`);
const EXPECT_30 = {
  chest: [BY_RULE[RULE].chest, 'improved'], back: [0, 'unchanged'], shoulders: [2, 'improved'], biceps: [1, 'unchanged'],
  triceps: [-2, 'unchanged'], core: [-3, 'declined'], quadriceps: [BY_RULE[RULE].quadriceps, 'declined'],
  hamstringsGlutes: [null, 'awaitingBaseline'], calves: [null, 'noData'], forearms: [null, 'awaitingBaseline'],
};
/** The mean of the seven rated ratios at 30 days, as the screen prints it. */
const MEAN_30 = ((BY_RULE[RULE].chestRatio + 1 + 1.02 + 1.01 + 0.98 + 0.97 + BY_RULE[RULE].quadricepsRatio) / 7 - 1) * 100;

/** Every group trained three times and unchanged within the band: −2 % to +1 %. */
const HELD = GROUPS.map((group, i) => lift(group, [24 - i, 14 - (i % 5), 4 + (i % 3)], [100, 100, 100 + ((i % 4) - 2)]));

/** Held everywhere, and the smallest improvement and decline beside it: +2 % and −3 %. */
const EDGE = GROUPS.map((group, i) => {
  const last = { chest: 102, back: 102, quadriceps: 97, hamstringsGlutes: 97 }[group] ?? 100;
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
  await openGymHub(page);
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
const stateOfShown = (shown) => (shown >= 2 ? 'improved' : shown <= -3 ? 'declined' : 'unchanged');
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
  check(`${W}: in every row the state fits the printed figure (−2 … +1 held, a rise from +2, a fall from −3)`, ruleHolds, ruleDetail.join(' ‖ '));
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

  /* The figure above the rows. Since block 7B it heads the metrics strip
     above the body: the trend and its state in the first cell, the count of
     rated groups in the second — printed "7 / 10" over "Gruppen" and named
     for a screen reader as the tile's line used to read. */
  const tile = await page.evaluate(() => {
    const n = (s) => (s ?? '').replace(/[ \t\n]+/g, ' ').trim();
    const el = document.querySelector('[data-metric="gym-overall"]');
    const trend = el?.querySelector('.gym-progress__trend');
    const rated = document.querySelectorAll('.muscle-strip__cell')[1] ?? null;
    return {
      title: n(el?.querySelector('.muscle-strip__label')?.textContent),
      number: trend ? trend.textContent : null,
      trendClass: trend?.className ?? null,
      color: trend ? getComputedStyle(trend).color : null,
      scale: n(el?.querySelector('.muscle-strip__sub')?.textContent),
      line: rated?.getAttribute('aria-label') ?? null,
      printed: rated ? [...rated.children].map((child) => n(child.textContent)).join(' | ') : null,
      text: n(el?.textContent),
    };
  });
  const meanShown = Math.sign(MEAN_30) * Math.round(Math.abs(MEAN_30));
  check(`${W}: the figure above is called "Leistungstrend"`, tile.text.startsWith('Leistungstrend'), tile.text);
  check(`${W}: it is the mean of the rated groups, ${signed(meanShown)}, with its state in words`,
    tile.number === signed(meanShown) && tile.scale === WORD[stateOfShown(meanShown)], short(tile));
  check(`${W}: held, it is the text colour`, tile.color === T['--text-primary'] && /--unchanged/.test(tile.trendClass ?? ''), short(tile));
  const withFigure = rows.filter((r) => r.delta !== null).length;
  check(`${W}: "n von 10" names exactly the rows that print a figure`,
    tile.line === `${withFigure} von 10 Gruppen gewertet` && withFigure === 7 && tile.printed === `Gewertet | ${withFigure}\u00a0/\u00a010 | Gruppen`, `${tile.line} · ${tile.printed}`);

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
    ['muscle-row__name', 'Brust'], ['muscle-row__delta', `+${BY_RULE[RULE].chest}${NBSP}%`], ['muscle-row__state', 'Verbessert'],
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
    ['muscle-row__delta', `${MINUS}3${NBSP}%`], ['muscle-row__delta', `${MINUS}${-BY_RULE[RULE].quadriceps}${NBSP}%`], ['muscle-row__state', 'Zurückgegangen'],
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
      // The band is one-sided (D180), and the legend says why at the two figures that differ.
      ['Verbessert', `Ab +2${NBSP}%. Schon eine Wiederholung mehr zählt als Fortschritt.`],
      ['Gehalten', `${MINUS}2${NBSP}% bis +1${NBSP}%`],
      ['Zurückgegangen', `Ab ${MINUS}3${NBSP}%. Eine kleine Schwankung nach unten zählt noch nicht als Rückgang.`],
      ['Zu wenig Vergleichsdaten', 'Weniger als drei Übungstage im Zeitraum, oder keine Übung an zwei Tagen'],
      ['Noch nicht trainiert', 'Kein Satz im Zeitraum'],
    ]), short(sheet.states, 400));
  check(`${W}: and under them what an exercise day is`, sheet.note === 'Ein Übungstag ist eine Übung an einem Tag.', short(sheet.note));
  check(`${W}: the sheet is not wider than the screen`, sheet.overflow !== null && sheet.overflow <= 0 && (await sideways(page)) <= 0, String(sheet.overflow));
  // The words at the two figures (D180) make the sheet two lines longer:
  // on a 320-pixel phone its last line stands below the fold, and the sheet
  // scrolls. What the fold hides is measured after scrolling to the end, so
  // every line of the legend is read on its own pixels at every width.
  const sheetTop = await textContrast(page);
  const scrolled = await page.evaluate(() => {
    const body = document.querySelector('[role="dialog"] .sheet__body');
    const before = body.scrollTop;
    body.scrollTop = body.scrollHeight;
    return { by: body.scrollTop - before, atEnd: body.scrollHeight - body.clientHeight - body.scrollTop <= 1 };
  });
  await page.waitForTimeout(300);
  const sheetEnd = scrolled.by > 0 ? await textContrast(page) : [];
  const noteInView = await page.locator('[role="dialog"] .muscle-legend-sheet__note').evaluate((el) => {
    const note = el.getBoundingClientRect();
    const body = el.closest('.sheet__body').getBoundingClientRect();
    return note.top >= body.top - 0.5 && note.bottom <= body.bottom + 0.5;
  });
  check(`${W}: the sheet's last line can be reached — in view at once, or after scrolling the sheet to its end`,
    scrolled.atEnd && noteInView, short({ scrolledBy: scrolled.by, atEnd: scrolled.atEnd, noteInView }));
  await page.evaluate(() => { document.querySelector('[role="dialog"] .sheet__body').scrollTop = 0; });
  await page.waitForTimeout(300);
  const sheetRuns = [...sheetTop, ...sheetEnd];
  const sheetNamed = measured(sheetRuns, [
    ['muscle-legend-sheet__lead', 'Die Farbe zeigt'],
    ['DT', 'Verbessert'], ['DD', 'Ab +2'], ['DT', 'Gehalten'], ['DD', `${MINUS}2`], ['DT', 'Zurückgegangen'], ['DD', `Ab ${MINUS}3`],
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

  /*
   * A group with too little to compare, opened: the sentence. Until block
   * 7C a chosen row put it above a list of exercises under the rows; it
   * now stands in the group's sheet, word for word (contract §9).
   */
  const sentenceOf = async (group) => {
    await openGroupSheet(page, NAME[group]);
    const text = await page.locator('.sheet--detents .muscle-sheet__sentence').first().textContent().catch(() => null);
    return text === null ? null : text.replace(/\s+/g, ' ').trim();
  };
  const hamSentence = await sentenceOf('hamstringsGlutes');
  check(`${W}: Beinbeuger, opened, says what is missing`, hamSentence === '2 Übungstage in den letzten 30 Tagen. Ab dem dritten zeigt Momentum einen Leistungstrend.', String(hamSentence));
  check(`${W}: and draws no chart where there is no figure`, (await page.locator('.sheet--detents .exercise-line').count()) === 0);
  await closeGroupSheet(page);
  const foreSentence = await sentenceOf('forearms');
  check(`${W}: Unterarme, with three days and no exercise twice, says that`, foreSentence === '3 Übungstage in den letzten 30 Tagen. Ein Leistungstrend braucht dieselbe Übung an zwei Tagen.', String(foreSentence));
  // An exercise recorded once has no change: it stands under "Erfasst"
  // with its set, and no figure beside it.
  const recorded = await page.locator('.sheet--detents .muscle-sheet__exercise--record').evaluateAll((rows) => rows.map((row) => ({
    name: row.querySelector('.muscle-sheet__exerciseName')?.textContent ?? '',
    set: row.querySelector('.muscle-sheet__recordSet')?.textContent ?? '',
    figures: row.querySelectorAll('.muscle-sheet__exerciseChange').length,
  })));
  const once = recorded.find((e) => e.name === 'Unterarme-Übung A');
  check(`${W}: one recorded once stands under "Erfasst" with its set and no figure`, once !== undefined && /×/.test(once.set) && once.figures === 0 && /Erfasst/.test(await page.locator('.sheet--detents').innerText()), short(once ?? recorded));
  await closeGroupSheet(page);
  check(`${W}: with the sheet closed nothing of it is left`, (await page.locator('[role="dialog"]').count()) === 0 && (await page.locator('.muscle-sheet__sentence').count()) === 0);

  /*
   * The exercises of a group and the exercise detail: the same band, and
   * the same figure in both places (D176). Until block 7C the list under
   * the rows printed an exercise's change against the day before, and a
   * held one as the word "Gehalten" alone; the sheet prints the change in
   * the range as the figure with its word, as the ten rows do.
   */
  const inSheet = async (group) => {
    await openGroupSheet(page, NAME[group]);
    const row = (await sheetExercises(page)).find((e) => e.name === `${NAME[group]}-Übung`) ?? null;
    return row;
  };
  const bi = await inSheet('biceps');
  check(`${W}: an exercise at +1 % reads "+1 %" with "Gehalten", in the text colour`, bi?.change === signed(1) && bi?.word === 'Gehalten' && bi?.state === 'unchanged' && bi?.color === T['--text-primary'], short(bi));
  await openSheetExercise(page, 'Bizeps-Übung');
  const detail = await page.locator('.gym-detail__head').evaluate((el) => {
    const change = el.querySelector('.gym-detail__change');
    return { text: change?.textContent.trim() ?? null, cls: change?.className ?? '', color: change ? getComputedStyle(change).color : null, chip: el.querySelector('.state-chip')?.textContent.trim() ?? null };
  });
  check(`${W}: the exercise detail reads the same +1 % as "Gehalten", in the text colour`, detail.text === bi?.change && detail.chip === 'Gehalten' && /--unchanged/.test(detail.cls) && detail.color === T['--text-primary'], short(detail));
  const detailDrawn = await coloursOnScreen(page);
  check(`${W}: nothing on the exercise detail is drawn in the warning yellow`,
    detailDrawn.elements > 40 && carrying(detailDrawn, yellows).length === 0, `${detailDrawn.elements} elements · ${carrying(detailDrawn, yellows).join(' | ')}`);
  await shot(page, width, 'uebungsdetail-gehalten');
  await closeExercise(page);
  await closeGroupSheet(page);

  const tri = await inSheet('triceps');
  check(`${W}: one at ${MINUS}2 % too`, tri?.change === signed(-2) && tri?.word === 'Gehalten' && tri?.state === 'unchanged', short(tri));
  await closeGroupSheet(page);
  const sh = await inSheet('shoulders');
  check(`${W}: one at +2 % is "+2 %", green`, sh?.change === signed(2) && sh?.word === 'Verbessert' && sh?.state === 'improved' && sh?.color === T['--status-strong-ink'], short(sh));
  await openSheetExercise(page, 'Schultern-Übung');
  const detailUp = await page.locator('.gym-detail__head').evaluate((el) => {
    const change = el.querySelector('.gym-detail__change');
    return { text: change?.textContent.trim() ?? null, cls: change?.className ?? '', chip: el.querySelector('.state-chip')?.textContent.trim() ?? null };
  });
  check(`${W}: and the detail reads the same +2 %, improved`, detailUp.text === signed(2) && /--improved/.test(detailUp.cls) && detailUp.chip === 'Verbessert', short(detailUp));
  await shot(page, width, 'uebungsdetail-verbessert');
  await closeExercise(page);
  await closeGroupSheet(page);
  const co = await inSheet('core');
  check(`${W}: one at ${MINUS}3 % is "${MINUS}3 %", red`, co?.change === signed(-3) && co?.word === 'Zurückgegangen' && co?.state === 'declined' && co?.color === T['--status-weak-ink'], short(co));
  await closeGroupSheet(page);

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
  const tile90 = await page.locator('.muscle-strip__cell').nth(1).getAttribute('aria-label');
  check(`${W}: and eight groups are rated`, tile90?.trim() === '8 von 10 Gruppen gewertet', String(tile90));
  const sentence90 = await pick('hamstringsGlutes');
  check(`${W}: the sentence names the range on show`, sentence90 === '2 Übungstage in den letzten 90 Tagen. Ab dem dritten zeigt Momentum einen Leistungstrend.', String(sentence90));
  await pick('hamstringsGlutes');
  await scrollTop(page);
  // Choosing a row turned the body to that group; the picture is of the front.
  if ((await page.locator('.body-viewer canvas').count()) > 0) {
    await page.getByRole('group', { name: 'Ansicht' }).getByRole('button', { name: 'Vorne', exact: true }).click();
    await page.waitForTimeout(3000);
  }
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

/*
 * The picture of the body as numbers — the zones, the card's lightness and
 * `readBody()` — is `body-tones.mjs`, shared with the pictures of the block
 * "Kurve" so that a ΔE in a design and the ΔE held here are one measure.
 */

if (process.env.NO_BODY) {
  console.log('NO_BODY: the pictures of the body and their pixel checks were skipped.');
} else {
  const pictures = {};
  /** Where the view buttons stand in a picture, as shares of its frame. */
  const controls = {};
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
    const views = await page.locator('.body-viewer__views').first().boundingBox();
    controls[name] = views
      ? [(views.x - box.x) / box.width, (views.y - box.y) / box.height, (views.x + views.width - box.x) / box.width, (views.y + views.height - box.y) / box.height]
      : null;
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
    const read = (name, against = null) => readBody(probe.page, pictures[name], controls[name], against ? pictures[against] : null);
    const empty = await read('leer-vorne', 'gehalten-vorne');
    const held = await read('gehalten-vorne');
    const heldBack = await read('gehalten-hinten');
    const edge = await read('schwelle-vorne', 'gehalten-vorne');
    const edgeBack = await read('schwelle-hinten', 'gehalten-hinten');
    const mixed = await read('gemischt-vorne', 'gehalten-vorne');
    const mixedBack = await read('gemischt-hinten', 'gehalten-hinten');
    console.log('\n[the body, in numbers]', JSON.stringify({ empty, held, heldBack, edge, edgeBack, mixed, mixedBack }));

    // The three tones, read where they stand (D161, D165, D166). Under the
    // light of D165 a held muscle reads L* 68–86 by where the light falls, an
    // untrained one 38–50 and the inert feet 68–72; the limits below leave
    // each of them room and keep the three apart.
    const same = (a) => a.sameFrame === true;
    const MUSCLES = ['upper', 'thigh', 'calf'];
    const tones = (picture) => short(Object.fromEntries([...MUSCLES, 'foot'].map((zone) => [zone, [picture[zone].L, picture[zone].a]])));
    const neutral = (zone) => zone.lit >= 100 && Math.abs(zone.a) <= 3;
    check('body, no data: a quiet grey figure — chest, thighs and calves in the dimmed tone, and no colour',
      empty.body > 3000 && MUSCLES.every((zone) => neutral(empty[zone]) && empty[zone].L <= 58) && empty.green + empty.red <= 0.01,
      `${tones(empty)} · green ${empty.green}, red ${empty.red}`);
    check('body, held only: white — a trained muscle with no change — and no colour at all',
      held.body > 3000 && MUSCLES.every((zone) => neutral(held[zone]) && held[zone].L >= 62) && held.green + held.red <= 0.01,
      `${tones(held)} · green ${held.green}, red ${held.red}`);
    check('body, held only, from the back: the back, the hamstrings and the calves are white there too',
      heldBack.body > 3000 && MUSCLES.every((zone) => neutral(heldBack[zone]) && heldBack[zone].L >= 62) && heldBack.green + heldBack.red <= 0.01,
      `${tones(heldBack)} · green ${heldBack.green}, red ${heldBack.red}`);
    check('body: an untrained muscle is clearly darker than the same muscle held — every zone, pixel for pixel, by 20 L* and more',
      same(empty) && MUSCLES.every((zone) => empty[zone].pixels >= 100 && empty[zone].moved >= 0.9 && empty[zone].dL <= -20),
      short(Object.fromEntries(MUSCLES.map((zone) => [zone, empty[zone].dL]))));
    // The two pictures are not laid over each other pixel for pixel here: a
    // page with nothing coloured has no row of states under the figure, and
    // its stage stands one CSS pixel apart, so the outline of the feet
    // differs. Their tone is compared instead — a tint or the dimmed tone
    // on the feet would move it by far more than these limits.
    check('body, the inert zone (D166): the feet take no state — one tone in the untrained figure and in the held one',
      same(empty) && empty.foot.lit >= 100 && held.foot.lit >= 100 && empty.foot.dE <= 1.5
        && Math.abs(empty.foot.L - held.foot.L) <= 1 && Math.abs(empty.foot.a - held.foot.a) <= 0.5 && Math.abs(empty.foot.b - held.foot.b) <= 0.5,
      `untrained ${short([empty.foot.L, empty.foot.a, empty.foot.b])}, held ${short([held.foot.L, held.foot.a, held.foot.b])}, median ΔE ${empty.foot.dE}`);
    check('body, the inert zone (D166): its own tone — neutral, and clearly lighter than the untrained calves above it',
      neutral(empty.foot) && neutral(held.foot) && empty.calf.lit >= 100 && empty.foot.L - empty.calf.L >= 15,
      `feet L ${empty.foot.L}, untrained calves L ${empty.calf.L}, held calves L ${held.calf.L}`);

    // EDGE against HELD, same angle. The chest and the back are at +2 % —
    // the smallest rise the band shows since STOP Kurve (D180), +3 % before —
    // the quadriceps and the hamstrings at −3 %, everything else is held in
    // both — the calves stand for "everything else".
    // The zone also holds the strip under the chest that belongs to no group,
    // so not every pixel of it moves; the median over all of them still must.
    check('body, +2 % beside held: the chest has turned green — the median of every lit pixel of the zone, by a difference the eye can see (ΔE ≥ 5)',
      same(edge) && edge.upper.pixels >= 300 && edge.upper.moved >= 0.5 && edge.upper.dA <= -3 && edge.upper.dE >= 5, short(edge.upper));
    check('body, −3 % beside held: the quadriceps have turned red (ΔE ≥ 5)',
      same(edge) && edge.thigh.pixels >= 300 && edge.thigh.moved >= 0.6 && edge.thigh.dA >= 3 && edge.thigh.dE >= 5, short(edge.thigh));
    check('body, +2 % and −3 % beside held: the calves, held in both, are the same white',
      same(edge) && edge.calf.pixels >= 100 && edge.calf.moved <= 0.1 && edge.calf.dE <= 1.5, short(edge.calf));
    check('body, from the back: the back at +2 % has turned green, the hamstrings at −3 % red, the calves not at all',
      same(edgeBack) && edgeBack.upper.pixels >= 300 && edgeBack.upper.dA <= -3 && edgeBack.upper.dE >= 5
        && edgeBack.thigh.pixels >= 300 && edgeBack.thigh.dA >= 3 && edgeBack.thigh.dE >= 5 && edgeBack.calf.pixels >= 100 && edgeBack.calf.moved <= 0.1,
      short({ upper: edgeBack.upper, thigh: edgeBack.thigh, calf: edgeBack.calf }, 400));

    // MIXED against HELD. From the front: the chest at +7 % (+9 % last
    // against first), the quadriceps at −6 % (−8 %), the calves untrained.
    // From the back: the back held, the hamstrings with too little to
    // compare, the calves untrained.
    check('body, mixed: the untrained calves are dimmed — clearly darker than the same calves held, and no colour',
      same(mixed) && mixed.calf.pixels >= 100 && mixed.calf.moved >= 0.8 && mixed.calf.dL <= -8 && Math.abs(mixed.calf.dA) <= 3, short(mixed.calf));
    check(`body, mixed: +${BY_RULE[RULE].chest} % is greener than +2 %, and −${-BY_RULE[RULE].quadriceps} % redder than −3 % — the strength grows with the change`,
      mixed.upper.dA < edge.upper.dA - 1 && mixed.thigh.dA > edge.thigh.dA + 1, `chest ${mixed.upper.dA} vs ${edge.upper.dA} · thigh ${mixed.thigh.dA} vs ${edge.thigh.dA}`);
    check('body, mixed from the back: the held back is the same white as in the held figure',
      same(mixedBack) && mixedBack.upper.pixels >= 300 && mixedBack.upper.moved <= 0.1, short(mixedBack.upper));
    check('body, mixed from the back: the hamstrings, with too little to compare, are lightly blue — bluer than held, neither green nor red',
      same(mixedBack) && mixedBack.thigh.pixels >= 300 && mixedBack.thigh.moved >= 0.6 && mixedBack.thigh.dB <= -4 && Math.abs(mixedBack.thigh.dA) < Math.abs(mixedBack.thigh.dB) && mixedBack.thigh.dE >= 4, short(mixedBack.thigh));
    check('body, mixed from the back: the untrained calves are dimmed there too',
      same(mixedBack) && mixedBack.calf.pixels >= 100 && mixedBack.calf.moved >= 0.8 && mixedBack.calf.dL <= -8, short(mixedBack.calf));
    await probe.ctx.close();
  } else if (probe) {
    await probe.ctx.close();
  }
}

await browser.close();
process.exit(summary() ? 0 : 1);
