# WP3 block "Kurve" — the performance curve and the tint's strength, fitted to the Stage 5b metric

The design, written before any production code (step 1 of
`docs/wp3/prompts/prompt-kurve.md`), and at the end of the block the record
of what was built. Decisions it rests on: D175 (the commission), D99 and
D101 (the curve), D150 and D172 (the era of Stage 5b), D153, D164 and D167
(the band, the colour rules, the weakest tint).

## What changes, in one paragraph

Stage 5b replaced what a Gym exercise-day is worth. Under `reps × load` one
rep more read as +8 to +17 %; under the strength score it reads as +2 to
+3 %. The curve that turns a change into a performance level — `1000 ÷ (1 +
4^(−x ÷ 10))`, "every ten points of improvement multiply the odds by four"
— was left as it was, and so was the scale of the tints on the body, full
strength at 12 %. Both were fitted to the old metric's numbers. This block
sets the curve's one value anew **for Gym, inside the era of Stage 5b**, so
that someone who trains as in the import file does not stand lower after the
update than before, and it moves the upper end of the tint's strength.
Nothing that was scored before the boundary of Stage 5b moves, and Running
does not move on any day.

## The numbers, and where they come from

Every figure below is read off the real replay by
`src/storage/services/kurveReport.test.ts`
(`KURVE_REPORT=docs/design/wp3/kurve npx vitest run kurveReport`), never
worked out beside it. The tables are committed as generated, in the words
of the STOP report:

- [`kurve/zahlen-update.md`](kurve/zahlen-update.md) — the curve per
  candidate, and the rating round the day of the update as it is seen on
  each day;
- [`kurve/zahlen-lesarten.md`](kurve/zahlen-lesarten.md) — "not lower than
  before" in its three readings, the import file to its last day, and a
  break after it;
- [`kurve/zahlen-andere-seite.md`](kurve/zahlen-andere-seite.md) — the
  other side;
- [`kurve/zahlen-band.md`](kurve/zahlen-band.md) — the held band beside the
  new metric.

One history is replayed once as **old** — the device had Stage 5b never
been: the best set by `reps × load`, a window's last day against its first,
the curve at ten — and once per candidate as **new**: the Stage 5b metric
from the update day, and from that day the curve at the candidate's value.
The update loads on the same day in each, with the one-day window and Food
off as every update brings them.

**A candidate is "how many percentage points multiply the odds by four"**:
10 is the curve as it stands. Nine were replayed: 10, 8, 6, 5, 4, 3.5, 3,
2.5 and 2.

**How a candidate reached the replay before the code existed.** The replay
has one curve for every day until step 2 is built. The report therefore
hands the candidate in from outside, touching no production file: it wraps
`performanceScore()` and uses the candidate's steepness only for a Gym day
of the Stage 5b era — a call that follows `gymPerformanceInWindow()` with a
metric, which is how `gymRatingService.performanceOn()` computes exactly
those days. A Gym day before the boundary and every Running day go to the
function as it is. Two things are held on every replay before anything is
printed: the candidate 10 is the replay as it stands, to the last bit, and
every candidate leaves every day before the update exactly as the old
replay has it. Once the value travels in the snapshot, the wrapper goes and
the same tables must come out (see "What was built").

**The run with the owner's own data is missing.** He has no backup with real
data (STOP 5b). The measure is the import file and the profiles below.

## 1. How "not lower than before" is measured

The owner's aim: *whoever manages one rep more every week and then more
weight, as in the import file, does not stand lower after the update than
before.*

"Before" is the same history without the marker of Stage 5b; "after"
carries the marker and the candidate. What is compared is the **Gym
rating** — the number he stands at — day by day, new minus old, with the
performance level, the target and the Boss beside it. Three readings, each
with its numbers for the long profile of section 2, the update loaded on
every one of 155 days from the sixth week to the 28th, and the 90 days
after each:

| Value | **(a) on every day**: the lowest new − old | update days with a day lower by 0.5 or more | longest stretch lower | **(b) on average** over the first 30 days, worst update day | 60 days | 90 days | **(c) where it settles**: the last 8 weeks (old 930.7) | Boss there (old 861.8) |
|---|---|---|---|---|---|---|---|---|
| 10 | −54.2 | 155 of 155 | 91 days | −37.4 | −43.1 | −43.2 | 915.1 (−15.6) | −7.8 |
| 8 | −32.8 | 155 of 155 | 91 days | −26.3 | −25.1 | −25.6 | 931.1 (+0.4) | +0.2 |
| 6 | −18.2 | 105 of 155 | 77 days | −14.4 | −10.8 | −7.6 | 949.3 (+18.6) | +9.5 |
| 5 | −10.9 | 64 of 155 | 37 days | −7.8 | −3.6 | +1.7 | 958.5 (+27.9) | +19.9 |
| 4 | −4.5 | 14 of 155 | 21 days | −1.5 | +3.2 | +10.7 | 966.9 (+36.3) | +30.0 |
| 3.5 | −1.9 | 8 of 155 | 8 days | +1.2 | +6.2 | +15.0 | 970.6 (+39.9) | +34.4 |
| **3** | **0.0** | **0 of 155** | **0** | +3.6 | +9.0 | +19.2 | 973.7 (+43.0) | +38.1 |
| 2.5 | +0.1 | 0 of 155 | 0 | +5.3 | +11.3 | +20.3 | 976.3 (+45.6) | +41.2 |
| 2 | +0.1 | 0 of 155 | 0 | +6.2 | +13.0 | +20.7 | 978.2 (+47.5) | +43.5 |

