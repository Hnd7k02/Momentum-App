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
 *
 * Since WP3 Stage 6 there are two worlds (P11). `:root` is Mind, light, and
 * `[data-world="gym"]` is Gym, dark; a token the Gym block does not redefine
 * is inherited from `:root`. Every promise below is held for each set
 * against *its own* ground — the solid a glass card falls back to — so an
 * ink that reads on white is not assumed to read on #171c2b. While Stage 6a
 * is open the second design variant's overrides are read from
 * `stage6-variant-b.css` and held to the same promises; that file goes at
 * 6b.
 */

const TOKENS_CSS = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');
const VARIANT_B_CSS = readFileSync(fileURLToPath(new URL('./stage6-variant-b.css', import.meta.url)), 'utf8');

type Declarations = Map<string, string>;

/**
 * The custom-property declarations of each top-level rule, by selector.
 * At-rules (`@media`, `@supports`) are skipped whole: the reduced-motion
 * block only overrides durations and a fallback block is not a token set.
 */
function rules(css: string): Array<{ selector: string; declarations: Declarations }> {
  const out: Array<{ selector: string; declarations: Declarations }> = [];
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  let selector = '';
  let body = '';
  let skipping = 0;
  for (const char of source) {
    if (char === '{') {
      if (depth === 0 && selector.trim().startsWith('@')) skipping = 1;
      else if (skipping) skipping += 1;
      depth += 1;
      if (depth === 1) body = '';
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (skipping) {
        skipping -= 1;
        if (skipping === 0) selector = '';
        continue;
      }
      if (depth === 0) {
        const declarations: Declarations = new Map();
        // A last declaration may lack its semicolon; it still counts.
        const text = body.trim().endsWith(';') ? body : `${body};`;
        for (const match of text.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
          declarations.set(match[1]!, match[2]!.replace(/\s+/g, ' ').trim());
        }
        out.push({ selector: selector.replace(/\s+/g, ' ').trim(), declarations });
        selector = '';
      }
      continue;
    }
    if (depth === 0) selector += char;
    else if (depth === 1 && !skipping) body += char;
  }
  return out;
}

function declarationsOf(css: string, selector: string): Declarations {
  const rule = rules(css).find((entry) => entry.selector === selector);
  if (!rule) throw new Error(`No rule "${selector}"`);
  return rule.declarations;
}

/** A set is a base with overrides laid on top, `var()` aliases resolved within the set. */
function set(...layers: Declarations[]): Declarations {
  const merged: Declarations = new Map();
  for (const layer of layers) for (const [name, value] of layer) merged.set(name, value);
  const resolved: Declarations = new Map();
  for (const [name, value] of merged) {
    let current = value;
    for (let depth = 0; depth < 6 && current.startsWith('var('); depth += 1) {
      const target = current.slice(4, current.indexOf(')'));
      current = merged.get(target) ?? current;
    }
    resolved.set(name, current);
  }
  return resolved;
}

const ROOT = declarationsOf(TOKENS_CSS, ':root');
const GYM = declarationsOf(TOKENS_CSS, '[data-world="gym"], :root:not([data-variant="b"]) [data-tile="gym"]');
const ROOT_B = declarationsOf(VARIANT_B_CSS, ':root[data-variant="b"]');
const GYM_B = declarationsOf(VARIANT_B_CSS, '[data-variant="b"] [data-world="gym"], [data-variant="b"][data-world="gym"]');

/*
 * Layered as the browser cascades them on `<html>`: `:root` and the Gym
 * block are both (0,1,0) with the Gym block later; B's two rules are (0,2,0)
 * and outrank both, B's Gym rule last of all.
 */
const SETS: Array<[string, Declarations]> = [
  ['Mind (A)', set(ROOT)],
  ['Gym (A)', set(ROOT, GYM)],
  ['Mind (B)', set(ROOT, ROOT_B)],
  ['Gym (B)', set(ROOT, GYM, ROOT_B, GYM_B)],
];

function hexIn(tokens: Declarations, name: string): string {
  const value = tokens.get(name);
  if (!value) throw new Error(`Token ${name} is not defined`);
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`Token ${name} is not a plain hex: ${value}`);
  return value.toLowerCase();
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

/** WCAG AA: 4.5:1 for body text, 3:1 for large text and graphical objects. */
const BODY = 4.5;
const LARGE = 3;

const STATUSES = ['weak', 'mixed', 'good', 'strong'];

describe('the two worlds share one vocabulary', () => {
  it('the Gym block redefines only tokens the light set declares', () => {
    // A misspelt override would silently define a token nothing reads.
    for (const name of GYM.keys()) expect(ROOT.has(name), name).toBe(true);
  });

  it('the Gym block redefines colours only — type, spacing and motion are one system', () => {
    for (const name of GYM.keys()) {
      expect(name, name).not.toMatch(/^--(type|weight|space|radius|touch|tab-bar-height|workout-bar|safe|duration|ease|card-pad|card-gutter|meter)/);
    }
  });

  it('variant B overrides only tokens that exist', () => {
    for (const name of ROOT_B.keys()) expect(ROOT.has(name), name).toBe(true);
    for (const name of GYM_B.keys()) expect(ROOT.has(name), name).toBe(true);
  });

  it('keeps the status fills the one definition (D123) in every set', () => {
    for (const [, tokens] of SETS) {
      for (const status of [...STATUSES]) {
        expect(hexIn(tokens, `--status-${status}`)).toBe(hexIn(set(ROOT), `--status-${status}`));
      }
    }
  });
});

