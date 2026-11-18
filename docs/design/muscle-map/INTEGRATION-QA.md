# Muscle map — integration QA record

| | |
|---|---|
| Release candidate | **`bc57ec6`** on `claude/momentum-pass-2-geometry-r2qzkd` — the build reviewed on the device and approved |
| Merge | `90bf328`, a merge commit into `claude/momentum-pwa-spec-j82dhm` (which carried the later upload `04c3d72`); conflict-free, no source overlap |
| Housekeeping | `6ba7935`: the device-review screenshots moved to `qa/device/`, the byte-identical root copy of the design canvas removed (md5 `4644b709829f9f256fde90a778e00f41` on both) |
| Release head | the documentation commit on top of `6ba7935`, tagged **`muscle-map-v1`**. It differs from `bc57ec6` only by the merge history, the relocation of the device evidence, the removal of the redundant canvas copy, and release/handover documentation |
| Device review | approved by the product owner on the phone from the preview `5db6fc4`. *(Corrected in the tidy-up of WP3, 2026-11: the three screenshots once named here, under `qa/device/`, were iPad screenshots of a draft, not a record of that review; they left the tree with D157 and stay in the history.)* |
| App source last changed | `5e554aa` (Stage 4b); every later commit is docs, scripts and screenshots only |
| Base for all comparisons | `fc2ffff` — the last commit before any muscle-map code (the handoff package as supplied) |
| Date | 2026-09-11 |
| Environment | Node v22.22.2 · Chromium 141.0.7390.37 (headless, software WebGL) · playwright-core 1.63.0 · vite 5.4 · three 0.160.1 · @react-three/fiber 8.18.0 |
| Preview | https://dario02king.github.io/Momentum-preview/ — Momentum-preview main at `5db6fc4`, built 2026-09-11T21:54:25Z from Momentum-App `75cf2a5` (app source `5e554aa`); bundle `index-CVyd9Y_w.js`, `BodyViewer-hDJmfRtX.js`, `models/momentum-body.glb`; no service worker on the preview by convention |

## Evidence standard

**PASS** needs a named test with its result, a harness count, a build
artefact with a size, an observed network request, a committed screenshot
path or a fingerprint hash. **FAIL** needs the observed output. **NOT
VERIFIED** is the status for anything this environment cannot observe, and
it is the correct status, not a lesser one. Reading the code is never
evidence, and neither is "implemented in Stage 4b".

Evidence files live in `docs/design/muscle-map/qa/`:

- `regression-run.txt` — validator, typecheck, unit suite, with commands and result lines
- `browser-suites.txt` — every browser suite, with commands and result lines
- `phase41-comparison.txt` — the known failing assertion on this head and on the base
- `release-proof.txt` — network table per route, worker precache, offline Gym, mini-chart measurements, accessibility tree
- `bundle-and-worker.txt` — artefact sizes, precache lists for both bases, model URLs
- `body-reach.txt`, `body-reach-8px.txt`, `body-reach-8px-320.txt` — direct hit coverage
- `<width>-<letter>-<slug>.png` — the screenshots, from `scripts/verify/qa-shots.mjs`
- ~~`device/` — three screenshots~~ — removed in the tidy-up of WP3 (D157): iPad screenshots of a draft, not a record of the device review

## Record

