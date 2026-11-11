#!/usr/bin/env node
/**
 * measure-body.mjs — the body, measured at landmarks.
 *
 *   node tools/body/measure-body.mjs <body.glb> [<other.glb> …] [--json] [--markdown]
 *
 * Every figure is read from the surface of the GLB itself, so the same rule
 * measures today's model, the proof and every candidate: no skeleton, no
 * vertex index, nothing a file has to bring along. The body stands on the
 * ground, looks along +z, and y is up.
 *
 * How a landmark is found (H is the body height):
 *
 *   slices      the body is cut by a horizontal plane every H/900. A cut gives
 *               closed loops. The loop that spans the middle is the trunk, and
 *               a loop beside it is an arm; where no loop spans the middle the
 *               body has divided into legs, and a loop beside a leg is a hand.
 *   crotch      the highest cut in which no loop spans the middle.
 *   elbow, knee the border ring between the regions: upper arm | forearms,
 *               thigh | calves. It is where the model itself puts the joint.
 *   wrist       the narrowest cut of the arm between elbow and fingertip.
 *   shoulder    the upper-arm line (through the centres of the arm's cuts) is
 *               followed upwards until the skin above it is 0.025 H away — the
 *               depth of the joint under the shoulder. That point is the
 *               shoulder joint, the skin above it the acromion. Lengths run
 *               between skin landmarks (acromion, elbow, wrist, fingertip);
 *               angles are those of the lines through the limbs.
 *   menton      on the front line of the head, coming up from the throat: the
 *               upper end of the first stretch that runs back under the chin
 *               more steeply than 45°.
 *   neck, head  the narrowest cut between shoulders and head; the widest cut
 *               of the skull above the ears.
 *   foot        the surface below 0.04 H on one side; its long axis runs from
 *               the middle of the heel to the middle of the forefoot.
 *   breadth     the shoulder joints' distance plus, on each side, how far the
 *               shoulder muscle stands out from the arm's line — the bideltoid
 *               breadth as if the arms hung straight down, as it is taped.
 *   symmetry    every point mirrored at x = 0, and its distance to the surface.
 *
 * Where a file was built by tools/body/build.py, its skeleton lies beside it
 * (<name>.landmarks.json) and is printed as a second opinion. The two agree
 * to about one percent of H; the table says which is which.
 *
 * The targets are the ones of the guide (koerper-anleitung-7a.md §3). What
 * they were checked against is said in tools/body/MEASURES.md.
 *
 * Dependency-free on purpose, like the validator, which takes these measures
 * over once a body is chosen.
 */
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/* ── targets ───────────────────────────────────────────────────────────── */

/** [low, high] of a pass, and how the figure is printed. Sources: MEASURES.md. */
export const TARGETS = {
  headHeight: { range: [0.125, 0.135], unit: '%H', label: 'Head height (crown to chin)' },
  acromionHeight: { range: [0.80, 0.83], unit: '%H', label: 'Shoulder height (acromion)' },
  kneeHeight: { range: [0.27, 0.30], unit: '%H', label: 'Knee height (joint line)' },
  crotchHeight: { range: [0.45, 0.49], unit: '%H', label: 'Crotch height' },
  upperArm: { range: [0.186 * 0.9, 0.186 * 1.1], unit: '%H', label: 'Upper arm' },
  forearm: { range: [0.146 * 0.9, 0.146 * 1.1], unit: '%H', label: 'Forearm' },
  hand: { range: [0.108 * 0.9, 0.108 * 1.1], unit: '%H', label: 'Hand' },
  footLength: { range: [0.145, 0.16], unit: '%H', label: 'Foot length' },
  bideltoid: { range: [0.25, 0.30], unit: '%H', label: 'Shoulder breadth (bideltoid)' },
  neckToHead: { range: [0.75, 0.90], unit: 'ratio', label: 'Neck width to head width' },
  symmetry: { range: [0, 2], unit: 'mm', label: 'Symmetry (largest mirrored distance)' },
  armAbduction: { range: [15, 25], unit: '°', label: 'Upper arm away from the trunk' },
  elbowFlexion: { range: [5, 15], unit: '°', label: 'Elbow bend' },
  toeOut: { range: [5, 10], unit: '°', label: 'Toes turned out' },
};

/* ── reading a GLB ─────────────────────────────────────────────────────── */

