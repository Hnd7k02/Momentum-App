import { useRef, useState } from 'react';
import type { StoredDomainType } from '../../core/model';
import type { DomainTerminal } from '../../app/route';
import { useToday } from '../../app/useToday';
import { useToast } from '../../components/Toast';
import { Button, Card, EmptyState, LoadFailure, Row, Section, StaleNotice } from '../../components';
import { ChevronRightIcon, PlusIcon, SparkIcon } from '../../components/Icons';
import { SessionSheet } from '../../domains/sports/SessionSheet';
import { formatDayAndMonth, formatTime, formatWeekday } from '../../i18n/format';
import { useI18n, useT } from '../../i18n/I18nProvider';
import type { TrainingSession } from '../../storage/services/checkInService';
import type { TranslationKey } from '../../i18n';
import { FoodCard } from '../food/FoodCard';
import '../pause/pause.css';
import { useTrainingLauncher } from '../gym/useTrainingLauncher';
import { BossSummary } from './BossSummary';
import { CheckInItem } from './CheckInItem';
import { useDay } from './useDay';
import './today.css';

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
  const date = useToday();
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
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  /*
   * One-tap logging is one write per tap (WP3, B9). A double tap logged two
   * runs and called the week met; the ref turns the second tap away before
   * React has re-rendered the disabled button, and the toast makes the one
   * that did land reversible.
   */
  const logging = useRef(false);
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
          action: { label: t('toast.undo'), run: () => void deleteSession(domain, session.id) },
        });
      }
    } finally {
      logging.current = false;
      setLoggingDomain(null);
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

  // Three states, never collapsed into one: still loading, failed outright,
  // or loaded. What is *empty* is decided further down, from the day itself.
  // A view loaded for another day is not "loaded" (WP3, B3): after midnight
  // yesterday's answers stay in memory until today's arrive, and not one
  // control is offered on them in the meantime.
  const current = state.status === 'ready' && state.value.date === date;
  if (!current) {
    return (
      <div className="screen">
        <header className="screen__header">
          <h1 className="screen__title">{t('nav.today')}</h1>
        </header>
        <div className="today__scroll" aria-busy={state.status !== 'failed'}>
          {state.status === 'failed' ? (
            <LoadFailure title={t('error.day.title')} onRetry={reload} />
          ) : null}
        </div>
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

  if (gym.open) return <>{gym.overlay}</>;

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">{t('nav.today')}</h1>
        <p className="today__date">
          {t('today.date', {
            weekday: formatWeekday(language, date),
            date: formatDayAndMonth(language, date),
          })}
        </p>
        {dailyDue > 0 ? (
          <p className={`today__progress ${dailyDone === dailyDue ? 'today__progress--complete' : ''}`.trim()}>
            <span className="today__progressDot" aria-hidden="true" />
            {dailyDone === dailyDue
              ? t('today.allDone')
              : t('today.progress', { done: dailyDone, total: dailyDue })}
          </p>
        ) : null}
      </header>

      <div className="today__scroll">
        {state.refreshFailed ? <StaleNotice onRetry={reload} /> : null}

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
                  <span className="week__label">{t('sports.thisWeek')}</span>
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
                    onClick={() =>
                      training.domain === 'gym'
                        ? openGym(session.id)
                        : setEditingSession(session)
                    }
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
                ) : (
                  <button
                    type="button"
                    className="week__log"
                    disabled={loggingDomain === training.domain}
                    aria-busy={loggingDomain === training.domain}
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
            onAddEntry={addFoodEntry}
            onRemoveEntry={removeFoodEntry}
          />
        ) : null}
      </div>

      {gym.overlay}

      <SessionSheet
        open={editingSession !== null}
        session={editingSession}
        onClose={() => setEditingSession(null)}
        onSave={(input) => {
          if (editingSession) updateSession(editingSession.domain, editingSession.id, input);
          setEditingSession(null);
        }}
        onDelete={() => {
          if (editingSession) deleteSession(editingSession.domain, editingSession.id);
          setEditingSession(null);
        }}
      />
    </div>
  );
}
