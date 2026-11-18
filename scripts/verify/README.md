# Browser verification

Unit tests prove the rules. These prove the app: that the rules reached the
screen, that nothing is clipped on a phone, and that the accessibility tree a
screen reader consumes says what the pixels say.

Every phase of iteration 2 was signed off against these, and a phase is not
finished until they pass. They are committed rather than improvised per
session so the next run means the same thing as the last one.

## Running them

**All of them, by one command** (block 9, step 1):

```sh
npm run verify                    # build, serve, run every suite, print the table
npm run verify -- --no-build      # with the builds that are there
ONLY=phase2,release npm run verify   # a selection
```

`run-all.mjs` builds the app, the preview build with a database of its own
(`dist-preview`) and the live state `e30becd` — the default branch's head,
in `LIVE_DIR` (default `<tmp>/momentum-live-e30becd`), from `git archive`,
built once and kept (`--rebuild-live` builds it again). It serves them on
4173, 4174 and 4273 **as GitHub Pages serves a site** (`pages-server.mjs`,
below) and Vite's dev server on 5173, refuses a port that is already taken, runs the ordinary suites `JOBS` at a time (default 2) and
then the 3D suites one by one with nothing beside them, writes every
suite's pictures and log under `.artifacts/verify/<run>/` — never into
`docs/` — prints the table (suite, passed of total, duration, result) and
writes it as `table.md` and `results.json`. **It exits 1 if anything
failed**: a build, a server or one check. **There is no known red check**
since the tidy-up of WP3 (D163, D200); `KNOWN_RED` in `run-all.mjs` is
where one would be named, marked in the table and still failing the run.

**Why the builds are no longer served by `vite preview`.** For months one
check was red: `release-proof.mjs`, "offline, Gym still shows the 3D
body". The worker had the body's chunk in its cache, a plain request for
it answered 200 — and offline the first import of it failed, and the flat
figure stood where the body should. The cause was the test server.
`vite preview` answers every file with `Vary: Origin`. A cache keeps that
header with the stored response and does not hand the response to a
request that sends another `Origin` than the one it was stored under. The
worker precaches with a plain request, which carries no `Origin`; a
module import carries one, even on the same origin (read off the
requests: `BodyViewer-*.js` with `Origin`, the model without). So the
cache refused the chunk to its own import — unless Muskelgruppen had been
opened online once, when the import itself had stored it. **GitHub Pages
sends no `Vary: Origin`**, so the app on its real address was never
affected; the check told a truth about `vite preview`. The proof both
ways: against `pages-server.mjs` the suite is 28 of 28, three runs of
three; against the same server started with `--vary Origin` the same
check is red. The app was not changed. What stays the owner's is the
check in flight mode after the go-live (D163): an installed app on an
iPhone is not a runner's Chromium.

