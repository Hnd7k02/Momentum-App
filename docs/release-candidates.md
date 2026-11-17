# Momentum V1 — release candidates

A candidate is superseded the moment application code changes, so the build
under test always has its own number. The history below is kept as it
happened; RC1 is not rewritten to pretend its defect never existed.

| | Application commit | Status |
|---|---|---|
| **WP3 RC** | app source **`017cc56`**, on `claude/momentum-wp3` | **At the gate** (STOP 9) — see below |
| **muscle-map-v1** | app source **`5e554aa`**; the tag was never set in the repository (found in block 9) | **Released** — see below |
| V1 | the release pass after RC2 | Released |
| RC2 | `c3e8b7f` | Superseded by V1 |
| RC1 | `ae8b479` | Superseded — never deployed, never tested on a device |

---

## WP3 RC — app source `017cc56`

WP3 — Mind and Gym — as a whole, on `claude/momentum-wp3`, after block 9
(hardening and the release gate). The live app is still `e30becd` (WP2).
Record: `docs/wp3/stage9/README.md`; decisions D127–D195. **Preview:**
`Momentum-preview` `59aa850`, <https://hnd7k02.github.io/Momentum-preview/>
— built from `b71cf9e`, no `sw.js`, the status bar `default`, its own
database `momentum-preview`.

### What it contains

- **Mind and Gym** (D139, D143): Food switched off as an era from the
  first load, its data kept; Laufen inside Gym.
- **One day back** (D132–D138): Heute | Gestern, a week judged when it is
  over, nothing charged while it can still be written.
- **The workout flow** (D128–D131, D137): a workout from its first set,
  undo that puts back what was removed, kg | lb, «Fertig».
- **A Gym day is worth its best working set** (D150, D151, D172–D175), on
  Gym's own curve (D177–D180), with warm-ups marked by hand.
- **The design system** (D145–D149, D160–D163): Mind light, Gym graphite,
  glass with solid fallbacks, text measured on its pixels.
- **Muskelgruppen** (D164–D170, D181–D187): a new body model built by
  script, a stage operated by time and rule, a sheet per group with its
  line, its exercises' one change each and the work volume (shown, never
  scored); a measuring display the owner switches on.
- **The catalogue** of 134 exercises and its search (D188, D189).
- **The onboarding** in direction C (D190–D193).
- **Block 9** (D194, D195): a workout on an open day shows at once, as
  provisional; less transparency makes every glass solid; a kept era
  boundary holds.

### The check

| | Baseline (`aab8d12`) | This candidate |
|---|---|---|
| `tsc -b` | exit 0 | exit 0 |
| `npm run test` | exit 0 · 141 files · 2485 tests | exit 0 · 144 files · 2508 tests |
| `npm run verify`, Chromium, here | 41 suites · 5641 / 5648 | FINAL_LOCAL |
| GitHub, Chromium | — | FINAL_GITHUB |
| GitHub, WebKit (5 suites) | — | 1012 / 1012 |

The 7 red checks of the baseline: the known offline check in
`release-proof.mjs` (D163, the tidy-up's) and six in `wp2-2-shots.mjs`
that counted the onboarding's still since 7E (the harness, fixed).

### On the device

Checked on the iPhone before this block: blocks 7A to 7E on their
previews, the owner's measurements of 7B and of 17 November (iPhone 15 Pro,
iOS 26.3.1; `docs/device-tests.md`). **Not yet**: this candidate's
checklist (`docs/device-tests.md`), VoiceOver, less motion and less
transparency on the phone, the update in place and offline — which the
preview cannot show, having no service worker.

### Known limits

- The offline check in `release-proof.mjs` is red until the tidy-up
  (D163).
- WebKit on Linux is not Safari on an iPhone: five suites run there as an
  early warning; the screen reader's tree, the body's frames and its
  reach are Chromium's alone.
- One unanswered daily question still holds a whole day open (D111); a
  workout on such a day shows as provisional (D194).

### The way back

