# Block 7D — the pictures of the exercise picker

Made by `scripts/verify/stage7d-shots.mjs` from the build of the block
(`000d7a7`), on an empty device after onboarding — the app as built.

| Picture | What it shows |
|---|---|
| `auswahl-ohne-suche-<width>` | The picker in a workout without a query: the hint under the field, the first heading (Brust) |
| `auswahl-ohne-suche-rumpf-<width>` | Further down: where Trizeps ends and Rumpf begins |
| `auswahl-bauch-<width>`, `-zieh-`, `-maschine-`, `-eigengewicht-` | The owner's four words (D171) |
| `auswahl-kabel-brust-<width>` | Two words narrowing |
| `auswahl-ohne-treffer-<width>` | A word nothing answers: the sentence, "Eigene Übung" the primary action |
| `auswahl-eigene-uebung-<width>` | The own exercise opened from there, the word as its name |
| `auswahl-englisch-abs-393`, `auswahl-englisch-ohne-suche-393` | The English screen |
| `auswahl-plan-bauch-393` | The plan editor's picker |

Widths 320, 360, 393 and 430 (`<width>`), 2× pixels.

## Looked at, each one

- **Fixed during the block:** «rücken» listed five presses before the
  pull-ups, because «rücken» lies inside «Bankdrücken»; a hit found only
  inside a word now stands last (D188).
- **Fixed in the script, not the app:** a search was typed into a field
  the scrolled list had half hidden; the script scrolls back first, as a
  finger does.
- **On purpose:** at 320 and 360 the hint under the field takes two lines,
  and a long second line ("unterer Bauch / Hüftbeuger · Rumpf · Unterarme
  · Eigengewicht") wraps — nothing is cut off, which `exercise-search.mjs`
  and `design-system.mjs` measure at every width.
- **On purpose:** with «maschine», Bauchmaschine and Trizepsmaschine stand
  among the hits by equipment, alphabetically, not among the names —
  «maschine» lies inside their names (D188).
- **On purpose:** a row says its equipment only where the name does not
  ("Bauchmaschine" has none beside its groups).
