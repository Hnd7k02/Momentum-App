import { describe, expect, it } from 'vitest';
import { HIT_TOLERANCE_PX, RINGS, groupAtTap, groupOfRing } from './picking';

/**
 * Which group a tap means (block 7B, contract §8): the surface that is
 * seen where it landed, and failing that the nearest group within twelve
 * pixels. Held here on a flat picture — a map from a place to what is seen
 * there — so the rule is tested without a model.
 */

type Seen = 'forearms' | 'quadriceps' | 'chest' | null;

/** A picture: what is seen at a place relative to the tap, or `null`. */
const tapOn = (picture: (dx: number, dy: number) => Seen) => groupAtTap<NonNullable<Seen>>(picture);

describe('the tolerance', () => {
  it('is twelve pixels, probed in rings of four, eight and twelve', () => {
    expect(HIT_TOLERANCE_PX).toBe(12);
    expect(RINGS.map((ring) => ring[0]!.distance)).toEqual([4, 8, 12]);
    for (const ring of RINGS) {
      for (const probe of ring) {
        expect(Math.hypot(probe.dx, probe.dy)).toBeCloseTo(probe.distance, 9);
        expect(probe.distance).toBeLessThanOrEqual(HIT_TOLERANCE_PX);
      }
    }
  });

  it('leaves no gap wider than five pixels between two neighbours of a ring', () => {
    for (const ring of RINGS) {
      const chord = Math.hypot(ring[0]!.dx - ring[1]!.dx, ring[0]!.dy - ring[1]!.dy);
      expect(chord).toBeLessThan(5);
    }
  });
});

describe('a tap', () => {
  it('on a group means that group, without looking further', () => {
    let looks = 0;
    const hit = groupAtTap<'chest'>(() => {
      looks += 1;
      return 'chest';
    });
    expect(hit).toBe('chest');
    expect(looks).toBe(1);
  });

  it('up to twelve pixels beside a group means that group', () => {
    // A forearm: a strip from 3 to 9 pixels to the right of… wherever.
    const forearmFrom = (edge: number) => (dx: number, _dy: number): Seen => (dx >= edge && dx <= edge + 6 ? 'forearms' : null);
    expect(tapOn(forearmFrom(3))).toBe('forearms');
    expect(tapOn(forearmFrom(7))).toBe('forearms');
    expect(tapOn(forearmFrom(11.5))).toBe('forearms');
    // Thirteen pixels away is too far.
    expect(tapOn(forearmFrom(13))).toBeNull();
  });

  it('means the nearest group, not the largest', () => {
    // A thin forearm five pixels to the left, a broad thigh ten to the right.
    const picture = (dx: number): Seen => (dx <= -5 && dx >= -9 ? 'forearms' : dx >= 10 ? 'quadriceps' : null);
    expect(tapOn((dx) => picture(dx))).toBe('forearms');
  });

  it('further than twelve pixels from every group means nothing', () => {
    expect(tapOn(() => null)).toBeNull();
    expect(tapOn((dx, dy) => (Math.hypot(dx, dy) > 12.5 ? 'chest' : null))).toBeNull();
  });
});

describe('the neutral zone', () => {
  it('is never chosen and is not see-through: a hand hides the thigh behind it', () => {
    // Everything within 30 pixels is hand. The thigh is behind it, and what
    // is seen at every place is the hand — which is no group.
    const hand = (_dx: number, _dy: number): Seen => null;
    expect(tapOn(hand)).toBeNull();
  });

  it('gives way at its edge: a tap on the hand a few pixels below the wrist means the forearm', () => {
    // The forearm ends 6 pixels above the tap; below that is hand.
    expect(tapOn((_dx, dy) => (dy <= -6 ? 'forearms' : null))).toBe('forearms');
    // Twenty pixels into the hand it does not.
    expect(tapOn((_dx, dy) => (dy <= -20 ? 'forearms' : null))).toBeNull();
  });

  it('a narrow hand in front of a thigh: the thigh seen beside it is within reach', () => {
    // The hand is 8 pixels wide; the thigh shows on both sides of it.
    expect(tapOn((dx) => (Math.abs(dx) <= 4 ? null : 'quadriceps'))).toBe('quadriceps');
  });
});

describe('a ring', () => {
  it('means the group most of its probes saw, and the first of two seen equally often', () => {
    expect(groupOfRing(['chest', null, 'forearms', 'forearms'])).toBe('forearms');
    expect(groupOfRing(['chest', 'forearms', null, null])).toBe('chest');
    expect(groupOfRing([null, null])).toBeNull();
    expect(groupOfRing([])).toBeNull();
  });
});
