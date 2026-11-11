import tokensCss from './tokens.css?raw';
import { STATUS_IDS, type StatusId } from '../core/config/constants';

/**
 * The status palette, read from the token file rather than restated.
 *
 * `src/styles/tokens.css` is the one place the status colours are written
 * (D123). CSS consumes them as `var(--status-*)`; anything that needs the
 * value as a string — the WebGL body, an inline style — gets it from here,
 * where it is parsed out of the same file at module load. Two definitions
 * would drift, and a drifted signal colour is the kind of bug nobody files.
 *
 * The parser is deliberately strict: a missing or non-hex token throws when
 * the module loads, which every test that imports it turns into a failure.
 */

export type StatusKey = StatusId | 'empty';

export interface StatusColours {
  /** The status colour itself: a bar, a region, a selected control. */
  fill: string;
  /** Darker text of the same hue, safe on white and on `tint`. */
  ink: string;
  /** The label colour on top of `fill`. */
  on: string;
  /** The pale ground of an unselected control or a badge. */
  tint: string;
}

const DECLARATION = /(--[\w-]+):\s*([^;]+);/g;

function readTokens(css: string): Map<string, string> {
  const found = new Map<string, string>();
  // Comments describe tokens and may quote a declaration; only real ones count.
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(DECLARATION)) {
    // First declaration wins: `:root` is defined once, and a later media
    // block (reduced motion) only ever overrides durations.
    if (!found.has(match[1]!)) found.set(match[1]!, match[2]!.trim());
  }
  return found;
}

const TOKENS = readTokens(tokensCss);

/** A token's value, with `var(--x)` aliases followed, as a six-digit hex. */
export function cssToken(name: string): string {
  let value = TOKENS.get(name);
  for (let depth = 0; depth < 4 && value?.startsWith('var('); depth += 1) {
    value = TOKENS.get(value.slice(4, value.indexOf(')')));
  }
  if (!value) throw new Error(`tokens.css does not define ${name}`);
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} is not a plain hex colour: ${value}`);
  return value.toLowerCase();
}

function statusColours(key: StatusKey): StatusColours {
  const on = key === 'empty' ? cssToken('--text-primary') : cssToken(`--status-${key}-on`);
  return {
    fill: cssToken(`--status-${key}`),
    ink: cssToken(`--status-${key}-ink`),
    on,
    tint: cssToken(`--status-${key}-tint`),
  };
}

export const STATUS_KEYS: readonly StatusKey[] = [...STATUS_IDS, 'empty'];

/** Every status, as the token file defines it. */
export const STATUS_PALETTE: Readonly<Record<StatusKey, StatusColours>> = Object.freeze(
  Object.fromEntries(STATUS_KEYS.map((key) => [key, Object.freeze(statusColours(key))])),
) as Readonly<Record<StatusKey, StatusColours>>;
