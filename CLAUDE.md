# Momentum — operating rules

A mobile-first PWA. German (de-CH) first, English second, **local-only**: no
backend, no account, no cloud sync, no telemetry. Everything lives in
IndexedDB on the device — with one named exception that is not data: the
switch of the body's measuring display, in the browser's local storage
(D181).

These are the rules that stay true across phases. Current state, status and
next work are in [`HANDOVER.md`](HANDOVER.md); the reasoning behind individual
choices is in [`docs/decisions.md`](docs/decisions.md).

## The architectural rule everything else follows

**Store what happened. Derive everything else, every time.**

Answers, sessions, sets and configuration snapshots are stored. Day scores,
ratings, ranks, XP, streaks, muscle-group performance and Boss progression are
*replayed* from them on every load. Nothing derived is ever written to
storage.

Two consequences that are not negotiable:

- A stored derived value and a replayed one would eventually disagree, and
  then neither could be trusted. If you find yourself caching a score, you are
  introducing that bug — measure first (`src/storage/services/replayPerformance.test.ts`).
- Correcting a past entry inside the edit window simply produces a different
  answer next replay. There is no recalculation step to write.

## Configuration is historical

Every scoring-relevant change appends an `AppConfigSnapshot` effective from
that day. A past day is scored against the snapshot in force **on that day**,
never against today's settings. This is what makes every change in this app
forward-only without any special handling:

- raising a weekly target does not rewrite last month
- changing Boss weights does not move historical Boss values
- moving a question to another category does not rescore a closed day
- changing the scoring model does not rescore days scored under the old one
- changing what a Gym exercise-day is worth does not revalue a day scored
  before the change (D150)
- changing how steeply a change becomes a level does not rescore a day
  mapped by the curve as it was (D177)

A field that is **absent** from a snapshot marks an era: no `boss` means RC2,
no `scoring.model` means the flat Wellbeing model, no `scoring.gymMetric`
means the best set by `reps × load` (D84), and a `gymMetric` without
`curveDecadePercent` means the curve at ten (D178). Never backfill those
into old snapshots — the absence *is* the information.

Where a fact is cheaper to record than to snapshot, record it on the row: a
gym set stores the muscle groups it was logged under, which of them were
primary, how it was loaded, and whether the user marked it as a warm-up
(D151). Same principle, smaller extension — and the absence of those fields
on an older row is itself an era, never something to backfill from today's
catalogue.

A fact that is already dated and stored is **replayed, not copied**: a
bodyweight set's load reads the most recent weight entry on or before its own
date, so a measurement taken next month can never enter a session already
logged.

## An absence is charged for once

Two mechanisms may not both bill the same silence. A missed weekly target is a
real result and already lowers the rating through the ordinary target. From
seven consecutive days with no session it becomes an *abstinence episode*, and
from that day the decay schedule sets the rating instead of the gap movement
running as well.

Decay of that kind touches **only the progress inside the tier held when the
episode began** — an interval of the shared ladder, held with hysteresis and
internal to the fold (D124); it is not a domain rank and nothing is shown or
promoted by it — and it is cumulative against the progress held when the
episode began, never compounded against what is left. Compounding never
reaches zero and makes a fourth week of absence cost a quarter of what the
first did. Nothing historical moves: sets, exercise performances,
muscle-group figures, past snapshots and Tombstones are facts about what
happened.

## Absence is not failure

The single most common way to get this app wrong is to treat "no data" as a
zero. Three states are kept apart everywhere:

| | Meaning |
|---|---|
| no data | never tracked, or not tracked yet |
| insufficient baseline | tracked, but nothing to compare against |
| a real result | including a genuinely bad one |

A domain nobody enabled, a muscle group nobody has trained, a question that
did not exist yet, a week before onboarding — none of these are zeros, and
none may enter a denominator. A *missed* item on a closed day is different:
that is a real result, and it counts as one.

## Two numbers per day, deliberately

- **`score`** — for history. On a closed day it divides by what was **due**,
  so an unanswered item is a miss.
- **`recordedScore`** — what the rating tracks. It divides by what was
  actually **answered**, because dividing by items due would make honestly
  logging partial progress cost more than staying silent.

Never conflate them.

## Product rules that are settled

- **One rank: the Boss** (D125). A domain has a rating, performance figures
  and a share of the Boss — never a rank, a badge, a promotion, a peak rank
  or an XP total of its own. **One badge family.** No second ladder, no
  "strength rank", no separate emblem set.
- Eight ranks, no divisions. Rank names stay English in every language.
- **A Boss promotion is confirmed, never instant** (D126): seven eligible
  days in a row at or above the next threshold — past, scored, unpaused;
  today, open, neutral and paused days are transparent, a scored day below
  resets. One rank per confirmation. Days before the stored era boundary
  `settings.promotionConfirmation.from` keep the legacy immediate rule. A
  settings record created under this version carries the boundary from its
  first day, opens at Rookie and confirms every rank in order, one seven-day
  period per transition, however high the rating already is; a record
  without the field predates the feature and is activated once from the day
  after, never moved. The pending dates are persisted but recomputed from history on
  every replay; never patch them from an edit. Demotion needs hysteresis
  *and* sustained days, exactly as before. A single bad day may never cost a
  tier. In the P8 era a day counts for a promotion, and moves the demotion
  counter, only once it is settled — closed, and if its week carried a
  weekly target up to it, that week judged (D136). Gym's and Running's Endurance Phase
  no longer gates a promotion (there is no domain promotion to gate, D125);
  it stays as written in D94 — four net weeks, real numbers throughout — and
  abstinence decay begins only once it is complete.
