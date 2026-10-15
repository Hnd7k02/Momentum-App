# Decisions

Choices made during the build that the specification did not settle, kept here
so the stage 8 review has a record rather than a reconstruction.

## D1 — Date arithmetic is anchored at local midday

Every date calculation builds its `Date` at 12:00 local, never at midnight.
In time zones where a DST transition skips local midnight, a midnight-anchored
day silently resolves to a neighbouring date, which would file a check-in on
the wrong day. Tests run in Europe/Berlin and in a historical São Paulo rule
where local midnight did not exist.

## D2 — Config snapshots are referenced, not copied into entries

§18 asks for the configuration in force to be stored alongside an entry. Each
answer and session stores a `configSnapshotId` instead of an inline copy.
Same determinism, no duplication — and it also covers days with **no entries
at all**, which an entry-embedded copy cannot: scoring a missed day needs to
know what was due on it.

## D3 — Correcting an answer keeps its original snapshot

Editing yesterday inside the three-day window judges that day by the
configuration it was lived under, not by today's.

## D4 — One answer per question per day, enforced by the key

An answer's id is `date#questionId`, so §8's "asked once per calendar day" is
a property of storage rather than a rule the UI has to remember.

## D5 — Mental Wellbeing questions are daily only; weekly quotas belong to domains

*Decided by the product owner, replacing the specification's per-question
rhythm (daily / N times per week / weekly).*

A question has no schedule. An active question is asked every day, once. This
keeps the daily check-in a single unambiguous act and removes "was this due
today?" from the scoring path entirely.

Anything that is genuinely a weekly quota is modelled the way Sports is: a
domain with a weekly target, logged on whatever days it happens, shown as
`2 / 3 diese Woche`. Future domains with weekly targets reuse that shape
rather than reintroducing per-item schedules or fixed weekdays.

Consequence: `Rhythm` was removed from the schema. Should a later version ever
need one, adding the field back is an additive read-time default — records
without it are daily, which is exactly right.

## D6 — German formats through the Swiss locale

