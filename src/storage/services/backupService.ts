import { nowIso, today } from '../../core/clock';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  backupFileName,
  parseBackup,
  type BackupData,
  type BackupFile,
  type BackupSummary,
  type ValidationResult,
} from '../../core/backup/format';
import { SCHEMA_VERSION } from '../../core/model';
import { APP_VERSION } from '../../core/config/app';
import { STORES, replaceAllStores, type StoreName } from '../db';
import { createRepository } from '../repositories/base';
import type {
  AnswerRecord,
  ConfigSnapshotRecord,
  DomainRecord,
  ExerciseRecord,
  FoodDayRecord,
  FoodEntryRecord,
  GymPlanStoreRecord,
  GymSessionRecord,
  GymSetRecord,
  PausePeriodRecord,
  ProfileRecord,
  QuestionRecord,
  RankEventRecord,
  RestDayRecord,
  RunRecord,
  SettingsRecord,
  SportsSessionRecord,
  TombstoneUnlockRecord,
  WeightEntryRecord,
} from '../../core/model';

/**
 * Backup and restore (§19).
 *
 * Export writes canonical source data only; everything the app shows about
 * ranks, ratings, streaks and trends is replayed from it. Import validates
 * the whole file first and then replaces the profile in a single
 * transaction, so a rejected or failing restore leaves the existing profile
 * exactly as it was.
 */

const settingsStore = createRepository<SettingsRecord>(STORES.settings);
const domainStore = createRepository<DomainRecord>(STORES.domains);
const questionStore = createRepository<QuestionRecord>(STORES.questions);
const answerStore = createRepository<AnswerRecord>(STORES.answers);
const sessionStore = createRepository<SportsSessionRecord>(STORES.sportsSessions);
const snapshotStore = createRepository<ConfigSnapshotRecord>(STORES.configSnapshots);
const rankEventStore = createRepository<RankEventRecord>(STORES.rankEvents);
const profileStore = createRepository<ProfileRecord>(STORES.profile);
const exerciseStore = createRepository<ExerciseRecord>(STORES.exercises);
const gymPlanStore = createRepository<GymPlanStoreRecord>(STORES.gymPlans);
const gymSessionStore = createRepository<GymSessionRecord>(STORES.gymSessions);
const gymSetStore = createRepository<GymSetRecord>(STORES.gymSets);
const runStore = createRepository<RunRecord>(STORES.runs);
const foodStore = createRepository<FoodEntryRecord>(STORES.foodEntries);
const foodDayStore = createRepository<FoodDayRecord>(STORES.foodDays);
const weightStore = createRepository<WeightEntryRecord>(STORES.weightEntries);
const restDayStore = createRepository<RestDayRecord>(STORES.restDays);
const pauseStore = createRepository<PausePeriodRecord>(STORES.pausePeriods);
const tombstoneStore = createRepository<TombstoneUnlockRecord>(STORES.tombstones);

export async function collectBackupData(): Promise<BackupData> {
  const [
    settings,
    domains,
    questions,
    answers,
    sportsSessions,
    configSnapshots,
    rankEvents,
    profile,
    exercises,
    gymPlans,
    gymSessions,
    gymSets,
    runs,
    foodEntries,
    foodDays,
    weightEntries,
    restDays,
    pausePeriods,
    tombstones,
  ] = await Promise.all([
    settingsStore.getAll(),
    domainStore.getAll(),
    questionStore.getAll(),
    answerStore.getAll(),
    sessionStore.getAll(),
    snapshotStore.getAll(),
    rankEventStore.getAll(),
    profileStore.getAll(),
    exerciseStore.getAll(),
    gymPlanStore.getAll(),
    gymSessionStore.getAll(),
    gymSetStore.getAll(),
    runStore.getAll(),
    foodStore.getAll(),
    foodDayStore.getAll(),
    weightStore.getAll(),
    restDayStore.getAll(),
    pauseStore.getAll(),
    tombstoneStore.getAll(),
  ]);

  // Sorted so two exports of the same profile are byte-identical, which makes
  // "export, import, export again" comparable rather than merely equivalent.
  const byId = <T extends { id: string }>(records: T[]) =>
    [...records].sort((a, b) => a.id.localeCompare(b.id));

  return {
    settings: settings[0] ?? null,
    domains: byId(domains),
    questions: byId(questions),
    answers: byId(answers),
    sportsSessions: byId(sportsSessions),
    configSnapshots: byId(configSnapshots),
    rankEvents: byId(rankEvents),
    profile: profile[0] ?? null,
    exercises: byId(exercises),
    gymPlans: byId(gymPlans),
    gymSessions: byId(gymSessions),
    gymSets: byId(gymSets),
    runs: byId(runs),
    foodEntries: byId(foodEntries),
    foodDays: byId(foodDays),
    weightEntries: byId(weightEntries),
    restDays: byId(restDays),
    pausePeriods: byId(pausePeriods),
    tombstones: byId(tombstones),
  };
}

