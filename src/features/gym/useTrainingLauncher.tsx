import { useCallback, useState, type ReactNode } from 'react';
import type { DateKey } from '../../core/dates';
import type { TrainingPlanRecord } from '../../core/model';
import { draftFromPlan, existingSessionForDay, type SessionDraft } from '../../storage/services/gymService';
import { listTrainingPlans } from '../../storage/services/trainingPlanService';
import { GymSessionScreen } from './GymSessionScreen';
import { PlanChooserSheet } from './PlanChooserSheet';

/**
 * Starting a workout, from wherever the button is.
 *
 * Today's quick-log action and the Gym hub's primary action are the same
 * flow, so it lives once: the day's existing session is continued; failing
 * that, saved plans are offered (with the free session second) or, with no
 * plan saved, the free session opens directly. Choosing a plan or the free
 * session opens a draft and writes nothing; the session is persisted inside
 * the logging screen with the first saved set (WP2-1; free sessions since
 * WP3, P6).
 *
 * The host renders `overlay` — the chooser sheet and, while a workout is
 * open, the logging screen — and is told when the screen closes so it can
 * reload whatever it shows.
 *
 * The workout's day is fixed when it opens (WP3, B3). The host's `date` is
 * live and turns at midnight; a workout begun at 23:50 is still that day's
 * workout at 00:10, so its draft, its header and the bodyweight typed into
 * it stay on the day it was opened for — while that day's week is open: a
 * draft has written nothing, and one carried past Sunday midnight moves to
 * today in the screen rather than be refused by the closed week. Once the
 * draft has become a session the launcher holds the session's id, so a host
 * that has to mount the screen again resumes the session, not the draft.
 */
export function useTrainingLauncher({
  date,
  onClosed,
  onManagePlans,
}: {
  date: DateKey;
  onClosed(): void;
  onManagePlans(): void;
}): {
  /** Opens a session: the given one, the day's existing one, or the chooser. */
  start(sessionId?: string): void;
  overlay: ReactNode;
  /** True while the logging screen is on top of the host. */
  open: boolean;
} {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ draft: SessionDraft; planName: string | null; free: boolean } | null>(null);
  const [plans, setPlans] = useState<TrainingPlanRecord[] | null>(null);
  /** The day the open workout belongs to, fixed when it opened. */
  const [openedFor, setOpenedFor] = useState<DateKey>(date);

  const openSession = useCallback((id: string, day: DateKey) => {
    setOpenedFor(day);
    setSessionId(id);
  }, []);

  /**
   * A free workout: a draft with nothing in it (WP3, P6). Opening it writes
   * nothing; it becomes the day's session with its first saved set, as a
   * planned draft does.
   */
  const openFree = useCallback(() => {
    setPlans(null);
    setOpenedFor(date);
    setDraft({ draft: { planId: null, exercises: [] }, planName: null, free: true });
  }, [date]);

  const start = useCallback(
    (id?: string) => {
      if (id) {
        // The screen reads an existing session's own day from the session.
        openSession(id, date);
        return;
      }
      const day = date;
      void existingSessionForDay(day)
        .then(async (existing) => {
          // One session per calendar day: continued, whichever way it began.
          if (existing) {
            openSession(existing.id, day);
            return;
          }
          const saved = await listTrainingPlans();
          if (saved.length === 0) openFree();
          else setPlans(saved);
        })
        .catch(() => openFree());
    },
    [date, openFree, openSession],
  );

  const close = () => {
    setSessionId(null);
    setDraft(null);
    onClosed();
  };

  const open = sessionId !== null || draft !== null;

  const overlay = (
    <>
      {open ? (
        <GymSessionScreen
          sessionId={sessionId}
          draft={draft?.draft ?? null}
          planName={draft?.planName ?? null}
          free={draft?.free ?? false}
          date={openedFor}
          onSessionCreated={setSessionId}
          onClose={close}
        />
      ) : null}
      <PlanChooserSheet
        open={plans !== null}
        plans={plans ?? []}
        onClose={() => setPlans(null)}
        onChoosePlan={(plan) => {
          setPlans(null);
          setOpenedFor(date);
          setDraft({ draft: draftFromPlan(plan), planName: plan.name, free: false });
        }}
        onFreeSession={openFree}
        onManagePlans={() => {
          setPlans(null);
          onManagePlans();
        }}
      />
    </>
  );

  return { start, overlay, open };
}
