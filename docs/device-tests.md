# WP3 release candidate — the check on the iPhone

**Where this stands (2026-11-18, after the merge).** The owner worked
through the checklist below on the preview `0d741de` and found it in
order but for two points (see "Results"). Both went into the tidy-up,
with what else he added (D196). On the tidy-up's preview he then checked
the short list at the end, "After the tidy-up": **points 1 to 9 ✅**, and
WP3 was merged and published the same day (D202). **What is left is
point 10, on the live app**: the update notice, one reload, the data,
then flight mode. The checklist of the gate stays here as it was
checked.

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
your data is there. Then open it once in flight mode: Heute appears, and
**in Muskelgruppen the body stands**. *(Until the tidy-up this said the
flat figure would stand there: the offline check in `release-proof.mjs`
was red. It was the test server's, not the app's — D163, D200 — and is
green against a server that answers as GitHub Pages does. The phone in
flight mode is still what decides.)*

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

**2026-11-18, the owner, on his iPhone, the preview `0d741de`** (the
iPhone 15 Pro of the measurements above; he did not restate device and
iOS version with this report). His words: "Prüfliste: Bis auf die zwei
Punkte unten ist alles in Ordnung."

| # | Result |
|---|---|
| 1–5, 7–10 | ✅ in order |
| 6, the onboarding | ❌ **it chooses for the user**: three questions (D191) and a Gym target of three stood chosen before he chose. To be empty, with «Weiter» held and a hint until he has chosen at least one question and a Gym target; Laufen optional; the second slide to name Gym's target in a sentence, as Laufen's, not as «0 von 3». **Built in the tidy-up, D197** |
| beside the list, the Gym hub | ❌ **the Muskelgruppen card on a first load**, now and then: «Noch nicht trainiert» shown to half its height, the hint under it missing; right on the next load. Two screenshots. **Not reproduced on a runner; the cause named as far as it can be and the card put there whole, D199** — whether it is gone is his to see |

## After the tidy-up — what to check again

**Build under test:** the preview of the tidy-up, the `Momentum-preview`
commit named in `release-candidates.md` (WP3 RC, after the tidy-up), at
<https://hnd7k02.github.io/Momentum-preview/>. **Remove the preview from
the Home Screen and add it again first**: an app on the Home Screen keeps
the icon it was added with.

**Check data:** the file of the day you check, from
`docs/wp3/aufraeumen/` — `momentum-pruefdaten-aufraeumen-2026-11-18.json`
on 18 November, and so on to the 21st. Made by the live app itself, as
the files of block 9 were. **Do points 1 and 2 before you import it**: the
card's finding was on a device without training.

| # | Do | Expected | Result |
|---|---|---|---|
| 1 | The preview, freshly added, **before any import**: walk the introduction | The first slide's picture reads +12 %, Mind 9 von 10, Gym 3 von 3, and is the same picture (D201). The mark beside «Momentum» is the new icon. The second slide says «Dein Wochenziel wählst du gleich.» under Gym — no «0 von 3». Bereiche, the questions and the weekly targets each open with **nothing chosen**; «Weiter» waits with its sentence — «Wähle mindestens einen Bereich.», «Wähl mindestens eine Frage oder nimm Mind ab.», «Wähl ein Wochenziel fürs Gym. Laufen ist freiwillig.» — and a target for Laufen alone does not open the way (D197) | |
| 2 | Still without data: close the app fully and open it, then Bereiche → Gym. **Five to ten times** — the finding did not show every time | The Muskelgruppen card says «Noch nicht trainiert» in full, with the hint «Ab dem dritten Übungstag …» under it, **every time** (D199). If it is cut again once, a screenshot — the cause is then another | |
| 3 | On that empty device, save one plan first (Bereiche → Gym → «Neuer Plan», one exercise is enough): without a plan «Training erfassen» opens a workout at once and there is no chooser. Then Muskelgruppen → «Training erfassen» → «Pläne verwalten» in the chooser | You stand at «Trainingspläne» on the Gym hub. Back — the gesture — returns to Muskelgruppen (D200) | |
| 4 | The same from Heute: «Session eintragen» on the Gym card → «Pläne verwalten» | You stand at «Trainingspläne». Back returns to Heute | |
| 5 | Back on sheets without fields: the legend in Muskelgruppen, «3D-Körpermodell» under Bereiche, the «i» of the weighting on Rang — open each, swipe back from the edge | The sheet closes and the screen stays where it was. A second swipe leaves the screen, as before (D187) | |
| 6 | Back on a sheet with fields: Bereiche → Mind → «Frage hinzufügen», type half a question, swipe back; open «Frage hinzufügen» again. Then the same with «Übung hinzufügen» in a workout: type into the search, swipe back, open it again | The text stands there again. Closed with the cross instead, the field opens empty, as always | |
| 7 | Import the check file of the day. A sample that nothing else moved: Heute, Muskelgruppen with one sheet, a workout with a warm-up set | As at the gate: the same number in row, sheet and body | |
| 8 | The Home Screen | The icon is the new one, as in `docs/wp3/prompts/aufraeumen-icon/vorschau-icon.png` | |
| 9 | On GitHub, in the browser, the branch `claude/momentum-wp3` | The zip, the copy of the backup and the three pictures are gone from the tree; the front page describes the app of today. `LICENSE` follows by one further fast-forward, with the record of the merge and the icon: it was committed after the merge (D202, D203) | |
| 10 | **After the go-live only:** the live app shows «Neue Version verfügbar», «Neu laden» reloads once, the data is there. Then flight mode: Heute appears, and in Muskelgruppen the body stands (D163). Then delete the repository `Momentum-preview`, if you no longer need it | | |

**Result (the owner, 2026-11-18, on his iPhone, the preview `65207c1`,
with the check file of 18 November):** "Prüfliste mit der Prüfdatei vom
18.11.: 1 bis 9 ✅". And: "Backup gemacht" — the backup of the live app
from before the update, the way back. Point 10 is open: it is the live
app's.

**After the release (D203), the icon:** the owner chose a stronger
drawing of the icon from a picture, without a preview; it is published
with the fast-forward that carries `LICENSE`. Nothing to check in the
app. **The Home Screen keeps the icon the app was added with.** To see
the new one, the app is removed and added again — and an iPhone deletes
a Home Screen app's data with the app (treat it so in any case):
**export a backup first
(Bereiche → Einstellungen → «Backup exportieren»), add the app again,
import the backup.**

Not to be repeated from the checklist of the gate: points 1 and 2 (the
live app did not change), 5 (D194), 8 and 9 (VoiceOver, less motion and
less transparency: nothing of them changed), and the measurements.
