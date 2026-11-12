#!/usr/bin/env node
/**
 * refine-body.mjs — stage 1 of the Momentum body upgrade.
 *
 * Reads the shipped body GLB and writes a new one that keeps the muscle
 * contract (tools/validate-body-glb.mjs) but reads more anatomically:
 *
 *   1. Region borders follow the grooves between the muscles of the sculpt
 *      instead of zig-zagging along triangle edges. The border is solved as a
 *      random walk inside a narrow band around today's border, with edges that
 *      cross a groove made expensive, and the result is cut into the mesh along
 *      the smooth isoline. The cut only splits existing triangles: every new
 *      vertex lies on an existing edge, so the surface, the silhouette, the
 *      frame and every measured landmark stay exactly where they were.
 *   2. Small cut-off patches of a region are handed back to their neighbours.
 *      In the v2.1 file that removes a 'shoulders' strip on each outer thigh
 *      (279 triangles: a tap there selected Schultern) and three 'none' bands
 *      that left holes in the torso (collar, below both pecs).
 *   3. A baked shade (COLOR_0, grey) darkens grooves and occluded places
 *      (cavity at two scales + ambient occlusion), so the relief reads at card
 *      size. The body stays one neutral colour; the tint still comes only from
 *      the training data. Turn it off with --shade 0 for a drop-in file.
 *
 * The shade needs one change in the app, because the viewer replaces the GLB
 * materials with its own (useMuscleHighlight.ts regionMaterial(), and the
 * inert material in BodyModel.tsx):
 *
 *   material.vertexColors = mesh.geometry.hasAttribute('color');
 *
 * Conditional on purpose: vertexColors without a colour attribute renders black.
 *
 * What it keeps, because the app and the validator depend on it:
 *   one mesh, one primitive per region, material name === MuscleGroup id,
 *   one shared POSITION / NORMAL accessor, no split at a region border,
 *   uint16 positions with a uniform node scale (KHR_mesh_quantization),
 *   int8 normals, asset.copyright verbatim, primitive order unchanged.
 *
 * Dependency-free on purpose, like the validator: runs on plain Node 18+.
 *
 *   node tools/body/refine-body.mjs public/models/momentum-body.glb out.glb
 *   node tools/validate-body-glb.mjs out.glb
 *
 * Options (defaults in brackets):
 *   --band <m>        width of the band in which a border may move   [0.03]
 *   --groove <n>      how strongly a groove attracts a border        [6]
 *   --prior <n>       pull towards today's assignment                [0.15]
 *   --stray <0..1>    a piece of a region smaller than this share of its
 *                     largest piece is handed back to its neighbours   [0.2]
 *   --straymax <n>    …unless it has this many triangles or more: a piece
 *                     that large is a part of the body — a hand beside an
 *                     unthinned head — and never a stray              [no limit]
 *   --freeze <name>   one region whose borders stay exactly on the edges
 *                     they lie on: no walk moves them, no cut reshapes them,
 *                     no piece of it is a stray. For a region whose border
 *                     the builder has already cut where it belongs — the
 *                     inert zone, cut level at the neck and straight at
 *                     wrist and ankle                                  [none frozen]
 *   --hold <list>     region pairs whose border keeps its place and is only
 *                     smoothed: the documented lumbar waistband and calf cut
 *                     [back|hamstringsGlutes,calves|quadriceps,calves|hamstringsGlutes]
 *   --shade <0|1>     write COLOR_0                                  [1]
 *   --cavity <0..1>   strength of the groove darkening               [0.5]
 *   --ao <0..1>       strength of the ambient occlusion              [0.4]
 *   --floor <0..1>    darkest allowed shade                          [0.55]
 *   --white <0..1>    share of the surface that keeps the full base colour [0.85]
 *   --shadedepth <m>  for the shade alone: the depth of a groove that counts
 *                     as a full one, in metres. Without it a groove is
 *                     measured against the deepest 3 % of the body, so the
 *                     shallowest body still gets its lines painted in full [0 = relative]
 *   --shadefine <0..1> the share of the fine scale in the shade's grooves:
 *                     the fine scale draws lines, the broad one forms [0.65]
 *   --shadesmooth <n> how often the shade is averaged over the neighbours;
 *                     0 leaves it as computed, triangle by triangle [1]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

/* ── options ───────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const positional = [];
const opt = {
  band: 0.03, groove: 6, prior: 0.15, stray: 0.2, straymax: Infinity, freeze: '',
  hold: 'back|hamstringsGlutes,calves|quadriceps,calves|hamstringsGlutes',
  shade: 1, cavity: 0.5, ao: 0.4, floor: 0.55, white: 0.85,
  shadedepth: 0, shadefine: 0.65, shadesmooth: 1,
};
// The file records the options it was made with. The three of the shade
// that came after the first shipped body are recorded only where they are
// used, so a body built without them is byte for byte the file it was.
const LATER = { shadedepth: 0, shadefine: 0.65, shadesmooth: 1 };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    if (!(key in opt)) die(`unknown option --${key}`);
    const value = argv[++i];
    opt[key] = typeof opt[key] === 'number' ? Number(value) : value;
  } else positional.push(a);
}
const [inPath, outPath] = positional;
if (!inPath || !outPath) die('usage: node tools/body/refine-body.mjs <in.glb> <out.glb> [options]');
const HOLD = new Set(String(opt.hold).split(',').filter(Boolean).map((p) => p.split('|').sort().join('|')));

function die(message) {
  console.error(message);
  process.exit(2);
}

/* ── GLB in ────────────────────────────────────────────────────────────── */

