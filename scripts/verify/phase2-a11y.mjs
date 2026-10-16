import { chromium } from 'playwright-core';
import { URL_APP, check, summary, phone, onboard, seed } from './lib.mjs';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext(phone);
const page = await ctx.newPage();
await page.goto(URL_APP, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await onboard(page, { gym: 3, running: 2 });
await seed(page, { days: 30 });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

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
  const root = nodes.find((n) => !n.parentId) ?? nodes[0];
  const flat = [];
  const walk = (n) => {
    if (!n.ignored && n.role && !['none', 'generic', 'InlineTextBox', 'StaticText'].includes(n.role)) {
      flat.push({ role: n.role, name: n.name, description: n.description });
    }
    n.children.forEach(walk);
  };
  walk(conv(root));
  return flat;
}

async function auditScreen(label) {
  const nodes = await tree();
  const interactive = nodes.filter((n) =>
    ['button', 'link', 'radio', 'switch', 'checkbox', 'textbox', 'combobox'].includes(n.role),
  );
  const unnamed = interactive.filter((n) => !n.name.trim());
  check(`${label}: every control has an accessible name`, unnamed.length === 0,
    unnamed.map((n) => n.role).join(', '));
  const headings = nodes.filter((n) => n.role === 'heading');
  check(`${label}: has a heading`, headings.length > 0);
  return nodes;
}

for (const tab of ['Heute', 'Verlauf', 'Rang', 'Bereiche']) {
  await page.locator('.tab-bar button', { hasText: tab }).click();
  await page.waitForTimeout(700);
  await auditScreen(tab);
}

/* The Verlauf drill-down, which is new. */
await page.locator('.tab-bar button', { hasText: 'Verlauf' }).click();
await page.waitForTimeout(700);
await page.getByRole('button', { name: /Mind/ }).first().click();
await page.waitForTimeout(400);

let nodes = await tree();
const questionRow = nodes.find((n) => n.role === 'button' && /Wie gut hast du gesch/.test(n.name));
check('the question row is a button in the accessibility tree', Boolean(questionRow),
  questionRow ? `${questionRow.name} / ${questionRow.description}` : 'not found');
check('its name is the question and its average, not its statistics',
  Boolean(questionRow) && !/Tagen/.test(questionRow.name), questionRow?.name);
check('the counts are its description instead',
  Boolean(questionRow) && /Tagen|von/.test(questionRow.description), questionRow?.description);

await page.getByRole('button', { name: /Wie gut hast du gesch/ }).first().click();
await page.waitForTimeout(500);
nodes = await auditScreen('Fragen-Detail');

const table = nodes.find((n) => n.role === 'table');
check('the detail chart has a table alternative carrying the dates', Boolean(table), table?.name);
const rowHeaders = nodes.filter((n) => n.role === 'rowheader');
check('every day is a row header in it', rowHeaders.length === 30, String(rowHeaders.length));
const back = nodes.find((n) => n.role === 'button' && /Zurück/.test(n.name));
check('there is a named way back', Boolean(back));

/* Focus order: the back button comes first on the detail screen. */
await page.keyboard.press('Tab');
const focused = await page.evaluate(() => document.activeElement?.className ?? '');
check('focus starts on the way back', /question-detail__back/.test(focused), focused);

await browser.close();
process.exit(summary() ? 0 : 1);
