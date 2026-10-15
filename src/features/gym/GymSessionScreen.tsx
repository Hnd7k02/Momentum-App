import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDayAndMonth } from '../../i18n/format';
import type { DateKey } from '../../core/dates';
import type {
  ExerciseLoadType,
  ExerciseRecord,
  GymSessionExerciseSnapshot,
  GymSessionRecord,
  GymSetRecord,
} from '../../core/model';
import { Button, Card, EmptyState, LoadFailure, Section } from '../../components';
import { ChevronLeftIcon, MinusIcon, PlusIcon } from '../../components/Icons';
import { MUSCLE_LABEL_KEYS } from '../../components/BodyRenderer';
import { useI18n, useT } from '../../i18n/I18nProvider';
import { useLoadable } from '../../app/useLoadable';
import { holdChanges } from '../../storage/changes';
import {
  addSessionExercise,
  addSet,
  bodyweightFor,
  createExercise,
  ensureExerciseCatalogue,
  loadDraftView,
  loadSession,
  recordBodyweight,
  removeExerciseFromSession,
  removeSet,
  startSessionFromDraft,
  updateSet,
  type LastRecorded,
  type NewExerciseInput,
  type SessionDraft,
  type SessionExercise,
} from '../../storage/services/gymService';
import { ExercisePicker } from './ExercisePicker';
import { useExerciseNamer } from './exerciseNames';
import './gym.css';

/**
 * Logging a workout.
 *
 * Everything here is shaped by one fact: this screen is used standing between
 * sets, one-handed, sometimes sweating. So —
 *
 * - **Sets save as they are typed.** No confirm, no save button per set, and
 *   no modal between one set and the next.
 * - **The next set is one tap.** It arrives pre-filled with the previous
 *   set's reps and weight, because the second set of an exercise is almost
 *   always the first set again. Typing over a suggestion is faster than
 *   typing into an empty box.
 * - **Numeric keypads, not text fields.** `inputMode="decimal"` for weight,
 *   because 62.5 is a real weight; `numeric` for reps, because 8.5 is not a
 *   real rep count.
 * - **One sheet in the whole flow**, for picking an exercise. Everything else
 *   is on the page.
 *
 * ## A planned workout (WP2-1)
 *
 * Opened from a plan, the screen starts as a **draft**: every exercise of
 * the plan is on the page, in the plan's order, with an empty first set to
 * type into and what the user did last time beside it. Nothing is stored.
 * The session comes into being with the **first saved set** — that is the
 * moment there is a workout to record — and from then on the screen is the
 * ordinary session screen over a session that owns its own exercise
 * snapshot. Opening a plan and walking away therefore leaves no session
 * behind and credits nothing.
 *
 * A free session is unchanged: it is created when it is opened, exactly as
 * it was, and every exercise arrives with one set.
 */

const grams = (text: string): number => {
  const value = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(value) ? Math.round(value * 1000) : 0;
};

const kgText = (weightGrams: number): string => {
  const kg = weightGrams / 1000;
  // Whole numbers read as whole numbers; 62.5 keeps its half, 60.25 its quarter.
  return Number.isInteger(kg) ? String(kg) : String(Number(kg.toFixed(3)));
};

/**
 * What the weight box on a set actually means, which is not always "weight".
 *
 * A pull-up logged as 0 kg is not a lift of nothing and an assisted pull-up
 * logged as 25 kg is not a 25 kg lift, so the field says which number it is
 * asking for rather than leaving the user to infer it from the exercise.
 */
const LOAD_LABEL_KEYS = {
  external: 'gym.load.external',
  bodyweight: 'gym.load.bodyweight',
  assisted: 'gym.load.assisted',
} as const satisfies Record<ExerciseLoadType, string>;

const LOAD_HINT_KEYS = {
  external: 'gym.load.externalHint',
  bodyweight: 'gym.load.bodyweightHint',
  assisted: 'gym.load.assistedHint',
} as const satisfies Record<ExerciseLoadType, string>;

