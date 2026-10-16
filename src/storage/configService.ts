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
 * Keyed on the snapshot **in force today**, not on the latest one: when it
 * lacks the marker, the same configuration is appended effective today with
 * the one-day window and the marker and nothing else new — it starts this era
 * and no other (a device that skipped releases starts the Boss or model eras
 * on its next write, which appends the full current configuration effective
 * that day, exactly as it always did). On a day that already has a snapshot,
 * that one is carried over with the two fields added. A snapshot dated after
 * today — a clock that was ahead — is not in force yet: it takes the fields
 * too, so the era cannot flip back on its date, and a marker it already
 * carries does not stand in for today's, so a corrected clock never finds
 * today locked. With nothing in force today but something dated later — set
 * up while the clock was ahead — today takes that first configuration, so
 * the app can be written to at all. A profile with no snapshot is left
 * alone: its first snapshot is written with the fields. Idempotent.
 */
export async function ensureSessionWindowEra(
  effectiveFrom: DateKey = today(),
): Promise<'unchanged' | 'appended'> {
  const all = await configSnapshotsRepository.list();
  if (all.length === 0) return 'unchanged';
  const withMarker = (config: AppConfigSnapshot): AppConfigSnapshot => ({
    ...config,
    scoring: { ...config.scoring, editWindowDays: EDIT_WINDOW_DAYS, sessionWindowDays: SESSION_WINDOW_DAYS },
  });
  const marked = (snapshot: { config: AppConfigSnapshot }) => snapshot.config.scoring.sessionWindowDays !== undefined;
  const inForce = [...all].reverse().find((snapshot) => snapshot.effectiveFrom <= effectiveFrom) ?? null;
  const later = all.filter((snapshot) => snapshot.effectiveFrom > effectiveFrom);
  let appended = false;
  if (inForce === null || !marked(inForce)) {
    const base = inForce ?? later[0]!;
    await configSnapshotsRepository.append(withMarker(base.config), effectiveFrom);
    appended = true;
  }
  for (const snapshot of later) {
    if (!marked(snapshot)) {
      await configSnapshotsRepository.append(withMarker(snapshot.config), snapshot.effectiveFrom);
      appended = true;
    }
  }
  return appended ? 'appended' : 'unchanged';
}
