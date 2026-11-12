/**
 * Momentum muscle-map colour tokens.
 *
 * Two systems run side by side and must not be mixed:
 *
 *   IDENTITY  answers "which muscle is this?"   — fixed per group, state-independent
 *   STATE     answers "how did it go?"          — the five training states
 *             (contract §7): improved is the status `strong`, declined is
 *             `weak`, awaitingBaseline the informational blue. Held and
 *             untrained carry no status colour at all: held is neutral —
 *             the text colour in a row, white on the body — and untrained
 *             is dimmed. "Gehalten" was the warning yellow until D153.
 *
 * Identity appears in exactly one place (D154): an 8px dot before the
 * group's name. It colours no line, no ring and no surface.
 * State is used for: the tinted regions on the 3D model (colour + emissive +
 * rim), the percentage in the row, the status badge, the end point of the
 * row's trend line, and any legend that lists STATES.
 *
 * Nothing here is a literal: every colour is read out of `tokens.css`
 * through `statusPalette.ts`, the one place a colour is written.
 */

import { MUSCLE_GROUPS, type MuscleGroup } from '../../core/model';
import { STATUS_PALETTE, cssToken } from '../../styles/statusPalette';

export type MuscleState =
  | 'improved'          // Verbessert
  | 'declined'          // Zurückgegangen
  | 'unchanged'         // Gehalten
  | 'awaitingBaseline'  // Zu wenig Vergleichsdaten
  | 'noData';           // Noch nicht trainiert

/* ── A. identity ───────────────────────────────────────────────────────── */

/** The token each group's identity hue is declared under in `tokens.css`. */
const IDENTITY_TOKEN: Readonly<Record<MuscleGroup, string>> = {
  chest: '--muscle-chest',                        // Terracotta
  back: '--muscle-back',                          // Stahlblau
  shoulders: '--muscle-shoulders',                // Amber
  biceps: '--muscle-biceps',                      // Violett
  triceps: '--muscle-triceps',                    // Magenta
  core: '--muscle-core',                          // Ocker
  quadriceps: '--muscle-quadriceps',              // Teal
  hamstringsGlutes: '--muscle-hamstrings-glutes', // Bronze
  calves: '--muscle-calves',                      // Himmelblau
  forearms: '--muscle-forearms',                  // Schiefer
};

/** Base identity hue per group, as `tokens.css` declares it. Never derived from state. */
export const IDENTITY_COLOR: Readonly<Record<MuscleGroup, string>> = Object.freeze(
  Object.fromEntries(MUSCLE_GROUPS.map((id) => [id, cssToken(IDENTITY_TOKEN[id])])),
) as Readonly<Record<MuscleGroup, string>>;

/**
 * How far the dot is pulled toward its own grey (contract §2.4): 35 %, so
 * terracotta beside a green figure, or teal beside a red one, does not read
 * as a status.
 */
export const IDENTITY_DESATURATION = 0.35;

/** Opacity of an untrained group's dot — present, but clearly inactive. */
export const IDENTITY_UNTRAINED_ALPHA = 0.4;

/** The dot's colour: the identity hue, muted. Returns an rgb()/rgba() string. */
export function mutedIdentity(hex: string, alpha = 1): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const grey = 0.299 * r + 0.587 * g + 0.114 * b;
  const mix = (c: number) => Math.round(c + (grey - c) * IDENTITY_DESATURATION);
  return alpha >= 1
    ? `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
    : `rgba(${mix(r)}, ${mix(g)}, ${mix(b)}, ${alpha})`;
}

/* ── B. state ──────────────────────────────────────────────────────────── */

export interface StateTokens {
  /** German label used by the badge and the legend. */
  text: string;
  /** Text-safe: the percentage, the badge text, the row figure. */
  ink: string;
  /** Badge background. */
  tint: string;
  /**
   * What the 3D region is tinted with: colour + emissive + rim. For the two
   * states without a status colour it is the neutral tone they stand in.
   */
  model: string;
  /** The neutral tone the region stands on before any tint. */
  ground: string;
}

/**
 * Nothing here is a literal. The three status states read the status
 * palette, which is parsed out of `tokens.css`; the informational blue is
 * the same `--sky-*` pair the 2D renderer and the muscle rows use. The 3D
 * region takes the status colour itself — the signal, not its text ink —
 * so the body and the legend swatch next to it are the same colour.
 */
const SKY_INK = cssToken('--sky-ink');
const SKY_FILL = cssToken('--sky-fill');

/* ── C. 3D material + selection treatment ─────────────────────────────── */

/**
 * White: a trained muscle with no change, "Gehalten" — and the ground every
 * tint is mixed from, so a small improvement is a white muscle turning green.
 */
export const BODY_HELD_COLOR = cssToken('--body-held');

/**
 * Dimmed: what says nothing. An untrained muscle, and the inert `none`
 * region (head, hands, feet). A body with no data is a quiet grey figure,
 * and training makes it light (contract §8, D161).
 */
export const BODY_DIMMED_COLOR = cssToken('--body-dimmed');

export const STATE_COLOR: Readonly<Record<MuscleState, StateTokens>> = {
  improved:         { text: 'Verbessert',               ink: STATUS_PALETTE.strong.ink,  tint: STATUS_PALETTE.strong.tint, model: STATUS_PALETTE.strong.fill, ground: BODY_HELD_COLOR },
  declined:         { text: 'Zurückgegangen',           ink: STATUS_PALETTE.weak.ink,    tint: STATUS_PALETTE.weak.tint,   model: STATUS_PALETTE.weak.fill,   ground: BODY_HELD_COLOR },
  unchanged:        { text: 'Gehalten',                 ink: cssToken('--text-primary'), tint: STATUS_PALETTE.empty.tint, model: BODY_HELD_COLOR,   ground: BODY_HELD_COLOR },
  awaitingBaseline: { text: 'Zu wenig Vergleichsdaten', ink: SKY_INK,                    tint: cssToken('--sky-tint'),    model: SKY_FILL,          ground: BODY_HELD_COLOR },
  noData:           { text: 'Noch nicht trainiert',     ink: STATUS_PALETTE.empty.ink,   tint: STATUS_PALETTE.empty.tint, model: BODY_DIMMED_COLOR, ground: BODY_DIMMED_COLOR },
};

/** Highlight used when tinting is off (data-tint="off") and a group is selected. */
export const NEUTRAL_HIGHLIGHT = cssToken('--accent');

/** The colour of an emissive or rim term that adds no light. */
export const BODY_UNLIT = cssToken('--body-unlit');

/**
 * The colours of the lights the body stands in: the hemisphere's sky and
 * ground, and the cool fill from the right. The key and the back light are
 * white by default. Values as approved; block 7A owns the lighting.
 */
export const BODY_LIGHT = {
  sky: cssToken('--body-light-sky'),
  ground: cssToken('--body-light-ground'),
  fill: cssToken('--body-light-fill'),
} as const;

/**
 * The light the body stands in and how the picture reaches the screen, as
 * data. `BODY_LOOK` is what the app shows: the values approved with the
 * muscle map, unchanged. Block 7A judges a new look on its candidates through
 * the dev harness (`#/dev/body?look=7a`) and moves it here once the owner has
 * chosen a body at the gate — until then nothing in the app changes.
 */
