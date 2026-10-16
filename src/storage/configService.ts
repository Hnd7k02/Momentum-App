import { equalWeights, weightsForSnapshot } from '../core/boss';
import { now, today } from '../core/clock';
import { EDIT_WINDOW_DAYS, SESSION_WINDOW_DAYS } from '../core/config/constants';
import { buildConfigSnapshot, configSnapshotsEqual } from '../core/config/snapshot';
import type { DateKey } from '../core/dates';
import { enabledDomainsIn } from '../core/domains';
import type { AppConfigSnapshot, ConfigSnapshotRecord, DomainConfigSnapshot, DomainRecord, QuestionRecord } from '../core/model';
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
  const { domains, questions, bossWeights } = await liveConfiguration();
  return buildConfigSnapshot(domains, questions, bossWeights);
}

async function liveConfiguration(): Promise<{
  domains: DomainRecord[];
  questions: QuestionRecord[];
  bossWeights: Parameters<typeof buildConfigSnapshot>[2];
}> {
  const [domains, questions, settings] = await Promise.all([
    domainsRepository.list(),
    questionsRepository.list(),
    settingsRepository.get(),
  ]);
  // Boss weights are scoring-relevant configuration, so they travel with the
  // rest of it. Changing them appends a snapshot and therefore applies from
  // that day forward — the forward-only rule, with nothing to enforce.
  return { domains, questions, bossWeights: settings?.bossWeights };
}

/** A snapshot's domain entries that are entries at all — a restored file is not trusted to hold only those. */
const entriesOf = (config: AppConfigSnapshot): DomainConfigSnapshot[] =>
  Array.isArray(config.domains)
    ? config.domains.filter((entry): entry is DomainConfigSnapshot => typeof entry === 'object' && entry !== null)
    : [];

const foodOn = (snapshot: { config: AppConfigSnapshot }): boolean =>
  entriesOf(snapshot.config).some((domain) => domain.type === 'food' && domain.enabled);

/**
 * A Food switch-off dated after `date` that stays where it is (D139): the
 * first later snapshot with Food off, while the day in force still has Food
 * on — the local date has moved back across it. A switch-off written on a
 * clock that was ahead is not kept: it moves to the day it reached.
 */
function keptFoodSwitchOff(all: readonly ConfigSnapshotRecord[], date: DateKey): ConfigSnapshotRecord | undefined {
  const inForce = [...all].reverse().find((snapshot) => snapshot.effectiveFrom <= date);
  if (inForce === undefined || !foodOn(inForce)) return undefined;
  const boundary = all.find((snapshot) => snapshot.effectiveFrom > date && !foodOn(snapshot));
  if (boundary === undefined) return undefined;
  return now().getTime() < Date.parse(boundary.createdAt) ? undefined : boundary;
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
 *
 * **Except Food, before a switch-off that is kept** (D139). Once the local
 * date has moved back across the switch-off, the live Food record is off but
 * the day was lived with Food. What is compared and written for a day before
 * the switch-off carries Food as it was on, with the Boss weights over the
 * domains that were on; from the switch-off on, the live configuration. An
 * answer on that day therefore moves nothing, and a change made on it reaches
 * both sides.
 */
export async function ensureCurrentSnapshot(
  effectiveFrom: DateKey = today(),
): Promise<ConfigSnapshotRecord> {
  const [{ domains, questions, bossWeights }, all] = await Promise.all([
    liveConfiguration(),
    configSnapshotsRepository.list(),
  ]);
  const config = buildConfigSnapshot(domains, questions, bossWeights);
  const kept = keptFoodSwitchOff(all, effectiveFrom);
  const lived = kept
    ? buildConfigSnapshot(
        domains.map((domain) => (domain.type === 'food' ? ({ ...domain, enabled: true } as DomainRecord) : domain)),
        questions,
        bossWeights,
      )
    : config;
  const configOn = (date: DateKey) => (kept !== undefined && date < kept.effectiveFrom ? lived : config);
  for (const later of all.filter((snapshot) => snapshot.effectiveFrom > effectiveFrom)) {
    const target = configOn(later.effectiveFrom);
    if (!configSnapshotsEqual(later.config, target)) await configSnapshotsRepository.append(target, later.effectiveFrom);
  }
  const target = configOn(effectiveFrom);
  const inForce = [...all].reverse().find((snapshot) => snapshot.effectiveFrom <= effectiveFrom);
  if (inForce && configSnapshotsEqual(inForce.config, target)) return inForce;
  return configSnapshotsRepository.append(target, effectiveFrom);
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
 *   the day it lands on was lived with Food and must replay as it was. A
 *   write on that day keeps it there too: `ensureCurrentSnapshot` carries
 *   Food as it was on any day before a kept switch-off.
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

  const withoutFood = (config: AppConfigSnapshot): AppConfigSnapshot => {
    // Entries that are not entries are carried untouched; nothing here reads them.
    const domains: unknown[] = Array.isArray(config.domains) ? config.domains : [];
    const next: AppConfigSnapshot = {
      ...config,
      domains: domains.map((domain) =>
        typeof domain === 'object' && domain !== null && (domain as DomainConfigSnapshot).type === 'food'
          ? { ...(domain as DomainConfigSnapshot), enabled: false }
          : domain,
      ) as DomainConfigSnapshot[],
    };
    if (config.boss) {
      const remaining = enabledDomainsIn({ ...next, domains: entriesOf(next) });
      next.boss = {
        ...config.boss,
        weights: settings?.bossWeights ? weightsForSnapshot(settings.bossWeights, remaining) : equalWeights(remaining),
      };
    }
    return next;
  };

  const inForce = [...all].reverse().find((snapshot) => snapshot.effectiveFrom <= effectiveFrom) ?? null;
  const later = all.filter((snapshot) => snapshot.effectiveFrom > effectiveFrom);
  if (inForce !== null && foodOn(inForce) && keptFoodSwitchOff(all, effectiveFrom) === undefined) {
    await configSnapshotsRepository.append(withoutFood(inForce.config), effectiveFrom);
    retired = true;
  }
  for (const snapshot of later) {
    if (foodOn(snapshot)) {
      await configSnapshotsRepository.append(withoutFood(snapshot.config), snapshot.effectiveFrom);
      retired = true;
    }
  }
  return retired ? 'retired' : 'unchanged';
}
