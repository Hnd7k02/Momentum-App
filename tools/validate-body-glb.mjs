#!/usr/bin/env node
/**
 * Validates the Momentum body GLB against the muscle-group contract.
 *
 * Run:  node tools/validate-body-glb.mjs public/models/momentum-body.glb
 *
 * Exits non-zero on any contract violation. A broken muscle mapping must fail
 * loudly in CI rather than reach a device as a dead region.
 *
 * The model is the one block 7A built (D165): MakeHuman's base mesh, shaped,
 * posed and cut by tools/body/, licensed CC0 1.0. What is checked:
 *
 *   structure     one mesh, eleven primitives, the material name is the
 *                 muscle-group id, shared position and normal lists,
 *                 KHR_mesh_quantization, a closed surface, the size
 *   frame         height, width, feet on the ground, the body on its axis
 *   envelopes     where each region lies, as a share of the body's height
 *   inert zone    head with neck, two hands, two feet: five pieces, each
 *                 cut straight (D165, correction 2)
 *   check points  a ray at a fixed place meets the region it must (§14)
 *   measures      the proportions and the posture of tools/body/MEASURES.md
 *                 whose targets are confirmed
 *   licence       the file names its source
 *
 * The ten ids below are a copy of `MuscleGroup` in src/core/model/index.ts.
 * They are duplicated here on purpose: this script must be runnable without
 * the TypeScript build.
 */
import { readFileSync } from 'node:fs';
import { TARGETS, format, measure, passes, readBody, regionBorders, regionSpans, targetText } from './body/measure-body.mjs';
import { runCheckPoints } from './body/checkpoints.mjs';

const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'core', 'quadriceps', 'hamstringsGlutes', 'calves', 'forearms',
];
const INERT = 'none';

// Expected model frame. A body that drifts out of these is a pipeline bug.
const EXPECT = {
  heightMin: 1.60, heightMax: 1.90,   // metres, feet on the ground
  widthMax: 1.40,                     // arm span in an A-pose
  footY: 0.02,                        // |min.y| must be under this
  centreX: 0.03,                      // |centre.x| — the body stands on the axis
  maxTriangles: 80000,
  minTrianglesPerGroup: 400,
  // 700 KB as this project counts them (the model of D156 was 478,008 bytes,
  // "467 KB"): the guide's ceiling for the download on a phone.
  maxBytes: 700 * 1024,
};

/**
 * Where each region lies, as shares of the body's height: the lowest it may
 * reach, the highest it may reach, and how far it must reach at least
 * (`from` down to, `to` up to). Measured on the body of block 7A (in
 * brackets), with two percent of slack: enough for another body type of the
 * same pipeline, too little for a region that crossed a joint.
 */
const ENVELOPE = {
  // The lower leg, from the ankle's cut [6.0] to the knee [31.1; the joint
  // line is at 29.9]. Must not reach the foot, must not climb into the thigh.
  calves: { low: 0.04, high: 0.33, from: 0.09, to: 0.28 },
  // The thigh, front and inside, from the knee [29.3] to the groin [57.0].
  quadriceps: { low: 0.27, high: 0.59, from: 0.33, to: 0.53 },
  // The back of the thigh and the buttocks, from the knee [28.7] to the iliac
  // crest [57.0]. Must not reach the lumbar region, must not cross the knee.
  hamstringsGlutes: { low: 0.27, high: 0.59, from: 0.33, to: 0.53 },
  // The belly, from the pubic bone [49.0] to under the chest [73.2].
  core: { low: 0.47, high: 0.75, from: 0.52, to: 0.69 },
  // The pectoral, from its lower edge [66.1] to the neck's cut, which it
  // reaches through the pit of the throat [85.4].
  chest: { low: 0.64, high: 0.87, from: 0.69, to: 0.81 },
  // Latissimus, erectors, trapezius: from the iliac crest [55.2] — the back
  // must reach DOWN to it — to the neck's cut at the trapezius [85.6].
  back: { low: 0.53, high: 0.87, from: 0.58, to: 0.82 },
  // The deltoid, from its insertion on the arm [72.9] to the acromion [83.8].
  shoulders: { low: 0.71, high: 0.86, from: 0.76, to: 0.81 },
  // The upper arm, front [65.1–75.6] and back [64.9–74.8]: from the elbow's
  // plane to the armpit. Must not cross the elbow, must not reach the shoulder's top.
  biceps: { low: 0.63, high: 0.78, from: 0.67, to: 0.73 },
  triceps: { low: 0.63, high: 0.77, from: 0.67, to: 0.72 },
  // The forearm, from the wrist's cut [51.4] to the elbow [67.2]. Must not
  // reach the hand.
  forearms: { low: 0.49, high: 0.69, from: 0.54, to: 0.64 },
};