describe.each(SETS)('%s', (_label, tokens) => {
  const hex = (name: string) => hexIn(tokens, name);
  /** The solid a glass card falls back to: what text on a card is held against. */
  const CARD = hex('--glass-solid');
  /** The ground beneath the header and the labels between cards. */
  const GROUND = hex('--surface-base');
  const dark = luminance(GROUND) < 0.2;

  describe('text on a card and on the ground', () => {
    it.each(['--text-primary', '--text-secondary', '--accent'])('%s is readable on a card', (name) => {
      expect(contrast(hex(name), CARD)).toBeGreaterThanOrEqual(BODY);
    });

    it.each(['--text-primary', '--text-secondary'])('%s is readable on the ground', (name) => {
      expect(contrast(hex(name), GROUND)).toBeGreaterThanOrEqual(BODY);
    });

    it.each([
      '--lilac-ink',
      '--mint-ink',
      '--sky-ink',
      '--peach-ink',
      '--rose-ink',
      '--sand-ink',
    ])('%s is safe for text, which is what "ink" promises', (name) => {
      expect(contrast(hex(name), CARD)).toBeGreaterThanOrEqual(BODY);
    });

    it('--accent-ink reads on a card', () => {
      expect(contrast(hex('--accent-ink'), CARD)).toBeGreaterThanOrEqual(BODY);
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

  describe('the label on a filled control', () => {
    it.each(['--accent', '--accent-pressed', '--lilac-ink', '--mint-ink'])(
      '--text-on-accent reads on %s',
      (name) => {
        // The primary button, and the "yes" option, carry this label.
        expect(contrast(hex('--text-on-accent'), hex(name))).toBeGreaterThanOrEqual(BODY);
      },
    );

    it.each(['--lilac-mid', '--mint-mid'])(
      '%s carries a graphical control against a card, not body text',
      (name) => {
        // The `-mid` weights are switches and display type, never 17px labels.
        expect(contrast(hex(name), CARD)).toBeGreaterThanOrEqual(LARGE);
      },
    );
  });

  /**
   * The status palette (D123).
   *
   * Weak, mixed, good and strong are a product decision about *hue*, bright
   * by design. Everything below is the accessibility half of it, which the
   * decision does not settle and which cannot be checked by eye: the fills
   * carry no text of their own, so each status has a darker (on dark, a
   * lighter) ink for text and outlines, an `-on` colour for the label inside
   * a filled control, and a tint for badges. Text moves; the bar never does.
   */
  describe('the status palette', () => {
    it.each(STATUSES)('--status-%s-ink is safe for text on a card', (status) => {
      expect(contrast(hex(`--status-${status}-ink`), CARD)).toBeGreaterThanOrEqual(BODY);
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
      expect(contrast(hex(`--status-${status}-ink`), CARD)).toBeGreaterThanOrEqual(LARGE);
      expect(contrast(hex(`--status-${status}-ink`), hex('--status-track'))).toBeGreaterThanOrEqual(
        LARGE,
      );
    });

    it('keeps the empty ink readable, because "no data" is spelled out too', () => {
      expect(contrast(hex('--status-empty-ink'), CARD)).toBeGreaterThanOrEqual(BODY);
    });

    it('keeps the no-data cell outside the range of the status fills', () => {
      // An empty cell must never be mistaken for a recorded day. The history
      // bars carry the value as height; this is the one promise colour makes:
      // lighter than every fill on a light ground, darker than every fill on
      // a dark one.
      const fills = STATUSES.map((status) => luminance(hex(`--status-${status}`)));
      const empty = luminance(hex('--status-empty'));
      if (dark) expect(empty).toBeLessThan(Math.min(...fills));
      else expect(empty).toBeGreaterThan(Math.max(...fills));
    });

    it('uses four distinct fills', () => {
      expect(new Set(STATUSES.map((status) => hex(`--status-${status}`))).size).toBe(4);
    });
  });

  /**
   * Progress bars.
   *
   * The track is tinted from the bar's own fill, which is a geometry decision
   * with an accessibility consequence: the filled part is a graphical object
   * and has to stay 3:1 against the unfilled part, or the bar stops saying
   * anything. Each pair is checked rather than assumed.
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
  });

  describe('surfaces', () => {
    it('separates the ground from a card', () => {
      // Subtle, but it has to be an actual difference — the card is what makes
      // a theme legible as layers rather than one flat sheet. Lighter on the
      // light ground, lighter again on the dark one: a card lifts both ways.
      expect(luminance(hex('--surface-elevated'))).toBeGreaterThan(luminance(hex('--surface-base')));
    });

    it('lifts a selected option off its track', () => {
      // The segmented pill and the body's view pills: on light the selection
      // is white on a recessed grey, on dark it is the lighter of the two.
      expect(luminance(hex('--surface-selected'))).toBeGreaterThan(luminance(hex('--surface-input')));
    });

    it('names a status-bar colour of the same world', () => {
      const bar = luminance(hex('--status-bar'));
      if (dark) expect(bar).toBeLessThan(0.1);
      else expect(bar).toBeGreaterThan(0.8);
    });
  });
});

describe('the light set, as it always was', () => {
  const hex = (name: string) => hexIn(set(ROOT), name);

  it('does not use a -mid weight as a fill on a tint', () => {
    // `-mid` is verified against the card and nothing else. Reaching for it
    // here is how the Gym bar shipped at 2.89:1 on a neutral track.
    expect(contrast(hex('--mint-mid'), hex('--mint-tint'))).toBeLessThan(LARGE);
  });
});
