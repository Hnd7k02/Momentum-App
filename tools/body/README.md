# The body pipeline

Builds the Momentum body model from the MakeHuman base mesh, by script only:
no Blender, no hand work, the same bytes every time. Decision D165; the guide
it follows is `koerper-anleitung-7a.md` on the owner's reference page.

**Status: in the app.** The owner chose the athletic body type with head A at
the gate (D165), with three corrections; `momentum-body` is that body, and
`public/models/momentum-body.glb` is its build, byte for byte.

## One command

```sh
python3 tools/body/build.py momentum-body --install   # builds, checks the digest, copies to public/models/
python3 tools/body/build.py momentum-body             # builds only → tools/body/out/momentum-body.glb
node tools/validate-body-glb.mjs public/models/momentum-body.glb
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

| body | bytes | sha256 |
|---|---|---|
| `momentum-body` | 704,100 | `924a501bc5fed71dd229a00e619e1d5942ebad962432aa0c25294f6da48a3318` |

`digests.json` holds the same figures for the build to check, and `public/models/momentum-body.glb` has this sha256. The digests hold for the
versions named above: another numpy may add in another order, and the last
bit of a position can then land on the other side of a rounding.

## The contract with the app

Unchanged from the model of D156, and checked by `tools/validate-body-glb.mjs`
on every build: one mesh; eleven primitives, one per region; the material name
is the muscle-group id (`none` for head, neck, hands and feet); one shared
position and normal list; `KHR_mesh_quantization`. The validator also holds
where each region lies, the five straight cuts of the inert zone, the check
points of the regions (`checkpoints.mjs`, contract §14), the measures whose
targets are confirmed, the size and the licence notice;
`tools/validate-body-glb.test.mjs` holds the validator.

The baked shade is a vertex colour (`COLOR_0`). The app's two body materials
read it where a model brings one —
`material.vertexColors = mesh.geometry.hasAttribute('color')`, in
`BodyModel.tsx` and `useMuscleHighlight.ts` — and only then: today's model has
no such attribute and is drawn as before.

## The regions

A region belongs to a vertex of MakeHuman's fixed topology, so one stored
labelling serves every body shape. `regions.json` is that labelling. It was
made by `regionrules.py` on the posed candidate `athletisch-a` — planes and
distances at the joints, the dominant bone of each vertex — and is read, never
recomputed, by an ordinary build.

Two things are secured there, because the proof lost them:

- **The upper trapezius belongs to the back.** In the proof, the slope
  between neck and shoulder was a piece of `back` cut off from the rest, and
  `refine-body.mjs` handed its 688 triangles to the neighbours as a stray
  patch. The neck rule now keeps it connected, and `build.py` stops when
  `refine-body.mjs` hands back any piece of 100 triangles or more.
- **Hands and feet are inert** from the wrist and the ankle on. They are
  small beside an unthinned head, and `refine-body.mjs` would hand them to
  the forearms and calves as strays of `none`; the build passes
  `--straymax 150`, above which no piece is a stray.

## The straight cuts

The owner's correction at the gate: "at the base of the neck a calm, nearly
level cut without a V and without waves; at wrist and ankle a straight cut."
A border that `refine-body.mjs` draws follows the grooves and is smoothed; it
is never straight. These five are therefore cut by the build itself
(`bodylib.cut_planes`, `bodylib.cut`):

| cut | where | which way |
|---|---|---|
| neck | 6 mm below the neck joint — the lowest height at which the neck is still a column | tilted 5°, the front lower |
| wrist, each side | at the wrist joint | across the forearm |
| ankle, each side | 35 mm above the ankle joint, so that the ankle bones go with the foot | across the shin |

Every triangle a plane crosses is split, so the plane's line on the body is a
loop of edges; no vertex moves. Beyond the plane everything is inert, before
it nothing is. `regionrules.py` labels the vertices by the same planes, and
`refine-body.mjs --freeze none` leaves these borders where they are. The
build stops if the inert zone is not exactly five pieces.

Below the neck's cut, the pit of the throat between the two collarbones goes
with the chest, and the trapezius begins at the side of the neck. The border
of chest and trapezius runs along the collarbone and is held (`--hold`), so it
is smoothed and not moved into a groove.

## The body

Four pairs of body type and head were shown at the gate — `schlank-a`,
`athletisch-a`, `athletisch-b`, `kraeftig-a`; their pictures are in
`docs/design/wp3/7a-gate/`. The owner chose `athletisch-a`: muscle 0.9,
weight 0.35, head A. That is `momentum-body`; the other three are no longer
built, and git has them.

- **Head A** is MakeHuman's head with the eye sockets closed: the pocket
  behind each pair of lids is turned inside out into a calm eyeball
  (`fill_eyes`). Head B, the same head softened to a mannequin's
  (`smooth_face`), was the alternative at the gate and is still a setting.
- **The pose** is the guide's: upper arms 20° from the trunk, elbows bent
  (20° at the joints, which reads as 8° on the arm), palms to the thighs,
  fingers together and lightly curled, the thumb laid on, legs nearly
  straight, toes 8° out.
- **The relief** is MakeHuman's own: the difference between the body at full
  and at average muscle, high-passed so that the bulk goes and the lines
  stay, added three and a half times and bounded softly at 9 mm. The guide
  names 2–6 mm for a groove; at that depth nothing reads at the size of the
  app, and without a bound the sharpest lines of the data become creases of
  two centimetres.
- **The triangles**: the muscle regions are subdivided once (Catmull-Clark),
  and with them two rings of the inert zone beside them — a border that runs
  along the seam between fine and coarse mesh is cut in saw teeth. Hands and
  feet are thinned to 45 % by a quadric edge collapse; the head is left as it
  is, because a face with half its triangles shows them as flat panels.
  49,996 triangles, 33 % of them in the inert zone, 704,100 bytes — 688 KB
  as this project counts (the model of D156: 478,008 bytes, "467 KB").

## What changed against the scripts of the reference page

- `build_mh.py` and `label_mh.py` were proof scripts. Their steps live in
  `bodylib.py` and `regionrules.py` now, behind `build.py`.
- `refine-body.mjs` is the script of the reference page with **three
  changes**. The first is a correction. Where a border crossing was snapped onto a vertex, the
  remaining quad was split along a diagonal that made a triangle without
  area; that triangle was dropped, and the crossing on the other edge was
  left as a T-junction. The body was no longer closed: 30 open edges in the
  proof, 84 in the first candidate. The quad is now split from the other
  corner, and `refine-body.test.mjs` holds the body closed. The second is
  the option `--straymax` (see "The regions"): without a value it changes
  nothing. The third is `--freeze <region>`: the borders of that region
  stay exactly on the edges they lie on. The build passes `--freeze none`,
  because it has cut the inert zone's borders itself (see "The straight
  cuts").
- `bpy` (Blender as a Python module, which the guide names) installs from
  PyPI here but does not import: the container lacks `libtbb.so.12`. Nothing
  in the pipeline needs it. Subdivision, skinning, the thinning of the inert
  zone and the relief are written out in numpy.

## Stills

```sh
npx vite --port 5173 &
node tools/body/render.mjs tools/body/out/athletisch-a.glb /tmp/athletisch-a.png \
  '{"views":[{"yaw":0},{"yaw":90},{"yaw":180},{"yaw":35}],"bg":"#22222c","w":330,"h":640}'
```

`preview.html` is a plain page with the lights of `BodyViewer.tsx`; it is a
tool for comparing files and no part of the app.