- **(c), where it settles, is met from 8 down** — and with 8 the rating is
  lower on some day after every one of the 155 updates, by up to 33 points
  and for three months at a stretch, before it gets there. That is not what
  "does not stand lower after the update" says.
- **(b), on average, has no natural horizon, and the horizon chooses the
  value**: over 30 days it is met from 3.5 down, over 60 from 4, over 90
  from 5. A reading that picks its own answer is no measure.
- **(a), on every day, is met from 3 down**: at 3 the new rating is lower on
  no day of any of the 155 updates; at 3.5 by up to 1.9 points after 8 of
  them, at 4 by up to 4.5 points after 14, for at most three weeks at a
  stretch.

**Recommended: (a), on every day from the update on.** It is what the
sentence says, it is what his check on the iPhone compares — the preview
against the live app, on whichever day he looks — and it needs no horizon.
The worry against it was the saw: by `reps × load` the performance level
peaks on the day before a weight goes up, and a curve that has to match
every peak would have to be absurdly steep. The replay does not bear the
worry out. The *rating* closes a tenth of its gap a day, so its day-by-day
comparison is not ruled by single peaks, and the strictest reading is met
by a value under which a rep is worth less than it was before the update,
not more (section 5).

**Its limit, stated and not hidden: the first five weeks of a history.**
With the update loaded in the third to the fifth week of the same profile
(21 days, both windows two to five weeks old) no candidate meets (a): 2 is
lower by up to 2.4 points, 3 by up to 14.4, 4 by up to 29.5, 10 by up to
77.8. In those weeks the old metric read three rep steps in a row as +12 %
each — a performance level of 939 on the import file's 2 November — and a
curve can follow that only by making 950 of +3 %. The aim is read for a
history of five weeks and more, which is the import file on the day it
ends and every day after it.

The other histories, by (a):

| History | 10 | 8 | 6 | 5 | 4 | 3.5 | 3 | 2.5 | 2 |
|---|---|---|---|---|---|---|---|---|---|
| Import file, update on its last day (15 Nov), that day | −3.7 | −2.7 | −1.4 | −0.5 | +0.4 | +0.9 | +1.4 | +1.8 | +2.2 |
| Import file, update on 2 Nov (three weeks in), lowest to 15 Nov | −50.6 | −39.8 | −26.2 | −22.1 | −16.5 | −12.9 | −8.6 | −4.5 | −1.6 |
| Sixteen-week profile, update on each Monday of weeks 6 to 12, lowest | −68.6 | −51.6 | −28.3 | −14.5 | −4.4 | −1.3 | +0.3 | +1.2 | +1.7 |

## 2. Which history counts as "like the import file"

The import file holds five weeks, and where a rating settles cannot be read
off five weeks. `progressionProfile()`
(`src/storage/services/fixtures/progressionProfile.ts`) is the same diary,
longer:

- **its first five weeks are the import file itself**, record for record as
  the live build exported it;
- **from the sixth week** the plan the file was typed from goes on by its
  one rule — a rep more every week, and at the top of the range the weight
  up and the reps back to the bottom — push, pull and legs on Wednesday,
  Friday and Sunday, forty weeks in all, across a turn of the year. No light
  day and no missed week: the strictest form of the training the aim names.

The plan is one module, `scripts/verify/pruefdaten-plan.mjs`, read by the
profile and by the script that types an import file into the live build
(step 6), so the file the owner loads at the STOP and the profile the curve
was measured on are one diary; `progressionProfile.test.ts` holds that for
the dates of the Stage 5b file the plan gives exactly the 194 sets that
file holds.

Under the new metric this diary's rolling window of 60 days reads +9 to
+13 % once it is nine weeks old; its muscle groups read +1 to +7 % at 30
days and +10 to +36 % at 90.

Measured beside it: the import file itself, with the update on 2 and on
15 November; the two sixteen-week profiles of Stage 5b
(`fixtures/trainingProfile.ts`), which hold a pyramid, drop sets, light
days and a light week; and, for the other side, `holdingProfile()` — the
person of the import file who makes no progress.

## 3. The candidates

The curve per candidate — the performance level of one window at a change
of +x % / −x %:

| Value | 0 % | ±2.5 % | ±3 % | ±5 % | ±10 % |
|---|---|---|---|---|---|
| 10 (today) | 500 | 586 / 414 | 602 / 398 | 667 / 333 | 800 / 200 |
| 8 | 500 | 607 / 393 | 627 / 373 | 704 / 296 | 850 / 150 |
| 6 | 500 | 641 / 359 | 667 / 333 | 760 / 240 | 910 / 90 |
| 5 | 500 | 667 / 333 | 697 / 303 | 800 / 200 | 941 / 59 |
| 4 | 500 | 704 / 296 | 739 / 261 | 850 / 150 | 970 / 30 |
| 3.5 | 500 | 729 / 271 | 766 / 234 | 879 / 121 | 981 / 19 |
| 3 | 500 | 760 / 240 | 800 / 200 | 910 / 90 | 990 / 10 |
| 2.5 | 500 | 800 / 200 | 841 / 159 | 941 / 59 | 996 / 4 |
| 2 | 500 | 850 / 150 | 889 / 111 | 970 / 30 | 999 / 1 |