- **A domain rating measures the user against their own history, never
  against anyone else.** No population norms, no absolute-strength scaling, no
  calibration against other people — not as a modifier and not as a starting
  estimate. Absolute benchmarks are Tombstones, which are a separate system
  and stay separate in both directions. **One documented exception**
  (D150): the 30 in Gym's strength score, `load × (1 + reps ÷ 30)`. It
  converts the user's own sets into one another and compares them with
  nobody; it is one constant carried in the snapshot, never a table, and
  nothing of its kind follows it without a decision.
- **The product is Mind and Gym, with Laufen inside Gym** (D139, D143).
- **Heute's Gym label leads straight to Muskelgruppen** (D161, D182), and
  back leads to where the user came from — Heute, or the hub; after a link
  straight to the address, the hub. The hub stays the place for training,
  plans and running and is one tap from Muskelgruppen. Heute loads neither
  the viewer nor the model. **A move to the hub can say what it is made
  for** (`app/hubIntent.ts`, D200): «Pläne verwalten» on Heute and on
  Muskelgruppen arrives at the training plans, in view and in focus. The
  intent is taken once and is not a place — the address is the hub's.
- **A tap on a muscle or on a row opens the group's sheet, and the
  selection is the open sheet** (D185, contract §9): one group is chosen
  while its sheet stands and none once it has gone. A row is a button that
  opens a dialog, not a toggle. Nothing stands under the ten rows but the
  way to the hub: the exercises of a group are in its sheet, and an
  exercise's detail is opened from there and lies **on top of**
  Muskelgruppen — the body beneath is never taken down. Back walks step by
  step, exercise, sheet, screen, by the button and by the browser alike,
  and the address changes for none of it.
- **The sheet shows the row's number and computes none** (D186): its state
  and figure are the `ShownMuscle` the row and the body read, its line is
  `muscleTrend()`, an exercise's change is `exerciseSpans()`
  (`features/gym/muscleSheet.ts`). The body says what it draws for each
  group, read back from its colours (`drawnState`), and `muscle-sheet.mjs`
  compares the three for all ten groups.
- **One exercise has one change** (D176, D186): the one in the range the
  screen shows — the comparison its groups' figures are the mean of
  (`exerciseChanges`). It stands in the exercise's row in the sheet and at
  the head of the exercise detail, with its state and under the same
  words. No other percentage of an exercise is printed: "Zuletzt" and
  "Davor" are two sets, and the detail's line ends without a figure. Do
  not print a second change for an exercise without a name that says what
  it compares, and never one that differs between the sheet and the detail.
  **Its line is that change day by day** (the owner's correction at STOP
  7C, D187): each point is the change in the range up to that day, by the
  same comparison (`exerciseLine`), as a group's line is its figure day by
  day — so it ends on the figure, and an end point in a rise's colour never
  lies under the zero line. Never draw an exercise against its first day
  again where the figure compares something else.
- **Work volume is shown and never scored** (D152, D186): Σ reps ×
  effective load over the working sets, per group and week
  (`core/gym/volume.ts`), spread over an exercise's groups by the shares
  the rating spreads its change by and by the roles the day was logged
  under. It enters no rating, no Boss share, no state and no colour — its
  bars are neutral, the last one included — and nothing under
  `core/scoring`, no rating service and not `muscleState.ts` may read it
  (`volumeUnscored.test.ts`). The sets reach the screen through
  `loadGymRange`, which stores nothing.
- Mind's questions are asked **daily**. There is no rhythm engine, no
  per-question schedule, and there never will be.
- Gym and Running are independent weekly quotas, never a combined one.
- **The week a training domain starts in carries no target** (D127). The
  weekly ledger takes a week's targets from the snapshot in force on its
  Monday, so a domain that starts after that Monday has no entry there: for
  attendance, Endurance, XP and streaks the partial week is no data, never a
  miss. The ledger stays as it is. The daily history fold resolves each day's
  own snapshot and so does score those days — a known divergence, recorded in
  D127, not something to "fix" in passing. A screen that states the week
  against the user's target reads it as Heute does (`loadTrainingWeek`); a
  rating figure shows the start week as no data.
- **A workout counts from its first saved set** (D128). Opening a workout,
  free or planned, writes nothing; the session is created with the first set
  — a free one as a bare session, a planned one with its snapshot — and a
  picked exercise is a pending row, never a stored 0×0 set. Sessions stored
  before this stay history. A session the user empties is deleted, and an
  undo or the next set brings it back with the same id; only a new set
  reopens a finished workout (D137). A Gym session is removed only in its
  workout, never by the check-in delete (D142).
- **One day back, as an era** (D132, D133). An answer, a session, a set, a
  run or a weight entry reaches today and yesterday on a day of the
  P8 era (`scoring.sessionWindowDays` present) and nothing older. A day's
  window is read from its own snapshot — an absent `editWindowDays` is the
  legacy 3 — and a week takes its era from its Monday. The rule lives in
  `core/config/closure.ts`; never re-implement it in a screen. A Gym session
  keeps its day, and no backfill reaches a day its domain was off. Heute
  shows Heute | Gestern, relative, and every write goes to the day on show
  (D138). On Gestern a standard question whose stored text is unchanged
  reads in its library "gestern" wording — display only, never written
  (D144).
