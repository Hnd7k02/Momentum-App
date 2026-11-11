# The body pipeline

Builds the Momentum body model from the MakeHuman base mesh, by script only:
no Blender, no hand work, the same bytes every time. Decision D165; the guide
it follows is `koerper-anleitung-7a.md` on the owner's reference page.

**Status: before the gate.** Nothing here is in the app yet. The app still
loads `public/models/momentum-body.glb`, the model of D156; the candidates
built here are shown to the owner first (block 7A, step 6).

## One command

```sh
python3 tools/body/build.py detail2        # → tools/body/out/detail2.glb, its sha256 on the last line
python3 tools/body/build.py --all          # every candidate of candidates.json
```

Needs Python 3 with numpy, and Node. Built and recorded with Python 3.13.18,
numpy 2.5.3 and Node 22.23.

A build compares its result with the digest recorded in `digests.json` and
ends with exit code 1 where the bytes differ. A deliberate change is recorded
with `--record`.

## What is here

| | |
|---|---|
| `build.py` | the command: shape → relief → pose → regions → subdivide → thin the inert zone → GLB → `refine-body.mjs` |
| `bodylib.py` | everything the build does, as functions; numpy and the standard library only |
| `candidates.json` | the bodies that can be built: targets, pose, relief, options. An entry may be `like` another |
| `regions.json` | the muscle region of each of the 13,380 vertices of the MakeHuman body. Stored, not derived: every build reads it |
| `regionrules.py` | the rules `regions.json` was made from. They run only with `build.py <candidate> --relabel` |
| `refine-body.mjs` | borders along the grooves, stray patches handed back, the baked shade, quantization |
| `refine-body.test.mjs` | its tests; they run with `npm run test` (vitest project `tools`) |
| `digests.json` | size and sha256 of every candidate, written by `build.py --record` |
| `makehuman/` | the MakeHuman files the candidates read, with their licence and a manifest |
| `vendor.py` | copies those files from the unpacked wheel, and checks the copies |
| `measure-body.mjs`, `MEASURES.md` | the body measured at landmarks; the targets, today's body and the proof |
| `preview.html`, `render.mjs` | stills of any GLB through the Vite dev server, for comparing candidates |
| `out/` | build results; ignored by git |

## Where the data comes from, and its licence

The base mesh, the default rig with its weights, the vertex groups and the
targets come from the PyPI wheel **`anny` 0.6.2**
(`anny-0.6.2-py3-none-any.whl`, sha256
`bad70bdc2be0dfa9880d60129c3a1339678f08f493184f637dc2825c3e27b8d2`), and from
its folder `anny/data/mpfb2/` only. None of the wheel's code is used or kept.

That folder carries its own `LICENSE.md` (sha256
`f6089cba…956d2c`, copied to `makehuman/LICENSE.md`). It was read in full on
11 November 2026: it is the complete text of **CC0 1.0 Universal**, the public
domain dedication, and nothing else. No attribution is required; MakeHuman is
named in the model's `asset.copyright` all the same.

The files are kept in the repository (18 files, 4.3 MB) rather than fetched
from the wheel at build time, for three reasons: the build then runs offline
and gives the same bytes when the package is no longer on PyPI; the wheel is
sixty megabytes of which the code must never come near this repository; and
the licence text lies beside the data it covers. `makehuman/MANIFEST.json`
holds each file's sha256, so every copy can be traced to the wheel.

```sh
python3 tools/body/vendor.py --check                       # the copies against the manifest
python3 tools/body/vendor.py <unpacked>/anny/data/mpfb2 --wheel <the .whl>
```

The second form is needed only when a candidate reads a target that is not
here yet: a build that misses a file says so. It shapes every candidate
against the full folder and copies exactly the files that were opened.

## The same bytes every time

Everything between the input files and the GLB is deterministic: no random
start, no threads, no timestamp in the file. `digests.json` records the
result, and two builds in a row were compared byte for byte.

| candidate | bytes | sha256 |
|---|---|---|
| `detail2` | 608,656 | `fb794d96b9f1861d0e4c5af773239769005b0a39b089ea6ef5f493e113d1b50b` |

The other candidates are listed in `digests.json`. The digests hold for the
versions named above: another numpy may add in another order, and the last
bit of a position can then land on the other side of a rounding.

## The contract with the app

Unchanged from today's model, and checked by `tools/validate-body-glb.mjs`
once a candidate is chosen: one mesh; eleven primitives, one per region; the
material name is the muscle-group id (`none` for head, neck, hands and feet);
one shared position and normal list; `KHR_mesh_quantization`.

The baked shade is a vertex colour (`COLOR_0`). The app shows it only with one
line in the two places that make the body's materials —
`material.vertexColors = mesh.geometry.hasAttribute('color')` — which belongs
to the step after the gate.

## The regions

A region belongs to a vertex of MakeHuman's fixed topology, so one stored
labelling serves every body shape. `regions.json` is that labelling. It was
made by `regionrules.py` on the posed candidate `detail2` — planes and
distances at the joints, the dominant bone of each vertex — and is read, never
recomputed, by an ordinary build.

Two things are secured there, because the proof lost them:

- **The upper trapezius belongs to the back.** In the proof, the slope
  between neck and shoulder was a piece of `back` cut off from the rest, and
  `refine-body.mjs` handed its 688 triangles to the neighbours as a stray
  patch. The neck rule now keeps it connected, and `build.py` stops when
  `refine-body.mjs` hands back any piece of 100 triangles or more.
- **Hands and feet are inert** from the wrist and the ankle on.

## What changed against the scripts of the reference page

- `build_mh.py` and `label_mh.py` were proof scripts. Their steps live in
  `bodylib.py` and `regionrules.py` now, behind `build.py`.
- `refine-body.mjs` is the script of the reference page with **one
  correction**. Where a border crossing was snapped onto a vertex, the
  remaining quad was split along a diagonal that made a triangle without
  area; that triangle was dropped, and the crossing on the other edge was
  left as a T-junction. The body was no longer closed: 30 open edges in the
  proof, 84 in the first candidate. The quad is now split from the other
  corner, and `refine-body.test.mjs` holds the body closed.
- `bpy` (Blender as a Python module, which the guide names) installs from
  PyPI here but does not import: the container lacks `libtbb.so.12`. Nothing
  in the pipeline needs it. Subdivision, skinning, the thinning of the inert
  zone and the relief are written out in numpy.

## Stills

```sh
npx vite --port 5173 &
node tools/body/render.mjs tools/body/out/detail2.glb /tmp/detail2.png \
  '{"views":[{"yaw":0},{"yaw":90},{"yaw":180},{"yaw":35}],"bg":"#22222c","w":330,"h":640}'
```

`preview.html` is a plain page with the lights of `BodyViewer.tsx`; it is a
tool for comparing files and no part of the app.
