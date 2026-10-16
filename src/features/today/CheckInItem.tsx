import { useEffect, useId, useRef, useState } from 'react';
import type { AnswerValue } from '../../core/model';
import { STATUS_LABEL_KEYS, scaleBandOf } from '../../core/scoring/scale';
import type { CheckInItem as Item } from '../../storage/services/checkInService';
import { ChevronDownIcon } from '../../components/Icons';
import { BooleanAnswer, ScaleAnswer } from '../../domains/mental/AnswerControls';
import { yesterdayWordingOf } from '../../domains/mental/questionLibrary';
import { useT } from '../../i18n/I18nProvider';

/**
 * One question on the Today screen.
 *
 * An answered question folds away to a single line — the question and what
 * was answered — so the screen keeps showing what is still open rather than
 * a wall of controls that have already done their job. Tapping the line
 * opens it again; nothing is ever hidden, only folded.
 *
 * The fold is not instant. Answering something and having it vanish under
 * your finger reads as the app taking the screen away, and it hides the
 * scale's band label at the moment it is most useful. The row stays open
 * long enough to see the answer land, then closes.
 *
 * On the Gestern side a standard question that still reads exactly as the
 * library put it speaks of yesterday — "Wie war deine Stimmung gestern?" —
 * in its heading, its folded row and the name of its answer group alike
 * (D144). Display only: what is stored, and what Verlauf and Bereiche show,
 * is the question as written.
 */

/** How long an answer stays visible before its row folds away. */
const COLLAPSE_DELAY_MS = 620;

export function CheckInItem({
  item,
  day,
  editable,
  onAnswer,
}: {
  item: Item;
  /** The day on show: Heute or Gestern (D138). */
  day: 'today' | 'yesterday';
  editable: boolean;
  onAnswer(value: AnswerValue | null): void;
}) {
  const t = useT();
  const questionText =
    day === 'yesterday' ? (yesterdayWordingOf(item.question.text) ?? item.question.text) : item.question.text;
  const panelId = useId();
  const value = item.answer?.value ?? null;
  const answered = item.answer !== null;

  const [open, setOpen] = useState(!answered);
  const timer = useRef<number | null>(null);

  // The write is asynchronous, so the delay can outrun it. Collapsing is
  // checked against what is actually on screen when the timer fires, never
  // against what was expected when it started.
  const answeredRef = useRef(answered);
  answeredRef.current = answered;

  const cancel = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => cancel, []);

  const handleAnswer = (next: AnswerValue | null) => {
    cancel();
    onAnswer(next);
    if (next === null) {
      // Clearing returns the question to the day's open list.
      setOpen(true);
      return;
    }
    setOpen(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if (answeredRef.current) setOpen(false);
    }, COLLAPSE_DELAY_MS);
  };

  const summary =
    typeof value === 'boolean'
      ? t(value ? 'answer.yes' : 'answer.no')
      : typeof value === 'number'
        ? `${value} · ${t(STATUS_LABEL_KEYS[scaleBandOf(value)])}`
        : '';

  return (
    <div
      className={`check-in ${answered ? 'check-in--answered' : ''} ${
        open ? 'check-in--open' : ''
      }`.trim()}
    >
      {answered ? (
        <button
          type="button"
          className="check-in__summary"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            cancel();
            setOpen((wasOpen) => !wasOpen);
          }}
        >
          <span className="check-in__question">{questionText}</span>
          <span className="check-in__value">{summary}</span>
          <ChevronDownIcon size={18} className="check-in__chevron" />
        </button>
      ) : (
        <p className="check-in__question">{questionText}</p>
      )}

      <div className="check-in__panel" id={panelId}>
        {/* Two elements, not one: the outer is clipped to the folding grid
            row, and the inner carries the spacing — padding on the clipped
            box would survive the fold as a strip of empty space. */}
        <div className="check-in__panelInner">
          <div className="check-in__panelContent">
            {item.question.type === 'boolean' ? (
              <BooleanAnswer
                questionText={questionText}
                value={typeof value === 'boolean' ? value : null}
                disabled={!editable}
                onChange={handleAnswer}
              />
            ) : (
              <ScaleAnswer
                questionText={questionText}
                value={typeof value === 'number' ? value : null}
                disabled={!editable}
                onChange={handleAnswer}
              />
            )}

            {/* Returning a question to unanswered is deliberate and explicit
                — never a side effect of tapping twice. */}
            {answered && editable ? (
              <button
                type="button"
                className="check-in__clear"
                onClick={() => handleAnswer(null)}
              >
                {t('answer.clear')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