const raw = readFileSync(inPath);
const { json, bin } = parseGlb(raw);
const mesh0 = json.meshes?.[0];
if (!mesh0 || json.meshes.length !== 1) die('expected exactly one mesh');
const node = json.nodes.find((n) => n.mesh === 0);
if (node.rotation || node.matrix) die('the body node must carry only scale and translation');
const nScale = node.scale ?? [1, 1, 1];
const nTrans = node.translation ?? [0, 0, 0];
const prims = mesh0.primitives;
const posIndex = prims[0].attributes.POSITION;
const nrmIndex = prims[0].attributes.NORMAL;
for (const p of prims) {
  if (p.attributes.POSITION !== posIndex || p.attributes.NORMAL !== nrmIndex) die('primitives must share one POSITION and one NORMAL accessor');
}
const regionNames = prims.map((p) => json.materials[p.material].name);
const L = regionNames.length;
const NONE = regionNames.indexOf('none');
if (NONE < 0) die('no inert "none" region');
const FROZEN = opt.freeze ? regionNames.indexOf(opt.freeze) : -1;
if (opt.freeze && FROZEN < 0) die(`--freeze names no region of this file: ${opt.freeze}`);

const posQ = readAccessor(posIndex);
const nrmQ = readAccessor(nrmIndex);
const V0 = posQ.count;

// World positions in metres (the node carries the dequantisation).
const P = new Float64Array(V0 * 3);
const N = new Float64Array(V0 * 3);
for (let i = 0; i < V0; i++) {
  for (let c = 0; c < 3; c++) P[i * 3 + c] = posQ.data[i * 3 + c] * nScale[c] + nTrans[c];
  const x = nrmQ.data[i * 3], y = nrmQ.data[i * 3 + 1], z = nrmQ.data[i * 3 + 2];
  const len = Math.hypot(x, y, z) || 1;
  N[i * 3] = x / len; N[i * 3 + 1] = y / len; N[i * 3 + 2] = z / len;
}

// Triangles with their region.
const triList = [];
const triLabel = [];
prims.forEach((p, label) => {
  const idx = readAccessor(p.indices).data;
  for (let k = 0; k < idx.length; k += 3) {
    triList.push(idx[k], idx[k + 1], idx[k + 2]);
    triLabel.push(label);
  }
});
const T = Int32Array.from(triList);
const TL = Int32Array.from(triLabel);
const M = TL.length;

// The frozen region, if one is named. A vertex of it either lies wholly
// inside — every triangle around it is frozen — or on its rim, where it also
// belongs to a region that is free to move. Everything below keeps the two
// apart: the inside never changes, and the rim is a vertex of its free region
// that can never be handed to the frozen one.
const edgeKey = (i, j) => (i < j ? i * 1048576 + j : j * 1048576 + i);
const touchesFree = new Uint8Array(V0);
const touchesFrozen = new Uint8Array(V0);
const freeEdges = new Set();
for (let t = 0; t < M; t++) {
  const frozen = TL[t] === FROZEN;
  for (let c = 0; c < 3; c++) {
    const a = T[t * 3 + c], b = T[t * 3 + ((c + 1) % 3)];
    if (frozen) touchesFrozen[a] = 1;
    else { touchesFree[a] = 1; freeEdges.add(edgeKey(a, b)); }
  }
}
const frozenInside = (i) => touchesFrozen[i] === 1 && touchesFree[i] === 0;

/* ── topology ──────────────────────────────────────────────────────────── */

const adjacency = buildAdjacency(V0, T);

// Area of each triangle.
const triArea = new Float64Array(M);
for (let t = 0; t < M; t++) triArea[t] = triangleArea(T[t * 3], T[t * 3 + 1], T[t * 3 + 2]);
const meanEdge = meanEdgeLength();

/* ── groove and shade fields ───────────────────────────────────────────── */

// A groove is a place that lies below a smoothed copy of the surface. Taubin
// smoothing does not shrink the body, so the offset along the normal is the
// local relief at the smoothing scale: negative in a groove, positive on a
// ridge. Two scales: the separations between muscles (~2 cm) and the broad
// hollows (~4 cm).
const fine = reliefAt(8);
const broad = reliefAt(32);
const grooveFine = normalisedDepth(fine);
const grooveBroad = normalisedDepth(broad);

/* ── stray patches ─────────────────────────────────────────────────────── */

// A region is one piece per side of the body. A small patch of it, cut off
// from that piece, is a painting error rather than anatomy: in the v2.1 file a
// strip of 'shoulders' sits on each outer thigh, and three 'none' bands
// (collar, below both pecs) leave holes in the torso. Such patches are handed
// back to the regions around them, through the same random walk as a border.
const strays = findStrays();
const stray = strays.mask;

// Per vertex: the area of each region around it (strays excluded), and the
// regions that reach it only through a stray patch.
const vertexLabelArea = new Float64Array(V0 * L);
const strayMask = new Int32Array(V0);
for (let t = 0; t < M; t++) {
  for (let c = 0; c < 3; c++) {
    const v = T[t * 3 + c];
    if (stray[t]) strayMask[v] |= 1 << TL[t];
    // A vertex on the frozen region's rim is counted for its free region alone.
    else if (!(TL[t] === FROZEN && touchesFree[v])) vertexLabelArea[v * L + TL[t]] += triArea[t] / 3;
  }
}
const forbidden = (i, k) =>
  (k === FROZEN && touchesFree[i] === 1) || (((strayMask[i] >> k) & 1) === 1 && vertexLabelArea[i * L + k] === 0);

/* ── 1. borders that follow the grooves ────────────────────────────────── */

const vertexLabel = new Int32Array(V0).fill(-1);
const isBorder = new Uint8Array(V0);
for (let i = 0; i < V0; i++) {
  let best = -1, bestArea = -1, count = 0;
  for (let k = 0; k < L; k++) {
    const area = vertexLabelArea[i * L + k];
    if (area > 0) {
      count++;
      if (area > bestArea) { bestArea = area; best = k; }
    }
  }
  vertexLabel[i] = best;
  if (count > 1) isBorder[i] = 1;
}

