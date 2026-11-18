# The tidy-up — the last block of WP3

The prompt is `docs/wp3/prompts/prompt-aufraeumen.md`; the owner's go and
what he added to the block are D196. The block removes and corrects. The
history is not rewritten, and nothing that computes or stores changed:
`src/core/` and `src/storage/` are untouched, `git diff e50518f --
.github/fixtures` is empty. Decisions: D196–D201.

It ran in one session, on the model D159 names. Subagents were not used.
Branch: `claude/momentum-wp3`, as the prompt allows; the session's own
branch `claude/dreamy-shannon-xdg39z` carries the same commits. No pull
request. Nothing was merged before the owner's ✅ and his word; what
happened then is at the end, "After the STOP".

## Step 0 — the baseline

On `e50518f`, the release candidate of block 9, before anything changed:
`tsc -b` exit 0; `npm run test` exit 0, 145 files, 2511 tests (7 skipped
in the two report files). The suites were not run again here before the
first change: the candidate's own final run on GitHub is the baseline —
Chromium at `d8abe4e`, **43 suites, 5746 of 5747**, the one red the known
offline check; `e50518f` differs from it in documents only.

**One thing was red that the baseline did not know.** On Wednesday 18
November, on GitHub, in WebKit, `muscle-sheet.mjs` failed one check at
`e50518f` (run 39) and again at this block's second commit (run 40): "the
volume is the working sets' reps × load … of 1020 kg — 420 + 180". It is a
check that depends on the weekday (below, "Found in the harness"), green
on the Monday and Tuesday block 9 ran on.

## Step 1 — out of the tree (D157)

Removed with `git rm`, and still visible in the history:

| File | What it was |
|---|---|
| `momentumpreview 2.zip` | an old build package, 364 KB |
| `.github/Claude I6 backup request` | a second copy of the RC2 backup, its umlauts destroyed, 13 KB |
| `docs/design/muscle-map/qa/device/IMG_0648.png`, `IMG_0649.png`, `IMG_0650.png` | iPad screenshots of a draft, with the owner's browser tabs and a part of a chat |