The state to return to is `e30becd`, the head of the default branch
(proposed tag `live-before-wp3`, not set). The only clean way back is a
backup exported in the live app before the update: delete the app's data,
open the live build, import that backup. Everything entered after the
backup is lost. Rehearsed in `update-in-place.mjs` (C) and
`updateRehearsal.test.ts`.

---

## muscle-map-v1

The 3D muscle map inside the Gym workspace of the domain terminal, released
after real-device approval of the candidate `bc57ec6`.

### What it adds

- **Bereiche is the domain terminal**: Mental · Gym · Ernährung, one area at a
  time, the area in the hash (`#/areas/<area>`), Back walking the areas
  visited. Verlauf stays the overall overview.
- **The 3D body** (`src/features/body/`): the approved handoff's React +
  three.js viewer, free 360° rotation with the angle as the state, front /
  side / back shortcuts, raycast selection, the approved material treatment,
  reduced motion, host-sized framing, paused while hidden or off screen.
- **Muscle analytics rows** with **mini sparklines**: per group its identity
  dot, name, last-trained day, an 80 × 24 chart in the identity colour, and
  the percentage or state in the state colour. The trend is the group's
  over-span change since the range began, evaluated at each training day
  through the existing `gymPerformanceOverSpan()`, so its last point equals
  the row's delta. No history, no baseline and a single observation draw
  nothing false.
- **One shared selection** between body, rows and the Übungen list; body
  taps select, rows toggle; an untrained selected group shows a neutral cue.
- **Laufen inside the Gym workspace**, board and target card; its daily row
  stays in Verlauf.
- **Lazy loading**: three.js, the renderer and the viewer in their own chunk
  (860.92 kB, 235.23 kB gzip), plus the model (478 008 B, 344 867 B gzip),
  fetched on first entry to Gym and on no other route; the main bundle grew
  by 4.26 kB gzip against Stage 2. The SVG figure stands in without WebGL, on
  a fetch failure and on a throw, with the rows intact.
- **The model contract**: `public/models/momentum-body.glb`, 40 000
  triangles, one primitive per muscle id plus `none`; `npm run validate:body`
  enforces it first in every build. CC BY 4.0 (patmateee, modified) — credit
  in Bereiche → Einstellungen, `THIRD-PARTY-NOTICES.md`, `asset.copyright`.
- **Verification**: `terminal.mjs`, `body.mjs`, `gym-muscles.mjs`,
  `body-reach.mjs`, `release-proof.mjs`, `qa-shots.mjs`; six domain-output
  fingerprints in `domainOutputs.test.ts` pinned before the work and unchanged
  after it.

### Record

`docs/design/muscle-map/INTEGRATION-QA.md` — 50 items, 47 PASS, 1 FAIL (two
harness checks, neither a product defect), 2 NOT VERIFIED (preview serving
from the build environment; real-device Safari, since performed by the
product owner and approved). Evidence and screenshots under
`docs/design/muscle-map/qa/`, the device-review screenshots under
`docs/design/muscle-map/qa/device/`. Every difference from the handoff:
`docs/design/muscle-map/HANDOFF-DEVIATIONS.md`.

### Known, not product

- `phase41`: one date-dependent assertion fails identically on the
  pre-integration base `fc2ffff` (`qa/phase41-comparison.txt`).
- `body.mjs`: its dev-page tap grid (11–14px pitch) misses one region of
  about that width; `body-reach.mjs` at 8px reaches 10/10 at every width.

### How it was merged

`bc57ec6` (reviewed candidate) → merge commit `90bf328` into the default
branch, which carried a later upload → housekeeping `6ba7935` moving the
device screenshots under the QA evidence and removing a byte-identical copy
of the design canvas → the documentation commit tagged `muscle-map-v1`. No
application source changed after `5e554aa`.

---

## RC2 — `c3e8b7f`

The build under test. It is RC1 plus one application change.

### What changed from RC1

`runTransaction` created a promise for the transaction commit and then
abandoned it whenever the transaction body threw: aborting the transaction
rejects that promise, and by then nothing was listening. The result was an
unhandled promise rejection — noise in a browser, and a non-zero exit from
the test runner even though all 352 tests passed.