/**
 * The measures that are held, of the fourteen in tools/body/MEASURES.md. Out
 * are the three whose targets are not yet checked at their source — knee
 * height, crotch height and the shoulder breadth, whose window is to become
 * 27–32 % once it is (the owner at the gate, D165). They enter here then.
 */
const HELD_MEASURES = [
  'headHeight', 'acromionHeight', 'upperArm', 'forearm', 'hand', 'footLength',
  'neckToHead', 'symmetry', 'armAbduction', 'elbowFlexion', 'toeOut',
];

const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/validate-body-glb.mjs <path-to.glb>');
  process.exit(2);
}

const problems = [];
const notes = [];
const fail = (m) => problems.push(m);

/* ── parse ─────────────────────────────────────────────────────────────── */

const raw = readFileSync(file);
const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
const dv = new DataView(buf);
if (dv.getUint32(0, true) !== 0x46546c67) { console.error('not a GLB'); process.exit(2); }

let off = 12, json = null, bin = null;
while (off < buf.byteLength) {
  const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
  const bytes = new Uint8Array(buf, off + 8, len);
  if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(bytes));
  if (type === 0x004e4942) bin = bytes;
  off += 8 + len + (len % 4 ? 4 - (len % 4) : 0);
}
if (!json) { console.error('no JSON chunk'); process.exit(2); }

const CT = { 5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2],
             5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function read(accessorIndex) {
  const a = json.accessors[accessorIndex];
  const bv = json.bufferViews[a.bufferView];
  const [Arr, size] = CT[a.componentType];
  const n = NCOMP[a.type];
  const stride = bv.byteStride || size * n;
  const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const out = new (a.componentType === 5126 ? Float32Array : Arr)(a.count * n);
  const view = new DataView(bin.buffer, bin.byteOffset);
  for (let i = 0; i < a.count; i++) {
    for (let c = 0; c < n; c++) {
      const o = base + i * stride + c * size;
      let v;
      switch (a.componentType) {
        case 5120: v = view.getInt8(o); break;
        case 5121: v = view.getUint8(o); break;
        case 5122: v = view.getInt16(o, true); break;
        case 5123: v = view.getUint16(o, true); break;
        case 5125: v = view.getUint32(o, true); break;
        default:   v = view.getFloat32(o, true);
      }
      out[i * n + c] = v;
    }
  }
  return { data: out, accessor: a };
}

/* ── structure ─────────────────────────────────────────────────────────── */

const meshes = json.meshes || [];
if (meshes.length !== 1) fail(`expected exactly 1 mesh, found ${meshes.length}`);
const prims = (meshes[0] || {}).primitives || [];
notes.push(`primitives: ${prims.length}`);

if (json.skins) fail('model must not be skinned');
if (json.animations && json.animations.length) fail('model must carry no animations');

const ext = json.extensionsRequired || [];
const KNOWN = ['KHR_mesh_quantization'];   // decoder-free; anything else needs a runtime decoder
for (const e of ext) if (!KNOWN.includes(e)) fail(`unsupported required extension "${e}" — needs a local decoder`);
notes.push(`extensionsRequired: ${ext.length ? ext.join(', ') : '(none)'}`);

