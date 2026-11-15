# WP3 Stage 5b — the exercise-day metric, as an era

The design, written before any production code (step 1 of
`docs/wp3/prompts/prompt-5b-kennzahl.md`), and at the end of the block the
record of what was built and what it does to the numbers. Decisions: D150,
D151, D152; the pattern of an era: D132, D139.

## What changes, in one paragraph

Today one exercise on one day is worth `max(reps × effective load)` over all
of its sets (D84), and a window compares an exercise's last day with its
first. From the first load of the update an exercise-day is worth its **best
working set by a strength score**, `effective load × (1 + reps ÷ 30)`; a set
the user marked as a warm-up never provides it; and a window compares the
**median of the last k exercise-days with the median of the first k**,
`k = min(3, ⌊days ÷ 2⌋)`. Everything from the percentage change onwards —
70/30, equal weight per group, the curve, 40/60, movement, Endurance, decay
— is untouched. The whole of it is an era: a day before the boundary
replays by the old metric in all its parts, byte for byte.

## 1. The field, what it carries, and what its absence means

A new optional field on the snapshot, `scoring.gymMetric`
(`AppConfigSnapshot`, `src/core/model/index.ts`):

```ts
gymMetric?: {
  /** Names the metric: the best working set of the day. */
  id: 'bestWorkingSet';
  /** The score's one constant: effective load × (1 + reps ÷ repsDivisor). */
  repsDivisor: 30;
  /** How a window compares an exercise's days — the switch of D150. */
  comparison: 'median' | 'firstLast';
}
```

- **One constant, carried in the snapshot, never a table** (D150). The value
  this build writes is `GYM_METRIC` in `src/core/config/constants.ts`; the
  replay reads the number from the snapshot of the day, not from the
  constant, so a later build that changed the constant would start an era of
  its own and could not reach a day already scored.
- **The comparison rule is a switch inside the field, not a second era.**
  The owner confirms the median with numbers at STOP 5b. Until then it is
  built and on. The switch is read in exactly one place
  (`exerciseSpans()` in `core/gym/performance.ts`), and tests hold that the
  rule a snapshot names is the rule that runs — for the pure function and
  through the rating replay (`CLAUDE.md`, "When a product decision is not
  settled": wired to the thing it governs).
- **Absent means the old metric in all its parts**: the best set by
  `reps × load` over *all* sets (a warm-up mark is not read), the last day
  against the first, and today's order of the muscle sums. Never
  backfilled: the absence is the information.
- A field that is present but not what this build writes — a restored file
  is not validated — is still the era's marker: a divisor that is not a
  positive number reads as 30, a comparison that is not `firstLast` reads as
  `median`. Nothing throws.

`gymMetricOf(config)` (`core/gym/metric.ts`) turns a snapshot into the
`GymMetric` the pure pipeline takes, or `null` for the old one. It is the
only reader of the field.

## 2. Where the calculation reads which metric a scored day has

From **the snapshot in force on that day**, in two places and no third:

- **The rating** — `buildGymRating()` in
  `src/storage/services/gymRatingService.ts`. For each history day it
  resolves the day's snapshot (as it already does for `gymModel`) and takes
  `gymMetricOf()` of it. That day's two windows, trend and year-to-date, are
  then computed by `performanceOn(days, date, metric)` over the
  exercise-days *as that metric values them*.
- **The screens** — `loadGymHistory(from, to)` in
  `src/storage/services/gymService.ts` resolves the snapshot in force on
  `to`, the day the range ends, which is today for every caller. The
  history carries the metric it was built under (`GymHistory.metric`), and
  everything that derives from it — `shownPerformance()`,
  `toMuscleAnalytics()`, `muscleTrend()`, the hub's card, the exercise list,
  the exercise detail — reads `history.days`, `history.overall` and
  `history.metric`. No surface chooses a metric or computes a version of its
  own; the workout's "Bester Arbeitssatz" line stops doing so (it compared
  `reps × the number typed`, which for a bodyweight exercise was not even
  the set the score took) and names the set the service hands it.