function SetRow({
  set,
  index,
  exerciseName,
  loadType,
  editable,
  onChange,
  onRemove,
}: {
  set: GymSetRecord;
  index: number;
  exerciseName: string;
  loadType: ExerciseLoadType;
  editable: boolean;
  onChange(patch: { reps?: number; weightGrams?: number }): void;
  onRemove(): void;
}) {
  const t = useT();
  const [reps, setReps] = useState(String(set.reps));
  const [weight, setWeight] = useState(kgText(set.weightGrams));

  // A reload after a write brings the stored values back; the fields follow
  // them rather than holding whatever was half-typed before.
  useEffect(() => {
    setReps(String(set.reps));
    setWeight(kgText(set.weightGrams));
  }, [set.id, set.reps, set.weightGrams]);

  return (
    <div className="gym-set">
      <span className="gym-set__number" aria-hidden="true">
        {index + 1}
      </span>

      <label className="gym-set__field">
        <span className="visually-hidden">
          {t('gym.repsFor', { exercise: exerciseName, number: index + 1 })}
        </span>
        <input
          className="field gym-set__input"
          value={reps}
          inputMode="numeric"
          disabled={!editable}
          onChange={(event) => setReps(event.target.value.replace(/[^0-9]/g, ''))}
          onBlur={() => onChange({ reps: Number(reps || 0) })}
        />
        <span className="gym-set__unit" aria-hidden="true">
          {t('gym.reps')}
        </span>
      </label>

      <label className="gym-set__field">
        <span className="visually-hidden">
          {`${t(LOAD_LABEL_KEYS[loadType])} — ${t('gym.weightFor', {
            exercise: exerciseName,
            number: index + 1,
          })}`}
        </span>
        <input
          className="field gym-set__input"
          value={weight}
          inputMode="decimal"
          disabled={!editable}
          onChange={(event) => setWeight(event.target.value.replace(/[^0-9.,]/g, ''))}
          onBlur={() => onChange({ weightGrams: grams(weight) })}
        />
        <span className="gym-set__unit" aria-hidden="true">
          {t('gym.weightUnit')}
        </span>
      </label>

      <button
        type="button"
        className="gym-set__remove"
        aria-label={t('gym.removeSet', { number: index + 1, exercise: exerciseName })}
        disabled={!editable}
        onClick={onRemove}
      >
        <MinusIcon size={18} />
      </button>
    </div>
  );
}

/**
 * The first set of a planned exercise, before it exists.
 *
 * It looks like a set row and is typed into like one, but it is only state
 * until it says something: reps, and a weight — or, for a bodyweight
 * exercise, reps alone. Then it is saved, once, and becomes a real set. A
 * row the user never fills in never writes anything, which is what keeps a
 * plan that was merely opened out of the record.
 */
function PendingSetRow({
  exerciseName,
  loadType,
  placeholder,
  editable,
  onCommit,
}: {
  exerciseName: string;
  loadType: ExerciseLoadType;
  /** What the user did last time, shown greyed until they type. */
  placeholder: { reps: number; weightGrams: number } | null;
  editable: boolean;
  onCommit(values: { reps: number; weightGrams: number }): void;
}) {
  const t = useT();
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const committed = useRef(false);

  const tryCommit = () => {
    if (committed.current) return;
    const repsValue = Number(reps || 0);
    const weightKnown = weight.trim() !== '' || loadType !== 'external';
    if (repsValue <= 0 || !weightKnown) return;
    committed.current = true;
    onCommit({ reps: repsValue, weightGrams: grams(weight) });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  };

  return (
    <div className="gym-set gym-set--pending">
      <span className="gym-set__number" aria-hidden="true">
        1
      </span>

      <label className="gym-set__field">
        <span className="visually-hidden">
          {t('gym.repsFor', { exercise: exerciseName, number: 1 })}
        </span>
        <input
          className="field gym-set__input"
          value={reps}
          placeholder={placeholder ? String(placeholder.reps) : undefined}
          inputMode="numeric"
          enterKeyHint="done"
          disabled={!editable}
          onChange={(event) => setReps(event.target.value.replace(/[^0-9]/g, ''))}
          onBlur={tryCommit}
          onKeyDown={onKeyDown}
        />
        <span className="gym-set__unit" aria-hidden="true">
          {t('gym.reps')}
        </span>
      </label>

      <label className="gym-set__field">
        <span className="visually-hidden">
          {`${t(LOAD_LABEL_KEYS[loadType])} — ${t('gym.weightFor', { exercise: exerciseName, number: 1 })}`}
        </span>
        <input
          className="field gym-set__input"
          value={weight}
          placeholder={placeholder ? kgText(placeholder.weightGrams) : undefined}
          inputMode="decimal"
          enterKeyHint="done"
          disabled={!editable}
          onChange={(event) => setWeight(event.target.value.replace(/[^0-9.,]/g, ''))}
          onBlur={tryCommit}
          onKeyDown={onKeyDown}
        />
        <span className="gym-set__unit" aria-hidden="true">
          {t('gym.weightUnit')}
        </span>
      </label>

      {/* Keeps the row's geometry identical to a saved set's. */}
      <span className="gym-set__remove gym-set__remove--spacer" aria-hidden="true" />
    </div>
  );
}

