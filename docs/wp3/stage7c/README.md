# The import files of the check at STOP 7C

**There is no backup with real data** (D183). These files are the device
the checks and the pictures of block 7C run on — `seedSheetProfile` in
`scripts/verify/lib.mjs` — set for one day each and exported by the build
of the block through its own "Backup exportieren"
(`scripts/verify/stage7c-check-files.mjs`). Every figure is invented.

They are a different kind of file from the diary of the earlier STOPs, and
for a reason. That diary (`docs/wp3/stage7b/`) has every group rated and
improved; block 7C built a sheet that says five things, and a diary in
which everything rises shows one of them. These files show all of them.
The price: **their rows were written into the database by the script, not
typed through the interface.** They are good for Muskelgruppen, the sheets,
the exercise details and the card on the Gym hub. Heute, Verlauf and Rang
show a device nobody lived on — ninety days of answers, a session without
sets every third day, a target for Laufen and no run.

**Take the file of the day you check, and import it into the preview**
(Bereiche → Einstellungen → "Backup importieren"; it replaces what the
preview holds). A file loaded on a later day shows other days ago and
another range.

| Check on | File |
|---|---|
| 16 November 2026 (the STOP) | `momentum-pruefdaten-7c-2026-11-16.json` |
| 17 November 2026 | `momentum-pruefdaten-7c-2026-11-17.json` |
| 18 November 2026 | `momentum-pruefdaten-7c-2026-11-18.json` |

Each holds 23 sessions, 42 sets and the answers of ninety days. Each was
read back on an empty device on its own day: imported through "Backup
importieren", all ten rows and the strip the same as on the device it was
made on, and the sheets saying what the table below has.

## What the preview shows after the import

The strip above the body, at 30 days: **Leistungstrend +15 % Verbessert ·
7 / 10 Gruppen · Stärkster +100 % Quadrizeps**.

| Group | Row, 30 days | What its sheet is there to show |
|---|---|---|
| Brust | +2 % Verbessert | a change with its line, one exercise (Bankdrücken +2 %), the work volume in four weeks and a week without a bar |
| Rücken | +3 % Verbessert | **"uneinheitlich"**: seven exercises, six held and "Rudern am Kabel" at +20 %; a long list to scroll, and a line that reaches the edge of its scale |
| Schultern | Noch nicht trainiert | **not trained in the range**: the sentence, "Zuletzt trainiert am …", and "Training erfassen"; at 90 days it has a figure |
| Bizeps | Zu wenig Vergleichsdaten | **too little to compare**: no chart, two exercise days, and under "Erfasst" the two days of Hammercurls |
| Trizeps | +4 % Verbessert | two exercises — Bankdrücken +2 % and **Dips +5 %**, whose detail is the case of D176: +5 % in the range while its last day lies under its first |
| Rumpf | −10 % Zurückgegangen | a fall: the line down to the edge of the scale, "−10 %" beside it |
| Quadrizeps | +100 % Verbessert | a three-digit figure in the row and in the sheet |
| Beinbeuger und Gesäss | 0 % Gehalten | held: neutral, never yellow |
| Waden | Zu wenig Vergleichsdaten | too little, with one exercise day |
| Unterarme | +6 % Verbessert | **a single observation** (D170): a dot in the row and in the sheet's chart — the form the owner chooses a replacement for |

## The diary, if a realistic one is wanted beside it

Block 7C changed nothing that computes or stores, so the diary files of
STOP 7B are still right on their days — `docs/wp3/stage7b/`, for the same
three days. They show the sheet on five weeks of push, pull and legs: every
group rated and improved, a line with a point for every training day, a bar
for every week.

## For any other day

```
npm run build && npx vite preview --port 4173 &
DAYS=<day>[,<day>…] OUT=docs/wp3/stage7c node scripts/verify/stage7c-check-files.mjs
```

The script throws, and leaves no file to hand over, if the import does not
show what the device showed.
