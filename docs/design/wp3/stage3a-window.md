# WP3 Stage 3a — the edit window as a scoring input (gate before code)

P8: backfill at most one day back — today and yesterday — for the check-in,
Gym sessions and runs. This note is the gate the brief asks for before any
production code: which baseline values move, why, and whether the window is
an era or one constant. Line numbers are at `464aafb`.

## 1. Where the window reaches scoring today

One function decides a day's lifecycle: `dayEditState(day, today, W)` —
future, open while `age ≤ W`, closed after (`core/dates/editWindow.ts:16-25`),
`W = EDIT_WINDOW_DAYS = 3` (`core/config/constants.ts:11`). Scoring calls it
once per day with the default (`historyService.ts:295`). `editWindowDays` is
written into every snapshot (`core/config/snapshot.ts:82`, 3 since the first
commit, in both RC2 fixtures and `profiles.ts:153`) and read by nothing.

A second, separate clock decides weeks: a week is in progress while its
Sunday ≥ today (`historyService.ts:278` per day, `:375` per week).

| Mechanism | What decides "charged" today | File |
|---|---|---|
| Day status | open = not closed **and** a daily item (Wellbeing, Food) missing; a complete day is scored at once; a weekly-only day is never open | `dayScore.ts:280, 360-373, 380-391` |
| Weekly score | in-progress week with 0 sessions = no data; else sessions/target | `dayScore.ts:251-255` |
| Rating folds (Wellbeing, Food, legacy) | skip every non-scored day; a scored silent day takes cooling-off and resets the streak | `rating/index.ts:176-230` |
| Domain ledgers | inherit the whole day's status (D111); recorded = items answered (sessions in the week for Gym/Running) | `bossService.ts:159-201` |
| Check-in streak, day XP | scored days only | `ratingService.ts:116-122, 142-147` |
| Training streak, week XP, Endurance | `weeks[].inProgress` | `streaks/index.ts:62-74`, `xp.ts:39-51`, `endurance.ts:91-119` |
| Training fold | a day counts when scored; attendance = the **whole week's** count | `gymRatingService.ts:295-300`, `runningRatingService.ts:286-291`, `trainingRating.ts:346` |
| Abstinence | every silent day counts, **today included**; decay is judged before the day's status | `gymRatingService.ts:251-267`, `runningRatingService.ts:243-259`, `trainingRating.ts:313-330` |
| D126 confirmation | eligible = before today, scored, unpaused | `ranks/confirmation.ts:124-126` |
| D126 demotion | counts every point, today and carried points included (the comment at `constants.ts:123` says "scored days") | `ranks/index.ts:131-155` |
| Writes | check-ins/Food: the same 3-day window; sessions, sets, runs, bodyweight: same ISO week | `checkInService.ts:183-186, 430-435`, `gymService.ts:217-219` |

Today the two clocks happen to line up with the two write rules: a check-in
day closes when its writes stop, and a week is charged at Monday 00:00, when
its sessions stop. P8 breaks the second alignment — a Sunday session becomes
writable on Monday — and narrows the first.

## 2. What moves (measured, five analysts and a prototype, each in a scratch copy)

| Variant | wp3-golden | stage2 | Other pinned tests |
|---|---|---|---|
| Day window 1 as a constant | 0 values | 0 values | 7 RC2 continuity values at clock 2026-09-01 (legacy 732.534291 → 731.203909, Boss 5.25026 → 5.24003, XP 4640 → 4645, check-in streak 5/5 → 1/4) — `coolingOff`, `migration`, `backupCompat`, `bossContinuity` ×3, `scoringModel` |
| + week charged at Sunday + 1, every domain | synthetic RC2 `lifetimeXp` 4640 → 4580, md5 `31b13585…` → `e2ed5f6e…` | rc2-synthetic: `lifetimeXp` ×2, `weeks[16].inProgress` | 3 Endurance tests on Monday clocks |
| + week rule for Gym/Running weeks only | 0 | 0 | the same 3 Endurance tests |
| Abstinence on closed days, carried while open | 0 | 0 | 2 "decays at seven" tests (timing) |
| D126 eligibility on closed days | 0 (no fixture activates D126) | 0 | 5 promotionConfirmation tests (timing) |
| **Era design E (below)** | **0** | **0** | **the 7 RC2 pins stay green**; 24 tests pin the old window, the same-week rule or the old timing |