// Every border may be smoothed. Most may also move towards a groove; the
// documented cuts (the lumbar waistband, the calf cut) only lose their saw
// teeth and keep their place: there the walk ignores grooves and is pulled
// hard towards today's assignment.
const pairKey = (a, b) => [regionNames[a], regionNames[b]].sort().join('|');
const freeBorder = new Uint8Array(V0);
const heldBorder = new Uint8Array(V0);
for (let i = 0; i < V0; i++) {
  if (strayMask[i]) { freeBorder[i] = 1; continue; }
  if (!isBorder[i]) continue;
  const present = [];
  for (let k = 0; k < L; k++) if (vertexLabelArea[i * L + k] > 0) present.push(k);
  let free = false;
  for (let x = 0; x < present.length; x++) for (let y = x + 1; y < present.length; y++) {
    if (!HOLD.has(pairKey(present[x], present[y]))) free = true;
  }
  if (free) freeBorder[i] = 1; else heldBorder[i] = 1;
}

// Distance along the surface to the nearest border of each kind.
const freeDistance = dijkstra(freeBorder, opt.band);
const heldDistance = dijkstra(heldBorder, opt.band);
const inBand = new Uint8Array(V0);
const held = new Uint8Array(V0);
for (let i = 0; i < V0; i++) {
  if (frozenInside(i)) continue;          // the frozen region takes no part in any walk
  if (strayMask[i]) { inBand[i] = 1; continue; }
  if (freeDistance[i] <= opt.band) inBand[i] = 1;
  else if (heldDistance[i] <= opt.band) { inBand[i] = 1; held[i] = 1; }
}

// Region probabilities. Outside the band a vertex is certain of its region;
// inside it, a random walk whose steps across a groove are expensive.
const F = new Float64Array(V0 * L);
const prior = new Float64Array(V0 * L);
for (let i = 0; i < V0; i++) {
  let total = 0;
  for (let k = 0; k < L; k++) total += vertexLabelArea[i * L + k];
  for (let k = 0; k < L; k++) {
    const share = total > 0 ? vertexLabelArea[i * L + k] / total : 0;
    prior[i * L + k] = share;
    F[i * L + k] = inBand[i] ? share : (k === vertexLabel[i] ? 1 : 0);
  }
}

const bandVertices = [];
for (let i = 0; i < V0; i++) if (inBand[i]) bandVertices.push(i);
const weights = edgeWeights(true);
const plainWeights = edgeWeights(false);
for (let iteration = 0; iteration < 1500; iteration++) {
  let change = 0;
  for (const i of bandVertices) {
    const start = adjacency.offset[i], end = adjacency.offset[i + 1];
    const w = held[i] ? plainWeights : weights;
    const lambda = held[i] ? 4 : opt.prior;
    let wsum = lambda;
    for (let e = start; e < end; e++) wsum += w[e];
    for (let k = 0; k < L; k++) {
      let next = 0;
      if (!forbidden(i, k)) {
        let acc = lambda * prior[i * L + k];
        for (let e = start; e < end; e++) acc += w[e] * F[adjacency.list[e] * L + k];
        next = acc / wsum;
      }
      change = Math.max(change, Math.abs(next - F[i * L + k]));
      F[i * L + k] = next;
    }
  }
  if (change < 1e-6) break;
}

// Two light smoothing passes over the probabilities, so the isoline the cut
// follows is a curve and not a staircase.
for (let pass = 0; pass < 2; pass++) {
  const copy = F.slice();
  for (const i of bandVertices) {
    const start = adjacency.offset[i], end = adjacency.offset[i + 1];
    const deg = end - start;
    for (let k = 0; k < L; k++) {
      if (forbidden(i, k)) { F[i * L + k] = 0; continue; }
      let avg = 0;
      for (let e = start; e < end; e++) avg += copy[adjacency.list[e] * L + k];
      F[i * L + k] = 0.5 * copy[i * L + k] + 0.5 * (avg / deg);
    }
  }
}

const newLabel = new Int32Array(V0);
for (let i = 0; i < V0; i++) {
  if (!inBand[i]) { newLabel[i] = vertexLabel[i]; continue; }
  let best = -1, bestValue = 0;
  for (let k = 0; k < L; k++) if (F[i * L + k] > bestValue) { bestValue = F[i * L + k]; best = k; }
  newLabel[i] = best;
}
// A vertex the walk never reached takes its neighbours' region.
for (let pass = 0; pass < 50; pass++) {
  let open = 0;
  for (const i of bandVertices) {
    if (newLabel[i] >= 0) continue;
    const votes = new Float64Array(L);
    let any = false;
    for (let e = adjacency.offset[i]; e < adjacency.offset[i + 1]; e++) {
      const j = adjacency.list[e];
      if (newLabel[j] >= 0 && !forbidden(i, newLabel[j])) { votes[newLabel[j]] += 1; any = true; }
    }
    if (!any) { open++; continue; }
    let best = 0;
    for (let k = 1; k < L; k++) if (votes[k] > votes[best]) best = k;
    newLabel[i] = best;
    for (let k = 0; k < L; k++) F[i * L + k] = k === best ? 1 : 0;
  }
  if (!open) break;
}
// A single vertex unlike all its neighbours is noise, not anatomy.
for (let pass = 0; pass < 2; pass++) {
  for (const i of bandVertices) {
    const votes = new Float64Array(L);
    let same = false, voted = false;
    for (let e = adjacency.offset[i]; e < adjacency.offset[i + 1]; e++) {
      const j = adjacency.list[e];
      if (newLabel[j] < 0 || newLabel[j] === FROZEN) continue;
      votes[newLabel[j]] += 1;
      voted = true;
      if (newLabel[j] === newLabel[i]) same = true;
    }
    if (!same && voted) {
      let best = 0;
      for (let k = 1; k < L; k++) if (votes[k] > votes[best]) best = k;
      newLabel[i] = best;
      for (let k = 0; k < L; k++) F[i * L + k] = k === best ? 1 : 0;
    }
  }
}

/* ── cut the mesh along the isoline ────────────────────────────────────── */

