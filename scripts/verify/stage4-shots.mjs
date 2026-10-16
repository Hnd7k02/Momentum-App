import { chromium } from 'playwright-core';
import { URL_APP, check, onboard, phone, seedConfirmation, summary } from './lib.mjs';

/**
 * The promotion-confirmation indicator (D126) in its three states, on the
 * real Rank screen and the Today card, from the verify-only seed: 0/7 when
 * the threshold was reached today, 4/7 while a confirmation is pending, and
 * nothing while the rating sits below the next threshold with no days
 * collected. Screenshots at 393px go to docs/design/overall-rank.
 *
 * The seeded profile is set up under P8, so its whole history is of that
 * era: a day counts towards a confirmation once it is settled — two days
 * old for this Wellbeing-only profile, since yesterday can still be
 * answered (D136). The pending and promoted presets therefore seed one day
 * more than under the rule before, where yesterday already counted.
 */
const OUT = process.env.OUT ?? 'docs/design/overall-rank';
const PRESETS = [
  { name: 'threshold', seed: { days: 28, value: 10, today: true }, expect: 'Rang bestätigen: 0/7 Tage', caption: 'Schwelle erreicht' },
  { name: 'pending', seed: { days: 33, value: 10 }, expect: 'Rang bestätigen: 4/7 Tage', caption: 'Schwelle erreicht' },
  { name: 'below', seed: { days: 28, value: 10 }, expect: null, caption: /^Noch \d+ bis Veteran$/ },
  // The day after a confirmation completed: the rank moved, the bar and the
  // caption retargeted, nothing pending towards the rank after that yet.
  { name: 'promoted', seed: { days: 26, value: 10 }, expect: null, caption: /^Noch \d+ bis Veteran$/, rank: 'Elite' },
  // The top of the ladder is not reachable from this seed in a sane number
  // of days (the seeded rating settles below Legend's threshold); its
  // unchanged treatment is covered by the unit tests instead.
];
const matches = (text, expected) => (expected instanceof RegExp ? expected.test(text) : text === expected);
const letters = { threshold: ['H', 'K'], pending: ['I', 'L'], below: ['J', 'M'], promoted: ['N', 'O'] };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

for (const preset of PRESETS) {
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await onboard(page, { gym: 0, running: 0 });
  await seedConfirmation(page, preset.seed);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const todayLine = (await page.locator('.boss-summary__confirm').allTextContents()).map((t) => t.trim());
  check(`${preset.name}: the Today card ${preset.expect ? `says "${preset.expect}"` : 'shows no indicator'}`,
    preset.expect ? todayLine.join('') === preset.expect : todayLine.length === 0, todayLine.join('|'));
  const todayCaption = ((await page.locator('.boss-summary__caption').textContent()) ?? '').trim();
  check(`${preset.name}: the Today caption reads "${String(preset.caption)}"`, matches(todayCaption, preset.caption), todayCaption);
  check(`${preset.name}: the Today caption never counts to nothing`, !/Noch 0 bis/.test(todayCaption), todayCaption);
  if (preset.rank) {
    const name = ((await page.locator('.boss-summary__name').textContent()) ?? '').trim();
    check(`${preset.name}: the rank is ${preset.rank}`, name === preset.rank, name);
  }
  await page.screenshot({ path: `${OUT}/393-${letters[preset.name][0]}-today-confirm-${preset.name}.png` });

  await page.locator('.tab-bar button', { hasText: 'Rang' }).click();
  await page.waitForTimeout(1400);
  const heroLine = (await page.locator('.rank-hero__confirm').allTextContents()).map((t) => t.trim());
  check(`${preset.name}: the Rank hero ${preset.expect ? `says "${preset.expect}"` : 'shows no indicator'}`,
    preset.expect ? heroLine.join('') === preset.expect : heroLine.length === 0, heroLine.join('|'));
  const bars = await page.locator('.rank-hero .rank-progress__track').count();
  check(`${preset.name}: the progress bar is still there, unchanged in number`, bars === 1, String(bars));
  const heroCaption = ((await page.locator('.rank-hero .rank-progress__caption').textContent()) ?? '').trim();
  const heroLabel = (await page.locator('.rank-hero .rank-progress__track').getAttribute('aria-label')) ?? '';
  check(`${preset.name}: the hero caption reads "${String(preset.caption)}"`, matches(heroCaption, preset.caption), heroCaption);
  check(`${preset.name}: the bar is labelled with the same sentence`, heroLabel === heroCaption, `${heroLabel} | ${heroCaption}`);
  check(`${preset.name}: the hero caption never counts to nothing`, !/Noch 0 bis/.test(heroCaption), heroCaption);
  const clip = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.rank-hero *')) {
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') out.push(el.className);
    }
    return out;
  });
  check(`${preset.name}: nothing in the hero is clipped`, clip.length === 0, clip.join(', '));
  await page.screenshot({ path: `${OUT}/393-${letters[preset.name][1]}-rang-confirm-${preset.name}.png` });
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
