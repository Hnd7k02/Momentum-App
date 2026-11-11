// Screenshots der Mockups in zwei Breiten. Aufruf aus dem Repo-Wurzelordner:
//   python3 -m http.server 8765 &
//   node docs/wp3/mockups/werkzeug/screenshots.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASIS = 'http://127.0.0.1:8765/docs/wp3/mockups/';
const seiten = [
  ['1-muskelgruppen', 'muskelgruppen.html', false],
  ['1-muskelgruppen-leer', 'muskelgruppen.html#leer', false],
  ['2-muskel-sheet', 'muskel-sheet.html', false],
  ['2-muskel-sheet-wenig', 'muskel-sheet.html#wenig', false],
  ['3-bausteine', 'bausteine.html', true],
];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [breite, hoehe] of [[393, 852], [320, 693]]) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  for (const [name, datei, ganz] of seiten) {
    await page.goto('about:blank');
    await page.goto(BASIS + datei);
    await page.waitForLoadState('networkidle');
    const zuBreit = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    const klein = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 10.5).length);
    await page.screenshot({ path: `docs/wp3/mockups/bilder/${name}-${breite}.png`, fullPage: ganz });
    console.log(`${name}-${breite}: zu breit=${zuBreit}, Text unter 11 px=${klein}`);
  }
  await ctx.close();
}
await browser.close();
