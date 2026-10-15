import { describe, expect, it } from 'vitest';
import {
  GRAMS_PER_POUND,
  formatBodyweight,
  formatWeight,
  parseBodyweight,
  parseWeight,
  weightUnitOf,
} from './weight';

/**
 * One formatter and one parser for every weight on screen (WP3, P4).
 * Storage stays grams for sets and kilograms for weight entries.
 */
describe('kilograms', () => {
  it('reads 62.5 kg unchanged, and whole numbers whole', () => {
    expect(parseWeight('62.5', 'kg')).toBe(62500);
    expect(formatWeight(62500, 'kg')).toBe('62.5');
    expect(formatWeight(60000, 'kg')).toBe('60');
    expect(formatWeight(60250, 'kg')).toBe('60.25');
  });

  it('takes a comma as the decimal point', () => {
    expect(parseWeight('62,5', 'kg')).toBe(62500);
  });
});

describe('pounds', () => {
  it.each([
    ['135', 61235],
    ['45', 20412],
    ['2.5', 1134],
  ])('round-trips %s lb through whole grams', (typed, grams) => {
    expect(parseWeight(typed, 'lb')).toBe(grams);
    expect(formatWeight(grams, 'lb')).toBe(typed);
  });

  it('shows at most one decimal', () => {
    expect(formatWeight(62500, 'lb')).toBe('137.8');
    expect(formatWeight(100000, 'lb')).toBe('220.5');
  });

  it('uses the exact avoirdupois pound', () => {
    expect(GRAMS_PER_POUND).toBe(453.59237);
  });
});

describe('weight entries in kilograms', () => {
  it('shows and takes a bodyweight in either unit, stored to the gram in kg', () => {
    expect(formatBodyweight(80, 'kg')).toBe('80');
    expect(formatBodyweight(80, 'lb')).toBe('176.4');
    expect(parseBodyweight('176.4', 'lb')).toBe(80.014);
    expect(parseBodyweight('80.5', 'kg')).toBe(80.5);
  });
});

describe('what is not a number', () => {
  it('reads as null, never as zero', () => {
    expect(parseWeight('', 'kg')).toBeNull();
    expect(parseWeight('abc', 'lb')).toBeNull();
    expect(parseBodyweight('', 'kg')).toBeNull();
    expect(parseWeight('0', 'kg')).toBe(0);
  });
});

describe('the stored preference', () => {
  it('is kilograms unless it says pounds', () => {
    expect(weightUnitOf(undefined)).toBe('kg');
    expect(weightUnitOf('lb')).toBe('lb');
    expect(weightUnitOf('stone')).toBe('kg');
  });
});