Why nothing moves at the pinned clocks: the days aged 2–3 are complete in
every profile, and only an *incomplete* day's status depends on the window.

On the update day itself, at the same clock, the prototype measured:

- **Constant**, four-domain profile, update 2026-08-23: 08-21 (unanswered,
  age 2) closes at once — check-in streak 10 → 2, Boss 809.62 → 806.64. On
  a Monday update XP drops by 60 per met domain for a day (5745 → 5625); a
  Gym-only abstinence case shows rank master → champion for one day.
- **Era**: no day before the update moves, in any scenario, at any clock.

## 3. Midnight drops that a P8 backfill would reverse

With yesterday writable and nothing else changed, these drop at 00:00 and
come back after a legal backfill (all reproduced):

1. Week closed at Monday 00:00 while Sunday is writable — training streak
   (2 → 0 → 3), Endurance (2 → 1.5 → 3), XP week bonus, an empty week's days
   turning into scored zeros (Gym 529.03 → 426.27 → 502.68).
2. Abstinence decay on the 7th silent day while it is still open
   (790.30 → 767.73 → 762.63).
3. D126: yesterday eligible at 00:00 while still writable (count 5 → 0 → 6).
4. **Attendance in a week that already has a session**: every new day enters
   the fold at the running count (572.34 → 548.44 → 636.26). Not solved by
   any window rule.
5. **The demotion counter**: it advances on today and carried points, so a
   demotion can fire at 00:00 and vanish after a backfill.

Already safe once each day's scoring window ≥ its write window: the check-in
streak, cooling-off, day XP and the Wellbeing/Food ledgers.

## 4. Era or constant — proposal: an era

**Design E**, prototyped and measured:

- **Day closure** reads the day's own snapshot: `editWindowDays`, with a
  frozen legacy 3 when absent (never `dayEditState`'s default parameter,
  which becomes 1).
- **One new optional snapshot field**, `scoring.sessionWindowDays` — absent
  means the pre-P8 era. P8 snapshots carry 1. It governs, per era: the week
  closes at Sunday + 1 (read from the snapshot in force on the week's
  **Monday**; reading it from Sunday moves pre-update values), abstinence is
  charged only on closed days (an open day of an episode is carried: no
  decay, no gap step), D126 counts only closed days, and an empty week still
  in progress is no data for Gym/Running.
- **The P8 snapshot is appended on the first load after the update**, by its
  own ensure step (only when a snapshot log exists; the latest snapshot plus
  the P8 fields, effective that day). A lazy append on the first write does
  not work: the write guard runs first and would refuse a backfill.
- **One write rule**: writable = today or yesterday, **and** the day belongs
  to the P8 era, **and** for sessions, sets, runs and bodyweight its week
  does (or is the current ISO week). So every write lands on a day and in a
  week that are still open.

Why an era: it is the only design that keeps the working agreement — days
before a scoring change replay byte-identical — and it moves nothing on the
update day. It also wires `editWindowDays`, which is today a field written
and read by nothing. The costs are one-time: on the update day yesterday is
read-only; a week that straddles the update cannot take its Sunday session
on the following Monday; for up to two days, pre-update days aged 2–3 show as
open while already read-only.

Why not a constant: simpler code, but it changes values already shown on
the update day (above), fails the golden and stage2 gates on the synthetic
RC2 history, and re-freezes 7 continuity pins.

## 5. Not solved by either design (product decisions)

- Attendance in a partly filled week still in progress (path 4).
- D126 eligibility when attendance can still change a closed day.
- The demotion counter (path 5).
- Recorded, not to fix in passing: a fresh profile whose day 0 is silent
  keeps its Boss opening at 0 for good (P8 shortens the rescue time from
  three days to one); the Wellbeing ledger folds `entry.score` (the score
  over items due) where CLAUDE.md says the rating tracks `recordedScore`.
