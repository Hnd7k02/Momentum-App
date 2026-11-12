# Third-party notices

Momentum ships one asset that is built from third-party data: the 3D body.
Its source is in the public domain and asks for no credit; the app names it
all the same, under Bereiche → Einstellungen, and this file ships with every
build. A second section credits files that are kept in the repository but are
not part of the app.

## 3D body model — `public/models/momentum-body.glb`

The body is built from the **MakeHuman** base mesh, its default rig and its
shape targets, as the Blender add-on MPFB2 distributes them
(https://static.makehumancommunity.org/mpfb.html). These data are released
under **Creative Commons CC0 1.0 Universal**
(https://creativecommons.org/publicdomain/zero/1.0/): a dedication to the
public domain, with no condition and no duty to name the source.

The files were taken from the data folder of the Python package **Anny**
0.6.2 (NAVER Corp.), which calls them "MakeHuman assets adapted from MPFB2 …
licensed under the CC0 1.0 Universal License". One of them is that project's
own work: the skinning weights the body is posed with, "Anny default
skinning weights", Copyright (C) 2025 NAVER Corp., released under CC0 as
well. Nothing of Anny's code, which is under the Apache License 2.0, is used
or shipped.

The files lie unchanged in `tools/body/makehuman/`, beside the licence text
they came with (`tools/body/makehuman/LICENSE.md`) and a manifest of their
sha256; `tools/body/README.md` says what was read and where they were taken
from.

What Momentum made of them, by script and reproducibly (`tools/body/`):

- shaped with MakeHuman's own targets into an athletic male body, the eye
  sockets closed
- posed with the default rig: arms slightly away from the trunk, elbows
  lightly bent, hands relaxed
- its muscle relief taken from MakeHuman's own muscle targets and deepened
- the muscle regions subdivided, hands and feet thinned
- split into one primitive per Momentum muscle region (10 regions and the
  inert zone of head, hands and feet), cut straight at neck, wrist and ankle
- a shade baked into the vertex colours; quantized with
  `KHR_mesh_quantization`; no textures, no UVs, no rig, no animation

`asset.copyright` inside the GLB names MakeHuman, Anny and CC0, and
`npm run validate:body` checks it on every build.

## Kept in the repository, not shipped

Until block 7A of WP3 the app's body was another model. Files derived from
it remain under `docs/design/muscle-map/` — a copy of that GLB in
`momentum-muscle-map-handoff/`, and pictures of it in the QA and design
records. They are not part of any build. Their credit stays with them:

This work is based on "Muscular Athletic Body - Male Base Mesh"
(https://sketchfab.com/3d-models/muscular-athletic-body-male-base-mesh-a58450cb3c23429f8f7acb2c7b22b552)
by patmateee (https://sketchfab.com/patmateee) licensed under CC-BY-4.0
(http://creativecommons.org/licenses/by/4.0/)

That mesh was modified for Momentum: 7 source sub-meshes merged into one
surface, re-posed, decimated from 615,940 to 40,000 triangles, its normals
recomputed, split into Momentum's muscle regions and quantized. The original
licence file and the full attribution note are kept in
`docs/design/muscle-map/license.txt` and
`docs/design/muscle-map/ATTRIBUTION.txt`. CC BY 4.0 has no ShareAlike clause;
only the attribution travels with those files.