## 3. A day after the boundary, and a window that reaches back before it

**Each scored day computes its whole window in that day's metric** (D150).
The sets are stored facts; a metric is a way of reading them.

- A day *before* the boundary has no marker in its snapshot: its windows
  are read by the old metric from the old values. It never sees a
  strength score, whatever today's date is.
- A day *from* the boundary on reads **every** exercise-day in its window —
  the ones before the boundary included — by the strength score, working
  sets only. A set without the warm-up field is a working set, so a day
  logged before the update is read exactly as it would be had it been
  logged after it without a mark.
- So no ratio ever divides a strength score by a `reps × load` product, and
  no window is left without a baseline on the update day: its baseline is
  the same days it had yesterday, read in the new unit.

What moves on the update day is therefore one thing: the day's two window
changes are the new metric's, and the rating takes one ordinary step
towards the target they give (section "The numbers" below measures it).

## 4. One exercise-day, two values, one read, no quadratic

`ExerciseDay` keeps its shape — one `best` — and **the list is built per
metric**: `exerciseDays(inputs, metric)` (`core/gym/performance.ts`).

- `metric === null`: `bestSet()` as it is, sorted by date as it is. The
  function body for this case is the one that runs today.
- a `GymMetric`: `bestWorkingSet()` — the highest
  `load × (repsDivisor + reps)` among the scorable sets not marked as a
  warm-up — sorted by date and then by exercise id. An exercise whose sets
  that day are all warm-ups produces no entry: no data, never a zero. The
  product is an integer for integer inputs and orders exactly as
  `load × (1 + reps ÷ 30)` does, so two identical sets compare equal
  (the invariant on `GymSetRecord.weightGrams`).

**The service reads once.** `gymService` reads the sets of the range and
the weight entries a single time and resolves each set's effective load a
single time (`readSetsInRange()`); from that it hands out the exercise-days
under whatever metric is asked for, memoised per metric
(`ExerciseDaySource.under(metric)`). The old metric buckets the sets in the
order the `by_date` index returned them, as today; the new one buckets them
sorted by date, exercise, set order, creation time and id — which is
section "The fixed order" below, and costs one in-memory sort.

**The rating replay stays linear.** `buildGymRating` keeps its three
pointers and its cache, once *per metric that occurs in the history* — a
"track": the exercise-days under that metric in date order, `trendLow`,
`yearLow`, `high`, and a cache keyed on the three. A day advances and reads
only the track of its own metric; the pointers only ever move forward
(January resets `yearLow`, as today), so a track that was not read for a
while catches up in amortised constant time. A history has one track
before the update and two after it, never one per day. Nothing filters
inside the day loop. `replayPerformance.test.ts` holds its four bounds
unchanged, and `gymScoring.test.ts` its guard over 420 days of real sets.

## 5. The activation step, case by case

`ensureGymMetricEra(effectiveFrom = today())` in
`src/storage/configService.ts`, called in `loadConfiguration()` after the
three existing steps — promotion confirmation, the one-day window, Food.
It is `ensureSessionWindowEra` with another field: keyed on the data,
appending the snapshot in force today again, effective today, with
`gymMetric` added and nothing else new.

