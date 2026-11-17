# Handover — Momentum V1, released

Current state, status and next work. Durable rules are in
[`CLAUDE.md`](CLAUDE.md); the reasoning behind individual choices is in
[`docs/decisions.md`](docs/decisions.md) (D1–D190). This file does not repeat
either — it says where things stand.

## Repository state

| | |
|---|---|
| Branch | `claude/momentum-pwa-spec-j82dhm` — the default branch, which is the only one Pages deploys from. Pass 2, the domain terminal and the muscle map were developed on `claude/momentum-pass-2-geometry-r2qzkd`; the muscle-map release candidate `bc57ec6` was merged here with a merge commit (`90bf328`) because the default branch carried a later upload. The release is tagged **`muscle-map-v1`** |
| Overall-rank update | On `claude/momentum-overall-rank-update-v2`. **Stage 1** (D123): one `--status-*` palette in `tokens.css`, both scales on four bands, muscle-map states on the same colours. **Stage 2** (D124, D125): the Boss is the only rank — domain ranks, badges, promotion messages, peak ranks and per-domain XP are gone from the engine and the screens; abstinence decay measures in an internal held tier; the rating engine's outputs are frozen in `.github/fixtures/stage2/` and replay byte-identical. **Stage 3**: Tombstones verified dormant and pinned by `tombstones.test.ts`; no production change. **Stage 4** (D126): a Boss promotion is confirmed over seven eligible past days; the era boundary is `settings.promotionConfirmation.from` — set at settings creation for a new install (today, Rookie opening) and by the ensure step for a legacy record (the day after activation), never moved; the pending dates are persisted and reconciled from every replay; the activation continuity fixture is `.github/fixtures/stage4/activation.json`. **Stage 5**: verification pass; the distance caption reads "Schwelle erreicht" while a rank waits to be confirmed; indicator states pinned on the real screens by `scripts/verify/stage4-shots.mjs` with screenshots under `docs/design/overall-rank/`. Release audit in the Stage 5 report. **Not merged, not deployed** |
| WP3 (Mind & Gym) | On `claude/momentum-wp3`, branched from `e30becd`, staged. **Stage 0**: the golden replay baseline `.github/fixtures/wp3-golden/` (six files, compared exactly by `domainOutputs.test.ts`). **Stage 1**: bug fixes B1–B6 and B9–B12 with no scoring change — every fingerprint and golden file byte-identical to Stage 0; D127 recorded. **Stage 2**: the workout flow — free workouts as drafts (B7, D128), removal with undo (B8, D131), the running workout on Heute and `finishedAt` (D129), kg \| lb (D130); no scoring change, every fingerprint and golden file byte-identical. **Stage 3a**: the edit-window gate (`docs/design/wp3/stage3a-window.md`). **Stage 3b**: one day back (P8) as an era — one write rule for today and yesterday, a week judged when it is over, abstinence carried while it can be written, D126 on settled days, Heute \| Gestern (D132–D138); every pre-P8 value byte-identical, the P8 golden files re-frozen deliberately. **Stage 4**: Mind and Gym — Food off as an era from the first load (D139), its data kept and nothing creating it (D140), the update day's yesterday (D141), the check-in delete refusing a Gym session (D142), one name, Mind, and the terminal Mind \| Gym (D143), Gestern's wording for the standard questions (D144); every value before the switch-off byte-identical, the Food-off golden files unchanged. **Stage 6a**: the visual system (P11) as two design variants — two token sets, Mind light and Gym dark, declared by the screen and carried on `<html>` (D145); glass cards and sheets with solid fallbacks, nothing blurred over the 3D canvas (D146); text over glass measured on the rendered pixels (D147); the owner chose variant B at STOP 6a (D148). **Stage 6b**: B is the one design system and the visual contract `docs/wp3/vertrag.md` (D160) is applied to every existing screen — colour with three jobs, the type and figure steps, one 16px margin, one order of buttons, the chart rules, layers and motion as tokens, calm loading surfaces — with its rules held by tests (`designRules.test.ts`, `contrast.test.ts`, `design-system.mjs`); nothing computed moved, `src/core/`, `src/storage/`, every fingerprint and golden file untouched (D162). **The colour rules of the muscle status** (contract §7, D164) and **block 7A** — the body is a new model, built by script from MakeHuman's base mesh, with straight cuts round an inert zone that has a tone of its own, and a light that is tokens without a tone mapping (D165, D166) — are built and **accepted by the owner on his iPhone on 2026-11-13**, from the `Momentum-preview` build `0414126`. **His addendum to that acceptance** (D167) — the weakest tint 0.3, the chest's lower edge level, the borders at the knee, the collarbone and the shoulder as lines the build cuts — is built, published as `Momentum-preview` `c80b61d` and **accepted by the owner on his iPhone on 2026-11-15**, the straight edge of the shoulder included; the elbow and the deltoid's lower edge stay as they are. **Stage 5b** (D150, D151, D172–D174): from the first load a Gym exercise-day is worth its best working set by a strength score, as an era marked by `scoring.gymMetric`; a window compares the median of an exercise's last days with the median of its first, behind a switch the owner confirms; a set can be marked as a warm-up by hand; every day before the boundary replays byte-identically, no golden file frozen again, sixteen new ones for two new profiles — **accepted by the owner on his iPhone on 2026-11-15** from the `Momentum-preview` build `7e0572f` (D175): the median stands, the exercise detail draws a line where it drew bars, and a hint under the sets says where the warm-up mark is until a set has been marked once. **Block "Kurve"** (D177–D179): in the Stage 5b era the performance curve's one value is Gym's own — every three points of improvement multiply the odds by four, where the constants say ten — carried in `scoring.gymMetric.curveDecadePercent` beside the metric and read from each day's snapshot; a marker without it, which only a Stage 5b preview wrote, is the curve as it was; no day before the boundary and no day of Running moved; and a tint on the body is full from 8 % where it was 12 %. **Accepted by the owner on his iPhone on 2026-11-15** from the `Momentum-preview` build `28e8ca0` (D180), with his four answers built in the same session: the value three stands (`GYM_CURVE_CONFIRMED` is `true`), the tint stays full from 8 %, the rows and the exercise detail are drawn on a scale of 8 % where it was 12 %, and the held band is one-sided — −2 to +1 % held, a rise from +2 %, a fall from −3 % — with the legend saying why; published as `Momentum-preview` `ae10d3d`. **Block 7B** (D181–D183): Muskelgruppen is the body's stage — no card, 55 % of the visible height, a metrics strip above it — operated by time and by rule: a tap never turns the body and reaches a group from twelve pixels beside it, two fingers zoom to 1.8, a double tap and a button reset, a sheet stands over a still body, a lost context ends with the body or the flat figure, and Heute's Gym label leads straight to it; with a measuring display the owner switches on in the settings. **Accepted by the owner on his iPhone on 2026-11-16** from the `Momentum-preview` build `275cfbc` (D184), without findings and with his five answers, each as built: the measuring display stays in the release, the strip's third cell prints the change with the group beneath, "Stärkster" says "–" where no group improved, a drag up or down on the body scrolls the page, and the 55 % are the stage. His three copies of the measuring display are the first measured values from an iPhone (15 Pro, iOS 26.3.1): 193 ms from opening Muskelgruppen to the first picture out of the cache, sixty frames a second while turning with every one of 154 measured frames under 25 ms, twelve draw calls, 50,488 triangles. **Block 7C** (D185, D186): a tap on a muscle or on a row opens the group's sheet — two heights and a finger, a Back that closes it without a place in the address, the body above it showing the group and nothing drawn under it — with the group's line, its exercises each with one change (D176) and the work volume per week, shown and never scored (D152); the card on the hub holds its place while it loads (D168) and all lines of the ten rows stand in one column (D169). **Accepted by the owner on his iPhone on 2026-11-16** from the `Momentum-preview` build `387bfc9` (D187), except the Dips: their line ended green under the zero line beside "+5 %". With his answers and his correction, built in the same session and published as `Momentum-preview` `7f859f3`: every line begins on the baseline of its first day (D170), an exercise states one change (D176), and **an exercise's line is that change day by day** — each point the change in the range up to its day — so it ends on the figure; Back for every sheet goes to the tidy-up, on the condition that a sheet with fields loses nothing typed. From STOP 7C the session runs on another model than D159 names, at his instruction (D187). **Block 7D** (D188): the catalogue holds 134 exercises where it held 49 — the last, the Bayesian cable curl, added at his request after the STOP — at least ten for every group by its primary role, every entry with its equipment and its movement — and the picker searches all of it, in the workout and in the plan editor, by name, detail, group with everyday words, movement and equipment; the 49 entries, every stored record and everything that computes or stores unchanged. **Accepted by the owner on 2026-11-17** (D189), with his answers each as built and Preacher-Curls also found as «Bizepsmaschine» and «Scott-Curls»; published as `Momentum-preview` `4063e82`. **7E runs in a session of its own** on `claude/hopeful-carson-4utktp`, from `adf1ead`, and is merged into this branch before block 9; then 9 and the tidy-up (D189). **Block 7E** (D190), the onboarding's look in direction C, ran beside it in a session of its own, on `claude/hopeful-carson-4utktp` from 7D's head `adf1ead`: built to its presentation and **waiting for the owner at STOP 7E-a2** with pictures, four questions and an estimate. **Not merged, not deployed** |
| Muscle map | **Released.** The 3D body in Bereiche → Gym, the ten analytics rows with their mini sparklines, Laufen inside the Gym workspace, the credits entry. App source `5e554aa`; QA record `docs/design/muscle-map/INTEGRATION-QA.md`; handoff deviations `docs/design/muscle-map/HANDOFF-DEVIATIONS.md` |
| Working tree | clean at the commit this file was committed in |
| `SCHEMA_VERSION` | **5** (`src/core/model/index.ts`) — v5 adds the `foodDays` store |
| `BACKUP_FORMAT_VERSION` | **3** (`src/core/backup/format.ts`) — v3 adds the `foodDays` collection; a v1 or v2 file still imports, every later collection reading as empty when absent |
| `SCORING_MODEL` | `categoryMean` (`src/core/config/constants.ts`) |
| `GYM_SCORING_MODEL` | `attendancePerformance` — Gym's 40/60 model |
| `RUNNING_SCORING_MODEL` | `attendancePerformance` — Running's 40/60 model |
| Food | **retired** (D139): Food-era days replay by the shared daily fold over the 1–10 adherence (D106, D107); nothing writes Food, and its data is kept (D140) |
| `DECAY_MODEL_APPROVED` | **`true`** — Gate 1 closed by D113. RC2's formula ratified unchanged, and `core/decay` is now on the live path |
| Gate 2 (nutrition targets) | moot since Food left the product (D139) |

Phases 0–6 of iteration 2 are complete. Phase 4.1 closed the Gym scoring gate,
Phase 5 closed Running's, and Phase 6 built Food **without** closing Gate 2:
Food is ranked on the adherence the user enters, so the calorie and macro
target decision is still entirely open and nothing in the scoring path
pre-empts it. WP3 Stage 4 then took Food out of the product (D139): its days
still replay and its data is kept.

> **The branch changed.** This work was carried out on
> `claude/gym-scoring-integration-9oeblv`, reset from
> `origin/claude/momentum-iteration-2` at `9bce7f8`. The iteration-2 branch is
> unchanged and remains the ancestor of everything here.

## Architecture

```
records (answers, sessions, sets, snapshots)
  └─ historyService      day scores, per domain, against each day's snapshot
       ├─ ratingService  the legacy undivided progression (RC2's rating)
       └─ bossService    per-domain ledgers + the Boss series
  └─ gymService          gym sets → core/gym/performance → progress figures
       └─ gymRatingService      attendance + windows → the Gym rating
  └─ runningRatingService  runs → core/running/performance → the Running rating

  core/scoring/*  the model both training domains share, from the percentage
                  change onwards: curve, target, movement, Endurance, decay,
                  Maintenance, the fold
```

- **Nothing derived is stored.** Everything above is replayed on load.
- **Business logic never sits in a component.** `core/*` is pure and testable;
  `storage/services/*` joins it to IndexedDB; `features/*` renders.
- **Config snapshots carry the era.** A missing field marks a period: no
  `boss` = RC2, no `scoring.model` = flat Wellbeing scoring. Never backfill.

### Files worth knowing

