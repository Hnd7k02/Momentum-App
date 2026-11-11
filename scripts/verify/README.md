# Browser verification

Unit tests prove the rules. These prove the app: that the rules reached the
screen, that nothing is clipped on a phone, and that the accessibility tree a
screen reader consumes says what the pixels say.

Every phase of iteration 2 was signed off against these, and a phase is not
finished until they pass. They are committed rather than improvised per
session so the next run means the same thing as the last one.

## Running them

```sh
npm run build
npx vite preview --port 4173 &          # the scripts expect this exact port
node scripts/verify/phase4.mjs          # exits 0 only if every check passes
```

**The 3D timing suites run alone** — `gym-muscles`, `body`, `body-reach` and `farbregeln`
count animation frames, wait for a rotation to settle or tap a grid over the
canvas. Under other browsers running in parallel they can miss a frame
budget, which says nothing about the code; a gate is green only when each
of them passes on its own. Every other suite may run in parallel.

Chromium comes from the image at `/opt/pw-browsers/chromium`, a link to its
current build — Playwright's own default path is not populated here. The
path is named once, as `CHROMIUM` in `lib.mjs`, and every script and
`tools/render-body-preview.mjs` launch with it; `CHROMIUM_PATH=<binary>`
points them all at another one. Never run `npx playwright install`.

## What each one covers

