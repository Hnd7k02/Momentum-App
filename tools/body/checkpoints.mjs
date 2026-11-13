/**
 * The check points of the body's regions (contract §14).
 *
 * A check point is a place on the body, given as a share of the body's
 * height, and the region a ray must meet there. The validator runs them on
 * every build and `tools/validate-body-glb.test.mjs` holds each of them by
 * name, so a region that slips — the hands back into the forearms, the
 * trapezius into the inert zone — fails with the place it slipped at.
 *
 * Every paired place is asked on both sides.
 */
import { castRay } from './measure-body.mjs';

const FROM = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  side: [1, 0, 0],      // from the body's own side: mirrored for the other one
  above: [0, 1, 0],
};

/**
 * `at` is [x, y, z] as shares of the height: for a ray from the front or the
 * back x and y are used, from the side y and z, from above x and z. `region`
 * is the region the ray must meet first, or the regions it may meet.
 */
export const CHECK_POINTS = [
  // Each of the ten groups, at a place in its middle.
  { name: 'chest', at: [0.05, 0.76, 0], from: 'front', region: ['chest'] },
  { name: 'core', at: [0.03, 0.62, 0], from: 'front', region: ['core'] },
  { name: 'quadriceps', at: [0.06, 0.40, 0], from: 'front', region: ['quadriceps'] },
  { name: 'shoulders', at: [0.115, 0.79, 0], from: 'front', region: ['shoulders'] },
  { name: 'biceps', at: [0.15, 0.70, 0], from: 'front', region: ['biceps'] },
  { name: 'forearms', at: [0.19, 0.58, 0], from: 'front', region: ['forearms'] },
  { name: 'back', at: [0.04, 0.70, 0], from: 'back', region: ['back'] },
  { name: 'triceps', at: [0.155, 0.70, 0], from: 'back', region: ['triceps'] },
  { name: 'hamstringsGlutes', at: [0.06, 0.50, 0], from: 'back', region: ['hamstringsGlutes'] },
  { name: 'calves', at: [0.075, 0.20, 0], from: 'back', region: ['calves'] },
  // The inert zone: head, neck, hands and feet are nobody's muscle.
  { name: 'the face is inert', at: [0, 0.93, 0], from: 'front', region: ['none'], once: true },
  { name: 'the neck is inert', at: [0, 0.868, 0], from: 'front', region: ['none'], once: true },
  { name: 'the hand is inert', at: [0, 0.48, 0.08], from: 'side', region: ['none'] },
  { name: 'the foot is inert', at: [0.085, 0, 0.07], from: 'above', region: ['none'], below: 0.1 },
  // The places that went wrong before.
  { name: 'the outside of the thigh belongs to the leg', at: [0, 0.40, 0.01], from: 'side', region: ['quadriceps', 'hamstringsGlutes'] },
  { name: 'the upper trapezius belongs to the back, from above', at: [0.055, 0, 0], from: 'above', region: ['back'] },
  { name: 'the upper trapezius belongs to the back, from the front', at: [0.06, 0.845, 0], from: 'front', region: ['back'] },
  { name: 'the pit of the throat goes with the chest', at: [0, 0.84, 0], from: 'front', region: ['chest'], once: true },
  // The pectoral's lower edge: lowest in its fold under the nipple, about
  // level from there to the middle, and not a point at the breastbone. A
  // centimetre and a half above the edge and two below, at both places.
  { name: 'the pectoral reaches down to its fold, under the nipple', at: [0.055, 0.72, 0], from: 'front', region: ['chest'] },
  { name: 'under the pectoral\'s fold is the core', at: [0.055, 0.70, 0], from: 'front', region: ['core'] },
  { name: 'the chest is as low at the breastbone as under the nipple', at: [0, 0.725, 0], from: 'front', region: ['chest'], once: true },
  { name: 'under the breastbone is the core, not a point of the chest', at: [0, 0.70, 0], from: 'front', region: ['core'], once: true },
  // The knee's cut: two centimetres above and below the joint, front and back.
  { name: 'above the knee\'s cut is the thigh, in front', at: [0.051, 0.31, 0], from: 'front', region: ['quadriceps'] },
  { name: 'below the knee\'s cut is the calf, in front', at: [0.051, 0.285, 0], from: 'front', region: ['calves'] },
  { name: 'above the knee\'s cut is the thigh, behind', at: [0.051, 0.31, 0], from: 'back', region: ['hamstringsGlutes'] },
  { name: 'below the knee\'s cut is the calf, behind', at: [0.051, 0.285, 0], from: 'back', region: ['calves'] },
  // The deltoid's edge against the trunk, on both sides of it: in front
  // under the collarbone, on top of the shoulder, and behind.
  { name: 'inside the deltoid\'s edge, under the collarbone, is the chest', at: [0.085, 0.815, 0], from: 'front', region: ['chest'] },
  { name: 'outside the deltoid\'s edge is the shoulder, in front', at: [0.105, 0.825, 0], from: 'front', region: ['shoulders'] },
  { name: 'inside the deltoid\'s edge, on top, is the trapezius', at: [0.085, 0, 0.01], from: 'above', region: ['back'] },
  { name: 'outside the deltoid\'s edge is the shoulder, on top', at: [0.105, 0, 0.01], from: 'above', region: ['shoulders'] },
  { name: 'inside the deltoid\'s edge, behind, is the back', at: [0.085, 0.80, 0], from: 'back', region: ['back'] },
  { name: 'outside the deltoid\'s edge is the shoulder, behind', at: [0.112, 0.80, 0], from: 'back', region: ['shoulders'] },
];

/**
 * Run every check point on a body (`readBody()` of measure-body.mjs).
 * One result per point and side: `{ name, side, expected, found, ok }`.
 */
export function runCheckPoints(body) {
  const { points: P } = body;
  let low = Infinity, high = -Infinity;
  for (let i = 0; i < body.count; i++) { low = Math.min(low, P[i * 3 + 1]); high = Math.max(high, P[i * 3 + 1]); }
  const H = high - low;
  const results = [];
  for (const point of CHECK_POINTS) {
    for (const mirror of point.once ? [1] : [1, -1]) {
      const [x, y, z] = point.at.map((share) => share * H);
      const direction = FROM[point.from].map((v, axis) => -v * (axis === 0 ? mirror : 1));
      let origin;
      if (point.from === 'front' || point.from === 'back') origin = [mirror * x, low + y, -direction[2] * 3];
      else if (point.from === 'side') origin = [mirror * 3, low + y, z];
      else origin = [mirror * x, high + 1, z];
      let hit = castRay(body, origin, direction);
      // A ray from above meets the hand or the shoulder before the foot: for a
      // point given as "below" a height, take the first hit under it.
      if (point.below !== undefined) {
        let from = origin;
        while (hit && hit.point[1] > low + point.below * H) {
          from = [hit.point[0], hit.point[1] - 1e-4, hit.point[2]];
          hit = castRay(body, from, direction);
        }
      }
      const found = hit ? hit.region : null;
      results.push({
        name: point.name,
        side: point.once ? null : mirror === 1 ? 'left' : 'right',
        expected: point.region,
        found,
        ok: found !== null && point.region.includes(found),
      });
    }
  }
  return results;
}
