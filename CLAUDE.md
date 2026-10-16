# Momentum — operating rules

A mobile-first PWA. German (de-CH) first, English second, **local-only**: no
backend, no account, no cloud sync, no telemetry. Everything lives in
IndexedDB on the device.

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

A field that is **absent** from a snapshot marks an era: no `boss` means RC2,
no `scoring.model` means the flat Wellbeing model. Never backfill those into
old snapshots — the absence *is* the information.

Where a fact is cheaper to record than to snapshot, record it on the row: a
gym set stores the muscle groups it was logged under, which of them were
primary, and how it was loaded. Same principle, smaller extension — and the
absence of those fields on an older row is itself an era, never something to
backfill from today's catalogue.

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
  and stay separate in both directions.
- **The product is Mind and Gym, with Laufen inside Gym** (D139, D143).
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
- **What a domain compares is domain-specific; how it is scored is not.** Gym
  reduces to the best set of an exercise, Running to pace at a comparable
  distance. Each produces a percentage change per window, and everything after
  that — the curve, the 40/60 target, movement, Endurance, decay, Maintenance
  — is the shared code in `core/scoring/`. Add a domain by adding its
  evidence, never by copying the model.
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
- **Mind is the wellbeing domain's one name** (D143), in both languages:
  every label reads one key through `i18n/domainNames.ts`. Its stored id
  stays `mental` (D66), and the question category "Mental" is a different
  thing. The terminal is Mind | Gym.

## Interface rules

- Design tokens only (`src/styles/tokens.css`). `contrast.test.ts` parses that
  file and will fail a colour that does not clear its promise.
- **Status colours have one definition** (D123): `--status-{weak,mixed,good,
  strong,empty}` in `tokens.css`. CSS uses `var()`; TypeScript and WebGL read
  the same file through `src/styles/statusPalette.ts`. Never write one of
  those hex values anywhere else — `statusPalette.test.ts` scans for it. The
  1–10 answer and the 0–100 scores both resolve to the same four statuses and
  the same `status.*` labels; text is darkened to read, the bar never is.
- Touch targets 44px effective. A control may reach it with a negatively
  inset `::before`.
- No horizontal clipping at 320/360/393/430px.
- Reduced motion respected.
- Avoid technical vocabulary in user-facing copy — no "IndexedDB", "JSON",
  "service worker", "snapshot".
- German is the source of truth for strings; English is typed against it and
  placeholder parity is enforced by `src/i18n/catalogue.test.ts`.

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
  for that reason.
- Browser and accessibility verification live in
  [`scripts/verify/`](scripts/verify/README.md) and are part of finishing a
  phase, not an optional extra.

## What this app does not do

No food tracking (D139), no exercise database, no calorie or macro targets, no
food API, no barcode scanner, no meal planning, no shopping list, no Strava
OAuth, no backend, no login, no social feed, no avatar editor, no muscle-group
ranks, no automatic plan changes without the user's approval.

Do not introduce a backend because it would simplify something.

## What is measured where

| | Answers |
|---|---|
| domain rating | how am I progressing, against my own history |
| Tombstone | have I hit this absolute benchmark |

Conflating them would ruin both, so the boundary is an API boundary as much as
a conceptual one: nothing in `core/gym/rating.ts` reads a benchmark table, and
no personal-development percentage belongs inside a Tombstone.

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