**On GitHub** `.github/workflows/verify-wp3.yml` runs on every push to
`claude/momentum-wp3`: `npm ci`, `tsc -b`, `npm run test`, `npm run verify`
in Chromium, and the WebKit selection below. It publishes nothing and has
no right to; `deploy.yml` is untouched. There the workflow installs the
browsers at the version of `playwright-core` and points the suites at
them (`CHROMIUM_PATH`; WebKit from Playwright's own place).

**One at a time**, as before:

```sh
npm run build
node scripts/verify/pages-server.mjs &  # dist/ at 127.0.0.1:4173/Momentum-App/, as Pages serves it
node scripts/verify/phase4.mjs          # exits 0 only if every check passes
```

Where a suite's own description below says "the production preview" or
`vite preview --port 4173`, read: the built app on that port — since the
tidy-up from `pages-server.mjs`. `update-in-place.mjs` still starts
`vite preview` for the two builds it swaps on its own port; it tests the
update, not the offline cache.

**The 3D timing suites run alone** — `gym-muscles`, `muscle-sheet`, `body`,
`body-reach` and `farbregeln` count animation frames, wait for a rotation to
settle, drag a sheet with a finger or tap a grid over the canvas. Under other browsers running in parallel they can miss a frame
budget, which says nothing about the code; a gate is green only when each
of them passes on its own. Every other suite may run in parallel.

Chromium comes from the image at `/opt/pw-browsers/chromium`, a link to its
current build — Playwright's own default path is not populated here. The
path is named once, as `CHROMIUM` in `lib.mjs`, and every script and
`tools/render-body-preview.mjs` launch with it; `CHROMIUM_PATH=<binary>`
points them all at another one. Never run `npx playwright install`.

### WebKit (block 9, step 3)

`BROWSER=webkit npm run verify` runs, on GitHub, the suites that launch
through `launch()` in `lib.mjs` (`WEBKIT_SUITES`). **It is an early
warning: WebKit under Linux is not Safari on an iPhone**, and the owner's
check on the phone decides. A cloud session has Chromium only and never
installs a browser.

| Suite | In WebKit | Why |
|---|---|---|
| `release.mjs` | yes | the whole journey through the app |
| `wp3-sheets.mjs` | yes | typing into every sheet |
| `terminal.mjs` | yes | the areas |
| `design-system.mjs` | yes, at 393 | every screen's text on its pixels |
| `muscle-card.mjs` | yes | the hub's Muskelgruppen card in its six states: its text against the same card painted from nothing (the tidy-up, D199) — the nearest a runner comes to the owner's finding on the iPhone. It did not show the finding there either, before the fix: 240 of 240 |
| `muscle-sheet.mjs` | parts 1, 4 and 5 | Muskelgruppen with the sheet: the same number in row, sheet and body; one change per exercise; the lines in one column. Parts 2 and 3 drag the sheet with a finger through the Chromium protocol (a CDP session) and stay in Chromium. On GitHub's runner WebKit has WebGL: the viewer runs there and the body's states are checked as in Chromium (204/204 in the first run) |
| `gym-muscles.mjs`, `body.mjs` | no | they count frames and turn the body through the Chromium protocol; the body's frames and draw calls are Chromium's to measure |
| `body-reach.mjs`, `farbregeln.mjs` | no | they read the body's picture pixel by pixel on a grid tuned to Chromium's rendering |
| `phase*-a11y.mjs` | no | they read the accessibility tree through the Chromium protocol |
| every other suite | not yet | they run in Chromium; nothing in them is bound to it, and they can join the list when WebKit is worth the time on GitHub |

## What each one covers

| Script | Covers |
|---|---|
| `phase2.mjs` | Onboarding, no generic Sport domain, categories, custom questions, the 1–10 palette, Areas, the Verlauf drill-down, four widths |
| `phase2-a11y.mjs` | Accessible names on every screen, the question row's name/description split, the heatmap's table alternative |
| `phase2-legacy.mjs` | A device carrying RC2's retired Sport domain: shown read-only, never creatable |
| `phase3.mjs` | Boss Rank on Today and Rank, domain ranks, the progress bar against its own copy, mystery ranks, Boss weighting, four widths |
| `phase3-a11y.mjs` | Progress bars as named images, weight steppers, ladder state in words, reduced motion |
| `phase4.mjs` | Gym: empty state, picker, sets, several exercises, best-set display, decimal kg, progress hierarchy, body renderer, exercise history, rank integration, four widths **Since block 7C** (D185) a tap on a group opens its sheet with the group's exercises — it used to filter a list under the rows — and Back from an exercise leads into that sheet. |
| `phase4-a11y.mjs` | Set/reps/weight field names, add and remove controls, body figures decorative with the legend carrying the facts, focus order, reduced motion **Since block 7C** the exercise history is reached through the group's sheet, and the sheet is held as a named dialog with named controls, a named grabber, and a description of its chart or the sentence that stands for it. |
| `phase41.mjs` | The Gym rating headline, the Endurance Phase and its setback, the locked first rank, a mature unlocked state, year-to-date performance, attendance, the decay state, bodyweight entry, the custom-exercise roles and load type, four widths. The setback reads 1.5 of 4 weeks from Tuesday to Sunday and 0.5 on a Monday: the week that ended yesterday is still in progress then and is judged from Tuesday 00:00 (D134) — until block 7B the check asked for 1.5 on every day and failed on every Monday |
| `phase41-a11y.mjs` | Every bar named and its number printed beside it, the Endurance Phase announced as attendance rather than performance, section order (rating → year-to-date → attendance), focus order, reduced motion |
| `phase5.mjs` | Running: one-tap logging with no distance, the optional distance field and derived pace, the rating headline, the Endurance Phase, a mature unlocked state, distance ranges labelled in kilometres, the break state, no grid mechanics in the copy, four widths |
| `phase5-a11y.mjs` | Every Running bar named and its number printed beside it, the distance field's accessible name, distance ranges spoken as kilometres rather than band indices, section order, reduced motion |
| `phase7.mjs` | The one-time legacy-Sport question: reachable from Today and answered in Areas, three branches each doing what it says, nothing preselected, nothing resolved by reloading or wandering, picking without confirming applying nothing, a fresh profile never asked, four widths |
| `phase7-a11y.mjs` | The three branches as one named radio group, nothing chosen at the start, one tab stop with arrow-key movement, each branch spelling out its consequence, the confirm named and unavailable until a branch is chosen, choosing by keyboard still applying nothing, reduced motion |
| `phase8.mjs` | Pause periods: the section and what it promises, creating one, the 28-day limit and every other rule refused on screen, editing and deleting a future pause, ending a running one from today, Today's paused line, logging still working while paused, no Rest Day surface, four widths |
| `terminal.mjs` | **The domain terminal (Stage A).** Heute, Verlauf and Rang unchanged in role; on Bereiche the Mind · Gym switch as a named radio group with one tab stop and arrow keys, on one line at 393 and 320, exactly one area rendered at a time, `#/areas/<area>` deep links and an old `#/areas/food` landing on Mind, Back and Forward walking the areas visited, an unknown hash corrected, reduced motion |
| `body-reach.mjs` | **Direct body hit coverage, measured.** Taps a 12px grid over the body and 24px to either side of it at 393, 430, 360 and 320, from the front and from the back, counting which regions respond (a miss leaves the selection alone, so only a change is a hit). Three checks a width since block 7B (contract §8): **10 of 10** — the accepted value for 320px used to be 9 of 10, and a tap now reaches a group from twelve pixels beside it; from the front every group that faces the front and from the back every group that faces the back; and **no tap turned the body** — until block 7B a hit on the far side turned the body and the suite put it back before the next tap; nothing is put back any more, and one tap that meets a turned body fails the suite. Cells under the buttons at the top of the stage are left out. No two taps in a row are a double tap, which would set the view back: the columns are walked every third one, and where the cells between two taps were left out — at 320 the buttons leave two columns of the top rows, 24px apart — the second waits until it is too late to be one. `STEP=8 WIDTHS=430` for a finer probe of one width **Since block 7C** a hit is a tap after which a sheet stands — its group is read from the row it marks — and the sheet is closed before the next tap; the grid runs under reduced motion, where the camera jumps, so that every tap finds the whole body. The counts per group are higher (two taps in a row on one group are two hits); the groups reached are held to the same rule. |
| `release-proof.mjs` | **Release evidence (Stage 5).** From a cold boot with no worker: which routes fetch the viewer chunk and the model, with status codes. With the worker: what it precached, and whether Gym still shows the body offline. The mini charts measured by the contract's chart rules (§6): one shared scale of ±12 % with the zero line in the middle, a line that ends where its number says and stands at the edge beyond 12 %, the neutral data ink at 1.5px with round ends, a 3px end point in the state's colour, nothing outside 80×24, and the muscle's own colour as an 8px dot and on no chart — and what the rows tell assistive technology, plus the credits dialog **Since block 7C** the ten rows are buttons that open a dialog and none is a toggle; a row opens a modal dialog under the group's name, and Escape closes it with nothing left chosen. **Since the tidy-up** the offline check is green: the build is served as GitHub Pages serves it, and the red of months was `vite preview`'s `Vary: Origin` (above, D163). |
| `qa-shots.mjs` | **The committed QA screenshots.** Writes `docs/design/muscle-map/qa/<width>-<letter>-<slug>.png` at 393, 430 and 320: the Gym workspace, the Muskelgruppen module, a measured and an untrained group selected, front/side/back, the sparklines, the SVG fallback, Laufen **Since block 7C** the picture of a chosen group is its sheet, opened and closed again. |
| `gym-muscles.mjs` | **The muscle module in the real Gym workspace.** Against the production preview: the viewer chunk fetched for Muskelgruppen and for nothing else; ten analytics rows with their mini charts, one per data state; in each row the state fits the printed figure, and a group with fewer than three exercise days shows the chip, no line and its count (contract §7); one selection shared by the body, the rows and the exercise list, with body taps that select and never clear; Laufen inside the Gym workspace and its row still in Verlauf; the credits sheet; the flat figure standing in when WebGL is missing, when the chunk cannot be fetched and when the viewer throws; `document.hidden` and off-screen both stopping the frames; leaving and re-entering Gym leaving exactly one viewer; reduced motion; a set logged at 23:29 reading as trained today. **And the stage of block 7B** (contract §8, §11, §14): from the front a tap on the trapezius selects the back and the angle stays 0, while the back's row turns the body; at 320, 360, 393 and 430 the stage takes 55 % of the screen's height from edge to edge, without a card or glass, with the header in 17px, the range and the metrics strip above it and nothing else; the strip's three cells stand 1.35 : 1 : 1, each a label in 11px, a value in 20px and a line beneath, nothing cut, and they count what the rows print — "Gewertet" the rows with a figure, "Stärkster" the row with the largest rise; the views and the reset are 44px targets at the stage's top; head and feet clear the stage's edge from the front, the side and the back, read off the drawn picture; the canvas lets the page scroll a drag that begins up or down. With the model held back on its way the stage shows the body's still on its middle axis at its full height, the rows are there already, and once the first picture is drawn the body stands where its still stood, to within two pixels. A flick followed at once by a tap on the legend's button: the sheet stands only once the body is held, the coast ended far short of where it would have run, **under the open sheet no animation frame fires and no draw call is made**, and closing it lifts the pause without starting the coast again; the same for the sheet behind the strip's first cell, which waits for a travel to finish. A context lost on purpose: the still stands in, a new canvas shows the body again; and where no new context can be made the flat figure stands in with the rows and the one selection. The measuring display: off and nothing stored until switched on; its switch in the settings in everyday words; the switch under one key in local storage and nowhere in any store of the database; on again after a restart, under the stage and beside the canvas; every value of step 1 in the copied text with its unit — the load in three legs with their sources, the turning (after a turn by a finger that keeps moving, `fingerTurn`), the idle second with no frame, in the copy and in the panel on the screen, twelve draw calls, 50,488 triangles, one texture of 768 × 1024, the pixel ratio, the display's rate, device, visible area and the stage's share; and with it on, an idle body still draws nothing. And scrolling the page with the body in view draws no frame of it. `SHOTS=<dir>` writes screenshots **Since block 7C**: a row or a tap on the body opens the group's sheet; a tap on the body above the sheet closes it and chooses nothing; closing leaves nothing chosen and the angle where it was. Under the sheet no frame arises and a change of the range draws exactly one (frames are counted by task — under a zoom's window a frame can be eleven draw calls, not twelve); the sheet is solid on a scrim that neither dims nor blurs; the stage's buttons are out of sight; the fingers' zoom is replaced and the stage is at 1.0 again after closing; an exercise opened on top draws nothing; a tap that changes nothing draws nothing (D184); under reduced motion the camera jumps. |
| `body.mjs` | **The 3D body viewer, in isolation.** Runs against the **dev server** (`npx vite --port 5173`), because the harness page `#/dev/body` exists only there and because that is where React StrictMode double-mounts. Proves one canvas and one live WebGL context after the double mount, the three shortcuts and free rotation with the angle as the state, selection reaching the drawn colour, mount → unmount → mount leaving one viewer with no leaked context or pointer handler, an idle demand loop running zero frames and making no draw call, the 2× pixel-ratio cap on a 3× screen, framing with no clipped head or feet at 320/393/430 and at an arbitrary angle, reduced motion (no coast, shortcuts and the reset jump), the German and English labels, and the fallback when the model cannot be fetched. **And the rules of block 7B** (contract §8, §10, §14). *A tap never turns the body*: after each tap of the two grid passes the angle is the pass's view — until 7B the pass put the body back after a hit on the far side — and all ten regions are reached. *The motion counts time*: a flick with the times written on its events (40px in 80 ms) runs on by the 76° its speed gives, to the degree; on a small canvas, with every animation frame, with every second and with every third, a travel over 180° takes the 710 ms and a coast from 275° a second the 1265 ms its equation gives — measured in the page from the moment the motion is asked for to the last frame that fires, never less and at most two frames more, with the time a step's cap took away known and taken off — and each ends on the same angle. *A render of its host with nothing changed draws no frame.* *Twelve pixels*: against the drawn silhouette a tap 9px beside the forearm selects it and one 16px beside it selects nothing; the wrist is read off the picture where the arm's tone changes, a tap in the middle of the hand and one in the middle of the head select nothing, and one on the hand 6px below the wrist selects the forearm. *Zoom*: two fingers to 1.5, no further than 1.8 and back to 1.0, the picture under them 1.8 times as large, the page not zoomed, nothing selected and nothing turned, a finger that stays down after a pinch turning nothing; with the calves chosen in the list the window moves to them at the same zoom. *Reset*: the button and a double tap set back the angle, the zoom and the tilt (read off the crown's row), the first tap of the pair selects and the selection stays, and two taps half a second apart are two taps. *The pause*: a viewer at rest is held at once and then runs no frame and makes no draw call; a selection made meanwhile is drawn in exactly twelve draw calls — one frame — and shows the whole change; a selection that faces away does not turn a held body and its travel begins when the pause ends; a coast ends at once and does not start again; a travel in flight is finished first. *A lost context*: lost while the body is turned and zoomed, the view is back at the start at once — where the still that stands in shows the body — and while the still stands in no pointer handler is on the canvas and a drag turns nothing; given back, the same canvas draws again from the front and answers a tap; kept lost, a new canvas takes its place with one set of pointer handlers. And no page of the suite throws an error nothing caught. `BODY_SHOTS=<dir>` writes screenshots |
| `geometry.mjs` | **Card geometry.** Every line of text measured against the box that clips it, on all four sides, at 393/430/320px — plus the one 16px side margin (no card inside it, a card that spans the screen exactly on it) and a document-level sideways check. Writes screenshots to a gitignored `.artifacts/` |
| `release.mjs` | **The V1 release smoke test, against the production build.** A cold load of the built bundle, the whole journey through Mind, Gym and Laufen with no Food row written, a refresh proving persistence, a backup export (Food's collections still in the format) / malformed refusal / restore round trip, five widths including desktop, and zero console errors throughout. A dev server proves none of this |
| `phase8-a11y.mjs` | Both date fields as real labelled date controls, the rejection in a live alert region, the save exposed as unavailable while invalid, saving from the keyboard alone, the paused state as a status rather than an alert, nothing disabled by a pause, reduced motion |
| `wp2-1-shots.mjs` | **Training plans and planned workouts (WP2-1).** The plan editor starting empty, the five-plan limit and its inline reason, the chooser under "Session eintragen", a draft that writes no session until a set is saved, the last-time line, an extra exercise, the session that then counts for the week, and the hub counting the day's first session (WP3, B4). Runs on a fixed day (`CLOCK=YYYY-MM-DD`, default 2026-10-14) so no check depends on the weekday. Screenshots to `docs/design/wp2-1/` |
| `wp2-2-shots.mjs` | **The Gym hub and the muscle destination (WP2-2).** The tab and the area lead to the hub, the hub's card to Muskelgruppen and back, the route and its deep link, the hub fetching neither the viewer chunk nor the model, the destination fetching both, the no-data states, the plan chooser and plan management from the hub, the week sentence. **And the way from Heute since block 7B** (D161): Heute's Gym label is named "Muskelgruppen öffnen" — until 7B "Gym öffnen", leading to the hub — fetches nothing 3D itself and lands on Muskelgruppen directly; the back control and the browser's own Back return to Heute; after a link straight to the address the back control leads to the hub; the row at the foot of Muskelgruppen leads to the hub on a target of its own, although Back would have led to Heute, and Back from the hub returns to Muskelgruppen; from the empty Muskelgruppen opened from Heute the plan chooser stands over a held body and "Pläne verwalten" leads to the hub, not back to Heute. Screenshots to `docs/design/wp2-2/` **Since block 7C** no list of exercises stands under the rows; a row opens its group's sheet and is marked as open, the group's exercises stand in it, and the browser's Back first closes the sheet and stays on Muskelgruppen. **Since the tidy-up** (D163, D200) «Pläne verwalten» is held to its end: from the empty Muskelgruppen and from Heute's Gym card it stands at the training plans on the hub with the focus on their heading, Back returns to Muskelgruppen or to Heute, and the hub opened by its tab afterwards starts at its top. |
| `wp3-sheets.mjs` | **Typing into every sheet (WP3, B1).** Every text field of every sheet — the exercise search in a workout and in the plan editor, the custom exercise's name, the question text, the run sheet's distance, duration and note — typed one character at a time, with the value and the focus asserted after each one; the field a sheet marks is focused on open, otherwise the dialog itself and never the close button; editing a question opens on the dialog, not the field; Escape closes and returns focus |
| `wp3-reload.mjs` | **Screens that change with their inputs (WP3, B2).** The 30/90-day muscle toggle showing different numbers — a group trained 44 to 80 days ago is untrained at 30 days and improved at 90, a group with two exercise days prints no figure in either, and the trend tile counts exactly the rows with a figure; the hub's week line and cards after "Fertig" without leaving the area; the Boss card after an answer, the Laufen board after a run; a Sunday-to-Monday rollover under a faked clock. Each screen is compared with what a full reload shows at that moment **Since block 7C** the exercises compared between 30 and 90 days are those of the sheets of Brust and Schultern, and at 30 days the sheet of Schultern lists nothing and says when they were last trained. |
| `wp3-midnight.mjs` | **One "today" across midnight (WP3, B3).** Under a faked clock: Heute moving to the new day at local midnight with no input, the first answer of the morning stored under the new day, a tap after a suspended timer never landing on the old day, the page coming back into view, both Berlin DST nights and a São Paulo midnight that does not exist (04.11.2018); an open workout across midnight, from Heute (a plan draft) and from the hub (a free session) — never remounted, still on the day it was opened for, and the next set going to the same session; across Sunday midnight, a run sheet that saves Sunday's run on Monday and turns read-only at the next midnight from the Gestern side, and a plan draft that keeps its Sunday and says its day is closed on Tuesday (P8, D133). `ONLY=7,8` runs the named scenarios alone |
| `wp3-stage1.mjs` | **The rest of WP3 Stage 1, on a fixed day.** The hub's week line after a first session (B4), the muscle rows on the card's content edge (B5), changes that round to 0 % reading as held in the rows, the exercise list and the detail (B6), a double-tapped run logging once with an undo toast above the tab bar, stacked below the sheet layer and dismissed when a sheet opens (B9), the Boss card's 28px gap (B10), picker rows that never repeat a group, including two-part details (B11), the front raise (B12), and the start week's attendance tile reading as no data rather than "0 von 0" (D127), with screenshots of every touched screen at 393, 430 and 320 in `docs/design/wp3/stage1/` **Since block 7C** (B6) an exercise that was held reads "0 %" with "Gehalten" in the sheet of its group, and the exercise detail's one change is that figure with no second change beside it (D176). |
| `wp3-stage3.mjs` | **WP3 Stage 3b, one day back (P8), under a faked clock.** Heute \| Gestern on a Monday: the switch, "Gestern ist noch offen" leading across and gone once yesterday is answered, yesterday's answers stored for yesterday, last week named as such, the run sheet offering Sunday and Monday only, a workout opened for yesterday (D133, D138); the update day: a profile from before P8 gets the P8 era appended today, earlier snapshots untouched, yesterday read-only with the closed copy, its run read-only too (D132); a week judged when it is over: the Endurance figure unmoved at Sunday midnight, a Sunday workout logged on Monday counting, the week landing on Tuesday (D134); the Gym and Laufen break tiles saying a charge is pending on the seventh day and showing it landed two days on (D135), with screenshots of every touched screen at 393, 430 and 320 in `docs/design/wp3/stage3/` |
| `wp3-stage4.mjs` | **WP3 Stage 4, Mind and Gym, under a faked clock.** A device that had Food, seeded as the old build left it: one load switches Food off from that day (one snapshot, the Boss shared over what remains), and Food is shown nowhere — Heute, Gestern, Bereiche, Verlauf, Rang and its weights — with nothing pointing to Gestern for it, while every rating, entry and the record with its sentence are kept and a second load writes nothing (D139–D141); its backup, taken before the update, restoring onto a new device with every Food row and switched off from the import day; a new device offered Mind and Gym, Laufen included, whose Food stores stay empty; the standard questions reading "gestern" on the Gestern side, their answer groups named the same (D144); Mind \| Gym on one line (D143). Screenshots at 393, 430 and 320 in `docs/design/wp3/stage4/` |
| `design-system.mjs` | **The design system on every screen (WP3 Stage 6b).** One seeded device per width — 320, 360, 393 and 430 — on a fixed day, walked through every screen in its own world: the seven onboarding steps, Heute and Gestern, Heute's Gym tile and its running workout, the plan chooser and the run sheet opened from Heute, the workout, Verlauf and a question's detail, Rang, Bereiche for Mind and for Gym, the Gym hub with Laufen, the training plans, a sheet and the plan editor, the pause form, Einstellungen with the backup, Muskelgruppen at the top, at its rows and with a row chosen, the exercise list and one exercise's detail. On each it holds: the screen is drawn in its world and `theme-color` is that world's `--status-bar`; nothing is wider than the viewport or cut off sideways, and no box can scroll sideways (none does on purpose, so a sheet that could is a failure of its own); **every** run of visible text reads at 4.5:1 (3:1 for large text) against the pixels it is drawn on, captions included (D149) — and a chart's axis, dates and end value included, which are hidden from assistive technology but not from the eye; no text is rendered under 11px. Once per width: in Bereiche the whole screen turns with the area and turns back; the plan chooser and the run sheet opened from Heute stay light; a sheet from a Gym screen is dark; the workout stands on the one 16px margin with exactly one primary action and a quiet "Entfernen"; the exercise detail draws a line (D175; bars until STOP 5b) — every point is checked against the day it stands for, as that day's change since the first day shown, on a scale that reaches 12 % at the least, widens in steps of six and cuts no day off, with the zero line and the scale's reach named on their lines, the line neutral, only the end point in the state's colour, its value beside it and in view; the seven weekly-target bubbles stand in one row, round, each a target 44px high and its share of the row wide. At the end the same device is looked at 45 days on with nothing logged since: the Gym hub and Muskelgruppen with an empty range, which must say why it is empty, when the last session was, and offer exactly one primary action — and at 90 days the same sessions are back, with figures and a trend. Prints the lowest contrast measured per world and writes `text-contrast.json`. `WIDTHS=393 ONLY=gym` narrows a run; screenshots (JPEG, 2×) go to `OUT`, by default `docs/design/wp3/stage6b/`. Successor of `wp3-stage6a.mjs`, which showed two design variants at one width **Since block 7C** the muscle sheet is among the measured screens — on both heights, at 90 days, "uneinheitlich", with too little to compare, and not trained: it opens on two thirds, name, change, range and chart stand above the fold, the grabber leads to 92 %, twelve to thirteen weeks fit, no chart stands without a figure; the exercise detail's line ends in a colour with no figure beside it, and its one change at the head is the sheet's. |
| `farbregeln.mjs` | **The colour rules of the muscle status (contract §7), on a fixed day.** A seeded history in which every group's change is known by hand, both edges of the band included — by the rule the device compares a window with (D150), read off the snapshot its onboarding wrote: the medians of the last and the first exercise days (the chest's five days +7 %, the quadriceps' four −6 %) or, on a build without the field or with the switch the other way, the last day against the first (+9 %, −8 %, what this suite stated until Stage 5b). At 320, 360, 393 and 430: in every one of the ten rows the state fits the printed figure (−2 to +2 held, from ±3 the direction); a rise is green, a fall red, a held figure the text colour; a group with too little to compare shows a blue chip and no line and says how many exercise days it has, and once chosen the sentence says what is missing; an untrained group has a neutral chip and a pale dot; "n von 10" names exactly the rows with a figure and the trend above is their mean with its state in words; the hub's card says the same in ten markers; Muskelgruppen offers 30 and 90 days and opens on 30, 90 reaches what 30 does not, Verlauf keeps 7 and 30; nothing on the Gym screens is drawn in the warning yellow; ⓘ is a named 44px target that opens the legend with the contract's sentence word for word and the five states, Escape returns focus; the exercise list and the detail read ±2 % as "Gehalten" and ±3 % as a figure in its colour; an empty range says why. Every text at the rows, at the lower rows with their chips and in the sheet at 4.5:1 — each check names the runs it is about and holds that they were measured. The scan for the warning yellow reads every element and its pseudo-elements on the page — text, fills, gradients, borders, shadows, the tab bar and the open sheet — and holds that it can see the colours that are there. Then the pictures of the 3D body from the real screen, each taken once two frames in a row are the same — mixed, held only and ±3 % beside held from the front and the back, and no data — and their pixels, in CIELAB, read zone by zone (chest or upper back, thigh, calf, feet) as the median tone of the lit pixels — the light of D165 has no tone mapping, so a tone is no longer one flat value and is never read as a share of pixels above a fixed lightness: with no data chest, thighs and calves are in the dimmed tone with no colour; held they are white with no colour, from the front and from the back, and every zone is at least 20 L* lighter than the same zone untrained; the feet — the inert zone (D166) — have one tone in both figures, neutral, and clearly lighter than untrained calves; and against the figure in which the same groups are held: ±3 % lies at least 5 ΔE away in the median of every lit pixel, towards green and towards red, while the calves held in both are the same white; untrained calves are clearly darker and without colour; a held back is the same white; too little to compare is bluer than held; the chest's larger rise is greener than +3 %. Runs alone (it draws the body). `SHOTS=<dir>`, by default `docs/design/wp3/farbregeln/`; `WIDTHS=393`, `NO_BODY=1` **Since block 7C** a group's sentence is read in its sheet and an exercise's state beside its figure in the sheet's row — "+1 %" with "Gehalten", "+2 %" with "Verbessert", "−2 %" with "Gehalten", "−3 %" with "Zurückgegangen" — and the exercise detail's head figure is the sheet's. |
| `stage6-blur-cost.mjs` | **WP3 Stage 6**, the frame cost of glass over the 3D canvas while the body turns — as built (the stage without a surface, its buttons solid — until block 7B the body's card, solid), the stage as glass, the view pills as glass too, a blurred layer over the body — on SwiftShader, so relative only; prints a table, no exit code |
| `wp3-stage2.mjs` | **WP3 Stage 2, the workout flow, on a fixed day.** A free workout as a draft until its first saved set — opening, picking and leaving store nothing and count nothing (B7, D128), a picked exercise waits in a pending row; "Übung hinzufügen" in a bar at the foot of the workout at either end of the scroll, removing an exercise as a worded control unlike a set's minus (B8), both removals undone exactly with the toast above the bar, extras staying extras and the plan unchanged (D131); a weight typed right after the reps stored too; the running workout on Heute above the Boss card under one accessible name, as a plan percentage that excludes extras or as counts, continued with one tap, the hub's Training card saying the same, and "Fertig" recording when it finished (D129); kg \| lb in Einstellungen with 135 lb and 45 lb round-tripping through grams, the last-time line, best set, bodyweight and exercise detail in lb, an untouched field keeping its grams and 62.5 kg unchanged (D130), with screenshots of every touched screen at 393, 430 and 320 in `docs/design/wp3/stage2/` **Since block 7C** the exercise detail is reached through the sheet, and the sheet reads in lb — its sets and its work volume. |
| `wp3-stage5b.mjs` | **WP3 Stage 5b, the warm-up mark and the exercise-day metric, on a fixed day** (D150, D151, D172, D173). At 320, 360, 393 and 430, in kg and in lb: the set's number is a named toggle with a 44px target; marked, the row says "Aufwärmsatz" in a word above fields that keep one line and cut nothing off, down to "999.5" lb at 320; the mark is stored as `warmUp: true`, survives a reload and is removed with the field when taken off; "Bester Arbeitssatz" never names a marked set, however heavy; removing a marked set and undoing brings it back marked (D131); "Satz hinzufügen" after it adds a working set. A workout of warm-up sets only counts for the week, shows no value and no zero, and Muskelgruppen says that only warm-up sets were logged. A set of yesterday can be marked, the day before is not offered. A device as the live build left it — Food on, the three-day window, no metric — writes one snapshot with all three eras on its first load and nothing on its second. The hint that says where the mark is (D175): there before the first mark, once, under the sets, an 11px caption inside its card at 4.5:1; gone with the first mark, and not back after a reload or with every mark taken off again. The production bundle draws the exercise detail as the line the owner chose at STOP 5b and carries no bar. `CLOCK=YYYY-MM-DD` (default 2026-11-18), `WIDTHS=393`, screenshots of the set row in `docs/design/wp3/stage5b/` |
| `stage5b-live-backup.mjs` | **Not a suite: the generator of the Stage 5b import file.** Drives the *live* build (`e30becd`, built in a worktree and served on a port of its own, `LIVE_URL`) through its own onboarding and workout screen on a clock that moves day by day from 12 October to 15 November 2026 — five weeks of push / pull / legs, 194 sets, two weight entries, two answers a day — and exports the backup through its "Backup exportieren". Nothing is written to the database from outside. The result is `docs/wp3/stage5b/momentum-pruefdaten-5b.json`: the trial run of the number report (`STAGE5B_BACKUP`) and the file the owner loads into the live app and the preview. It exits 0 only if the export holds exactly what was entered. **`FIRST`, `LAST` and `OUT` are its parameters** (block "Kurve"): with a later `LAST` it types the same diary carried on by its rule to that day (`pruefdaten-plan.mjs`), the last session on the last day — the import file of a later STOP, `docs/wp3/kurve/momentum-pruefdaten-kurve.json`. Needs the live build served; it is not part of a run of all suites |
| `stage5b-import-check.mjs` | **The import file in both builds, as the owner will see it** (STOP 5b). The live build (`LIVE_URL`) and the build under test each import `docs/wp3/stage5b/momentum-pruefdaten-5b.json` through their own "Backup importieren" on a fixed day (`DAYS=2026-11-15,…`): both accept it and hold every set; the live build keeps the file's one snapshot; the build under test writes exactly one more, from the day of the import, with the one-day window, the end of Food and the new metric, leaves the earlier one byte for byte, and writes nothing on a reload. The Gym rating, the ten muscle rows at 30 and 90 days, the exercise list and the detail of three exercises are read off both and written to `<OUT>/import-check.json` with screenshots — the figures of the STOP report's checklist. Needs both builds served; `FILE=<file>` loads another import file the same way — the block "Kurve" read the numbers of its three files off both builds so (`docs/wp3/kurve/README.md`), and block 7B those of its three, with the three cells of the metrics strip where a build has it (`docs/wp3/stage7b/README.md`). It is not part of a run of all suites **Since block 7C** it reaches an exercise through its group's sheet on the build under test and through the list under the rows on the live build, which still has it, and prints the head of the exercise detail — the one change and its caption — beside the two sets. |
| `pruefdaten-plan.mjs` | **Not a suite: the training diary of the import files, as a plan.** The five weeks written by hand for Stage 5b, set for set, and from the sixth week their rule — a rep more every week, at the top of the range the weight up and the reps back. Read by `stage5b-live-backup.mjs`, which types it into the live build, and by the long test profile of the block "Kurve" (`src/storage/services/fixtures/progressionProfile.ts`); `progressionProfile.test.ts` holds that for the dates of the Stage 5b file it gives exactly that file's sets. `pruefdaten-plan.d.mts` types it for the profile |
| `body-tones.mjs` | **Not a suite: the picture of the 3D body as numbers.** The zones — since block 7B those of the stage, in which the body stands from 11.5 % to 96 % of the height; the same stretches of the body as in the card before — the ground's lightness, `readBody()` — the median tone of every lit pixel of a zone and, against a second picture from the same angle, their difference in ΔE — and `stillPicture()`. `farbregeln.mjs` holds the colour rules on it, and the pictures of the block "Kurve" are measured with it, so a ΔE in a design and the ΔE the suite asks for are one measure |
| `kurve-tint-shots.mjs` | **Not a suite: the tint's strength under other upper ends** (block "Kurve"). Runs against the **dev server** (`npx vite --port 5173`): `#/dev/body?tintTo=<percent>&deltas=<group>:<change>,…` draws the named groups at those changes under another upper end, the app's own scale untouched. One sheet per history of `<OUT>/gruppen.json` (the groups' changes as the replay gives them, written by `kurveReport.test.ts`) with the body from the front and the back under each candidate, and the steps ±3, ±5, ±7 and ±10 % measured against a held figure. `CANDIDATES=12,10,8,7,6`, `TODAY=<the app's upper end>`, `GROUPS_FILE`, `OUT` (by default `docs/design/wp3/kurve/`); it is not part of a run of all suites |
| `kurve-shots.mjs` | **Not a suite: an import file on the real screen** (block "Kurve"). The production build imports `FILE` through its own "Backup importieren" on `DAY` and is pictured where the block changes or asks something: the 3D body at 30 and 90 days from the front and the back, the ten rows, one exercise's detail. `LABEL=vorher` before a change and `LABEL=nachher` after it; where both exist the two are set side by side as `vergleich-*.png`. `HELD=<file>` — the same sessions with nothing changing, which `KURVE_PROFILES=<dir> npx vitest run kurveReport` writes — measures each zone against the same zone held, in ΔE. It is not part of a run of all suites **Since block 7C** it reaches an exercise through its group's sheet. |
| `kurve-golden-diff.mjs` | **Not a suite: the proof beside the re-freeze of the Stage 5b golden files** (block "Kurve", D177). `node scripts/verify/kurve-golden-diff.mjs [<commit before the block>] [<commit of the re-freeze>]` compares `.github/fixtures` at two commits (by default `78a22ef` and `6f37680`) and fails unless: only `stage5b-*` golden files differ, and not the two of 2026-05-17; all eight `*.gym.json` — exercise-days, percentage changes, muscle states — are byte for byte the same; every value that moved in a `*.boss.json` is one that depends on the performance level (the level, the target, the rating and its movement, the peak, Gym's ledger, the Boss, the date of a promotion); and in the profile crossing the metric no value of a day before the boundary moved. Needs no build and no browser. The table it prints is `docs/design/wp3/kurve-golden.md` |
| `band-golden-diff.mjs` | **Not a suite: the proof beside the re-freeze after the held band became one-sided** (STOP Kurve, D180). `node scripts/verify/band-golden-diff.mjs [<commit before the band>] [<commit of the re-freeze> | --worktree]` compares `.github/fixtures` at two commits (by default `1752245` and `1a769ed`; `--worktree` takes the files as they stand) and fails unless: only `*.gym.json` golden files differ — no `*.boss.json`, so no rating; every value that moved is the shown state of a muscle group, from "unchanged" to "improved", at a printed +2 %; and in every golden Gym file, moved or not, each rated group's state is the one-sided band's reading of its figure. Needs no build and no browser. Its table is the second part of `docs/design/wp3/kurve-golden.md` |
| `stage5b-chart-shots.mjs` | **Not a suite: the pictures of the exercise detail's line** (D175). Imports the strength profile (`STAGE5B_PROFILE=<file> npx vitest run stage5bReport` writes it) into the production build and renders three series — double progression, a steady rise, one light day at the end — at 393 and 320, one sheet per width, into `docs/design/wp3/stage5b/uebungsdetail-linie-*.png`. Before the STOP it drew the same series as bars and as the proposed line, side by side; those sheets, `linie-oder-balken-*.png`, are what the owner chose from and stay as the record. Needs `PROFILE=<file>`; it is not part of a run of all suites **Since block 7C** it reaches an exercise through its group's sheet. |
| `body-measure.mjs` | **Not a suite: the measuring display, read in the headless browser** (block 7B, D181). Does what the owner does on the phone — switches the display on in the settings, starts the app again from its own address, opens Muskelgruppen, turns the body for ten seconds with a finger that keeps moving (`fingerTurn` in `lib.mjs`: an event every 8 ms on a clock, none waiting for the one before — `page.mouse.move` hops once a frame in a slow renderer, which the display rightly reads as pauses), lets go, waits two seconds, copies the values — and prints what was copied: the first load after a start, the second, and once more in a browser without the app's offline store, so that code and model come over the network. The numbers are a comparison value between two builds and say nothing about an iPhone: the headless browser draws with a software renderer. `WIDTH`, `HEIGHT`, `TURN_MS`, `SHOTS=<dir>`. No exit code; runs alone |
| `stage7b-shots.mjs` | **Not a suite: the pictures of block 7B** (`docs/design/wp3/stage7b/`). Muskelgruppen at 320, 360, 393 and 430: at the top, with a group chosen by a tap, with nothing trained, while the body loads (the model held back), zoomed with two fingers, with the flat figure standing in, the switch in the settings and the measuring display after a turn. `LABEL=vorher URL_APP=<a build from before the block>` pictures the four states that build has; `PAIR=1` sets before and after side by side as `vergleich-*.png`. Runs alone |
| `muscle-sheet.mjs` | **The muscle sheet, on a device with all five states (block 7C, D185, D186). Runs alone.** `seedSheetProfile` in `lib.mjs`: chest and triceps improved, the back improved and "uneinheitlich", the shoulders not trained in the range, biceps and calves with too little to compare, the core declined, the quadriceps at +100 %, hamstrings held, the forearms on a single observation. **One number**: for each of the ten groups the row's figure and state, the sheet's, and the state the body draws — read back from its colours, `data-drawn` on the viewer — are the same; the chart ends on that figure on the rows' scale with its first and last date; no chart stands without a figure; "uneinheitlich" is said exactly where the exercises lie more than ten points apart; the untrained group says when it was last trained and offers the one action; no figure of the sheet is in a state's colour but the change and its chip. **The work volume**: "nicht gewertet", neutral bars with words beside them, a week without a working set as a gap, the working sets only, an axis from six weeks on. **Closing and Back**: the cross, Escape, a tap on the body above, a flick down — each leaves the screen standing, returns focus to the group's row and the page to where it was; the address never changes for a sheet; Back walks exercise, sheet, screen, and only the third step leaves. **Two heights and a finger**, at 393 × 852 and 320 × 693, with touch events that carry their own times: the sheet opens on two thirds with name, change, range and chart above the fold; a drag up on the content raises it to 92 % and scrolls nothing; one long drag raises it and then scrolls; with the content scrolled a drag down is the content's; the header always moves the sheet; a flick goes one step; a drag that begins sideways moves nothing; the page behind never moves; the grabber is a control with a name and a 44px target, operated by Enter. **One change for one exercise** (D176): at 30 and 90 days the sheet's row and the head of the exercise detail show the same figure under the same words, and no second change stands on the detail. **No blur over the body in any frame drawn under a sheet.** **D169**: in both languages at four widths the lines of all rows stand in one column, with the longest word and a three-digit figure among them. `WIDTHS=393,320` **Its volume check holds on every weekday since the tidy-up**: a week only partly inside the range at its start is left out, so from Wednesday to Friday the first bar is the second week's 600 kg and not the first week's 1020 — the check knew the first case only and was red three days a week, in both browsers. |
| `muscle-card.mjs` | **The card "Muskelgruppen" on the Gym hub holds its place while it loads (block 7C, D168).** The read of the Gym sets is held back in the page (`IDBIndex.prototype.getAll`, released or failed by the suite), and the card is measured before and after in each of its six states — rated, trained without a figure, an empty range, nothing to evaluate yet, never trained, the load failed — at 320, 360, 393 and 430, and in English at the narrowest: the same height, the title in the same place, the picture in the same place, nothing cut off. **Red before the change**: 18 of the title checks, the title moving by 10 to 30px. `SHOTS=<dir>` writes each state loading and loaded **Since the tidy-up** (D199) also: the card that stands once its history has arrived is a new element, not the loading one with its text changed, and its text is, pixel for pixel, what the same card shows when it is painted from nothing — in Chromium and in WebKit. |
| `stage7c-shots.mjs` | **Not a suite: the pictures of block 7C** (`docs/design/wp3/stage7c/`), on `muscle-sheet.mjs`'s device with one exercise more. At 320, 360, 393 and 430: the ten rows after and before their lines stood in one column (D169 — "before" is the screen with the one rule taken out again); the sheet on both heights, at 90 days, "uneinheitlich", with too little, not trained, declined; once in English. **Two kinds of picture are not the app as built, and their names say so**: `kandidat-*` — the forms a single observation could take (D170), for the row, the sheet's chart and the exercise detail, drawn on a copy of the real element from its real numbers — and `zwei-zahlen-*` — the form of D176 that was not built, two named changes, beside `eine-zahl-*`, the form that was. `OUT=<dir> WIDTHS=393` |
| `stage7c-travel-cost.mjs` | **Not a suite: what the camera's travel to a group costs under the rising sheet** (block 7C, D185). Three ways, three travels there and back each at 393 × 852 and 3×: the solid sheet as built; nothing at all over the body while it travels (the least "the camera first, then the sheet" can cost); and glass over a blurred scrim, which is forbidden and drawn only to be measured. Reads the measuring display's lines under "Drehen" and counts frames of its own. A software renderer's numbers: a comparison between ways, not a phone. Prints; no exit code |
| `stage7c-check-files.mjs` | **Not a suite: the import files of the check at STOP 7C, and their proof** (`docs/wp3/stage7c/`). The diary of the earlier STOPs has every group rated and improved and would show one of the sheet's five states; so for each day in `DAYS` the device of `muscle-sheet.mjs` and of the pictures is seeded on a clock that reads that morning in Zurich, and the build exports it through its own "Backup exportieren". An empty device on the same day then imports the file through "Backup importieren" and must show the same ten rows and strip, and in seven sheets what the file is made for — otherwise the script throws. **Its rows are written into the database by the script, not typed through the interface**, and the README beside the files says so. `DAYS=2026-11-16,2026-11-17 OUT=docs/wp3/stage7c` |
| `exercise-search.mjs` | **The exercise catalogue and its search (block 7D, D171, D188).** What each of the owner's four words must find is read from `catalogue.ts` at run time, not from the search: «bauch» every exercise whose primary group is the core, «zieh» every one that names the pulling movement, «maschine» every one on a machine, «eigengewicht» every one loaded by body weight — and the search is held to that list exactly, no row missing, none more; every row says why it was found. Case and the spellings of an umlaut make no difference («RÜCKEN», «ruecken», «rucken»); two words narrow («kabel brust»); the stored English name still finds its exercise first («Bench Press» → Bankdrücken); a word nobody knows says what was searched and makes «Eigene Übung» the primary action, which opens with the word as its name. Without a query every offered exercise stands exactly once, under one heading per group in the app's order. A found exercise is picked into the workout and into a plan, saved by its id. The English screen finds «abs», «pull», «machine» and «bodyweight» with English headings. At 320, 360, 393 and 430 nothing is cut off, nothing scrolls sideways and every row is a 44px target. `WIDTHS=393` |
| `stage7d-shots.mjs` | **Not a suite: the pictures of block 7D** (`docs/design/wp3/stage7d/`). The picker in a workout at 320, 360, 393 and 430: without a query, at the top and at the core's heading; with «bauch», «zieh», «maschine», «eigengewicht», «kabel brust» and a word nothing answers; the own exercise opened from the empty search. Once in English («abs», and without a query), once from the plan editor («bauch»). `OUT=<dir> WIDTHS=393` |
| `stage7e-shots.mjs` | **Not a suite: the pictures of block 7E** (`docs/design/wp3/stage7e/` at STOP 7E-a2, `docs/design/wp3/stage7e-b/` since). A new device walks the onboarding by its own buttons, both worlds chosen, three questions, three gym sessions and two runs: every step at 393, the first slide and the weekly targets at 320 and 430 (`ALL=1` every step at every width), the opening page and the areas as they open (since D192), the question step as it opens and with none chosen, and — given `URL_PREVIEW` — the preview's row «Einführung ansehen». It prints for each step whether the page runs wider than the screen, how far the step scrolls, and the face its title is set in. `OUT=<dir> WIDTHS=… LANGUAGE=en URL_PREVIEW=<url>` |
| `onboarding-7e.mjs` | **Block 7E: the onboarding, every way through it** (D190, D191). Against the production preview at 320, 360, 393 and 430: the opening page — one line and a faint «Screen antippen», no button and no marks; every point of the screen lands on the page, and a real tap in each corner, on the line and on the hint goes on, as do Tab and Enter (D193) — and the areas opening with nothing chosen, «Weiter» held (D192); Mind alone — the three starter questions, one per category, reach storage; Gym alone at five sessions and two runs, without a question step; Mind and Gym with every starter taken off — «Weiter» waits and says «Wähl mindestens eine Frage oder nimm Mind ab.» — then one question of the library and one of the user's own; Mind taken off from the question step. Each path's domains, targets and questions are read back from the database. Every step of every path: no wider than the screen, nothing cut sideways, every control a 44px target (the seven target cells aside, D163), at most one dark surface and it Gym or the rank, the hero one picture with nothing to operate. The live build has no rehearsal. **And the rehearsal on a preview build** (`URL_PREVIEW`, a build with `VITE_MOMENTUM_DB=momentum-preview` served on 4174): every store of the preview's database read before and after a rehearsal walked to its end with other choices, one left by Back and one by a reload — byte for byte the same each time, and the live app's database never opened. **Since the tidy-up** (D197) nothing is chosen for the user: the second slide names Gym's target in a sentence, the questions open with none chosen and «Weiter» held, the weekly targets open with none chosen and «Weiter» held until Gym has one — a target for Laufen alone does not open the way. |
| `back-sheets.mjs` | **Back closes every sheet, and a sheet with fields loses nothing typed (the tidy-up, D187, D200).** At 393 and 320. Without fields — the plan chooser on Heute, the weighting on Rang, Mind's standing, the credits, the Gym rating, the legend over the body: opened, the address unchanged, Back closes it and the screen stands; after the legend a second Back leaves Muskelgruppen for the hub, so no entry was left behind. With fields — the onboarding's own question, a new question, an existing one, the run sheet's three fields, the exercise picker's search and the form of an exercise of one's own: typed, Back, opened again and the text stands; then the cross, opened again and the field is as stored. Nothing typed and taken back reaches storage. The muscle sheet and the exercise detail stay `muscle-sheet.mjs`'s |
| `pages-server.mjs` | **Not a suite: the server the suites read the builds from** (the tidy-up, step 5, D163). A static server that answers as GitHub Pages does — `Access-Control-Allow-Origin: *`, `Vary: Accept-Encoding`, `Cache-Control: max-age=600`, ETag and 304, a 404 for what is not there — under `/Momentum-App/`. `--dir dist --base /Momentum-App/ --port 4173 --host 127.0.0.1`; `--vary Origin` answers as `vite preview` did, for the counter-proof. The headers are from GitHub's documentation, not read off a live answer: the session that wrote it could not reach `github.io` |
| `stage2-shots.mjs` | **Not a suite: the pictures of Stage 2 of the overall-rank update** (D125): the Rank screen with the area ratings, the Gym rating board without a badge, Laufen's board and Mind's standing tile at 393, into `docs/design/overall-rank/`. Counts no check |
| `stage4-shots.mjs` | **The promotion-confirmation indicator (D126)** in its states on the Rank screen and the Today card, from the verify-only seed `seedConfirmation`: 0/7 when the threshold was reached today, 4/7 while a confirmation is pending, nothing below the threshold, and the day after a promotion. Counts checks and is part of `npm run verify`; its pictures go to `docs/design/overall-rank/` |
| `status-shots.mjs` | **Not a suite: the pictures of the status palette** (D123): the 1–10 picker on Heute, the Verlauf grid with its legend, a question's history and the muscle map at 393, into `docs/design/status-palette/`. Counts no check |
| `run-all.mjs` | **Not a suite: every suite, by one command** (block 9, step 1; `npm run verify`). Above, under "Running them". |
| `today-in-charts.mjs` | **Block 9, step 6a: a workout saved today stands in every chart at once** (D194). On the check file of block 7D, imported on a Monday, a workout saved before the day's questions are answered: the chest row says "Heute", its sheet's line reaches today with one measurement more, Bankdrücken lists today first and its line ends on it, every earlier day reads as it did; the hub counts it and its rating tile shows the rating with it at once, "Vorläufig · der Tag ist noch offen"; Verlauf's grid shows today hollow and "vorläufig" in Gym and overall, names the hollow bar in its legend, leaves every day before the week as it was; a question answered today stands as provisional in its history; once the day is complete its own values stand, the curve moves and the tile shows the same value as the rating. |
| `update-in-place.mjs` | **Block 9, steps 4 to 6: the update and the way back, in one browser.** The live state `e30becd` and this build served one after the other under one address (4295), so one database and one service worker meet them: the update waits, "Neue Version verfügbar", one reload, nothing of the live build left in the cache, every record kept, the three eras on the update day, a second load writing nothing; the live build again on the updated data (described); the clean way back (two exports alike, the data of the backup); and a backup of this build in the live build (described). Needs `dist` and the live state (`run-all.mjs` builds both). |
| `access-wp3.mjs` | **Block 9, step 8: contract §12 in the browser** (D146, D147, D182, D185). One device with a month behind it at 393 and 320 (`WIDTHS`): **less transparency**, asked for through Chromium's media emulation, on every screen with glass — Heute, Verlauf, Rang, Bereiche, the Gym hub, a metric's sheet, Muskelgruppen with its sheet, an exercise's detail, a workout: nothing blurs what lies under it, every card, sheet, bar and scrim is solid, and every text still reads at 4.5:1 on its pixels; **less motion** with the muscle sheet: once it stands no animation runs and no transition is under way; **the page's zoom** is locked nowhere; **the new screens** — Muskelgruppen, its sheet, an exercise's detail, the picker — keep every control a 44px target and cut nothing off sideways; **the way a screen reader takes**: each of the ten rows says group, figure and state, the sheet is a named dialog whose chart carries its description, closing it gives the focus back to its row, and nothing in the body takes the focus without a name. Chromium only (its protocol); run alone, it draws the body. |
| `update-live-outputs.mjs` | **Not a suite: what the live state shows, day by day, read by its own code** (block 9, step 4). Copies `src/storage/services/fixtures/updateOutputs.ts` into the live state, runs it there on a backup and a day, and writes the JSON `updateRehearsal.test.ts` compares the days before the update with. `BACKUP=… REFERENCE=… OUT=…` |
| `stage7d-check-files.mjs` | **Not a suite: the import files of the check at STOP 7D, and their proof** (`docs/wp3/stage7d/`). Made by the live build (`LIVE_URL`, the default branch with its own catalogue): for each day in `DAYS` it imports the diary of STOP 7B for that day, makes a plan of Bankdrücken, Latzug and an exercise of the user's own through its interface, and exports it through "Backup exportieren". The build before the block (`BEFORE_URL`) and the build under test (`URL_APP`) then import the file on an empty device and must show the same Gym rating, rows, strip and plan; the build under test must offer every exercise of its catalogue and the user's own, keep every stored exercise byte for byte, and find the user's own by its name — otherwise the script throws. `LIVE_URL=… BEFORE_URL=… URL_APP=… DAYS=2026-11-17,2026-11-18 OUT=docs/wp3/stage7d` |

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

Three more, found in block 7C:

- **A flick needs its times written down.** `Input.dispatchTouchEvent`
  stamps an event when it is sent, and a headless browser under load sends
  a gesture of a tenth of a second over half a second: the speed the sheet
  reads off the events is then a slow drag's, and "a flick closes the
  sheet" fails for the harness and not for the code. `muscle-sheet.mjs`
  writes each event's `timestamp`.
- **One frame is not twelve draw calls.** Under a zoom's window a region
  that lies outside it is not drawn, and a frame is eleven. Count frames by
  the task they are drawn in (`gym-muscles.mjs`, `stage7c-travel-cost.mjs`),
  and keep the draw calls for the one question they answer — what a whole
  picture costs.
- **Draw a candidate on a copy, never into the row.** Putting a row back
  with `innerHTML` after drawing into it takes the handlers the app had
  bound with it; the row looks right and no longer opens anything.
  `stage7c-shots.mjs` hides the original and draws on a clone beside it.

## Checks restated in block 7C

A tap on a group opens its sheet, where a row used to be a toggle that
filtered a list of every exercise under the ten rows; and an exercise has
one change, where its detail printed two and its row in the list a third
(D185, D186). The checks that held the old behaviour are restated below,
each with its old rule and its new one. **None was removed and none was
weakened**; `wp3-sheets.mjs` is unchanged and green.

- **`exerciseDetailChart.test.tsx`** (unit). *Old:* the line "ends in the
  state of its end value, with the value beside it", and the head reads
  "Veränderung +3 %" — the last day against the one before. *New:* the head
  carries one change — the one in the range, "+4 %" with the chip
  "Verbessert" under "Bester Arbeitssatz · letzte 30 Tage"; no percentage
  stands between "Zuletzt" and "Davor"; the end point carries the state of
  that one figure and no value stands at the line. A case in which the
  figure and the line's end differ in sign was added. One recorded day:
  *old* "Veränderung · Zu wenig Vergleichsdaten", *new* the chip, no figure,
  "Davor –".
- **`phase4.mjs`**. *Old:* "selecting a group filters the exercises below
  it" (one row left in the list). *New:* "a tap on a group opens its sheet
  with the group's exercises", and "back from the exercise leads into the
  group's sheet".
- **`phase4-a11y.mjs`**. *Old:* the exercise history is reached through
  the first row of the list under the rows. *New:* through the group's
  sheet; four checks added — the sheet is a named dialog, its controls are
  named, the grabber is named, the chart has a description or a sentence
  stands for it.
- **`release-proof.mjs`**. *Old:* "all ten rows are buttons with a pressed
  state" and "a selected row is exposed as pressed". *New:* "all ten rows
  are buttons that open a dialog, and none is a toggle", "a row opens its
  group's sheet: a modal dialog with the group's name", and "Escape closes
  it, nothing left selected".
- **`wp2-2-shots.mjs`**. *Old:* "the overall tile and the exercise list
  came along", and "selecting a row marks it selected" (`aria-pressed`).
  *New:* "the overall tile came along, and no list of exercises stands
  under the rows", "a row opens its group's sheet and is marked as open",
  "the group's exercises stand in its sheet"; and before "browser Back
  returns to the hub" now stands "browser Back closes the sheet and stays
  on Muskelgruppen".
- **`qa-shots.mjs`** (pictures). *Old:* a row toggled on and off. *New:*
  its sheet opened and closed.
- **`wp3-reload.mjs`**. *Old:* "the 30-day exercise list is a strict
  subset of the 90-day one" — the list under the rows. *New:* "the
  exercises of the 30-day sheets are a strict subset of the 90-day ones" —
  the sheets of Brust and Schultern — and "at 30 days the sheet of
  Schultern lists nothing and says when they were last trained".
- **`wp3-stage1.mjs`** (B6). *Old:* an exercise "reads Gehalten in the
  exercise list" — the word alone, for the change since the day before —
  and "the detail's change reads Gehalten, neutral", its third figure.
  *New:* it "reads "0 %" with "Gehalten" in the sheet of its group" — the
  figure and the word, for the change in the range — "the detail's change
  reads "0 %" and "Gehalten", neutral — the sheet's own figure", and "the
  detail stands no second change beside it".
- **`wp3-stage2.mjs`** (P4). *Old:* the exercise detail is reached through
  the list. *New:* through the sheet; added "the muscle sheet reads in lb —
  the sets and the work volume".
- **`design-system.mjs`**. *Old:* the pictures `muskelgruppen-auswahl` and
  `uebungen`, the check "Muskelgruppen lists the exercises", and "the line
  … only its end point carries the state — its end value, beside it and in
  view". *New:* the pictures `muskel-sheet`, `-gross`, `-90`,
  `-uneinheitlich`, `-wenig` and `-nicht-trainiert` with the sheet's checks
  (it opens on two thirds, the fold, the grabber to 92 %, twelve to
  thirteen weeks fit, the words of each state, no chart without a figure);
  "the line … only its end point carries a colour — the state of that one
  change — in view, with no figure beside it"; "the exercise's one change
  stands at the head … the sheet's own figure"; and "back from the exercise
  leads into the sheet".
- **`farbregeln.mjs`**. *Old:* "Beinbeuger, chosen, says what is missing" —
  a sentence above the list — and "with no group chosen the sentence is
  gone"; "an exercise at +1 % reads "Gehalten"" — the word alone in the
  list; "one recorded once has too little to compare" — the list's text;
  the detail's third figure. *New:* "Beinbeuger, opened, says what is
  missing" — in its sheet, which "draws no chart" — and "with the sheet
  closed nothing of it is left"; an exercise "reads "+1 %" with "Gehalten""
  in the sheet's row, and so −2 %, +2 % and −3 % with their words; one
  recorded once "stands under "Erfasst" with its set and no figure"; the
  detail's head figure and chip, equal to the sheet's.
- **`gym-muscles.mjs`**. *Old → new*, pair by pair: "a row tap selects it"
  → "a row tap opens the group's sheet and marks the row"; "the exercises
  below follow the selected group" → "the group's exercises stand in its
  sheet, not under the rows"; "tapping the selected row again clears it" →
  "closing the sheet leaves nothing chosen, and the angle where it was"; "a
  tap on the body selects the group" → "a tap on the body opens the sheet
  of the group it landed on"; "a second tap on the same region keeps it
  selected rather than clearing it" → "a tap on the body above the sheet
  closes it and chooses nothing"; the trapezius "selects the back" → "opens
  the back's sheet"; "selecting an untrained group still reads as selected"
  → "an untrained group opens its sheet too, and says so"; "all ten groups
  can be selected from their row" → "every group's sheet opens from its
  row"; "selecting the triceps row turns the body to the back" → "opening
  the triceps from its row turns the body to the back", with the strip
  above the sheet checked beside it; without WebGL "the exercises still
  follow it" → "the group's sheet stands over the flat figure with the
  group's exercises"; under reduced motion "selection still works from the
  rows" → "a row still opens its group's sheet"; "selecting a group that
  faces away turns the body to it" and "the same group chosen in its row
  turns the body to it" → the same two with "opening … from its row" for
  "selecting", the angle held to the same three degrees; and after a lost
  context "the selection, the rows and the views still work" keeps its
  name and now also holds that the group's sheet stands. Two sections are
  new: the frames under the sheet, and the camera's jump under reduced
  motion.
- **`body-reach.mjs`**. *Old:* a miss leaves the selection alone, so only
  a *change* of selection is a hit. *New:* a hit is a tap after which a
  sheet stands; the sheet is closed before the next tap, and the grid runs
  under reduced motion. Which groups each view must reach, that no tap may
  turn the body, and 10 of 10 at every width are held as before.
- **`stage5b-import-check.mjs`** (the check files in both builds; its
  eleven checks per file are unchanged). *Old:* an exercise is opened from
  the list under the rows, in both builds. *New:* from the sheet of its
  group on the build under test, from the list on the live build, which
  still has it; what it prints of the detail now begins with the head —
  the one change and its caption.

## Checks restated after STOP 7C (D187)

The owner chose that a line begins on the baseline of its first day
(D170), and that an exercise's line is its change in the range day by day,
so that it ends on its one figure. None of these was removed or weakened.

- **`exerciseDetailChart.test.tsx`** (unit). *Old:* the table reads each
  day against the first (+7, +4, +5, +3 %), "Veränderung" stands once, as
  "Veränderung seit dem ersten Tag", and one day is a dot on the zero line.
  *New:* the table reads the change in the range up to each day (+4, +3,
  +5, +3 %, the newest row being the figure at the head), "Veränderung" is
  never bare — both times it says "im Zeitraum bis zu diesem Tag" — the
  line's last point stands where the figure does, and one day draws no
  chart but a sentence. Added: two days are the shortest line, from the
  baseline.
- **`gym-muscles.mjs`**. *Old:* "a single observation is one dot and no
  line". *New:* "a single observation is the shortest line: from the zero
  line to its value, with its end point"; added "every line begins on the
  zero line, where its group began".
- **`release-proof.mjs`**. *Old:* "a single observation is a dot and
  nothing else". *New:* "a single observation is the shortest line: two
  points, from the zero line, and its end point".
- **`design-system.mjs`**. *Old:* "every point is its day's change since
  the first day shown". *New:* "every point is the change in the range up
  to its day", worked out in the suite from the sets the table names;
  added "the line ends on the exercise's one change".
- **`phase4-a11y.mjs`**. *Old:* "and the bars themselves are decorative" —
  the exercise logged there has one day, which was a dot in a chart hidden
  from a screen reader. *New:* "and a chart is a picture only: one day draws
  none, and says so in a sentence; a chart that is drawn is hidden" — the
  rule for a chart is kept for two days and more, and one day is held to
  its sentence. (Its pick of "Bankdrücken" by name, where it took the first
  row, belongs to block 7D: see there.)
- **`muscle-sheet.mjs`** (added only): the sheet's line begins on the zero
  line at the group's first day; an exercise's line ends on its figure, on
  the side of the zero line its colour says, and its newest table row reads
  the figure; one recorded day draws a sentence, not a chart.

## Checks restated in block 7D (D188)

The catalogue grew from 49 entries to 134, and the picker's list stands
under headings until something is typed. No check was removed or
weakened; these were restated because their rule assumed the small
catalogue.

- **`catalogue.test.ts`** (unit). *Old:* "has 49 entries". *New:* "has
  134 entries" — the 49 are held by the three tables as before, byte for
  byte, and a fourth table pins the 85 new ones. (At STOP 7D it said 133
  and 84; the owner's Bayesian cable curl after it made them 134 and 85.)
- **`phase4.mjs`**. *Old:* "search narrows the list" — «Squat» leaves
  exactly one row, and the first row is picked. *New:* "«Squat» finds the
  squats, Kniebeuge and Frontkniebeuge among them" — at least two rows and
  fewer than fifteen — and Kniebeuge is picked by its name.
- **`phase4-a11y.mjs`**. *Old:* after «Bench», the first row is picked.
  *New:* Bankdrücken is picked by its name: «Bench» now also finds «Bench
  Dip» (Bankdips), which ranks beside it.
- **`wp3-stage1.mjs`** B11 is not restated: it reads the catalogue's
  source when it runs and asks that the empty search list every entry. It
  counts 134 on this block's build and fails on an earlier one — so a run
  against an earlier build is made from that build's checkout.

## Checks restated in block 7E (D190)

The onboarding changed how it looks, not what it asks. No check was
removed or weakened; these were restated because they found an element by
the look it had.

- **`lib.mjs` `onboard()`, `design-system.mjs` and `phase2.mjs`**. *Old:* the two weekly
  targets are found in the first and the second `.card`. *New:* the two
  stand in one card, and each is found by the name of its group
  («Gym-Sessions pro Woche», «Läufe pro Woche») — the name the control
  always had.
- **`design-system.mjs`** `bubbles()`. *Old:* each of the seven is a
  target 44px high and its share of the row wide, around a round circle
  that fits. *New:* the same targets, and in the onboarding (`segments`)
  around a pill that fits instead of a circle (contract §16) — the round
  circle is still held everywhere else.
- **`phase2.mjs`** and **`wp3-stage4.mjs`**, the titles. *Old:* the slides' titles
  «Zwei Welten» and «Rang und Meilensteine», and the first slide by its
  sentence «Fortschritt sieht man selten …». *New:* «Zwei Welten. Ein
  Verlauf.», «Ein Rang für alles.» and «Fortschritt, den du siehst.» —
  the copy of D190; that the second slide names the two worlds with
  Laufen inside Gym is checked as before.
- **Not restated, on purpose**: `stage5b-import-check.mjs`,
  `stage5b-live-backup.mjs` and `stage7d-check-files.mjs` walk the *live*
  build's onboarding (`e30becd`), which still has a card per target.

## Checks restated after STOP 7E-a2 (D191)

Mind opens with three starter questions chosen. A walk that taps a
question to choose it would now take a starter off; no check was removed
or weakened.

- **`lib.mjs` `onboard()`, `design-system.mjs`, `phase2.mjs` and
  `stage7e-shots.mjs`**. *Old:* each named question is tapped. *New:*
  `chooseQuestions()` sets the choice to exactly the named questions, each
  row by its own pressed state — a walk that names two ends with those
  two, as before.
- **`phase2.mjs`**, the question of the user's own. *Old:* it is the only
  question stored. *New:* the same, after the starters are taken off.

## Checks restated after STOP 7E-b (D192)

The onboarding begins on an opening page, and its areas open with nothing
chosen. No check was removed or weakened.

- **Every walk of the new build** (`lib.mjs` `onboard()`, `phase2.mjs`,
  `design-system.mjs`, `wp3-stage4.mjs`, `onboarding-7e.mjs`,
  `stage7e-shots.mjs`). *Old:* the first screen is the first slide, and
  Mind is chosen on the areas. *New:* `passOpening()` passes the opening
  page first, and Mind is chosen by a tap where it was chosen for the
  walk; `onboard()` taps Mind when `wellbeing` is on, where it took Mind
  off when it was off.
- **`phase2.mjs`**, «cannot continue with nothing switched on». *Old:*
  Mind is taken off, and «Weiter» waits. *New:* nothing is chosen as the
  areas open, and «Weiter» waits — the same words beneath it.
- **`release.mjs`**, the cold load and the reload. *Old:* the first
  screen's «Los geht’s» is there, and after a reload it is not. *New:*
  the onboarding is there, and after a reload it is not.

## Checks restated after STOP 7E-b, the opening page without a button (D193)

The opening page has no «Weiter»: a tap anywhere goes on, and a faint
«Screen antippen» says so. No check was removed or weakened.

- **`passOpening()`** (`lib.mjs`), which every walk of the flow passes.
  *Old:* taps «Weiter». *New:* taps the middle of the screen, where the
  line stands — no button there — so every walk proves the tap anywhere.
- **`onboarding-7e.mjs`**, the opening page. *Old:* its one button is
  «Weiter». *New:* its one button is «Screen antippen», in
  `--text-tertiary`, 13px, regular, on no surface; a grid of 153 points
  over the viewport, edges included, lands on the page and on nothing laid
  over it (in the rehearsal too); a real tap in each corner, at the top, on
  the line, below it and on the hint goes on, each on a fresh page; Tab
  and Enter go on, with the focus on «Los geht’s»; the page shows a hand
  to a pointer and sets no tap highlight, which would flash over the
  whole screen.
- **`design-system.mjs`** keeps the two runs of text the page holds by
  design — now its line and the hint. A transparent layer over the screen,
  tried first, hid the line from the hit test this measurement relies on;
  the page takes the click itself instead, and the measurement is as it
  was.

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