if (raw.byteLength > EXPECT.maxBytes) {
  fail(`the file is ${raw.byteLength} bytes — over ${EXPECT.maxBytes} (700 KB), the ceiling for the download on a phone`);
}

/* ── attributes ────────────────────────────────────────────────────────── */

const posIdx = new Set(), nrmIdx = new Set(), colIdx = new Set();
// What every later check indexes into: without it the file is not read on.
let whole = prims.length > 0;
if (!prims.length) fail('the file has no mesh with primitives');
for (const p of prims) {
  const attributes = p.attributes ?? {};
  if (attributes.POSITION === undefined) { fail('a primitive has no POSITION'); whole = false; }
  if (attributes.NORMAL === undefined) fail('a primitive has no NORMAL — the body would render faceted');
  if (p.indices === undefined) { fail('a primitive is not indexed'); whole = false; }
  if ((json.materials ?? [])[p.material] === undefined) { fail('a primitive has no material — a region is the name of its material'); whole = false; }
  posIdx.add(attributes.POSITION);
  nrmIdx.add(attributes.NORMAL);
  colIdx.add(attributes.COLOR_0);
}
if (!whole) {
  console.error(`\n✗ ${problems.length} contract violation(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('  (the file was not read further: every primitive needs its points, its triangles and its material first)');
  process.exit(1);
}
if (posIdx.size !== 1) fail(`primitives must share ONE position accessor (found ${posIdx.size}) — shared buffers are what keep this asset cheap`);
if (nrmIdx.size !== 1) fail(`primitives must share ONE normal accessor (found ${nrmIdx.size})`);
// The baked shade is a vertex colour. All regions carry the same list, or
// none does: a region without it would be drawn without its shade, and the
// viewer switches vertex colours on per mesh.
if (colIdx.size !== 1) fail('some primitives carry a vertex colour and some do not — the baked shade must be on all or on none');
notes.push(`baked shade: ${[...colIdx][0] === undefined ? 'none' : 'COLOR_0, shared'}`);

/* ── muscle mapping ────────────────────────────────────────────────────── */

const seen = new Map();
for (const p of prims) {
  const mat = json.materials[p.material];
  const name = mat ? mat.name : '(unnamed)';
  const tris = json.accessors[p.indices].count / 3;
  if (seen.has(name)) fail(`material "${name}" is used by more than one primitive — regions must be exactly one primitive each`);
  seen.set(name, tris);
}
for (const id of MUSCLE_GROUPS) {
  if (!seen.has(id)) fail(`MISSING muscle region "${id}"`);
  else if (seen.get(id) < EXPECT.minTrianglesPerGroup) fail(`region "${id}" has only ${seen.get(id)} triangles — probably collapsed`);
}
if (!seen.has(INERT)) fail(`missing inert "${INERT}" region (head, hands, feet)`);
for (const name of seen.keys()) {
  if (name !== INERT && !MUSCLE_GROUPS.includes(name)) fail(`unknown region "${name}" — not a Momentum MuscleGroup`);
}

/* ── geometry sanity ───────────────────────────────────────────────────── */

const posA = read([...posIdx][0]);
const vertexCount = posA.accessor.count;
const node = (json.nodes || []).find((n) => n.mesh === 0) || {};
const scale = node.scale || [1, 1, 1];
const translation = node.translation || [0, 0, 0];
if (posA.accessor.componentType !== 5126) {
  if (!ext.includes('KHR_mesh_quantization')) fail('quantized positions without KHR_mesh_quantization in extensionsRequired');
  if (Math.abs(scale[0] - scale[1]) > 1e-12 || Math.abs(scale[1] - scale[2]) > 1e-12) {
    fail('non-uniform dequantization scale — stored normals would be wrong after the inverse-transpose');
  }
}

const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < vertexCount; i++) {
  for (let c = 0; c < 3; c++) {
    const v = posA.data[i * 3 + c] * scale[c] + translation[c];
    if (v < min[c]) min[c] = v;
    if (v > max[c]) max[c] = v;
  }
}
const height = max[1] - min[1], width = max[0] - min[0], centreX = (max[0] + min[0]) / 2;
notes.push(`bbox  x[${min[0].toFixed(3)}, ${max[0].toFixed(3)}]  y[${min[1].toFixed(3)}, ${max[1].toFixed(3)}]  z[${min[2].toFixed(3)}, ${max[2].toFixed(3)}]`);
notes.push(`height ${height.toFixed(3)} m · width ${width.toFixed(3)} m · centreX ${centreX.toFixed(4)}`);

if (height < EXPECT.heightMin || height > EXPECT.heightMax) fail(`height ${height.toFixed(3)} m outside [${EXPECT.heightMin}, ${EXPECT.heightMax}]`);
if (width > EXPECT.widthMax) fail(`width ${width.toFixed(3)} m exceeds ${EXPECT.widthMax}`);
if (Math.abs(min[1]) > EXPECT.footY) fail(`feet are at y=${min[1].toFixed(4)}, expected the ground plane`);
if (Math.abs(centreX) > EXPECT.centreX) fail(`body is off-axis: centreX=${centreX.toFixed(4)}`);
if (height < width) fail('model does not look Y-up: it is wider than it is tall');

/* ── indices ───────────────────────────────────────────────────────────── */

let totalTris = 0;
const edgeUse = new Map();
for (const p of prims) {
  const { data } = read(p.indices);
  totalTris += data.length / 3;
  if (data.length % 3) fail('index count is not a multiple of 3');
  let bad = 0, degenerate = 0;
  for (let i = 0; i < data.length; i += 3) {
    const a = data[i], b = data[i + 1], c = data[i + 2];
    if (a >= vertexCount || b >= vertexCount || c >= vertexCount) bad++;
    if (a === b || b === c || a === c) degenerate++;
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const key = u < v ? u * 4194304 + v : v * 4194304 + u;
      edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
    }
  }
  const name = json.materials[p.material].name;
  if (bad) fail(`region "${name}": ${bad} triangles index past the vertex buffer`);
  if (degenerate) fail(`region "${name}": ${degenerate} degenerate triangles`);
}
notes.push(`vertices ${vertexCount} · triangles ${totalTris}`);
if (totalTris > EXPECT.maxTriangles) fail(`${totalTris} triangles exceeds the budget of ${EXPECT.maxTriangles}`);

// A body is a closed surface: every edge lies between exactly two triangles.
// An open edge is a hairline that the background shows through.
let openEdges = 0;
for (const n of edgeUse.values()) if (n !== 2) openEdges++;
if (openEdges) fail(`the surface is not closed: ${openEdges} edges do not lie between exactly two triangles`);

/* ── what follows reads the surface itself ─────────────────────────────── */

const structural = problems.length;
const body = structural ? null : readBody(file);

/* ── anatomical envelopes ──────────────────────────────────────────────── */

if (body) {
  const spans = regionSpans(body);
  const pct = (v) => `${(v * 100).toFixed(1)}%`;
  for (const id of MUSCLE_GROUPS) {
    const span = spans[id];
    const env = ENVELOPE[id];
    if (span.low < env.low) fail(`region "${id}" reaches down to ${pct(span.low)} of height, below its envelope (${pct(env.low)})`);
    if (span.high > env.high) fail(`region "${id}" reaches up to ${pct(span.high)} of height, above its envelope (${pct(env.high)})`);
    if (span.low > env.from) fail(`region "${id}" stops at ${pct(span.low)} of height — it must reach down to ${pct(env.from)}`);
    if (span.high < env.to) fail(`region "${id}" ends at ${pct(span.high)} of height — it must reach up to ${pct(env.to)}`);
    // One Momentum group is two limbs, or two halves of the trunk: a region
    // that lost a side would still pass every count.
    if (!span.left || !span.right) fail(`region "${id}" is not on both sides of the body (left=${span.left}, right=${span.right})`);
    notes.push(`envelope ${id.padEnd(17)} y ${pct(span.low)}–${pct(span.high)} of height`);
  }
}

/* ── the inert zone, and its straight cuts ─────────────────────────────── */

if (body) {
  // Head with neck, two hands, two feet — and each of them ends where the
  // build cut it: on a plane. A border that has left its plane by a
  // millimetre has been moved or smoothed by a later step.
  const borders = regionBorders(body, INERT);
  if (borders.length !== 5) fail(`the inert zone has ${borders.length} borders, not five — head, two hands, two feet`);
  for (const border of borders) {
    const where = `(${border.centre.map((v) => v.toFixed(2)).join(', ')})`;
    if (border.deviation > 0.001) {
      fail(`the inert zone's border at ${where} is not a straight cut: it leaves its plane by ${(border.deviation * 1000).toFixed(1)} mm`);
    }
  }
  if (borders.length === 5) {
    // The first is the highest: the neck. Nearly level — within ten degrees.
    const tilt = Math.acos(Math.min(1, Math.abs(borders[0].normal[1]))) * 180 / Math.PI;
    if (tilt > 10) fail(`the neck's cut is tilted by ${tilt.toFixed(1)}° — it is to be nearly level`);
    notes.push(`inert zone: five straight cuts, the largest ${(Math.max(...borders.map((b) => b.deviation)) * 1000).toFixed(2)} mm off its plane; the neck tilted ${tilt.toFixed(1)}°`);
  }
}

