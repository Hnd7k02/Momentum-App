import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS, type ExerciseLoadType, type MuscleGroup } from '../model';
import { EQUIPMENT_WORDS, MOVEMENT_WORDS } from './search';
import {
  EXERCISE_CATALOGUE,
  catalogueEntry,
  catalogueRecords,
  catalogueRolesAreWellFormed,
  exerciseDetail,
  exerciseDisplayName,
  offeredCatalogue,
} from './catalogue';

/**
 * The catalogue after WP3 Stage 1: 49 entries — the 48 of WP2-1 plus the
 * front raise (B12) — and the 29 that iteration 2 shipped are still exactly
 * what they were where it matters. Block 7D adds 84 (D171), pinned in a
 * fourth table, and the three tables before it stand as they were.
 *
 * What a built-in *counts for* — its groups, its roles, its load type — and
 * the English name its seeded record carries are pinned here verbatim. A
 * change to any of them would reweight every new set logged under that id,
 * or write a different record on a fresh device than on an old one, and
 * neither is a thing this file lets happen by accident.
 */

type Pinned = [id: string, en: string, muscles: MuscleGroup[], primary: MuscleGroup[], loadType?: ExerciseLoadType];

/** The 29 iteration-2 entries, as they were before WP2-1 touched the file. */
const ITERATION_2: Pinned[] = [
  ['ex_bench_press', 'Bench Press', ['chest', 'triceps', 'shoulders'], ['chest']],
  ['ex_incline_press', 'Incline Dumbbell Press', ['chest', 'shoulders', 'triceps'], ['chest']],
  ['ex_chest_fly', 'Cable Fly', ['chest'], ['chest']],
  ['ex_push_up', 'Push-Up', ['chest', 'triceps', 'core'], ['chest'], 'bodyweight'],
  ['ex_lat_pulldown', 'Lat Pulldown', ['back', 'biceps'], ['back']],
  ['ex_barbell_row', 'Barbell Row', ['back', 'biceps', 'forearms'], ['back']],
  ['ex_deadlift', 'Deadlift', ['back', 'hamstringsGlutes', 'forearms'], ['back', 'hamstringsGlutes']],
  ['ex_pull_up', 'Pull-Up', ['back', 'biceps'], ['back'], 'bodyweight'],
  ['ex_assisted_pull_up', 'Assisted Pull-Up', ['back', 'biceps'], ['back'], 'assisted'],
  ['ex_overhead_press', 'Overhead Press', ['shoulders', 'triceps', 'core'], ['shoulders']],
  ['ex_lateral_raise', 'Lateral Raise', ['shoulders'], ['shoulders']],
  ['ex_biceps_curl', 'Biceps Curl', ['biceps'], ['biceps']],
  ['ex_hammer_curl', 'Hammer Curl', ['biceps', 'forearms'], ['biceps']],
  ['ex_triceps_pushdown', 'Triceps Pushdown', ['triceps'], ['triceps']],
  ['ex_skullcrusher', 'Skullcrusher', ['triceps'], ['triceps']],
  ['ex_dip', 'Dip', ['triceps', 'chest', 'shoulders'], ['triceps'], 'bodyweight'],
  ['ex_assisted_dip', 'Assisted Dip', ['triceps', 'chest', 'shoulders'], ['triceps'], 'assisted'],
  ['ex_squat', 'Back Squat', ['quadriceps', 'hamstringsGlutes', 'core'], ['quadriceps']],
  ['ex_leg_press', 'Leg Press', ['quadriceps', 'hamstringsGlutes'], ['quadriceps']],
  ['ex_leg_extension', 'Leg Extension', ['quadriceps'], ['quadriceps']],
  ['ex_romanian_deadlift', 'Romanian Deadlift', ['hamstringsGlutes', 'back'], ['hamstringsGlutes']],
  ['ex_hip_thrust', 'Hip Thrust', ['hamstringsGlutes'], ['hamstringsGlutes']],
  ['ex_leg_curl', 'Leg Curl', ['hamstringsGlutes'], ['hamstringsGlutes']],
  ['ex_calf_raise', 'Calf Raise', ['calves'], ['calves']],
  ['ex_plank', 'Plank', ['core'], ['core'], 'bodyweight'],
  ['ex_cable_crunch', 'Cable Crunch', ['core'], ['core']],
  ['ex_hanging_leg_raise', 'Hanging Leg Raise', ['core', 'forearms'], ['core'], 'bodyweight'],
  ['ex_wrist_curl', 'Wrist Curl', ['forearms'], ['forearms']],
  ['ex_farmers_carry', "Farmer's Carry", ['forearms', 'core'], ['forearms']],
];

