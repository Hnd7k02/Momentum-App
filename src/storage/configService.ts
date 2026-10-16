import { today } from '../core/clock';
import { EDIT_WINDOW_DAYS, SESSION_WINDOW_DAYS } from '../core/config/constants';
import { buildConfigSnapshot, configSnapshotsEqual } from '../core/config/snapshot';
import type { DateKey } from '../core/dates';
import type { AppConfigSnapshot, ConfigSnapshotRecord } from '../core/model';
import {
  configSnapshotsRepository,
  domainsRepository,
  questionsRepository,
  settingsRepository,
} from './repositories';

/**
 * Keeps the configuration log honest.
 *
 * Every write of an answer or a session references the snapshot in force at
 * the time, and every configuration change appends a new snapshot — but only
 * if something scoring-relevant actually changed.
 */

export async function currentConfigSnapshot(): Promise<AppConfigSnapshot> {
  const [domains, questions, settings] = await Promise.all([
    domainsRepository.list(),
    questionsRepository.list(),
    settingsRepository.get(),
  ]);
  // Boss weights are scoring-relevant configuration, so they travel with the
  // rest of it. Changing them appends a snapshot and therefore applies from
  // that day forward — the forward-only rule, with nothing to enforce.
  return buildConfigSnapshot(domains, questions, settings?.bossWeights);
}

/**
 * Returns the snapshot record that new entries should reference, appending one
 * first if configuration has drifted from the last recorded state.
 */
export async function ensureCurrentSnapshot(
  effectiveFrom: DateKey = today(),
): Promise<ConfigSnapshotRecord> {
  const [config, latest] = await Promise.all([
    currentConfigSnapshot(),
    configSnapshotsRepository.latest(),
  ]);
  if (latest && configSnapshotsEqual(latest.config, config)) return latest;
  return configSnapshotsRepository.append(config, effectiveFrom);
}

/** The configuration a past day must be scored against. */
export async function configForDate(date: DateKey): Promise<AppConfigSnapshot | undefined> {
  const record = await configSnapshotsRepository.resolveForDate(date);
  return record?.config;
}

/**
 * The P8 era begins on the first load after the update (D132) — not on the
 * first configuration write, which may never come, and which a write guard
 * that refuses pre-P8 days would refuse anyway before it could append.
 *
 * Appends, effective today, the latest snapshot again with the one-day window
 * and the P8 marker and nothing else new: it starts this era and no other (a
 * device that skipped releases starts the Boss or model eras on its next real
 * configuration change, exactly as it always did). On a day that already has
 * a snapshot, that one is carried over with the two fields added. A snapshot
 * dated after today — a clock that was ahead — is not in force yet and takes
 * the fields too, so the era cannot flip back on its date. A profile with no
 * snapshot at all is left alone: its first snapshot is written with the
 * fields. Idempotent: once the latest snapshot carries the marker, nothing
 * is written.
 */
export async function ensureSessionWindowEra(
  effectiveFrom: DateKey = today(),
): Promise<'unchanged' | 'appended'> {
  const all = await configSnapshotsRepository.list();
  const latest = all[all.length - 1];
  if (!latest || latest.config.scoring.sessionWindowDays !== undefined) return 'unchanged';
  const withMarker = (config: AppConfigSnapshot): AppConfigSnapshot => ({
    ...config,
    scoring: { ...config.scoring, editWindowDays: EDIT_WINDOW_DAYS, sessionWindowDays: SESSION_WINDOW_DAYS },
  });
  const inForce = [...all].reverse().find((snapshot) => snapshot.effectiveFrom <= effectiveFrom) ?? latest;
  await configSnapshotsRepository.append(withMarker(inForce.config), effectiveFrom);
  for (const later of all.filter((snapshot) => snapshot.effectiveFrom > effectiveFrom)) {
    if (later.config.scoring.sessionWindowDays === undefined) {
      await configSnapshotsRepository.append(withMarker(later.config), later.effectiveFrom);
    }
  }
  return 'appended';
}