*Decided by the product owner.* `de-CH` groups thousands with an apostrophe
(4'820), which is what §14 shows. Dates, weekday and month names are identical
to `de-DE`, so nothing else changes. Output is normalised to a straight
apostrophe because ICU versions differ on which one they use.

## D7 — Dark mode only, and no light-mode scaffolding

*Superseded by D13.* Per §6 the interface was dark only, with no unused
light-mode tokens waiting to be filled in.

## D8 — Pastel accents on an Apple-dark ground

The stage 2 brief asks for soft pastel tones; §6 of the specification warns
against pastel palettes on dark. Both are satisfied by keeping pastels as
*accents* — selected states, domain identity, switches, badges, the scale
ramp — while every surface underneath stays true black and Apple dark grey.
The interface reads soft without turning washed out, and the rank badges
still have somewhere louder to go in stage 5.

## D9 — Sports target is capped at seven per week

The picker shows every choice as a bubble, and above "every day" a weekly
quota stops describing a week. `SPORTS.MAX_TARGET_PER_WEEK` moved from 14
to 7. Easy to raise if two-a-day training turns out to matter.

## D10 — Bubbles wrap rather than shrink

Seven 44px targets plus gaps do not fit one row below about 390px. They wrap
to a second row instead of shrinking: a sub-44px tap target is a worse trade
than an extra row, and a horizontal scroller would hide choices.

## D11 — A question row states its type once

Type lives in the badge; the row subtitle is gone. Every active question is
asked daily, so "Täglich" on every line distinguished nothing, and the type
appeared twice per row. Paused and archived get a badge because those are
the states worth calling out.

## D12 — No Apple HIG design skill is available in this environment

Checked at stage 2: no such skill or plugin is installed. Per §6 this is
reported rather than invented; the work follows HIG principles directly
(type scale, 44px targets, safe areas, translucent tab bar, restrained
motion). Worth re-checking before the stage 8 review.

Re-checked at stage 8: still none. The §6 conformance review was therefore
done against §6's own rules — the type scale, card treatment, tab bar,
targets, safe areas and the one dark surface — rather than against an
external HIG reference, as §6 instructs.

## D13 — The interface is light (supersedes D7, revises D8)

*Decided by the product owner, overriding §6's "dark interface only".*

Version 1 is now a single **light** theme: a tinted off-white ground, white
cards lifted by soft two-layer shadows rather than borders, inset hairline
separators, iOS proportions (50px CTAs, 44px minimum targets, 22px card
radii) and generous spacing.

Still one theme, not two. The reason §6 gave for picking one — that the
history colours and the rank badges each need a single ground designed for
properly — holds whichever ground is chosen. `color-scheme: light` is
declared so the browser does not auto-invert anything.

Two consequences for later stages followed from this; both are now settled
in D15 and D16.

## D14 — Two weights per pastel, and they are not interchangeable

Each identity colour has a decorative `-fill`, a `-mid` for controls, and a
text-safe `-ink`, plus a `-tint` for backgrounds. On a light ground a pastel
that looks right as a switch cannot carry 17px text at 4.5:1, and the
readable variant looks heavy as a large fill. Splitting them keeps both the
softness the design asks for and the contrast accessibility requires.

Where a colour is display-sized (the 76px sports numeral) the 3:1 large-text
bar applies and the lighter `-mid` is used deliberately.

## D15 — The heatmap stays fully inside the light interface

*Decided by the product owner.*

No dark inset for the history grid. The red/orange/yellow/green bands are
re-mixed specifically for a light ground rather than reused from the dark
palette — yellow is the one that does not survive the move unchanged, since
at small cell size on white it neither reads as a distinct band nor carries
a value.

Colour is never the only carrier: each cell pairs its band with a value or
label, and no-data cells are distinguished by treatment rather than hue
alone. But the grid stays visually clean and compact — a small value inside
a cell where it earns its place, not a number stamped on all thirty days.
Legibility comes from the band mix first and the label second.

Open when stage 4 starts: the `--band-*` colour tokens were dropped during
the light rewrite (D13) and nothing has referenced them since. The
`SCORE_BANDS` thresholds in the constants module are untouched. Stage 4
defines the light-adapted colour tokens against those thresholds.

## D16 — The rank badge gets a dark hero inside a light screen

*Decided by the product owner.*

The Rank screen is not a dark screen. It keeps the light chrome, the light
tab bar and the light surrounding cards — current rank, peak rank and
Lifetime XP read as part of the same app as everywhere else.

The badge hero area alone sits on its own dark premium surface. That is
where §6's gaming contrast lives: metallic material, dimensional depth,
subtle glow, stronger drama, and the one orchestrated moment of motion on a
promotion reveal.

This is a better outcome than the original all-dark screen, because the
contrast now works twice: the badge stands against its own dark ground, and
that dark inset stands against the calm light interface around it. The rule
from §6 still holds — if everything glows, the badge stops meaning anything —
and the glow is now confined to a single surface by construction rather than
by discipline.

## D17 — Today shows today, and only today

§10 says the screen is items due today and nothing else, so there is no day
picker on it. The three-day edit window is nonetheless enforced now, in the
check-in service rather than in a component: `saveAnswer` and `clearAnswer`
refuse a day that is closed or in the future, and `loadDay` reports a day's
edit state so a UI can disable its controls.

The surface for actually correcting an earlier day belongs with the history
view in stage 4, where the user is already looking at past days. Building a
second date-navigation UI on Today first would have been the wrong place for
it.

## D18 — "Nein" is neutral, never red

A yes/no answer records behaviour. Colouring the negative red would make
honest recording feel like failure, which is exactly the behaviour that stops
people opening the app in week three. "Ja" takes the domain's green; "Nein"
takes a neutral grey fill. Only the scale, where the user is rating something
themselves, uses the full poor-to-very-good ramp.

Removing an answer is a separate, explicit action — see D21.

## D19 — Scale answers wrap to five and five

Ten 44px targets never fit one phone row. They wrap to two rows of five
rather than shrinking below the minimum tap size. Each value carries its
band's soft tint even when unselected, so the direction of the scale is
visible before anything is chosen, and the selected value fills with the
band's readable weight. The qualitative word ("Gut") appears next to it —
colour never carries the reading alone.

## D20 — The palette is verified by test, not by eye

`src/styles/contrast.test.ts` parses the real token file, resolves `var()`
aliases and does the WCAG arithmetic: every `-ink` must clear 4.5:1 both on
white and on its own `-tint`, every filled control must carry its label, and
the card must actually separate from the ground.

This was not a formality. On first run it failed nine assertions, including
two `-ink` values that D14 claimed were text-safe and were not, and the
secondary button's own tint pairing. Ink-on-tint is the binding constraint
and it is easy to get wrong by eye, which is the whole argument for checking
it automatically.

## D21 — Selecting is not toggling; clearing is its own action

*Decided by the product owner, replacing the re-tap-to-clear behaviour
originally shipped in stage 3.*

Re-tapping the selected option leaves it selected. It does not clear the
answer. An iOS-style selection control is not expected to un-select on a
second tap, and treating it that way makes an accidental double tap destroy
data — the one thing a save-on-tap interface must never do.

Returning a question to unanswered is a small explicit "Antwort entfernen"
action that appears only once an answer exists, styled as quiet footnote
text with a full 44px tap target: secondary in weight, not fiddly to hit.

Two consequences worth recording:

- The controls are now single-choice, so they carry **radio semantics**
  rather than toggle-button semantics: `role="radiogroup"` with
  `aria-checked`, one tab stop per group, and arrow keys moving the
  selection. `aria-pressed` would now describe them wrongly, since it
  implies an option that can be un-pressed.
- `cycleBooleanAnswer` was **removed** from the check-in service rather than
  left unused. It encoded exactly the rejected behaviour, and dead code that
  still works is an invitation to wire it back up. `clearAnswer` remains and
  is now reached only through the explicit action.

## D22 — The trend runs on the overall daily score, not the rating

§12's example figures (642, 518) look like the 0–1000 rating, but the rating
engine is stage 5 and the Progress screen is stage 4. The curve therefore
plots the smoothed **overall daily score** as a percentage.

`core/trends` is deliberately generic over its series — it takes dated values
where `null` means "no data" and knows nothing about what they measure. Stage
5 can feed it the rating without touching the module, and the two curves have
the same shape anyway, since the rating is an exponentially weighted average
of exactly this score.

## D23 — A weekly sports target is resolved at the week's Monday

A week is scored against the target that was in force when it began. Using
the target as of each individual day would let a mid-week change retroactively
rewrite the earlier days of the same week, since the sports score is a
week-level value shown on every day of that week. Monday's snapshot is
deterministic and matches the plain reading of "the target I started this
week with". A change therefore takes effect from the following week.

## D24 — A running week with nothing logged has no data, rather than zero

The same principle as an open day (§11). A week that has not finished cannot
have missed its target yet, so with no sessions logged it is excluded from
the mean instead of scoring zero. Once anything is logged it reports running
progress, and a finished week reports the truth even when that truth is zero.

Without this, every Monday morning would open with the day dragged down by a
sports domain that had simply not happened yet.

## D25 — Days before the app was configured are neutral, never missed

History resolves each day against the snapshot in force then, and there is
deliberately **no fallback** to the earliest snapshot for days that precede
it. Nothing was due before the user configured anything, so those days are
neutral.

This was found by looking at a freshly onboarded profile: the Progress screen
showed a flat 0% line across thirty days, a "Höchststand" annotation on a
date before the app existed, and a grid of red for days the user was never
asked about — precisely the zero-filled chart §21 forbids.

## D26 — "Inactive" is a property the caller supplies, not one inferred

A closed day on which nothing was answered scores zero rather than being
excluded, correctly, because it was missed. But that means a run of missed
days looks like ordinary data to every average, and the inactivity
annotation §12 asks for would never fire.

`SeriesPoint` therefore carries an optional `inactive` flag that the caller
sets from what was actually recorded. The trend module cannot infer it from
the number alone, and pretending otherwise would have made the annotation
fire only in the rare case where nothing was even due.

## D27 — The rating is replayed, never stored

*Reinforces a requirement from the product owner: a rating shown for a past
date must come from the history valid at that point, and must not move
because of a later configuration change.*

`computeRating` is a pure fold that only ever reads backwards, over day
scores that were themselves reconstructed against the configuration snapshot
in force on each day. Nothing is persisted and read back, so there is no
stored value that could disagree with the history.

The consequence is tested directly: adding a question, archiving a question
and changing the sports target today all leave every past day's rating
byte-identical, and extending the history leaves the earlier points
unchanged.

## D28 — Inactivity decays the rating; it does not feed zeros into it

§11 and §13 pull in opposite directions here, and both are honoured by
splitting where each applies.

A closed day with nothing recorded scores **zero**, and the Progress screen
says so — that is §11 and it is the honest reading of a missed day. But
feeding those zeros into the moving average would cost roughly a third of the
rating for a week away, which §13 explicitly forbids ("a one-week holiday
must never cost several tiers").

So the rating treats a day with nothing recorded as *inactivity*: gentle
per-day decay after a two-day grace, capped per episode, with a fresh
allowance once the user returns. History tells the truth; the rating is
deliberately forgiving.

## D29 — The streak bonus eases in both directions

*Superseded by D33, which removes the separate bonus entirely.*

Found on a real seeded profile, not in the tests: the rank history showed
Legend → Champion → Legend within days. A broken streak was giving up its
whole bonus in one step, so at a tier boundary a single incomplete check-in
demoted the user — exactly the "a single bad day must never cost a rank tier"
rule.

The applied bonus now moves a quarter of the way towards what the streak has
earned each day, in both directions. Gaining a streak is slightly less
instant; losing one is no longer a cliff. A regression test pins the
boundary case.

Genuine multi-day oscillation across a threshold is still possible when the
underlying scores really do oscillate there. That is movement, not flicker,
and `RANK_DEMOTION_HYSTERESIS` is the constant to turn if it proves too
lively in real use.

## D30 — The trend now plots the rating (supersedes D22)

*Decided by the product owner.* With the engine in place, the Progress curve
plots the 0–1000 rating and reads `977 / 1000` as §12 shows.

The trend module was already generic over its series, so this was a change of
caller only. The rolling window is **one day**: the rating is itself an
exponentially weighted average, and smoothing it again would flatten the very
movement the screen exists to show. Days before the first scored day carry no
rating and stay out of the series entirely, so a new profile still gets the
empty state rather than a flat line.

## D31 — The badges are a ladder, and Legend leaves it

One shield silhouette gains framing, an inner bevel, side flanges, rays,
laurels and finally a cut jewel as the rank rises, with the metal warming
from steel through bronze to gold. Legend abandons the shield entirely for an
eight-point prism inside a broken orbit — §15 asks for a treatment "clearly
unlike every other badge", and one more shield with a brighter gradient would
not have been that.

All geometry is drawn here rather than adapted from anything published. Each
instance scopes its gradient ids so two badges on one screen cannot collide.

## D32 — The promotion reveal plays once

The rank itself stays derived. What is stored is only `acknowledgedRankId` —
that the user has *seen* a rank — so the one orchestrated animation §6 allows
plays on promotion and not on every visit to the screen. Reduced-motion
users get the same information with no animation at all.

## D33 — The streak is part of what the rating tracks (supersedes D29)

The eased-bonus fix from D29 stopped the immediate cliff but left a tail: one
bad day broke the streak, and the bonus kept unwinding for three more days
while every one of those days was perfect. Measured on a settled profile just
inside Legend, the rating fell 958 → 925.9 → 921.4 → 919.7 and stayed below
the demotion line — so the bad day did cost the tier, days later.

The streak bonus is no longer a figure added to the rating. It is part of the
**target** the moving average tracks, so a lost streak decays at the same
half-life as everything else. The same measurement now falls once, on the day
itself, and rises monotonically afterwards; what remains of the tail is the
carried bonus lapsing for a single day, worth 0.17 points.

`STREAK_BONUS_SMOOTHING` is gone with it — the fix removed a constant rather
than adding one.

A day is judged with the streak it was **carried into**, since that is what
the run up to it earned. Cancelling the bonus on the very day it breaks made
an honestly reported partial day come out fractionally worse than saying
nothing — a small gap, but pointing the wrong way.

## D34 — Demotion must be sustained; promotion is immediate

Reaching a rank is an achievement the moment it happens, so promotion is
instant. A demotion now requires the rating to sit below the hysteresis
buffer for `RANK_DEMOTION_SUSTAIN_DAYS` scored days running.

This is what makes "a single bad day must never cost a tier" hold for the
whole tail of that day rather than only for the day itself: a dip that
recovers within a couple of days was never a change in standing. The
protection is not an inability to fall — sustained poor performance still
demotes, and that is tested.

## D35 — A day counts on what was reported, in proportion to how much was

The sharpest incentive problem found in stage 5. From a settled rating of
900, answering **one of three questions "yes"** — real partial progress —
cost **27 points**, while recording nothing cost **zero**. Logging an honest
partial day was materially worse than pretending to have been away.

The cause was using §11's score, which divides by items *due*, as the
rating's input. That is right for history, where an unanswered item is a
miss, but wrong for the rating, because it conflates not doing a thing with
not saying so.

The rating now uses `recordedScore` — the score over items actually reported
— weighted by `answeredItems / dueItems`. The same day now moves the rating
**+1.6** instead of −27, more of the day reported moves it more, and the cost
of a bad day scales continuously with how much was reported, so there is no
cliff that would reward leaving one question permanently blank.

**The residual, stated plainly.** Reporting a failure still costs more than
silence: one of three answered "no" costs about 14 points where silence costs
0 to 1.5. That difference is inherent to §13 — an unrecorded day is forgiven
precisely because the user may simply have been away, while a reported "no"
is information. It cannot be removed without either punishing holidays or
ignoring reported failure. What is guaranteed instead: the gap is under a
fifth of a tier, it shrinks continuously to nothing as less of the day is
reported, and silence still forfeits XP, the streak, and shows as a missed
day in the history.

## D36 — The rating folds over reconstructed daily state, not a score series

*Wording and architecture point raised by the product owner.*

`DayState` carries status, the §11 score, the recorded score, items due and
answered, whether anything was recorded, and whether the day was completed. A
zero because the user answered "no" and a zero because nothing was recorded
are deliberately treated differently, and how much of a day was reported
decides how much it counts — none of which can be recovered from a number
alone. The distinction is part of the deterministic input by design.

## D37 — A rest day inside a trained week is not inactivity

Found in the stage 6 verification pass, on the configuration least exercised
until then: Sports with no Mental Wellbeing questions at all.

A weekly target is met over a week. Training Monday to Wednesday and resting
Thursday to Sunday *is* a three-a-week target being met — but the rating was
treating those four rest days as absence and decaying them, punishing exactly
the pattern the target asks for.

Inactivity now means the user was away, not that a particular day was quiet:
a day counts as recorded when something was recorded on it, or when there was
no daily obligation that day and the week it belongs to has training. A day
with questions due is still judged on its own, because there the obligation
really is daily. A week with no training at all still decays.

## D38 — A session can be moved to the day it happened, within its week

§17 makes a session editable within its week, and the day is part of the
session. Without this, forgetting to log Monday's run until Wednesday left no
truthful option: the only path was to log it as Wednesday.

The sheet offers the seven days of the session's own week, with days still to
come disabled. Moving beyond the week is refused by the same rule that
governs every other edit to a session, so the week a target counts over
cannot be rewritten after the fact.

## D39 — A backup carries source data only

Ratings, ranks, peaks, streaks, XP, trends and day scores are all replayed
from answers, sessions and configuration snapshots (D27), so exporting them
would ship two versions of the truth that could disagree — and the derived
one would be the stale one. The file holds settings, domains, questions,
answers, sessions, configuration snapshots and rank events, and nothing that
can be recomputed.

Records are sorted by id on the way out, so exporting the same profile twice
produces identical bytes. That makes "export, import, export" comparable
rather than merely equivalent.

## D40 — Two version numbers, because they move for different reasons

`formatVersion` describes the envelope, `schemaVersion` the records inside
it. A future reader can then say *which* of the two it does not understand,
and either being higher than this build knows is refused outright rather than
guessed at.

## D41 — Import replaces; it never merges

Version 1 has no conflict resolution and should not invent one. Merging two
histories would produce a profile that never existed, with a rating matching
neither — and the rating is a fold over the whole history, so a merged
timeline is not a repair, it is a fabrication.

The whole file is validated before anything is touched, and the replacement
runs as a **single IndexedDB transaction** across every store. A rejected
file, or one that fails partway, leaves the existing profile exactly as it
was. Importing the same backup twice is idempotent.

## D42 — The service worker never applies an update on its own

The failure §4 names is a user unknowingly stuck on an old build. So a new
version installs and then *waits*: the app shows an unobtrusive prompt and
the reload happens only when the user taps it, and exactly once — guarded
against the `controllerchange` event firing more than once.

One cache per build, named from the built asset filenames, so activation
cannot leave a mix of old and new assets. The worker never reads or writes
IndexedDB: activating a new version replaces cached code and cannot touch a
single answer.

Navigations are served from the cached shell first rather than trying the
network first, because the app is local-first and has everything it needs
without a request succeeding — network-first would make every offline launch
wait for a timeout.

## D43 — Storage failures say which failure they are

`StorageError` carries a reason — unavailable, blocked, newerData, failed —
and the screen offers the action that actually helps: a reload when an old
tab is running against newer data, a retry otherwise. A migration that throws
aborts its transaction rather than leaving a half-migrated database.

## D44 — The precache list is generated, never written by hand

A hand-maintained list drifts the first time a filename changes, and the
symptom is an installed app serving half of an old build. The build plugin
takes the list from the bundle, so the possibility is removed rather than
managed.

## D45 — Rank badges differ by silhouette first, ornament last

Every badge is read at 38px far more often than at 148px, so the things
that separate one rank from the next are the outline, the dominant hue and
one bold central mark. Ornament — wings, wreath, starburst, crown — is an
accumulating signal of rarity, not the thing that identifies a rank. Below
56px the smallest of it is dropped rather than rendered into mud.

Depth is layered geometry, not filters: a shadow underlay, a diagonal metal
gradient, a clipped specular sweep and a shaded lower body. The Rank screen
can show a dozen badges at once, and a Gaussian blur on each would cost far
more paint than the softness is worth.

An earlier pass washed the crest face with a light inner bevel, and every
rank came out the same silver — the rim carried the hue and the body did
not. The bevel is a stroke now, and the metal gradient holds its saturated
mid-tone across most of the face.

## D46 — Legend is a different kind of object, not a shinier shield

Every other rank is a crest that grew. Legend is a radiant core inside a
broken orbit, with no crest at all. Making the top of the ladder differ in
degree — one more shield, more gold — leaves it looking like Champion with
the contrast turned up; differing in kind is what makes it read as the end
of the ladder at any size.

## D47 — Rank history shows the emblem that was reached

The history list used bare ↑/↓ glyphs, so the one place that shows the
ladder as a sequence showed none of it. Each entry now carries the badge of
the rank reached, with the direction kept as a separate glyph on its corner
— colour is never the only carrier of promotion versus demotion.

## D48 — The eight-rank badge family is locked for V1

The family shipped in D45–D47 is the V1 design and is not revisited for
polish. That fixes four things in particular: Champion steps sideways into
platinum-gold with a crimson gem rather than trying to out-yellow Master;
Rookie stays deliberately restrained, with no aura and no ornament, because
the floor of the ladder has to look like the floor; Legend stays
structurally distinct from the shield-based ranks; and rank history keeps
the badge of the rank reached.

Further changes need an actual defect — usability, accessibility,
rendering or integration — not a better idea about the artwork.

## D49 — An answered question folds away, and the fold is not instant

*Deferred from stage 3 to the stage 8 review by the product owner.*

Today shows what is still open. An answered question folds to one line —
the question, and what was answered — so a finished check-in reads as a
short list of receipts rather than a wall of controls that have already
done their job. Tapping the line opens it again: nothing is hidden, only
folded.

The fold waits about six-tenths of a second. Answering something and having
it vanish under your finger reads as the app taking the screen away, and it
hides the scale's band label at the moment it is most useful. The row stays
open long enough to see the answer land, then closes. The timer is checked
against what is on screen when it fires rather than what was expected when
it started, because the write is asynchronous and can outrun the delay.

The summary states the band, not only the number — "8 · Sehr gut" — for the
same reason the scale itself does: a number alone is not an answer.

A folded panel is `visibility: hidden` once the fold finishes, so it leaves
the tab order and the accessibility tree instead of merely being invisible.
The fold animates `grid-template-rows` from `0fr` to `1fr`, which needs no
measured height; the spacing lives inside the clipped box, because padding
on the clipped box itself survives the fold as a strip of empty space.

## D50 — A screen that cannot load says so

Today rendered an empty `<div>` when its day failed to load — a blank
screen with nothing to act on. It now states what happened and offers a
retry. The failure is reported without naming the storage layer, per the
stage 7 copy rule, and carries no icon: the icon set has no failure mark,
and the celebratory one reads as the opposite of what happened.

## D51 — Placeholder drift is caught by test

English is typed against German, so a missing or misspelled key is already
a compile error. A placeholder renamed inside one string is not: `{total}`
in German and `{totals}` in English compiles and ships a literal brace to
the screen. A test compares the placeholder sets per key, checks that
supplying the expected parameters leaves nothing unfilled, and rejects
empty strings.

## D52 — One way to load a screen, with three states that cannot be confused

Today, Progress and Rank each read from storage on mount, and each had grown
its own version of that effect. The versions did not agree, and none of them
was right: a rejected load left Rank spinning forever, left Progress blank,
and left Today blank until D50. None could be retried, because the load
lived in an effect with no dependencies and nothing else could re-run it.

`useLoadable` is the single version. It is a hook rather than a component
because what counts as *empty* depends on the data and belongs to the screen;
only loading, failure and readiness are general. They are three variants, so
a screen cannot render one as another — the bug that made a failure look like
a load still in progress is now unrepresentable.

Two properties are easy to lose when this is written per screen, so they are
written once:

**A retry is a fresh attempt.** Every attempt takes a ticket and a reply is
accepted only while its ticket is current, so a slow first attempt that
resolves late cannot overwrite the retry that replaced it.

**Content already on screen survives a failed refresh.** Reloading after a
write is not a reason to throw away what the user was reading. The value is
kept and marked stale, and the screen says so quietly instead of emptying.

## D53 — A failure is louder than a stale view, and both are quieter than nothing

A screen that never loaded shows an alert with a retry, and takes focus when
it appears: the content the reader was waiting for did not arrive, and the
next thing they need is one tab away. A screen that *did* load and then
failed to refresh keeps its content and shows a status line — not an alert,
because nothing on screen is wrong, only possibly out of date.

Neither says why. "Deine Einträge sind gespeichert" is what the user needs;
the storage layer is not mentioned anywhere, per the stage 7 copy rule.

## D54 — A write that fails is reported, and the screen returns to the truth

Every configuration mutation was fired with no rejection handler. A failed
write left the interface showing a change that was never stored, and a failed
`applyOnboarding` stranded a new user on the last onboarding step for good:
the button did nothing, said nothing, and there was no way forward.

Mutations now report a refusal and reload, so the screen shows what is
actually stored rather than what was attempted. In onboarding the message
sits above the button that retries it, because there the button *is* the
retry. Elsewhere it is a dismissible banner over the tab bar.

The same hole existed in the backup import: `replaceAllStores` can throw, and
the confirmation stayed on screen for good with no message. The replace is
one transaction, so a throw means nothing changed, and it is now reported as
such.

## D55 — Compiled output never sits beside its source

`npm run typecheck` was `tsc -b --noEmit false --emitDeclarationOnly false`,
which overrode the projects' own `noEmit` and wrote a `.js` next to every
`.ts` — including `vite.config.js` beside `vite.config.ts`.

That is not untidiness. Vite resolves `./useDay` to `useDay.js` before
`useDay.ts`, and loads `vite.config.js` before `vite.config.ts`, so running
the typecheck and then the build produced a bundle built from stale
JavaScript, with no warning and a passing build. It was found here only
because a change that was definitely in the source was definitely not in the
bundle.

Three things close it: the script no longer emits, `resolve.extensions` puts
TypeScript ahead of JavaScript so an artefact cannot shadow its source again,
and the artefacts are ignored so they cannot be committed.

## D56 — The strips are decorative; a table carries the numbers

Thirty bars per row, with no interaction on any of them. Making each a stop
would be thirty tab stops and thirty announcements to say what one sentence
says — and it still would not answer the question a screen reader actually
has, because the bars never carried the dates. Only the count of days was
ever exposed, as one aria-label per row stating the average.

So the strips are `aria-hidden`, and the same data is rendered as a real
`<table>` that nobody sees: dates as column headers, rows as row headers,
values in percent, "Keine Daten" where there are none. That is a semantic
alternative rather than an addition — nothing is announced twice — and it
turns the grid into something a reader can navigate by row and column
instead of listening to end to end.

Each row header also carries one hidden sentence, "24 von 30 Tagen erfasst,
6 ohne Daten", for the shape of the strip without entering the table. On the
expandable rows that sentence is the button's *description*, not part of its
name: the name says which row it opens.

The wrapper carries the hiding, not the table. `.visually-hidden` clamps to a
1px box, and `display: table` ignores that — its box is sized by its content,
so thirty-one columns of dates made a very wide absolutely positioned element
that only `clip-path` was keeping off the screen.

## D57 — The chart is one image, and the answer is next to it

The trend curve stays a single `role="img"`. Its internals are a gradient and
two paths; exposing them would be noise, and the numbers that matter are
already real text beside the chart — the direction in a word, the current
value, the value before it, the annotations. Delete every SVG on the screen
and the trend is still readable, which is the actual test.

The label adds only what the shape alone knew: where the line started, where
it ended and the range it covered. It used to say "30 Tage" and nothing else.

## D58 — Values are rounded wherever they are spoken

The replay produces values like 70.83333333333333. The visible grid always
rounded them; the accessible table did not, so a reader heard thirteen
decimal places for a number the screen shows as 71.

## D59 — A section can be named without being labelled

The trend card and the history grid each carry their own visual title — a
range, a legend — so a grey heading above them would be repetition. Without
any heading they were unnamed regions that a screen reader could neither
navigate to nor skip. `Section` can now render its heading visually hidden,
which structures the document without adding chrome. The shell also gained
the `main` landmark it never had.

## D60 — Hit areas grow; the design does not

An iOS switch is 51×31, a segmented option 40 tall inside a 44px track, and
a sheet's close button 30×30. All three are smaller than the 44px this
project sets as its own minimum, and all three are that size deliberately —
they are the native proportions.

Growing the boxes would change the design. Growing the *targets* costs
nothing: an invisible `::before` extends each to 44px, over areas that hold
nothing tappable. The pixels are unchanged and the thumb has the room the
project promised.

Measured by hit-testing rather than by the elements' own boxes, because an
element's rectangle says nothing about where a tap actually lands.

## D61 — A decorative image claims no name

The rank badge carried `role="img"` and `aria-hidden="true"` at once. The
`aria-hidden` wins, so nothing was broken, but the pair is a contradiction:
an image role promises a name the badge has no way to supply, and does not
need to — the rank's name is always in text beside it.

## D62 — Zoom is never blocked

The viewport meta carried `user-scalable=no`. Android Chrome honours it, so
pinch-to-zoom was taken away from anyone who needs it — a straight
accessibility failure, and there was nothing to protect: the layout holds at
the narrowest supported width and the type scale is fixed in px, so nothing
reflowed badly when zoomed.

## D63 — The document's language follows the interface

`<html lang>` was fixed at `de`. Switching to English left a screen reader
pronouncing English words with German phonetics. The provider now sets it
whenever the language changes.

## D64 — The gap gives way before the tap target

At 320px, five 44px scale bubbles plus four 8px gaps come to 252px inside a
240px card, and the card's `overflow: hidden` silently cut the right-hand
edge off 5 and off 10. Below 360px the gap drops to 4px, which fits without
taking the targets under 44px or breaking the five-and-five layout.

The reason this survived earlier passes is that a document-level overflow
check cannot see it: the card clips its own content and the page never gains
a scrollbar. The regression check now asks every element whether it fits
inside whatever is clipping it.

## D65 — A generic storage failure no longer blames private mode

`error.storage.body` — the fallback for an unclassified failure — was a
byte-for-byte copy of `error.storage.unavailable`, so any storage error the
app could not classify told the user their browser was in private mode.

---

# Iteration 2

Decisions made building iteration 2, continuing the numbering above. Where
these refer to a decision from the iteration 2 brief they say so explicitly —
that document has its own D-numbers, and the two sequences are unrelated.

## D66 — Wellbeing keeps `mental` as its stored name

The product calls the domain Wellbeing. The discriminator every answer row
carries still says `mental`, and will keep saying it. Renaming it means
rewriting every answer, every question and every config snapshot on every
device, in exchange for a label — and the label belongs in the string layer,
where it can differ per language anyway. Display name changes; type does not.

## D67 — Boss weights live in the config snapshot

The brief's D3 asks that a weight change apply forward only and never rewrite
historical Boss progression. That reads like a demand for an append-only Boss
log, which would be a departure from replay.

It is not needed. Weights go into the config snapshot, and the replay already
evaluates every day against the snapshot in force on that day. Editing weights
today changes what today and every later day mean and cannot reach January.
Nothing is stored that could drift from what is replayed, and there is no
second source of truth to keep in step.

## D68 — A snapshot with no `boss` field is the RC2 era

This is the whole of the grandfathering mechanism, and it needed no new data.

Every snapshot RC2 wrote lacks the field. The Boss replay reads that absence
as "one undivided progression" and uses the legacy rating for that day — so
the Boss for a pre-upgrade day is not a number carried across a boundary and
seeded, it is the same replay RC2 ran. Pre-upgrade Boss history is exactly
what the user already saw and cannot drift. Every snapshot this build writes
carries weights, so the marker stays unambiguous.

## D68a — The Boss accumulates weighted movement from the RC2 anchor

*Required at the Phase 1 review, replacing the era step this originally had.*

The rule is that **an application upgrade alone must not create progress or
take progress away.** The first implementation broke it: the RC2 era averaged
Wellbeing and Sport into one number, the new era took the weighted *level* of
the separate ledgers, and those are different quantities — so the Boss could
move a tier on the day the update landed, without the user doing anything.

The Boss now continues from where the RC2 era left it and moves by the
weighted *movement* of the domain ledgers:

```
boss[t] = clamp( boss[t-1] + Σ w[d,t] · ( p[d,t] − p[d,t-1] ) , 0 , 8 )
```

`p[d,t]` is domain `d`'s ladder position on day `t`; `w[d,t]` are the weights
in the config snapshot in force on day `t`, normalised over the domains that
are enabled, weighted, and have actually started. The anchor `boss[t0-1]` is
the RC2 era's final value, bit for bit. A profile with no RC2 era has nothing
to continue from, so it opens at the weighted level of what it has — the one
place a level is used at all.

What this buys, beyond continuity:

- **A domain ledger's starting rating stops being visible.** It is an
  arbitrary constant; in a weighted level it would read as real standing, and
  in a difference it cancels.
- **Weights stay forward-only.** Each day's movement uses that day's
  snapshot, so changing weights today cannot reach back, and enabling Food
  later cannot alter a single earlier Boss value.
- **A domain that has not started contributes nothing** and its weight leaves
  the denominator with it, so it cannot drag the Boss towards zero — and a day
  on which nothing has started moves the Boss by zero.
- Lifetime XP is a sum over history that only ever grows, and peak rank is a
  maximum over a series that now runs unbroken through the anchor, so neither
  can fall at the boundary.

It is not smoothing and not a grace period: no value is adjusted towards
another, and nothing is suspended for a while. It is one continuous series
whose increments change definition at a point.

## D69 — The Boss averages ladder position, not rating

Ranks do not span equal numbers of rating points: Rookie covers 120 and
Legend covers the last 50. Averaging ratings would let the shape of the tier
boundaries distort the mean. The Boss averages the position on the ladder —
rank index plus the fraction climbed towards the next rank, on one continuous
0–8 scale — which is the quantity a user actually experiences.

Legend measures its fraction across the rest of the rating range rather than
sitting at a flat 7.0, so a maxed-out domain keeps contributing. The result is
converted back to a rating so the Boss inherits the existing hysteresis and
sustained-demotion rules instead of growing a second copy of them.

## D70 — A domain that has never been used is left out of the Boss

Not counted as zero, and not given a history it never had. Boss continuity
(D68a) and domain-history truth are separate concerns, and solving the first
by fabricating the second — handing Gym, Running and Food the user's old
overall rank as a stand-in — would make every domain screen a lie.

A domain contributes from the first day it actually has a scored, recorded
day, and its weight leaves the denominator until then. Legacy Sport is the
one exception, and only because the user themselves said what those sessions
were.

## D71 — Converting legacy Sport copies the sessions, it never moves them

Every day before the conversion resolves to a config snapshot in which Sport
is the enabled weekly domain, and snapshots are never rewritten. Deleting the
rows those days count would turn a year of met targets into a year of empty
weeks — the user's history rewritten by an act meant to reinterpret it. The
legacy rows stay; the domain that holds them going forward changes, from the
day of the conversion.

Nothing is fabricated in the copy. RC2 recorded no distance, elevation or step
count, so a converted run has none. Duration is carried only where the user
actually entered one. The weekly target is inherited because it is the number
the user themselves set.

And there is no default: until the user answers, `legacySportMigration` stays
`pending`, the sports domain is untouched and the app works exactly as it did.

## D72 — The decay placeholder is RC2's decay, unchanged *(superseded by D113)*

The cooling-off formula is a product-owner gate. A placeholder that guessed at
it would quietly become it: every screen built in phases 2 to 6 would rest on
a number nobody approved, and the approved formula would then read as a
regression. The provisional model reproduces RC2 day for day, behind one
switch and one flag, and a test asserts the flag and the model cannot
disagree.

Rest days and pause periods are already-approved product decisions rather than
part of the formula question, so the input carries them and the placeholder
honours them. On RC2 data this changes nothing, because RC2 recorded neither.

> **Correction (D115, D116, D117).** The claim that rest days and pause
> periods were "already-approved product decisions" was **not supported by
> anything in this repository** — no such decision existed here, and the
> D42/D43 citations behind it point at a document that has never been in it.
> Rest days are now deprecated as a product concept (D115); pause periods are
> now genuinely approved, with semantics decided rather than assumed (D116).
> The sentence above stands as written because it is what D72 said at the
> time; it should not be read as evidence of a prior approval.

## D73 — The week lookup was quadratic, and the measurement found it

Reconstructing the weeks looked up each week's first day by scanning the whole
date range. At two years that scan was five sixths of the entire cost of a
replay — 338 ms of 427 ms — and it grew as the square of a user's history. It
was there in RC2 too; nobody had a long enough profile to feel it.

Remembering the day while walking the range removes it: two years of four
domains now replays in about 60 ms, of which 25 ms is reading the answers.
The four per-domain ledgers and the Boss aggregation together cost about 4 ms,
so memoising day scores would buy nothing and is not being done.

## D74 — Wellbeing questions are picked from categories, not from a list

The daily score means within a category before it means across them (D17 of
the brief), so choosing six questions from one shelf and none from another is
a decision about weighting whether the user knows it or not. Showing the
shelves is how they get to know it — in the picker, and again in Areas, where
the questions are grouped the way the score groups them.

"Eigene" is not one of the shelves offered. It is where a question the user
writes lands, not a place with anything on it. A question written from scratch
defaults to it and can be moved anywhere.

## D75 — The 1–10 palette needs four values per band, not one

The product decision is about hue: 1–4 red, 5 orange, 6 yellow, 7–8 green,
9–10 dark green. The accessibility half of it is not settled by that, and
cannot be checked by eye.

One colour cannot do four jobs, so each band declares four: a `-fill` at full
strength for a selected control, an `-on` that reads on that fill, an `-ink`
that reads on white and on the band's own tint, and a `-tint` for the
unselected ramp. `-on` is white for four of the five and near-black for
yellow — a yellow dark enough to carry white text is not a yellow any more.

Two consequences worth naming. A yellow fill cannot clear 3:1 against a white
card, so a selected control is outlined in its own ink; that outline is what
makes it a graphical object rather than a pale wash, and every band carries it
so the selected shape is the same all the way along the ramp. And green and
dark green are two steps of one hue, so they are separated by luminance as
well — `contrast.test.ts` checks the gap, because hue alone would leave 8 and
9 indistinguishable for a colour-blind reader and the ramp would lose its top
half.

Red and orange sit at similar luminance and are told apart by hue alone. That
is inherent to the mapping asked for, and it is why the number is always
present next to the colour.

## D76 — Tapping a question in Verlauf opens the question, not Today

Verlauf is where you look; Today is where you act. Someone who taps a question
in a history view is asking how *that* has been going, and landing them on a
check-in answers a question they did not ask. The drill-down is its own
screen: the question, its category, the latest answer, the average, a chart,
and the recent days as a list.

Answering today is offered as a secondary action, and only while the question
is actually being asked — a paused or archived question has no check-in to
reach, and a button that leads nowhere is worse than no button.

The values there are the answers themselves, 1 to 10 or yes and no, not the
percentages the history grid works in. A percentage is the right unit for
comparing a day against a week and the wrong one for reading back what you
said.

## D77 — Today shows one card per training domain

Gym and Running are separate quotas, so a week that met one and missed the
other has to read that way. The check-in service returns a list rather than a
single Sport view, and each log — gym sessions, runs, and RC2's Sport log —
sits behind the same small view type. Phases 4 and 5 add sets and distances
behind that, not instead of it.

The retired Sport card is read-only: it still shows the week it was scored in,
and there is no button that adds anything to it.

## D78 — Grouping the question picker made the step the scroller

The picker used to be one flat list that scrolled itself. Grouped by category
it is several lists on one step, and several independent scrollers is not a
screen — the last question of the first group sat under a footer it could not
scroll past. The step scrolls now and the lists inside it simply flow.

Found by driving the flow in a browser rather than by reading the CSS, which
is the only way this class of defect is ever found.

## D79 — The scoring model is recorded in the snapshot, never inferred

D18 changes the arithmetic of a Wellbeing day: the mean within each category,
then the equal-weighted mean of those. That makes "which arithmetic was this
day scored by" a fact about the day, and no amount of looking at the shape of
the data can recover it — a January day and a December day hold identical
records and mean different things.

So `AppConfigSnapshot.scoring.model` says which. Every snapshot this build
writes says `categoryMean`; a snapshot with no model was written before the
change and is `flat`, which is what those days were. The snapshot also had to
start carrying each question's **category**, so a past day is scored by the
categories in force then rather than by wherever the question sits today.

The change is forward-only by the same mechanism as everything else: the new
snapshot takes effect from the day it is written.

## D80 — What an unanswered question means under category scoring

The two numbers a day produces answer different questions, and they treat an
absent category differently on purpose.

- **`recordedScore`**, which the rating tracks, is the mean of the categories
  that have an answer. A category with nothing answered has no data and leaves
  the denominator with it. It never contributes a zero it did not earn.
- **`score`**, which history shows, divides each category by the questions
  **due** in it on a closed day. A category where nothing was answered
  contributes 0, because those items were genuinely missed. That is the flat
  model's own rule applied per category, not a new one.

The consequence worth naming: for a user who answers one category and skips
two, the history number is harsher than the flat model was — three categories
where only Mental was answered read (0 + 0 + 80) / 3 rather than 80 × 4 / 7.
Equal weighting cuts both ways, and that is what equal weighting means.

"Eigene" is a category like any other. A custom question counts towards
whichever category it is currently in, with no hidden weighting either way.

## D81 — One authoritative rank progress calculation

The Rank screen filled its bar from the rank it was **displaying** and wrote
the sentence underneath from the rank the rating **naturally falls in**. Those
are the same rank almost always, and different exactly where it matters: in
the hysteresis buffer, where a user is held at a rank the rating has slipped
below. There the bar read empty while the copy said "12 points to Master" —
the rank they were already holding.

`rankProgress(value, displayed)` now derives the floor, the ceiling, the
fraction, the percentage and the remaining points together, from one rank.
Three states are handled explicitly rather than left to the formula: the top
of the ladder measures across the rest of the range and counts down to
nothing; a rating below the displayed floor reads empty and counts to the rank
above; and with no rank held, the rank the rating falls in is used.

`displayedRankProgress` rounds once before deriving anything. A rating of
671.6 shows as 672 and leaves `ceil(700 − 671.6) = 29` points, so the screen
read "672 / 1000" and "29 to Master" — two right answers that read as one
wrong one to anyone who subtracts. Rounding first costs a fifth of a pixel of
fill and makes the three numbers agree.

## D82 — Boss weights are set in parts, shown in percentages

Percentages that must total exactly 100 are a spreadsheet: every adjustment
forces a compensating one somewhere else, and on a phone that is four sliders
fighting each other. The user sets **parts** — "gym matters twice as much as
food" — and the share is arithmetic.

The arithmetic is not hidden, which is the other half of the rule. Each row
shows its parts and the percentage they work out to, the total is stated
underneath, and it is always 100 because it cannot be anything else. There is
no save button and no invalid state to save.

Whole percentages are apportioned by largest remainder rather than by dumping
the rounding on the last row, so the one row that reads 34 where three areas
share 100 is the one that was closest to it.

## D83 — Mystery is withheld richness, not a disabled state

An unearned rank keeps its name, its threshold and its **silhouette** — the
silhouette is what makes the ladder browsable and is the honest part of the
promise. What it does not get is the emblem: the metal goes to three neutral
greys, the aura to nothing, the central mark to the body's own grey, and the
ornament that only appears above 56px is left out at every size.

The veil over it is drawn, not filtered. A Gaussian blur would soften it more
convincingly, cost real paint time on a screen showing eight badges at once,
and take the silhouette with it. Diagonal hairlines over a pale scrim read as
frosted glass at 148px and as a grey plate at 32px, which is what each size
needs.

The state is a word beside the badge, never the badge alone.

## D84 — The exercise-day metric is the best set, and only the best set

`max(reps × weight)` across the day's completed sets of one exercise. Ten at
10 kg and six at 20 kg are both 100; eight at 15 kg is 120 and wins.

It is not total volume, not the sum of the set scores, not their average, not
the average weight, not an estimated one-rep max, and not the heaviest weight
alone. Every one of those is a familiar fitness-app number and none of them is
this one. Tied bests change nothing, because a maximum has no opinion about
which set achieved it; a screen that needs to name a set takes the earliest by
order, and nothing downstream reads it.

Weights are stored in **whole grams**. `reps × weight` is compared against a
previous workout's, and a comparison of floating-point products can call two
identical sets different. Integers cannot drift, grams cover a 0.5 kg
micro-plate with room to spare, and the displayed unit stays entirely the
interface's business — which is what makes pounds a later change to one
formatter rather than to the data.

## D85 — A first workout has no baseline, and says so

Four states, not a number: `noBaseline`, `improved`, `unchanged`, `declined`.
A first-ever recording has nothing to compare against, and reporting that as
+0 % or −100 % would be inventing a baseline out of an absence.

Two absences are deliberately not failures either. A **skipped** exercise is
compared against the last day it was actually recorded, whether that was last
Tuesday or in March. A **long gap** does not enter the comparison at all:
coming back after two months and matching your old best is `unchanged`,
because that is what happened.

The join is the exercise's stable id. Renaming "Bench Press" continues one
history; two exercises that happen to share a display name keep two.

## D86 — Muscle groups are equal-weighted, and a two-muscle exercise counts once in each

An exercise's ratio is the ratio of its most recent comparable day. Every
group it is mapped to receives that ratio, a group's value is the plain mean
of what it received, and the Gym aggregate is the **equal-weighted mean over
groups**.

Chest with five exercises and legs with two do not become five sevenths and
two sevenths. And a deadlift mapped to back and hamstrings raises both, which
is what "it trains both" means — it cannot amplify itself, because inside each
group it is one voice among that group's exercises and the groups are equal
above.

Only groups with a measurable comparison enter the denominator. A group nobody
has trained is `noData`, a group trained once is `insufficientBaseline`, and
neither is an earned zero: the app has never treated absence as failure, and
scoring an untrained calf as a failed calf would be the first time.

Over a longer window the comparison is each exercise's **whole span** — most
recent recorded best against its first — rather than day against day. That is
what stops training frequency from becoming structural weight: benching twice
a week produces more observations than benching fortnightly, and averaging
them would let a frequent trainer's chest outvote their legs. Frequency
changes how much evidence there is, never how much a muscle counts.

## D87 — A set records the muscle groups it was logged under

The one Gym fact that depends on configuration is the exercise→muscle mapping.
Rather than snapshot the whole catalogue, each set stores the groups its
exercise had at the moment it was written.

That makes the replay independent of the catalogue entirely: correcting a
mapping applies from that point forward and cannot reach into a workout
already done, exactly as every other configuration change in this app behaves.
It costs one short array per set row and it needs no snapshot growth at all,
which is the smallest correct extension of the architecture that was already
there.

Nothing is ever inferred from an exercise's name. A wrong guess would send a
user's work quietly to the wrong part of the body.

## D88 — Gym's rank still counts sessions, and the screen says so

The Gym day score that feeds the rating is unchanged by phase 4: sessions
against the weekly quota. Performance is a *rate of change*, and mapping a
rate of change onto a 0–1000 level requires deciding what rate equals what
level — which the specification does not define and which is not a detail to
settle in passing.

So phase 4 computes performance, shows it, and does not feed it into the
rating. The progress screen states that outright rather than leaving a user to
work out why a good month did not move their rank. The mapping is the one
product decision this phase deliberately leaves open.

## D89 — The body is a diagram, not an illustration

Rounded blocks laid out on a torso outline, front and back side by side. They
read at 120 px on a phone, stay legible with ten of them lit, and can be
maintained by anyone who can read a rectangle. An anatomical rendering would
look better in a screenshot, cost far more to keep correct, and imply a
medical precision the app has no business claiming.

The renderer computes nothing. Every value arrives from
`core/gym/performance.ts`, so a number here and a number on the progress
screen cannot disagree. The figures are `aria-hidden` and the legend beneath
carries every group, its state in words and its value — the answer to "which
muscles are improving" never depends on telling two fills apart.

## D90 — Gym's rating is 40 % attendance and 60 % personal development

*This closes the decision D88 deliberately left open.*

Phase 4 computed performance, showed it, and did not feed it into the rating,
because mapping a rate of change onto a 0–1000 level was undefined. It is now
defined:

```
target = 0.40 × attendanceScore + 0.60 × performanceScore
```

The thing worth writing down is not the split but what the split is *about*.
**A Gym rank is a statement about the user against their own history, and
never about the user against anyone else.** Someone pressing 30 kg who turns
up three times a week and adds a rep a month outranks someone pressing 120 kg
who trains occasionally and has not moved in a year. That is not a compromise
forced by having no population data; it is the product. Absolute strength is a
real thing and it is measured somewhere else (D95).

Two consequences follow directly:

- **No population norms enter Gym rating, ever.** Not as a modifier, not as a
  calibration, not as a "starting estimate".
- **Performance is available from the second comparable training**, not after
  a month. Waiting would have meant a user's first month did not count, and it
  would then have had to be invented back.

Where performance has no baseline yet, the target is attendance **alone** —
the app's existing available-score rule, the same one that leaves an
unanswered Wellbeing category out of the denominator rather than scoring it
zero. Attendance plus a fabricated neutral 500 would be a claim about a user
who has simply not repeated an exercise yet.

The change is an era, marked the way every era in this app is marked: a config
snapshot with no `scoring.gymModel` predates it and replays as attendance
against the weekly quota, exactly as those days were actually scored. The new
fold continues from the number the old one left, so the day the update lands
moves the rating by one ordinary step rather than by a jump — the same
continuity rule the Boss follows across its own boundary (D68a).

## D91 — Effective load, so a pull-up is not a lift of nothing

The primary metric is untouched: `max(reps × effectiveLoad)` over the day's
sets, exactly as D84 defined it. What changes is that `effectiveLoad` is not
always the number on the bar.

```
external    load = the weight lifted
bodyweight  load = bodyweight + added weight
assisted    load = bodyweight − assistance
```

**The bodyweight is replayed, not stored on the set.** It is a dated fact of
its own in `weightEntries`, and the load uses the most recent measurement on
or before the set's date. That is what makes replaying last March produce last
March's numbers however often the user has weighed themselves since — and it
is the same rule the whole app follows, not a special case for the gym.

Three states are kept apart, and none of them is a zero:

- a bodyweight set logged before the user ever weighed themselves has no
  measurable load and is **dropped**, exactly as a zero-rep set is;
- **assistance greater than or equal to the bodyweight is dropped too**, and
  is never re-read as ordinary positive resistance. 85 − 90 is not a 5 kg
  lift; flipping the sign would invent a workout, and clamping to a floor
  would invent a different one;
- everything else is a real load, in whole grams, so `reps × load` stays
  integer arithmetic and two identical sets can never compare unequal.

Load types are recorded on the set as well as on the exercise, for the reason
D87 gives about muscle groups: reclassifying an exercise applies forward and
cannot reach a workout already done.

## D92 — Primary muscles take 70 %, secondaries share 30 %

D86 gave an exercise's ratio to every group it mapped to at full strength.
That made a bench press speak as loudly for triceps as a triceps pushdown
does, and let a compound movement gain total influence simply by touching more
of the body. **An exercise is now worth one exercise, however many groups it
names.**

```
primaries   share 70 %, equally
secondaries share 30 %, equally
```

Chest 70 %, triceps 15 %, front delts 15 % — and the three sum to 1, which is
the invariant the tests assert rather than a property of those numbers. Two
degenerate shapes keep the invariant: an exercise with no secondaries gives
its primaries the whole 100 % (an isolation exercise is not worth less because
nothing else is listed), and an exercise with no primaries shares itself
equally.

What survives from D86 is everything above the group: a group's value is the
**weighted** mean of what it received, and the groups themselves are still
equal-weighted, so chest with five exercises still does not outweigh legs with
two.

**Roles are stated, never positional.** Phase 4's catalogue relied on "primary
first" as a display convention, which was fine while every group counted the
same and is not fine now. An ordering convention is exactly the kind of
implicit fact that becomes wrong the first time someone sorts a list.

## D93 — A user may remap their own exercise, never a built-in

A built-in's mapping ships with the app and is the same on every device.
Letting one user's edit of "Bench Press" diverge from the catalogue would make
a permanent id mean two different things, and `ex_bench_press` is what a
two-year-old set row points at. A user who wants their own mapping makes their
own exercise, which is one tap.

Either way the change is forward-only without any special handling: every set
already carries the mapping and roles it was logged under (D87), so a workout
already done cannot be reinterpreted at all.

## D94 — The Endurance Phase gates the first promotion, and nothing else

> **Status note (D125).** There is no domain promotion to gate any more.
> The phase itself stays exactly as written below — four net weeks, +1 and
> −0.5, real numbers throughout — and what it still governs is the
> abstinence decay, which begins only once the phase is complete (D96). The
> per-day `promotionUnlocked` answer keeps its name and is read by nothing.

A new Gym user starts in an Endurance Phase, and their **first** rank
promotion waits until they have shown four net weeks of training.

```
a completed week that met the target   +1.0
a completed week that missed it        −0.5
floor                                   0
unlock at                               4.0
```

Three things this deliberately is not:

- **It is not a streak.** A miss costs half a week, not the balance. Resetting
  to zero after one bad week would contradict the rule this app has held since
  RC2: a single bad day — or week — never costs a tier.
- **It is not a timer.** Four weeks elapsing is not the requirement; four net
  weeks of actually training is. The worked example ends at 2.5 after four
  calendar weeks, and the user needs more.
- **It is not a delay on the arithmetic.** Performance is computed, the rating
  moves, and every screen shows real numbers throughout. Only the promotion is
  held back. Gating the arithmetic would mean the first month did not exist.

Implemented as one optional argument to the existing `rankHistory`, so there
is no second ladder, no second badge family and no parallel rank state — the
rating rises normally and simply does not cross a threshold yet. Once reached,
the gate is permanently complete, and nothing is awarded at the unlock: the
rating the user has been building all along is allowed to show, and that is
all that happens.

The gate is on the **rank**. The rating still flows into the Boss through the
ordinary weighting, because there is no separate Gym-to-Boss formula and this
would have been one.

## D95 — Gym rank is development; Tombstones are absolute

Two motivational systems, and conflating them would ruin both.

| | Answers |
|---|---|
| **Gym rank** | how am I progressing, against my own history |
| **Tombstone** | have I hit this absolute benchmark |

So no absolute-strength scaling goes inside Gym rating, and no personal-
development percentage will go inside a Tombstone. The boundary is an API
boundary as much as a conceptual one: `core/gym/rating.ts` never reads a
benchmark table, and there is none to read.

Tombstones remain future work. The store exists, the boundary is documented,
and **no benchmark values are invented here** — picking what counts as a
"100 kg bench" milestone is a product decision, not a detail to settle while
building something else.

## D96 — Abstinence decay reduces rank progress, and only that

> **Status note (D124).** The interval this entry calls "the rank currently
> held" is, since Stage 2 of the Overall-rank update, an internal *decay
> tier* — the same interval of the same ladder, held with the same
> hysteresis, but no longer a rank: nothing is named, shown, promoted or
> demoted by it. Every number below is unchanged and the equivalence is
> pinned day by day (`decayEquivalence.test.ts`).

> **Status note (D113).** The cooling-off gate this entry describes as open
> has since been closed, on RC2's formula unchanged. Nothing about the rule
> below moved: the two models remain separate, and no day is charged by both.

Distinct from the cooling-off gate, which was still open when this was
written (D72, closed by D113). `core/decay` held RC2's provisional rating
decay behind `DECAY_MODEL_APPROVED`, and this does not close it. What is
approved here is a Gym-specific rule.

**Abstinence is seven consecutive days with no saved Gym session.** Missing
the weekly target is *not* abstinence: a user who trained twice against a
target of three has trained, Attendance already says so, and charging them
again here would punish partial effort harder than the rule already measuring
it. Decay begins only after the Endurance Phase is complete — before that
there is no promotion to lose.

It touches **only the progress inside the rank currently held**:

```
rankProgress = (rating − rankFloor) / (rankCeiling − rankFloor)
```

Sets, exercise performances, muscle-group figures, the performance
percentages, past snapshots and Tombstones are facts about what happened, and
not training this week does not change what happened last March. The user
cannot fall out of their rank through this either — losing a tier to a
fortnight's holiday would contradict the sustained-evidence rule demotion has
always needed.

Four schedules, keyed on Gym training age. All four are one rule with a
different number in it — a **full** seven-day block removes a fixed share of
the baseline, capped at everything — but the rule is written out day by day
here, because "20 % a block" is the kind of summary that gets reimplemented
slightly differently later:

```
  abstinent days      →   7     14     21     28     35     42  …  70

  after unlock,
  through month 2       50 %  100 %  100 %  100 %  100 %  100 %   100 %
  months 3–4            25 %   50 %   75 %  100 %  100 %  100 %   100 %
  months 5–12           20 %   40 %   60 %   80 %  100 %  100 %   100 %
  month 13 onward       10 %   20 %   30 %   40 %   50 %   60 %   100 %
```

Blocks are whole. Six days is not a block and removes nothing; thirteen days
is one block and not one and a bit. Partial credit would make the boundary
meaningless and the arithmetic unexplainable. The phase is chosen from the
training age **at the start of the episode**, so an episode that crosses a
month boundary does not change schedule underneath the user.

"Training age" is completed whole calendar months since the first day Gym
actually had a session of its own — not since the app was installed. A user
who enabled Gym in June is two months into Gym in August, however long they
have been logging their sleep.

**Cumulative against the baseline, never compounded against the remainder.**
In the 25 % phase, 80 % of a rank runs 80 → 60 → 40 → 20 → 0, not 80 → 60 →
45 → 33.75. Compounding never reaches zero and would make the fourth week of
absence cost a quarter of what the first did. The baseline is the rating held
when the episode began, read once; the decay is recomputed from it every time,
which is what makes the schedule cumulative and is why nothing is stored.

Any saved session ends the episode immediately. What was lost stays lost — the
user rebuilds through attendance and performance like anyone else — and a
later absence takes a fresh baseline at *its* start.

One implementation note that is really a product rule. **Decay is judged
before the day's own score status.** A week with nothing logged in it yet has
no score, because a week still running cannot have missed its target — that
rule is right and stays. But those are precisely the days an abstinence
episode is made of, so requiring a scored day would have meant the schedule
never ran during the only week it was written for.

## D97 — The one-year Maintenance rule

After twelve months of Gym training, holding steady is a legitimate outcome
rather than a failure. Without a rule saying so it reads as one: 0 % maps to
500, and a user who has honestly earned 780 would be dragged towards 500 for
ever by doing exactly what they set out to do. "Improve every month or lose
your rank" is not something this app should say to someone in their second
year.

So when **all** of these hold, the target may not pull the rating **down**:

- Gym **training age ≥ 12 completed months**, counted from the first day Gym
  had a session of its own.
- The week's **attendance target fully met** — `sessions / target ≥ 1`,
  uncapped, so "nearly" does not qualify.
- **Both performance windows carry a baseline.** This is what "enough
  performance history" means concretely: `components.length >= 2`, the trend
  *and* the year-to-date figure. One window alone is not enough evidence to
  call a year's work "unchanged", and no window at all is missing data rather
  than a flat result.
- The **aggregate change is within ±0.25 percentage points of zero** —
  genuinely about zero rather than missing.

The aggregate the tolerance is measured against is the mean of the two
windows' ratios, converted to a percentage. That is average-then-convert
rather than the map-then-average the *score* uses, and it is deliberate: this
number is only ever compared against zero, where the two orders agree exactly
because the curve is symmetric about it.

It is a floor under the target and nothing more, which is what keeps it
narrow:

- positive performance still raises the rating, because the blended target is
  already above it and the floor never applies;
- negative performance still lowers it, because the change is then outside the
  tolerance and the rule does not fire;
- missed attendance still lowers it, for the same reason;
- abstinence decay is untouched: it is not a target, and the month-13 schedule
  applies to a maintaining user exactly as it does to anyone else.

The tolerance is **±0.25 percentage points**. Aggregating ratios across groups
leaves floating-point dust in the last few bits, which without a tolerance
would flick Maintenance on and off between two replays of identical data; a
quarter of a point is far below one rep or one micro-plate on any real best
set, so it can only ever absorb noise and never a change.

## D98 — Two migrations rewriting one store must share a cursor

Found while adding schema 4, and worth recording because it was silent.

Migrations v3 and v4 both rewrite `exercises`. Each called `backfill`, and
each opened its own cursor. Requests inside one IndexedDB upgrade transaction
are served in the order they were made, so both cursors read the record as it
was before either of them wrote, and the later write won with a value that had
never seen the earlier one. **A device upgrading from version 2 straight to
version 4 lost version 3's reshape entirely** — silently, and only on the
devices that had skipped a release.

Migrations now *declare* their per-record rewrites (`transforms`) instead of
performing them. The runner composes every applicable transform for a store,
in version order, and applies the chain in a single pass, so each one sees
what the previous produced. That is what running the versions in sequence was
always supposed to mean, and it removes the hazard for every future migration
rather than for this pair.

## D99 — The performance curve is one parameter, and the anchor table cannot be met as written

```
                            1000
  score(x) =  ────────────────────────────
                1 + 4 ^ (−x / 10)
```

A logistic written in base 4 rather than base e, because in that form it says
something a reader can hold on to: **every ten points of improvement
multiplies the odds by four.** The score's odds are `score / (1000 − score)`;
at 0 % they are 1:1 and the score is 500, at +10 % they are 4:1 and it is 800,
at −10 % they are 1:4 and it is 200. One constant, retunable without any of
the required properties changing.

The approved anchor table asks for −20 % → 0 **and** +20 % → 950. Those cannot
both hold. Symmetry about 500 requires that if +20 scores 950 then −20 scores
50; and an asymptotically bounded curve cannot reach exactly 0 at a finite
input at all — a function that hits 0 at −20 % either stops being monotonic
below it or clips, and clipping would make every collapse worse than −20 %
indistinguishable. The approved priority order puts `score(0) = 500`,
monotonicity, symmetry and diminishing returns above closeness to the table,
so the two ±20 % anchors are the ones that give:

```
  change    approved    curve      
   −20 %          0      58.82     forced by symmetry and the asymptote
   −10 %        200     200.00     exact
    −5 %        330     333.33     +3.33
     0 %        500     500.00     exact
    +5 %        670     666.67     −3.33
   +10 %        800     800.00     exact
   +20 %        950     941.18     −8.82
```

There is no cap on the input: a beginner tripling their best set is +200 % and
scores 999.999. Large gains keep helping, and keep helping less.

**The two windows are mapped and then averaged, never averaged and then
mapped.** Running a non-linear curve over a blended rate would lose exactly
what the two windows exist to keep apart: a user who has improved 20 % over
the year and slipped 20 % in the last two months is not the same as one who
has done nothing. There is a test that proves the code takes the first road.

## D100 — Year-to-date means this year, not since you started

`gymPerformanceOverSpan` anchors each exercise to its first-ever recorded day,
which HANDOVER already listed as debt: a lifetime figure measured from where
the user began keeps reporting a beginner's first month for ever.

The two rating windows do not use it. Each takes the exercise's first and last
recorded day **inside the window** — 60 rolling days for the trend, January
the first for year-to-date — and requires two observations there before it
says anything. One comparison per exercise per window, so training something
often adds evidence and never weight.

The lifetime variant stays, because the Progress screen's "overall" figure is
a different question and answers it correctly.

## D101 — The performance curve is a shared contract, and its anchors are illustrative

*Confirmed at the Phase 5 review, before Running becomes its second caller.*

D99 chose the curve and recorded why the approved anchor table could not be
satisfied as written. This states the resulting rule as a **durable,
cross-domain contract**, because the curve is about to be reused and the
question "may I refit it to hit 950 at +20 %?" must have a permanent answer.

**Authoritative, in this order, and not negotiable per domain:**

1. `score(0 %) = 500` — exactly.
2. Monotonic and continuous over the whole real line, with no branch on sign
   that changes the value.
3. **Symmetric about 500**: `score(−x) = 1000 − score(x)`, exactly.
4. Diminishing marginal reward as `|x|` grows.
5. Bounded to 0–1000, asymptotically, with no cap on the input.

**Illustrative, and not to be fitted against:** the ±20 % anchors. The
approved table's −20 % → 0 and +20 % → 950 cannot coexist with rule 3 (which
demands 50/950) or with rule 5 (an asymptote reaches 0 at no finite input).
The reference values the curve actually produces are:

```
  −20 %   58.8      0 %   500.0     +20 %   941.2
  −10 %  200.0     +5 %   666.7
   −5 %  333.3    +10 %   800.0
```

`score(x) = 1000 / (1 + 4^(−x/10))` satisfies every authoritative rule and
meets 0 % and ±10 % exactly; ±5 % lands within 3.4 points of the illustration.

**Do not silently refit the curve** to close the ±20 % gap. Any function that
does so breaks symmetry, monotonicity or boundedness, and those are the
properties the score's meaning rests on. The one tunable is
`GYM_RATING.CURVE_ODDS_PER_DECADE`; changing it moves every anchor together
and preserves all five rules, which is the only kind of retuning that is safe.

The curve lives in `core/gym/score.ts` today. When Running becomes a real
second caller it should move to `core/scoring/` unchanged — a move, not a
reimplementation, and not two copies that can drift.

## D102 — Running performance is pace at a comparable measured distance

A runner is rewarded for **getting faster over runs that are genuinely
alike**. Not for running further, not for running longer, and never through a
composite that mixes the two.

An observation qualifies only with a **measured** distance of at least 3 km
and a positive duration. Distance is what the watch recorded, never a target
the user declared — a declared "5 k" that was actually 5.4 km would put two
different efforts under one label and quietly compare them.

```
  ratio = (distanceCurrent × durationBaseline)
        / (durationCurrent × distanceBaseline)
```

Above 1 is faster and therefore positive. Both products are integers, so two
identical runs give exactly 1, and a longer duration alone can never read as
improvement because distance sits in the numerator beside it.

Everything else about a run stays valid without qualifying. **A run saves with
no distance and no duration at all** and counts in full towards the weekly
target; logging has to stay one tap, and taxing it would cost more honest data
than the performance figure is worth. Missing fields are never fabricated to
make a run scorable, which is why every converted RC2 run is attendance-only
for ever: RC2 recorded no distance, and inventing one would be inventing a
performance.

Two consequences the product accepts deliberately:

- **Running further at the same pace is exactly neutral.** It is not an
  improvement under a metric that measures speed, and pretending otherwise
  would make the number mean two things.
- **A nearby-but-not-identical distance is not perfectly effort-equivalent.**
  Inside the allowed comparability range a small distance-related bias can
  remain. It is left uncorrected: every correction for it is a
  population-derived model, which this app does not use anywhere.

## D103 — A Running distance identity is a fixed multiplicative band

Two runs may be compared when `max/min ≤ 1.10`, symmetric and inclusive at the
boundary, evaluated in integer metres so the edge is exact rather than a
rounding artefact.

That relation is symmetric but **not transitive** — 5.0 and 5.4 km compare,
5.4 and 5.8 compare, 5.0 and 5.8 do not — so it cannot group anything by
itself. Grouping is a fixed, half-open multiplicative band:

```
  band(d) = floor( ln(d / ANCHOR) / ln(WIDTH) )
  ANCHOR = 972.42 m      WIDTH = 1.10
```

**A band depends on nothing but the run's own distance.** That is the whole
point, and it was arrived at by discarding three alternatives that each let an
unrelated run rewrite history:

- *Anchoring a group at its lowest member.* Adding a 4 900 m run to an
  existing 5 000/5 500 pair moved the anchor, evicted the 5 500 run and cost
  it its baseline. A run logged in January stopped counting because of one
  logged in March.
- *Connected components of the comparability relation.* Chains 5.0 km to
  6.2 km through the runs between them, then compares two runs 24 % apart —
  which the rule forbids outright.
- *A band wider than the comparability ratio, choosing the best pair inside.*
  A 5.4 km history and a 6.4 km history share such a band while being 18.5 %
  apart, so one of two legitimate histories is discarded — and which one
  survives flips with their calendar spans, so extending the losing history
  changes nothing.

Because a band spans `[a, 1.10a)`, **same band implies comparable** by
construction rather than by a check, and the baseline/current pair needs no
selection heuristic: earliest date against latest, exactly as Gym does. Needing
anything cleverer would have been evidence the identity was too wide.

`ANCHOR` is the minimax grid offset over 3 km, 5 km, 10 km, 15 km, the half
marathon and the marathon — every one sits at least 18 % of a band (±1.73 % of
distance) from a boundary. The obvious round anchors are far worse: 3 000
places 3 km *exactly* on a boundary, 1 000 does the same to the half marathon.

**Both constants are part of the scoring-model contract.** They define what a
stored run's identity *is*; changing either would silently repartition every
user's history, so a change is a new scoring era and must say so through the
snapshot marker. Do not re-tune them.

### The accepted split

A comparable pair can still straddle a boundary — 5 000 and 5 500 m are
exactly 10 % apart and land either side of one. A repeated route whose
measured distance wanders across a boundary becomes two identities, each
carrying equal weight, so that route is counted twice.

Both are accepted, and **no attempt is made to detect that two adjacent bands
probably mean the same route**. Doing so would make identity depend on the
surrounding observations, which is exactly the reinterpretation the fixed grid
exists to prevent. The product preference is explicit: a deterministic,
historically stable identity with a small weighting artefact beats a history
that rewrites itself.

## D104 — Running window evidence, and the aggregation Gym already uses

Inside each window independently:

1. keep the qualifying runs of that band;
2. collapse a date to its **fastest** run, the way an exercise-day collapses
   to its best set;
3. require **two distinct dates**, else the identity has no baseline and
   leaves the denominator — it is not a zero;
4. baseline is the earliest date, current the latest;
5. **one ratio per identity**, however many runs built it.

Then, and this is the part that had to match Gym exactly:

```
  identity ratios
    → equal-weighted mean                    ← ONE ratio for the window
      → percentage change → shared curve     ← mapped ONCE per window
        → Trend score, YTD score → 50/50
```

Frequency is evidence, never weight: twenty 5 km runs and two 10 km runs each
contribute exactly one ratio to the mean.

**Ratios are averaged before the curve, not after.** An earlier proposal had
Running map each identity and average the scores; it was withdrawn. Gym
averages ratios within a window and maps once, the two orders differ
materially at wide spreads, and two training domains disagreeing about the
shape of their own pipeline would be a defect waiting to be found by a user.
Gym was not changed.

Trend is a rolling 60 days and year-to-date starts on January the first, each
computed over its own range so neither can borrow the other's baseline. Both
available blends 50/50; one available is used alone; neither available means
performance is unavailable and the target is attendance by itself.

## D105 — Shared scoring is a move, not a second copy

Running became the second real caller of the model Gym established, so the
parts both use moved out of `core/gym/` into `core/scoring/`: the performance
curve, attendance, the two-window blend, the 40/60 target, the movement
factor, Maintenance, the rating fold, the Endurance Phase and abstinence
decay. `GYM_RATING` became `TRAINING_RATING` for the same reason.

It is a move rather than an extraction of something new — the test suite that
pinned Gym's behaviour ran unchanged across it — and it stops at what two
callers actually share. What stays domain-specific is the *evidence*: Gym's
best set per exercise, Running's pace per distance identity. Each reduces to a
percentage change per window, and from that point the two domains are scored
by identical code.

No generic framework was built for domains that do not exist yet. Food has no
scoring engine and gains nothing here.

## D106 — Food is ranked on the adherence the user entered, not on what they ate

Phase 6 had to give Food a rank while the nutrition-target decision (Gate 2)
stayed open. Those two facts are usually taken to be in tension, and they are
not: what a person's calorie and macro targets ought to be is undecided, but
whether their day went the way they intended is something only they can say
and something they can say without any model at all.

So Food's evidence is **one number per day, chosen by the user, on the 1–10
scale the rest of the app already uses**. That number is stored verbatim
(`FoodDayRecord.adherence`); the percentage, the day score, the rating and the
rank are derived from it on every replay, like everything else.

Two consequences worth stating.

**No target was invented.** There is no calorie figure, no macro split, no
basal-rate estimate and no weight-goal model anywhere in the scoring path — a
number chosen here to make the arithmetic work would be indistinguishable
afterwards from one that had actually been decided, and Gate 2 would be closed
by accident. `core/food/adherence.ts` says so where the code is.

**Entries are shown and never scored.** The app records what was eaten and
totals it, because a log is useful in itself, but nothing about kcal or macros
reaches the score. The Food card says this in words rather than leaving the
juxtaposition to imply the opposite.

Reusing the 1–10 scale is not a shortcut. A user who has learned what "7"
means from a Wellbeing question has learned what it means here; the bands, the
colours and the words are the same, and a second scale with its own arithmetic
would be a second thing to learn and a second thing to get wrong.

## D107 — Food is scored by the rules that already existed, and gets no rules of its own

Food is a daily domain with one due item, so it is scored by the day-score
rules unchanged:

- A rated day scores `adherence × 10`, the same mapping a scale answer uses.
- An unrated day inside the edit window leaves the day **open** — it costs
  nothing and can still be answered, exactly as an unanswered Wellbeing
  question does.
- An unrated day that has closed is a **miss for history** (score 0) and
  **no data for the rating** (`recorded` is null). That is the existing
  two-numbers rule (D35), not a Food variant of it.
- A day before Food was switched on has no food entry at all. Absence is not
  failure, and enabling Food in June cannot fill the spring with misses.

Its rating is then the shared fold over day states — the same one Wellbeing
has had since RC2 — and its ledger, ladder position, rank and Boss
contribution are the ordinary ones. **Food is not a training domain**: it has
no attendance, no 40/60 target, no performance curve, no Endurance Phase and
no abstinence decay. Those belong to Gym and Running because those domains
have sessions and comparable observations; Food has neither.

This is deliberately not a decision *about* Food decay. **D72 remains open**
and `DECAY_MODEL_APPROVED` is still `false`. Giving Food a decay rule
inferred from Gym or Running would close a gate nobody opened, and the shape
of the two mechanisms is not even the same — a training domain decays after
seven days with no session, and Food has no sessions to be without.

> **Status note (D113).** The gate has since been closed, and Food does
> participate in the **general** cooling-off model — which is what the
> paragraph above says it is not being given: the *training* model. The
> sentence still stands as written. What changed is D72's status, not Food's
> exemption from Gym's and Running's rule.

**Food does not add to the day-level `dueItems`/`answeredItems`.** Those
weight the legacy fold by how much of the *check-in* was reported and drive
the Wellbeing check-in streak; Gym and Running do not contribute to them
either. The consequence, stated plainly rather than papered over: a rated
Food day earns XP in Food's own ledger but does not move the single lifetime
XP figure the Boss shows. What a rated day should be worth against a gym
session is a product decision, and Phase 6 did not make it.

## D108 — Food's setup is a sentence, because that is all adherence needs

"How closely did today match what you set out to do?" needs the user to have
set out to do something. It does not need a computed target.

So Food's whole setup is one optional free-text line — `focus` in
`FoodDomainSettings`, carried in the config snapshot like every other domain
setting, so the intention a past day was rated against stays readable as what
it was on that day. Food scores identically with it empty.

This is the smallest thing that makes the daily question answerable, and it is
the only thing that could be built without pre-empting Gate 2. A profile form
(age, sex, height, activity, goal weight) would have been building the *input*
to the undecided model, which is the same commitment in a different order.

## D109 — Version 5 adds a store and invents nothing

The `foodDays` store is created empty and declares no per-record transform.
A device that had Food switched on before there was anything to rate with
comes out with no ratings for those days — which is what actually happened.
Food contributed nothing to the Boss then, and that absence is the record of
it.

The tempting alternative was to derive a rating for those days from the food
entries already stored. That would put a number in someone's history that they
never entered, which is the exact failure "store what happened" exists to
prevent, and it would be indistinguishable afterwards from a rating they had
given.

`BACKUP_FORMAT_VERSION` moves 2 → 3 for the same reason it moved 1 → 2: a new
collection in the envelope. The ratings are the one piece of Food data that
cannot be recomputed from anything else, so a backup without them would lose
history outright. Older files still import — every collection a later version
introduced reads as empty when absent.

## D110 — Boss contribution is normalized domain performance, never event count

*Product-owner decision, closing the Food/Boss question Phase 6 left open.*

Every active scored domain may contribute to the Boss. Food must not become a
permanent exception with a rank of its own but no route into global progress.
It must also not contribute through fixed per-event XP: Food is a
high-frequency daily domain and Gym and Running are lower-frequency activity
domains, so "1 rating = X, 1 session = Y" would make the Boss depend on how
often a domain is logged and would need an arbitrary cross-domain exchange
rate nobody can justify.

**The rule: Boss contribution is based on normalized domain performance, not
raw event count.**

### The architecture already expresses this, and that is the finding

Nothing had to be built. The three properties D110 requires are already how
the Boss works, and they are now pinned by tests rather than left as
incidental:

1. **The Boss averages ladder positions, not events.** `bossSeries` moves the
   Boss by the weighted *movement* of each domain's position on the shared
   0–8 ladder (`ratingToProgress`). A domain's position is its 0–1000 rating
   mapped onto the ladder — a normalized figure — and the Boss never sees a
   session, a run, a rating entry or a food row.

2. **Event count is normalized away before it gets there.** A weekly quota
   scores `min(100, sessions / target × 100)` and attendance scores
   `min(1, sessions / quota) × RATING.MAX`, so training beyond the target buys
   nothing. Food has exactly one due item per day, so logging fifteen meals
   and logging one produce the same day score. Two domains performing equally
   well against their own expectations contribute equally, whatever it took.

3. **XP is not the Boss path and never was.** Lifetime XP answers "how much
   have I done"; it is computed in `core/scoring/xp.ts`, and neither
   `core/rating` nor `core/ranks` nor `core/boss` reads it. The Boss's rank
   comes from `bossSeries` alone. So the Phase 6 question — what a rated Food
   day is worth in XP — was never a question about Boss contribution, and the
   answer is that no such constant is needed.

**No Food-specific XP constant, calorie multiplier, macro multiplier, streak
bonus or attendance-style rule was introduced.** Food reaches the Boss through
the same normalized path as every other domain.

### What is preserved for later

The long-term intent — a prominent global Boss, contributions from active
domains and subdomains, user-configurable relative weights, and no domain
dominating through logging frequency — is compatible with what exists.
Per-domain weights are already user-configurable (`BossWeights`,
`setBossWeights`), already normalized over the enabled domains, already
floored so nothing is weighted out of existence, and already forward-only via
the config snapshot.

**Subdomains do not exist yet and were not speculatively built.** The
requirement they impose on this code is recorded here instead: whatever
aggregates a subdomain must produce a ladder position, so that the Boss keeps
averaging normalized performance and a subdomain cannot smuggle event
frequency in through a side door.

## D111 — One unanswered daily domain currently holds the whole day open

*Recorded as a known property with a future direction, not as a defect and not
as a change.*

A day is `open` while anything due on it can still be answered, and `open`
means open for every domain — so an unrated Food day inside the edit window
postpones Gym's and Running's day too. Phase 6 found this and it is the
existing mechanism working: it is what an unanswered Wellbeing question has
always done.

What was verified, and what keeps it safe:

- closed historical days are unaffected — every day outside the edit window is
  bit-identical with and without the extra domain;
- an unanswered domain never creates a negative score;
- it only postpones closure while the day is still editable;
- once the day is rated, or once it closes, the difference resolves.

**The behaviour is deliberately unchanged.** It is nonetheless worth
reconsidering as the number of daily domains grows: with one daily domain the
postponement is invisible, and with several the odds that *something* is
unanswered rise until the day is routinely held open for domains that have
nothing outstanding. A later design may want domain-independent closure —
each domain's day closing on its own obligations — which would be a change to
`DayStatus` and to `domainDayStates`, not a patch.

This is a future architecture and UX consideration. It is not permission to
change the mechanism now, and it must not be redesigned as cleanup.

## D112 — The legacy-Sport question is offered in Areas, never imposed

*Phase 7. The conversion itself was decided in D71 and built in phase 2; this
records only where and how it is asked, which was the missing half.*

`core/migration/legacySport.ts` and `legacySportService.ts` were complete,
documented and covered by 18 tests since phase 2 — and **nothing called
them**. Every migrated RC2 user's `legacySportMigration` stayed `pending` for
ever, so the three branches were unreachable and the sessions stayed in a
domain the product no longer offers. The engine was right; it had no door.

### Where the question lives

**In Areas, inside the card that already explains the retired domain.** That
card is where somebody goes to ask "where did my old training go?", so the
question and its answer belong in the same place. The choice is a radio group
of three, each option stating what it *does* rather than only what it is
called, with a confirm underneath.

**On Today, a pointer and nothing more.** The retired log already appears
there showing a week with no way to log into it, which is exactly where the
question occurs to someone — so the card carries one line that navigates to
Areas. It cannot apply anything.

### Why it is not a blocking step

The engine's own rule is that no branch runs by itself: no default, no
timeout, no "most likely" guess. A gate on startup would contradict that in
spirit even while obeying it in code — it would coerce an answer from a user
who has not decided, to a question that cannot be un-answered. So the
question is *offered*: scrolling past it costs nothing, the app stays fully
usable, and it is asked again next time. That property is now verified rather
than asserted — reloading, revisiting and wandering the app leave
`legacySportMigration` at `pending` and both training logs empty.

### Why this one is confirmed rather than saved on tap

Every other selection in this app is one calendar day and reversible inside
the edit window. This one writes a year of sessions into a different log,
retires a domain from today, and is asked once. A second, deliberate action is
proportionate to that, and the confirm stays unavailable until a branch is
chosen so there is nothing to confirm by accident.

### What the copy promises, and why it is safe to promise

That the rank, the history and every week already lived stay exactly as they
are, and that nothing is deleted. Both are true in all three branches for
reasons that predate this phase — the replay reads each day against the
snapshot in force on it, and the conversion copies rather than moves — and
both were already pinned by `legacySport.test.ts`. The interface says out loud
what the tests already guaranteed.

**No product decision was made here.** The three branches, what each carries,
the inherited weekly target, the `legacyCarryOver` marker and the refusal to
invent distance or pace are all D71, unchanged.

## D113 — The general cooling-off formula is RC2's, ratified unchanged (closes D72)

*Product-owner decision. `DECAY_MODEL_APPROVED` is now `true`.*

The general inactivity formula is RC2's, approved exactly as it stands:

| Consecutive inactive days | Cost |
|---|---|
| 1–2 | nothing (`GRACE_DAYS = 2`) |
| 3–7 | 1.5 rating points each |
| 8 onwards | 3 rating points each |

and **one episode can never cost more than 60 points in total**. No constant
changed. No proportional or half-life model. Approving D72 was a decision, not
a change: not one rating that was correct at the accepted baseline moved, and
that is asserted rather than hoped — see "the numbers" below.

### Scope: one model per domain-and-era segment

The general formula governs any segment that has **no approved
domain-specific decay model of its own**:

| Segment | Model |
|---|---|
| Wellbeing | general cooling-off |
| Food | general cooling-off |
| Gym, `attendancePerformance` era | Gym abstinence only (D96) |
| Running, `attendancePerformance` era | Running abstinence only (D96) |
| Gym / Running, pre-model eras | whatever was in force on those days — the general formula |
| the legacy undivided fold | its own historical semantics, unchanged |

**No day may ever be charged by both.** That is D96 and it stays
authoritative. It holds by construction rather than by a guard: a day scored
under the performance model is folded by `computeTrainingRating`, which never
reaches the general model at all.

Food therefore *does* participate in general cooling-off. This is not the
Gym/Running training-decay model that D107 forbids it — that rule decays a
fraction of rank progress in weekly blocks after seven days with no saved
*session*, and Food has no sessions. The general model removes fixed points a
day from any daily domain that goes quiet, which is what Wellbeing has always
done and what "absence is not failure" has always meant: silence is decayed
gently, never scored as a zero.

### The architectural half: the contract is now the implementation

D72 could not honestly be closed by flipping a flag, because **the flag
governed dead code**. From phase 1 to phase 7 `core/decay` was a contract
nobody called, and the decay that actually ran was a second, inline copy of
the same schedule inside `computeRating`. Two implementations of one rule is
the same defect as a cached score: they can disagree, and then neither can be
trusted.

So the schedule moved into `core/decay`, which now owns the grace period, both
rates, the episode cap and the model selection; `core/rating` re-exports
`decayForDay` from there rather than holding a copy, and `computeRating`
reaches its decay figure only through `activeDecayModel()`. There is one
function object, and a test asserts identity rather than agreement — equal
outputs would not catch a re-introduced duplicate.

`computeRating` gained an optional `domain`, passed by the callers that know
one. The approved formula does not read it; it exists so that a per-domain
formula would be a change to `perDay` rather than to every caller.

### The numbers

Before and after the refactor, a 64 KB fingerprint of 2691 values — five pure
folds covering grace, cap, broken episodes, mixed statuses and partial days;
both RC2 fixtures replayed to their full Boss, legacy and per-domain ledgers;
and a live four-domain profile taken through five weeks of silence — is
**byte-identical**, same MD5, zero mismatches.

### What this decision does **not** touch

- **Rest-day suspension semantics remain unresolved**, separately. Nothing
  writes a `RestDayRecord`, `DayState` does not carry one, and
  `RestDayRecord.domainType` being `gym | running` does **not** authorise
  changing the approved abstinence definition. Abstinence remains consecutive
  calendar days with zero saved sessions; a declared rest day must not start
  interrupting that sequence until a decision says so.
- **Pause-period suspension and its XP claim remain unresolved**, separately.
  The comment on `PausePeriodRecord` saying "XP does not accrue" is an
  unimplemented note, not a rule.

Both flags stay in `DecayDay` and are honoured there, and `computeRating`
passes `false` for both — which reproduces today's behaviour exactly. They are
kept rather than removed so that resolving those questions is wiring an input,
not reopening this contract, and so that neither is answered by a type
refactor.

## D114 — The D42/D43 citations in the decay code are iteration-plan numbers *(refined by D117)*

Verified during the D72 inspection and recorded so the next reader does not
follow them.

`core/decay/index.ts` and D72 cited "rest days (D42)" and "pause periods
(D43)"; `RestDayRecord` and `PausePeriodRecord` in `core/model/index.ts` carry
the same citations. Those are **`docs/iteration-2-plan.md` numbers**. In this
log, D42 is "The service worker never applies an update on its own" and D43 is
"Storage failures say which failure they are".

The two numbering schemes were never reconciled, and the collision is silent:
following the citation lands on a real decision about something else. No
replacement semantics are invented here — what rest days and pauses should do
is still undecided (D113). This entry records only that the references are
stale, so that a future decision names them properly instead of inheriting a
wrong pointer.

## D115 — Rest Days are deprecated as a product concept

`RestDayRecord` was never shipped, never reachable and never approved. The
store arrived with schema v2 in iteration-2 phase 1; RC2 — the only build ever
deployed — is schema v1 and both fixtures confirm it. No writer, no reader, no
screen and no string has ever existed for it, and no decision in this log
defines one.

**The later architecture removed its job.** Rest days were designed when the
only decay was the general per-day one, which charges from day 3, so a
declared recovery day had an obvious purpose. Since phase 4.1, Gym and Running
decay only after **seven consecutive days with no saved session**, and D37
already treats a rest day inside a trained week as attendance rather than
absence. Ordinary recovery is therefore free without declaring anything, and
the only remaining effect a rest day could have is on absence the model has
already judged real — a self-declared, unfalsifiable exemption. Seven days
each marked as rest would make training decay unreachable for ever.

`RestDayRecord.domainType` is `'gym' | 'running'`, so it could never have
covered Wellbeing or Food either. Whatever a rest day was for, a pause covers
it better and generically.

**Deprecation, not deletion.** The store, the repository, the type and the
backup collection stay exactly as they are: removing them is provably safe —
no writer has ever existed — but it is a `BACKUP_FORMAT_VERSION` change for no
gain, and a later schema cleanup can do it deliberately. What ends is the
product concept: no UI, no writer, no place in the roadmap, and nothing in any
flow creates one. A test asserts that no new flow does.

The dormant `restDay` flag stays in `DecayDay` and is still honoured there.
Nothing populates it, and this decision is why nothing will.

## D116 — A Pause Period suspends inactivity penalties, and only those

*Product-owner decision. Pause periods are now an active feature.*

A pause is a temporary, user-declared suspension of **inactivity penalties**
for a holiday, an illness, an injury, or any stretch where keeping the app's
ordinary rhythm is unreasonable. It is not a scoring freeze and not a way of
deleting history.

### What it suspends

Every inactivity mechanism, across every active domain:

| Segment | What stops |
|---|---|
| Wellbeing, Food, legacy and pre-model eras | the D113 general cooling-off charge |
| Gym, Running (performance era) | the abstinence inactivity progression |

This is an **exception layer around** inactivity progression. It does not
change the approved decay formulas: D113's schedule and the Gym/Running
abstinence arithmetic in `abstinence.ts` are untouched, and outside a pause
the training definition — consecutive calendar days with zero saved sessions —
is exactly what it was.

### It freezes the clock; it does not reset it

A paused day adds no day to the inactivity count, adds no decay, and **does
not clear the episode**. Five silent days, a fortnight paused, one more silent
day: that day is the sixth of the episode. `consecutiveInactiveDays` and
`episodeSoFar` both survive the pause untouched. Otherwise a single paused day
would be a reset button held just short of every threshold.

### What still works

Everything. Logging is never blocked, and a day logged inside a pause is
stored, scored, rated, and earns XP exactly as it would outside one. A pause
protects against what the user *did not* do — never against what they did.

### Streaks, XP and the Boss

- **Streaks break.** A pause invents no activity, so it bridges no streak: a
  thirty-day run, a fortnight paused with nothing done, and the first
  qualifying day afterwards is day one.
- **XP is untouched.** There is no withholding mechanism and none was built.
  The `PausePeriodRecord` comment saying "XP does not accrue" was unsupported
  and is superseded by this decision. XP stays monotone.
- **The Boss has no pause rule.** It inherits, as D110 requires: if a domain
  loses nothing, the Boss inherits no loss.

### Bounded, and prospective only

Start and end are both required, `end >= start`, at most **28 days**, and no
two pauses may overlap. There is deliberately no quota, no annual allowance
and no cooldown — one limit, stated plainly. The schema still permits
`to: null` so an older file reads back, but **no product flow creates an
open-ended pause**: that would be an indefinite rating freeze, and a pause is
for a holiday.

A pause may never rewrite a lived day. The earliest permitted start is today;
a pause that has not begun may be edited or deleted; one that has begun is
immutable except that it may be **ended early, from today or later**. It can
never be moved backwards, created retroactively, or shortened in a way that
reclassifies a day already lived. A user cannot watch decay happen and then
backdate a pause to undo it.

### The defect this decision had to survive

Suppressing only the decay made a pause **strictly worse than no pause**. The
abstinence branch is rank-floored; the ordinary attendance target is not. So a
paused training week of zero attendance dragged the rating towards the bottom
while an unpaused one stopped at the rank floor — measured at 899 → 98 paused
against 899 → 560 unpaused.

The fix is not to credit attendance, which would fabricate activity. It is to
**decline to score a paused week nobody trained in at all** — the same "no
data" the app already gives a day before a domain was enabled, and the same
treatment Wellbeing and Food get for a paused silent day. Session counts, the
met flag and every screen reading them are untouched: nothing is fabricated,
the day is simply not charged. A week the user did train in scores normally.

## D117 — The D42/D43 references are dangling, not iteration-plan numbers

*Refines D114, which was close but not precise.*

D114 recorded that the "rest days (D42)" and "pause periods (D43)" citations
in the decay code and the model were `iteration-2-plan.md` numbers. Checked
again during the rest-day inspection: **the plan cites them too and defines
neither.** No file in this repository, and no file in its entire git history,
defines a D42 or D43 meaning rest days or pause periods. The original brief
(`.github/Claude I6 backup request`, 357 lines) does not mention either
concept at all.

They are **dangling references to a document that has never been here**. In
this log D42 is the service-worker rule and D43 is storage-failure reasons, so
following the citation lands on a real decision about something else — which
is worse than a broken link.

The citations on `RestDayRecord` and `PausePeriodRecord` are corrected in
place to name the decisions that actually govern them (D115, D116). No
replacement semantics were invented from them: what rest days and pauses do is
decided in D115 and D116 on their own merits, not reconstructed from a
reference nobody can read.

## D118 — A pause may raise the training rating, never lower it (closes the pause/activity case)

Phase 8 stopped a pause from *charging* for absence. The release pass found
the other half, by measurement: it was still punishing people for turning up.

Over a 28-day pause from a settled 899.58 Gym rating:

| During the pause | Rating after |
|---|---|
| logged nothing | 899.58 |
| logged **one** session a week | **520.91** |
| logged the full target | 936.10 |

Honest partial effort cost 378 points and a rank, while doing nothing cost
zero. That is D35's rule — *reporting must never cost more than silence* —
failing inside the pause feature, and it is exactly the incentive this app
exists to avoid.

The cause is not a bug in the attendance model. A week with one session of
two genuinely *is* 50 % attendance. But attendance is a **measure of the
absence a pause exists to excuse**, so charging it during a declared pause is
the very penalty being suspended.

**The rule: on a paused day the training target may raise the rating and may
not lower it.** One line, the same shape the Maintenance rule already uses, so
no new mechanism. It is deliberately one-sided — train well through a pause
and the rating still climbs, because a pause protects against what was not
done and never against what was.

Wellbeing and Food get no such floor, and must not: there a low day is a
**reported result**, not a measure of absence, and forgiving it would be
forgiving something the user actually told us.

Nothing else moves. No attendance is credited, no session invented, the week's
counts and `met` flag are untouched, streaks break as normal, XP stays
monotone, replay stays deterministic, and every history with no pause in it is
byte-identical.

## D119 — The Today status counts every daily obligation (closes D111)

D111 recorded that one unanswered daily domain holds the whole day open, and
left it deliberately unchanged. The release pass looked at what a user
actually sees, and found the harm was not the postponement — it was the app
contradicting itself.

With Wellbeing and Food both on, answering every question while leaving Food
unrated showed **"Für heute erledigt"** — *done for today* — while Food sat
unrated below it and the day was being held open precisely because of it. The
app said finished, then quietly postponed.

The header now counts every **daily** obligation: Wellbeing's questions plus
Food's one rating. The same case now reads "2 von 3 beantwortet", which is
true, and names what is left.

A weekly quota is deliberately not counted. It is not due today; it is due
this week, and the training cards say so themselves.

**The open-day mechanism itself is unchanged.** No day closes earlier, nothing
is fabricated, no score moves, and the replay is untouched — this is a
statement about what the interface says, not about what the app counts. The
underlying property D111 describes stands, and so does its note that
domain-independent closure deserves revisiting as daily domains multiply.

## D120 — Nutrition targets stay out of V1, deliberately

Gate 2 is closed for V1 by deciding **not** to build it.

Food is already a coherent, finished feature: the user writes what they are
aiming at in their own words, rates each day 1–10 against it, and logs what
they ate for their own reference. That loop is complete, understandable,
editable, replay-safe and consistent with the rest of Momentum. Nothing in it
is waiting on a target.

Adding a calorie or macro target now would mean inventing the exact model D106
reserved, to close a gap the feature does not have. The reserved decision
stays reserved, and if targets ever arrive they arrive as something new the
user can be measured against — the entered 1–10 stays what it always was, and
no stored value needs rewriting.

## D121 — Tombstones are post-V1, not a release blocker

Checked during the release pass: `tombstonesRepository` is dead code, nothing
writes an unlock, no screen renders one, and no rating or rank reads one. The
"earned / locked" wording on the Rank screen is the **rank ladder**, a
different thing.

Tombstones are therefore invisible to a V1 user and cannot block the release.
The benchmark values remain an open product decision, and the boundary D95
draws — domain ranks measure you against your own history, Tombstones against
an absolute benchmark — still holds for whenever they are built.

## D122 — The dormant restDays collection stays, and the deploy branch was the real release blocker

Two release-hygiene findings, recorded so neither is rediscovered.

**`restDays` stays.** Removing the collection is provably safe — no writer has
ever existed — but it is a `BACKUP_FORMAT_VERSION` change and a migration for
tidiness alone. Cleanup is subordinate to release safety (D115 already
deprecates the concept), so it stays dormant and documented.

**The deploy workflow pointed at a dead branch.** `.github/workflows/deploy.yml`
triggered on `claude/momentum-pwa-spec-j82dhm`, which stopped receiving work
after RC2. Every phase from 1 to 8 built green, tested green and **deployed
nothing**: the published site was still the RC2 bundle from `452c835`, months
of work behind the repository.

This is worse than having no deploy at all, because the pipeline reported
success the whole time — the same failure shape as `core/decay` being a
contract nobody called, and as `legacySportService` being an engine with no
door. A pipeline is only a pipeline if something is actually at the other end
of it.

## D123 — One status palette, four bands on every scale

**Decision.** The colours that answer "how is it going" are one palette,
defined once: `weak` #ff3b5c, `mixed` #ffd600, `good` #4cde24, `strong`
#00b85b, and `empty` for no data — the neutral grey the history grid already
used, not a fifth status. They are written in exactly one place,
`src/styles/tokens.css` (`--status-*`). CSS consumes them as `var()`;
TypeScript and WebGL read them out of the same file through
`src/styles/statusPalette.ts`, which parses the token file at module load.
`statusPalette.test.ts` walks `src/` and fails on a second literal.

**The 1–10 answer is re-banded** from five presentation bands (Schlecht,
Mässig, Okay, Gut, Sehr gut) to the same four: 1–4 weak, 5–6 mixed, 7–8
good, 9–10 strong. The 0–100 score bands keep RC2's thresholds exactly (0–40,
40–65, 65–85, 85–100) and are only named and recoloured. Both scales now
resolve to one `StatusId` and one set of labels (`status.*`: Schwach,
Wechselhaft, Gut, Stark). This is presentation only: the stored answer, its
percentage, the day scores, the ratings and every threshold in the scoring
path are untouched.