| Script | Covers |
|---|---|
| `phase2.mjs` | Onboarding, no generic Sport domain, categories, custom questions, the 1–10 palette, Areas, the Verlauf drill-down, four widths |
| `phase2-a11y.mjs` | Accessible names on every screen, the question row's name/description split, the heatmap's table alternative |
| `phase2-legacy.mjs` | A device carrying RC2's retired Sport domain: shown read-only, never creatable |
| `phase3.mjs` | Boss Rank on Today and Rank, domain ranks, the progress bar against its own copy, mystery ranks, Boss weighting, four widths |
| `phase3-a11y.mjs` | Progress bars as named images, weight steppers, ladder state in words, reduced motion |
| `phase4.mjs` | Gym: empty state, picker, sets, several exercises, best-set display, decimal kg, progress hierarchy, body renderer, exercise history, rank integration, four widths |
| `phase4-a11y.mjs` | Set/reps/weight field names, add and remove controls, body figures decorative with the legend carrying the facts, focus order, reduced motion |
| `phase41.mjs` | The Gym rating headline, the Endurance Phase and its setback, the locked first rank, a mature unlocked state, year-to-date performance, attendance, the decay state, bodyweight entry, the custom-exercise roles and load type, four widths |
| `phase41-a11y.mjs` | Every bar named and its number printed beside it, the Endurance Phase announced as attendance rather than performance, section order (rating → year-to-date → attendance), focus order, reduced motion |
| `phase5.mjs` | Running: one-tap logging with no distance, the optional distance field and derived pace, the rating headline, the Endurance Phase, a mature unlocked state, distance ranges labelled in kilometres, the break state, no grid mechanics in the copy, four widths |
| `phase5-a11y.mjs` | Every Running bar named and its number printed beside it, the distance field's accessible name, distance ranges spoken as kilometres rather than band indices, section order, reduced motion |
| `phase7.mjs` | The one-time legacy-Sport question: reachable from Today and answered in Areas, three branches each doing what it says, nothing preselected, nothing resolved by reloading or wandering, picking without confirming applying nothing, a fresh profile never asked, four widths |
| `phase7-a11y.mjs` | The three branches as one named radio group, nothing chosen at the start, one tab stop with arrow-key movement, each branch spelling out its consequence, the confirm named and unavailable until a branch is chosen, choosing by keyboard still applying nothing, reduced motion |
| `phase8.mjs` | Pause periods: the section and what it promises, creating one, the 28-day limit and every other rule refused on screen, editing and deleting a future pause, ending a running one from today, Today's paused line, logging still working while paused, no Rest Day surface, four widths |
| `terminal.mjs` | **The domain terminal (Stage A).** Heute, Verlauf and Rang unchanged in role; on Bereiche the Mind · Gym switch as a named radio group with one tab stop and arrow keys, on one line at 393 and 320, exactly one area rendered at a time, `#/areas/<area>` deep links and an old `#/areas/food` landing on Mind, Back and Forward walking the areas visited, an unknown hash corrected, reduced motion |
| `body-reach.mjs` | **Direct body hit coverage, measured.** Taps a grid over the whole canvas at 393, 430 and 320, front and back, counting which regions respond (a miss leaves the selection alone, so only a change is a hit). `STEP=8 WIDTHS=430` for a finer probe of one width. Prints cells per region; the accepted 320px value is 9/10 at the 12px pitch. Since WP3 Stage 4 it measures a body that stands still: cells under the view pills are skipped, the pills are pressed without scrolling the module, and after a far-side hit the body is turned back before the next tap — four runs of one build had given four different results; two now give the same tallies |
| `release-proof.mjs` | **Release evidence (Stage 5).** From a cold boot with no worker: which routes fetch the viewer chunk and the model, with status codes. With the worker: what it precached, and whether Gym still shows the body offline. The mini charts measured by the contract's chart rules (§6): one shared scale of ±12 % with the zero line in the middle, a line that ends where its number says and stands at the edge beyond 12 %, the neutral data ink at 1.5px with round ends, a 3px end point in the state's colour, nothing outside 80×24, and the muscle's own colour as an 8px dot and on no chart — and what the rows tell assistive technology, plus the credits dialog |
| `qa-shots.mjs` | **The committed QA screenshots.** Writes `docs/design/muscle-map/qa/<width>-<letter>-<slug>.png` at 393, 430 and 320: the Gym workspace, the Muskelgruppen module, a measured and an untrained group selected, front/side/back, the sparklines, the SVG fallback, Laufen |
| `gym-muscles.mjs` | **The muscle module in the real Gym workspace (Stage 4).** Against the production preview: the viewer chunk fetched for Gym and for nothing else; ten analytics rows with their mini charts, one per data state (a measured line, a flat line where every point is equal, a single dot, and no chart at all for a group with no history or too little to compare); in each row the state fits the printed figure, and a group with fewer than three exercise days shows the chip, no line and its count (contract §7); one selection shared by the body, the rows and the exercise list, with body taps that select and never clear; Laufen inside the Gym workspace and its row still in Verlauf; the credits sheet; the flat figure standing in when WebGL is missing, when the chunk cannot be fetched and when the viewer throws; `document.hidden` and off-screen both stopping the frames; leaving and re-entering Gym leaving exactly one viewer; reduced motion; and a set logged at 23:29 reading as trained today. `SHOTS=<dir>` writes screenshots |
| `body.mjs` | **The 3D body viewer (muscle map, Stage 2), in isolation.** Runs against the **dev server** (`npx vite --port 5173`), because the harness page `#/dev/body` exists only there and because that is where React StrictMode double-mounts. Proves one canvas and one live WebGL context after the double mount, the three shortcuts and free rotation with the angle as the state, raycast selection of all ten regions, selection reaching the drawn colour, mount → unmount → mount leaving one viewer with no leaked context or pointer handler, an idle demand loop running zero frames, the 2× pixel-ratio cap on a 3× screen, host-sized framing with no clipped head or feet at 320/393/430 and at an arbitrary angle, reduced motion (no coast, presets settle at once), the German and English pill labels, and the fallback when the model cannot be fetched. `BODY_SHOTS=<dir>` writes screenshots |
| `geometry.mjs` | **Card geometry.** Every line of text measured against the box that clips it, on all four sides, at 393/430/320px — plus the one 16px side margin (no card inside it, a card that spans the screen exactly on it) and a document-level sideways check. Writes screenshots to a gitignored `.artifacts/` |
| `release.mjs` | **The V1 release smoke test, against the production build.** A cold load of the built bundle, the whole journey through Mind, Gym and Laufen with no Food row written, a refresh proving persistence, a backup export (Food's collections still in the format) / malformed refusal / restore round trip, five widths including desktop, and zero console errors throughout. A dev server proves none of this |
| `phase8-a11y.mjs` | Both date fields as real labelled date controls, the rejection in a live alert region, the save exposed as unavailable while invalid, saving from the keyboard alone, the paused state as a status rather than an alert, nothing disabled by a pause, reduced motion |
| `wp2-1-shots.mjs` | **Training plans and planned workouts (WP2-1).** The plan editor starting empty, the five-plan limit and its inline reason, the chooser under "Session eintragen", a draft that writes no session until a set is saved, the last-time line, an extra exercise, the session that then counts for the week, and the hub counting the day's first session (WP3, B4). Runs on a fixed day (`CLOCK=YYYY-MM-DD`, default 2026-10-14) so no check depends on the weekday. Screenshots to `docs/design/wp2-1/` |
| `wp2-2-shots.mjs` | **The Gym hub and the muscle destination (WP2-2).** Heute → Gym → hub → Muskelgruppen and back, the route and its deep link, the hub fetching neither the viewer chunk nor the model, the destination fetching both, the no-data states, the plan chooser and plan management from the hub, the week sentence. Screenshots to `docs/design/wp2-2/` |
| `wp3-sheets.mjs` | **Typing into every sheet (WP3, B1).** Every text field of every sheet — the exercise search in a workout and in the plan editor, the custom exercise's name, the question text, the run sheet's distance, duration and note — typed one character at a time, with the value and the focus asserted after each one; the field a sheet marks is focused on open, otherwise the dialog itself and never the close button; editing a question opens on the dialog, not the field; Escape closes and returns focus |
| `wp3-reload.mjs` | **Screens that change with their inputs (WP3, B2).** The 30/90-day muscle toggle showing different numbers — a group trained 44 to 80 days ago is untrained at 30 days and improved at 90, a group with two exercise days prints no figure in either, and the trend tile counts exactly the rows with a figure; the hub's week line and cards after "Fertig" without leaving the area; the Boss card after an answer, the Laufen board after a run; a Sunday-to-Monday rollover under a faked clock. Each screen is compared with what a full reload shows at that moment |
| `wp3-midnight.mjs` | **One "today" across midnight (WP3, B3).** Under a faked clock: Heute moving to the new day at local midnight with no input, the first answer of the morning stored under the new day, a tap after a suspended timer never landing on the old day, the page coming back into view, both Berlin DST nights and a São Paulo midnight that does not exist (04.11.2018); an open workout across midnight, from Heute (a plan draft) and from the hub (a free session) — never remounted, still on the day it was opened for, and the next set going to the same session; across Sunday midnight, a run sheet that saves Sunday's run on Monday and turns read-only at the next midnight from the Gestern side, and a plan draft that keeps its Sunday and says its day is closed on Tuesday (P8, D133). `ONLY=7,8` runs the named scenarios alone |
| `wp3-stage1.mjs` | **The rest of WP3 Stage 1, on a fixed day.** The hub's week line after a first session (B4), the muscle rows on the card's content edge (B5), changes that round to 0 % reading as held in the rows, the exercise list and the detail (B6), a double-tapped run logging once with an undo toast above the tab bar, stacked below the sheet layer and dismissed when a sheet opens (B9), the Boss card's 28px gap (B10), picker rows that never repeat a group, including two-part details (B11), the front raise (B12), and the start week's attendance tile reading as no data rather than "0 von 0" (D127), with screenshots of every touched screen at 393, 430 and 320 in `docs/design/wp3/stage1/` |
| `wp3-stage3.mjs` | **WP3 Stage 3b, one day back (P8), under a faked clock.** Heute \| Gestern on a Monday: the switch, "Gestern ist noch offen" leading across and gone once yesterday is answered, yesterday's answers stored for yesterday, last week named as such, the run sheet offering Sunday and Monday only, a workout opened for yesterday (D133, D138); the update day: a profile from before P8 gets the P8 era appended today, earlier snapshots untouched, yesterday read-only with the closed copy, its run read-only too (D132); a week judged when it is over: the Endurance figure unmoved at Sunday midnight, a Sunday workout logged on Monday counting, the week landing on Tuesday (D134); the Gym and Laufen break tiles saying a charge is pending on the seventh day and showing it landed two days on (D135), with screenshots of every touched screen at 393, 430 and 320 in `docs/design/wp3/stage3/` |
| `wp3-stage4.mjs` | **WP3 Stage 4, Mind and Gym, under a faked clock.** A device that had Food, seeded as the old build left it: one load switches Food off from that day (one snapshot, the Boss shared over what remains), and Food is shown nowhere — Heute, Gestern, Bereiche, Verlauf, Rang and its weights — with nothing pointing to Gestern for it, while every rating, entry and the record with its sentence are kept and a second load writes nothing (D139–D141); its backup, taken before the update, restoring onto a new device with every Food row and switched off from the import day; a new device offered Mind and Gym, Laufen included, whose Food stores stay empty; the standard questions reading "gestern" on the Gestern side, their answer groups named the same (D144); Mind \| Gym on one line (D143). Screenshots at 393, 430 and 320 in `docs/design/wp3/stage4/` |
| `design-system.mjs` | **The design system on every screen (WP3 Stage 6b).** One seeded device per width — 320, 360, 393 and 430 — on a fixed day, walked through every screen in its own world: the seven onboarding steps, Heute and Gestern, Heute's Gym tile and its running workout, the plan chooser and the run sheet opened from Heute, the workout, Verlauf and a question's detail, Rang, Bereiche for Mind and for Gym, the Gym hub with Laufen, the training plans, a sheet and the plan editor, the pause form, Einstellungen with the backup, Muskelgruppen at the top, at its rows and with a row chosen, the exercise list and one exercise's detail. On each it holds: the screen is drawn in its world and `theme-color` is that world's `--status-bar`; nothing is wider than the viewport or cut off sideways, and no box can scroll sideways (none does on purpose, so a sheet that could is a failure of its own); **every** run of visible text reads at 4.5:1 (3:1 for large text) against the pixels it is drawn on, captions included (D149) — and a chart's axis, dates and end value included, which are hidden from assistive technology but not from the eye; no text is rendered under 11px. Once per width: in Bereiche the whole screen turns with the area and turns back; the plan chooser and the run sheet opened from Heute stay light; a sheet from a Gym screen is dark; the workout stands on the one 16px margin with exactly one primary action and a quiet "Entfernen"; the exercise detail's bars start at zero — every bar is checked against the day it stands for (D163) — with zero and the largest value named on their lines, only the latest bar carries a colour and it is in view; the seven weekly-target bubbles stand in one row, round, each a target 44px high and its share of the row wide. At the end the same device is looked at 45 days on with nothing logged since: the Gym hub and Muskelgruppen with an empty range, which must say why it is empty, when the last session was, and offer exactly one primary action — and at 90 days the same sessions are back, with figures and a trend. Prints the lowest contrast measured per world and writes `text-contrast.json`. `WIDTHS=393 ONLY=gym` narrows a run; screenshots (JPEG, 2×) go to `OUT`, by default `docs/design/wp3/stage6b/`. Successor of `wp3-stage6a.mjs`, which showed two design variants at one width |
| `farbregeln.mjs` | **The colour rules of the muscle status (contract §7), on a fixed day.** A seeded history in which every group's change is known by hand, both edges of the band included. At 320, 360, 393 and 430: in every one of the ten rows the state fits the printed figure (−2 to +2 held, from ±3 the direction); a rise is green, a fall red, a held figure the text colour; a group with too little to compare shows a blue chip and no line and says how many exercise days it has, and once chosen the sentence says what is missing; an untrained group has a neutral chip and a pale dot; "n von 10" names exactly the rows with a figure and the trend above is their mean with its state in words; the hub's card says the same in ten markers; Muskelgruppen offers 30 and 90 days and opens on 30, 90 reaches what 30 does not, Verlauf keeps 7 and 30; nothing on the Gym screens is drawn in the warning yellow; ⓘ is a named 44px target that opens the legend with the contract's sentence word for word and the five states, Escape returns focus; the exercise list and the detail read ±2 % as "Gehalten" and ±3 % as a figure in its colour; an empty range says why. Every text at the rows, at the lower rows with their chips and in the sheet at 4.5:1 — each check names the runs it is about and holds that they were measured. The scan for the warning yellow reads every element and its pseudo-elements on the page — text, fills, gradients, borders, shadows, the tab bar and the open sheet — and holds that it can see the colours that are there. Then the pictures of the 3D body from the real screen, each taken once two frames in a row are the same — mixed, held only and ±3 % beside held from the front and the back, and no data — and their pixels, in CIELAB: with no data the figure is dimmed with no white and no colour, held it is white with no colour and clearly lighter; and zone by zone (chest or upper back, thigh, calf) against the figure in which the same groups are held: ±3 % lies at least 5 ΔE away in the median of every lit pixel, towards green and towards red, while the calves held in both are the same white; untrained calves are clearly darker and without colour; a held back is the same white; too little to compare is bluer than held; +9 % is greener than +3 %. Runs alone (it draws the body). `SHOTS=<dir>`, by default `docs/design/wp3/farbregeln/`; `WIDTHS=393`, `NO_BODY=1` |
| `stage6-blur-cost.mjs` | **WP3 Stage 6**, the frame cost of glass over the 3D canvas while the body turns — as built (the body's card solid), the card as glass, the view pills as glass too, a blurred layer over the body — on SwiftShader, so relative only; prints a table, no exit code |
| `wp3-stage2.mjs` | **WP3 Stage 2, the workout flow, on a fixed day.** A free workout as a draft until its first saved set — opening, picking and leaving store nothing and count nothing (B7, D128), a picked exercise waits in a pending row; "Übung hinzufügen" in a bar at the foot of the workout at either end of the scroll, removing an exercise as a worded control unlike a set's minus (B8), both removals undone exactly with the toast above the bar, extras staying extras and the plan unchanged (D131); a weight typed right after the reps stored too; the running workout on Heute above the Boss card under one accessible name, as a plan percentage that excludes extras or as counts, continued with one tap, the hub's Training card saying the same, and "Fertig" recording when it finished (D129); kg \| lb in Einstellungen with 135 lb and 45 lb round-tripping through grams, the last-time line, best set, bodyweight and exercise detail in lb, an untouched field keeping its grams and 62.5 kg unchanged (D130), with screenshots of every touched screen at 393, 430 and 320 in `docs/design/wp3/stage2/` |

Two things worth knowing before writing another suite, both of which produced
false failures here first:

- **Chrome's accessibility tree calls `role="img"` an `image`.** Filtering the
  CDP tree for `img` silently finds nothing and passes an "everything is
  named" check by vacuum.
- **Reduced motion collapses durations to `0.001ms`, not to zero.** That is
  the standard idiom — it keeps `transitionend` firing — so a check for
  `> 0` counts every transition in the app. Assert that no keyframe animation
  runs and that no duration is long enough to perceive.

One found in this pass, and it is the reason `geometry.mjs` exists:

- **`scrollWidth` and a right-edge comparison cannot see a leftward or upward
  clip.** `clipped()` in `lib.mjs` measures `child.right − clipper.right`,
  which is only ever positive when content escapes to the right. A card with
  `padding: 0`, a 22px radius and `overflow: hidden` cuts the *first* glyph of
  its top line and the *last* of its bottom line, symmetrically, and every
  suite here reported zero clipping while it did. Rectangle comparison on all
  four sides is the only check that sees it, and "inside" is not enough —
  a corner radius removes far more than a pixel, so the harness asks for
  `MIN_INSET` of clear space rather than for non-negative overlap.

Two more, found in phase 6:

- **A page-wide selector for a shared control counts every instance of it.**
  Food's rating (retired in WP3 Stage 4) used the same `ScaleAnswer` every
  scale question renders, so "ten radios, one tab stop" was really thirty
  and three. Scope to the card under test, not to the document.
- **Two strings can differ by one word and match the same regex.** The legacy
  card's description ("Deine Trainings aus der früheren Version.") and the
  question's lead line read almost identically, and a page-wide text match
  finds the description first. Scope to the element under test.
- **A button name can be a prefix of another.** `getByRole('button', { name:
  'Eintragen' })` also matches "Essen eintragen", and `'Heute'` matches a
  question containing the word. Use `exact: true`, or address the tab bar by
  `.tab-bar__tab`.

## Conventions

`lib.mjs` holds the shared pieces: `CHROMIUM` (the one place the browser
binary is named), `check`/`summary` (which set the exit code), `onboard`
(walks the current onboarding flow), `seed` (writes history straight into
IndexedDB), `clipped`, `smallTargets` and `textContrast` (the WCAG ratio of
every visible run of text against the pixels it is drawn on).

The rules a search can hold — no colour, font size, layer or duration
outside `tokens.css` — are unit tests (`src/styles/designRules.test.ts`).
What needs a browser is `design-system.mjs`.

Two things `smallTargets` knows that a naive check does not, both of which
produced false failures before they were handled: a control may grow its hit
area with an absolutely positioned `::before` at a *negative* inset — that is
how a 31px iOS switch is a 45px target — and a hairline separator is also an
absolutely positioned `::before`, which must not be counted. Visually hidden
controls, such as the file input behind an import button, are operated through
the visible control that labels them and are skipped.

## What they do not cover

Real VoiceOver, real iOS Safari, real touch. No Apple hardware is available in
this environment. What is verified is the layer VoiceOver consumes — the
computed accessibility tree, names, descriptions, roles and focus order — not
VoiceOver itself. Say that plainly rather than implying otherwise.
