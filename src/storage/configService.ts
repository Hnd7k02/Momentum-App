import { equalWeights, weightsForSnapshot } from '../core/boss';
import { now, today } from '../core/clock';
import { EDIT_WINDOW_DAYS, SESSION_WINDOW_DAYS } from '../core/config/constants';
import { buildConfigSnapshot, configSnapshotsEqual } from '../core/config/snapshot';
import type { DateKey } from '../core/dates';
import { enabledDomainsIn } from '../core/domains';
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

/**
 * Food leaves the product (WP3 Stage 4, P1 — D139), as an era that begins on
 * the first load after the update, built the way the P8 step above is.
 *
 * Keyed on the data, never on a run-once flag: wherever Food is still
 * switched on — the live record, the snapshot in force today, a snapshot
 * dated later — it is switched off. A backup from before the update
 * restored later, a second tab still running the old build that switches
 * Food back on, an old-build switch-off interrupted between its two writes:
 * each ends the same way on the next load.
 *
 * - The live record goes off first, its settings kept (P2). The live
 *   configuration is what `ensureCurrentSnapshot` compares against the
 *   snapshot in force, so a record left on would switch Food back on with
 *   the next answer, and Rang would keep showing its share.
 * - The snapshot in force today is carried over, effective today, with
 *   Food's entry disabled and the Boss weights worked out again over the
 *   domains that remain — by `buildConfigSnapshot`'s rule (the user's parts,
 *   or equal shares), so Rang shows the shares the Boss uses and the next
 *   write finds nothing to append. Every other field is carried as it was:
 *   this starts its own era and no other, and a snapshot without `boss`
 *   (RC2) gets none.
 * - A snapshot dated after today takes the same at its own date, so Food
 *   cannot come back on that day.
 * - **A switch-off already written stays where it is, unless the clock was
 *   ahead when it was written** — the boundary rule of the P8 step, for the
 *   same reason: a local date can move back across it (a journey west), and
 *   the day it lands on was lived with Food and must replay as it was.
 * - A profile with no snapshot in force today is left alone for today.
 *
 * Every day before the switch-off replays byte-identically, because a day
 * reads its own snapshot; from that day the Boss moves by the remaining
 * domains alone, with no jump (`bossSeries` adds movement). Nothing here
 * throws on a configuration it does not recognise: a throw would stop the
 * app from opening, on every retry. Idempotent.
 */
export async function ensureFoodRetired(
  effectiveFrom: DateKey = today(),
): Promise<'unchanged' | 'retired'> {
  const [all, domains, settings] = await Promise.all([
    configSnapshotsRepository.list(),
    domainsRepository.list(),
    settingsRepository.get(),
  ]);
  let retired = false;
  for (const domain of domains) {
    if (domain.type === 'food' && domain.enabled) {
      await domainsRepository.setEnabled(domain.id, false);
      retired = true;
    }
  }

  const entriesOf = (config: AppConfigSnapshot) => (Array.isArray(config.domains) ? config.domains : []);
  const foodOn = (snapshot: { config: AppConfigSnapshot }) =>
    entriesOf(snapshot.config).some((domain) => domain.type === 'food' && domain.enabled);
  const withoutFood = (config: AppConfigSnapshot): AppConfigSnapshot => {
    const next: AppConfigSnapshot = {
      ...config,
      domains: entriesOf(config).map((domain) => (domain.type === 'food' ? { ...domain, enabled: false } : domain)),
    };
    if (config.boss) {
      const remaining = enabledDomainsIn(next);
      next.boss = {
        ...config.boss,
        weights: settings?.bossWeights ? weightsForSnapshot(settings.bossWeights, remaining) : equalWeights(remaining),
      };
    }
    return next;
  };

  const inForce = [...all].reverse().find((snapshot) => snapshot.effectiveFrom <= effectiveFrom) ?? null;
  const later = all.filter((snapshot) => snapshot.effectiveFrom > effectiveFrom);
  if (inForce !== null && foodOn(inForce)) {
    const boundary = later.find((snapshot) => !foodOn(snapshot));
    const clockWasAhead = boundary !== undefined && now().getTime() < Date.parse(boundary.createdAt);
    if (boundary === undefined || clockWasAhead) {
      await configSnapshotsRepository.append(withoutFood(inForce.config), effectiveFrom);
      retired = true;
    }
  }
  for (const snapshot of later) {
    if (foodOn(snapshot)) {
      await configSnapshotsRepository.append(withoutFood(snapshot.config), snapshot.effectiveFrom);
      retired = true;
    }
  }
  return retired ? 'retired' : 'unchanged';
}
