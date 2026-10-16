import { describe, expect, it } from 'vitest';
import { formatRoute, mergeRoute, parseRoute } from './route';

/**
 * The route model after WP2-2: one tab, one area, and — on the Gym area
 * only — one optional section. The hash mirrors the state exactly, and a
 * section never survives a move to another tab or area.
 */
describe('parseRoute', () => {
  it('reads a tab, an area, and the Gym muscle section', () => {
    expect(parseRoute('#/today')).toEqual({ tab: 'today' });
    expect(parseRoute('#/areas/gym')).toEqual({ tab: 'areas', terminal: 'gym' });
    expect(parseRoute('#/areas/gym/muscles')).toEqual({ tab: 'areas', terminal: 'gym', section: 'muscles' });
  });

  it('drops a section that is not a place', () => {
    expect(parseRoute('#/areas/gym/nowhere')).toEqual({ tab: 'areas', terminal: 'gym' });
    expect(parseRoute('#/areas/mental/muscles')).toEqual({ tab: 'areas', terminal: 'mental' });
    expect(parseRoute('#/today/muscles')).toEqual({ tab: 'today' });
    expect(parseRoute('#/nowhere')).toBeNull();
  });

  it('lands an address from before Stage 4 on Bereiche, since Food is no area (D139)', () => {
    expect(parseRoute('#/areas/food')).toEqual({ tab: 'areas' });
    expect(parseRoute('#/areas/food/muscles')).toEqual({ tab: 'areas' });
    expect(parseRoute('#/areas/running')).toEqual({ tab: 'areas' });
  });
});

describe('formatRoute', () => {
  it('writes the section only where it means something', () => {
    expect(formatRoute({ tab: 'areas', terminal: 'gym', section: 'muscles' })).toBe('#/areas/gym/muscles');
    expect(formatRoute({ tab: 'areas', terminal: 'gym' })).toBe('#/areas/gym');
    expect(formatRoute({ tab: 'areas', terminal: 'mental', section: 'muscles' })).toBe('#/areas/mental');
    expect(formatRoute({ tab: 'today', terminal: 'gym', section: 'muscles' })).toBe('#/today');
  });
});

describe('mergeRoute', () => {
  const muscles = { tab: 'areas' as const, terminal: 'gym' as const, section: 'muscles' as const };

  it('opens and closes a section in place', () => {
    expect(mergeRoute({ tab: 'areas', terminal: 'gym' }, { section: 'muscles' })).toEqual(muscles);
    expect(mergeRoute(muscles, { section: undefined })).toEqual({ tab: 'areas', terminal: 'gym' });
  });

  it('leaves the section behind when the tab or the area changes', () => {
    expect(mergeRoute(muscles, { tab: 'today' })).toEqual({ tab: 'today', terminal: 'gym' });
    expect(mergeRoute(muscles, { terminal: 'mental' })).toEqual({ tab: 'areas', terminal: 'mental' });
    // Coming back to Bereiche lands on the area, not inside it.
    expect(mergeRoute({ tab: 'today', terminal: 'gym' }, { tab: 'areas' })).toEqual({ tab: 'areas', terminal: 'gym' });
  });

  it('never attaches a section to another area', () => {
    expect(mergeRoute({ tab: 'areas', terminal: 'mental' }, { section: 'muscles' })).toEqual({ tab: 'areas', terminal: 'mental' });
  });
});
