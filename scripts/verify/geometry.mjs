import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { URL_APP, check, summary, onboard, seed, seedTraining, openMuscles } from './lib.mjs';

/**
 * Card geometry: does any text sit on, or past, the edge of the box that
 * clips it?
 *
 * The suites that came before this one measure `scrollWidth` against
 * `clientWidth`, or a child's `right` against its clipper's `right`. Both
 * only ever see an escape to the **right or the bottom**, because that is
 * the only direction ordinary overflow travels. Neither can see a glyph
 * eaten by a rounded corner, and neither can see content that starts left
 * of, or above, the box it lives in — which is what a phone screenshot of
 * this app actually showed.
 *
 * So this compares rectangles on all four sides, and asks for more than
 * "inside": a line of text needs `MIN_INSET` of clear space between itself
 * and the edge, because a 22px corner radius removes far more than a pixel.
 *
 * Dev-only. Nothing here is imported by `src/`, so nothing here ships.
 */

/** Breathing room required between a glyph box and the edge that clips it. */
const MIN_INSET = 12;

const ART = new URL('../../.artifacts/', import.meta.url);
mkdirSync(ART, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

/**
 * Every leaf text node measured against the nearest ancestor that clips it.
 *
 * An axis a box actually *scrolls* is exempt on that axis: a scroll port is
 * supposed to hold more than it shows, and the user can reach the rest. What
 * it may never do is hide content on an axis it does not scroll.
 */
function findClipped(MIN_INSET) {
  const CARD = '[data-card], .card';
  const scrolls = (cs, axis) =>
    ['auto', 'scroll'].includes(axis === 'x' ? cs.overflowX : cs.overflowY);

  /**
   * The boxes a line of text has to fit inside: the tile it lives on, and
   * any closer box that clips — a fold wrapper, a masked media block.
   * Only boxes that actually clip carry a verdict.
   */
  const boxes = (el, card) => {
    const found = [];
    for (let p = el.parentElement; p && p !== card.parentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') found.push({ box: p, cs });
    }
    return found;
  };

  const hits = [];
  for (const el of document.querySelectorAll('h1,h2,h3,h4,p,span,li,label,div,button,a')) {
    if (el.childElementCount !== 0) continue;
    const text = (el.textContent ?? '').trim();
    if (!text) continue;
    // Deliberately out of sight but kept for a screen reader.
    if (el.closest('.visually-hidden')) continue;
    const own = getComputedStyle(el);
    if (own.visibility === 'hidden' || own.display === 'none') continue;
    // Intentional single-line truncation is a design decision, not a defect.
    if (own.textOverflow === 'ellipsis') continue;
    // Card geometry is what this measures. App chrome is measured against the
    // document instead, below.
    const card = el.closest(CARD);
    if (!card) continue;

    const c = el.getBoundingClientRect();
    if (c.width === 0 || c.height === 0) continue;

    for (const { box, cs } of boxes(el, card)) {
      const p = box.getBoundingClientRect();
      const d = {
        left: p.left - c.left,
        right: c.right - p.right,
        top: p.top - c.top,
        bottom: c.bottom - p.bottom,
      };
      // An axis the box scrolls carries no verdict on that axis: a scroll
      // port is meant to hold more than it shows.
      if (scrolls(cs, 'x')) {
        d.left = -Infinity;
        d.right = -Infinity;
      }
      if (scrolls(cs, 'y')) {
        d.top = -Infinity;
        d.bottom = -Infinity;
      }
      // A box that is itself the clipping half of a deliberate mask — it
      // carries no padding and exists only to round or fold what is inside
      // it — is held to "inside", not to the full breathing room. The tile
      // is what owns the inset. Flush against a mask is allowed within a
      // pixel, because a flex row that fills its container lands on the edge
      // to a fraction and that is not a defect.
      const isTile = box.matches(CARD);
      const required = isTile ? MIN_INSET : -1;

      const worst = Math.max(d.left, d.right, d.top, d.bottom);
      if (worst > -required) {
        hits.push({
          text: text.slice(0, 40),
          box: box.className || box.tagName,
          el: el.className || el.tagName,
          tile: isTile,
          worst: Math.round(worst),
          left: Math.round(d.left),
          right: Math.round(d.right),
          top: Math.round(d.top),
          bottom: Math.round(d.bottom),
        });
      }
    }
  }
  return hits;
}

/** Every card, measured against the screen edge it should keep clear of. */
function findBadGutters(MIN_GUTTER) {
  const out = [];
  const width = document.documentElement.clientWidth;
  for (const card of document.querySelectorAll('[data-card], .card')) {
    const r = card.getBoundingClientRect();
    if (r.width === 0) continue;
    // A card nested inside another is inset by its parent, not by the screen.
    if (card.parentElement?.closest('[data-card], .card')) continue;
    if (r.left < MIN_GUTTER - 1 || width - r.right < MIN_GUTTER - 1) {
      out.push(`${card.className || card.tagName} at ${Math.round(r.left)}…${Math.round(r.right)} of ${width}`);
    }
  }
  return [...new Set(out)].slice(0, 6);
}

/**
 * Anything sticking out of the document sideways.
 *
 * Only elements that *reach* the document count: an element wider than the
 * screen inside a box that clips it is contained, which is the whole job of
 * a clipping box. The screen-reader table under the history grid is exactly
 * that — thirty-one date columns inside a 1px `.visually-hidden` wrapper —
 * and flagging it would be flagging the fix.
 */
const findWideDocument = () => {
  const doc = document.documentElement;
  const wide = [];
  if (doc.scrollWidth > doc.clientWidth + 1) {
    wide.push(`document scrolls ${doc.scrollWidth - doc.clientWidth}px sideways`);
  }
  const contained = (el) => {
    for (let p = el.parentElement; p && p !== doc; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== 'visible') return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (getComputedStyle(el).position === 'fixed') continue;
    if (r.right <= doc.clientWidth + 1 && r.left >= -1) continue;
    if (contained(el)) continue;
    wide.push(`${el.className || el.tagName} spans ${Math.round(r.left)}…${Math.round(r.right)}`);
  }
  return [...new Set(wide)].slice(0, 8);
};

const describe = (hits) =>
  hits
    .slice(0, 6)
    .map((h) => `"${h.text}" in .${String(h.box).split(' ')[0]} (worst ${h.worst}px: l${h.left} r${h.right} t${h.top} b${h.bottom})`)
    .join('; ');

/** One screen, measured and photographed. */
async function audit(page, name, width) {
  const hits = await page.evaluate(findClipped, MIN_INSET);
  const wide = await page.evaluate(findWideDocument);
  // Today keeps the roomier 20px treatment; the browsing screens use 16px.
  const gutter = name.startsWith('today') ? 18 : 14;
  const gutters = await page.evaluate(findBadGutters, gutter);
  check(`${width} · ${name} · no text on or past a clipping edge`, hits.length === 0, describe(hits));
  check(`${width} · ${name} · nothing overflows the document sideways`, wide.length === 0, wide.join('; '));
  check(`${width} · ${name} · every card keeps its gutter from the screen`, gutters.length === 0, gutters.join('; '));
  await page.screenshot({
    path: new URL(`${name.replace(/\s+/g, '-')}-${width}.png`, ART).pathname,
  });
  return hits;
}

/** Scrolls the screen's own scroll port to an element and settles. */
async function scrollTo(page, selector) {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
}

/**
 * A profile with enough history behind it that every card has content.
 *
 * The point of Stage A is that the *existing* copy renders without clipping,
 * so a card measured while it is still saying "noch keine Daten" proves
 * nothing. Six weeks of answers, gym sets, runs and food ratings puts the
 * rating, the Endurance figure, the year-to-date change and attendance all
 * on screen at once, which is the state the device screenshots were taken in.
 */
async function profile(ctx, { days = 42 } = {}) {
  const page = await ctx.newPage();
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await onboard(page, { gym: 3, running: 2, food: true });
  await seed(page, { days });
  await seedTraining(page, { days });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  // Today's own Food rating, so the scale question shows its selected state.
  const eight = page.locator('.food__scale').getByRole('radio', { name: /^8\b/ }).first();
  if (await eight.isVisible().catch(() => false)) {
    await eight.click();
    await page.waitForTimeout(600);
  }
  return page;
}

for (const [width, height] of [
  [393, 852],
  [430, 932],
  [320, 693],
]) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 3,
    hasTouch: true,
  });
  const page = await profile(ctx);

  /* ── Today, including the Ernährung scale question ─────────────────────── */
  await audit(page, 'today', width);
  await scrollTo(page, '.food__scale');
  await audit(page, 'today-ernaehrung', width);

  /* ── Verlauf: the overall overview ─────────────────────────────────────── */
  await page.getByRole('button', { name: 'Verlauf' }).click();
  await page.waitForTimeout(1200);
  await audit(page, 'verlauf', width);

  /* ── Rang, including the Gewichtung card ───────────────────────────────── */
  await page.getByRole('button', { name: 'Rang' }).click();
  await page.waitForTimeout(1000);
  await audit(page, 'rang', width);
  await scrollTo(page, '.boss-weights__explain');
  await audit(page, 'rang-gewichtung', width);

  /* ── Bereiche: the domain terminal, one area at a time ─────────────────── */
  await page.getByRole('button', { name: 'Bereiche' }).click();
  await page.waitForTimeout(1200);
  await audit(page, 'bereiche-mental', width);
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(3500);
  await audit(page, 'bereiche-gym', width);
  /* The muscle module, on its own destination since WP2-2: the body, the ten rows and their charts. */
  await openMuscles(page, { wait: 3500 });
  await audit(page, 'bereiche-gym-muskeln-top', width);
  await scrollTo(page, '.muscle-rows');
  await audit(page, 'bereiche-gym-muskeln', width);
  /* WP3, B5: the rows sit on the card's content edge — no browser list inset. */
  const inset = await page.locator('.muscle-rows').evaluate((ul) => {
    const card = ul.closest('.card');
    const box = card.getBoundingClientRect();
    const style = getComputedStyle(card);
    const list = getComputedStyle(ul);
    const row = ul.querySelector('.muscle-row').getBoundingClientRect();
    return {
      paddingStart: list.paddingInlineStart,
      marginBlock: `${list.marginBlockStart}/${list.marginBlockEnd}`,
      offset: Math.round(row.left - (box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft))),
    };
  });
  check(
    `${width} · muscle rows start on the card's content edge, with no list inset`,
    inset.paddingStart === '0px' && inset.marginBlock === '0px/0px' && Math.abs(inset.offset) <= 1,
    JSON.stringify(inset),
  );
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.waitForTimeout(1200);
  /* Laufen, inside the Gym workspace, and a sheet opened from its tile. */
  await scrollTo(page, '[data-metric="running-rating"]');
  await audit(page, 'bereiche-laufen', width);
  await page.locator('[data-metric="running-rating"] .metric-tile__open').click();
  await page.waitForTimeout(500);
  await audit(page, 'bereiche-laufen-sheet', width);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.getByRole('radio', { name: 'Ernährung' }).click();
  await page.waitForTimeout(900);
  await audit(page, 'bereiche-food', width);

  await ctx.close();

  /* ── A younger profile: the Endurance Phase is still running, so
        Anwesenheit and Ausdauerphase share a row ───────────────────────── */
  const young = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 3,
    hasTouch: true,
  });
  const page2 = await profile(young, { days: 12 });
  await page2.getByRole('button', { name: 'Bereiche' }).click();
  await page2.waitForTimeout(1200);
  await page2.getByRole('radio', { name: 'Gym' }).click();
  await page2.waitForTimeout(3500);
  await audit(page2, 'bereiche-gym-locked', width);
  await scrollTo(page2, '[data-metric="running-rating"]');
  await audit(page2, 'bereiche-laufen-locked', width);
  await young.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