/** The 19 ids WP2-1 adds, with the approved mapping. */
const WP2_1: Pinned[] = [
  ['ex_incline_press_machine', 'Incline Press Machine', ['chest', 'shoulders', 'triceps'], ['chest']],
  ['ex_cable_fly_low_to_high', 'Low-to-High Cable Fly', ['chest'], ['chest']],
  ['ex_lat_pulldown_wide', 'Wide-Grip Lat Pulldown', ['back', 'biceps'], ['back']],
  ['ex_lat_pulldown_close', 'Close-Grip Lat Pulldown', ['back', 'biceps'], ['back']],
  ['ex_lat_pulldown_neutral', 'Neutral-Grip Lat Pulldown', ['back', 'biceps'], ['back']],
  ['ex_straight_arm_pulldown', 'Straight-Arm Cable Pullover', ['back'], ['back']],
  ['ex_smith_row', 'Smith Machine Row', ['back', 'biceps', 'forearms'], ['back']],
  ['ex_close_cable_row', 'Close-Grip Cable Row', ['back', 'biceps', 'forearms'], ['back']],
  ['ex_cable_lateral_raise', 'Cable Lateral Raise', ['shoulders'], ['shoulders']],
  ['ex_lean_away_lateral_raise', 'Lean-Away Lateral Raise', ['shoulders'], ['shoulders']],
  ['ex_reverse_fly_machine', 'Reverse Fly Machine', ['shoulders', 'back'], ['shoulders']],
  ['ex_face_pull', 'Face Pulls', ['shoulders', 'back'], ['shoulders']],
  ['ex_supinating_curl', 'Supinating Curl', ['biceps'], ['biceps']],
  ['ex_incline_curl', 'Incline Curl', ['biceps'], ['biceps']],
  ['ex_preacher_curl', 'Preacher Curl', ['biceps'], ['biceps']],
  ['ex_overhead_cable_extension', 'Overhead Cable Extension', ['triceps'], ['triceps']],
  ['ex_cable_skullcrusher', 'Cable Skullcrusher', ['triceps'], ['triceps']],
  ['ex_hip_abduction_machine', 'Hip Abduction Machine', ['hamstringsGlutes'], ['hamstringsGlutes']],
  ['ex_seated_calf_raise', 'Seated Calf Raise', ['calves'], ['calves']],
];

/** Added in WP3 Stage 1 (B12). */
const WP3: Pinned[] = [
  ['ex_front_raise', 'Front Raise', ['shoulders'], ['shoulders']],
];

/**
 * The 84 ids block 7D adds (D171), with the mapping the owner sees on the
 * STOP page (`docs/design/wp3/stage7d-katalog.md`). Until he has accepted
 * the list an id may still change; from the release on it is given for good.
 */
