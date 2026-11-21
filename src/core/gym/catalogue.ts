import type { ExerciseLoadType, ExerciseRecord, Language, MuscleGroup } from '../model';

/**
 * The exercises Momentum ships with.
 *
 * Six properties matter more than the list itself:
 *
 * 1. **The ids are permanent.** `ex_bench_press` is what a two-year-old set
 *    row points at, so a rename is a rename rather than the start of a new
 *    history. Never renumber one, never reuse one, and never delete one: an
 *    entry that should no longer be offered is marked `deprecated`, which
 *    hides it from new plans and keeps it resolvable for every plan and
 *    session that already names it (WP2 A2).
 * 2. **The muscle groups are written down.** Nothing here is inferred from a
 *    name — "Row" is not parsed for the word "back". A mapping is a product
 *    decision, and a wrong guess would quietly redistribute a user's Gym
 *    score across the wrong parts of the body.
 * 3. **It is code, not data.** Like the demo foods, the catalogue ships with
 *    the app rather than living in a backup. What is stored is the user's
 *    own exercises and the mapping each *set* was logged under.
 * 4. **Roles are stated, not positional.** `primary` names the groups that
 *    share 70 % of the exercise; everything else in `muscles` shares 30 %
 *    (D92). Phase 4 relied on "primary first" as a display convention, which
 *    was fine while every group counted the same and is not fine now that
 *    they do not — an ordering convention is exactly the kind of implicit
 *    fact that becomes wrong the first time someone sorts a list.
 * 5. **The load type is stated too.** A pull-up is not a lift of zero
 *    kilograms, and an assisted pull-up is not a lift of the assistance. See
 *    `core/gym/load.ts`.
 * 6. **The catalogue is the presentation source for a built-in** (WP2-1,
 *    decision 4). The display name is localised here, and the anatomical
 *    `detail` is a label and nothing else: "Trizeps, langer Kopf" tells the
 *    user what an exercise is for, and the scoring reads only `muscles` and
 *    `primary`. The `exercises` store record a built-in seeded is its id
 *    anchor and its fallback name, never rewritten — so a set logged years
 *    ago under `ex_bench_press` reads "Bankdrücken" in German today with
 *    not one stored byte changed.
 */
export interface CatalogueExercise {
  id: string;
  /** The display name per language. German is the source of truth (de-CH). */
  names: Record<Language, string>;
  /** What the exercise is for, anatomically. Display only — never scored. */
  detail: Record<Language, string>;
  /** Every group the exercise counts towards. */
  muscles: MuscleGroup[];
  /** Those of them that are primary. Always a subset of `muscles`. */
  primary: MuscleGroup[];
  /** Omitted for the ordinary case, `external`. */
  loadType?: ExerciseLoadType;
  /**
   * What it is done with. Description and a search word (block 7D): shown
   * on the picker's row and found by the search, never read by anything
   * that rates. Every entry has one, and an entry is loaded by body weight
   * exactly when its equipment is `bodyweight`.
   */
  equipment: Equipment;
  /**
   * How it moves, from a fixed list (block 7D, D171) — written down like the
   * muscles, never read from the name. Several where an exercise is more
   * than one: a row is also a pull. Description and search words only.
   */
  movement: Movement[];
  /**
   * Hidden from new plans and the picker, still resolvable everywhere it is
   * already named. Nothing is deprecated today; the flag exists so a future
   * release has a way to retire an entry that is not deleting it.
   */
  deprecated?: boolean;
}

/**
 * What an exercise is done with. `ezBar`, `kettlebell` and `wristRoller`
 * came with block 7D, for the SZ curls, the kettlebell swing and the wrist
 * roller; each has its search words in `search.ts`.
 */
export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'smith' | 'bodyweight' | 'ezBar' | 'kettlebell' | 'wristRoller';

/**
 * How an exercise moves (block 7D). The six of D171 — drücken, ziehen,
 * rudern, beugen, strecken, heben — and four the six do not cover: `fly`
 * (the arms round the chest, and the rear-delt flys), `rotate` (the core's
 * rotation), `hold` (the core holding against a force: plank, Pallof press,
 * ab wheel) and `carry` (the farmer's walk). The search's words for each
 * are in `search.ts`.
 */
export type Movement = 'push' | 'pull' | 'row' | 'bend' | 'extend' | 'raise' | 'fly' | 'rotate' | 'hold' | 'carry';

const de = (deName: string, enName: string): Record<Language, string> => ({ de: deName, en: enName });

/*
 * The muscle roles of the 29 iteration-2 entries are unchanged; the German
 * names, the detail labels and the equipment are new presentation
 * metadata. `catalogue.test.ts` pins the roles, so a later edit that moves
 * one is a test failure rather than a quiet rescoring of new sets.
 *
 * Block 7D (D171, D188) adds 85 entries — 84 at its STOP and the Bayesian
 * cable curl the owner asked for after it — at least ten per group by
 * primary, and gives every entry its movement. The 49 before it keep their
 * ids, roles, load types, names and details; `catalogue.test.ts` pins the
 * roles of all 134 in four tables. One entry a line: `wp3-stage1.mjs` reads the German
 * names from this file.
 */
