import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS, type ExerciseRecord, type Language } from '../model';
import { de as deCatalogue } from '../../i18n/de';
import { en as enCatalogue } from '../../i18n/en';
import { EXERCISE_CATALOGUE, catalogueRecords, type Equipment } from './catalogue';
import { EQUIPMENT_WORDS, EXERCISE_WORDS, GROUP_WORDS, foldText, searchExercises, searchableExercise, type SearchableExercise } from './search';

/**
 * The picker's search (block 7D, D171): what each of the owner's four words
 * finds — by name, every exercise it must find and no other — and the rules
 * of case, umlauts, the beginnings of words, several words, the user's own
 * exercises, the English screen, and the order of the hits.
 */

const records = catalogueRecords('2026-11-16T08:00:00.000Z');

/** Every built-in as the picker offers it, under its name in `language`. */
function offered(language: Language, own: ExerciseRecord[] = []): SearchableExercise[] {
  return [
    ...records.map((record) => searchableExercise(record, EXERCISE_CATALOGUE.find((entry) => entry.id === record.id)!.names[language], language)),
    ...own.map((record) => searchableExercise(record, record.name, language)),
  ];
}

const names = (query: string, language: Language = 'de', own: ExerciseRecord[] = []): string[] =>
  searchExercises(offered(language, own), query, language).map((hit) => hit.name);
const sorted = (list: string[], language: Language = 'de'): string[] => [...list].sort((a, b) => a.localeCompare(b, language));

const CORE = ['Bauchmaschine', 'Bauchroller', 'Beinheben liegend', 'Cable Crunch', 'Crunches', 'Fahrrad-Crunches', 'Hanging Leg Raises', 'Pallof Press', 'Plank', 'Reverse Crunches', 'Rumpfrotation Maschine', 'Russian Twist', 'Seitbeugen Kurzhantel', 'Sit-ups', 'Woodchop Kabel'];
const PULLING = ['Aufrechtes Rudern', 'Enges Kabelrudern', 'Face Pulls', 'Klimmzüge', 'Klimmzüge assistiert', 'Klimmzüge Untergriff', 'Kurzhantelrudern einarmig', 'Langhantelrudern', 'Latzug', 'Latzug einarmig Kabel', 'Latzug eng von oben', 'Latzug neutraler Griff', 'Latzug weit', 'Rudern Eigengewicht', 'Rudern Maschine', 'Rudern Smith Machine', 'Straight-Arm Pullover Kabel', 'T-Bar-Rudern'];
const MACHINE = ['Bauchmaschine', 'Beinbeuger Maschine', 'Beinbeuger sitzend', 'Beinpresse', 'Beinstrecker Maschine', 'Brustpresse Maschine', 'Butterfly Maschine', 'Dips assistiert', 'Dips Maschine sitzend', 'Donkey-Wadenheben', 'Hackenschmidt-Kniebeuge', 'Hip Thrust Maschine', 'Hüftabduktion Maschine', 'Klimmzüge assistiert', 'Preacher-Curls', 'Reverse Flys Maschine', 'Rückenstrecker Maschine', 'Rudern Maschine', 'Rumpfrotation Maschine', 'Schrägbank Maschine', 'Schulterpresse Maschine', 'Seitheben Maschine', 'Trizepsmaschine', 'Wadenheben', 'Wadenheben Beinpresse', 'Wadenheben sitzend'];
const BODYWEIGHT = ['Ausfallschritte', 'Bankdips', 'Bauchroller', 'Beinheben liegend', 'Bulgarian Split Squat', 'Crunches', 'Dips', 'Fahrrad-Crunches', 'Glute Bridge', 'Hanging Leg Raises', 'Hyperextensions', 'Klimmzüge', 'Klimmzüge Untergriff', 'Kniebeuge Eigengewicht', 'Liegestütze', 'Liegestütze eng', 'Nordic Curls', 'Pike-Liegestütze', 'Plank', 'Reverse Crunches', 'Rudern Eigengewicht', 'Russian Twist', 'Sit-ups', 'Step-ups', 'Wadenheben Eigengewicht', 'Wadenheben einbeinig'];

