import { nowIso, today } from '../../core/clock';
import type { RankId } from '../../core/config/constants';
import type { Language, SettingsRecord } from '../../core/model';
import type { WeightUnit } from '../../core/gym/weight';
import { canonicalConfirmation } from '../../core/ranks/confirmation';
import { STORES } from '../db';
import { createRepository } from './base';

const repo = createRepository<SettingsRecord>(STORES.settings);
const SETTINGS_ID = 'settings';

export const settingsRepository = {
  async get(): Promise<SettingsRecord | undefined> {
    return repo.get(SETTINGS_ID);
  },

  /**
   * Reads settings, creating the day-one record on first launch.
   *
   * A record created under this version carries the promotion-confirmation
   * era from its first day (D126): a new user has no legacy rank to keep,
   * so the confirmation rule applies from the start — today itself still
   * cannot count, because a current day never does. An *absent* field
   * therefore has one meaning only: a record that predates the feature,
   * which the ensure step activates prospectively.
   */
  async getOrCreate(defaults: Partial<SettingsRecord> = {}): Promise<SettingsRecord> {
    const existing = await repo.get(SETTINGS_ID);
    if (existing) return existing;
    const stamp = nowIso();
    const created: SettingsRecord = {
      id: SETTINGS_ID,
      language: 'de',
      firstUseDate: today(),
      onboardingCompletedAt: null,
      acknowledgedRankId: null,
      promotionConfirmation: canonicalConfirmation(today(), null),
      createdAt: stamp,
      updatedAt: stamp,
      ...defaults,
    };
    await repo.put(created);
    return created;
  },

  async update(patch: Partial<Omit<SettingsRecord, 'id' | 'createdAt'>>): Promise<SettingsRecord> {
    const current = await settingsRepository.getOrCreate();
    const next: SettingsRecord = { ...current, ...patch, id: SETTINGS_ID, updatedAt: nowIso() };
    await repo.put(next);
    return next;
  },

  async setLanguage(language: Language): Promise<SettingsRecord> {
    return settingsRepository.update({ language });
  },

  async setWeightUnit(weightUnit: WeightUnit): Promise<SettingsRecord> {
    return settingsRepository.update({ weightUnit });
  },

  /** Records that a promotion reveal has been played. */
  async acknowledgeRank(rankId: RankId): Promise<SettingsRecord> {
    return settingsRepository.update({ acknowledgedRankId: rankId });
  },

  async completeOnboarding(): Promise<SettingsRecord> {
    return settingsRepository.update({ onboardingCompletedAt: nowIso() });
  },

  async replaceAll(record: SettingsRecord | null): Promise<void> {
    await repo.clear();
    if (record) await repo.put({ ...record, id: SETTINGS_ID });
  },
};
