import { useCallback, useEffect, useId, useState } from 'react';
import { useToday } from '../../app/useToday';
import { PAUSE } from '../../core/config/constants';
import { addDays, type DateKey } from '../../core/dates';
import { validateDraft, type PauseProblem } from '../../core/pause';
import { Button, Card, EmptyState, LoadFailure, Section } from '../../components';
import { PlusIcon } from '../../components/Icons';
import { formatDayAndMonth } from '../../i18n/format';
import { useI18n, useT } from '../../i18n/I18nProvider';
import type { TranslationKey } from '../../i18n';
import {
  createPause,
  deletePause,
  endPauseEarly,
  loadPauses,
  PauseError,
  updatePause,
  type PauseOverview,
  type PauseView,
} from '../../storage/services/pauseService';
import './pause.css';

/**
 * Planning and ending a pause.
 *
 * The screen's job is to make three things unmistakable, because a pause is
 * the one feature in this app whose value is easy to misread:
 *
 * - what it *does* — inactivity penalties are suspended;
 * - what it *does not* do — it invents no activity, keeps no streak alive
 *   and credits no attendance;
 * - that the app keeps working — logging is never blocked, and anything
 *   logged during a pause counts exactly as it would outside one.
 *
 * It is a section in Areas rather than a mode: a pause is a setting about a
 * period, not a state the app enters.
 */

const PROBLEM_KEYS: Record<PauseProblem, TranslationKey> = {
  startInPast: 'pause.error.startInPast',
  endBeforeStart: 'pause.error.endBeforeStart',
  endMissing: 'pause.error.endMissing',
  tooLong: 'pause.error.tooLong',
  overlaps: 'pause.error.overlaps',
  alreadyBegun: 'pause.error.alreadyBegun',
  endsInPast: 'pause.error.endsInPast',
  extendsBeyondOriginal: 'pause.error.extendsBeyondOriginal',
  notFound: 'pause.error.notFound',
};