export function readBody(path) {
  const buffer = readFileSync(path);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error(`${path} is not a GLB`);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(buffer.subarray(20, 20 + jsonLength)));
  const bin = buffer.subarray(28 + jsonLength);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const TYPES = { 5120: ['getInt8', 1], 5121: ['getUint8', 1], 5122: ['getInt16', 2], 5123: ['getUint16', 2], 5125: ['getUint32', 4], 5126: ['getFloat32', 4] };
  const WIDTH = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const accessor = (index) => {
    const a = json.accessors[index];
    const v = json.bufferViews[a.bufferView];
    const [getter, size] = TYPES[a.componentType];
    const n = WIDTH[a.type];
    const stride = v.byteStride || size * n;
    const base = (v.byteOffset || 0) + (a.byteOffset || 0);
    const out = new Float64Array(a.count * n);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < n; c++) out[i * n + c] = dv[getter](base + i * stride + c * size, true);
    return out;
  };
  const node = json.nodes.find((n) => n.mesh === 0);
  const scale = node.scale ?? [1, 1, 1];
  const shift = node.translation ?? [0, 0, 0];
  const mesh = json.meshes[0];
  const raw = accessor(mesh.primitives[0].attributes.POSITION);
  const points = new Float64Array(raw.length);
  for (let i = 0; i < raw.length; i++) points[i] = raw[i] * scale[i % 3] + shift[i % 3];
  const names = mesh.primitives.map((p) => json.materials[p.material].name);
  const triList = [];
  const labelList = [];
  mesh.primitives.forEach((primitive, label) => {
    const indices = accessor(primitive.indices);
    for (let i = 0; i < indices.length; i += 3) {
      triList.push(indices[i], indices[i + 1], indices[i + 2]);
      labelList.push(label);
    }
  });
  return {
    path,
    points,
    count: points.length / 3,
    tris: Int32Array.from(triList),
    labels: Int32Array.from(labelList),
    names,
    copyright: json.asset?.copyright ?? null,
    bytes: buffer.byteLength,
  };
}

/* ── small geometry ────────────────────────────────────────────────────── */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (norm(a) || 1));
const degrees = (radians) => (radians * 180) / Math.PI;
const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;

/** The direction of a cloud of points: its principal axis, by power iteration. */
function principalAxis(pointsList) {
  const centre = [0, 1, 2].map((c) => mean(pointsList.map((p) => p[c])));
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pointsList) {
    const d = sub(p, centre);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i][j] += d[i] * d[j];
  }
  let v = [0.3, 1, 0.2];
  for (let pass = 0; pass < 200; pass++) v = unit([dot(m[0], v), dot(m[1], v), dot(m[2], v)]);
  return { centre, axis: v };
}

/* ── the measuring ─────────────────────────────────────────────────────── */