Round the update — performance level and target on the day, the Gym rating
on the day and 1, 7, 14 and 30 days on, the Boss beside it, each day as it
is seen with the clock on that day — for nine histories and update days:
[`kurve/zahlen-update.md`](kurve/zahlen-update.md). Three of them, for the
value of today, the recommended one and its neighbours (in brackets: new
minus old):

| History, update | Value | Performance on the day | Target | Gym rating on the day | +7 days | +14 days | +30 days | Boss +30 |
|---|---|---|---|---|---|---|---|---|
| Import file, 15 Nov | old | 884 | 930 | 831.7 | 831.7 | (a break) | | |
| | 10 | 711 | 826 | 828.0 (−3.7) | 828.0 (−3.7) | | | |
| | 4 | 904 | 943 | 832.1 (+0.4) | 832.1 (+0.4) | | | |
| | **3** | 952 | 971 | 833.1 (+1.4) | 833.1 (+1.4) | | | |
| | 2.5 | 973 | 984 | 833.6 (+1.8) | 833.6 (+1.8) | | | |
| Long profile, 16 Nov | old | 884 | 930 | 835.0 | 860.1 | 878.7 | 907.8 | 839.8 |
| | 10 | 711 | 826 | 831.2 (−3.8) | 828.9 (−31.2) | 835.3 (−43.4) | 862.6 (−45.1) | −23.6 |
| | 4 | 904 | 943 | 835.4 (+0.4) | 856.8 (−3.4) | 876.2 (−2.6) | 909.4 (+1.7) | +0.8 |
| | **3** | 952 | 971 | 836.4 (+1.4) | 862.7 (+2.5) | 883.3 (+4.6) | 914.9 (+7.1) | +3.6 |
| | 2.5 | 973 | 984 | 836.8 (+1.8) | 865.2 (+5.0) | 886.1 (+7.4) | 916.7 (+9.0) | +4.5 |
| Sixteen weeks, Monday of week 11 | old | 667 | 800 | 837.0 | 819.3 | 796.1 | 835.5 | 772.8 |
| | 10 | 690 | 814 | 838.4 (+1.3) | 828.5 (+9.2) | 824.6 (+28.5) | 827.4 (−8.1) | −4.3 |
| | 4 | 868 | 921 | 843.6 (+6.6) | 857.0 (+37.7) | 869.8 (+73.7) | 890.5 (+55.0) | +29.8 |
| | **3** | 918 | 951 | 844.6 (+7.6) | 862.9 (+43.6) | 878.9 (+82.8) | 902.9 (+67.3) | +36.5 |
| | 2.5 | 944 | 967 | 845.1 (+8.1) | 865.7 (+46.4) | 883.1 (+87.0) | 908.6 (+73.1) | +39.6 |

The row of candidate 10 for the import file's 2 November — 611, 767, −9.6,
−41.8 after a week, −50.6 after two — is the row the Stage 5b report
printed: the harness replays that stage's numbers exactly.

**What the last block shows: the update gives to whoever the old metric
misread.** The sixteen-week profile trains with a pyramid, drop sets, a
light week and light days. By `reps × load` its rating fell on 17 of its
last 35 days; under the new metric and a curve at 6 or steeper it falls on
none, and at 4, 3 and 2.5 it stands 55, 67 and 73 points higher a month
after the update than it would have. That is the metric of Stage 5b doing
what it was changed for, made visible by the curve — not a property of one
candidate: at 10 it is +28 after a fortnight.

**A break after the update** (existing behaviour, D96 and D174, not
changed): with no session after the import file's last day the missed week
lowers the rating through attendance, and from the seventh day abstinence
decay sets it to the progress inside the tier held when the episode began.
The old rating ends at 700. At 10, 8, 6 and 5 the new rating holds the tier
below by then and ends at 560, a whole tier lower; at 4 and steeper it
holds the same tier as the old one and ends at 700. The file's rating on
its last day, 831.7, stands two points above a tier's floor, which is why
so little decides it.

## 4. The other side

The curve is symmetric: what rewards a small rise more charges a small fall
more. Four measures, all from the replay except the first table, which is
the function itself.

**As a pure curve** — both windows read the same change, attendance is
full:

| Value | target at 0 % | at −2 % (on screen "Gehalten") | at −3 % | at −5 % | span of the target between −2 % and +2 % |
|---|---|---|---|---|---|
| 10 | 700 | 659 | 639 | 600 | 83 |
| 5 | 700 | 619 | 582 | 520 | 162 |
| 4 | 700 | 600 | 557 | 490 | 200 |
| 3 | 700 | 570 | 520 | 454 | 259 |
| 2.5 | 700 | 549 | 496 | 435 | 302 |

**As a diary** — `holdingProfile()`: the sets of the import file's fifth
week, every week for forty weeks, the new metric and the candidate from the
first day; "old" is the same diary under the old metric and curve.