- **Nothing is charged while it can still be written** (D134, D135). A P8
  week is judged when it is over — Tuesday 00:00: until then a week with a
  session counts attendance as met and an empty one is no data, while
  performance keeps moving daily. An abstinence charge waits for its day to
  close, and the break tiles say it is pending. A legal write may never
  reverse a charge (`p8Reversal.test.ts`).
- **`finishedAt` is a fact nothing scores** (D129): a timestamp after
  "Fertig", `null` while a workout started in the app is running, absent for
  a session recorded before the field — which is finished. Never backfill it.
- **The weight unit is a display preference** (D130). Sets stay grams and
  weight entries kilograms; kg and lb exist only in `core/gym/weight.ts` and
  on screen. Write a weight only when its value changed — re-parsing rounded
  pounds moves stored grams — and never read an emptied field as zero.
- **An undo puts back what was removed** (D131): the same rows, the same
  line in the same place, within the edit window — never a re-add. A
  workout action decides from what is stored when its turn in the write
  queue comes, never from the render it was tapped on: the tap's own blur
  may just have saved something.
- **Food existed until WP2; its data is kept and nothing creates it**
  (D139, D140). It was ranked on the 1–10 adherence the user entered, never
  on calories or macros, by the shared daily fold — no attendance, no 40/60,
  no Endurance Phase, no abstinence decay. WP3 Stage 4 switched it off from
  the update day as an era (`ensureFoodRetired`, on every load): each day
  before replays byte-identically by the rules it was lived under (D107,
  D110, D111, D113, D118), and from that day the Boss moves by the remaining
  domains. The stores, the record, the ratings, the entries and the backup
  collections stay; no screen, service or onboarding field writes them, and
  `food` stays in `DOMAIN_TYPES` for the replay but never in
  `OFFERED_DOMAIN_TYPES`. Do not bring a Food screen back, and do not delete
  its data.
- A training domain's rating is **40 % attendance and 60 % personal
  development** — Gym and Running both. Extra sessions beyond the weekly
  target buy no more attendance; a rate of change reaches the level through
  one documented curve (`src/core/scoring/performanceCurve.ts`), never
  through a table of branches.
- **One curve, and the one value a domain may bring to it** (D99, D101,
  D177). Its five properties — exactly 500 at 0 %, symmetric, monotonic,
  diminishing, bounded with no cap on the input — are shared and not
  negotiable per domain. Its one tunable, how many percentage points of
  change multiply the odds by four, is ten in the constants and may be a
  domain's own **in an era of its own, carried in that domain's snapshot**:
  Gym's is `scoring.gymMetric.curveDecadePercent` from the Stage 5b era on
  — three, confirmed by the owner at STOP Kurve (D180) — handed to the
  function as an argument and read per day by
  `gymCurveOf()`, the field's one reader beside `gymMetricOf()` (D178).
  Running hands in nothing and computes with the constants on every day,
  as does a Gym day before the era or under a marker without the value.
  `TRAINING_RATING.CURVE_ODDS_PER_DECADE` and `CURVE_DECADE_PERCENT` are
  read when the module loads: changing them would revalue every day ever
  scored, so they stay what they are. No second curve, no table, no branch
  by sign, no fitting to anyone else's data — and no screen computes the
  curve.
- **What a domain compares is domain-specific; how it is scored is not.** Gym
  reduces to the best working set of an exercise, Running to pace at a
  comparable distance. Each produces a percentage change per window, and
  everything after that — the curve, the 40/60 target, movement, Endurance,
  decay, Maintenance — is the shared code in `core/scoring/`. Add a domain by
  adding its evidence, never by copying the model.
- **A Gym exercise-day is worth its best working set, as an era** (D150,
  D151, D172, D173; the median confirmed at STOP 5b, D175). From the snapshot that carries `scoring.gymMetric` on,
  the day's value is the highest `effective load × (1 + reps ÷ 30)` among
  the sets not marked as a warm-up, and a window compares the median of an
  exercise's last days with the median of its first
  (`k = min(3, ⌊days ÷ 2⌋)`). Before it, the value is the best set by
  `reps × load` and the last day against the first (D84), and such a day
  replays so for good. Each scored day computes its **whole window in its
  own day's metric**: no ratio mixes the two, and a day before the boundary
  never sees a strength score. `gymMetricOf()` (`core/gym/metric.ts`) is the
  field's one reader; the rating asks it for each day, a screen for the day
  its range ends on (`GymHistory.metric`), and no surface chooses a metric
  or computes a version of its own. In the new era the order of the sums is
  fixed — by date, exercise id and set order — so the same sets replay to
  the same bits on every device. A warm-up is a fact on the set
  (`warmUp: true` or absent), set by hand, never detected and never
  backfilled: it opens the session and counts for the week like any set,
  and never for the metric. There is no rule for pyramids, drop sets or
  light weeks. The set's number is the mark's control; a hint under the
  sets says so until a set has been marked once, and that it has is a
  recorded fact (`settings.warmUpMarkUsed`), not a thing derived from the
  sets (D175).
- **An identity a comparison is grouped by must depend only on the record's
  own facts.** Running's distance bands are a pure function of the run's own
  distance, so adding, editing, deleting or expiring any other run cannot
  change what an existing run is compared against. Anything that groups by
  looking at neighbouring records reinterprets history the moment one arrives.
