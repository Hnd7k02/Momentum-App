// The app icon, in every size, from one source (the tidy-up of WP3, step 4c).
//
//   node tools/render-icons.mjs            writes the files under public/
//   node tools/render-icons.mjs --check    writes nothing; fails if a file
//                                          under public/ is not what the
//                                          source makes
//
// The source is `public/icon-full.svg`: the owner's drawing, byte for byte
// (`docs/wp3/prompts/aufraeumen-icon/icon-full.svg`) — full bleed, with no
// corners of its own. Everything else is made from it here, so the icon is
// changed in one file and never by hand in six:
//
//   icon.svg               the same, clipped to rounded corners, with a
//                          fine light rim — for a browser tab and wherever
//                          the icon stands on a ground of its own
//   icon-small.svg         for anything under 48px: without the sheen, the
//                          two glows and the rim, and the star drawn with a
//                          stroke of 64 where the large one has 30 — at
//                          28px the fine parts are noise and the star a hair
//   apple-touch-icon.png   180, from icon-full.svg: opaque, no corners —
//   icon-maskable-512.png  512, likewise — iOS and Android round it themselves
//   icon-192.png           from icon.svg, its corners transparent
//   icon-512.png           likewise
//
// The PNGs are drawn by Chromium, the browser the suites use
// (`CHROMIUM_PATH`, or the image's own). The colours of the icon stand in
// these SVG files and nowhere else: a fixed graphic, as the rank badge is
// (D48, D198) — not tokens, and `designRules.test.ts` reads `src/` only.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const CHECK = process.argv.includes('--check');

const full = readFileSync(join(PUBLIC, 'icon-full.svg'), 'utf8');

/** Replaces exactly one occurrence, or says what the source no longer holds. */
function once(text, find, put) {
  const parts = text.split(find);
  if (parts.length !== 2) throw new Error(`render-icons: expected one «${find.slice(0, 48)}…» in the source, found ${parts.length - 1}`);
  return parts.join(put);
}

const CLIP = '<clipPath id="r"><rect width="1024" height="1024" rx="229"/></clipPath>';
const RIM = '<rect x="2" y="2" width="1020" height="1020" rx="227" fill="none" stroke="url(#rim)" stroke-width="4"/>';
const SHEEN = '<path d="M0 0H1024V236Q566 548 0 706Z" fill="url(#sheen)"/>';
const EDGE = '<path d="M1024 236Q566 548 0 706" fill="none" stroke="url(#edge)" stroke-width="7" filter="url(#soft)"/>';
const STAR = 'M512 300C524.7 408.1 615.9 499.3 724 512C615.9 524.7 524.7 615.9 512 724C499.3 615.9 408.1 524.7 300 512C408.1 499.3 499.3 408.1 512 300Z';
const GLOW_WIDE = `<g filter="url(#glowWide)" opacity="0.55"><path d="${STAR}" fill="none" stroke="#f1e6ff" stroke-width="56" stroke-linejoin="round"/></g>`;
const GLOW = `<g filter="url(#glow)" opacity="0.75"><path d="${STAR}" fill="none" stroke="#ffffff" stroke-width="36" stroke-linejoin="round"/></g>`;
const STAR_STROKE = 'stroke="url(#line)" stroke-width="30"';

// The rounded icon: a clip in the definitions, the outer group clipped by
// it, and the rim as the group's last element.
const clipped = once(full, '</defs><g>', `${CLIP}</defs><g clip-path="url(#r)">`);
const rounded = once(clipped, '</g></svg>', `${RIM}</g></svg>`);

// The small icon: the rounded one without what a small size cannot show.
let small = clipped;
for (const part of [SHEEN, EDGE, GLOW_WIDE, GLOW]) small = once(small, part, '');
small = once(small, STAR_STROKE, 'stroke="url(#line)" stroke-width="64"');

const files = new Map([
  ['icon.svg', Buffer.from(rounded, 'utf8')],
  ['icon-small.svg', Buffer.from(small, 'utf8')],
]);

const { chromium } = await import('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
try {
  /** One SVG drawn at one size: opaque as it is, or on nothing. */
  const draw = async (svg, size, { transparent }) => {
    const context = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.setContent(
      `<!doctype html><style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style>` +
        `<img src="data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}">`,
    );
    await page.locator('img').evaluate((image) => image.decode());
    const png = await page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
    await context.close();
    return png;
  };
  files.set('apple-touch-icon.png', await draw(full, 180, { transparent: false }));
  files.set('icon-maskable-512.png', await draw(full, 512, { transparent: false }));
  files.set('icon-192.png', await draw(rounded, 192, { transparent: true }));
  files.set('icon-512.png', await draw(rounded, 512, { transparent: true }));
} finally {
  await browser.close();
}

let stale = 0;
for (const [name, bytes] of files) {
  const path = join(PUBLIC, name);
  if (CHECK) {
    let same = false;
    try {
      same = readFileSync(path).equals(bytes);
    } catch {
      same = false;
    }
    console.log(`${same ? 'same  ' : 'DIFFERS'} public/${name}  ${bytes.length} bytes`);
    if (!same) stale += 1;
  } else {
    writeFileSync(path, bytes);
    console.log(`wrote public/${name}  ${bytes.length} bytes`);
  }
}
if (stale > 0) {
  console.error(`render-icons: ${stale} file(s) under public/ are not what icon-full.svg makes — run node tools/render-icons.mjs`);
  process.exit(1);
}