export type BodyLook = {
  toneMapping: 'aces' | 'agx' | 'none';
  exposure: number;
  /** The hemisphere's strength: the light that comes from everywhere. */
  hemisphere: number;
  key: { position: readonly [number, number, number]; intensity: number };
  fill: { position: readonly [number, number, number]; intensity: number };
  back: { position: readonly [number, number, number]; intensity: number };
  /** How the surface takes the light; absent leaves each material its own value. */
  surface?: { roughness?: number; inertRoughness?: number; environment?: number };
};

export const BODY_LOOK: BodyLook = {
  toneMapping: 'aces',
  exposure: 1,
  hemisphere: 1.35,
  key: { position: [-1.7, 2.6, 2.4], intensity: 2.15 },
  fill: { position: [2.4, 0.9, 1.5], intensity: 0.75 },
  back: { position: [0.4, 1.9, -2.8], intensity: 1.05 },
};

/**
 * Region material mix. `intensity` (0…1) comes from the host and carries the
 * MAGNITUDE of the change, so +12 % burns brighter than +3 %.
 *
 *   color    = lerp(ground, STATE_COLOR[state].model, mix * intensity)
 *   emissive = STATE_COLOR[state].model at emissiveIntensity * intensity
 *   rim      = STATE_COLOR[state].model at rim * intensity   (Fresnel, pow 2.6)
 *
 * The ground is white for every trained group, so the mix is what makes a
 * tint: three quarters of the way to the status colour at full strength,
 * three eighths at the weakest. The mock-ups' tool had a quarter there; it
 * is raised because under today's light and tone mapping green arrives much
 * weaker than red. Measured on the rendered body at 393px, as the median
 * difference of the chest at +3 % from the same chest held: 4.1 ΔE at a
 * quarter, 4.8 at three tenths, 6.5 at three eighths; the quadriceps at
 * −3 % 9.0, 10.8 and 14.7. `farbregeln.mjs` holds both at 5 or more. Roughness, the lights and the tone mapping are block 7A's.
 */
export const REGION_MATERIAL = {
  roughness: 0.74,
  metalness: 0,
  resting:  { mix: 0.75, emissiveIntensity: 0.11, rim: 0.42 },
  selected: { mix: 0.88, emissiveIntensity: 0.26, rim: 0.95 },
  /** Exponential ease rate; 1 - exp(-dt * rate) settles in ~250 ms. */
  easeRate: 12,
} as const;

/**
 * The strength of a tint (contract §7): it grows evenly from 2.5 % to 12 %
 * and stays there. 2.5 % is where the band ends — the smallest change that
 * is shown as ±3 % — and it starts at `TINT_STRENGTH.min`, the least at
 * which +3 % reads as green beside a held, white group on a phone, with a
 * margin (see `REGION_MATERIAL`).
 */
export const TINT_STRENGTH = {
  fromPercent: 2.5,
  toPercent: 12,
  min: 0.5,
  /** "Zu wenig Vergleichsdaten": lightly blue, whatever its ratio. */
  awaitingBaseline: 0.5,
} as const;

/** The strength of a state's tint, from the unrounded change. */
export function stateIntensity(state: MuscleState, deltaPercent: number): number {
  // Held is white and untrained is dimmed: neither carries a tint.
  if (state === 'noData' || state === 'unchanged') return 0;
  if (state === 'awaitingBaseline') return TINT_STRENGTH.awaitingBaseline;
  const { fromPercent, toPercent, min } = TINT_STRENGTH;
  const along = (Math.abs(deltaPercent) - fromPercent) / (toPercent - fromPercent);
  return min + Math.max(0, Math.min(1, along)) * (1 - min);
}
