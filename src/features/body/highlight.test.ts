import { describe, expect, it } from 'vitest';
import { regionTargets } from './useMuscleHighlight';
import { BODY_DIMMED_COLOR, BODY_HELD_COLOR, BODY_INERT_COLOR, NEUTRAL_HIGHLIGHT, REGION_MATERIAL, STATE_COLOR, stateIntensity } from './tokens';

/**
 * The one rule that is easy to get wrong: a group with nothing to report
 * must still look chosen when it is chosen.
 */
describe('regionTargets', () => {
  const visual = (state: keyof typeof STATE_COLOR, delta: number) => ({
    tint: STATE_COLOR[state].model,
    ground: STATE_COLOR[state].ground,
    intensity: stateIntensity(state, delta),
  });
  const untrained = visual('noData', 0);
  const held = visual('unchanged', 1);
  const improved = visual('improved', 12);

  it('an untrained group is the dimmed tone and draws no attention', () => {
    expect(regionTargets(untrained, false)).toEqual({
      color: BODY_DIMMED_COLOR, emissive: '#000000', emissiveIntensity: 0, rim: 0, rimColor: '#000000',
    });
  });

  it('a held group is white, with no tint, glow or rim (contract §8)', () => {
    expect(regionTargets(held, false)).toEqual({
      color: BODY_HELD_COLOR, emissive: '#000000', emissiveIntensity: 0, rim: 0, rimColor: '#000000',
    });
    // Chosen, it stays white and takes the neutral cue — never a status colour.
    const chosen = regionTargets(held, true);
    expect(chosen.color).toBe(BODY_HELD_COLOR);
    expect(chosen.rimColor).toBe(NEUTRAL_HIGHLIGHT);
    expect(chosen.rim).toBeGreaterThan(0);
  });

  it('the two neutral tones are told apart: white is clearly lighter than dimmed', () => {
    const lightness = (hex: string) => [1, 3, 5].reduce((sum, at) => sum + parseInt(hex.slice(at, at + 2), 16), 0) / 3;
    expect(lightness(BODY_HELD_COLOR) - lightness(BODY_DIMMED_COLOR)).toBeGreaterThan(80);
  });

  it('and selecting it shows the neutral cue without inventing a result', () => {
    const target = regionTargets(untrained, true);
    expect(target.color).toBe(BODY_DIMMED_COLOR);          // still dimmed, still noData
    expect(target.emissive).toBe(NEUTRAL_HIGHLIGHT);       // never a state colour
    expect(target.rimColor).toBe(NEUTRAL_HIGHLIGHT);
    expect(target.rim).toBeGreaterThan(0);
    expect(target.emissiveIntensity).toBeGreaterThan(0);
  });

  it('a group with no visual at all behaves the same way', () => {
    expect(regionTargets(undefined, true).rimColor).toBe(NEUTRAL_HIGHLIGHT);
    expect(regionTargets(undefined, false).rim).toBe(0);
  });

  it('a measured group is tinted with its state, more so when selected', () => {
    const resting = regionTargets(improved, false);
    const chosen = regionTargets(improved, true);
    expect(resting.emissive).toBe(STATE_COLOR.improved.model);
    expect(chosen.rimColor).toBe(STATE_COLOR.improved.model);
    expect(chosen.rim).toBe(REGION_MATERIAL.selected.rim);
    expect(chosen.emissiveIntensity).toBeGreaterThan(resting.emissiveIntensity);
    expect(chosen.color).not.toBe(resting.color);
    expect(chosen.color).not.toBe(BODY_HELD_COLOR);
  });

  it('a tint is mixed from white, and the weakest is three eighths of the way', () => {
    const hex = (value: string) => [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16));
    const weakest = regionTargets(visual('improved', 2.5), false);
    const white = hex(BODY_HELD_COLOR);
    const green = hex(STATE_COLOR.improved.model);
    const mix = REGION_MATERIAL.resting.mix * stateIntensity('improved', 2.5);
    expect(mix).toBeCloseTo(0.375, 6);
    expect(hex(weakest.color)).toEqual(white.map((from, i) => Math.round(from + (green[i]! - from) * mix)));
    // +3 % is a different colour from a held group beside it.
    expect(weakest.color).not.toBe(regionTargets(held, false).color);
  });

  it('with tinting off every group falls back to the neutral treatment', () => {
    expect(regionTargets(improved, true, false).rimColor).toBe(NEUTRAL_HIGHLIGHT);
    // …and is one figure in the inert zone's tone: neither trained nor untrained (D166).
    expect(regionTargets(improved, false, false).color).toBe(BODY_INERT_COLOR);
    expect(regionTargets(held, false, false).color).toBe(BODY_INERT_COLOR);
    expect(regionTargets(untrained, false, false).color).toBe(BODY_INERT_COLOR);
  });
});