That is why RC1 was never deployable: the deploy workflow runs `npm run test`
as a gate, and the gate failed on a suite that printed a green summary. It was
found by the first CI run rather than locally, because reading a test
summary is not the same as reading an exit code.

Six lines in `src/storage/db.ts`. No product, visual, copy or accessibility
behaviour differs between RC1 and RC2.

### Verified at RC2

- `tsc -b` clean; 352 tests across 23 files passing; **`npm run test` exits 0**
- Production build clean; no compiled JavaScript beside its TypeScript source
- The transaction-heavy suites re-run against the rebuilt bundle: backup, PWA
  and offline 31/31; §25 acceptance scenarios 26/26

## RC1 — `ae8b479`

The build frozen at the close of stage 8, superseded before it ever reached a
device. Kept here because the release rule depends on it: RC1 is the baseline
RC2 is measured against, and the defect it carried is the reason the numbering
moved.

---

## What is frozen

Stages 1–8 are complete and closed. The behaviour, the product decisions
recorded in [`decisions.md`](decisions.md), and the visual design are frozen.
Changes from here are limited to defects found during real-device validation,
classified by the scale in [`device-tests.md`](device-tests.md).

| # | Stage | Status |
|---|---|---|
| 1 | Project setup, storage, schema v1, date and week logic | complete |
| 2 | Onboarding, domain and question configuration | complete |
| 3 | Today screen and daily check-in | complete |
| 4 | Progress screen: heatmap and trend curve | complete |
| 5 | Rating engine, rank ladder, rank badges | complete |
| 6 | Sports domain: weekly target tracking | complete |
| 7 | Backup export/import, PWA behaviour, service-worker updates | complete |
| 8 | Product review: §25 acceptance, copy, §6 design conformance | complete |

## Outstanding before RC2 can be promoted

1. **Real-device validation on iPhone and, if available, iPad.** No part of
   the app has run on iOS hardware. Safari's PWA behaviour, the installed
   standalone shell, safe areas around the Dynamic Island and home indicator,
   the on-screen keyboard, and real touch ergonomics are all unproven.
2. **Real screen-reader validation.** VoiceOver has never been run against
   the app. What was verified is the layer VoiceOver consumes — the computed
   accessibility tree, accessible names and descriptions, roles, table
   semantics and focus order — not VoiceOver itself.

## Known non-blocking limitations

| # | Limitation | Why it is not a blocker |
|---|---|---|
| 1 | Screen-reader behaviour is inferred from the accessibility tree, not observed | The semantics beneath it are verified; this is what device validation is for |
| 2 | The type scale is fixed in px, so browser and OS text-size settings do not reflow the interface | Text enlargement works through zoom, which is no longer blocked (D62). Moving the scale to relative units is a V2 change |
| 3 | Layout viewports below roughly 200px wide can push onboarding content under the footer | Not reproducible at any phone viewport; it models a desktop browser zoomed to 200% in a sub-400px window |
| 4 | 14 unused strings remain in the i18n catalogues | Invisible to users; deleting them changes nothing |
| 5 | Backup counts have no singular form — a one-answer backup reads "1 Antworten" | A transient status line in a rare edge case |
| 6 | No Apple HIG reference was available in the build environment | §6 requires this be stated rather than invented; the conformance review used §6's own rules |

## Deployment

Published to GitHub Pages by [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml),
which runs typecheck, tests and the production build before publishing. The
Vite base path is `/Momentum-App/`, which is where a project site is served
from, so the build needs no deployment-specific configuration.

Pages must be enabled once by hand — repository → Settings → Pages → Build and
deployment → Source → **GitHub Actions**. A commit cannot set it.

**Live at <https://dario02king.github.io/Momentum-App/>**

## Two places the app deliberately departs from the specification

Both were decided by the product owner and are recorded in full:

- **D13** replaces §6's "dark interface only in version 1" with a single
  light theme.
- **D16** gives the rank badge its own dark hero surface inside that light
  screen.
