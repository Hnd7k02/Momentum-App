import { chromium } from 'playwright-core';
import { URL_APP, check, summary, phone, onboard, seed } from './lib.mjs';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext(phone);
const page = await ctx.newPage();
await page.goto(URL_APP, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await onboard(page, { gym: 3, running: 2 });
await seed(page, { days: 40 });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

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

/* Today */
let nodes = await tree();
const bossCard = nodes.find((n) => n.role === 'button' && /Boss/i.test(n.name));
check('the Boss card on Today is one named button', Boolean(bossCard), bossCard?.name);
check('its name carries the rank and what is left',
  Boolean(bossCard) && /(Rookie|Challenger|Contender|Elite|Veteran|Master|Champion|Legend)/.test(bossCard.name) &&
  /(bis|Höchster)/.test(bossCard.name), bossCard?.name);

/* Rank */
await page.locator('.tab-bar button', { hasText: 'Rang' }).click();
await page.waitForTimeout(900);
nodes = await tree();

const unnamed = nodes.filter((n) =>
  ['button', 'radio', 'switch', 'textbox', 'link'].includes(n.role) && !n.name.trim());
check('every control on Rank has a name', unnamed.length === 0, unnamed.map((n) => n.role).join(', '));

const images = nodes.filter((n) => n.role === 'image' || n.role === 'img');
check('the progress bars are images with a sentence for a name',
  images.length > 0 && images.every((n) => n.name.trim().length > 4),
  JSON.stringify(images.map((n) => n.name)));

const decorative = await page.evaluate(() =>
  [...document.querySelectorAll('.badge-svg')].every((el) => el.getAttribute('aria-hidden') === 'true'));
check('every badge, fogged or not, stays decorative', decorative);

const steppers = nodes.filter((n) => n.role === 'button' && /^(Mehr|Weniger) (Mind|Gym|Laufen)$/.test(n.name));
check('each weight stepper says which area it moves', steppers.length === 6,
  JSON.stringify(steppers.map((n) => n.name)));

const shares = await page.evaluate(() =>
  [...document.querySelectorAll('.boss-weights__share')].map((el) => el.getAttribute('aria-live')));
check('the share announces itself when it changes', shares.every((v) => v === 'polite'));

const ladderStates = await page.evaluate(() =>
  [...document.querySelectorAll('.ladder-row')].map((row) => row.textContent?.trim() ?? ''));
check('every ladder row states its condition in words',
  ladderStates.every((text) => /(Erreicht|Noch nicht erreicht)/.test(text)),
  JSON.stringify(ladderStates.slice(0, 2)));

/* Reduced motion. */
const reduced = await browser.newContext({ ...phone, reducedMotion: 'reduce' });
const page2 = await reduced.newPage();
await page2.goto(URL_APP, { waitUntil: 'networkidle' });
await page2.waitForTimeout(600);
const animated = await page2.evaluate(() => {
  const moving = [...document.querySelectorAll('*')].filter((el) => {
    const s = getComputedStyle(el);
    return s.animationName !== 'none' && s.animationDuration !== '0s';
  });
  return moving.length;
});
check('nothing animates when the user asks for reduced motion', animated === 0, String(animated));
await reduced.close();

await browser.close();
process.exit(summary() ? 0 : 1);
