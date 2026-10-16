import { chromium } from 'playwright-core';
import { URL_APP, check, summary, phone, onboard, seed, seedTraining } from './lib.mjs';

/**
 * The domain terminal, Stage A — two areas since WP3 Stage 4: Mind | Gym.
 *
 * What the architecture promises and this proves: Heute, Verlauf and Rang
 * unchanged; Bereiche carrying one switch with proper selected semantics and
 * exactly one area rendered beneath it; the area in the URL so a link can
 * name it; Back walking the areas the user actually visited; and an address
 * left by an older build (#/areas/food) landing on Mind, corrected.
 */

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

const ctx = await browser.newContext(phone);
const page = await ctx.newPage();
await page.goto(URL_APP, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await onboard(page, { gym: 3, running: 2 });
await seed(page, { days: 42 });
await seedTraining(page, { days: 42 });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const title = async (p = page) => (await p.locator('.screen__title').textContent())?.trim();
const hash = async (p = page) => p.evaluate(() => location.hash);
const metricsOn = async (p = page) =>
  p.locator('[data-metric]').evaluateAll((els) => els.map((el) => el.getAttribute('data-metric')));

/* ── Heute stays global ────────────────────────────────────────────────── */
check('the app opens on Heute, addressed as #/today', (await title()) === 'Heute' && (await hash()) === '#/today');
check('Heute carries the Boss standing', await page.locator('.boss-summary').isVisible());
check('Heute carries the daily check-in', (await page.locator('.check-in').count()) > 0);
check('Heute carries no Food card (D139)', (await page.locator('[class*="food"]').count()) === 0);
check('Heute carries the training actions',
  await page.getByRole('button', { name: 'Session eintragen' }).isVisible() &&
  await page.getByRole('button', { name: 'Lauf eintragen' }).isVisible());
check('Heute carries no terminal', (await page.locator('.domain-switch').count()) === 0);

/* ── Verlauf stays the overall overview ────────────────────────────────── */
await page.getByRole('button', { name: 'Verlauf' }).click();
await page.waitForTimeout(1400);
check('Verlauf is addressed as #/progress, with no area', (await hash()) === '#/progress');
check('Verlauf carries no switch', (await page.locator('.domain-switch').count()) === 0);
check('Verlauf carries the overall trend', await page.locator('.trend').isVisible());
const rowLabels = (await page.locator('.heatmap__label').allTextContents()).map((s) => s.trim());
check('Verlauf carries the overall grid with every domain row',
  ['Gesamt', 'Mind', 'Gym', 'Laufen'].every((label) => rowLabels.includes(label)), rowLabels.join(' | '));
check('and no Ernährung row', !rowLabels.includes('Ernährung'), rowLabels.join(' | '));
let metrics = await metricsOn();
check('neither training board is on Verlauf any more — both live in the Gym workspace',
  !metrics.some((m) => m.startsWith('gym') || m.startsWith('running')), metrics.join(','));

/* ── Rang is unchanged ─────────────────────────────────────────────────── */
await page.getByRole('button', { name: 'Rang' }).click();
await page.waitForTimeout(1200);
check('Rang is addressed as #/rank', (await hash()) === '#/rank');
check('Rang carries its hero and standings, and no trend', await page.locator('.rank-hero').isVisible() && (await page.locator('.trend').count()) === 0);

/* ── Bereiche is the terminal ──────────────────────────────────────────── */
await page.getByRole('button', { name: 'Bereiche' }).click();
await page.waitForTimeout(1200);
check('Bereiche is addressed with its area', (await hash()) === '#/areas/mental');
const group = page.getByRole('radiogroup', { name: 'Bereich wählen' });
check('the switch is a named radio group', await group.isVisible());
const radios = (await group.getByRole('radio').allTextContents()).map((s) => s.trim());
check('it offers Mind and Gym, and nothing else', JSON.stringify(radios) === JSON.stringify(['Mind', 'Gym']), radios.join(' | '));
check('exactly one area is checked, and it is Mind',
  (await group.locator('[aria-checked="true"]').count()) === 1 &&
  (await group.locator('[aria-checked="true"]').textContent())?.trim() === 'Mind');
check('the switch is one tab stop', (await group.locator('[tabindex="0"]').count()) === 1);
const box = await group.boundingBox();
check('the switch sits on one line at 393px', box !== null && box.height < 60, String(box?.height));
const clipped = await group.getByRole('radio').evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).length);
check('no switch label is clipped', clipped === 0, String(clipped));
check('the switch is on screen at entry, above the scroll port',
  box !== null && box.y < (await page.locator('.areas__scroll').boundingBox())?.y);

/* ── One area at a time ────────────────────────────────────────────────── */
const names = async () => (await page.locator('.areas__domainName').allTextContents()).map((s) => s.trim());
metrics = await metricsOn();
check('Mind shows its standing and its card, and no other area\'s',
  metrics.every((m) => m.startsWith('mental')) && JSON.stringify(await names()) === JSON.stringify(['Mind']),
  metrics.join(',') + ' / ' + (await names()).join(','));
check('the Mind questions are configured here', await page.getByText('Frage hinzufügen').isVisible());

await group.getByRole('radio', { name: 'Gym' }).click();
await page.waitForTimeout(1400);
metrics = await metricsOn();
check('Gym shows the Gym workspace, with Laufen inside it and nothing of Mind',
  metrics.length > 0 && metrics.every((m) => m.startsWith('gym') || m.startsWith('running')) &&
  JSON.stringify(await names()) === JSON.stringify(['Gym', 'Laufen']),
  metrics.join(','));
