import { chromium } from 'playwright-core';
import { URL_APP, check, summary, phone, onboard, openMuscles } from './lib.mjs';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
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
    role: n.role?.value, name: n.name?.value ?? '', description: n.description?.value ?? '',
    ignored: n.ignored, children: (n.childIds ?? []).map((id) => byId.get(id)).filter(Boolean).map(conv),
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
const unnamed = (nodes) =>
  nodes.filter((n) => ['button', 'textbox', 'radio', 'switch', 'link', 'combobox'].includes(n.role) && !n.name.trim());

/* ── The session ────────────────────────────────────────────────────────── */
await page.getByRole('button', { name: 'Session eintragen' }).click();
await page.waitForTimeout(700);
await page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
await page.waitForTimeout(500);
await page.getByRole('textbox', { name: 'Suchen' }).fill('Bench');
await page.waitForTimeout(300);
await page.locator('.gym-picker__row').first().click();
await page.waitForTimeout(700);
// A picked exercise arrives with a pending row (D128); its first set is typed there.
await page.locator('.gym-set--pending input').first().fill('8');
await page.locator('.gym-set--pending input').first().blur();
await page.waitForTimeout(300);
await page.locator('.gym-set--pending input').nth(1).fill('60');
await page.locator('.gym-set--pending input').nth(1).blur();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /Satz zu .* hinzufügen/ }).click();
await page.waitForTimeout(600);

let nodes = await tree();
check('every control in the session has a name', unnamed(nodes).length === 0,
  unnamed(nodes).map((n) => n.role).join(', '));

const fields = nodes.filter((n) => n.role === 'textbox');
check('reps and weight fields say which set and which exercise they are',
  fields.length >= 4 && fields.every((n) => /Bankdrücken/.test(n.name)),
  JSON.stringify(fields.map((n) => n.name)));
check('the reps field says it is reps, and the weight says kilograms',
  fields.some((n) => /Wiederholungen/.test(n.name)) && fields.some((n) => /Kilogramm/.test(n.name)));

const removes = nodes.filter((n) => n.role === 'button' && /entfernen/.test(n.name));
check('each remove button names the set and exercise it affects',
  removes.length >= 2 && removes.some((n) => /Satz 1 von Bankdrücken/.test(n.name)),
  JSON.stringify(removes.map((n) => n.name)));

const addSet = nodes.find((n) => n.role === 'button' && /Satz zu/.test(n.name));
check('the add-set button names the exercise it adds to', Boolean(addSet), addSet?.name);

/* Focus order: back, then the first field, in document order. */
const order = await page.evaluate(() =>
  [...document.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.closest('.visually-hidden') && el.offsetParent !== null)
    .slice(0, 3)
    .map((el) => el.className || el.tagName));
check('focus starts at the way back', /gym-session__back/.test(order[0] ?? ''), JSON.stringify(order));

/* ── Progress and the body ──────────────────────────────────────────────── */
await page.locator('.gym-set').first().locator('input').first().fill('8');
await page.locator('.gym-set').first().locator('input').first().blur();
await page.waitForTimeout(300);
await page.locator('.gym-set').first().locator('input').nth(1).fill('60');
await page.locator('.gym-set').first().locator('input').nth(1).blur();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Fertig' }).click();
await page.waitForTimeout(700);
await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
await page.waitForTimeout(1200);
// The Gym workspace is the Gym area of the domain terminal under Bereiche.
await page.getByRole('radio', { name: 'Gym' }).click();
await page.waitForTimeout(900);
nodes = await tree();
check('every control on the Gym hub has a name', unnamed(nodes).length === 0,
  unnamed(nodes).map((n) => n.role).join(', '));
await openMuscles(page, { wait: 1500 });

nodes = await tree();
check('every control on Gym progress has a name', unnamed(nodes).length === 0,
  unnamed(nodes).map((n) => n.role).join(', '));

const bodyButtons = nodes.filter((n) => n.role === 'button' && /(Brust|Waden|Rumpf)/.test(n.name));
check('each muscle group is a named button', bodyButtons.length >= 3,
  JSON.stringify(bodyButtons.slice(0, 3).map((n) => n.name)));
check('and its name carries the state in words, not only a colour',
  bodyButtons.every((n) => /(Noch nicht trainiert|Noch kein Vergleich|Verbessert|Gehalten|Zurückgegangen)/.test(n.name)),
  bodyButtons[0]?.name);

const figuresHidden = await page.evaluate(() =>
  [...document.querySelectorAll('.body-renderer__figure')].every((el) => el.getAttribute('aria-hidden') === 'true'));
check('the body figures stay decorative, with the list carrying the facts', figuresHidden);

/* ── The exercise history ───────────────────────────────────────────────── */
await page.locator('.gym-progress__row').first().click();
await page.waitForTimeout(700);
nodes = await tree();
check('every control in the exercise history has a name', unnamed(nodes).length === 0);
const table = nodes.find((n) => n.role === 'table');
check('the chart has a table alternative with the dates', Boolean(table), table?.name);
const rowHeaders = nodes.filter((n) => n.role === 'rowheader');
check('one row per training day', rowHeaders.length >= 1, String(rowHeaders.length));
const chartHidden = await page.evaluate(() =>
  document.querySelector('.gym-detail__chart')?.getAttribute('aria-hidden') === 'true');
check('and the bars themselves are decorative', chartHidden);

/* ── Reduced motion ─────────────────────────────────────────────────────── */
const reduced = await browser.newContext({ ...phone, reducedMotion: 'reduce' });
const page2 = await reduced.newPage();
await page2.goto(URL_APP, { waitUntil: 'networkidle' });
await page2.waitForTimeout(700);
const moving = await page2.evaluate(() => {
  const bad = [];
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    if (s.animationName !== 'none' && s.animationDuration !== '0s') bad.push(el.className);
    if (s.transitionDuration !== '0s' && el.className && String(el.className).includes('body-renderer')) bad.push(el.className);
  }
  return bad;
});
check('nothing animates under reduced motion', moving.length === 0, moving.slice(0, 3).join('; '));
await reduced.close();

await browser.close();
process.exit(summary() ? 0 : 1);
