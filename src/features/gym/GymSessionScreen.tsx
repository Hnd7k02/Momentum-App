import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDayAndMonth } from '../../i18n/format';
import { isSameWeek, type DateKey } from '../../core/dates';
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
import { useToday } from '../../app/useToday';
import { useWeights } from '../../app/useWeights';
import { holdChanges } from '../../storage/changes';
import { useDismissToast, useToast, useToastLift } from '../../components/Toast';
import {
  addSessionExercise,
  addSet,
  bodyweightFor,
  createExercise,
  ensureExerciseCatalogue,
  loadDraftView,
  loadSession,
  recordBodyweight,
  finishSession,
  openSessionForDay,
  removeExerciseFromSession,
  removeSet,
  restoreExercise,
  restoreSet,
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
 * ## A free workout (WP3, P6)
 *
 * A free workout is a draft too, until its first saved set: opening it and
 * leaving writes nothing, and a picked exercise arrives with the pending row
 * rather than a stored 0×0 set. At the first saved set it becomes the day's
 * session exactly as before — a bare session, rendering from its sets — and
 * the exercises picked but not yet logged stay on the page, in the order
 * they were picked, until the workout is left.
 *
 * ## Within reach, and undoable (WP3, P5)
 *
 * "Übung hinzufügen" sits in a bar at the foot of the screen for the whole
 * workout. Removing an exercise is a worded control in its card, unlike the
 * row's minus for a set, and both removals offer an undo that puts back the
 * sets, the order and the line.
 *
 * ## Running, then finished (WP3, P7)
 *
 * "Fertig" records that the workout is finished. Going back leaves it
 * running, and Heute offers to continue it.
 */


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
  const weights = useWeights();
  const [reps, setReps] = useState(String(set.reps));
  const [weight, setWeight] = useState(weights.format(set.weightGrams));
  const editingReps = useRef(false);
  const editingWeight = useRef(false);

  /*
   * A reload after a write brings the stored values back, and each field
   * follows its own value — never the other's, and never while it is being
   * typed into. Re-syncing both on any change lost the weight typed right
   * after the reps: the reps' write reloaded the row and overwrote the
   * half-typed weight with the stored one (WP3, Stage 2).
   */
  useEffect(() => {
    if (!editingReps.current) setReps(String(set.reps));
  }, [set.id, set.reps]);
  useEffect(() => {
    if (!editingWeight.current) setWeight(weights.format(set.weightGrams));
  }, [set.id, set.weightGrams, weights]);

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
          onFocus={() => {
            editingReps.current = true;
          }}
          onChange={(event) => setReps(event.target.value.replace(/[^0-9]/g, ''))}
          onBlur={() => {
            editingReps.current = false;
            // Only what was changed is written: leaving a field untouched is
            // not an edit.
            if (reps !== String(set.reps)) onChange({ reps: Number(reps || 0) });
          }}
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
            unitName: t(`unit.${weights.unit}.name`),
          })}`}
        </span>
        <input
          className="field gym-set__input"
          value={weight}
          inputMode="decimal"
          disabled={!editable}
          onFocus={() => {
            editingWeight.current = true;
          }}
          onChange={(event) => setWeight(event.target.value.replace(/[^0-9.,]/g, ''))}
          onBlur={() => {
            editingWeight.current = false;
            // Only a changed weight is written. In lb the text is rounded to
            // one decimal, so re-parsing an untouched field would move the
            // stored grams (60 000 g → 60 010 g) — a fact the rating replays.
            if (weight !== weights.format(set.weightGrams)) onChange({ weightGrams: weights.parse(weight) ?? 0 });
          }}
        />
        <span className="gym-set__unit" aria-hidden="true">
          {weights.unitLabel}
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
  /** Resolves `false` when the set was not stored, so the row can be committed again. */
  onCommit(values: { reps: number; weightGrams: number }): Promise<boolean>;
}) {
  const t = useT();
  const weights = useWeights();
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const committed = useRef(false);

  const tryCommit = () => {
    if (committed.current) return;
    const repsValue = Number(reps || 0);
    const weightKnown = weight.trim() !== '' || loadType !== 'external';
    if (repsValue <= 0 || !weightKnown) return;
    committed.current = true;
    void onCommit({ reps: repsValue, weightGrams: weights.parse(weight) ?? 0 }).then((stored) => {
      if (!stored) committed.current = false;
    });
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
          {`${t(LOAD_LABEL_KEYS[loadType])} — ${t('gym.weightFor', {
            exercise: exerciseName,
            number: 1,
            unitName: t(`unit.${weights.unit}.name`),
          })}`}
        </span>
        <input
          className="field gym-set__input"
          value={weight}
          placeholder={placeholder ? weights.format(placeholder.weightGrams) : undefined}
          inputMode="decimal"
          enterKeyHint="done"
          disabled={!editable}
          onChange={(event) => setWeight(event.target.value.replace(/[^0-9.,]/g, ''))}
          onBlur={tryCommit}
          onKeyDown={onKeyDown}
        />
        <span className="gym-set__unit" aria-hidden="true">
          {weights.unitLabel}
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
  const weights = useWeights();
  if (!last || last.sets.length === 0) return null;
  const sets = last.sets
    .map((set) =>
      t('gym.lastTime.set', { reps: set.reps, weight: weights.format(set.weightGrams), unit: weights.unitLabel }),
    )
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
  const weights = useWeights();
  const [value, setValue] = useState(current === null ? '' : weights.formatBodyweight(current));

  useEffect(() => {
    setValue(current === null ? '' : weights.formatBodyweight(current));
  }, [current, weights]);

  // An unchanged value saves the weight in force exactly: re-parsing its
  // rounded lb text would record 80.014 kg for 80 kg.
  const parsed =
    current !== null && value === weights.formatBodyweight(current) ? current : weights.parseBodyweight(value);
  const valid = parsed !== null && parsed > 0;

  return (
    <Section label={t('gym.bodyweight.title')}>
      <Card>
        <label className="gym-bodyweight">
          <span className="visually-hidden">
            {t('gym.bodyweight.label', { unitName: t(`unit.${weights.unit}.name`) })}
          </span>
          <input
            className="field gym-bodyweight__input"
            value={value}
            inputMode="decimal"
            disabled={!editable}
            onChange={(event) => setValue(event.target.value.replace(/[^0-9.,]/g, ''))}
          />
          <span className="gym-set__unit" aria-hidden="true">
            {weights.unitLabel}
          </span>
          <Button
            variant="secondary"
            disabled={!editable || !valid}
            onClick={() => valid && parsed !== null && onSave(parsed)}
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
  free = false,
  onSessionCreated,
  onClose,
}: {
  /** An existing session, or `null` to start from `draft`. */
  sessionId: string | null;
  /** A planned workout that has not been persisted yet. */
  draft?: SessionDraft | null;
  /** A free workout that has not been persisted yet: no plan, nothing picked. */
  free?: boolean;
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
  const weights = useWeights();
  const namer = useExerciseNamer();
  const [picking, setPicking] = useState(false);
  const [exercises, setExercises] = useState<ExerciseRecord[]>([]);
  const [bodyweight, setBodyweight] = useState<number | null>(null);
  const toast = useToast();
  /** The writes, one after another; nothing typed is ever turned away. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  /** A tapped action in flight: a second tap meanwhile is the same tap. */
  const tapping = useRef(false);
  /**
   * A free workout's exercises as the page shows them, in the order they
   * were picked or first shown. A stored set is not needed to be here, so a
   * picked exercise — and one whose last set was removed — stays on the
   * page until the workout is left (P6).
   */
  const keptRef = useRef<{ exerciseId: string; name: string }[]>([]);

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

  /*
   * A draft has written nothing, so it holds the day it was opened for only
   * while that day's week is open. A Sunday draft still open after Monday
   * 00:00 moves to today: kept on Sunday, every set would be refused by the
   * closed week.
   *
   * Temporary, by decision (WP3, STOP 1): once Stage 3 keeps yesterday
   * editable, this move goes and a draft keeps the day it was opened for,
   * exactly as a workout does.
   */
  const now = useToday();
  const draftDate = isSameWeek(date, now) ? date : now;
  /**
   * A free workout's entries: the stored ones, plus every kept exercise
   * without a set, each where it was kept. An exercise shown once is kept.
   */
  const withKept = useCallback(async (stored: SessionExercise[], day: DateKey): Promise<SessionExercise[]> => {
    for (const entry of stored) {
      if (!keptRef.current.some((kept) => kept.exerciseId === entry.exercise.id)) {
        keptRef.current = [...keptRef.current, { exerciseId: entry.exercise.id, name: entry.exercise.name }];
      }
    }
    const missing = keptRef.current.filter((kept) => !stored.some((entry) => entry.exercise.id === kept.exerciseId));
    const waiting =
      missing.length === 0
        ? []
        : (
            await loadDraftView(
              {
                planId: null,
                exercises: missing.map((kept, order) => ({ ...kept, order, source: 'extra' as const })),
              },
              day,
            )
          ).exercises.map((entry) => ({ ...entry, source: null }));
    const byId = new Map([...stored, ...waiting].map((entry) => [entry.exercise.id, entry]));
    return keptRef.current.flatMap((kept) => byId.get(kept.exerciseId) ?? []);
  }, []);

  const load = useCallback(async (): Promise<ScreenView> => {
    const id = sessionRef.current;
    if (id) {
      const view = await loadSession(id);
      if (!view) throw new Error(`Unknown session ${id}`);
      // A session that owns its structure lists it; a bare one lists its sets
      // and whatever the user picked here and has not logged yet.
      if (view.session.exercises !== undefined) return view;
      return { ...view, exercises: await withKept(view.exercises, view.session.date) };
    }
    if (free) return { session: null, editable: true, exercises: await withKept([], draftDate) };
    const view = await loadDraftView(
      { planId: draft?.planId ?? null, exercises: draftRef.current },
      draftDate,
    );
    return { session: null, ...view };
  }, [draft?.planId, draftDate, free, withKept]);
  const { state, reload } = useLoadable(load, [draft?.planId, draftDate, free]);
  /** The day this workout is on: the session's own once there is one. */
  const day = state.status === 'ready' && state.value.session ? state.value.session.date : draftDate;

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
  const dismissToast = useDismissToast();
  // The undo toast rises above the bar at the foot of the screen (P5).
  useToastLift('calc(var(--workout-bar-height) - var(--tab-bar-height))');
  useEffect(() => {
    // Mounted (again, under StrictMode's double effect in development).
    closed.current = false;
    // Opening the workout is a new task, as opening a sheet is: an undo
    // left floating over its bottom bar could be hit instead of it.
    dismissToast();
    const release = holdChanges();
    releaseChanges.current = release;
    return () => {
      closed.current = true;
      release();
    };
  }, [dismissToast]);
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
    // An undo belongs to the workout it came from; it does not follow the
    // user back to Heute.
    dismissToast();
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

  /**
   * Writes run one after another, each followed by its reload, so two never
   * interleave — and none is turned away: a weight typed while the reps are
   * still saving waits its turn instead of being dropped (WP3, Stage 2).
   * Resolves `true` once stored, `false` when a rule refused it.
   */
  const run = useCallback(
    (operation: () => Promise<unknown>): Promise<boolean> => {
      const task = queue.current
        .then(operation)
        .then(
          () => true,
          () => false,
        )
        .then(async (stored) => {
          await reload();
          return stored;
        });
      queue.current = task;
      pending.current = task;
      return task;
    },
    [reload],
  );

  /** A tapped action — add a set, remove one: a double tap is one tap. */
  const tap = useCallback(
    (operation: () => Promise<unknown>): Promise<boolean> => {
      if (tapping.current) return Promise.resolve(false);
      tapping.current = true;
      return run(operation).finally(() => {
        tapping.current = false;
      });
    },
    [run],
  );

  /**
   * The session the next write goes to — the existing one, or the one the
   * draft becomes right now. This is the one place a planned workout is
   * persisted, and it is reached only with a set to save.
   */
  const ensureSession = async (): Promise<string> => {
    const existing = sessionRef.current;
    if (existing) return existing;
    // A free workout becomes a bare session, exactly as one always was; a
    // planned one carries its draft as the session's own snapshot.
    const session = free
      ? await openSessionForDay(draftDate)
      : await startSessionFromDraft({ planId: draft?.planId ?? null, exercises: draftRef.current }, draftDate);
    sessionRef.current = session.id;
    setActiveSessionId(session.id);
    // A screen that has already gone must not reopen the workout it left.
    if (!closed.current) onSessionCreated?.(session.id);
    return session.id;
  };

  /** "Fertig": the workout is finished (P7), once the write in flight is stored. */
  const finishing = useRef(false);
  const finish = async () => {
    if (finishing.current || closed.current) return;
    finishing.current = true;
    // Read when its turn comes: a set saved on the tap's blur, queued first,
    // may be what creates the session.
    await run(async () => {
      const id = sessionRef.current;
      if (id) await finishSession(id);
    });
    await close();
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
  /** A free workout: the free draft, or a session that renders from its sets. */
  const freeMode = isDraft ? free : view.session?.exercises === undefined;
  /* Only asked for when a set in this session actually depends on it. */
  const needsBodyweight = view.exercises.some(
    (entry) => entry.exercise.loadType === 'bodyweight' || entry.exercise.loadType === 'assisted',
  );

  const addExercise = (exercise: ExerciseRecord) => {
    setPicking(false);
    if (freeMode) {
      // A free workout keeps it on the page with the pending row; nothing is
      // stored until a set is (P6). Picking it twice changes nothing.
      if (!keptRef.current.some((kept) => kept.exerciseId === exercise.id)) {
        keptRef.current = [...keptRef.current, { exerciseId: exercise.id, name: exercise.name }];
      }
      setDraftVersion((version) => version + 1);
      return;
    }
    if (sessionRef.current === null) {
      // A planned draft grows, and the session it becomes will carry this
      // line as an extra. Read from the ref: the draft may have become a
      // session since this render.
      if (!draftRef.current.some((entry) => entry.exerciseId === exercise.id)) {
        draftRef.current = [
          ...draftRef.current,
          { exerciseId: exercise.id, name: exercise.name, order: draftRef.current.length, source: 'extra' },
        ];
      }
      setDraftVersion((version) => version + 1);
      return;
    }
    // A plan session names its exercises itself; an added one is an extra,
    // its first set typed into the pending row. The plan is never touched.
    void tap(() => addSessionExercise(sessionRef.current!, exercise.id));
  };

  const createAndAdd = (input: NewExerciseInput) => {
    setPicking(false);
    void createExercise(input).then(async (exercise) => {
      setExercises(await ensureExerciseCatalogue());
      addExercise(exercise);
    });
  };

  /** An undo that a closed week refused says so (P5). */
  const undone = (stored: boolean) => {
    if (!stored) toast({ message: t('gym.undoRefused') });
  };

  /*
   * Removing an exercise (P5). What is only on the page goes from the page;
   * what is stored is deleted. Either way the toast's undo puts back exactly
   * what went: the sets, the line and its place.
   */
  const removeExercise = (entry: SessionExercise, name: string) => {
    const exerciseId = entry.exercise.id;
    const message = t('gym.removed.exercise', { exercise: name });
    const keptAt = keptRef.current.findIndex((kept) => kept.exerciseId === exerciseId);
    const kept = keptRef.current[keptAt];
    const forget = () => {
      keptRef.current = keptRef.current.filter((item) => item.exerciseId !== exerciseId);
    };
    const keepAgain = () => {
      if (!kept || keptRef.current.some((item) => item.exerciseId === exerciseId)) return;
      const next = [...keptRef.current];
      next.splice(Math.min(keptAt, next.length), 0, kept);
      keptRef.current = next;
    };

    if (entry.sets.length === 0 && (freeMode || isDraft)) {
      const draftAt = draftRef.current.findIndex((line) => line.exerciseId === exerciseId);
      const draftLine = draftRef.current[draftAt];
      forget();
      draftRef.current = draftRef.current
        .filter((line) => line.exerciseId !== exerciseId)
        .map((line, index) => ({ ...line, order: index }));
      setDraftVersion((version) => version + 1);
      toast({
        message,
        action: {
          label: t('toast.undo'),
          run: () => {
            keepAgain();
            if (draftLine && !draftRef.current.some((line) => line.exerciseId === exerciseId)) {
              const next = [...draftRef.current];
              next.splice(Math.min(draftAt, next.length), 0, draftLine);
              draftRef.current = next.map((line, index) => ({ ...line, order: index }));
            }
            setDraftVersion((version) => version + 1);
          },
        },
      });
      return;
    }

    const sessionId = sessionRef.current!;
    const sets = entry.sets;
    const line = view.session?.exercises?.find((item) => item.exerciseId === exerciseId) ?? null;
    void tap(async () => {
      await removeExerciseFromSession(sessionId, exerciseId);
      forget();
    }).then((removed) => {
      if (!removed) return;
      toast({
        message,
        action: {
          label: t('toast.undo'),
          run: () => {
            keepAgain();
            void run(() => restoreExercise(sessionId, sets, line)).then((stored) => {
              if (!stored) forget();
              undone(stored);
            });
          },
        },
      });
    });
  };

  /** Removing a set (P5), with the same undo. */
  const removeOneSet = (set: GymSetRecord, index: number, name: string) => {
    void tap(() => removeSet(set.id)).then((removed) => {
      if (!removed) return;
      toast({
        message: t('gym.removed.set', { number: index + 1, exercise: name }),
        action: {
          label: t('toast.undo'),
          run: () => void run(() => restoreSet(set)).then(undone),
        },
      });
    });
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
            {/* "Übung hinzufügen" is the bar below, always in reach. */}
            <EmptyState title={t('gym.emptyTitle')} body={t('gym.emptyBody')} />
          </Card>
        ) : (
          view.exercises.map((entry) => {
            const last = entry.sets[entry.sets.length - 1];
            const name = namer.name(entry.exercise.id, entry.exercise.name);
            const loadType = entry.exercise.loadType ?? 'external';
            // An exercise without a stored set is typed into once, then saved
            // — in a plan, a draft and a free workout alike (P6).
            const pending = entry.sets.length === 0;
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
                      onClick={() => removeExercise(entry, name)}
                    >
                      {t('gym.removeExercise.short')}
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
                      onChange={(patch) => void run(() => updateSet(set.id, patch))}
                      onRemove={() => removeOneSet(set, index, name)}
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
                        weight: weights.format(bestOf(entry.sets).weightGrams),
                        unit: weights.unitLabel,
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
                        void tap(() =>
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

        <Button variant="primary" block onClick={() => void finish()}>
          {t('gym.done')}
        </Button>
      </div>

      <div className="gym-session__bar">
        <Button variant="secondary" block disabled={!editable} onClick={() => setPicking(true)}>
          <PlusIcon size={18} />
          {t('gym.addExercise')}
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
