#!/usr/bin/env python3
"""Build one Momentum body from the MakeHuman data, with one command.

    python3 tools/body/build.py <candidate> [--out DIR] [--data DIR] [--relabel] [--keep]

A candidate is an entry of candidates.json: the macro and local targets, the
pose, the head, the relief and the options of refine-body.mjs. The result is
`<out>/<candidate>.glb` — the same bytes every time for the same input — and
its sha256 on the last line.

`--relabel` makes regions.json anew from the rules (regionrules.py), on the
candidate named; without it the stored regions are read and the rules never
run. `--keep` leaves the unrefined GLB beside the result.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

import bodylib as B
import regionrules

HERE = Path(__file__).resolve().parent
REGIONS_FILE = HERE / 'regions.json'


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

    relief = spec.get('relief', {})
    if relief.get('muscle_detail'):
        V = V + relief['muscle_detail'] * B.muscle_detail(base, macro, local, relief.get('muscle_detail_scale', 10))

    posed = B.pose(base, V, **spec.get('pose', {}))
    Vp = posed.skin()
    body = B.body_only(base, Vp, height=spec.get('height', 1.78))
    bones, dominant = posed.dominant_bones()

    if relabel:
        labels = regionrules.label_by_rules(body.P, body.joints, dominant[body.origin], bones, body.P[:, 1].max())
        save_regions(labels, name)
        say(f'regions.json written from the rules, on {name}')
    labels = load_regions()
    quad_labels = B.face_labels(labels, body.quads)

    refine_mask = quad_labels != B.NONE
    P, tris, tri_labels, parents = B.subdivide(body.P, body.quads, quad_labels, refine_mask)
    n_old = len(body.P)
    vertex_region = np.concatenate([labels, np.full(len(P) - n_old, -1)])
    for i in range(n_old, len(P)):
        ps = labels[list(parents[i])]
        vertex_region[i] = np.bincount(ps).argmax()
    if spec.get('inert_share', 1.0) < 1.0:
        before = int((tri_labels == B.NONE).sum())
        P, tris, tri_labels, kept = B.decimate(P, tris, tri_labels, B.NONE, spec['inert_share'])
        vertex_region = vertex_region[kept]
        say(f'inert zone: {before} → {int((tri_labels == B.NONE).sum())} triangles')
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
    digest = hashlib.sha256(final.read_bytes()).hexdigest()
    say(f'{name}: {len(P)} vertices and {len(tris)} triangles before the borders are cut; pose {posed.info}')
    say(f'{final}  {final.stat().st_size} bytes  sha256 {digest}')
    return final, digest


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('candidate')
    parser.add_argument('--out', default=str(HERE / 'out'))
    parser.add_argument('--data', default=str(B.DATA))
    parser.add_argument('--candidates', default=str(HERE / 'candidates.json'))
    parser.add_argument('--relabel', action='store_true')
    parser.add_argument('--keep', action='store_true')
    args = parser.parse_args()
    candidates = json.loads(Path(args.candidates).read_text())
    if args.candidate not in candidates:
        raise SystemExit(f'unknown candidate {args.candidate}; known: {", ".join(k for k in candidates if not k.startswith("_"))}')
    spec = candidates[args.candidate]
    while 'like' in spec:                      # a candidate may be another one with changes
        parent = candidates[spec['like']]
        merged = json.loads(json.dumps(parent))
        for key, value in spec.items():
            if key == 'like':
                continue
            if isinstance(value, dict) and isinstance(merged.get(key), dict):
                merged[key] = {**merged[key], **value}
            else:
                merged[key] = value
        if 'like' not in parent:
            merged.pop('like', None)
        spec = merged
    build(args.candidate, spec, Path(args.data), Path(args.out), args.relabel, args.keep)


if __name__ == '__main__':
    main()
