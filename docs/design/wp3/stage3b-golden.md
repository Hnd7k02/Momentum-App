# WP3 Stage 3b — the P8 golden files, re-frozen

The two P8 profiles in `.github/fixtures/wp3-golden/p8-*.boss.json` were frozen
before any Stage 3b code (STOP 3a, question 7) as the replay under the rules
before P8. At STOP 3b they are re-frozen under the P8 rules. This is the record
of what moved and why; nothing else in the golden baseline moved — the six
original files, `.github/fixtures/stage2/` and every `domainOutputs`
fingerprint are byte-identical.

**Every moved value lies on a day of the P8 era**: from 2026-07-27 in the
crossing profile, from 2026-06-08 in the confirmation profile. Earliest moved
day per file below; "values" counts every number and string in the file that
differs.

| File (clock) | Values | Earliest day | What moved, and the rule |
|---|---|---|---|
| crossing 2026-08-06 | 76 | 08-03 | 08-03, unanswered, is three days old: closed under the one-day window (D132), open under the three-day one. Boss 5.5558 → 5.5468; Running 785.88 → 787.42. Gym 08-05 and 08-06 carried, not decayed (D135). |
| crossing 2026-08-10 | 68 | 08-03 | A Monday: week 32 is still in progress until Monday midnight (D134), so it is not judged yet — XP 4665 → 4605 (Running's week bonus waits), Gym Endurance 5.5 → 6 (its missed week waits), Running Endurance 10 → 9 (its met week waits). Gym's day 14 of the break is today: 25 % charged, the second block pending — `decayPending: {day: today, days: 14}`; Gym rating 745.15 → 767.73. Boss 5.5248 → 5.5769. |
| crossing 2026-08-14 | 66 | 08-12 | 08-12, unanswered, closes at two days old. Boss 5.6279 → 5.6223; Running 797.65 → 799.28. |
| crossing 2026-08-29 | 56 | 08-24 | The first week back has one session of three and is still in progress: its days count attendance as met (D134). Gym 703.62 → 733.67; Boss 5.5468 → 5.6162. |
| crossing 2026-10-04 | 93 | 09-28 | A Sunday in the run break: the empty running week in progress is no data (D134), and day 7 of the break is yesterday, carried — Running held at 846.68 instead of 700, decay 0.2 → 0, `decayPending: {day: yesterday, days: 7}`. Boss 5.6176 → 5.8454. |
| confirmation 2026-06-14 | 12 | — | Pending confirmation only: contender 6/7 → 0/7. Under D136 a day with a weekly target counts once its week is judged, and this week is still in progress. |
| confirmation 2026-06-22 | 122 | 06-19 | A Monday: week 25 not judged yet — XP 1570 → 1450, Gym and Running Endurance 3 → 2; the week's days at the target (D134), Gym 751.09 → 777.75, Running 692.19 → 694.10. Pending elite 6/7 → 0/7. |
| confirmation 2026-06-29 | 131 | 06-22 | A Monday again: XP 1995 → 1935, Gym Endurance 2.5 → 3, Running 4 → 3; Gym 676.52 → 787.33. Pending veteran 6/7 → 0/7. |
| confirmation 2026-07-10 | 101 | 07-07 | A Friday: the week's days at the target; Gym 787.14 → 795.88, Running 728.84 → 730.46. Pending master 6/7 → 3/7. |
| confirmation 2026-08-29 | 0 | — | Identical: every promotion lands on the same date as before — later in replay time, never earlier, and none disappears. |

Values were compared with the frozen files field by field; the moved paths are
the Boss points, each domain's series, the history rows, the Gym and Running
rating states (attendance, abstinence, decay, Endurance), XP, and the pending
and persisted confirmation state. No rank change moved in either profile.