- **The Boss averages normalized domain performance, never event count**
  (D110). It moves by the weighted movement of each domain's position on the
  one shared 0–8 ladder. Attendance is capped at its target and a day is
  answered once, so logging something more often can never make it dominate.
  Lifetime XP answers a different question and never enters the rank. Do not
  introduce a per-event Boss constant or a cross-domain exchange rate.
- **The general cooling-off formula is RC2's, approved** (D113): two grace
  days, then 1.5 a day to day 7, then 3, capped at 60 per episode. It governs
  every domain-and-era segment that has no approved model of its own —
  Mind, Food's days, and the pre-performance-model Gym and Running eras — and
  it is reached only through `activeDecayModel()`. Gym and Running under the
  performance model use their own abstinence rule and never both (D96).
  A declared **pause** suspends it (D116); rest days never will (D115).
- **A pause suspends inactivity penalties and nothing else** (D116). It stops
  the general cooling-off charge and the training abstinence progression
  across every domain, and it **freezes the inactivity clock without
  resetting it** — five silent days, a fortnight paused, and the next silent
  day is the sixth. It creates no activity: streaks break as normal,
  attendance is never credited, no session is fabricated, XP stays monotone
  and the Boss has no pause rule of its own. Logging is never blocked, and a
  day logged inside a pause counts exactly as it would outside. Bounded to 28
  days, both dates required, no overlaps, and **prospective only** — the
  earliest start is today, a begun pause may only be ended early from today
  onwards, and no pause may ever reclassify a day already lived.
  A paused training week nobody trained in is scored as **no data**, not as
  zero attendance: suppressing only the decay made a pause strictly worse
  than no pause, because the decay branch is rank-floored and the ordinary
  target is not. And on a paused day the training target may **raise** the
  rating but never lower it (D118) — attendance is a measure of the absence a
  pause excuses, so charging it punished people for turning up. The floor is
  one-sided, and Mind and Food's days get none: there a low day is a reported
  result, not a measure of absence.
- **Rest days are deprecated** (D115). Never shipped, never approved, and made
  redundant by the seven-day abstinence rule and D37. The store stays for
  backup compatibility; nothing creates one, and no UI ever should.
- **Today's status counts every daily obligation** — Mind's questions (D119,
  D141). A weekly quota is not due today and is not counted. The app must
  never say "done for today" while something daily is outstanding.
- **One unanswered daily domain currently holds the whole day open** (D111).
  That is the existing mechanism, it only postpones closure inside the edit
  window, and it is deliberately unchanged — but it deserves revisiting as
  daily domains multiply, since a later design may want each domain's day to
  close on its own obligations. Not a licence to redesign it as cleanup.
  Mind is the only daily domain since D139; a Food-era day still replays
  under this rule, which is the update day's cost recorded in D141.
- A rating **moves towards** its target rather than becoming it. Climbing gets
  slower as the rating rises; falling never does — a high rank is harder to
  reach, not protected.
- The generic `sports` domain is **retired**. It exists as a stored
  discriminator so RC2 history replays; nothing in the product may create one.
  A migrated user is **offered** the one-time question about what those
  sessions were (D112) — in Areas, never as a blocking step. No default, no
  timeout and no guess may answer it: a user who never answers must keep a
  fully working app and be asked again next time.
- Colour is never the only carrier of meaning.
- **A built-in exercise is written down, never inferred** (D87, D93,
  D171, D188): its groups, its primary ones, its load type, its equipment
  and its movement stand on its catalogue entry, and none of them is read
  from a name. The 49 entries before block 7D keep their ids, roles, load
  types and names for good; an id, once released, is never reused. The
  search (`core/gym/search.ts`) reads the entry and the words of one place
  per language; it finds a group by its primary role only, and nothing that
  rates reads the movement or the equipment.
- **Mind is the wellbeing domain's one name** (D143), in both languages:
  every label reads one key through `i18n/domainNames.ts`. Its stored id
  stays `mental` (D66), and the question category "Mental" is a different
  thing. The terminal is Mind | Gym.

## Interface rules

- **The visual contract is [`docs/wp3/vertrag.md`](docs/wp3/vertrag.md)**
  (D160): how every screen looks and speaks. The rules below are the ones
  that stay true; `src/styles/designRules.test.ts` and
  `scripts/verify/design-system.mjs` enforce them.
- **The onboarding has four exceptions of its own, and they stay there**
  (D190, D191, contract §16): a flat ground without the washes, solid
  white cards, a coloured gradient line, bars and segments in the first
  slide's hero only — the one place with example values, an image with no
  control in it — and a 40px hero figure (`--type-figure-hero`), with at
  most one dark surface a screen, always Gym or the rank. It speaks in the
  app's system font: DM Sans came and went at the owner's word (D191), and
  no stylesheet loads a face or sets a family of its own. Everything else
  in the flow follows the contract, and nothing of the four reaches a
  screen of the app: `designRules.test.ts` fails if a file outside
  `features/onboarding/` reads those tokens. A step never shows a number
  the flow does not hold. **It begins on an opening page** — «Let’s get it
  started», no step and no marks (D192), and **no button to find**: a tap
  anywhere goes on, the page itself takes it, and a faint «Screen
  antippen» in `--text-tertiary` says so, a real button for a keyboard
  (D193). That hint is the opening page's own exception, beside the four:
  an operable thing in grey, outside "Colour has three jobs" and "One
  order of buttons", on that page only. **Nothing is chosen for the
  user** (D192, D197): the areas, Mind's questions and the weekly targets
  all open empty, and «Weiter» waits, saying why, for a world, for one
  question, and for Gym's weekly target — Laufen stays optional. The
  three starter questions of D191 came and went; do not bring a default
  back into the flow. `GYM.DEFAULT_TARGET_PER_WEEK` is what the settings
  fall back on, never what the introduction starts from, and the second
  slide names a target not yet chosen in a sentence, never as «0 von 3».
  **Only a preview build replays it** (`app/preview.ts`: a database of
  its own): Einstellungen →
  «Einführung ansehen» walks the flow as a rehearsal that hands nothing to
  storage — never in the live app.
