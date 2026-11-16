# The pictures of block 7C

**Since STOP 7C** (D187) the owner's answers are built: a line begins on
the baseline of its first day (candidate A), one recorded day in the
exercise detail is a sentence, and an exercise's line is its change in the
range day by day, ending on its figure. The pictures named `nach-stop-*`
show that; the others show the block at its STOP.

Made by `scripts/verify/stage7c-shots.mjs` and, for the card,
`scripts/verify/muscle-card.mjs` (`SHOTS=<dir>`), against the production
build. The device is the one of `muscle-sheet.mjs` (`seedSheetProfile`):
every figure is invented. The pictures named `*-tagebuch-*` are made on the
diary of the earlier STOPs (`docs/wp3/stage7b/`), imported through the
interface on 16 November 2026.

## What is the app as built, and what is drawn

| Pictures | What they are |
|---|---|
| `sheet-*` | **As built.** The sheet at 320, 360, 393 and 430: with a change on both heights (`werte-unten`, `werte-oben`), at 90 days, "uneinheitlich" on both heights, too little to compare (`wenig`), not trained, declined; once in English |
| `zeilen-nachher-*` | **As built.** The ten rows with their lines in one column (D169) |
| `zeilen-vorher-*` | The same screen with the one rule of D169 taken out again — as the rows stood before the block |
| `card-<state>-loading-*`, `card-<state>-loaded-*` | **As built.** The card "Muskelgruppen" on the Gym hub in each of its six states, while its history is held back and after (D168); `-en-` in English at 320 |
| `kandidat-punkt-*` | **As built.** A single observation as a dot: in the row (`zeile`), in the sheet's chart (`sheet`) and, for one recorded day, in the exercise detail (`uebung`) |
| `kandidat-A-*`, `kandidat-B-*`, `kandidat-C-*` | **Drawn, not built** (D170): the forms a single observation could take, on a copy of the real element from its real numbers |
| `uebung-zwei-tage-*` | **As built.** The exercise detail's line with two days: it already begins at the first day |
| `eine-zahl-*` | **As built** (D176): the exercise detail and the sheet's rows with one change for an exercise |
| `zwei-zahlen-*` | **Drawn, not built** (D176): the same screens with two named changes |
| `vorher-*-tagebuch-*` | The build of the commit before the block (`54c15d4`) on the same diary: the list of every exercise under the rows, and the exercise detail with its two changes |

## A single observation (D170)

The case: a group states a figure — it has its three exercise days — but
only one comparison stands behind it, so its line has one point. The
forearms of the pictures: Hammercurls on two days, +6 %.

| | What someone reads who does not know the app | A value and not yet a course? | On the scale of ±8 %? | Calm beside nine rows? |
|---|---|---|---|---|
| **The dot** (built) | a point that floats in an empty chart — something is missing, or broken (the owner's finding) | it says "one value" and nothing about what it is compared with | yes | no: the one row whose chart looks unfinished |
| **A — a line from the baseline** | the group went from where it began up to +6 %: the first day at nought, the latest at its change | two days are two points and the shortest line there is; the sheet's two dates say that it is two days | yes | yes: the form of every other row |
| **B — words in place of a chart** | exactly what it is: "Erster Vergleich", and in the sheet a sentence with the day it began | most exactly | — | the row grows a third line and has no chart where its neighbours have one; the sheet changes its layout |
| **C — a stroke up from nought** | an amount: a pin of the height of +6 % | yes | yes | a form no other row has |

**Recommended: A**, as one rule for all three places — *a series is drawn
from the baseline of its first day*. It is what the exercise detail does
already (`uebung-zwei-tage`), so nothing new is taught. With it goes its
other half, which is the contract's own rule that no chart stands without a
value: **an exercise with one recorded day has no change, and gets the
sentence of candidate B in place of a dot on the zero line**
(`kandidat-B-uebung`). The build keeps the dot until the owner has chosen.

## One change for an exercise, or two named ones (D176)

| | What someone reads who does not know the app |
|---|---|
| **Before the block** (`vorher-*`) | "Veränderung +3 %" at the head — against what? — and "+7 %" at the end of the line, which is another comparison and has no name; the list under the rows says "+3 %", and the group's figure is made of a fourth number that stood nowhere, +4 % |
| **One change** (built, `eine-zahl-*`) | one statement, twice in the same words: "Bankdrücken +4 % Verbessert · Bester Arbeitssatz · letzte 30 Tage", in the sheet's row and at the head of the detail. Under it two sets — the last time and the time before — as facts. The group's +5 % can be read off its exercises' +4 % and +6 % |
| **Two named changes** (drawn, `zwei-zahlen-*`) | two statements, each named: "im Zeitraum · letzte 30 Tage +4 %" and "zum letzten Mal +3 %". More is said, and more has to be read: in the sheet every row carries two figures, and one exercise can be green and red at once (Dips: +5 % in the range, −8 % since last time) |

**Built and recommended: one change.** The sheet is there to answer why a
group stands as it does, and it does so with one number an exercise. Its
weak point, shown on purpose (`eine-zahl-uebung-dips-30`): the figure
compares the medians of the range and the line each day with the first, so
the end point of the line can be green and lie under the zero line. The
sentence under the chart says what the line draws.

## Looked at against mock-up 2

Fixed while looking:

- The body above the sheet showed the whole figure, small: every region
  had the box of the whole body (D185). It shows the group now.
- A group with too little to compare had no way to its exercises once the
  list under the rows was gone: the days under "Erfasst" lead to them.
- The card's text was 0.8px taller than its picture at 320 where the load
  had failed.

Different on purpose:

- **The scale is ±8 %**, where the mock-up has +12 %: D180 came after it.
- **The figure stands right of the end point**, on its height, as in the
  rows and the exercise detail; in the mock-up it stands above the point,
  where a falling line runs through it.
- **A line that crosses nought has the zero line in the middle and three
  labels**; the mock-up and the contract's sentence know only a line that
  rises.
- **An exercise's row carries its state in a word under the figure, and a
  chevron**: colour is never the only carrier of meaning, and the row leads
  somewhere.
- **The work volume from six weeks on stands on an axis**, where the
  mock-up's four bars each carry their value; a week without a working set
  is a gap with its week's name; and no bar carries a state's colour
  (D152).
- **The range stays in the sheet of a group with too little or without
  training**, so that 90 days can be asked for where 30 say nothing.
- **At 430 "Beinbeuger und Gesäss" breaks onto two lines beside its line**,
  as it did at 393 before: the column of the figures is as wide as its
  widest word in every row (D169).
