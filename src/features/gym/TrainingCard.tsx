import { useCallback } from 'react';
import { Button, Card, Section } from '../../components';
import { PlusIcon } from '../../components/Icons';
import { formatDayAndMonth, formatWeekday } from '../../i18n/format';
import { useI18n, useT } from '../../i18n/I18nProvider';
import { useDataVersion } from '../../app/useDataVersion';
import { useLoadable } from '../../app/useLoadable';
import { useToday } from '../../app/useToday';
import { loadTrainingWeek } from '../../storage/services/checkInService';
import { existingSessionForDay, latestGymSession } from '../../storage/services/gymService';
import { listTrainingPlans } from '../../storage/services/trainingPlanService';
import './gymHub.css';

/**
 * The top of the Gym hub: where training stands, and the one button.
 *
 * Three lines of existing facts — this week's sessions against the weekly
 * target, the last session from the session log, and how many plans are
 * saved — and the primary action. Nothing is computed here that the app
 * does not already compute; nothing is shown that is not stored.
 *
 * The week is read exactly as Heute reads it (WP3, B4), so the two screens
 * can never disagree about it, and the card reloads when the day turns and
 * after any committed write (B2) — finishing a workout updates it in place.
 */
export function weekSentence(t: ReturnType<typeof useT>, done: number, target: number): string {
  if (done < target) return t('gymHub.training.thisWeek', { done, target });
  if (done === target) return done === 1 ? t('gymHub.training.atTargetOne') : t('gymHub.training.atTarget', { done });
  return t('gymHub.training.aboveTarget', { done, target });
}

export function TrainingCard({
  onStart,
  onManagePlans,
}: {
  onStart(): void;
  onManagePlans(): void;
}) {
  const t = useT();
  const { language } = useI18n();
  const date = useToday();
  const version = useDataVersion();
  const load = useCallback(
    async () => ({
      latest: await latestGymSession(),
      today: await existingSessionForDay(date),
      plans: (await listTrainingPlans()).length,
      week: await loadTrainingWeek('gym', date),
    }),
    [date],
  );
  const { state } = useLoadable(load, [date], [version]);
  const facts = state.status === 'ready' ? state.value : null;

  // The same two stored values, read three ways: a fraction only while the
  // target is ahead, because "7 von 3" reads as a bounded progress figure
  // that it is not. No number here changes; only the sentence does. Before
  // the first session ever there is nothing to count, and the card says so.
  // While the facts are loading the line holds its place and says nothing —
  // loading is not "none". With Gym switched off there is no weekly quota to
  // state, and sessions logged before still are not "none": no line at all.
  const weekLine =
    facts === null
      ? undefined
      : !facts.latest
        ? t('gymHub.training.none')
        : facts.week
          ? weekSentence(t, facts.week.progress.completed, facts.week.progress.target)
          : null;
  const lastLine = facts?.latest
    ? facts.today
      ? t('gymHub.training.today')
      : t('gymHub.training.last', {
          date: `${formatWeekday(language, facts.latest.date)}, ${formatDayAndMonth(language, facts.latest.date)}`,
        })
    : null;
  const plansLine =
    facts === null
      ? null
      : facts.plans === 0
        ? t('gymHub.plans.none')
        : facts.plans === 1
          ? t('gymHub.plans.countOne')
          : t('gymHub.plans.count', { count: facts.plans });

  return (
    <Section label={t('gymHub.training.title')}>
      <Card className="gym-hub__training">
        {weekLine === null ? null : <p className="gym-hub__week">{weekLine ?? '\u00A0'}</p>}
        {lastLine ? <p className="gym-hub__last">{lastLine}</p> : null}
        <div className="gym-hub__action">
          <Button variant="primary" block onClick={onStart}>
            <PlusIcon size={18} />
            {facts?.today ? t('gymHub.training.continue') : t('gymHub.training.log')}
          </Button>
        </div>
        {plansLine ? (
          <p className="gym-hub__plans">
            <span>{plansLine}</span>
            <button type="button" className="gym-hub__plansLink" onClick={onManagePlans}>
              {t('gymHub.plans.manage')}
            </button>
          </p>
        ) : null}
      </Card>
    </Section>
  );
}
