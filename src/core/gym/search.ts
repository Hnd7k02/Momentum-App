import { MUSCLE_GROUPS, type ExerciseLoadType, type Language, type MuscleGroup } from '../model';
import { catalogueEntry, type Equipment, type Movement } from './catalogue';

/**
 * The search of the exercise picker (block 7D, D171).
 *
 * One pure function over what the picker offers: the name the screen shows
 * and the stored name, the anatomical detail, the primary muscle groups with
 * their synonyms, the movement, the equipment, and "bodyweight". It computes
 * nothing that is scored, and it guesses nothing from a name: the movement
 * and the equipment of a built-in are written on its catalogue entry, like
 * its muscles; a user's own exercise is found by its name, its groups and
 * whether it is loaded by body weight, which is all it has.
 *
 * **Every word the search knows stands here, once per language** — the
 * synonyms of the groups, the words of the movements, of the equipment and
 * of body weight. A test holds that each group and each piece of equipment
 * is found under the very label the screen shows for it.
 *
 * How a query matches:
 *
 * - **Case, umlauts and their spellings do not matter.** "RÜCKEN",
 *   "rücken", "ruecken" and "rucken" are one word; "gesass" is "Gesäss".
 * - **The beginning of a word is enough.** "zieh" finds what "ziehen" finds,
 *   "masch" what "Maschine" finds.
 * - **Several words narrow**: each must be found somewhere — "kabel brust"
 *   is the chest exercises on a cable.
 * - **What the search found before, it still finds**: any part of the name,
 *   in the middle of a word too — "bench" finds Bankdrücken by its stored
 *   name, "curl" finds the curls.
 * - **A group is found by its primary role only.** "bauch" lists the
 *   exercises that train the core and no other: a push-up names the core
 *   among its groups but is not a core exercise. The row still shows every
 *   group, so the reason for a hit is in sight.
 *
 * The order (`rank`): an exercise whose name is the query comes first, then
 * one whose name begins with it, then one found by its name at all, then
 * one found by its group, its detail, its movement or its equipment — and
 * alphabetically within each.
 */

/* ── The words ───────────────────────────────────────────────────────── */

/** Each group's words: its label as the screen shows it, then its synonyms. */
export const GROUP_WORDS: Record<Language, Record<MuscleGroup, readonly string[]>> = {
  de: {
    chest: ['Brust', 'Brustmuskel', 'Pecs'],
    back: ['Rücken', 'Latissimus', 'Lat', 'Trapez', 'Nacken'],
    shoulders: ['Schultern', 'Schulter', 'Delta'],
    biceps: ['Bizeps', 'Arme', 'Arm', 'Oberarm'],
    triceps: ['Trizeps', 'Arme', 'Arm', 'Oberarm'],
    core: ['Rumpf', 'Bauch', 'Bauchmuskeln', 'Core', 'Abs', 'Sixpack'],
    quadriceps: ['Quadrizeps', 'Quads', 'Beine', 'Bein', 'Oberschenkel'],
    hamstringsGlutes: ['Beinbeuger und Gesäss', 'Beinbeuger', 'Gesäss', 'Po', 'Hintern', 'Glutes', 'Hamstrings', 'Beine', 'Bein', 'Oberschenkel'],
    calves: ['Waden', 'Wade', 'Beine', 'Bein', 'Unterschenkel'],
    forearms: ['Unterarme', 'Unterarm', 'Griff', 'Griffkraft', 'Arme', 'Arm'],
  },
  en: {
    chest: ['Chest', 'Pecs'],
    back: ['Back', 'Lats', 'Traps'],
    shoulders: ['Shoulders', 'Shoulder', 'Delts'],
    biceps: ['Biceps', 'Arms', 'Arm'],
    triceps: ['Triceps', 'Arms', 'Arm'],
    core: ['Core', 'Abs', 'Abdominals', 'Stomach'],
    quadriceps: ['Quadriceps', 'Quads', 'Legs', 'Leg', 'Thighs', 'Thigh'],
    hamstringsGlutes: ['Hamstrings and glutes', 'Hamstrings', 'Glutes', 'Butt', 'Legs', 'Leg', 'Thighs', 'Thigh'],
    calves: ['Calves', 'Calf', 'Legs', 'Leg'],
    forearms: ['Forearms', 'Forearm', 'Grip', 'Arms', 'Arm'],
  },
};