const outPos = Array.from(P);
const outNrm = Array.from(N);
const shade0 = opt.shade ? bakeShade() : null;
const outShade = shade0 ? Array.from(shade0) : null;
const outTris = Array.from({ length: L }, () => []);
const crossing = new Map();
let created = 0, snapped = 0;

function vertexOnEdge(i, j) {
  const key = edgeKey(i, j);
  const hit = crossing.get(key);
  if (hit !== undefined) return hit;
  const a = newLabel[i], b = newLabel[j];
  const si = F[i * L + a] - F[i * L + b];
  const sj = F[j * L + a] - F[j * L + b];
  let t = si - sj !== 0 ? si / (si - sj) : 0.5;
  if (!(t > 0 && t < 1)) t = 0.5;
  let index;
  if (t < 0.03) { index = i; snapped++; }
  else if (t > 0.97) { index = j; snapped++; }
  else {
    index = outPos.length / 3;
    for (let c = 0; c < 3; c++) outPos.push(P[i * 3 + c] + t * (P[j * 3 + c] - P[i * 3 + c]));
    pushNormal(lerp3(N, i, j, t));
    if (outShade) outShade.push(shade0[i] + t * (shade0[j] - shade0[i]));
    created++;
  }
  crossing.set(key, index);
  return index;
}

function centreOf(i, j, k) {
  const index = outPos.length / 3;
  for (let c = 0; c < 3; c++) outPos.push((outPos[i * 3 + c] + outPos[j * 3 + c] + outPos[k * 3 + c]) / 3);
  const n = [0, 1, 2].map((c) => outNrm[i * 3 + c] + outNrm[j * 3 + c] + outNrm[k * 3 + c]);
  pushNormal(n);
  if (outShade) outShade.push((outShade[i] + outShade[j] + outShade[k]) / 3);
  created++;
  return index;
}

function emit(label, a, b, c) {
  if (a === b || b === c || a === c) return;
  if (areaOf(a, b, c) < 1e-12) return;
  outTris[label].push(a, b, c);
}

/**
 * A triangle of the frozen region keeps its region and its place. Only where
 * a border between two free regions ends on one of its edges — both ends on
 * the rim, in different regions, a free triangle on the other side — does
 * that triangle put a vertex on the edge; this one takes the same vertex, so
 * the surface stays closed. A crossing snapped onto an end of the edge adds
 * no vertex and needs no split.
 */
function emitFrozen(a, b, c) {
  const crossingOn = (i, j) => {
    if (!touchesFree[i] || !touchesFree[j] || newLabel[i] === newLabel[j] || !freeEdges.has(edgeKey(i, j))) return -1;
    const m = vertexOnEdge(i, j);
    return m === i || m === j ? -1 : m;
  };
  let v = [a, b, c];
  let m = [crossingOn(a, b), crossingOn(b, c), crossingOn(c, a)];
  const count = m.filter((x) => x >= 0).length;
  if (count === 0) { emit(FROZEN, a, b, c); return; }
  if (count === 3) {
    emit(FROZEN, a, m[0], m[2]); emit(FROZEN, m[0], b, m[1]); emit(FROZEN, m[1], c, m[2]); emit(FROZEN, m[0], m[1], m[2]);
    return;
  }
  // Turn the triangle, winding kept, until the first edge carries a crossing
  // and — with two of them — the last one does not.
  while (m[0] < 0 || (count === 2 && m[2] >= 0)) {
    v = [v[1], v[2], v[0]];
    m = [m[1], m[2], m[0]];
  }
  if (count === 1) {
    emit(FROZEN, v[0], m[0], v[2]); emit(FROZEN, m[0], v[1], v[2]);
  } else {
    emit(FROZEN, v[0], m[0], m[1]); emit(FROZEN, m[0], v[1], m[1]); emit(FROZEN, v[0], m[1], v[2]);
  }
}

for (let t = 0; t < M; t++) {
  const v = [T[t * 3], T[t * 3 + 1], T[t * 3 + 2]];
  if (TL[t] === FROZEN) { emitFrozen(v[0], v[1], v[2]); continue; }
  const l = v.map((x) => newLabel[x]);
  // Triangles away from every border keep their region.
  if (v.every((x) => !inBand[x])) { emit(TL[t], v[0], v[1], v[2]); continue; }
  if (l[0] === l[1] && l[1] === l[2]) { emit(l[0], v[0], v[1], v[2]); continue; }
  if (l[0] !== l[1] && l[1] !== l[2] && l[0] !== l[2]) {
    const [i, j, k] = v;
    const mij = vertexOnEdge(i, j), mjk = vertexOnEdge(j, k), mki = vertexOnEdge(k, i);
    const c = centreOf(i, j, k);
    emit(l[0], i, mij, c); emit(l[0], i, c, mki);
    emit(l[1], j, mjk, c); emit(l[1], j, c, mij);
    emit(l[2], k, mki, c); emit(l[2], k, c, mjk);
    continue;
  }
  // Exactly two regions: rotate so the odd vertex comes first, winding kept.
  let r = 0;
  if (l[1] !== l[0] && l[1] !== l[2]) r = 1;
  else if (l[2] !== l[0] && l[2] !== l[1]) r = 2;
  const i = v[r], j = v[(r + 1) % 3], k = v[(r + 2) % 3];
  const A = l[r], B = l[(r + 1) % 3];
  const mij = vertexOnEdge(i, j), mki = vertexOnEdge(k, i);
  emit(A, i, mij, mki);
  // The rest is the quad mij–j–k–mki. Where the crossing on i–j was snapped
  // onto i, three of its corners lie in one line (i, mki, k), and the diagonal
  // from mij would make a triangle without area. emit() drops such a triangle,
  // and with it the only use of mki on this side of the edge: the neighbour
  // across k–i is split there, this triangle is not, and the closed body has
  // an open edge. The diagonal from j has no such case.
  if (mij === i) {
    emit(B, j, k, mki);
    emit(B, j, mki, i);
  } else {
    emit(B, mij, j, k);
    emit(B, mij, k, mki);
  }
}

