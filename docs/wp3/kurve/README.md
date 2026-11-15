# The import files of the check at STOP Kurve

A training diary nobody kept — every figure is invented — made by the live
build (`e30becd`) itself, through its own interface, and exported by its own
"Backup exportieren" (`scripts/verify/stage5b-live-backup.mjs`). Loaded into
the live app and into the preview, it shows the same weeks under the old
rules and under the new ones.

**Take the file whose last session is on the day you check.** The update is
the first load after the import, and no day before it moves: loaded on a
later day than its last session, a file shows the same Gym rating in both
apps until a day is scored again.

| Check on | File | Gym rating, live app | Gym rating, preview |
|---|---|---|---|
| 15 November 2026 (the STOP) | `momentum-pruefdaten-kurve.json` | 832 | 833 |
| 16 November 2026 | `momentum-pruefdaten-kurve-2026-11-16.json` | 818 | 836 |
| 17 November 2026 | `momentum-pruefdaten-kurve-2026-11-17.json` | 803 | 821 |

The first is the diary of the Stage 5b file
(`docs/wp3/stage5b/momentum-pruefdaten-5b.json`), set for set: the STOP fell
on that file's last day. The other two are the same diary with the next
session done on their day. The numbers were read off both builds
(`scripts/verify/stage5b-import-check.mjs`) and are held by
`src/storage/services/kurveImportFile.test.ts`.

For any other day:

```
git worktree add <dir> e30becd && (cd <dir> && npm ci && npm run build)
(cd <dir> && npx vite preview --port 4273 --strictPort) &
LIVE_URL=http://127.0.0.1:4273/Momentum-App/ LAST=<day> \
  OUT=docs/wp3/kurve/momentum-pruefdaten-kurve-<day>.json \
  node scripts/verify/stage5b-live-backup.mjs
```
