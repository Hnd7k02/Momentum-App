import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The design tokens are checked, not trusted.
 *
 * Every colour claim in the palette — "this one is safe for text", "this one
 * is only for fills" — is an accessibility promise, and a promise nobody
 * verifies is a promise that quietly breaks the first time a colour is
 * nudged. This suite reads the real token file and does the arithmetic.
 */

const CSS = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

function tokens(): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of CSS.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    found.set(match[1]!, match[2]!.trim());
  }
  // Resolve `var(--x)` aliases so a token defined by reference is checked too.
  for (const [name, value] of found) {
    let resolved = value;
    for (let depth = 0; depth < 4 && resolved.startsWith('var('); depth += 1) {
      const target = resolved.slice(4, resolved.indexOf(')'));
      resolved = found.get(target) ?? resolved;
    }
    found.set(name, resolved);
  }
  return found;
}

const TOKENS = tokens();

function hex(name: string): string {
  const value = TOKENS.get(name);
  if (!value) throw new Error(`Token ${name} is not defined`);
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`Token ${name} is not a plain hex: ${value}`);
  return value;
}

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string): number {
  const r = channel(parseInt(color.slice(1, 3), 16));
  const g = channel(parseInt(color.slice(3, 5), 16));
  const b = channel(parseInt(color.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const WHITE = '#ffffff';

/** WCAG AA: 4.5:1 for body text, 3:1 for large text and graphical objects. */
const BODY = 4.5;
const LARGE = 3;

describe('text on white', () => {
  it.each(['--text-primary', '--text-secondary', '--accent'])('%s is readable', (name) => {
    expect(contrast(hex(name), WHITE)).toBeGreaterThanOrEqual(BODY);
  });

  it.each([
    '--lilac-ink',
    '--mint-ink',
    '--sky-ink',
    '--peach-ink',
    '--rose-ink',
    '--sand-ink',
  ])('%s is safe for text, which is what "ink" promises', (name) => {
    expect(contrast(hex(name), WHITE)).toBeGreaterThanOrEqual(BODY);
  });
});

describe('ink on its own tint', () => {
  it.each([
    ['--lilac-ink', '--lilac-tint'],
    ['--mint-ink', '--mint-tint'],
    ['--sky-ink', '--sky-tint'],
    ['--peach-ink', '--peach-tint'],
    ['--rose-ink', '--rose-tint'],
    ['--sand-ink', '--sand-tint'],
    // The tinted secondary button.
    ['--accent-ink', '--accent-tint'],
  ])('%s reads on %s', (ink, tint) => {
    // Badges pair an ink with its own tint; both halves have to work.
    expect(contrast(hex(ink), hex(tint))).toBeGreaterThanOrEqual(BODY);
  });
});

describe('the toast', () => {
  it.each(['--toast-text', '--toast-action'])('%s reads on the toast surface', (name) => {
    expect(contrast(hex(name), hex('--toast-surface'))).toBeGreaterThanOrEqual(BODY);
  });
});

describe('white on a filled control', () => {
  it.each(['--accent', '--accent-pressed', '--lilac-ink', '--mint-ink'])(
    'white label reads on %s',
    (name) => {
      expect(contrast(WHITE, hex(name))).toBeGreaterThanOrEqual(BODY);
    },
  );

  it.each(['--lilac-mid', '--mint-mid'])(
    '%s carries a graphical control, not body text',
    (name) => {
      // The `-mid` weights are switches and display type, never 17px labels.
      expect(contrast(WHITE, hex(name))).toBeGreaterThanOrEqual(LARGE);
    },
  );
});

/**
 * The status palette (D123).
 *
 * Weak, mixed, good and strong are a product decision about *hue*, bright
 * by design. Everything below is the accessibility half of it, which the
 * decision does not settle and which cannot be checked by eye: the fills
 * carry no text of their own, so each status has a darker ink for text and
 * outlines, an `-on` colour for the label inside a filled control, and a
 * tint for badges. Text is darkened; the bar never is.
 */
describe('the status palette', () => {
  const STATUSES = ['weak', 'mixed', 'good', 'strong'];

  it.each(STATUSES)('--status-%s-ink is safe for text on white', (status) => {
    expect(contrast(hex(`--status-${status}-ink`), WHITE)).toBeGreaterThanOrEqual(BODY);
  });

  it.each(STATUSES)('--status-%s-ink reads on its own tint', (status) => {
    expect(
      contrast(hex(`--status-${status}-ink`), hex(`--status-${status}-tint`)),
    ).toBeGreaterThanOrEqual(BODY);
  });

  it.each(STATUSES)('--status-%s-on reads on the fill', (status) => {
    // The number inside a selected bubble is the value itself. If it does not
    // read, the control has no content.
    expect(
      contrast(hex(`--status-${status}-on`), hex(`--status-${status}`)),
    ).toBeGreaterThanOrEqual(BODY);
  });

  it.each(STATUSES)('--status-%s-ink outlines the fill against a card and a track', (status) => {
    // A yellow or a bright green fill cannot clear 3:1 on a light ground,
    // so the outline is what makes a swatch, a region or a selected control
    // a graphical object. It has to clear it on every status.
    expect(contrast(hex(`--status-${status}-ink`), WHITE)).toBeGreaterThanOrEqual(LARGE);
    expect(contrast(hex(`--status-${status}-ink`), hex('--status-track'))).toBeGreaterThanOrEqual(
      LARGE,
    );
  });

  it('keeps the empty ink readable, because "no data" is spelled out too', () => {
    expect(contrast(hex('--status-empty-ink'), WHITE)).toBeGreaterThanOrEqual(BODY);
  });

  it('leaves the no-data cell lighter than every status fill', () => {
    // An empty cell must never be mistaken for a recorded day. The history
    // bars carry the value as height; this is the one promise colour makes.
    const fills = STATUSES.map((status) => luminance(hex(`--status-${status}`)));
    expect(Math.max(...fills)).toBeLessThan(luminance(hex('--status-empty')));
  });

  it('uses four distinct fills', () => {
    expect(new Set(STATUSES.map((status) => hex(`--status-${status}`))).size).toBe(4);
  });
});

/**
 * Progress bars.
 *
 * The track used to be a neutral grey and is now tinted from the bar's own
 * fill, which is a geometry decision with an accessibility consequence: the
 * filled part is a graphical object and has to stay 3:1 against the
 * unfilled part, or the bar stops saying anything. Each pair is checked
 * rather than assumed, exactly as the history bands are.
 */
describe('meter fill on its own track', () => {
  it.each([
    ['--domain-gym-ink', '--domain-gym-tint'],
    ['--domain-running-ink', '--domain-running-tint'],
    ['--domain-sports-ink', '--domain-sports-tint'],
    ['--domain-mental-ink', '--domain-mental-tint'],
    // The Boss and domain-rank bars, which sit on the accent tint.
    ['--accent', '--accent-tint'],
  ])('%s separates from %s', (fill, track) => {
    expect(contrast(hex(fill), hex(track))).toBeGreaterThanOrEqual(LARGE);
  });

  it('does not use a -mid weight as a fill on a tint', () => {
    // `-mid` is verified against *white* and nothing else. Reaching for it
    // here is how the Gym bar shipped at 2.89:1 on a neutral track.
    expect(contrast(hex('--mint-mid'), hex('--mint-tint'))).toBeLessThan(LARGE);
  });
});

describe('surfaces', () => {
  it('separates the ground from a card', () => {
    // Subtle, but it has to be an actual difference — the card is what makes
    // the light theme legible as layers rather than one flat sheet.
    expect(luminance(hex('--surface-elevated'))).toBeGreaterThan(luminance(hex('--surface-base')));
  });
});
