import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDayAndMonth } from '../../i18n/format';
import { type DateKey } from '../../core/dates';
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
  bodyweightEntryFor,
  createExercise,
  ensureExerciseCatalogue,
  loadDraftView,
  loadSession,
  recordBodyweight,
  finishSession,
  openSessionForDay,
  reinstateSession,
  removeExerciseFromSession,
  removeSet,
  repeatLastSet,
  restoreExercise,
  restoreSet,
  startSessionFromDraft,
  updateSet,
  workoutWritable,
  type LastRecorded,
  type NewExerciseInput,
  type RemovedSet,
  type SessionDraft,
  type SessionExercise,
} from '../../storage/services/gymService';
import { ExercisePicker } from './ExercisePicker';
import { useExerciseNamer } from './exerciseNames';
import './gym.css';
import { useWorld } from '../../app/world';

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
   * What each field last stored or sent, as text. A blur writes when the
   * text differs from this — not from the props, which lag behind a write
   * still in the queue: typing 10, leaving, and typing the stored 8 back
   * before the 10 had come back would otherwise compare 8 with 8, write
   * nothing, and let the 10 land.
   */
  const sentReps = useRef(String(set.reps));
  const sentWeight = useRef(weights.format(set.weightGrams));

  /*
   * A reload after a write brings the stored values back, and each field
   * follows its own value — never the other's, and never while it is being
   * typed into. Re-syncing both on any change lost the weight typed right
   * after the reps: the reps' write reloaded the row and overwrote the
   * half-typed weight with the stored one (WP3, Stage 2).
   */
  useEffect(() => {
    sentReps.current = String(set.reps);
    if (!editingReps.current) setReps(String(set.reps));
  }, [set.id, set.reps]);
  useEffect(() => {
    sentWeight.current = weights.format(set.weightGrams);
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
            // not an edit, and neither is leaving it empty — that is retyping
            // abandoned, not zero reps.
            const value = reps === '' ? null : Number(reps);
            if (value === null || value === Number(sentReps.current)) {
              setReps(sentReps.current);
              return;
            }
            sentReps.current = String(value);
            onChange({ reps: value });
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
            // Only a changed weight is written (D130). In lb the text is
            // rounded to one decimal, so re-parsing an untouched field would
            // move the stored grams (60 000 g → 60 010 g) — a fact the rating
            // replays. "Changed" is the value, not the text: 132,3 is 132.3.
            // An empty field is retyping abandoned, not a load of zero — on
            // a barbell and on an assisted exercise alike; only on a
            // bodyweight exercise is it no added weight.
            const grams = weights.parse(weight);
            const next = grams ?? (loadType === 'bodyweight' ? 0 : null);
            if (next === null || next === weights.parse(sentWeight.current)) {
              setWeight(sentWeight.current);
              return;
            }
            sentWeight.current = weights.format(next);
            onChange({ weightGrams: next });
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
    // Known when it reads as a number: "." or "," is not a load. Only a
    // bodyweight exercise may leave it empty — that is no added weight. An
    // assisted one needs its assistance typed, an explicit 0 included
    // (STOP 2, decision 3): left empty, it would score as no assistance.
    const grams = weights.parse(weight);
    const weightKnown = grams !== null || loadType === 'bodyweight';
    if (repsValue <= 0 || !weightKnown) return;
    committed.current = true;
    void onCommit({ reps: repsValue, weightGrams: grams ?? 0 }).then((stored) => {
      if (!stored) committed.current = false;
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  };

  /*
   * Saved when the focus leaves the row, not a field: moving from the reps
   * to the weight is still typing the one set. Saving on the reps' blur
   * stored a bodyweight set without its added load and replaced the row —
   * and the field being typed into — with the saved set.
   */
  const onRowBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    tryCommit();
  };

  return (
    <div className="gym-set gym-set--pending" onBlur={onRowBlur}>
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
  asOf,
  current,
  editable,
  needed,
  onSave,
}: {
  /** The day the weight in force was entered. */
  asOf: DateKey | null;
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
  // rounded lb text would record 80.014 kg for 80 kg. Unchanged is the
  // value, whichever decimal mark it was typed with.
  const typed = weights.parseBodyweight(value);
  const parsed =
    current !== null && typed !== null && typed === weights.parseBodyweight(weights.formatBodyweight(current))
      ? current
      : typed;
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
          {current === null || asOf === null
            ? t('gym.bodyweight.none')
            : t('gym.bodyweight.asOf', { date: formatDayAndMonth(language, asOf) })}
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
  // The workout is a Gym screen wherever it was opened from (WP3 Stage 6),
  // and from the moment it opens — before any set is saved.
  useWorld('gym');
  const { language } = useI18n();
  const weights = useWeights();
  const namer = useExerciseNamer();
  const [picking, setPicking] = useState(false);
  const [exercises, setExercises] = useState<ExerciseRecord[]>([]);
  /** The weight entry in force on the session's day, and the day it was entered. */
  const [bodyweight, setBodyweight] = useState<{ date: DateKey; kg: number } | null>(null);
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
  /**
   * The session this screen showed until the user emptied it (D137). It is
   * deleted — a session without sets does not exist — and the page carries
   * on as its draft, on its own day: the next set, or the undo, brings it
   * back with the same id, so one workout is never counted twice.
   */
  const goneRef = useRef<GymSessionRecord | null>(null);
  /** The draft's exercises, held here until the first set makes them a snapshot. */
  const draftRef = useRef<GymSessionExerciseSnapshot[]>(draft?.exercises ?? []);
  const [draftVersion, setDraftVersion] = useState(0);

  /*
   * A draft keeps the day it was opened for, exactly as a workout does (WP3,
   * decided at STOP 1, built with P8). Once that day can no longer be
   * written, the page says so and refuses its first set; it never moves to
   * another day. The day turning is read so the page reloads into that state.
   */
  const now = useToday();
  const draftDate = date;
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
      if (view) {
        // A session that owns its structure lists it; a bare one lists its
        // sets and whatever the user picked here and has not logged yet.
        if (view.session.exercises !== undefined) return view;
        return { ...view, exercises: await withKept(view.exercises, view.session.date) };
      }
      // Gone underneath the screen: carry on as its draft.
      sessionRef.current = null;
    }
    const gone = goneRef.current;
    const day = gone?.date ?? draftDate;
    if (gone ? gone.exercises === undefined : free) {
      return { session: null, editable: await workoutWritable(day), exercises: await withKept([], day) };
    }
    const view = await loadDraftView(
      { planId: gone?.planId ?? draft?.planId ?? null, exercises: draftRef.current },
      day,
    );
    return { session: null, ...view };
  }, [draft?.planId, draftDate, free, withKept]);
  const { state, reload } = useLoadable(load, [draft?.planId, draftDate, free, now]);
  /** The day this workout is on: the session's own once there is one. */
  const day =
    state.status === 'ready' && state.value.session
      ? state.value.session.date
      : goneRef.current?.date ?? draftDate;

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
  /** Whether this screen has offered an undo, which must not outlive it. */
  const showedToast = useRef(false);
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
      // Gone without "Zurück" — the host moved on: its undo goes with it.
      if (showedToast.current) dismissToast();
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
    void bodyweightEntryFor(day).then(setBodyweight);
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
    const gone = goneRef.current;
    // An emptied session comes back as itself, with the lines the draft has
    // now (D137); otherwise a free workout becomes a bare session, exactly as
    // one always was, and a planned one carries its draft as its snapshot.
    const session = gone
      ? await reinstateSession(
          gone.exercises === undefined
            ? gone
            : { ...gone, exercises: draftRef.current.map((entry, order) => ({ ...entry, order })) },
        )
      : free
        ? await openSessionForDay(draftDate)
        : await startSessionFromDraft({ planId: draft?.planId ?? null, exercises: draftRef.current }, draftDate);
    goneRef.current = null;
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
  /** A free workout: the free draft, a session that renders from its sets, or one emptied. */
  const freeMode = view.session
    ? view.session.exercises === undefined
    : goneRef.current
      ? goneRef.current.exercises === undefined
      : free;
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
    // Decided in the queue: the first set may be making the draft a session
    // right now, and a line added to the draft after the session copied it
    // would be lost.
    void run(async () => {
      const id = sessionRef.current;
      if (id) {
        // A plan session names its exercises itself; an added one is an
        // extra, its first set typed into the pending row. The plan is
        // never touched.
        await addSessionExercise(id, exercise.id);
        return;
      }
      // A planned draft grows, and the session it becomes will carry this
      // line as an extra.
      if (!draftRef.current.some((entry) => entry.exerciseId === exercise.id)) {
        draftRef.current = [
          ...draftRef.current,
          { exerciseId: exercise.id, name: exercise.name, order: draftRef.current.length, source: 'extra' },
        ];
      }
    });
  };

  const createAndAdd = (input: NewExerciseInput) => {
    setPicking(false);
    void createExercise(input).then(async (exercise) => {
      setExercises(await ensureExerciseCatalogue());
      addExercise(exercise);
    });
  };

  /** An undo that a closed day refused says so (P5, D133). */
  const undone = (stored: boolean) => {
    if (!stored) toast({ message: t('gym.undoRefused') });
  };
  /** An undo for what this screen just removed — unless the screen has gone. */
  const offerUndo = (message: string, undo: () => void) => {
    if (closed.current) return;
    showedToast.current = true;
    toast({ message, action: { label: t('toast.undo'), run: undo } });
  };

  /*
   * Removing an exercise (P5). What is decided here is decided in the queue,
   * after every write before it: the tap that removes an exercise first takes
   * the focus from a field, and that blur may just have saved the
   * exercise's first set — or made the draft a session. So what is stored is
   * deleted and what is only on the page goes from the page, as things stand
   * when the removal's turn comes; and the undo puts back exactly what went,
   * read from what was removed, never from the render (D131).
   */
  /** The session went with its last set (D137): the page carries on as its draft. */
  const sessionWent = (session: GymSessionRecord | null) => {
    if (!session) return;
    goneRef.current = session;
    sessionRef.current = null;
    setActiveSessionId(null);
    if (session.exercises !== undefined) draftRef.current = session.exercises;
  };
  /** An undo put the session back: the page is that session again. */
  const sessionBack = (session: GymSessionRecord | null) => {
    if (!session) return;
    goneRef.current = null;
    sessionRef.current = session.id;
    setActiveSessionId(session.id);
  };

  const removeExercise = (exerciseId: string, name: string) => {
    let removed: {
      sets: GymSetRecord[];
      line: GymSessionExerciseSnapshot | null;
      session: GymSessionRecord | null;
    } | null = null;
    let keptAt = -1;
    let kept: { exerciseId: string; name: string } | undefined;
    const forget = () => {
      keptRef.current = keptRef.current.filter((item) => item.exerciseId !== exerciseId);
    };
    const keepAgain = () => {
      if (!kept || keptRef.current.some((item) => item.exerciseId === exerciseId)) return;
      const next = [...keptRef.current];
      next.splice(Math.min(keptAt, next.length), 0, kept);
      keptRef.current = next;
    };

    void tap(async () => {
      keptAt = keptRef.current.findIndex((item) => item.exerciseId === exerciseId);
      kept = keptRef.current[keptAt];
      const id = sessionRef.current;
      if (id) {
        removed = await removeExerciseFromSession(id, exerciseId);
        sessionWent(removed.session);
      } else {
        // Nothing stored yet: the line leaves the draft.
        const line = draftRef.current.find((entry) => entry.exerciseId === exerciseId) ?? null;
        draftRef.current = draftRef.current
          .filter((entry) => entry.exerciseId !== exerciseId)
          .map((entry, index) => ({ ...entry, order: index }));
        removed = { sets: [], line, session: null };
      }
      forget();
    }).then((ok) => {
      const what = removed;
      if (!ok || !what) return;
      offerUndo(t('gym.removed.exercise', { exercise: name }), () => {
        void run(async () => {
          keepAgain();
          // The session as it is now: a draft may have become one since, and
          // a session the removal emptied comes back as itself (D137).
          const id = sessionRef.current ?? what.session?.id ?? null;
          if (id) {
            await restoreExercise(id, what.sets, what.line, undefined, what.session);
            sessionBack(what.session);
          } else if (what.line && !draftRef.current.some((entry) => entry.exerciseId === exerciseId)) {
            const next = [...draftRef.current];
            next.splice(Math.min(what.line.order, next.length), 0, what.line);
            draftRef.current = next.map((entry, index) => ({ ...entry, order: index }));
          }
        }).then((stored) => {
          if (!stored) forget();
          undone(stored);
        });
      });
    });
  };

  /** Removing a set (P5): the undo puts back the set as it was stored when it went. */
  const removeOneSet = (setId: string, index: number, name: string) => {
    let removed: RemovedSet | undefined;
    void tap(async () => {
      removed = await removeSet(setId);
      sessionWent(removed?.session ?? null);
    }).then((ok) => {
      const what = removed;
      if (!ok || !what) return;
      offerUndo(t('gym.removed.set', { number: index + 1, exercise: name }), () => {
        void run(async () => {
          await restoreSet(what.set, undefined, what.session);
          sessionBack(what.session);
        }).then(undone);
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
            asOf={bodyweight?.date ?? null}
            current={bodyweight?.kg ?? null}
            editable={editable}
            needed
            onSave={(kg) =>
              run(async () => {
                await recordBodyweight(kg, day);
                setBodyweight({ date: day, kg });
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
                      onClick={() => removeExercise(entry.exercise.id, name)}
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
                      onRemove={() => removeOneSet(set.id, index, name)}
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
                        // The set before it, as stored when the tap's turn
                        // comes — an edit its blur just saved included.
                        void tap(() => repeatLastSet(sessionRef.current!, entry.exercise.id))
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
