import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The visual contract's rules that a search can hold (`docs/wp3/vertrag.md`
 * §14).
 *
 * `contrast.test.ts` does the arithmetic on the token file. This walks the
 * source tree, the way `statusPalette.test.ts` does for the four status
 * fills, and holds what the token file cannot hold by itself: that it is
 * the *only* place a colour, a font size, a layer or a duration is written.
 * A rule that lives in a document is a rule until the first busy afternoon;
 * these fail the build instead.
 *
 * What a search cannot see — whether text reads on the glass it is drawn
 * on, whether a screen is wider than a phone — is held in the browser by
 * `scripts/verify/design-system.mjs`.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx|css)$/.test(entry)) out.push(path);
  }
  return out;
}

const relative = (path: string) => path.slice(SRC.length).split('\\').join('/');
const isTest = (path: string) => /\.test\.tsx?$/.test(path);

/**
 * Source with its comments blanked out, line for line: a comment may name a
 * colour or a size while explaining one, and only what ships counts. Line
 * numbers survive, so a failure points at the right place.
 */
function code(text: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ');
  return text
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    // A line comment, but not the `//` of a URL inside a string.
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (match, lead: string) => lead + blank(match.slice(lead.length)));
}

interface Hit {
  file: string;
  line: number;
  text: string;
}

function scan(files: string[], pattern: RegExp, source: (path: string) => string = (path) => code(readFileSync(path, 'utf8'))): Hit[] {
  const hits: Hit[] = [];
  for (const path of files) {
    const lines = source(path).split('\n');
    lines.forEach((line, index) => {
      const found = line.match(pattern);
      if (found) hits.push({ file: relative(path), line: index + 1, text: found[0] });
    });
  }
  return hits;
}

const describeHits = (hits: Hit[]) => hits.map((hit) => `${hit.file}:${hit.line} ${hit.text}`);

const ALL = sourceFiles(SRC).filter((path) => !isTest(path));
const CSS = ALL.filter((path) => path.endsWith('.css'));
const TOKENS = join(SRC, 'styles', 'tokens.css');
const TOKENS_CSS = code(readFileSync(TOKENS, 'utf8'));

/**
 * The contract's exceptions (§2.6), by file. Nothing else may carry a
 * colour of its own.
 *
 * - `RankBadge.tsx` — the rank badge is a fixed graphic (D48); its metals
 *   are part of the drawing, not of the interface around it.
 * - `BodyDevPage.tsx` — the developer harness for the 3D body. It is not a
 *   product screen and exists only on the dev server.
 */
const COLOUR_EXCEPTIONS = ['features/ranking/RankBadge.tsx', 'features/body/BodyDevPage.tsx'];