- Design tokens only (`src/styles/tokens.css`): no colour, font size, layer
  or duration is written anywhere else, and `designRules.test.ts` walks
  `src/` for one. The exceptions are the rank badge, a fixed graphic
  (`RankBadge.tsx`), the dev harness `BodyDevPage.tsx`, and **the app
  icon, a fixed graphic like the badge** (D198): its colours stand in its
  SVG files under `public/` and nowhere else. The owner's first drawing
  is kept byte for byte (`docs/wp3/prompts/aufraeumen-icon/icon-full.svg`)
  and never edited; `tools/icon-source.mjs` holds the values he chose for
  it afterwards (D203) — the star larger and sharper, the sheen clearer,
  each a number of his own SVG — and `tools/render-icons.mjs` makes
  `public/icon-full.svg`, the rounded and the small drawing and the four
  PNGs from the two (`--check` says whether all seven still are what it
  makes). Change the icon there, never a file by hand, and never redraw
  it: a change to it is a number of his drawing, and his to choose.
  `contrast.test.ts` parses the token file and will fail a colour that does
  not clear its promise.
- **Two worlds, one system** (D145, D148). `:root` is Mind, light, and the
  shell every shared screen is drawn in; `[data-world="gym"]` is Gym,
  graphite with one violet accent. The Gym block redefines colours, shadows
  and the glass, nothing else. A screen declares its world with `useWorld`
  (`app/world.ts`), which puts the attribute on `<html>` so the tab bar, the
  sheets and the status bar follow; in Bereiche the whole screen turns with
  the area. A Gym card on a shared screen is light like the screen it
  stands on, and a sheet follows the screen that opened it. There is no
  variant and no dark tile. `contrast.test.ts` holds each set against its
  own ground.
- **Colour has three jobs** (D154, D160). The accent means *operable* — a
  button, a link, the chosen option, the active tab. The status palette
  means *the state of the data*. Everything else is neutral: an area has no
  colour of its own, a bar or a line that shows a value is `--data-ink` on
  `--data-track`, and the one coloured bar is a weekly target that has been
  met (`--data-met`). A muscle's identity colour is an 8px dot before its
  name and nothing else. Do not bring back a pastel family, a `--domain-*`
  alias or mint.
- **Glass is one blur per card** (D146): `backdrop-filter` with the
  `-webkit-` prefix, a 1.5px gradient edge (`--glass-edge`), the solid
  `--glass-solid` where blur is unsupported or less transparency was asked
  for. Nothing blurs over or under the 3D canvas while it can move: the
  body's stage has no surface of its own, the buttons that stand in it are
  solid, and **a sheet stands over a still body** (D182). Every sheet asks
  whatever can draw by itself to stop and stands once it has
  (`app/stillness.ts`); under it no frame arises unless one is asked for.
  **The one sheet that rises over a body still on its way is the muscle
  sheet, and it has no glass at all** (D185): a solid surface on a scrim
  that neither dims nor blurs (`overBody`), at every moment, while the
  camera brings the group into the strip above it; its screen holds the
  viewer from the moment the camera rests. Do not open a sheet over the
  body by another way, and do not give the stage a card. The ground is one
  layer, painted by the shell and by a full-screen overlay; a header never
  paints it again.
- **A sheet is as tall as its content and does not move — except the one
  with two heights** (D185, contract §9): the muscle sheet opens at two
  thirds of the screen, is dragged to 92 % and down to close, and hands a
  drag over between itself and its content as a phone does
  (`components/sheetDetents.ts`); the two shares are tokens. **A grabber
  stands only where one can drag**, and there it is a control with a name
  that changes the height. Do not give a sheet with fields a drag, and do
  not draw a grabber on a sheet that cannot be dragged.
- **A layer that Back closes owns a history entry with the address of the
  screen it lies on** (D185, `app/backLayer.ts`): the exercise detail, and
  **every sheet** (D187, D200) — `Sheet` registers itself, and a host that
  owns the layer already, as Muskelgruppen does for the muscle sheet, says
  so with `hostsBack`. **A sheet with fields loses nothing typed when
  Back closes it**: what stood in its fields stands again when it opens
  next for the same thing (`components/sheetDraft.ts`; in memory, handed
  back once, never stored), while its cross, the ground behind it, Escape
  and its buttons discard as they always did. A new sheet with a field
  keeps its draft the same way. A sheet is still not a place — no link
  names it and none is restored from an address — and `route.ts` knows of
  layers only that a move from a layer's entry takes that entry over. Do
  not write a layer into the hash, and do not call `history.back()` for one
  by hand: the entries follow the layers by counting.
- **Text on glass is measured, not assumed** (D147, D149).
  `design-system.mjs` reads the rendered pixels under every visible run of
  text on every screen at 320, 360, 393 and 430 and holds all of it at
  4.5:1 — the captions (`--text-tertiary`) included. The ground's washes
  and a sheet's fill are bounded by that measurement.