/** Each movement's words (D171: drücken, ziehen, rudern, beugen, strecken, heben, and the four the flys, the core and the carry need). */
export const MOVEMENT_WORDS: Record<Language, Record<Movement, readonly string[]>> = {
  de: {
    push: ['drücken'],
    pull: ['ziehen', 'Zug'],
    row: ['rudern'],
    bend: ['beugen'],
    extend: ['strecken'],
    raise: ['heben'],
    fly: ['Flys', 'Fliegende', 'Butterfly'],
    rotate: ['drehen', 'Rotation'],
    hold: ['halten'],
    carry: ['tragen'],
  },
  en: {
    push: ['push', 'press'],
    pull: ['pull'],
    row: ['row'],
    bend: ['bend', 'flex'],
    extend: ['extend', 'extension'],
    raise: ['raise', 'lift'],
    fly: ['fly', 'flys', 'flyes'],
    rotate: ['rotate', 'rotation', 'twist'],
    hold: ['hold'],
    carry: ['carry'],
  },
};

/** Each piece of equipment's words: its label as the screen shows it, then its synonyms. */
export const EQUIPMENT_WORDS: Record<Language, Record<Equipment, readonly string[]>> = {
  de: {
    barbell: ['Langhantel', 'LH'],
    dumbbell: ['Kurzhantel', 'KH'],
    cable: ['Kabel', 'Kabelzug', 'Seilzug'],
    machine: ['Maschine'],
    smith: ['Smith Machine', 'Multipresse'],
    bodyweight: ['Eigengewicht', 'Körpergewicht'],
    ezBar: ['SZ-Stange', 'SZ', 'EZ'],
    kettlebell: ['Kettlebell', 'Kugelhantel'],
    wristRoller: ['Unterarmroller', 'Wrist Roller'],
  },
  en: {
    barbell: ['Barbell'],
    dumbbell: ['Dumbbell'],
    cable: ['Cable'],
    machine: ['Machine'],
    smith: ['Smith machine'],
    bodyweight: ['Bodyweight', 'Body weight'],
    ezBar: ['EZ bar'],
    kettlebell: ['Kettlebell'],
    wristRoller: ['Wrist roller'],
  },
};

/** The words of an exercise loaded by the body's own weight, built-in or the user's own. */
export const BODYWEIGHT_WORDS: Record<Language, readonly string[]> = {
  de: EQUIPMENT_WORDS.de.bodyweight,
  en: EQUIPMENT_WORDS.en.bodyweight,
};

/* ── Folding ─────────────────────────────────────────────────────────── */

/**
 * A text as the search compares it: lower case, "ß" as "ss", an umlaut and
 * its spelt-out form ("ü", "ue") both as the bare vowel ("u"), and any
 * other accent dropped. Applied to the query and to every word alike, so
 * "RÜCKEN", "ruecken" and "rucken" all read "rucken".
 */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** The words of a folded text: what lies between anything that is not a letter or a digit. */
const words = (folded: string): string[] => folded.split(/[^a-z0-9]+/).filter(Boolean);

/* ── What is searched ────────────────────────────────────────────────── */

/** One exercise as the search sees it. */
export interface SearchableExercise {
  id: string;
  /** The name the screen shows. */
  name: string;
  /** The stored record's name: the English anchor of a built-in, the user's own name otherwise. */
  storedName: string;
  /** The anatomical detail in the language shown; `null` for the user's own exercise. */
  detail: string | null;
  /** The groups the exercise trains primarily. */
  primary: readonly MuscleGroup[];
  movement: readonly Movement[];
  equipment: Equipment | null;
  /** Loaded by the body's own weight. */
  bodyweight: boolean;
}

/**
 * An exercise the picker offers, as the search sees it: a built-in by its
 * catalogue entry, the user's own by its record. A record of the user's own
 * written before roles existed names no primary group; all its groups are
 * read as primary, as the rating reads them (D92).
 */
