import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MUSCLE_GROUPS,
  type ExerciseLoadType,
  type ExerciseRecord,
  type MuscleGroup,
} from '../../core/model';
import { Button, SHEET_INITIAL_FOCUS, Sheet } from '../../components';
import { MUSCLE_LABEL_KEYS } from '../../components/BodyRenderer';
import { catalogueEntry } from '../../core/gym/catalogue';
import { foldText, searchExercises, searchableExercise, type SearchableExercise } from '../../core/gym/search';
import { useI18n, useT } from '../../i18n/I18nProvider';
import type { NewExerciseInput } from '../../storage/services/gymService';
import { useExerciseNamer } from './exerciseNames';
import './gym.css';

/**
 * Choosing what to do next.
 *
 * A search box and a list, because during a workout the user already knows
 * the name and is holding a phone in one hand. The muscle groups are shown
 * on every row rather than used as a filter: they are what the exercise
 * *counts for*, and seeing them is how a user notices their session is all
 * chest.
 *
 * **Since block 7D** (D171) the catalogue holds well over a hundred
 * exercises and the search finds them by much more than their name — the
 * muscle group with its everyday words, the movement, the equipment, body
 * weight (`core/gym/search.ts`). Two consequences on this screen:
 *
 * - **Without a query the list stands under one heading per muscle
 *   group**, in the order the app names the groups everywhere, each
 *   exercise once, under its first primary group; with a query it is one
 *   list, the best answers first.
 * - **Why a row was found is in sight**: its second line names its groups
 *   and its equipment — unless the name already says the equipment — so a
 *   search for "Maschine" never shows a row without a reason.
 *
 * No query finds nothing silently: the empty state says what was searched
 * and makes the one action there is, "Eigene Übung", the primary one; the
 * form it opens starts with what was typed as the name.
 *
 * A custom exercise names its own muscle groups, which of them are primary,
 * and how it is loaded. Nothing is inferred from the name — a wrong guess
 * would quietly send a user's work to the wrong part of the body, and that is
 * the one thing this screen must never do.
 *
 * Only a *custom* exercise is editable here. A built-in's mapping belongs to
 * the catalogue and stays there (D93), so "Bench Press" means the same thing
 * on every device; a user who wants their own version makes their own, which
 * is the button at the bottom of this sheet.
 */