export const EXERCISE_CATALOGUE: CatalogueExercise[] = [
  /* ── Chest ─────────────────────────────────────────────────────────── */
  { id: 'ex_bench_press', names: de('Bankdrücken', 'Bench Press'), detail: de('Brust', 'Chest'), muscles: ['chest', 'triceps', 'shoulders'], primary: ['chest'], equipment: 'barbell', movement: ['push'] },
  { id: 'ex_incline_press', names: de('Schrägbank Kurzhantel', 'Incline Dumbbell Press'), detail: de('obere Brust', 'Upper chest'), muscles: ['chest', 'shoulders', 'triceps'], primary: ['chest'], equipment: 'dumbbell', movement: ['push'] },
  { id: 'ex_incline_press_machine', names: de('Schrägbank Maschine', 'Incline Press Machine'), detail: de('obere Brust', 'Upper chest'), muscles: ['chest', 'shoulders', 'triceps'], primary: ['chest'], equipment: 'machine', movement: ['push'] },
  { id: 'ex_chest_fly', names: de('Cable Fly straight', 'Cable Fly'), detail: de('Brust', 'Chest'), muscles: ['chest'], primary: ['chest'], equipment: 'cable', movement: ['fly'] },
  { id: 'ex_cable_fly_low_to_high', names: de('Cable Fly bottom-up', 'Low-to-High Cable Fly'), detail: de('obere Brust', 'Upper chest'), muscles: ['chest'], primary: ['chest'], equipment: 'cable', movement: ['fly'] },
  { id: 'ex_push_up', names: de('Liegestütze', 'Push-Up'), detail: de('Brust', 'Chest'), muscles: ['chest', 'triceps', 'core'], primary: ['chest'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['push'] },

  // Block 7D (D171): machine, cable and free-weight chest work.
  { id: 'ex_chest_press_machine', names: de('Brustpresse Maschine', 'Chest Press Machine'), detail: de('Brust', 'Chest'), muscles: ['chest', 'triceps', 'shoulders'], primary: ['chest'], equipment: 'machine', movement: ['push'] },
  { id: 'ex_pec_deck', names: de('Butterfly Maschine', 'Pec Deck'), detail: de('Brust', 'Chest'), muscles: ['chest'], primary: ['chest'], equipment: 'machine', movement: ['fly'] },
  { id: 'ex_cable_chest_press', names: de('Brustpresse Kabel', 'Cable Chest Press'), detail: de('Brust', 'Chest'), muscles: ['chest', 'triceps', 'shoulders'], primary: ['chest'], equipment: 'cable', movement: ['push'] },
  { id: 'ex_high_to_low_cable_fly', names: de('Cable Fly top-down', 'High-to-Low Cable Fly'), detail: de('untere Brust', 'Lower chest'), muscles: ['chest'], primary: ['chest'], equipment: 'cable', movement: ['fly'] },
  { id: 'ex_dumbbell_bench_press', names: de('Bankdrücken Kurzhantel', 'Dumbbell Bench Press'), detail: de('Brust', 'Chest'), muscles: ['chest', 'triceps', 'shoulders'], primary: ['chest'], equipment: 'dumbbell', movement: ['push'] },
  { id: 'ex_dumbbell_fly', names: de('Flys Kurzhantel', 'Dumbbell Fly'), detail: de('Brust', 'Chest'), muscles: ['chest'], primary: ['chest'], equipment: 'dumbbell', movement: ['fly'] },
  { id: 'ex_incline_bench_press', names: de('Schrägbank Langhantel', 'Incline Bench Press'), detail: de('obere Brust', 'Upper chest'), muscles: ['chest', 'shoulders', 'triceps'], primary: ['chest'], equipment: 'barbell', movement: ['push'] },
  { id: 'ex_decline_bench_press', names: de('Negativbank Langhantel', 'Decline Bench Press'), detail: de('untere Brust', 'Lower chest'), muscles: ['chest', 'triceps', 'shoulders'], primary: ['chest'], equipment: 'barbell', movement: ['push'] },
  { id: 'ex_smith_machine_bench_press', names: de('Bankdrücken Smith Machine', 'Smith Machine Bench Press'), detail: de('Brust', 'Chest'), muscles: ['chest', 'triceps', 'shoulders'], primary: ['chest'], equipment: 'smith', movement: ['push'] },

  /* ── Back ──────────────────────────────────────────────────────────── */
  { id: 'ex_lat_pulldown', names: de('Latzug', 'Lat Pulldown'), detail: de('Latissimus', 'Latissimus'), muscles: ['back', 'biceps'], primary: ['back'], equipment: 'cable', movement: ['pull'] },
  // A starter plan's exercise (Pull B): one arm at the cable from above.
  { id: 'ex_single_arm_cable_pulldown', names: de('Latzug einarmig Kabel', 'Single-Arm Cable Pulldown'), detail: de('Latissimus', 'Latissimus'), muscles: ['back', 'biceps'], primary: ['back'], equipment: 'cable', movement: ['pull'] },
  { id: 'ex_lat_pulldown_wide', names: de('Latzug weit', 'Wide-Grip Lat Pulldown'), detail: de('Latissimus', 'Latissimus'), muscles: ['back', 'biceps'], primary: ['back'], equipment: 'cable', movement: ['pull'] },
  { id: 'ex_lat_pulldown_close', names: de('Latzug eng von oben', 'Close-Grip Lat Pulldown'), detail: de('Latissimus', 'Latissimus'), muscles: ['back', 'biceps'], primary: ['back'], equipment: 'cable', movement: ['pull'] },
  { id: 'ex_lat_pulldown_neutral', names: de('Latzug neutraler Griff', 'Neutral-Grip Lat Pulldown'), detail: de('Latissimus', 'Latissimus'), muscles: ['back', 'biceps'], primary: ['back'], equipment: 'cable', movement: ['pull'] },
  { id: 'ex_straight_arm_pulldown', names: de('Straight-Arm Pullover Kabel', 'Straight-Arm Cable Pullover'), detail: de('Latissimus', 'Latissimus'), muscles: ['back'], primary: ['back'], equipment: 'cable', movement: ['pull'] },
  { id: 'ex_barbell_row', names: de('Langhantelrudern', 'Barbell Row'), detail: de('oberer Rücken', 'Upper back'), muscles: ['back', 'biceps', 'forearms'], primary: ['back'], equipment: 'barbell', movement: ['row', 'pull'] },
  { id: 'ex_smith_row', names: de('Rudern Smith Machine', 'Smith Machine Row'), detail: de('oberer Rücken', 'Upper back'), muscles: ['back', 'biceps', 'forearms'], primary: ['back'], equipment: 'smith', movement: ['row', 'pull'] },
  { id: 'ex_close_cable_row', names: de('Enges Kabelrudern', 'Close-Grip Cable Row'), detail: de('oberer Rücken', 'Upper back'), muscles: ['back', 'biceps', 'forearms'], primary: ['back'], equipment: 'cable', movement: ['row', 'pull'] },
  // Both halves of a deadlift are the point of it, so both are primary and
  // share the 70 % between them. Nothing else about the rule changes.
  { id: 'ex_deadlift', names: de('Kreuzheben', 'Deadlift'), detail: de('Rücken / Beinbeuger / Gesäss', 'Back / hamstrings / glutes'), muscles: ['back', 'hamstringsGlutes', 'forearms'], primary: ['back', 'hamstringsGlutes'], equipment: 'barbell', movement: ['raise'] },
  { id: 'ex_pull_up', names: de('Klimmzüge', 'Pull-Up'), detail: de('Latissimus', 'Latissimus'), muscles: ['back', 'biceps'], primary: ['back'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['pull'] },
  { id: 'ex_assisted_pull_up', names: de('Klimmzüge assistiert', 'Assisted Pull-Up'), detail: de('Latissimus', 'Latissimus'), muscles: ['back', 'biceps'], primary: ['back'], loadType: 'assisted', equipment: 'machine', movement: ['pull'] },

  // Block 7D (D171): the machine and bodyweight rows, the back extensions and the shrugs.
  { id: 'ex_seated_row_machine', names: de('Rudern Maschine', 'Seated Row Machine'), detail: de('oberer Rücken', 'Upper back'), muscles: ['back', 'biceps', 'forearms'], primary: ['back'], equipment: 'machine', movement: ['row', 'pull'] },
  { id: 'ex_back_extension_machine', names: de('Rückenstrecker Maschine', 'Back Extension Machine'), detail: de('unterer Rücken', 'Lower back'), muscles: ['back', 'hamstringsGlutes'], primary: ['back'], equipment: 'machine', movement: ['extend'] },
  { id: 'ex_chin_up', names: de('Klimmzüge Untergriff', 'Chin-Up'), detail: de('Latissimus', 'Latissimus'), muscles: ['back', 'biceps'], primary: ['back'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['pull'] },
  { id: 'ex_inverted_row', names: de('Rudern Eigengewicht', 'Inverted Row'), detail: de('oberer Rücken', 'Upper back'), muscles: ['back', 'biceps', 'forearms'], primary: ['back'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['row', 'pull'] },
  { id: 'ex_hyperextension', names: de('Hyperextensions', 'Hyperextension'), detail: de('unterer Rücken', 'Lower back'), muscles: ['back', 'hamstringsGlutes'], primary: ['back'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['extend'] },
  { id: 'ex_one_arm_dumbbell_row', names: de('Kurzhantelrudern einarmig', 'One-Arm Dumbbell Row'), detail: de('oberer Rücken', 'Upper back'), muscles: ['back', 'biceps', 'forearms'], primary: ['back'], equipment: 'dumbbell', movement: ['row', 'pull'] },
  { id: 'ex_t_bar_row', names: de('T-Bar-Rudern', 'T-Bar Row'), detail: de('oberer Rücken', 'Upper back'), muscles: ['back', 'biceps', 'forearms'], primary: ['back'], equipment: 'barbell', movement: ['row', 'pull'] },
  { id: 'ex_dumbbell_shrug', names: de('Shrugs Kurzhantel', 'Dumbbell Shrug'), detail: de('Trapez', 'Traps'), muscles: ['back', 'forearms'], primary: ['back'], equipment: 'dumbbell', movement: ['raise'] },
  { id: 'ex_barbell_shrug', names: de('Shrugs Langhantel', 'Barbell Shrug'), detail: de('Trapez', 'Traps'), muscles: ['back', 'forearms'], primary: ['back'], equipment: 'barbell', movement: ['raise'] },

  /* ── Shoulders ─────────────────────────────────────────────────────── */
  { id: 'ex_overhead_press', names: de('Overhead Press', 'Overhead Press'), detail: de('vordere Schulter', 'Front delts'), muscles: ['shoulders', 'triceps', 'core'], primary: ['shoulders'], equipment: 'barbell', movement: ['push'] },
  { id: 'ex_lateral_raise', names: de('Seitheben', 'Lateral Raise'), detail: de('seitliche Schulter', 'Side delts'), muscles: ['shoulders'], primary: ['shoulders'], equipment: 'dumbbell', movement: ['raise'] },
  // WP3 (B12): the front raise was missing. Shoulders only, like the
  // lateral raise: the front delt is the one head it isolates.
  { id: 'ex_front_raise', names: de('Frontheben', 'Front Raise'), detail: de('vordere Schulter', 'Front delts'), muscles: ['shoulders'], primary: ['shoulders'], equipment: 'dumbbell', movement: ['raise'] },
  { id: 'ex_cable_lateral_raise', names: de('Seitheben Kabel', 'Cable Lateral Raise'), detail: de('seitliche Schulter', 'Side delts'), muscles: ['shoulders'], primary: ['shoulders'], equipment: 'cable', movement: ['raise'] },
  { id: 'ex_lean_away_lateral_raise', names: de('Seitheben Kurzhantel lean-away', 'Lean-Away Lateral Raise'), detail: de('seitliche Schulter', 'Side delts'), muscles: ['shoulders'], primary: ['shoulders'], equipment: 'dumbbell', movement: ['raise'] },
  { id: 'ex_reverse_fly_machine', names: de('Reverse Flys Maschine', 'Reverse Fly Machine'), detail: de('hintere Schulter', 'Rear delts'), muscles: ['shoulders', 'back'], primary: ['shoulders'], equipment: 'machine', movement: ['fly'] },
  { id: 'ex_face_pull', names: de('Face Pulls', 'Face Pulls'), detail: de('hintere Schulter / Trapez', 'Rear delts / traps'), muscles: ['shoulders', 'back'], primary: ['shoulders'], equipment: 'cable', movement: ['pull'] },

  // Block 7D (D171): presses, raises and flys on the machine, the cable and the dumbbell.
  { id: 'ex_shoulder_press_machine', names: de('Schulterpresse Maschine', 'Shoulder Press Machine'), detail: de('vordere Schulter', 'Front delts'), muscles: ['shoulders', 'triceps'], primary: ['shoulders'], equipment: 'machine', movement: ['push'] },
  { id: 'ex_lateral_raise_machine', names: de('Seitheben Maschine', 'Lateral Raise Machine'), detail: de('seitliche Schulter', 'Side delts'), muscles: ['shoulders'], primary: ['shoulders'], equipment: 'machine', movement: ['raise'] },
  { id: 'ex_cable_reverse_fly', names: de('Reverse Flys Kabel', 'Cable Reverse Fly'), detail: de('hintere Schulter', 'Rear delts'), muscles: ['shoulders', 'back'], primary: ['shoulders'], equipment: 'cable', movement: ['fly'] },
  { id: 'ex_pike_push_up', names: de('Pike-Liegestütze', 'Pike Push-Up'), detail: de('vordere Schulter', 'Front delts'), muscles: ['shoulders', 'triceps'], primary: ['shoulders'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['push'] },
  { id: 'ex_dumbbell_shoulder_press', names: de('Schulterdrücken Kurzhantel', 'Dumbbell Shoulder Press'), detail: de('vordere Schulter', 'Front delts'), muscles: ['shoulders', 'triceps'], primary: ['shoulders'], equipment: 'dumbbell', movement: ['push'] },
  { id: 'ex_arnold_press', names: de('Arnold Press', 'Arnold Press'), detail: de('vordere und seitliche Schulter', 'Front and side delts'), muscles: ['shoulders', 'triceps'], primary: ['shoulders'], equipment: 'dumbbell', movement: ['push'] },
  { id: 'ex_dumbbell_reverse_fly', names: de('Reverse Flys Kurzhantel', 'Dumbbell Reverse Fly'), detail: de('hintere Schulter', 'Rear delts'), muscles: ['shoulders', 'back'], primary: ['shoulders'], equipment: 'dumbbell', movement: ['fly'] },
  { id: 'ex_upright_row', names: de('Aufrechtes Rudern', 'Upright Row'), detail: de('seitliche Schulter / Trapez', 'Side delts / traps'), muscles: ['shoulders', 'back'], primary: ['shoulders'], equipment: 'barbell', movement: ['row', 'pull'] },

  /* ── Biceps ────────────────────────────────────────────────────────── */
  { id: 'ex_biceps_curl', names: de('Bizeps-Curls', 'Biceps Curl'), detail: de('Bizeps', 'Biceps'), muscles: ['biceps'], primary: ['biceps'], equipment: 'dumbbell', movement: ['bend'] },
  { id: 'ex_supinating_curl', names: de('Eindreh-Curls', 'Supinating Curl'), detail: de('Bizeps', 'Biceps'), muscles: ['biceps'], primary: ['biceps'], equipment: 'dumbbell', movement: ['bend'] },
  { id: 'ex_incline_curl', names: de('Schrägbank-Curls', 'Incline Curl'), detail: de('Bizeps, langer Kopf', 'Biceps, long head'), muscles: ['biceps'], primary: ['biceps'], equipment: 'dumbbell', movement: ['bend'] },
  { id: 'ex_preacher_curl', names: de('Preacher-Curls', 'Preacher Curl'), detail: de('Bizeps, kurzer Kopf', 'Biceps, short head'), muscles: ['biceps'], primary: ['biceps'], equipment: 'machine', movement: ['bend'] },
  { id: 'ex_hammer_curl', names: de('Hammer Curls', 'Hammer Curl'), detail: de('Brachialis / Brachioradialis', 'Brachialis / brachioradialis'), muscles: ['biceps', 'forearms'], primary: ['biceps'], equipment: 'dumbbell', movement: ['bend'] },

  // Block 7D (D171): curls on the cable, the barbell and the SZ bar.
  { id: 'ex_cable_curl', names: de('Bizeps-Curls Kabel', 'Cable Curl'), detail: de('Bizeps', 'Biceps'), muscles: ['biceps'], primary: ['biceps'], equipment: 'cable', movement: ['bend'] },
  // Added at the owner's request after STOP 7D (D188): the arm behind the body, the cable from below.
  { id: 'ex_bayesian_cable_curl', names: de('Bayesian Curls Kabel', 'Bayesian Cable Curl'), detail: de('Bizeps, langer Kopf', 'Biceps, long head'), muscles: ['biceps'], primary: ['biceps'], equipment: 'cable', movement: ['bend'] },
  { id: 'ex_rope_hammer_curl', names: de('Hammer Curls Seil', 'Rope Hammer Curl'), detail: de('Brachialis / Brachioradialis', 'Brachialis / brachioradialis'), muscles: ['biceps', 'forearms'], primary: ['biceps'], equipment: 'cable', movement: ['bend'] },
  { id: 'ex_barbell_curl', names: de('Bizeps-Curls Langhantel', 'Barbell Curl'), detail: de('Bizeps', 'Biceps'), muscles: ['biceps'], primary: ['biceps'], equipment: 'barbell', movement: ['bend'] },
  { id: 'ex_ez_bar_curl', names: de('SZ-Curls', 'EZ-Bar Curl'), detail: de('Bizeps', 'Biceps'), muscles: ['biceps'], primary: ['biceps'], equipment: 'ezBar', movement: ['bend'] },
  { id: 'ex_concentration_curl', names: de('Konzentrationscurls', 'Concentration Curl'), detail: de('Bizeps', 'Biceps'), muscles: ['biceps'], primary: ['biceps'], equipment: 'dumbbell', movement: ['bend'] },

  /* ── Triceps ───────────────────────────────────────────────────────── */
  { id: 'ex_triceps_pushdown', names: de('Pushdown Seil', 'Triceps Pushdown'), detail: de('Trizeps', 'Triceps'), muscles: ['triceps'], primary: ['triceps'], equipment: 'cable', movement: ['extend', 'push'] },
  { id: 'ex_overhead_cable_extension', names: de('Trizeps Überkopf Kabel', 'Overhead Cable Extension'), detail: de('Trizeps, langer Kopf', 'Triceps, long head'), muscles: ['triceps'], primary: ['triceps'], equipment: 'cable', movement: ['extend'] },
  { id: 'ex_skullcrusher', names: de('Skullcrusher Langhantel', 'Skullcrusher'), detail: de('Trizeps', 'Triceps'), muscles: ['triceps'], primary: ['triceps'], equipment: 'barbell', movement: ['extend'] },
  { id: 'ex_cable_skullcrusher', names: de('Trizeps-Crusher Kabel', 'Cable Skullcrusher'), detail: de('Trizeps', 'Triceps'), muscles: ['triceps'], primary: ['triceps'], equipment: 'cable', movement: ['extend'] },
  // Dips keep the roles they were logged under since iteration 2 (decision
  // 2): triceps primary, chest and shoulders secondary. The detail label
  // says what the movement is for; it is not the scoring role.
  { id: 'ex_dip', names: de('Dips', 'Dip'), detail: de('Brust unten / Trizeps', 'Lower chest / triceps'), muscles: ['triceps', 'chest', 'shoulders'], primary: ['triceps'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['push'] },
  { id: 'ex_assisted_dip', names: de('Dips assistiert', 'Assisted Dip'), detail: de('Brust unten / Trizeps', 'Lower chest / triceps'), muscles: ['triceps', 'chest', 'shoulders'], primary: ['triceps'], loadType: 'assisted', equipment: 'machine', movement: ['push'] },

  // Block 7D (D171): pushdowns, extensions and the bodyweight presses.
  { id: 'ex_bar_pushdown', names: de('Pushdown Stange', 'Bar Pushdown'), detail: de('Trizeps', 'Triceps'), muscles: ['triceps'], primary: ['triceps'], equipment: 'cable', movement: ['extend', 'push'] },
  { id: 'ex_triceps_extension_machine', names: de('Trizepsmaschine', 'Triceps Extension Machine'), detail: de('Trizeps', 'Triceps'), muscles: ['triceps'], primary: ['triceps'], equipment: 'machine', movement: ['extend'] },
  { id: 'ex_seated_dip_machine', names: de('Dips Maschine sitzend', 'Seated Dip Machine'), detail: de('Trizeps', 'Triceps'), muscles: ['triceps', 'chest', 'shoulders'], primary: ['triceps'], equipment: 'machine', movement: ['push'] },
  { id: 'ex_bench_dip', names: de('Bankdips', 'Bench Dip'), detail: de('Trizeps', 'Triceps'), muscles: ['triceps', 'shoulders'], primary: ['triceps'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['push'] },
  { id: 'ex_close_grip_push_up', names: de('Liegestütze eng', 'Close-Grip Push-Up'), detail: de('Trizeps', 'Triceps'), muscles: ['triceps', 'chest', 'core'], primary: ['triceps'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['push'] },
  { id: 'ex_close_grip_bench_press', names: de('Enges Bankdrücken', 'Close-Grip Bench Press'), detail: de('Trizeps', 'Triceps'), muscles: ['triceps', 'chest', 'shoulders'], primary: ['triceps'], equipment: 'barbell', movement: ['push'] },
  { id: 'ex_dumbbell_overhead_extension', names: de('Trizeps Überkopf Kurzhantel', 'Dumbbell Overhead Extension'), detail: de('Trizeps, langer Kopf', 'Triceps, long head'), muscles: ['triceps'], primary: ['triceps'], equipment: 'dumbbell', movement: ['extend'] },
  { id: 'ex_triceps_kickback', names: de('Trizeps-Kickbacks Kurzhantel', 'Triceps Kickback'), detail: de('Trizeps', 'Triceps'), muscles: ['triceps'], primary: ['triceps'], equipment: 'dumbbell', movement: ['extend'] },

  /* ── Legs ──────────────────────────────────────────────────────────── */
  { id: 'ex_squat', names: de('Kniebeuge', 'Back Squat'), detail: de('Quadrizeps / Gesäss', 'Quadriceps / glutes'), muscles: ['quadriceps', 'hamstringsGlutes', 'core'], primary: ['quadriceps'], equipment: 'barbell', movement: ['bend'] },
  { id: 'ex_leg_press', names: de('Beinpresse', 'Leg Press'), detail: de('Quadrizeps / Gesäss', 'Quadriceps / glutes'), muscles: ['quadriceps', 'hamstringsGlutes'], primary: ['quadriceps'], equipment: 'machine', movement: ['push'] },
  { id: 'ex_leg_extension', names: de('Beinstrecker Maschine', 'Leg Extension'), detail: de('Quadrizeps', 'Quadriceps'), muscles: ['quadriceps'], primary: ['quadriceps'], equipment: 'machine', movement: ['extend'] },
  { id: 'ex_romanian_deadlift', names: de('Rumänisches Kreuzheben', 'Romanian Deadlift'), detail: de('Beinbeuger / Gesäss', 'Hamstrings / glutes'), muscles: ['hamstringsGlutes', 'back'], primary: ['hamstringsGlutes'], equipment: 'barbell', movement: ['raise'] },
  { id: 'ex_hip_thrust', names: de('Hip Thrust', 'Hip Thrust'), detail: de('Gesäss', 'Glutes'), muscles: ['hamstringsGlutes'], primary: ['hamstringsGlutes'], equipment: 'barbell', movement: ['extend'] },
  { id: 'ex_leg_curl', names: de('Beinbeuger Maschine', 'Leg Curl'), detail: de('Beinbeuger', 'Hamstrings'), muscles: ['hamstringsGlutes'], primary: ['hamstringsGlutes'], equipment: 'machine', movement: ['bend'] },
  { id: 'ex_hip_abduction_machine', names: de('Hüftabduktion Maschine', 'Hip Abduction Machine'), detail: de('Gluteus medius', 'Gluteus medius'), muscles: ['hamstringsGlutes'], primary: ['hamstringsGlutes'], equipment: 'machine', movement: ['push'] },
  { id: 'ex_calf_raise', names: de('Wadenheben', 'Calf Raise'), detail: de('Waden', 'Calves'), muscles: ['calves'], primary: ['calves'], equipment: 'machine', movement: ['raise'] },
  { id: 'ex_seated_calf_raise', names: de('Wadenheben sitzend', 'Seated Calf Raise'), detail: de('Soleus', 'Soleus'), muscles: ['calves'], primary: ['calves'], equipment: 'machine', movement: ['raise'] },

  // Block 7D (D171): the squat on the machine, the bodyweight squat and the single-leg work.
  { id: 'ex_hack_squat', names: de('Hackenschmidt-Kniebeuge', 'Hack Squat'), detail: de('Quadrizeps', 'Quadriceps'), muscles: ['quadriceps', 'hamstringsGlutes'], primary: ['quadriceps'], equipment: 'machine', movement: ['bend'] },
  { id: 'ex_smith_machine_squat', names: de('Kniebeuge Smith Machine', 'Smith Machine Squat'), detail: de('Quadrizeps / Gesäss', 'Quadriceps / glutes'), muscles: ['quadriceps', 'hamstringsGlutes'], primary: ['quadriceps'], equipment: 'smith', movement: ['bend'] },
  { id: 'ex_bodyweight_squat', names: de('Kniebeuge Eigengewicht', 'Bodyweight Squat'), detail: de('Quadrizeps / Gesäss', 'Quadriceps / glutes'), muscles: ['quadriceps', 'hamstringsGlutes'], primary: ['quadriceps'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['bend'] },
  { id: 'ex_front_squat', names: de('Frontkniebeuge', 'Front Squat'), detail: de('Quadrizeps', 'Quadriceps'), muscles: ['quadriceps', 'hamstringsGlutes', 'core'], primary: ['quadriceps'], equipment: 'barbell', movement: ['bend'] },
  { id: 'ex_goblet_squat', names: de('Goblet Squat', 'Goblet Squat'), detail: de('Quadrizeps / Gesäss', 'Quadriceps / glutes'), muscles: ['quadriceps', 'hamstringsGlutes', 'core'], primary: ['quadriceps'], equipment: 'dumbbell', movement: ['bend'] },
  { id: 'ex_bulgarian_split_squat', names: de('Bulgarian Split Squat', 'Bulgarian Split Squat'), detail: de('Quadrizeps / Gesäss', 'Quadriceps / glutes'), muscles: ['quadriceps', 'hamstringsGlutes'], primary: ['quadriceps'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['bend'] },
  { id: 'ex_lunge', names: de('Ausfallschritte', 'Lunge'), detail: de('Quadrizeps / Gesäss', 'Quadriceps / glutes'), muscles: ['quadriceps', 'hamstringsGlutes'], primary: ['quadriceps'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['bend'] },
  { id: 'ex_step_up', names: de('Step-ups', 'Step-Up'), detail: de('Quadrizeps / Gesäss', 'Quadriceps / glutes'), muscles: ['quadriceps', 'hamstringsGlutes'], primary: ['quadriceps'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['bend'] },
  // Block 7D (D171): the glute machines and cables, the hip hinge and the seated leg curl.
  { id: 'ex_hip_thrust_machine', names: de('Hip Thrust Maschine', 'Hip Thrust Machine'), detail: de('Gesäss', 'Glutes'), muscles: ['hamstringsGlutes'], primary: ['hamstringsGlutes'], equipment: 'machine', movement: ['extend'] },
  { id: 'ex_seated_leg_curl', names: de('Beinbeuger sitzend', 'Seated Leg Curl'), detail: de('Beinbeuger', 'Hamstrings'), muscles: ['hamstringsGlutes'], primary: ['hamstringsGlutes'], equipment: 'machine', movement: ['bend'] },
  { id: 'ex_cable_glute_kickback', names: de('Gesäss-Kickbacks Kabel', 'Cable Glute Kickback'), detail: de('Gesäss', 'Glutes'), muscles: ['hamstringsGlutes'], primary: ['hamstringsGlutes'], equipment: 'cable', movement: ['extend'] },
  { id: 'ex_cable_pull_through', names: de('Pull-Through Kabel', 'Cable Pull-Through'), detail: de('Gesäss / Beinbeuger', 'Glutes / hamstrings'), muscles: ['hamstringsGlutes'], primary: ['hamstringsGlutes'], equipment: 'cable', movement: ['extend'] },
  { id: 'ex_glute_bridge', names: de('Glute Bridge', 'Glute Bridge'), detail: de('Gesäss', 'Glutes'), muscles: ['hamstringsGlutes'], primary: ['hamstringsGlutes'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['extend'] },
  { id: 'ex_nordic_hamstring_curl', names: de('Nordic Curls', 'Nordic Hamstring Curl'), detail: de('Beinbeuger', 'Hamstrings'), muscles: ['hamstringsGlutes'], primary: ['hamstringsGlutes'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['bend'] },
  { id: 'ex_dumbbell_romanian_deadlift', names: de('Rumänisches Kreuzheben Kurzhantel', 'Dumbbell Romanian Deadlift'), detail: de('Beinbeuger / Gesäss', 'Hamstrings / glutes'), muscles: ['hamstringsGlutes', 'back'], primary: ['hamstringsGlutes'], equipment: 'dumbbell', movement: ['raise'] },
  { id: 'ex_good_morning', names: de('Good Morning', 'Good Morning'), detail: de('Beinbeuger / unterer Rücken', 'Hamstrings / lower back'), muscles: ['hamstringsGlutes', 'back'], primary: ['hamstringsGlutes'], equipment: 'barbell', movement: ['extend'] },
  { id: 'ex_kettlebell_swing', names: de('Kettlebell Swing', 'Kettlebell Swing'), detail: de('Gesäss / Beinbeuger', 'Glutes / hamstrings'), muscles: ['hamstringsGlutes', 'back'], primary: ['hamstringsGlutes'], equipment: 'kettlebell', movement: ['extend'] },
  // Block 7D (D171): the calf raise on every station a gym or a home has.
  { id: 'ex_leg_press_calf_raise', names: de('Wadenheben Beinpresse', 'Leg Press Calf Raise'), detail: de('Waden', 'Calves'), muscles: ['calves'], primary: ['calves'], equipment: 'machine', movement: ['raise'] },
  { id: 'ex_donkey_calf_raise', names: de('Donkey-Wadenheben', 'Donkey Calf Raise'), detail: de('Waden', 'Calves'), muscles: ['calves'], primary: ['calves'], equipment: 'machine', movement: ['raise'] },
  { id: 'ex_smith_machine_calf_raise', names: de('Wadenheben Smith Machine', 'Smith Machine Calf Raise'), detail: de('Waden', 'Calves'), muscles: ['calves'], primary: ['calves'], equipment: 'smith', movement: ['raise'] },
  { id: 'ex_bodyweight_calf_raise', names: de('Wadenheben Eigengewicht', 'Bodyweight Calf Raise'), detail: de('Waden', 'Calves'), muscles: ['calves'], primary: ['calves'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['raise'] },
  { id: 'ex_single_leg_calf_raise', names: de('Wadenheben einbeinig', 'Single-Leg Calf Raise'), detail: de('Waden', 'Calves'), muscles: ['calves'], primary: ['calves'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['raise'] },
  { id: 'ex_dumbbell_calf_raise', names: de('Wadenheben Kurzhantel', 'Dumbbell Calf Raise'), detail: de('Waden', 'Calves'), muscles: ['calves'], primary: ['calves'], equipment: 'dumbbell', movement: ['raise'] },
  { id: 'ex_seated_dumbbell_calf_raise', names: de('Wadenheben sitzend Kurzhantel', 'Seated Dumbbell Calf Raise'), detail: de('Soleus', 'Soleus'), muscles: ['calves'], primary: ['calves'], equipment: 'dumbbell', movement: ['raise'] },
  { id: 'ex_barbell_calf_raise', names: de('Wadenheben Langhantel', 'Barbell Calf Raise'), detail: de('Waden', 'Calves'), muscles: ['calves'], primary: ['calves'], equipment: 'barbell', movement: ['raise'] },

  /* ── Core ──────────────────────────────────────────────────────────── */
  { id: 'ex_plank', names: de('Plank', 'Plank'), detail: de('Rumpf', 'Core'), muscles: ['core'], primary: ['core'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['hold'] },
  { id: 'ex_cable_crunch', names: de('Cable Crunch', 'Cable Crunch'), detail: de('gerade Bauchmuskulatur', 'Rectus abdominis'), muscles: ['core'], primary: ['core'], equipment: 'cable', movement: ['bend'] },
  { id: 'ex_hanging_leg_raise', names: de('Hanging Leg Raises', 'Hanging Leg Raise'), detail: de('unterer Bauch / Hüftbeuger', 'Lower abs / hip flexors'), muscles: ['core', 'forearms'], primary: ['core'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['raise'] },

  // Block 7D (D171): crunches and rotation on the machine and the cable, and the floor work.
  { id: 'ex_ab_crunch_machine', names: de('Bauchmaschine', 'Ab Crunch Machine'), detail: de('gerade Bauchmuskulatur', 'Rectus abdominis'), muscles: ['core'], primary: ['core'], equipment: 'machine', movement: ['bend'] },
  { id: 'ex_rotary_torso_machine', names: de('Rumpfrotation Maschine', 'Rotary Torso Machine'), detail: de('schräge Bauchmuskulatur', 'Obliques'), muscles: ['core'], primary: ['core'], equipment: 'machine', movement: ['rotate'] },
  { id: 'ex_cable_woodchop', names: de('Woodchop Kabel', 'Cable Woodchop'), detail: de('schräge Bauchmuskulatur', 'Obliques'), muscles: ['core'], primary: ['core'], equipment: 'cable', movement: ['rotate'] },
  { id: 'ex_pallof_press', names: de('Pallof Press', 'Pallof Press'), detail: de('Rumpfstabilität', 'Core stability'), muscles: ['core'], primary: ['core'], equipment: 'cable', movement: ['hold', 'push'] },
  { id: 'ex_crunch', names: de('Crunches', 'Crunch'), detail: de('gerade Bauchmuskulatur', 'Rectus abdominis'), muscles: ['core'], primary: ['core'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['bend'] },
  { id: 'ex_reverse_crunch', names: de('Reverse Crunches', 'Reverse Crunch'), detail: de('unterer Bauch', 'Lower abs'), muscles: ['core'], primary: ['core'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['bend'] },
  { id: 'ex_bicycle_crunch', names: de('Fahrrad-Crunches', 'Bicycle Crunch'), detail: de('schräge Bauchmuskulatur', 'Obliques'), muscles: ['core'], primary: ['core'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['rotate', 'bend'] },
  { id: 'ex_sit_up', names: de('Sit-ups', 'Sit-Up'), detail: de('Bauch / Hüftbeuger', 'Abs / hip flexors'), muscles: ['core'], primary: ['core'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['bend'] },
  { id: 'ex_lying_leg_raise', names: de('Beinheben liegend', 'Lying Leg Raise'), detail: de('unterer Bauch / Hüftbeuger', 'Lower abs / hip flexors'), muscles: ['core'], primary: ['core'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['raise'] },
  { id: 'ex_russian_twist', names: de('Russian Twist', 'Russian Twist'), detail: de('schräge Bauchmuskulatur', 'Obliques'), muscles: ['core'], primary: ['core'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['rotate'] },
  { id: 'ex_ab_wheel_rollout', names: de('Bauchroller', 'Ab Wheel Rollout'), detail: de('gerade Bauchmuskulatur', 'Rectus abdominis'), muscles: ['core'], primary: ['core'], loadType: 'bodyweight', equipment: 'bodyweight', movement: ['hold'] },
  { id: 'ex_dumbbell_side_bend', names: de('Seitbeugen Kurzhantel', 'Dumbbell Side Bend'), detail: de('schräge Bauchmuskulatur', 'Obliques'), muscles: ['core'], primary: ['core'], equipment: 'dumbbell', movement: ['bend'] },

  /* ── Forearms ──────────────────────────────────────────────────────── */
  { id: 'ex_wrist_curl', names: de('Unterarm-Curls Kurzhantel', 'Wrist Curl'), detail: de('Unterarmbeuger', 'Forearm flexors'), muscles: ['forearms'], primary: ['forearms'], equipment: 'dumbbell', movement: ['bend'] },
  { id: 'ex_farmers_carry', names: de("Farmer's Walk", "Farmer's Carry"), detail: de('Griffkraft', 'Grip'), muscles: ['forearms', 'core'], primary: ['forearms'], equipment: 'dumbbell', movement: ['carry'] },
  // Block 7D (D171): wrist curls and reverse curls by equipment, and the wrist roller.
  { id: 'ex_cable_wrist_curl', names: de('Unterarm-Curls Kabel', 'Cable Wrist Curl'), detail: de('Unterarmbeuger', 'Forearm flexors'), muscles: ['forearms'], primary: ['forearms'], equipment: 'cable', movement: ['bend'] },
  { id: 'ex_cable_reverse_curl', names: de('Reverse Curls Kabel', 'Cable Reverse Curl'), detail: de('Brachioradialis', 'Brachioradialis'), muscles: ['forearms', 'biceps'], primary: ['forearms'], equipment: 'cable', movement: ['bend'] },
  { id: 'ex_dumbbell_reverse_wrist_curl', names: de('Unterarm-Curls Obergriff Kurzhantel', 'Dumbbell Reverse Wrist Curl'), detail: de('Unterarmstrecker', 'Forearm extensors'), muscles: ['forearms'], primary: ['forearms'], equipment: 'dumbbell', movement: ['extend'] },
  { id: 'ex_barbell_wrist_curl', names: de('Unterarm-Curls Langhantel', 'Barbell Wrist Curl'), detail: de('Unterarmbeuger', 'Forearm flexors'), muscles: ['forearms'], primary: ['forearms'], equipment: 'barbell', movement: ['bend'] },
  { id: 'ex_barbell_reverse_wrist_curl', names: de('Unterarm-Curls Obergriff Langhantel', 'Barbell Reverse Wrist Curl'), detail: de('Unterarmstrecker', 'Forearm extensors'), muscles: ['forearms'], primary: ['forearms'], equipment: 'barbell', movement: ['extend'] },
  { id: 'ex_barbell_reverse_curl', names: de('Reverse Curls Langhantel', 'Barbell Reverse Curl'), detail: de('Brachioradialis', 'Brachioradialis'), muscles: ['forearms', 'biceps'], primary: ['forearms'], equipment: 'barbell', movement: ['bend'] },
  { id: 'ex_wrist_roller', names: de('Unterarmroller', 'Wrist Roller'), detail: de('Unterarmbeuger und -strecker', 'Forearm flexors and extensors'), muscles: ['forearms'], primary: ['forearms'], equipment: 'wristRoller', movement: ['raise'] },
  { id: 'ex_ez_bar_reverse_curl', names: de('Reverse Curls SZ', 'EZ-Bar Reverse Curl'), detail: de('Brachioradialis', 'Brachioradialis'), muscles: ['forearms', 'biceps'], primary: ['forearms'], equipment: 'ezBar', movement: ['bend'] },

];

const BY_ID = new Map(EXERCISE_CATALOGUE.map((entry) => [entry.id, entry]));

/** The catalogue entry for a built-in id, or `undefined` for a custom one. */
export function catalogueEntry(id: string): CatalogueExercise | undefined {
  return BY_ID.get(id);
}

/** The entries a user may add to a plan or a session today. */
export function offeredCatalogue(): CatalogueExercise[] {
  return EXERCISE_CATALOGUE.filter((entry) => !entry.deprecated);
}

/**
 * The name to show for an exercise id.
 *
 * A built-in reads its localised catalogue name; anything else — a custom
 * exercise, or an id the catalogue no longer knows — reads the fallback the
 * caller has, which is the stored record's name or a snapshot of it.
 */
export function exerciseDisplayName(id: string, fallback: string, language: Language): string {
  return BY_ID.get(id)?.names[language] ?? fallback;
}

/** The anatomical label for a built-in, or `null` for a custom exercise. */
export function exerciseDetail(id: string, language: Language): string | null {
  return BY_ID.get(id)?.detail[language] ?? null;
}

/**
 * The catalogue as records, for seeding the store on first use.
 *
 * The record's `name` is the English catalogue name: it is the id anchor and
 * the fallback, never what the screen shows for a built-in. The 29 entries
 * iteration 2 seeded had exactly this name, so a device that already holds
 * them and one seeded today hold the same bytes.
 */
export function catalogueRecords(now: string): ExerciseRecord[] {
  return EXERCISE_CATALOGUE.map((entry) => ({
    id: entry.id,
    name: entry.names.en,
    muscles: entry.muscles,
    primaryMuscles: entry.primary,
    builtIn: true,
    loadType: entry.loadType ?? ('external' as const),
    durationSeconds: null,
    attributes: {},
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * Every catalogue entry names primaries that are actually in its `muscles`,
 * and names at least one. Exported so a test can assert it over the whole
 * table rather than over the three entries someone remembered to check.
 */
export function catalogueRolesAreWellFormed(): boolean {
  return EXERCISE_CATALOGUE.every(
    (entry) =>
      entry.primary.length > 0 &&
      entry.primary.every((muscle) => entry.muscles.includes(muscle)),
  );
}

/** Every muscle group at least one built-in exercise covers. */
export function cataloguedMuscles(): MuscleGroup[] {
  const seen = new Set<MuscleGroup>();
  for (const entry of EXERCISE_CATALOGUE) for (const muscle of entry.muscles) seen.add(muscle);
  return [...seen];
}