const BLOCK_7D: Pinned[] = [
  ['ex_chest_press_machine', 'Chest Press Machine', ['chest', 'triceps', 'shoulders'], ['chest']],
  ['ex_pec_deck', 'Pec Deck', ['chest'], ['chest']],
  ['ex_cable_chest_press', 'Cable Chest Press', ['chest', 'triceps', 'shoulders'], ['chest']],
  ['ex_high_to_low_cable_fly', 'High-to-Low Cable Fly', ['chest'], ['chest']],
  ['ex_dumbbell_bench_press', 'Dumbbell Bench Press', ['chest', 'triceps', 'shoulders'], ['chest']],
  ['ex_dumbbell_fly', 'Dumbbell Fly', ['chest'], ['chest']],
  ['ex_incline_bench_press', 'Incline Bench Press', ['chest', 'shoulders', 'triceps'], ['chest']],
  ['ex_decline_bench_press', 'Decline Bench Press', ['chest', 'triceps', 'shoulders'], ['chest']],
  ['ex_smith_machine_bench_press', 'Smith Machine Bench Press', ['chest', 'triceps', 'shoulders'], ['chest']],
  ['ex_seated_row_machine', 'Seated Row Machine', ['back', 'biceps', 'forearms'], ['back']],
  ['ex_back_extension_machine', 'Back Extension Machine', ['back', 'hamstringsGlutes'], ['back']],
  ['ex_chin_up', 'Chin-Up', ['back', 'biceps'], ['back'], 'bodyweight'],
  ['ex_inverted_row', 'Inverted Row', ['back', 'biceps', 'forearms'], ['back'], 'bodyweight'],
  ['ex_hyperextension', 'Hyperextension', ['back', 'hamstringsGlutes'], ['back'], 'bodyweight'],
  ['ex_one_arm_dumbbell_row', 'One-Arm Dumbbell Row', ['back', 'biceps', 'forearms'], ['back']],
  ['ex_t_bar_row', 'T-Bar Row', ['back', 'biceps', 'forearms'], ['back']],
  ['ex_dumbbell_shrug', 'Dumbbell Shrug', ['back', 'forearms'], ['back']],
  ['ex_barbell_shrug', 'Barbell Shrug', ['back', 'forearms'], ['back']],
  ['ex_shoulder_press_machine', 'Shoulder Press Machine', ['shoulders', 'triceps'], ['shoulders']],
  ['ex_lateral_raise_machine', 'Lateral Raise Machine', ['shoulders'], ['shoulders']],
  ['ex_cable_reverse_fly', 'Cable Reverse Fly', ['shoulders', 'back'], ['shoulders']],
  ['ex_pike_push_up', 'Pike Push-Up', ['shoulders', 'triceps'], ['shoulders'], 'bodyweight'],
  ['ex_dumbbell_shoulder_press', 'Dumbbell Shoulder Press', ['shoulders', 'triceps'], ['shoulders']],
  ['ex_arnold_press', 'Arnold Press', ['shoulders', 'triceps'], ['shoulders']],
  ['ex_dumbbell_reverse_fly', 'Dumbbell Reverse Fly', ['shoulders', 'back'], ['shoulders']],
  ['ex_upright_row', 'Upright Row', ['shoulders', 'back'], ['shoulders']],
  ['ex_cable_curl', 'Cable Curl', ['biceps'], ['biceps']],
  ['ex_rope_hammer_curl', 'Rope Hammer Curl', ['biceps', 'forearms'], ['biceps']],
  ['ex_barbell_curl', 'Barbell Curl', ['biceps'], ['biceps']],
  ['ex_ez_bar_curl', 'EZ-Bar Curl', ['biceps'], ['biceps']],
  ['ex_concentration_curl', 'Concentration Curl', ['biceps'], ['biceps']],
  ['ex_bar_pushdown', 'Bar Pushdown', ['triceps'], ['triceps']],
  ['ex_triceps_extension_machine', 'Triceps Extension Machine', ['triceps'], ['triceps']],
  ['ex_seated_dip_machine', 'Seated Dip Machine', ['triceps', 'chest', 'shoulders'], ['triceps']],
  ['ex_bench_dip', 'Bench Dip', ['triceps', 'shoulders'], ['triceps'], 'bodyweight'],
  ['ex_close_grip_push_up', 'Close-Grip Push-Up', ['triceps', 'chest', 'core'], ['triceps'], 'bodyweight'],
  ['ex_close_grip_bench_press', 'Close-Grip Bench Press', ['triceps', 'chest', 'shoulders'], ['triceps']],
  ['ex_dumbbell_overhead_extension', 'Dumbbell Overhead Extension', ['triceps'], ['triceps']],
  ['ex_triceps_kickback', 'Triceps Kickback', ['triceps'], ['triceps']],
  ['ex_hack_squat', 'Hack Squat', ['quadriceps', 'hamstringsGlutes'], ['quadriceps']],
  ['ex_smith_machine_squat', 'Smith Machine Squat', ['quadriceps', 'hamstringsGlutes'], ['quadriceps']],
  ['ex_bodyweight_squat', 'Bodyweight Squat', ['quadriceps', 'hamstringsGlutes'], ['quadriceps'], 'bodyweight'],
  ['ex_front_squat', 'Front Squat', ['quadriceps', 'hamstringsGlutes', 'core'], ['quadriceps']],
  ['ex_goblet_squat', 'Goblet Squat', ['quadriceps', 'hamstringsGlutes', 'core'], ['quadriceps']],
  ['ex_bulgarian_split_squat', 'Bulgarian Split Squat', ['quadriceps', 'hamstringsGlutes'], ['quadriceps'], 'bodyweight'],
  ['ex_lunge', 'Lunge', ['quadriceps', 'hamstringsGlutes'], ['quadriceps'], 'bodyweight'],
  ['ex_step_up', 'Step-Up', ['quadriceps', 'hamstringsGlutes'], ['quadriceps'], 'bodyweight'],
  ['ex_hip_thrust_machine', 'Hip Thrust Machine', ['hamstringsGlutes'], ['hamstringsGlutes']],
  ['ex_seated_leg_curl', 'Seated Leg Curl', ['hamstringsGlutes'], ['hamstringsGlutes']],
  ['ex_cable_glute_kickback', 'Cable Glute Kickback', ['hamstringsGlutes'], ['hamstringsGlutes']],
  ['ex_cable_pull_through', 'Cable Pull-Through', ['hamstringsGlutes'], ['hamstringsGlutes']],
  ['ex_glute_bridge', 'Glute Bridge', ['hamstringsGlutes'], ['hamstringsGlutes'], 'bodyweight'],
  ['ex_nordic_hamstring_curl', 'Nordic Hamstring Curl', ['hamstringsGlutes'], ['hamstringsGlutes'], 'bodyweight'],
  ['ex_dumbbell_romanian_deadlift', 'Dumbbell Romanian Deadlift', ['hamstringsGlutes', 'back'], ['hamstringsGlutes']],
  ['ex_good_morning', 'Good Morning', ['hamstringsGlutes', 'back'], ['hamstringsGlutes']],
  ['ex_kettlebell_swing', 'Kettlebell Swing', ['hamstringsGlutes', 'back'], ['hamstringsGlutes']],
  ['ex_leg_press_calf_raise', 'Leg Press Calf Raise', ['calves'], ['calves']],
  ['ex_donkey_calf_raise', 'Donkey Calf Raise', ['calves'], ['calves']],
  ['ex_smith_machine_calf_raise', 'Smith Machine Calf Raise', ['calves'], ['calves']],
  ['ex_bodyweight_calf_raise', 'Bodyweight Calf Raise', ['calves'], ['calves'], 'bodyweight'],
  ['ex_single_leg_calf_raise', 'Single-Leg Calf Raise', ['calves'], ['calves'], 'bodyweight'],
  ['ex_dumbbell_calf_raise', 'Dumbbell Calf Raise', ['calves'], ['calves']],
  ['ex_seated_dumbbell_calf_raise', 'Seated Dumbbell Calf Raise', ['calves'], ['calves']],
  ['ex_barbell_calf_raise', 'Barbell Calf Raise', ['calves'], ['calves']],
  ['ex_ab_crunch_machine', 'Ab Crunch Machine', ['core'], ['core']],
  ['ex_rotary_torso_machine', 'Rotary Torso Machine', ['core'], ['core']],
  ['ex_cable_woodchop', 'Cable Woodchop', ['core'], ['core']],
  ['ex_pallof_press', 'Pallof Press', ['core'], ['core']],
  ['ex_crunch', 'Crunch', ['core'], ['core'], 'bodyweight'],
  ['ex_reverse_crunch', 'Reverse Crunch', ['core'], ['core'], 'bodyweight'],
  ['ex_bicycle_crunch', 'Bicycle Crunch', ['core'], ['core'], 'bodyweight'],
  ['ex_sit_up', 'Sit-Up', ['core'], ['core'], 'bodyweight'],
  ['ex_lying_leg_raise', 'Lying Leg Raise', ['core'], ['core'], 'bodyweight'],
  ['ex_russian_twist', 'Russian Twist', ['core'], ['core'], 'bodyweight'],
  ['ex_ab_wheel_rollout', 'Ab Wheel Rollout', ['core'], ['core'], 'bodyweight'],
  ['ex_dumbbell_side_bend', 'Dumbbell Side Bend', ['core'], ['core']],
  ['ex_cable_wrist_curl', 'Cable Wrist Curl', ['forearms'], ['forearms']],
  ['ex_cable_reverse_curl', 'Cable Reverse Curl', ['forearms', 'biceps'], ['forearms']],
  ['ex_dumbbell_reverse_wrist_curl', 'Dumbbell Reverse Wrist Curl', ['forearms'], ['forearms']],
  ['ex_barbell_wrist_curl', 'Barbell Wrist Curl', ['forearms'], ['forearms']],
  ['ex_barbell_reverse_wrist_curl', 'Barbell Reverse Wrist Curl', ['forearms'], ['forearms']],
  ['ex_barbell_reverse_curl', 'Barbell Reverse Curl', ['forearms', 'biceps'], ['forearms']],
  ['ex_wrist_roller', 'Wrist Roller', ['forearms'], ['forearms']],
  ['ex_ez_bar_reverse_curl', 'EZ-Bar Reverse Curl', ['forearms', 'biceps'], ['forearms']],
];

