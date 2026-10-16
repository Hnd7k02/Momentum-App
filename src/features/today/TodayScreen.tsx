import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { addDays, weekKeyOf } from '../../core/dates';
import type { StoredDomainType } from '../../core/model';
import type { DomainTerminal } from '../../app/route';
import { useToday } from '../../app/useToday';
import { useDataVersion } from '../../app/useDataVersion';
import { useLoadable } from '../../app/useLoadable';
import { loadRunningWorkout } from '../../storage/services/gymService';
import { RunningWorkoutCard } from '../gym/RunningWorkoutCard';
import { useToast } from '../../components/Toast';
import { Button, Card, EmptyState, LoadFailure, Row, Section, Segmented, StaleNotice, focusTarget } from '../../components';
import { ChevronRightIcon, PlusIcon, SparkIcon } from '../../components/Icons';
import { SessionSheet } from '../../domains/sports/SessionSheet';
import { formatDayAndMonth, formatTime, formatWeekday } from '../../i18n/format';
import { useI18n, useT } from '../../i18n/I18nProvider';
import { yesterdayOutstanding, type TrainingSession } from '../../storage/services/checkInService';
import type { TranslationKey } from '../../i18n';
import { FoodCard } from '../food/FoodCard';
import { FoodEntrySheet } from '../food/FoodEntrySheet';
import '../pause/pause.css';
import { useTrainingLauncher } from '../gym/useTrainingLauncher';
import { BossSummary } from './BossSummary';
import { CheckInItem } from './CheckInItem';
import { useDay } from './useDay';
import './today.css';

/** How long a one-tap log stays busy after its write has landed. */
const LOG_SETTLE_MS = 600;

/** The two days Heute can show (WP3, P8 — D138). */
type ShownDay = 'today' | 'yesterday';

/** Titles and log labels per training domain, including the retired one. */
const TRAINING_COPY: Record<StoredDomainType, { title: TranslationKey; log: TranslationKey }> = {
  mental: { title: 'domain.wellbeing', log: 'sports.log' },
  food: { title: 'domain.food', log: 'sports.log' },
  gym: { title: 'today.gym.title', log: 'today.gym.log' },
  running: { title: 'today.running.title', log: 'today.running.log' },
  sports: { title: 'domain.legacySport', log: 'sports.log' },
};

/**
 * The primary interaction point: what is due today, grouped by domain, and
 * nothing else. Answers save on tap — no confirm buttons — and there are no
 * charts here, because this screen is for acting, not for analysis.
 *
 * Training is a list rather than one card: Gym and Running are separate
 * quotas, so a week that met one and missed the other has to read that way.
 *
 * **Heute | Gestern** (WP3, P8 — D138). Anything can be written for today
 * and yesterday, and nothing older, so the screen shows one of exactly those
 * two days: the questions, Food, Gym (start or continue yesterday's session)
 * and Laufen all follow the switch, and every write goes to the day on show.
 * The switch is relative and follows B3: at midnight "Heute" becomes the new
 * day and "Gestern" the one that was today, and the screen moves before it
 * accepts input either way. A yesterday the write rule no longer opens — the
 * update day, when yesterday was lived under the old rules — is shown
 * read-only with the closed copy.
 */