| Path | Purpose |
|---|---|
| `src/core/model/index.ts` | Every record shape; `SCHEMA_VERSION` |
| `src/core/config/constants.ts` | Every tunable number; ranks; `SCORING_MODEL` |
| `src/core/domains/index.ts` | Domain registry; `WEEKLY_DOMAIN_TYPES` includes legacy `sports` |
| `src/core/scoring/dayScore.ts` | One day's score, both models, all domains |
| `src/core/rating/index.ts` | The 0–1000 EWMA fold |
| `src/core/ranks/index.ts` | Ladder, hysteresis, rank history |
| `src/core/ranks/progress.ts` | **The only** progress-bar calculation |
| `src/core/ledger/index.ts` | The three per-domain quantities |
| `src/core/boss/index.ts` | Boss scale, weights, and the anchored series |
| `src/core/gym/performance.ts` | Best set → comparison → muscle group → aggregate; the trend and YTD windows |
| `src/core/gym/load.ts` | Effective load: external, bodyweight, assisted |
| `src/core/gym/muscles.ts` | 70/30 primary/secondary influence |
| `src/core/gym/volume.ts` | **Shown, never scored** (D152, block 7C): the work volume — Σ reps × effective load over the working sets, per group and week. `volumeUnscored.test.ts` holds that nothing that rates reads it |
| `src/core/scoring/performanceCurve.ts` | **Shared.** The curve, attendance, the two-window blend |
| `src/core/scoring/trainingRating.ts` | **Shared.** The 40/60 target, movement, Maintenance, the fold |
| `src/core/scoring/endurance.ts` | **Shared.** The first-promotion gate |
| `src/core/scoring/abstinence.ts` | **Shared.** Episodes, the four decay schedules, rank intervals |
| `src/core/running/performance.ts` | Distance bands, pace ratios, the window aggregate |
| `src/core/food/adherence.ts` | How a Food-era day's 1–10 replays (Food itself retired, D139) |
| `src/storage/configService.ts` | The snapshot log and its ensure steps: the P8 era (D132) and the Food switch-off (D139) |
| `src/i18n/domainNames.ts` | The one name map for the offered domains — Mind, Gym, Laufen (D143) |
| `src/core/gym/catalogue.ts` | 134 built-in exercises (block 7D, D188), stable ids, explicit muscles, roles, load types, equipment and movement — each written down on its entry, never read from a name. The 49 before block 7D are held by three tables in `catalogue.test.ts`, the 85 of 7D by a fourth |
| `src/core/gym/search.ts` | **The picker's search** (block 7D, D188): an exercise found by its names, detail, primary groups with their everyday words, movement, equipment and body weight — the words of one place per language — folded for case and umlauts, by the beginning of a word, every word narrowing; five tiers of order, alphabetical within each. Nothing that rates reads it |
| `src/core/decay/index.ts` | **The** general cooling-off formula (D113) — one source of truth for the schedule, the cap and model selection; on the live path |
| `src/core/migration/legacySport.ts` | RC2 Sport conversion planning (pure) |
| `src/storage/db.ts` | Stores and the numbered migrations |
| `src/storage/services/historyService.ts` | Replays the past, per day, per domain |
| `src/storage/services/bossService.ts` | Ledgers, Boss series, era transition |
| `src/storage/services/gymService.ts` | Catalogue seeding, sets, bodyweight, gym replay |
| `src/storage/services/gymRatingService.ts` | Gym's rating state, the era join, window memoisation |
| `src/storage/services/runningRatingService.ts` | Running's rating state, the era join, window memoisation |
| `src/storage/services/checkInService.ts` | Today; owns the edit-window rules |
| `src/storage/services/legacySportService.ts` | The one-time RC2 Sport question, and applying the answer |
| `src/core/pause/index.ts` | **The** pause semantics — coverage, validation, standing. One canonical `isPausedOn` |
| `src/storage/services/pauseService.ts` | Declaring, editing, ending a pause; every rule enforced on the write |
| `src/features/pause/*` | The Areas section that plans and ends one |
| `src/components/metrics.tsx` | **Pass 2.** `MetricTile`, `MetricBoard`, `MetricBar`, `MetricDetailSheet` — a tile states, a sheet explains; built on the one `Sheet` primitive |
| `src/app/route.ts` | **Domain terminal.** The one navigation state, mirrored to the hash (`#/areas/<area>`); Back walks the areas visited |
| `src/app/backLayer.ts` | **A layer that Back closes** (block 7C, D185): the muscle sheet and the exercise detail opened from it each own one history entry with the address of the screen they lie on; the entries follow the layers by counting. `route.ts` knows of layers only that a move from a layer's entry takes that entry over |
| `src/components/sheetDetents.ts` | **A sheet with two heights and a finger** (block 7C, D185): the two heights as offsets, whose drag it is, where a release lands (`SHEET_DRAG`). Used by `Sheet` when it is given `detents` — today by the muscle sheet only |
| `src/features/areas/DomainSwitch.tsx`, `GymTerminal.tsx`, `RunningTerminal.tsx`, `CreditsSection.tsx` | **Bereiche is the terminal**: Mind · Gym (D143), one area at a time. Gym carries its board, the muscle module, and Laufen as a separate section; Einstellungen names the body model's source (MakeHuman, CC0 1.0 — no credit is owed, D165) |
| `src/features/body/` | **The 3D body.** `BodyViewer` (R3F canvas, camera rig, tap-vs-drag, the approved material treatment with the neutral selection cue), `useGLTF`, `BodyBoundary`, `bodyVisuals.ts` (the adapter from `MusclePerformance` to tint and intensity), `muscleMeshMap.ts` (the id ↔ GLB contract), `tokens.ts` (identity and state colours, the single colour source). `index.ts` is the **lazy boundary**: three.js and the renderer live in their own chunk and are fetched only when the Gym module renders. **Since block 7B** (D182) how the body is operated is arithmetic of its own, each with its unit test: `motion.ts` (the named values, a coast and a travel as the exact solution of their equation over the time that passed), `picking.ts` (what a tap means: the surface seen, twelve pixels of tolerance), `framing.ts` (the one framing of every stage, and a zoom as a window on the picture); `BodyGround.tsx` is the disc under the feet, `FrameProbe.tsx` says when a frame ended at rest |
| `src/features/gym/MuscleModule.tsx`, `MuscleStrip.tsx`, `MuscleRows.tsx`, `Sparkline.tsx`, `muscleAnalytics.ts` | **Muskelgruppen.** The metrics strip, the body on its stage (55 % of the visible height, no card; its still `assets/body-stage.webp` until the first picture), the ten rows below, and one chosen group — the one whose sheet stands — held by `GymProgress` (block 7C). `MuscleSheet.tsx` is that sheet and `muscleSheet.ts` its view: the row's own state and figure, the group's line, its exercises with their one change in the range (`exerciseChanges`), the work volume per week, and what is missing where a group has too little or was not trained (D186); it computes nothing. Above the open sheet `MuscleModule` names the strip of the stage that is left, and the camera shows the group in it (D185). `toMuscleAnalytics()` derives each row read-only from the loaded history: state, delta, last trained day, and the trend — the group's over-span change since the range began, as of each training day, via `gymPerformanceOverSpan()` on the history prefix, so the last point *is* the row's delta. The chart is the handoff's `spark80`: per-row min/max, flat when equal, a dot for one observation, nothing for none |
| `public/models/momentum-body.glb`, `tools/validate-body-glb.mjs` | The model (built by `tools/body/` from MakeHuman's base mesh, CC0 1.0; 50 152 triangles, one primitive per muscle id plus `none`; D165, D167) and the contract validator that runs first in `npm run build`: structure, envelopes, the straight cuts of the inert zone and of the knee, the check points of the regions, eleven measures, the licence notice |
| `tools/body/` | **The body's pipeline.** One command builds the model byte for byte (`build.py momentum-body --install`); `README.md` has the commands, the data's source and licence, `MEASURES.md` the measures. `measure-body.mjs` and `checkpoints.mjs` are what the validator reads the surface with |
| `src/features/measure/` | **The measuring display** (block 7B, D181): `measure.ts` (the recorder and the switch, in local storage), `readout.ts` (its lines), `BodyReadout.tsx`, `MeasureSetting.tsx`. A tool, off by default; it knows nothing of three.js — the viewer reports to it |
| `src/app/stillness.ts` | **A sheet stands over a still body** (D146, D182): whatever can draw by itself joins, every `Sheet` asks and stands once all rest |
| `src/components/BodyRenderer/index.tsx` | Muscle diagram; presentation only |
| `src/features/gym/*` | Session logging, picker, bodyweight, overview, exercise detail, progress |
| `src/features/running/*` | The Running overview and its distance ranges |
| `scripts/verify/` | Browser + accessibility suites (see its README) |
| `.github/fixtures/` | RC2 export + a 120-day synthetic profile |

## Implemented state

**Fully implemented and usable**
- Mind (the wellbeing domain, D143): categories, custom questions, daily
  check-in, drill-down history
- Gym: exercises, sets, picker, session logging, performance pipeline,
  muscle-group aggregation, body renderer, exercise history, progress hierarchy
- **Gym scoring: the 40/60 rating, the trend and year-to-date windows, the
  Endurance Phase, abstinence decay, Maintenance, bodyweight and assisted
  exercises, 70/30 muscle roles, and the Gym overview that explains them**
- **Running: the 40/60 rating, distance-band identities, pace over the trend
  and year-to-date windows, the Endurance Phase, abstinence decay,
  Maintenance, optional distance/duration entry with derived pace, and the
  Running overview that explains them**
- Boss Rank (the only rank, D125), user-configurable weights, mystery ladder
- Backup export/import, PWA, offline, migrations v1→v2→v3→v4→v5
- **Pause periods, end to end** (D116). Bounded to 28 days, prospective only,
  suspending inactivity penalties across every domain without fabricating
  activity — planned and ended in Areas, stated on Today, and read once per
  replay by `loadHistory`.
- **Legacy Sport migration, end to end.** A migrated RC2 user is now offered
  the one-time question in Areas and pointed at it from Today (D112). The
  conversion engine is unchanged — it was always correct, it simply had no
  door.

**WP2-1 — exercise catalogue and training plans** (branch
`claude/momentum-gym-plans`, not merged)
- The catalogue has 48 entries (`src/core/gym/catalogue.ts`): the 29 from
  iteration 2 with their roles and English record names unchanged, plus 19
  approved ids. It is now the **presentation source** for a built-in — a
  localised name (de-CH / en) and an anatomical detail label — while the
  seeded `exercises` record stays the id anchor and fallback, never
  rewritten (`features/gym/exerciseNames.ts`). Roles are pinned in
  `catalogue.test.ts`.
- Training plans live in the existing `gymPlans` store as
  `TrainingPlanRecord` (`kind: 'userTrainingPlan', version: 1`); at most
  `GYM.MAX_PLANS` (5). Service: `storage/services/trainingPlanService.ts`;
  UI: Bereiche → Gym → Trainingspläne (`features/gym/TrainingPlansSection`,
  `PlanEditor`). A record of any other shape in that store is preserved and
  never shown.
- A planned workout is a **draft** until its first set is saved
  (`gymService.startSessionFromDraft`); the session then owns an ordered
  exercise snapshot (`GymSessionRecord.exercises`, absent on every free or
  pre-WP2 session) and `planId` is provenance only. One session per day.
  Extras land in the snapshot, never in the plan. Screenshots and the
  browser proof: `scripts/verify/wp2-1-shots.mjs`, `docs/design/wp2-1/`.
- `SCHEMA_VERSION` and `BACKUP_FORMAT_VERSION` are unchanged (5 / 3).
- **Scoring equivalence** (`planEquivalence.test.ts`, 20 seeded runs):
  manual and plan entry write identical set and session rows; every
  discrete output is identical; floating outputs agree to within the same
  last-ULP effect a manual-vs-manual control shows. Exact float equality is
  not a plan invariant under the current engine — see the determinism debt
  below.

**WP2-2 — Gym navigation** (same branch, not merged)
- `#/areas/gym` is the **Gym hub** (`features/areas/GymTerminal.tsx`):
  Training (this week, last session, *Training erfassen*, the plan count
  with *Pläne verwalten*) → the *Muskelgruppen* entry card → the rating board → the
  plans → the Gym card and Laufen as before. `#/areas/gym/muscles` is the
  **muscle destination** (`features/gym/GymMusclesScreen.tsx`): the range
  control and the whole `GymProgress` hierarchy — overall tile, the 3D body
  behind its unchanged lazy boundary, the ten rows, the exercises — and it
  exists before the first workout with everything untrained. The route
  model gained one optional `section` (`app/route.ts`, `mergeRoute`,
  `leave`); the section's back control walks the pushed entry.
- Heute: the Gym label is *Gym öffnen* → hub; *Session eintragen* is the
  unchanged quick log. Both use `features/gym/useTrainingLauncher.tsx`.
- Only the muscle destination fetches the viewer chunk and the model
  (`release-proof.mjs`, `wp2-2-shots.mjs`); `gymHub.test.tsx` pins that no
  hub file imports `features/body`. Screenshots: `docs/design/wp2-2/`.
- The entry card's body is a **still of the approved model**:
  `features/gym/assets/body-preview.webp` (16 kB, 240 × 522) is
  `momentum-body.glb` rendered once through the real viewer with its data
  colours off — one figure in the inert zone's tone, which says neither
  "trained" nor "not trained yet" (D166) — by
  `tools/render-body-preview.mjs`; regenerate it from there when the model
  changes, never redraw it. It has no regions and takes no colour; ten
  markers beside it carry the groups' states from the same history the
  module shows (grey before the first workout). The bundled SVG diagram
  stays what it was: the muscle module's stand-in where WebGL is missing.
- The training line is the same two stored values read three ways — a
  fraction only below target, *Ziel erreicht* at it, *· Ziel n* above it —
  so "7 von 3" never appears (`weekSentence` in `TrainingCard.tsx`).
- Polish pass before merge (six approved findings, presentation only): the
  set row's inputs size from their content — the weight input never below
  five characters, the reps input never below two, padding two steps below
  the shared field's, minimums released under 360px; the no-data guidance on
  the muscle destination is a state line over a hint inside one status; the
  entry card carries no section label (it names itself); the pending set
  row has no helper sentence beneath it (the row is the instruction);
  counts are figures everywhere (`1 Plan`, `1 Übung`); and the "Laufen"
  heading that `RunningTerminal` repeated under the area's own is gone.
  Before/after pairs: `docs/design/wp2-polish/`.
- Follow-up debt from the pre-merge gates, none of it blocking: the
  repository's default branch is named `claude/momentum-pwa-spec-j82dhm`,
  which CI configuration and documentation will have to name explicitly;
  a saved set row re-syncs both fields from storage after either commits,
  so a value typed into the other field within that window is overwritten
  (timing-dependent, not reached at typing speed); the chooser's
  *Pläne verwalten* link sits 4px right of its label; the Training card's
  footer keeps the 44px link's air; the session screen's title repeats
  "Session"; two-word exercise names wrap at 360px behind the 44px controls.

**WP3 Stage 1 — bug fixes** (branch `claude/momentum-wp3`, not merged)
- One "today" (`app/useToday.ts`): it moves at local midnight (a calendar
  timer, correct across DST and a missing midnight), when the app comes back
  into view, and at the start of any input. Heute withholds every control
  until the new day has loaded, shows a retry if that load fails, and keeps
  what floats over the day — the workout, the plan chooser, the run sheet,
  the food entry sheet, with what was typed — mounted across the change;
  focus and scroll come back to where they were.
- One change signal (`storage/changes.ts`): raised after a committed
  read-write transaction, once per burst. The Boss card, the Gym and Running
  boards, the hub's cards and the domain standings reload on it and on the
  day changing; `useLoadable(load, deps, refreshOn)` keeps a failed refresh
  stale and makes a failed load for new inputs a failure. A full-screen
  workout holds the signal and releases it when it closes, after the write
  in flight has landed.
- The workout's day is fixed when it opens; an existing session shows its
  own day. (Superseded in Stage 3b: a draft no longer moves to Monday, and
  bodyweight entries follow the one write rule — today and yesterday, D133,
  D137.)
- One toast (`components/Toast.tsx`): an outlet above the banners and tab
  bar, `useToastLift` for a screen with its own bar (the workout's sticky bar
  in Stage 2), below the sheet layer — sheets render into `<body>` — and
  dismissed when a sheet or a workout opens. One-tap run logging is one write
  per press, with undo; refused writes are said out loud.
- Presentation: the hub's week line reads Heute's weekly progress (D127),
  the attendance tile reads a zero target as the start week or a switched-off
  domain, number/sign/state agree on the rounded figure (`muscleState.ts`),
  list reset, spacing, picker details, `ex_front_raise`.
- Verification: `wp3-sheets`, `wp3-reload`, `wp3-midnight`, `wp3-stage1`
  (see `scripts/verify/README.md`); screenshots in `docs/design/wp3/stage1/`.
- **For Stage 3 (decided at STOP 1):** once yesterday stays editable, drop
  the Sunday→Monday move for drafts (`draftDate` in `GymSessionScreen.tsx`):
  a draft keeps the day it was opened for, like a workout.
- Real-device preview: the Stage 1 build is published to Momentum-preview
  (`aa32127`, https://hnd7k02.github.io/Momentum-preview/).

**WP3 Stage 2 — the workout flow** (branch `claude/momentum-wp3`, not merged)
- A free workout is a draft until its first saved set (D128): opening,
  picking and leaving store nothing; a picked exercise waits in a pending
  row (no 0×0 set); picked exercises stay on screen until the workout is
  left; the first saved set creates one bare session (`openSessionForDay`),
  as a planned workout's first set always created its session
  (`ensureSession` in `GymSessionScreen.tsx`).
- "Übung hinzufügen" lives in a bar at the foot of the workout
  (`.gym-session__bar`, `--workout-bar-height`, safe-area aware). Removing an
  exercise is a worded "Entfernen" control; a set keeps its minus. Both
  removals undo for 5 s by putting the same rows back (`restoreSet`,
  `restoreExercise`; D131), refused once the day has closed (the week, until
  Stage 3b's D133). Every write of
  the screen goes through one queue (`run`), double taps through `tap`; a set
  row writes only the field whose text changed.
- "Fertig" stores `finishedAt` (D129): `null` while running, a timestamp
  once finished, absent on every session before the field — read as
  finished, never backfilled, read by nothing that scores. Heute shows the
  running workout above the Boss card (`RunningWorkoutCard`,
  `loadRunningWorkout`): a plan as the share of planned exercises with a
  saved set (extras excluded), a free workout as "n Übungen · m Sätze",
  with a placeholder slot for the Gym companion; the hub's Training card
  says the same and offers "Training fortsetzen".
- Gewichtseinheit kg | lb in Einstellungen (D130): `settings.weightUnit`, a
  display preference, never a snapshot. One formatter and parser
  (`core/gym/weight.ts`, `app/useWeights.tsx`): 1 lb = 453.59237 g, typed lb
  rounded to whole grams, lb shown with at most one decimal; sets, the
  last-time line, best set, bodyweight, exercise detail and progress figures.
- Review (four reviewers, each finding verified): every workout action now
  decides from what is stored when its turn in the write queue comes, not
  from the render it was tapped on (D131) — the tap's own blur may just have
  saved a set or made the draft a session. Removals return what they
  removed and the undo restores exactly that; "+ Satz" copies the stored set
  before it (`repeatLastSet`); a pending row saves when the focus leaves the
  row; a weight is unchanged by value, and an emptied field is not zero
  (D130); a repeated plan line counts once; "Fertig" never stamps a
  pre-field session (D129); a unit or language that failed to store goes
  back. All reproduced first in `workoutScreen.test.tsx`,
  `workoutFlow.test.ts` and `app/useMomentum.test.tsx`.
- Verification: `wp3-stage2` (see `scripts/verify/README.md`), the service
  tests in `workoutFlow.test.ts` and `weight.test.ts`, the screen tests in
  `workoutScreen.test.tsx`; screenshots in `docs/design/wp3/stage2/`. At
  STOP 2: `tsc -b` clean, `npm run test` exit 0 (96 files, 1426 tests),
  build clean, every browser suite green — `wp3-stage2` 198/198 on the
  Wednesday, Sunday and Monday clocks, `release` 82/82. `gym-muscles` is
  72/72 run alone (twice); under three suites in parallel two of its
  frame-timing checks each missed once (89° for 90°, 3 hidden frames for 9
  watched), in the 3D viewer Stage 2 does not touch. Golden files and
  fingerprints byte-identical; no scoring file changed. `release`, `phase4-a11y`, `phase8` and
  `wp3-sheets` now log a real set where they used to count an opened
  workout.

- Real-device preview: the Stage 2 build (`fbd4942`) is published to
  Momentum-preview (`cf81a3b`, https://hnd7k02.github.io/Momentum-preview/).
- **Decided at STOP 2, built in Stage 3b:** (1) a session the user empties —
  its last set or exercise removed — is deleted, since a session without
  sets should not exist (P6); bare sessions stored before P6 stay history;
  (2) a finished workout runs again only when a *new* set is added to it,
  never when an existing set is corrected; (3) an assisted exercise needs
  its load typed — an explicit 0 stays allowed for "no assistance"; (4) the
  global double-tap guard stays; (5) the bundle growth is accepted.
- Gates: the 3D timing suites (`gym-muscles`, `body`, `body-reach`) run
  alone, never in parallel (`scripts/verify/README.md`).

**WP3 Stage 3a — the edit window gate** (no production code)
- The analysis is in `docs/design/wp3/stage3a-window.md`: every consumer of
  the day window and the week clock, what moves under each variant
  (measured), the midnight drops a P8 backfill would reverse, and the
  proposal — the window as an era (`editWindowDays` read per day, a new
  optional `scoring.sessionWindowDays` marker, the P8 snapshot appended on
  first load, one write rule). Decided at STOP 3a and built in Stage 3b.

**WP3 Stage 3b — one day back (P8)** (branch `claude/momentum-wp3`, not merged)
- **The window is an era** (D132): `scoring.editWindowDays` is read per day
  (absent → the legacy 3) and the optional `scoring.sessionWindowDays`
  marks the P8 era; `ensureSessionWindowEra` appends it on the first load
  after the update. A week takes its era from its Monday.
- **One write rule** (D133, `core/config/closure.ts`): today and yesterday on
  a P8 day, for every write; sessions also only in a week still in progress.
  A Gym session keeps its day; no backfill reaches a day its domain was off.
- **Nothing is charged while it can still be written**: a P8 week is judged
  on Tuesday 00:00, with a week holding a session counted as met until then
  and an empty one as no data (D134); an abstinence charge waits for its day
  to close, and the break tiles say it is pending (D135); D126 counts settled
  days, for a promotion and for the demotion counter (D136).
- **STOP 2 follow-ups** (D137): an emptied workout is deleted and comes back
  with the same id; only a new set reopens a finished one; an assisted load
  is typed; the Sunday→Monday draft move is gone.
- **Heute | Gestern** (D138), "Gestern ist noch offen", the run sheet on the
  writable days only, the closed copy "Dieser Tag ist abgeschlossen."
- **Golden files.** Everything before P8 is byte-identical: the six original
  golden files, `.github/fixtures/stage2/`, every fingerprint. The P8 files
  are re-frozen at STOP 3b as their own deliberate commit; every moved value
  lies on a day of the P8 era and is explained in the STOP 3b report.
- **Recorded, not changed (STOP 3a, Q11):** the Wellbeing ledger folds
  `entry.score` where the rating tracks `recordedScore`, and a silent day 0
  pins the Boss opening at 0. Both are a separate scoring gate after WP3, as
  their own era.
- Verification at STOP 3b: `tsc -b` clean, `npm run test` exit 0 (101
  files, 1532 tests), build clean (main 147.79 kB gzipped). Every browser
  suite green — `wp3-stage3` 153/153 (new), `release` 82/82, `wp3-midnight`
  139/139, `wp3-reload`, `wp3-sheets`, `wp3-stage1`, `wp3-stage2`, the phase
  suites and their accessibility suites, `geometry`, `terminal`,
  `release-proof`, `wp2-1-shots`, `wp2-2-shots`, `stage4-shots` 37/37; run
  alone, `gym-muscles` 72/72, `body` 39/39 (three times), `body-reach` 3/3.
  Screenshots in `docs/design/wp3/stage3/`.
- Suites repaired at STOP 3b, no check loosened and no app code changed:
  `wp3-midnight` reads the date label only once Heute has loaded (the date
  stands above the load gate, D138); `stage4-shots` seeds its pending and
  promoted presets one day longer, since a P8 profile's yesterday is not yet
  settled (D136), and now exits 1 on a failure; `body`'s settle also waits
  for the render loop to stop (an inertia coast outlasted 1.5 s of an
  unchanged whole-degree angle), and its tap grid turns the body back after a
  far-side hit; `status-shots` and `qa-shots`, broken before WP3, name the
  question they answer and look for Laufen on the hub.
- **Found, not changed (pre-WP3):** a tap on the trapezius seen from the
  front selects `back` and turns the body round — the turn-into-view rule in
  `BodyViewer.tsx` was written for list selections and fires for taps too.
  **Decided at STOP 3b: a tap never turns the body; only a list selection
  does — built in Stage 7**, where the muscle interaction changes anyway.
- Real-device preview: the Stage 3b build (`188ff3d`) is published to
  Momentum-preview (`246f47a`, https://hnd7k02.github.io/Momentum-preview/).
- **Decided at STOP 3b:** (1) the break-tile copy stays as shown; (2) the
  demotion counter counts settled days, as built (D136); (3) on Gestern a
  standard question whose stored text is unchanged reads in its "gestern"
  wording, display only — built in Stage 4; (4) the Gym branch of
  `deleteSession` is fixed in Stage 4, the other known limitations stand;
  (5) the bundle growth is accepted.

**WP3 Stage 4 — Mind and Gym** (branch `claude/momentum-wp3`, not merged)
- **Food is off as an era** (D139). `ensureFoodRetired`, the third ensure
  step of `loadConfiguration`, switches Food off from the first load after
  the update wherever it is still on — the live record (its settings kept),
  the snapshot in force today, a snapshot dated later — carrying the
  configuration over with Food's entry disabled and the Boss weights worked
  out again over what remains, from the user's parts or equally. Keyed on
  the data, idempotent, with D132's boundary rule. Every day before replays
  byte-identically; from that day the Boss moves by the remaining domains,
  with no jump.
- **Nothing creates Food data, and nothing deletes it** (D140): the service
  writers, the onboarding field, the Heute card and sheet, the focus editor
  and the area are gone, and `enableDomain` refuses Food. The stores,
  repositories, types and backup collections stay; the backup format is
  unchanged.
- **The update day** (D141): yesterday's Food — still on in its own
  snapshot — is not shown, counted, pointed at or writable. The recorded
  cost: a rating still to be given for it is lost, and the day closes with
  Food missed in `score`; `recordedScore` and the Boss are exactly what they
  would be had the rating simply not been given.
- **Mind** (D143): one name in German and English, every label from one
  key; the terminal is Mind | Gym; onboarding offers two worlds, with "Gym" taking
  Laufen in; `#/areas/food` lands on Bereiche.
- **The STOP 3b carry-overs:** Gestern speaks of yesterday in the standard
  questions whose text is unchanged (D144); the check-in delete refuses a Gym
  session (D142).
- **Golden files.** The Food-off profile frozen before any Stage 4 code
  (`db6076a`) is unchanged, and `foodRetirement.test.ts` proves it is exactly
  what the step writes. Every other golden file, `.github/fixtures/stage2/`
  and every fingerprint are byte-identical.
- **Tests.** Food-era history is seeded through the repositories
  (`fixtures/legacyFood.ts`), never through a service. New:
  `foodRetirement.test.ts`, `questionLibrary.test.ts`,
  `OnboardingFlow.test.tsx`, `DomainSwitch.test.tsx`; in the browser,
  `wp3-stage4.mjs`. `phase6` and `phase6-a11y` were retired with the Food
  screens, and every suite onboards through Mind and Gym.
- **Review of Stage 4** (four reviewers, every finding put to a skeptic): a
  write on a day before a kept switch-off no longer moves it
  (`ensureCurrentSnapshot`, D139), and the same holds for D132's P8
  boundary, which a configuration change on that day used to move; a restored snapshot holding an entry that
  is not one no longer blocks the load; a yesterday that had only Food is
  not called empty (D141); Rang's list and its Gewichtung card print one
  rounding (`wholePercents`); the switch's dead two-row rule and the unused
  onboarding sports-step styles are gone. Refuted and left: the retired
  Sport log reachable through a mislabelled update or delete (the argument
  is never read there), and the sleep wording (a recorded decision, D144).
- Verification at STOP 4, on the final build: `tsc -b` clean, `npm run
  test` exit 0 (105 files, 1584 tests), build clean (main 143.29 kB gzipped,
  4.50 kB less than Stage 3b). Every browser suite green — `wp3-stage4`
  170/170 (new), `release` 83/83, `terminal` 43/43, `geometry` 111/111,
  `wp3-stage3` 153/153, `wp3-midnight` 139/139, `wp3-sheets` 330/330, the
  phase suites and their accessibility suites; run alone, `gym-muscles`
  71/71, `body` 39/39, `body-reach` 3/3 twice with identical tallies.
  Golden files and fingerprints byte-identical; nothing re-pinned.
- Suite repaired at STOP 4, no check loosened and no app code changed:
  `body-reach` measured a moving body — the view pills sit over the canvas
  and the grid tapped them, a far-side hit turned the body, and pressing a
  pill through Playwright scrolled the module — so four runs of one build
  gave four results. It now skips cells under a control, turns the body
  back after a far-side hit and presses the pills in place. At 320 the
  region below the 12px pitch is now the forearms, not the triceps; the
  accepted count, 9 of 10, holds.
- **Decided at STOP 4:** (1) on Gestern the sleep question reads "Wie gut
  hast du in der Nacht auf gestern geschlafen?" (D144); (2) a Gym session is
  removed only in its workout, as built (D142); (3) the update day's
  yesterday stays as built (D141); (4) a profile that had only Food is left
  with nothing set up, and no note says Food has left; (5) the question
  category keeps its name "Mental"; (6) the Bereiche heading below the open
  area reads "Weiteres" / "More"; (7) the Stage 4 build goes to the preview.
  **Order change:** Stage 6 (the visual system, P11) comes next, then Stage 5
  (the Gym metric, P10); Stage 7 stays after both.
- Real-device preview: the Stage 4 build (`52fe355`) is published to
  Momentum-preview (`58c287f`, https://hnd7k02.github.io/Momentum-preview/).

**WP3 Stage 6a — the visual system, two variants** (branch `claude/momentum-wp3`,
not merged; the choice between the variants is the owner's at STOP 6a)
- **Two worlds, one vocabulary** (D145). `:root` is Mind, light, and the
  shell every shared screen is drawn in; `[data-world="gym"]` is Gym, dark,
  with one neon accent, redefining colours only. A screen declares its
  world (`app/world.ts`, `useWorld`), the claim is counted and the document
  carries it on `<html>`, so the tab bar, a toast, a sheet rendered into
  `<body>` and the status bar (`theme-color` from `--status-bar`) follow.
  Bereiche declares the world of the area it shows — the switch is the
  door, the whole screen turns; Muskelgruppen, the workout and the exercise
  detail declare Gym wherever they were opened from. A training card on
  Heute is a Gym tile (`data-tile="gym"` on the card, never on its section).
- **Glass** (D146): cards and sheets are a translucent fill over the ground,
  blurred behind, under a hairline light border; the ground is one painted
  layer on the shell; one blur per card; the solid `--glass-solid` where blur
  is unsupported, where less transparency was asked for, and on a Gym tile
  standing on a light screen. Nothing blurs over or under the 3D canvas
  while it can move: `stage6-blur-cost.mjs` measured the card holding the
  canvas as glass at a sixth more per frame at the median and double at
  the 95th percentile while the body turns (SwiftShader, so relative
  only), and the body's card is solid.
- **Text on glass is measured** (D147): `textContrast()` reads the rendered
  pixels under every visible run of text; `wp3-stage6a.mjs` holds body text
  at 4.5:1 and large text at 3:1 on every screen it shows, in both worlds
  and both variants (`docs/design/wp3/stage6a/text-contrast.json`). The
  light secondary moved to #65656f and the ground's washes are bounded by
  it. Captions (`--text-tertiary`, about 2.5:1 on light by an earlier
  choice) are reported, not held — a STOP 6a question.
- **Two variants, as built.** A, the build: navy ground, neon mint, frosted
  glass with a hairline border, a Gym card on Heute as a dark tile. B,
  `src/styles/stage6-variant-b.css` behind `data-variant="b"` on `<html>`
  (set only by the screenshot suite): graphite ground, neon violet, the
  glass_kit reference's gradient fill and 1.5px gradient border, a stronger
  wash on Mind with its secondary a shade darker, the Gym card on Heute
  light with the label in the Gym accent. One is removed at 6b and the
  other folded into `tokens.css`; the temporary `:root:not([data-variant="b"])`
  selector in `tokens.css` and the `@import` in `global.css` go with it.
- **Tests.** `contrast.test.ts` parses the token blocks and holds four sets
  (Mind A, Gym A, Mind B, Gym B) each against its own ground — the card
  solid and the base — with every promise of the light set kept and the
  dark reading of each ("the empty cell darker than every fill", the label
  on a fill `--text-on-accent`); `world.test.tsx` (counted claims, the
  theme-colour rewrite); in the browser `wp3-stage6a.mjs` (64 checks: the
  world attribute follows the screen and comes back, the status-bar colour
  with it, a sheet from a Gym screen is drawn in Gym, no overflow, text over
  glass on thirteen screens × two variants) and `stage6-blur-cost.mjs`
  (the body's card solid as built against the card as glass, the pills
  as glass, a layer over the body).
- Found in passing: `--surface-primary` was referenced by the stale-notice
  button and the rank-change mark and never defined, so the one had no
  background and the other no ring; both read `--surface-elevated` now.
- **Review of Stage 6a** (three reviewers, each asked to refute its own
  findings before reporting): the domain identity aliases resolved on the
  root and so a Gym tile on Heute drew its meter in the light mint — they
  are declared again inside the Gym block; the suite's "sheet is not white"
  check could not fail and now holds the sheet's luminance in the Gym world;
  the blur-cost script measured the body's card solid against solid once the
  card was made solid, and now forces the glass on for that arrangement;
  a text measurement with no rows passed, and now fails; `world.test.tsx`
  unmounts every screen it mounted; the contrast test models B's cascade in
  the browser's order and tolerates a last declaration without its
  semicolon; the docs no longer say "colours only", "nothing blurs over the
  canvas" without the still-body exception, or "four tokens".
- Verification at STOP 6a: see the STOP 6a report; the numbers are recorded
  there and carried here at 6b.
- **After STOP 6a, while the choice is open** (the owner's "go ahead" with
  the questions unanswered): the two variants ran at 430 and 320 as well —
  A clean at both; B's Gym label on Heute measured 4.45:1 on B's wash at
  430, so B's mint ink darkened to #0a6e55 and B was re-run, 64/64 at 430
  and 320. Nothing that depends on the choice was touched. And Stage 5's Gate G was taken, before
  any production code: `docs/design/wp3/stage5-gateG.md` compares the best
  set, the mean set score and the total volume through the real pipeline
  over a purpose-built history, recommends keeping the best set, and
  measures the deterministic set order (no golden value moves; one Gym
  golden file's row order would). STOP 5a waits on the owner with STOP 6a.
- **Open at STOP 6a:** the variant (or a mix of palette, glass and tile);
  whether Bereiche turns whole or only below the switch; captions at 4.5:1;
  the status bar (`default` with `theme-color` per world, or the preview's
  `black-translucent`), which only the iPhone settles; the Stage 7 sheet
  over the body pausing the render loop; the plan chooser and the run sheet
  opened from Heute staying light; `body-preview.webp`, a palette-independent
  alpha cut-out that reads on the dark tile, re-rendered at 6b only if the
  body's lighting changes for the dark ground.

**WP3 — the November review and the owner's decisions** (branch
`claude/momentum-wp3`, not merged)
- A read-only review of the branch at `7e2a5ce` is
  `docs/wp3/review-2026-11.md`; the owner approved it on 2026-11-11.
- **STOP 6a is decided** (D148, D149): variant B as built, folded into
  `tokens.css` at 6b; Bereiche turns whole; captions at 4.5:1; the status
  bar `default` with a `theme-color` per world, accepted on the iPhone; the
  render loop paused under the Stage 7 sheet; the plan chooser and the run
  sheet light from Heute; `body-preview.webp` not re-rendered in 6b.
- **STOP 5a is decided** (D150–D152): the best working set by a strength
  score as an era from the first load, warm-up sets marked by hand, the
  work volume shown and never scored. Gate G's recommendation to keep the
  best set stands; its set score changes.
- **Further decisions** (D153–D157): the muscle status with a tolerance
  band, colour with three jobs and no mint in Gym, the single-colour
  anatomical body with inert hands, stage 1 of the model plus a BodyParts3D
  proof gate, the tidy-up of the public repository and the licence.
- **Block 0 — the visual contract** (no production code):
  `docs/wp3/vertrag.md`, **approved at STOP 0 on 2026-11-11** (D160, D161),
  with three mock-ups under `docs/wp3/mockups/`. It replaces D89. Areas
  carry no colour of their own; a value bar is neutral, and a met weekly
  target is the one bar in the `strong` status; the status fills stay as
  they are; white is held and the dimmed tone is untrained and the inert
  zone; the body stage takes 55 % of the height; the Gym tile on Heute
  leads to the body; the muscle sheet opens at two thirds.
- **Answered by the owner on 2026-11-11:** his usual reps are about 6–12;
  he has not logged warm-up sets so far and wants to be able to, without
  them counting; drop sets yes, deloads no, pyramids "his own decision"
  (read as: no special rule — section 4 of the 5b prompt). His phone is an
  iPhone 15 Pro on the newest iOS; the exact version is recorded with the
  first measurements at STOP 7B — iOS 26.3.1 on 2026-11-16 (D184). He has
  no Mac.
- **Answered by the owner on 2026-11-11, at the start of the colour-rules
  block** (his answers to the questions the prompt session left open):
  - *The live address.* His account used to be `dario02king`; GitHub does
    not redirect Pages after a rename. The live app is at
    <https://hnd7k02.github.io/Momentum-App/> — **the same origin as the
    preview**. He checked in Safari that the new address loads. **The old
    address, `dario02king.github.io/Momentum-App/`, does not load** (owner,
    2026-11-13; his first answer had left it unfilled). He opens the live
    app **as an app from the Home Screen**.
  - *The preview gets its own database from this block on.* A preview build
    is built with `VITE_MOMENTUM_DB=momentum-preview` and opens that
    database; the ordinary build stays `momentum` (`storage/db.ts`,
    `databaseName()`). It is the one change this block was allowed under
    `src/storage`. The live app's data is therefore out of the preview's
    reach, and the preview starts empty: **the owner imports his backup
    into the preview again**, and the iPhone checklist says so.
  - *For block 9, noted:* check which address his installed app comes from
    (an app added to the Home Screen under `dario02king.github.io` would
    hold its data under an origin that no longer serves the app — the old
    address does not load, so such an app can never update itself), and plan
    the move by backup — export, install anew from the new address, import,
    and remove the old app only after the check.
  - *The licence file:* Dario Moffa, 2026 (tidy-up block, D157).
  - *Readings 5–9 and the resolution of the contradictions,* as the prompt
    session put them to him at its STOP: agreed. (Their wording is in that
    session's report, not in the repository; the prompts as committed in
    `9e4f546` already carry them.)
  - *His backup* comes with block 5b; *his points on the MakeHuman proof*
    come with block 7A (section 4 of the 7A prompt has the place for them).
- **Accepted by the owner on 2026-11-13.** He checked the colour rules of
  the muscle status and block 7A on his iPhone, on the preview build
  `0414126` (built from `534515d`): **"alles ok"** — both blocks are
  accepted, without findings. That closes STOP Farbregeln and STOP 7A.
  The body stands as built, and with it the questions of STOP 7A, each as
  the build has it: the relief bounded at 4 mm, the nipples smoothed away
  and the navel a soft hollow, the arms of the second sheet, the inert
  zone's one tone on an untrained body too, the still on the Gym card in
  the inert tone, and the strength of a small change (±3 %) unchanged.
  **No merge** — the branch stays as it is; the default branch publishes
  the live app with every push.
- **STOP 7C is closed** (2026-11-16, D187): accepted on his iPhone (the file of 16 November), except the Dips, whose line ended green under the zero line beside "+5 % Verbessert". His answers: a line begins on the baseline (D170 A), one change for an exercise (D176 A), its line is that change day by day, Back for every sheet in the tidy-up with nothing typed lost (3 B), the list under the rows stays away (4 A), the muscle sheet stays solid (5 A). All of it is built.
- **STOP 7D is closed** (2026-11-17, D189): the list accepted with the Bayesian cable curl, its 85 new ids given for good; 2 A, 3 A, 4 A, 5 A, each as built. The biceps machine he asked for after the STOP is the preacher curl: it is taken out again, and Preacher-Curls keeps its name and id and is also found as «Bizepsmaschine» and «Scott-Curls». A measure by time is an idea for the next update (under "Next work").
- **Still open from the owner:** nothing from STOP 7B — his third copy
  of the measuring display brought the turning, and he named iOS 26.3.1
  (D184). His backup: it did not come with block 5b (owner, 2026-11-15:
  "Ich hänge kein Backup an"), and since 2026-11-15 the standing rule is
  that there is none — check data is generated and every STOP says that
  the run with real data is missing (D183). Nothing else: the old address
  is answered (it does not load), the colour rules have no findings, and
  his points on the proof of the body were none.
- **Order from here: 5b, Kurve, 7B, 7C, 7D, 7E, 9, and the tidy-up of
  D157 last** (owner, STOP 5b, 2026-11-15, with 7E since STOP 7D, D189). **Block 7E runs in a session of its own on
  `claude/hopeful-carson-4utktp`, from `adf1ead`, without a prompt from
  here, and is merged into `claude/momentum-wp3` before block 9.** Otherwise each block starts in a fresh session from
  its prompt under `docs/wp3/prompts/` — `prompt-kurve.md`,
  `prompt-7b-interaktion.md`, `prompt-7c-muskel-sheet.md`,
  `prompt-7d-uebungskatalog.md`, `prompt-9-haertung.md`,
  `prompt-aufraeumen.md` — and ends at a STOP (D159). Block 7D is new since
  the morning of 2026-11-15 (D171) and block "Kurve" since STOP 5b the same
  day (D175); until then the order was 5b, 7B, 7C, 9, tidy-up. Done and
  accepted before them: the contract (STOP 0), Stage 6b, the colour rules
  of the muscle status, block 7A with the owner's addendum, which he had
  pulled before 5b in the night of 2026-11-11, Stage 5b, and block "Kurve"
  with his four answers at its STOP (D180). **Block 7B is accepted** (2026-11-16,
  D184); it ran in the session of the block before it, at his instruction
  (D183). **Block 7C is accepted** (2026-11-16, D187), with his correction of an exercise's line built after it, and **block 7D ran in the same session** at his instruction, on another model than D159 names (D187); **it is accepted** (2026-11-17, D188, D189). For the rest
  of WP3 (D183): check data is generated and laid beside each STOP for the
  day of the check and the day after, a STOP report opens with one line —
  what he has to decide and what he has to check on the iPhone — and
  nothing is merged.
- **Five points from the owner, 2026-11-15** (D168–D171 from his iPhone,
  D176 at the start of block "Kurve"), each recorded with what he saw, what
  he suspects and what the code shows. **Since block 7C** D168 and D169 are built, D176 is built in the form with one figure, and D170 as he chose it at STOP 7C — a line from the baseline (D187); D171 is built in block 7D (D188). As they were recorded:
  - *D168, for 7C:* on the Gym hub the title "Muskelgruppen" now and then
    stands twice, offset, the upper copy half cut off, until a moment
    later. The card's text column changes its height with the load — two
    placeholders while loading, up to four lines after, the empty range's
    sentence on two — and is centred against the still, so the title
    moves; the stale copy under the glass is his observation on the
    device. The card is to hold its height and its title's place.
  - *D169, for 7C:* the trend line of "Trizeps" sits further left than the
    others. `.muscle-row__right` is as wide as its word, and the chart
    stands left of it. All lines are to stand in one column.
  - *D170, for 7C:* one observation is a dot on the zero line, which reads
    as an error. 7C proposes a better form at its STOP, for the row and
    the sheet's chart together; contract §6 and `CLAUDE.md` follow his
    choice.
  - *D176, for 7C* (owner, 2026-11-15, at the start of block "Kurve"): the
    exercise detail states two changes — at the top the last day against
    the one before, at the line the last day against the first of the
    range; bench press in the import file reads "+3 %" and "+4 %" — and
    only the upper one has a name. Either one figure or two that are each
    named, the same in the muscle sheet and in the exercise detail. The
    sheet would add a third (the change in the range that enters the
    group's figure, +2 % and "Gehalten" for the same bench press); 7C
    decides which remain and asks at its STOP.
  - *D171, block 7D:* the catalogue grows from 49 exercises (five by
    bodyweight; quadriceps 3, core 3, calves 2, forearms 2 by primary
    group) to at least ten per group, existing ids untouched, with a
    keyword search over name, detail, group with synonyms, movement and
    equipment in the workout and the plan editor. The list is shown on the
    STOP page.
- **Block 7A takes a different road from D156.** The owner asked for a new
  base model from MakeHuman, built by script after the guide on his
  reference page, with a gate before anything is swapped in the app; if the
  gate fails, stage 1 on today's model stands as D156 has it. Recorded as
  **D165**, which supplements D156.
- **Reserved, not touched in WP3** (D158): `bossService.ts:217` fills
  `recordedScore` with `entry.score` — its own scoring gate, as its own era.
- **Recorded by the review, corrected in the tidy-up block:** the offline
  check of `release-proof.mjs` — make the test server answer as GitHub
  Pages does, without `Vary: Origin`, and after go-live the owner checks
  once in flight mode (D163); the device
  screenshots named under "Verification status" are iPad screenshots of a
  design canvas, not the app on an iPhone; `README.md`,
  `docs/release-candidates.md` and `docs/device-tests.md` describe RC2. (The
  verify scripts' Chromium path was the third item; Stage 6b repaired it —
  one constant in `lib.mjs`, `CHROMIUM_PATH` to override.)

**WP3 Stage 6b — variant B is the design system** (branch
`claude/momentum-wp3`, not merged; **accepted by the owner on his iPhone at
STOP 6b**, with the changes of D163 — see "After STOP 6b" at the end of
this block)
- **What it is.** The look of every existing screen, and nothing about what
  the app does. `src/core/`, `src/storage/`, the data schema, the backup
  format, `muscleState.ts`, the GLB, the body's light and material values
  and `body-preview.webp` are untouched; `git diff 7e2a5ce -- .github/fixtures`
  is empty and `domainOutputs.test.ts` holds the same fingerprints. The one
  string that changed is the heading over the exercise detail's day list
  ("Letzte Trainingstage" / "Recent training days"). (After STOP 6b the
  owner lifted the text lock for three rules and the empty range gained
  its sentences — D163; in `muscleState.ts` only the printed sign and space
  of a change moved, never the mapping from a number to a state.)
- **One system** (D148). Variant B's values are folded into `tokens.css`;
  `stage6-variant-b.css`, `data-variant` and the dark Gym tile on a light
  screen (`data-tile`) are gone. Proven before anything else moved: the
  thirteen Stage 6a screens rendered pixel for pixel as variant B did.
- **Colour has three jobs** (contract §2, D154, D160). The pastel families
  (mint, lilac, rose, peach, sand) and the sixteen `--domain-*` aliases are
  removed; a bar or a line that shows a value is `--data-ink` on
  `--data-track`; a met weekly target is the one coloured bar
  (`--data-met`); a muscle's own colour is an 8px dot, pulled 35 % towards
  its grey, and never its chart; the Mind ground keeps two washes and Gym
  one. `--text-tertiary` is `#64646f` and `#9896a6` and is held at 4.5:1.
- **Type, figures, density** (§3, §4). No text under 11px (the tab bar and
  one muscle label were 10px); three figure steps and `Figure`, which sets
  a unit smaller and secondary; one side margin of 16px on every screen
  (`--page-gutter` — the workout stood at 36px), a card inset of 16px, a
  row of at least 54px.
- **Controls** (§5). At most one primary action per screen, the tinted
  second step, text buttons in `--accent-ink`, a destructive act quiet on
  its first tap; the segmented control at 32px with a 44px target.
- **Charts** (§6). The muscle rows share one scale, −12 % to +12 %, with a
  zero line, a neutral 1.5px line and the state on the end point; the trend
  on Verlauf lost its wash and gained its zero line and a labelled end; the
  exercise detail's bars are neutral with the latest in the colour of its
  change; they start at zero (D163), with zero and the largest value named
  on the left and the first and the last date beneath.
- **Layers, motion, loading** (§10, §11). Every `z-index` and duration is a
  token; a loading screen holds its layout with calm surfaces
  (`LoadingBlocks`) and never for a load that failed.
- **The rules are tests** (§14). `designRules.test.ts` walks `src/` and
  fails on a colour, a font size, a layer or a duration written outside
  `tokens.css`, on a removed token family, on a second place that draws a
  muscle colour, on a type token under 11px; `contrast.test.ts` holds the
  two worlds, the stage and the data bars; `designSystem.test.tsx` the
  components; in the browser `design-system.mjs` (successor of
  `wp3-stage6a.mjs`) walks 39 screens at 320, 360, 393 and 430px and holds
  world, status-bar colour, width, and every visible run of text at 4.5:1
  and 11px on its rendered pixels. Each rule was broken once on purpose and
  seen to fail (19 source mutations, 6 in the browser).
- **Two values the measurement overruled, and the small choices** are D162:
  the light sheet's fill is 0.92, not B's 0.78, and the Gym wash 0.24, not
  0.28 — both where text fell under 4.5:1 on rendered pixels.
- **Review.** Every screenshot was looked at, at four widths, and the diff
  was read against the contract by five read-only reviewers with a refuter
  each (8 findings confirmed, 4 refuted). Fixed from both: the bars' labels
  stood at the baseline, not at their bars; a chart's visible text was
  never measured because it is hidden from assistive technology (measuring
  it found the bars' axis at 4.29:1); a sheet could scroll sideways unseen;
  a check that could not fail; the onboarding's target cards squeezed at
  320px; a unit wrapping away from its number; two figure rows off their
  baseline. The full list is in the STOP 6b report.
- **Verification** (final build `535e2b3`): `tsc -b` 0; `npm run test`
  exit 0, 108 files, 1699 tests (1761 before: 108 fewer for
  the two variant sets `contrast.test.ts` no longer has to hold, the rest
  new rules); build `index.css` 87.94 kB, `index.js` 497.56 kB (86.74 kB and
  489.89 kB before — the script grew mostly because `tokens.css` is read
  as text by `statusPalette.ts` and now carries the body's and the stage's
  values); browser suites: 37 as before (`design-system.mjs` in
  place of `wp3-stage6a.mjs`), 3620 of 3621 checks against 2650 of 2651 —
  the one red check is the same before and after (below). In the full
  parallel run `wp3-stage1.mjs` also failed one check, at a different width
  each time: it sampled the toast the instant after a sheet was attached,
  and the toast goes 4–8 ms later, in the sheet's effect. The check now
  waits for that, within a second; 312/312 alone and under the same load.
  The 3D suites ran alone: `gym-muscles` 71/71, `body-reach` 3/3, `body`
  39/39. Lowest text contrast measured:
  Mind 4.70:1 (the tinted "Freie Session" on the plan chooser), Gym 4.79:1
  (the exercise detail's "Zuletzt" label at 430px)
  (`docs/design/wp3/stage6b/text-contrast.json`).
- **Known, not from this stage.** `release-proof.mjs` fails one check as it
  did before the first change of this stage (three runs of the baseline):
  "offline, Gym still shows the 3D body". Offline in headless Chromium the
  first dynamic import of the body chunk fails although the worker has it
  cached and a plain `fetch()` of the same URL answers 200; `vite preview`
  sends `Vary: Origin`, which GitHub Pages does not, and with Muskelgruppen
  visited once online the same offline run passes. To be settled on the
  device in flight mode, and in the tidy-up block if it is real.
- **Seen, left for later blocks.** "Gehalten" stays yellow in a row until
  the colour-rules block turns it on body, legend and rows at once; the
  body is small at 320px and stands still while it loads (7A, 7B); the
  running workout's companion is still a placeholder (P12); `tokens.css`
  travels as text inside the script. (The hyphen for a fall and the lone
  "7" of the target bubbles were on this list and are done — D163.)
- **After STOP 6b** (D163, same session). The owner's answers: the two
  measured values stay; captions under the Gym wash stay as built; the
  status bar is `default` for the rest of WP3; **the bars start at zero**;
  the offline check goes to the tidy-up block. And from the iPhone:
  - *The finding.* After importing a backup of the live app, Gym showed
    the year's figure, Muskelgruppen ten untrained rows and a white body.
    Reproduced with a backup made by the live build through its own
    interface, imported with the real clock, before and after a reload:
    Muskelgruppen reads the selected 7 or 30 days, the hub's figures the
    whole history, and the last session lay 40 days back. The live build
    shows the same for the same file — not Stage 6b, not the import, not
    the replay. What was wrong was the sentence ("Noch nicht trainiert —
    nach deiner ersten Session …"). `features/gym/muscleGap.ts` now tells
    four absences apart and each says what is missing; with nothing in
    the range the screen offers "Training erfassen"; a failed load uses
    the existing "could not load" block; the hub's card says nothing
    while loading and names a failed load. `src/core` and `src/storage`
    are untouched. Should the owner's own file show something other than
    an empty range, the screen now names the reason — and the file is the
    next thing to look at.
  - *Three text rules* (`i18n/typography.ts`, `typography.test.ts`): a
    fall with the minus sign U+2212, a no-break space before a percent
    sign, "1 Distanzbereich gewertet".
  - *The seven target bubbles stand in one row at every width*; under
    375px a bubble's target is 44px high and its share of the row wide —
    the one place a target is narrower than 44px. The grid cell is the
    target and the circle is drawn inside it: a target computed from a
    border came out a pixel wrong, because browsers snap borders.
  - *The follow-up was reviewed like the stage* (seven findings confirmed,
    four refuted, six fixed; the one left is in D163).
  - *The toast check* waits at most `--duration-sheet` (320 ms).
  - Verification after these (source as of `d63dd8a`): `tsc -b` 0;
    `npm run test` exit 0, 111 files, 1728 tests; build `index.css`
    88.25 kB, `index.js` 501.14 kB; browser suites 36 of 37, 3720 of 3721
    checks — the one red check is still the offline one; `design-system.mjs`
    1128/1128 over 41 screens at four widths (the Gym hub and Muskelgruppen
    with an empty range are the two new ones); the 3D suites alone, 71/71,
    3/3 and 39/39; lowest text contrast unchanged, Mind 4.70:1 and Gym
    4.79:1. `git diff 7e2a5ce -- .github/fixtures` is empty; `src/core`,
    `src/storage` and `public/` are unchanged since the stage began. Both
    live backups were imported into this build once more, with the real
    clock, before and after a reload.
- Real-device preview: the build of `6447ba8` was published to
  Momentum-preview as `e8617a7` for the acceptance
  (https://hnd7k02.github.io/Momentum-preview/), with the status-bar style
  `default` so that the `theme-color` per world could be judged (D149).
  After STOP 6b the build of `a956ecb` — with everything of D163 — was
  published as `3d3545d`; the status bar stays `default`, now as decided.

**WP3 — the colour rules of the muscle status** (branch
`claude/momentum-wp3`, not merged; **built and accepted by the owner on his
iPhone on 2026-11-13, without findings**)
- **What it is.** What the muscle status *shows*, and nothing about what is
  computed (contract §7, D153, D160, D161, D164). No ratio, rating or day
  value moves. `src/core` changed by one constant (`MUSCLE_TREND_RANGES`),
  `src/storage` by the database name a preview build may carry and by the
  golden test calling the rule with its new argument.
- **One place makes a number a state:** `features/gym/muscleState.ts`.
  Rounding half away from zero in both directions (−2.5 was −2); the state
  follows the shown whole percent — −2 to +2 held, from ±3 the direction;
  a group states a trend only with three exercise days in the range and an
  exercise on two days, otherwise it is "Zu wenig Vergleichsdaten" with no
  figure and no line. An exercise day is one exercise on one day (an entry
  of `GymHistory.days`), counted for every group the exercise gives a
  weight above zero — by the membership `musclePerformance()` computes
  with, an exercise's roles as of its latest day in the range
  (`exerciseGroups`, which the rows' recency, the trend's days and the
  exercise list of a chosen group read as well). `shownPerformance()` is the range as the screen shows it: the ten
  states, the rated groups, and the trend above them — the mean of the
  rated groups with a state by the same band. The body, the flat figure,
  the rows, the hub's card, the trend tile, the exercise list, the exercise
  detail, the year-to-date tile and the golden test read it; the three
  places that rounded on their own (`MuscleEntryCard`, two `changeText`
  helpers) no longer do (`changeWords.ts`).
- **"Gewertet" means the row prints a figure.** The counter and the trend
  read the rated groups, not the domain's `measured` list; they differ by
  the groups that have a ratio on fewer than three exercise days.
- **"Gehalten" is neutral** — the text colour in a row, the data ink as a
  mark, white on the body; the warning yellow is gone from every Gym
  screen and from the flat figure. The body has two neutral tones in
  `tokens.css`, `--body-held` and `--body-dimmed` (`--body-base` is gone):
  dimmed is an untrained muscle and the head, hands and feet. A tint is
  mixed from white and grows evenly from 2.5 % to 12 %
  (`TINT_STRENGTH`, `REGION_MATERIAL` in `features/body/tokens.ts`); the
  weakest is three eighths of the way to the status colour, measured on
  the rendered body: the chest at +3 % lies 6.5 ΔE from the same chest
  held, the quadriceps at −3 % 14.7. The flat figure outlines the chosen
  group in the accent.
  Light, roughness, tone mapping, the GLB and `body-preview.webp` are
  untouched — block 7A.
- **Ranges.** Muskelgruppen reads 30 days, the default, or 90; Verlauf
  keeps 7 and 30; the hub's card stays on 30. Two constants.
- **Words.** "Leistungstrend" for "Gesamtentwicklung" and the card's
  "Gesamt"; "Zu wenig Vergleichsdaten" for "Noch kein Vergleich" and "Kein
  Vergleich", in both languages. A group with too little says how many
  exercise days it has in its row, and once chosen one sentence says what
  is missing; `muscleGap.ts` has a fifth absence, `tooFewDays`.
- **The legend.** ⓘ in the header of Muskelgruppen (44px, named) opens a
  sheet with the contract's sentence word for word and the five states
  with their rule in words; under the body stands the row of the five
  states. Below 370px the title of this one screen takes the 22px step so
  that the button fits (at the large title's size it has the room from
  366px). The sentence says "bester Arbeitssatz" ahead of
  block 5b.
- **No golden file changed** — the prompt expected the Gym file of the
  profile with sets to change in the state column. In that profile every
  rated group lies far outside the band and has three exercise days or
  more in every window, so no state moves; nothing was frozen anew.
  `git diff af89fd9 -- .github/fixtures` is empty; all fingerprints hold.
- **A preview build opens a database of its own**
  (`VITE_MOMENTUM_DB=momentum-preview`), because the live app and the
  preview share an origin (see "Answered by the owner … at the start of
  the colour-rules block" above). Checked in a browser: the preview build
  opens `momentum-preview`, the ordinary build `momentum`.
- **Verification** (source as of `67db6d2`; the commit that carries this
  block adds the record and the pictures): `tsc -b` 0; `npm run test` exit
  0, 111 files, 1786 tests (1728 before); build `index.css` 90.21 kB,
  `index.js` 507.06 kB (88.25 and 501.14 before). Browser suites, all of
  them in one run, the four 3D suites alone: 37 with an exit code, 36
  green, 4075 of 4076 checks — before the block 36 suites, 35 green, 3720
  of 3721. The one red check is still the offline one in
  `release-proof.mjs`, the tidy-up block's (D163), untouched. New:
  `farbregeln.mjs`, 319/319 at 320, 360, 393 and 430. `design-system.mjs`
  1156/1156 over 42 screens (the empty range at 90 days is the new one);
  `gym-muscles` 73/73, `body-reach` 3/3, `body` 39/39, `wp3-reload`
  125/125. Lowest text contrast unchanged: Mind 4.70:1, Gym 4.79:1.
  `git diff af89fd9 -- .github/fixtures` is empty. Screenshots under
  `docs/design/wp3/farbregeln/`: ten screens at each of the four widths,
  seven pictures of the body and their overview
  (`koerper-uebersicht.jpg`), the flat figure, and three before-and-after
  pairs (`vorher-nachher-*.jpg`, the "before" from the build of `9e4f546`
  with the same seeded history).
- **Rewritten checks** (old rule → new, none weakened): `seedMuscles`
  (forearms a third exercise day; biceps stay at two and read "too
  little"; `older` adds shoulder work 44–80 days back); `wp3-reload` (the
  7/30 toggle → 30/90); `wp3-stage1` B6 (two → three exercise days for the
  zero-change groups); `gym-muscles` (the word, plus state-fits-figure on
  all ten rows and the chip for fewer than three exercise days);
  `design-system` (taps "90 Tage" instead of "7 Tage" and finds the
  sessions of 45 days ago); `phase4` (a third bench day); `phase4-a11y`,
  `wp2-2-shots`, `release-proof` (the words; the biceps draw nothing).
- **Seen and left for later blocks:** the hands still take the forearms'
  colour and three strips of the inert zone show on the torso (7A); the
  body's tints are pale under today's tone mapping (7A);
  `tools/render-body-preview.mjs` renders the body with tinting off, which
  is now the dimmed figure, while the committed `body-preview.webp` is
  still the old grey — 7A re-renders it with its light; the sentence for
  too little to compare belongs in the muscle sheet (7C); a group's row
  compares the last day of the range with the first, the exercise list
  the last with the one before, so the two can print different numbers
  for one exercise (7C shows both); "Leistungsentwicklung" still names the
  rating's 60 % (not the muscle trend; not touched); the documents that
  still name `dario02king.github.io` (`docs/device-tests.md`,
  `docs/release-candidates.md`, the muscle-map QA) are the tidy-up block's.
- **The commits.** `e073c65` (the database name), `70c4d0b` (the rule
  and everything that shows it), `7f19fd4` (the header at 320px — it also
  carries D164, `CLAUDE.md`, the verify README, `farbregeln.mjs` and most
  of the suite rewrites, which were staged when it was made; its message
  names only the header), `84950df` (the rest of the suites), `d71ec5a`
  (the title's breakpoint), `06de798` (the first review), `a06380e` (the
  second), `67db6d2` (the count of exercise days on its own line), and the
  record that follows them.
- **Open at the STOP:** whether an exercise day is an entry or a calendar
  day (in the test profile the two readings never differ; the owner's data
  is not counted yet); whether a held figure on a single line should also
  print its number; the weakest tint on his screen.
- **Reviewed twice** by read-only readers and a refuter each (D164):
  fifteen findings in the first pass, nine confirmed, eight fixed; eight
  in the second pass over those fixes, six confirmed, all fixed. The one
  recorded and left: the offline cache is named `momentum-<revision>` without its base,
  and each worker deletes the other `momentum-` caches of its origin — it
  touches nothing while the preview publishes no worker, and it has to
  carry the base before one ever does (block 9 or the tidy-up block).
- Real-device preview: the build of `67db6d2` is published to
  Momentum-preview as `88b2999`
  (https://hnd7k02.github.io/Momentum-preview/), built with
  `VITE_MOMENTUM_DB=momentum-preview`; the status bar stays `default`
  (D163). It starts empty — the owner imports his backup there.

**WP3 Block 7A — the body model** (branch `claude/momentum-wp3`, not
merged; **built and accepted by the owner on his iPhone on 2026-11-13 —
the body of the second sheet stands — and his addendum to it on
2026-11-15**)
- **The owner's addendum to the acceptance (2026-11-13), before 5b
  starts.** Three things: the weakest tint is to be 0.3 for 0.5 (he meant
  his fourth question that way — the 0.5 made up for a tone mapping that is
  gone); the chest's lower edge ran to a point under the breastbone and is
  to lie level from the middle to under the nipples; and the borders at the
  knee, front and back, and at the outer end of the collarbone are to be
  smooth, since the app never turns its colours off (D166). `gate-2-b` and
  `stop-7a` go on the way. He looks at chest, knee and tint on a new preview
  and confirms. **No merge.** The steps, ticked as they are done:
  - [x] the borders (D167): the build cuts the knee as a plane, and the
    pectoral's lower edge, the collarbone, the pit of the throat and the
    deltoid's edge against the trunk as lines, into the fine mesh
    (`bodylib.cut_field`, `regionrules.Lines`); every vertex on a cut is
    marked and `refine-body.mjs` leaves a border through marked vertices on
    its edges, a line of them a wall. The build stops if a cut line has
    moved or an edge is left open. `tools/body/README.md`, "The lines on
    the trunk", has the measurements. `gate-2-b` and `stop-7a` are gone
    from `candidates.json` and `digests.json`. `momentum-body` is 706 392
    bytes, 50 152 triangles, and builds to its recorded bytes twice in a
    row; the table in `muscleMeshMap.ts` and the still follow it. The
    validator: the chest's envelope (it must end between 69 and 73 % of the
    height; it ended at 66.1), the two cuts of each lower leg on their
    planes, 59 check points for 33. `tsc -b` 0; `npm run test` exit 0, 113
    files, 1891 tests (`44d52a9`).
  - [x] read by five read-only readers with a refuter each (Sonnet): two
    lenses — the cuts, the rules and the build — found nothing; eight
    findings stood, all of them small, and all are fixed: the test of the
    wall did not fail without the wall (there is one now that does: a
    vertex whose every neighbour lies on the line), a figure in a comment
    of the validator, and five passages in four documents that still gave
    the old file's numbers or called the removed candidates kept. Checking
    the claim that no vertex moved found four that had, by a tenth of a
    millimetre: the guard on the relief's curvature ran after the new cuts.
    The cuts between muscles now come after it, and the body is vertex for
    vertex the one he accepted (sha256 `b47c392b…0a274de1`).
  - [x] the tint: `TINT_STRENGTH.min` is 0.3. Measured on the new body at
    393 px, as the median difference from the same zone held: at 0.5 the
    chest at +3 % stood 34.2 ΔE away and at +9 % 51.4 (a* −30 and −45, one
    and a half times); at 0.3 it stands 22.2 and 48.1 (a* −20 and −42,
    twice). The quadriceps at −3 % and −8 %: 30.2 and 44.6 before, 19.3
    and 40.2 now. `farbregeln.mjs` keeps its limit of 5 ΔE and passes.
  - [x] the closing run, on `9eccdae`: `tsc -b` 0; `npm run test` exit 0,
    **113 files, 1892 tests**; `npm run build` with the validator (59 check
    points, the knee's cuts 0.2 mm off their planes), `index.css` 90.57 kB,
    `index.js` 509.36 kB as before, the model 706 392 bytes; **all 37
    browser suites, 36 green, 4080 of 4081 checks** — the one red is the
    offline check of `release-proof.mjs`, as in the baseline;
    `gym-muscles` 74/74, `farbregeln` 322/322, `body` 40/40, `body-reach`
    3/3 with 10 of 10 groups at 320, 393 and 430 px, the four of them one
    at a time. No suite had to be changed. `git diff fec6d5c --
    .github/fixtures src/core src/storage` and the diff of `muscleState.ts`
    are empty.
  - [x] the preview: `Momentum-preview` `c80b61d`, built from `9eccdae`;
    its files are the build's byte for byte, and from a local server it
    starts empty in its own database, walks through the first start and
    draws the body on the muscle screen.
  - [x] D167, and the STOP page: «Körper STOP 7A»
    (https://claude.ai/artifact/V6EXnbcNemqc63rpxCxpQG) carries the
    addendum first — the tint at 0.5 and at 0.3 side by side, the chest's
    edge, the knee, the collarbone and the shoulder before and after.
  - [x] **accepted by the owner on 2026-11-15**, on his iPhone, from the
    preview `c80b61d`: chest, knee and tint as built. Of the two things
    put to him there, the deltoid's edge as one straight line all round
    the shoulder (he had named only the outer collarbone; where it lies
    and how it leans are two numbers in `regionrules.py`) is accepted with
    it, and **the elbow and the deltoid's lower edge stay as they are** —
    borders of `refine-body.mjs`, not cuts of the build (D167). Then Stage
    5b, 7B, 7C, 7D, 9 and the tidy-up, in that order.
- **The owner's word on the second sheet (2026-11-13, 00:45 Zurich).** After
  the sheet was reported he wrote that he is going to sleep and that the
  session is **not to stop until the task is done**, restarting itself at
  04:30 Zurich if the usage limit cuts it (a message is scheduled for
  then). He did not answer the sheet's three questions. That is read as
  his go-ahead: **production runs with the sheet's recommendations** —
  relief bounded at 4 mm (A), the nipples smoothed away and the navel a
  soft hollow, the arms as shown. `gate-2-b` (6 mm) and the body of STOP 7A
  (`stop-7a`) stay in `candidates.json` and can be built and installed
  with one command each, should he decide otherwise in the morning; the
  commit before production is `2215a51`. The steps, ticked as they are
  done:
  - [x] `gate-2` becomes `momentum-body` (`5514ba8`): `candidates.json`,
    `build.py momentum-body --record --install`, the table in
    `muscleMeshMap.ts`, the still on the Gym card (240 × 574 now: the arms
    hang closer, so the figure is narrower). The validator passes as it
    stood. `gate-2-b` and `stop-7a` build to their recorded bytes.
  - [x] the closing run, on `534515d` (the commits after it are the
    record alone): `tsc -b` 0; `npm run test` exit 0, **113 files, 1858
    tests**; `npm run build` with the validator, `index.css` 90.57 kB,
    `index.js` 509.36 kB, the model 703 760 bytes; **all 37 browser suites,
    36 green, 4080 of 4081 checks** — the one red is the offline check of
    `release-proof.mjs`, as in the baseline; `gym-muscles` 74/74,
    `farbregeln` 322/322, `body` 40/40, `body-reach` 3/3 with 10 of 10
    groups at 320, 393 and 430 px (the biceps and the triceps are two 12px
    cells wide at 320 now, for one), the four of them one at a time. No
    suite had to be changed for the new body. `git diff fec6d5c --
    .github/fixtures src/core src/storage` and the diff of `muscleState.ts`
    are empty. Measured again on the way: the chest at +3 % stands 34.1 ΔE
    from the same chest held, the quadriceps at −3 % 30.2.
  - [x] the record (`tools/body/README.md`, `MEASURES.md`, the deviations
    table, D165's outcome, D166's measured tones), and the preview:
    `Momentum-preview` `0414126`, built from `534515d`; its files are the
    build's byte for byte, and from a local server it starts empty in its
    own database, walks through the first start and draws the body on the
    muscle screen without an error.
  - [x] STOP 7A anew — reported on 2026-11-13; the page «Körper STOP 7A»
    (https://claude.ai/artifact/V6EXnbcNemqc63rpxCxpQG) carries the second
    version. **Accepted the same day: "alles ok"** on the iPhone, for 7A
    and for the colour rules. Its five questions — how much relief, the
    inert zone on a wholly untrained body, the tone of the still, the
    strength of a small change, his findings on the colour rules — are
    answered by that: everything as built, no findings.
  - *Done with the owner's addendum (D167):* `gate-2-b` and `stop-7a`,
    kept in `candidates.json` only until this acceptance, are removed with
    their lines in `digests.json`; `tools/body/README.md` and `MEASURES.md`
    name them as past (git keeps them at `8537f79`).
- **Where it stands now (2026-11-12, after STOP 7A).** The owner added two
  corrections to the gate and stopped production until he has seen them
  (D165, "After the gate"): *2b* the surface — no folds at collarbone,
  chest, belly and groin, no rings at wrist and ankle, a shade that brings
  out forms and paints no lines — and *3* the arms — forearm 14.6 % for
  15.2 %, a little stronger, fingers bent more, upper arms about 17° from
  the trunk. **Nothing in the app was changed for them.** They are a
  candidate, `gate-2` (`python3 tools/body/build.py gate-2`, into
  `tools/body/out/`, installed nowhere), with `gate-2-b` as the sheet's
  alternative (relief bounded at 6 mm for 4). The second sheet is a private
  Artifact page, «Körper-Gate 7A, Blatt 2» (https://claude.ai/artifact/Sr45ZS6gT3QeEeNJFbRjyw); its pictures are
  in `docs/design/wp3/7a-gate-2/`.
  - *What the sheet asks him:* how much relief (A 4 mm, recommended, or B
    6 mm), the nipples and the navel (gone and a soft hollow, as shown),
    and the arms (as shown, or what to adjust). The five questions of
    STOP 7A are still open and do not hang on the sheet.
  - *Checked:* `tsc -b` 0; `npm run test` exit 0, 113 files, 1858 tests;
    `git diff 552802c -- src public .github` is empty; all three bodies of
    `candidates.json` build to their recorded bytes; both candidates pass
    the validator as it stands. No browser suite was run: the app did not
    change. A read-only review of the pipeline's diff (three readers on
    Sonnet, each finding checked by a refuter) found nothing in the
    geometry and two small things, both corrected (`--shadesmooth 0`
    smoothed once all the same; a stale comment on the crotch).
  - *What the pipeline learned* (every one an option, off for the shipped
    body, which builds to its recorded bytes): `relief.soften`,
    `relief.smooth`, `relief.sharpest`, `spots`, `seam_fade` in
    `candidates.json`; `--shadedepth`, `--shadefine`, `--shadesmooth` in
    `refine-body.mjs` (four tests more, 70 in the `tools` project). Three
    more MakeHuman files are vendored for the arms (21 files; the same
    folder, the same CC0 text). `tools/body/README.md`, "After the gate",
    has the causes as measured.
  - *Two readings of `measure-body.mjs` were wrong and are corrected.* The
    crotch was the cut below it; found between the cuts it reads 49.1 %
    for the shipped body too, so **the shipped body meets 13 of the 14
    measures, not 14** as STOP 7A reported (the window is 45–49 %, not
    checked at its source, not in the validator). The hand's reach took the
    thigh for the hand once the arm hung closer.
  - **When the owner says go** (and names A or B): make the chosen
    candidate `momentum-body` in `candidates.json` and drop the other;
    `build.py momentum-body --record --install`; the table in
    `muscleMeshMap.ts` (the test names the counts); the still
    (`tools/render-body-preview.mjs`, and his answer to question 2 of
    STOP 7A decides its tone); the validator needs no change — both
    candidates pass it as it stands; `tools/body/README.md` ("The body",
    the digest table), `MEASURES.md`, D165's outcome; then the closing run
    again (the four 3D suites one at a time — `body-reach.mjs` matters, the
    arms hang closer), the preview, and STOP 7A anew.
  - **If he asks for more on the sheet:** change `gate-2` in
    `candidates.json`, `build.py gate-2 --record`, and rebuild the pictures
    with the two scripts named in `docs/design/wp3/7a-gate-2/README.md`.
- **What the app ships now.** `public/models/momentum-body.glb` is a new
  body: `athletisch-a` of the gate with the owner's three corrections at
  the gate and the two of its second sheet, built by one command from
  MakeHuman's base mesh (CC0 1.0) — 50 152 triangles, 706 392 bytes
  (690 KB; 480 KB compressed, for 345 KB of the model of D156), closed,
  1.75 m tall like the body it replaces, sha256 `b47c392b…0a274de1`
  (`tools/body/digests.json`). Head with neck, hands and feet are an inert
  zone with straight cuts and a tone of its own (D166); the light is tokens
  and has no tone mapping (D165). Since the owner's addendum the borders
  at the knee and round the chest are lines the build cuts (D167); until
  then the file had 49 964 triangles and 703 760 bytes
  (`202c8045…bcabf286e2`). Since the second sheet the surface has
  no folds — the relief is softened and bounded at 4 mm, the nipples are
  smoothed away, the navel is a soft hollow — and the arms are shorter,
  stronger and held closer (forearm 14.6 % of the height, upper arm 17°
  from the trunk). Nothing computed moved: `src/core`, `src/storage`,
  `muscleState.ts`, every golden file and fingerprint are as they were, and
  so are the body's interaction, the stage's size and frame and the flat
  fallback figure. (The body the app shipped at STOP 7A was `stop-7a` in
  `candidates.json` until D167, and is in commit `8537f79`: 49 988
  triangles, relief at 9 mm, upper arm 21°.)
- **How this block is run.** Started by the owner on 2026-11-11, late, in
  the session of the colour rules, from
  `docs/wp3/prompts/prompt-7a-koerpermodell.md`. His points on the first
  MakeHuman proof: **none — build by the guide.** He decides at the gate
  the next day. The session may be cut off by its usage limit; two
  messages are scheduled into it (03:00 and 06:00 Zurich on 2026-11-12)
  that say: read this file and `git log`, go on where the work stopped, up
  to the gate; if the gate is reached, do nothing. So every finished step
  is committed, pushed and ticked here.
- **Nothing is swapped in the app before the gate**, and the app's logic
  does not change at all in this block: `src/core`, `src/storage`,
  `muscleState.ts`, every golden file and fingerprint stay as they are.
- **Where it stands** (update this list with every step):
  - [x] Step 0 — baseline and tooling. The baseline is the one below.
    Tooling: Python 3.13.18 with numpy 2.5.3, Node 22, PyPI reachable.
    `bpy` 5.3.0 installs from PyPI but does not import in this container
    (`libtbb.so.12` is missing), so the pipeline uses numpy and Node only —
    which also keeps the build light and byte-reproducible. The reference
    page was read with the Artifact tool (the guide, `build_mh.py`,
    `label_mh.py`, `refine-body.mjs`, the two pictures of today's body and
    of the proof); its third-party reference pictures were not downloaded
    and never enter the repository. The data wheel `anny==0.6.2` downloads
    (47.7 MB, sha256 `bad70bdc2be0dfa9880d60129c3a1339678f08f493184f637dc2825c3e27b8d2`);
    only `anny/data/mpfb2/` is unpacked (1489 files, 66 MB), and its
    `LICENSE.md` is the full text of CC0 1.0 Universal.
  - [x] Step 1 — the decision that supplements D156: **D165**.
  - [x] Step 2 — the pipeline under `tools/body/` (its `README.md` has the
    commands). One command, `python3 tools/body/build.py <candidate>`;
    numpy and Node only. The eighteen MakeHuman files (21 since the second
    sheet) the candidates read
    lie in `tools/body/makehuman/` with their `LICENSE.md` (CC0 1.0
    Universal, read in full) and a manifest of sha256 — in the repository
    rather than pinned to the wheel, so the build runs offline and the
    wheel's code never comes near. Two builds in a row are byte-identical;
    `digests.json` records every candidate and a build that differs exits 1.
    The regions are stored per vertex (`regions.json`); the upper trapezius
    stays with the back, and the build stops if `refine-body.mjs` hands
    back a piece of 100 triangles or more. `refine-body.mjs` has tests now
    (vitest project `tools`, 15 tests at the gate and 20 at the end of the
    block, part of `npm run test`), and **they found a defect in the script as the
    reference page has it**: a border crossing snapped onto a vertex left a
    T-junction, so the body was not closed (30 open edges in the proof, 84
    in the first candidate). One branch is corrected; the body is closed.
    `npm run test` was 112 files and 1801 tests at the gate.
  - [x] Step 3 — measuring. `node tools/body/measure-body.mjs <glb>…` reads
    fourteen measures from the surface of any GLB (no skeleton needed) and
    says where the regions lie; `tools/body/MEASURES.md` has the definitions,
    the table for today's body (9 of 14 met) and the proof (8 of 14), and
    what the targets were checked against. **The check is partial:** the
    sources themselves are blocked by this session's network rules, so some
    windows are marked open there and must not enter the validator
    unchecked. One finding for the gate: the guide's window for the
    shoulder breadth (25–30 % H) is too low for a bideltoid breadth — ANSUR
    II's mean is 29.0 %.
  - [x] Step 4 — the candidates: `schlank-a`, `athletisch-a`,
    `athletisch-b`, `kraeftig-a` (three body types of the guide, head A
    natural with closed eye sockets, head B softened to a mannequin's). Each
    about 50,200 triangles, 34 % in the inert zone, 707,400 bytes (691 KB
    as the prompt counts), closed, byte for byte the same on a second
    build. Measured: `athletisch` meets 14 of
    14 targets, `schlank` 13 (crotch 49.2 %), `kraeftig` 13 (shoulder
    breadth 30.3 % against the guide's 30 %). The relief is MakeHuman's own
    muscle detail in multiples, bounded at 9 mm — deeper than the guide's
    2–6 mm, because that depth does not read at the size of the app.
    `refine-body.mjs` got a second, small change: `--straymax`, without
    which hands and feet are handed away beside an unthinned head.
  - [x] Step 5 — light, material, tone mapping, **on the dev harness
    only**. The viewer takes its lights, tone mapping and surface values as
    one object now (`BodyLook` in `tokens.ts`); the app passes none and gets
    `BODY_LOOK`, which is today's values to the digit (`body.mjs` 39/39
    after the change). The proposed look is `LOOK_7A` in `BodyDevPage.tsx`:
    less light from everywhere (hemisphere 0.6 for 1.35), a key from above
    left (1.9), a light from behind (2.0), **no tone mapping**, roughness
    0.62. Measured on `athletisch-a`: the strongest green reaches the screen
    with a chroma of 56 where ACES and today's light leave 27, at the hue of
    the material; ±3 % reads as a colour beside a held, white group (chroma
    27 against 4). The numbers of the tint strength are untouched. The dev
    page takes `?model=<path>` (a candidate of `tools/body/out/`),
    `?look=7a`, `?world=gym|light` and two more fixtures, `greens` and
    `reds`; `tools/body/gate-shots.mjs` takes the stills through it. Both
    materials read a baked shade where a model brings one
    (`vertexColors`, conditional — today's model has none). **After the
    gate** the look moves to the tokens (`tokens.css`, `tokens.test.ts`),
    whichever body it is then tuned on.
  - [x] Step 6 — **the gate was reached and is decided** (see below; the
    text that follows describes the sheet as it was shown). The comparison sheet is a private Artifact page,
    «Körper-Gate 7A» (https://claude.ai/artifact/WdwyQ1we3wQe14VoJr8saz):
    today's body beside the four candidates in four views, neutral and
    with status colours, in both worlds at 393 and 320 px, close-ups, the
    five pictures of the light, the measures, triangles, bytes and sha256,
    an assessment of each candidate, the checklist for the iPhone and four
    questions. Its key pictures are in `docs/design/wp3/7a-gate/`. The
    recommendation is `athletisch-a`. **Nothing in the app is replaced:**
    `public/models/momentum-body.glb`, the validator, `muscleMeshMap.ts`,
    the tokens, the attribution and `body-preview.webp` are as they were.
    What follows depends on the answer — the owner picks a pair (step 7a),
    a pair with up to three corrections (one more round, a new sheet), or
    none (step 7b: stage 1 on today's model). D165 gets the outcome then.
    **Checked at the gate, against the baseline below:** `tsc -b` 0;
    `npm run test` exit 0, 112 files, 1801 tests (the fifteen new ones are
    the pipeline's); the build with the validator, `index.js` 507.25 kB for
    507.06; all 37 browser suites, 36 green, 4075 of 4076 checks, the one
    red being the offline check of `release-proof.mjs` as before;
    `gym-muscles` 73/73, `body-reach` 3/3, `farbregeln` 319/319, `body`
    39/39, each alone. `git diff fec6d5c -- .github/fixtures src/core
    src/storage` is empty.
    A read-only review of the block's diff (four readers on Sonnet, each
    finding checked by a refuter) found nothing in the viewer and nothing
    in the pipeline; it found three defects in the measuring script (the
    verdict judged the raw value beside a rounded figure, the foot was
    measured between triangle centres, the chin's edge lay up to 3 mm high)
    and four slips in the record. All are corrected; the counts of targets
    met did not change, the foot length reads 14.9 % for 14.7 %.
- **The gate is decided (2026-11-12): `athletisch-a`, with three
  corrections, then production (step 7a) and STOP 7A.** The corrections
  and the owner's answers are in D165. What is owed, in this order:
  - [x] correction 2 — borders. The build cuts the mesh itself along five
    planes (`bodylib.cut_planes`): the neck 6 mm below its joint, tilted 5°;
    wrist and ankle across the limb. `refine-body.mjs` got `--freeze none`
    (its third change, with four tests) and leaves those borders exactly
    where they are. The pit of the throat goes with the chest, the
    trapezius begins at the side of the neck, and the border of chest and
    trapezius along the collarbone is held. `tools/body/README.md`, "The
    straight cuts".
  - [x] correction 1 — the inert zone's own tone: `--body-inert` `#b3b3bc`,
    halfway between dimmed and white (**D166**, departs from D161).
    `BodyModel.tsx` gives it to head, hands and feet; "Noch nicht
    trainiert" stays dimmed. With the data colours off the whole figure
    takes the inert tone (the still on the Gym card). Contract §8 and `CLAUDE.md` say
    three tones now. **Owed at STOP 7A: show the white body and the
    untrained one** — on the second the inert zone is lighter than the
    muscles, and the owner judges that there.
  - [x] correction 3 — the key light is 1.1 for 1.9. Measured on the white
    body through the real viewer at 393 px: the share of burnt-out pixels
    (every channel 252 or more) is 5.0 % at 1.9, 1.3 % at 1.5, 0.4 % at 1.3
    and 0.1 % at 1.1, where only single points on the ridge of the
    trapezius are left; the chest goes from 215 to 198 of 255. The look is
    the app's now: every value is a token in `tokens.css`
    (`--body-light-*`, `--body-roughness*`, `--body-environment`,
    `--body-tone-mapping: none`), read by `cssNumber`, `cssVector` and
    `cssKeyword` in `statusPalette.ts` into `BODY_LOOK`, and held by
    `tokens.test.ts`. `LOOK_7A` and `?look=7a` are gone from the dev page;
    it takes `?key=` to try a strength.
  - [x] step 7a — production.
    - *The model.* `python3 tools/body/build.py momentum-body --install`
      writes `public/models/momentum-body.glb`; `candidates.json` holds the
      one body (`momentum-body`), `digests.json` its bytes, and a build
      that differs exits 1. Built at 1.75 m, not the 1.78 m of the gate's
      candidates: the height of the model it replaces, so the frame did not
      have to move (`body.mjs` holds head and feet clear of the edge at
      320, 393 and 430, from every view).
    - *The validator* (`tools/validate-body-glb.mjs`, first in `npm run
      build`): structure, an envelope per group taken from the measured
      body (reach and extent, each with its reason beside it), both sides,
      the closed surface, the five straight cuts (each within 1 mm of its
      plane, the neck within 10° of level), **33 check points** of the
      regions (`tools/body/checkpoints.mjs`, contract §14), eleven of the
      fourteen measures, the ceiling of 700 KB, the licence notice. Knee
      height, crotch height and shoulder breadth are measured but not held
      — see "open" below. `tools/validate-body-glb.test.mjs` (46 tests)
      holds every check point by name and that the validator refuses what
      it promises to refuse: another notice, no notice, hands that belong
      to the forearms, a shade on some regions, a missing region, a
      primitive without its triangles or its material, the model of D156.
    - *The table.* `muscleMeshMap.ts` carries the counts of the installed
      file; the test compares them with the file itself.
    - *Attribution.* Einstellungen names MakeHuman and Anny (CC0 1.0, no
      credit owed — named all the same), in both languages;
      `THIRD-PARTY-NOTICES.md` has the new source and keeps the credit of
      the model of D156 in a section of its own, for as long as the files
      derived from it lie under `docs/design/muscle-map/` (its
      `ATTRIBUTION.txt` and `license.txt` stay there). **Found on the
      way:** the vendored skinning weights are the Anny project's own work
      (NAVER Corp., CC0) and the folder is MakeHuman's data *as Anny
      adapted them* — still CC0 throughout, so nothing had to stop, but the
      record said "MPFB2's data, unchanged" and says it as it is now; the
      model's own notice names Anny too.
    - *The still* on the Gym card is the new body with the data colours
      off: one figure in the inert zone's tone (240 × 522, 16 kB).
    - *The suites that had the old model built in.* `farbregeln.mjs` read
      "white" as a share of pixels above L* 88 and the card as everything
      under 45; without a tone mapping a tone is no longer flat, and three
      checks failed on a body that was right. A tone is the median of a
      zone now, and there are new checks: held from the back, every
      untrained zone against the same zone held, and the inert zone's tone
      (322 checks for 319). `body.mjs`: one tap of its grid's top row
      presses "Seite", the next tap stops that turn at 57°, and the whole
      front pass had been tapping a body standing askew since before this
      block — the old model happened to show all ten groups from there, the
      new one does not show the biceps. The body is put back whenever it
      does not face the pass's view, and a check of its own holds that no
      tap met a body off the view (40 checks for 39). `body-reach.mjs`
      reaches **10 of 10 groups at 320 px** (9 before), and at 393 and 430.
    - *The tint strength is unchanged.* Measured under the new light, as
      the median difference from the same zone held at 393 px: the chest at
      +3 % 33.6 ΔE (6.5 under the old light and tone mapping), the
      quadriceps at −3 % 30.3 (14.7); +9 % reads a* −44 for −30 at +3 %.
      The prompt let the numbers follow the light only if +3 % no longer
      read as a colour or ±12 % glared; neither is so. That +3 % is now a
      clear colour rather than a hint is a question at STOP 7A.
  - [x] step 8 — the closing run (below), the record (D165's "what was
    built", D166's measured tones, `CLAUDE.md`'s rule that the model is
    built and never edited, `tools/body/README.md`, `MEASURES.md`), and the
    preview published in `Momentum-preview`.
  - [ ] STOP 7A — reported on 2026-11-12; the owner checks on his iPhone.
    The report is a private Artifact page, «Körper STOP 7A»
    (https://claude.ai/artifact/V6EXnbcNemqc63rpxCxpQG): the pairs, the
    numbers, the checklist of ten points and five questions — the inert
    zone on a wholly untrained body, the tone of the still on the Gym
    card, the strength of a small change, the three targets not checked
    at their source, and his findings on the colour rules. What he finds
    is corrected in the session that built the block and the preview is
    published again; 7B starts in a new session after that.
  The owner's line on the colour rules came without findings (the
  checklist was left as its template); "an exercise day is an entry, as
  built" is confirmed. Asked again at STOP 7A.
- **Open after this block.**
  - *Three targets not checked at their source.* The ANSUR II report
    (`apps.dtic.mil`) and the Penn State tables are not reachable through
    this session's network rules. So the shoulder window still reads
    25–30 % (the owner's 27–32 % waits for the check; the body's 29.6 %
    meets both), and knee height (29.9 %) and crotch height (49.0 %) are
    measured and reported but not in `HELD_MEASURES`. Whoever can open the
    sources: check, then move the three keys into the list and change the
    one window in `measure-body.mjs`.
  - *For the tidy-up block (D157).* The licence file's sentence "the 3D
    model keeps its own licence (CC BY 4.0)" fits the model of D156 only.
    The shipped model is CC0 1.0; the kept files under
    `docs/design/muscle-map/` are still CC BY 4.0 and keep their credit.
  - *Seen and left:* the border of hamstrings and calves behind the knee
    is slightly wavy (it follows the groove; the cuts were asked for neck,
    wrist and ankle only); the chest runs to a point at the lower end of
    the breastbone; a body with nothing trained has head, hands and feet
    lighter than its muscles — the owner judges that at the STOP (D166);
    the size of the body at 320 px and what it does while it loads are
    7B's; the muscle sheet is 7C's.
- **The closing run of block 7A** (2026-11-12, on the commit this block
  ends with; the baseline is the one below): `tsc -b` 0; `npm run test`
  exit 0, **113 files, 1854 tests** (111 and 1786: the two new files are
  the pipeline's and the validator's tests, 66 between them, and
  `tokens.test.ts` grew by two); `npm run build`
  with the validator, `index.css` 90.57 kB (90.21), `index.js` 509.36 kB
  (507.06), the viewer's chunk 235 kB compressed as before, the model
  704 044 bytes (478 008). **All 37 browser suites, 36 green, 4080 of 4081
  checks** (4075 of 4076) — the one red is the offline check of
  `release-proof.mjs`, as in the baseline and for the reason recorded
  under Stage 6b; the five new checks are `farbregeln` 322/322 (319),
  `gym-muscles` 74/74 (73, the credits name the new source and no longer
  the old) and `body` 40/40 (39); `body-reach` 3/3 with 10 of 10 groups at
  320, 393 and 430 px. The four 3D suites ran one at a time. `git diff
  fec6d5c -- .github/fixtures src/core src/storage` is empty, and so is
  the diff of `muscleState.ts`. A second build of the model gives the
  recorded bytes.
  A read-only review of the production diff (four readers on Sonnet, each
  finding checked by a refuter) found six things; four were real and are
  corrected: `refine-body.mjs --freeze` stopped on an error of its own
  for a small piece of a muscle with the frozen region all round it (the
  shipped body has none; such a piece is left alone now, with a test);
  the validator stopped the same way on a primitive without triangles or
  material instead of naming the fault (two tests); two checks of
  `farbregeln.mjs` did not ask that their zone held pixels. The two that
  were not: the tap that passes through the inert zone to the muscle
  behind it (as built and as the comment says — interaction is 7B's), and
  a body left off its view after the very last tap of `body.mjs` (no tap
  follows; counted now all the same).
- **Preview.** `Momentum-preview` `2c007e4`, built from `6eb5f3a` with
  `--base=/Momentum-preview/` and `VITE_MOMENTUM_DB=momentum-preview`; the
  status bar stays `default`, `sw.js` and the sourcemaps are not published.
  Its files are the build's, byte for byte; opened from a local server it
  starts empty in its own database, walks through the first start and
  draws the body on the muscle screen without an error. The address
  `hnd7k02.github.io` itself is not reachable from the session.
- **The pictures of STOP 7A** are in `docs/design/wp3/7a/`: four pairs
  before and after from the app (Muskelgruppen from the front, the stage
  from the back, the Gym card, a close-up) and the white body beside the
  untrained one — all five with the body shipped since the second sheet —
  and, from the first version, the borders at neck, wrist and ankle. The
  close-ups of the second sheet are in `docs/design/wp3/7a-gate-2/`.
- **Baseline for this block** is the closing run of the colour rules on
  `67db6d2` (the commit before this block's first is `fec6d5c`, which adds
  only the record, the pictures and a moved block in one verify script): `tsc -b`
  0; `npm run test` exit 0, 111 files, 1786 tests; build `index.css`
  90.21 kB, `index.js` 507.06 kB; 37 browser suites with an exit code, 36
  green, 4075 of 4076 checks, the one red being the offline check of
  `release-proof.mjs`; `gym-muscles` 73/73, `body-reach` 3/3, `body`
  39/39, `farbregeln` 319/319, each alone.

**WP3 Stage 5b — the exercise-day metric as an era** (branch
`claude/momentum-wp3`, not merged; **built and accepted by the owner on his
iPhone on 2026-11-15**, from the `Momentum-preview` build `7e0572f`, with
his four answers at STOP 5b built in the same session — D175)
- **What changed.** From the first load of this build a Gym exercise-day is
  worth its best *working* set by the strength score
  `effective load × (1 + reps ÷ 30)` (D150); a set can be marked as a
  warm-up by hand (D151); and a window compares the median of an exercise's
  last days with the median of its first. Everything from the percentage
  change on — 70/30, the curve, 40/60, movement, Endurance, decay — is
  untouched: `git diff 16c520c -- src/core/scoring` is empty. The design,
  every case and the numbers are `docs/design/wp3/stage5b-kennzahl.md`; the
  block's own decisions are D172 (the era), D173 (the warm-up mark) and
  D174 (the trial run and what the numbers showed).
- **An era.** `scoring.gymMetric` in the snapshot marks it and
  `gymMetricOf()` is its one reader. `ensureGymMetricEra()` appends it on
  the first load, after the three existing steps and into the snapshot they
  wrote for that day: a device as the live build left it (Food on, the
  three-day window) takes all three eras in **one** snapshot on one load
  and writes nothing on the second. A new device carries the field from its
  first snapshot. Each scored day computes its whole window in its own
  day's metric; the screens read the metric of the day their range ends on.
- **The two proofs that no earlier day moved.** (1) Every existing golden
  file, the Stage 2 and Stage 4 baselines and every fingerprint of
  `domainOutputs.test.ts` are untouched and green:
  `git diff 16c520c -- .github/fixtures` shows 25 added files and nothing
  else — the fixture profiles write their snapshots by hand and were pinned
  to the old metric all along. (2) Four seeded histories with several sets
  a day were frozen from the engine *before* the stage
  (`.github/fixtures/stage5b/`, commit `9dfb658`) and still replay to the
  last bit (`stage5bLegacy.test.ts`); and over seeded histories every day
  before the boundary has the same value in every output field once the
  marker is appended as before it (`gymMetricEra.test.ts`, five update
  days, five clocks).
- **New profiles and golden files.** `metricCrossingProfile()` — sixteen
  weeks lived under the old metric, crossing on a Monday, frozen at five
  clocks round the boundary — and `strengthProfile()` — the new metric from
  day one, with double progression in 8–12 reps, a pyramid, drop sets,
  marked and unmarked warm-ups, a day of warm-ups only, a single light day
  with six and with four exercise-days, a light week and a bodyweight
  exercise over a changing weight: sixteen files `stage5b-*.json` in
  `.github/fixtures/wp3-golden/`, committed on their own (`a33a025`).
- **The fixed order** is bound to the era (D172): the same sets under other
  record ids replay to the same bits from the boundary on, and no existing
  golden file changed its row order — the exception D150 allowed was not
  needed.
- **The warm-up mark** (D173). The set's number is the control: a named
  44px toggle, and the word "Aufwärmsatz" above a marked row, which keeps
  one line down to 320px in pounds. `warmUp: true` or absent on the record;
  editable today and yesterday by the one write rule; an undo brings the
  set back marked; "Satz hinzufügen" does not copy the mark; it counts for
  the week and never for the metric. The backup carries it;
  `SCHEMA_VERSION` 5 and `BACKUP_FORMAT_VERSION` 3 are unchanged.
- **What names earlier sets, and what each shows now.** The "Zuletzt am …"
  line of a planned workout and the placeholder of a row not yet stored:
  working sets only, passing over a day on which the exercise had warm-up
  sets only. "Bester Arbeitssatz" in the workout: the service's answer in
  the metric the screens read today, never a marked set, "Noch kein
  Arbeitssatz." when there is none. The exercise list and the exercise
  detail: exercise-days, so a day of warm-ups only is not among them.
  Muskelgruppen: says when a range holds warm-up sets only. The week's
  count, the share of a plan that is done and a session's set count still
  count every set.
- **The numbers** — the design's last section, and
  `docs/design/wp3/stage5b/zahlen-*.md` as generated by
  `stage5bReport.test.ts`. The step at the update is larger than the review
  estimated (about 50 points in the target, about −26 after a week): −197
  in the target and −42 in the Gym rating after a week for a history of
  strict double progression, −123 to +14 and −37 to +9 over seven update
  days of the sixteen-week profile. The cause is the untouched curve
  ("Risks and known debt", below).
- **The run with the owner's own data is missing.** He attached no backup,
  and neither repository holds one with a Gym set. The trial run uses a
  backup the live build made itself through its own interface
  (`scripts/verify/stage5b-live-backup.mjs`): five weeks, 194 sets,
  `docs/wp3/stage5b/momentum-pruefdaten-5b.json`. It is also the file the
  owner loads into the live app and the preview at his check;
  `stage5bImportFile.test.ts` and `stage5b-import-check.mjs` hold what he
  reads there. The live build offers 7 and 30 days where this build offers
  30 and 90, so the two are compared at 30 days.
- **Decided at STOP 5b** (owner, 2026-11-15, D175). He checked the
  preview with the import file on his iPhone — points 3 to 9 of the
  checklist, the preview only — and found nothing.
  - *The median stands.* `GYM_COMPARISON_CONFIRMED` is `true`.
  - *The exercise detail draws a line.* `ExerciseLineChart.tsx` is the
    chart of `ExerciseDetail`: each day as its change since the first day
    shown, on the scale of the muscle rows — 12 % to the edge, widened in
    steps of six where a series goes further — with the end value right of
    the plot and one day as a dot without a value. The bars, their styles
    and the dev-only switch are gone; the table a screen reader gets gains
    the change since the first day. Contract §6 says so. The pictures the
    owner chose from stay as `linie-oder-balken-*.png`; the built line is
    `uebungsdetail-linie-*.png`.
  - *A hint says where the warm-up mark is*, under the sets of the first
    exercise that has one, until a set has been marked once: the first mark
    is recorded as `settings.warmUpMarkUsed`, so a mark taken off again
    does not bring the hint back. Contract §5 says so.
  - *The curve gets a block of its own, "Kurve"*, directly after 5b and
    before 7B, and the colour strength on the body with it:
    `docs/wp3/prompts/prompt-kurve.md`. His aim: whoever manages one rep
    more every week and then more weight, as in the import file, does not
    stand lower after the update than before.
  - *His own backup* does not exist ("Ein Backup mit echten Daten gibt es
    nicht"): the run with real data stays missing, and "Kurve" measures on
    the import file and the profiles.
  - *Said to him, not decided:* the figures above the chart compare the
    last day with the one before, the chart's end value the last day with
    the first shown, so the two can differ, even in sign. And the held
    band (−2 % to +2 % shown, D153) now sits where a single step lands:
    one rep more at the same weight is `1 ÷ (30 + reps)`, so 8 to 9 reps
    reads "+3 %" and 11 to 12 reads "Gehalten" in those figures. Nothing
    was changed for it; "Kurve" shows the numbers and asks (its design,
    point 11).
- **Seen in the closing review of the era's mechanics, and left**: see
  "Risks and known debt" — a snapshot dated between today and a kept
  boundary.
- **Verification** — against step 0 of the block, taken on `16c520c`:
  `tsc -b` 0. `npm run test` **exit 0**, 121 files and 2052 tests (113 and
  1892 before), two more skipped — the report and the profile writer, which
  run only when asked. `npm run build` clean: `index.js` 514.90 kB
  (509.36), `index.css` 91.32 kB (90.57); the proposed line chart is not in
  the bundle. **Every browser suite of step 0 ends as it did**, suite by
  suite, with the same number of checks: 39 suites, 38 exit 0, 4400 of
  4401 checks (38 suites, 37, 4080 of 4081 before); the one more is
  `wp3-stage5b.mjs`, 320/320 at four widths; the one red check is the one
  that was red before the block — `release-proof.mjs`, "offline, Gym still
  shows the 3D body" — and is block 9's. The four 3D suites ran one at a
  time: `gym-muscles` 74/74, `body-reach` 3/3, `farbregeln` 322/322,
  `body` 40/40. Four suites state the new rule where they stated the old
  one — `phase4`, `wp3-stage2`, `design-system`, `farbregeln` (commit
  `ee65c0e` names each) — none with a check fewer. The six fingerprints of
  `domainOutputs.test.ts` are the ones of step 0; `git diff 16c520c --
  .github/fixtures` is additions only. Replay over 730 days, three runs
  each, before and after: rating 38–46 and 41–58 ms, Boss 54–81 and
  55–105 ms, the answers read alone 17–25 and 16–21 ms, the full Boss
  replay 52–70 and 52–68 ms — inside the noise of the machine, with the
  four bounds of `replayPerformance.test.ts` unchanged and held. The
  import file was loaded into the live build and into this one through
  their own interfaces on each day from 15 to 21 November
  (`stage5b-import-check.mjs`, 77/77). **Not checked:** the owner's own
  data, and a real iPhone — the checklist of STOP 5b is his.
- **Verification after STOP 5b** — the median confirmed, the line and the
  hint built: `tsc -b` 0; `npm run test` exit 0, 122 files and 2066 tests;
  build clean, `index.js` 517.24 kB and `index.css` 91.72 kB, with the line
  in the bundle and no bar. Every browser suite again, the 3D suites one at
  a time: 39 suites, 38 exit 0, 4436 of 4437 checks, each suite as in the
  run before except `wp3-stage5b.mjs`, now 356/356 with the hint's nine
  checks a width; the one red check is the same. No check was dropped: the
  four unit tests of the bar's height hold the same four statements for the
  line, the five bar checks of `design-system.mjs` hold the line to the
  same five things, and the bundle check of `wp3-stage5b.mjs` holds the
  opposite of what it held. The six fingerprints are unchanged and
  `.github/fixtures` is untouched since the block's verification.
  Published as `Momentum-preview` `7426881`, built from `b46c44b`. **Not checked on the iPhone
  yet:** the line and the hint.

**WP3 block "Kurve" — the curve's value for the new metric, and the tint's
strength** (branch `claude/momentum-wp3`, not merged; **built and accepted
by the owner on his iPhone on 2026-11-15**, from the `Momentum-preview`
build `28e8ca0`, with his four answers at STOP Kurve built in the same
session — D177, D178, D179, D180)
- **What changed.** From the Stage 5b era on, a Gym day's two windows
  become a level by the same curve at a value of its own: **every three
  points of improvement multiply the odds by four**, where the constants
  say ten. +3 % is the 800 that +10 % was. The value travels in the marker
  of Stage 5b, `scoring.gymMetric.curveDecadePercent`, and the rating reads
  it from each day's own snapshot (`gymCurveOf()` beside `gymMetricOf()` in
  `core/gym/metric.ts`). And a tint on the body is **full from 8 %** where
  it was 12 %. The design, every candidate and the numbers are
  `docs/design/wp3/kurve.md`; its last section is what was built.
- **The aim, and the reading.** The owner's aim (STOP 5b): whoever adds a
  rep a week and then weight, as in the import file, does not stand lower
  after the update than before. It is read **on every day from the
  update** — not on average, not where the rating settles — for a history
  of five weeks or more. Met: the import file loaded once stands at 833.1
  where it stood at 831.7 (level 952 for 884, target 971 for 930; Stage
  5b's curve gave 828.0), and the same diary continued for forty weeks is
  lower on no day of the ninety after the update, whichever of 155 days
  the update loads on. In the long run he stands higher than before, 974
  for 931. With the update inside the first five weeks no candidate meets
  the aim; at three the rating can stand up to 14.4 points lower for at
  most seventeen days. `gymCurveGoal.test.ts` holds all of it.
- **The other side** — the same person without progress: the same sets
  every week stay at 700.0; an ordinary up and down of one rep moves the
  rating between 682 and 734 (old rules: 675 to 716); a light day and a
  light week move nothing (old: down to 637 and 582); one rep less for
  good goes down to 543.5 (old: 526.0).
- **One function.** `mapPerformanceChangeToScore(change, decadePercent?)`
  and `performanceScore(input, decadePercent?)`: without the argument the
  module's constant rate, bit for bit as before — every Running day, every
  Gym day before the era. `TRAINING_RATING.CURVE_ODDS_PER_DECADE` and
  `CURVE_DECADE_PERCENT` are untouched. This amends D101: the five
  properties stay shared; the one tunable may be a domain's own in an era
  of its own, carried in that domain's snapshot.
- **Three states of a snapshot**: *before* (no marker), *metric only* (the
  marker without the value — only a Stage 5b preview wrote such),
  *complete*. A missing value is the curve at ten, never today's.
  `ensureGymMetricEra()` gives a device the live build left metric and
  curve in one snapshot — one boundary — and a device a preview left the
  value added to the marker it has, from that day; a second load writes
  nothing on either. Nothing is written into a snapshot dated in the past,
  and `ensureCurrentSnapshot()` carries the field of a day before a kept
  boundary as the stored snapshot has it. `SCHEMA_VERSION` and
  `BACKUP_FORMAT_VERSION` are unchanged.
- **`GYM_CURVE_CONFIRMED` is `true`** since STOP Kurve (D180): the owner
  chose three, with 4 (flatter) and 2.5 (steeper) laid beside it. Changing
  the value again would be a decision and an era of its own — a snapshot
  written with three keeps three for the days it covers.
- **No day before the boundary moved, and no day of Running.**
  `gymCurveEra.test.ts`: four seeded histories, five update days, three
  clocks, the build before Stage 5b, Stage 5b and this build side by side;
  the value arriving after the metric; Running in every field under the
  era, the marker without the value and four values of the curve; the
  value in the snapshot is what the replay runs, for values this build
  does not ship among them. Under `.github/fixtures` **seven**
  `stage5b-*.boss.json` were frozen again — the level and what follows from
  it, nothing else, no day before the boundary; all eight `*.gym.json`, the
  two files of 2026-05-17, every other golden file, the baselines and the
  six fingerprints are what they were
  (`scripts/verify/kurve-golden-diff.mjs`, `docs/design/wp3/kurve-golden.md`).
  In the profile under the metric from day one the promotion to master is
  confirmed on 8 April instead of 16 April.
- **Tests restated, none removed or weakened**: `metric.test.ts` (the
  snapshot's marker has four fields), `gymScoring.test.ts` (+10 % in both
  windows: 800 before the era and under a marker without the value, 990
  under the complete one), `gymMetricEra.test.ts` (the update day's level
  and each day of the era are the pure windows mapped by the value the
  snapshot names; the preview device keeps the curve as it was),
  `bodyVisuals.test.ts` (the strength grows to 8 %), and the browser suite
  `wp3-stage5b.mjs` (the update's marker: its three fields as they were,
  the fourth in a check of its own). `stage5bReport.test.ts`
  — a report, not a test — is pinned to the marker without the value, and
  the three reports of Stage 5b regenerate byte for byte.
- **The tint** (D179): `TINT_STRENGTH.toPercent` 8; `min` 0.3 and
  `fromPercent` 2.5 as they were. Strengths 0.36 at 3 %, 0.62 at 5 %, 0.87
  at 7 %, full from 8 %. Measured on the production build with the import
  file at 30 days, each zone against the same zone held: the chest at +3 %
  21.3 ΔE (20.7 before), the calves at +7 % 49.1 (36.9). `farbregeln.mjs`
  passes with its rules and examples unchanged. `stateIntensity()` takes
  the upper end as an argument no screen hands in; the dev harness does
  (`#/dev/body?tintTo=`). Pictures: `docs/design/wp3/kurve/vergleich-*.png`.
- **The import files** (`docs/wp3/kurve/`, its README says which is for
  which day). The STOP fell on 15 November 2026, the last day of the Stage
  5b file, so `momentum-pruefdaten-kurve.json` holds that file's diary,
  made afresh by the live build through its own interface; two more carry
  it to the 16th and the 17th, because a file loaded on a later day than
  its last session shows the same rating in both apps until a day is
  scored again. Read off the live build and this one
  (`stage5b-import-check.mjs`) and held by `kurveImportFile.test.ts`:
  832 and 833 on the 15th, 818 and 836 on the 16th, 803 and 821 on the
  17th.
- **Decided at STOP Kurve** (owner, 2026-11-15, D180). He checked the
  preview on his iPhone and found nothing, and answered the four questions.
  What follows is the state now, and it supersedes the 12 % and the ±2 %
  named in the records of Stage 6b, the colour rules and Stage 5b above.
  - *Three stands*, and *a tint is full from 8 %*: as built.
  - *The rows and the exercise detail go to 8 %.* `SPARK_SCALE` and
    `LINE_SCALE` are 8, and the exercise detail widens in steps of four.
    A row's line stands 3.4 pixels above its zero line at +3 % and 7.9 at
    +7 %, where it stood 2¼ and 5¼ (its half height is nine pixels; the
    design and the STOP report had counted with twelve — the shares they
    named were right). At 90 days more rows stand at the edge. Contract §6
    says so, and the sheet's chart of 7C takes the same scale.
  - *The held band is one-sided.* −2 to +1 % is held, a rise counts from a
    shown +2 %, a fall from a shown −3 % as before — so one rep more at the
    same weight reads as progress at every rep count, and one rep less is a
    decline up to ten reps and held from eleven, as it was. One function,
    `trendOfShown()` in `muscleState.ts`; contract §7 says so. The legend
    explains it at the two figures that differ: "Ab +2 %. Schon eine
    Wiederholung mehr zählt als Fortschritt." and "Ab −3 %. Eine kleine
    Schwankung nach unten zählt noch nicht als Rückgang." A sentence of its
    own under the states slid below the visible part of the sheet on a
    320-pixel phone; on that phone the sheet's last line, what an exercise
    day is, is reached by scrolling the sheet.
  - *The tint's scale did not move for the band.* A rise shown as "+2 %"
    takes the weakest strength, 0.3, and the scale from 2.5 % to 8 % is the
    one he accepted. The design had expected the start to move to 1.5 %,
    which would have made +3 % a strength of 0.46 where he had just
    accepted 0.36.
  - *What moved:* no rating and no fingerprint. In the golden files 24
    states in seven `stage5b-*.gym.json` went from held to improved, each
    at a shown +2 % (`scripts/verify/band-golden-diff.mjs`). On the import
    file the ten group figures are what they were; in the exercise list
    Kniebeuge, Wadenheben and Bizeps-Curls read "+2 %" in green where they
    read "Gehalten".
  - *Tests restated, none removed or weakened:* the band's table and its
    constants, the hub card's held example, the four chart tests on the
    scale of 8 and the step of four, the tint at +2 %, the flag; and three
    browser suites — `farbregeln.mjs` (the fixture's rising edge at +2 %
    and +1 %, the smallest rise on the body at +2 %, the legend's words,
    and the legend's last line measured after scrolling where a narrow
    phone hides it), `gym-muscles.mjs` and `design-system.mjs` (the band,
    the line's scale and step). D180 lists each.
- **Verification after STOP Kurve** — the value confirmed, the scale and
  the band built: `tsc -b` 0; `npm run test` exit 0, 126 files and 2205
  tests (2199 before the STOP); build clean, `index.js` 518.19 kB and
  `index.css` 91.72 kB. Every browser suite again, the 3D suites one at a
  time: 39 suites, 38 exit 0, 4445 of 4446 checks, each suite as in the
  run before the STOP except `farbregeln.mjs`, now 330/330 where it had
  322 — two more checks a width, for the legend's note and for its last
  line being reachable; the one red check is the same,
  `release-proof.mjs`, "offline, Gym still shows the 3D body".
  `gym-muscles` 74/74, `body-reach` 3/3, `body` 40/40. Measured by
  `farbregeln.mjs` on the rendered body: the chest at +2 % — the smallest
  rise the band now shows, at the weakest strength — stands 19.5 ΔE from
  the same chest held, the quadriceps at −3 % 20.4, and +7 % is greener
  than +2 % (a* −45.2 against −17.3). The six fingerprints are unchanged;
  of the golden files only the state column of seven `stage5b-*.gym.json`
  moved (`band-golden-diff.mjs`), and `kurve-golden-diff.mjs` still passes
  on its own two commits. No scoring code changed after the STOP, so the
  replay timings were not taken again. **Not checked on the iPhone yet:**
  the lines on the scale of 8 %, "+2 %" in green, and the legend's two
  sentences.
- **Preview after STOP Kurve.** `Momentum-preview` `ae10d3d`, built from
  `d43414b` as before; served from a local server under
  `/Momentum-preview/` before the push, the published tree imports the
  file of the STOP day, shows the Gym rating 833 and names the exercise
  detail's scale "+8 %". Pictures of the rows and of the exercise detail
  on the old scale and the new: `docs/design/wp3/kurve/nach-stop-*.png`
  (in the comparisons "nachher" is the scale to 12 % as the block was
  accepted, "nach-stop" the scale to 8 %).
- **Seen and left**: abstinence decay can still cost a whole tier (D174) —
  with the built value a break after the import file ends at 700.0, as
  under the old rules; the edge of the three load steps with a date that
  moves back two days is block 9's; **the Gym screen prints neither the
  level nor the target** — the prompt's checklist assumed it does — so
  they are stated in the report and held by tests, and show on the screen
  as the rating; `D101` called the curve's symmetry exact, and it is exact
  to one unit in the last place of a double, which the tests now hold.
- **The run with the owner's own data is still missing.** There is no
  backup with a Gym set in either repository; every number is from
  invented diaries.
- **Verification** — against step 0 of the block, taken on `78a22ef`:
  `tsc -b` 0. `npm run test` **exit 0**, 126 files and 2199 tests (122 and
  2066 before), one more file skipped — `kurveReport.test.ts`, which like
  the Stage 5b report runs only when asked. `npm run build` clean:
  `index.js` 517.99 kB (517.24), `index.css` 91.72 kB (91.72). **Every
  browser suite of step 0 ends as it did**, suite by suite, with the same
  number of checks, except one: 39 suites, 38 exit 0, 4437 of 4438 checks
  (4436 of 4437 before). The one that changed is `wp3-stage5b.mjs`, whose
  check of the owner's device compared the update's marker with the three
  fields Stage 5b wrote: 355 of 356 on the first pass, restated — the
  three fields held as they were, the fourth in a check of its own — and
  357 of 357 after. The one red check is the one that was red before the
  block, `release-proof.mjs`, "offline, Gym still shows the 3D body", and
  is block 9's. The four 3D suites ran one at a time: `gym-muscles` 74/74,
  `body-reach` 3/3, `farbregeln` 322/322, `body` 40/40 — `farbregeln` with
  its rules and its examples unchanged. The six fingerprints of
  `domainOutputs.test.ts` are the ones of step 0; `git diff 78a22ef --
  .github/fixtures` shows the seven `stage5b-*.boss.json` and nothing
  else. Replay over 730 days, eight runs each at the commit before the
  block and now, one after the other on the same machine: rating 47–68
  and 46–91 ms (median 56 and 51), Boss 64–103 and 68–105 ms (75 and 75),
  the answers read alone 20–29 and 19–30 ms (21 and 21), the full Boss
  replay 69–101 and 64–93 ms (83 and 73) — inside the noise of the
  machine, with the four bounds of `replayPerformance.test.ts` unchanged
  and held. The number report regenerates byte for byte from the final
  code (`KURVE_REPORT=<dir> npx vitest run kurveReport`). The three import
  files were loaded into the live build and into this one through their
  own interfaces (`stage5b-import-check.mjs`: 88 of 88 over eight days for
  the file of the STOP day, 11 of 11 for each of the other two on its
  day). **Not checked:** the owner's own data, and a real iPhone — the
  checklist of STOP Kurve is his.
- **Preview.** `Momentum-preview` `28e8ca0`, built from `50c5ff7` with
  `--base=/Momentum-preview/` and `VITE_MOMENTUM_DB=momentum-preview`; the
  status bar stays `default`, `sw.js` and the sourcemaps are not
  published. Served from a local server under `/Momentum-preview/` before
  the push, the published tree imports the file of the STOP day through
  its own "Backup importieren" and shows the Gym rating 833, the ten rows
  and the body with the new strengths. The address `hnd7k02.github.io`
  itself is not reachable from the session.

**WP3 block 7B — the body's stage: size, operation, motion, taps, and the
measuring display** (branch `claude/momentum-wp3`, not merged; **built and
accepted by the owner on his iPhone on 2026-11-16**, without findings, from
the `Momentum-preview` build `275cfbc` — D181, D182, D183, D184)
- **What changed.** Muskelgruppen is the body's stage (contract §8, mock-up
  1): the body stands on the ground without a card, as wide as the screen
  and as tall as 55 % of what the device shows, under a header in 17px, the
  range and a metrics strip of three cells; the five states and the ten
  rows follow on the ground. It is operated by time and by rule: a coast
  and a travel are the exact solution of their equation over the time that
  passed (`motion.ts`), a tap never turns the body, a tap reaches a group
  from twelve pixels beside it and never selects head, hands or feet
  (`picking.ts`), two fingers zoom between 1.0 and 1.8 in a window that
  keeps a chosen group inside (`framing.ts`), a double tap and a button
  reset. A sheet stands over a still body and nothing is drawn under it
  (`app/stillness.ts`); a lost graphics context ends with the body or the
  flat figure, which stands in the stage at the body's size. Until the
  first picture the body's still stands where the body will stand, and
  while it does a finger moves nothing. Heute's Gym label opens
  Muskelgruppen directly and back returns to Heute. D182 has each of these
  with its reason.
- **The measuring display** (D181) was built first: `features/measure/`,
  off until the owner switches it on under Bereiche → Einstellungen →
  "Messanzeige beim Körper". It shows the load in three legs with each
  file's source, the frames of a rotation, the frames of the last idle
  second, what the renderer draws, the display's rate, device and visible
  area, and copies all of it as text. The switch is the first and only use
  of local storage; nothing of it is in the schema or a backup. The display
  is the one place that may carry technical words.
- **What it found.** The live build draws only every second display frame
  while the body turns: the next frame was asked for one refresh late. On a
  canvas small enough for the software renderer to keep up, a drawn frame
  every 33.4 ms where block 7B draws one every 16.7 ms. And at eleven
  frames a second the old inertia was still coasting two seconds after the
  finger had lifted. Both are fixed with the motion. At the end of the
  block its idle line read "1" where it should read nought, and behind
  that stood three frames nobody had asked for: one for every render of
  the viewer (the ground under the feet was given a new function each
  time, and the renderer's root wrote to its store on every render of the
  canvas) and one after every scroll of the page (the renderer measured
  the canvas again). All three are gone, and held by a check each. The
  display itself was wrong twice and is right now: it took a slow frame
  for a pausing finger — whether a finger paused is read from its own
  events, by the times they were made — and it called a body that drew
  while nothing moved "waiting for a second of rest".
- **Decisions of mine, named at the STOP** (D182): the 55 % are the stage, as
  the mock-up has them, and the body fills 84 % of it — 46 % of the screen,
  where the prompt's criterion reads 55 % for the body; the strip's third
  cell prints the change as its figure and the group beneath it, and says
  "keine Verbesserung" where no group improved; the neutral zone is not
  see-through; a drag that begins up or down scrolls the page; the zoom's
  window keeps the chosen group; a context lost while the body was turned
  sets the view back to the start, where the still shows it; the ground under
  the feet is a small disc in the scene, not the mock-up's wide halo; the
  display tells its panel once more a second after a motion ended; the hub is
  reached from Muskelgruppen by a row at the foot of the screen.
- **Not changed.** `git diff 6a1ea05 -- .github/fixtures src/core
  src/storage` is empty. `muscleState.ts`, the body's colours, the model,
  its light and its material, the content of the ten rows: untouched. No
  golden file and no fingerprint was frozen.
- **Tests restated, none removed or weakened.** Unit tests: none restated;
  seven new files. Browser suites, each with the old rule and the new in its
  own comment: `body.mjs` (40 checks → 97: the drag "22° plus some inertia"
  is a flick whose coast is the 76° its speed gives, to the degree; the two
  grid passes no longer put the body back after a hit on the far side — a tap
  that meets a turned body fails; the frame's empty edge is its last
  hundredth, since the ground under the feet fades out inside the frame; live
  contexts are counted on the canvases, since the suite now loses contexts on
  purpose; and a motion's time is measured in the page from the moment it is
  asked for to its last frame and held to what its equation gives — 710 ms
  for a travel over 180°, 1265 ms for a coast from 275° a second — at every
  frame rate, where the first form of the check compared three runs read off
  the reported angle), `body-reach.mjs` (3 → 12: 10 of 10 at 320 where 9 of
  10 was accepted, 360 added, each view held to the groups that face it, no
  tap may turn the body, nothing is put back, and two taps that lie near one
  another wait so that they are no double tap), `gym-muscles.mjs` (74 → 176:
  a hidden tab and a stage scrolled away run no frame at all, where "fewer
  than a quarter of a watched second" was asked; the display is read after a
  turn by a finger that keeps moving — an event every 8 ms on a clock,
  `fingerTurn` — where sixty `mouse.move`s hopped once a frame),
  `wp2-2-shots.mjs` (162 → 192: Heute's label is named "Gym: Muskelgruppen
  öffnen" and lands on Muskelgruppen, where it was named "Gym öffnen" and
  landed on the hub; Back from the hub leads to the area the hub was entered
  from; "the 3D body, not a still" is held once the stage says the body is
  shown), `geometry.mjs` and `wp3-stage1.mjs` (the rows stand on the screen's
  16px margin outside any card, where they stood on a card's content edge),
  `phase4.mjs`, `wp3-reload.mjs` and `farbregeln.mjs` (the count of rated
  groups is the strip's second cell, "7 / 10" over "Gruppen" and named "7 von
  10 Gruppen gewertet", where it was the tile's line), `design-system.mjs`
  (1156 → 1164: the stage's texts are named among the measured runs).
  `wp3-reload`, `wp3-stage1`, `wp3-stage2` and `farbregeln` reach the hub by
  the tab and the area, where they tapped Heute's old label; every suite
  addresses the back button by its exact name, since "Ansicht zurücksetzen"
  contains it. `body-tones.mjs` reads the zones of the stage's frame. And one
  check that has nothing to do with the block, found because the closing run
  fell on a Monday: `phase41.mjs` asked for "1.5 von 4 Wochen" after a missed
  week on every day and failed on every Monday since the one-day window — the
  week that ended on Sunday is judged from Tuesday 00:00 (D134), so on a
  Monday the tile says 0.5. It now asks for 0.5 on a Monday and 1.5 on every
  other day; the build of `6a1ea05` fails the old check the same way on the
  same day.
- **Verification** (2026-11-16): `tsc -b` clean; `npm run test` exit 0, 133
  files, 2294 tests (126 and 2205 before the block); build clean, `index.js`
  541.65 kB (518.19), `index.css` 96.10 kB (91.72), the viewer's chunk 875.79
  kB (861.41), the stage's still 25.75 kB; 39 browser suites, 38 exit 0, 4651
  of 4652 checks (39, 38 and 4445 of 4446 before). Red: the offline check of
  `release-proof.mjs`, as before the block (tidy-up, D163). `body-reach.mjs`:
  12 of 12 — 10 of 10 at 393, 430, 360 and 320 (1340, 1664, 1088 and 888
  taps), each view reaching every group that faces it, and none of the 4980
  taps met a body that had turned.
- **Measured in the headless browser** (software renderer; says nothing about
  an iPhone), at 393 × 852 with `body-measure.mjs`, beside the targets of the
  review: first load 1.73 s to the first picture (target 2.5 s), second load
  1.51 s (target 1 s from the cache — not met here: 1.3 s of it start the
  canvas and generate the studio's environment in software, the files come
  out of the app's store in milliseconds), without the offline store 1.51 s
  with 241 kB of code and 707 kB of model over the wire; turning 9 to 10
  frames a second, none under 25 ms, the longest frame 126 to 168 ms
  (targets: 55 a second and 95 % under 25 ms — these are a software
  renderer's numbers); the idle second 0 frames (target 0); 12 draw calls,
  50,488 triangles, one texture of 768 × 1024 (targets: 12, 80,000, one of
  1024²).
- **Preview**: `Momentum-preview` `275cfbc`, built from `c24c8d4` with
  `--base=/Momentum-preview/` and `VITE_MOMENTUM_DB=momentum-preview`; its
  own `index.html`, status bar `default`, no `sw.js`. Checked from a local
  server before the push: its own database, Heute's Gym label to the body
  and back to Heute, the switch of the measuring display in the settings.
- **The owner's acceptance and answers** (2026-11-16, D184): "STOP 7B:
  abgenommen. 1 A, 2 A, 3 A, 4 A, 5 A. iPhone: alles ok, keine Befunde."
  Each answer is what was built, so nothing changed after his check: the
  measuring display stays in the release as a switch in the settings, off
  by default; the strip's third cell prints the change as its figure and
  the group beneath; with no improved group it says "–" over "keine
  Verbesserung"; a drag that begins up or down on the body scrolls the
  page; and the 55 % are the stage, the body filling 84 % of it. The
  contract says each of them now (§4, §8, §13).
- **The owner's measurements** — the first from an iPhone in this project,
  three copies of the measuring display from the build `index-DQBEJ-V9`
  (the preview `275cfbc`) on 2026-11-16. Device: **iPhone 15 Pro, iOS
  26.3.1** (his word; the browser's string says Safari 26.3 and keeps
  "iPhone OS 18_7" fixed), the app from the home screen. Visible area
  393 × 793 points, the stage 393 × 436 (55 %), pixel ratio 2 of 3,
  drawing buffer 786 × 872, "Apple GPU", 63 frames a second as the frames
  show the display.

  | | on the iPhone | target |
  |---|---|---|
  | to the first picture, out of the cache | 193 ms | 1 s |
  | … with both files already in memory | 142 ms | |
  | … with both files checked over the network | 864 ms | 2.5 s over the network |
  | turning: frames a second | 60.2 on average | 55 |
  | turning: frames under 25 ms | 100 % of 154 | 95 % |
  | turning: longest frame | 19 ms | |
  | idle: frames in the last second | 1, and 2 | 0 |
  | draw calls | 12 | 12 |
  | triangles | 50,488 | 80,000 |
  | textures | 1 · 768 × 1024 | one of 1024² |

  - *Loading* meets its targets. 193 ms is a fresh start with code and
    model out of the browser's cache — the headless browser's software
    renderer needed 1.5 s. 864 ms is a start in which the browser checked
    both files over the network first (181 and 467 ms for the round trips)
    and then took them from its cache; the display reads that as "aus dem
    Netz, 0 kB". A first load with the files themselves coming over the
    network is in none of the copies.
  - *Turning* meets its targets: sixty frames a second, every measured
    frame under 25 ms, the longest 19 ms — after a drag of ten seconds
    without lifting, the third copy. The first two copies held no turn,
    and with them it was open whether the display counts a real finger on
    iOS at all; it does. **The 154 frames are 2.6 seconds of counted
    motion**, not ten: the display counts a frame only if the finger made
    an event within 50 ms before it, and the copy cannot say how much of
    the ten seconds was motion (D184).
  - *What is drawn* meets its targets on the device.
  - *Idle is not shown clean.* The copies read 2 and 1 frames in the last
    second, each what one touch on the body before the copy draws — the
    point for 7C below; nought on the device is still owed and comes with
    that point built. That a finger making several events a frame leaves
    frames behind was tried in the headless browser and is ruled out.
  - *Hits of ten taps:* left open twice; not asked again (D184).
- **Points for block 9 from his copies** (D184), where the measurement
  protocol is release evidence and WebKit runs. Not built:
  - the display prints how many frames it drew in all since the screen was
    opened, beside the ones it measured, so that a reader sees what share
    of a turn was counted;
  - it names a file the browser checked over the network and took from its
    cache as that, where it says "aus dem Netz, 0 kB".
- **A point for 7C from his copy** (D184): a touch on the body draws two
  frames even when nothing changes — `onDown` and `onUp` in
  `CameraRig.tsx` each ask for one. Needed only when something was moving
  or was moved; harmless, but frames nobody needed, and the reason the
  display's idle line reads "2" after a tap. Not built.
- **Check data** (D183): `docs/wp3/stage7b/` — the invented diary of the
  block "Kurve", made anew by the live build's own interface, one file
  whose last session is on each day from 16 to 18 November 2026, each read
  off both builds (`stage5b-import-check.mjs`, 11 of 11 a file): Gym rating
  836, 821 and 807 in the preview, every group rated and improved, the
  strip "+6 % · 10 / 10 · +7 % Waden" on the 16th. **The run with real data
  is missing: there is no backup with real data.**
- **Pictures**: `docs/design/wp3/stage7b/` — at 320, 360, 393 and 430 the
  top, a chosen group, nothing trained, loading, zoomed, the flat figure,
  the switch and the measuring display; the four states the build before
  the block has, before and after side by side.
- **Seen and left.** The offline check of `release-proof.mjs` (tidy-up).
  The check files show a body that is green all over: a diary with a held,
  a declined and an untrained group would show more of the stage (the
  pictures do). The exercise detail still
  takes the body down while it is open and stands above the row that leads
  to the hub (7C rebuilds the way from a group to its exercises). Whether
  the viewer and the model should be loaded ahead on Heute is a question
  for the owner's numbers, not built. The hub does not yet land on the
  plans when "Pläne verwalten" is tapped from the chooser (tidy-up). The
  view buttons do not say that the body is zoomed. The measuring display
  calls a file the browser only checked over the network and took from
  its cache "aus dem Netz", with the few bytes beside it (D181).

**WP3 block 7C — the muscle sheet: two heights, the body above it, one
change for an exercise, and the work volume** (branch `claude/momentum-wp3`,
not merged; **accepted at STOP 7C on 2026-11-16, except the Dips, and
corrected after it** — D185, D186, D187)
- **What changed.** A tap on a muscle of the body or on a group's row opens
  the group's sheet (contract §9, mock-up 2). It opens at two thirds of the
  screen, is dragged to 92 % and down to close, and hands a drag over
  between itself and its content as a phone does
  (`components/sheetDetents.ts`); its grabber is a control with a name.
  Back — the button's and the browser's — closes it without a new place in
  the address (`app/backLayer.ts`) and walks step by step: exercise, sheet
  of the same group, Muskelgruppen. One group is chosen while its sheet
  stands and none once it has gone; a row is a button that opens a dialog,
  no longer a toggle. Nothing stands under the ten rows but the way to the
  hub: the list of every exercise is gone, and an exercise's detail lies on
  top of Muskelgruppen instead of replacing it. D185 has each of these with
  its reason.
- **What the sheet shows** (D186), in this order: the name with its dot
  and the cross; the group's change in `--type-figure-l` with its state as
  a chip — the very `ShownMuscle` the row and the body read; "Bester
  Arbeitssatz · letzte 30 Tage"; the range, which is the screen's own; the
  group's line on the rows' scale; its exercises, each with the best
  working set in the range and its change in the range; and the work
  volume per week, "nicht gewertet". "uneinheitlich" stands beside the
  state where the exercises lie more than ten points apart as shown
  (`isUneven` in `muscleState.ts`, the one thing added there). Too little
  to compare: no chart, the sentence, and under "Erfasst" every recorded
  day. Not trained in the range: a sentence, the day the group was last
  trained before the range, and "Training erfassen".
  `features/gym/muscleSheet.ts` shapes all of it and computes none.
- **The body above the sheet** (D185). The page brings the stage under the
  header, the camera travels to the window that shows the group in the
  strip above the sheet — zoom and place, never the angle after a tap;
  opened from the list, the body has turned to the group first — and the
  screen holds the viewer from the moment the camera rests. No frame
  arises under the sheet, a change of the range draws exactly one, an
  exercise opened on top draws none. When the sheet goes, the stage is at
  1.0 again, the angle stays, and the page is where the user had it. The
  sheet is a solid surface on a scrim that neither dims nor blurs, at
  every moment: nothing blurs over the body while a frame is drawn.
- **One change for one exercise** (D176, D186). Built is the form with one
  figure: an exercise's change is the one in the range — the comparison
  its groups' figures are the mean of — in its row in the sheet and at the
  head of its detail, with its state and under the same words. On the
  detail "Zuletzt" and "Davor" are two sets with no percentage between
  them, and the line ends without a figure; a sentence under the chart
  says what the line draws. The other form, two named figures, is drawn
  beside the built one in the pictures and goes to the owner as a
  question.
- **The work volume** (D152, D186): Σ reps × effective load over the
  working sets, per group and week (`core/gym/volume.ts`), an exercise
  spread over its groups by the shares the rating spreads its change by
  and by the roles the day was logged under. Whole weeks of the range and
  the running one; neutral bars from zero, none in a state's colour; a
  week without a working set is a gap; from six weeks on the bars stand on
  an axis. Nothing that rates reads it (`volumeUnscored.test.ts`).
- **The owner's findings from the iPhone.** *D168, built*: the card
  "Muskelgruppen" on the hub is as tall before its history arrives as
  after, and its title stands in the same place — `muscle-card.mjs` was
  red first, the title moving by 10 to 30px in 18 of 24 cases. Whether the
  doubled title is gone is his to see on the device. *D169, built*: beside
  a chart the figure's column has one width, so all lines stand in one
  column. *D170, drawn and not built*: three candidates for a single
  observation — a line from the baseline, words in place of a chart, a
  stroke up from zero — for the row, the sheet's chart and the exercise
  detail; the build keeps the dot until he has chosen. *The point of D184,
  built*: a touch that changes nothing draws nothing.
- **What it found.** Every region had the box of the whole body: the
  regions share one vertex buffer, and `Box3.setFromObject` reads a
  geometry's whole position attribute. Block 7B's "a zoom keeps the chosen
  group in its window" therefore kept the body's middle. A region's box is
  now the box of the triangles it draws (`BodyModel.regionBox`).
- **Decisions of mine, named at the STOP** (D185, D186): only the muscle
  sheet is dragged and has a grabber — the decorative grabber is gone from
  every other sheet; Back closes the muscle sheet and the exercise detail
  and no other sheet; the selection is the open sheet, and the list of
  every exercise under the rows is gone; the exercise detail lies on top;
  the muscle sheet is solid for good, where the prompt allowed glass once
  the body stands; above the sheet the zoom goes to 2.6 where two fingers
  reach 1.8; "uneinheitlich" reads the figures as shown; the volume's
  shares are the rating's, by the roles as logged, over whole weeks; a
  recorded day under "Erfasst" leads to its exercise; and the block ran in
  the session of block 7B, at the owner's instruction, where D159 has a
  fresh one.
- **Different from the contract or the mock-up, on purpose.** The chart
  has three labels and the zero line in the middle where a group's line
  crosses zero (the contract names two labels); the figure stands right of
  the end point, on its height, as in the rows (mock-up: above it, where a
  falling line runs through it); the scale is ±8 % (mock-up: 12 %, from
  before D180); the last bar of the work volume carries no state's colour
  (contract §6 gives a chart's last bar the state: D152 outranks it, and
  §6 says so now); a chevron stands in each exercise row, because the row
  leads somewhere; and at 430px "Beinbeuger und Gesäss" breaks onto two
  lines beside its line, as it did at 393 before — the figure's column is
  as wide as its widest word in every row.
- **Not changed.** `git diff 54c15d4 -- .github/fixtures` is empty and
  `domainOutputs.test.ts` holds the same fingerprints; no golden file was
  frozen. Under `src/core` the one new file is `gym/volume.ts` with its
  tests; nothing under `core/scoring` and no rating service was touched.
  Under `src/storage` `gymService.ts` gained two functions that read and
  store nothing — `loadGymRange`, which hands on the sets the history is
  read from, and `lastTrainedBefore` — and `loadGymHistory` returns what
  it returned. In `muscleState.ts` no rule that makes a number a state
  moved. The stage, the body's operation, the model, the typing and the
  keyboard on every existing sheet (`wp3-sheets.mjs` unchanged, 330 of
  330): as they were.
- **Tests restated, none removed or weakened.** One unit test file
  (`exerciseDetailChart.test.tsx`: the head's one change and a line
  without an end value, where it held "Veränderung" against the day before
  and the end value beside the line) and thirteen browser scripts, each
  with its old rule and its new in `scripts/verify/README.md` under
  "Checks restated in block 7C": `phase4`, `phase4-a11y`, `release-proof`,
  `qa-shots`, `wp2-2-shots`, `wp3-reload`, `wp3-stage1`, `wp3-stage2`,
  `design-system`, `farbregeln`, `gym-muscles`, `body-reach`,
  `stage5b-import-check`, and the picture scripts `kurve-shots` and
  `stage5b-chart-shots`. In every case the old rule held a row that
  toggles, a list under the rows, or a second change of an exercise.
- **Verification** (2026-11-16): `tsc -b` clean; `npm run test` exit 0, 139
  files, 2406 tests (133 and 2294 before the block; six new files: `volume`,
  `volumeUnscored`, `gymRange`, `muscleSheet`, `sheetDetents`, `backLayer`);
  build clean, `index.js` 562.47 kB (541.65), `index.css` 103.04 kB (96.10),
  the viewer's chunk 878.30 kB (875.79); 41 browser suites, 40 exit 0, 5277
  of 5278 checks (39, 38 and 4651 of 4652 before). Red: the offline check of
  `release-proof.mjs`, as before the block (tidy-up, D163). New:
  `muscle-sheet.mjs` 231 of 231 and `muscle-card.mjs` 210 of 210. Grown with
  the sheet: `design-system` 1164 → 1300, `gym-muscles` 176 → 197,
  `farbregeln` 330 → 334, `wp2-2-shots` 192 → 198, `wp3-stage1` 312 → 318,
  `wp3-stage2` 198 → 201, `wp3-reload` 125 → 128, `phase4-a11y` 16 → 20,
  `phase4` 53 → 54, `release-proof` 26 of 27 → 27 of 28; no suite holds
  fewer checks than before, and `wp3-sheets.mjs` is unchanged at 330 of 330.
  `body-reach.mjs`: 12 of 12 — 10 of 10 at 393, 430, 360 and 320 (1340,
  1664, 1088 and 888 taps), every hit a sheet that opens and is closed
  again, and none of the 4980 taps met a body that had turned. The lowest
  contrast measured in the sheet is 5.96:1, in every state and at every
  width (the limit is 4.5:1).
- **Measured in the headless browser** (software renderer; says nothing
  about an iPhone), with the measuring display, three travels to a group
  and back at 393 × 852 (`stage7c-travel-cost.mjs`): the solid sheet as
  built 7.4 frames a second, the longest frame 190 ms; nothing over the
  body while it travels 7.9 and 197 ms; glass over a blurred scrim, which
  is forbidden, 5.8 and 328 ms. The two permitted ways draw alike, so the
  sheet answers the tap at once instead of waiting for the camera.
- **Preview**: `Momentum-preview` `387bfc9`, built from `4a61baf` with
  `--base=/Momentum-preview/` and `VITE_MOMENTUM_DB=momentum-preview`; its
  own `index.html`, status bar `default`, no `sw.js`. Checked from a local
  server before the push: its own database, the check file of 16 November
  imported through the interface, the card on the hub ("7 von 10 gewertet ·
  Leistungstrend +15 %"), the ten rows as the README of the check files has
  them, the back's row opening its sheet at two thirds with the body turned
  to it and held above, and Back closing the sheet on the same address.
- **Check data** (D183): `docs/wp3/stage7c/` — one file for each day from 16
  to 18 November 2026 (`momentum-pruefdaten-7c-<day>.json`), made by
  `stage7c-check-files.mjs`. Not the diary of the earlier STOPs, in which
  every group is rated and improved and which would show one of the sheet's
  five states: the device the block's checks and pictures run on, exported
  by the build through its own interface and read back on an empty device on
  its day — the ten rows and the strip the same, seven sheets saying what
  the file is for. Its rows were written by the script, not typed, which the
  README beside the files and D186 say; the diary files of STOP 7B are still
  right on the same days (the file of the 16th read off both builds again,
  11 of 11, Gym rating 836) and stand beside it for a realistic diary. **The
  run with real data is missing: there is no backup with real data.**
- **Pictures**: `docs/design/wp3/stage7c/`, 174 of them, with a README
  that says which are the app as built and which are drawn. At 320, 360,
  393 and 430: the sheet on both heights, at 90 days, "uneinheitlich",
  with too little, not trained and declined, once in English; the ten rows
  before and after; the card in each of its six states, loading and
  loaded. At 393 and 320: the candidates for a single observation
  (`kandidat-*`); the exercise detail beside the sheet's rows in both
  forms (`eine-zahl-*`, `zwei-zahlen-*`), on the device of the checks and
  on the bench press of the diary D176 was recorded on; and that bench
  press on the build of the commit before the block (`vorher-*`). The
  README also holds what someone reads from each candidate and each form
  who does not know the app, and the list of the review against mock-up 2
  — fixed, or different on purpose with its reason.
- **Seen and left.** With one figure for an exercise, the end point of its
  line can be green and lie under the zero line: the figure compares the
  medians of the range, the line each day with the first (the Dips of the
  pictures: +5 % in the range, the last day under the first). The sentence
  under the chart says what the line draws; whether that is enough is part
  of the owner's question on D176. *(He answered at STOP 7C: it is not —
  the line is now the change day by day, D187.)* How the sheet's drag feels under a real
  finger, and whether iOS lets the page behind rest while the sheet is
  dragged, cannot be seen in a headless browser and stands in his
  checklist. An exercise is reached through the sheet of one of its groups
  only, until block 7D brings the catalogue. The measuring display stands
  under the stage and is covered while a sheet is open. The offline check
  of `release-proof.mjs` (tidy-up). `.gym-progress__overall` in `gym.css`
  has had no element since before the block (tidy-up).

**After STOP 7C — a line begins on its baseline, and an exercise's line
is its change day by day** (branch `claude/momentum-wp3`, not merged; D187)
- **The owner's answers** (2026-11-16): accepted on his iPhone except the
  Dips — "+5 % Verbessert", a line ending green under the zero line, and
  5 × 96 kg after 5 × 104 kg in the list. 1 A: a line begins on the
  baseline of its first day. 2 A: one change for an exercise. His
  correction: an exercise's line reckons by the rule its figure does, each
  point the change in the range up to that day, as a group's line; the
  sentence under the chart says so; "Letzte Trainingstage" keeps the real
  sets. 3 B: Back for every sheet, in the tidy-up (`prompt-aufraeumen.md`,
  step 4b), on the condition that a sheet with fields loses nothing typed.
  4 A and 5 A as built. And: the session runs from here on another model
  than D159 names, recorded as a deviation from D159 in D187.
- **What changed.** `fromBaseline` (`muscleAnalytics.ts`) puts the
  baseline of the group's first training day in the range before its line
  — in the row, which shows the last twelve points, and in the sheet
  (`MuscleSheetView.line`). `exerciseLine` (`muscleSheet.ts`) is an
  exercise's line: its first day at nought, each later day the change of
  `exerciseSpans` over the days up to it, by the comparison of the day the
  range ends on — so its last point is the figure at the head by
  construction, and an end point in a rise's colour never lies under the
  zero line. The exercise detail draws it and its table reads the same
  numbers ("Veränderung im Zeitraum bis zu diesem Tag"); one recorded day
  is a sentence and no chart. Nothing under `src/core` or `src/storage`
  changed.
- **Checks restated, none removed or weakened**, each with its old and its
  new rule in `scripts/verify/README.md` under "Checks restated after STOP
  7C (D187)": `exerciseDetailChart.test.tsx`, `gym-muscles.mjs`,
  `release-proof.mjs`, `design-system.mjs`, `phase4-a11y.mjs`;
  `muscle-sheet.mjs` gained checks only.
- **Verification** (2026-11-16, at `8460d46`): `tsc -b` clean (in the
  build); `npm run test` exit 0, 139 files, 2417 tests (2406 at STOP 7C);
  build clean, `index.js` 563.27 kB (562.47), `index.css` 103.11 kB
  (103.04), the viewer's chunk 878.30 kB (878.30). 40 browser suites, 39 exit 0, 5304 of 5305
  checks; red is the offline check of `release-proof.mjs`, as before.
  Grown: `muscle-sheet` 231 → 265, `design-system` 1300 → 1304,
  `gym-muscles` 197 → 198; every other suite as at STOP 7C. Three ran a
  second time at the commit's own state, because the working tree had
  moved on to block 7D while the chain ran: `phase4` 54 of 54,
  `phase4-a11y` 20 of 20 (its restated check, committed after `8460d46`)
  and `wp3-stage1` 318 of 318, from a worktree at `8460d46` — it reads the
  catalogue's source, which already held 133 entries. **`body-reach.mjs`
  was not run on this commit**: nothing it taps changed, and it runs on
  the build of block 7D, which carries this code unchanged.
- **Preview**: `Momentum-preview` `7f859f3`, built from `8460d46` as
  before. **Check data**: the files of `docs/wp3/stage7c/` for 17 and 18
  November hold; the correction changes how the sets are drawn, not one
  stored row. **The run with real data is missing: there is no backup with
  real data.**

**WP3 block 7D — the exercise catalogue and its search** (branch
`claude/momentum-wp3`, not merged; **accepted at STOP 7D on 2026-11-17**
— D188, D189)
- **What changed.** The catalogue (`core/gym/catalogue.ts`) holds 134
  exercises: the 49 before as they were, and 85 new — machine, cable and
  body weight first — so that every group has at least ten by its primary
  role (chest 15, back 20, shoulders 15, biceps 11, triceps 14, core 15,
  quadriceps 11, hamstrings and glutes 14, calves 10, forearms 10). Every
  entry names its equipment (three new: SZ bar, kettlebell, wrist roller)
  and its movement from a fixed list of ten. The list, the rules it
  follows, the reading of it by three critics and every assignment
  hesitated over are in `docs/design/wp3/stage7d-katalog.md`. The picker
  searches with `core/gym/search.ts`; without a query it stands under one
  heading per group, a row names its groups and its equipment, the field
  says what can be searched, and a query that finds nothing says so and
  makes "Eigene Übung" the primary action, with the query as the name. An
  existing device gets the new entries the next time Gym opens; its stored
  entries stay byte for byte.
- **Not changed.** `git diff 8460d46 -- .github/fixtures` is empty and
  `domainOutputs.test.ts` holds the same fingerprints. Nothing under
  `core/scoring`, no rating service, no schema or backup version, no stored
  record; the 49 entries' ids, roles, load types and names; the user's own
  exercises and how they are made; the three tables of roles in
  `catalogue.test.ts`, line for line; the sheet's behaviour with typing
  and keyboard (`wp3-sheets.mjs` unchanged).
- **Tests restated, none removed or weakened**, each with its old and its
  new rule in `scripts/verify/README.md` under "Checks restated in block
  7D": `catalogue.test.ts` (134 entries, where it counted 49),
  `phase4.mjs` («Squat» finds the squats, where it left one row) and
  `phase4-a11y.mjs` (Bankdrücken picked by its name). New: `search.test.ts`,
  the existing device in `gym.test.ts`, the browser suite
  `exercise-search.mjs`, and the picker in `design-system.mjs`.
- **Verification** (2026-11-16): `tsc -b` clean; `npm run test` exit 0, 140 files, 2443 tests (139 and 2417 at the close of 7C; one new file, `search.test.ts`); build clean, `index.js` 587.81 kB (563.27), `index.css` 103.56 kB (103.11), the viewer's chunk 878.30 kB (878.30); 42 browser suites, 41 exit 0, 5511 of 5512 checks (41, 40 and 5316 of 5317 at the close of 7C). Red: the offline check of `release-proof.mjs`, as before. New: `exercise-search.mjs` 115 of 115. Grown: `design-system` 1304 → 1384, the picker at four widths; every other suite holds the number it held — `wp3-sheets.mjs` 330 of 330, `wp3-stage1.mjs` 318 of 318 with B11 counting 133 rows, `phase4` 54, `phase4-a11y` 20. The 3D suites ran alone: `body` 97, `gym-muscles` 198, `muscle-sheet` 265, `farbregeln` 334, `body-reach` 12 of 12 — 10 of 10 at 393, 430, 360 and 320 (1340, 1664, 1088 and 888 taps). `git diff 8460d46 -- .github/fixtures` is empty.
- **Preview**: `Momentum-preview` `c2d93fc`. **Check data** (D183):
  `docs/wp3/stage7d/` — the files of 17 and 18 November, made by the live
  build (`e30becd`) with its own catalogue: the diary of STOP 7B, a plan
  of Bankdrücken, Latzug and an exercise of the user's own, exported
  through its interface (`stage7d-check-files.mjs`). Read back on the
  build before the block and on this one: the same Gym rating (821 on the
  17th, 807 on the 18th), the same rows and the same plan, 134 exercises
  offered, every stored exercise byte for byte. **The run with real data
  is missing: there is no backup with real data.**
- **Pictures**: `docs/design/wp3/stage7d/`, the picker at 320, 360, 393
  and 430 without a query, with «bauch», «zieh», «maschine»,
  «eigengewicht», «kabel brust» and a word nothing answers, the own
  exercise from an empty search; once in English and once from the plan
  editor (`stage7d-shots.mjs`).
- **Seen and left.** Exercises measured in time or distance (a question
  at the STOP); the adductor machine (no group is the adductors); «rücken»
  still finds the presses whose name holds it, now last.
- **After the STOP** (owner, 2026-11-17, D188's addendum): of the four
  exercises he asked about, the three cable flys — high to low, at
  shoulder height, low to high — and the Smith machine row were in the
  catalogue; the **Bayesian cable curl** was not and is added
  (`ex_bayesian_cable_curl`, biceps, cable). The figures above are the run
  at STOP 7D, with 133 entries. With the addition: `tsc -b` clean (in the build); `npm run test`
  exit 0, 140 files, 2443 tests; build clean, `index.js` 588.02 kB. The
  14 browser suites that read the catalogue or open the picker ran again,
  all exit 0 with the counts of the STOP run: `exercise-search` 115,
  `wp3-stage1` 318 with B11 counting 134 rows, `design-system` 1384,
  `wp3-sheets` 330, `phase4` 54, `phase4-a11y` 20, `wp2-1-shots` 102,
  `release` 83, `phase8` 56, `wp3-midnight` 139, `wp3-reload` 128,
  `wp3-stage2` 201, `wp3-stage3` 153, `wp3-stage5b` 357; the other suites
  and the 3D suites were not run again, as nothing they read changed. The
  two check files read back on this build: Gym rating 821 and 807, the
  same strip and plan, 135 exercises offered, every stored exercise byte
  for byte. Published as `Momentum-preview` `a0a3528`, built from
  `e12ab48`.
- **Accepted** (owner, 2026-11-17, D189). The biceps machine he asked for
  after the STOP was added and published (`35a5c9c`, preview `8ee9215`)
  and is taken out again, both commits reverted: Preacher-Curls is that
  machine. Preacher-Curls keeps its name and id and is also found as
  «Bizepsmaschine» and «Scott-Curls» («Biceps machine», «Scott curl» in
  English), from `EXERCISE_WORDS` in `core/gym/search.ts`; a test in
  `search.test.ts` holds it. Verified at `e7fc44e`: `tsc -b`
  clean; `npm run test` exit 0, 140 files, 2444 tests (one more: the other
  names); build clean. The 14 suites that read the catalogue or open the
  picker ran again, all exit 0 with the counts of the STOP run —
  `exercise-search` 115, `wp3-stage1` 318 with B11 counting 134 rows,
  `design-system` 1384, `wp3-sheets` 330, `phase4` 54, `phase4-a11y` 20,
  `wp2-1-shots` 102, `release` 83, `phase8` 56, `wp3-midnight` 139,
  `wp3-reload` 128, `wp3-stage2` 201, `wp3-stage3` 153, `wp3-stage5b`
  357. The two check files read back with 821 and 807, the same strip and
  plan, 135 exercises offered, every stored exercise byte for byte.
  Published as `Momentum-preview` `4063e82`; a preview device that opened
  Gym on the build with the biceps machine (`8ee9215`) holds a record of
  it until a check file is imported again.

**WP3 block 7E — the onboarding in direction C** (branch
`claude/hopeful-carson-4utktp`, built on block 7D's head `adf1ead`, not
merged; **the presentation is built and waits for the owner at STOP
7E-a2** — D190, `docs/wp3/stage7e/README.md`)
- **What changed.** How the seven steps look, and only that: a flat
  ground, solid white cards, DM Sans, and at most one dark surface a
  screen — Gym or the rank. The first slide is the canvas's «C1»: the
  card «Verlauf» with example values and the coloured line as one image
  (`OnboardingHero.tsx`), the tiles Mind and Gym, «Fortschritt, den du
  siehst.» The second shows a real question and the Gym card with its
  targets and the body's still; the third the Rookie stage, the way to
  Challenger and the six ranks beyond. The setup: the areas as two tiles
  chosen by a filled check, one card per question category, one Gym card
  with two rows of seven segments, the summary as tiles of what was
  chosen. Contract §16 holds the exceptions, and they hold in the
  onboarding only; `designRules.test.ts` keeps them there.
- **Not changed.** The steps, their order, which steps appear, the
  disabled «Weiter», the targets the flow opens on, `OnboardingSelection`
  and `applyOnboarding`; no dependency (the font is a file of the
  repository, 36,932 bytes, OFL, credited under Danksagungen). A step
  shows only what the flow holds: Laufen opens without a target and says
  so, and the summary has a Mind tile only with a question.
- **Suites that walk the flow, restated** (no check removed or weakened):
  `lib.mjs` `onboard()` and `design-system.mjs` find each target by the
  name of its group (the two stand in one card now, where they were found
  by card); `design-system.mjs` holds the seven segments as targets of
  44px around a pill instead of a round circle; `phase2.mjs` and
  `wp3-stage4.mjs` read the slides' new titles.
- **Verification** (2026-11-17, on `75ee4b9`): `tsc -b` clean; `npm run
  test` exit 0, 140 files, 2454 tests; `phase2.mjs` 67 of 67,
  `wp3-stage4.mjs` 170 of 170, `design-system.mjs` with `ONLY=onboarding`
  212 of 212 at 320, 360, 393 and 430 (lowest text 4.58:1). Reviewed
  before the STOP by three readers with a skeptic for every finding: five
  held and are fixed, two were refuted (D190).
- **After the owner's go** (D190): the tests for every path, the replay of
  the onboarding in the preview without losing data, the preview, and
  STOP 7E-b with at most eight check points.

**Infrastructure only — built, tested, not reachable from any screen**
- Rest days, pause periods, tombstones, profile: stores +
  repositories exist, no logic and no UI. **Weight entries are now reachable**
  — the Gym session screen writes one when a bodyweight exercise needs it.
- `RunRecord` carries `source`/`externalId` as the import seam. No importer.

**Intentionally dormant**
- **Food** (D139, D140). Left the product in WP3 Stage 4. The `foodDays`
  and `foodEntries` stores, the repositories, the record and the backup
  collections stay, and Food-era days replay; nothing creates Food data and
  no screen shows it. A source scan in `foodRetirement.test.ts` pins that
  nothing shipped writes a Food row.
- **Rest days.** Deprecated as a product concept (D115): never shipped, never
  approved, made redundant by the seven-day abstinence rule and D37. Store,
  repository, type and backup collection stay for compatibility; nothing
  creates one and no UI ever should. A test asserts no flow does.
- **Tombstone unlocks.** Store and repository exist; the benchmark values are
  an open product decision, so nothing writes them. Stage 3 of the
  Overall-rank update verified this rather than changing it, and
  `src/storage/services/tombstones.test.ts` now pins it: the five ids, the
  storage and backup round trip of a record, an RC2 file without the
  collection importing with an empty store, and no writer or screen outside
  storage. `firstPromotion` stays dormant and semantically unresolved; it is
  not connected to the Boss or to the removed domain ranks.

**Not implemented**
- Nutrition targets — moot since Food left the product (D139). Tombstone unlocking,
  rest-day/pause handling in the replay, "Warum diese Zahl?", Strava import.

## Scoring rules, as implemented

### Mind day score — two-level mean (`dayScore.ts`)
Per category: mean of its questions. Then the **equal-weighted mean across
categories**. Six Alltag questions cannot outweigh one Mental question.

- `score` (history, closed day): each category divides by questions **due**, so
  a category nobody answered contributes 0 — it was missed.
- `recordedScore` (what the rating tracks): only categories **with an answer**
  enter the mean. A category with nothing answered leaves the denominator.
- Model is read from the day's snapshot: absent ⇒ `flat` (one mean over all
  questions, divided by those due). Never today's model.

### Weekly-quota domains (Gym, Running, legacy Sport)
`min(100, sessionsInWeek / target × 100)`. A week still running with nothing
logged is `null`, not 0. Target resolved at the week's Monday. On a day lived
under P8 a week in progress with a session reads as met (100) and is judged
once it can no longer be written — Tuesday 00:00 (D134).

### Rating (`core/rating`)
EWMA over day scores, half-life 14 days, start 250, range 0–1000. Streak bonus
is part of the target rather than added on. Inactivity **decays** (capped per
episode) rather than feeding zeros. First 14 days may rise, never fall.

### Ranks
Eight, thresholds in `RANKS`. Promotion confirmed over seven eligible days
(D126); demotion needs 15 points below the floor **and** 3 sustained days —
every point before P8, settled days in the P8 era, which also count for a
promotion only once settled (D136).
`rankProgress(value, displayedRank)` is the single source for fill, percentage
and remaining — never derive one from a different rank than the other.
`displayedRankProgress` rounds once first so the printed rating and the
countdown agree.

### Boss (`core/boss`)
Ladder position = `rankIndex + fraction to next` on a continuous 0–8 scale;
Legend spans its fraction across the rest of the range.

```
legacy era (snapshot has no `boss`):  boss[t] = legacy progression[t]
weighted era:  boss[t] = clamp( boss[t-1] + Σ w[d,t]·(p[d,t] − p[d,t-1]), 0, 8 )
```

Movement, not level — an upgrade must neither create nor destroy progress. The
anchor is the RC2 era's final value exactly. Only domains that are enabled,
weighted **and started** contribute. Weights come from each day's snapshot.

### Gym performance (`core/gym/performance.ts`, `metric.ts`, `load.ts`, `muscles.ts`)
- **Two eras** (D150, WP3 Stage 5b), told apart by `scoring.gymMetric` in
  the snapshot in force on the scored day; `gymMetricOf()` is the field's
  one reader. A day computes its whole window in its own day's metric.
- **Exercise-day, from the snapshot with the field on:** the best *working*
  set by the strength score `effectiveLoad × (1 + reps ÷ 30)`, computed as
  the integer `load × (30 + reps)`. A set marked as a warm-up
  (`GymSetRecord.warmUp`, D151) never provides it; an exercise with warm-up
  sets only is no exercise-day. Still a maximum — not volume, not the sum,
  not an average.
- **Exercise-day, before it** (D84): `max(reps × effectiveLoad)` over that
  day's scorable sets, a warm-up mark not read. Ties never change the
  number.
- **Effective load** (D91): `external` = the bar; `bodyweight` = bodyweight +
  added; `assisted` = bodyweight − assistance. The bodyweight is the latest
  entry **on or before** the set's date, replayed rather than stored on the
  set, so a later weigh-in can never reach a session already logged. No
  bodyweight yet, or assistance ≥ bodyweight, drops the set — never a zero and
  never re-read as positive resistance.
- **Comparison:** against the last day the *same stable exercise id* was
  recorded. `noBaseline | improved | unchanged | declined`. A skipped
  exercise and a long gap are neither.
- **Muscle group** (D92): primaries share 70 % of an exercise, secondaries
  30 %, equally inside each role — so one exercise is worth one exercise
  however many groups it names. A group's value is the **weighted** mean of
  what it received. A set with no recorded roles is the pre-roles era and its
  groups share it equally, which is how it was actually scored.
- **Gym aggregate:** the **equal-weighted mean over measured groups**. Groups
  with no data or no baseline are excluded from the denominator.
- **Windows** (D100): `gymPerformanceInWindow` compares each exercise once
  *inside the window* and needs two observations there, so frequency adds
  evidence not weight. In the new era the comparison is the **median of the
  last k exercise-days against the median of the first k**,
  `k = min(3, ⌊days ÷ 2⌋)` — with two or three days that is the last against
  the first; before it, always the last day against the first.
  `exerciseSpans()` is the one place that reads which
  (`gymMetric.comparison`; the owner confirmed the median at STOP 5b,
  D175).
  `gymPerformanceOverSpan` (lifetime) still anchors at the first-ever day and
  is used only by the Progress "overall" figure.
- **Order** (D172): in the new era the exercise-days enter the sums by date
  and exercise id, a day's sets by set order, creation time and id — the
  same sets replay to the same bits whatever their record ids. Before it,
  the order of the `by_date` index, as it always was.
- A set is scorable only with positive, finite reps and an integer positive
  effective load.

### Gym rating (`core/gym/score.ts`, `rating.ts`, `endurance.ts`, `decay.ts`)

**40 % attendance, 60 % personal development** (D90). Relative to the user's
own history; no population norms, ever.

```
attendanceScore   = min(sessions / weeklyTarget, 1) × 1000
performanceScore  = 0.5 × map(trendChange) + 0.5 × map(ytdChange)
target            = 0.40 × attendanceScore + 0.60 × performanceScore
rating           ← rating + (target − rating) × movementFactor(rating, target)
```

- **The curve** (D99): `score(x) = 1000 / (1 + 4^(−x/10))` — every ten points
  of improvement multiplies the odds by four. `score(0) = 500` exactly, ±10 %
  exact, ±5 % within 3.4, ±20 % is 941/59 because symmetry outranks the
  approved table and an asymptote cannot reach 0. No cap on the input.
- **The curve's value in the Stage 5b era** (block "Kurve", D177, D178):
  from the snapshot that carries `scoring.gymMetric.curveDecadePercent` on,
  a Gym day's two windows are mapped with **that** value in place of the
  ten — `score(x) = 1000 / (1 + 4^(−x/3))` in this build: +3 % is 800,
  +2.5 % 760, +5 % 910, +10 % 990. It is the same function with one
  argument (`mapPerformanceChangeToScore(change, decadePercent?)`), read
  per day by `gymCurveOf()` beside `gymMetricOf()`; the replay's cache is
  keyed by metric and curve. A day before the era, a day under a marker
  without the value (a Stage 5b preview wrote such), and every day of
  Running compute with the constants, bit for bit. The five properties of
  D101 hold for every value; the two constants are untouched. The owner
  confirmed the three at STOP Kurve (D180, `GYM_CURVE_CONFIRMED`).
- **Map then average**, never average then map: the two windows exist to be
  able to disagree.
- **One component missing** ⇒ use the other. **Both missing** ⇒ the target is
  attendance alone. Never a fabricated neutral 500 and never a zero.
- **Windows:** trend is a rolling 60 days ending on the calculation date; YTD
  starts on January the first of that year.
- **Movement:** 10 % of the gap. Upward it scales by
  `min(1, (1000 − rating) / 500)` — full speed at or below 500, 6 % at 700,
  2 % at 900. Downward it is always 10 %: a high rank is harder to climb, not
  protected. The Performance Score itself is never touched by rank.
- **Endurance Phase** (D94): completed weeks score +1 met, −0.5 missed,
  floored at 0; the **first** promotion unlocks at 4.0 net weeks and the gate
  is then permanent. The rating calculates and moves throughout; nothing is
  awarded at the unlock. The Boss reads the rating, so the gate does not
  reach it.
- **Abstinence decay** (D96): **7 consecutive calendar days with zero saved
  Gym sessions**, and only after the Endurance Phase is complete. Missing the
  weekly attendance target alone is *not* abstinence. Reduces **within-rank
  progress only** — never the historical rating, the performance percentages
  or anything already recorded — cumulative against the progress held at the
  episode's start and never compounded. Never below the current rank floor.
  Any saved session ends the episode; a later absence takes a fresh baseline.
  Whole blocks only, and the phase is fixed by the training age at the
  episode's start:

  ```
    abstinent days      →   7     14     21     28     35     42  …  70

    through month 2       50 %  100 %  100 %  100 %  100 %  100 %   100 %
    months 3–4            25 %   50 %   75 %  100 %  100 %  100 %   100 %
    months 5–12           20 %   40 %   60 %   80 %  100 %  100 %   100 %
    month 13 onward       10 %   20 %   30 %   40 %   50 %   60 %   100 %
  ```
- **Maintenance** (D97): from 12 months of Gym training age, with the week's
  attendance target fully met, **both** performance windows carrying a
  baseline, and the aggregate change within ±0.25 pp of zero, the target may
  not pull the rating down. A floor under the target, nothing more — positive
  performance still raises, negative still lowers, missed attendance still
  lowers, and abstinence decay is untouched.
- **Era:** a snapshot with no `scoring.gymModel` is the attendance era and
  replays as it was scored; the new fold continues from the number the old one
  left.

### Food — retired, replayed only (`core/food/adherence.ts`, `core/scoring/dayScore.ts`)

Food left the product in WP3 Stage 4 (D139). This is how a day lived with
it replays; from the switch-off day it is due nowhere.

One item due per day: the 1–10 the user chooses. `adherence × 10` is the day
score — the same mapping a Wellbeing scale answer uses. Unrated inside the
edit window leaves the day **open**; unrated once closed is a **miss for
history** and **no data for the rating**. Before Food was enabled there is no
food entry at all.

The rating is then the shared daily fold, not the 40/60 training model: no
attendance, no performance curve, no Endurance Phase and no abstinence
episode — the general cooling-off (D113) charges its days as it charges
Mind's. Calories and macros were logged, totalled and shown, and never scored
(D106).

Setup was one optional sentence (`FoodDomainSettings.focus`), carried in the
config snapshot; a Food-era day scores identically with it empty. The entries
and the sentence are kept and shown nowhere (D140).

### Running performance (`core/running/performance.ts`)

**Pace at a comparable measured distance** (D102). Relative to the runner's
own history; no population norms, ever.

- **Qualifying:** a *measured* distance ≥ 3 km and a positive duration. A run
  missing either counts in full for attendance and carries no performance.
  Nothing is fabricated — every converted RC2 run is attendance-only for ever.
- **Comparability:** `max/min ≤ 1.10`, symmetric, inclusive, in integer metres.
- **Identity** (D103): a fixed half-open band,
  `floor(ln(d / 972.42) / ln(1.10))`, depending **only** on the run's own
  distance. Same band ⇒ comparable by construction. Adding, editing, deleting
  or expiring any other run can never move an existing run's identity.
- **Evidence** (D104): fastest run per date; ≥ 2 dates; baseline earliest,
  current latest; one ratio per identity;
  `ratio = (d_cur × t_base) / (t_cur × d_base)`.
- **Window:** equal-weighted mean of identity ratios → one percentage change,
  then the shared curve **once**, then Trend (rolling 60 days) and YTD 50/50.
- **Accepted:** a comparable pair can straddle a boundary, and a route
  wandering across one becomes two equally weighted identities. No attempt is
  made to re-merge them, because that would read neighbouring runs.
- Running's Endurance Phase, abstinence decay, Maintenance and movement are
  the shared training-domain rules, identical to Gym's, against Running's own
  weekly target.

## Invariants future changes must preserve

- No derived value is written to storage.
- A past day is scored against its own snapshot, never today's config.
- An absent field in an old snapshot marks an era. Do not backfill it.
- Untrained / unanswered / not-yet-enabled never enter a denominator.
- Gym weights are **integer grams**; `reps × weight` must stay integer
  arithmetic or two identical sets can compare unequal.
- A gym set's `muscles`, `primaryMuscles` and `loadType` are recorded at write
  time; the replay must read the set, not the catalogue. Their **absence** is
  the pre-roles era, not an empty value to fill in.
- A bodyweight load is replayed from the weight entry in force on the set's
  own date. Never a later measurement.
- An absence is charged for once: ordinary movement **or** abstinence decay,
  never both on the same day.
- Nothing is charged while it can still be written (D134–D136): a write may
  only reach a day and a week that are still open, and a legal write never
  reverses a charge. `p8Reversal.test.ts` and `closure.test.ts` pin it.
- The Boss is the only rank (D125). Nothing computes or shows a rank for a
  domain; a domain contributes a rating and a ladder position. The decay tier
  (D124) is internal and is never a rank.
- The Stage 2 baseline in `.github/fixtures/stage2/` is compared exactly.
  A changed value there is a changed rating, never a fixture to regenerate.
- `settings.promotionConfirmation.from` is written once and never moved; days
  before it are walked by the legacy rank rule verbatim (D126). A record
  without the field is a legacy record, nothing else. The persisted
  `eligibleDates` are reconciled from every Boss replay, never patched.
- Decay is cumulative against the episode's baseline, never compounded.
- Gym rank is personal development; Tombstones are absolute. No population
  norms enter a rank, and no development percentage enters a Tombstone.
- Two migrations rewriting one store share one cursor (D98).
- **A comparison identity depends only on its own record's facts.** Running's
  distance band reads the run's distance and two fixed constants, nothing
  else. Grouping by looking at neighbouring records reinterprets history the
  moment one is added, and three such designs were rejected for exactly that.
- `RUNNING_BANDS.ANCHOR_METRES` and `WIDTH` are the scoring-model contract.
  Changing either repartitions every user's history and is a new era.
- Exercise identity is the id. Never join history on a display name.
- Peak rank and lifetime XP never fall.
- One badge family, one rank ladder, one Boss.
- **The Boss averages normalized ladder positions, never event counts** (D110).
  Nothing that reaches `bossSeries` may be a tally of sessions, runs or
  ratings, and lifetime XP must stay out of the rank.
- `npm run test` must exit 0; typecheck is `tsc -b`.

## Open product decisions — do not invent these

1. ~~**How training performance maps into the 0–1000 rating.**~~ **Resolved
   for Gym in Phase 4.1** (D90, D99) and **for Running in Phase 5**
   (D102–D105). Both are 40 % attendance and 60 % personal development,
   through the same shared code. D88 no longer describes the build.
2. ~~**The general cooling-off / decay formula.**~~ **Gate 1 closed by D113.**
   RC2's schedule ratified unchanged — 2 grace days, 1.5/day to day 7, 3/day
   after, 60 per episode — and `core/decay` is now the live implementation
   rather than a contract nobody called. Not one baseline rating moved.
   Wellbeing and Food are general; Gym and Running under the performance
   model keep their own abstinence rule (D96) and are never charged by both.
2a. ~~**Rest-day suspension semantics.**~~ **Resolved by D115** — deprecated,
   not implemented. The schema stays for backup compatibility only.
2b. ~~**Pause-period suspension, and whether XP accrues.**~~ **Resolved by
   D116.** A pause suspends inactivity penalties only; XP is untouched and
   stays monotone.
3. ~~**Nutrition targets.**~~ **Moot since D139**: Food has left the
   product. Nothing in the scoring path ever read a calorie or macro figure.
4. ~~**How Food contributes to the Boss, and what a rated day is worth.**~~
   **Resolved by D110.** Boss contribution is normalized domain performance —
   the shared 0–8 ladder position — never raw event count, and lifetime XP was
   never the Boss path. No per-event constant exists or is needed. Pinned by
   tests in `foodBoss.test.ts`.
5. **Tombstone benchmark values.** The boundary is documented (D95) and no
   values were invented. What counts as a milestone is a product decision.
   No Food Tombstone values were invented either.

## Risks and known debt

- **Gym replay is not bit-deterministic across record ids — for days before
  the Stage 5b era only.** From the snapshot that carries `scoring.gymMetric`
  on, the order is fixed (D172) and `planEquivalence.test.ts` holds a planned
  and a free workout with the same sets to identical bits. Days before it
  keep the behaviour described here, because fixing their order would have
  moved a pinned fingerprint. As found in WP2-1 and
  deliberately not fixed there: `gymService.buildExerciseDays` reads sets
  through the `by_date` index, whose order within a day is the record id —
  random — and `core/gym/performance.ts musclePerformance()` sums each
  group's weighted ratios in that order. Floating-point addition is not
  associative, so **the same sets under different ids replay to numbers
  that differ in the last ULP**. Reproduction:
  `src/storage/services/planEquivalence.test.ts` (seeded ids, control =
  manual vs manual). Observed over 20 seeded runs: 2 ULP at the source
  (a muscle ratio, |Δ| = 4.4e-16 at ≈ 1.12) and, propagated through
  `(ratio − 1) × 100`, the curve and the daily fold, up to 13 ULP of a
  0–1000 performance score (|Δ| = 1.5e-12 at ≈ 595), 4 ULP of a rating, 4 ULP
  of a ladder position; a movement (`p[t] − p[t−1]`) inherits 2 ULP of its
  operands. Never a discrete output, never a rank, and nine orders of
  magnitude below any genuine scoring change. The fix — a deterministic set
  order in `buildExerciseDays` (date, exercise, order) — was tried: it makes
  manual and plan entry byte-identical and keeps every Stage 2 baseline,
  **but changes the pinned `domainOutputs` Gym-history fingerprint**, which
  hashes `days` in index order. That makes it a scoring-engine work package
  with its own deliberate re-pin, not a WP2 side effect.
- **There is no way back from the Stage 5b update except a backup taken
  before it** (review risk 9). After the first load the configuration
  carries `scoring.gymMetric` from that day on. A build from before the
  stage would not read the field and would score the new days by the old
  metric — and it would not read `warmUp` either. Going back therefore means
  importing a backup exported before the update; the iPhone checklist of
  STOP 5b begins with that export, and block 9 rehearses the way back.
- ~~**The curve was not retuned for the quieter metric**~~ (review risk
  10) — **done in block "Kurve"** (D177, D178). Under the strength score
  typical changes are smaller, and the median makes them smaller again;
  the steepness of `performanceCurve.ts` (+10 % is 800 of 1000) no longer
  fitted, and Stage 5b deliberately left it untouched. The block carries
  Gym's value in the snapshot of the Stage 5b era — three, where the
  constants say ten — because the two constants are read when the module
  loads and changing them in place would revalue every past day. The
  owner confirmed the value at STOP Kurve (D180).
- **A device that loaded a preview carries that preview's value in its
  snapshot** (D178). A marker without the curve's value (a Stage 5b
  preview) gets the value added from the first load of this build, and the
  days in between keep the curve at ten. A snapshot that names another
  value than the build's — after the owner chose another at a STOP — is
  complete and is left alone; the next configuration write carries the
  build's value from that day. Either way the device replays what it
  lived, and a check that wants one boundary imports the block's file
  afresh. No released device is in either state: the live app has never
  written a marker.
- ~~**The scale of the rows and of the exercise detail is still 12 %**~~
  — **done at STOP Kurve** (D180): both are 8 %, the change at which a tint
  is full, and the exercise detail widens in steps of four.
- ~~**The held band sits where a single step lands**~~ (D153, seen at STOP
  5b) — **done at STOP Kurve** (D180): the band is one-sided, a rise counts
  from a shown +2 %, and one rep more reads as progress at every rep
  count. What stays as it was, and is the price of not making every missed
  rep a decline: "+2 %" is green and "−2 %" is neutral. The legend says
  why.
- **A snapshot dated between today and a kept era boundary takes the era's
  marker** (found in the closing review of Stage 5b; the same in all three
  load steps — `ensureSessionWindowEra`, `ensureFoodRetired`,
  `ensureGymMetricEra`). Each step leaves today alone when the local date
  has moved back across a boundary written before now, and then gives
  *every* later snapshot the marker — one dated before the kept boundary
  included, although its days were lived under the earlier era. It has no
  realistic path: the local date must move back two days through time
  zones alone (a clock set back reads as "the clock was ahead" and moves
  the era to today, by design), with a snapshot dated on the day in
  between. `ensureCurrentSnapshot` already writes such a day without the
  markers. The guard is one line per step — skip a later snapshot dated
  before the kept boundary — and belongs in block 9 with a test for all
  three, not in one step alone.
- **Legacy Sport is unreachable** (above). Real RC2 users are affected.
- ~~**`gymPerformanceOverSpan` anchors to an exercise's first recorded day, for
  ever.**~~ **Addressed for the rating in Phase 4.1** (D100): the trend and
  year-to-date windows anchor inside their own window. The lifetime variant
  still anchors at the first-ever day and is still what the Progress "overall"
  figure uses, which is correct for that question.
- **The `.github/fixtures/rc2-export.json` profile is one day.** Long-history
  regressions rely on `rc2-synthetic.json`. Neither may be regenerated: the
  numbers RC2 produced from them are pinned in `src/storage/migration.test.ts`.
- **`SPORTS` in `constants.ts` is now unused by app code.** Kept because it
  documents the quota range legacy weeks were scored under.
- **Both training ratings replay two performance windows per day.** The obvious
  implementation filters the exercise-days per day and is quadratic — the same
  shape D73 already removed once. `gymRatingService` and `runningRatingService`
  both walk the window bounds with pointers and memoise on their contents;
  `gymScoring.test.ts` measures a 420-day history of real sets against a
  guard. Do not replace either with a filter inside the day loop.
- **Running's accepted limitations, all deliberate** (D103). A comparable pair
  can straddle a fixed band boundary and never compare — 5 000 and 5 500 m are
  exactly 10 % apart and land either side of one. A repeated route whose
  measured distance wanders across a boundary becomes two identities and is
  counted twice. Neither is fixed, because detecting them means reading the
  surrounding runs, which is the history-reinterpretation the fixed grid
  exists to prevent. Also: pace at a nearby but non-identical distance is not
  perfectly effort-equivalent, so a small distance-related bias can remain
  inside the allowed range. It is left uncorrected — every correction for it
  is a population-derived model.
- **There is no treadmill / indoor / outdoor concept**, and no compensation
  for one. A user mixing treadmill and outdoor runs at the same distance will
  see them compared. Recording this rather than inventing a correction.
- **`elevationMetres` and `steps` remain in the data model, unwritten and
  unscored.** No input exists and none is planned for now.
- **Nothing surfaces a Gym or Running rank demotion yet.** The rating can fall through
  missed attendance and through decay, and `rankHistory` records the demotion,
  but no screen announces it the way a promotion is announced. That is Phase 8
  integration work rather than a defect in either domain.
- **Replay cost is linear and measured**
  (`replayPerformance.test.ts`, ~60 ms for two years of four domains against
  fake-indexeddb). Do not add caching without a measurement showing need — a
  quadratic week lookup was already found and removed this way (D73).
- `Sheet`-based flows and IndexedDB writes are serialised per screen; a fast
  tapper interleaving writes was handled in `GymSessionScreen` with a busy
  guard rather than optimistic state.

## Verification status

Taken at the muscle-map release (`735efca`) and carried since; each WP3 stage
records its own verification in its block above, and its STOP report. Since
WP3 Stage 4 the Phase 6 suites are retired with the Food screens (D139), the
release smoke test runs through Mind, Gym and Laufen, and the Food unit tests
are replay tests seeded through the repositories.

| | |
|---|---|
| Real device (muscle map) | iPhone, from the `Momentum-preview` build `5db6fc4` of the release candidate `bc57ec6`: the 3D body, touch rotation, muscle selection, shared row/body selection, mini sparklines, recency/status layout, Running placement and the credits sheet all approved. Screenshots: `docs/design/muscle-map/qa/device/IMG_0648–0650.png` |
| Muscle map QA | `docs/design/muscle-map/INTEGRATION-QA.md`: 50 items — 47 PASS, 1 FAIL (two harness checks, neither product), 2 NOT VERIFIED (preview serving, real-device Safari). Evidence under `docs/design/muscle-map/qa/` |
| Muscle map suites | `gym-muscles.mjs` 71/71 · `terminal.mjs` 42/42 · `geometry.mjs` 117/117 · `release-proof.mjs` 21/21 · `body.mjs` 38/39 (its dev-page tap grid is coarser than an upper arm; the 8px production probe reaches 10/10) · `body-reach.mjs` 393 10/10, 430 9/10 at 12px and 10/10 at 8px, 320 9/10 at 12px as accepted |
| Real device (Pass 2) | iPhone 15 class, from the preview build: the five conditions above, all clean. Recorded here because nothing in `scripts/verify/` can stand in for it |
| Card geometry (Pass 2) | `geometry.mjs`: every line of text measured on all four sides against the box that clips it, 12px of clear space required, at 393/430/320 — Today, Verlauf (both domains, an opened sheet, and a locked-Endurance profile), Rang, Bereiche. **90/90.** The earlier suites' `clipped()` measures `child.right − clipper.right` and cannot see a leftward or upward clip, which is how V1 shipped cards whose corners cut their first and last glyphs |
| Unit tests | **1070 passing, 69 files, exit 0** (`npm run test`) — the muscle map adds the adapter, sparkline, highlight, recency and token-contract tests, and `domainOutputs.test.ts` pins six fingerprints (Boss and Gym history over three profiles) that are unchanged from before any of this work |
| Release smoke (production build) | **82/82** (`release.mjs`) — cold load, the whole journey through all four domains, refresh and persistence, backup export / malformed refusal / restore, five widths including desktop, zero console errors |
| Pause regression | the same 2709-value fingerprint — five pure folds, both RC2 fixtures replayed to full Boss and per-domain ledgers, a live four-domain profile through five weeks of silence — is **byte-identical before and after**, same MD5. Only histories that contain a pause differ |
| D113 numeric equivalence | a 64 KB, 2691-value fingerprint — five pure folds, both RC2 fixtures replayed to full Boss and per-domain ledgers, and a live four-domain profile through five weeks of silence — is **byte-identical before and after the refactor**, same MD5, zero mismatches |
| D113 live path | `core/decay` proved on the production path by spying the model through `computeRating`, and model *selection* proved connected by substituting a model in an isolated file and watching the fold follow it |
| Typecheck | `tsc -b` clean |
| Production build | clean; no stale `.js` beside any `.ts` |
| Migration + continuity | v5 adds `foodDays` and declares no transform; a version-4 database carrying food *entries* upgrades with **no** ratings invented from them. RC2 fixtures still reproduce exactly, v1→v2→v3→v4→v5 (including the v2→v4 jump D98 fixed), backup round trip with Food data, newer-file refusal |
| Food era continuity | a day before Food was enabled has no food entry at all; a rating reads back as the number entered after a year of other configuration changes; every Boss value before the switch-on day is bit-identical to a profile that never enabled it |
| Gym/Running isolation | with Food rated every day, both training ratings, peaks, ranks and whole ladder series are bit-identical to the same profile without Food |
| Browser (Phase 8) | 56/56 at 320/360/393/430px (`phase8.mjs`) |
| Accessibility (Phase 8) | **23/23** (`phase8-a11y.mjs`) |
| Browser (Phase 7, regression) | 57/57 at 320/360/393/430px |
| Accessibility (Phase 7) | 18/18 |
| Browser (Phase 6, regression) | 47/47 at 320/360/393/430px — retired in WP3 Stage 4 (D139) |
| Accessibility (Phase 6) | 20/20 — retired in WP3 Stage 4 (D139) |
| Browser (Phase 5, regression) | 46/46 at 320/360/393/430px |
| Accessibility (Phase 5) | 15/15 |
| Browser (Phase 4.1, regression) | 52/52 at 320/360/393/430px |
| Accessibility (Phase 4.1) | 14/14 |
| Browser (Phase 4, regression) | 52/52 at 320/360/393/430px |
| Accessibility (Phase 4) | 15/15 |
| Browser (Phases 2–3, regression) | 64/64, 44/44, 5/5 |
| Accessibility (Phases 2–3) | 17/17, 9/9 |
| Earlier assertions | none weakened. Every earlier suite runs its original checks; the one change was adding `foodDays` to the backup's deliberately exhaustive collection list |
| Boss contribution (D110) | the Boss averages ladder positions and nothing else; training beyond target and logging six meals instead of one both leave every series bit-identical; a daily and a weekly domain take equal shares at equal performance; XP stays out of the rank |
| Flake fixed | one Phase 6 assertion was clock-dependent — it searched the serialised food-day record for the string `70`, which an ISO timestamp contains about one run in three. The assertion was wrong, not the code; it now checks the record's fields. Twelve consecutive full runs are green |

**Real VoiceOver was not tested. No Apple hardware is available in this
environment.** What is verified is the layer VoiceOver consumes — the computed
accessibility tree, names, descriptions, roles and focus order. Real iOS
Safari, installed-PWA behaviour and real touch are likewise unverified.

Re-run browser suites with `scripts/verify/*.mjs` (see that README; needs
`npm run build` and `vite preview --port 4173` first).

## Next work

**WP3: block 7D is accepted** (2026-11-17, D189), after block 7C was
accepted and closed in the same session (D187). The order from here is
**7E, 9, the tidy-up**. **Block 7E runs in a session of its own** on
`claude/hopeful-carson-4utktp`, branched from `adf1ead`; this session
wrote no prompt for it. **7E is merged into `claude/momentum-wp3` before
block 9**, which then starts in a fresh session with "Lies
`docs/wp3/prompts/prompt-9-haertung.md` und führe ihn aus." The tidy-up
comes last and now also holds Back for every sheet, on the condition that
a sheet with fields loses nothing typed (D187).

**For block 9, from the owner at STOP 7D** (D189; step 6a of its prompt,
not built now), in his words: "Ein eingetragenes Training erscheint im
Entwicklungs-Chart erst am nächsten Tag. Es soll sofort nach dem Speichern
erscheinen. Finde die Ursache und prüf, welche Charts betroffen sind
(Gym-Rating, Muskelgruppen, Übungsdetail). Solange der Tag noch offen ist,
darf der Punkt als vorläufig markiert sein. Vergangene Tage rechnen
unverändert." — a workout logged today is to appear in the progress charts
as soon as it is saved, not only the next day.

**An idea for the next update, not for WP3** (owner, STOP 7D, D189): **a
measure by time.** Exercises that are held or done for a time — side
plank, dead hang, wall sit, hollow hold, plate pinch, skipping, a sled —
cannot be logged as repetitions × load and stay out of the catalogue until
there is such a measure (D188, 5 A at STOP 7D).

**From the owner's copies of the measuring display** (D184): the point for
7C — a touch on the body draws two frames even when nothing changes — is
built (D185), so the display's idle line can read nought on his phone; it
is in the STOP's checklist. Still open, for block 9: the display should
print how many frames it drew in all beside the ones it measured, and name
a file that was checked over the network and taken from the cache as that.

**Food has left the product (WP3 Stage 4, D139).** Gate 2 is moot. Food-era
days replay as they were, and the data stays (D140); nothing in the build
creates Food data, shows it, or reads a calorie or macro figure.

**The domain terminal and the muscle map are merged and released
(`muscle-map-v1`).** Bereiche is the terminal: one switch — Mind · Gym
since WP3 Stage 4 (D143), Mental · Gym · Ernährung before — and beneath it
one area's workspace, with the area in the route
(`src/app/route.ts`, `#/areas/<area>`; Back walks the areas visited). Heute,
Verlauf and Rang are unchanged in role: Verlauf stays the overall, historical
overview and keeps every domain's daily row. Gym carries its board, then
Muskelgruppen — the 3D body above ten analytics rows, each with its identity
dot, name, last-trained day, an 80 × 24 sparkline and the percentage or
state in the state colour (since WP3 Stage 6b the line is neutral on one
scale shared by the ten rows, with the state on its end point; the group's
own colour is the dot and nothing else) — then Übungen, then
Laufen as its own section with its board and target card. The body, the rows
and the exercise list share one selected group; a body tap selects and never
clears, a row tap toggles (since block 7C a tap on either opens the group's sheet, the chosen group is the open sheet, and the list of exercises under the rows is gone — D185). Three.js arrives in a lazy chunk (235 kB gzip)
with the model (475 kB gzip since block 7A, 345 kB before) on first entry to Gym and never on any other
screen; without WebGL, on a fetch failure or on a throw, the SVG figure stands
in with the rows intact. Nothing in scoring, ranking, persistence or the
questions was touched: `domainOutputs.test.ts` pins six fingerprints from
before any of this work, unchanged after all of it. What differs from the
handoff and why is `docs/design/muscle-map/HANDOFF-DEVIATIONS.md` (28 rows);
the release record is `docs/design/muscle-map/INTEGRATION-QA.md`.

Two harness items are known and are not product defects: `phase41` fails one
date-dependent assertion ("a missed week costs half a week rather than the
balance") identically on the pre-integration base `fc2ffff`, and `body.mjs`'s
dev-page tap grid misses one region of about its own pitch while the finer
production probe reaches all ten. Neither test was edited for the release.
(Block 7A found the cause of the second: one tap of the grid's top row
presses the "Seite" button, and the front pass then ran on a body standing
at 57°. The grid puts the body back now and reaches all ten.)

**The `phase41` date dependence, resolved (WP2 final gate).** The Gym seed
in `phase41.mjs` and its copy in `phase41-a11y.mjs` laid `metWeeks` 7-day
blocks back from the run date, while the ledger counts ISO weeks (Monday to
Sunday). From Thursday to Sunday the last block straddled two ISO weeks, so
"the middle week" deleted by `weekKey` was not the seed's middle block and
the Endurance balance read `1.0 von 4 Wochen` — which the rule by hand
confirms is correct for that input (a one-session first week, a deleted
week, one met week). Both seeds now lay complete ISO weeks with sessions on
Monday, Wednesday and Friday, ending with the last complete week at least
`silentDays` before today; the ordinary run and runs with `CLOCK=YYYY-MM-DD`
on 2026-09-13, 09-14, 09-16, 10-01, 12-30 and 2027-01-02 all read
`1.5 von 4 Wochen`. Nothing in production changed.

**Next for the muscle map, none of it blocking:** the "several exercises"
line for a group whose latest day had more than one (the ids are on the
view model, the copy is not decided); the `Muskelgruppen` module's rows stay
the accessible selection path at 320px, where the biceps and the triceps
are one 12px cell wide on the body of block 7A (`body-reach.mjs` reaches
all ten there now, for nine before).

**Pass 2 (card geometry, widget layout, detail sheets) is merged and
deployed.** Both stages were approved on a real iPhone 15-class device from
the `Momentum-preview` build: no wrap of "853 von 1000" at 393px, the 2-up
tiles balanced and readable, no clipping or horizontal overflow, the bottom
sheets respecting the safe area, and the metric sheets consistent across Gym
and Running. Those five are the device's verdict, not the desktop harness's —
the harness cannot see SF Pro widths or `env(safe-area-inset-*)`, and says so.
Stage A made the card own its inset on all four sides (`--card-pad`), which
was the whole cause of the corner-clipped text on the phone. Stage B turned
Verlauf into a widget board: rating hero, year-to-date full width, attendance
and the Endurance Phase side by side while the first rank is held, and every
paragraph of methodology moved into the sheet the tile opens. Nothing in
scoring, ranking, persistence or the questions was touched; the one colour
that moved is the Gym bar fill (`-mid` → `-ink`, to clear 3:1 on its tint).
The `Momentum-preview` repository's `index.html` carried
`apple-mobile-web-app-status-bar-style: black-translucent`, which this
repository has never had. **Decided at STOP 6b (D163):** the style is
`default` for the rest of WP3, here and in the preview — the status bar is
painted from `theme-color`, which the app sets per world. An edge-to-edge
status bar is a backlog item (below).

**V1 is released.** The release pass closed the last four open items —
Gate 2 by deciding not to build it (D120), tombstones as post-V1 (D121),
D111's real harm (D119), and `restDays` left dormant (D122) — and fixed two
defects found by measurement rather than by reading: a pause punished people
for turning up (D118), and the deploy workflow had been pointing at a dead
branch since RC2, so every green build published nothing (D122).

**Deployment.** GitHub Pages, from `.github/workflows/deploy.yml`, on push to
this branch. Pages is already enabled on the repository; the base path
`/Momentum-App/` in `vite.config.ts` matches the project-site path, so the
build needs no deployment-specific configuration. Live at
<https://hnd7k02.github.io/Momentum-App/> — the account was renamed from
`dario02king`, and GitHub does not redirect Pages after a rename, so the
old address no longer leads here (owner, 2026-11-11) and does not load at
all (owner, 2026-11-13). It is the same origin
as the preview, which is why a preview build opens a database of its own
(`VITE_MOMENTUM_DB`, see the colour-rules block).

Genuine post-V1 work, none of it blocking:

| Candidate | Product decisions needed |
|---|---|
| "Warum diese Zahl?" panel | none — it explains numbers that already exist. The largest remaining user-facing gap |
| Gym plans, profile | stores and repositories exist; what they are *for* is partly a product question |
| Tombstone unlocking | the benchmark values are an open decision (D121) |
| Nutrition targets | moot since Food left the product (D139) |
| Removing the dormant `restDays` collection | a deliberate `BACKUP_FORMAT_VERSION` cleanup, safe but not urgent (D115, D122) |
| Domain-independent day closure | D111's note; Mind is the only daily domain since D139 |
| kg or lb per exercise (backlog from STOP 6b, D163) | some machines are marked in pounds only: the unit becomes switchable per exercise, and progress is always converted to and compared in kilograms. Today the unit is one display preference (D130); sets stay grams |
| Edge-to-edge status bar, like a native app (backlog from STOP 6b, D163) | the content runs under the clock and the battery, only the camera island covers it. The catch: with `black-translucent` the status bar's own text is always white for a Home Screen app, so the light Mind world needs a dark gradient at the top. Not in WP3 — the style stays `default` |

**If a third training domain ever arrives**, add only its evidence — what one
comparable observation is, and what makes two of them comparable. Everything
from the percentage change onwards already exists in `core/scoring/` and
should not be copied. And whatever groups its comparisons must depend only on
the record's own facts; the three designs that did not are recorded in D103
along with the regressions that killed them.
