import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, summary, phone, onboard } from './lib.mjs';

/**
 * Phase 7 through the accessibility tree.
 *
 * Three mutually exclusive options with a confirm underneath is the shape
 * that reads as three unrelated buttons if the semantics are wrong — and this
 * particular set of three is asked once, so a screen-reader user who cannot
 * tell what they are choosing between has no second chance.
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
await onboard(page, { gym: 0, running: 0 });

await page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('momentum');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const all = (store) =>
    new Promise((res, rej) => {
      const r = db.transaction([store], 'readonly').objectStore(store).getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  const putAll = (store, records) =>
    new Promise((res, rej) => {
      const tx = db.transaction([store], 'readwrite');
      for (const record of records) tx.objectStore(store).put(record);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  const stamp = new Date().toISOString();
  const snapshots = await all('configSnapshots');
  await putAll('domains', [
    {
      id: 'dom_legacy_sports',
      type: 'sports',
      enabled: true,
      order: 9,
      settings: { targetPerWeek: 4 },
      createdAt: stamp,
      updatedAt: stamp,
    },
  ]);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  const key = (d) => `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  await putAll('sportsSessions', [
    {
      id: 'legacy-a11y-0',
      date: key(today),
      weekKey: '2026-W01',
      performedAt: today.toISOString(),
      durationMinutes: 45,
      note: null,
      configSnapshotId: snapshots[0]?.id ?? 'cfg_1',
      createdAt: stamp,
      updatedAt: stamp,
    },
  ]);
  const settings = await all('settings');
  await putAll('settings', [{ ...settings[0], legacySportMigration: 'pending' }]);
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);

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

/* ── The pointer on Today ───────────────────────────────────────────────── */
{
  const nodes = await tree();
  check('nothing on Today is an unnamed control', unnamed(nodes).length === 0,
    unnamed(nodes).map((n) => n.role).join(', '));
  check('the pointer is a named button, not a bare line of text',
    nodes.some((n) => n.role === 'button' && /Sag unter Bereiche/.test(n.name)));
}

/* ── The question itself ────────────────────────────────────────────────── */
await page.locator('.tab-bar__tab', { hasText: 'Bereiche' }).click();
await page.waitForTimeout(700);
{
  const nodes = await tree();
  check('nothing in Areas is an unnamed control', unnamed(nodes).length === 0,
    unnamed(nodes).map((n) => n.role).join(', '));

  const group = nodes.find((n) => n.role === 'radiogroup' && /Was waren diese Trainings/.test(n.name));
  check('the three branches are one radio group', Boolean(group), group?.name ?? '');

  const scoped = await page.evaluate(() =>
    [...document.querySelectorAll('.legacy-choice__option')].map((el) => ({
      role: el.getAttribute('role'),
      checked: el.getAttribute('aria-checked'),
      tabIndex: el.tabIndex,
      text: (el.textContent ?? '').trim(),
    })),
  );
  check('all three are exposed as radios', scoped.length === 3 && scoped.every((o) => o.role === 'radio'));
  check('none of them starts chosen', scoped.every((o) => o.checked === 'false'));
  check('the group is one tab stop, not three',
    scoped.filter((o) => o.tabIndex === 0).length === 1,
    String(scoped.filter((o) => o.tabIndex === 0).length));

  // Each option must say what it *does*, not only what it is called: this is
  // asked once and cannot be undone from the interface.
  check('each branch spells out its consequence, not just its name',
    scoped.every((o) => o.text.length > 40), JSON.stringify(scoped.map((o) => o.text.length)));

  const confirm = nodes.find((n) => n.role === 'button' && /Antwort übernehmen/.test(n.name));
  check('the confirm is a named button', Boolean(confirm));
  check('and it is unavailable until a branch is chosen',
    await page.getByRole('button', { name: 'Antwort übernehmen' }).isDisabled());
}

/* ── Choosing, by keyboard alone ────────────────────────────────────────── */
{
  await page.locator('.legacy-choice__option').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);

  const chosen = await page.evaluate(
    () =>
      [...document.querySelectorAll('.legacy-choice__option')]
        .filter((el) => el.getAttribute('aria-checked') === 'true')
        .map((el) => (el.textContent ?? '').trim()).length,
  );
  check('a branch can be chosen from the keyboard', chosen === 1, String(chosen));
  check('and exactly one is ever chosen at a time', chosen === 1);
  check('choosing enables the confirm',
    !(await page.getByRole('button', { name: 'Antwort übernehmen' }).isDisabled()));

  // Arrow keys move within the group, the same as every other single choice
  // in the app — the shared helper, not a second copy of it.
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  const moved = await page.evaluate(() =>
    [...document.querySelectorAll('.legacy-choice__option')].findIndex(
      (el) => el.getAttribute('aria-checked') === 'true',
    ),
  );
  check('arrow keys move within the group', moved === 1, String(moved));
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(300);
  const back = await page.evaluate(() =>
    [...document.querySelectorAll('.legacy-choice__option')].findIndex(
      (el) => el.getAttribute('aria-checked') === 'true',
    ),
  );
  check('and back again', back === 0, String(back));

  const stored = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('momentum');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows = await new Promise((res, rej) => {
      const r = db.transaction(['settings'], 'readonly').objectStore('settings').getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return rows[0]?.legacySportMigration ?? null;
  });
  check('and choosing alone still applies nothing', stored === 'pending', String(stored));
}

/* ── Reduced motion ─────────────────────────────────────────────────────── */
{
  const reduced = await ctx.newPage();
  await reduced.emulateMedia({ reducedMotion: 'reduce' });
  await reduced.goto(URL_APP, { waitUntil: 'networkidle' });
  await reduced.waitForTimeout(1200);
  await reduced.locator('.tab-bar__tab', { hasText: 'Bereiche' }).click();
  await reduced.waitForTimeout(900);
  /*
   * `global.css` collapses motion to 0.001ms rather than to zero — the
   * standard idiom, which keeps `transitionend` firing.
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
}

await browser.close();
process.exit(summary() ? 0 : 1);
