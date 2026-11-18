import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FIRST, FIRST_STAR, TUNED, starPath, tuneIcon } from './icon-source.mjs';

/**
 * The app icon's files (the tidy-up of WP3, step 4c, D198; the values the
 * owner chose after the release, D203).
 *
 * `tools/render-icons.mjs` makes them from one source and can say whether
 * they still are what it makes (`--check`) — but that needs a browser, and
 * this test runs where there is none. So it holds what can be read: the
 * owner's first drawing is kept as he sent it, the source is that drawing
 * with the values of D203 and nothing else changed, and the two drawings
 * made from the source are what the step describes.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path));
const text = (path) => read(path).toString('utf8');

const DRAWING = 'docs/wp3/prompts/aufraeumen-icon/icon-full.svg';
const STAR = starPath(TUNED.star);
const count = (haystack, needle) => haystack.split(needle).length - 1;

describe('the app icon', () => {
  it('keeps the owner\'s first drawing, and reads its star as the one it has', () => {
    const drawing = text(DRAWING);
    expect(count(drawing, FIRST_STAR)).toBe(3);
    // The star's description in numbers is the drawing's own star, to the character.
    expect(starPath(FIRST)).toBe(FIRST_STAR);
  });

  it('has that drawing with the values of D203 as its source, and nothing else of it changed', () => {
    const drawing = text(DRAWING);
    const source = text('public/icon-full.svg');
    expect(source).toBe(tuneIcon(drawing));
    // Full bleed: no corners of its own, no clip.
    expect(source).not.toContain('clip-path');
    // The same drawing: every element and every colour, in the same order —
    // with the numbers taken out, the two are one text.
    const shape = (svg) => svg.replace(/d="M[^"]*"/g, 'd=""').replace(/(stroke-width|opacity|stop-opacity)="[\d.]+"/g, '$1=""');
    expect(shape(source)).toBe(shape(drawing));
    const colours = (svg) => svg.match(/#[0-9a-fA-F]{3,6}\b/g);
    expect(colours(source)).toEqual(colours(drawing));
    // What D203 changed, read off the file.
    expect(count(source, STAR)).toBe(3);
    expect(source).toContain(`stroke="url(#line)" stroke-width="${TUNED.line}"`);
    expect(TUNED.star.reach).toBeGreaterThan(FIRST.reach);
    expect(TUNED.star.inward).toBeLessThan(FIRST.inward);
  });

  it('keeps the star inside what a system may cut away', () => {
    // A maskable icon is safe within the middle 80 %: a circle of 410 round
    // the centre of the 1024 square. The star's tips, with half its widest
    // glow, stay well inside it.
    expect(TUNED.star.reach + TUNED.glowWide.width / 2).toBeLessThan(410);
  });

  it('icon.svg is the source clipped to rounded corners, with the rim as its last element', () => {
    const full = text('public/icon-full.svg');
    const icon = text('public/icon.svg');
    expect(icon).toContain('<clipPath id="r"><rect width="1024" height="1024" rx="229"/></clipPath></defs><g clip-path="url(#r)">');
    expect(icon.trimEnd().endsWith('<rect x="2" y="2" width="1020" height="1020" rx="227" fill="none" stroke="url(#rim)" stroke-width="4"/></g></svg>')).toBe(true);
    // Nothing of the drawing is lost or changed on the way.
    const undone = icon
      .replace('<clipPath id="r"><rect width="1024" height="1024" rx="229"/></clipPath>', '')
      .replace('<g clip-path="url(#r)">', '<g>')
      .replace('<rect x="2" y="2" width="1020" height="1020" rx="227" fill="none" stroke="url(#rim)" stroke-width="4"/>', '');
    expect(undone).toBe(full);
  });

  it('icon-small.svg has no sheen, no glow and no rim, and a star drawn with 64', () => {
    const small = text('public/icon-small.svg');
    expect(small).toContain('<g clip-path="url(#r)">');
    expect(small).not.toContain('fill="url(#sheen)"');
    expect(small).not.toContain('stroke="url(#edge)"');
    expect(small).not.toContain('filter="url(#glowWide)"');
    expect(small).not.toContain('filter="url(#glow)"');
    expect(small).not.toContain('stroke="url(#rim)"');
    // The star once, and nothing else drawn with its path.
    expect(count(small, STAR)).toBe(1);
    expect(small).toContain(`<path d="${STAR}" fill="url(#inner)" stroke="url(#line)" stroke-width="64" stroke-linejoin="round"/>`);
    // The ground is the source's: its four fills, in order.
    for (const fill of ['base', 'glowTL', 'sky', 'deep']) {
      expect(small).toContain(`<rect width="1024" height="1024" fill="url(#${fill})"/>`);
    }
  });

  it('the four PNGs are PNGs of the sizes their names and the manifest promise', () => {
    const size = (path) => {
      const bytes = read(path);
      expect(bytes.subarray(1, 4).toString('latin1'), path).toBe('PNG');
      return [bytes.readUInt32BE(16), bytes.readUInt32BE(20), bytes[25]];
    };
    // Colour type 2 is opaque RGB, 6 is RGBA: the two icons a system rounds
    // itself carry no transparency.
    expect(size('public/apple-touch-icon.png')).toEqual([180, 180, 2]);
    expect(size('public/icon-maskable-512.png')).toEqual([512, 512, 2]);
    expect(size('public/icon-192.png')).toEqual([192, 192, 6]);
    expect(size('public/icon-512.png')).toEqual([512, 512, 6]);
  });

  it('names, manifest and index.html are as they were', () => {
    const manifest = JSON.parse(text('public/manifest.webmanifest'));
    expect(manifest.icons.map((icon) => icon.src)).toEqual(['./icon-192.png', './icon-512.png', './icon-maskable-512.png']);
    const html = text('index.html');
    expect(html).toContain('<link rel="apple-touch-icon" href="./apple-touch-icon.png" />');
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="./icon.svg" />');
  });
});
