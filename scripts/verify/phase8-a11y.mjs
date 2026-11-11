import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, summary, phone, onboard } from './lib.mjs';

/**
 * Phase 8 through the accessibility tree.
 *
 * Two date fields, a reason, a save and a set of per-pause actions. The risk
 * here is the ordinary one for forms — unlabelled controls and an error that
 * is announced to nobody — plus one specific to this feature: the paused
 * status on Today must be readable without being an alert that interrupts.
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

const p = (n, l = 2) => String(n).padStart(l, '0');
const key = (d) => `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
const shift = (n) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return key(d);
};

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

await page.locator('.tab-bar__tab', { hasText: 'Bereiche' }).click();
await page.waitForTimeout(700);

/* ── The section, before anything is planned ────────────────────────────── */
{
  const nodes = await tree();
  check('nothing in Areas is an unnamed control', unnamed(nodes).length === 0,
    unnamed(nodes).map((n) => n.role).join(', '));
  check('the section is a named heading',
    nodes.some((n) => n.role === 'heading' && /^Pause$/.test(n.name)));
  check('planning one is a named button',
    nodes.some((n) => n.role === 'button' && /Pause planen/.test(n.name)));
}

/* ── The form ───────────────────────────────────────────────────────────── */
await page.getByRole('button', { name: 'Pause planen' }).click();
await page.waitForTimeout(500);
{
  const nodes = await tree();
  check('nothing in the form is an unnamed control', unnamed(nodes).length === 0,
    unnamed(nodes).map((n) => `${n.role}`).join(', '));

  const labelled = await page.evaluate(() =>
    [...document.querySelectorAll('.pause-form__input')].map((el) => {
      const label = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
      return { type: el.type, label: (label?.textContent ?? '').trim() };
    }),
  );
  check('both date fields are real date controls',
    labelled.filter((f) => f.type === 'date').length === 2,
    JSON.stringify(labelled.map((f) => f.type)));
  check('every field is labelled by a real label element',
    labelled.every((f) => f.label.length > 0), JSON.stringify(labelled));
  check('the labels say which end is which',
    labelled[0]?.label === 'Von' && labelled[1]?.label === 'Bis', JSON.stringify(labelled));

  check('the limit is stated in text, not only enforced',
    await page.getByText(/Höchstens 28 Tage/).isVisible());
}

/* ── An error is announced, not merely shown ────────────────────────────── */
{
  const inputs = page.locator('.pause-form__input');
  await inputs.nth(0).fill(shift(0));
  await inputs.nth(1).fill(shift(40));
  await page.waitForTimeout(400);

  const alerts = await page.evaluate(() =>
    [...document.querySelectorAll('[role="alert"]')].map((el) => (el.textContent ?? '').trim()),
  );
  check('the rejection is in a live alert region',
    alerts.some((text) => /höchstens 28 Tage/i.test(text)), alerts.join(' | '));

  const nodes = await tree();
  const save = nodes.find((n) => n.role === 'button' && /Pause sichern/.test(n.name));
  check('the save button is named', Boolean(save));
  check('and is exposed as unavailable while the draft is invalid',
    await page.getByRole('button', { name: 'Pause sichern' }).isDisabled());
}

/* ── Keyboard: the whole flow without a pointer ─────────────────────────── */
{
  const inputs = page.locator('.pause-form__input');
  await inputs.nth(0).fill(shift(0));
  await inputs.nth(1).fill(shift(6));
  await page.waitForTimeout(300);

  await inputs.nth(2).focus();
  const reachedSave = await page.evaluate(() => {
    const order = [...document.querySelectorAll('.pause-form__input, .pause-form__actions button')];
    return order.length >= 4;
  });
  check('the form is a plain tab order of fields then actions', reachedSave);

  await page.getByRole('button', { name: 'Pause sichern' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  const stored = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('momentum');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return new Promise((res, rej) => {
      const r = db.transaction(['pausePeriods'], 'readonly').objectStore('pausePeriods').getAll();
      r.onsuccess = () => res(r.result.length);
      r.onerror = () => rej(r.error);
    });
  });
  check('a pause can be saved from the keyboard alone', stored === 1, String(stored));
}

/* ── The saved pause, and its actions ───────────────────────────────────── */
{
  const nodes = await tree();
  check('ending it early is a named button',
    nodes.some((n) => n.role === 'button' && /Jetzt beenden/.test(n.name)));
  check('nothing in the list is an unnamed control', unnamed(nodes).length === 0,
    unnamed(nodes).map((n) => n.role).join(', '));
  check('its state is spelled out in words, not only by colour',
    await page.getByText('Läuft').isVisible());
}

/* ── Today ──────────────────────────────────────────────────────────────── */
await page.locator('.tab-bar__tab', { hasText: 'Heute' }).click();
await page.waitForTimeout(700);
{
  const nodes = await tree();
  check('nothing on Today is an unnamed control', unnamed(nodes).length === 0,
    unnamed(nodes).map((n) => n.role).join(', '));

  const statuses = await page.evaluate(() =>
    [...document.querySelectorAll('[role="status"]')].map((el) => (el.textContent ?? '').trim()),
  );
  check('the paused state is a status, not an alert that interrupts',
    statuses.some((text) => /Heute ist Pause/.test(text)), statuses.join(' | '));
  check('and it is not a dialog or a modal',
    (await page.locator('[role="dialog"]').count()) === 0);

  const disabled = await page.evaluate(
    () => document.querySelectorAll('button[disabled], input[disabled]').length,
  );
  check('nothing on Today is disabled by the pause', disabled === 0, String(disabled));

  const body = (await page.locator('body').textContent()) ?? '';
  check('no Rest Day surface exists', !/Ruhetag|Rest Day|Rest-Tag/i.test(body));
}

/* ── Reduced motion ─────────────────────────────────────────────────────── */
{
  const reduced = await ctx.newPage();
  await reduced.emulateMedia({ reducedMotion: 'reduce' });
  await reduced.goto(URL_APP, { waitUntil: 'networkidle' });
  await reduced.waitForTimeout(1200);
  await reduced.locator('.tab-bar__tab', { hasText: 'Bereiche' }).click();
  await reduced.waitForTimeout(900);
  const motion = await reduced.evaluate(() => {
    let keyframed = 0;
    let perceptible = 0;
    for (const el of document.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      if (s.animationName !== 'none' && parseFloat(s.animationDuration) > 0.001) keyframed += 1;
      if (s.transitionDuration.split(',').some((v) => parseFloat(v) > 0.001)) perceptible += 1;
    }
    return { keyframed, perceptible };
  });
  check('no animation runs under reduced motion', motion.keyframed === 0, String(motion.keyframed));
  check('and no transition is long enough to perceive', motion.perceptible === 0, String(motion.perceptible));
  await reduced.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
