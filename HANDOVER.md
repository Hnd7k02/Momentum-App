# Handover — Momentum V1, released

Current state, status and next work. Durable rules are in
[`CLAUDE.md`](CLAUDE.md); the reasoning behind individual choices is in
[`docs/decisions.md`](docs/decisions.md) (D1–D131). This file does not repeat
either — it says where things stand.

## Repository state

| | |
|---|---|
| Branch | `claude/momentum-pwa-spec-j82dhm` — the default branch, which is the only one Pages deploys from. Pass 2, the domain terminal and the muscle map were developed on `claude/momentum-pass-2-geometry-r2qzkd`; the muscle-map release candidate `bc57ec6` was merged here with a merge commit (`90bf328`) because the default branch carried a later upload. The release is tagged **`muscle-map-v1`** |
| Overall-rank update | On `claude/momentum-overall-rank-update-v2`. **Stage 1** (D123): one `--status-*` palette in `tokens.css`, both scales on four bands, muscle-map states on the same colours. **Stage 2** (D124, D125): the Boss is the only rank — domain ranks, badges, promotion messages, peak ranks and per-domain XP are gone from the engine and the screens; abstinence decay measures in an internal held tier; the rating engine's outputs are frozen in `.github/fixtures/stage2/` and replay byte-identical. **Stage 3**: Tombstones verified dormant and pinned by `tombstones.test.ts`; no production change. **Stage 4** (D126): a Boss promotion is confirmed over seven eligible past days; the era boundary is `settings.promotionConfirmation.from` — set at settings creation for a new install (today, Rookie opening) and by the ensure step for a legacy record (the day after activation), never moved; the pending dates are persisted and reconciled from every replay; the activation continuity fixture is `.github/fixtures/stage4/activation.json`. **Stage 5**: verification pass; the distance caption reads "Schwelle erreicht" while a rank waits to be confirmed; indicator states pinned on the real screens by `scripts/verify/stage4-shots.mjs` with screenshots under `docs/design/overall-rank/`. Release audit in the Stage 5 report. **Not merged, not deployed** |
| WP3 (Mind & Gym) | On `claude/momentum-wp3`, branched from `e30becd`, staged. **Stage 0**: the golden replay baseline `.github/fixtures/wp3-golden/` (six files, compared exactly by `domainOutputs.test.ts`). **Stage 1**: bug fixes B1–B6 and B9–B12 with no scoring change — every fingerprint and golden file byte-identical to Stage 0; D127 recorded. **Stage 2**: the workout flow — free workouts as drafts (B7, D128), removal with undo (B8, D131), the running workout on Heute and `finishedAt` (D129), kg \| lb (D130); no scoring change, every fingerprint and golden file byte-identical. **Stage 3a**: the edit-window gate (`docs/design/wp3/stage3a-window.md`). **Stage 3b**: one day back (P8) as an era — one write rule for today and yesterday, a week judged when it is over, abstinence carried while it can be written, D126 on settled days, Heute \| Gestern (D132–D138); every pre-P8 value byte-identical, the P8 golden files re-frozen deliberately. **Not merged, not deployed** |
| Muscle map | **Released.** The 3D body in Bereiche → Gym, the ten analytics rows with their mini sparklines, Laufen inside the Gym workspace, the credits entry. App source `5e554aa`; QA record `docs/design/muscle-map/INTEGRATION-QA.md`; handoff deviations `docs/design/muscle-map/HANDOFF-DEVIATIONS.md` |
| Working tree | clean at the commit this file was committed in |
| `SCHEMA_VERSION` | **5** (`src/core/model/index.ts`) — v5 adds the `foodDays` store |
| `BACKUP_FORMAT_VERSION` | **3** (`src/core/backup/format.ts`) — v3 adds the `foodDays` collection; a v1 or v2 file still imports, every later collection reading as empty when absent |
| `SCORING_MODEL` | `categoryMean` (`src/core/config/constants.ts`) |
| `GYM_SCORING_MODEL` | `attendancePerformance` — Gym's 40/60 model |
| `RUNNING_SCORING_MODEL` | `attendancePerformance` — Running's 40/60 model |
| Food scoring | the shared daily fold over a 1–10 adherence rating (D106, D107) — **no** model constant, because there is no second model |
| `DECAY_MODEL_APPROVED` | **`true`** — Gate 1 closed by D113. RC2's formula ratified unchanged, and `core/decay` is now on the live path |
| Gate 2 (nutrition targets) | **still open.** Food ranks without one, on purpose (D106) |

