import { nowIso } from '../../../core/clock';
import type { DateKey } from '../../../core/dates';
import { DOMAIN_DEFINITIONS } from '../../../core/domains';
import { createId } from '../../../core/ids';
import type { FoodEntryRecord } from '../../../core/model';
import { ensureCurrentSnapshot } from '../../configService';
import {
  configSnapshotsRepository,
  domainsRepository,
  foodDaysRepository,
  foodEntriesRepository,
} from '../../repositories';

/**
 * A device that had Food switched on before WP3 Stage 4 (D139).
 *
 * Nothing in the product creates Food data any more, so a test that needs
 * Food-era history writes it the way the old build left it on disk: a Food
 * domain record switched on, a snapshot carrying it from a given day, and
 * ratings and entries as stored rows. Every write goes through the
 * repositories, because the services no longer have a Food writer to go
 * through — which is the point.
 *
 * Nothing here calls `loadConfiguration`, so nothing here switches Food off.
 * A test that wants the switch-off runs it itself, on the day it chooses.
 */

/**
 * Switches Food on from `from`, as the old build's `enableDomain('food')`
 * did: the record (created the first time, re-enabled after), then the
 * configuration revision that carries it.
 */
export async function enableLegacyFood(from: DateKey): Promise<void> {
  const existing = await domainsRepository.findByType('food');
  if (existing) await domainsRepository.setEnabled(existing.id, true);
  else await domainsRepository.ensure('food', DOMAIN_DEFINITIONS.food.order, DOMAIN_DEFINITIONS.food.defaultSettings);
  await ensureCurrentSnapshot(from);
}

/** A day's 1–10 rating, stored the way the old build's `saveAdherence` stored it. */
export async function rateLegacyFood(date: DateKey, adherence: number): Promise<void> {
  const snapshot = await configSnapshotsRepository.resolveForDate(date);
  await foodDaysRepository.save({ date, adherence, note: null, configSnapshotId: snapshot?.id ?? 'cfg_legacy' });
}

/** One thing eaten, stored the way the old build's `addFoodEntry` stored it. */
export async function logLegacyFoodEntry(
  date: DateKey,
  entry: Pick<FoodEntryRecord, 'label' | 'kcal'> & Partial<Pick<FoodEntryRecord, 'foodId' | 'grams' | 'proteinG' | 'carbsG' | 'fatG'>>,
): Promise<FoodEntryRecord> {
  const snapshot = await configSnapshotsRepository.resolveForDate(date);
  const stamp = nowIso();
  const record: FoodEntryRecord = {
    id: createId('food'),
    date,
    foodId: entry.foodId ?? null,
    label: entry.label,
    grams: entry.grams ?? null,
    kcal: entry.kcal,
    proteinG: entry.proteinG ?? null,
    carbsG: entry.carbsG ?? null,
    fatG: entry.fatG ?? null,
    detail: null,
    sensitivity: 'private',
    configSnapshotId: snapshot?.id ?? 'cfg_legacy',
    createdAt: stamp,
    updatedAt: stamp,
  };
  await foodEntriesRepository.put(record);
  return record;
}