/* ── write ─────────────────────────────────────────────────────────────── */

const V1 = outPos.length / 3;
const glb = writeGlb();
writeFileSync(outPath, glb);

const before = new Array(L).fill(0);
for (let t = 0; t < M; t++) before[TL[t]]++;
console.log(`\n${inPath} → ${outPath}`);
console.log(`  vertices ${V0} → ${V1}  (+${created} on borders, ${snapped} border crossings snapped to a vertex)`);
console.log(`  band ${opt.band} m · groove ${opt.groove} · prior ${opt.prior} · held ${[...HOLD].join(', ') || '—'}`);
console.log(`  shade ${opt.shade ? `cavity ${opt.cavity} · ao ${opt.ao} · floor ${opt.floor} · white ${opt.white}` : 'off'}`);
const strayTotal = strays.patches.reduce((n, p) => n + p.triangles, 0);
console.log(`  stray patches handed back: ${strays.patches.length} (${strayTotal} triangles)`);
for (const patch of strays.patches.filter((p) => p.triangles >= 20)) {
  console.log(`    ${patch.label.padEnd(18)} ${String(patch.triangles).padStart(5)} triangles at y ${patch.low.toFixed(2)}–${patch.high.toFixed(2)} m`);
}
console.log(`  ${(raw.byteLength / 1024).toFixed(0)} KB → ${(glb.byteLength / 1024).toFixed(0)} KB`);
console.log('  region            triangles before → after');
regionNames.forEach((name, k) => {
  console.log(`    ${name.padEnd(18)} ${String(before[k]).padStart(6)} → ${String(outTris[k].length / 3).padStart(6)}`);
});
console.log('');

/* ── helpers: geometry ─────────────────────────────────────────────────── */

function triangleArea(a, b, c) {
  const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
  const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
  return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}

function areaOf(a, b, c) {
  const ux = outPos[b * 3] - outPos[a * 3], uy = outPos[b * 3 + 1] - outPos[a * 3 + 1], uz = outPos[b * 3 + 2] - outPos[a * 3 + 2];
  const vx = outPos[c * 3] - outPos[a * 3], vy = outPos[c * 3 + 1] - outPos[a * 3 + 1], vz = outPos[c * 3 + 2] - outPos[a * 3 + 2];
  return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}

function lerp3(arr, i, j, t) {
  return [0, 1, 2].map((c) => arr[i * 3 + c] + t * (arr[j * 3 + c] - arr[i * 3 + c]));
}

function pushNormal(n) {
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  outNrm.push(n[0] / len, n[1] / len, n[2] / len);
}

function buildAdjacency(count, tris) {
  const sets = Array.from({ length: count }, () => new Set());
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    sets[a].add(b); sets[a].add(c);
    sets[b].add(a); sets[b].add(c);
    sets[c].add(a); sets[c].add(b);
  }
  const offset = new Int32Array(count + 1);
  for (let i = 0; i < count; i++) offset[i + 1] = offset[i] + sets[i].size;
  const list = new Int32Array(offset[count]);
  for (let i = 0; i < count; i++) {
    let e = offset[i];
    for (const j of sets[i]) list[e++] = j;
  }
  return { offset, list };
}

function meanEdgeLength() {
  let sum = 0, n = 0;
  for (let i = 0; i < V0; i++) {
    for (let e = adjacency.offset[i]; e < adjacency.offset[i + 1]; e++) {
      const j = adjacency.list[e];
      if (j < i) continue;
      sum += Math.hypot(P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2]);
      n++;
    }
  }
  return sum / n;
}

/** Pieces of a region that are cut off from its main piece and much smaller. */
function findStrays() {
  const parent = Int32Array.from({ length: M }, (_, k) => k);
  const find = (x) => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };
  const firstOnEdge = new Map();
  // Triangles of two free regions that share an edge, in pairs.
  const acrossBorder = [];
  for (let t = 0; t < M; t++) {
    for (let c = 0; c < 3; c++) {
      const a = T[t * 3 + c], b = T[t * 3 + ((c + 1) % 3)];
      const key = a < b ? a * 1048576 + b : b * 1048576 + a;
      const other = firstOnEdge.get(key);
      if (other === undefined) firstOnEdge.set(key, t);
      else if (TL[other] === TL[t]) {
        const ra = find(other), rb = find(t);
        if (ra !== rb) parent[ra] = rb;
      } else if (TL[other] !== FROZEN && TL[t] !== FROZEN) acrossBorder.push(other, t);
    }
  }
  // A piece with the frozen region all round it lies beside no region it
  // could be handed to — the frozen one takes nothing (its border stays
  // where it is). Such a piece is left as it is, whatever its size.
  const besideFree = new Set();
  for (const t of acrossBorder) besideFree.add(find(t));
  const size = new Map();
  for (let t = 0; t < M; t++) { const r = find(t); size.set(r, (size.get(r) ?? 0) + 1); }
  const largest = new Array(L).fill(0);
  for (const [r, n] of size) largest[TL[r]] = Math.max(largest[TL[r]], n);
  const mask = new Uint8Array(M);
  const patches = new Map();
  for (let t = 0; t < M; t++) {
    const r = find(t);
    if (TL[t] === FROZEN) continue;
    if (FROZEN >= 0 && !besideFree.has(r)) continue;
    if (size.get(r) >= opt.stray * largest[TL[t]] || size.get(r) >= opt.straymax) continue;
    mask[t] = 1;
    const y = (P[T[t * 3] * 3 + 1] + P[T[t * 3 + 1] * 3 + 1] + P[T[t * 3 + 2] * 3 + 1]) / 3;
    const patch = patches.get(r) ?? { label: regionNames[TL[t]], triangles: 0, low: Infinity, high: -Infinity };
    patch.triangles++;
    patch.low = Math.min(patch.low, y);
    patch.high = Math.max(patch.high, y);
    patches.set(r, patch);
  }
  return { mask, patches: [...patches.values()].sort((a, b) => b.triangles - a.triangles) };
}