export function searchableExercise(
  record: { id: string; name: string; muscles: readonly MuscleGroup[]; primaryMuscles?: readonly MuscleGroup[]; loadType?: ExerciseLoadType },
  shownName: string,
  language: Language,
): SearchableExercise {
  const entry = catalogueEntry(record.id);
  if (entry) {
    return {
      id: record.id,
      name: shownName,
      storedName: record.name,
      detail: entry.detail[language],
      primary: entry.primary,
      movement: entry.movement,
      equipment: entry.equipment,
      bodyweight: (entry.loadType ?? 'external') === 'bodyweight',
    };
  }
  return {
    id: record.id,
    name: shownName,
    storedName: record.name,
    detail: null,
    primary: record.primaryMuscles && record.primaryMuscles.length > 0 ? record.primaryMuscles : record.muscles,
    movement: [],
    equipment: null,
    bodyweight: record.loadType === 'bodyweight',
  };
}

/** Everything an exercise can be found by, folded, beside its names. */
interface Indexed<T> {
  entry: T;
  name: string;
  storedName: string;
  /** The words of the two names. */
  nameWords: string[];
  /** Every word it can be found by: its names, its detail, its groups, its movement, its equipment. */
  allWords: string[];
}

function indexed<T extends SearchableExercise>(entry: T, language: Language): Indexed<T> {
  const name = foldText(entry.name);
  const storedName = foldText(entry.storedName);
  const nameWords = [...words(name), ...words(storedName)];
  const extra: string[] = [];
  if (entry.detail) extra.push(entry.detail);
  for (const group of MUSCLE_GROUPS) if (entry.primary.includes(group)) extra.push(...GROUP_WORDS[language][group]);
  for (const movement of entry.movement) extra.push(...MOVEMENT_WORDS[language][movement]);
  if (entry.equipment) extra.push(...EQUIPMENT_WORDS[language][entry.equipment]);
  if (entry.bodyweight) extra.push(...BODYWEIGHT_WORDS[language]);
  return { entry, name, storedName, nameWords, allWords: [...nameWords, ...extra.flatMap((text) => words(foldText(text)))] };
}

/** Each part of a query word begins one of the words known. */
const begins = (word: string, known: readonly string[]): boolean =>
  words(word).every((part) => known.some((candidate) => candidate.startsWith(part)));

/** A query word is found by the name — anywhere in it — or by the beginning of each of its parts. */
const foundIn = (word: string, names: readonly string[], known: readonly string[]): boolean =>
  names.some((name) => name.includes(word)) || begins(word, known);

/**
 * How well an exercise answers a query — 0 is best — or `null` where it
 * does not: 0 its name is the query, 1 its name begins with it, 2 every
 * word begins a word of its name, 3 every word begins a word it is found
 * by — its group, detail, movement or equipment — and 4 found only inside
 * a word of its name.
 *
 * The last tier keeps what the search found before block 7D, which matched
 * any part of a name, and puts it where it belongs: «rücken» lies inside
 * «Bankdrücken», and a search for the back is not to list bench presses
 * before the pull-ups.
 */
function rank<T extends SearchableExercise>(item: Indexed<T>, query: string, queryWords: readonly string[]): number | null {
  const names = [item.name, item.storedName];
  if (!queryWords.every((word) => foundIn(word, names, item.allWords))) return null;
  if (names.includes(query)) return 0;
  if (names.some((name) => name.startsWith(query))) return 1;
  if (queryWords.every((word) => begins(word, item.nameWords))) return 2;
  if (queryWords.every((word) => begins(word, item.allWords))) return 3;
  return 4;
}

/**
 * The exercises that answer `query`, best first and alphabetically within
 * an equal answer — by the name shown, in the language shown. An empty
 * query answers everything, alphabetically.
 */
export function searchExercises<T extends SearchableExercise>(entries: readonly T[], query: string, language: Language): T[] {
  const folded = foldText(query).trim().replace(/\s+/g, ' ');
  const byName = (a: T, b: T): number => a.name.localeCompare(b.name, language);
  if (folded === '') return [...entries].sort(byName);
  const queryWords = folded.split(' ');
  return entries
    .map((entry) => {
      const item = indexed(entry, language);
      return { entry, rank: rank(item, folded, queryWords) };
    })
    .filter((hit): hit is { entry: T; rank: number } => hit.rank !== null)
    .sort((a, b) => a.rank - b.rank || byName(a.entry, b.entry))
    .map((hit) => hit.entry);
}
