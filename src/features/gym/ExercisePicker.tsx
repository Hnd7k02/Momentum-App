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
import { useT } from '../../i18n/I18nProvider';
import type { NewExerciseInput } from '../../storage/services/gymService';
import { useExerciseNamer } from './exerciseNames';
import './gym.css';

/**
 * Choosing what to do next.
 *
 * A search box and a flat list, because during a workout the user already
 * knows the name and is holding a phone in one hand. The muscle groups are
 * shown on every row rather than used as a filter: they are what the exercise
 * *counts for*, and seeing them is how a user notices their session is all
 * chest.
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
  const namer = useExerciseNamer();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [primary, setPrimary] = useState<MuscleGroup[]>([]);
  const [loadType, setLoadType] = useState<ExerciseLoadType>('external');
  const nameRef = useRef<HTMLInputElement>(null);

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
   * shown name and the stored one, so "bench" still finds Bankdrücken.
   */
  const offered = useMemo(
    () =>
      exercises
        .filter((exercise) => !catalogueEntry(exercise.id)?.deprecated)
        .map((exercise) => ({
          exercise,
          label: namer.name(exercise.id, exercise.name),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [exercises, namer],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return offered;
    return offered.filter(
      (entry) =>
        entry.label.toLowerCase().includes(needle) ||
        entry.exercise.name.toLowerCase().includes(needle),
    );
  }, [offered, query]);

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
        reset();
        onClose();
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
          <Button variant="secondary" block onClick={() => setCreating(true)}>
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
            />
          </div>

          <div className="gym-picker__list">
            {matches.length === 0 ? (
              <p className="gym-picker__empty">{t('gym.picker.empty')}</p>
            ) : (
              matches.map(({ exercise, label }) => (
                <button
                  key={exercise.id}
                  type="button"
                  className="gym-picker__row"
                  onClick={() => {
                    onPick(exercise);
                    reset();
                  }}
                >
                  <span className="gym-picker__name">{label}</span>
                  <span className="gym-picker__groups">
                    {namer.describe(exercise.id, exercise.muscles.map((muscle) => t(MUSCLE_LABEL_KEYS[muscle])))}
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
