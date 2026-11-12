# The second sheet of the gate of block 7A

Pictures for the owner's two corrections after the gate (D165, "After the
gate"): the shipped body, `momentum-body`, beside the candidate `gate-2`,
and `gate-2` beside its alternative `gate-2-b`. "Vorher" is what the app
ships since STOP 7A; "Nachher" is the candidate. Nothing in the app was
changed for these pictures.

How they were taken, so that they can be taken again after a change to
`tools/body/candidates.json`:

```sh
npx vite --port 5173 &
python3 tools/body/build.py momentum-body gate-2 gate-2-b
```

- `buehne-*`, `ort-*`, `alt-*`, `breite-320`, `drei-schritte*` are the real
  viewer on the dev page, `tools/body/gate-shots.mjs`: the stage of the Gym
  world at 393 px (320 for `breite-320`, the light world for
  `buehne-hell-vorne`), two device pixels per px, view buttons hidden, with
  the fixtures `held` (white), `mixed` (status colours) and `empty`
  (untrained), from the front, the side, the back and 35° (`azimuth`). A
  shot is `{ "name": …, "model": "tools/body/out/gate-2.glb", "world":
  "gym", "fixture": "held", "width": 393, "pills": false }`. `ort-*` are
  cut from the white stage and enlarged three times: chest, belly and
  groin, shoulder (from 35°), the arm, and the ankles.
- `nah-*` are close-ups from the pipeline's own renderer,
  `tools/body/render.mjs`, in the app's tones (`rest` `#e9e9ee`, `none`
  `#b3b3bc`) and with the app's light (`look`: no tone mapping, hemisphere
  0.6, key 1.1 at −1.9 3 2.2, fill 0.3, back 2 at 0.9 2.4 −2.6, environment
  0.3, roughness 0.62). They are not the app, and say so on the sheet.
- `drei-schritte*` puts the gate's own picture of `athletisch-a` (as it was
  shown: key light 1.9, the inert zone still dimmed) before the two.