| Case | old | 10 | 5 | 4 | 3.5 | **3** | 2.5 | 2 |
|---|---|---|---|---|---|---|---|---|
| Staying the same: the same sets every week | 700.0 | 700.0 | 700.0 | 700.0 | 700.0 | 700.0 | 700.0 | 700.0 |
| An ordinary up and down — two weeks a rep more, two a rep less, each exercise at its own point of it: lowest to highest rating | 675–716 | 695–711 | 689–721 | 687–726 | 685–730 | 682–734 | 679–741 | 674–750 |
| A single light day (every working set at 80 %): lowest rating in the fortnight after | 636.6 | 700.0 | 700.0 | 700.0 | 700.0 | 700.0 | 700.0 | 700.0 |
| A whole light week: lowest rating in the three weeks after | 581.9 | 700.0 | 700.0 | 700.0 | 700.0 | 700.0 | 700.0 | 700.0 |
| One rep less on everything from one week on, for good (−2.4 to −2.9 % an exercise): lowest rating | 526.0 | 648.2 | 599.6 | 577.2 | 562.2 | 543.5 | 520.1 | 490.8 |
| …and twelve weeks later | 604.9 | 671.3 | 645.3 | 633.5 | 625.7 | 616.0 | 603.9 | 588.9 |

- **Staying the same is 500 and 700 under every value**: the curve's fixed
  point does not move.
- **A light day and a light week cost nothing under any value** — the
  median of Stage 5b takes them out before the curve sees them. Under the
  old metric they cost 63 and 118 points.
- **An ordinary up and down** moved the rating over 41 points before the
  update. It moves it over 16 at 10, 39 at 4, 52 at 3, 62 at 2.5 and 76 at
  2.
- **A lasting loss of one rep everywhere** cost 174 points before the
  update. It costs 52 at 10, 123 at 4, 156 at 3, 180 at 2.5 and 209 at 2.

**In the two sixteen-week profiles** the Gym rating fell on 26 and on 17
days under the old metric, by up to 25 points in a week. Under the new one
the profile that carries it from its first day falls on no day at any
value. The one that crosses into it falls on no day at 6 and steeper, on 3
days at 8 and on 15 at 10 — there the target the flat curve gives lies
below the rating the profile had reached. The single light day lowers the
performance level of that day by 14 to 21 points under every candidate,
and the light week by nothing; under the old metric the light week took 98
points off it.

**From which value an ordinary up and down moves the rating more than can
be wanted.** Measured against what the same training did before the
update: up to 4 no measure is harsher than it was. At 3 the ordinary up and
down moves the rating a quarter more than before (52 against 41 points)
and a lasting loss of a rep a tenth less (156 against 174). **From 2.5
down both are harsher than before the update**: 62 and 180 points at 2.5,
76 and 209 at 2. On the pure curve the target's span between −2 % and
+2 % — both windows at once, changes the screen calls "Gehalten" — is 83
points at 10, 200 at 4, 259 at 3 and 302 at 2.5, where a tier is 120 to 150
wide; both windows at −2 % together is the diary's last row, not an
ordinary week.

## 5. The recommendation

**3: every three points of improvement multiply the odds by four.** +3 % is
800 where +10 % was, −3 % is 200.

It is the flattest of the candidates that meets the aim in the reading
recommended — on no day of any update from the sixth week on does the
person of the import file stand lower — and it does so without making a rep
worth more than it was:

| One rep more at the same weight | old metric, curve at 10 | new metric, at 10 | at 4 | **at 3** | at 2.5 |
|---|---|---|---|---|---|
| 8 → 9 reps | +12.5 %: odds × 5.7 | +2.6 %: × 1.4 | × 2.5 | × 3.4 | × 4.3 |
| 10 → 11 reps | +10.0 %: odds × 4.0 | +2.5 %: × 1.4 | × 2.4 | × 3.2 | × 4.0 |
| 11 → 12 reps | +9.1 %: odds × 3.5 | +2.4 %: × 1.4 | × 2.3 | × 3.1 | × 3.9 |

At 3 a rep moves the odds a little less than it did before the update, at
2.5 about as much, at 4 clearly less, and at 10 hardly at all. That the
rating is nevertheless never lower at 3 is the metric's doing: the day a
weight goes up no longer reads as a fall of a sixth.

What comes with it, said plainly:

- **In the long run he stands higher than before**, not level: 974 where
  the old rules settled at 931, and the Boss 38 points higher. Level would
  be 8, which leaves him up to 33 points lower for three months first.
- **Weight is worth what reps are worth.** 2.5 kg more at 100 kg and the
  same reps is +2.5 % under either metric; the old curve made odds × 1.4 of
  it, the curve at 3 makes × 3.2. Whoever progresses by weight at fixed reps
  stands higher after the update, as the sixteen-week profile shows. That
  is the Stage 5b metric's own statement — a rep and a plate are one kind
  of step — carried through the curve.
- **The other side is about where it was**: a lasting loss of a rep costs a
  tenth less than before the update, an ordinary up and down moves the
  rating a quarter more.
- **The scale has little room at the top.** A diary of strict double
  progression reads +9 to +13 % in its windows and scores 990 of 1000;
  half that pace scores about 910. The old rules had the same diary at 850
  to 980.