/* ── check points ──────────────────────────────────────────────────────── */

if (body) {
  const results = runCheckPoints(body);
  for (const result of results.filter((r) => !r.ok)) {
    fail(`check point "${result.name}"${result.side ? ` (${result.side})` : ''}: the ray meets ${result.found ?? 'nothing'}, not ${result.expected.join(' or ')}`);
  }
  notes.push(`check points: ${results.filter((r) => r.ok).length} of ${results.length}`);
}

/* ── proportions and posture ───────────────────────────────────────────── */

if (body) {
  const { values, notes: measuring } = measure(body);
  for (const note of measuring) fail(`measuring: ${note}`);
  for (const key of HELD_MEASURES) {
    if (!passes(key, values[key])) {
      fail(`${TARGETS[key].label}: ${format(key, values[key])}, outside ${targetText(key)}`);
    }
  }
  notes.push(`measures: ${HELD_MEASURES.map((key) => format(key, values[key])).join(' · ')}`);
}

/* ── licence ───────────────────────────────────────────────────────────── */

// The body is MakeHuman's base mesh and targets, CC0 1.0. No attribution is
// owed; the file says where it comes from all the same, and it must not carry
// the notice of the model it replaced.
const copyright = (json.asset || {}).copyright || '';
if (!/MakeHuman/i.test(copyright) || !/CC0/i.test(copyright)) {
  fail('asset.copyright must name MakeHuman and CC0 — the source and the licence of the body');
}
if (/patmateee|CC-BY/i.test(copyright)) {
  fail('asset.copyright names the model of D156 — that body is no longer shipped');
}

/* ── report ────────────────────────────────────────────────────────────── */

console.log(`\n${file}`);
console.log(`  ${(raw.byteLength / 1024).toFixed(0)} KB`);
for (const n of notes) console.log(`  ${n}`);
console.log('  regions:');
for (const id of [...MUSCLE_GROUPS, INERT]) {
  console.log(`    ${seen.has(id) ? '✓' : '✗'} ${id.padEnd(18)} ${seen.get(id) ?? '—'}`);
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} contract violation(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  if (structural) console.error('  (the surface itself was not read: the structure must hold first)');
  process.exit(1);
}
console.log(`\n✓ muscle mapping ${MUSCLE_GROUPS.length}/${MUSCLE_GROUPS.length} · contract satisfied\n`);
