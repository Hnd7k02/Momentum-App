# The import files of the check at STOP 7D

**There is no backup with real data** (D183). Block 7D is about a device
that already exists — someone who trains, has a plan and an exercise of
their own, and opens the new build — so these files are **made by the live
build** (the default branch, `e30becd`, with the exercises it ships), not
by the build under test (`scripts/verify/stage7d-check-files.mjs`):

1. the live build, on a clock that reads that day at noon in Zurich,
   imports the training diary of the earlier STOPs for that day
   (`docs/wp3/stage7b/`, every set typed through the live build's own
   interface; every figure invented);
2. through its interface again it makes a plan **"Oberkörper"** of
   Bankdrücken, Latzug and an exercise of the user's own, **"Zercher
   Squat"** (Quadrizeps as the primary group, Rumpf beside it), made in
   the plan's picker with "Eigene Übung";
3. and exports its backup through "Backup exportieren".

Each file was then imported on an empty device of its day by the build
before this block and by the build of this block, and read off both. Every
line below held, or the file would not be here:

- the same Gym rating, the same ten rows and the same strip above the body
  on both builds — the catalogue moves no figure;
- the same plan on both, its three exercises in their order;
- the build of this block offers **134 exercises**: the 133 of its
  catalogue and the user's own — the build before it offered 50;
- **every exercise the file holds stands as it was, byte for byte**, after
  the new build has added its 84;
- «zercher» finds the user's own exercise on both.

**Take the file of the day you check, and import it into the preview**
(Bereiche → Einstellungen → "Backup importieren"; it replaces what the
preview holds).

| Check on | File | Gym rating in the preview |
|---|---|---|
| 17 November 2026 | `momentum-pruefdaten-7d-2026-11-17.json` | 821 |
| 18 November 2026 | `momentum-pruefdaten-7d-2026-11-18.json` | 807 |

Each holds 16 sessions and 208 sets from 12 October 2026 on, 49 exercises
(48 of the live catalogue and the user's own) and one plan.

**The live app shows another rating for the same file** (803 on the 17th,
789 on the 18th). That is not this block: it is Stage 5b's metric and the
block "Kurve" (D150, D177), which the live app does not have yet. The two
builds that differ only by this block show the same number.

## What the preview shows after the import

The strip above the body, at 30 days: **Leistungstrend +6 % Verbessert ·
10 / 10 Gruppen · Stärkster +9 % Rumpf**; every group improved, between
+3 % (Rücken) and +9 % (Rumpf).

What the file is for is the picker: open a workout or the plan
"Oberkörper", tap "Übung hinzufügen", and the list stands under one
heading per group, the user's own exercise under Quadrizeps with the
built-in ones; «zercher» finds it, and every word of the checklist finds
what it should.