/** The 34 names the brief lists, after the approved corrections. */
const BRIEF_NAMES_DE = [
  'Bankdrücken', 'Schrägbank Kurzhantel', 'Cable Fly bottom-up', 'Seitheben Kabel', 'Trizeps Überkopf Kabel', 'Pushdown Seil',
  'Klimmzüge', 'Latzug weit', 'Rudern Smith Machine', 'Latzug eng von oben', 'Reverse Flys Maschine', 'Schrägbank-Curls', 'Hammer Curls', 'Unterarm-Curls Kurzhantel',
  'Beinpresse', 'Rumänisches Kreuzheben', 'Beinbeuger Maschine', 'Beinstrecker Maschine', 'Wadenheben sitzend', 'Hüftabduktion Maschine',
  'Overhead Press', 'Schrägbank Maschine', 'Cable Fly straight', 'Seitheben Kurzhantel lean-away', 'Trizeps-Crusher Kabel', 'Dips',
  'Enges Kabelrudern', 'Latzug neutraler Griff', 'Straight-Arm Pullover Kabel', 'Face Pulls', 'Eindreh-Curls', 'Preacher-Curls',
  'Cable Crunch', 'Hanging Leg Raises',
];

describe('the catalogue after WP2-1', () => {
  it('has 133 entries with unique ids', () => {
    // 49 until block 7D, which adds 84 (D171).
    expect(EXERCISE_CATALOGUE).toHaveLength(133);
    expect(new Set(EXERCISE_CATALOGUE.map((entry) => entry.id)).size).toBe(133);
    expect(EXERCISE_CATALOGUE).toHaveLength(ITERATION_2.length + WP2_1.length + WP3.length + BLOCK_7D.length);
  });

  it('adds the front raise with the approved mapping (WP3, B12)', () => {
    for (const [id, en, muscles, primary, loadType] of WP3) {
      const entry = catalogueEntry(id);
      expect(entry, id).toBeDefined();
      expect(entry!.names.en, id).toBe(en);
      expect(entry!.muscles, id).toEqual(muscles);
      expect(entry!.primary, id).toEqual(primary);
      expect(entry!.loadType, id).toBe(loadType);
    }
    const front = catalogueEntry('ex_front_raise')!;
    expect(front.names.de).toBe('Frontheben');
    expect(front.detail).toEqual({ de: 'vordere Schulter', en: 'Front delts' });
    expect(front.equipment).toBe('dumbbell');
  });

  it('keeps every iteration-2 entry exactly as it was scored', () => {
    for (const [id, en, muscles, primary, loadType] of ITERATION_2) {
      const entry = catalogueEntry(id);
      expect(entry, id).toBeDefined();
      expect(entry!.names.en, id).toBe(en);
      expect(entry!.muscles, id).toEqual(muscles);
      expect(entry!.primary, id).toEqual(primary);
      expect(entry!.loadType, id).toBe(loadType);
    }
  });

  it('adds the 19 approved ids with the approved mapping', () => {
    for (const [id, en, muscles, primary, loadType] of WP2_1) {
      const entry = catalogueEntry(id);
      expect(entry, id).toBeDefined();
      expect(entry!.names.en, id).toBe(en);
      expect(entry!.muscles, id).toEqual(muscles);
      expect(entry!.primary, id).toEqual(primary);
      expect(entry!.loadType, id).toBe(loadType);
    }
  });

  it('offers every exercise the brief lists, once, under its German name', () => {
    const names = EXERCISE_CATALOGUE.map((entry) => entry.names.de);
    for (const name of BRIEF_NAMES_DE) {
      expect(names.filter((candidate) => candidate === name), name).toHaveLength(1);
    }
    expect(new Set(names).size).toBe(names.length);
  });

  it('splits the combined Klimmzüge / Latzug weit into two ids with different load types', () => {
    expect(catalogueEntry('ex_pull_up')?.loadType).toBe('bodyweight');
    expect(catalogueEntry('ex_lat_pulldown_wide')?.loadType).toBeUndefined();
    expect(catalogueEntry('ex_pull_up')?.names.de).toBe('Klimmzüge');
    expect(catalogueEntry('ex_lat_pulldown_wide')?.names.de).toBe('Latzug weit');
  });

  it('keeps the Dips roles and shows the approved detail label beside them', () => {
    const dips = catalogueEntry('ex_dip')!;
    expect(dips.primary).toEqual(['triceps']);
    expect(dips.muscles).toEqual(['triceps', 'chest', 'shoulders']);
    expect(dips.detail.de).toBe('Brust unten / Trizeps');
  });

  it('names only the ten canonical groups, well-formed roles, and never a new group', () => {
    expect(catalogueRolesAreWellFormed()).toBe(true);
    for (const entry of EXERCISE_CATALOGUE) {
      for (const muscle of entry.muscles) expect(MUSCLE_GROUPS, entry.id).toContain(muscle);
    }
  });

  it('uses Swiss orthography and non-empty labels in both languages', () => {
    for (const entry of EXERCISE_CATALOGUE) {
      for (const language of ['de', 'en'] as const) {
        expect(entry.names[language].trim(), entry.id).not.toBe('');
        expect(entry.detail[language].trim(), entry.id).not.toBe('');
        expect(entry.names[language], entry.id).not.toMatch(/ß/);
        expect(entry.detail[language], entry.id).not.toMatch(/ß/);
      }
    }
  });

  it('deprecates nothing today, and would hide what it deprecates', () => {
    expect(EXERCISE_CATALOGUE.every((entry) => !entry.deprecated)).toBe(true);
    expect(offeredCatalogue()).toHaveLength(EXERCISE_CATALOGUE.length);
  });
});