**The next flatter: 4** (3.5 lies between: lower by up to 1.9 points after
8 of the 155 updates). At 4 lower than before by up to 4.5 points for at
most three weeks, after 14 of the 155 updates; on the import file's own
last day +0.4. A lasting loss of a rep costs 123 points, an ordinary up and
down moves 39. Settles 36 points above the old rules.

**The next steeper: 2.5.** Never lower, by a wider margin (+5 on average
over the first month). A rep is worth exactly what it was at ten reps. A
lasting loss of a rep costs 180 points and an ordinary up and down moves
62 — both more than before the update.

The value is the owner's to confirm at the STOP. Until then
`GYM_CURVE_CONFIRMED` is `false`.

## 6. How the snapshot carries the curve, and where the calculation reads it

**The value is a field of the marker of Stage 5b:**
`scoring.gymMetric.curveDecadePercent`.

```ts
gymMetric?: {
  id: 'bestWorkingSet';
  repsDivisor: number;
  comparison: 'median' | 'firstLast';
  /** How many percentage points of change multiply the odds by four. */
  curveDecadePercent?: number;
}
```

- **Why inside `gymMetric`, and not a field beside it.** It is the era of
  5b: the curve is set anew *because* the metric reads a week's progress as
  two or three percent, and the two were never released apart. One field
  means one boundary on every device the live build left, written by one
  step — and no snapshot can carry the new curve without the new metric,
  which a field beside it could. Everything a Gym day of the era was scored
  with — what a set is worth, how a window compares, how a change becomes a
  level — travels in one object with that day (D172 argued the same for the
  divisor and the comparison).
- **The name follows the constant it stands beside**:
  `TRAINING_RATING.CURVE_DECADE_PERCENT` is ten, the number of percentage
  points per "decade" of the odds; the odds factor per decade stays the
  constant four (`CURVE_ODDS_PER_DECADE`). One value is tuned, the one D99
  names, and the sentence stays the sentence — *every N points of
  improvement multiply the odds by four*.
- **The build's value is `GYM_METRIC.curveDecadePercent`**, written into
  every snapshot by `buildConfigSnapshot()` with the rest of the marker;
  beside it `GYM_CURVE_CONFIRMED` says whether the owner has confirmed it
  (the pattern of `GYM_COMPARISON_CONFIRMED`): `false` until STOP Kurve.
- **Two readers, one module.** `gymMetricOf()` stays what it is — the metric
  the pipeline of `performance.ts` takes, `{ repsDivisor, comparison }` —
  because the screens read it (`GymHistory.metric`) and no screen has any
  business with the curve; `stage5bImportFile.test.ts`, which this block may
  not touch, holds that shape. Beside it, in the same file
  (`core/gym/metric.ts`), `gymCurveOf()` returns the curve's value of a
  snapshot or `null`. Those two functions are the only readers of the field.
- **The curve stays one function.** `mapPerformanceChangeToScore(change,
  decadePercent?)` and `performanceScore(input, decadePercent?)` take the
  value as an argument. Without it they compute with the module's constant,
  bit for bit as today — which is every Gym day before the boundary and
  every Running day. `TRAINING_RATING.CURVE_ODDS_PER_DECADE` and
  `CURVE_DECADE_PERCENT` are not touched.
- **Where it is read:** `buildGymRating()` resolves each day's snapshot (it
  already does, for the model and the metric) and asks `gymCurveOf()` of it.
  `performanceOn(days, on, metric, curve)` hands the value to
  `performanceScore()`. The track of the replay — the exercise-days, the
  three pointers, the cache — is keyed by the metric **and** the curve's
  value, so a window computed under one curve can never be handed to a day
  of another. A history has one track before the update and two after it; a
  device that loaded a 5b preview has three. `performanceFor()` — the
  reference day, and a day outside the history — takes the track of that
  day's own snapshot, so the performance level and the target on the Gym
  screen come out of the same calculation as the rating. No screen computes
  the curve.
- **A value that cannot be read is no value.** A restored file is not
  validated: anything but a positive finite number is read as absent — the
  curve as it was — and the activation step then writes a real one. Nothing
  throws.

## 7. A marker without the curve's value

It exists in one place: a database a Stage 5b preview has loaded — the
owner's iPhone, in `momentum-preview`. The live app has never written a
marker. **A missing value is the earlier state**: the days such a snapshot
covers were lived under the new metric and the curve at ten, and replay so.

The activation step is the one of Stage 5b, `ensureGymMetricEra()`, keyed on
the data as before — now on whether the snapshot in force carries the
*whole* marker. A snapshot is in one of three states: **before** (no
`gymMetric`), **metric only** (the marker without the value), **complete**.