describe('the four words of the owner (D171)', () => {
  it('"bauch" finds the core exercises, and no other', () => {
    expect(sorted(names('bauch'))).toEqual(CORE);
    // A push-up names the core among its groups, and is not a core exercise.
    expect(names('bauch')).not.toContain('Liegestütze');
    expect(names('bauch')).not.toContain('Kniebeuge');
  });

  it('"ziehen" finds the pulling exercises — the rows among them — and no other', () => {
    expect(sorted(names('ziehen'))).toEqual(PULLING);
    // The deadlift is a lift, Kreuzheben: found by "heben", not by "ziehen".
    expect(names('ziehen')).not.toContain('Kreuzheben');
    expect(names('heben')).toContain('Kreuzheben');
  });

  it('"zieh" finds what "ziehen" finds: the beginning of a word is enough', () => {
    expect(sorted(names('zieh'))).toEqual(PULLING);
    expect(sorted(names('masch'))).toEqual(MACHINE);
  });

  it('"maschine" finds the exercises on a machine, and no other', () => {
    expect(sorted(names('maschine'))).toEqual(MACHINE);
  });

  it('"eigengewicht" finds the exercises loaded by the body\'s own weight, and no other', () => {
    expect(sorted(names('eigengewicht'))).toEqual(BODYWEIGHT);
    // An assisted pull-up is done on a machine: it is not found as body weight.
    expect(names('eigengewicht')).not.toContain('Klimmzüge assistiert');
  });
});

describe('how a query is read', () => {
  it('ignores case', () => {
    expect(names('BAUCH')).toEqual(names('bauch'));
    expect(names('Maschine')).toEqual(names('maschine'));
  });

  it('reads an umlaut in all four spellings as one, and "gesass" as Gesäss', () => {
    const rucken = names('rücken');
    expect(rucken.length).toBeGreaterThan(10);
    for (const spelling of ['RÜCKEN', 'ruecken', 'rucken', 'Rücken']) expect(names(spelling), spelling).toEqual(rucken);
    expect(foldText('Gesäss')).toBe(foldText('gesass'));
    expect(names('gesass')).toEqual(names('gesäss'));
    expect(names('gesass')).toContain('Hip Thrust');
    expect(names('gesäß')).toEqual(names('gesäss'));
  });

  it('narrows with every further word: "kabel brust" is the chest on the cable', () => {
    expect(sorted(names('kabel brust'))).toEqual(['Brustpresse Kabel', 'Cable Fly bottom-up', 'Cable Fly straight', 'Cable Fly top-down']);
    expect(names('brust kabel')).toEqual(names('kabel brust'));
  });

  it('finds nothing for a word it does not know', () => {
    expect(names('xylophon')).toEqual([]);
    expect(names('bauch xylophon')).toEqual([]);
  });

  it('still finds what it found before: any part of the name, and the stored English name', () => {
    // By the stored English name: the exercise whose stored name is the query comes first.
    expect(names('bench press')[0]).toBe('Bankdrücken');
    expect(names('bench')).toEqual(expect.arrayContaining(['Bankdrücken', 'Bankdips', 'Enges Bankdrücken', 'Schrägbank Langhantel']));
    expect(names('curl')).toEqual(expect.arrayContaining(['Bizeps-Curls', 'Hammer Curls', 'Preacher-Curls', 'Eindreh-Curls']));
    expect(names('drück')).toEqual(expect.arrayContaining(['Bankdrücken', 'Enges Bankdrücken', 'Schulterdrücken Kurzhantel']));
    expect(names('Pull-Up')).toContain('Klimmzüge');
    expect(names('Squat')).toContain('Kniebeuge');
  });

  it('finds every group by the name the screen shows for it, and by its synonyms', () => {
    for (const [language, catalogue] of [['de', deCatalogue], ['en', enCatalogue]] as const) {
      for (const group of MUSCLE_GROUPS) {
        const label = catalogue[`muscle.${group}` as const];
        expect(GROUP_WORDS[language][group], `${language} ${group}`).toContain(label);
        const found = searchExercises(offered(language), label, language);
        const primary = EXERCISE_CATALOGUE.filter((entry) => entry.primary.includes(group)).map((entry) => entry.id);
        expect(found.length, `${language} ${label}`).toBeGreaterThan(0);
        for (const id of primary) expect(found.map((hit) => hit.id), `${language} ${label}: ${id}`).toContain(id);
      }
    }
    for (const [query, group] of [['bauch', 'core'], ['rumpf', 'core'], ['core', 'core'], ['abs', 'core'], ['po', 'hamstringsGlutes'], ['gesäss', 'hamstringsGlutes'], ['schulter', 'shoulders'], ['unterarm', 'forearms'], ['oberschenkel', 'quadriceps']] as const) {
      const ids = searchExercises(offered('de'), query, 'de').map((hit) => hit.id);
      for (const entry of EXERCISE_CATALOGUE.filter((candidate) => candidate.primary.includes(group))) expect(ids, `${query}: ${entry.id}`).toContain(entry.id);
    }
    // "Beine" are the quadriceps, the hamstrings and glutes, and the calves.
    const legs = new Set(searchExercises(offered('de'), 'beine', 'de').map((hit) => hit.id));
    for (const entry of EXERCISE_CATALOGUE.filter((candidate) => candidate.primary.some((group) => ['quadriceps', 'hamstringsGlutes', 'calves'].includes(group)))) expect(legs.has(entry.id), entry.id).toBe(true);
    // "Arme" the biceps, the triceps and the forearms.
    const arms = new Set(searchExercises(offered('de'), 'arme', 'de').map((hit) => hit.id));
    for (const entry of EXERCISE_CATALOGUE.filter((candidate) => candidate.primary.some((group) => ['biceps', 'triceps', 'forearms'].includes(group)))) expect(arms.has(entry.id), entry.id).toBe(true);
  });

  it('finds every piece of equipment by the word the row shows for it', () => {
    for (const [language, catalogue] of [['de', deCatalogue], ['en', enCatalogue]] as const) {
      for (const equipment of Object.keys(EQUIPMENT_WORDS[language]) as Equipment[]) {
        const label = catalogue[`gym.equipment.${equipment}` as const];
        expect(EQUIPMENT_WORDS[language][equipment], `${language} ${equipment}`).toContain(label);
        const ids = searchExercises(offered(language), label, language).map((hit) => hit.id);
        for (const entry of EXERCISE_CATALOGUE.filter((candidate) => candidate.equipment === equipment)) expect(ids, `${language} ${label}: ${entry.id}`).toContain(entry.id);
      }
    }
  });
});