describe('the catalogue after block 7D (D171)', () => {
  it('adds the 84 ids with the mapping on the STOP page', () => {
    for (const [id, en, muscles, primary, loadType] of BLOCK_7D) {
      const entry = catalogueEntry(id);
      expect(entry, id).toBeDefined();
      expect(entry!.names.en, id).toBe(en);
      expect(entry!.muscles, id).toEqual(muscles);
      expect(entry!.primary, id).toEqual(primary);
      expect(entry!.loadType, id).toBe(loadType);
    }
    // No id is in two tables, and every entry is in one.
    const pinned = [...ITERATION_2, ...WP2_1, ...WP3, ...BLOCK_7D].map(([id]) => id);
    expect(new Set(pinned).size).toBe(pinned.length);
    expect([...pinned].sort()).toEqual(EXERCISE_CATALOGUE.map((entry) => entry.id).sort());
  });

  it('gives every one of the ten groups at least ten exercises, counted by primary', () => {
    for (const group of MUSCLE_GROUPS) {
      const primary = EXERCISE_CATALOGUE.filter((entry) => entry.primary.includes(group));
      expect(primary.length, group).toBeGreaterThanOrEqual(10);
    }
  });

  it('names the equipment and the movement of every entry, from the fixed lists', () => {
    for (const entry of EXERCISE_CATALOGUE) {
      expect(Object.keys(EQUIPMENT_WORDS.de), entry.id).toContain(entry.equipment);
      expect(entry.movement.length, entry.id).toBeGreaterThan(0);
      for (const movement of entry.movement) expect(Object.keys(MOVEMENT_WORDS.de), entry.id).toContain(movement);
      expect(new Set(entry.movement).size, entry.id).toBe(entry.movement.length);
    }
  });

  it('loads an entry by body weight exactly when its equipment is the body', () => {
    for (const entry of EXERCISE_CATALOGUE) {
      expect((entry.loadType ?? 'external') === 'bodyweight', entry.id).toBe(entry.equipment === 'bodyweight');
    }
  });

  it('gives each new entry an id made of its English name', () => {
    for (const [id, en] of BLOCK_7D) {
      expect(id, en).toBe(`ex_${en.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`);
    }
  });
});

