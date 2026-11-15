# Stage 5b — the engine before the stage, frozen

Eight files, written by `src/storage/services/stage5bLegacy.test.ts` from
the replay **as it stood before any production code of WP3 Stage 5b**
(commit `9dfb658`, on top of `2c41169`). They are half of the second proof
that the stage moved no earlier day (D150, D172): four seeded Gym histories
(`src/storage/services/fixtures/randomGym.ts`, seeds 11, 29, 47 and 83, the
last two in the P8 era) with several sets per exercise and day, changing
reps, light sets round the heavy ones, a bodyweight and an assisted
exercise, a break and a turn of the year — each replayed at two clocks.

What is frozen is everything the metric reaches: the Boss series, Gym's
ladder series, the whole Gym rating state down to every day's attendance,
performance, target and movement, and the Gym history the screens read at
7, 30 and 90 days. The comparison is **exact**, not rounded: these files are
what would notice a sum added in another order.

**Never regenerate them from a later commit.** None of these histories
carries the new metric, so none of their values may ever move, and a file
written by the code under test proves nothing about it.
`UPDATE_STAGE5B_LEGACY=1 npx vitest run stage5bLegacy` exists for the one
case in which the generator itself has to change, and then the files are
written from a checkout of the commit before the stage.

The sixteen golden files of the stage's own profiles are in
[`../wp3-golden/`](../wp3-golden/) — `stage5b-crossing-the-metric-*` and
`stage5b-under-the-metric-from-day-one-*` — rounded as every file there is
and compared by `domainOutputs.test.ts`.

This note is a file of its own, and the folder's `README.md` is unchanged,
because the stage's acceptance holds that
`git diff 16c520c -- .github/fixtures` shows additions only.