export function ExercisePicker({
  open,
  exercises,
  onClose,
  onPick,
  onCreate,
}: {
  open: boolean;
  exercises: ExerciseRecord[];
  onClose(): void;
  onPick(exercise: ExerciseRecord): void;
  onCreate(input: NewExerciseInput): void;
}) {
  const t = useT();
  const { language } = useI18n();
  const namer = useExerciseNamer();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [primary, setPrimary] = useState<MuscleGroup[]>([]);
  const [loadType, setLoadType] = useState<ExerciseLoadType>('external');
  const nameRef = useRef<HTMLInputElement>(null);
  /** Back is closing the picker: its fields are kept. */
  const byBack = useRef(false);

  // The sheet focuses the search when it opens (WP3, B1). Switching to the
  // custom form inside the open sheet is the picker's own change of view, so
  // the picker moves focus to the name field itself — and scrolls it into
  // view, since the form opens below the list the user had scrolled.
  useEffect(() => {
    if (creating) nameRef.current?.focus();
  }, [creating]);

  /**
   * Every exercise the user may pick, under the name they see it by. A
   * deprecated catalogue entry is not offered — it stays resolvable for
   * what already names it, and that is all (WP2 A2). The search matches the
   * shown name and the stored one as before, so "bench" still finds
   * Bankdrücken, and since block 7D everything else an exercise is.
   */
  const offered = useMemo(
    () =>
      exercises
        .filter((exercise) => !catalogueEntry(exercise.id)?.deprecated)
        .map((exercise) => ({
          ...searchableExercise(exercise, namer.name(exercise.id, exercise.name), language),
          exercise,
        })),
    [exercises, namer, language],
  );

  const searching = query.trim().length > 0;
  const matches = useMemo(() => searchExercises(offered, query, language), [offered, query, language]);

  /** Without a query: one heading per group, each exercise under its first primary group. */
  const sections = useMemo(() => {
    if (searching) return [];
    return MUSCLE_GROUPS.map((group) => ({
      group,
      entries: matches.filter((entry) => MUSCLE_GROUPS.find((candidate) => entry.primary.includes(candidate)) === group),
    })).filter((section) => section.entries.length > 0);
  }, [matches, searching]);

  /** The equipment beside the groups, where the name does not already say it. */
  const equipmentOf = (entry: SearchableExercise): string | null => {
    const label = entry.equipment
      ? t(`gym.equipment.${entry.equipment}` as const)
      : entry.bodyweight
        ? t('gym.equipment.bodyweight')
        : null;
    if (label === null) return null;
    return foldText(entry.name).includes(foldText(label)) ? null : label;
  };

  const row = (entry: (typeof offered)[number]) => {
    const equipment = equipmentOf(entry);
    return (
      <button
        key={entry.id}
        type="button"
        className="gym-picker__row"
        onClick={() => {
          onPick(entry.exercise);
          reset();
        }}
      >
        <span className="gym-picker__name">{entry.name}</span>
        <span className="gym-picker__meta">
          <span className="gym-picker__groups">
            {namer.describe(entry.id, entry.exercise.muscles.map((muscle) => t(MUSCLE_LABEL_KEYS[muscle])))}
          </span>
          {equipment ? <span className="gym-picker__equipment">{` · ${equipment}`}</span> : null}
        </span>
      </button>
    );
  };

  const nothing = searching && matches.length === 0;

  const reset = () => {
    setQuery('');
    setCreating(false);
    setName('');
    setMuscles([]);
    setPrimary([]);
    setLoadType('external');
  };

  const toggleMuscle = (muscle: MuscleGroup) => {
    setMuscles((current) =>
      current.includes(muscle)
        ? current.filter((entry) => entry !== muscle)
        : [...current, muscle],
    );
    // A group that is no longer trained cannot still be the primary one.
    setPrimary((current) => current.filter((entry) => entry !== muscle || !muscles.includes(entry)));
  };

  const togglePrimary = (muscle: MuscleGroup) =>
    setPrimary((current) =>
      current.includes(muscle)
        ? current.filter((entry) => entry !== muscle)
        : [...current, muscle],
    );

  const LOAD_TYPES: { id: ExerciseLoadType; label: 'gym.load.external' | 'gym.load.bodyweight' | 'gym.load.assisted' }[] = [
    { id: 'external', label: 'gym.load.external' },
    { id: 'bodyweight', label: 'gym.load.bodyweight' },
    { id: 'assisted', label: 'gym.load.assisted' },
  ];

  return (
    <Sheet
      open={open}
      title={t('gym.picker.title')}
      onClose={() => {
        // Back keeps what was typed (D187): the search and the form of an
        // exercise of the user's own stay as they are and stand again when
        // the picker opens next — for as long as the workout or the plan it
        // was opened in. Every other way out empties it, as before.
        if (!byBack.current) reset();
        byBack.current = false;
        onClose();
      }}
      onBack={() => {
        byBack.current = true;
      }}
      footer={
        creating ? (
          <Button
            variant="primary"
            block
            disabled={name.trim().length === 0 || muscles.length === 0}
            onClick={() => {
              onCreate({
                name: name.trim(),
                muscles,
                // No primary picked means the first group chosen, which is
                // what the ordering in this list already implies.
                primaryMuscles: primary.length > 0 ? primary : muscles.slice(0, 1),
                loadType,
              });
              reset();
            }}
          >
            {t('common.add')}
          </Button>
        ) : (
          <Button
            // Where the search found nothing, this is the one thing to do.
            variant={nothing ? 'primary' : 'secondary'}
            block
            onClick={() => {
              // What was searched for and not found is the likely name.
              if (nothing && name.trim() === '') setName(query.trim());
              setCreating(true);
            }}
          >
            {t('gym.picker.custom')}
          </Button>
        )
      }
    >
      {creating ? (
        <>
          <div>
            <label className="field-label" htmlFor="exercise-name">
              {t('gym.picker.customName')}
            </label>
            <input
              ref={nameRef}
              id="exercise-name"
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <span className="field-label">{t('gym.picker.customMuscles')}</span>
            <div
              className="gym-picker__muscles"
              role="group"
              aria-label={t('gym.picker.customMuscles')}
            >
              {MUSCLE_GROUPS.map((muscle) => (
                <button
                  key={muscle}
                  type="button"
                  className="gym-picker__muscle"
                  aria-pressed={muscles.includes(muscle)}
                  onClick={() => toggleMuscle(muscle)}
                >
                  {t(MUSCLE_LABEL_KEYS[muscle])}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="field-label">{t('gym.picker.primary')}</span>
            <div
              className="gym-picker__muscles"
              role="group"
              aria-label={t('gym.picker.primary')}
            >
              {muscles.map((muscle) => (
                <button
                  key={muscle}
                  type="button"
                  className="gym-picker__muscle"
                  aria-pressed={primary.includes(muscle)}
                  onClick={() => togglePrimary(muscle)}
                >
                  {t(MUSCLE_LABEL_KEYS[muscle])}
                </button>
              ))}
            </div>
            <p className="gym-picker__empty">{t('gym.picker.primaryHint')}</p>
          </div>
          <div>
            <span className="field-label">{t('gym.load.title')}</span>
            <div className="gym-picker__muscles" role="group" aria-label={t('gym.load.title')}>
              {LOAD_TYPES.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="gym-picker__muscle"
                  aria-pressed={loadType === entry.id}
                  onClick={() => setLoadType(entry.id)}
                >
                  {t(entry.label)}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="field-label" htmlFor="exercise-search">
              {t('gym.picker.search')}
            </label>
            <input
              {...SHEET_INITIAL_FOCUS}
              id="exercise-search"
              className="field"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
              enterKeyHint="search"
              aria-describedby="exercise-search-hint"
            />
            {/* What can be searched for, in everyday words. */}
            <p id="exercise-search-hint" className="gym-picker__hint">
              {t('gym.picker.searchHint')}
            </p>
          </div>

          {nothing ? (
            <div className="gym-picker__empty" role="status">
              <p>{t('gym.picker.empty', { query: query.trim() })}</p>
              <p>{t('gym.picker.emptyHint')}</p>
            </div>
          ) : searching ? (
            <div className="gym-picker__list">{matches.map(row)}</div>
          ) : (
            <div className="gym-picker__list" aria-label={t('gym.picker.groups')}>
              {sections.map((section) => (
                <section key={section.group} className="gym-picker__section" aria-labelledby={`gym-picker-${section.group}`}>
                  <h3 id={`gym-picker-${section.group}`} className="gym-picker__group">
                    {t(MUSCLE_LABEL_KEYS[section.group])}
                  </h3>
                  {section.entries.map(row)}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