export function TodayScreen({
  onGoToAreas,
  onGoToRank,
  onOpenGym,
}: {
  /** Bereiche, optionally opened on a given area. */
  onGoToAreas(terminal?: DomainTerminal): void;
  onGoToRank?(): void;
  /** The Gym hub (WP2-2): logging or muscle progress, the user's choice. */
  onOpenGym?(): void;
}) {
  const t = useT();
  const { language } = useI18n();
  // One "today" for the whole app (WP3, B3): it moves at local midnight, when
  // the app comes back to the foreground, and at the start of any input.
  const today = useToday();
  const [shown, setShown] = useState<ShownDay>('today');
  /** The day on show, and so the day every write here goes to. */
  const date = shown === 'today' ? today : addDays(today, -1);
  const toast = useToast();
  const {
    state,
    answer,
    logSession,
    updateSession,
    deleteSession,
    rateFood,
    clearFoodRating,
    addFoodEntry,
    removeFoodEntry,
    reload,
  } = useDay(date);
  /*
   * Today's workout while it is under way (WP3, P7). Read only, from the
   * session itself; it moves when a workout writes, which reaches here
   * through the change signal once the workout closes.
   */
  const version = useDataVersion();
  const loadWorkout = useCallback(() => loadRunningWorkout(date), [date]);
  const { state: workoutState } = useLoadable(loadWorkout, [date], [version]);
  const runningWorkout = workoutState.status === 'ready' ? workoutState.value : null;
  /*
   * Whether yesterday still owes an answer that can be given (STOP 3a, Q8).
   * Read from storage, so answering it from the Gestern side clears the
   * line by the time the switch is back on Heute.
   */
  const loadOutstanding = useCallback(() => yesterdayOutstanding(today), [today]);
  const { state: outstandingState } = useLoadable(loadOutstanding, [today], [version]);
  const yesterdayOpen = outstandingState.status === 'ready' && outstandingState.value;
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [addingFood, setAddingFood] = useState(false);
  /** The run the sheet was last opened for, so focus can find its row again. */
  const lastEdited = useRef<string | null>(null);
  /*
   * One-tap logging is one write per tap (WP3, B9). A double tap logged two
   * runs and called the week met; the ref turns the second tap away before
   * React has re-rendered the busy button, and the toast makes the one that
   * did land reversible. The guard outlasts the write by a moment: a write
   * and its reload can finish within one key repeat, and a double press or a
   * held Enter would otherwise log again.
   */
  const logging = useRef(false);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (settle.current !== null) clearTimeout(settle.current);
  }, []);
  const [loggingDomain, setLoggingDomain] = useState<StoredDomainType | null>(null);
  const logOnce = async (domain: StoredDomainType) => {
    if (logging.current) return;
    logging.current = true;
    setLoggingDomain(domain);
    try {
      const session = await logSession(domain);
      if (session && domain === 'running') {
        toast({
          message: t('today.running.logged'),
          action: {
            label: t('toast.undo'),
            // An undo tapped once the run's day has left the window — a run
            // logged for yesterday, undone after midnight — is refused; it
            // says so rather than leaving the run in place silently.
            run: () =>
              void deleteSession(domain, session.id).then((deleted) => {
                if (!deleted) toast({ message: t('today.running.undoRefused') });
              }),
          },
        });
      }
    } finally {
      settle.current = setTimeout(() => {
        settle.current = null;
        logging.current = false;
        setLoggingDomain(null);
      }, LOG_SETTLE_MS);
    }
  };
  /*
   * A gym session is not a diary line with a note on it — it holds exercises
   * and sets — so tapping one opens the logging screen rather than the sheet
   * the other training logs use. The quick-log flow — continue today's
   * session, or choose a plan, or open a free session — is the launcher the
   * Gym hub shares (WP2-1, WP2-2); it stays one tap from here.
   */
  const gym = useTrainingLauncher({
    date,
    onClosed: () => void reload(),
    onManagePlans: () => onGoToAreas('gym'),
  });

  /*
   * Where the user was in the day. The gate below empties the scroll port
   * while a new day loads, and the browser puts it back at the top; a sheet
   * kept open across midnight would otherwise close onto the top of the
   * list. The same goes for the list coming back after a workout.
   */
  const scrollPort = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);
  const showsDay = state.status === 'ready' && state.value.date === date;
  useLayoutEffect(() => {
    if (showsDay && !gym.open && scrollPort.current) scrollPort.current.scrollTop = savedScroll.current;
  }, [showsDay, gym.open]);

  /** The user's own switch starts the other day at its top; midnight does not. */
  const show = (next: ShownDay) => {
    if (next === shown) return;
    savedScroll.current = 0;
    setShown(next);
  };

  /*
   * The workout belongs to its own session, not to the day on show, so it is
   * never behind the gate below: a day turning under an open workout must
   * not unmount it (WP3, B3).
   */
  if (gym.open) return <>{gym.overlay}</>;

  /*
   * The same holds for what floats over the day: the plan chooser, the run
   * sheet and the food entry sheet. They are rendered in both branches under
   * the same keys, so React keeps them — and whatever has been typed into
   * them — when the gate closes and opens again around midnight. The run
   * sheet edits a run by id; a food entry is saved to the day the screen
   * shows when it is saved, as every write here is (B3).
   */
  const editingDays =
    editingSession && state.status === 'ready'
      ? state.value.training.find((entry) => entry.domain === editingSession.domain)?.writableDays ?? []
      : [];
  const floating = (
    <>
      <Fragment key="gym-overlay">{gym.overlay}</Fragment>
      <SessionSheet
        key="run-sheet"
        open={editingSession !== null}
        session={editingSession}
        days={editingDays}
        returnFocus={() => (lastEdited.current ? focusTarget(`session-${lastEdited.current}`) : null)}
        onClose={() => setEditingSession(null)}
        // A write the window refuses — the run's day closed while the sheet
        // was open — is said out loud rather than dropped silently.
        onSave={(input) => {
          if (editingSession) {
            void updateSession(editingSession.domain, editingSession.id, input).then((saved) => {
              if (!saved) toast({ message: t('today.session.saveRefused') });
            });
          }
          setEditingSession(null);
        }}
        onDelete={() => {
          if (editingSession) {
            void deleteSession(editingSession.domain, editingSession.id).then((deleted) => {
              if (!deleted) toast({ message: t('today.session.deleteRefused') });
            });
          }
          setEditingSession(null);
        }}
      />
      <FoodEntrySheet
        key="food-sheet"
        open={addingFood}
        returnFocus={() => document.querySelector<HTMLElement>('button.food__add')}
        onClose={() => setAddingFood(false)}
        onAdd={(input) => void addFoodEntry(input)}
      />
    </>
  );

  /*
   * The title, the switch and the day on show. Drawn from `date` alone, so it
   * stands in both branches below: the switch stays where it is while the
   * other day loads, and the date always names the day a write would reach.
   */
  const header = (status?: ReactNode) => (
    <header className="screen__header">
      <h1 className="screen__title">{t('nav.today')}</h1>
      <div className="today__switch">
        <Segmented<ShownDay>
          value={shown}
          options={[
            { value: 'today', label: t('today.show.today') },
            { value: 'yesterday', label: t('today.show.yesterday') },
          ]}
          onChange={show}
          label={t('today.show.label')}
        />
      </div>
      <p className="today__date">
        {t('today.date', {
          weekday: formatWeekday(language, date),
          date: formatDayAndMonth(language, date),
        })}
      </p>
      {status}
    </header>
  );

  // Three states, never collapsed into one: still loading, failed outright,
  // or loaded. What is *empty* is decided further down, from the day itself.
  // A view loaded for another day is not "loaded" (WP3, B3): after midnight
  // — or a moment after the switch — the other day's answers stay in memory
  // until this day's arrive, and not one control is offered on them in the
  // meantime. If the load fails, that is a failure with a retry, never an
  // endless wait.
  if (!showsDay) {
    return (
      <div className="screen">
        {header()}
        <div className="today__scroll" aria-busy={state.status !== 'failed'}>
          {state.status === 'failed' ? (
            <LoadFailure title={t('error.day.title')} onRetry={reload} />
          ) : null}
        </div>
        {floating}
      </div>
    );
  }

  const day = state.value;
  const mental = day.mental;

  /*
   * What is due *today*, across every daily domain — not just Wellbeing.
   *
   * This line used to count Wellbeing alone, so a user who answered every
   * question but had not yet rated Food was told "Für heute erledigt" while
   * Food sat unrated below it and the day was being held open precisely
   * because of it (D111). The app contradicted itself and then quietly
   * postponed the day.
   *
   * Counting every daily obligation removes the contradiction without
   * touching scoring: nothing is fabricated, no day closes earlier, and the
   * replay is untouched. A weekly quota is deliberately not counted here —
   * it is not due today, it is due this week, and the training cards say so
   * themselves.
   */
  const dailyDue = (mental?.items.length ?? 0) + (day.food ? 1 : 0);
  const dailyDone =
    (mental?.answeredCount ?? 0) + (day.food?.adherence !== null && day.food ? 1 : 0);

  const openGym = (sessionId?: string) => gym.start(sessionId);
  /*
   * A workout under way on the day on show. Yesterday's is offered only
   * while it can still be written; today's always is (P7).
   */
  const gymDays = day.training.find((entry) => entry.domain === 'gym')?.writableDays ?? [];
  const showsWorkout = runningWorkout !== null && (shown === 'today' || gymDays.includes(date));
  const thisWeek = weekKeyOf(today);

  return (
    <div className="screen">
      {header(
        <>
          {/* A yesterday that can no longer be written says so once (D133). */}
          {day.editable ? null : (
            <p className="today__closed" role="status">
              {t('today.closed')}
            </p>
          )}
          <div className="today__status">
            {dailyDue > 0 ? (
              <p className={`today__progress ${dailyDone === dailyDue ? 'today__progress--complete' : ''}`.trim()}>
                <span className="today__progressDot" aria-hidden="true" />
                {dailyDone === dailyDue
                  ? t(shown === 'today' ? 'today.allDone' : 'today.yesterdayDone')
                  : t('today.progress', { done: dailyDone, total: dailyDue })}
              </p>
            ) : null}
            {/* Quiet, and only a way across: nothing here is counted. */}
            {shown === 'today' && yesterdayOpen ? (
              <button type="button" className="today__yesterday" onClick={() => show('yesterday')}>
                {t('today.yesterdayOpen')}
                <ChevronRightIcon size={14} />
              </button>
            ) : null}
          </div>
        </>,
      )}

      <div
        className="today__scroll"
        ref={scrollPort}
        onScroll={(event) => {
          savedScroll.current = event.currentTarget.scrollTop;
        }}
      >
        {state.refreshFailed ? <StaleNotice onRetry={reload} /> : null}

        {/* A workout under way comes first: one tap continues it (P7). */}
        {showsWorkout && runningWorkout ? (
          <RunningWorkoutCard workout={runningWorkout} onContinue={() => openGym(runningWorkout.sessionId)} />
        ) : null}

        {/*
          The Boss Rank, and nothing more than the Boss Rank.
          
          Today is for acting. The one thing a global standing earns here is
          the answer to "where am I" in a glance — badge, name, how far to the
          next one — and a way through to the screen where the weighting and
          the history live. Anything more turns a check-in into a dashboard.
        */}
        {onGoToRank ? <BossSummary onOpen={onGoToRank} /> : null}

        {/*
          A pause is stated, never enforced. One line, no banner, nothing
          disabled: the user can still answer every question and log every
          session, and doing so counts exactly as it would otherwise.
        */}
        {day.paused ? (
          <div className="today__paused" role="status">
            <span className="today__pausedTitle">{t('pause.today')}</span>
            <span className="today__pausedBody">{t('pause.today.detail')}</span>
          </div>
        ) : null}

        {day.empty ? (
          <Card rows>
            <EmptyState
              icon={<SparkIcon size={26} />}
              title={t('today.emptyTitle')}
              body={t('today.emptyBody')}
              action={
                <Button variant="secondary" onClick={() => onGoToAreas()}>
                  {t('today.emptyAction')}
                </Button>
              }
            />
          </Card>
        ) : null}

        {mental ? (
          <Section label={t('domain.mental')}>
            <Card>
              {mental.items.length === 0 ? (
                <EmptyState
                  title={t('today.noQuestionsTitle')}
                  body={t('today.noQuestionsBody')}
                  action={
                    <Button variant="secondary" onClick={() => onGoToAreas()}>
                      {t('today.emptyAction')}
                    </Button>
                  }
                />
              ) : (
                mental.items.map((item) => (
                  <CheckInItem
                    key={item.question.id}
                    item={item}
                    editable={day.editable}
                    onAnswer={(next) => answer(item.question.id, next)}
                  />
                ))
              )}
            </Card>
          </Section>
        ) : null}

        {day.training.map((training) => {
          const copy = TRAINING_COPY[training.domain];
          /*
           * Whether a session may be written for the day on show (D133). The
           * one day the check-in can take and a session cannot is the Sunday
           * of a week that began before the update, on the Monday after: that
           * week closed at Sunday midnight under the rules it was lived by.
           */
          const loggable = training.writableDays.includes(date);
          return (
            <Section key={training.domain} label={t(copy.title)} labelHidden={training.domain === 'gym' && Boolean(onOpenGym)}>
              {/* Gym's label is the door to its hub (WP2-2): logging stays
                  the button below; the area itself is one tap away too. */}
              {training.domain === 'gym' && onOpenGym ? (
                <button type="button" className="today__areaLink" onClick={onOpenGym} aria-label={t('gymHub.open')}>
                  <span className="section__label today__areaLabel">{t(copy.title)}</span>
                  <ChevronRightIcon size={16} />
                </button>
              ) : null}
              <Card>
                <div className="week__header">
                  <span className="week__label">
                    {t(training.weekKey === thisWeek ? 'sports.thisWeek' : 'sports.lastWeek')}
                  </span>
                  <span className="week__value">
                    {t('sports.progress', {
                      done: training.progress.completed,
                      target: training.progress.target,
                    })}
                  </span>
                </div>

                <div
                  className="week__segments"
                  role="img"
                  aria-label={t('sports.progress', {
                    done: training.progress.completed,
                    target: training.progress.target,
                  })}
                >
                  {Array.from({ length: training.progress.target }, (_, index) => (
                    <span
                      key={index}
                      className={`week__segment ${
                        index < training.progress.completed ? 'week__segment--filled' : ''
                      }`.trim()}
                    />
                  ))}
                </div>

                <p
                  className={`week__status ${training.progress.met ? 'week__status--met' : ''}`.trim()}
                >
                  {training.progress.exceeded
                    ? t('sports.exceeded')
                    : training.progress.met
                      ? t('sports.met')
                      : t('sports.remaining', { count: training.progress.remaining })}
                </p>

                {training.sessions.map((session) => (
                  <Row
                    key={session.id}
                    title={t(copy.title)}
                    subtitle={
                      <span className="session-row__time">
                        {/* Several sessions can share a day, so today's are told
                            apart by time and earlier ones by weekday. */}
                        {session.date === date
                          ? formatTime(language, session.performedAt)
                          : formatWeekday(language, session.date)}
                        {session.durationMinutes ? ` · ${session.durationMinutes} min` : ''}
                        {session.note ? ` · ${session.note}` : ''}
                      </span>
                    }
                    focusKey={`session-${session.id}`}
                    onClick={() => {
                      if (training.domain === 'gym') {
                        openGym(session.id);
                        return;
                      }
                      lastEdited.current = session.id;
                      setEditingSession(session);
                    }}
                    trailing={<ChevronRightIcon size={18} />}
                  />
                ))}

                {/*
                  The retired Sport log is read-only. Those sessions still
                  count for every week they were logged in, and nothing new
                  is ever added to it.
                */}
                {training.domain === 'sports' ? (
                  /*
                    The retired log has no log button, so this is where a
                    migrated user notices it and wonders what it is. Point at
                    the answer rather than leaving the one-time question to be
                    stumbled on — but only point: the choice itself is made in
                    Areas, deliberately, with what each branch does spelled
                    out beside it.
                  */
                  day.legacySportChoicePending ? (
                    <button type="button" className="week__legacyAsk" onClick={() => onGoToAreas()}>
                      {t('legacySport.today.pending')}
                    </button>
                  ) : null
                ) : !loggable ? (
                  // A closed day already says so above; only the closed week
                  // of a day the check-in still takes needs its own line.
                  day.editable ? (
                    <p className="week__closed" role="status">
                      {t('sports.weekClosed')}
                    </p>
                  ) : null
                ) : (
                  <button
                    type="button"
                    className="week__log"
                    // aria-disabled rather than disabled: a disabled button
                    // drops keyboard focus to the page, and the ref in
                    // logOnce already turns the second tap away.
                    aria-disabled={loggingDomain === training.domain}
                    aria-busy={loggingDomain === training.domain}
                    // A held key repeats; only the first press logs.
                    onKeyDown={(event) => {
                      if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
                    }}
                    onClick={() =>
                      // Gym opens the session it just created, so logging and
                      // filling it in are one gesture rather than two screens.
                      training.domain === 'gym' ? openGym() : void logOnce(training.domain)
                    }
                  >
                    <PlusIcon size={19} />
                    {t(copy.log)}
                  </button>
                )}
              </Card>
            </Section>
          );
        })}

        {/*
          Food comes after training, which is its display order — and it is
          one card rather than a row in the training list, because it is not
          a weekly quota. Nothing here fabricates a session.
        */}
        {day.food ? (
          <FoodCard
            food={day.food}
            editable={day.editable}
            onRate={rateFood}
            onClearRating={clearFoodRating}
            onOpenEntry={() => setAddingFood(true)}
            onRemoveEntry={removeFoodEntry}
          />
        ) : null}
      </div>

      {floating}
    </div>
  );
}