describe('the user\'s own exercises', () => {
  const own: ExerciseRecord[] = [
    { id: 'ex_own_1', name: 'Zercher Squat', muscles: ['quadriceps', 'core'], primaryMuscles: ['quadriceps'], builtIn: false, loadType: 'external', durationSeconds: null, attributes: {}, createdAt: '2026-11-01T08:00:00.000Z', updatedAt: '2026-11-01T08:00:00.000Z' },
    { id: 'ex_own_2', name: 'Ringdips', muscles: ['triceps', 'chest'], primaryMuscles: ['triceps'], builtIn: false, loadType: 'bodyweight', durationSeconds: null, attributes: {}, createdAt: '2026-11-01T08:00:00.000Z', updatedAt: '2026-11-01T08:00:00.000Z' },
    // Written before roles existed: every group counts as primary, as the rating reads it (D92).
    { id: 'ex_own_3', name: 'Kettlebell Halo', muscles: ['shoulders', 'core'], builtIn: false, durationSeconds: null, attributes: {}, createdAt: '2025-01-01T08:00:00.000Z', updatedAt: '2025-01-01T08:00:00.000Z' } as ExerciseRecord,
  ];

  it('are found by their name, their groups with synonyms, and body weight — and by nothing they do not have', () => {
    expect(names('zercher', 'de', own)).toEqual(['Zercher Squat']);
    expect(names('oberschenkel', 'de', own)).toContain('Zercher Squat');
    // The core is the Zercher squat's second group, not its primary one.
    expect(names('bauch', 'de', own)).not.toContain('Zercher Squat');
    expect(names('eigengewicht', 'de', own)).toContain('Ringdips');
    expect(names('eigengewicht', 'de', own)).not.toContain('Zercher Squat');
    expect(names('bauch', 'de', own)).toContain('Kettlebell Halo');
    expect(names('schulter', 'de', own)).toContain('Kettlebell Halo');
    // No equipment and no movement is guessed from a name.
    expect(names('maschine', 'de', own)).not.toContain('Zercher Squat');
    expect(names('kugelhantel', 'de', own)).not.toContain('Kettlebell Halo');
    expect(names('drücken', 'de', own)).not.toContain('Ringdips');
  });
});