**The muscle map maps its states onto the same palette**: improved is
strong, declined is weak, unchanged is mixed, no data is empty, and
awaiting-baseline keeps the informational blue (`--sky-*`). The 3D region is
tinted with the status colour itself, so the body and the legend swatch beside
it agree; the row figure uses the status ink. Muscle identity colours are a
different system and are unchanged.

**Why the inks exist.** The four fills are signal colours and bright by
design, and bright colours do not carry text: white fails 4.5:1 on all four,
and yellow or green fail 3:1 as a graphical object on a white card or the
history track. So every status has a darker `-ink` of its own hue for text and
outlines, an `-on` colour (the primary text colour, dark on all four) for the
label inside a filled control, and a pale `-tint`. Text is darkened; the bar
never is. Legend swatches, the SVG body regions and the selected 1–10 control
are outlined in their ink. The thirty-day strips are not: there the value is
carried by height, as the heatmap has always documented, and colour only
reinforces it. contrast.test.ts checks every one of these promises.

**Superseded.** D13's five-band presentation and the `--band-*` / `--scale-*`
token families. The `bandOf()` thresholds and the scoring model they sit on
are not superseded.

## D124 — Abstinence decay is measured in a held tier, not in a domain rank

**Decision.** `computeTrainingRating` no longer holds a `Rank`. The interval
the abstinence schedule (D96) measures progress in is a **decay tier**
(`src/core/scoring/decayTier.ts`): an interval of the shared ladder,
identified by its position and its two bounds, held with the ladder's
demotion hysteresis. It is not user-facing, it produces no promotion or
demotion, it is never persisted, and it exists only because the decay
formula needs a stable pair of numbers.

