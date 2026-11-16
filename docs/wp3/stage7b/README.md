# The import files of the check at STOP 7B

A training diary nobody kept — every figure is invented — made by the live
build (`e30becd`) itself, through its own interface, and exported by its own
"Backup exportieren" (`scripts/verify/stage5b-live-backup.mjs`). It is the
diary of the block "Kurve" (`docs/wp3/kurve/`), made anew: the same sets on
the same days under other ids.

**There is no backup with real data** (D183). Block 7B changed nothing that
computes or stores, so the figures of these files are the figures the block
"Kurve" ended with — the Gym rating of the 16th and the 17th is the one
`docs/wp3/kurve/README.md` has. What the files are for is the stage: a body
to turn, to tap and to zoom, with a strip above it that has something to
say. **In this diary every group is rated and improved**, so the body is
green all over, in different strengths; the other states — held, declined,
too little to compare, not trained — are in the pictures under
`docs/design/wp3/stage7b/`, and the empty screen is the preview before any
import.

**Take the file whose last session is on the day you check.** A file loaded
on a later day than its last session shows a different week.

| Check on | File |
|---|---|
| 16 November 2026 (the STOP) | `momentum-pruefdaten-7b-2026-11-16.json` |
| 17 November 2026 | `momentum-pruefdaten-7b-2026-11-17.json` |
| 18 November 2026 | `momentum-pruefdaten-7b-2026-11-18.json` |

Each holds 16 sessions and 208 sets from 12 October 2026 on, two body
weights, and the answers of every day up to its own.

## What the preview shows after the import

Read off the preview build on each file's day
(`scripts/verify/stage5b-import-check.mjs`, at 393 × 852). The strip stands
above the body; "Stärkster" is the improved group with the largest change.

| File of the | Gym rating | Range | Leistungstrend | Gewertet | Stärkster |
|---|---|---|---|---|---|
| 16 November | 836 | 30 Tage | +6 % Verbessert | 10 / 10 | +7 % Waden |
| | | 90 Tage | +6 % Verbessert | 10 / 10 | +11 % Bizeps |
| 17 November | 821 | 30 Tage | +6 % Verbessert | 10 / 10 | +9 % Rumpf |
| | | 90 Tage | +6 % Verbessert | 10 / 10 | +11 % Bizeps |
| 18 November | 807 | 30 Tage | +6 % Verbessert | 10 / 10 | +9 % Rumpf |
| | | 90 Tage | +6 % Verbessert | 10 / 10 | +11 % Bizeps |

The ten rows at 30 days, file of the 16th: Brust +5 %, Rücken +4 %,
Schultern +6 %, Bizeps +7 %, Trizeps +7 %, Rumpf +6 %, Quadrizeps +5 %,
Beinbeuger und Gesäss +6 %, Waden +7 %, Unterarme +4 %. Three rows print
+7 %; the strip names the one whose change is really the largest. In the
live app the same file reads by the old metric (Gym rating 818, 803 and 789
on the three days), as in the block "Kurve".

For any other day:

```
git worktree add <dir> e30becd && (cd <dir> && npm ci && npm run build)
(cd <dir> && npx vite preview --port 4273 --strictPort) &
LIVE_URL=http://127.0.0.1:4273/Momentum-App/ LAST=<day> \
  OUT=docs/wp3/stage7b/momentum-pruefdaten-7b-<day>.json \
  node scripts/verify/stage5b-live-backup.mjs
```