| Case | A device as the live build left it (*before*) | A device a 5b preview left (*metric only*) |
|---|---|---|
| First load after the update | The snapshot in force gets the whole marker, effective today — metric and curve in **one** snapshot, the same one the P8 and Food steps of that load wrote. One boundary. | The same configuration is appended effective today with the value added to the marker it has; its divisor and its comparison are carried as they were. The days since the preview's boundary keep the curve at ten. That device has two boundaries. |
| Second load, any later load | Nothing. | Nothing. |
| A snapshot dated after today | Takes the whole marker at its own date. | Takes the value at its own date. |
| No snapshot in force today | Left alone for today; its later snapshots are completed. | The same. |
| No snapshot at all | Nothing; the first snapshot is written complete. | — |
| The clock was ahead on the first load, and has been put right | The boundary was written at an instant after now and is not kept: the whole marker is appended today. | The same for the value. |
| The local date moved back across the boundary | Kept. Today was lived *before* and replays so; `ensureCurrentSnapshot()` writes such a day without the field. | Kept. Today was lived *metric only* and replays so; `ensureCurrentSnapshot()` writes such a day with the marker as that day had it — no value. |
| An old backup imported later | Its snapshots are *before*: the next load starts metric and curve together on that day. | A backup made by a 5b preview is *metric only*: the next load adds the value from that day. |
| A backup from this build imported | The boundary stays where the file has it. | The same. |
| A configuration this build does not recognise | A snapshot without a `scoring` object is left as it is. | A value that is not a positive finite number is no value: the step writes a real one. |

`ensureCurrentSnapshot()` compares the snapshot in force with the live
configuration, which carries the whole marker. After the step has run there
is nothing to write. With a kept boundary ahead of the day being written,
it carries the field **as the stored snapshot in force on that day has it**
— absent, or without the value — where today it only knew "absent". That is
one rule for both boundaries, and for a device with a single boundary it
writes exactly what it writes today.

**Why the value is not backfilled into the preview's snapshots**, although
that would leave every device with one boundary: a snapshot says what its
days were scored with, and those days were scored with the curve at ten —
on a preview, but scored. "Never backfill" has no exception for a database
that only the owner holds; importing the block's file gives him a device
with one boundary, which is what his check compares anyway.

## 8. Running

Running calls `performanceScore()` without a value and so computes with the
module's constant: the same expression on the same operands as today, on
every day. Nothing about Running is keyed, stored or branched. The curve is
still one function — one expression, one set of properties — and what Gym
has of its own is the argument.

This amends D101, which called the tunable a single constant for every
domain. The amendment, to be recorded as a decision: **the five properties
stay shared and are not negotiable per domain; the one value D99 allows to
be tuned may be a domain's own, in an era of its own, carried in that
domain's snapshot.** Gym's is `scoring.gymMetric.curveDecadePercent` from
the Stage 5b era on. Running's is the constant, ten, and would need a
decision and an era of its own to become anything else.

## 9. The tint's strength on the body

A tint starts at three tenths of its full strength where the held band ends,
at 2.5 % (D153, D167 — neither is a candidate), grows evenly and is full at
an upper end: 12 % today. Five upper ends, on the dev harness
(`#/dev/body?tintTo=<percent>&deltas=…`, `scripts/verify/kurve-tint-shots.mjs`),
measured the way `farbregeln.mjs` measures a tint
(`scripts/verify/body-tones.mjs`): the chest at a rise and the quadriceps
at the same fall, every other group held, against the figure in which all
are held — the median difference of every lit pixel of the zone.

| Full strength from | Strength at +3 / +5 / +7 / +10 % | Chest: ΔE from held (a*) at +3 / +5 / +7 / +10 % | Quadriceps at −3 / −5 / −7 / −10 % |
|---|---|---|---|
| 12 % (today) | 0.34 / 0.48 / 0.63 / 0.85 | 21.8 (−19) / 30.7 (−27) / 39.9 (−35) / 51.9 (−45) | 19.3 / 27.6 / 35.8 / 47.9 |
| 10 % | 0.35 / 0.53 / 0.72 / 1.00 | 22.2 (−20) / 33.7 (−30) / 45.0 (−39) / 58.5 (−50) | 19.7 / 30.6 / 41.0 / 55.3 |
| **8 %** | 0.36 / 0.62 / 0.87 / 1.00 | 23.6 (−21) / 38.7 (−34) / 52.8 (−46) / 58.5 (−50) | 20.5 / 35.3 / 49.1 / 55.3 |
| 7 % | 0.38 / 0.69 / 1.00 / 1.00 | 24.3 (−22) / 43.1 (−38) / 58.5 (−50) / 58.5 (−50) | 21.3 / 39.1 / 55.3 / 55.3 |
| 6 % | 0.40 / 0.80 / 1.00 / 1.00 | 25.5 (−23) / 49.1 (−43) / 58.5 (−50) / 58.5 (−50) | 22.8 / 45.1 / 55.3 / 55.3 |

The pictures, each candidate beside today's, the body from the front and
from the back:

- the import file at 30 days, groups from +2.7 to +7.1 %:
  [`kurve/farbstaerke-pruefdaten-30.png`](kurve/farbstaerke-pruefdaten-30.png);
- the import file at 90 days, +4.7 to +11.1 %:
  [`kurve/farbstaerke-pruefdaten-90.png`](kurve/farbstaerke-pruefdaten-90.png);
- the sixteen-week profile a month after its update, seven groups held and
  three at +2.8 to +4.6 %:
  [`kurve/farbstaerke-profil-16-wochen-30.png`](kurve/farbstaerke-profil-16-wochen-30.png);
- the steps alone, ±3 % beside ±7 %:
  [`kurve/farbstaerke-stufen.png`](kurve/farbstaerke-stufen.png).

The groups' changes in the pictures are the replay's
(`kurve/gruppen.json`, written by the report), none typed by hand.