/** Signed relief along the normal against a Taubin-smoothed copy. */
function reliefAt(iterations) {
  let cur = Float64Array.from(P);
  const next = new Float64Array(V0 * 3);
  const step = (factor) => {
    for (let i = 0; i < V0; i++) {
      const start = adjacency.offset[i], end = adjacency.offset[i + 1];
      const deg = end - start;
      for (let c = 0; c < 3; c++) {
        let avg = 0;
        for (let e = start; e < end; e++) avg += cur[adjacency.list[e] * 3 + c];
        avg /= deg;
        next[i * 3 + c] = cur[i * 3 + c] + factor * (avg - cur[i * 3 + c]);
      }
    }
    cur.set(next);
  };
  for (let k = 0; k < iterations; k++) { step(0.5); step(-0.53); }
  const relief = new Float64Array(V0);
  for (let i = 0; i < V0; i++) {
    let d = 0;
    for (let c = 0; c < 3; c++) d += (P[i * 3 + c] - cur[i * 3 + c]) * N[i * 3 + c];
    relief[i] = d;
  }
  return relief;
}

/** Groove depth in [0, 1]: 0 on flat or convex surface, 1 at the deepest 3 %. */
function normalisedDepth(relief) {
  const depths = [];
  for (let i = 0; i < V0; i++) if (relief[i] < 0) depths.push(-relief[i]);
  depths.sort((a, b) => a - b);
  const ref = depths[Math.floor(depths.length * 0.97)] || 1;
  const out = new Float64Array(V0);
  for (let i = 0; i < V0; i++) out[i] = relief[i] < 0 ? Math.min(1, -relief[i] / ref) : 0;
  return out;
}

/** Edge weights for the random walk: with `grooves`, a step across a groove costs. */
function edgeWeights(grooves) {
  const w = new Float64Array(adjacency.list.length);
  for (let i = 0; i < V0; i++) {
    for (let e = adjacency.offset[i]; e < adjacency.offset[i + 1]; e++) {
      const j = adjacency.list[e];
      const g = Math.max(grooveFine[i], grooveFine[j]) * 0.75 + Math.max(grooveBroad[i], grooveBroad[j]) * 0.25;
      const len = Math.hypot(P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2]);
      w[e] = (grooves ? Math.exp(-opt.groove * g) : 1) * (meanEdge / Math.max(len, meanEdge * 0.25));
    }
  }
  return w;
}

/** Multi-source shortest paths along edges, stopped at `limit`. */
function dijkstra(sources, limit) {
  const dist = new Float64Array(V0).fill(Infinity);
  const heap = createMinHeap();
  for (let i = 0; i < V0; i++) if (sources[i]) { dist[i] = 0; heap.push(0, i); }
  while (heap.size) {
    const [d, i] = heap.pop();
    if (d > dist[i] || d > limit) continue;
    for (let e = adjacency.offset[i]; e < adjacency.offset[i + 1]; e++) {
      const j = adjacency.list[e];
      const nd = d + Math.hypot(P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2]);
      if (nd < dist[j]) { dist[j] = nd; heap.push(nd, j); }
    }
  }
  return dist;
}

/* ── shade: cavity + ambient occlusion ─────────────────────────────────── */

function bakeShade() {
  const ao = ambientOcclusion(64, 0.35);
  const out = new Float64Array(V0);
  // The borders are walked along grooves measured against the body's own
  // deepest ones. For the shade that measure paints the shallowest body as
  // dark as the deepest: with --shadedepth a groove is measured in metres.
  const depthOf = (relief, i) => (relief[i] < 0 ? Math.min(1, -relief[i] / opt.shadedepth) : 0);
  for (let i = 0; i < V0; i++) {
    const narrow = opt.shadedepth > 0 ? depthOf(fine, i) : grooveFine[i];
    const wide = opt.shadedepth > 0 ? depthOf(broad, i) : grooveBroad[i];
    const cavity = Math.min(1, opt.shadefine * narrow + (1 - opt.shadefine) * wide);
    out[i] = (1 - opt.cavity * Math.pow(cavity, 0.85)) * (1 - opt.ao * (1 - ao[i]));
  }
  // Most of the body keeps the full base colour; only grooves and occluded
  // places get darker. The body stays white, it just shows its relief.
  const sorted = Array.from(out).sort((a, b) => a - b);
  const reference = sorted[Math.floor(sorted.length * (1 - opt.white))] || 1;
  for (let i = 0; i < V0; i++) out[i] = Math.max(opt.floor, Math.min(1, out[i] / reference));
  // One light smoothing pass so the shade never shows the triangles; more
  // of them (--shadesmooth) widen a painted line into a soft form.
  let from = out;
  let smooth = out;
  for (let pass = 0; pass < opt.shadesmooth; pass++) {
    smooth = new Float64Array(V0);
    for (let i = 0; i < V0; i++) {
      let acc = from[i] * 2, n = 2;
      for (let e = adjacency.offset[i]; e < adjacency.offset[i + 1]; e++) { acc += from[adjacency.list[e]]; n++; }
      smooth[i] = acc / n;
    }
    from = smooth;
  }
  return smooth;
}

