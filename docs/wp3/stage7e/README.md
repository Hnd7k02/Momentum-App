# Block 7E — the onboarding

**Direction C, «referenznah»** (owner, STOP 7E-a, 2026-11-16; D190). The
look is the frame «C1 · Momentum» of the canvas the three directions were
drawn on; it shows the look of the first slide, not the content of the
other steps. Rejected: the diagonal, «Quiet Editorial» (A) and «Soft Dual
World» (B). The rules that hold in the onboarding only are the contract's
§16 «Onboarding-Ausnahmen» (`docs/wp3/vertrag.md`); for every screen of
the app the contract is unchanged.

The block had no prompt in the repository. What it was asked, as the
owner restated it at STOP 7E-a:

- at most three slides, no new function, no new npm dependency — only
  the presentation changes; 320 to 430px; every path tested; **the
  onboarding can be replayed in the preview without losing data**;
- first the presentation of every step, then **STOP 7E-a2** with pictures
  of every step at 393px and of the first slide and the weekly targets at
  320 and 430px, four questions and an estimate;
- only after his go: the tests for every path, the preview, and **STOP
  7E-b** with at most eight check points.

## STOP 7E-a2 — the answers (D191)

Go, on 17 November 2026: **1 A** the body stays in the Gym card; **2 A**
the rank stays focused; **3 A** Mind opens with three starter questions,
one per category, and «Weiter» waits with «Wähl mindestens eine Frage
oder nimm Mind ab.» while none is chosen; **4 No** — DM Sans does not go
into the app, and at the owner's word it leaves the onboarding as well:
the flow speaks in the system font, like everything after it, and an
installation fetches 36,932 bytes less. The other exceptions stay in the
onboarding only. The head of `claude/momentum-wp3` (STOP 7D accepted,
D189) was merged into the branch first.

**Sections below that speak of DM Sans** describe STOP 7E-a2 as it stood;
the pictures of `docs/design/wp3/stage7e/` show it in that face. Those of
STOP 7E-b are in `docs/design/wp3/stage7e-b/`.

## STOP 7E-b — accepted (D192)

Accepted on 17 November 2026, with two adjustments that have no STOP of
their own — the owner checks them in the round of block 9:

- **An opening page** before the first slide: very empty, «Let’s get it
  started» in its middle and «Weiter» beneath. It is no step: no marks, no
  brand, no way back; the first slide is still step one.
- **The areas open with nothing chosen**; «Weiter» waits, with «Wähle
  mindestens einen Bereich.», until a world is chosen.

Then the tests, a new preview, and the branch merged into
`claude/momentum-wp3` and pushed, so block 9 checks one state. Pictures:
`docs/design/wp3/stage7e-b/393-0-auftakt.png` and
`393-4a-bereiche-leer.png` beside the others of STOP 7E-b.

## STOP 7E-b — what is built after the go

- **The answers**, as above (D191).
- **The tests for every path**: `OnboardingFlow.test.tsx` (22 tests: every
  way through the flow, what it hands on, and what each step shows) and
  the browser suite `onboarding-7e.mjs` (four paths at 320, 360, 393 and
  430 in the real build, each read back from storage; every step held to
  the screen's width, 44px targets, at most one dark surface and a hero
  with nothing to operate).
- **The rehearsal in the preview**: Bereiche → Einstellungen →
  «Einführung ansehen», only in a build with a database of its own. The
  flow stands in for the app from its first slide; «Starten» at its end,
  Back at any step, or a reload return to the app, and nothing is written
  — `onboarding-7e.mjs` reads every store of the preview's database
  before and after and finds them byte for byte the same.
- **What it costs now**: without the font, the stylesheet is 11,144 bytes
  larger than at block 7D's head (1,633 gzip) and the script 13,039
  (3,430 gzip) — about 5 kB an installation fetches more, where STOP 7E-a2
  cost 42.
- **Verification** (2026-11-17, on `06f902f`): `tsc -b` clean; `npm run
  test` exit 0, 141 files, 2476 tests; `onboarding-7e.mjs` 67 of 67,
  `phase2.mjs` 67 of 67, `phase2-a11y.mjs` 17 of 17, `wp3-stage4.mjs`
  170 of 170, `design-system.mjs` with `ONLY=onboarding` 212 of 212 at
  four widths (lowest text 4.71:1, «Heute» in the hero at 320). Reviewed
  by four readers with a skeptic for every finding: seven held, all
  fixed (D191).
- **The preview**: `Momentum-preview` `8a5df95`, built from `6806630`.
  Data to rehearse on: the check files of block 7D for 17 and 18 November
  (`docs/wp3/stage7d/`); there is no backup with real data (D183).
- **The pictures**: `docs/design/wp3/stage7e-b/` — every step at 393, the
  first slide and the weekly targets at 320 and 430, the question step as
  it opens and with no question chosen, and the preview's row
  (`stage7e-shots.mjs` with `URL_PREVIEW`).

## STOP 7E-a2 — the pictures

`docs/design/wp3/stage7e/`, made by `scripts/verify/stage7e-shots.mjs`
against a production preview (`npm run build`, `vite preview --port
4173`): a new device walks the flow by its own buttons, both worlds
chosen, three questions, three gym sessions and two runs.

| Step | 393px | 320px | 430px |
|---|---|---|---|
| 1 Momentum (the hero) | `393-1-momentum.png` | `320-1-momentum.png` | `430-1-momentum.png` |
| 2 Zwei Welten | `393-2-welten.png` | | |
| 3 Ein Rang | `393-3-rang.png` | | |
| 4 Bereiche | `393-4-bereiche.png` | | |
| 5 Mind-Fragen (top of the step) | `393-5-fragen.png` | | |
| 6 Wochenziele | `393-6-wochenziele.png` | `320-6-wochenziele.png` | `430-6-wochenziele.png` |
| 7 Zusammenfassung | `393-7-zusammenfassung.png` | | |

