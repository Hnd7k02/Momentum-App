# Block 9 — hardening and the release gate

The prompt is `docs/wp3/prompts/prompt-9-haertung.md`. The block adds
nothing and changes no behaviour, except where it fixes what it found and
the owner's point of step 6a (D194). It proves, hardens and documents; it
does not publish the live app — the merge is the owner's step.

The session ran on another model than D159 names, as since STOP 7C at
the owner's word (D187). Subagents
were not used: the prompt allows them for pure search runs only.

The owner's word at the start (2026-11-17): the live app is
<https://hnd7k02.github.io/Momentum-App/>, opened as a Home Screen app;
there is no backup with real data, so the check data is generated; every
STOP report opens with one line; no new topics; at the gate the
recommendation stands unless he objects; the measurements of 7B and of 17
November stand; nothing is merged before the gate and without his order.

## Step 0 — the baseline

Taken on the block's starting point `aab8d12` (block 7E merged, D193), in
this cloud session, Chromium, by the runner of step 1 before anything else
changed. `tsc -b` exit 0 (12 s); `npm run test` exit 0, 141 files, 2485
tests (90 s); the three builds green.

| Suite | Passed | Duration | |
|---|---|---|---|
| phase2 · phase2-a11y · phase2-legacy | 68/68 · 17/17 · 5/5 | 32 · 11 · 6 s | |
| phase3 · phase3-a11y | 46/46 · 9/9 | 31 · 8 s | |
| phase4 · phase4-a11y | 54/54 · 20/20 | 66 · 19 s | |
| phase41 · phase41-a11y | 52/52 · 14/14 | 79 · 19 s | |
| phase5 · phase5-a11y | 46/46 · 15/15 | 70 · 26 s | |
| phase7 · phase7-a11y | 57/57 · 18/18 | 54 · 10 s | |
| phase8 · phase8-a11y | 56/56 · 23/23 | 52 · 11 s | |
| terminal · release · geometry | 43/43 · 83/83 · 111/111 | 30 · 53 · 110 s | |
| release-proof | 27/28 | 54 s | the known red offline check (D163) |
| stage4-shots | 37/37 | 29 s | |
| wp2-1-shots | 102/102 | 85 s | |
| wp2-2-shots | 192/198 | 209 s | **found**: counted the onboarding's still since 7E — fixed, below |
| wp3-sheets · wp3-midnight · wp3-reload | 330/330 · 139/139 · 128/128 | 120 · 110 · 602 s | |
| wp3-stage1 · wp3-stage2 · wp3-stage3 · wp3-stage4 | 318/318 · 201/201 · 153/153 · 170/170 | 297 · 279 · 131 · 76 s | |
| wp3-stage5b · stage5b-import-check | 357/357 · 11/11 | 226 · 68 s | |
| design-system | 1408/1408 | 489 s | |
| exercise-search · muscle-card · onboarding-7e | 115/115 · 210/210 · 100/100 | 58 · 192 · 61 s | |
| gym-muscles (alone) | 198/198 | 510 s | |
| muscle-sheet (alone) | 265/265 | 382 s | |
| farbregeln (alone) | 334/334 | 587 s | |
| body (alone, dev server) | 97/97 | 577 s | |
| body-reach (alone) | *(see below)* | | cut off by the runner's first time limit of 30 minutes; it needs about two hours |

40 suites; 5629 of 5636 checks before `body-reach`.

## Step 1 — one command

`npm run verify` (`scripts/verify/run-all.mjs`) builds the app, the
preview build with a database of its own and the live state `e30becd`
(from history, outside the repository), serves each where its suites ask
(`127.0.0.1`: 4173, 4174, 4273, the dev server on 5173), runs the 2D suites
two at a time and every suite with the body alone, and writes
`.artifacts/verify/<run>/table.md` and `results.json`. It exits 1 on any
red check; the known red offline check is named in the table as known and
still fails the run (D163). `ONLY=a,b` runs a choice, `--no-build` reuses
the builds. A red suite prints its failed checks with their detail.

## Step 2 — on GitHub

`.github/workflows/verify-wp3.yml`: on every push to `claude/momentum-wp3`
and by hand; read rights only; it publishes nothing and `deploy.yml` is
untouched. Job 1: `npm ci`, `tsc -b`, `npm run test`, Chromium from
Playwright's own download, `npm run verify`, the results uploaded. Job 2:
the WebKit selection. Each job queues on its own: the Chromium job under
way finishes and the newest push waits behind it; the WebKit job runs at
once. Two things the first runs found, both in the harness: Vite's
`localhost` is `::1` alone on a GitHub runner (every server now names
`127.0.0.1`), and the newest push cancelled a run under way.

## Step 3 — WebKit

