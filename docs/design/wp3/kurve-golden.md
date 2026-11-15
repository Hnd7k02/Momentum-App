# WP3 block "Kurve" — the Stage 5b golden files, re-frozen

The two Stage 5b profiles in `.github/fixtures/wp3-golden/stage5b-*` were
frozen at STOP 5b under the Stage 5b metric and the curve of the constants.
Their marker now names the curve's value (D177), so the files that hold days
of the era are frozen once more. They were never published: the live app has
never written a marker. This is the record of what moved and why. Nothing
else under `.github/fixtures/` moved — every other golden file, the
baselines under `stage2/`, `stage4/` and `stage5b/`, and every
`domainOutputs` fingerprint are byte-identical.

The proof is a script, and it fails on any violation:

```
node scripts/verify/kurve-golden-diff.mjs          # 78a22ef, the commit before the block, against 6f37680, the re-freeze
```

It holds four things.

1. **Under `.github/fixtures` only `stage5b-*` golden files differ**, and
   of those not the two of 2026-05-17, which hold no day of the era. Seven
   files moved, all of them `*.boss.json`.
2. **All eight `*.gym.json` are byte for byte what they were**: the
   exercise-days, the percentage changes, the muscle groups and their
   states, at 7, 30 and 90 days. What a Gym screen shows of the sets does
   not know the curve.
3. **Every value that moved depends on the performance level.** The fields,
   and no others: per day, Gym's level, its target, its rating and the
   share of the gap it closed (`gym.detail[].performance`, `.target`,
   `.rating`, `.movement`, `gym.points[].rating`); today's level and
   rating and the peak (`gym.performance.*`, `gym.rating`, `gym.peak`);
   Gym's ledger on the shared ladder (`series`, `momentum`,
   `peakMomentum`, `progress` — and of no other domain); the Boss
   (`outputs.points`, `outputs.progress`); and the date of one promotion.
   The two windows and their percentage changes, attendance, Endurance,
   abstinence and decay, the history rows, lifetime XP, the other domains
   and the pending and persisted confirmation state are the same.
4. **In the profile "crossing the metric" no value of a day before the
   boundary moved**, in any file: the earliest day with a different value
   is the boundary itself, 2026-05-18.

| File (clock) | Values | Earliest day | Days with another level | Level today | Gym rating today | Boss today | Rank change |
|---|---|---|---|---|---|---|---|
| crossing 2026-05-17 | 0 | – | 0 | identical | identical | identical | – |
| crossing 2026-05-18 | 18 | 2026-05-18 | 1 | 690 → 918 | 838.4 → 844.6 | 5.5428 → 5.5688 | none |
| crossing 2026-05-19 | 27 | 2026-05-18 | 2 | 690 → 918 | 835.9 → 847.9 | 5.5532 → 5.6032 | none |
| crossing 2026-05-25 | 83 | 2026-05-18 | 8 | 709 → 938 | 828.5 → 862.9 | 5.5210 → 5.6639 | none |
| crossing 2026-06-17 | 290 | 2026-05-18 | 31 | 715 → 919 | 827.4 → 902.9 | 5.5269 → 5.8405 | none |
| from day one 2026-05-10 | 578 | 2026-03-09 | 63 | 689 → 929 | 783.9 → 885.1 | 5.3193 → 5.7264 | master 2026-04-16 → 2026-04-08 |
| from day one 2026-06-13 | 884 | 2026-03-09 | 97 | 710 → 917 | 815.9 → 921.0 | 5.5341 → 5.9676 | master 2026-04-16 → 2026-04-08 |
| from day one 2026-06-21 | 956 | 2026-03-09 | 105 | 720 → 920 | 820.0 → 924.9 | 5.5327 → 5.9667 | master 2026-04-16 → 2026-04-08 |

"Values" counts every number and string in the file that differs. "Level"
is the performance level of the day the replay ends on; the Boss is its
position on the 0–8 ladder.

**The one rank change.** The profile under the metric from day one is a
device set up under this version: its whole history is the era, so its
first level, on 2026-03-09, is already read by the new curve. Its Gym
rating stands about a hundred points higher throughout, the Boss reaches
the next threshold sooner, and the promotion to master is confirmed on
2026-04-08 instead of 2026-04-16 — the same seven-day confirmation (D126),
eight days earlier. No rank is gained or lost: the rank and the peak rank
of every file are what they were. In the crossing profile no rank change
moved.