export function PauseSection() {
  const t = useT();
  const { language } = useI18n();
  // The day the pause rules are judged against moves with the clock (B3).
  const reference = useToday();

  const [overview, setOverview] = useState<PauseOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<PauseView | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [problem, setProblem] = useState<PauseProblem | null>(null);

  const reload = useCallback(() => {
    loadPauses(reference)
      .then((next) => {
        setOverview(next);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [reference]);

  useEffect(reload, [reload]);

  const run = (operation: () => Promise<unknown>) => {
    setProblem(null);
    operation()
      .then(() => {
        setDrafting(false);
        setEditing(null);
        reload();
      })
      .catch((error: unknown) => {
        // A refused write says which rule refused it, in the same words the
        // form would have used — there is one set of rules, in `core/pause`.
        if (error instanceof PauseError) setProblem(error.problem);
        else setFailed(true);
      });
  };

  const dates = (view: PauseView) =>
    view.record.to === null
      ? t('pause.openEnded')
      : t('pause.range', {
          from: formatDayAndMonth(language, view.record.from),
          to: formatDayAndMonth(language, view.record.to),
        });

  const length = (view: PauseView) =>
    view.days === null
      ? t('pause.openEnded')
      : view.days === 1
        ? t('pause.dayOne')
        : t('pause.days', { count: view.days });

  if (failed && overview === null) {
    return (
      <Section label={t('pause.title')}>
        <Card>
          <LoadFailure title={t('pause.title')} onRetry={reload} />
        </Card>
      </Section>
    );
  }

  const pauses = overview?.pauses ?? [];
  const visible = pauses.filter((entry) => entry.standing !== 'past');

  return (
    <Section label={t('pause.title')}>
      <Card>
        <div className="pause__intro">
          <p className="pause__lead">{t('pause.subtitle')}</p>
          <p className="pause__note">{t('pause.what')}</p>
          <p className="pause__note">{t('pause.whatNot')}</p>
          <p className="pause__note">{t('pause.stillWorks')}</p>
        </div>

        {visible.length === 0 && !drafting ? (
          <EmptyState title={t('pause.none')} />
        ) : (
          visible.map((entry) => (
            <div key={entry.record.id} className="pause__row">
              <div className="pause__rowBody">
                <span className="pause__rowDates">{dates(entry)}</span>
                <span className="pause__rowMeta">
                  {length(entry)}
                  {entry.record.reason ? ` · ${entry.record.reason}` : ''}
                </span>
              </div>
              <span
                className={`badge pause__badge pause__badge--${entry.standing}`}
              >
                {t(entry.standing === 'active' ? 'pause.active' : 'pause.upcoming')}
              </span>
              <div className="pause__rowActions">
                {entry.standing === 'active' ? (
                  <button
                    type="button"
                    className="pause__action"
                    onClick={() => run(() => endPauseEarly(entry.record.id, reference, reference))}
                  >
                    {t('pause.endNow')}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="pause__action"
                      onClick={() => {
                        setProblem(null);
                        setDrafting(false);
                        setEditing(entry);
                      }}
                    >
                      {t('pause.edit')}
                    </button>
                    <button
                      type="button"
                      className="pause__action pause__action--quiet"
                      onClick={() => run(() => deletePause(entry.record.id, reference))}
                    >
                      {t('pause.delete')}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}

        {drafting || editing ? (
          <PauseForm
            reference={reference}
            existing={pauses.map((entry) => entry.record)}
            initial={editing}
            problem={problem}
            onProblem={setProblem}
            onCancel={() => {
              setDrafting(false);
              setEditing(null);
              setProblem(null);
            }}
            onSubmit={(draft) =>
              run(() =>
                editing
                  ? updatePause(editing.record.id, draft, reference)
                  : createPause(draft, reference),
              )
            }
          />
        ) : (
          <button
            type="button"
            className="pause__add"
            onClick={() => {
              setProblem(null);
              setEditing(null);
              setDrafting(true);
            }}
          >
            <PlusIcon size={19} />
            {t('pause.add')}
          </button>
        )}
      </Card>
    </Section>
  );
}

function PauseForm({
  reference,
  existing,
  initial,
  problem,
  onProblem,
  onCancel,
  onSubmit,
}: {
  reference: DateKey;
  existing: readonly { id: string; from: DateKey; to: DateKey | null }[];
  initial: PauseView | null;
  problem: PauseProblem | null;
  onProblem(next: PauseProblem | null): void;
  onCancel(): void;
  onSubmit(draft: { from: DateKey; to: DateKey; reason: string | null }): void;
}) {
  const t = useT();
  const fromId = useId();
  const toId = useId();
  const reasonId = useId();

  const [from, setFrom] = useState<DateKey>(initial?.record.from ?? reference);
  const [to, setTo] = useState<DateKey>(
    initial?.record.to ?? addDays(reference, 6),
  );
  const [reason, setReason] = useState(initial?.record.reason ?? '');

  // The same rules the write enforces, so the button and the outcome agree.
  const check = validateDraft(
    { from, to, reason },
    existing as never,
    reference,
    initial?.record.id,
  );

  return (
    <div className="pause-form">
      <div className="pause-form__pair">
        <label className="pause-form__field" htmlFor={fromId}>
          <span className="pause-form__label">{t('pause.from')}</span>
          <input
            id={fromId}
            type="date"
            className="pause-form__input"
            value={from}
            min={reference}
            onChange={(event) => {
              onProblem(null);
              setFrom(event.target.value);
            }}
          />
        </label>
        <label className="pause-form__field" htmlFor={toId}>
          <span className="pause-form__label">{t('pause.to')}</span>
          <input
            id={toId}
            type="date"
            className="pause-form__input"
            value={to}
            min={from}
            max={addDays(from, PAUSE.MAX_DAYS - 1)}
            onChange={(event) => {
              onProblem(null);
              setTo(event.target.value);
            }}
          />
        </label>
      </div>

      <label className="pause-form__field" htmlFor={reasonId}>
        <span className="pause-form__label">{t('pause.reason')}</span>
        <input
          id={reasonId}
          type="text"
          className="pause-form__input"
          placeholder={t('pause.reasonPlaceholder')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>

      <p className="pause-form__hint">{t('pause.maxHint', { count: PAUSE.MAX_DAYS })}</p>

      {problem || check ? (
        <p className="pause-form__error" role="alert">
          {t(PROBLEM_KEYS[problem ?? check!], { count: PAUSE.MAX_DAYS })}
        </p>
      ) : null}

      <div className="pause-form__actions">
        <Button
          variant="primary"
          disabled={check !== null}
          onClick={() => onSubmit({ from, to, reason: reason.trim() || null })}
        >
          {t('pause.save')}
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          {t('pause.cancel')}
        </Button>
      </div>
    </div>
  );
}
