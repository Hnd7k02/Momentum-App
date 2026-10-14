import { useEffect, useState } from 'react';
import { useToday } from '../../app/useToday';
import { daysOfWeek, type DateKey } from '../../core/dates';

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
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  session: TrainingSession | null;
  onClose(): void;
  onSave(input: SessionInput): void;
  onDelete(): void;
}) {
  const t = useT();
  const { language } = useI18n();
  const [note, setNote] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  // The week's days are offered against the app's one "today" (B3).
  const current = useToday();
  const [date, setDate] = useState<DateKey>(current);

  useEffect(() => {
    if (!open) return;
    setNote(session?.note ?? '');
    setDuration(session?.durationMinutes ? String(session.durationMinutes) : '');
    setDistance(session?.distanceMetres ? kmText(session.distanceMetres) : '');
    setDate(session?.date ?? current);
    // Reset when the sheet opens for a session, not when the day turns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session]);

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
      footer={
        <>
          <Button
            variant="primary"
            block
            onClick={() =>
              onSave({
                date,
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
      }
    >
      {/*
        A session can be moved to the day it actually happened, within its own
        week. Without this, forgetting to log Monday's run until Wednesday
        left no way to record it truthfully.
      */}
      <div>
        <span className="field-label">{t('sports.day')}</span>
        <div className="session-days" role="radiogroup" aria-label={t('sports.day')}>
          {daysOfWeek(session?.date ?? current).map((option) => {
            const future = option > current;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={option === date}
                className="session-days__day"
                disabled={future}
                onClick={() => setDate(option)}
              >
                {formatWeekdayShort(language, option)}
              </button>
            );
          })}
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
          placeholder={t('sports.notePlaceholder')}
          onChange={(event) => setNote(event.target.value)}
          autoComplete="off"
        />
      </div>
    </Sheet>
  );
}
