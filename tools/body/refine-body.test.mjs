/**
 * refine-body.mjs, held to what the pipeline relies on.
 *
 * The script is a command, so the tests run it as one, on a small closed body
 * made here: a ball of 30 cm with a relief, painted with four regions. Three
 * promises matter for the build:
 *
 *   1. what counts as a stray patch — a piece of a region smaller than the
 *      `--stray` share of that region's largest piece — and that nothing else
 *      is handed back;
 *   2. cutting the borders never moves the surface: every new vertex lies on
 *      the old surface, the area stays, the body stays closed;
 *   3. the copyright notice of the input is written to the output unchanged.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'refine-body.mjs');
const RADIUS = 0.3;
const REGIONS = ['none', 'chest', 'back', 'biceps'];
const COPYRIGHT = 'Test body — «Kugel», CC0 1.0 Universal';

let dir;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'refine-body-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/* ── a small body ──────────────────────────────────────────────────────── */

/** An icosphere with a relief: grooves for the borders to find. */
function ball(subdivisions = 4) {
  const t = (1 + Math.sqrt(5)) / 2;
  let points = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t],
    [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  let tris = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2],
    [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5],
    [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  for (let level = 0; level < subdivisions; level++) {
    const middle = new Map();
    const mid = (a, b) => {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (!middle.has(key)) {
        middle.set(key, points.length);
        points.push([0, 1, 2].map((c) => (points[a][c] + points[b][c]) / 2));
      }
      return middle.get(key);
    };
    tris = tris.flatMap(([a, b, c]) => {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]];
    });
  }
  points = points.map((p) => {
    const length = Math.hypot(...p);
    const [x, y, z] = p.map((v) => v / length);
    const relief = 1 + 0.03 * Math.sin(5 * Math.atan2(z, x)) * Math.cos(4 * Math.asin(y));
    return [x, y, z].map((v) => v * RADIUS * relief);
  });
  return { points, tris };
}

const centroid = (points, [a, b, c]) => [0, 1, 2].map((k) => (points[a][k] + points[b][k] + points[c][k]) / 3);

/**
 * The paint: a cap of `none` on top, a `biceps` cap on each side (two equal
 * pieces, both real), `chest` in front and `back` behind — and, where asked
 * for, an island of `chest` in the middle of the back.
 */
function paint({ points, tris }, islandAngle = 0) {
  return tris.map((tri) => {
    const [x, y, z] = centroid(points, tri);
    if (y > 0.8 * RADIUS) return 0;
    if (Math.abs(x) > 0.8 * RADIUS) return 3;
    const fromBackPole = Math.acos(Math.max(-1, Math.min(1, -z / Math.hypot(x, y, z))));
    if (fromBackPole < islandAngle) return 1;
    return z >= 0 ? 1 : 2;
  });
}

function writeGlb(path, { points, tris }, labels, copyright = COPYRIGHT) {
  const normals = points.map(() => [0, 0, 0]);
  for (const [a, b, c] of tris) {
    const u = [0, 1, 2].map((k) => points[b][k] - points[a][k]);
    const v = [0, 1, 2].map((k) => points[c][k] - points[a][k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const i of [a, b, c]) for (let k = 0; k < 3; k++) normals[i][k] += n[k];
  }
  const chunks = [];
  const views = [];
  const accessors = [];
  let length = 0;
  const add = (typed, accessor) => {
    views.push({ buffer: 0, byteOffset: length, byteLength: typed.byteLength });
    accessors.push({ bufferView: views.length - 1, ...accessor });
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4);
    padded.set(bytes);
    chunks.push(padded);
    length += padded.length;
    return accessors.length - 1;
  };
  const position = add(Float32Array.from(points.flat()), { componentType: 5126, count: points.length, type: 'VEC3' });
  const normal = add(
    Float32Array.from(normals.flatMap((n) => n.map((v) => v / (Math.hypot(...n) || 1)))),
    { componentType: 5126, count: points.length, type: 'VEC3' },
  );
  const primitives = REGIONS.map((_, region) => {
    const indices = tris.filter((__, t) => labels[t] === region).flat();
    return {
      attributes: { POSITION: position, NORMAL: normal },
      indices: add(Uint32Array.from(indices), { componentType: 5125, count: indices.length, type: 'SCALAR' }),
      material: region,
    };
  });
  const json = {
    asset: { version: '2.0', generator: 'refine-body.test.mjs', copyright },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'Ball', mesh: 0 }],
    meshes: [{ name: 'Ball', primitives }],
    materials: REGIONS.map((name) => ({ name })),
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: length }],
  };
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jsonChunk = new Uint8Array(Math.ceil(text.length / 4) * 4).fill(0x20);
  jsonChunk.set(text);
  const out = new Uint8Array(12 + 8 + jsonChunk.length + 8 + length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.length, true);
  view.setUint32(12, jsonChunk.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonChunk, 20);
  view.setUint32(20 + jsonChunk.length, length, true);
  view.setUint32(24 + jsonChunk.length, 0x004e4942, true);
  let at = 28 + jsonChunk.length;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  writeFileSync(path, out);
}