check('the Gym hub carries the rating board and the door to the muscle groups',
  (await page.locator('[data-metric="gym-rating"]').count()) === 1 && (await page.getByRole('button', { name: 'Muskelgruppen öffnen' }).count()) === 1);
check('and the Gym target is configured there', await page.getByText('3 Sessions / Woche').isVisible());
check('the URL names the area', (await hash()) === '#/areas/gym');
check('the rest of Bereiche stays below whichever area is open',
  await page.getByText('Weitere Bereiche und Einstellungen').isVisible() &&
  await page.getByText('Backup exportieren').isVisible() &&
  await page.getByText('Sprache').first().isVisible());

/* ── Keyboard ──────────────────────────────────────────────────────────── */
await group.locator('[aria-checked="true"]').focus();
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(900);
check('arrow keys move the selection', (await group.locator('[aria-checked="true"]').textContent())?.trim() === 'Mind');

/* ── Back walks the areas visited ──────────────────────────────────────── */
await page.goBack();
await page.waitForTimeout(900);
check('Back returns to the previous area', (await hash()) === '#/areas/gym' && (await group.locator('[aria-checked="true"]').textContent())?.trim() === 'Gym');
await page.goBack();
await page.waitForTimeout(900);
check('and to the area the terminal was entered on', (await hash()) === '#/areas/mental');
await page.goBack();
await page.waitForTimeout(900);
check('and out of the terminal to the tab visited before it', (await hash()) === '#/rank' && (await title()) === 'Rang');
await page.goForward();
await page.waitForTimeout(900);
check('Forward re-enters the terminal on the area it was entered on', (await hash()) === '#/areas/mental');

/* ── Deep links ────────────────────────────────────────────────────────── */
await page.goto(`${URL_APP}#/areas/gym`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
check('a link to #/areas/gym opens Bereiche on Gym',
  (await title()) === 'Bereiche' && (await page.getByRole('radiogroup').locator('[aria-checked="true"]').textContent())?.trim() === 'Gym');
// #/areas/food names no area since Stage 4 (D139). Reached in-page, it is
// an unknown area like an unknown section: Bereiche stays on the area in
// view and the address is corrected.
await page.goto(`${URL_APP}#/areas/food`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
check('#/areas/food reached in-page keeps Bereiche on the area in view, address corrected',
  (await title()) === 'Bereiche' && (await hash()) === '#/areas/gym' &&
  (await page.getByRole('radiogroup').locator('[aria-checked="true"]').textContent())?.trim() === 'Gym',
  await hash());
// Opened fresh — a bookmark from before Stage 4 — it lands on Mind.
const stale = await ctx.newPage();
await stale.goto(`${URL_APP}#/areas/food`, { waitUntil: 'networkidle' });
await stale.waitForTimeout(1500);
check('a bookmark to #/areas/food opens Bereiche on Mind, address corrected (D139)',
  (await title(stale)) === 'Bereiche' && (await hash(stale)) === '#/areas/mental' &&
  (await stale.getByRole('radiogroup').locator('[aria-checked="true"]').textContent())?.trim() === 'Mind',
  await hash(stale));
await stale.close();
await page.goto(`${URL_APP}#/progress`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
check('a link to #/progress opens Verlauf', (await title()) === 'Verlauf');
await page.goto(`${URL_APP}#/nowhere`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
check('an unknown hash reached in-page keeps the screen and corrects the address',
  (await title()) === 'Verlauf' && (await hash()) === '#/progress');
const fresh = await ctx.newPage();
await fresh.goto(`${URL_APP}#/nowhere`, { waitUntil: 'networkidle' });
await fresh.waitForTimeout(1500);
check('a fresh load of an unknown hash lands on Heute, address corrected',
  (await title(fresh)) === 'Heute' && (await hash(fresh)) === '#/today');
await fresh.close();

/* ── The narrowest phone ───────────────────────────────────────────────── */
await page.setViewportSize({ width: 320, height: 640 });
await page.goto(`${URL_APP}#/areas/mental`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const narrowGroup = page.getByRole('radiogroup', { name: 'Bereich wählen' });
const narrowBox = await narrowGroup.boundingBox();
const narrowClipped = await narrowGroup.getByRole('radio').evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).length);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('at 320px Mind | Gym sits on one line, unclipped, with no sideways scroll',
  narrowBox !== null && narrowBox.height < 60 && narrowClipped === 0 && overflow <= 0,
  `${narrowBox?.height} / ${narrowClipped} / ${overflow}`);
await page.setViewportSize(phone.viewport);

/* ── Reduced motion ────────────────────────────────────────────────────── */
const reduced = await ctx.newPage();
await reduced.emulateMedia({ reducedMotion: 'reduce' });
await reduced.goto(`${URL_APP}#/areas/gym`, { waitUntil: 'networkidle' });
await reduced.waitForTimeout(1500);
const motion = await reduced.evaluate(() => {
  let keyframed = 0, perceptible = 0;
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    if (s.animationName !== 'none' && parseFloat(s.animationDuration) > 0.01) keyframed += 1;
    for (const d of s.transitionDuration.split(',')) if (parseFloat(d) > 0.05) perceptible += 1;
  }
  return { keyframed, perceptible };
});
check('no animation runs under reduced motion on the terminal', motion.keyframed === 0, String(motion.keyframed));
check('and no transition is long enough to perceive', motion.perceptible === 0, String(motion.perceptible));

await browser.close();
process.exit(summary() ? 0 : 1);