export async function exportBackup(): Promise<BackupFile> {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    app: { name: 'Momentum', version: APP_VERSION },
    data: await collectBackupData(),
  };
}

export interface ExportedFile {
  fileName: string;
  contents: string;
  summary: { questions: number; answers: number; sessions: number };
}

export async function exportBackupFile(): Promise<ExportedFile> {
  const backup = await exportBackup();
  return {
    fileName: backupFileName(today()),
    contents: `${JSON.stringify(backup, null, 2)}\n`,
    summary: {
      questions: backup.data.questions.length,
      answers: backup.data.answers.length,
      sessions:
        backup.data.sportsSessions.length +
        backup.data.gymSessions.length +
        backup.data.runs.length,
    },
  };
}

/** Checks a file without touching storage, so the user can be asked first. */
export function inspectBackup(text: string): ValidationResult {
  return parseBackup(text);
}

/**
 * Replaces the whole profile with the backup's contents.
 *
 * Replacement, not merge: version 1 needs no conflict resolution, and
 * merging two histories would produce a profile that never existed, with
 * ratings that match neither. The caller confirms with the user first.
 */
export async function importBackup(
  text: string,
): Promise<{ ok: true; summary: BackupSummary } | { ok: false; details: string[] }> {
  const result = inspectBackup(text);
  if (!result.ok) return { ok: false, details: result.details };

  const { data } = result.backup;
  const contents: Partial<Record<StoreName, unknown[]>> = {
    // A device that takes a backup has had the starter plans' one turn
    // (D205): its plans are the backup's, and a file written before the
    // seed existed must not bring Push A and Push B in after it.
    [STORES.settings]: data.settings
      ? [{ ...data.settings, id: 'settings', starterPlansSeededAt: data.settings.starterPlansSeededAt ?? nowIso() }]
      : [],
    [STORES.domains]: data.domains,
    [STORES.questions]: data.questions,
    [STORES.answers]: data.answers,
    [STORES.sportsSessions]: data.sportsSessions,
    [STORES.configSnapshots]: data.configSnapshots,
    [STORES.rankEvents]: data.rankEvents,
    [STORES.profile]: data.profile ? [{ ...data.profile, id: 'profile' }] : [],
    [STORES.exercises]: data.exercises,
    [STORES.gymPlans]: data.gymPlans,
    [STORES.gymSessions]: data.gymSessions,
    [STORES.gymSets]: data.gymSets,
    [STORES.runs]: data.runs,
    [STORES.foodEntries]: data.foodEntries,
    [STORES.foodDays]: data.foodDays,
    [STORES.weightEntries]: data.weightEntries,
    [STORES.restDays]: data.restDays,
    [STORES.pausePeriods]: data.pausePeriods,
    [STORES.tombstones]: data.tombstones,
  };

  // One transaction: either the profile is fully replaced or nothing changed.
  await replaceAllStores(contents);
  return { ok: true, summary: result.summary };
}
