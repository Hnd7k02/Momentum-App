import type { AppConfigSnapshot, GymWindowComparison } from '../model';

/**
 * Which exercise-day metric a day was lived under (WP3 Stage 5b, D150).
 *
 * The one reader of `scoring.gymMetric`. Everything that computes — the
 * rating replay for each of its days, the Gym history for the day its range
 * ends on — asks here with that day's snapshot and hands the answer to the
 * pure pipeline in `performance.ts`. No screen and no service decides for
 * itself, so a day cannot be read by two metrics.
 */

/**
 * The metric of the Stage 5b era as the pipeline takes it: the best working
 * set by `load × (1 + reps ÷ repsDivisor)`, and how a window compares an
 * exercise's days. **`null` is the metric before it** (D84), in all its
 * parts: the best set by `reps × load` over every set, the last day against
 * the first, the order of the set index.
 */
export interface GymMetric {
  repsDivisor: number;
  comparison: GymWindowComparison;
}

/**
 * The metric a snapshot carries, or `null` for the era before the field.
 *
 * Presence is the marker, and absence is the old metric — never today's
 * (`CLAUDE.md`, "Configuration is historical"). A field that is present but
 * not what this build writes — a restored file is not validated — still
 * marks the era: a divisor that is not a positive number reads as 30, and a
 * comparison that is not `firstLast` reads as `median`. A field that is not
 * an object at all is no marker: the activation step, which asks this same
 * function, then writes a real one.
 */
export function gymMetricOf(config: AppConfigSnapshot | null | undefined): GymMetric | null {
  const raw: unknown = (config as { scoring?: { gymMetric?: unknown } } | null | undefined)?.scoring?.gymMetric;
  if (raw === null || typeof raw !== 'object') return null;
  const { repsDivisor, comparison } = raw as { repsDivisor?: unknown; comparison?: unknown };
  return {
    repsDivisor:
      typeof repsDivisor === 'number' && Number.isFinite(repsDivisor) && repsDivisor > 0
        ? repsDivisor
        : DEFAULT_REPS_DIVISOR,
    comparison: comparison === 'firstLast' ? 'firstLast' : 'median',
  };
}

/** What an unreadable divisor is read as: the value of the era's first build. */
const DEFAULT_REPS_DIVISOR = 30;

/** One string per distinct metric, for a cache that must never mix two. */
export function gymMetricKey(metric: GymMetric | null): string {
  return metric === null ? 'legacy' : `strength:${metric.repsDivisor}:${metric.comparison}`;
}