function readGlb(path) {
  const buffer = readFileSync(path);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(buffer.subarray(20, 20 + jsonLength)));
  const bin = buffer.subarray(28 + jsonLength);
  const binView = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const getter = { 5120: ['getInt8', 1], 5121: ['getUint8', 1], 5123: ['getUint16', 2], 5125: ['getUint32', 4], 5126: ['getFloat32', 4] };
  const width = { SCALAR: 1, VEC3: 3, VEC4: 4 };
  const accessor = (index) => {
    const a = json.accessors[index];
    const v = json.bufferViews[a.bufferView];
    const [name, size] = getter[a.componentType];
    const stride = v.byteStride || size * width[a.type];
    const out = [];
    for (let i = 0; i < a.count; i++) {
      for (let c = 0; c < width[a.type]; c++) out.push(binView[name]((v.byteOffset || 0) + i * stride + c * size, true));
    }
    return out;
  };
  const node = json.nodes[0];
  const scale = node.scale ?? [1, 1, 1];
  const shift = node.translation ?? [0, 0, 0];
  const mesh = json.meshes[0];
  const flat = accessor(mesh.primitives[0].attributes.POSITION);
  const points = [];
  for (let i = 0; i < flat.length; i += 3) points.push([0, 1, 2].map((c) => flat[i + c] * scale[c] + shift[c]));
  const tris = [];
  const labels = [];
  mesh.primitives.forEach((primitive, region) => {
    const indices = accessor(primitive.indices);
    for (let i = 0; i < indices.length; i += 3) {
      tris.push([indices[i], indices[i + 1], indices[i + 2]]);
      labels.push(region);
    }
  });
  return { json, points, tris, labels, step: scale[0], buffer };
}

function refine(name, body, labels, options = [], copyright = COPYRIGHT) {
  const input = join(dir, `${name}.in.glb`);
  const output = join(dir, `${name}.out.glb`);
  writeGlb(input, body, labels, copyright);
  const log = execFileSync('node', [SCRIPT, input, output, ...options], { encoding: 'utf8' });
  return { input, output, log, result: readGlb(output) };
}

/* ── geometry for the checks ───────────────────────────────────────────── */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Distance from p to the triangle abc (Ericson, Real-Time Collision Detection 5.1.5). */
function distanceToTriangle(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  let closest;
  if (d1 <= 0 && d2 <= 0) closest = a;
  else {
    const bp = sub(p, b);
    const d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) closest = b;
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) closest = a.map((v, k) => v + (d1 / (d1 - d3)) * ab[k]);
      else {
        const cp = sub(p, c);
        const d5 = dot(ab, cp), d6 = dot(ac, cp);
        if (d6 >= 0 && d5 <= d6) closest = c;
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) closest = a.map((v, k) => v + (d2 / (d2 - d6)) * ac[k]);
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
              const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
              closest = b.map((v, k) => v + w * (c[k] - v));
            } else {
              const denominator = 1 / (va + vb + vc);
              closest = a.map((v, k) => v + ab[k] * vb * denominator + ac[k] * vc * denominator);
            }
          }
        }
      }
    }
  }
  return Math.hypot(...sub(p, closest));
}

function area({ points, tris }) {
  let sum = 0;
  for (const [a, b, c] of tris) {
    const u = sub(points[b], points[a]), v = sub(points[c], points[a]);
    sum += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
  }
  return sum;
}

