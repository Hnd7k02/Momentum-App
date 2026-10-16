import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareDateKeys,
  daysBetween,
  diffInDays,
  endOfDayExclusive,
  isValidDateKey,
  lastNDays,
  middayOf,
  startOfDay,
  toDateKey,
  todayKey,
  weekdayIndex,
} from './dateKey';
import {
  addWeeks,
  daysOfWeek,
  diffInWeeks,
  endOfWeek,
  isSameWeek,
  isValidWeekKey,
  remainingDaysInWeek,
  startOfWeek,
  startOfWeekKey,
  weekKeyOf,
  weekRange,
} from './week';
import { dayEditState, editableDays, isEditableDay, oldestEditableDay } from './editWindow';

// The suite runs with TZ=Europe/Berlin (see vitest.workspace.ts).
// DST 2025: forward Sun 30 Mar 02:00 -> 03:00, back Sun 26 Oct 03:00 -> 02:00.

describe('toDateKey — local calendar day, never UTC', () => {
  it('uses the local day even when UTC is on the previous one', () => {
    // 01:00 local in summer (UTC+2) is 23:00 the day before in UTC.
    const instant = new Date(2025, 6, 1, 1, 0, 0);
    expect(instant.toISOString().slice(0, 10)).toBe('2025-06-30');
    expect(toDateKey(instant)).toBe('2025-07-01');
  });

  it('uses the local day for the last minute of a day', () => {
    expect(toDateKey(new Date(2025, 0, 31, 23, 59, 59))).toBe('2025-01-31');
  });

  it('todayKey reads the local day of the given instant', () => {
    expect(todayKey(new Date(2025, 11, 31, 22, 0, 0))).toBe('2025-12-31');
  });
});

describe('isValidDateKey', () => {
  it.each(['2025-01-01', '2024-02-29', '2025-12-31'])('accepts %s', (key) => {
    expect(isValidDateKey(key)).toBe(true);
  });

  it.each(['2025-02-30', '2025-13-01', '2025-00-10', '2025-1-1', '20250101', '', null, 42])(
    'rejects %s',
    (key) => {
      expect(isValidDateKey(key)).toBe(false);
    },
  );

  it('rejects 29 February in a non-leap year', () => {
    expect(isValidDateKey('2025-02-29')).toBe(false);
  });
});