describe('what a built-in is called on screen', () => {
  it('reads the catalogue name in the current language, whatever the record says', () => {
    expect(exerciseDisplayName('ex_bench_press', 'Bench Press', 'de')).toBe('Bankdrücken');
    expect(exerciseDisplayName('ex_bench_press', 'Bench Press', 'en')).toBe('Bench Press');
    expect(exerciseDisplayName('ex_bench_press', 'Flachbankdrücken', 'de')).toBe('Bankdrücken');
  });

  it('falls back to the name it was given for a custom or unknown id', () => {
    expect(exerciseDisplayName('ex_1234', 'Zercher Squat', 'de')).toBe('Zercher Squat');
    expect(exerciseDetail('ex_1234', 'de')).toBeNull();
    expect(exerciseDetail('ex_overhead_cable_extension', 'de')).toBe('Trizeps, langer Kopf');
  });
});

describe('the seeded records', () => {
  it('writes the same bytes for an iteration-2 id as iteration 2 did', () => {
    const records = new Map(catalogueRecords('2026-01-01T00:00:00.000Z').map((record) => [record.id, record]));
    for (const [id, en, muscles, primary, loadType] of ITERATION_2) {
      expect(records.get(id), id).toEqual({
        id,
        name: en,
        muscles,
        primaryMuscles: primary,
        builtIn: true,
        loadType: loadType ?? 'external',
        durationSeconds: null,
        attributes: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    }
  });
});