- **Status colours have one definition** (D123): `--status-{weak,mixed,good,
  strong}` in `tokens.css`, the same four fills in both worlds. CSS uses
  `var()`; TypeScript and WebGL read the same file through
  `src/styles/statusPalette.ts`, which keeps the light set. Never write one
  of those hex values anywhere else — `statusPalette.test.ts` scans for it.
  Their companions — ink, tint, the `-on` label, the track — and the empty
  cell move with the world (D145); the body never paints the empty cell. The
  1–10 answer and the 0–100 scores both resolve to the same four statuses and
  the same `status.*` labels; text moves to read, the bar never does.
- **One place makes a number a state** (D153, D164, contract §7):
  `features/gym/muscleState.ts`. A change is shown as a whole percent,
  rounded half away from zero both ways; the state follows the shown
  figure, so figure and colour can never part, and **the band is
  one-sided** (the owner's choice at STOP Kurve, D180): −2 % to +1 % is
  held, a rise counts from +2 % and a fall from −3 %. One rep more at the
  same weight then always reads as progress, and a fall counts where it
  always did — a symmetric ±1 would have made every missed rep a decline.
  The legend says that the two sides differ. A group states a trend only
  with three
  exercise days in the range and an exercise on two days, otherwise it is
  "Zu wenig Vergleichsdaten". The body, the flat figure, the rows, the
  hub's card, the trend above the rows, the muscle sheet, the exercise
  detail and the golden test all read it; none rounds, compares or counts
  on its own. **"uneinheitlich"** is its word too (`isUneven`, D186): the
  exercises of a group more than ten points apart *as shown* — a word
  beside the figure in the sheet, not a state, colouring nothing.
  "Gewertet" means the row prints a figure. Which group an exercise
  belongs to is asked once as well (`exerciseGroups`): the domain's answer,
  its roles as of its latest day in the range — for the count, a row's
  recency, the trend's days and the exercises in a group's sheet. All of it
  is presentation: the rating reads its own windows and `src/core` knows
  none of it.
- **"Gehalten" is neutral, never the warning yellow** (D153, D161): the
  text colour in a row, the data ink as a mark, white on the body. The
  body has three neutral tones: `--body-held` (a trained muscle with no
  change), `--body-dimmed` (a muscle not trained yet) and `--body-inert`
  (head with neck, hands, feet — a tone of its own, halfway between the
  two, D166). The inert zone is no state: it takes no tint, is never
  chosen, and nothing refers to it. A tint is mixed from white and grows
  evenly from 2.5 % to 8 % (D179: the changes the Stage 5b metric reads
  in a month span the scale), from three tenths of its full strength (the
  owner's value, D167 — not a number to tune), and `stateIntensity()` is
  the one place a strength comes from. A rise shown as +2 % takes that
  weakest strength; the scale does not move for the band (D180). Which
  state takes which tone never changes.
  The muscle trend reads 30 or 90 days, Verlauf 7 or 30 — two constants,
  never one again.
- **The body's light is tokens, and it has no tone mapping** (D165,
  contract §8): `--body-light-*`, `--body-roughness*`, `--body-environment`
  and `--body-tone-mapping: none` in `tokens.css`, read into `BODY_LOOK`
  (`features/body/tokens.ts`) and held by `tokens.test.ts`. No strength or
  position of a light is written in a component. A status colour on the
  body is the colour of its material; a tone mapping makes a pastel of it.
  The key light is as strong as white bears on the shoulders without
  burning out — measure before raising it.
- **The body stands on a stage, not in a card** (D182, contract §8): as
  wide as the screen and as tall as 55 % of the dynamic viewport, with only
  the header in 17px, the range and the metrics strip above it. The 55 %
  are the stage's, not the body's, which fills 84 % of it (the owner's
  answer at STOP 7B, D184). One framing
  for every stage — the camera's angle of view is fixed (`framing.ts`) —
  so the body's still (`assets/body-stage.webp`, made by
  `tools/render-body-preview.mjs … stage`) stands exactly where the canvas
  draws the body, until the first picture and whenever a lost graphics
  context is being replaced: the stage is never an empty field. A change to
  the framing means a new still. The strip counts nothing: its trend and
  its count are `shownPerformance()`'s; its third cell prints the change
  of the improved group that rose most, with the group beneath, and "–"
  over "keine Verbesserung" where none improved (D184). Under the feet lies one disc whose
  colour fades to nothing (`--body-ground-*`) — a gradient, never a blur
  and never a texture; the scene stays at twelve draw calls.