/** "Zuletzt am 3. Sep · 8 × 60 kg · 8 × 60 kg", on one compact line. */
function LastTimeLine({ last }: { last: LastRecorded | null }) {
  const t = useT();
  const { language } = useI18n();
  if (!last || last.sets.length === 0) return null;
  const sets = last.sets
    .map((set) => t('gym.lastTime.set', { reps: set.reps, weight: kgText(set.weightGrams) }))
    .join(' · ');
  return (
    <p className="gym-exercise__last">
      {t('gym.lastTime', { date: formatDayAndMonth(language, last.date) })} · {sets}
    </p>
  );
}

/**
 * Recording what the user weighs, where they need it.
 *
 * It sits in the session rather than in a profile screen because that is
 * where it is missed: a pull-up cannot be scored without it, and being told
 * so on the screen that will not score it is more use than a setting
 * somewhere else. Entering it is optional and nothing nags — the card only
 * insists when a bodyweight exercise is actually in the session.
 */
function BodyweightCard({
  date,
  current,
  editable,
  needed,
  onSave,
}: {
  date: DateKey;
  current: number | null;
  editable: boolean;
  needed: boolean;
  onSave(kg: number): void;
}) {
  const t = useT();
  const { language } = useI18n();
  const [value, setValue] = useState(current === null ? '' : String(current));

  useEffect(() => {
    setValue(current === null ? '' : String(current));
  }, [current]);

  const parsed = Number.parseFloat(value.replace(',', '.'));
  const valid = Number.isFinite(parsed) && parsed > 0;

  return (
    <Section label={t('gym.bodyweight.title')}>
      <Card>
        <label className="gym-bodyweight">
          <span className="visually-hidden">{t('gym.bodyweight.label')}</span>
          <input
            className="field gym-bodyweight__input"
            value={value}
            inputMode="decimal"
            disabled={!editable}
            onChange={(event) => setValue(event.target.value.replace(/[^0-9.,]/g, ''))}
          />
          <span className="gym-set__unit" aria-hidden="true">
            {t('gym.weightUnit')}
          </span>
          <Button
            variant="secondary"
            disabled={!editable || !valid}
            onClick={() => valid && onSave(parsed)}
          >
            {t('gym.bodyweight.save')}
          </Button>
        </label>
        <p className="gym-exercise__best">
          {current === null
            ? t('gym.bodyweight.none')
            : t('gym.bodyweight.asOf', { date: formatDayAndMonth(language, date) })}
        </p>
        {needed && current === null ? (
          <p className="gym-session__closed" role="status">
            {t('gym.bodyweight.needed')}
          </p>
        ) : null}
      </Card>
    </Section>
  );
}

interface ScreenView {
  /** `null` while the workout is still a draft. */
  session: GymSessionRecord | null;
  exercises: SessionExercise[];
  editable: boolean;
}