| Case | What the step does |
|---|---|
| First load after the update | The snapshot in force today has no marker: the same configuration is appended effective today with `gymMetric`. On a day that already has a snapshot — the P8 and Food steps of the same load have just written one — that one is carried over with the field added (`append` replaces a same-day record, keeping its id). |
| Second load, any later load | The snapshot in force carries the marker: nothing is written. Idempotent. |
| A snapshot dated after today | It takes the field too, at its own date, so the era cannot flip back on that day. |
| No snapshot in force today (a profile set up while the clock was ahead) | Left alone for today; its later snapshots take the field. Its first day is not moved. |
| No snapshot at all (before onboarding) | Nothing to do; the first snapshot is written with the field. |
| The clock was ahead on the first load, and has been put right | Today lies before a boundary whose `createdAt` is later than now: that boundary was written on a clock that was ahead and is not kept — the marker is appended today, and the era begins on the day it was really reached. |
| The local date moved back across the boundary (a journey west) | Today lies before a boundary written at an instant already past: it is **kept**. Today was lived under the old metric and replays so; nothing is appended. `ensureCurrentSnapshot()` writes a snapshot for such a day *without* the field (the old era has none), and with it from the boundary on — so a write on that day cannot start the era early. |
| An old backup imported later | Its snapshots carry no marker: the next load starts the era on that day. Every day in the file replays by the old metric. |
| A backup from this build imported | The marker is in the file: the boundary stays where it was written. |
| A configuration this build does not recognise | A snapshot without a `scoring` object is left as it is. Nothing throws: a throw here would stop the app from opening, on every retry. |

**The three activations of the owner's device.** The live app is at
`e30becd`: it knows promotion confirmation, not the one-day window, not the
end of Food, not this metric. On the first load of the release
`loadConfiguration()` runs four steps; three write, and all three land in
**one** snapshot effective that day — P8 appends it, Food carries it over
with Food off, this step carries it over with `gymMetric`. A test builds
that device (Food on, three-day window), loads once, and holds: one new
snapshot, with all three; every earlier snapshot untouched; every day
before it replaying exactly as before; a second load writing nothing.

**`ensureCurrentSnapshot()` may not start the era earlier.** It compares
the snapshot in force with the live configuration, which
`buildConfigSnapshot()` now builds with the field. With a kept boundary
ahead of the day being written, the comparison and the write use the
configuration *as the old era had it* — the same construction it already
uses for the P8 window (`withWindowOf`) and for Food.

## 6. The existing profiles, and the new ones

**The existing profiles are already pinned to the old metric, and stay
so.** `currentProfile`, `trainingBreakProfile`, `p8CrossingProfile`,
`confirmationProfile` and `foodOffProfile`
(`src/storage/services/fixtures/profiles.ts`) write their snapshots by
hand, field by field, and none calls `buildConfigSnapshot()`: they carry no
`gymMetric` and never will. The tests that replay them import the file and
load — no step runs, nothing is appended. So every existing golden file,
the five files of `.github/fixtures/stage2/`, the one of `stage4/` and
every fingerprint in `domainOutputs.test.ts` are produced by the old metric
on every day, the reference day included. That is the first proof, and it
is made without touching a file. (The prompt expected `currentProfile` to
pick the field up from `buildConfigSnapshot()`; it does not go through it.)

**What does change sides** is every test that builds its history through
the services (`applyOnboarding()`, `addSet()`): a new device carries the
field from its first snapshot, so those histories are scored by the new
metric from day one. Each such test that states a number is looked at one
by one: where it is about the old rule, it is given the old era
explicitly (`fixtures/legacyGymMetric.ts` rewrites the stored snapshots
without the field, the way a device before the update holds them) and
keeps its numbers; where it is about something else and merely used
`reps × load` as its observable, it states the new product. None is
deleted or loosened, and each is listed in the STOP report.

**Frozen before any code of this stage**
(`.github/fixtures/stage5b/legacy-*.json`, commit `9dfb658`): four seeded
histories with several sets per exercise and day
(`fixtures/randomGym.ts`), replayed at two clocks by the engine as it was,
exact to the last bit. They are the second half of the second proof.

**New profiles and new golden files** (after the code):

- `metricCrossingProfile` — a realistic four-day split with several sets
  per exercise and day, lived under the old metric and crossing into the
  new one on a fixed Monday; frozen at clocks before, on and after the
  boundary.
- `strengthProfile` — under the new metric from its first day, holding
  each pattern the owner named or the review computed: double progression
  in 6–12 reps; a pyramid; drop sets after the work; marked and unmarked
  warm-up sets; a day with only warm-up sets; a single light day at the
  end of a window with six and with four exercise-days; a whole light
  week; a bodyweight exercise over a changing bodyweight.