- **How the body is operated is settled** (D182). The motion counts time,
  never frames: every value is in `MOTION` (`motion.ts`), a coast and a
  travel are the exact solution of their equation, and the next frame is
  asked for from inside the frame — never through a deferred
  `requestAnimationFrame`, which halves the frame rate. **A tap never turns
  the body**; a selection made in the list turns it when the group faces
  away. A tap means the surface that is seen, with twelve CSS pixels of
  tolerance (`picking.ts`); head, hands and feet are never chosen and are
  not see-through. Two fingers zoom between 1.0 and 1.8 and are never a tap
  and never a turn; a zoom is a window on the picture and a chosen group
  stays inside it. A double tap and the reset button set the view back and
  leave the selection. A drag that begins up or down is the page's. The
  page's own zoom is never locked. A host can hold the viewer; held, it
  draws exactly one frame when what it shows changes, and advances nothing.
  **Above its sheet the body shows the chosen group** (D185): the host
  names the strip of the stage the sheet leaves free, and the camera
  travels to the window that puts the group in it (`framing.focusOn`) —
  zoom and place, never the angle, whatever zoom the fingers had left —
  and back to the whole picture at 1.0 when the strip is gone. A region's
  box is the box of the triangles it draws (`BodyModel.regionBox`): the
  regions share one vertex buffer. **A touch that changes nothing draws
  nothing** (D184).
  While the still stands in, a finger moves nothing, and a lost context
  sets the view back to the start: the body returns where its still stood.
  **Nothing in the body's scene is given a value that is new on every
  render** — a function written in the element, or an object (an array of
  numbers is compared by its entries; nothing else is): the renderer takes
  it for a changed prop and draws a frame for every render of the screen.
  A render with nothing changed draws nothing, and so does a scroll of the
  page (`body.mjs`, `gym-muscles.mjs`).
