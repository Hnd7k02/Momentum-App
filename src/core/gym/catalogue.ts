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
  /** Display metadata only. */
  equipment?: Equipment;
  /**
   * Hidden from new plans and the picker, still resolvable everywhere it is
   * already named. Nothing is deprecated today; the flag exists so a future
   * release has a way to retire an entry that is not deleting it.
   */
  deprecated?: boolean;
}

export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'smith' | 'bodyweight';

const de = (deName: string, enName: string): Record<Language, string> => ({ de: deName, en: enName });

/*
 * The muscle roles of the 29 iteration-2 entries are unchanged; the German
 * names, the detail labels and the equipment are new presentation
 * metadata. `catalogue.test.ts` pins the roles, so a later edit that moves
 * one is a test failure rather than a quiet rescoring of new sets.
 */
export const EXERCISE_CATALOGUE: CatalogueExercise[] = [
  /* ── Chest ─────────────────────────────────────────────────────────── */
  { id: 'ex_bench_press', names: de('Bankdrücken', 'Bench Press'), detail: de('Brust', 'Chest'), muscles: ['chest', 'triceps', 'shoulders'], primary: ['chest'], equipment: 'barbell' },
  { id: 'ex_incline_press', names: de('Schrägbank Kurzhantel', 'Incline Dumbbell Press'), detail: de('obere Brust', 'Upper chest'), muscles: ['chest', 'shoulders', 'triceps'], primary: ['chest'], equipment: 'dumbbell' },
  { id: 'ex_incline_press_machine', names: de('Schrägbank Maschine', 'Incline Press Machine'), detail: de('obere Brust', 'Upper chest'), muscles: ['chest', 'shoulders', 'triceps'], primary: ['chest'], equipment: 'machine' },
  { id: 'ex_chest_fly', names: de('Cable Fly straight', 'Cable Fly'), detail: de('Brust', 'Chest'), muscles: ['chest'], primary: ['chest'], equipment: 'cable' },
  { id: 'ex_cable_fly_low_to_high', names: de('Cable Fly bottom-up', 'Low-to-High Cable Fly'), detail: de('obere Brust', 'Upper chest'), muscles: ['chest'], primary: ['chest'], equipment: 'cable' },
  { id: 'ex_push_up', names: de('Liegestütze', 'Push-Up'), detail: de('Brust', 'Chest'), muscles: ['chest', 'triceps', 'core'], primary: ['chest'], loadType: 'bodyweight', equipment: 'bodyweight' },

  /* ── Back ──────────────────────────────────────────────────────────── */
  { id: 'ex_lat_pulldown', names: de('Latzug', 'Lat Pulldown'), detail: de('Latissimus', 'Latissimus'), muscles: ['back', 'biceps'], primary: ['back'], equipment: 'cable' },
  { id: 'ex_lat_pulldown_wide', names: de('Latzug weit', 'Wide-Grip Lat Pulldown'), detail: de('Latissimus', 'Latissimus'), muscles: ['back', 'biceps'], primary: ['back'], equipment: 'cable' },
  { id: 'ex_lat_pulldown_close', names: de('Latzug eng von oben', 'Close-Grip Lat Pulldown'), detail: de('Latissimus', 'Latissimus'), muscles: ['back', 'biceps'], primary: ['back'], equipment: 'cable' },
  { id: 'ex_lat_pulldown_neutral', names: de('Latzug neutraler Griff', 'Neutral-Grip Lat Pulldown'), detail: de('Latissimus', 'Latissimus'), muscles: ['back', 'biceps'], primary: ['back'], equipment: 'cable' },
  { id: 'ex_straight_arm_pulldown', names: de('Straight-Arm Pullover Kabel', 'Straight-Arm Cable Pullover'), detail: de('Latissimus', 'Latissimus'), muscles: ['back'], primary: ['back'], equipment: 'cable' },
  { id: 'ex_barbell_row', names: de('Langhantelrudern', 'Barbell Row'), detail: de('oberer Rücken', 'Upper back'), muscles: ['back', 'biceps', 'forearms'], primary: ['back'], equipment: 'barbell' },
  { id: 'ex_smith_row', names: de('Rudern Smith Machine', 'Smith Machine Row'), detail: de('oberer Rücken', 'Upper back'), muscles: ['back', 'biceps', 'forearms'], primary: ['back'], equipment: 'smith' },
  { id: 'ex_close_cable_row', names: de('Enges Kabelrudern', 'Close-Grip Cable Row'), detail: de('oberer Rücken', 'Upper back'), muscles: ['back', 'biceps', 'forearms'], primary: ['back'], equipment: 'cable' },
  // Both halves of a deadlift are the point of it, so both are primary and
  // share the 70 % between them. Nothing else about the rule changes.
  { id: 'ex_deadlift', names: de('Kreuzheben', 'Deadlift'), detail: de('Rücken / Beinbeuger / Gesäss', 'Back / hamstrings / glutes'), muscles: ['back', 'hamstringsGlutes', 'forearms'], primary: ['back', 'hamstringsGlutes'], equipment: 'barbell' },
  { id: 'ex_pull_up', names: de('Klimmzüge', 'Pull-Up'), detail: de('Latissimus', 'Latissimus'), muscles: ['back', 'biceps'], primary: ['back'], loadType: 'bodyweight', equipment: 'bodyweight' },
  { id: 'ex_assisted_pull_up', names: de('Klimmzüge assistiert', 'Assisted Pull-Up'), detail: de('Latissimus', 'Latissimus'), muscles: ['back', 'biceps'], primary: ['back'], loadType: 'assisted', equipment: 'machine' },

  /* ── Shoulders ─────────────────────────────────────────────────────── */
  { id: 'ex_overhead_press', names: de('Overhead Press', 'Overhead Press'), detail: de('vordere Schulter', 'Front delts'), muscles: ['shoulders', 'triceps', 'core'], primary: ['shoulders'], equipment: 'barbell' },
  { id: 'ex_lateral_raise', names: de('Seitheben', 'Lateral Raise'), detail: de('seitliche Schulter', 'Side delts'), muscles: ['shoulders'], primary: ['shoulders'], equipment: 'dumbbell' },
  // WP3 (B12): the front raise was missing. Shoulders only, like the
  // lateral raise: the front delt is the one head it isolates.
  { id: 'ex_front_raise', names: de('Frontheben', 'Front Raise'), detail: de('vordere Schulter', 'Front delts'), muscles: ['shoulders'], primary: ['shoulders'], equipment: 'dumbbell' },
  { id: 'ex_cable_lateral_raise', names: de('Seitheben Kabel', 'Cable Lateral Raise'), detail: de('seitliche Schulter', 'Side delts'), muscles: ['shoulders'], primary: ['shoulders'], equipment: 'cable' },
  { id: 'ex_lean_away_lateral_raise', names: de('Seitheben Kurzhantel lean-away', 'Lean-Away Lateral Raise'), detail: de('seitliche Schulter', 'Side delts'), muscles: ['shoulders'], primary: ['shoulders'], equipment: 'dumbbell' },
  { id: 'ex_reverse_fly_machine', names: de('Reverse Flys Maschine', 'Reverse Fly Machine'), detail: de('hintere Schulter', 'Rear delts'), muscles: ['shoulders', 'back'], primary: ['shoulders'], equipment: 'machine' },
  { id: 'ex_face_pull', names: de('Face Pulls', 'Face Pulls'), detail: de('hintere Schulter / Trapez', 'Rear delts / traps'), muscles: ['shoulders', 'back'], primary: ['shoulders'], equipment: 'cable' },

  /* ── Biceps ────────────────────────────────────────────────────────── */
  { id: 'ex_biceps_curl', names: de('Bizeps-Curls', 'Biceps Curl'), detail: de('Bizeps', 'Biceps'), muscles: ['biceps'], primary: ['biceps'], equipment: 'dumbbell' },
  { id: 'ex_supinating_curl', names: de('Eindreh-Curls', 'Supinating Curl'), detail: de('Bizeps', 'Biceps'), muscles: ['biceps'], primary: ['biceps'], equipment: 'dumbbell' },
  { id: 'ex_incline_curl', names: de('Schrägbank-Curls', 'Incline Curl'), detail: de('Bizeps, langer Kopf', 'Biceps, long head'), muscles: ['biceps'], primary: ['biceps'], equipment: 'dumbbell' },
  { id: 'ex_preacher_curl', names: de('Preacher-Curls', 'Preacher Curl'), detail: de('Bizeps, kurzer Kopf', 'Biceps, short head'), muscles: ['biceps'], primary: ['biceps'], equipment: 'machine' },
  { id: 'ex_hammer_curl', names: de('Hammer Curls', 'Hammer Curl'), detail: de('Brachialis / Brachioradialis', 'Brachialis / brachioradialis'), muscles: ['biceps', 'forearms'], primary: ['biceps'], equipment: 'dumbbell' },

  /* ── Triceps ───────────────────────────────────────────────────────── */
  { id: 'ex_triceps_pushdown', names: de('Pushdown Seil', 'Triceps Pushdown'), detail: de('Trizeps', 'Triceps'), muscles: ['triceps'], primary: ['triceps'], equipment: 'cable' },
  { id: 'ex_overhead_cable_extension', names: de('Trizeps Überkopf Kabel', 'Overhead Cable Extension'), detail: de('Trizeps, langer Kopf', 'Triceps, long head'), muscles: ['triceps'], primary: ['triceps'], equipment: 'cable' },
  { id: 'ex_skullcrusher', names: de('Skullcrusher Langhantel', 'Skullcrusher'), detail: de('Trizeps', 'Triceps'), muscles: ['triceps'], primary: ['triceps'], equipment: 'barbell' },
  { id: 'ex_cable_skullcrusher', names: de('Trizeps-Crusher Kabel', 'Cable Skullcrusher'), detail: de('Trizeps', 'Triceps'), muscles: ['triceps'], primary: ['triceps'], equipment: 'cable' },
  // Dips keep the roles they were logged under since iteration 2 (decision
  // 2): triceps primary, chest and shoulders secondary. The detail label
  // says what the movement is for; it is not the scoring role.
  { id: 'ex_dip', names: de('Dips', 'Dip'), detail: de('Brust unten / Trizeps', 'Lower chest / triceps'), muscles: ['triceps', 'chest', 'shoulders'], primary: ['triceps'], loadType: 'bodyweight', equipment: 'bodyweight' },
  { id: 'ex_assisted_dip', names: de('Dips assistiert', 'Assisted Dip'), detail: de('Brust unten / Trizeps', 'Lower chest / triceps'), muscles: ['triceps', 'chest', 'shoulders'], primary: ['triceps'], loadType: 'assisted', equipment: 'machine' },

  /* ── Legs ──────────────────────────────────────────────────────────── */
  { id: 'ex_squat', names: de('Kniebeuge', 'Back Squat'), detail: de('Quadrizeps / Gesäss', 'Quadriceps / glutes'), muscles: ['quadriceps', 'hamstringsGlutes', 'core'], primary: ['quadriceps'], equipment: 'barbell' },
  { id: 'ex_leg_press', names: de('Beinpresse', 'Leg Press'), detail: de('Quadrizeps / Gesäss', 'Quadriceps / glutes'), muscles: ['quadriceps', 'hamstringsGlutes'], primary: ['quadriceps'], equipment: 'machine' },
  { id: 'ex_leg_extension', names: de('Beinstrecker Maschine', 'Leg Extension'), detail: de('Quadrizeps', 'Quadriceps'), muscles: ['quadriceps'], primary: ['quadriceps'], equipment: 'machine' },
  { id: 'ex_romanian_deadlift', names: de('Rumänisches Kreuzheben', 'Romanian Deadlift'), detail: de('Beinbeuger / Gesäss', 'Hamstrings / glutes'), muscles: ['hamstringsGlutes', 'back'], primary: ['hamstringsGlutes'], equipment: 'barbell' },
  { id: 'ex_hip_thrust', names: de('Hip Thrust', 'Hip Thrust'), detail: de('Gesäss', 'Glutes'), muscles: ['hamstringsGlutes'], primary: ['hamstringsGlutes'], equipment: 'barbell' },
  { id: 'ex_leg_curl', names: de('Beinbeuger Maschine', 'Leg Curl'), detail: de('Beinbeuger', 'Hamstrings'), muscles: ['hamstringsGlutes'], primary: ['hamstringsGlutes'], equipment: 'machine' },
  { id: 'ex_hip_abduction_machine', names: de('Hüftabduktion Maschine', 'Hip Abduction Machine'), detail: de('Gluteus medius', 'Gluteus medius'), muscles: ['hamstringsGlutes'], primary: ['hamstringsGlutes'], equipment: 'machine' },
  { id: 'ex_calf_raise', names: de('Wadenheben', 'Calf Raise'), detail: de('Waden', 'Calves'), muscles: ['calves'], primary: ['calves'], equipment: 'machine' },
  { id: 'ex_seated_calf_raise', names: de('Wadenheben sitzend', 'Seated Calf Raise'), detail: de('Soleus', 'Soleus'), muscles: ['calves'], primary: ['calves'], equipment: 'machine' },

  /* ── Core ──────────────────────────────────────────────────────────── */
  { id: 'ex_plank', names: de('Plank', 'Plank'), detail: de('Rumpf', 'Core'), muscles: ['core'], primary: ['core'], loadType: 'bodyweight', equipment: 'bodyweight' },
  { id: 'ex_cable_crunch', names: de('Cable Crunch', 'Cable Crunch'), detail: de('gerade Bauchmuskulatur', 'Rectus abdominis'), muscles: ['core'], primary: ['core'], equipment: 'cable' },
  { id: 'ex_hanging_leg_raise', names: de('Hanging Leg Raises', 'Hanging Leg Raise'), detail: de('unterer Bauch / Hüftbeuger', 'Lower abs / hip flexors'), muscles: ['core', 'forearms'], primary: ['core'], loadType: 'bodyweight', equipment: 'bodyweight' },

  /* ── Forearms ──────────────────────────────────────────────────────── */
  { id: 'ex_wrist_curl', names: de('Unterarm-Curls Kurzhantel', 'Wrist Curl'), detail: de('Unterarmbeuger', 'Forearm flexors'), muscles: ['forearms'], primary: ['forearms'], equipment: 'dumbbell' },
  { id: 'ex_farmers_carry', names: de("Farmer's Walk", "Farmer's Carry"), detail: de('Griffkraft', 'Grip'), muscles: ['forearms', 'core'], primary: ['forearms'], equipment: 'dumbbell' },
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
