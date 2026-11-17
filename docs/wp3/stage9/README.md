# Block 9 — hardening and the release gate

The prompt is `docs/wp3/prompts/prompt-9-haertung.md`. The block adds
nothing and changes no behaviour, except where it fixes what it found and
the owner's point of step 6a (D194). It proves, hardens and documents; it
does not publish the live app — the merge is the owner's step.

The session ran on another model than D159 names (Opus 5.5 where D159
says Fable 5.2), as since STOP 7C at the owner's word (D187). Subagents
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
