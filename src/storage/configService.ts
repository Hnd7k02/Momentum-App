import { equalWeights, weightsForSnapshot } from '../core/boss';
import { now, today } from '../core/clock';
import { EDIT_WINDOW_DAYS, GYM_METRIC, SESSION_WINDOW_DAYS } from '../core/config/constants';
import { buildConfigSnapshot, configSnapshotsEqual } from '../core/config/snapshot';
import type { DateKey } from '../core/dates';
import { enabledDomainsIn } from '../core/domains';
import { gymCurveOf, gymMetricOf } from '../core/gym/metric';
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

const marked = (snapshot: { config: AppConfigSnapshot }): boolean => snapshot.config.scoring.sessionWindowDays !== undefined;

/**
 * The P8 boundary dated after `date` that stays where it is (D132): the first
 * later snapshot carrying the marker, while the day in force does not — the
 * local date has moved back across it. One written on a clock that was ahead
 * is not kept: it moves to the day it reached.
 */
function keptSessionWindowEra(all: readonly ConfigSnapshotRecord[], date: DateKey): ConfigSnapshotRecord | undefined {
  const inForce = [...all].reverse().find((snapshot) => snapshot.effectiveFrom <= date);
  if (inForce === undefined || marked(inForce)) return undefined;
  const boundary = all.find((snapshot) => snapshot.effectiveFrom > date && marked(snapshot));
  if (boundary === undefined) return undefined;
  return now().getTime() < Date.parse(boundary.createdAt) ? undefined : boundary;
}

/** `config` with the one-day window's fields as `era` had them: before P8, none. */
function withWindowOf(config: AppConfigSnapshot, era: AppConfigSnapshot['scoring']): AppConfigSnapshot {
  const scoring: Partial<AppConfigSnapshot['scoring']> = { ...config.scoring };
  delete scoring.sessionWindowDays;
  if (era.editWindowDays === undefined) delete scoring.editWindowDays;
  else scoring.editWindowDays = era.editWindowDays;
  return { ...config, scoring: scoring as AppConfigSnapshot['scoring'] };
}

/**
 * How far a snapshot is into the era of the Stage 5b metric — asked where
 * the replay asks (D150, D177): `0` before it, no marker; `1` the marker
 * without the curve's value, which only a Stage 5b preview wrote; `2` the
 * whole marker, the metric and the curve that goes with it.
 */
const metricEraOf = (snapshot: { config: AppConfigSnapshot }): 0 | 1 | 2 =>
  gymMetricOf(snapshot.config) === null ? 0 : gymCurveOf(snapshot.config) === null ? 1 : 2;

/**
 * The marker of the Stage 5b era the day `date` was lived under, where a
 * boundary of that era dated after it stays where it is (D150, D177) — or
 * `undefined` where there is none, and the live configuration applies.
 *
 * A boundary is the first later snapshot that is further into the era than
 * the one in force on the day: the marker, for a day before it; the curve's
 * value, for a day lived under the marker a Stage 5b preview wrote. It
 * stays while the local date has merely moved back across it. One written
 * on a clock that was ahead is not kept: it moves to the day it reached.
 * The rule of the P8 boundary above, for the same reason.
 *
 * What is handed back is the field as the stored snapshot in force on that
 * day has it — absent, or without the value — never rebuilt.
 */
function livedGymMetric(all: readonly ConfigSnapshotRecord[], date: DateKey): { field: unknown } | undefined {
  const inForce = [...all].reverse().find((snapshot) => snapshot.effectiveFrom <= date);
  if (inForce === undefined || keptGymMetricEra(all, date) === undefined) return undefined;
  return { field: (inForce.config as { scoring?: { gymMetric?: unknown } } | null)?.scoring?.gymMetric };
}

/** The boundary of the Stage 5b era dated after `date` that stays where it is (above), or `undefined`. */
function keptGymMetricEra(all: readonly ConfigSnapshotRecord[], date: DateKey): ConfigSnapshotRecord | undefined {
  const inForce = [...all].reverse().find((snapshot) => snapshot.effectiveFrom <= date);
  if (inForce === undefined) return undefined;
  const era = metricEraOf(inForce);
  if (era === 2) return undefined;
  const boundary = all.find((snapshot) => snapshot.effectiveFrom > date && metricEraOf(snapshot) > era);
  if (boundary === undefined) return undefined;
  return now().getTime() < Date.parse(boundary.createdAt) ? undefined : boundary;
}

