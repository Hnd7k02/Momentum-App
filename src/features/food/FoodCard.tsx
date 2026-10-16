import { ADHERENCE_MAX, adherenceBandOf } from '../../core/food';
import { STATUS_LABEL_KEYS } from '../../core/scoring/scale';
import { Card, EmptyState, Row, Section } from '../../components';
import { PlusIcon, SparkIcon } from '../../components/Icons';
import { ScaleAnswer } from '../../domains/mental/AnswerControls';
import { useT } from '../../i18n/I18nProvider';
import type { FoodDayView } from '../../storage/services/checkInService';
import './food.css';

/**
 * Food on the Today screen.
 *
 * The card is in two halves, and the order says which one matters. The
 * **rating** comes first: one 1–10 answer about how the day matched what the
 * user set out to do, and it is the only thing on this screen that reaches
 * the rating. The **log** comes second, and its totals are there so a day can
 * be looked at — nothing about them is scored.
 *
 * Saying so in the interface is deliberate. A screen that shows a calorie
 * total next to a rating invites the reading that one produces the other, and
 * here it does not: what a person's calorie target should be has not been
 * decided, and the app does not pretend otherwise.
 */
export function FoodCard({
  food,
  editable,
  day = 'today',
  closedNoted = false,
  onRate,
  onClearRating,
  onOpenEntry,
  onRemoveEntry,
}: {
  food: FoodDayView;
  editable: boolean;
  /** Which day the card speaks of: Heute's side, or Gestern's (D138). */
  day?: 'today' | 'yesterday';
  /** The screen already says the day is closed, so the card need not again. */
  closedNoted?: boolean;
  onRate(value: number): void;
  onClearRating(): void;
  /**
   * Opens the entry sheet. The host owns it (WP3, B3): Heute keeps its sheets
   * mounted while a new day loads, so what is typed into one survives
   * midnight, and this card is part of the day that reloads.
   */
  onOpenEntry(): void;
  onRemoveEntry(id: string): void;
}) {
  const t = useT();
  const band = food.adherence === null ? null : adherenceBandOf(food.adherence);
  const yesterday = day === 'yesterday';
  const question = t(yesterday ? 'food.rate.label.yesterday' : 'food.rate.label');

  return (
    <Section label={t('food.today.title')}>
      <Card>
        <div className="food__focus">
          {food.focus ? (
            <p className="food__focusText">{food.focus}</p>
          ) : (
            <p className="food__focusEmpty">{t('food.focus.empty')}</p>
          )}
        </div>

        <p className="food__question">{question}</p>
        {/* Wrapped so the card's own scale can be addressed on its own —
            Wellbeing renders the same control, and a page-wide selector
            would find all of them. */}
        <div className="food__scale">
          <ScaleAnswer
            questionText={question}
            value={food.adherence}
            disabled={!editable}
            onChange={(next) => onRate(Number(next))}
          />
        </div>

        <p className="food__rating" aria-live="polite">
          {food.adherence === null || band === null
            ? t(yesterday ? 'food.rate.none.yesterday' : 'food.rate.none')
            : t('food.rate.value', {
                value: food.adherence,
                band: t(STATUS_LABEL_KEYS[band]),
              })}
        </p>

        {food.adherence !== null && editable ? (
          <button type="button" className="food__clear" onClick={onClearRating}>
            {t('food.rate.clear')}
          </button>
        ) : null}

        <div className="food__log">
          <div className="food__logHeader">
            <span className="food__logTitle">
              {t(yesterday ? 'food.entries.title.yesterday' : 'food.entries.title')}
            </span>
            {food.entries.length > 0 ? (
              <span className="food__total">
                {t('food.entries.total', {
                  kcal: food.totals.kcal,
                  protein: food.totals.proteinG,
                  carbs: food.totals.carbsG,
                  fat: food.totals.fatG,
                })}
              </span>
            ) : null}
          </div>

          {food.entries.length === 0 ? (
            <EmptyState icon={<SparkIcon size={22} />} title={t('food.entries.empty')} />
          ) : (
            food.entries.map((entry) => (
              <Row
                key={entry.id}
                title={entry.label}
                subtitle={
                  <span className="food__entryMeta">
                    {entry.grams === null
                      ? `${entry.kcal} kcal`
                      : t('food.entry.portion', { grams: entry.grams, kcal: entry.kcal })}
                  </span>
                }
                trailing={
                  editable ? (
                    <button
                      type="button"
                      className="food__remove"
                      aria-label={`${t('food.entries.remove')}: ${entry.label}`}
                      onClick={() => onRemoveEntry(entry.id)}
                    >
                      ×
                    </button>
                  ) : undefined
                }
              />
            ))
          )}

          {editable ? (
            <button type="button" className="food__add" onClick={onOpenEntry}>
              <PlusIcon size={19} />
              {t('food.entries.add')}
            </button>
          ) : closedNoted ? null : (
            <p className="food__closed">{t('food.locked')}</p>
          )}

          <p className="food__note">{t('food.entries.note')}</p>
        </div>
      </Card>
    </Section>
  );
}

/** The highest rating there is, so a screen can say "x of 10" without a literal. */
export const FOOD_RATING_MAX = ADHERENCE_MAX;