export function measure(body, skeleton = null) {
  const { points: P, tris: T, labels: TL, names } = body;
  const V = body.count;
  const M = TL.length;
  const point = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  const region = (name) => names.indexOf(name);

  let low = Infinity, crown = -Infinity;
  for (let i = 0; i < V; i++) {
    if (P[i * 3 + 1] < low) low = P[i * 3 + 1];
    if (P[i * 3 + 1] > crown) crown = P[i * 3 + 1];
  }
  const H = crown - low;
  const notes = [];

  /** The loops of the body in the plane y. */
  function slice(y) {
    const edgePoint = new Map();
    const owner = new Map();
    const crossing = [];
    const parent = [];
    const find = (x) => {
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    };
    for (let t = 0; t < M; t++) {
      const v = [T[t * 3], T[t * 3 + 1], T[t * 3 + 2]];
      const d = v.map((i) => (P[i * 3 + 1] - y) || 1e-12);
      if ((d[0] > 0) === (d[1] > 0) && (d[1] > 0) === (d[2] > 0)) continue;
      const ends = [];
      for (let c = 0; c < 3; c++) {
        const i = v[c], j = v[(c + 1) % 3];
        const di = d[c], dj = d[(c + 1) % 3];
        if ((di > 0) === (dj > 0)) continue;
        const key = i < j ? i * 4194304 + j : j * 4194304 + i;
        if (!edgePoint.has(key)) {
          const s = di / (di - dj);
          edgePoint.set(key, [P[i * 3] + s * (P[j * 3] - P[i * 3]), P[i * 3 + 2] + s * (P[j * 3 + 2] - P[i * 3 + 2])]);
        }
        ends.push(key);
      }
      if (ends.length !== 2) continue;
      const index = crossing.length;
      parent.push(index);
      crossing.push({ t, ends });
      for (const key of ends) {
        const other = owner.get(key);
        if (other === undefined) owner.set(key, index);
        else parent[find(other)] = find(index);
      }
    }
    const loops = new Map();
    crossing.forEach(({ t, ends }, index) => {
      const root = find(index);
      let loop = loops.get(root);
      if (!loop) {
        loop = { length: 0, sx: 0, sz: 0, area: 0, minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, y };
        loops.set(root, loop);
      }
      let a = edgePoint.get(ends[0]), b = edgePoint.get(ends[1]);
      // Turn the piece so that the outside of the body lies to its right.
      const p0 = point(T[t * 3]), p1 = point(T[t * 3 + 1]), p2 = point(T[t * 3 + 2]);
      const n = cross(sub(p1, p0), sub(p2, p0));
      if ((b[0] - a[0]) * n[2] - (b[1] - a[1]) * n[0] < 0) [a, b] = [b, a];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      loop.length += length;
      loop.sx += length * (a[0] + b[0]) / 2;
      loop.sz += length * (a[1] + b[1]) / 2;
      loop.area += (a[0] * b[1] - b[0] * a[1]) / 2;
      for (const q of [a, b]) {
        if (q[0] < loop.minX) loop.minX = q[0];
        if (q[0] > loop.maxX) loop.maxX = q[0];
        if (q[1] < loop.minZ) loop.minZ = q[1];
        if (q[1] > loop.maxZ) loop.maxZ = q[1];
      }
    });
    const found = [...loops.values()]
      .map((loop) => ({ ...loop, cx: loop.sx / loop.length, cz: loop.sz / loop.length, area: Math.abs(loop.area), side: 0 }))
      .sort((a, b) => b.area - a.area);
    // Which loop is what. The trunk is the loop that spans the middle. Beside
    // a trunk, every other loop below the shoulders is an arm. Where there is
    // no trunk the body has divided into legs: on each side the largest loop
    // is the leg, and whatever lies beside it is the hand of that side.
    const trunk = found.find((loop) => loop.minX < 0 && loop.maxX > 0);
    if (trunk) {
      trunk.trunk = true;
      if (y < low + 0.8 * H) for (const loop of found) if (loop !== trunk) loop.side = Math.sign(loop.cx);
    } else {
      for (const side of [1, -1]) {
        const here = found.filter((loop) => Math.sign(loop.cx) === side);
        if (!here.length) continue;
        here[0].leg = side;
        for (const loop of here.slice(1)) loop.side = side;
      }
    }
    return found;
  }

  const STEPS = 900;
  const slices = [];
  for (let k = 1; k < STEPS; k++) {
    const y = low + (k / STEPS) * H;
    slices.push({ y, loops: slice(y) });
  }
  const central = (s) => s.loops.filter((loop) => loop.side === 0);
  const widthOf = (s) => {
    const loops = central(s);
    return loops.length ? Math.max(...loops.map((l) => l.maxX)) - Math.min(...loops.map((l) => l.minX)) : 0;
  };

  /** Where a ray meets the surface: the nearest hit, or the farthest. */
  function cast(origin, direction, farthest = false) {
    let best = null;
    for (let t = 0; t < M; t++) {
      const a = point(T[t * 3]), b = point(T[t * 3 + 1]), c = point(T[t * 3 + 2]);
      const e1 = sub(b, a), e2 = sub(c, a);
      const h = cross(direction, e2);
      const det = dot(e1, h);
      if (Math.abs(det) < 1e-14) continue;
      const s = sub(origin, a);
      const u = dot(s, h) / det;
      if (u < -1e-9 || u > 1 + 1e-9) continue;
      const q = cross(s, e1);
      const v = dot(direction, q) / det;
      if (v < -1e-9 || u + v > 1 + 1e-9) continue;
      const distance = dot(e2, q) / det;
      if (distance <= 1e-9) continue;
      if (!best || (farthest ? distance > best.distance : distance < best.distance)) best = { distance, triangle: t };
    }
    if (!best) return null;
    return { ...best, point: add(origin, mul(direction, best.distance)), region: names[TL[best.triangle]] };
  }

  /* legs: the highest cut in which no loop spans the middle */
  let crotch = null;
  for (const s of slices) {
    if (s.y > low + 0.65 * H) break;
    if (s.loops.some((loop) => loop.leg === 1) && s.loops.some((loop) => loop.leg === -1)) crotch = s.y;
  }

  /* per-vertex regions, for the border rings */
  const mask = new Int32Array(V);
  for (let t = 0; t < M; t++) for (let c = 0; c < 3; c++) mask[T[t * 3 + c]] |= 1 << TL[t];
  const bit = (...list) => list.reduce((bits, name) => (region(name) >= 0 ? bits | (1 << region(name)) : bits), 0);
  function ring(upper, lower, side) {
    const found = [];
    for (let i = 0; i < V; i++) {
      if ((mask[i] & upper) && (mask[i] & lower) && Math.sign(P[i * 3]) === side) found.push(point(i));
    }
    if (found.length < 6) return null;
    return [0, 1, 2].map((c) => mean(found.map((p) => p[c])));
  }

  const sides = {};
  for (const side of [1, -1]) {
    const result = {};
    sides[side] = result;
    result.knee = ring(bit('quadriceps', 'hamstringsGlutes'), bit('calves'), side);

    /* the foot: its long axis runs from the middle of the heel to the middle of the forefoot */
    const foot = [];
    for (let t = 0; t < M; t++) {
      const corners = [point(T[t * 3]), point(T[t * 3 + 1]), point(T[t * 3 + 2])];
      const centre = [0, 1, 2].map((c) => (corners[0][c] + corners[1][c] + corners[2][c]) / 3);
      if (Math.sign(centre[0]) !== side || centre[1] > low + 0.04 * H) continue;
      foot.push({ x: centre[0], z: centre[2], weight: norm(cross(sub(corners[1], corners[0]), sub(corners[2], corners[0]))) / 2 });
    }
    if (foot.length > 20) {
      let forward = [0, 1];
      for (let pass = 0; pass < 4; pass++) {
        const along = foot.map((f) => f.x * forward[0] + f.z * forward[1]);
        const back = Math.min(...along), front = Math.max(...along);
        const middle = (from, to) => {
          let sx = 0, sz = 0, sw = 0;
          foot.forEach((f, k) => {
            const share = (along[k] - back) / (front - back);
            if (share >= from && share <= to) { sx += f.weight * f.x; sz += f.weight * f.z; sw += f.weight; }
          });
          return [sx / sw, sz / sw];
        };
        const heel = middle(0, 0.15), ball = middle(0.6, 0.8);
        const length = Math.hypot(ball[0] - heel[0], ball[1] - heel[1]);
        forward = [(ball[0] - heel[0]) / length, (ball[1] - heel[1]) / length];
        result.footLength = front - back;
      }
      result.toeOut = degrees(Math.atan2(side * forward[0], forward[1]));
    }

    /* the ankle: the narrowest cut of the leg above the foot */
    let ankle = null;
    for (const s of slices) {
      if (s.y < low + 0.025 * H || s.y > low + 0.12 * H) continue;
      const loop = s.loops.find((l) => l.leg === side);
      if (loop && (!ankle || loop.length < ankle.loop.length)) ankle = { y: s.y, loop };
    }
    result.ankle = ankle ? [ankle.loop.cx, ankle.y, ankle.loop.cz] : null;

    /* the arm's cuts */
    // From the armpit down to the fingertips: the longest run of cuts with a
    // loop on this side. The toes far below are a run of their own, and a
    // faulty mesh may leave a splinter beside the shoulder; neither is the arm.
    let arm = [];
    let run = [];
    let gap = 0;
    for (let k = slices.length - 1; k >= -1; k--) {
      const loop = k >= 0 ? slices[k].loops.find((candidate) => candidate.side === side) : null;
      if (loop) { run.unshift({ y: slices[k].y, loop }); gap = 0; continue; }
      if (k >= 0 && run.length && ++gap <= 4) continue;
      if (run.length > arm.length) arm = run;
      run = [];
      gap = 0;
    }
    if (arm.length < 20) { notes.push(`no free arm found on side ${side}`); continue; }
    const armpit = arm[arm.length - 1].y;
    const tipY = arm[0].y;

    const elbow = ring(bit('biceps', 'triceps'), bit('forearms'), side);
    if (!elbow) { notes.push(`no border between upper arm and forearm on side ${side}`); continue; }
    result.elbow = elbow;

    const span = elbow[1] - tipY;
    let wrist = null;
    for (const entry of arm) {
      if (entry.y < tipY + 0.25 * span || entry.y > tipY + 0.62 * span) continue;
      if (!wrist || entry.loop.length < wrist.loop.length) wrist = entry;
    }
    if (!wrist) { notes.push(`no wrist found on side ${side}`); continue; }
    result.wrist = [wrist.loop.cx, wrist.y, wrist.loop.cz];

    let reach = 0;
    for (let i = 0; i < V; i++) {
      // Below the wrist and within a hand's reach of it: the leg beside is farther.
      if (P[i * 3] * side <= 0 || P[i * 3 + 1] > wrist.y || P[i * 3 + 1] < tipY - 0.002 * H) continue;
      if (Math.abs(P[i * 3] - wrist.loop.cx) > 0.09 * H) continue;
      const d = norm(sub(point(i), result.wrist));
      if (d > reach) { reach = d; result.fingertip = point(i); }
    }

    /* the upper-arm line, and the shoulder on it */
    const upper = arm
      .filter((entry) => entry.y > elbow[1] + 0.2 * (armpit - elbow[1]) && entry.y < armpit - 0.01 * H)
      .map((entry) => [entry.loop.cx, entry.y, entry.loop.cz]);
    const line = principalAxis(upper);
    const up = line.axis[1] > 0 ? line.axis : mul(line.axis, -1);
    let shoulder = null, acromion = null;
    for (let step = 0; step < 400; step++) {
      const q = add(line.centre, mul(up, step * 0.001));
      const hit = cast(q, [0, 1, 0], true);
      if (!hit) break;
      shoulder = q;
      acromion = hit.point;
      if (hit.distance <= 0.025 * H) break;
    }
    result.shoulder = shoulder;
    result.acromion = acromion;
    result.armpit = armpit;

    // The lengths run between the landmarks a tape would use: acromion to
    // elbow, elbow to wrist, wrist to fingertip (Drillis & Contini measured
    // on the skin). The angles are those of the limbs' own lines, which a
    // joint placed a centimetre off cannot bend.
    const lower = arm
      .filter((entry) => entry.y > wrist.y + 0.2 * (elbow[1] - wrist.y) && entry.y < elbow[1] - 0.15 * (elbow[1] - wrist.y))
      .map((entry) => [entry.loop.cx, entry.y, entry.loop.cz]);
    const lowerLine = principalAxis(lower);
    const down = mul(up, -1);
    const forearmDown = lowerLine.axis[1] < 0 ? lowerLine.axis : mul(lowerLine.axis, -1);
    result.upperArm = norm(sub(elbow, acromion));
    result.forearm = norm(sub(result.wrist, elbow));
    result.hand = reach;
    result.armAbduction = degrees(Math.atan2(side * down[0], -down[1]));
    result.elbowFlexion = degrees(Math.acos(Math.max(-1, Math.min(1, dot(down, forearmDown)))));

    // How far the shoulder muscle stands out from the arm's line: the breadth
    // of the shoulders is taken as if the arms hung straight down.
    const outward = unit([side * up[1], -side * up[0], 0]);
    let bulge = 0;
    for (let step = 0; step <= 30; step++) {
      const q = add(shoulder, mul(down, step * 0.003 * H));
      const hit = cast(q, outward, true);
      if (hit && hit.distance > bulge && hit.distance < 0.12 * H) bulge = hit.distance;
    }
    result.shoulderBulge = bulge;
  }

  const both = (key) => [sides[1]?.[key], sides[-1]?.[key]].filter((v) => v !== undefined && v !== null);
  const average = (key, pick = (v) => v) => {
    const values = both(key).map(pick);
    return values.length ? mean(values) : null;
  };

  /* shoulders, neck, head */
  const acromionY = average('acromion', (p) => p[1]);
  let bideltoid = null;
  if (sides[1]?.shoulder && sides[-1]?.shoulder) {
    bideltoid = sides[1].shoulder[0] - sides[-1].shoulder[0] + sides[1].shoulderBulge + sides[-1].shoulderBulge;
  }

  let neck = null;
  const neckFrom = (acromionY ?? low + 0.8 * H) + 0.005 * H;
  for (const s of slices) {
    if (s.y < neckFrom || s.y > crown - 0.06 * H) continue;
    const width = widthOf(s);
    if (width > 0 && (!neck || width < neck.width)) neck = { y: s.y, width };
  }

  /* the front line of throat and head, and the chin on it */
  const profile = [];
  const profileFrom = (acromionY ?? low + 0.8 * H) + 0.01 * H;
  for (let y = profileFrom; y < crown - 0.02 * H; y += 0.001) {
    const hit = cast([0.0007, y, 2], [0, 0, -1]);
    profile.push({ y, z: hit ? hit.point[2] : null });
  }
  let menton = null;
  let mentonRule = null;
  for (const threshold of [1.0, 0.7, 0.45]) {
    let run = 0;
    for (let k = 3; k < profile.length - 3 && menton === null; k++) {
      const a = profile[k - 3].z, b = profile[k + 3].z;
      const slope = a === null || b === null ? 0 : (b - a) / 0.006;
      if (slope > threshold) run++;
      else {
        if (run >= 5) menton = profile[k - 1].y;
        run = 0;
      }
    }
    if (menton !== null) { mentonRule = threshold; break; }
  }
  if (menton !== null && mentonRule < 1) notes.push(`the chin is weak: found with a slope of ${mentonRule} instead of 1`);
  if (menton === null) notes.push('no chin found on the front line of the head');

  const headHeight = menton === null ? null : crown - menton;
  let headWidth = null;
  if (headHeight !== null) {
    for (const s of slices) {
      if (s.y < crown - 0.45 * headHeight || s.y > crown - 0.1 * headHeight) continue;
      const width = widthOf(s);
      if (headWidth === null || width > headWidth) headWidth = width;
    }
  }

  /* symmetry: each point mirrored, and its distance to the surface */
  const symmetry = mirroredDistance(P, T, V, M);

  /* where the regions lie */
  const probes = {};
  const probe = (name, origin, direction) => {
    const hit = cast(origin, direction);
    probes[name] = hit ? hit.region : null;
  };
  probe('crown', [0.0007, crown + 1, P[indexOfHighest(P, V) * 3 + 2]], [0, -1, 0]);
  probe('face', [0.0007, crown - 0.07 * H, 2], [0, 0, -1]);
  for (const side of [1, -1]) {
    const s = sides[side];
    const tag = side === 1 ? 'left' : 'right';
    if (s?.wrist && s?.fingertip) {
      const middle = mul(add(s.wrist, s.fingertip), 0.5);
      probe(`hand ${tag}`, [middle[0] + side, middle[1], middle[2]], [-side, 0, 0]);
    }
    if (s?.ankle) probe(`foot ${tag}`, [s.ankle[0], low - 1, s.ankle[2] + 0.06 * H], [0, 1, 0]);   // the sole, from below
    if (s?.acromion && neck) {
      // The ridge between neck and shoulder, from above: the upper trapezius.
      const x = side * (neck.width / 2 + (Math.abs(s.acromion[0]) - neck.width / 2) * 0.45);
      let ridge = null;
      for (let z = -0.12; z <= 0.12; z += 0.004) {
        const hit = cast([x, crown + 1, z], [0, -1, 0]);
        if (hit && (!ridge || hit.point[1] > ridge.point[1])) ridge = hit;
      }
      probes[`trapezius ${tag}`] = ridge ? ridge.region : null;
      if (ridge) {
        // …and the same slope seen from the front, a little below the ridge.
        const front = cast([x, ridge.point[1] - 0.012 * H, 2], [0, 0, -1]);
        probes[`trapezius front ${tag}`] = front ? front.region : null;
      }
    }
    if (s?.knee && crotch !== null) {
      const y = (s.knee[1] + crotch) / 2;
      probe(`thigh outside ${tag}`, [side * 2, y, s.knee[2]], [-side, 0, 0]);
    }
  }

  const perRegion = {};
  names.forEach((name, k) => { perRegion[name] = 0; void k; });
  for (let t = 0; t < M; t++) perRegion[names[TL[t]]]++;

  const values = {
    height: H,
    headHeight: headHeight === null ? null : headHeight / H,
    acromionHeight: acromionY === null ? null : (acromionY - low) / H,
    kneeHeight: average('knee', (p) => (p[1] - low) / H),
    crotchHeight: crotch === null ? null : (crotch - low) / H,
    upperArm: average('upperArm', (v) => v / H),
    forearm: average('forearm', (v) => v / H),
    hand: average('hand', (v) => v / H),
    footLength: average('footLength', (v) => v / H),
    bideltoid: bideltoid === null ? null : bideltoid / H,
    neckToHead: neck && headWidth ? neck.width / headWidth : null,
    symmetry: symmetry.max * 1000,
    armAbduction: average('armAbduction'),
    elbowFlexion: average('elbowFlexion'),
    toeOut: average('toeOut'),
  };
  const extra = {
    neckWidth: neck ? neck.width : null,
    headWidth,
    symmetryP99: symmetry.p99 * 1000,
    ankleSpacing: sides[1]?.ankle && sides[-1]?.ankle ? (sides[1].ankle[0] - sides[-1].ankle[0]) / H : null,
    ankleHeight: average('ankle', (p) => (p[1] - low) / H),
    armpitHeight: average('armpit', (y) => (y - low) / H),
    leftRight: Object.fromEntries(['upperArm', 'forearm', 'hand', 'footLength', 'armAbduction', 'elbowFlexion', 'toeOut']
      .map((key) => [key, [sides[1]?.[key] ?? null, sides[-1]?.[key] ?? null]])),
  };

  return {
    values,
    extra,
    probes,
    notes,
    skeleton: skeleton ? fromSkeleton(skeleton, low, H) : null,
    mesh: { vertices: V, triangles: M, perRegion, bytes: body.bytes, closed: openEdges(T, M) === 0, openEdges: openEdges(T, M) },
  };
}