/** How many triangles of a region lie around the middle of the back. */
function chestOnTheBack({ points, tris, labels }) {
  return tris.filter((tri, t) => labels[t] === 1 && centroid(points, tri)[2] < -0.6 * RADIUS).length;
}

const count = (labels, region) => labels.filter((label) => label === region).length;

/* ── the tests ─────────────────────────────────────────────────────────── */

describe('refine-body.mjs — stray patches', () => {
  const body = ball();

  it('hands back a piece smaller than a fifth of its region and says so', () => {
    const labels = paint(body, 0.42);
    const island = chestOnTheBack({ ...body, labels });
    const main = count(labels, 1) - island;
    expect(island).toBeGreaterThan(40);
    expect(island / main).toBeLessThan(0.2);

    const { result, log } = refine('stray-small', body, labels);
    expect(chestOnTheBack(result)).toBe(0);
    expect(log).toMatch(new RegExp(`stray patches handed back: 1 \\(${island} triangles\\)`));
    expect(log).toMatch(/chest\s+\d+ triangles at y/);
  });

  it('keeps a piece of a fifth or more: it is a second part of the region', () => {
    const labels = paint(body, 0.95);
    const island = chestOnTheBack({ ...body, labels });
    const main = count(labels, 1) - island;
    expect(island / main).toBeGreaterThan(0.2);
    expect(island).toBeLessThan(main);

    const { result, log } = refine('stray-large', body, labels);
    expect(chestOnTheBack(result)).toBeGreaterThan(island * 0.6);
    expect(log).toMatch(/stray patches handed back: 0 \(0 triangles\)/);
  });

  it('measures against the largest piece of the same region, by the --stray share', () => {
    const labels = paint(body, 0.42);
    const island = chestOnTheBack({ ...body, labels });
    const share = island / (count(labels, 1) - island);

    const kept = refine('stray-threshold-kept', body, labels, ['--stray', String(share * 0.9)]);
    expect(chestOnTheBack(kept.result)).toBeGreaterThan(island * 0.6);
    expect(kept.log).toMatch(/stray patches handed back: 0 /);

    const gone = refine('stray-threshold-gone', body, labels, ['--stray', String(share * 1.1)]);
    expect(chestOnTheBack(gone.result)).toBe(0);
  });

  it('never hands back a piece of --straymax triangles or more, however small its share', () => {
    const labels = paint(body, 0.42);
    const island = chestOnTheBack({ ...body, labels });

    const kept = refine('stray-max-kept', body, labels, ['--straymax', String(island)]);
    expect(chestOnTheBack(kept.result)).toBeGreaterThan(island * 0.6);
    expect(kept.log).toMatch(/stray patches handed back: 0 /);

    const gone = refine('stray-max-gone', body, labels, ['--straymax', String(island + 1)]);
    expect(chestOnTheBack(gone.result)).toBe(0);
  });

  it('leaves two equal pieces of one region alone — a left and a right arm', () => {
    const labels = paint(body);
    const { result, log } = refine('stray-two-sides', body, labels);
    const sides = result.tris
      .filter((_, t) => result.labels[t] === 3)
      .map((tri) => Math.sign(centroid(result.points, tri)[0]));
    const left = sides.filter((side) => side < 0).length;
    const right = sides.filter((side) => side > 0).length;
    expect(left).toBeGreaterThan(50);
    expect(right).toBeGreaterThan(50);
    expect(log).toMatch(/stray patches handed back: 0 /);
  });
});

