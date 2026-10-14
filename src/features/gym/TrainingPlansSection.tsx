import { useCallback, useState } from 'react';
import type { TrainingPlanRecord } from '../../core/model';
import { Card, Row, Section } from '../../components';
import { ChevronRightIcon, PlusIcon } from '../../components/Icons';
import { useT } from '../../i18n/I18nProvider';
import { useLoadable } from '../../app/useLoadable';
import {
  createTrainingPlan,
  deleteTrainingPlan,
  duplicateTrainingPlan,
  listTrainingPlans,
  planSlotsOf,
  updateTrainingPlan,
  type PlanDraftInput,
} from '../../storage/services/trainingPlanService';
import { PlanEditor } from './PlanEditor';
import './gym.css';

/**
 * The plans a user has saved, in the Gym workspace.
 *
 * A list, a way to add one, and the limit stated where it applies — in a
 * line under the list, never a modal. The editor takes the workspace over
 * while it is open, the way an exercise's detail already does.
 */
export function TrainingPlansSection() {
  const t = useT();
  const load = useCallback(() => listTrainingPlans(), []);
  // The section reloads itself after each of its own writes.
  const { state, reload } = useLoadable(load, []);
  const [editing, setEditing] = useState<TrainingPlanRecord | null | 'new'>(null);

  const plans = state.status === 'ready' ? state.value : [];
  const slots = planSlotsOf(plans.length);

  const run = (operation: () => Promise<unknown>) => {
    operation()
      .catch(() => undefined)
      .then(() => {
        setEditing(null);
        return reload();
      });
  };

  if (editing !== null) {
    const plan = editing === 'new' ? null : editing;
    return (
      <PlanEditor
        plan={plan}
        slots={slots}
        onCancel={() => setEditing(null)}
        onSave={(input: PlanDraftInput) =>
          run(() => (plan ? updateTrainingPlan(plan.id, input) : createTrainingPlan(input)))
        }
        onDuplicate={
          plan
            ? () =>
                run(() =>
                  duplicateTrainingPlan(plan.id, t('plans.editor.duplicateName', { name: plan.name })),
                )
            : undefined
        }
        onDelete={plan ? () => run(() => deleteTrainingPlan(plan.id)) : undefined}
      />
    );
  }

  return (
    <Section label={t('plans.title')}>
      <Card rows>
        {plans.length === 0 ? (
          <p className="plans__empty">{t('plans.empty')}</p>
        ) : (
          plans.map((plan) => (
            <Row
              key={plan.id}
              title={plan.name}
              subtitle={
                plan.exercises.length === 1
                  ? t('plans.countOne')
                  : t('plans.count', { count: plan.exercises.length })
              }
              onClick={() => setEditing(plan)}
              trailing={<ChevronRightIcon size={18} />}
            />
          ))
        )}
        {slots.free ? (
          <div className="areas__addRow">
            <Row title={t('plans.new')} onClick={() => setEditing('new')} leading={<PlusIcon size={20} />} />
          </div>
        ) : (
          <p className="plans__limit" role="status">
            {t('plans.limit', { max: slots.max })}
          </p>
        )}
        <p className="plans__slots">{t('plans.slots', { used: slots.used, max: slots.max })}</p>
      </Card>
    </Section>
  );
}