function indexOfHighest(P, V) {
  let best = 0;
  for (let i = 1; i < V; i++) if (P[i * 3 + 1] > P[best * 3 + 1]) best = i;
  return best;
}

function openEdges(T, M) {
  const edges = new Map();
  for (let t = 0; t < M; t++) {
    for (let c = 0; c < 3; c++) {
      const a = T[t * 3 + c], b = T[t * 3 + ((c + 1) % 3)];
      const key = a < b ? a * 4194304 + b : b * 4194304 + a;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  let open = 0;
  for (const n of edges.values()) if (n !== 2) open++;
  return open;
}

/** Each point mirrored at x = 0: how far it lies from the surface. */
function mirroredDistance(P, T, V, M) {
  const CELL = 0.02;
  const grid = new Map();
  const cellKey = (i, j, k) => `${i},${j},${k}`;
  for (let t = 0; t < M; t++) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let c = 0; c < 3; c++) for (let a = 0; a < 3; a++) {
      const v = P[T[t * 3 + c] * 3 + a];
      if (v < lo[a]) lo[a] = v;
      if (v > hi[a]) hi[a] = v;
    }
    for (let i = Math.floor(lo[0] / CELL); i <= Math.floor(hi[0] / CELL); i++)
      for (let j = Math.floor(lo[1] / CELL); j <= Math.floor(hi[1] / CELL); j++)
        for (let k = Math.floor(lo[2] / CELL); k <= Math.floor(hi[2] / CELL); k++) {
          const key = cellKey(i, j, k);
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(t);
        }
  }
  const distances = new Float64Array(V);
  for (let n = 0; n < V; n++) {
    const p = [-P[n * 3], P[n * 3 + 1], P[n * 3 + 2]];
    const cell = p.map((v) => Math.floor(v / CELL));
    let best = 2 * CELL;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const list = grid.get(cellKey(cell[0] + i, cell[1] + j, cell[2] + k));
      if (!list) continue;
      for (const t of list) {
        const d = distanceToTriangle(p,
          [P[T[t * 3] * 3], P[T[t * 3] * 3 + 1], P[T[t * 3] * 3 + 2]],
          [P[T[t * 3 + 1] * 3], P[T[t * 3 + 1] * 3 + 1], P[T[t * 3 + 1] * 3 + 2]],
          [P[T[t * 3 + 2] * 3], P[T[t * 3 + 2] * 3 + 1], P[T[t * 3 + 2] * 3 + 2]]);
        if (d < best) best = d;
      }
    }
    distances[n] = best;
  }
  const sorted = Float64Array.from(distances).sort();
  return { max: sorted[V - 1], p99: sorted[Math.floor(V * 0.99)] };
}

