import { useState } from 'react';
import { DEMO_FOODS, forGrams, type DemoFood } from '../../core/food';
import { Button, Row, Sheet } from '../../components';
import { PlusIcon } from '../../components/Icons';
import { useI18n, useT } from '../../i18n/I18nProvider';
import type { FoodEntryInput } from '../../storage/services/checkInService';

/**
 * Logging one thing eaten.
 *
 * Two ways in, and the second is the important one: the five suggestions are
 * a starting point, not a database, and everything the app does not ship is
 * typed by hand in the same sheet rather than searched for in a table that
 * does not exist. There is no barcode scanner and no nutrition service behind
 * this, by design.
 *
 * Only a name and an energy figure are required. Grams and macros are
 * optional because nothing here is scored — leaving them out costs the user
 * nothing at all.
 */
export function FoodEntrySheet({
  open,
  onClose,
  onAdd,
  returnFocus,
}: {
  open: boolean;
  onClose(): void;
  onAdd(input: FoodEntryInput): void;
  /** See `Sheet`: where focus goes if the opener is gone. */
  returnFocus?: () => HTMLElement | null;
}) {
  const t = useT();
  const { language } = useI18n();
  const [label, setLabel] = useState('');
  const [grams, setGrams] = useState('');
  const [kcal, setKcal] = useState('');

  const close = () => {
    setLabel('');
    setGrams('');
    setKcal('');
    onClose();
  };

  const addDemo = (food: DemoFood) => {
    onAdd({
      foodId: food.id,
      label: food.name[language],
      grams: food.defaultGrams,
      kcal: forGrams(food.kcal, food.defaultGrams),
      proteinG: forGrams(food.proteinG, food.defaultGrams),
      carbsG: forGrams(food.carbsG, food.defaultGrams),
      fatG: forGrams(food.fatG, food.defaultGrams),
    });
    close();
  };

  const gramsValue = grams.trim() === '' ? null : Number(grams);
  const kcalValue = Number(kcal);
  const canAdd =
    label.trim() !== '' &&
    kcal.trim() !== '' &&
    Number.isFinite(kcalValue) &&
    kcalValue >= 0 &&
    (gramsValue === null || (Number.isFinite(gramsValue) && gramsValue > 0));

  const addOwn = () => {
    if (!canAdd) return;
    onAdd({
      foodId: null,
      label: label.trim(),
      grams: gramsValue,
      kcal: kcalValue,
      // A hand-typed entry carries no macro breakdown. Absent is absent —
      // it is never written down as three zeros the user did not mean.
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
    close();
  };

  return (
    <Sheet open={open} title={t('food.sheet.title')} onClose={close} returnFocus={returnFocus}>
      <div className="food-sheet">
        <h3 className="food-sheet__heading">{t('food.sheet.suggestions')}</h3>
        {DEMO_FOODS.map((food) => (
          <Row
            key={food.id}
            title={food.name[language]}
            subtitle={
              <span className="food-sheet__meta">
                {t('food.entry.portion', {
                  grams: food.defaultGrams,
                  kcal: forGrams(food.kcal, food.defaultGrams),
                })}
                {' · '}
                {t('food.per100', { kcal: food.kcal })}
              </span>
            }
            onClick={() => addDemo(food)}
            leading={<PlusIcon size={18} />}
          />
        ))}

        <h3 className="food-sheet__heading">{t('food.sheet.own')}</h3>
        <label className="food-sheet__field">
          <span className="food-sheet__label">{t('food.sheet.name')}</span>
          <input
            type="text"
            className="food-sheet__input"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <div className="food-sheet__pair">
          <label className="food-sheet__field">
            <span className="food-sheet__label">{t('food.sheet.grams')}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              className="food-sheet__input"
              value={grams}
              onChange={(event) => setGrams(event.target.value)}
            />
          </label>
          <label className="food-sheet__field">
            <span className="food-sheet__label">{t('food.sheet.kcal')}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className="food-sheet__input"
              value={kcal}
              onChange={(event) => setKcal(event.target.value)}
            />
          </label>
        </div>
        <Button variant="secondary" onClick={addOwn} disabled={!canAdd}>
          {t('food.sheet.add')}
        </Button>
      </div>
    </Sheet>
  );
}