`ALL=1` pictures every step at every width; `LANGUAGE=en` walks it in
English. `uebersicht-393.jpg` and `uebersicht-breiten.jpg` set the same
pictures side by side, at half size, for a phone.

## What it costs

- **The typeface**: one file of 36,932 bytes (DM Sans, Latin, the weight
  axis), served with the app and precached by the service worker — every
  installation downloads it once; the browser reads it only while the
  onboarding shows text in it.
- **The build** against block 7D's head (`adf1ead`): the stylesheet
  +11,815 bytes (+1,869 gzip), the script +13,196 bytes (+3,422 gzip).
  In all, an installation fetches about 42 kB more, 37 of them the font.
  The font's licence text goes out with the build as well
  (`licenses/dm-sans-OFL.txt`, 4,502 bytes); it is not precached.
- **No new dependency**, no stored record, no schema or backup version;
  `applyOnboarding` and what the flow hands to it are as they were.

## Measured for the questions of the STOP

- **The body in the Gym card** (slide 2): the still is the Gym hub's
  (`body-preview.webp`, already in the build: no byte more). With it the
  card is 185px high at 393px, without it 179px; it takes 64px of width
  and 16px of gap from the two targets.
- **The rank** (slide 3): the focused stage is 328px high at 393 × 852
  and 271px under 720px of height; the slide has 173px to spare at 393 ×
  852, 79px at 320 × 693 and 71px at 393 × 659. The whole ladder as rows
  — eight of 54px, as the rank screen draws it — would take about 432px
  where the next rank and the line under the stage take about 92px: some
  340px more, and the slide would scroll at every one of those sizes
  (by about 170px at 393 × 852).
- **Mind without a question**: «Weiter» is free with none chosen, as it
  always was; Mind then stays off (`applyOnboarding` switches it on only
  with a question), and the summary shows no Mind tile. The library has
  13 questions in three categories (4, 4, 5).
- **DM Sans in the app**: the shipped file has **no tabular figures** —
  «1111» measures 49.9px and «8888» 97.3px at 40px, with
  `tabular-nums` and without. The app's columns of figures (contract §3)
  rely on them.

## Estimate: the three exceptions in the whole app (not built)

Read from the code by three readers, one per exception; the paths and
counts are theirs, checked against the repository.

- **The flat ground** — about half a block, up to one if the Gym card
  needs a second look at a STOP. About 8 files and 40–60 lines of CSS: the
  two `--ground` tokens, the four places that paint the ground
  (`global.css`, `appShell.css`, the Gym overlay in `gym.css`,
  `questionDetail.css`) and the card in `ui.css`. **Ground and cards are
  one decision**: glass over a flat ground shows nothing (a Mind card
  would be 1.05:1 on the ground), so the cards go solid as in the
  onboarding. It reverses owner choices (D148's washes, D160's bound) and
  amends D146 and D147. Verification dominates: the design suite at four
  widths in both worlds, seven more suites, about 170 pictures.
- **The coloured line** — about one block, after four decisions: whether
  the line may end in blue at all (#2f8fe8 is the hue of «Zu wenig
  Vergleichsdaten», 209° against 207°), which middle stop Gym takes, 1.5
  or 2.5px, all four charts or Verlauf only. Code is a quarter of it
  (`TrendCurve.tsx`, `Sparkline.tsx`, `ExerciseLineChart.tsx`, three CSS
  rules); it reopens D154 and D160 and reverses D162, which took a
  lilac-to-sky gradient off the Boss bar; `designSystem.test.tsx`,
  `designRules.test.ts`, `release-proof.mjs` and `design-system.mjs` fail
  by design and would be rewritten. The end point, which carries the
  state, loses its contrast on a blue end (red 1.03:1).
- **DM Sans** — about one block if figures may be proportional or stay in
  the system face, about two if a cut with tabular figures has to be
  made. The move itself is an hour or two; **the figures are the cost**:
  74 `tabular-nums` declarations in 19 stylesheets (and one on the dev
  page) would silently stop working
  (the muscle rows' column of figures, the strip, Verlauf, the sets). A
  font that is not preloaded also shows the system face for a moment on
  every cold start (a preload in the build, or a wait in `main.tsx`);
  19 suites check text geometry; `ch`-based widths in the set row grow
  8.4 %; the arrows ↗ ↘ → are not in the file.

## Seen and left

- The three slides fit without scrolling at 320 × 693, 390 × 664, 393 ×
  659 and on every taller screen; the areas, the weekly targets and the
  summary from 320 × 568. The questions scroll by nature. On 360 × 640
  and 375 × 647 the first slide scrolls by about 30px; on 320 × 568 and
  375 × 548 the slides scroll by up to 130px, and the button stays.
- **The face is DM Sans at its small optical size**: the file has the
  weight axis only. The package's file with the optical-size axis as well
  (62,724 bytes, 25,792 more) sets the 34px titles about 6 % tighter
  («den du siehst.» 203.7px instead of 217.3px) and the 40px figure 4 %;
  13px text stays as it is. Not taken: the owner asked for the weights 400
  to 700, and the canvas's own letter-spacing was kept.
- The second slide's title is «Zwei Welten. Ein Verlauf.» and the third's
  «Ein Rang für alles.»; «Rang und Meilensteine» is gone with the
  milestones the slide no longer shows.