Phases 0–6 of iteration 2 are complete. Phase 4.1 closed the Gym scoring gate,
Phase 5 closed Running's, and Phase 6 built Food **without** closing Gate 2:
Food is ranked on the adherence the user enters, so the calorie and macro
target decision is still entirely open and nothing in the scoring path
pre-empts it.

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
| `src/core/scoring/performanceCurve.ts` | **Shared.** The curve, attendance, the two-window blend |
| `src/core/scoring/trainingRating.ts` | **Shared.** The 40/60 target, movement, Maintenance, the fold |
| `src/core/scoring/endurance.ts` | **Shared.** The first-promotion gate |
| `src/core/scoring/abstinence.ts` | **Shared.** Episodes, the four decay schedules, rank intervals |
| `src/core/running/performance.ts` | Distance bands, pace ratios, the window aggregate |
| `src/core/food/adherence.ts` | The 1–10 Food is ranked on, and why no target lives there |
| `src/core/food/catalogue.ts` | Five demo foods — code, not data, never in a backup |
| `src/core/gym/catalogue.ts` | 29 built-in exercises, stable ids, explicit muscles, roles and load types |
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
| `src/features/areas/DomainSwitch.tsx`, `GymTerminal.tsx`, `RunningTerminal.tsx`, `CreditsSection.tsx` | **Bereiche is the terminal**: Mental · Gym · Ernährung, one area at a time. Gym carries its board, the muscle module, and Laufen as a separate section; Einstellungen carries the CC BY credit for the body model |
| `src/features/body/` | **The 3D body.** `BodyViewer` (R3F canvas, camera rig, tap-vs-drag, the approved material treatment with the neutral selection cue), `useGLTF`, `BodyBoundary`, `bodyVisuals.ts` (the adapter from `MusclePerformance` to tint and intensity), `muscleMeshMap.ts` (the id ↔ GLB contract), `tokens.ts` (identity and state colours, the single colour source). `index.ts` is the **lazy boundary**: three.js and the renderer live in their own chunk and are fetched only when the Gym module renders |
| `src/features/gym/MuscleModule.tsx`, `MuscleRows.tsx`, `Sparkline.tsx`, `muscleAnalytics.ts` | **Muskelgruppen.** The body above, the ten rows below, one selected group held by `GymProgress`. `toMuscleAnalytics()` derives each row read-only from the loaded history: state, delta, last trained day, and the trend — the group's over-span change since the range began, as of each training day, via `gymPerformanceOverSpan()` on the history prefix, so the last point *is* the row's delta. The chart is the handoff's `spark80`: per-row min/max, flat when equal, a dot for one observation, nothing for none |
| `public/models/momentum-body.glb`, `tools/validate-body-glb.mjs` | The model (CC BY 4.0, patmateee, modified; 40 000 triangles, one primitive per muscle id plus `none`) and the contract validator that runs first in `npm run build` |
| `src/components/BodyRenderer/index.tsx` | Muscle diagram; presentation only |
| `src/features/gym/*` | Session logging, picker, bodyweight, overview, exercise detail, progress |
| `src/features/running/*` | The Running overview and its distance ranges |
| `src/features/food/*` | The Today card: the day's rating, then the log |
| `scripts/verify/` | Browser + accessibility suites (see its README) |
| `.github/fixtures/` | RC2 export + a 120-day synthetic profile |

## Implemented state

**Fully implemented and usable**
- Wellbeing: categories, custom questions, daily check-in, drill-down history
- Gym: exercises, sets, picker, session logging, performance pipeline,
  muscle-group aggregation, body renderer, exercise history, progress hierarchy
- **Gym scoring: the 40/60 rating, the trend and year-to-date windows, the
  Endurance Phase, abstinence decay, Maintenance, bodyweight and assisted
  exercises, 70/30 muscle roles, and the Gym overview that explains them**
- **Running: the 40/60 rating, distance-band identities, pace over the trend
  and year-to-date windows, the Endurance Phase, abstinence decay,
  Maintenance, optional distance/duration entry with derived pace, and the
  Running overview that explains them**
- Boss Rank + four domain ranks, user-configurable weights, mystery ladder
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
  `features/gym/assets/body-preview.webp` (12 kB) is `momentum-body.glb`
  rendered once through the real viewer in its neutral tint by
  `tools/render-body-preview.mjs` — regenerate it from there when the model
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
  days for a promotion and closed days for a demotion (D136).
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

**Infrastructure only — built, tested, not reachable from any screen**
- Rest days, pause periods, tombstones, profile: stores +
  repositories exist, no logic and no UI. **Weight entries are now reachable**
  — the Gym session screen writes one when a bodyweight exercise needs it.
- `RunRecord` carries `source`/`externalId` as the import seam. No importer.

**Intentionally dormant**
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
- Nutrition targets (Gate 2) — deliberately, see below. Tombstone unlocking,
  rest-day/pause handling in the replay, "Warum diese Zahl?", Strava import.

## Scoring rules, as implemented

### Wellbeing day score — two-level mean (`dayScore.ts`)
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

### Gym performance (`core/gym/performance.ts`, `load.ts`, `muscles.ts`)
- **Exercise-day:** `max(reps × effectiveLoad)` over that day's scorable sets.
  Not volume, not the sum, not an average, not 1RM, not the heaviest weight.
  Ties never change the number.
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
- **Windows** (D100): `gymPerformanceInWindow` takes each exercise's first and
  last recorded day *inside the window* and needs two observations there. One
  comparison per exercise, so frequency adds evidence not weight.
  `gymPerformanceOverSpan` (lifetime) still anchors at the first-ever day and
  is used only by the Progress "overall" figure.
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

