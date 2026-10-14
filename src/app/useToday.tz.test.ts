// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, type Mounted } from '../test/dom';
import { msUntilNextLocalDay, useToday } from './useToday';

/**
 * In America/Sao_Paulo, where DST used to begin *at* midnight: on 04.11.2018
 * the clocks went from 23:59:59 on the 3rd straight to 01:00 on the 4th, so
 * local midnight did not exist. The day still has to turn, at the first
 * instant it has.
 */

let mounted: Mounted | null = null;
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
});

describe('a midnight that does not exist', () => {
  it('is reached at the first instant of the new day', () => {
    const from = new Date('2018-11-03T23:58:00-03:00');
    const ms = msUntilNextLocalDay(from);
    // 23:58 → 01:00 local is two minutes of real time.
    expect(ms).toBe(2 * 60 * 1000);
    const next = new Date(from.getTime() + ms);
    expect(next.getDate()).toBe(4);
    expect(next.getHours()).toBe(1);
  });

  it('turns the day on the screen', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date('2018-11-03T23:58:00-03:00'));
    const seen: string[] = [];
    function Probe() {
      seen.push(useToday());
      return null;
    }
    mounted = await mount(createElement(Probe));
    expect(seen[seen.length - 1]).toBe('2018-11-03');
    await act(async () => {
      vi.advanceTimersByTime(3 * 60 * 1000);
    });
    expect(seen[seen.length - 1]).toBe('2018-11-04');
  });
});
