import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, summary, phone, onboard } from './lib.mjs';

/**
 * Phase 5 through the accessibility tree.
 *
 * The Running overview is numbers with bars beside them, the shape that reads
 * as nothing at all if the bar carries the meaning alone. What is checked is
 * that every figure is spoken, that the bars are named images, that the
 * distance field is labelled, and that the Endurance Phase is announced as
 * attendance over weeks rather than as pace.
 *
 * Real VoiceOver is **not** tested — no Apple hardware here. What is verified
 * is the layer VoiceOver consumes.
 */

const browser = await chromium.launch({
  executablePath: CHROMIUM,
});
const ctx = await browser.newContext(phone);
const page = await ctx.newPage();
await page.goto(URL_APP, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await onboard(page, { gym: 0, running: 2 });

const cdp = await ctx.newCDPSession(page);
await cdp.send('Accessibility.enable');
async function tree() {
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const conv = (n) => ({
    role: n.role?.value,
    name: n.name?.value ?? '',
    description: n.description?.value ?? '',
    ignored: n.ignored,
    children: (n.childIds ?? []).map((id) => byId.get(id)).filter(Boolean).map(conv),
  });
  const flat = [];
  const walk = (n) => {
    if (!n.ignored && n.role && !['none', 'generic', 'InlineTextBox', 'StaticText'].includes(n.role)) {
      flat.push({ role: n.role, name: n.name, description: n.description });
    }
    n.children.forEach(walk);
  };
  walk(conv(nodes.find((n) => !n.parentId) ?? nodes[0]));
  return flat;
}
/* Chrome's accessibility tree calls role="img" an **image**, not an `img`. */
const IMAGE_ROLES = ['image', 'img'];
const unnamed = (nodes) =>
  nodes.filter(
    (n) =>
      ['button', 'textbox', 'radio', 'switch', 'link', 'combobox', ...IMAGE_ROLES].includes(n.role) &&
      !n.name.trim(),
  );

async function seedRuns(page, { metWeeks, silentDays = 0, second = null }) {
  return page.evaluate(
    async ({ metWeeks, silentDays, second }) => {
      const open = () => new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const all = (db, s) => new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const putAll = (db, s, recs) => new Promise((res, rej) => { const tx = db.transaction([s], 'readwrite'); for (const r of recs) tx.objectStore(s).put(r); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
      const p = (n, l = 2) => String(n).padStart(l, '0');
      const key = (d) => `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      const shift = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
      const isoWeek = (d) => { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3); const y = t.getFullYear(); const f = new Date(y, 0, 4, 12); f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3); return `${p(y, 4)}-W${p(1 + Math.round((t - f) / (7 * 86400000)))}`; };
      const db = await open();
      const snaps = await all(db, 'configSnapshots');
      const settings = await all(db, 'settings');
      const totalDays = metWeeks * 7 + silentDays;
      const origin = key(shift(-(totalDays + 2)));
      await putAll(db, 'configSnapshots', snaps.map((s, i) => (i === 0 ? { ...s, effectiveFrom: origin } : s)));
      await putAll(db, 'settings', [{ ...settings[0], firstUseDate: origin }]);
      await new Promise((res, rej) => { const tx = db.transaction(['runs'], 'readwrite'); tx.objectStore('runs').clear(); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
      const runs = []; let i = 0;
      for (let week = 0; week < metWeeks; week += 1) {
        for (const [slot, offset] of [[0, 0], [1, 3]]) {
          const at = shift(-(totalDays - (week * 7 + offset)));
          const date = key(at);
          const metres = second !== null && slot === 1 ? second : 5000;
          const minPerKm = 6.0 - week * 0.15;
          runs.push({ id: `sr-${i}`, date, weekKey: isoWeek(at), performedAt: new Date(at.setHours(7, 0, 0, 0)).toISOString(),
            source: 'manual', externalId: null, distanceMetres: metres,
            durationSeconds: Math.round((metres / 1000) * minPerKm * 60),
            elevationMetres: null, steps: null, note: null, legacyCarryOver: false,
            configSnapshotId: snaps[0].id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
          i += 1;
        }
      }
      await putAll(db, 'runs', runs);
    },
    { metWeeks, silentDays, second },
  );
}

/**
 * Running's board lives in the Gym workspace under Bereiche, in its own
 * Laufen section; Verlauf keeps the daily row and nothing else.
 */
async function openRunning(target) {
  await target.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
  await target.waitForTimeout(700);
  await target.getByRole('radio', { name: 'Gym' }).click();
  await target.waitForTimeout(2500);
  await target.locator('[data-metric="running-rating"]').scrollIntoViewIfNeeded();
  await target.waitForTimeout(700);
}

/* ── Inside the Endurance Phase ─────────────────────────────────────────── */
await seedRuns(page, { metWeeks: 2 });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await openRunning(page);

let nodes = await tree();
check('every control and image on the Running overview has a name',
  unnamed(nodes).length === 0, unnamed(nodes).map((n) => n.role).join(', '));

const meters = await page.locator('.metric-bar').all();
check('every bar is a named image rather than bare decoration',
  meters.length >= 3 &&
    (await Promise.all(meters.map((m) => m.getAttribute('aria-label')))).every((l) => (l ?? '').trim().length > 0),
  String(meters.length));

const images = nodes.filter((n) => IMAGE_ROLES.includes(n.role));
check('the rating bar speaks the rating it draws',
  images.some((n) => /von 1000/.test(n.name)),
  JSON.stringify(images.map((n) => n.name).slice(0, 4)));
check('the endurance bar speaks the weeks it draws',
  images.some((n) => /von 4 Wochen/.test(n.name)));
check('the attendance bar speaks the runs it draws',
  images.some((n) => /von 2 Läufen/.test(n.name)));

const printed = await page.locator('.metric-tile__value').allTextContents();
check('every bar has its number printed beside it',
  printed.some((t) => /von 1000/.test(t)) &&
    printed.some((t) => /von 4 Wochen/.test(t)) &&
    printed.some((t) => /von 2 Läufen/.test(t)),
  printed.map((t) => t.trim()).join(' | '));

check('the running phase is stated in words, not by a dimmed badge alone',
  await page.getByText('Ausdauerphase läuft').isVisible());
check('the Endurance Phase is not announced as a pace figure',
  !/Tempo/.test((await page.locator('[data-metric="running-endurance"] .metric-tile__line').textContent()) ?? ''));

const order = (await page.locator('.section__label, h2, h3').allTextContents()).map((t) => t.trim()).filter(Boolean);
const at = (needle) => order.findIndex((t) => t.includes(needle));
check('rating comes before year-to-date pace, which comes before attendance',
  at('Lauf-Rating') >= 0 && at('Lauf-Rating') < at('Tempo seit Jahresbeginn') &&
    at('Tempo seit Jahresbeginn') < at('Anwesenheit'),
  order.join(' → '));

/* ── The distance ranges read as distances ──────────────────────────────── */
await seedRuns(page, { metWeeks: 6, second: 10000 });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await openRunning(page);

nodes = await tree();
check('the mature state names every control too', unnamed(nodes).length === 0,
  unnamed(nodes).map((n) => n.role).join(', '));
const rangeText = (await page.locator('.running-range').allTextContents()).join(' ');
check('a distance range is spoken in kilometres, never as a band index',
  /km/.test(rangeText) && !/\bBand\b|\bindex\b/i.test(rangeText), rangeText.slice(0, 80));

/* ── The distance field ─────────────────────────────────────────────────── */
await page.locator('.tab-bar button', { hasText: 'Heute' }).click();
await page.waitForTimeout(900);
// The log button creates a run; the detail sheet opens by tapping the run.
await page.getByRole('button', { name: 'Lauf eintragen' }).click();
await page.waitForTimeout(900);
await page.locator('.row', { hasText: 'Laufen' }).first().click();
await page.waitForTimeout(800);
const opened = await page.locator('#session-distance').isVisible().catch(() => false);
if (opened) {
  nodes = await tree();
  const fields = nodes.filter((n) => n.role === 'textbox');
  check('the distance field has an accessible name',
    fields.some((n) => /Distanz/.test(n.name)), JSON.stringify(fields.map((n) => n.name)));
  check('no control in the run sheet is unnamed', unnamed(nodes).length === 0,
    unnamed(nodes).map((n) => n.role).join(', '));
} else {
  // The sheet is reached by tapping the logged run; log then open it.
  check('the run sheet was reachable for the field check', false, 'sheet did not open');
}

/* ── Reduced motion ─────────────────────────────────────────────────────── */
const reduced = await ctx.newPage();
await reduced.emulateMedia({ reducedMotion: 'reduce' });
await reduced.goto(URL_APP, { waitUntil: 'networkidle' });
await reduced.waitForTimeout(1200);
await openRunning(reduced);
await reduced.waitForTimeout(1500);
/*
 * `global.css` collapses motion to 0.001ms rather than to zero — the standard
 * idiom, which keeps `transitionend` firing. So assert that nothing runs a
 * keyframe animation and no transition is long enough to perceive, not that
 * the computed duration is the string "0s".
 */
const motion = await reduced.evaluate(() => {
  let keyframed = 0;
  let perceptible = 0;
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    if (s.animationName !== 'none' && parseFloat(s.animationDuration) > 0.001) keyframed += 1;
    if (s.transitionDuration.split(',').some((p) => parseFloat(p) > 0.001)) perceptible += 1;
  }
  return { keyframed, perceptible };
});
check('no animation runs under reduced motion', motion.keyframed === 0, String(motion.keyframed));
check('and no transition is long enough to perceive', motion.perceptible === 0, String(motion.perceptible));
await reduced.close();

await browser.close();
process.exit(summary() ? 0 : 1);