/** Cosine-weighted hemisphere visibility per vertex, rays up to `reach` m. */
function ambientOcclusion(samples, reach) {
  const bvh = buildBvh();
  const visible = new Float64Array(V0);
  // Fixed, stratified directions in the local frame; same for every vertex.
  const dirs = [];
  const side = Math.round(Math.sqrt(samples));
  for (let a = 0; a < side; a++) for (let b = 0; b < side; b++) {
    const u = (a + 0.5) / side, v = (b + 0.5) / side;
    const r = Math.sqrt(u), phi = 2 * Math.PI * v;
    dirs.push([r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(1 - u)]);
  }
  const o = [0, 0, 0], d = [0, 0, 0];
  for (let i = 0; i < V0; i++) {
    const n = [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]];
    const t1 = Math.abs(n[0]) < 0.9 ? cross(n, [1, 0, 0]) : cross(n, [0, 1, 0]);
    normalize(t1);
    const t2 = cross(n, t1);
    // Rotate the pattern per vertex so the bands do not line up.
    const spin = (i * 2.399963) % (2 * Math.PI);
    const cs = Math.cos(spin), sn = Math.sin(spin);
    let free = 0;
    for (const [lx0, ly0, lz] of dirs) {
      const lx = lx0 * cs - ly0 * sn, ly = lx0 * sn + ly0 * cs;
      for (let c = 0; c < 3; c++) {
        d[c] = t1[c] * lx + t2[c] * ly + n[c] * lz;
        o[c] = P[i * 3 + c] + n[c] * meanEdge * 0.05;
      }
      if (!bvh.hits(o, d, reach)) free++;
    }
    visible[i] = free / dirs.length;
  }
  return visible;
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  v[0] /= len; v[1] /= len; v[2] /= len;
  return v;
}

/** A small bounding volume hierarchy over the input triangles, any-hit queries only. */
function buildBvh() {
  const order = Int32Array.from({ length: M }, (_, k) => k);
  const centroid = new Float64Array(M * 3);
  const bmin = new Float64Array(M * 3), bmax = new Float64Array(M * 3);
  for (let t = 0; t < M; t++) {
    for (let c = 0; c < 3; c++) {
      const a = P[T[t * 3] * 3 + c], b = P[T[t * 3 + 1] * 3 + c], d = P[T[t * 3 + 2] * 3 + c];
      bmin[t * 3 + c] = Math.min(a, b, d);
      bmax[t * 3 + c] = Math.max(a, b, d);
      centroid[t * 3 + c] = (a + b + d) / 3;
    }
  }
  const nodes = []; // { min, max, left, right, start, count }
  const build = (start, end) => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let k = start; k < end; k++) {
      const t = order[k];
      for (let c = 0; c < 3; c++) {
        if (bmin[t * 3 + c] < min[c]) min[c] = bmin[t * 3 + c];
        if (bmax[t * 3 + c] > max[c]) max[c] = bmax[t * 3 + c];
      }
    }
    const id = nodes.length;
    nodes.push({ min, max, left: -1, right: -1, start, count: end - start });
    if (end - start <= 6) return id;
    const ext = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const axis = ext[0] > ext[1] ? (ext[0] > ext[2] ? 0 : 2) : (ext[1] > ext[2] ? 1 : 2);
    const slice = Array.from(order.subarray(start, end)).sort((a, b) => centroid[a * 3 + axis] - centroid[b * 3 + axis]);
    order.set(slice, start);
    const mid = (start + end) >> 1;
    nodes[id].left = build(start, mid);
    nodes[id].right = build(mid, end);
    nodes[id].count = 0;
    return id;
  };
  build(0, M);
  const stack = new Int32Array(128);
  return {
    hits(o, d, reach) {
      const inv = [1 / d[0], 1 / d[1], 1 / d[2]];
      let sp = 0;
      stack[sp++] = 0;
      while (sp) {
        const nd = nodes[stack[--sp]];
        let tmin = 0, tmax = reach;
        for (let c = 0; c < 3; c++) {
          let t0 = (nd.min[c] - o[c]) * inv[c], t1 = (nd.max[c] - o[c]) * inv[c];
          if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
          if (t0 > tmin) tmin = t0;
          if (t1 < tmax) tmax = t1;
          if (tmax < tmin) break;
        }
        if (tmax < tmin) continue;
        if (nd.count) {
          for (let k = nd.start; k < nd.start + nd.count; k++) if (rayHitsTriangle(order[k], o, d, reach)) return true;
        } else {
          stack[sp++] = nd.left;
          stack[sp++] = nd.right;
        }
      }
      return false;
    },
  };
}

function rayHitsTriangle(t, o, d, reach) {
  const a = T[t * 3] * 3, b = T[t * 3 + 1] * 3, c = T[t * 3 + 2] * 3;
  const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]];
  const e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
  const p = cross(d, e2);
  const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  if (Math.abs(det) < 1e-14) return false;
  const inv = 1 / det;
  const s = [o[0] - P[a], o[1] - P[a + 1], o[2] - P[a + 2]];
  const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv;
  if (u < 0 || u > 1) return false;
  const q = cross(s, e1);
  const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv;
  if (v < 0 || u + v > 1) return false;
  const dist = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
  return dist > 1e-6 && dist < reach;
}

/** Binary min-heap of (key, value); a function so it is hoisted. */
function createMinHeap() {
  const k = [], v = [];
  return {
    get size() { return k.length; },
    push(key, value) {
      let i = k.length;
      k.push(key); v.push(value);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (k[p] <= key) break;
        k[i] = k[p]; v[i] = v[p]; i = p;
      }
      k[i] = key; v[i] = value;
    },
    pop() {
      const top = [k[0], v[0]];
      const lastK = k.pop(), lastV = v.pop();
      if (k.length) {
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i, mk = lastK;
          if (l < k.length && k[l] < mk) { m = l; mk = k[l]; }
          if (r < k.length && k[r] < mk) { m = r; mk = k[r]; }
          if (m === i) break;
          k[i] = k[m]; v[i] = v[m]; i = m;
        }
        k[i] = lastK; v[i] = lastV;
      }
      return top;
    },
  };
}

/* ── helpers: GLB ──────────────────────────────────────────────────────── */

function parseGlb(buffer) {
  const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) die('not a GLB');
  let off = 12, j = null, b = null;
  while (off < buffer.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    const chunk = buffer.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) j = JSON.parse(new TextDecoder().decode(chunk));
    else if (type === 0x004e4942) b = chunk;
    off += 8 + len;
  }
  return { json: j, bin: b };
}