describe('refine-body.mjs — the surface', () => {
  const body = ball();
  const labels = paint(body, 0.42);
  let run;
  beforeAll(() => {
    run = refine('surface', body, labels);
  });

  it('cuts the borders into the mesh: more vertices, no triangle lost', () => {
    expect(run.result.points.length).toBeGreaterThan(body.points.length);
    expect(run.result.tris.length).toBeGreaterThan(body.tris.length);
  });

  it('puts every vertex on the surface it was given', () => {
    // A position is written as a whole step of the 16-bit grid, so it may be
    // off by half a step on each axis; two steps is the generous bound.
    const tolerance = 2 * run.result.step;
    expect(tolerance).toBeLessThan(0.00003);
    const known = new Set(body.points.map((p) => p.map((v) => Math.round(v / tolerance)).join(',')));
    let worst = 0;
    let checked = 0;
    for (const p of run.result.points) {
      // An old vertex is found by its place; only a new one needs the search.
      const near = [-1, 0, 1];
      const cell = p.map((v) => Math.round(v / tolerance));
      if (near.some((i) => near.some((j) => near.some((k) => known.has([cell[0] + i, cell[1] + j, cell[2] + k].join(','))))))
        continue;
      checked++;
      let best = Infinity;
      for (const [a, b, c] of body.tris) {
        const d = distanceToTriangle(p, body.points[a], body.points[b], body.points[c]);
        if (d < best) best = d;
      }
      if (best > worst) worst = best;
    }
    expect(checked).toBeGreaterThan(50);
    expect(worst).toBeLessThan(tolerance);
  });

  it('keeps every vertex it was given', () => {
    const tolerance = 2 * run.result.step;
    const written = new Set();
    for (const p of run.result.points) {
      const cell = p.map((v) => Math.round(v / tolerance));
      for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) for (const k of [-1, 0, 1]) {
        written.add([cell[0] + i, cell[1] + j, cell[2] + k].join(','));
      }
    }
    const lost = body.points.filter((p) => !written.has(p.map((v) => Math.round(v / tolerance)).join(',')));
    expect(lost).toHaveLength(0);
  });

  it('keeps the area and stays closed', () => {
    expect(Math.abs(area(run.result) - area(body)) / area(body)).toBeLessThan(1e-4);
    const edges = new Map();
    for (const [a, b, c] of run.result.tris) {
      for (const [u, v] of [[a, b], [b, c], [c, a]]) {
        const key = u < v ? `${u}|${v}` : `${v}|${u}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    expect([...edges.values()].filter((n) => n !== 2)).toHaveLength(0);
  });

  it('keeps the contract with the app: one mesh, the regions in their order, shared points', () => {
    const { json } = run.result;
    expect(json.meshes).toHaveLength(1);
    expect(json.meshes[0].primitives.map((p) => json.materials[p.material].name)).toEqual(REGIONS);
    expect(new Set(json.meshes[0].primitives.map((p) => p.attributes.POSITION)).size).toBe(1);
    expect(new Set(json.meshes[0].primitives.map((p) => p.attributes.NORMAL)).size).toBe(1);
    expect(json.extensionsRequired).toEqual(['KHR_mesh_quantization']);
    expect(json.accessors[json.meshes[0].primitives[0].attributes.POSITION].componentType).toBe(5123);
  });

  it('bakes the shade as a vertex colour, and leaves it out when asked', () => {
    expect(run.result.json.meshes[0].primitives.every((p) => p.attributes.COLOR_0 !== undefined)).toBe(true);
    const plain = refine('surface-plain', body, labels, ['--shade', '0']);
    expect(plain.result.json.meshes[0].primitives.some((p) => p.attributes.COLOR_0 !== undefined)).toBe(false);
  });

  it('writes the same bytes for the same input', () => {
    const again = refine('surface', body, labels);
    expect(Buffer.compare(again.result.buffer, run.result.buffer)).toBe(0);
  });
});

describe('refine-body.mjs — the notice', () => {
  const body = ball(3);
  const labels = paint(body);

  it('writes the copyright of the input unchanged', () => {
    const { result } = refine('notice', body, labels);
    expect(result.json.asset.copyright).toBe(COPYRIGHT);
  });

  it('writes another body\'s notice just as it stands', () => {
    const other = 'Body: MakeHuman base mesh and targets via MPFB2, CC0 1.0 Universal';
    const { result } = refine('notice-other', body, labels, [], other);
    expect(result.json.asset.copyright).toBe(other);
  });

  it('records which file it was made from', () => {
    const { input, result } = refine('notice-source', body, labels);
    const digest = createHash('sha256').update(readFileSync(input)).digest('hex');
    expect(result.json.asset.extras.refinedFrom.sha256).toBe(digest.slice(0, 16));
    expect(result.json.asset.extras.refinedFrom.generator).toBe('refine-body.test.mjs');
  });
});
