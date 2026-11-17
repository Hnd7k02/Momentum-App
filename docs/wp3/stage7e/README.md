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
English.

## What it costs

- **The typeface**: one file of 36,932 bytes (DM Sans, Latin, the weight
  axis), served with the app and precached by the service worker — every
  installation downloads it once; the browser reads it only while the
  onboarding shows text in it.
- **The build** against block 7D's head (`adf1ead`): the stylesheet
  +11,341 bytes (+1,798 gzip), the script +13,201 bytes (+3,419 gzip).
  In all, an installation fetches about 42 kB more, 37 of them the font.
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

## Seen and left

- The three slides fit without scrolling at 320 × 693, 390 × 664, 393 ×
  659 and on every taller screen; the areas, the weekly targets and the
  summary from 320 × 568 (the targets but for 11px there). The questions
  scroll by nature. On 360 × 640 and 375 × 647 the first slide scrolls by
  about 30px; on 320 × 568 and 375 × 548 the slides scroll by up to
  130px, the button stays.
- The second slide's title is «Zwei Welten. Ein Verlauf.» and the third's
  «Ein Rang für alles.»; «Rang und Meilensteine» is gone with the
  milestones the slide no longer shows.