**What the held rank was doing, characterised before it was replaced.**

- The fold tracked `heldRank` with `rankWithHysteresis()`: up the moment a
  threshold was reached, down only once the rating had fallen more than 15
  points below the held floor, and then to wherever the rating actually was.
  No sustained-days rule and no Endurance gate — so it was **already not the
  rank the user saw**, which `rankHistory()` computed separately with both.
- An episode read it exactly once, on its seventh abstinent day, and kept it
  until a session ended the episode. The decay's floor and ceiling were that
  held rank's threshold and the next one's (or the top of the scale).
- Because the held interval is sticky, an episode can begin with the rating a
  few points *below* the floor it is measured against. The progress is then
  clamped to zero and the seventh day sets the rating **to the floor** —
  695 becomes 700. A lookup on the current rating would have measured the
  same episode in the interval below and decayed it downwards instead. That
  case is in the differential fixture on purpose; it must keep behaving as
  it did.
- Replay-sensitive state: the held tier and the episode baseline, both pure
  functions of the day sequence and both recomputed on every replay.
- Endurance: decay runs only while the gate is open, but the held interval
  tracks throughout, so an episode beginning just after the gate opens is
  measured in an interval the rating cleared while it was shut. Preserved.

**Equivalence.** The tier's bounds are the ladder thresholds `RANKS` — the
same ones the Boss normalises against in `ratingToProgress()` — and the
arithmetic in `abstinence.ts` reads two numbers from it and nothing else.
One hundred and four hand-built sequences and four replayed profiles,
frozen from the previous implementation before this change, produce
identical output on every day with no rounding and no tolerance.

