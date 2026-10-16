import { now, today } from '../core/clock';
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
 * first if configuration has drifted from the state in force on the day.
 *
 * Compared with the snapshot in force on `effectiveFrom`, not the latest: a
 * snapshot dated later exists only where a clock was once ahead, and drift
 * measured against it would leave today's own snapshot behind the change.
 * Such a later snapshot is not history yet — no day has been lived under it —
 * so it takes the current configuration too, or a change made today would be
 * undone on its date.
 */
export async function ensureCurrentSnapshot(
  effectiveFrom: DateKey = today(),
): Promise<ConfigSnapshotRecord> {
  const [config, all] = await Promise.all([currentConfigSnapshot(), configSnapshotsRepository.list()]);
  for (const later of all.filter((snapshot) => snapshot.effectiveFrom > effectiveFrom)) {
    if (!configSnapshotsEqual(later.config, config)) await configSnapshotsRepository.append(config, later.effectiveFrom);
  }
  const inForce = [...all].reverse().find((snapshot) => snapshot.effectiveFrom <= effectiveFrom);
  if (inForce && configSnapshotsEqual(inForce.config, config)) return inForce;
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
 * Keyed on the snapshot in force today: when it lacks the marker, the same
 * configuration is appended effective today with the one-day window and the
 * marker and nothing else new — it starts this era and no other (a device
 * that skipped releases starts the Boss or model eras on its next write,
 * which appends the full current configuration effective that day, exactly
 * as it always did). On a day that already has a snapshot, that one is
 * carried over with the two fields added. A snapshot dated after today takes
 * the fields too, so the era cannot flip back on its date.
 *
 * **A boundary already written stays where it is, unless the clock was ahead
 * when it was written.** Today falling before it means one of two things: the
 * first load after the update ran on a clock that was ahead and has since
 * been put right — the days in between are being lived under the new build,
 * so the era moves to today — or the local date has moved back since, through
 * a time zone or a clock set back, and the day it lands on was lived under the
 * old rules and must replay as it was. The two are told apart by the instant
 * the boundary was written: a local date can move back, absolute time cannot,
 * so only a boundary written after now was written on a clock that was ahead.
 * Kept, it locks today until the boundary — hours, after a journey west.
 *
 * A profile with no snapshot in force today — set up while the clock was
 * ahead — is left alone: moving its configuration back would put days before
 * its first day, and its D126 boundary, into its history; nothing written on
 * them could count. A profile with no snapshot at all is left alone too: its
 * first snapshot is written with the fields. Idempotent.
 */
export async function ensureSessionWindowEra(
  effectiveFrom: DateKey = today(),
): Promise<'unchanged' | 'appended'> {
  const all = await configSnapshotsRepository.list();
  const withMarker = (config: AppConfigSnapshot): AppConfigSnapshot => ({
    ...config,
    scoring: { ...config.scoring, editWindowDays: EDIT_WINDOW_DAYS, sessionWindowDays: SESSION_WINDOW_DAYS },
  });
  const marked = (snapshot: { config: AppConfigSnapshot }) => snapshot.config.scoring.sessionWindowDays !== undefined;
  const inForce = [...all].reverse().find((snapshot) => snapshot.effectiveFrom <= effectiveFrom) ?? null;
  const later = all.filter((snapshot) => snapshot.effectiveFrom > effectiveFrom);
  let appended = false;
  if (inForce !== null && !marked(inForce)) {
    const boundary = later.find(marked);
    const clockWasAhead = boundary !== undefined && now().getTime() < Date.parse(boundary.createdAt);
    if (boundary === undefined || clockWasAhead) {
      await configSnapshotsRepository.append(withMarker(inForce.config), effectiveFrom);
      appended = true;
    }
  }
  for (const snapshot of later) {
    if (!marked(snapshot)) {
      await configSnapshotsRepository.append(withMarker(snapshot.config), snapshot.effectiveFrom);
      appended = true;
    }
  }
  return appended ? 'appended' : 'unchanged';
}