/** Distance from p to the triangle abc (Ericson, Real-Time Collision Detection 5.1.5). */
function distanceToTriangle(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return norm(ap);
  const bp = sub(p, b);
  const d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return norm(bp);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return norm(sub(ap, mul(ab, d1 / (d1 - d3))));
  const cp = sub(p, c);
  const d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return norm(cp);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return norm(sub(ap, mul(ac, d2 / (d2 - d6))));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return norm(sub(p, add(b, mul(sub(c, b), w))));
  }
  const denominator = 1 / (va + vb + vc);
  return norm(sub(ap, add(mul(ab, vb * denominator), mul(ac, vc * denominator))));
}

/* ── the skeleton's opinion, where a body brings one ───────────────────── */

function fromSkeleton(skeleton, low, H) {
  const joint = (name) => skeleton.joints[name];
  const out = {};
  const perSide = (fn) => mean(['l', 'r'].map(fn));
  const length = (a, b) => norm(sub(joint(a), joint(b)));
  out.shoulderJointHeight = perSide((s) => (joint(`joint-${s}-shoulder`)[1] - low) / H);
  out.kneeHeight = perSide((s) => (joint(`joint-${s}-knee`)[1] - low) / H);
  out.hipJointHeight = perSide((s) => (joint(`joint-${s}-upper-leg`)[1] - low) / H);
  out.ankleJointHeight = perSide((s) => (joint(`joint-${s}-ankle`)[1] - low) / H);
  out.upperArm = perSide((s) => length(`joint-${s}-shoulder`, `joint-${s}-elbow`) / H);
  out.forearm = perSide((s) => length(`joint-${s}-elbow`, `joint-${s}-hand`) / H);
  // The hand laid flat: wrist to the root of the middle finger, then along its joints.
  out.hand = perSide((s) => (
    length(`joint-${s}-hand`, `joint-${s}-finger-3-1`) + length(`joint-${s}-finger-3-1`, `joint-${s}-finger-3-2`)
    + length(`joint-${s}-finger-3-2`, `joint-${s}-finger-3-3`) + length(`joint-${s}-finger-3-3`, `joint-${s}-finger-3-4`)) / H);
  out.armAbduction = perSide((s) => {
    const d = sub(joint(`joint-${s}-elbow`), joint(`joint-${s}-shoulder`));
    return degrees(Math.atan2((s === 'l' ? 1 : -1) * d[0], -d[1]));
  });
  out.elbowFlexion = perSide((s) => {
    const a = unit(sub(joint(`joint-${s}-elbow`), joint(`joint-${s}-shoulder`)));
    const b = unit(sub(joint(`joint-${s}-hand`), joint(`joint-${s}-elbow`)));
    return degrees(Math.acos(Math.max(-1, Math.min(1, dot(a, b)))));
  });
  out.toeOut = perSide((s) => {
    const toes = mul(add(joint(`joint-${s}-toe-2-1`), joint(`joint-${s}-toe-3-1`)), 0.5);
    const d = sub(toes, joint(`joint-${s}-ankle`));
    return degrees(Math.atan2((s === 'l' ? 1 : -1) * d[0], d[2]));
  });
  out.shoulderJointSpacing = (joint('joint-l-shoulder')[0] - joint('joint-r-shoulder')[0]) / H;
  out.hipJointSpacing = (joint('joint-l-upper-leg')[0] - joint('joint-r-upper-leg')[0]) / H;
  out.ankleJointSpacing = (joint('joint-l-ankle')[0] - joint('joint-r-ankle')[0]) / H;
  if (skeleton.pose) out.pose = skeleton.pose;
  return out;
}

