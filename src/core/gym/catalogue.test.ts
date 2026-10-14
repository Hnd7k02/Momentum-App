import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS, type ExerciseLoadType, type MuscleGroup } from '../model';
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
 * what they were where it matters.
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
  it('has 49 entries with unique ids', () => {
    expect(EXERCISE_CATALOGUE).toHaveLength(49);
    expect(new Set(EXERCISE_CATALOGUE.map((entry) => entry.id)).size).toBe(49);
    expect(EXERCISE_CATALOGUE).toHaveLength(ITERATION_2.length + WP2_1.length + WP3.length);
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