**What this is not.** Not a second ladder, not a domain rank under another
name, and not a change to what an absence costs. Where a tier boundary
sits, and what a block removes, are D96's numbers unchanged.

## D125 — The Boss is the only rank

**Decision.** Domain ranks are gone: no rank name, badge, progress bar,
promotion or demotion message, peak rank or lifetime XP is computed or shown
for Wellbeing, Gym, Running or Food. A domain has a **rating** on the shared
0–1000 scale, its performance figures, its history, streaks, attendance and
Endurance, and a **share** of the Boss. The Boss Rank — current, peak,
lifetime XP, progress to the next rank, rank history, hysteresis, sustained
demotion and the acknowledgement in `settings.acknowledgedRankId` — is
unchanged and is the one rank system the user sees.

**What was checked before removing.**

- Boss lifetime XP is `legacy.lifetimeXp` from `ratingService`, computed
  over every history day and every domain-week; it never read the per-domain
  totals, so those went with their (never-built) presentation.
- Boss peak rank is derived from the Boss's own series; the domain peak
  ranks fed nothing.
- `acknowledgedRankId` was introduced with RC2's single progression — which
  is the Boss's legacy era — and re-pointed to `boss.rank` in phase 1. It
  has only ever held the overall rank.
- The abstinence decay's dependency on a held rank was characterised and
  replaced first (D124), with exact equivalence, so the rating engine's
  outputs did not move: the Stage 2 baseline replays byte-identical.