`BROWSER=webkit npm run verify` runs `release`, `wp3-sheets`, `terminal`,
`design-system` (at 393) and `muscle-sheet` (without its two drag parts,
which drive touch through Chromium's DevTools protocol). Everything else
reads the accessibility tree, emulates media or drives touch through that
protocol, or is a 3D suite that measures frames; the list and the reasons
are in `scripts/verify/README.md`. WebKit is not on this machine and its
download is closed to this session, so it runs on GitHub only. WebKit on
Linux is not Safari on an iPhone: an early warning, never the owner's
check.

## Step 4 — the update, rehearsed as a whole

**The profile** (`.github/fixtures/wp3-update/live-profile.json`) is lived
through the live build's own screens (`stage5b-live-backup.mjs` with
`FOOD=1 RUNS=1 PLAN=1`): 28 September to 18 November, Mind's two questions
answered every day, 22 Gym sessions with 286 sets (a bodyweight exercise
and two weight entries among them), 15 runs, a plan «Push», Food switched
on and rated on all 52 days; exported through the live build's own
«Backup exportieren». Invented data, no one's own.

**The live state's own reading** of it, per day — the day's status and two
scores, the Boss, every domain's ledger, the Gym and Laufen ratings, the
legacy fold — is stored as `e30becd-outputs-2026-11-18.json` (the day
before the update, as the live build shows it on the update day) and
`e30becd-outputs-2026-11-25.json` (the live build a week later, with no
update), made by the live build's own code (`update-live-outputs.mjs`).

**`updateRehearsal.test.ts`** (6 tests): the first load of this build runs
each activation once and a second writes nothing; every collection keeps
every record, field for field; every day before the update reads as the
live build read it — 51 days, all of them; the backup imported into a fresh
install ends in the same state as the update in place; there and back by
the backup; and the update day and the week after replay to their frozen
files (`after-update-2026-11-18.json`, `after-update-2026-11-25.json`).
The three dates of the prompt: before (the live reading), on, and after.

**`update-in-place.mjs`** (16 checks): one address, one database, one
service worker. The live build holds the profile and its worker controls
the page; this build takes the address; the new worker waits, the page
still runs the live build, «Neue Version verfügbar» stands and nothing is
written; «Neu laden» reloads exactly once; this build runs and nothing of
the live build is left in the cache; nothing is lost; the eras are written
on the update day; a second load writes nothing; no page error.

**What moves from the update day on** — the live build without the update
against this build with it, both read on 25 November, nothing logged after
the 18th:

| Day | Status old / new | Boss | Gym | Laufen | Mind | Food (ledger) | Why |
|---|---|---|---|---|---|---|---|
| 16.–17.11. | scored / scored | the same | the same | the same | the same | the same | before the update |
| 18.11. | scored / scored | 744.1 → 743.1 | 831.2 → 832.7 | the same | the same | 705.6 → 708.4 | the new metric scores Gym's day (D150, D177/D180); Food is off and its ledger holds, the Boss moves by the rest (D139) |
| 19.–21.11. | scored / scored | 738.4 → 735.9 … 727.9 → 723.2 | 819.4 → 822.2 … 799.2 → 804.4 | the same | the same | held at 708.4 | the same two reasons, day by day |
| 22.–23.11. | open / scored | 727.9 → 717.5, 717.0 | 799.2 → 796.8 | 665.5 → 656.8 | 740.4 → 738.9, 737.4 | held | one day back (D132): with no answers these days close after a day, not three — and once closed, an unanswered day is a miss |
| 24.–25.11. | open / open | 715.7, 703.3 → 717.0 | 799.2, 749.6 → 796.8 | 612.7 → 656.8 | 740.4 → 737.4 | held | nothing is charged while it can be written (D134, D135): the live build charges the week's miss and Gym's and Laufen's abstinence on open days; this build waits for the day to close and the week to be over |

No promotion was due in the profile, so D136 shows nothing here; it is
held by its own tests and suites (`wp3-stage5b`, `p8Reversal.test.ts`).

## Step 5 — the way back

**The live build on data this build has loaded** (`update-in-place.mjs`,
B): it opens them without an error and writes nothing. It shows Heute with
Mind, Gym and Laufen, the Boss «Master», and no Food — it reads the
domains from the snapshot in force, which says Food is off. It does not
know the window, the metric or the curve the snapshot carries: every new
day would be scored by the old rules on data that says otherwise. That is
not a way back.

**The clean way back** (C): the data deleted, the live build, the backup
from before the update imported — two exports in a row are the same file,
and hold the backup's data record for record.

**The state to return to** is the head of the default branch, `e30becd`.
The repository has no tag (HANDOVER named `muscle-map-v1`, which does not
exist). Proposed: **`live-before-wp3`** on `e30becd`. Not set: whether and
who sets it is the owner's at the gate.

## Step 6 — the backup there and back

In the unit test: export, delete, import, export — the same file, and every
day's ratings as before. In the browser: the two exports of C. **The live
build with a backup of this build** (D): it reads it, takes every record,
keeps the snapshot with the new eras as data, and scores by its own rules,
as in B. A set marked as a warm-up keeps its mark in the live build's
storage, which never reads it.

## Step 6a — a workout stands at once

D194. The cause, chart by chart, and what is built, are recorded there.
`today-in-charts.mjs` holds it (14 checks): a workout saved on a Monday
before the day's questions stands at once in the chest row, its sheet's
line, the exercise detail, the hub's count and rating tile (provisional),
Verlauf's grid (hollow, «vorläufig») and the question history; every day
before is unchanged; once the day is complete its own values stand.
