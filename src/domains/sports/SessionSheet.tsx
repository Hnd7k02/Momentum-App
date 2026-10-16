import { useEffect, useState } from 'react';
import type { DateKey } from '../../core/dates';

import { Button, Sheet } from '../../components';
import { formatWeekdayShort } from '../../i18n/format';
import { useI18n, useT } from '../../i18n/I18nProvider';
import type { SessionInput, TrainingSession } from '../../storage/services/checkInService';
import './sessionSheet.css';

/**
 * Detail for a logged training session, whichever log it belongs to.
 *
 * Logging happens in one tap on the Today screen; everything in here is
 * optional and added afterwards, so a session never waits on a form.
 *
 * The fields follow the domain rather than the other way round. A run has a
 * distance and a duration; a gym session's substance is its sets, which belong
 * on the gym screen and not in a sheet reached from Today. Showing an empty
 * duration box for a gym session would be asking for a number nothing reads.
 *
 * **Distance and duration stay optional for a run.** Both are what unlock
 * pace development, and neither is required to log one — a run saved with
 * nothing but a date still counts in full towards the weekly target. Making
 * them mandatory would tax the honest logging the whole domain depends on.
 * The sheet says what supplying them buys instead of insisting.
 *
 * **What can change is the write rule's, not the sheet's** (D133). A run can
 * be moved to the days a run may still be written for — today and
 * yesterday — and a run dated on any other day opens read-only, with the
 * closed copy instead of the buttons.
 */
/** Kilometres as whole metres. Swiss metric, one decimal is plenty. */
function metresFrom(text: string): number | null {
  const value = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 1000) : null;
}

function kmText(metres: number): string {
  const km = metres / 1000;
  return Number.isInteger(km) ? String(km) : String(Number(km.toFixed(3)));
}

/** Minutes and seconds per kilometre, for display only. */
function paceText(metres: number, seconds: number): string {
  const perKm = seconds / (metres / 1000);
  const minutes = Math.floor(perKm / 60);
  return `${minutes}:${String(Math.round(perKm % 60)).padStart(2, '0')}`;
}

export function SessionSheet({
  open,
  session,
  days,
  onClose,
  onSave,
  onDelete,
  returnFocus,
}: {
  open: boolean;
  session: TrainingSession | null;
  /**
   * The days a run may be written for, oldest first — the day view's
   * `writableDays`, which move with the app's one "today" (B3).
   */
  days: readonly DateKey[];
  onClose(): void;
  onSave(input: SessionInput): void;
  onDelete(): void;
  /** See `Sheet`: where focus goes if the opener is gone. */
  returnFocus?: () => HTMLElement | null;
}) {
  const t = useT();
  const { language } = useI18n();
  const [note, setNote] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [date, setDate] = useState<DateKey | null>(null);

  useEffect(() => {
    if (!open) return;
    setNote(session?.note ?? '');
    setDuration(session?.durationMinutes ? String(session.durationMinutes) : '');
    setDistance(session?.distanceMetres ? kmText(session.distanceMetres) : '');
    setDate(session?.date ?? null);
    // Reset when the sheet opens for a session, not when the day turns.
  }, [open, session]);

  /*
   * Read-only once the run's own day has left the window: nothing about it
   * can be written any more, so the sheet shows it and offers nothing. A
   * sheet left open across midnight follows, as everything else does — and
   * then shows the run as stored, never what was typed but not saved.
   */
  const editable = session !== null && days.includes(session.date);
  useEffect(() => {
    if (!open || editable) return;
    setNote(session?.note ?? '');
    setDuration(session?.durationMinutes ? String(session.durationMinutes) : '');
    setDistance(session?.distanceMetres ? kmText(session.distanceMetres) : '');
    setDate(session?.date ?? null);
  }, [open, editable, session]);
  /* The run's own day and every day it could move to; read-only, its own. */
  const offered = editable ? [...new Set([session.date, ...days])].sort() : session ? [session.date] : [];
  /* A day picked before midnight that is no longer offered falls back to the run's own. */
  const chosen = date !== null && editable && !days.includes(date) ? session.date : date;

  const parsedDuration = Number.parseInt(duration, 10);
  const parsedDistance = metresFrom(distance);
  const isRun = session?.domain === 'running';
  /* Pace is shown, never stored: it is the two numbers above, divided. */
  const pace =
    isRun && parsedDistance !== null && Number.isFinite(parsedDuration) && parsedDuration > 0
      ? paceText(parsedDistance, parsedDuration * 60)
      : null;

  return (
    <Sheet
      open={open}
      title={t('sports.session')}
      onClose={onClose}
      returnFocus={returnFocus}
      footer={
        editable ? (
          <>
            <Button
              variant="primary"
              block
              onClick={() =>
                onSave({
                  ...(chosen === null ? {} : { date: chosen }),
                  note: note.trim() || null,
                  durationMinutes:
                    Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : null,
                  distanceMetres: parsedDistance,
                })
              }
            >
              {t('common.save')}
            </Button>
            <Button variant="quiet" block onClick={onDelete}>
              {t('sports.delete')}
            </Button>
          </>
        ) : undefined
      }
    >
      {editable ? null : (
        <p className="session-sheet__closed" role="status">
          {t('today.closed')}
        </p>
      )}

      {/*
        A run can be moved to the day it actually happened while that day can
        still be written: today or yesterday (D133). A run logged this morning
        for last night's training is recorded truthfully; one older than that
        stays where it is.
      */}
      <div>
        <span className="field-label">{t('sports.day')}</span>
        <div className="session-days" role="radiogroup" aria-label={t('sports.day')}>
          {offered.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={option === chosen}
              className="session-days__day"
              disabled={!editable || !days.includes(option)}
              onClick={() => setDate(option)}
            >
              {formatWeekdayShort(language, option)}
            </button>
          ))}
        </div>
      </div>

      {isRun ? (
        <div>
          <label className="field-label" htmlFor="session-distance">
            {t('running.distance')}
          </label>
          <input
            id="session-distance"
            className="field"
            value={distance}
            inputMode="decimal"
            readOnly={!editable}
            placeholder={t('running.distanceUnit')}
            onChange={(event) => setDistance(event.target.value.replace(/[^0-9.,]/g, ''))}
          />
          <p className="session-sheet__hint">{t('running.distanceHint')}</p>
        </div>
      ) : null}

      {session?.domain === 'gym' ? null : (
        <div>
          <label className="field-label" htmlFor="session-duration">
            {t('sports.duration')}
          </label>
          <input
            id="session-duration"
            className="field"
            value={duration}
            inputMode="numeric"
            readOnly={!editable}
            placeholder={t('sports.durationUnit')}
            onChange={(event) => setDuration(event.target.value.replace(/[^0-9]/g, ''))}
          />
          {pace ? (
            <p className="session-sheet__hint" role="status">
              {t('running.pace', { pace })}
            </p>
          ) : null}
        </div>
      )}

      <div>
        <label className="field-label" htmlFor="session-note">
          {t('sports.note')}
        </label>
        <input
          id="session-note"
          className="field"
          value={note}
          readOnly={!editable}
          placeholder={t('sports.notePlaceholder')}
          onChange={(event) => setNote(event.target.value)}
          autoComplete="off"
        />
      </div>
    </Sheet>
  );
}