/** `config` with the Stage 5b marker as a day before a kept boundary had it: absent, or as stored. */
function withGymMetricAs(config: AppConfigSnapshot, field: unknown): AppConfigSnapshot {
  const scoring: Partial<AppConfigSnapshot['scoring']> = { ...config.scoring };
  if (field === undefined) delete scoring.gymMetric;
  else scoring.gymMetric = field as AppConfigSnapshot['scoring']['gymMetric'];
  return { ...config, scoring: scoring as AppConfigSnapshot['scoring'] };
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
 * **Except the eras a kept boundary has not reached** (D132, D139, D150,
 * D177). Once the local date has moved back across a boundary written
 * before now, the day it lands on was lived under the earlier era: without
 * the one-day window, with Food, or under the exercise-day metric before
 * Stage 5b — or under that metric with the curve as it was, on a device a
 * Stage 5b preview left. What is compared and written for a day before
 * such a boundary carries that era as it was — the window fields of the
 * snapshot in force; Food on, with the Boss weights over the domains that
 * were on; `gymMetric` as the stored snapshot in force on that day has it,
 * absent or without the curve's value — and from the boundary on, the live
 * configuration. An answer on that day therefore moves nothing, and a
 * change made on it reaches both sides.
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
  const inForce = [...all].reverse().find((snapshot) => snapshot.effectiveFrom <= effectiveFrom);
  const keptWindow = keptSessionWindowEra(all, effectiveFrom);
  const configOn = (date: DateKey) => {
    const withFood = kept !== undefined && date < kept.effectiveFrom ? lived : config;
    const withWindow =
      keptWindow !== undefined && inForce !== undefined && date < keptWindow.effectiveFrom
        ? withWindowOf(withFood, inForce.config.scoring)
        : withFood;
    // A day before a kept boundary of the Stage 5b era was lived under the
    // marker it had then: none, or the one without the curve's value (D150,
    // D177). Asked per day, so a snapshot dated between two kept boundaries
    // keeps what it carries.
    const metricThen = livedGymMetric(all, date);
    return metricThen === undefined ? withWindow : withGymMetricAs(withWindow, metricThen.field);
  };
  for (const later of all.filter((snapshot) => snapshot.effectiveFrom > effectiveFrom)) {
    const target = configOn(later.effectiveFrom);
    if (!configSnapshotsEqual(later.config, target)) await configSnapshotsRepository.append(target, later.effectiveFrom);
  }
  const target = configOn(effectiveFrom);
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
 * Kept, it locks today until the boundary — hours, after a journey west — and
 * a configuration change made meanwhile keeps it there too: `ensureCurrentSnapshot`
 * writes that day without the P8 fields (review of Stage 4).
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
  const inForce = [...all].reverse().find((snapshot) => snapshot.effectiveFrom <= effectiveFrom) ?? null;
  const later = all.filter((snapshot) => snapshot.effectiveFrom > effectiveFrom);
  let appended = false;
  const kept = keptSessionWindowEra(all, effectiveFrom);
  if (inForce !== null && !marked(inForce) && kept === undefined) {
    await configSnapshotsRepository.append(withMarker(inForce.config), effectiveFrom);
    appended = true;
  }
  for (const snapshot of later) {
    // Dated before a kept boundary: its days were lived under the old era (block 9).
    if (kept !== undefined && snapshot.effectiveFrom < kept.effectiveFrom) continue;
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
  const kept = keptFoodSwitchOff(all, effectiveFrom);
  if (inForce !== null && foodOn(inForce) && kept === undefined) {
    await configSnapshotsRepository.append(withoutFood(inForce.config), effectiveFrom);
    retired = true;
  }
  for (const snapshot of later) {
    // Dated before a kept switch-off: its days were lived with Food (block 9).
    if (kept !== undefined && snapshot.effectiveFrom < kept.effectiveFrom) continue;
    if (foodOn(snapshot)) {
      await configSnapshotsRepository.append(withoutFood(snapshot.config), snapshot.effectiveFrom);
      retired = true;
    }
  }
  return retired ? 'retired' : 'unchanged';
}

/**
 * The exercise-day metric of WP3 Stage 5b begins on the first load after the
 * update (D150), as an era built the way the P8 step above is — and with it
 * the value of the performance curve that fits it (block "Kurve", D177).
 *
 * Keyed on the snapshot in force today: when it does not carry the whole
 * marker, the same configuration is appended effective today with it and
 * nothing else new — it starts this era and no other. On a day that already
 * has a snapshot — the P8 and Food steps of the same load may just have
 * written one — that one is carried over with the field added. A snapshot
 * dated after today is completed too, so the era cannot flip back on its
 * date.
 *
 * - **A device as the live build left it** has no marker: metric and curve
 *   arrive in one snapshot, and it has one boundary.
 * - **A device a Stage 5b preview left** carries the marker without the
 *   curve's value: the value is added to the marker it has — its divisor
 *   and its comparison carried as they were — effective today. Its days
 *   between the two boundaries were scored with the curve at ten and replay
 *   so; the value is never written into a snapshot dated in the past.
 *
 * From the boundary on the Gym rating reads each day's two windows by the
 * best working set and the strength score, the windows reaching back over
 * the sets before the boundary in the same unit, and turns their changes
 * into a level by the curve at the value its snapshot names; every day
 * before the boundary has no marker in its snapshot and replays by the best
 * set of `reps × load` and the curve at ten, byte for byte.
 *
 * **A boundary already written stays where it is, unless the clock was
 * ahead when it was written** — the boundary rule of the P8 step, for the
 * same reason: a local date can move back across it (a journey west), and
 * the day it lands on was lived under the earlier state and must replay as
 * it was. A write on that day keeps it there too: `ensureCurrentSnapshot`
 * writes such a day with the field as that day had it.
 *
 * A profile with no snapshot in force today is left alone for today, and
 * one with no snapshot at all is left alone: its first snapshot is written
 * with the field. A snapshot without a `scoring` object — a restored file
 * is not validated — is left as it is; nothing here throws, because a throw
 * would stop the app from opening, on every retry. Idempotent.
 */
export async function ensureGymMetricEra(
  effectiveFrom: DateKey = today(),
): Promise<'unchanged' | 'appended'> {
  const all = await configSnapshotsRepository.list();
  const readable = (snapshot: ConfigSnapshotRecord): boolean =>
    typeof snapshot.config === 'object' &&
    snapshot.config !== null &&
    typeof snapshot.config.scoring === 'object' &&
    snapshot.config.scoring !== null;
  /*
   * The whole marker. Where the snapshot has one already, its own fields
   * are kept and the curve's value is added; where it has none, the marker
   * is this build's. Either way the keys stand in the order
   * `buildConfigSnapshot()` writes them, so the next write finds nothing to
   * append.
   */
  const complete = (config: AppConfigSnapshot): AppConfigSnapshot => {
    const marker = gymMetricOf(config) === null ? {} : (config.scoring.gymMetric as object);
    return {
      ...config,
      scoring: {
        ...config.scoring,
        gymMetric: { ...GYM_METRIC, ...marker, curveDecadePercent: GYM_METRIC.curveDecadePercent },
      },
    };
  };
  const inForce = [...all].reverse().find((snapshot) => snapshot.effectiveFrom <= effectiveFrom) ?? null;
  const later = all.filter((snapshot) => snapshot.effectiveFrom > effectiveFrom);
  let appended = false;
  const kept = keptGymMetricEra(all, effectiveFrom);
  if (
    inForce !== null &&
    readable(inForce) &&
    metricEraOf(inForce) < 2 &&
    kept === undefined
  ) {
    await configSnapshotsRepository.append(complete(inForce.config), effectiveFrom);
    appended = true;
  }
  for (const snapshot of later) {
    // Dated before a kept boundary: its days were lived under the earlier metric (block 9).
    if (kept !== undefined && snapshot.effectiveFrom < kept.effectiveFrom) continue;
    if (readable(snapshot) && metricEraOf(snapshot) < 2) {
      await configSnapshotsRepository.append(complete(snapshot.config), snapshot.effectiveFrom);
      appended = true;
    }
  }
  return appended ? 'appended' : 'unchanged';
}
