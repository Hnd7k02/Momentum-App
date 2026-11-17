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

**Read on the update day itself** the picture is another, and on purpose:
the 18th stands at 849 in this build against 831 in the live build
(`after-update-2026-11-18.json`: 848.96). The week of the update holds a
session and is not over, so its attendance counts as met until it is
judged (D134); once it is — Tuesday the 24th — the same day stands at
832.7, still not below the live build's 831.2. A user sees the Gym rating
rise on the update day and settle a week later.

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

## Step 9 — for the owner, and the merge

**What changes for him on the update day** (German, as he reads it):

> Vorher: In der Live-App unter Bereiche → Einstellungen ein Backup
> exportieren und sicher ablegen. Das ist dein Rückweg.
> - Die App zeigt «Neue Version verfügbar». Ein Tipp lädt neu; deine Daten bleiben.
> - Ernährung verschwindet aus der Oberfläche. Ihre Daten bleiben gespeichert, nichts wird gelöscht.
> - Heute | Gestern: Eintragen geht für heute und gestern, nicht weiter zurück.
> - Neues Aussehen: Mind hell, Gym dunkel; Muskelgruppen mit dem Körper und einem Sheet je Gruppe.
> - Gym rechnet ab diesem Tag mit der neuen Kennzahl (bester Arbeitssatz, Aufwärmsätze zählen nicht). Das Gym-Rating steht danach an keinem Tag tiefer als nach der alten Rechnung. Im Probeprofil springt es am Update-Tag um 18 Punkte, weil die laufende Woche als erfüllt zählt, und setzt sich, wenn sie vorbei ist.
> - Eine Woche wird erst gewertet, wenn sie vorbei ist (Dienstag 00:00). Bis dahin zählt eine Woche mit Training als erfüllt.
> - Ein Training steht sofort im Rating und in Verlauf, als «vorläufig», bis der Tag abgeschlossen ist.
> - Alles vor dem Update bleibt, wie es war.

The prompt asks for "the number from block 5b" for the Gym rating's
move in the first weeks. That number (−42 after a week, D174) was the
reason for block "Kurve": under the curve at three the rating stands on
no day lower than under the old rules for a history of five weeks or more
(D177, D180). The decisions come first; the text says what holds now,
with the profile's own figures.

**The merge plan** (the owner's step; not done here):

1. The tidy-up block first, on `claude/momentum-wp3` (`prompt-aufraeumen.md`):
   it takes old files out of the public state and brings the licence file,
   so the release does not publish what the tidy-up removes. Its own check
   runs on the branch (this workflow).
2. A tag on the state to return to, if the owner wants one:
   `live-before-wp3` on `e30becd`.
3. The merge: `claude/momentum-wp3` into `claude/momentum-pwa-spec-j82dhm`.
   `e30becd` is an ancestor of the branch, so it is a fast-forward — no
   merge commit is needed. The push starts `deploy.yml`: `npm ci`,
   `tsc -b`, `npm run test`, `npm run build` (the body's validator first),
   and the publish to Pages at <https://hnd7k02.github.io/Momentum-App/>.
   `verify-wp3.yml` does not run there.
4. After it: the deploy run green; the address serves the new `index-*.js`
   and `sw.js`; on the iPhone point 10 of the checklist — «Neue Version
   verfügbar», one reload, the data there, then once in flight mode. The
   first load writes the three eras on that day; from then on the way back
   is the backup of step 1 of the checklist.

## The check files

There is no backup with real data. The owner's check uses invented diaries
made by the live build (`e30becd`) itself, through its own interface, and
exported by its own «Backup exportieren» — exactly what his live app would
hand the preview (`stage5b-live-backup.mjs`, `FIRST=2026-09-28 FOOD=1
RUNS=1 PLAN=1`, `LAST=` the day):

| Check on | File | Sessions · sets · answers · runs · Food days |
|---|---|---|
| 17 November 2026 | `momentum-pruefdaten-9-2026-11-17.json` | 22 · 286 · 102 · 15 · 51 |
| 18 November 2026 | `momentum-pruefdaten-9-2026-11-18.json` | 22 · 286 · 104 · 15 · 52 |
| 19 November 2026 | `momentum-pruefdaten-9-2026-11-19.json` | 23 · 298 · 106 · 15 · 53 |

Read off both builds on the file's own day (`stage5b-import-check.mjs`,
11/11 each: accepted by both, every set kept, one snapshot written by this
build with all three eras, a reload writing nothing):

| Day | Gym rating, live app | Gym rating, preview | Muskelgruppen, 30 days |
|---|---|---|---|
| 17 November | 845 | 863 | +5 %, 10 of 10 groups, strongest Bizeps +8 % |
| 18 November | 831 | 849 | +5 %, 10 of 10, Bizeps +8 % |
| 19 November | 865 | 871 | +6 %, 10 of 10, Bizeps +11 % |

**Take the file of the day you check**: its last session is on that day,
so the import into the preview is the update on that day. Mind's two
questions are answered on every day of the file, a plan «Push» is saved,
and Ernährung was on and rated — in the preview it is gone from every
screen and its data stays.

## Step 8 — contract §12 in the browser

`access-wp3.mjs`, 64 checks at 393 and 320: **less transparency**
(Chromium's own media emulation) on Heute, Verlauf, Rang, Bereiche, the Gym
hub, a metric's sheet, Muskelgruppen with its sheet, an exercise's detail
and a workout — nothing blurs, every card, sheet and bar is solid, every
text reads at 4.5:1 on its pixels; **less motion** with the muscle sheet —
once it stands nothing is on its way; **the page's zoom** is locked
nowhere; **44px and no overflow** on Muskelgruppen, its sheet, an
exercise's detail and the picker; **the screen reader's way** — ten rows
each saying group, figure and state, the sheet a named dialog, its chart
described, the focus back on the row, nothing nameless in the body.

What it found: the tab bar, the bar at the foot of a workout and the
scrim behind a sheet kept blurring under less transparency — fixed (D195).
What it found in the harness: a measurement that compared a screenshot
with text boxes read a moment later while Rang was still settling
(2.02:1 for «Boss-Rang», with and without less transparency) —
`textContrast` now measures one layout; and Chromium's tree names
`role="img"` an «image».

`docs/device-tests.md` is rewritten for this candidate: the ten points
for the iPhone, a place for device, iOS version and date, and the owner's
measurements beside the review's targets.

## The read-only review

Four finders over the block's changes (D194, the kept boundary, the
transparency fix, the harness), each finding put to two skeptics, and a
sweep of every rule the contract and CLAUDE.md say a test enforces —
agents that only read, every verdict mine. Fifteen findings; two upheld,
both in the runner, both fixed: a suite that crashed after its known red
check was labelled "known red", and a selection that ran nothing ended
green. The sweep's one gap that §14 covers: the pixel measurement left
out every text of one character — a bubble's digit, a scale's value;
measured since (333 such texts in `design-system.mjs`, the lowest 4.72:1).
The other "partly" entries are the scope of a check (which screens, which
widths), recorded, not new topics.