**Recommended: full strength from 8 %.** Under it the import file's month
spans the scale it is shown on — its weakest group, +2.7 %, stands at 0.32
and its strongest, +7.1 %, at 0.89, where today they stand at 0.31 and
0.64 — and +7 % is more than twice as green as +3 % (a* −46 against −21),
where today it is not quite twice. +3 % stays where it was against a held
group, 23.6 ΔE for 21.8, more than four times what `farbregeln.mjs` asks.
There is still a step left between +7 % and +10 %, which 7 and 6 give up:
under them the import file's strongest groups at 90 days, +7 % and +11 %,
are one colour. 10 moves too little: +7 % at 0.72.

On the real screen the import file's body as it is today, before any
change, with the same five weeks held as the reference
(`kurve/vorher-koerper-*.png`, `kurve/vorher-koerper.json`): the chest
(+2.7 %) 20.7 ΔE from held, the back (+3.6 %) 23.1, the quadriceps (+4.7 %)
26.5, the hamstrings (+5.6 %) 30.9, the calves (+7.1 %) 36.9.

## 10. The two scales

`SPARK_SCALE` — the line of a muscle row, −12 % to +12 % with the zero line
in the middle — and `LINE_SCALE` — the line of the exercise detail, 12 % to
the edge, widened in steps of six — are scales, not strengths. They are not
changed in this block.

On today's scale, with the import file on its last day
(`kurve/vorher-zeilen-30.png`, `kurve/vorher-zeilen-90.png`,
`kurve/vorher-uebungsdetail.png`):

- **The rows at 30 days** run from +3 to +7 %. Their lines use a quarter to
  somewhat over a half of the upper half of the row's 24 pixels — three to
  seven pixels — and most of them look level. They are right, and they are
  quiet: "a small change must look small" (D163) was written when a month
  read +5 to +20 %.
- **The rows at 90 days** are at the edge already for a diary like the
  import file's continued: +10 to +36 %. The number beside the line says
  the value, as the contract has it.
- **The exercise detail** draws the bench press's month, +4 %, over a third
  of its height.

**Do they still fit beside the new strength?** With the tint full at 8 %, a
group at +7 % is nearly as green as the body gets while its line stands a
little over half way up. The two do not contradict each other — one says
how notable, the other how much — but they no longer say it on one scale,
and the rows have become harder to tell apart than the body. Going with
the tint, both scales at 8 % (the detail widening in steps of four), would
give +3 % four and a half pixels and +7 % ten and a half; at 90 days more
rows would stand at the edge than do today. The question goes to the STOP;
nothing is built for it here.

## 11. The band beside the new metric

"Gehalten" is −2 to +2 % of the shown whole number (D153): a change under
2.5 % is held. Under the strength score one rep more at the same weight is
`1 ÷ (30 + reps)`, which puts the edge of the band in the middle of the
range the owner trains in:

| One rep more | change | today | one rep less | change | today |
|---|---|---|---|---|---|
| 5 → 6 … 9 → 10 | +2.9 … +2.6 %, shown +3 % | Verbessert | 6 → 5 … 9 → 8 | −2.8 … −2.6 %, shown −3 % | Zurückgegangen |
| 10 → 11 | +2.50 %, shown +3 % | Verbessert | 10 → 9 | −2.50 %, shown −3 % | Zurückgegangen |
| 11 → 12 | +2.44 %, shown +2 % | **Gehalten** | 11 → 10 | −2.44 %, shown −2 % | Gehalten |
| 12 → 13 … 15 → 16 | +2.4 … +2.2 %, shown +2 % | Gehalten | 12 → 11 … 15 → 14 | −2.4 … −2.2 %, shown −2 % | Gehalten |

2.5 kg more at the same reps is held from 102.5 kg on the bar (shown +2 %),
and improved up to 100 kg. The day a weight goes up and the reps go back to
eight reads −1 % and "Gehalten" after ten reps at 60 kg, and −6 % and
"Zurückgegangen" after twelve — under every band, as it is a real step
down on that day. The full tables:
[`kurve/zahlen-band.md`](kurve/zahlen-band.md).

**How many figures lie in the band**, old against new (groups: the row's
figure; exercises: the last day against the one before, as the exercise
list has it; improved / held / declined):

| History | Groups, old | Groups, new | Exercises, old | Exercises, new | Exercises shown +2 % / −2 % under the new metric |
|---|---|---|---|---|---|
| Import file, 15 Nov, 30 days | 8 / 1 / 1 | 10 / 0 / 0 | 9 / 3 / 0 | 7 / 5 / 0 | 3 / 0 |
| Import file, 90 days | 10 / 0 / 0 | 10 / 0 / 0 | | | |
| Crossing profile, 17 June, 30 days | 5 / 4 / 1 | 3 / 7 / 0 | 2 / 10 / 3 | 3 / 9 / 3 | 1 / 0 |
| Crossing profile, 90 days | 6 / 2 / 2 | 7 / 3 / 0 | | | |
| From day one, 13 June, 30 days | 6 / 4 / 0 | 2 / 8 / 0 | 5 / 8 / 2 | 4 / 9 / 2 | 2 / 0 |
| From day one, 90 days | 7 / 2 / 1 | 7 / 3 / 0 | | | |
| Long profile, 28 Feb, 30 days | 7 / 3 / 0 | 7 / 3 / 0 | 6 / 2 / 4 | 5 / 7 / 0 | 3 / 1 |

