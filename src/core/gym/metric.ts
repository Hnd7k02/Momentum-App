import type { AppConfigSnapshot, GymWindowComparison } from '../model';
import { isCurveDecade } from '../scoring/performanceCurve';

/**
 * Which exercise-day metric a day was lived under (WP3 Stage 5b, D150), and
 * which value of the performance curve (block "Kurve", D177).
 *
 * This module is the one reader of `scoring.gymMetric`, in two functions
 * for two askers. `gymMetricOf()` is what the pure pipeline in
 * `performance.ts` takes: everything that computes a change — the rating
 * replay for each of its days, the Gym history for the day its range ends
 * on — asks it with that day's snapshot. `gymCurveOf()` is what turns such
 * a change into a level, and only the rating replay asks it. No screen and
 * no service decides either for itself, so a day cannot be read by two
 * metrics or scored by two curves.
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

/**
 * The value of the performance curve a snapshot carries for Gym — how many
 * percentage points of change multiply the odds by four — or `null` where
 * it carries none (D177).
 *
 * **`null` is the curve of the constants, ten, never today's value**: a
 * snapshot before the Stage 5b era has no marker at all, and a marker a
 * Stage 5b preview wrote has no value; the days either covers were scored
 * with the curve at ten and replay so. The value lives inside the marker,
 * so a snapshot cannot carry the new curve without the new metric.
 *
 * A value that is not a positive finite number — a restored file is not
 * validated — is no value: the curve as it was, and the activation step,
 * which asks this same function, then writes a real one. Nothing throws.
 */
export function gymCurveOf(config: AppConfigSnapshot | null | undefined): number | null {
  const raw: unknown = (config as { scoring?: { gymMetric?: unknown } } | null | undefined)?.scoring?.gymMetric;
  if (raw === null || typeof raw !== 'object') return null;
  const value = (raw as { curveDecadePercent?: unknown }).curveDecadePercent;
  return isCurveDecade(value) ? value : null;
}

/** One string per distinct way a Gym day is scored — its metric and its curve — for a cache that must never mix two. */
export function gymScoringKey(metric: GymMetric | null, curveDecadePercent: number | null): string {
  return `${gymMetricKey(metric)}|${curveDecadePercent === null ? 'curve:constant' : `curve:${curveDecadePercent}`}`;
}