- **The measuring display is a tool, not interface** (D181), and it stays
  in the release (the owner's answer at STOP 7B, D184):
  `features/measure/`, off until its user switches it on in the settings.
  It asks for no frame and stands beside the canvas, never over it. Its
  switch speaks everyday language and lives in local storage — the first
  and only use of it, nothing in the schema or a backup. The display itself
  is **the one place that may carry technical words**, each number with its
  unit. It knows nothing of three.js: the viewer reports to it.
- **The body model is built, never edited** (D165).
  `public/models/momentum-body.glb` comes out of `python3
  tools/body/build.py momentum-body --install`, byte for byte, from the
  data in `tools/body/makehuman/`; a change to the body is a change to
  that pipeline, and `digests.json`, the table in `muscleMeshMap.ts` and
  the still on the Gym card follow it. Head with neck, hands and feet are
  the inert zone and end in straight cuts; the validator's check points
  (`tools/body/checkpoints.mjs`) hold where every region lies, and it runs
  first in `npm run build`. **A border that is to be a line is cut by the
  build** (D167): the knee, the pectoral's lower edge, the collarbone and
  the deltoid's edge are planes and fields of `regionrules.py`, cut into
  the fine mesh and marked, and `refine-body.mjs` leaves a marked border
  where it is. The app never turns its colours off, so every border is
  seen; do not try to straighten one by smoothing — a region belongs to a
  vertex of the base mesh, and its staircase survives. No data enters
  `tools/body/` whose licence was not read in its own wording, and no
  Blender by hand.
- **Type and numbers.** The scale is 34, 22, 17, 15, 13, 11 and no text is
  under 11px. A number takes a figure step — `--type-figure-xl` for the one
  main number of a screen, `-l` on a tile and in a sheet's head, `-m` in a
  strip, 17px semibold in a row — with tabular digits wherever numbers
  stand in a column and its unit smaller and secondary (`Figure`).
- **Density.** One side margin of 16px on every screen (`--page-gutter`),
  a card inset of 16px, a row at least 54px.
- **One order of buttons** on every screen: at most one primary, the tinted
  second step, a text button in `--accent-ink`, and quiet for the first tap
  of a destructive act — only its confirmation carries `--status-weak-ink`.
- **A chart** is a neutral 1.5px line or neutral bars with a fine zero
  line and no wash beneath; the end point or the last bar carries the
  state. The rows of a list share one scale, −8 % to +8 % — the change at
  which a tint on the body is full, so body and rows speak on one scale
  (D180; ±12 % before) — and bars start at zero (D163): a small change
  must look small. No data draws nothing. **A line begins on the baseline
  of its first day** (D170, the owner's choice at STOP 7C, D187): the
  group's or the exercise's first training day in the range, at nought —
  in the row, in the sheet and in the exercise detail — so a single
  observation is the shortest line there is, never a dot floating over the
  zero line (`fromBaseline`, `exerciseLine`); a row that shows only the
  last twelve points of a long line no longer begins there. **The
  exercise detail draws a line** (D175): each day as the change in the
  range up to it (above), on that scale — widened in steps of four where a
  series goes further, never cut off and never from the smallest day to
  the largest — and one recorded day as a sentence, not a chart (D170).
  No figure stands at its end (D176): its end point carries the state of
  the exercise's one change, which stands at the head and which the line
  ends on. **The sheet's chart** is the group's line on the rows'
  scale: what goes beyond 8 % stays at the edge and the figure beside the
  end point says how far it went; a series that rises and falls has the
  zero line in the middle. **The work volume's bars carry no state's
  colour** (D152) — the one chart whose last bar does not. All lines of
  the ten rows stand in one column (D169): beside a chart the figure's
  column has one width.
- **A screen that loads holds its layout** with calm surfaces
  (`LoadingBlocks`), no shimmer — and never for a load that failed, which
  says so and can be retried (`LoadFailure`). The hub's "Muskelgruppen"
  card is as tall before its history arrives as after and its title stands
  in the same place (D168): its text begins at the picture's top and grows
  downwards only — do not centre it again. **What a glass card says never
  changes under its glass** (D199): that card was the one on the hub whose
  text changed after its first picture, and an iPhone now and then kept
  only part of the new one. A card whose words arrive later is put there
  whole — mounted with them, or, where it must stand before them, a new
  element when they change (`key`), which a browser paints from nothing.
  The body is there before its history: the stage stands from the first
  render with the body's still in it, and the viewer's code and the model
  load beside the history, not after it (D182).
- **An empty state says why it is empty and what is missing** (contract
  §11, D163), and offers the one action that supplies it. An empty *range*
  is not "never": Muskelgruppen reads 30 or 90 days while the hub's figures
  read the whole history, and `features/gym/muscleGap.ts` keeps the five
  absences apart. Never answer a range without data with a first-time text.
- **A figure is printed with a real minus sign and a no-break space before
  its percent sign** (D163): "−10 %", never a hyphen, never "100 / %" across
  a line end. `i18n/typography.ts` has the helpers, `translate()` prints a
  negative parameter that way, and `typography.test.ts` holds both
  catalogues and the source to it.
- Touch targets 44px effective. A control may reach it with a negatively
  inset `::before` — but never one computed from a border width: a browser
  snaps a border to whole device pixels, differently per device. Where it
  can, make the control's own box the target and draw the shape inside it
  (`.bubble`, the body's reset button). The one exception to 44px is the
  row of seven target bubbles, which never wraps (D163): under 375px a
  bubble's target is 44px high and its share of the row wide. On the body
  itself a group is reached from twelve pixels beside it (D182).
- No horizontal clipping at 320/360/393/430px.
- Reduced motion and reduced transparency respected.
- Avoid technical vocabulary in user-facing copy — no "IndexedDB", "JSON",
  "service worker", "snapshot". The one named exception is the measuring
  display (D181), which is a tool: its switch and hint are everyday
  language, its numbers may be called what they are.
- German is the source of truth for strings; English is typed against it and
  placeholder parity is enforced by `src/i18n/catalogue.test.ts`.
- **An update is a worker other than the one that runs the page** (D204):
  `isUpdate()` in `app/serviceWorker.ts`, with the controller read when
  the worker reports, never before. A worker claims its page as it
  activates, and WebKit can tell the page of the claim before it tells it
  of the install — asking only *whether* there is a controller turned a
  first visit into «Neue Version verfügbar».

## Migrations

Two migrations that rewrite the same store must not each open their own
cursor. Requests inside one upgrade transaction are served in the order they
were made, so both read the record as it was before either wrote and the later
write wins with a stale value — losing a version's work silently, and only on
devices that skipped a release. Migrations therefore **declare** their
per-record rewrites (`transforms` in `storage/db.ts`); the runner composes them
in version order and applies the chain in one pass.

## Build and test discipline

- **`npm run test` must exit 0.** A green summary is not enough: vitest counts
  an unhandled rejection as failure while still printing every test as passed.
  Read the exit code, not the summary. This is how a release once shipped
  broken.
- **Typecheck is `tsc -b`**, never `tsc --noEmit`. `-b` enforces
  `noUncheckedIndexedAccess`, and an emitting typecheck once left stale `.js`
  files that Vite resolved in preference to their TypeScript sources.
- The vitest workspace has two projects: `berlin` for `*.test.ts(x)` and
  `sao_paulo` for `*.tz.test.ts` — date logic runs in a zone where local
  midnight has not always existed. All date arithmetic is anchored at midday
  for that reason. A test has thirty seconds there, not vitest's five:
  the replay tests walk whole profiles, and a slow runner once failed one
  on the clock alone — what a replay may cost is measured in
  `replayPerformance.test.ts`, not by a default.
- Browser and accessibility verification live in
  [`scripts/verify/`](scripts/verify/README.md) and are part of finishing a
  phase, not an optional extra. `npm run verify` serves the builds **as
  GitHub Pages serves them** (`scripts/verify/pages-server.mjs`), never
  through `vite preview`: its `Vary: Origin` made the service worker's
  cache refuse a precached chunk to its own import and kept one check red
  for months (D163, D200). A check that depends on the weekday it runs on
  is a broken check — say what the rule gives for the day, as
  `muscle-sheet.mjs` does for the volume's first week.

## What this app does not do

No food tracking (D139), no exercise database from outside — the catalogue
ships with the app as code (`core/gym/catalogue.ts`, D171, D188): no
external database, no API, no pictures, no instructions — no calorie or macro
targets, no food API, no barcode scanner, no meal planning, no shopping list,
no Strava OAuth, no backend, no login, no social feed, no avatar editor, no
muscle-group ranks, no automatic plan changes without the user's approval.

Do not introduce a backend because it would simplify something.

## What is measured where

| | Answers |
|---|---|
| domain rating | how am I progressing, against my own history |
| Tombstone | have I hit this absolute benchmark |

Conflating them would ruin both, so the boundary is an API boundary as much as
a conceptual one: nothing in `core/scoring/trainingRating.ts` reads a
benchmark table, and no personal-development percentage belongs inside a
Tombstone.

## When a product decision is not settled

Some decisions are explicitly reserved. Build the shape, leave the value, and
say so — the decay model did exactly this until D113 closed it
(`src/core/decay/index.ts`): one switch, one flag, a placeholder that
reproduced the previous behaviour exactly, and a test asserting the flag and
the model cannot disagree.

**And wire the shape to the thing it governs.** That gate stayed open for six
phases with `core/decay` calling nobody while a second copy of the same
schedule ran inline in `computeRating`, so the flag was a claim about dead
code and every test of it was self-consistent and meaningless. A reserved
decision is only reserved if flipping it would actually change what runs.

Do not substitute a conventional fitness-app or habit-app model because it is
familiar. Where this app's rules differ from convention, the difference is the
product.