describe('addDays across boundaries', () => {
  it('crosses month ends', () => {
    expect(addDays('2025-01-31', 1)).toBe('2025-02-01');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    expect(addDays('2025-03-01', -1)).toBe('2025-02-28');
    expect(addDays('2025-04-30', 1)).toBe('2025-05-01');
  });

  it('crosses leap days', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('crosses year ends', () => {
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(addDays('2025-01-01', -1)).toBe('2024-12-31');
  });

  it('crosses the spring-forward DST transition', () => {
    expect(addDays('2025-03-29', 1)).toBe('2025-03-30');
    expect(addDays('2025-03-30', 1)).toBe('2025-03-31');
    expect(addDays('2025-03-31', -1)).toBe('2025-03-30');
  });

  it('crosses the autumn fall-back DST transition', () => {
    expect(addDays('2025-10-25', 1)).toBe('2025-10-26');
    expect(addDays('2025-10-26', 1)).toBe('2025-10-27');
    expect(addDays('2025-10-27', -1)).toBe('2025-10-26');
  });

  it('produces 366 distinct days over a leap year', () => {
    const days = new Set<string>();
    let key = '2024-01-01';
    for (let i = 0; i < 366; i += 1) {
      days.add(key);
      key = addDays(key, 1);
    }
    expect(days.size).toBe(366);
    expect(key).toBe('2025-01-01');
  });
});

describe('diffInDays', () => {
  it('counts whole days across DST in both directions', () => {
    expect(diffInDays('2025-03-29', '2025-03-31')).toBe(2);
    expect(diffInDays('2025-03-31', '2025-03-29')).toBe(-2);
    expect(diffInDays('2025-10-25', '2025-10-27')).toBe(2);
    expect(diffInDays('2025-10-27', '2025-10-25')).toBe(-2);
  });

  it('is zero for the same day', () => {
    expect(diffInDays('2025-03-30', '2025-03-30')).toBe(0);
  });

  it('counts a full year', () => {
    expect(diffInDays('2024-01-01', '2025-01-01')).toBe(366);
    expect(diffInDays('2025-01-01', '2026-01-01')).toBe(365);
  });

  it('never returns a fraction on any day of a DST year', () => {
    for (const day of daysBetween('2025-01-01', '2025-12-31')) {
      expect(Number.isInteger(diffInDays('2025-01-01', day))).toBe(true);
    }
  });
});

describe('day instants', () => {
  it('anchors arithmetic at midday so no key ever shifts', () => {
    for (const day of daysBetween('2025-03-25', '2025-11-02')) {
      expect(toDateKey(middayOf(day))).toBe(day);
    }
  });

  it('startOfDay stays inside its own day', () => {
    for (const day of daysBetween('2025-03-25', '2025-11-02')) {
      expect(toDateKey(startOfDay(day))).toBe(day);
    }
  });

  it('endOfDayExclusive is the first instant of the next day', () => {
    expect(toDateKey(endOfDayExclusive('2025-03-29'))).toBe('2025-03-30');
    expect(toDateKey(endOfDayExclusive('2025-12-31'))).toBe('2026-01-01');
  });

  it('the DST day is still exactly one day long in calendar terms', () => {
    // 23 real hours, but one calendar day.
    const hours = (endOfDayExclusive('2025-03-30').getTime() - startOfDay('2025-03-30').getTime()) / 3_600_000;
    expect(hours).toBe(23);
    expect(diffInDays('2025-03-30', '2025-03-31')).toBe(1);
  });
});

describe('compare and ranges', () => {
  it('orders keys lexicographically, which matches chronologically', () => {
    expect(compareDateKeys('2025-01-01', '2025-01-02')).toBe(-1);
    expect(compareDateKeys('2025-01-02', '2025-01-01')).toBe(1);
    expect(compareDateKeys('2025-01-01', '2025-01-01')).toBe(0);
    const shuffled = ['2025-10-01', '2025-02-11', '2024-12-31', '2025-02-02'];
    expect([...shuffled].sort(compareDateKeys)).toEqual([
      '2024-12-31',
      '2025-02-02',
      '2025-02-11',
      '2025-10-01',
    ]);
  });

  it('daysBetween is inclusive and ascending', () => {
    expect(daysBetween('2025-01-30', '2025-02-02')).toEqual([
      '2025-01-30',
      '2025-01-31',
      '2025-02-01',
      '2025-02-02',
    ]);
    expect(daysBetween('2025-01-01', '2025-01-01')).toEqual(['2025-01-01']);
    expect(daysBetween('2025-01-02', '2025-01-01')).toEqual([]);
  });

  it('lastNDays returns exactly N ascending days ending at the given day', () => {
    const days = lastNDays('2025-03-31', 30);
    expect(days).toHaveLength(30);
    expect(new Set(days).size).toBe(30);
    expect(days[0]).toBe('2025-03-02');
    expect(days[29]).toBe('2025-03-31');
    expect(lastNDays('2025-01-01', 0)).toEqual([]);
  });
});

describe('weekday index — Monday is 0', () => {
  it('maps the week of 2025-03-31', () => {
    expect(weekdayIndex('2025-03-31')).toBe(0); // Monday
    expect(weekdayIndex('2025-04-01')).toBe(1);
    expect(weekdayIndex('2025-04-05')).toBe(5); // Saturday
    expect(weekdayIndex('2025-04-06')).toBe(6); // Sunday
  });
});

describe('weeks run Monday to Sunday', () => {
  it('anchors a Sunday to the preceding Monday, not the following one', () => {
    expect(startOfWeek('2025-03-30')).toBe('2025-03-24');
    expect(endOfWeek('2025-03-30')).toBe('2025-03-30');
  });

  it('treats Monday as the first day of its own week', () => {
    expect(startOfWeek('2025-03-31')).toBe('2025-03-31');
    expect(endOfWeek('2025-03-31')).toBe('2025-04-06');
  });

  it('holds across the DST week', () => {
    expect(daysOfWeek('2025-03-30')).toEqual([
      '2025-03-24',
      '2025-03-25',
      '2025-03-26',
      '2025-03-27',
      '2025-03-28',
      '2025-03-29',
      '2025-03-30',
    ]);
  });

  it('assigns every day of a year to a week of exactly seven distinct days', () => {
    for (const day of daysBetween('2025-01-01', '2025-12-31')) {
      const week = daysOfWeek(day);
      expect(week).toHaveLength(7);
      expect(new Set(week).size).toBe(7);
      expect(week).toContain(day);
      expect(weekdayIndex(week[0]!)).toBe(0);
      expect(weekdayIndex(week[6]!)).toBe(6);
    }
  });

  it('isSameWeek splits at Sunday/Monday, not Saturday/Sunday', () => {
    expect(isSameWeek('2025-03-29', '2025-03-30')).toBe(true); // Sat + Sun
    expect(isSameWeek('2025-03-30', '2025-03-31')).toBe(false); // Sun + Mon
  });

  it('remainingDaysInWeek counts the day itself', () => {
    expect(remainingDaysInWeek('2025-03-31')).toBe(7); // Monday
    expect(remainingDaysInWeek('2025-04-04')).toBe(3); // Friday
    expect(remainingDaysInWeek('2025-04-06')).toBe(1); // Sunday
  });
});

describe('ISO week keys', () => {
  it('uses the ISO week-year, which is not always the calendar year', () => {
    expect(weekKeyOf('2024-12-30')).toBe('2025-W01'); // Monday, belongs to 2025
    expect(weekKeyOf('2025-01-01')).toBe('2025-W01');
    expect(weekKeyOf('2025-12-29')).toBe('2026-W01'); // Monday, belongs to 2026
    expect(weekKeyOf('2021-01-01')).toBe('2020-W53'); // long year 2020
    expect(weekKeyOf('2020-12-28')).toBe('2020-W53');
  });

  it('numbers the first weeks of an ordinary year', () => {
    expect(weekKeyOf('2025-01-06')).toBe('2025-W02');
    expect(weekKeyOf('2025-03-30')).toBe('2025-W13');
    expect(weekKeyOf('2025-03-31')).toBe('2025-W14');
  });

  it('round-trips every day of four years back to its own Monday', () => {
    for (const day of daysBetween('2023-01-01', '2026-12-31')) {
      expect(startOfWeekKey(weekKeyOf(day))).toBe(startOfWeek(day));
    }
  });

  it('weekRange spans Monday to Sunday', () => {
    expect(weekRange('2025-W14')).toEqual({ start: '2025-03-31', end: '2025-04-06' });
    expect(weekRange('2025-W01')).toEqual({ start: '2024-12-30', end: '2025-01-05' });
  });

  it('validates week keys, including long-year week 53', () => {
    expect(isValidWeekKey('2020-W53')).toBe(true);
    expect(isValidWeekKey('2025-W53')).toBe(false); // 2025 has 52 weeks
    expect(isValidWeekKey('2025-W00')).toBe(false);
    expect(isValidWeekKey('2025-W1')).toBe(false);
    expect(isValidWeekKey('2025-14')).toBe(false);
  });

  it('adds and diffs weeks across a year boundary', () => {
    expect(addWeeks('2025-W52', 1)).toBe('2026-W01');
    expect(addWeeks('2026-W01', -1)).toBe('2025-W52');
    expect(diffInWeeks('2025-W01', '2025-W14')).toBe(13);
    expect(diffInWeeks('2025-W52', '2026-W01')).toBe(1);
    expect(diffInWeeks('2026-W01', '2025-W52')).toBe(-1);
  });
});

describe('the edit window (P8: today and yesterday, D132)', () => {
  const today = '2025-03-31';

  it('keeps today and yesterday open, by default', () => {
    expect(dayEditState('2025-03-31', today)).toBe('open');
    expect(dayEditState('2025-03-30', today)).toBe('open');
    expect(dayEditState('2025-03-29', today)).toBe('closed');
  });

  it('still reads a day lived before P8 with its own three-day window', () => {
    expect(dayEditState('2025-03-28', today, 3)).toBe('open');
    expect(dayEditState('2025-03-27', today, 3)).toBe('closed');
  });

  it('closes the second preceding day', () => {
    expect(dayEditState('2025-03-29', today)).toBe('closed');
    expect(isEditableDay('2025-03-29', today)).toBe(false);
  });

  it('marks future days as future, never editable', () => {
    expect(dayEditState('2025-04-01', today)).toBe('future');
    expect(isEditableDay('2025-04-01', today)).toBe(false);
  });

  it('stays exactly two days wide across DST and month ends', () => {
    for (const day of ['2025-03-30', '2025-10-26', '2025-03-01', '2026-01-01']) {
      const window = editableDays(day);
      expect(window).toHaveLength(2);
      expect(window[1]).toBe(day);
      expect(window[0]).toBe(oldestEditableDay(day));
      expect(diffInDays(window[0]!, day)).toBe(1);
      expect(window.every((d) => isEditableDay(d, day))).toBe(true);
      expect(isEditableDay(addDays(day, -2), day)).toBe(false);
    }
  });
});