| # | Check | Status | Evidence |
|---|---|---|---|
| 1 | GLB validator | PASS | `npm run validate:body`: `✓ muscle mapping 10/10 · contract satisfied`, exit 0 (`regression-run.txt`) |
| 2 | All ten regions present | PASS | The validator lists all ten ids plus `none`, one primitive each; `tokens.test.ts` pins `BODY_REGIONS` to `MUSCLE_GROUPS` (unit suite, 1070 passing) |
| 3 | Gym domain location correct | PASS | `gym-muscles.mjs`: the module carries one body and one list, under Bereiche → Gym only; `terminal.mjs`: Heute, Verlauf, Rang, Mental and Ernährung carry no `[data-metric^="gym"]`. Screenshots `393-A-gym-workspace.png`, `393-B-muskelgruppen.png` |
| 4 | BodyViewer lazy loading | PASS | `release-proof.txt` network table: the chunk is first requested on Bereiche → Gym — `200 /assets/BodyViewer-CyH-vmvt.js`, `200 /assets/BodyViewer-jpdF9QL8.css` |
| 5 | Three/R3F absent from the main bundle | PASS | `bundle-and-worker.txt`: main `index-BOj1S-LQ.js` 421 235 B; `grep -c 'ACESFilmic\|R3F' dist/assets/index-*.js` = 0; both strings are in `BodyViewer-CyH-vmvt.js` only |
| 6 | Mental does not request viewer assets | PASS | `release-proof.txt` network table, row "Bereiche → Mental": chunk none, GLB none |
| 7 | Food does not request viewer assets | PASS | Same table, row "Bereiche → Ernährung": none, none (also Heute, Verlauf, Rang: none) |
| 8 | Body → row shared selection | PASS | `gym-muscles.mjs` "a tap on the body selects the group it landed on, and its row"; `393-C-measured-selected.png` |
| 9 | Row → body shared selection | PASS | `gym-muscles.mjs` "a row tap selects it" and "selecting a group that faces away turns the body to it" (azimuth 180 after the Rücken row) |
| 10 | Übungen follows the selected muscle | PASS | `gym-muscles.mjs` "the exercises below follow the selected group" — the section reads `Übungen · Brust` |
| 11 | Body second tap remains selected | PASS | `gym-muscles.mjs` "a second tap on the same region keeps it selected rather than clearing it" |
| 12 | Selected noData cue visible | PASS | `highlight.test.ts` (5 tests): an untrained selected region gets `NEUTRAL_HIGHLIGHT` emissive and rim while its colour stays `BODY_BASE_COLOR`; `gym-muscles.mjs` "selecting an untrained group still reads as selected in the list"; `393-D-nodata-selected.png`. Its visibility on a real GPU is item 50 |
| 13 | All ten analytics rows | PASS | `gym-muscles.mjs` "all ten groups have a row — 10", in domain order, translated; `release-proof.txt` rows: 10 buttons |
| 14 | Measured sparkline | PASS | `release-proof.txt` charts: Brust `pts 11 dots 1 line bbox 3,4,74,16`, Trizeps, Rumpf, Quadrizeps, Beinbeuger the same shape; `393-H-sparklines.png` |
| 15 | Single-observation marker | PASS | `release-proof.txt`: Bizeps and Unterarme `pts 0 dots 1`; `gym-muscles.mjs` "a single observation is one dot and no line"; `Sparkline.test.ts` |
| 16 | No-history: no fabricated line | PASS | `release-proof.txt`: Schultern `box 0,0 pts 0 dots 0`; `gym-muscles.mjs` "a group with no history draws nothing at all" |
| 17 | Awaiting-baseline: no fabricated line | PASS | `release-proof.txt`: Waden `pts 0 dots 0`, badge "Noch kein Vergleich"; `muscleAnalytics.test.ts` classifies the four data states |
| 18 | Sparkline endpoint equals row delta | PASS | `muscleAnalytics.test.ts` asserts `trend[last].value === delta` with strict equality for every group with a trend; on the synthetic profile, chest: final point `27.499999999999993` = row delta `27.499999999999993`. The browser cannot read the value back from a path, so this is unit-level evidence only |
| 19 | Sparkline uses the approved `spark80` scaling | PASS | `Sparkline.test.ts` (6 tests): 74px span with 3px inset, series min/max into 16px, flat series at y=12, single point centred; `release-proof.txt`: Rücken `line bbox 3,12,74,0`. Per row, not zero-inclusive, as approved |
| 20 | Recency uses local DateKey semantics | PASS | `MuscleRows.test.tsx` (4 tests, includes a 00:30-local day that is the previous day in UTC); `gym-muscles.mjs` "a set logged at 23:29 reads as trained today" → `Schultern Heute` |
| 21 | SVG fallback | PASS | `gym-muscles.mjs` "without WebGL the flat figure takes the body's place"; `393-I-svg-fallback.png`, `430-I-svg-fallback.png` |
| 22 | Fallback keeps analytics rows | PASS | `gym-muscles.mjs` "the rows and their charts are still there" (10 rows, polylines present) |
| 23 | Fallback has no duplicate old legend | PASS | `gym-muscles.mjs` "the flat figure brings no second list with it" (`.body-renderer__legend` count 0) |
| 24 | BodyViewer error isolation | PASS | `gym-muscles.mjs`: an aborted chunk request (worker blocked) and a renderer that throws on construction both degrade to the flat figure with the rows and the Gym rating intact |
| 25 | `document.hidden` behaviour | PASS | `gym-muscles.mjs` "a rotation in a hidden tab all but stops running frames" — frames counted as they fire, hidden vs. watched, then "coming back finishes it" at 180° |
| 26 | Offscreen behaviour | PASS | `gym-muscles.mjs` "a body scrolled out of view all but stops running frames" and "scrolling back finishes what it was doing" (from 180 to 0) |
| 27 | Reduced motion | PASS | `gym-muscles.mjs`: a 100px drag lands on exactly 55° and does not coast, a shortcut settles at once, rows still select; `body.mjs` the same on the dev harness |
| 28 | StrictMode lifecycle | PASS | `body.mjs` on the dev server, where StrictMode double-mounts: one canvas, one live WebGL context, one set of four pointer handlers after the double mount (`browser-suites.txt`, body.mjs 38/39 in both runs: the lifecycle checks all pass; the one failing check is the dev page's own coarse tap grid, see item 45) |
| 29 | WebGL/resource cleanup | PASS | `gym-muscles.mjs`: leaving Gym → 0 canvases, contexts created − lost = 0, listeners 0; re-entering → exactly one of each; `body.mjs` mount → unmount → mount the same |
| 30 | 393px layout | PASS | `geometry.mjs` (117/117) at 393 × 852, incl. `bereiche-gym-muskeln` and `bereiche-laufen`; `gym-muscles.mjs` no sideways scroll, no cut row text; `393-A…J.png` |
| 31 | 430px layout | PASS | `geometry.mjs` at 430 × 932; `gym-muscles.mjs` 430 block: no sideways scroll, no cut text, charts ≥ 56px, rows ≥ 44px; `430-A…J.png` |
| 32 | 320px regression layout | PASS | `geometry.mjs` at 320 × 693; `gym-muscles.mjs` 320 block: rows wrap to two lines, nothing cut, charts at their 56px floor, rows 60–122px; `320-A-gym-workspace.png`, `320-B-muskelgruppen.png`, `320-H-sparklines.png`, `320-K-triceps-row-selected.png` |
| 33 | 393 direct hit coverage — measured | PASS | `body-reach.txt`, 12px grid: **10/10** (Quadrizeps 11 · Unterarme 9 · Beinbeuger 8 · Schultern 6 · Rumpf 5 · Brust 3 · Trizeps 3 · Rücken 2 · Bizeps 2 · Waden 2); 8px grid: 10/10 |
| 34 | 430 direct hit coverage — measured | PASS, with a deviation | `body-reach.txt`, 12px grid: **9/10, triceps not hit** — this contradicts the 10/10 I stated at the 4b gate, which was asserted without a probe. `body-reach-8px.txt`, 8px grid: **10/10** (Trizeps 5 cells). The region is about one 12px pitch wide, so the coarse miss is grid alignment, not absence; at 430 it is no smaller than at 393 |
| 35 | 320 direct hit coverage — measured vs. accepted 9/10 | PASS | `body-reach.txt`, 12px grid: **9/10, triceps not hit** — equals the accepted value. `body-reach-8px-320.txt`, 8px grid: 10/10 with Trizeps at 2 cells, i.e. reachable but small |
| 36 | All ten rows selectable at 320 | PASS | `gym-muscles.mjs` "320: all ten groups can be selected from their row" and "selecting the triceps row turns the body to the back — 177" |
| 37 | Running inside Gym | PASS | `gym-muscles.mjs` "Laufen sits inside the Gym workspace" with `[data-metric="running-rating"]` and the Laufen card; `393-J-laufen.png`, `430-J-laufen.png` |
| 38 | Running historical row remains in Verlauf | PASS | `gym-muscles.mjs` "Verlauf keeps the Laufen row in the history grid" (`Gesamt | Wellbeing | Gym | Laufen`) and "no longer carries the Running board" |
| 39 | Running domain outputs unchanged | PASS | Boss fingerprints, which include `boss.running` and the running ledger: `5304a99c…` (RC2 export), `6ef514a4…` (RC2 synthetic), `2afc67e3…` (four-domain profile) — identical to the values pinned at `d07f677`, before any of this work |
| 40 | Gym domain outputs unchanged | PASS | Gym history fingerprints pinned at `b7ad9e7`: `61cc417e…` (both RC2 profiles), `58662df2…` over 4 212 values (four-domain profile) — unchanged (`regression-run.txt`) |
| 41 | Boss/global outputs unchanged | PASS | The three Boss fingerprints above, 479 / 12 764 / 11 993 values |
| 42 | Credits/attribution present | PASS | `gym-muscles.mjs`: the sheet names patmateee, CC BY 4.0 and "bearbeitet", two links `target=_blank rel=noopener`; `release-proof.txt`: a modal dialog, Escape closes it; `THIRD-PARTY-NOTICES.md` at the root; `asset.copyright` checked by the validator |
| 43 | Typecheck | PASS | `npm run typecheck` (`tsc -b`), exit 0 |
| 44 | Full unit suite | PASS | `npm run test`: 69 files, 1070 tests, exit 0 |
| 45 | Browser verification harnesses | FAIL — two suites carry one failing check each, neither a product defect | `browser-suites.txt`, 22 suites: gym-muscles 71/71 · terminal 42/42 · geometry 117/117 · release 82/82 · phase2 64/64 · phase2-a11y 17/17 · phase2-legacy 5/5 · phase3 44/44 · phase3-a11y 9/9 · phase4 52/52 · phase4-a11y 15/15 · phase41 **51/52** · phase41-a11y 14/14 · phase5 46/46 · phase5-a11y 15/15 · phase6 47/47 · phase6-a11y 20/20 · phase7 57/57 · phase7-a11y 18/18 · phase8 56/56 · phase8-a11y 23/23 · body **38/39**. (a) `phase41`: the pre-existing date-dependent assertion, identical on the base — see below. (b) `body.mjs` "all ten regions are reachable by a tap, front and back": its 11 × 11 tap grid on the dev page missed two regions in the first run (biceps, core; that run overlapped the 8px hit probes) and one in a re-run alone (triceps). The grid's pitch is 11–14px and an upper arm is about 13px at that size, so a hit depends on alignment; the same suite passed 10/10 at Stage 2 by that alignment. The finer production probe (`body-reach-8px*.txt`, 8px pitch) reaches 10/10 at 393, 430 and 320, and every lifecycle, rotation, selection and framing check in `body.mjs` passes. No test was edited in this stage, as instructed; the probe's pitch is the follow-up |
| 46 | Production build | PASS | `npm run build`: validator green, `tsc -b` clean, `vite build` clean |
| 47 | Production bundle measurements | PASS | `bundle-and-worker.txt` — see the table below; main +0.06 kB gzip against the Stage 4b baseline, viewer +0.00 kB |
| 48 | Preview deployment | PASS (push) / NOT VERIFIED (serving) | Momentum-preview `5db6fc4` on `main`, pushed 2026-09-11T21:54:25Z (`ec8dd8c..5db6fc4 main -> main`), built from `75cf2a5`; its index.html references `assets/index-CVyd9Y_w.js` and `assets/index-c0r-SqIw.css`; `models/momentum-body.glb` and `assets/BodyViewer-hDJmfRtX.js` are in the commit. Whether GitHub Pages is serving it could not be observed from this environment: the egress proxy denies `dario02king.github.io` by organisation policy (19 rejected connections at 21:57Z). The push is the evidence; the first load on the phone is the check |
| 49 | PWA/service-worker asset behaviour | PASS (desktop) | `bundle-and-worker.txt`: production precache carries `/Momentum-App/models/momentum-body.glb` and both viewer files, zero `Momentum-preview` strings; the preview-base build carries `/Momentum-preview/…` for all three, zero `Momentum-App` strings. `release-proof.txt`: after install the worker holds 12 entries incl. the model and the chunk; offline, the shell loads and Gym shows the 3D body with 10 rows. Real iOS PWA offline behaviour is NOT VERIFIED — see item 50 and the device checklist |
| 50 | Real-device Safari review | NOT VERIFIED here / APPROVED by the product owner | Cannot be observed from the build environment. Performed on the phone from preview `5db6fc4`: the 3D body, touch rotation, muscle selection, shared row/body selection, mini sparklines, recency/status layout, Running placement and the credits UI approved (the owner's word; the screenshots once kept under `qa/device/` were not a record of it and left the tree with D157). iOS PWA offline stays for the production site |

Items marked NOT VERIFIED by the environment, beyond 50: 200 % text zoom
(no harness supports it; nothing here has measured it) and iOS PWA offline
(the preview publishes no worker by convention, so it cannot be tried there
either).

## phase41 — pre-existing, not caused by the body map

`phase41-comparison.txt`:

```
phase41 on head 5e554aa:
FAIL  a missed week costs half a week rather than the balance  — 1.0 von 4 Wochen
51/52 checks passed

phase41 on base fc2ffff (its own script, its own build):
FAIL  a missed week costs half a week rather than the balance  — 1.0 von 4 Wochen
51/52 checks passed
```

Same assertion, same output, same count on both. Status:
`PRE-EXISTING / NOT CAUSED BY BODYMAP`. It is date-dependent (the seeded
week that is "missed" depends on the weekday the suite runs on) and has been
reported on every pass since Pass 2. No product logic and no test was
changed for it.

## Bundle

| Artefact | Raw | gzip | Baseline (Stage 4b) | Δ gzip |
|---|---|---|---|---|
| `index-BOj1S-LQ.js` (main) | 421 235 B (vite: 420.86 kB) | 123 633 B (vite: 123.70 kB) | 420.86 / 123.70 | +0.00 |
| `index-c0r-SqIw.css` | 73 027 B | 11 566 B | 73.03 / 11.55 | +0.00 |
| `BodyViewer-CyH-vmvt.js` (lazy) | 860 923 B (vite: 860.92 kB) | 234 197 B (vite: 235.23 kB) | 860.92 / 235.23 | +0.00 |
| `BodyViewer-jpdF9QL8.css` | 1 010 B | 507 B | 1.01 / 0.48 | +0.00 |
| `models/momentum-body.glb` | 478 008 B | 344 867 B | 478 008 B | 0 |
| `sw.js` | 3 471 B | 1 410 B | 3.31 kB at Stage 1 | +0.16 kB raw (two precache lines) |

Against the Stage 2 baseline (410.33 / 119.44) the main bundle grew by
4.26 kB gzip: the muscle rows, the sparkline, the credits sheet, the Laufen
section and their strings, all in Stage 4b. The viewer chunk is three.js and
the React renderer; it is the first-Gym-entry cost, 235 kB gzip plus the
345 kB gzip model, once, then served from the worker's cache.

## Network, cold boot, no worker (`release-proof.txt`)

| Route | BodyViewer chunk | GLB |
|---|---|---|
| Heute (boot) | none | none |
| Verlauf | none | none |
| Rang | none | none |
| Bereiche → Mental | none | none |
| Bereiche → Ernährung | none | none |
| Bereiche → Gym | `200 /assets/BodyViewer-jpdF9QL8.css`, `200 /assets/BodyViewer-CyH-vmvt.js` | `200 /models/momentum-body.glb` |

## Defects found during this stage

None of class 2. One class-1 correction of the record: the 430 direct-hit
figure stated at the 4b gate (10/10) had not been measured; measured now, it
is 9/10 at a 12px pitch and 10/10 at 8px (item 34). No code changed for it.

## Known limits of this record

- Real-device behaviour is not in this file: shading on a GPU, touch and
  pointer capture in Safari, safe areas, the iOS PWA offline path.
- 200 % text zoom is unmeasured.
- The sparkline's endpoint equality with the row delta is proven at unit
  level, not read back from the rendered path.
