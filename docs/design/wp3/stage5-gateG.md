# Gate G — the Gym metric (WP3 Stage 5a, P10)

Before any production code: what changes if an exercise-day is scored by
all of its sets rather than by its best one. Three variants, one purpose-built
history, the real pipeline.

## What the metric is, and what it is not

`core/gym/performance.ts` reduces one exercise on one day to **one number**,
today `bestSet` = `max(reps × load)`. Everything after that number is shared
and unchanged by the choice: the comparison with the exercise's previous
recorded day (a ratio), the muscle-group value (a weighted mean of ratios,
70 % primaries, 30 % secondaries), the equal-weighted Gym ratio, the
60-day trend and year-to-date spans, the performance curve (0 % → 500,
+10 % → 800, −10 % → 200) and the 40 / 60 rating target. So the three
variants were run by swapping that one reducer and leaving the rest alone:

| | exercise-day score |
|---|---|
| a | best set: `max(reps × load)` — as today (D84) |
| b | mean set score: `Σ(reps × load) ÷ sets` |
| c | total volume: `Σ(reps × load)` |

Bodyweight and assisted sets resolve their load per set through
`core/gym/load.ts` under every variant (the bodyweight in force on the
set's own date). A set with no load is dropped, never scored.

## The histories

The fixture profiles cannot tell the variants apart: the synthetic profile
logs **one set per exercise and day**, and the two RC2 fixtures carry no
Gym sets at all. So a purpose-built history was used, as the brief asks:
eight weeks, Monday and Thursday, three exercises —

- bench press and squat, three working sets of five, the load rising 2.5 kg
  a week;
- pull-ups, bodyweight, three sets of eight, bodyweight 80 kg then 78 kg
  from week five, +5 kg added from week five.

On one day in week six (the Thursday) one of four things happens to the
bench press, and the day is compared with the plain Monday before it and
with the plain Monday after it:

| case | the bench press that day |
|---|---|
| warm-up sets | two light warm-ups (10 × 20, 5 × 40) before the three working sets |
| one extra set | a fourth working set at the same load |
| drop set | the three working sets, then 10 × 50 and 12 × 40 |
| shortened workout | one working set instead of three (squat and pull-ups too) |

## What each variant does

The exercise-day comparison (bench press, kg-reps; "next" is the plain
Monday after the case day, compared against the case day):

| case | variant | case day vs the day before | next day vs the case day |
|---|---|---|---|
| plain | a, b, c | 0 %, unchanged | +3.3 %, improved |
| warm-up sets | a best | 0 %, unchanged | +3.3 % |
| | b mean | **−18.7 %, declined** | +27.1 % |
| | c total | **+35.6 %, improved** | −23.8 %, declined |
| one extra set | a best | 0 % | +3.3 % |
| | b mean | 0 % | +3.3 % |
| | c total | **+33.3 %** | −22.5 %, declined |
| drop set | a best | **+33.3 %** (the 10 × 50 set is the day's best) | −22.5 % |
| | b mean | +12.3 % | −8.0 % |
| | c total | **+87.1 %** | −44.8 % |
| shortened | a best | 0 % | +3.3 % |
| | b mean | 0 % | +3.3 % |
| | c total | **−66.7 %, declined** | +210 % |

What that does to the chest group's 30-day figure and to the performance
component of the rating (0–1000, the 60 % part of the target) on the case
day — the plain history stands at chest +15 %, Gym +11 %, score 917:

| case | a best | b mean | c total |
|---|---|---|---|
| warm-up sets | chest +15 %, score 917 | chest −6 %, score 767 | chest +56 %, score 991 |
| one extra set | +15 %, 917 | +15 %, 917 | +54 %, 990 |
| drop set | +54 %, 990 | +30 %, 961 | +116 %, 1000 |
| shortened | +15 %, 917 | +15 %, 917 | −62 %, 0 |

Every case is undone on the next plain day, by the same amount in the
other direction: the metric compares day with day, so a one-day artefact
is a one-day swing, up on the day and down on the next. The rating follows
with its own movement rule, so it feels less of it, but the direction and
the muscle-group figures are what the user sees.

The bodyweight exercise behaves the same under all three: 8 × 80 kg =
640 kg-reps until week five, then 8 × (78 + 5) = 664 on the Monday the
weight entry and the added load both start, +3.75 %, read per set from the
bodyweight in force on that date.

## Reading

- **Total volume (c)** rewards doing more sets and punishes doing fewer,
  whatever the sets were. Two warm-ups are +36 %; a short day is −67 % and
  drags the Gym rating's performance component to 0 for that window. It
  measures work done, which is attendance by another name, and attendance
  already has its 40 %.
- **Mean set score (b)** punishes warm-ups (−19 %) and rewards leaving them
  out; it is the only variant where logging a lighter set honestly makes
  the day worse. The brief's "logging partial progress must not cost more
  than staying silent" is the Mind rule, but the instinct is the same.
- **Best set (a)** ignores how many sets there were and what the lighter
  ones were. Its one artefact is the drop set: a 10 × 50 after a 5 × 75 is
  the day's best at 500 against 375, +33 %, because a high-rep light set
  can outscore a low-rep heavy one in kg-reps. That is a property of
  `reps × load` as the set score, not of taking the maximum, and it is
  there today.

**Recommendation: keep the best set (a).** It is the only one of the three
that does not change when the user warms up, adds a set or cuts a workout
short — the things P10 was worried about are exactly the things it is
indifferent to. What P10 is actually after, "read all sets of a workout",
would need a different set score before a different reduction: an
estimated one-rep max per set (Epley, `load × (1 + reps / 30)`) stops a
light high-rep set beating a heavy one, and *then* the best set of the day
is the best set of the day. That is a separate question, and it moves
every exercise's history, so it would be its own era.

If P10 stands as written, mean (b) over the **working sets only** would be
the least bad reading of "all sets", with a warm-up rule (a set below 60 %
of the day's heaviest load is a warm-up and not counted) — but that rule is
a table of branches of the kind `core/scoring` was built to avoid, and the
drop set still moves it +12 %.

## The deterministic set order

HANDOVER records that the Gym replay is not bit-deterministic across record
ids: within one day the exercises are summed in the order the `by_date`
index returns them, which is id order, and floating-point addition is not
associative. The brief asks whether this era should fix the order, and what
it re-pins.

Measured, by sorting a day's exercise-days by exercise id before the muscle
sums and re-freezing every golden file into a scratch folder:

- every Boss golden file, all three profiles and every P8 and Food-off
  clock: **byte-identical**;
- the Gym golden files of the two RC2 fixtures: byte-identical (no sets);
- the Gym golden file of the synthetic profile: **the rows of its `days`
  list change order and nothing else** — every value in it is the same to
  the ninth decimal, which is how the golden files are written.

So fixing the order re-pins one Gym golden file by row order, moves no
value, and makes two devices with the same sets under different ids replay
to the same bits. The last-ULP differences HANDOVER measured (up to
1.5 × 10⁻¹² of a 0–1000 score) sit below the golden rounding either way.

Old and new, as asked: the synthetic profile's Gym fingerprint (the md5
over the three windows) is `58662df205f6d7bb5af3075d040bb0c6` today; under
the deterministic order it would be the md5 of the same values in the new
row order, re-pinned when the change lands, with the Boss fingerprint
`4a3145503723d3fec9761ec62ca8669a` unchanged.

## How this was produced

`core/gym/performance.ts` (comparison, muscle groups, windows),
`core/gym/load.ts` (bodyweight per set), `core/scoring/performanceCurve.ts`
and `gymRatingService.performanceOn` (the 60-day trend and year-to-date
spans, the curve), run from a probe test that replaced `bestSet` with each
reducer and wrote the tables above; the probe lives in the session
scratchpad and is not part of the tree.
