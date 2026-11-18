import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The app icon's files (the tidy-up of WP3, step 4c, D198).
 *
 * `tools/render-icons.mjs` makes them from one source and can say whether
 * they still are what it makes (`--check`) — but that needs a browser, and
 * this test runs where there is none. So it holds what can be read: the
 * source is the owner's drawing byte for byte, and the two drawings made
 * from it are what the step describes.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path));
const text = (path) => read(path).toString('utf8');

const STAR = 'M512 300C524.7 408.1 615.9 499.3 724 512C615.9 524.7 524.7 615.9 512 724C499.3 615.9 408.1 524.7 300 512C408.1 499.3 499.3 408.1 512 300Z';
const count = (haystack, needle) => haystack.split(needle).length - 1;

describe('the app icon', () => {
  it('has the owner\'s drawing as its source, byte for byte', () => {
    expect(read('public/icon-full.svg').equals(read('docs/wp3/prompts/aufraeumen-icon/icon-full.svg'))).toBe(true);
    // Full bleed: no corners of its own, no clip.
    expect(text('public/icon-full.svg')).not.toContain('clip-path');
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
