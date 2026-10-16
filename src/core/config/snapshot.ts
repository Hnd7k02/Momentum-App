import {
  EDIT_WINDOW_DAYS,
  GYM_SCORING_MODEL,
  RUNNING_SCORING_MODEL,
  SCALE_MAX,
  SCALE_MIN,
  SCORING_MODEL,
  SESSION_WINDOW_DAYS,
} from './constants';
import type {
  AppConfigSnapshot,
  DomainConfigSnapshot,
  DomainRecord,
  QuestionConfigSnapshot,
  QuestionRecord,
} from '../model';
import { activationOf } from '../domains';
import { equalWeights, weightsForSnapshot, type BossWeights } from '../boss';

/**
 * Config snapshots (§18).
 *
 * Momentum stores source events and derives everything else, which only works
 * if the configuration each event happened under can be reconstructed. Rather
 * than a full effective-dated revision system, version 1 appends a snapshot
 * whenever scoring-relevant configuration changes and resolves any past day
 * to the latest snapshot effective on or before it.
 */

function toQuestionSnapshot(question: QuestionRecord): QuestionConfigSnapshot {
  return {
    id: question.id,
    domainId: question.domainId,
    text: question.text,
    type: question.type,
    status: question.status,
    // The category is part of the arithmetic now, so a past day has to be
    // able to read the category the question was in *then*. Moving a question
    // to another shelf today cannot reach back.
    category: question.category,
  };
}

function toDomainSnapshot(domain: DomainRecord): DomainConfigSnapshot {
  return {
    id: domain.id,
    type: domain.type,
    enabled: domain.enabled,
    settings: domain.settings,
  } as DomainConfigSnapshot;
}

/**
 * Boss weights are part of the snapshot, and that is the whole of D3.
 *
 * Because every past day is evaluated against the snapshot in force on it,
 * changing the weights today changes what today and every later day mean and
 * cannot reach a single day before. There is no append-only Boss log to keep
 * in step, and nothing stored that could drift from what is replayed.
 *
 * **A snapshot with no `boss` field at all was written by RC2.** The replay
 * reads that absence as "one undivided progression", which is exactly what
 * RC2 had — so upgrading cannot move a day of anyone's existing history. Every
 * snapshot this build writes carries weights, so the marker stays unambiguous.
 */
export function buildConfigSnapshot(
  domains: DomainRecord[],
  questions: QuestionRecord[],
  bossWeights?: BossWeights,
): AppConfigSnapshot {
  const enabled = activationOf(domains).enabled;
  return {
    boss: {
      weights: bossWeights
        ? weightsForSnapshot(bossWeights, enabled)
        : equalWeights(enabled),
    },
    domains: [...domains].sort((a, b) => a.id.localeCompare(b.id)).map(toDomainSnapshot),
    // Archived questions stay in the snapshot: a day in the past was scored
    // with them, and dropping them would silently rewrite that day.
    questions: [...questions].sort((a, b) => a.id.localeCompare(b.id)).map(toQuestionSnapshot),
    scoring: {
      editWindowDays: EDIT_WINDOW_DAYS,
      scaleMin: SCALE_MIN,
      scaleMax: SCALE_MAX,
      /*
       * Recorded, never inferred (D18).
       *
       * Every snapshot this build writes says which arithmetic it was written
       * under, so the replay can score a January day the way January was
       * scored without consulting anything current. A snapshot with no model
       * predates the change and is flat, which is what those days were.
       */
      model: SCORING_MODEL,
      /*
       * And the same, one level along, for Gym (D90).
       *
       * A snapshot with no `gymModel` was written before Gym performance
       * reached the rating, and the days it covers are replayed as attendance
       * against the weekly quota — which is what those days actually were.
       * Absence marks the era here exactly as it does for `model` above and
       * for `boss` before it, and it is never backfilled.
       */
      gymModel: GYM_SCORING_MODEL,
      /*
       * And once more for Running (D104), which reached the same model in
       * phase 5. A snapshot with no `runningModel` predates it and replays as
       * runs against the weekly quota, which is what those days were. The era
       * marker is the existing mechanism, not a new one: same absence rule,
       * same never-backfill rule, same place.
       */
      runningModel: RUNNING_SCORING_MODEL,
      /*
       * P8: the era marker for the one-day window (D132). Absent on every
       * snapshot before it, and that absence keeps those days and weeks on
       * the rules they were lived under.
       */
      sessionWindowDays: SESSION_WINDOW_DAYS,
    },
  };
}

/**
 * Two snapshots are equal when nothing that affects scoring differs. Ordering
 * is normalised in `buildConfigSnapshot`, so a structural comparison is exact
 * and cheap — and it keeps the snapshot log proportional to real change.
 */
export function configSnapshotsEqual(a: AppConfigSnapshot, b: AppConfigSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