**What replaced the visible surfaces.** The Rank screen's area section lists
each enabled area's rating out of 1000, its weighting share and a short bar
on the 0–1000 scale. The Gym and Running rating tiles show the rating and a
bar on that same scale, without a badge or a rank name. The Wellbeing and
Food standing tiles do the same. The Endurance and training-break copy no
longer speaks of a first rank, a promotion or rank progress: the phase is
"in progress", a break reduces "part of the progress your rating had
reached", and the floor is "a break alone never resets it entirely".

**What stays, and why.** `core/ranks` (the ladder, `rankHistory`, hysteresis)
for the Boss. `RANKS` thresholds, because `ratingToProgress()` and the decay
tier (D124) are measured against them. `promotionUnlocked` in the two
training states, as the Endurance gate's per-day answer (D94 note). The
`rankEvents` store and backup collection, untouched. The `Progression`
type's rank fields, which are RC2's undivided rank — the Boss's legacy era,
pinned by the migration tests — not a domain's. No schema version, no
migration, no destructive change: a domain rank was never stored.

## D126 — A Boss promotion is confirmed over seven eligible days

**Decision.** From the confirmation era on, the Boss reaches the next rank
only once its rating has been at or above that rank's threshold on
`RANK_PROMOTION_CONFIRMATION_DAYS` (seven) eligible evaluations in a row. A
day is eligible when its local calendar date is strictly before `today()`,
it is not paused, and the ordinary scoring produced `scored` for it. Today
never confirms — it is not final. Open, neutral and paused days are
transparent: they neither count nor reset. A scored day below the threshold
empties the count. One target at a time, the next rank only: a rating already
two thresholds up advances one rank per confirmation, and each promotion
starts the following target from nothing. The top rank has no pending state.
Demotion is untouched — same hysteresis, same sustained-days rule, same
treatment of today and of unscored points, the counter carried across the
boundary.