function readAccessor(index) {
  const COMP = { 5120: [1, 'getInt8'], 5121: [1, 'getUint8'], 5122: [2, 'getInt16'], 5123: [2, 'getUint16'], 5125: [4, 'getUint32'], 5126: [4, 'getFloat32'] };
  const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const a = json.accessors[index];
  const view = json.bufferViews[a.bufferView];
  const [size, getter] = COMP[a.componentType];
  const n = NCOMP[a.type];
  const stride = view.byteStride || size * n;
  const base = (view.byteOffset || 0) + (a.byteOffset || 0);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const out = new Float64Array(a.count * n);
  for (let i = 0; i < a.count; i++) {
    for (let c = 0; c < n; c++) {
      let v = dv[getter](base + i * stride + c * size, true);
      if (a.normalized) {
        if (a.componentType === 5120) v = Math.max(v / 127, -1);
        else if (a.componentType === 5121) v /= 255;
        else if (a.componentType === 5122) v = Math.max(v / 32767, -1);
        else if (a.componentType === 5123) v /= 65535;
      }
      out[i * n + c] = v;
    }
  }
  return { data: out, count: a.count };
}

function writeGlb() {
  // Positions: uint16 against a uniform scale, the frame of the input file.
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < V1; i++) for (let c = 0; c < 3; c++) {
    const v = outPos[i * 3 + c];
    if (v < min[c]) min[c] = v;
    if (v > max[c]) max[c] = v;
  }
  const scale = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 65535;
  const views = [];
  const accessors = [];
  const chunks = [];
  let byteLength = 0;
  const addView = (bytes, extra) => {
    const pad = (4 - (byteLength % 4)) % 4;
    if (pad) { chunks.push(new Uint8Array(pad)); byteLength += pad; }
    views.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.byteLength, ...extra });
    chunks.push(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    byteLength += bytes.byteLength;
    return views.length - 1;
  };

  const qpos = new Uint16Array(V1 * 4);
  const qmin = [65535, 65535, 65535], qmax = [0, 0, 0];
  for (let i = 0; i < V1; i++) for (let c = 0; c < 3; c++) {
    const q = Math.max(0, Math.min(65535, Math.round((outPos[i * 3 + c] - min[c]) / scale)));
    qpos[i * 4 + c] = q;
    if (q < qmin[c]) qmin[c] = q;
    if (q > qmax[c]) qmax[c] = q;
  }
  accessors.push({ bufferView: addView(qpos, { byteStride: 8, target: 34962 }), componentType: 5123, count: V1, type: 'VEC3', min: qmin, max: qmax });

  const qnrm = new Int8Array(V1 * 4);
  for (let i = 0; i < V1; i++) for (let c = 0; c < 3; c++) qnrm[i * 4 + c] = Math.round(Math.max(-1, Math.min(1, outNrm[i * 3 + c])) * 127);
  accessors.push({ bufferView: addView(qnrm, { byteStride: 4, target: 34962 }), componentType: 5120, normalized: true, count: V1, type: 'VEC3' });

  let colorAccessor;
  if (outShade) {
    const col = new Uint8Array(V1 * 4);
    for (let i = 0; i < V1; i++) {
      const g = Math.round(Math.max(0, Math.min(1, outShade[i])) * 255);
      col[i * 4] = g; col[i * 4 + 1] = g; col[i * 4 + 2] = g; col[i * 4 + 3] = 255;
    }
    colorAccessor = accessors.length;
    accessors.push({ bufferView: addView(col, { byteStride: 4, target: 34962 }), componentType: 5121, normalized: true, count: V1, type: 'VEC4' });
  }

  const wide = V1 > 65535;
  const primitives = prims.map((p, label) => {
    const idx = wide ? Uint32Array.from(outTris[label]) : Uint16Array.from(outTris[label]);
    const accessor = accessors.length;
    accessors.push({ bufferView: addView(idx, { target: 34963 }), componentType: wide ? 5125 : 5123, count: idx.length, type: 'SCALAR' });
    const attributes = { POSITION: 0, NORMAL: 1 };
    if (colorAccessor !== undefined) attributes.COLOR_0 = colorAccessor;
    return { attributes, indices: accessor, material: p.material };
  });

  const sourceHash = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  const out = {
    asset: {
      version: '2.0',
      generator: 'Momentum body pipeline v3 (tools/body/refine-body.mjs: groove borders + baked shade)',
      copyright: json.asset.copyright,
      extras: {
        refinedFrom: { sha256: sourceHash, generator: json.asset.generator },
        options: Object.fromEntries(Object.entries(opt).filter(([key, value]) => !(key in LATER) || value !== LATER[key])),
      },
    },
    extensionsUsed: ['KHR_mesh_quantization'],
    extensionsRequired: ['KHR_mesh_quantization'],
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: node.name ?? 'MomentumBody', mesh: 0, scale: [scale, scale, scale], translation: min }],
    meshes: [{ name: mesh0.name ?? 'MomentumBody', primitives }],
    materials: json.materials,
    accessors,
    bufferViews: views,
    buffers: [{ byteLength }],
  };

  const binPad = (4 - (byteLength % 4)) % 4;
  const binChunk = new Uint8Array(byteLength + binPad);
  let at = 0;
  for (const c of chunks) { binChunk.set(c, at); at += c.byteLength; }
  const text = new TextEncoder().encode(JSON.stringify(out));
  const jsonPad = (4 - (text.byteLength % 4)) % 4;
  const jsonChunk = new Uint8Array(text.byteLength + jsonPad).fill(0x20);
  jsonChunk.set(text);
  const total = 12 + 8 + jsonChunk.byteLength + 8 + binChunk.byteLength;
  const outBuf = new Uint8Array(total);
  const dv = new DataView(outBuf.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jsonChunk.byteLength, true); dv.setUint32(16, 0x4e4f534a, true);
  outBuf.set(jsonChunk, 20);
  const binStart = 20 + jsonChunk.byteLength;
  dv.setUint32(binStart, binChunk.byteLength, true); dv.setUint32(binStart + 4, 0x004e4942, true);
  outBuf.set(binChunk, binStart + 8);
  return outBuf;
}
