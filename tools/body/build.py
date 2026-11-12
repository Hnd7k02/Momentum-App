#!/usr/bin/env python3
"""Build one Momentum body from the MakeHuman data, with one command.

    python3 tools/body/build.py <candidate>… [--out DIR] [--data DIR] [--record] [--relabel] [--keep]
    python3 tools/body/build.py --all

A candidate is an entry of candidates.json: the macro and local targets, the
pose, the head, the relief and the options of refine-body.mjs. The result is
`<out>/<candidate>.glb` — the same bytes every time for the same input — and
its sha256 on the last line.

The sha256 of every candidate is kept in digests.json. A build that gives
other bytes than the ones recorded says so and ends with exit code 1;
`--record` writes the new digest instead, which is how a deliberate change is
made. `--relabel` makes regions.json anew from the rules (regionrules.py), on
the candidate named; without it the stored regions are read and the rules
never run. `--keep` leaves the unrefined GLB beside the result.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

import bodylib as B
import regionrules

HERE = Path(__file__).resolve().parent
REGIONS_FILE = HERE / 'regions.json'
DIGESTS_FILE = HERE / 'digests.json'

#: refine-body.mjs hands a piece of a region back to its neighbours when it is
#: cut off from the region's main piece and small. That is right for a stray
#: speck at a border and wrong for anatomy: in the proof it took the front of
#: the upper trapezius, 688 triangles, away from the back. The regions are
#: stored so that this cannot happen (regionrules.py, the neck); a build in
#: which it happens all the same stops here instead of shipping the loss.
STRAY_LIMIT = 100


def load_regions():
    stored = json.loads(REGIONS_FILE.read_text())
    assert stored['regions'] == B.REGIONS, 'regions.json was made for another order of regions'
    return np.array(stored['vertex'], dtype=np.int64)


def save_regions(labels, made_on):
    text = json.dumps({
        'about': 'The muscle region of every vertex of the MakeHuman body (13,380 vertices, fixed topology), '
                 'as an index into `regions`. Made by tools/body/build.py --relabel from regionrules.py; '
                 'read by every build.',
        'made_on': made_on,
        'regions': B.REGIONS,
        'vertex': [int(x) for x in labels],
    }, separators=(',', ':'))
    REGIONS_FILE.write_text(text + '\n')


def build(name, spec, data, out_dir, relabel=False, keep=False, quiet=False):
    say = (lambda *a: None) if quiet else print
    base = B.Base(data)
    macro, local = spec.get('macro', {}), spec.get('local', {})
    V, applied = B.shape(base, macro, local)

    # The head, before anything moves: 'A' is natural with a calm eyeball,
    # 'B' a mannequin's, its features smoothed away; 'raw' is MakeHuman's own.
    head = spec.get('head', 'A')
    if head in ('A', 'B'):
        V = B.fill_eyes(base, V)
    if head == 'B':
        V = B.smooth_face(base, V, **spec.get('head_smoothing', {}))

    relief = spec.get('relief', {})
    if relief.get('muscle_detail'):
        # MakeHuman's own muscle lines, in multiples — and no deeper than the
        # guide allows a groove to be. Unbounded, the few sharpest lines of the
        # data (above the buttocks, along the hip) become creases of two
        # centimetres while the rest has hardly begun to show.
        moved = relief['muscle_detail'] * B.muscle_detail(base, macro, local, relief.get('muscle_detail_scale', 10))
        limit = relief.get('limit_mm', 0) / 100.0            # the base mesh counts in decimetres
        if limit:
            size = np.linalg.norm(moved, axis=1)
            moved = moved * (limit * np.tanh(size / limit) / np.maximum(size, 1e-12))[:, None]
        V = V + moved

    posed = B.pose(base, V, **spec.get('pose', {}))
    Vp = posed.skin()
    body = B.body_only(base, Vp, height=spec.get('height', 1.78))
    bones, dominant = posed.dominant_bones()

    cuts = B.cut_planes(body.joints, spec.get('height', 1.78), spec.get('cuts'))
    if relabel:
        labels = regionrules.label_by_rules(body.P, body.joints, dominant[body.origin], bones, body.P[:, 1].max(), cuts)
        save_regions(labels, name)
        say(f'regions.json written from the rules, on {name}')
    labels = load_regions()
    quad_labels = B.face_labels(labels, body.quads)

    # The muscle regions are subdivided — and two rings of the inert zone
    # beside them. A border that runs along the seam between fine and coarse
    # mesh is cut in saw teeth, one tooth for each coarse quad; two rings on,
    # refine-body.mjs draws it through an even mesh.
    refine_mask = quad_labels != B.NONE
    for _ in range(spec.get('seam_rings', 2)):
        touched = np.zeros(len(body.P), dtype=bool)
        touched[body.quads[refine_mask].ravel()] = True
        refine_mask = refine_mask | touched[body.quads].any(axis=1)
    P, tris, tri_labels, parents = B.subdivide(body.P, body.quads, quad_labels, refine_mask)
    n_old = len(body.P)
    if spec.get('inert_share', 1.0) < 1.0:
        # Hands and feet are thinned; the head is not. A face with half its
        # triangles shows them as flat panels, close up and in the silhouette.
        before = int((tri_labels == B.NONE).sum())
        # Nor are the subdivided rings beside the muscles: they are known by
        # a vertex the subdivision made.
        HEAD = len(B.REGIONS)
        centre_y = P[tris].mean(axis=1)[:, 1]
        part = tri_labels.copy()
        part[(tri_labels == B.NONE) & (centre_y > 0.78 * P[:, 1].max())] = HEAD
        part[(tri_labels == B.NONE) & (tris >= n_old).any(axis=1)] = HEAD
        P, tris, part, kept = B.decimate(P, tris, part, B.NONE, spec['inert_share'])
        tri_labels = np.where(part == HEAD, B.NONE, part)
        say(f'inert zone: {before} → {int((tri_labels == B.NONE).sum())} triangles')
    # The straight cuts: level at the neck, across the limb at wrist and
    # ankle. Each becomes a loop of edges exactly on its plane, and
    # refine-body.mjs is told to leave the inert zone's borders where they are.
    for cut_name in sorted(cuts):
        point, normal, radius = cuts[cut_name]
        P, tris, tri_labels = B.cut(P, tris, tri_labels, point, normal, radius, B.NONE)
    inert_pieces = B.pieces(tris, tri_labels, B.NONE)
    if len(inert_pieces) != 5:
        sizes = ', '.join(str(len(piece)) for piece in inert_pieces)
        raise SystemExit(f'{name}: the inert zone is {len(inert_pieces)} pieces ({sizes} triangles), not five — '
                         f'head, two hands, two feet. regions.json and the cuts disagree.')
    muscle = np.zeros(len(P), dtype=bool)
    muscle[np.unique(tris[tri_labels != B.NONE])] = True
    inert = np.zeros(len(P), dtype=bool)
    inert[np.unique(tris[tri_labels == B.NONE])] = True
    free = muscle & ~inert          # not on the seam to the inert zone

    if relief.get('unsharp'):
        P = B.unsharp(P, tris, free, relief['unsharp'], relief.get('unsharp_scale', 6), relief.get('unsharp_limit', 0.004))

    out_dir.mkdir(parents=True, exist_ok=True)
    raw = out_dir / f'{name}.regions.glb'
    counts = B.write_glb(raw, P, tris, tri_labels, f'Momentum body pipeline (tools/body/build.py, candidate {name})')
    final = out_dir / f'{name}.glb'
    options = []
    for key, value in sorted(spec.get('refine', {}).items()):
        options += [f'--{key}', str(value)]
    result = subprocess.run(['node', str(HERE / 'refine-body.mjs'), str(raw), str(final), *options],
                            capture_output=True, text=True)
    if result.returncode != 0:
        sys.stderr.write(result.stdout + result.stderr)
        raise SystemExit(result.returncode)
    if not quiet:
        sys.stdout.write(result.stdout)
    if not keep:
        raw.unlink()
    limit = spec.get('stray_limit', STRAY_LIMIT)
    lost = [(label, int(count)) for label, count in
            re.findall(r'^\s+(\w+)\s+(\d+) triangles at y', result.stdout, flags=re.M) if int(count) >= limit]
    if lost:
        final.unlink()
        pieces = ', '.join(f'{count} triangles of {label}' for label, count in lost)
        raise SystemExit(f'{name}: refine-body.mjs handed back {pieces}. A piece that large is anatomy, not a '
                         f'stray: connect it in regions.json (regionrules.py) before building.')
    # The skeleton, beside the file: measure-body.mjs prints it as a second
    # opinion next to what it reads from the surface.
    (out_dir / f'{name}.landmarks.json').write_text(json.dumps({
        'about': 'Joint centres of the posed MakeHuman skeleton, in the metres of the GLB beside this file.',
        'joints': {key: [round(float(x), 5) for x in value] for key, value in sorted(body.joints.items())},
        'pose': spec.get('pose', {}),
    }, indent=1) + '\n')
    digest = hashlib.sha256(final.read_bytes()).hexdigest()
    say(f'{name}: {len(P)} vertices and {len(tris)} triangles before the borders are cut; pose {posed.info}')
    say(f'{final}  {final.stat().st_size} bytes  sha256 {digest}')
    return final, digest


def load_digests():
    return json.loads(DIGESTS_FILE.read_text()) if DIGESTS_FILE.exists() else {}


def resolve(candidates, name):
    """A candidate with everything it takes over from the one it is 'like'."""
    if name not in candidates or name == '_about':
        known = ', '.join(key for key in candidates if not key.startswith('_'))
        raise SystemExit(f'unknown candidate {name}; known: {known}')
    spec = candidates[name]
    if 'like' not in spec:
        return json.loads(json.dumps(spec))
    merged = resolve(candidates, spec['like'])
    for key, value in spec.items():
        if key == 'like':
            continue
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = {**merged[key], **value}
        else:
            merged[key] = value
    return merged


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('candidate', nargs='*')
    parser.add_argument('--all', action='store_true', help='every candidate of candidates.json')
    parser.add_argument('--out', default=str(HERE / 'out'))
    parser.add_argument('--data', default=str(B.DATA))
    parser.add_argument('--candidates', default=str(HERE / 'candidates.json'))
    parser.add_argument('--record', action='store_true', help='write the digest to digests.json')
    parser.add_argument('--relabel', action='store_true')
    parser.add_argument('--keep', action='store_true')
    args = parser.parse_args()
    candidates = json.loads(Path(args.candidates).read_text())
    names = [key for key in candidates if not key.startswith('_')] if args.all else args.candidate
    if not names:
        parser.error('name a candidate, or pass --all')
    if args.relabel and len(names) != 1:
        parser.error('--relabel takes the one candidate the regions are made on')
    digests = load_digests()
    differs = []
    for name in names:
        spec = resolve(candidates, name)
        final, digest = build(name, spec, Path(args.data), Path(args.out), args.relabel, args.keep)
        entry = {'bytes': final.stat().st_size, 'sha256': digest}
        if args.record:
            digests[name] = entry
        elif name not in digests:
            print(f'{name}: no digest recorded yet (--record writes it)')
        elif digests[name] == entry:
            print(f'{name}: the same bytes as recorded')
        else:
            differs.append(name)
            print(f'{name}: DIFFERS from the recorded sha256 {digests[name]["sha256"]}')
    if args.record:
        kept = {name: digests[name] for name in candidates if name in digests}
        DIGESTS_FILE.write_text(json.dumps(kept, indent=2) + '\n')
    if differs:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
