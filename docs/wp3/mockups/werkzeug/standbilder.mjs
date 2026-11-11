// Erzeugt die Körper-Standbilder der Mockups. Aufruf aus dem Repo-Wurzelordner, nach `npm ci`:
//   python3 -m http.server 8765 &      (liefert node_modules, public und docs aus)
//   node docs/wp3/mockups/werkzeug/standbilder.mjs
// Braucht das in der Cloud-Session vorinstallierte Playwright und Chromium; installiert nichts.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const WEISS = '#e9e9ee', GEDIMMT = '#7d7d8a';
const GRUEN = '#00b85b', ROT = '#ff3b5c', BLAU = '#62b4f7';
const mix = (a, b, t) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');
const getoent = (farbe, staerke) => ({ color: mix(WEISS, farbe, 0.25 + 0.5 * staerke), emissive: farbe, glow: 0.04 + 0.1 * staerke });
const gehalten = { color: WEISS }, untrainiert = { color: GEDIMMT }, zuWenig = { color: mix(WEISS, BLAU, 0.38), emissive: BLAU, glow: 0.04 };

const gemischt = {
  none: untrainiert,   // Kopf, Hände, Füsse: sagen nichts, also der gedimmte Ton
  chest: getoent(GRUEN, 0.7), shoulders: getoent(GRUEN, 0.2), biceps: gehalten, triceps: gehalten, core: gehalten,
  back: getoent(GRUEN, 0.45), quadriceps: getoent(ROT, 0.35), hamstringsGlutes: gehalten, forearms: zuWenig, calves: untrainiert,
};
const leer = Object.fromEntries(['chest', 'shoulders', 'biceps', 'triceps', 'core', 'back', 'quadriceps', 'hamstringsGlutes', 'forearms', 'calves'].map((k) => [k, untrainiert]));
leer.none = untrainiert;

const bilder = [
  ['koerper-gemischt-vorne', { regions: gemischt, strips: gehalten, yaw: 0 }],
  ['koerper-gemischt-hinten', { regions: gemischt, strips: gehalten, yaw: 180 }],
  ['koerper-leer-vorne', { regions: leer, strips: untrainiert, yaw: 0 }],
];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 760, height: 1080 } });
page.on('console', (m) => { if (m.type() === 'error') console.error('Seite:', m.text()); });
for (const [name, q] of bilder) {
  await page.goto('about:blank');
  await page.goto('http://127.0.0.1:8765/docs/wp3/mockups/werkzeug/koerper-standbild.html#' + encodeURIComponent(JSON.stringify({ w: 760, h: 1080, ...q })));
  await page.waitForFunction('window.__done === true', null, { timeout: 60000 });
  await page.locator('canvas').screenshot({ path: `docs/wp3/mockups/bilder/${name}${process.env.SUFFIX ?? ''}.png`, omitBackground: true });
  console.log('geschrieben', name);
}
await browser.close();