describe('the English screen', () => {
  const english = (query: string) => sorted(names(query, 'en'), 'en');
  const inEnglish = (german: string[]) =>
    sorted(german.map((name) => EXERCISE_CATALOGUE.find((entry) => entry.names.de === name)!.names.en), 'en');

  it('"abs" finds the core exercises', () => {
    expect(english('abs')).toEqual(inEnglish(CORE));
  });

  it('"pull" finds the pulling exercises — and the pull-through, by its name', () => {
    expect(english('pull')).toEqual(sorted([...inEnglish(PULLING), 'Cable Pull-Through'], 'en'));
  });

  it('"machine" finds the exercises on a machine — and the Smith machine, by its name', () => {
    const smith = EXERCISE_CATALOGUE.filter((entry) => entry.equipment === 'smith').map((entry) => entry.names.en);
    expect(english('machine')).toEqual(sorted([...inEnglish(MACHINE), ...smith], 'en'));
  });

  it('"bodyweight" finds the exercises loaded by the body\'s own weight', () => {
    expect(english('bodyweight')).toEqual(inEnglish(BODYWEIGHT));
  });
});

describe('the order of the hits', () => {
  it('puts the exercise whose name is the query first, then names beginning with it, then other name hits, then the rest', () => {
    const hits = names('bankdrücken');
    expect(hits[0]).toBe('Bankdrücken');
    expect(hits.slice(1, 3)).toEqual(['Bankdrücken Kurzhantel', 'Bankdrücken Smith Machine']);
    expect(hits).toContain('Enges Bankdrücken');
    // A name hit stands before a hit by group or equipment.
    const kabel = names('kabel');
    const firstOther = kabel.findIndex((name) => !foldText(name).includes('kabel'));
    expect(firstOther).toBeGreaterThan(0);
    expect(kabel.slice(firstOther).every((name) => !foldText(name).includes('kabel'))).toBe(true);
    // Alphabetical within each: the hits on the cable not named by it.
    const rest = kabel.slice(firstOther);
    expect(rest).toEqual(sorted(rest));
  });

  it('puts a hit found only inside a word last: «rücken» lists the back before Bankdrücken', () => {
    const hits = names('rücken');
    expect(hits[0]).toBe('Rückenstrecker Maschine');
    // «rücken» lies inside «drücken»: what the search found before block 7D
    // is still found, after every exercise of the back.
    const presses = ['Bankdrücken', 'Bankdrücken Kurzhantel', 'Bankdrücken Smith Machine', 'Enges Bankdrücken', 'Schulterdrücken Kurzhantel'];
    expect(hits.slice(-presses.length)).toEqual(sorted(presses));
    const back = EXERCISE_CATALOGUE.filter((entry) => entry.primary.includes('back') && !entry.deprecated).map((entry) => entry.names.de);
    const lastBack = Math.max(...back.map((name) => hits.indexOf(name)));
    expect(back.every((name) => hits.includes(name))).toBe(true);
    expect(lastBack).toBeLessThan(hits.indexOf('Bankdrücken'));
    // A word that begins a word of the name is no such hit: «hack» finds the hack squat among the names.
    expect(names('hack')[0]).toBe('Hackenschmidt-Kniebeuge');
  });

  it('finds the preacher curl by its other names, and nothing else by them (D189)', () => {
    expect(names('bizepsmaschine')).toEqual(['Preacher-Curls']);
    expect(names('Bizeps-Maschine')).toEqual(['Preacher-Curls']);
    expect(names('scott')).toEqual(['Preacher-Curls']);
    expect(names('Scott-Curls')).toEqual(['Preacher-Curls']);
    expect(names('scott curl', 'en')).toEqual(['Preacher Curl']);
    expect(names('biceps machine', 'en')).toEqual(['Preacher Curl']);
    // A word of a group finds the group as before: the preacher curl stands among the biceps, not ahead of them.
    expect(names('bizeps')[0]).not.toBe('Preacher-Curls');
    // Other names hang on built-ins that exist, the same ones in both languages.
    for (const language of ['de', 'en'] as const) {
      for (const id of Object.keys(EXERCISE_WORDS[language])) expect(EXERCISE_CATALOGUE.some((entry) => entry.id === id), id).toBe(true);
    }
    expect(Object.keys(EXERCISE_WORDS.de)).toEqual(Object.keys(EXERCISE_WORDS.en));
  });

  it('lists everything alphabetically for an empty query', () => {
    const all = names('');
    expect(all).toHaveLength(EXERCISE_CATALOGUE.length);
    expect(all).toEqual(sorted(all));
    expect(names('   ')).toEqual(all);
  });
});
