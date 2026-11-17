# WP3 release candidate — the check on the iPhone

What only the phone can show, for the release candidate of WP3 (block 9,
the release gate). Everything a browser can prove runs in
`scripts/verify/` (`npm run verify`) and on GitHub; this list is what is
left: real Safari, the app from the Home Screen, a real finger, a real
VoiceOver, and the measuring display.

The RC2 checklist that stood here is history; it is recorded with RC2 in
[`release-candidates.md`](release-candidates.md).

**Build under test:** the preview `Momentum-preview` named in
`release-candidates.md` (WP3 RC), at <https://hnd7k02.github.io/Momentum-preview/>,
opened as a Home Screen app. The live app is <https://hnd7k02.github.io/Momentum-App/>
(the owner, 2026-11-17). Both share one origin; the preview keeps its data
in a database of its own (`momentum-preview`), so nothing here can touch
the live app's data.

**Check data:** there is no backup with real data (D183). The check files
for the day of the check and the day after are named in the STOP report
of block 9; import the one for the day you check.

| | |
|---|---|
| Device | |
| iOS version | |
| Date | |
| Who | |

## How to report

For each point: ✅, or ❌ with what you did, what happened and what you
expected. A screenshot or a screen recording beats a description. A point
that fails is fixed in the session of block 9 and the preview is published
again.

## The checklist

| # | Do | Expected | Result |
|---|---|---|---|
| 1 | In the **live app**, Bereiche → Einstellungen → "Backup exportieren", and keep the file somewhere safe | A file `momentum-backup-….json` is saved. **This is the way back.** | |
| 2 | Only once 1 is done: in the live app, import that same file at once | "Backup wiederhergestellt." — nothing changes. The live build reads its own backup | |
| 3 | Open the preview, import the file from 1 | Everything is there: answers, sessions, runs, plans. Ernährung is nowhere to be seen. Export a backup there and import it again: nothing changes | |
| 4 | A whole day: answer the questions, add something for yesterday on Gestern, log a workout with a warm-up set, "Fertig" | Each lands on the day on show; the warm-up set says "Aufwärmsatz" | |
| 5 | Log a workout **before** answering the day's questions, then look at the Gym tile, Muskelgruppen and Verlauf | The workout is there at once: Muskelgruppen and the exercise detail as always; the Gym tile with its value and "Vorläufig · der Tag ist noch offen"; Verlauf's grid with today as a hollow bar, "vorläufig". Answer the questions: the tile drops the word and keeps the value (D194) | |
| 6 | The onboarding — in a private tab, or Einstellungen → "Einführung ansehen": tap a corner, the line and the hint on the opening page; then "Womit startest du?" | Every tap goes on. The hint «Screen antippen» is faint, and still readable. Nothing is chosen in the areas, and "Weiter" waits for a world (D192, D193) | |
| 7 | Muskelgruppen: the body, three sheets | The same number and colour in row, sheet and body | |
| 8 | VoiceOver on: answer a question on Heute; swipe through the ten rows of Muskelgruppen; open a sheet and close it | Each row says group, figure and state; the sheet has its name; closing returns to the row | |
| 9 | Settings → Accessibility: "Reduce Motion", then "Reduce Transparency", one at a time | Nothing travels; glass turns solid; everything stays readable | |
| 10 | As a Home Screen app: both worlds, the status bar, the keyboard in a set row, the tab bar above the Home indicator | Nothing hides under the clock or the indicator; the keyboard leaves the field in view | |

**After the go-live only** (not the preview, which has no service worker):
the live app shows "Neue Version verfügbar"; "Neu laden" reloads once and
your data is there. Then open it once in flight mode: Heute and the body
appear (the offline check in `release-proof.mjs` is red until the tidy-up,
D163).

## Measured on the phone, against the targets

The targets are the review's (`docs/wp3/review-2026-11.md`, section I).
The measurements are the owner's, from the measuring display (block 7B,
D181; Einstellungen → "Messanzeige"). They stand for the release (the
owner, 2026-11-17: "Die Messwerte aus 7B und vom 17.11. gelten. Neue
Messrunden nur, wenn etwas auffällt.").

| | Target | Block 7B (2026-11-16, build `index-DQBEJ-V9`) | 17 November 2026 (build `index-B1RXpspr`) |
|---|---|---|---|
| Body visible, first load over the network | ≤ 2.5 s | 864 ms (files checked over the network, taken from the cache) | — |
| Body visible, from the cache | ≤ 1 s | 193 ms | — |
| … both files already in memory | | 142 ms | 161 ms (code 2 ms, model 124 ms, first picture 35 ms) |
| Turning: frames a second | ≥ 55 on average | 60.2 | about 63 observed |
| Turning: frames under 25 ms | ≥ 95 % | 100 % of 154 | — |
| Idle: frames | 0 | 1, and 2 (a touch drew; fixed in 7C, D184/D185) | — |
| Draw calls | ≤ 12 | 12 | 12 |
| Triangles | ≤ 80,000 | 50,488 | 50,488 |
| Textures | one of 1024² | 1 · 768 × 1024 | 1 · 768 × 1024 |

Device for both: iPhone 15 Pro, iOS 26.3.1 (the browser reports 18.7),
the app from the Home Screen, screen 393 × 852, visible 393 × 793, the
body's stage 393 × 436 (55 %), pixel ratio 2 of 3, drawing buffer
786 × 872, "Apple GPU".

**Not measured on the phone, and open:** a first load with the files
really coming over the network; the turning measurement on the 17th; an
idle second after block 7C's fix. None is a new measuring round unless
something stands out.

## Results

*(filled in from the owner's report, with device, iOS version and date)*