describe('a colour is written in tokens.css and nowhere else (contract §2, §14)', () => {
  const files = ALL.filter((path) => path !== TOKENS && !COLOUR_EXCEPTIONS.includes(relative(path)));

  it('no hex colour outside the token file', () => {
    // #rgb, #rgba, #rrggbb, #rrggbbaa — as a CSS value or a string in code.
    // A hash route ("#/areas") and an element id ("#plan-name") are not hex.
    expect(describeHits(scan(files, /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_-])/i))).toEqual([]);
  });

  it('no rgb(), hsl() or other colour function outside the token file', () => {
    expect(describeHits(scan(files, /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(\s*[\d.]/i))).toEqual([]);
  });

  it('no numeric colour for WebGL outside the token file', () => {
    // three.js takes 0xrrggbb; the body reads its colours through tokens.ts.
    expect(describeHits(scan(files, /\b0x[0-9a-f]{6}\b/i))).toEqual([]);
  });

  it('no named colour in a stylesheet', () => {
    const named = /:\s*[^;{}]*\b(?:white|black|red|green|blue|yellow|orange|purple|pink|gr[ae]y|silver|gold|navy|teal|maroon|olive|lime|aqua|fuchsia|indigo|violet|cyan|magenta)\b/i;
    expect(describeHits(scan(CSS.filter((path) => path !== TOKENS), named))).toEqual([]);
  });

  it('keeps the exceptions to the two files the contract names', () => {
    // If one of them stops carrying a colour, the exception is stale and
    // comes off the list rather than staying as an open door.
    for (const file of COLOUR_EXCEPTIONS) {
      const text = code(readFileSync(join(SRC, file), 'utf8'));
      expect(/#[0-9a-f]{3,8}\b/i.test(text), file).toBe(true);
    }
  });

  it('ties the two colours a browser needs before any stylesheet to their tokens', () => {
    // `index.html` and the web manifest cannot read a custom property. Their
    // literals are the light world's status bar and ground, and may not drift.
    const token = (name: string) => TOKENS_CSS.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6});`, 'i'))?.[1];
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    expect(html.match(/<meta name="theme-color" content="([^"]+)"/)?.[1]).toBe(token('--status-bar'));
    const manifest = JSON.parse(readFileSync(join(ROOT, 'public', 'manifest.webmanifest'), 'utf8')) as Record<string, string>;
    expect(manifest.theme_color).toBe(token('--status-bar'));
    expect(manifest.background_color).toBe(token('--surface-base'));
  });
});

describe('colour has three jobs: what the contract removed stays removed (D154, D160)', () => {
  it.each(['mint', 'lilac', 'rose', 'peach', 'sand', 'domain'])('nothing reads or declares a --%s-* token', (family) => {
    expect(describeHits(scan(ALL, new RegExp(`--${family}-[a-z-]+`)))).toEqual([]);
  });

  it('there is one system: no design variant and no dark tile on a light screen', () => {
    expect(describeHits(scan(ALL, /data-variant|data-tile|stage6-variant/))).toEqual([]);
    expect(readdirSync(join(SRC, 'styles')).filter((name) => name.endsWith('.css')).sort()).toEqual(['global.css', 'tokens.css']);
  });

  it('a muscle colour is a dot and nothing else', () => {
    // The ten hues are read through `features/body/tokens.ts`, never by a
    // stylesheet, and the one product file that draws them is the row.
    expect(describeHits(scan(CSS.filter((path) => path !== TOKENS), /--muscle-/))).toEqual([]);
    const readers = ALL.filter((path) => /IDENTITY_COLOR|mutedIdentity/.test(code(readFileSync(path, 'utf8'))))
      .map(relative)
      .sort();
    expect(readers).toEqual(['features/body/BodyDevPage.tsx', 'features/body/tokens.ts', 'features/gym/MuscleRows.tsx']);
    // And in the row it colours exactly one thing: the dot's background.
    const rows = code(readFileSync(join(SRC, 'features/gym/MuscleRows.tsx'), 'utf8'));
    expect(rows.match(/mutedIdentity\(/g)).toHaveLength(1);
    expect(rows).toMatch(/className="muscle-row__dot"[^>]*style=\{\{ background: identity \}\}/);
    // The chart takes the group's state, never its colour.
    const spark = code(readFileSync(join(SRC, 'features/gym/Sparkline.tsx'), 'utf8'));
    expect(spark).not.toMatch(/color|stroke=\{|fill=\{/);
  });
});

describe('a font size is a token, and none is under 11px (contract §3, §14)', () => {
  it('every font-size in a stylesheet reads a --type-* token', () => {
    const literal = /font-size:(?!\s*(?:var\(--type-[a-z-]+\)|inherit)\s*;)[^;]+;/;
    expect(describeHits(scan(CSS.filter((path) => path !== TOKENS), literal))).toEqual([]);
  });

  it('the font shorthand is only ever used to inherit', () => {
    expect(describeHits(scan(CSS, /\bfont:(?!\s*inherit\s*;)[^;]+;/))).toEqual([]);
  });

  it('no component sets a font size of its own', () => {
    const files = ALL.filter((path) => !path.endsWith('.css') && relative(path) !== 'features/body/BodyDevPage.tsx');
    expect(describeHits(scan(files, /fontSize|font-size|\bfont:/))).toEqual([]);
  });

  it('no size on the scale is under 11px', () => {
    const sizes = [...TOKENS_CSS.matchAll(/(--type-[a-z-]+):\s*([\d.]+)px;/g)].map((match) => [match[1]!, Number(match[2])] as const);
    // The scale and the three figure steps: ten tokens, all in pixels.
    expect(sizes.map(([name]) => name).sort()).toEqual([
      '--type-body', '--type-caption', '--type-figure-l', '--type-figure-m', '--type-figure-xl',
      '--type-footnote', '--type-headline', '--type-large-title', '--type-subhead', '--type-title',
    ]);
    for (const [name, size] of sizes) expect(size, name).toBeGreaterThanOrEqual(11);
    expect(Math.min(...sizes.map(([, size]) => size))).toBe(11);
    // And no --type-* token is declared in any other unit that would slip by.
    expect(TOKENS_CSS.match(/--type-[a-z-]+:\s*[^;]+;/g)).toHaveLength(sizes.length);
  });
});

describe('layers and motion are tokens (contract §10)', () => {
  it('every z-index reads a --layer-* token', () => {
    expect(describeHits(scan(CSS.filter((path) => path !== TOKENS), /z-index:(?!\s*var\(--layer-[a-z-]+\)\s*;)[^;]+;/))).toEqual([]);
  });

  it('no duration is written outside the token file', () => {
    // The two idioms that are not durations of the design: the reduced-motion
    // reset (0.001ms, which keeps `transitionend` firing) and a zero.
    const literal = /(?<![\w.-])(?!0(?:\.001)?m?s\b)\d*\.?\d+m?s\b/;
    expect(describeHits(scan(CSS.filter((path) => path !== TOKENS), literal))).toEqual([]);
  });

  it('names three durations, the reveal and one curve', () => {
    const value = (name: string) => TOKENS_CSS.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1];
    expect(value('--duration-fast')).toBe('130ms');
    expect(value('--duration-base')).toBe('240ms');
    expect(value('--duration-sheet')).toBe('320ms');
    expect(TOKENS_CSS.match(/--ease-[a-z-]+:/g)).toEqual(['--ease-standard:']);
  });
});

describe('density is one set of numbers (contract §4)', () => {
  const value = (name: string) => TOKENS_CSS.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1];

  it('one side margin of 16px, a card inset of 16px, a row of 54px', () => {
    expect(value('--page-gutter')).toBe('16px');
    expect(value('--card-pad')).toBe('16px');
    expect(value('--radius-card')).toBe('22px');
    expect(value('--row-height')).toBe('54px');
    expect(value('--touch-min')).toBe('44px');
  });

  it('only the shell and the gutter read the safe-area insets for a side margin', () => {
    // `--gutter-left/right` already carry the inset. A screen, a scroll port
    // or a bar that adds `--safe-left` to a padding of its own stands at a
    // different margin from every other screen — the workout did, at 36px.
    // What a search cannot hold is a margin written without the inset; that
    // one is measured on the rendered screens (`geometry.mjs`, 16px on every
    // screen, and `design-system.mjs` on the workout).
    const own = /(?:padding|margin)(?:-left|-right|-inline)?:[^;]*var\(--safe-(?:left|right)\)/;
    const hits = scan(CSS.filter((path) => path !== TOKENS), own).map((hit) => `${hit.file} ${hit.text}`);
    expect(hits).toEqual(['app/appShell.css padding-left: var(--safe-left)', 'app/appShell.css padding-right: var(--safe-right)']);
    // And the gutter is the inset plus the one margin, on both sides.
    expect(value('--gutter-left')).toBe('calc(var(--safe-left) + var(--page-gutter))');
    expect(value('--gutter-right')).toBe('calc(var(--safe-right) + var(--page-gutter))');
  });
});