Under the new metric more is held than before, and in the diary of strict
double progression seven of twelve exercises read "Gehalten" on their last
day although each of them did a rep more or went up in weight.

**The owner's aim (at the start of this block): one rep more at the same
weight is to appear as progress, always, up to twelve reps.** The step from
eleven to twelve is +2.44 % and the one from twelve to thirteen +2.38 %.
The state follows the shown whole number so that figure and colour cannot
part (contract §7), so no edge between the two can be drawn; the aim is
met by letting a shown **+2 %** count as improved. Two ways, and what each
means for small falls:

| | Held | One rep more | One rep less | 2.5 kg less at 110 kg and above | The reset day after ten reps at 80 kg (−2.0 %) |
|---|---|---|---|---|---|
| Today | −2 … +2 | progress up to 10 → 11; from 11 → 12 held | a fall from ten reps and fewer; from 11 → 10 held | held | held |
| **A** — symmetric | −1 … +1 | always progress | **always a fall**, red | a fall | a fall |
| **B** — one-sided | −2 … +1 | always progress | as today | as today | as today |

Counted on the same histories: A and B colour the same extra rises — three
of twelve exercises in the import file and in the long profile, two groups
of the sixteen-week profile "from day one" at 30 days. A alone also turns
every shown −2 % red: one exercise in the long profile here, and in a diary
with an ordinary up and down every week in which a rep was missed.

- **A** keeps the band's symmetry: what counts upwards counts downwards. Its
  price is that a single missed rep is "Zurückgegangen" at any rep count,
  which is the twitchiness the band was introduced against (D153).
- **B** does what the aim asks and nothing else: a rise shows from +2 %, a
  fall from −3 % as today. Its price is the asymmetry — "+2 %" is green and
  "−2 %" is not — which has to be said in the legend.

Either would move the start of the tint with it (a shown +2 % begins at
1.5 %), which is `TINT_STRENGTH.fromPercent` and the sentence in contract
§7. The band is not changed in this block; the question goes to the STOP
with these numbers, and what he chooses is built after it.

## Read as an adversary

**Where could a day before the boundary move anyway?**

1. *The constants.* `CURVE_ODDS_PER_DECADE` and `CURVE_DECADE_PERCENT` are
   not edited, and the module's `K` stays what the function uses when no
   value is handed in. Held by every frozen baseline and fingerprint,
   unchanged.
2. *The new argument defaulting wrongly.* A caller that passes nothing must
   compute the same expression on the same operands. A test compares bit
   for bit, and a snapshot that names ten computes what one without the
   value does.
3. *`GYM_METRIC` gaining a field, and a hand-written profile picking it
   up.* The fixture profiles of `profiles.ts` and `randomGym.ts` write
   their snapshots by hand and carry no marker. `trainingProfile.ts` spreads
   `GYM_METRIC` into the snapshot of its era — those are the two Stage 5b
   profiles, whose fourteen files with days of the era are frozen again
   (step 4); the two files of the day before the boundary hold no such day
   and may not change by a byte.
4. *The rating's cache shared between two curves.* The track is keyed by
   metric and curve; a day before the boundary has neither and reads the
   track it always read.
5. *The activation step now acting on a snapshot that already has a
   marker.* It appends the snapshot in force **effective today**, and
   completes snapshots dated after today; it never rewrites a snapshot
   dated in the past. On the one device with such snapshots the days
   between the two boundaries keep the curve at ten.
6. *A write on a day before a kept boundary* appending the live
   configuration, value included. `ensureCurrentSnapshot()` carries the
   field as that day had it (section 7).
7. *The 5b report's own numbers.* Its "new" replay is the era as that stage
   built it — the marker without the value — so regenerating it must give
   the committed files of Stage 5b byte for byte. It is pinned so, and
   checked.
8. *What stays open, unchanged in shape:* a snapshot dated between today
   and a kept boundary takes the marker in the loop over later snapshots —
   the known edge of all three load steps (HANDOVER, "Risks"), block 9's.
   This block adds no new step and no new instance of the loop.

**Where could Running move?**

1. *Through the shared function.* It gains an optional argument; Running
   passes none. `runningRatingService.ts` is not edited.
2. *Through the constant.* Not edited.
3. *Through the Boss.* Running's own rating, series and ladder position are
   its own; what moves in the Boss from the boundary on is Gym's movement.
   A test replays one history with runs and Gym sets three ways — without
   the era, with the marker only, with the whole marker — and compares
   every field of the Running state on every day.

**Where is a number that is not from the real replay?**

- The curve table (section 3) and the table "as a pure curve" (section 4)
  are the function itself, the second with the target of a full week
  (`400 + 0.6 × level`); they are marked as such.
- "Odds × …" in section 5 is `4^(change ÷ value)`, arithmetic on the
  changes the metric gives for the named sets.
- The step table of the band is arithmetic through the app's own rounding
  (`roundShown`).
- The strengths of the tint are the formula of `stateIntensity()`; the ΔE
  beside them are measured on the dev harness, and the real screen is
  measured once the value is built (step 5).
- Everything else is the replay. The candidates reached it through a
  wrapper (above), which the built mechanism has to reproduce.
- **Not measured at all: the owner's own data.** There is none.
