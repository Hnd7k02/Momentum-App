// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, type Mounted } from '../test/dom';
import { msUntilNextLocalDay, useToday } from './useToday';

/**
 * One "today" for the screens (WP3, B3), in Europe/Berlin: it moves at local
 * midnight on an ordinary day, across both DST changes, and — when a phone
 * has suspended the timer — on the first input or on coming back into view.
 */

let mounted: Mounted | null = null;
const seen: string[] = [];

function Probe() {
  seen.push(useToday());
  return null;
}

const last = () => seen[seen.length - 1];

beforeEach(() => {
  seen.length = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
});

async function at(local: string) {
  vi.setSystemTime(new Date(local));
  mounted = await mount(<Probe />);
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe('msUntilNextLocalDay', () => {
  it('is the time to the next local midnight on an ordinary day', () => {
    expect(msUntilNextLocalDay(new Date('2026-10-14T23:58:00'))).toBe(2 * 60 * 1000);
    expect(msUntilNextLocalDay(new Date('2026-10-14T00:00:00'))).toBe(24 * 3600 * 1000);
  });

  it('counts a 25-hour day and a 23-hour day by the calendar, not by 24 hours', () => {
    // Berlin leaves summer time on 25.10.2026 and enters it on 28.03.2027.
    expect(msUntilNextLocalDay(new Date('2026-10-25T00:00:00'))).toBe(25 * 3600 * 1000);
    expect(msUntilNextLocalDay(new Date('2027-03-28T00:00:00'))).toBe(23 * 3600 * 1000);
  });
});

describe('useToday', () => {
  it('moves to the new day at local midnight, before any input', async () => {
    await at('2026-10-14T23:58:00');
    expect(last()).toBe('2026-10-14');
    await advance(60 * 1000);
    expect(last()).toBe('2026-10-14');
    await advance(2 * 60 * 1000);
    expect(last()).toBe('2026-10-15');
  });

  it('crosses the night the clocks go back, and the next one', async () => {
    await at('2026-10-24T23:59:00');
    await advance(2 * 60 * 1000);
    expect(last()).toBe('2026-10-25');
    // 25.10 has 25 hours: still the 25th after 24 of them.
    await advance(24 * 3600 * 1000);
    expect(last()).toBe('2026-10-25');
    await advance(3600 * 1000);
    expect(last()).toBe('2026-10-26');
  });

  it('crosses the night the clocks go forward', async () => {
    await at('2027-03-27T23:59:00');
    await advance(2 * 60 * 1000);
    expect(last()).toBe('2027-03-28');
    // 28.03 has 23 hours: the 29th begins 23 hours after midnight.
    await advance(23 * 3600 * 1000);
    expect(last()).toBe('2027-03-29');
  });

  it('catches up on the first input when the timer never ran', async () => {
    await at('2026-10-14T22:00:00');
    // A suspended phone: the clock moves, no timer fires.
    vi.setSystemTime(new Date('2026-10-15T07:30:00'));
    expect(last()).toBe('2026-10-14');
    await act(async () => {
      document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(last()).toBe('2026-10-15');
  });

  it('catches up when the page becomes visible again', async () => {
    await at('2026-10-14T22:00:00');
    vi.setSystemTime(new Date('2026-10-16T08:00:00'));
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(last()).toBe('2026-10-16');
  });

  it('gives every subscriber the same day', async () => {
    await at('2026-10-14T23:59:30');
    const second: string[] = [];
    function Other() {
      second.push(useToday());
      return null;
    }
    const other = await mount(<Other />);
    await advance(60 * 1000);
    expect(last()).toBe('2026-10-15');
    expect(second[second.length - 1]).toBe('2026-10-15');
    await other.unmount();
  });
});