**The era boundary is option B, and it has two entry points.** The one
stored fact is `settings.promotionConfirmation.from`, never moved once
written. A settings record **created under this version** carries it from
the start with `from = today()`: a new user has no legacy rank to keep, the
walk opens at Rookie and confirms every rank from there, and a first day
already past a threshold shows 0/7 rather than a rank it has not held — the
day itself counts once it is past, today never does. A record that
**predates the feature** has no field, and that absence has exactly one
meaning: the ensure step on the next configuration load activates it
prospectively with `from = addDays(today(), 1)`. The activation day is then
legacy in its entirety — whatever the immediate-promotion rule awards on it,
including later that same day, is kept — and the first day the new rule
could count is the day after tomorrow. Days before `from` are walked by
`rankHistory()` verbatim; days from `from` on are walked by
`confirmedRankHistory()`, which continues from the legacy walk's own
terminal state. Existing users keep their rank, peak rank, lifetime XP and
legacy rank history to the byte (`.github/fixtures/stage4/activation.json`).
A restored backup follows the same two rules by its settings record: an old
file has no field and activates from the day after the import; a newer file
keeps the boundary it carries. Nothing infers "new user" heuristically.

**The pending state is persisted, and is not a source of truth.** The
product model asks for the unique qualifying dates to be on record, so the
settings carry `{ from, targetRankId, eligibleDates }` with the dates as a
sorted, deduplicated array and the shown count as its length. Every Boss
replay recomputes the canonical state from stored history, pauses, Boss
points, `from` and today, and writes it back only when the bytes differ.
Editing a counted day inside the edit window simply produces a different
canonical set on the next replay; nothing is patched from the edit itself.
Saving the same day twice, replaying twice and reloading twice write nothing.

