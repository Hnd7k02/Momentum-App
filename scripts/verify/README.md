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

Chromium comes from the image at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
which each script names explicitly — Playwright's own default path is not
populated here. If that directory moves, change `executablePath` in the
scripts rather than running `npx playwright install`.

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
| `phase6.mjs` | Food: the ratings store exists and starts empty, rating and re-rating and clearing a day, the stored value being the 1–10 the user chose, the log and its totals, that logging food does **not** rate the day, the setup sentence, that no calorie target is asked for anywhere, four widths including the logging sheet |
| `phase6-a11y.mjs` | The rating as one named radio group scoped to the Food card, each value spoken with its band, one tab stop with arrow-key movement, the chosen value in a live region, the sheet's field names, the remove control naming its entry, reduced motion |
| `phase7.mjs` | The one-time legacy-Sport question: reachable from Today and answered in Areas, three branches each doing what it says, nothing preselected, nothing resolved by reloading or wandering, picking without confirming applying nothing, a fresh profile never asked, four widths |
| `phase7-a11y.mjs` | The three branches as one named radio group, nothing chosen at the start, one tab stop with arrow-key movement, each branch spelling out its consequence, the confirm named and unavailable until a branch is chosen, choosing by keyboard still applying nothing, reduced motion |
| `phase8.mjs` | Pause periods: the section and what it promises, creating one, the 28-day limit and every other rule refused on screen, editing and deleting a future pause, ending a running one from today, Today's paused line, logging still working while paused, no Rest Day surface, four widths |
| `terminal.mjs` | **The domain terminal (Stage A).** Heute, Verlauf and Rang unchanged in role; on Bereiche the Mental · Gym · Ernährung switch as a named radio group with one tab stop and arrow keys, exactly one area rendered at a time, `#/areas/<area>` deep links, Back and Forward walking the areas visited, an unknown hash corrected, reduced motion |
| `body-reach.mjs` | **Direct body hit coverage, measured.** Taps a grid over the whole canvas at 393, 430 and 320, front and back, counting which regions respond (a miss leaves the selection alone, so only a change is a hit). `STEP=8 WIDTHS=430` for a finer probe of one width. Prints cells per region; the accepted 320px value is 9/10 at the 12px pitch |
| `release-proof.mjs` | **Release evidence (Stage 5).** From a cold boot with no worker: which routes fetch the viewer chunk and the model, with status codes. With the worker: what it precached, and whether Gym still shows the body offline. The mini charts measured (box, line height, stroke, identity vs. state colour, nothing outside 80×24) and what the rows tell assistive technology, plus the credits dialog |
| `qa-shots.mjs` | **The committed QA screenshots.** Writes `docs/design/muscle-map/qa/<width>-<letter>-<slug>.png` at 393, 430 and 320: the Gym workspace, the Muskelgruppen module, a measured and an untrained group selected, front/side/back, the sparklines, the SVG fallback, Laufen |
| `gym-muscles.mjs` | **The muscle module in the real Gym workspace (Stage 4).** Against the production preview: the viewer chunk fetched for Gym and for nothing else; ten analytics rows with their mini charts, one per data state (a measured line, a flat line where every point is equal, a single dot, and no chart at all for a group with no history or no baseline); one selection shared by the body, the rows and the exercise list, with body taps that select and never clear; Laufen inside the Gym workspace and its row still in Verlauf; the credits sheet; the flat figure standing in when WebGL is missing, when the chunk cannot be fetched and when the viewer throws; `document.hidden` and off-screen both stopping the frames; leaving and re-entering Gym leaving exactly one viewer; reduced motion; and a set logged at 23:29 reading as trained today. `SHOTS=<dir>` writes screenshots |
| `body.mjs` | **The 3D body viewer (muscle map, Stage 2), in isolation.** Runs against the **dev server** (`npx vite --port 5173`), because the harness page `#/dev/body` exists only there and because that is where React StrictMode double-mounts. Proves one canvas and one live WebGL context after the double mount, the three shortcuts and free rotation with the angle as the state, raycast selection of all ten regions, selection reaching the drawn colour, mount → unmount → mount leaving one viewer with no leaked context or pointer handler, an idle demand loop running zero frames, the 2× pixel-ratio cap on a 3× screen, host-sized framing with no clipped head or feet at 320/393/430 and at an arbitrary angle, reduced motion (no coast, presets settle at once), the German and English pill labels, and the fallback when the model cannot be fetched. `BODY_SHOTS=<dir>` writes screenshots |
| `geometry.mjs` | **Card geometry.** Every line of text measured against the box that clips it, on all four sides, at 393/430/320px — plus the card gutter and a document-level sideways check. Writes screenshots to a gitignored `.artifacts/` |
| `release.mjs` | **The V1 release smoke test, against the production build.** A cold load of the built bundle, the whole journey through all four domains, a refresh proving persistence, a backup export / malformed refusal / restore round trip, five widths including desktop, and zero console errors throughout. A dev server proves none of this |
| `phase8-a11y.mjs` | Both date fields as real labelled date controls, the rejection in a live alert region, the save exposed as unavailable while invalid, saving from the keyboard alone, the paused state as a status rather than an alert, nothing disabled by a pause, reduced motion |
| `wp2-1-shots.mjs` | **Training plans and planned workouts (WP2-1).** The plan editor starting empty, the five-plan limit and its inline reason, the chooser under "Session eintragen", a draft that writes no session until a set is saved, the last-time line, an extra exercise, the session that then counts for the week, and the hub counting the day's first session (WP3, B4). Runs on a fixed day (`CLOCK=YYYY-MM-DD`, default 2026-10-14) so no check depends on the weekday. Screenshots to `docs/design/wp2-1/` |
| `wp2-2-shots.mjs` | **The Gym hub and the muscle destination (WP2-2).** Heute → Gym → hub → Muskelgruppen and back, the route and its deep link, the hub fetching neither the viewer chunk nor the model, the destination fetching both, the no-data states, the plan chooser and plan management from the hub, the week sentence. Screenshots to `docs/design/wp2-2/` |
| `wp3-sheets.mjs` | **Typing into every sheet (WP3, B1).** Every text field of every sheet — the exercise search in a workout and in the plan editor, the custom exercise's name, the question text, the food sheet's fields, the run sheet's distance, duration and note — typed one character at a time, with the value and the focus asserted after each one; the field a sheet marks is focused on open, otherwise the dialog itself and never the close button; editing a question opens on the dialog, not the field; Escape closes and returns focus |
| `wp3-reload.mjs` | **Screens that change with their inputs (WP3, B2).** The 7/30-day muscle toggle showing different numbers; the hub's week line and cards after "Fertig" without leaving the area; the Boss card after an answer, the Laufen board after a run; a Sunday-to-Monday rollover under a faked clock. Each screen is compared with what a full reload shows at that moment |
| `wp3-midnight.mjs` | **One "today" across midnight (WP3, B3).** Under a faked clock: Heute moving to the new day at local midnight with no input, the first answer of the morning stored under the new day, a tap after a suspended timer never landing on the old day, the page coming back into view, both Berlin DST nights and a São Paulo midnight that does not exist (04.11.2018); an open workout across midnight, from Heute (a plan draft) and from the hub (a free session) — never remounted, still on the day it was opened for, and the next set going to the same session. `ONLY=7,8` runs the named scenarios alone |
| `wp3-stage1.mjs` | **The rest of WP3 Stage 1, on a fixed day.** The hub's week line after a first session (B4), the muscle rows on the card's content edge (B5), changes that round to 0 % reading as held in the rows, the exercise list and the detail (B6), a double-tapped run logging once with an undo toast above the tab bar, stacked below the sheet layer and dismissed when a sheet opens (B9), the Boss card's 28px gap (B10), picker rows that never repeat a group, including two-part details (B11), the front raise (B12), and the start week's attendance tile reading as no data rather than "0 von 0" (D127), with screenshots of every touched screen at 393, 430 and 320 in `docs/design/wp3/stage1/` |

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
  Food's rating uses the same `ScaleAnswer` Wellbeing renders per scale
  question, so "ten radios, one tab stop" was really thirty and three. Scope
  to the card under test (`.food__scale`), not to the document.
- **Two strings can differ by one word and match the same regex.** The legacy
  card's description ("Deine Trainings aus der früheren Version.") and the
  question's lead line read almost identically, and a page-wide text match
  finds the description first. Scope to the element under test.
- **A button name can be a prefix of another.** `getByRole('button', { name:
  'Eintragen' })` also matches "Essen eintragen", and `'Heute'` matches a
  question containing the word. Use `exact: true`, or address the tab bar by
  `.tab-bar__tab`.

## Conventions

`lib.mjs` holds the shared pieces: `check`/`summary` (which set the exit
code), `onboard` (walks the current onboarding flow), `seed` (writes history
straight into IndexedDB), `clipped` and `smallTargets`.

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