/* ── printing ──────────────────────────────────────────────────────────── */

export function format(key, value) {
  if (value === null || value === undefined) return '—';
  const unitOf = TARGETS[key]?.unit;
  if (unitOf === '%H') return `${(value * 100).toFixed(1)} %`;
  if (unitOf === 'mm') return `${value.toFixed(1)} mm`;
  if (unitOf === '°') return `${value.toFixed(1)}°`;
  return value.toFixed(2);
}

export function targetText(key) {
  const { range, unit: unitOf } = TARGETS[key];
  if (unitOf === '%H') return `${(range[0] * 100).toFixed(1)}–${(range[1] * 100).toFixed(1)} %`;
  if (unitOf === 'mm') return `≤ ${range[1]} mm`;
  if (unitOf === '°') return `${range[0]}–${range[1]}°`;
  return `${range[0].toFixed(2)}–${range[1].toFixed(2)}`;
}

export function passes(key, value) {
  if (value === null || value === undefined) return false;
  const [lowest, highest] = TARGETS[key].range;
  return value >= lowest - 1e-9 && value <= highest + 1e-9;
}

export function measureFile(path) {
  const body = readBody(path);
  const beside = path.replace(/\.glb$/, '.landmarks.json');
  const skeleton = existsSync(beside) ? JSON.parse(readFileSync(beside, 'utf8')) : null;
  return measure(body, skeleton);
}

