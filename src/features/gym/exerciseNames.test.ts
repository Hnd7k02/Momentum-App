import { describe, expect, it } from 'vitest';
import { describeExercise } from './exerciseNames';

/**
 * Picker rows (WP3, B11): the catalogue detail first, then the groups — but
 * never a detail that a group label already says.
 */
describe('describeExercise', () => {
  it('drops a detail a group label contains', () => {
    expect(describeExercise('ex_leg_curl', ['Beinbeuger und Gesäss'], 'de')).toBe('Beinbeuger und Gesäss');
  });

  it('drops a detail equal to a group, ignoring case', () => {
    expect(describeExercise('ex_triceps_pushdown', ['Trizeps'], 'de')).toBe('Trizeps');
  });

  it('keeps a detail that adds something', () => {
    expect(describeExercise('ex_incline_press', ['Brust', 'Schultern', 'Trizeps'], 'de')).toBe(
      'obere Brust · Brust · Schultern · Trizeps',
    );
  });

  it('drops a detail of several parts when every part is a group', () => {
    expect(
      describeExercise('ex_squat', ['Quadrizeps', 'Beinbeuger und Gesäss', 'Rumpf'], 'de'),
    ).toBe('Quadrizeps · Beinbeuger und Gesäss · Rumpf');
    expect(
      describeExercise('ex_deadlift', ['Rücken', 'Beinbeuger und Gesäss', 'Unterarme'], 'de'),
    ).toBe('Rücken · Beinbeuger und Gesäss · Unterarme');
  });

  it('keeps a detail of several parts when one part adds something', () => {
    expect(describeExercise('ex_dip', ['Trizeps', 'Brust', 'Schultern'], 'de')).toBe(
      'Brust unten / Trizeps · Trizeps · Brust · Schultern',
    );
  });

  it('describes a custom exercise by its groups alone', () => {
    expect(describeExercise('custom-1', ['Rücken'], 'de')).toBe('Rücken');
  });
});