**Why the levels rise by two hundred points.** These profiles are sixteen
weeks of steady progress — double progression, a pyramid, drop sets — whose
two windows read +3.7 to +10.7 % under the Stage 5b metric on the seven
clocks. The curve of the constants called that 624 to 815 (a window's
score, as the files hold it); the curve at three calls it 843 to 993. That
is the block's purpose, and `docs/design/wp3/kurve.md` weighs it against
what the same value does to someone who is not improving.

## After STOP Kurve — the state column, once

At STOP Kurve the owner made the held band one-sided (D180): a rise counts
from a shown +2 % where it counted from +3 %. The band decides one thing
in a golden file — the **shown state** of a muscle group, the seventh
element of its tuple in a `*.gym.json`, which the golden test takes from
the same function the screen does (`gymOutputsOf()`; D164 had foreseen
that a change to the colour rules may move this column and no other). The
files were frozen once more, in a commit of their own, and a second script
holds what moved:

```
node scripts/verify/band-golden-diff.mjs           # 1752245, the commit before the band, against 1a769ed, the re-freeze
```

1. **Under `.github/fixtures` only `*.gym.json` golden files differ.**
   Every `*.boss.json` — every rating, every Boss point — is byte for byte
   what it was: the band is presentation and reaches no score. The six
   fingerprints of `domainOutputs.test.ts` are unchanged.
2. **Every value that moved is the state of a muscle group**, it went from
   "unchanged" to "improved", and the figure that group prints is +2 %.
3. **Nothing was left behind**: in all eleven golden Gym files, moved or
   not, each rated group's state is the one-sided band's reading of the
   figure it prints — 358 groups, 24 of them at +2 %.

Seven files moved, the seven Stage 5b files with days of the era; the
three older profiles and the file of the day before the boundary hold no
rated group at +2 %.

| File (clock) | Range | Window | Group | Change | Shown | State |
|---|---|---|---|---|---|---|
| crossing 2026-05-18 | 30 days | overall | chest | +1.70 % | +2 % | unchanged → improved |
| crossing 2026-05-18 | 30 days | overall | back | +1.59 % | +2 % | unchanged → improved |
| crossing 2026-05-19 | 30 days | overall | chest | +1.70 % | +2 % | unchanged → improved |
| crossing 2026-05-19 | 30 days | overall | back | +2.05 % | +2 % | unchanged → improved |
| crossing 2026-05-25 | 30 days | recent | core | +2.39 % | +2 % | unchanged → improved |
| crossing 2026-05-25 | 30 days | overall | chest | +1.71 % | +2 % | unchanged → improved |
| crossing 2026-05-25 | 90 days | recent | core | +2.39 % | +2 % | unchanged → improved |
| crossing 2026-05-25 | 90 days | overall | hamstringsGlutes | +2.22 % | +2 % | unchanged → improved |
| crossing 2026-06-17 | 30 days | recent | core | +2.23 % | +2 % | unchanged → improved |
| crossing 2026-06-17 | 30 days | recent | quadriceps | +2.26 % | +2 % | unchanged → improved |
| crossing 2026-06-17 | 90 days | recent | core | +2.23 % | +2 % | unchanged → improved |
| crossing 2026-06-17 | 90 days | recent | quadriceps | +2.26 % | +2 % | unchanged → improved |
| from day one 2026-05-10 | 30 days | overall | back | +1.74 % | +2 % | unchanged → improved |
| from day one 2026-05-10 | 30 days | overall | triceps | +1.76 % | +2 % | unchanged → improved |
| from day one 2026-05-10 | 90 days | overall | hamstringsGlutes | +1.81 % | +2 % | unchanged → improved |
| from day one 2026-06-13 | 30 days | recent | core | +2.23 % | +2 % | unchanged → improved |
| from day one 2026-06-13 | 30 days | recent | quadriceps | +2.26 % | +2 % | unchanged → improved |
| from day one 2026-06-13 | 30 days | overall | chest | +2.47 % | +2 % | unchanged → improved |
| from day one 2026-06-13 | 30 days | overall | triceps | +1.72 % | +2 % | unchanged → improved |
| from day one 2026-06-13 | 90 days | recent | core | +2.23 % | +2 % | unchanged → improved |
| from day one 2026-06-13 | 90 days | recent | quadriceps | +2.26 % | +2 % | unchanged → improved |
| from day one 2026-06-13 | 90 days | overall | hamstringsGlutes | +2.26 % | +2 % | unchanged → improved |
| from day one 2026-06-21 | 90 days | overall | shoulders | +1.53 % | +2 % | unchanged → improved |
| from day one 2026-06-21 | 90 days | overall | hamstringsGlutes | +2.11 % | +2 % | unchanged → improved |

"Recent" and "overall" are the two windows a golden Gym file freezes for
each of its ranges of 7, 30 and 90 days.