function main() {
  const args = process.argv.slice(2);
  const files = args.filter((a) => !a.startsWith('--'));
  if (!files.length) {
    console.error('usage: node tools/body/measure-body.mjs <body.glb> [<other.glb> …] [--json] [--markdown]');
    process.exit(2);
  }
  const results = files.map((path) => ({ path, name: path.split('/').pop().replace(/\.glb$/, ''), ...measureFile(path) }));
  if (args.includes('--json')) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  const markdown = args.includes('--markdown');
  const rows = [['measure', 'target', ...results.map((r) => r.name)]];
  rows.push(['Height', '—', ...results.map((r) => `${r.values.height.toFixed(3)} m`)]);
  for (const key of Object.keys(TARGETS)) {
    rows.push([TARGETS[key].label, targetText(key),
      ...results.map((r) => `${format(key, r.values[key])} ${passes(key, r.values[key]) ? '✓' : '✗'}`)]);
  }
  rows.push(['Met', `of ${Object.keys(TARGETS).length}`,
    ...results.map((r) => String(Object.keys(TARGETS).filter((key) => passes(key, r.values[key])).length))]);
  rows.push(['Triangles', '≤ 80,000', ...results.map((r) => String(r.mesh.triangles))]);
  rows.push(['Inert zone', '25–35 %', ...results.map((r) => `${((r.mesh.perRegion.none / r.mesh.triangles) * 100).toFixed(0)} %`)]);
  rows.push(['Smallest group', '≥ 400', ...results.map((r) => String(Math.min(...Object.entries(r.mesh.perRegion).filter(([n]) => n !== 'none').map(([, n]) => n))))]);
  rows.push(['File', '≤ 700 KB', ...results.map((r) => `${(r.mesh.bytes / 1024).toFixed(0)} KB`)]);
  rows.push(['Closed surface', 'yes', ...results.map((r) => (r.mesh.closed ? 'yes' : `no (${r.mesh.openEdges} open edges)`))]);
  printTable(rows, markdown);

  console.log('\nWhere the regions lie');
  const probeNames = [...new Set(results.flatMap((r) => Object.keys(r.probes)))];
  printTable([['place', ...results.map((r) => r.name)], ...probeNames.map((name) => [name, ...results.map((r) => r.probes[name] ?? '—')])], markdown);

  const withSkeleton = results.filter((r) => r.skeleton);
  if (withSkeleton.length) {
    console.log('\nThe skeleton\'s opinion (bodies built by build.py)');
    const keys = ['shoulderJointHeight', 'hipJointHeight', 'kneeHeight', 'ankleJointHeight', 'upperArm', 'forearm', 'hand',
      'shoulderJointSpacing', 'hipJointSpacing', 'ankleJointSpacing'];
    const angles = ['armAbduction', 'elbowFlexion', 'toeOut'];
    printTable([
      ['from the joints', ...withSkeleton.map((r) => r.name)],
      ...keys.map((key) => [key, ...withSkeleton.map((r) => `${(r.skeleton[key] * 100).toFixed(1)} %`)]),
      ...angles.map((key) => [key, ...withSkeleton.map((r) => `${r.skeleton[key].toFixed(1)}°`)]),
    ], markdown);
  }
  for (const r of results) for (const note of r.notes) console.log(`note (${r.name}): ${note}`);
}

function printTable(rows, markdown) {
  if (markdown) {
    rows.forEach((row, index) => {
      console.log(`| ${row.join(' | ')} |`);
      if (index === 0) console.log(`|${row.map(() => '---').join('|')}|`);
    });
    return;
  }
  const widths = rows[0].map((_, c) => Math.max(...rows.map((row) => String(row[c]).length)));
  for (const row of rows) console.log(row.map((cell, c) => String(cell).padEnd(widths[c])).join('  '));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
