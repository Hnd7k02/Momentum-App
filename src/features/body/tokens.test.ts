import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS } from '../../core/model';
import { MUSCLE_STATE_KEYS, type MuscleState as RendererMuscleState } from '../../components/BodyRenderer';
import { BODY_REGIONS, REGION_FACING } from './muscleMeshMap';
import {
  BODY_BASE_COLOR,
  BODY_LIGHT,
  BODY_UNLIT,
  IDENTITY_COLOR,
  IDENTITY_DESATURATION,
  IDENTITY_UNTRAINED_ALPHA,
  NEUTRAL_HIGHLIGHT,
  STATE_COLOR,
  mutedIdentity,
  type MuscleState,
} from './tokens';

const TOKENS_CSS = readFileSync(fileURLToPath(new URL('../../styles/tokens.css', import.meta.url)), 'utf8');

/**
 * The handoff's ids are Momentum's ids, and its five states are the body
 * renderer's five states. Neither is looked up through a table, so the only
 * way they can drift is silently — these make that loud.
 */

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
// Compile-time: the token file's MuscleState is the renderer's, name for name.
const statesAgree: Equal<MuscleState, RendererMuscleState> = true;

describe('muscle-map tokens follow the domain', () => {
  it('the body regions are the ten muscle groups, in the same order', () => {
    expect([...BODY_REGIONS]).toEqual([...MUSCLE_GROUPS]);
  });

  it('every group has an identity colour and a facing', () => {
    expect(Object.keys(IDENTITY_COLOR).sort()).toEqual([...MUSCLE_GROUPS].sort());
    expect(Object.keys(REGION_FACING).sort()).toEqual([...MUSCLE_GROUPS].sort());
  });

  it('the five state tokens are the five states the renderer draws', () => {
    expect(statesAgree).toBe(true);
    expect(Object.keys(STATE_COLOR).sort()).toEqual(Object.keys(MUSCLE_STATE_KEYS).sort());
  });
});

/**
 * The muscle's identity colour is a dot and nothing else (D154, contract
 * §2.4). Its ten values are written in `tokens.css`; this file only reads
 * them, pulls them 35 % towards their own grey, and hands the dot its colour.
 */
describe('the muscle dot', () => {
  const kebab = (id: string) => id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  const declared = (name: string) => TOKENS_CSS.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6});`, 'i'))?.[1]?.toLowerCase();
  const rgb = (css: string) => css.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number) as [number, number, number];
  const channel = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  const luminance = ([r, g, b]: [number, number, number]) =>
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const hexRgb = (hex: string): [number, number, number] =>
    [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)) as [number, number, number];

  it('reads each group\'s hue from the --muscle-* token of its name', () => {
    for (const id of MUSCLE_GROUPS) {
      expect(declared(`--muscle-${kebab(id)}`), id).toBeDefined();
      expect(IDENTITY_COLOR[id]).toBe(declared(`--muscle-${kebab(id)}`));
    }
    expect(new Set(Object.values(IDENTITY_COLOR)).size).toBe(MUSCLE_GROUPS.length);
  });

  it('keeps the ten approved hues: Stage 6b moved where they are written, not what they are', () => {
    // The table as it stood in this file's subject before the move (contract
    // §2.4). Reading the token back from the token file would agree with
    // any value at all; this is the one place the hues are pinned.
    expect(IDENTITY_COLOR).toEqual({
      chest: '#d9654e', // terracotta
      back: '#2e6fb7', // steel blue
      shoulders: '#e8a33d', // amber
      biceps: '#7b5ac9', // violet
      triceps: '#c45d9e', // magenta
      core: '#c9a227', // ochre
      quadriceps: '#1f9e94', // teal
      hamstringsGlutes: '#8c6239', // bronze
      calves: '#4fb3e8', // sky blue
      forearms: '#6e7b8b', // slate
    });
  });

  it('is pulled 35 % towards its own grey, and 40 % opaque for an untrained group', () => {
    expect(IDENTITY_DESATURATION).toBe(0.35);
    expect(IDENTITY_UNTRAINED_ALPHA).toBe(0.4);
    // Worked by hand for terracotta #d9654e: grey 0.299·217 + 0.587·101 + 0.114·78 = 133.06.
    expect(mutedIdentity('#d9654e')).toBe('rgb(188, 112, 97)');
    expect(mutedIdentity('#d9654e', IDENTITY_UNTRAINED_ALPHA)).toBe('rgba(188, 112, 97, 0.4)');
    // A grey has no hue to lose.
    expect(mutedIdentity('#808080')).toBe('rgb(128, 128, 128)');
  });

  it('stays a visible mark on the Gym card, where the rows are drawn', () => {
    // The Gym block's card solid: the second declaration in the file.
    const card = [...TOKENS_CSS.matchAll(/--glass-solid:\s*(#[0-9a-f]{6});/gi)][1]![1]!;
    const ground = luminance(hexRgb(card));
    expect(ground).toBeLessThan(0.05);
    for (const id of MUSCLE_GROUPS) {
      const dot = luminance(rgb(mutedIdentity(IDENTITY_COLOR[id])));
      expect((dot + 0.05) / (ground + 0.05), id).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('the body\'s material and light are read, never restated', () => {
  it('keeps the approved values, from tokens.css', () => {
    // Stage 6b moved where these are written, not what they are.
    expect(BODY_BASE_COLOR).toBe('#c9c9d2');
    expect(BODY_UNLIT).toBe('#000000');
    expect(NEUTRAL_HIGHLIGHT).toBe('#5e5ce6');
    expect(BODY_LIGHT).toEqual({ sky: '#ffffff', ground: '#cdcdda', fill: '#dfe4f5' });
  });
});
