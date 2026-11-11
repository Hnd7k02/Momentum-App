import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, summary, phone, onboard, inSheet } from './lib.mjs';

/**
 * Phase 4.1, through the accessibility tree.
 *
 * The Gym overview is mostly numbers with bars beside them, which is exactly
 * the shape that reads as nothing at all if the bar is the only carrier. So
 * what is checked here is that every figure is spoken, that the bars are
 * named images rather than unlabelled decoration, and that the Endurance
 * Phase is announced as what it is rather than as a performance score.
 *
 * Real VoiceOver is **not** tested — there is no Apple hardware here. What is
 * verified is the layer VoiceOver consumes.
 */

const browser = await chromium.launch({
  executablePath: CHROMIUM,
});
const ctx = await browser.newContext(phone);
const page = await ctx.newPage();
await page.goto(URL_APP, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await onboard(page, { gym: 3, running: 0 });

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
/* Chrome's accessibility tree calls `role="img"` an **image**, not an `img`. */
const IMAGE_ROLES = ['image', 'img'];
const unnamed = (nodes) =>
  nodes.filter(
    (n) =>
      ['button', 'textbox', 'radio', 'switch', 'link', 'combobox', ...IMAGE_ROLES].includes(n.role) &&
      !n.name.trim(),
  );

/** Seeds met weeks of gym training, then a silence. Same shape as phase41. */
async function seedGym(page, { metWeeks, silentDays = 0 }) {
  return page.evaluate(
    async ({ metWeeks, silentDays }) => {
      const open = () =>
        new Promise((res, rej) => {
          const r = indexedDB.open('momentum');
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      const all = (db, s) =>
        new Promise((res, rej) => {
          const r = db.transaction([s], 'readonly').objectStore(s).getAll();
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      const putAll = (db, s, recs) =>
        new Promise((res, rej) => {
          const tx = db.transaction([s], 'readwrite');
          for (const r of recs) tx.objectStore(s).put(r);
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
      const p = (n, l = 2) => String(n).padStart(l, '0');
      const key = (d) => `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      const shift = (n, from = new Date()) => {
        const d = new Date(from);
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() + n);
        return d;
      };
      const isoWeek = (d) => {
        const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
        t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3);
        const y = t.getFullYear();
        const f = new Date(y, 0, 4, 12);
        f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3);
        return `${p(y, 4)}-W${p(1 + Math.round((t - f) / (7 * 86400000)))}`;
      };

      const db = await open();
      const snaps = await all(db, 'configSnapshots');
      const settings = await all(db, 'settings');
      // Anchored to complete ISO weeks, as in phase41.mjs: the last complete
      // Monday-to-Sunday week ending at least `silentDays` before today, and
      // `metWeeks` such weeks with sessions on Monday, Wednesday and Friday.
      const end = shift(-Math.max(1, silentDays));
      const lastSunday = shift(-(end.getDay() % 7), end);
      const firstMonday = shift(-6 - 7 * (metWeeks - 1), lastSunday);
      const origin = key(shift(-2, firstMonday));
      await putAll(db, 'configSnapshots', snaps.map((s, i) => (i === 0 ? { ...s, effectiveFrom: origin } : s)));
      await putAll(db, 'settings', [{ ...settings[0], firstUseDate: origin }]);

      const sessions = [];
      const sets = [];
      let index = 0;
      for (let week = 0; week < metWeeks; week += 1) {
        for (const offset of [0, 2, 4]) {
          const at = shift(week * 7 + offset, firstMonday);
          const date = key(at);
          const id = `seed-${date}`;
          sessions.push({
            id,
            date,
            weekKey: isoWeek(at),
            performedAt: new Date(at.setHours(18, 0, 0, 0)).toISOString(),
            planId: null,
            note: null,
            legacyCarryOver: false,
            configSnapshotId: snaps[0].id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          sets.push({
            id: `seedset-${index}`,
            sessionId: id,
            exerciseId: 'ex_squat',
            date,
            weightGrams: (100 + week * 10) * 1000,
            reps: 5,
            order: 0,
            muscles: ['quadriceps', 'hamstringsGlutes', 'core'],
            primaryMuscles: ['quadriceps'],
            loadType: 'external',
            createdAt: new Date().toISOString(),
          });
          index += 1;
        }
      }
      await putAll(db, 'gymSessions', sessions);
      await putAll(db, 'gymSets', sets);
    },
    { metWeeks, silentDays },
  );
}

/* ── Inside the Endurance Phase ─────────────────────────────────────────── */
await seedGym(page, { metWeeks: 2 });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
await page.waitForTimeout(1500);
// The Gym workspace is the Gym area of the domain terminal under Bereiche.
await page.getByRole('radio', { name: 'Gym' }).click();
await page.waitForTimeout(900);

let nodes = await tree();
check('every control and image on the Gym overview has a name',
  unnamed(nodes).length === 0, unnamed(nodes).map((n) => `${n.role}`).join(', '));

const meters = await page.locator('.metric-bar').all();
check('every bar is a named image rather than bare decoration',
  meters.length >= 2 &&
    (await Promise.all(meters.map((m) => m.getAttribute('aria-label')))).every((l) => (l ?? '').trim().length > 0),
  String(meters.length));

const images = nodes.filter((n) => IMAGE_ROLES.includes(n.role));
check('the rating bar speaks the rating it draws',
  images.some((n) => /von 1000/.test(n.name)),
  JSON.stringify(images.map((n) => n.name).slice(0, 4)));
check('the endurance bar speaks the weeks it draws',
  images.some((n) => /von 4 Wochen/.test(n.name)),
  JSON.stringify(images.map((n) => n.name).slice(0, 4)));
check('the attendance bar speaks the sessions it draws',
  images.some((n) => /von 3 Sessions/.test(n.name)));

/* Colour is never the only carrier: every figure is also printed. */
const printed = await page.locator('.metric-tile__value').allTextContents();
check('every bar has its number printed beside it',
  printed.some((t) => /von 1000/.test(t)) &&
    printed.some((t) => /von 4 Wochen/.test(t)) &&
    printed.some((t) => /von 3 Sessions/.test(t)),
  printed.map((t) => t.trim()).join(' | '));

check('the running phase is stated in words, not by a dimmed badge alone',
  await page.getByText('Ausdauerphase läuft').isVisible());
check('the Endurance Phase is not announced as a performance figure',
  !/Leistung/.test((await page.locator('[data-metric="gym-endurance"] .metric-tile__line').textContent()) ?? ''));

/* ── Heading order ──────────────────────────────────────────────────────── */
const sectionLabels = await page.locator('.section__label, h2, h3').allTextContents();
const order = sectionLabels.map((t) => t.trim()).filter(Boolean);
const at = (needle) => order.findIndex((t) => t.includes(needle));
check('the rating comes before the year-to-date figure, which comes before attendance',
  at('Gym-Rating') >= 0 && at('Gym-Rating') < at('Leistung seit Jahresbeginn') &&
    at('Leistung seit Jahresbeginn') < at('Anwesenheit'),
  order.join(' → '));

/* ── The break ──────────────────────────────────────────────────────────── */
// The earlier fixture's sessions land in the days this one needs silent, so
// the stores are emptied rather than written over.
await page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('momentum');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  await new Promise((res, rej) => {
    const tx = db.transaction(['gymSessions', 'gymSets'], 'readwrite');
    tx.objectStore('gymSessions').clear();
    tx.objectStore('gymSets').clear();
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
});
await seedGym(page, { metWeeks: 6, silentDays: 16 });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
await page.waitForTimeout(1500);
// The Gym workspace is the Gym area of the domain terminal under Bereiche.
await page.getByRole('radio', { name: 'Gym' }).click();
await page.waitForTimeout(900);

nodes = await tree();
check('the break state names every control too', unnamed(nodes).length === 0,
  unnamed(nodes).map((n) => n.role).join(', '));
check('the break says in words what it reduced and what it did not',
  (await page.getByText(/deines Fortschritts abgebaut/).isVisible()) &&
    (await inSheet(page, 'gym-decay', (sheet) => sheet.getByText(/bleiben unverändert/).isVisible())));

/* ── Focus order through the overview ───────────────────────────────────── */
// A closed sheet hands focus back to the tile that opened it. The trail is
// about the screen, not about that tile, so it starts from the document.
await page.evaluate(() => document.activeElement?.blur());
await page.keyboard.press('Tab');
const focusTrail = [];
for (let i = 0; i < 12; i += 1) {
  focusTrail.push(
    await page.evaluate(() => {
      // Identity, not class: five tiles share one class and are five
      // different controls. Being stuck means landing on the *same* one.
      const el = document.activeElement;
      return el
        ? `${el.tagName.toLowerCase()}.${(el.className || '').split(' ')[0]}:${(el.textContent ?? '').trim().slice(0, 12)}`
        : 'none';
    }),
  );
  await page.keyboard.press('Tab');
}
check('tabbing reaches real controls and never gets stuck',
  new Set(focusTrail).size > 3 && !focusTrail.every((f) => f === focusTrail[0]),
  focusTrail.slice(0, 5).join(' → '));

/* ── Reduced motion ─────────────────────────────────────────────────────── */
const reduced = await ctx.newPage();
await reduced.emulateMedia({ reducedMotion: 'reduce' });
await reduced.goto(URL_APP, { waitUntil: 'networkidle' });
await reduced.waitForTimeout(1200);
await reduced.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
await reduced.waitForTimeout(1400);
// The Gym workspace is the Gym area of the domain terminal under Bereiche.
await reduced.getByRole('radio', { name: 'Gym' }).click();
await reduced.waitForTimeout(900);
/*
 * The app's promise, and the shape of it: `global.css` collapses every
 * animation and transition to 0.001ms under reduced motion rather than to
 * zero, which is the usual idiom — it keeps `transitionend` firing while
 * making the motion imperceptible. So what is asserted is that nothing
 * *runs* a keyframe animation and that no transition is long enough to see,
 * not that the computed duration is the string "0s".
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
