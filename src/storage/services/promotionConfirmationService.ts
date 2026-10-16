import { today } from '../../core/clock';
import { addDays } from '../../core/dates';
import type { PromotionConfirmationState } from '../../core/model';
import { canonicalConfirmation } from '../../core/ranks/confirmation';
import { settingsRepository } from '../repositories';

/**
 * The confirmation era's one stored fact, and the reconciliation of its
 * pending state (D126).
 *
 * ## Activation
 *
 * `ensurePromotionConfirmation` runs on every configuration load. A settings
 * record created under this version already carries the state (see
 * `settingsRepository.getOrCreate`, `from` = its first day), so an absent
 * field means exactly one thing: a record that predates the feature. For
 * that record the ensure step writes the state once with `from` set to the
 * **next** local day, so the activation day — whatever the legacy rule
 * awards on it, including a promotion later that same day — stays entirely
 * legacy, and the new rule begins on a day that is still today and
 * therefore cannot count until it is final — yesterday under the old rules,
 * settled in the P8 era (D136). Every later call
 * finds the state and does nothing. The boundary is never moved.
 *
 * An old backup carries no state, so restoring one on a device activates a
 * fresh prospective boundary on the next load; a newer backup carries its
 * own `from`, which is kept exactly, and its dates are reconciled from it.
 *
 * ## Reconciliation
 *
 * The pending dates are persisted because the product model asks for the
 * unique qualifying set to be on record. They are not a second source of
 * truth: the Boss replay recomputes the canonical state from stored history
 * on every load and hands it here, and the write happens only when the
 * stored bytes differ. Replaying twice, saving the same day twice, reloading
 * twice — all write the same thing, which is to say nothing.
 */
export async function ensurePromotionConfirmation(): Promise<PromotionConfirmationState> {
  const settings = await settingsRepository.getOrCreate();
  if (settings.promotionConfirmation) return settings.promotionConfirmation;
  const state = canonicalConfirmation(addDays(today(), 1), null);
  await settingsRepository.update({ promotionConfirmation: state });
  return state;
}

export async function reconcilePromotionConfirmation(
  canonical: PromotionConfirmationState,
): Promise<'unchanged' | 'written'> {
  const settings = await settingsRepository.get();
  if (!settings?.promotionConfirmation) return 'unchanged';
  if (JSON.stringify(settings.promotionConfirmation) === JSON.stringify(canonical)) {
    return 'unchanged';
  }
  await settingsRepository.update({ promotionConfirmation: canonical });
  return 'written';
}