### Food (`core/food/adherence.ts`, `core/scoring/dayScore.ts`)

One item due per day: the 1–10 the user chooses. `adherence × 10` is the day
score — the same mapping a Wellbeing scale answer uses. Unrated inside the
edit window leaves the day **open**; unrated once closed is a **miss for
history** and **no data for the rating**. Before Food was enabled there is no
food entry at all.

The rating is then the shared daily fold, not the 40/60 training model. There
is no attendance, no performance curve, no Endurance Phase and no decay.
Calories and macros are logged, totalled and shown, and never scored — see
D106 for why that is a rule and not a phase-6 shortcut.

Setup is one optional sentence (`FoodDomainSettings.focus`), carried in the
config snapshot, saying what the user is aiming at. Food scores identically
with it empty.

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
3. **Nutrition targets.** Gate 2, **still open after Phase 6.** Food is built
   and ranked, on the 1–10 adherence the user enters (D106) — deliberately a
   question that needs no target to answer. Nothing in the scoring path reads
   a calorie or macro figure, so this decision is as open as it was, and
   making it later rewrites nothing already stored.
4. ~~**How Food contributes to the Boss, and what a rated day is worth.**~~
   **Resolved by D110.** Boss contribution is normalized domain performance —
   the shared 0–8 ladder position — never raw event count, and lifetime XP was
   never the Boss path. No per-event constant exists or is needed. Pinned by
   tests in `foodBoss.test.ts`.
5. **Tombstone benchmark values.** The boundary is documented (D95) and no
   values were invented. What counts as a milestone is a product decision.
   No Food Tombstone values were invented either.

## Risks and known debt

- **Gym replay is not bit-deterministic across record ids** (found in WP2-1,
  deliberately not fixed there). `gymService.buildExerciseDays` reads sets
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

All of the following were run against the exact commit this file is committed
in, except where noted.

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
| Browser (Phase 6, regression) | 47/47 at 320/360/393/430px |
| Accessibility (Phase 6) | 20/20 |
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

**Gate 2 — nutrition targets — is still open, and Food works without it.**
Food is ranked on the 1–10 adherence the user enters (D106). Calories and
macros are logged, totalled and shown, and **nothing about them reaches the
score**. If and when targets are decided, they arrive as a new thing the user
can be measured against — the entered 1–10 stays exactly what it always was,
and no stored value needs rewriting.

Do not read Food's existence as the gate having been closed. There is no
calorie target, no macro split, no BMR or TDEE estimate and no weight-goal
model anywhere in the build.

**The domain terminal and the muscle map are merged and released
(`muscle-map-v1`).** Bereiche is the terminal: one switch — Mental · Gym ·
Ernährung — and beneath it one area's workspace, with the area in the route
(`src/app/route.ts`, `#/areas/<area>`; Back walks the areas visited). Heute,
Verlauf and Rang are unchanged in role: Verlauf stays the overall, historical
overview and keeps every domain's daily row. Gym carries its board, then
Muskelgruppen — the 3D body above ten analytics rows, each with its identity
dot, name, last-trained day, an 80 × 24 sparkline in the group's identity
colour and the percentage or state in the state colour — then Übungen, then
Laufen as its own section with its board and target card. The body, the rows
and the exercise list share one selected group; a body tap selects and never
clears, a row tap toggles. Three.js arrives in a lazy chunk (235 kB gzip)
with the model (345 kB gzip) on first entry to Gym and never on any other
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

**Next for the muscle map, none of it blocking:** a finer pitch for the
`body.mjs` probe; the "several exercises" line for a group whose latest day
had more than one (the ids are on the view model, the copy is not decided);
the `Muskelgruppen` module's rows are the accessible selection path at 320px,
where the triceps is about two 8px cells wide on the body.

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
The `Momentum-preview` repository's `index.html` carries
`apple-mobile-web-app-status-bar-style: black-translucent`, which this
repository has never had — worth deciding on deliberately.

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
<https://dario02king.github.io/Momentum-App/>.

Genuine post-V1 work, none of it blocking:

| Candidate | Product decisions needed |
|---|---|
| "Warum diese Zahl?" panel | none — it explains numbers that already exist. The largest remaining user-facing gap |
| Gym plans, profile | stores and repositories exist; what they are *for* is partly a product question |
| Tombstone unlocking | the benchmark values are an open decision (D121) |
| Nutrition targets | deliberately out of V1 (D120); D106's reservation stands |
| Removing the dormant `restDays` collection | a deliberate `BACKUP_FORMAT_VERSION` cleanup, safe but not urgent (D115, D122) |
| Domain-independent day closure | D111's note, worth revisiting as daily domains multiply |

**If a third training domain ever arrives**, add only its evidence — what one
comparable observation is, and what makes two of them comparable. Everything
from the percentage change onwards already exists in `core/scoring/` and
should not be copied. And whatever groups its comparisons must depend only on
the record's own facts; the three designs that did not are recorded in D103
along with the regressions that killed them.