What named them says so now: `HANDOVER.md` ("Verification status"),
`docs/design/muscle-map/INTEGRATION-QA.md`, `docs/release-candidates.md`,
`docs/decisions.md` (D43's note on the brief). The decision and the
prompts that list the files are records and stay as written.

## Step 2 — the licence

- **`LICENSE` was prepared and, at the STOP, not committed**: the session
  asked the owner for the name and the year. *(It should not have had to:
  `HANDOVER.md` and `docs/decisions.md` held his answer of 11 November,
  which the session overlooked. His answer at the STOP, on 18 November,
  is the later word and stands — D202: the account name `Hnd7k02`, 2026 —
  and the file is committed with it.)* Its text, three things and no
  more: the app — code,
  design, texts — is protected by copyright, all rights reserved; the 3D
  body has a licence of its own, in `THIRD-PARTY-NOTICES.md`; the owner's
  drawings are excluded (D157).
- `package.json`: `"license": "UNLICENSED"`.
- **`THIRD-PARTY-NOTICES.md` and the credits in the app say the same
  thing** and were not rewritten: the shipped body is built from
  MakeHuman's base mesh, rig and targets as MPFB2 distributes them, taken
  from the package Anny 0.6.2, all CC0; a second section credits what is
  kept in the repository from the model before block 7A — the copy of
  that GLB in the handoff folder and pictures of it — to patmateee under
  CC BY 4.0. Nothing was missing.

## Step 3 — the documents

`README.md` is new: what Momentum is, how it is built, tested and
checked, where the rules, the state, the decisions and the contract are,
and the licence. No table of stages from then, nothing personal.

**The six contradictions of the review** (`docs/wp3/review-2026-11.md`,
section B):

| | Contradiction | Today | Done here |
|---|---|---|---|
| 1 | `HANDOVER.md` named three iPad screenshots as the record of an iPhone review | block 9 had struck the row and named the owner's measurements from block 7B on | the files are out of the tree (step 1), and the three documents that named them say what they were |
| 2 | `HANDOFF.txt` and the comment in `muscleMeshMap.ts` called head, hands and feet the neutral zone; in the GLB the hands belonged to the forearms | block 7A's model has head with neck, hands and feet as its inert zone, cut straight; `muscleMeshMap.ts` (lines 10, 135) and `tools/validate-body-glb.mjs` (line 18) say exactly that | nothing: checked. `HANDOFF.txt` describes the old model and stays |
| 3 | `HANDOVER.md` called Heute's Gym label "in the Gym accent"; the CSS set mint | Stage 6b removed mint and every area colour (D154, D160); the one "mint" left in `src/` is the comment in `tokens.css` that says what went. The sentence in `HANDOVER.md` describes variant B of Stage 6a, and says one variant is removed at 6b | nothing: history, and true of its day |
| 4 | `HANDOVER.md` named D1–D144; the decisions reached D147 | the decisions reach D201, 202 entries with D68a | `HANDOVER.md` names D1–D201 |
| 5 | Gate G recommended the best set, the owner's decision of 28 October the mean; only one side was in the repository | D150 records both: the mean decided on 28 October, replaced on 11 November by the best working set by a strength score, with the review's section E for why | nothing: resolved by D150 |
| 6 | `README.md`, `docs/release-candidates.md` and `docs/device-tests.md` described RC2, with the live address `dario02king.github.io` | block 9 rewrote the two records for the WP3 candidate with the address the owner confirmed, `https://hnd7k02.github.io/Momentum-App/` | `README.md` rewritten; the one place the old address still stood as current (`release-candidates.md`, V1's "Live at") names the new one and says what happened; `INTEGRATION-QA.md` keeps the old one as the address of its day |

Also corrected: `HANDOVER.md`'s title, and the two "not merged" of WP2-1
and WP2-2, which `e30becd` merged. `scripts/verify/README.md`: every file
of the folder is in its table (`back-sheets.mjs`, `pages-server.mjs`,
`stage2-shots.mjs`, `stage4-shots.mjs`, `status-shots.mjs` were not), and
the one name without a file, `wp3-stage6a.mjs`, is named as the
predecessor it was. `CLAUDE.md`: only what this block made untrue or new —
the onboarding's start (D197), the icon among the exceptions (D198), Back
for every sheet and the kept draft, the card that is put there whole
(D199), the move to the hub that says what it is for, the test server.
No rule was taken out.

Three commits carry a private e-mail address in their author data. That
cannot change without rewriting history, and stays.

## Step 4 — «Pläne verwalten» leads to the plans

D200. `app/hubIntent.ts`, `GymTerminal.tsx`, the two hosts.
`hubPlans.test.tsx` (5 tests); `wp2-2-shots.mjs`, both ways at four
widths: at the plans, the focus on their heading, Back to Muskelgruppen
or to Heute, and the hub by its tab at its top afterwards (222 checks
where it had 198).

## Step 4b — Back closes every sheet

D200. `Sheet` in `components/index.tsx`, `components/sheetDraft.ts`, the
three sheets with fields. `sheetBack.test.tsx` (8 tests);
`back-sheets.mjs`, a new suite (138 checks). `wp3-sheets.mjs` is unchanged
and green, 330 of 330.

## Step 4c — the app icon

D198. `docs/wp3/aufraeumen/icon-vergleich.png`: the built files at 180,
60 and 28px beside the owner's preview.

## Step 5 — the offline check

D200. Against `vite preview`: 27 of 28, the offline check red, as since
before Stage 6b. Against `pages-server.mjs`: 28 of 28, three runs of
three. Against `pages-server.mjs --vary Origin`: 27 of 28, the same check
red. Read off the requests: `BodyViewer-*.js`, its CSS and `index-*.js`
are asked for with an `Origin`, the model without. The app was not
changed. The headers of GitHub Pages could not be read off a live answer
— the session's network rules close `github.io` — and are taken from its
documentation: `Access-Control-Allow-Origin: *`, `Vary: Accept-Encoding`,
`Cache-Control: max-age=600`, ETag and Last-Modified.

## What the owner added (D196)

- **The onboarding chooses nothing** — D197.
- **The Muskelgruppen card on the iPhone** — D199. Not reproduced, here or
  on GitHub; the cause named as far as it can be; fixed by putting the
  card there whole; held by a test and by the suite in both browsers.
- **The first slide's picture** — D201.
  `docs/wp3/aufraeumen/titelbild-vorher-nachher.png`.
- **The two tokens nothing read** are gone, with the two the icon's mark
  no longer needs (D198).

## Found in the harness

- **`muscle-sheet.mjs`, a check that depended on the weekday.** A week
  only partly inside the range at its start is left out of the work
  volume (`rangeWeeks`). The seeded bench press begins 26 days back and
  the range 29: from Saturday to Tuesday that day's week is the first bar
  (1020 kg), from Wednesday to Friday it is left out and the first bar is
  the next week's (600 kg). The check knew the first case. It now says
  which it is on the day it runs.
- **The unit tests' time limit was vitest's default, five seconds.** The
  replay tests of `gymMetricEra` and `gymCurveEra` take two and a half
  seconds each here; on GitHub's runner one crossed five (run 42), and the
  test after it failed with it. A test has thirty seconds now
  (`vitest.workspace.ts`); what a replay may cost is measured where it is
  meant, in `replayPerformance.test.ts`.
- **`run-all.mjs` took a port for free when what answered there said
  404.** With a server that answers `/` with 404, as Pages does, a stale
  server would have been tested in place of the build. Any answer now
  counts as taken.

## Step 6 — what else lies around

Nothing of this was removed. Sizes are of the tracked tree: 1631 files,
181 MB.

| What | Size | What it was for | Proposal |
|---|---|---|---|
| `docs/design/wp3/` — pictures of the stages of WP3 | 136 MB, 855 files; the largest: `stage7c` 24 MB, `stage6a` 17 MB, `stage7b` 15 MB, `stage6b` 14 MB, `stage1` 13 MB, `stage5b` 11 MB | the evidence the owner accepted each stage on | **an archive branch or a release asset, then out of the tree** — after the go-live. They are three quarters of the repository and nobody builds from them. `stage6a` first: it shows two design variants, one of which no longer exists |
| `docs/design/` besides — muscle map, WP2, overall rank, status palette | 20 MB, 133 files | the same, for the stages before WP3 | the same, with it |
| `docs/design/muscle-map/momentum-muscle-map-handoff/` | 2.4 MB | the handoff of the first body, with its GLB | **keep**: `tools/validate-body-glb.test.mjs` proves the validator on that GLB, and its licence notes travel with it |
| Check files: 15 `momentum-pruefdaten-*.json` under `docs/wp3/` | 2.3 MB before this block | the import files of each STOP | **keep those of block 9 and of this block until the go-live**, then remove all but the one `updateRehearsal.test.ts` reads (it lies under `.github/fixtures/`) |
| `tsconfig.node.tsbuildinfo` in the root | 2 KB | a build artefact, tracked although `.gitignore` names `*.tsbuildinfo` | **remove from the tree** (`git rm --cached`) |
| Scripts under `scripts/verify/` that are not suites and belong to a past stage — `stage2-shots`, `status-shots`, `qa-shots`, `kurve-shots`, `kurve-tint-shots`, `stage7b-shots`, `stage7c-shots`, `stage7d-shots`, `stage7e-shots`, `stage6-blur-cost`, `stage7c-travel-cost`, `band-golden-diff`, `kurve-golden-diff`, `stage7c-check-files`, `stage7d-check-files` | 0.3 MB | the pictures, measurements and files of their stage | **keep**: small, and each says how a recorded picture or figure was made. `qa-shots.mjs` draws the muscle map of before block 7A; it goes when its pictures go |
| `docs/iteration-2-plan.md` | 351 lines | the plan of iteration 2; decisions cite it | **keep**: a record |
| `docs/wp3/mockups/` | 3 MB | the mockups the contract was accepted on; the contract's appendix names them | **keep** |
| `update-in-place.mjs` still serves its two builds with `vite preview` | — | it swaps two builds on one port to rehearse the update | **later, not now**: move it to `pages-server.mjs` too. It is green as it is, and under Pages' `max-age=600` it would test something it does not test today |
| The repository `Momentum-preview` | — | the preview for the phone | **the owner deletes it after the go-live** |
| Two wishes for the measuring display (D184) | — | frames drawn in all; a file from the cache named as that | **open**: not in this block's prompt |

## The check files

There is still no backup with real data. As in block 9, the files are
invented diaries made by the live build `e30becd` itself through its own
screens and exported by its own «Backup exportieren»
(`stage5b-live-backup.mjs`, `FIRST=2026-09-28 FOOD=1 RUNS=1 PLAN=1`):
the diary of block 9, carried on to the day.

| Check on | File | Sessions · sets · answers · runs · Food days | Gym rating, live app | Gym rating, preview | Muskelgruppen, 30 days |
|---|---|---|---|---|---|
| 18 November 2026 | `momentum-pruefdaten-aufraeumen-2026-11-18.json` | 22 · 286 · 104 · 15 · 52 | 831 | 849 | +5 %, 10 of 10 groups, strongest Bizeps +8 % |
| 19 November | `momentum-pruefdaten-aufraeumen-2026-11-19.json` | 23 · 298 · 106 · 15 · 53 | 865 | 871 | +6 %, 10 of 10, Bizeps +11 % |
| 20 November | `momentum-pruefdaten-aufraeumen-2026-11-20.json` | 23 · 298 · 108 · 15 · 54 | 863 | 869 | +5 %, 10 of 10, Bizeps +11 % |
| 21 November | `momentum-pruefdaten-aufraeumen-2026-11-21.json` | 24 · 311 · 110 · 16 · 55 | 890 | 890 | +6 %, 10 of 10, Bizeps +11 % |

Read off both builds on the file's own day (`stage5b-import-check.mjs`,
11 of 11 each: accepted by both, every set kept, one snapshot written by
this build with all three eras, a reload writing nothing). The files of
the 18th and the 19th are, record for record, those of block 9, and show
the figures block 9 read: the tidy-up moved nothing that computes.

**Take the file of the day you check**: its last day is that day, so the
import into the preview is the update on that day. Mind's two questions
are answered on every day of the file, a plan «Push» is saved, and
Ernährung was on and rated — in the preview it is gone from every screen
and its data stays. The files of block 9 (`docs/wp3/stage9/`) stay valid
for their days.

## Step 7 — the final check

Here, Chromium, at `e185f91` (application source `f9848b6`; the head adds
the unit tests' time limit and documents): `tsc -b` exit 0; `npm run
test` exit 0 — **149 files, 2534 tests** (the two report files skipped,
as before; 145 files and 2511 tests at the baseline: four files and 23
tests more); `node tools/render-icons.mjs --check`: the six icon files
are what the source makes; `npm run verify` — **44 suites, 5989 of 5989
checks, exit 0. No red check, known or not.** Against the gate's 43
suites and 5746 of 5747: one suite more (`back-sheets`, 138), 243 checks
more — `wp2-2-shots` 222 where it had 198, `muscle-card` 270 where it had
210, `onboarding-7e` 120 where it had 100, `release-proof` 28 of 28 —
and the offline check green.

| Suite | Kind | Passed | Duration | Result |
|---|---|---|---|---|
| build: app | build | — | 19 s | green |
| build: preview | build | — | 5 s | green |
| phase2-a11y | suite | 17/17 | 10 s | green |
| phase2-legacy | suite | 5/5 | 7 s | green |
| phase2 | suite | 68/68 | 32 s | green |
| phase3-a11y | suite | 9/9 | 7 s | green |
| phase3 | suite | 46/46 | 31 s | green |
| phase4-a11y | suite | 20/20 | 19 s | green |
| phase4 | suite | 54/54 | 66 s | green |
| phase41-a11y | suite | 14/14 | 18 s | green |
| phase41 | suite | 52/52 | 77 s | green |
| phase5-a11y | suite | 15/15 | 26 s | green |
| phase5 | suite | 46/46 | 70 s | green |
| phase7-a11y | suite | 18/18 | 9 s | green |
| phase7 | suite | 57/57 | 53 s | green |
| phase8-a11y | suite | 23/23 | 10 s | green |
| phase8 | suite | 56/56 | 51 s | green |
| terminal | suite | 43/43 | 30 s | green |
| release | suite | 88/88 | 55 s | green |
| geometry | suite | 111/111 | 107 s | green |
| release-proof | suite | 28/28 | 54 s | green |
| stage4-shots | suite | 37/37 | 29 s | green |
| wp2-1-shots | suite | 102/102 | 85 s | green |
| wp3-sheets | suite | 330/330 | 118 s | green |
| wp2-2-shots | suite | 222/222 | 224 s | green |
| wp3-midnight | suite | 139/139 | 108 s | green |
| wp3-stage1 | suite | 318/318 | 295 s | green |
| wp3-reload | suite | 128/128 | 590 s | green |
| wp3-stage2 | suite | 201/201 | 271 s | green |
| wp3-stage3 | suite | 153/153 | 126 s | green |
| wp3-stage4 | suite | 170/170 | 75 s | green |
| stage5b-import-check | suite | 11/11 | 66 s | green |
| wp3-stage5b | suite | 357/357 | 223 s | green |
| exercise-search | suite | 115/115 | 55 s | green |
| muscle-card | suite | 270/270 | 200 s | green |
| back-sheets | suite | 138/138 | 102 s | green |
| design-system | suite | 1408/1408 | 445 s | green |
| update-in-place | suite | 16/16 | 56 s | green |
| onboarding-7e | suite | 120/120 | 58 s | green |
| gym-muscles | 3D, alone | 198/198 | 491 s | green |
| muscle-sheet | 3D, alone | 265/265 | 362 s | green |
| farbregeln | 3D, alone | 334/334 | 427 s | green |
| today-in-charts | 3D, alone | 14/14 | 60 s | green |
| access-wp3 | 3D, alone | 64/64 | 86 s | green |
| body-reach | 3D, alone | 12/12 | 2885 s | green |
| body | 3D, alone | 97/97 | 542 s | green |

44 suites, 5989/5989 checks in chromium; 0 red beyond the known, 0 known red.

`git diff e50518f -- .github/fixtures` is empty. `src/core/` and
`src/storage/` are untouched. Under `src/` logic and behaviour changed
where steps 4, 4b and 4c and the owner's four points say, and nowhere
else. `deploy.yml` and the default branch are untouched.

**On GitHub.**

- **WebKit, three runs at `e185f91`** (run 42 by the push, runs 43 and 44
  started by hand with `only: webkit`): each **6 suites, 1287 of 1287**.
  **No notice stood in the middle of a journey in any of them** —
  `release.mjs` would have named it. Before the fix of the weekday check,
  runs 39 and 40 were red in that one check of `muscle-sheet.mjs`.
- **Chromium, run 42 at `e185f91`: red at `npm run test`**, before any
  suite ran. `gymMetricEra.test.ts` — a file this block did not touch —
  timed out at vitest's default of five seconds in "every output of every
  day before the update", a replay that takes two and a half seconds
  here; the test after it then failed on the database the first was still
  writing ("expected -1 to be 35"). Green here, and green on GitHub in
  run 39 two hours before. Not a rule that broke: a runner with two cores
  and a default nobody chose. **A test has thirty seconds since**
  (`vitest.workspace.ts`), and a probe that waits six seconds shows the
  limit holds for every project.
- **The run that counts for the merge is the one on the head** — the
  commit that carries this record. It cannot be written into itself: its
  result stands on GitHub at that commit, and in the STOP report.

**The preview.** `Momentum-preview` `65207c1` on its `main`, built from
`e185f91` with `--base=/Momentum-preview/` and
`VITE_MOMENTUM_DB=momentum-preview`; no `sw.js`, no source maps,
`index.html` the preview's own, the status bar `default`. The main
bundle, its stylesheet and the viewer's chunk changed and the icon files
are the new ones; the model, the stills and the manifest are byte for
byte what was there. Served under its own path here before the push: the
opening page, the new mark, the empty onboarding, the database
`momentum-preview`, no service worker, no error and no failed request.
Its `Publish preview` run on GitHub ended in success; the page itself
could not be opened from this session, whose network rules close
`github.io`.

## After the STOP — accepted, merged, released (D202)

**The owner's answers** (2026-11-18): `LICENSE` names the account,
`Hnd7k02`, and 2026. The tag `live-before-wp3` on `e30becd` is set by the
session before the merge; the merge is a fast-forward by the session, at
his explicit word; offline and the update are not rehearsed on the device
before the go-live — he checks both directly after it. The cover picture
he had meant is the app icon, with a picture of it as the target; the
session had read it as the first slide's picture (D201, corrected by
D202). The inventory after the go-live; the measuring display's two
wishes as a small block after WP3; the status bar from edge to edge not
in this release but as a small block after the go-live, together with the
backup protection. His checklist with the check file of 18 November:
1 to 9 ✅. His backup of the live app: made. And: "Merge!!!"

**The two conditions of the merge** (D196), both met for `a8c5f95`:

- his ✅ on the tidy-up's preview, `Momentum-preview` `65207c1`, built from
  `e185f91` — the same application source, `f9848b6`;
- `verify-wp3.yml` green on exactly `a8c5f95`, run 45: `tsc -b`, `npm run
  test`, and `npm run verify` in Chromium — **44 suites, 5989 of 5989** —
  and the WebKit selection green.

**The merge.** 2026-11-18, 14:02 UTC: `git push origin a8c5f95:
claude/momentum-pwa-spec-j82dhm`, a fast-forward from `e30becd` over 324
commits, nothing forced. `deploy.yml` ran on it (run 15): `npm ci`, the typecheck, `npm run test`
and the build green, and the site published to GitHub Pages at 14:05
UTC — **WP3 is the live app**, at
<https://hnd7k02.github.io/Momentum-App/>. The address itself could not
be opened from the session, whose network rules close `github.io`; the
owner's point 10 is the check of it.

**The tag is not on GitHub.** `live-before-wp3` is set on `e30becd` in the
session's clone; its push was refused with HTTP 403 — the session's
access pushes branches and no tags — and no tool of the session creates
one. The commit stays in the history of the default branch whatever
happens; the tag is a name for it and can be set at any time: `git push
origin e30becd:refs/tags/live-before-wp3`. The merge was not held for it:
the way back is the owner's backup (D195), which he had made.

**What a read-only sweep found before the merge** (four search runs over
the tracked tree, no edits by them): in the commit that was merged,
`HANDOVER.md` and `docs/release-candidates.md` carried unfilled
placeholders — `%(app)s` and nine of its kind — where the block's last
record should have printed its figures: the session's script wrote the
templates and never filled them. Documents only; the merged commit shows
them on the default branch until the next fast-forward. They are filled
in the commit that carries this section. Also found, and corrected there:
`CLAUDE.md` named `core/gym/rating.ts`, a file renamed to
`core/scoring/trainingRating.ts` in Phase 5. Not found: an e-mail
address, a local path, a session address or anything like a key in 657
text files. Found and left for the owner to decide: his full name, in
two lines that record his answer of 11 November about the licence.

**After the merge, on `claude/momentum-wp3`:** `LICENSE`, this section,
D202, and the documents that said "not merged" (`783a84b`). The built app
of that commit is, file for file, the one that was merged. It was to
reach the default branch by a fast-forward of its own; the owner's next
word put it together with the icon (below), and that fast-forward was
not made.

## The same day, after the release (D203)

The session laid the owner's picture beside the icon as released and two
proposals made of his own SVG. **He chose the second, without a
preview**; the first slide's picture stays as D201 left it; and his name
leaves the two lines that held it.

- **The icon.** `tools/icon-source.mjs` holds nine values and applies
  them to his first drawing, which stays untouched under `docs/`;
  `tools/render-icons.mjs` makes all seven icon files from the two. The
  built files are, byte for byte, the proposal he saw.
  `docs/wp3/aufraeumen/icon-d203-vergleich.png`: his picture, the icon as
  released, and the built files at 180, 60 and 28px.
- **His name.** `HANDOVER.md` and `docs/decisions.md`, one line each: «the
  owner». No tracked file holds his family name any more.
- **Checked here before the push:** `tsc -b`, `npm run test`, `npm run
  build`, `node tools/render-icons.mjs --check`, and the suites that meet
  the icon or the worker's list of files — `release`, `release-proof`,
  `onboarding-7e`, `phase2`, `wp3-stage4`, `update-in-place`,
  `design-system`, `terminal`. The whole check is GitHub's, on the commit.
- **One fast-forward for all of it** — the licence, the record of the
  merge and the icon — made only once `verify-wp3.yml` is green on exactly
  that commit. Its result stands on GitHub at the commit; a record of it
  in the repository would be another commit and another run.
- **What it changes for an installed app:** nothing it can see. The
  scripts and styles are the same, so the service worker's revision is
  the same and no notice follows; the icon files keep their names and an
  installed app keeps the ones in its cache. The Home Screen keeps the
  icon the app was added with.
