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

  it('describes a custom exercise by its groups alone', () => {
    expect(describeExercise('custom-1', ['Rücken'], 'de')).toBe('Rücken');
  });
});
