import { chromium } from 'playwright-core';
import { URL_APP, check, summary, phone, onboard, seed } from './lib.mjs';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function ready(opts = {}) {
  const ctx = await browser.newContext({ ...phone, ...opts });
  const page = await ctx.newPage();
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await onboard(page, { gym: 3, running: 2 });
  await seed(page, { days: 40 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return { ctx, page };
}

/** The rating, the rank and the bar, straight off the screen. */
async function heroState(page) {
  return page.evaluate(() => {
    const name = document.querySelector('.rank-hero__name')?.textContent ?? '';
    const rating = document.querySelector('.rank-hero__rating')?.textContent ?? '';
    const fill = document.querySelector('.rank-hero .rank-progress__fill');
    const caption = document.querySelector('.rank-hero .rank-progress__caption')?.textContent ?? '';
    const label = document.querySelector('.rank-hero .rank-progress__track')?.getAttribute('aria-label') ?? '';
    return { name, rating, width: fill ? fill.style.width : '', caption, label };
  });
}

{
  const { ctx, page } = await ready();

  /* ── Today ────────────────────────────────────────────────────────────── */
  check('Today leads with the Boss Rank', await page.locator('.boss-summary').isVisible());
  const summaryText = await page.locator('.boss-summary').textContent();
  check('the Boss card says rank and what is left',
    /Boss/i.test(summaryText ?? '') && /(bis|Höchster)/.test(summaryText ?? ''), summaryText?.trim());
  check('Today is still a check-in, not a dashboard',
    (await page.locator('.week__log').count()) > 0 &&
    (await page.locator('.answer-scale, .answer-boolean').count()) > 0);
  check('the Boss card has exactly one bar on Today',
    (await page.locator('.boss-summary__track').count()) === 1);

  await page.locator('.boss-summary').click();
  await page.waitForTimeout(900);
  check('tapping it opens the Rank screen', await page.locator('.rank-hero').isVisible());

  /* ── The progress bar ─────────────────────────────────────────────────── */
  const hero = await heroState(page);
  check('the bar is labelled with the same sentence printed under it',
    hero.label === hero.caption.trim(), `${hero.label} | ${hero.caption}`);

  const consistent = await page.evaluate(() => {
    const RANKS = [0, 120, 260, 410, 560, 700, 830, 950];
    const NAMES = ['Rookie', 'Challenger', 'Contender', 'Elite', 'Veteran', 'Master', 'Champion', 'Legend'];
    const rating = Number((document.querySelector('.rank-hero__rating')?.textContent ?? '').split('/')[0].trim());
    const name = document.querySelector('.rank-hero__name')?.textContent ?? '';
    const index = NAMES.indexOf(name);
    const floor = RANKS[index];
    const ceiling = index + 1 < RANKS.length ? RANKS[index + 1] : 1000;
    const expected = Math.round(Math.min(1, Math.max(0, (rating - floor) / (ceiling - floor))) * 100);
    const shown = Number((document.querySelector('.rank-hero .rank-progress__fill')?.style.width ?? '0').replace('%', ''));
    const caption = document.querySelector('.rank-hero .rank-progress__caption')?.textContent ?? '';
    const remaining = index + 1 < RANKS.length ? Math.max(0, Math.ceil(ceiling - rating)) : null;
    return { rating, name, expected, shown, caption, remaining, index };
  });
  check('the fill matches the rank interval it claims to show',
    Math.abs(consistent.shown - consistent.expected) <= 1,
    JSON.stringify(consistent));
  check('the copy counts to the same threshold the bar measures',
    consistent.remaining === null || consistent.caption.includes(String(consistent.remaining)),
    `${consistent.caption} vs ${consistent.remaining}`);

  /* ── Area ratings: a rating and a share each, and no rank ─────────────── */
  const domainRows = await page.locator('.domain-standing__name').allTextContents();
  check('every enabled area is listed with a rating of its own',
    JSON.stringify(domainRows) === JSON.stringify(['Mind', 'Gym', 'Laufen']),
    JSON.stringify(domainRows));
  const domainMeta = await page.locator('.domain-standing__meta').allTextContents();
  check('each area states its rating out of 1000 and its share, or that it has not started',
    domainMeta.every((text) => /von 1000 · \d+ %/.test(text) || /Noch nicht gestartet/.test(text)) &&
      domainMeta.some((text) => /von 1000 · \d+ %/.test(text)),
    domainMeta.join(' | '));
  check('no area carries a rank badge — the Boss is the only rank',
    (await page.locator('.domain-standing .badge-svg').count()) === 0);
  check('there is only one badge family',
    (await page.locator('.badge-svg').count()) > 5);

  /* ── Promotion confirmation (D126): the indicator, when it is there, is
        the compact count and nothing else; a seeded history is all legacy
        so it is usually absent ─────────────────────────────────────────── */
  const confirmLines = await page.locator('.rank-hero__confirm').allTextContents();
  check('the confirmation indicator is compact and counts days out of seven',
    confirmLines.every((line) => /^Rang bestätigen: \d\/7 Tage$/.test(line.trim())),
    confirmLines.join(' | ') || '(absent)');

  /* ── Mystery ranks ────────────────────────────────────────────────────── */
  const ladder = await page.evaluate(() => {
    return [...document.querySelectorAll('.ladder-row')].map((row) => ({
      name: row.querySelector('.ladder-row__name')?.textContent ?? '',
      state: row.querySelector('.badge')?.textContent ?? '',
      from: row.querySelector('.ladder-row__from')?.textContent ?? '',
      mystery: Boolean(row.querySelector('.badge-svg--mystery')),
    }));
  });
  check('all eight ranks stay browsable', ladder.length === 8, String(ladder.length));
  check('every rank keeps its name', ladder.every((row) => row.name.length > 2));
  check('every rank keeps its threshold', ladder.every((row) => /\d/.test(row.from)));
  check('unearned ranks are fogged and earned ones are not',
    ladder.every((row) => row.mystery === (row.state !== 'Erreicht')),
    JSON.stringify(ladder.map((r) => [r.name, r.state, r.mystery])));
  check('the state is a word, not only a colour',
    ladder.every((row) => row.state === 'Erreicht' || row.state === 'Noch nicht erreicht'));
  check('the mystery treatment is drawn, not blurred',
    (await page.evaluate(() => {
      const el = document.querySelector('.badge-svg--mystery');
      return el ? getComputedStyle(el).filter : 'none';
    })) === 'none');

  /* ── Boss weights ─────────────────────────────────────────────────────── */
  const shares = () => page.locator('.boss-weights__share').allTextContents();
  const before = await shares();
  check('every enabled area gets a share', before.length === 3, JSON.stringify(before));
  const total = (values) => values.reduce((sum, v) => sum + Number(v.replace(/[^0-9]/g, '')), 0);
  check('the shares total 100 %', total(before) === 100, JSON.stringify(before));
  check('the total is on screen', /100/.test((await page.locator('.boss-weights__total').textContent()) ?? ''));
  // Three equal thirds cannot all be whole percentages; what "equal" can mean
  // here is that no row differs from another by more than a rounding point.
  const values = before.map((v) => Number(v.replace(/[^0-9]/g, '')));
  check('and it is equal by default, to the point',
    Math.max(...values) - Math.min(...values) <= 1, JSON.stringify(before));

  await page.getByRole('button', { name: 'Mehr Gym' }).click();
  await page.waitForTimeout(800);
  const after = await shares();
  check('raising one area raises its share', Number(after[1].replace(/[^0-9]/g, '')) > Number(before[1].replace(/[^0-9]/g, '')),
    `${before[1]} → ${after[1]}`);
  check('and the shares still total 100 %', total(after) === 100, JSON.stringify(after));

  // Drive one area to the floor and check nothing disappears.
  for (let i = 0; i < 12; i += 1) {
    const less = page.getByRole('button', { name: 'Weniger Laufen' });
    if (await less.isDisabled()) break;
    await less.click();
    await page.waitForTimeout(250);
  }
  const floored = await shares();
  check('no area can be squeezed out entirely',
    floored.every((value) => Number(value.replace(/[^0-9]/g, '')) > 0), JSON.stringify(floored));
  check('the total holds at 100 % at the extremes', total(floored) === 100, JSON.stringify(floored));
  check('the stepper stops rather than allowing an invalid value',
    await page.getByRole('button', { name: 'Weniger Laufen' }).isDisabled());

  /* Historical Boss values must not move when the weighting changes. */
  const bossBefore = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const rows = await new Promise((res, rej) => { const r = db.transaction(['configSnapshots'], 'readonly').objectStore('configSnapshots').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return rows.map((s) => ({ from: s.effectiveFrom, boss: s.config.boss?.weights ?? null }));
  });
  check('editing weights appends a snapshot rather than editing the old one',
    bossBefore.length > 1, JSON.stringify(bossBefore.map((s) => s.from)));
  check('the earliest snapshot still carries the weighting it was written with',
    JSON.stringify(bossBefore[0].boss) !== JSON.stringify(bossBefore[bossBefore.length - 1].boss),
    JSON.stringify(bossBefore));

  await ctx.close();
}

/* ── Narrow widths, with the new screens ────────────────────────────────── */
for (const width of [320, 360, 393, 430]) {
  const { ctx, page } = await ready({ viewport: { width, height: 780 } });
  for (const tab of ['Heute', 'Rang']) {
    await page.locator('.tab-bar button', { hasText: tab }).click();
    await page.waitForTimeout(700);
    const { clipped, smallTargets } = await import('./lib.mjs');
    const clip = await clipped(page);
    check(`${tab} is not clipped at ${width}px`, clip.length === 0, clip.slice(0, 3).join('; '));
    const small = await smallTargets(page);
    check(`${tab} keeps its tap targets at ${width}px`, small.length === 0, small.slice(0, 3).join('; '));
  }
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