export function GymSessionScreen({
  sessionId,
  draft = null,
  planName = null,
  date,
  onSessionCreated,
  onClose,
}: {
  /** An existing session, or `null` to start from `draft`. */
  sessionId: string | null;
  /** A planned workout that has not been persisted yet. */
  draft?: SessionDraft | null;
  /** Shown under the title while the draft is open, so the user knows which plan this is. */
  planName?: string | null;
  /**
   * The day a draft or a new session belongs to. An existing session is
   * shown on its own day, whatever this says.
   */
  date: DateKey;
  /** Told the id the moment the draft becomes a session. */
  onSessionCreated?(id: string): void;
  onClose(): void;
}) {
  const t = useT();
  const { language } = useI18n();
  const namer = useExerciseNamer();
  const [picking, setPicking] = useState(false);
  const [exercises, setExercises] = useState<ExerciseRecord[]>([]);
  const [bodyweight, setBodyweight] = useState<number | null>(null);
  const busy = useRef(false);

  /*
   * The session id lives in a ref as well as in state: the loader reads the
   * ref, so a reload issued right after the draft became a session reads
   * the session, whether or not React has re-rendered in between.
   */
  const sessionRef = useRef<string | null>(sessionId);
  const [, setActiveSessionId] = useState<string | null>(sessionId);
  /** The draft's exercises, held here until the first set makes them a snapshot. */
  const draftRef = useRef<GymSessionExerciseSnapshot[]>(draft?.exercises ?? []);
  const [draftVersion, setDraftVersion] = useState(0);

  const load = useCallback(async (): Promise<ScreenView> => {
    const id = sessionRef.current;
    if (id) {
      const view = await loadSession(id);
      if (!view) throw new Error(`Unknown session ${id}`);
      return view;
    }
    const view = await loadDraftView(
      { planId: draft?.planId ?? null, exercises: draftRef.current },
      date,
    );
    return { session: null, ...view };
  }, [draft?.planId, date]);
  const { state, reload } = useLoadable(load, [draft?.planId, date]);
  /** The day this workout is on: the session's own once there is one. */
  const day = state.status === 'ready' && state.value.session ? state.value.session.date : date;

  /*
   * Nothing behind a full-screen workout is on show, so the store's change
   * signal is held while it is open (WP3, B2): otherwise every saved set
   * would replay the Boss for screens nobody can see. Closing releases it
   * before the host re-renders, so the screen underneath loads once, against
   * everything the workout wrote.
   */
  const releaseChanges = useRef<(() => void) | null>(null);
  /** Set once the screen is closing or gone; nothing is reported after it. */
  const closed = useRef(false);
  /** The write in flight, if any — the one a tap's blur may just have started. */
  const pending = useRef<Promise<unknown> | null>(null);
  useEffect(() => {
    // Mounted (again, under StrictMode's double effect in development).
    closed.current = false;
    const release = holdChanges();
    releaseChanges.current = release;
    return () => {
      closed.current = true;
      release();
    };
  }, []);
  /*
   * Closing waits for the write in flight. Tapping "Fertig" with the cursor
   * still in a set's field saves that set on blur, a moment before the tap
   * lands; closing at once would let the host reload before the set — and,
   * for a draft, the session — was stored.
   */
  const close = async () => {
    if (closed.current) return;
    closed.current = true;
    await pending.current;
    releaseChanges.current?.();
    onClose();
  };

  // A draft edited on the page — an exercise added or removed before any
  // set exists — is reloaded like a write would be.
  useEffect(() => {
    if (draftVersion > 0) void reload();
  }, [draftVersion, reload]);

  useEffect(() => {
    void ensureExerciseCatalogue().then(setExercises);
  }, []);

  // The weight in force on the session's own day, not today's: a session
  // opened inside the edit window still reads the body that performed it.
  useEffect(() => {
    void bodyweightFor(day).then(setBodyweight);
  }, [day]);

  /** Writes are serialised so a fast tapper cannot interleave two reloads. */
  const run = useCallback(
    (operation: () => Promise<unknown>) => {
      if (busy.current) return;
      busy.current = true;
      pending.current = operation()
        .catch(() => undefined)
        .then(() => {
          busy.current = false;
          return reload();
        });
    },
    [reload],
  );

  /**
   * The session the next write goes to — the existing one, or the one the
   * draft becomes right now. This is the one place a planned workout is
   * persisted, and it is reached only with a set to save.
   */
  const ensureSession = async (): Promise<string> => {
    const existing = sessionRef.current;
    if (existing) return existing;
    const session = await startSessionFromDraft(
      { planId: draft?.planId ?? null, exercises: draftRef.current },
      date,
    );
    sessionRef.current = session.id;
    setActiveSessionId(session.id);
    // A screen that has already gone must not reopen the workout it left.
    if (!closed.current) onSessionCreated?.(session.id);
    return session.id;
  };

  if (state.status !== 'ready' || !state.value) {
    return (
      <div className="screen gym-session">
        <header className="screen__header gym-session__header">
          <button
            type="button"
            className="button button--quiet gym-session__back"
            onClick={() => void close()}
            aria-label={t('common.back')}
          >
            <ChevronLeftIcon />
          </button>
          <h1 className="screen__title">{t('gym.session')}</h1>
        </header>
        <div className="gym-session__scroll" aria-busy={state.status === 'loading'}>
          {state.status === 'failed' ? (
            <LoadFailure title={t('error.day.title')} onRetry={reload} />
          ) : null}
        </div>
      </div>
    );
  }

  const view = state.value;
  const editable = view.editable;
  const isDraft = view.session === null;
  /** A session that owns its exercise list: a plan session, or the draft. */
  const structured = isDraft || view.session?.exercises !== undefined;
  /* Only asked for when a set in this session actually depends on it. */
  const needsBodyweight = view.exercises.some(
    (entry) => entry.exercise.loadType === 'bodyweight' || entry.exercise.loadType === 'assisted',
  );

  const addExercise = (exercise: ExerciseRecord) => {
    setPicking(false);
    if (isDraft) {
      // Nothing to store yet: the draft grows, and the session it becomes
      // will carry this line as an extra.
      if (!draftRef.current.some((entry) => entry.exerciseId === exercise.id)) {
        draftRef.current = [
          ...draftRef.current,
          { exerciseId: exercise.id, name: exercise.name, order: draftRef.current.length, source: 'extra' },
        ];
      }
      setDraftVersion((version) => version + 1);
      return;
    }
    if (structured) {
      // A plan session names its exercises itself; the first set is typed
      // into the pending row rather than created empty.
      run(() => addSessionExercise(sessionRef.current!, exercise.id));
      return;
    }
    // A free session, exactly as before: a picked exercise arrives with one
    // empty set ready to type into, so choosing an exercise and logging its
    // first set is one gesture.
    run(() => addSet({ sessionId: sessionRef.current!, exerciseId: exercise.id, reps: 0, weightGrams: 0 }));
  };

  const createAndAdd = (input: NewExerciseInput) => {
    setPicking(false);
    void createExercise(input).then(async (exercise) => {
      setExercises(await ensureExerciseCatalogue());
      addExercise(exercise);
    });
  };

  const removeExercise = (exerciseId: string) => {
    if (isDraft) {
      draftRef.current = draftRef.current
        .filter((entry) => entry.exerciseId !== exerciseId)
        .map((entry, index) => ({ ...entry, order: index }));
      setDraftVersion((version) => version + 1);
      return;
    }
    run(() => removeExerciseFromSession(sessionRef.current!, exerciseId));
  };

  return (
    <div className="screen gym-session">
      <header className="screen__header gym-session__header">
        <button
          type="button"
          className="button button--quiet gym-session__back"
          onClick={() => void close()}
          aria-label={t('common.back')}
        >
          <ChevronLeftIcon />
        </button>
        <div>
          <h1 className="screen__title">{t('gym.session')}</h1>
          <p className="gym-session__date">
            {t('gym.sessionOn', { date: formatDayAndMonth(language, day) })}
            {planName ? ` · ${planName}` : ''}
          </p>
        </div>
      </header>

      <div className="gym-session__scroll">
        {!editable ? (
          <p className="gym-session__closed" role="status">
            {t('gym.closed')}
          </p>
        ) : null}

        {needsBodyweight ? (
          <BodyweightCard
            date={day}
            current={bodyweight}
            editable={editable}
            needed
            onSave={(kg) =>
              run(async () => {
                await recordBodyweight(kg, day);
                setBodyweight(kg);
              })
            }
          />
        ) : null}

        {view.exercises.length === 0 ? (
          <Card>
            <EmptyState
              title={t('gym.emptyTitle')}
              body={t('gym.emptyBody')}
              action={
                <Button variant="secondary" onClick={() => setPicking(true)}>
                  <PlusIcon size={18} />
                  {t('gym.addExercise')}
                </Button>
              }
            />
          </Card>
        ) : (
          view.exercises.map((entry) => {
            const last = entry.sets[entry.sets.length - 1];
            const name = namer.name(entry.exercise.id, entry.exercise.name);
            const loadType = entry.exercise.loadType ?? 'external';
            const pending = structured && entry.sets.length === 0;
            return (
              <Section key={entry.exercise.id}>
                <Card>
                  <div className="gym-exercise__header">
                    <span className="gym-exercise__body">
                      <span className="gym-exercise__name">
                        {name}
                        {entry.source === 'extra' ? (
                          <span className="gym-exercise__source">{t('gym.exercise.extra')}</span>
                        ) : null}
                      </span>
                      <span className="gym-exercise__muscles">
                        {namer.describe(
                          entry.exercise.id,
                          entry.exercise.muscles.map((muscle) => t(MUSCLE_LABEL_KEYS[muscle])),
                        )}
                      </span>
                      {entry.exercise.loadType && entry.exercise.loadType !== 'external' ? (
                        <span className="gym-exercise__muscles">
                          {t(LOAD_HINT_KEYS[entry.exercise.loadType])}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="gym-exercise__remove"
                      aria-label={t('gym.removeExercise', { exercise: name })}
                      disabled={!editable}
                      onClick={() => removeExercise(entry.exercise.id)}
                    >
                      <MinusIcon size={18} />
                    </button>
                  </div>

                  <LastTimeLine last={entry.lastRecorded} />

                  {entry.sets.map((set, index) => (
                    <SetRow
                      key={set.id}
                      set={set}
                      index={index}
                      exerciseName={name}
                      loadType={loadType}
                      editable={editable}
                      onChange={(patch) => run(() => updateSet(set.id, patch))}
                      onRemove={() => run(() => removeSet(set.id))}
                    />
                  ))}

                  {pending ? (
                    <PendingSetRow
                      key={`pending-${entry.exercise.id}`}
                      exerciseName={name}
                      loadType={loadType}
                      placeholder={entry.lastRecorded?.sets[0] ?? null}
                      editable={editable}
                      onCommit={(values) =>
                        run(async () => {
                          const id = await ensureSession();
                          await addSet({ sessionId: id, exerciseId: entry.exercise.id, ...values });
                        })
                      }
                    />
                  ) : null}

                  {/* A pending row is its own instruction — the numbered row,
                      "Wdh." and "kg" say what goes where — so no sentence
                      repeats it beneath every exercise. */}
                  {pending ? null : entry.bestScore !== null ? (
                    <p className="gym-exercise__best">
                      {t('gym.bestSet')} ·{' '}
                      {t('gym.bestSetValue', {
                        reps: bestOf(entry.sets).reps,
                        weight: kgText(bestOf(entry.sets).weightGrams),
                      })}
                    </p>
                  ) : (
                    <p className="gym-exercise__best">{t('gym.noSets')}</p>
                  )}

                  {pending ? null : (
                    <button
                      type="button"
                      className="gym-exercise__add"
                      disabled={!editable}
                      aria-label={t('gym.addSetFor', { exercise: name })}
                      onClick={() =>
                        run(() =>
                          addSet({
                            sessionId: sessionRef.current!,
                            exerciseId: entry.exercise.id,
                            // The set before it, because the next set is almost
                            // always the same one again.
                            reps: last?.reps ?? 0,
                            weightGrams: last?.weightGrams ?? 0,
                          }),
                        )
                      }
                    >
                      <PlusIcon size={18} />
                      {t('gym.addSet')}
                    </button>
                  )}
                </Card>
              </Section>
            );
          })
        )}

        {view.exercises.length > 0 ? (
          <Button variant="secondary" block disabled={!editable} onClick={() => setPicking(true)}>
            <PlusIcon size={18} />
            {t('gym.addExercise')}
          </Button>
        ) : null}

        <Button variant="primary" block onClick={() => void close()}>
          {t('gym.done')}
        </Button>
      </div>

      <ExercisePicker
        open={picking}
        exercises={exercises}
        onClose={() => setPicking(false)}
        onPick={addExercise}
        onCreate={createAndAdd}
      />
    </div>
  );
}

/** The set a screen names when it shows "best set". Never used for scoring. */
function bestOf(sets: GymSetRecord[]): GymSetRecord {
  let best = sets[0]!;
  for (const set of sets) {
    if (set.reps * set.weightGrams > best.reps * best.weightGrams) best = set;
  }
  return best;
}
