import { describe, expect, it } from 'vitest';
import { formatDayAndMonth, formatFullDate, formatNumber, formatPercent, formatRelativeDay, formatWeekday } from './format';
import { translate } from './index';

describe('numbers', () => {
  it('groups German thousands the Swiss way', () => {
    expect(formatNumber('de', 4820)).toBe("4'820");
    expect(formatNumber('de', 1234567)).toBe("1'234'567");
    expect(formatNumber('de', 820)).toBe('820');
  });

  it('groups English thousands with commas', () => {
    expect(formatNumber('en', 4820)).toBe('4,820');
  });

  it('shows percentages without decimals', () => {
    expect(formatPercent('de', 66.6)).toBe('67\u00A0%');
    expect(formatPercent('en', 100)).toBe('100\u00A0%');
    // A negative share carries the minus sign in both languages, and −0 none.
    expect(formatPercent('de', -9.6)).toBe('\u221210\u00A0%');
    expect(formatPercent('en', -3)).toBe('\u22123\u00A0%');
    expect(formatPercent('de', -0.4)).toBe('0\u00A0%');
  });
});

describe('dates', () => {
  it('formats German dates in Hochdeutsch', () => {
    expect(formatFullDate('de', '2025-03-31')).toBe('31.03.2025');
    expect(formatDayAndMonth('de', '2025-03-31')).toBe('31. März');
    expect(formatWeekday('de', '2025-03-31')).toBe('Montag');
  });

  it('formats English dates', () => {
    expect(formatFullDate('en', '2025-03-31')).toBe('31/03/2025');
    expect(formatWeekday('en', '2025-03-31')).toBe('Monday');
  });

  it('prefers a relative day over a date the user has to decode', () => {
    expect(formatRelativeDay('de', '2025-03-31', '2025-03-31')).toBe('Heute');
    expect(formatRelativeDay('de', '2025-03-30', '2025-03-31')).toBe('Gestern');
    expect(formatRelativeDay('de', '2025-03-29', '2025-03-31')).toBe('29. März');
    expect(formatRelativeDay('en', '2025-03-30', '2025-03-31')).toBe('Yesterday');
  });
});

describe('string layer', () => {
  it('falls back to German rather than showing a raw key', () => {
    expect(translate('de', 'nav.today')).toBe('Heute');
    expect(translate('en', 'nav.today')).toBe('Today');
  });
});