**What was not done, and why.** `rankHistory()` was not changed globally —
it is now one fold over a shared step, byte-identical in output, so the
confirmation walk can run the same demotion step rather than a copy. The
`rankEvents` store stays unused: a promotion is a derived `RankChange`,
identified by target and date, and the fold cannot produce the same one
twice. No schema or backup-format version moved: the field is optional on
the settings record, which the backup validator passes through and the
importer stores whole. An old file activates a fresh prospective boundary on
the importing device; a newer file keeps the boundary it carries.

**A consequence to know.** A closed day nobody answered is a scored day with
a real result, and it is eligible. If the rating stays above the threshold
through seven such days — the general cooling-off is gentle and capped — the
promotion confirms through them. That follows from "a missed item on a
closed day is a real result" and is not special-cased.

**Interface.** "Rang bestätigen: n/7 Tage" on the Rank hero and the Today
Boss card, shown as soon as a promotion is pending — the rating has reached
the next threshold, 0/7 included, or qualifying days are on record — and not
merely because a next rank exists. The progress bar is unchanged. Once the
threshold is reached and the rank is waiting, the distance caption says
"Schwelle erreicht" rather than counting to nothing ("Noch 0 bis …" was
true and misleading); below the threshold the numeric distance stays, pending
dates or not, and the top rank keeps its own treatment (Stage 5).

**Product rule for a fresh install.** A profile created under this version
begins at Rookie and needs one separate seven-day confirmation for every
rank transition, in order. A rating already past several thresholds does
not jump to its natural rank; it confirms Challenger, then Contender, then
Elite, seven eligible days each. Pinned by `confirmation.test.ts` and the
fresh-install service test.

## D127 — The week a training domain starts in carries no target

**Decision.** In the **weekly ledger** a week's training targets are those
of the configuration snapshot in force on that week's **Monday**
(`historyService.ts`, `resolveSnapshot(snapshots, monday)`). The week in
which a training domain starts — the install week, or the week Gym or
Running is switched on — therefore has no ledger entry for that domain
whenever the start falls after the Monday: for everything the ledger
drives, the partial week is **no data**, never a met or a missed week. The
ledger stays exactly as it is.

What that means in the replay, precisely:

- **Earned nothing.** The start week earns no attendance (its days have no
  week target, so the training fold does not score them), no Endurance
  week, no session XP and no streak week.
- **Still counted as activity.** Its sessions are stored and shown; they
  start the domain's own timeline, reset the abstinence clock, and their
  sets are evidence for later performance windows.
- **Known divergence: the daily history fold.** The day-level fold resolves
  each *day's* own snapshot (`resolveSnapshot(snapshots, date)`), so the
  start week's days after the switch-on are scored against the new target:
  a Wednesday start with one session shows a Gym day score of 33 in the
  history, and with none, 0. The rating does not read those days (the
  training fold skips them), but the history does — and so does the Boss's
  participation: a domain joins the Boss's weighting from its first scored
  day with a session (`startedByDay` in `bossService.ts`), which can be a
  start-week day, with no movement until its rating moves. Whether the daily
  fold should follow the ledger is an open product question; changing it
  would be a scoring change and a new snapshot era, so it is not done here.
- **Mid-week target change.** For the same reason a target changed during a
  week is scored against Monday's target by the ledger, while Heute and the
  hub's Training card state the week against the target in force today.
- **No target, two readings.** A zero ledger target on a rating board means
  the start week while the domain is switched on, and nothing to aim at
  while it is switched off: the tile says which ("Startwoche · zählt ab
  Montag" or "Ausgeschaltet · kein Wochenziel"), never "0 von 0".

**Why it is written down now (WP3, B4).** The Gym hub read its week line
from the ledger, so a user's first session on a Wednesday showed
"0 Sessions diese Woche · Ziel erreicht": no sessions and a target of zero
from a week with no ledger entry. Heute showed "1 / 3" from the session log
against the user's own target. The two screens answered two different
questions with the same sentence. The fix is presentational: a screen that
states the week against the user's target reads it the way Heute does
(`loadTrainingWeek` in `checkInService.ts`), and a figure that belongs to
the rating — the attendance tile on the Gym and Running boards — shows the
start week as no data ("Startwoche · zählt ab Montag") instead of
"0 von 0".

**What was not done, and why.** Giving the start week the target the user
just chose would make a partial week count — one session on a Saturday
would be a missed week of three, which is exactly the "absence is a zero"
error the product refuses, and it would move every replayed fingerprint.
Prorating a target is a product decision nobody has made. The ledger
already treats the partial week as no data; this records it.

## D128 — A free workout is a draft until its first saved set

**Decision (WP3, P6).** Opening a free session writes nothing. The launcher
opens a *free draft* — no plan, nothing picked — and the workout screen
creates the day's session only when the first set is saved, through
`openSessionForDay`: a **bare** session with no `exercises` snapshot, which
renders from its sets exactly as free sessions always have. A picked
exercise arrives with the pending row, never as a stored 0×0 set, and stays
on the page — held in screen state, in the order it was picked — until the
workout is left; so does an exercise whose last set was removed. Picking an
exercise that is already on the page changes nothing.

**Overrides** HANDOVER's WP2-1 note that a free session "is created when it
is opened, and every exercise arrives with one set" (the B7 finding: opening
and leaving counted as a training).

**History stays history.** Bare sessions already stored — empty ones, and
0×0 sets — are facts of their time and keep counting for the weeks they
are in. Nothing cleans them up.

**Why a bare session rather than a snapshot.** A snapshot on a free session
would mark every exercise "Zusätzlich", blur the line between a plan and a
free workout that P7 needs, and break the model's documented invariant
(`exercises` absent on every free session). The bare session is also what
`planEquivalence.test.ts`'s manual path already writes, so the test stays
both green and a true description of the screen.

**Open.** Removing every set of a session leaves the session row, and an
empty row still counts for attendance. That was already so for a plan
session since WP2-1; whether an emptied session should go is asked at
STOP 2 rather than decided here.

## D129 — "Fertig" records `finishedAt`; a workout without it on record is finished

**Decision (WP3, P7).** `GymSessionRecord.finishedAt` has three states:

- a timestamp — "Fertig" was tapped then (a later "Fertig" overwrites it);
- `null` — the session was started in the app under P7 and not finished;
  `openSessionForDay` writes it on creation;
- **absent** — recorded before the field existed, and treated as finished.
  The absence is the era and is never backfilled.

Heute shows today's workout at the top while its session has at least one
saved set and `finishedAt === null`; the Gym hub's Training card states the
same in its own line. A plan session is stated as the share of planned
exercises with a saved set (extras excluded); anything else as counts.
Reopening a finished session and adding a set does not make it running
again. Outside the session's week "Fertig" leaves the record as it is and
still closes the screen.

**Nothing scores it.** No replay, rating, Boss or history path reads the
field; it decides only whether to offer "continue". The golden fixtures and
`planEquivalence` are untouched by it.

## D130 — The weight unit is a display preference

**Decision (WP3, P4).** `settings.weightUnit` is `kg` or `lb`, set in
Einstellungen, and absent means kg. It is a preference like the language,
never part of a config snapshot: sets stay integer grams and weight entries
kilograms whatever it says (D84 anticipated exactly this: "pounds a later
change to one formatter rather than to the data").

There is one formatter and one parser (`core/gym/weight.ts`, bound to the
preference by `useWeights`): 1 lb = 453.59237 g, typed pounds rounded to
whole grams, pounds shown with at most one decimal, kilograms as before.

**Only a changed value is written.** Pounds are shown rounded, so
re-parsing a field the user only focused would move the stored grams
(60 000 g → 60 010 g) — a fact the rating replays. A set's field writes only
when its **value** changed — "132,3" is the 132.3 lb a 60 000 g set shows,
so typing it again is no edit (Stage 2 review: comparing text missed the
decimal comma) — and an unchanged bodyweight saves the weight in force
exactly.

**An emptied field is not zero.** Clearing a barbell set's load or a set's
reps and leaving is retyping abandoned: the stored value stays and the
field shows it again. A pending row whose load does not read as a number
("." alone) is not a set and creates no session. On a bodyweight or
assisted exercise an empty load is no added weight, as it always was. This
is the parser's own contract — `parseWeight` returns `null` so a caller can
tell an empty field from a typed zero.

The preference is written like the language: the screen follows at once,
and a write that fails puts the screen back on what is stored.

## D131 — Removing in a workout is undoable, by putting back what was removed

**Decision (WP3, P5).** Removing an exercise (a worded control, unlike a
set's minus) and removing a set both offer an undo for about five seconds.
The undo puts back **the rows that were removed** — the same ids, order,
`createdAt`, muscles, roles and load type — and, in a session that owns its
structure, the snapshot line at the place it had (`restoreSet`,
`restoreExercise`). It never re-adds: new rows would mint new ids and copy
today's catalogue roles onto a set logged under older ones, which is the
backfilling CLAUDE.md forbids. An undo obeys the same weekly edit window as
the removal and says so when it is refused. An exercise added to a plan
session stays an extra, and the plan itself never changes.

Writes in the workout run one after another and none is turned away — a
weight typed while the reps are saving waits its turn — while a tapped
action keeps its double-tap guard.

**Every action decides when its turn comes, not when it is tapped**
(Stage 2 review). A tap first takes the focus from the field being typed
in, so that field's write is queued a moment before the tap's action; the
render the finger landed on is one write behind. Reading it removed a set
the same tap had saved and then restored an empty list, restored a set
without the edit its blur had saved, left an exercise on the page under a
toast saying it was gone, and put a draft line back into a draft that had
meanwhile become a session. So the removal services return what they
removed (`removeSet`, `removeExerciseFromSession` → `RemovedExercise`), the
undo restores exactly that, the branch between "stored" and "only on the
page" is taken on `sessionRef` inside the queue, and "+ Satz" copies the
set before it as stored when it runs (`repeatLastSet`, which never stores a
0×0 set). A saved set row compares a blur against what it last sent, not
against props that lag behind a queued write. An exercise's pending
row saves when the focus leaves the row, not a field: a bodyweight set is
otherwise stored without its added load. A new set's `order` follows the
highest, not the count; a set an undo put back may share an order with one
added meanwhile, and such sets sort by `createdAt`.
