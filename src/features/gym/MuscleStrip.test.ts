import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS, type MuscleGroup } from '../../core/model';
import { strongestOf } from './MuscleStrip';
import type { ShownMuscle } from './muscleState';

/**
 * The one choice the metrics strip makes itself (block 7B): which rated
 * group stands in its third cell. Everything else it shows is
 * `shownPerformance()`'s.
 */

const untrained = (muscle: MuscleGroup): ShownMuscle => ({ muscle, state: 'noData', change: null, exerciseDays: 0, compared: false });
const body = (some: Partial<Record<MuscleGroup, Pick<ShownMuscle, 'state' | 'change'>>>): ShownMuscle[] =>
  MUSCLE_GROUPS.map((muscle) => ({ ...untrained(muscle), ...(some[muscle] ? { ...some[muscle], exerciseDays: 4, compared: true } : {}) }));

describe('the strongest group', () => {
  it('is the improved group with the largest change', () => {
    const muscles = body({
      chest: { state: 'improved', change: 4.2 },
      quadriceps: { state: 'improved', change: 9.4 },
      back: { state: 'unchanged', change: 1.2 },
      calves: { state: 'declined', change: -5 },
    });
    expect(strongestOf(muscles)?.muscle).toBe('quadriceps');
  });

  it('of two equal ones the first in the domain\'s order', () => {
    const muscles = body({ shoulders: { state: 'improved', change: 6 }, chest: { state: 'improved', change: 6 } });
    expect(strongestOf(muscles)?.muscle).toBe('chest');
  });

  it('is nobody when no rated group improved: the least decline is not the strongest', () => {
    expect(strongestOf(body({ back: { state: 'unchanged', change: 1.4 }, calves: { state: 'declined', change: -3 } }))).toBeNull();
    expect(strongestOf(body({}))).toBeNull();
  });

  it('never a group that prints no figure', () => {
    const muscles = body({ biceps: { state: 'awaitingBaseline', change: null }, chest: { state: 'improved', change: 2 } });
    expect(strongestOf(muscles)?.muscle).toBe('chest');
  });
});
