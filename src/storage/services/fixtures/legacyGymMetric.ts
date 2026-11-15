import type { AppConfigSnapshot, ConfigSnapshotRecord } from '../../../core/model';
import { configSnapshotsRepository } from '../../repositories';

/**
 * A device as a build before WP3 Stage 5b left it: no snapshot carries the
 * exercise-day metric (D150).
 *
 * Every snapshot this build writes carries `scoring.gymMetric`, so a history
 * made through the services is lived under the Stage 5b metric from its
 * first day. A test that is about the metric before it — the best set by
 * `reps × load`, a window's last day against its first — or about the day
 * the update lands writes its history through the services and then calls
 * this: the stored snapshots are rewritten without the field, the way such
 * a device holds them. The absence is the era; nothing else is touched.
 *
 * Call it after the last write of the history: a service write compares the
 * live configuration, which has the field, with the snapshot in force and
 * would start the era on that day — exactly as it does on a real device
 * whose first load after the update has not run yet.
 *
 * Nothing here calls `loadConfiguration`, so nothing here starts the era. A
 * test that wants the update runs `ensureGymMetricEra` itself, on the day it
 * chooses.
 */
export async function withoutGymMetricEra(): Promise<void> {
  const all = await configSnapshotsRepository.list();
  await configSnapshotsRepository.replaceAll(all.map(withoutMetric));
}

function withoutMetric(snapshot: ConfigSnapshotRecord): ConfigSnapshotRecord {
  const scoring: Partial<AppConfigSnapshot['scoring']> = { ...snapshot.config.scoring };
  delete scoring.gymMetric;
  return { ...snapshot, config: { ...snapshot.config, scoring: scoring as AppConfigSnapshot['scoring'] } };
}
