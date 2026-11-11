import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS } from '../../core/model';
import type { ShownMuscle } from '../gym/muscleState';
import { BODY_REGIONS } from './muscleMeshMap';
import { BODY_DIMMED_COLOR, BODY_HELD_COLOR, STATE_COLOR, TINT_STRENGTH, stateIntensity } from './tokens';
import { toBodyVisuals, visualsByMuscle } from './bodyVisuals';

const shown = (muscle: ShownMuscle['muscle'], state: ShownMuscle['state'], change: number | null): ShownMuscle => ({
  muscle, state, change, exerciseDays: state === 'noData' ? 0 : 4, compared: change !== null,
});

const SAMPLE: ShownMuscle[] = [
  shown('chest', 'improved', 12), shown('back', 'declined', -6), shown('shoulders', 'unchanged', 0),
  shown('biceps', 'awaitingBaseline', null), shown('triceps', 'noData', null), shown('core', 'improved', 7),
  shown('quadriceps', 'unchanged', -2), shown('hamstringsGlutes', 'unchanged', 1.4), shown('calves', 'noData', null),
  shown('forearms', 'noData', null),
];

describe('toBodyVisuals', () => {
  it('maps all ten muscle groups, in region order, even when some are absent from the input', () => {
    const visuals = toBodyVisuals(SAMPLE.slice(0, 4));
    expect(visuals.map((v) => v.id)).toEqual([...BODY_REGIONS]);
    expect(visuals.map((v) => v.id)).toEqual([...MUSCLE_GROUPS]);
    expect(visuals.slice(4).every((v) => v.state === 'noData' && v.intensity === 0 && v.delta === null)).toBe(true);
  });

  it('takes state and change as the screen shows them, and derives neither', () => {
    const visuals = toBodyVisuals(SAMPLE);
    for (const entry of SAMPLE) {
      const visual = visuals.find((v) => v.id === entry.muscle)!;
      expect(visual.state).toBe(entry.state);
      expect(visual.delta).toBe(entry.change);
    }
  });

  it('tint is the state model colour and intensity the curve, from tokens.ts', () => {
    for (const visual of toBodyVisuals(SAMPLE)) {
      expect(visual.tint).toBe(STATE_COLOR[visual.state].model);
      expect(visual.ground).toBe(STATE_COLOR[visual.state].ground);
      expect(visual.intensity).toBe(stateIntensity(visual.state, visual.delta ?? 0));
    }
    const chest = toBodyVisuals(SAMPLE).find((v) => v.id === 'chest')!;
    expect(chest.intensity).toBeCloseTo(1, 6); // +12 % saturates the curve
    expect(toBodyVisuals(SAMPLE).find((v) => v.id === 'calves')!.intensity).toBe(0);
  });

  it('a held group is white and untinted, an untrained one dimmed (contract §8)', () => {
    const visuals = toBodyVisuals(SAMPLE);
    for (const id of ['shoulders', 'quadriceps', 'hamstringsGlutes'] as const) {
      expect(visuals.find((v) => v.id === id)).toMatchObject({ ground: BODY_HELD_COLOR, intensity: 0 });
    }
    for (const id of ['triceps', 'calves', 'forearms'] as const) {
      expect(visuals.find((v) => v.id === id)).toMatchObject({ ground: BODY_DIMMED_COLOR, intensity: 0 });
    }
    // Every tinted state is a trained one: its tint is mixed from white.
    for (const id of ['chest', 'back', 'biceps', 'core'] as const) {
      expect(visuals.find((v) => v.id === id)!.ground).toBe(BODY_HELD_COLOR);
    }
  });

  it('does not mutate what it is given', () => {
    const frozen = SAMPLE.map((entry) => Object.freeze({ ...entry }));
    const snapshot = JSON.stringify(frozen);
    toBodyVisuals(frozen);
    visualsByMuscle(toBodyVisuals(frozen));
    expect(JSON.stringify(frozen)).toBe(snapshot);
  });

  it('visualsByMuscle carries tint, ground and intensity into the viewer prop shape', () => {
    const byMuscle = visualsByMuscle(toBodyVisuals(SAMPLE));
    expect(Object.keys(byMuscle).sort()).toEqual([...MUSCLE_GROUPS].sort());
    expect(byMuscle.chest).toEqual({ tint: STATE_COLOR.improved.model, ground: BODY_HELD_COLOR, intensity: 1 });
    expect(byMuscle.biceps).toEqual({
      tint: STATE_COLOR.awaitingBaseline.model,
      ground: BODY_HELD_COLOR,
      intensity: TINT_STRENGTH.awaitingBaseline,
    });
  });
});

describe('the strength of a tint (contract §7)', () => {
  it('grows evenly from 2.5 % to 12 % and stays there', () => {
    const { min } = TINT_STRENGTH;
    expect(stateIntensity('improved', 2.5)).toBe(min);
    expect(stateIntensity('improved', 12)).toBe(1);
    expect(stateIntensity('improved', 40)).toBe(1);
    // Evenly: the midpoint of the range is the midpoint of the strength.
    expect(stateIntensity('improved', 7.25)).toBeCloseTo((min + 1) / 2, 12);
    const steps = [2.5, 4.4, 6.3, 8.2, 10.1, 12].map((pct) => stateIntensity('improved', pct));
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]! - steps[i - 1]!).toBeCloseTo((1 - min) / 5, 12);
    }
  });

  it('is the same for a fall as for a rise of the same size', () => {
    for (const pct of [2.5, 3, 6, 12, 30]) {
      expect(stateIntensity('declined', -pct)).toBe(stateIntensity('improved', pct));
    }
  });

  it('is nothing for held and untrained, and fixed for too little to compare', () => {
    expect(stateIntensity('unchanged', 2)).toBe(0);
    expect(stateIntensity('unchanged', -2.4)).toBe(0);
    expect(stateIntensity('noData', 0)).toBe(0);
    expect(stateIntensity('awaitingBaseline', 0)).toBe(TINT_STRENGTH.awaitingBaseline);
    expect(stateIntensity('awaitingBaseline', 25)).toBe(TINT_STRENGTH.awaitingBaseline);
    // Lightly: weaker than a full tint, and never nothing.
    expect(TINT_STRENGTH.awaitingBaseline).toBeGreaterThan(0);
    expect(TINT_STRENGTH.awaitingBaseline).toBeLessThan(1);
  });
});