## 7. A new device set up under this version

`buildConfigSnapshot()` (`src/core/config/snapshot.ts`) writes
`gymMetric: GYM_METRIC` into every snapshot, so the first snapshot of a new
device carries it: the device is in the new era from its first day and has
no boundary. The activation step finds the marker and writes nothing.

## The fixed order

In the new era the exercise-days of a day enter the muscle sums in the
order of their exercise ids, as Gate G measured: `exerciseDays()` sorts by
date and exercise id, and `musclePerformance()` and `exerciseSpans()` sum
in the order of first appearance in that list. With it, the sets of a day
are read sorted by set order, creation time and id, the roles of an
exercise-day are those of its first set in that order, and a tie between
two sets of equal score names the earlier one, then the heavier one. Two
devices holding the same sets under different record ids replay to the
same bits; a test shuffles the ids and compares exactly.

It is **bound to the era**: a day before the boundary is read in the index
order it always was, so no existing golden file changes its row order and
the exception D150 allowed for — one Gym golden file re-frozen for its row
order — is not needed.

## The warm-up set

A fact on the set (D151): `GymSetRecord.warmUp?: true`. Absent is a working
set; nothing backfills or detects it; no snapshot is involved. The field is
written when the user marks a set and removed when the mark is taken off,
so a set that was never marked and one that was unmarked are the same
record.

- Set and cleared by `updateSet()`, under the one write rule (today and
  yesterday on a day of the P8 era, `core/config/closure.ts`).
- A warm-up set is a set: it creates the session and counts for attendance
  as any set does (D128). It is skipped by `bestWorkingSet()` and by the
  "last time" line, and it will be skipped by the work volume (7C).
- `repeatLastSet()` copies reps and weight and not the mark.
- `restoreSet()` and `restoreExercise()` put back the record as it was
  stored, the mark included (D131).
- The backup carries the set as stored; `SCHEMA_VERSION` and
  `BACKUP_FORMAT_VERSION` stay 5 and 3 — an optional field on a record the
  format already takes without a field list is not a format change. An
  older build that imports such a file keeps the field on the row and never
  reads it.
- Under the old metric the mark is not read: a set of yesterday marked on
  the update day of a device that was already in P8 changes nothing about
  yesterday, which was lived under the old metric.

## Read as an adversary: where could a day before the boundary move?

Each of these was a way in; each is closed, and the test that holds it is
named.

1. **`buildConfigSnapshot()` now writes the field, and a hand-built profile
   might pick it up.** It does not (section 6). Held by every existing
   golden file and fingerprint, unchanged.
2. **A write on a day before a kept boundary** would append the live
   configuration, marker included, effective that day.
   `ensureCurrentSnapshot()` strips it for such a day (section 5).
   `gymMetricEra.test.ts`, "keeps it there through the next write".
3. **The rating's cache or pointers shared between eras** — a day before
   the boundary handed a window computed from strength scores because the
   cache key was the same. Each metric has its own track and its own cache.
   `gymMetricEra.test.ts`, the update-day proof over the seeded histories.
4. **The fallback of `performanceFor()`** — a reference day with no history
   row computed over "the" list. It takes the track of the reference day's
   own metric.
5. **The exercise-day list sorted anew for all days.** The old metric's
   list is built by the old function from sets in index order; only the
   new metric's list is sorted. `stage5bLegacy.test.ts`, exact.
6. **`SetInput` gaining a field** and so changing `best.set` in a golden
   file. The field is present only on a marked set; an unmarked set
   serialises as before.
7. **A warm-up mark on a day before the boundary** (the P8-yesterday case
   above). The old metric does not read the mark.
8. **The shared aggregation refactored.** `musclePerformance()` is split
   into "one row per exercise" and "sum the rows", so the new comparison
   can supply its own rows. The sums are the same additions in the same
   order; `stage5bLegacy.test.ts` compares the results to the last bit over
   histories with many exercises per group, and the Stage 2 baseline does
   the same over the fixture profiles.
9. **The screens.** They read today's metric, so on the update day
   Muskelgruppen shows the new figures for the whole range — that is
   intended (prompt, step 3) and is not a stored or scored value. The
   *rating's* days before the boundary do not read it.
10. **`GymRatingState` or `GymHistory` gaining a field** and so changing a
    frozen serialisation. The rating state gains none; `GymHistory.metric`
    is not part of any frozen output.
11. **A boundary written twice.** The Food and P8 steps and this one each
    append "the snapshot in force with one change"; none rebuilds the
    configuration, so none can add another era's field to a day that did
    not have it.

## What was built, against this design

The code follows the sections above; where the block decided something the
design had left open, it is recorded in D172 (the metric's era) and D173
(the warm-up mark). Two things came out differently from what the prompt
expected, both named in section 6 and in D172: the existing fixture profiles
were already pinned to the old metric, and the fixed order could be bound to
the era, so no golden file was frozen again.

Tests: `metric.test.ts`, `performance.strength.test.ts` (the eight cases of
the review, the series from the repository, the median at one to ten days),
`gymMetricEra.test.ts` (the step case by case, the owner's device, the
update-day proof over seeded histories, the fixed order under shuffled ids,
the switch through the replay), `warmUp.test.ts`, `workoutScreen.test.tsx`,
`stage5bLegacy.test.ts` (four seeded histories frozen from the engine
before the stage, compared exactly), `stage5bProfiles.test.ts`,
`stage5bImportFile.test.ts` and the sixteen new golden files of
`domainOutputs.test.ts`. In the browser: `scripts/verify/wp3-stage5b.mjs`.

## The numbers (step 8)

Every figure is read off the real replay by
`src/storage/services/stage5bReport.test.ts`
(`STAGE5B_REPORT=<file> npx vitest run stage5bReport`), never worked out
beside it. The full tables — every exercise's series, old against new — are
committed as generated, in the words of the STOP report:

- [`stage5b/zahlen-profile.md`](stage5b/zahlen-profile.md) — the two
  sixteen-week profiles of `fixtures/trainingProfile.ts`;
- [`stage5b/zahlen-probelauf-2026-11-15.md`](stage5b/zahlen-probelauf-2026-11-15.md)
  and [`stage5b/zahlen-probelauf-2026-11-02.md`](stage5b/zahlen-probelauf-2026-11-02.md)
  — the trial run.

One history is replayed three ways, the update loading on the same day in
each: **old** (the stage never was: the best set by `reps × load`, the last
day against the first), **new** (the marker from the update day, with the
medians) and **new, last against first** (the marker with the switch the
other way).

**The run with the owner's own data is missing.** He attached no backup, and
neither repository holds one with a single Gym set — only three files of the
RC2 era with sport sessions. The trial run therefore uses a backup the live
build made itself (`scripts/verify/stage5b-live-backup.mjs`: its onboarding,
its workout screen, its export, on a clock moving from 12 October to
15 November 2026): five weeks of push, pull and legs, 194 sets, twelve
exercises, written as strict double progression. It is committed as
`docs/wp3/stage5b/momentum-pruefdaten-5b.json` and is also the file the
owner loads into the live app and the preview at his check;
`stage5bImportFile.test.ts` pins what he will read there.

### One exercise, day by day

The trial run's bench press — the case the owner named: the reps rise, then
the weight goes up.

| Day | best set | old, to the day before | new, to the day before |
|---|---|---|---|
| 14 Oct | 8 × 60 kg | – | – |
| 21 Oct | 9 × 60 kg | +12.5 % | +2.6 % |
| 28 Oct | 10 × 60 kg | +11.1 % | +2.6 % |
| 4 Nov | 8 × 62.5 kg | **−16.7 %** | **−1.0 %** |
| 11 Nov | 9 × 62.5 kg | +12.5 % | +2.6 % |

First day to last: +17.2 % old, +6.9 % new. The other patterns of the same
file: the light squat day (8 × 80 kg between fives at 102.5 and 105 kg) is
the old metric's best day, +24.9 %, and the new one's dip, −15.3 %; the
pyramid's value was its lightest set (12 × 50 kg) and is its heaviest
(8 × 65 kg); the drop set (13 × 20 kg) was the day's value and the working
set before it (10 × 25 kg) is now; pull-ups over a falling bodyweight read
+48.5 % old and +7.2 % new over the five weeks.

### The muscle groups

The trial run, on the day the file was made (15 November):

| Group | 30 days: old | new (median) | new (last/first) | 90 days: old | new (median) | new (last/first) |
|---|---|---|---|---|---|---|
| Chest | +1.7 %, held | +2.7 %, improved | +5.3 % | +13.1 % | +5.3 % | +8.0 % |
| Back | +12.2 % | +3.6 % | +5.5 % | +21.9 % | +5.8 % | +7.9 % |
| Shoulders | +4.9 % | +3.2 % | +6.0 % | +20.7 % | +6.0 % | +8.8 % |
| Biceps | +15.6 % | +6.5 % | +11.6 % | +20.3 % | +11.1 % | +12.8 % |
| Triceps | +7.3 % | +4.1 % | +6.8 % | +15.8 % | +6.8 % | +9.5 % |
| Core | +6.9 % | +4.2 % | +6.9 % | +15.7 % | +5.6 % | +8.4 % |
| Quadriceps | +7.3 % | +4.7 % | +7.3 % | +7.3 % | +4.7 % | +7.3 % |
| Hamstrings and glutes | +14.7 % | +5.6 % | +8.3 % | +14.7 % | +5.6 % | +8.3 % |
| Calves | +8.3 % | +7.1 % | +8.3 % | +8.3 % | +7.1 % | +8.3 % |
| Forearms | **−3.7 %, declined** | **+4.2 %, improved** | +5.6 % | +8.3 % | +6.9 % | +8.3 % |
| **Trend** | +7.5 % | +4.6 % | +7.2 % | +14.6 % | +6.5 % | +8.8 % |

The forearms are the row that went from 9 × 60 to 8 × 65 kg inside the
window: a fall by `reps × load`, a rise by the strength score.

The crossing profile (sixteen weeks, a four-day split), 30 days, read on
17 June, thirty days after its update:

| Group | old | new (median) | new (last/first) |
|---|---|---|---|
| Chest | −12.5 %, declined | +1.0 %, held | −8.0 %, declined |
| Back | +2.5 %, held | +0.8 %, held | +0.8 %, held |
| Shoulders | +5.1 %, improved | −1.0 %, held | −3.0 %, declined |
| Biceps | +2.9 %, improved | +1.0 %, held | +1.5 %, held |
| Triceps | +3.0 %, improved | +0.9 %, held | +1.0 %, held |
| Core | +24.4 %, improved | +4.6 %, improved | +7.0 %, improved |
| Quadriceps | +5.6 %, improved | +3.3 %, improved | +5.6 %, improved |
| Hamstrings and glutes | +1.7 %, held | +1.0 %, held | +1.7 %, held |
| Calves | 0.0 %, held | 0.0 %, held | 0.0 %, held |
| Forearms | 0.0 %, held | +2.8 %, improved | +5.7 %, improved |
| **Trend** | +3.3 % | +1.4 % | +1.2 % |

### The rating round the update

The review estimated the one-off step at about 50 points in the target at
most, and about −26 in the rating after a week. **The replay gives more**,
and how much depends on how the history progressed:

| History, update | Target on the day | Gym rating on the day | +1 day | +7 days | +14 days | +30 days | Boss, largest in 30 days |
|---|---|---|---|---|---|---|---|
| Sixteen weeks, Monday of week 11 | +13.5 (800 → 814) | +1.3 | +1.2 | +9.2 | +28.5 | −8.1 | +15.2 |
| the same, Monday of week 5 | −122.3 | −6.7 | −12.7 | −29.8 | −46.4 | −67.9 | −35.0 |
| the same, Monday of week 8 | −117.5 | −6.4 | −12.0 | −37.3 | −37.6 | −0.9 | −21.8 |
| Trial run, 2 Nov (inside the five weeks) | −197 (964 → 767) | −9.6 | −18.4 | −41.8 | −50.6 | (a break, below) | −25.4 until day 14 |
| Trial run, 15 Nov (the day of the import) | −104 (930 → 826) | −3.7 | −3.7 | −3.7 | (a break, below) | | −1.9 until day 7 |

The seven update days of the sixteen-week profile are all in
`stage5b/zahlen-profile.md`; over them the target moves by −122.6 to +13.5
on the day, the rating by −6.8 to +1.3 on the day and by −37.3 to +9.2 after
a week, and the largest difference inside thirty days is −67.9 to +30.3 for
the Gym rating and −35.0 to +15.2 for the Boss.

Why it is more than the estimate: under `reps × load` every added rep reads
as +8 to +17 %, under the strength score as +2 to +3 %. A history that
progresses by reps — the owner's 6 to 12 — had its old figure four to five
times as large as the new one, and the curve (untouched, review risk 10)
turns the old +20 % into a performance of 939 and the new +3 % into 611. The
rating itself moves towards the lower target at its ordinary pace: single
points on the day, some thirty to forty after a week, and it settles where
the new target stands.

**A break after the update can cost a tier.** Not a rule of this stage, but
it follows from the lower target: abstinence decay removes the progress
inside the tier held when the episode began. In the trial run, with the
update on 2 November and no session after 15 November, the missed week
takes the old rating from 832 to 691 and the new one from 781 to 615. When
the episode begins on 22 November the old rating still holds the tier that
starts at 700 and the new one the tier that starts at 560, so the old one
ends at 700 and the new one at 560 — 140 points apart, 70 in the Boss, for
as long as the break lasts.

### The median against "last against first"

- **What the median buys.** One light day at an end of a window no longer
  decides the window. Crossing profile, chest, 30 days: −12.5 % old, −8.0 %
  by last against first — both "declined", from the single light day of
  Cable Fly — and +1.0 %, held, by the median.
- **What it costs.** A steady rise shows about two thirds to three quarters
  of its size: the comparison runs from the middle of the first days to the
  middle of the last. Trial run, the trend over 30 days: +4.6 % by the
  median, +7.2 % by last against first; over 90 days +6.5 % and +8.8 %.
  Through the untouched curve that is a lower target again — the trial
  run's Gym rating fourteen days after an update on 2 November: 831.7 old,
  799.7 by last against first, 781.1 by the median.
- **Where it is not a median.** With four or five exercise-days in a window
  k is 2, and the median of two days is their mean: a light day among the
  first two or the last two moves the comparison by half its size — at the
  end it softens a dip, at the beginning it lowers the baseline and makes a
  rise look larger. Only from six exercise-days on (k = 3) does one light
  day leave the comparison untouched.

## After STOP 5b

The owner accepted the stage on his iPhone on 2026-11-15 and answered its
four questions (D175). What that changed in this document's subject:

- **The median is confirmed.** Section 1's "until then it is built and on"
  is over: `GYM_COMPARISON_CONFIRMED` is `true`, and the switch stays wired.
- **The exercise detail draws a line.** The proposal of the stage,
  `ExerciseLineChart.tsx`, is the chart of `ExerciseDetail`; the bars are
  gone. It draws the days this document's metric values and computes
  nothing that is scored.
- **A hint says where the warm-up mark is** until a set has been marked
  once. That it has is recorded on the settings record
  (`warmUpMarkUsed`), not derived from the sets.
- **The curve gets a block of its own, "Kurve"**, before 7B and inside this
  era — the numbers above are why. `docs/wp3/prompts/prompt-kurve.md`.
