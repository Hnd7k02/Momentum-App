import 'fake-indexeddb/auto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { GYM_METRIC } from '../../core/config/constants';
import { addDays, diffInDays, type DateKey } from '../../core/dates';
import { gymMetricOf } from '../../core/gym/metric';
import { compareExerciseDays, percentChange, type ExerciseDay } from '../../core/gym/performance';
import { EXERCISE_CATALOGUE } from '../../core/gym/catalogue';
import { MUSCLE_GROUPS, type MuscleGroup } from '../../core/model';
import { shownPerformance } from '../../features/gym/muscleState';
import { closeDatabase, deleteDatabase } from '../db';
import { ensureFoodRetired, ensureGymMetricEra, ensureSessionWindowEra } from '../configService';
import { configSnapshotsRepository, gymSetsRepository } from '../repositories';
import { importBackup } from './backupService';
import { loadBossProgression, type BossProgression } from './bossService';
import { loadGymHistory, type GymHistory } from './gymService';
import { withoutGymCurveValue, withoutGymMetricEra } from './fixtures/legacyGymMetric';
import {
  LIGHT_DAY,
  METRIC_FROM,
  TRAINING_LAST,
  TRAINING_START,
  metricCrossingProfile,
  strengthProfile,
  trainingProfileUpdatedOn,
} from './fixtures/trainingProfile';

/**
 * The numbers of WP3 Stage 5b, old against new (step 8 of the prompt).
 *
 * Not a test of anything: a report, written from the real replay so that no
 * figure in the STOP report or in `docs/design/wp3/stage5b-kennzahl.md` is
 * worked out by hand. It runs only when asked:
 *
 *   STAGE5B_REPORT=<file.md> npx vitest run stage5bReport
 *   STAGE5B_REPORT=<file.md> STAGE5B_BACKUP=<backup.json> STAGE5B_UPDATE=<yyyy-mm-dd> npx vitest run stage5bReport
 *
 * One history is replayed three ways, the update loading on the same day in
 * each — the one-day window and Food off as every update brings them:
 *
 * - **old** — no Stage 5b marker: the best set by `reps × load`, a window's
 *   last day against its first, on every day;
 * - **new** — the marker from the update day, with the medians;
 * - **new, last against first** — the marker with the switch the other way.
 *
 * **"New" is the era as Stage 5b built it: the marker without the curve's
 * value**, and so the curve as it was (ten). The block "Kurve" gave the
 * marker that value afterwards (D177); this report takes it off again, so
 * that it writes the tables Stage 5b committed, byte for byte — the record
 * of that stage, and the proof that a marker without the value replays as
 * the Stage 5b preview did. What the curve's value does to these histories
 * is `kurveReport.test.ts`.
 *
 * For a backup handed in, only what the prompt allows leaves the file:
 * figures for exercises and muscle groups, the Gym rating and the Boss. No
 * answer, no question text and no note is read.
 *
 * `STAGE5B_PROFILE=<file.json>` writes the strength profile as a backup
 * file, so that a browser can import it for the pictures of the exercise
 * detail (`scripts/verify/stage5b-chart-shots.mjs`).
 */

const OUT = process.env.STAGE5B_REPORT;

type Variant = 'old' | 'new' | 'firstLast';
const VARIANTS: Variant[] = ['old', 'new', 'firstLast'];

function at(day: string, hour = 21): Date {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, date, hour, 0, 0);
}

/** A backup as the live build holds it before the update: no snapshot from the update on. */
function beforeUpdate(profile: string, update: DateKey): string {
  const backup = JSON.parse(profile) as {
    data: { configSnapshots: { effectiveFrom: string }[]; domains: { type: string; enabled: boolean }[] };
  };
  const kept = backup.data.configSnapshots.filter((snapshot) => snapshot.effectiveFrom < update);
  if (kept.length > 0 && kept.length < backup.data.configSnapshots.length) {
    backup.data.configSnapshots = kept;
    const food = (kept[kept.length - 1] as { config?: { domains?: { type: string; enabled: boolean }[] } }).config?.domains?.find((domain) => domain.type === 'food');
    for (const domain of backup.data.domains) if (domain.type === 'food' && food) domain.enabled = food.enabled;
  }
  return JSON.stringify(backup);
}

/** Imports `backup` at `clock` and loads the update on `update`, with or without the new metric. */
async function replay(backup: string, clock: DateKey, update: DateKey, variant: Variant): Promise<void> {
  await closeDatabase();
  await deleteDatabase();
  setClock({ now: () => at(clock) });
  const result = await importBackup(backup);
  if (!result.ok) throw new Error(result.details.join('; '));
  // "Old" is the same device had the stage never been: no snapshot with the marker.
  if (variant === 'old') await withoutGymMetricEra();
  if (clock < update) return;
  await ensureSessionWindowEra(update);
  await ensureFoodRetired(update);
  if (variant === 'old') return;
  await ensureGymMetricEra(update);
  if (variant === 'firstLast') {
    const all = await configSnapshotsRepository.list();
    await configSnapshotsRepository.replaceAll(
      all.map((snapshot) =>
        gymMetricOf(snapshot.config) === null
          ? snapshot
          : { ...snapshot, config: { ...snapshot.config, scoring: { ...snapshot.config.scoring, gymMetric: { ...GYM_METRIC, comparison: 'firstLast' as const } } } },
      ),
    );
  }
  // The era as Stage 5b built it: the metric, and the curve as it was.
  await withoutGymCurveValue();
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

const NAMES = new Map(EXERCISE_CATALOGUE.map((entry) => [entry.id, entry.names.de]));
const MUSCLE_NAMES: Record<MuscleGroup, string> = {
  chest: 'Brust', back: 'Rücken', shoulders: 'Schultern', biceps: 'Bizeps', triceps: 'Trizeps',
  core: 'Rumpf', quadriceps: 'Quadrizeps', hamstringsGlutes: 'Beinbeuger und Gesäss', calves: 'Waden', forearms: 'Unterarme',
};
const STATE_NAMES: Record<string, string> = {
  noData: 'nicht trainiert', awaitingBaseline: 'zu wenig Daten', improved: 'verbessert', unchanged: 'gehalten', declined: 'zurückgegangen',
};

/** A figure as the report prints it: a decimal comma, a real minus sign. */
const fixed = (value: number, digits: number): string => Math.abs(value).toFixed(digits).replace('.', ',');
const signed = (value: number, digits = 1): string =>
  `${Number(value.toFixed(digits)) > 0 ? '+' : Number(value.toFixed(digits)) < 0 ? '−' : ''}${fixed(value, digits)}`;
const pct = (value: number | null | undefined, digits = 1): string =>
  value === null || value === undefined ? '–' : `${signed(value, digits)} %`;
const num = (value: number | null | undefined, digits = 1): string =>
  value === null || value === undefined ? '–' : `${value < 0 ? '−' : ''}${fixed(value, digits)}`;
const kg = (grams: number): string => `${(grams / 1000).toLocaleString('de-CH', { maximumFractionDigits: 2 })}`;
const setText = (day: ExerciseDay | undefined): string => (day ? `${day.best.set.reps} × ${kg(day.best.set.weightGrams)}` : '–');
const short = (date: string): string => `${date.slice(8, 10)}.${date.slice(5, 7)}.`;

function table(head: string[], rows: string[][]): string {
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((row) => `| ${row.join(' | ')} |`)].join('\n');
}

/* ── The four tables ────────────────────────────────────────────────────── */

interface Loaded {
  boss: BossProgression;
  history: Record<number, GymHistory>;
  all: GymHistory;
}

async function load(backup: string, clock: DateKey, update: DateKey, variant: Variant, from: DateKey): Promise<Loaded> {
  await replay(backup, clock, update, variant);
  const history: Record<number, GymHistory> = {};
  for (const range of [30, 90]) history[range] = await loadGymHistory(addDays(clock, -(range - 1)), clock);
  return { boss: await loadBossProgression(clock), history, all: await loadGymHistory(from, clock) };
}

/** 1. Per exercise: the series, each day against the day before, old against new. */
function exerciseSeries(old: GymHistory, fresh: GymHistory, limit: number): string {
  const ids = [...new Set([...old.days, ...fresh.days].map((day) => day.exerciseId))].sort((a, b) =>
    (NAMES.get(a) ?? a).localeCompare(NAMES.get(b) ?? b, 'de'),
  );
  const parts: string[] = [];
  for (const id of ids) {
    const oldDays = old.days.filter((day) => day.exerciseId === id);
    const newDays = fresh.days.filter((day) => day.exerciseId === id);
    const oldChange = new Map(compareExerciseDays(oldDays).map((entry) => [entry.date, percentChange(entry.ratio)]));
    const newChange = new Map(compareExerciseDays(newDays).map((entry) => [entry.date, percentChange(entry.ratio)]));
    const dates = [...new Set([...oldDays, ...newDays].map((day) => day.date))].sort().slice(-limit);
    const rows = dates.map((date) => [
      short(date),
      setText(oldDays.find((day) => day.date === date)),
      pct(oldChange.get(date)),
      setText(newDays.find((day) => day.date === date)),
      pct(newChange.get(date)),
    ]);
    const span = (days: ExerciseDay[]): string =>
      days.length < 2 ? '–' : pct((days[days.length - 1]!.best.score / days[0]!.best.score - 1) * 100);
    parts.push(
      `**${NAMES.get(id) ?? 'Eigene Übung'}** — erster gegen letzten Tag: alt ${span(oldDays)}, neu ${span(newDays)}\n\n` +
        table(['Tag', 'alt: bester Satz', 'alt: zum Vortag', 'neu: bester Arbeitssatz', 'neu: zum Vortag'], rows),
    );
  }
  return parts.join('\n\n');
}

/** 2 and 4. Per muscle group at 30 and 90 days: change and state, old, new and new by last against first. */
function muscleTable(loaded: Record<Variant, Loaded>, range: number): string {
  const shown = Object.fromEntries(
    VARIANTS.map((variant) => {
      const history = loaded[variant].history[range]!;
      return [variant, shownPerformance(history.days, history.overall)];
    }),
  ) as Record<Variant, ReturnType<typeof shownPerformance>>;
  const cell = (variant: Variant, muscle: MuscleGroup): string => {
    const entry = shown[variant].muscles.find((item) => item.muscle === muscle)!;
    return entry.change === null ? STATE_NAMES[entry.state]! : `${pct(entry.change)}, ${STATE_NAMES[entry.state]}`;
  };
  const rows = MUSCLE_GROUPS.map((muscle) => [MUSCLE_NAMES[muscle], cell('old', muscle), cell('new', muscle), cell('firstLast', muscle)]);
  rows.push([
    '**Leistungstrend**',
    `${pct(shown.old.change)} (${shown.old.rated.length} gewertet)`,
    `${pct(shown.new.change)} (${shown.new.rated.length} gewertet)`,
    `${pct(shown.firstLast.change)} (${shown.firstLast.rated.length} gewertet)`,
  ]);
  return table(['Gruppe', 'alt', 'neu (Median)', 'neu (letzter gegen ersten)'], rows);
}

/** 3 and 4. The rating round the update day. */
function ratingRow(loaded: Record<Variant, Loaded>, date: DateKey, label: string): string[] {
  const of = (variant: Variant) => {
    const { boss } = loaded[variant];
    const index = boss.history.days.findIndex((day) => day.date === date);
    const detail = boss.gym.detail.find((point) => point.date === date);
    return {
      performance: detail?.performance ?? null,
      target: detail?.target ?? null,
      rating: boss.gym.points[index]?.rating ?? null,
      boss: boss.points[index]?.rating ?? null,
    };
  };
  const [old, fresh, firstLast] = [of('old'), of('new'), of('firstLast')];
  const diff = (a: number | null, b: number | null): string => (a === null || b === null ? '–' : signed(b - a));
  return [
    label,
    num(old.performance, 0), num(fresh.performance, 0), num(firstLast.performance, 0),
    num(old.target, 0), num(fresh.target, 0),
    num(old.rating), num(fresh.rating), diff(old.rating, fresh.rating), num(firstLast.rating),
    num(old.boss), num(fresh.boss), diff(old.boss, fresh.boss),
  ];
}

const RATING_HEAD = [
  'Tag', 'Leistung alt', 'Leistung neu', 'Leistung neu (l/e)', 'Ziel alt', 'Ziel neu',
  'Gym-Rating alt', 'Gym-Rating neu', 'Unterschied', 'Gym-Rating neu (l/e)', 'Boss alt', 'Boss neu', 'Unterschied',
];

const OFFSETS: [number, string][] = [[0, 'Tag der Grenze'], [1, '+1 Tag'], [7, '+7 Tage'], [14, '+14 Tage'], [30, '+30 Tage']];

interface Subject {
  title: string;
  /** The backup as it stands before the update. */
  backup: string;
  update: DateKey;
  /** The last day the file holds; clocks beyond it show a history that simply ends. */
  last: DateKey;
  /** The first day of the history, for the per-exercise series. */
  first: DateKey;
  /** The day the muscle tables are read on. */
  muscleClock: DateKey;
  seriesDays: number;
}

async function report(subject: Subject): Promise<string> {
  const out: string[] = [`## ${subject.title}`, ''];
  const sets = (JSON.parse(subject.backup) as { data: { gymSets: { date: string; exerciseId: string }[] } }).data.gymSets;
  out.push(
    `Sätze: ${sets.length}, Übungen: ${new Set(sets.map((set) => set.exerciseId)).size}, Trainingstage: ${new Set(sets.map((set) => set.date)).size}, ` +
      `von ${short(sets.reduce((min, set) => (set.date < min ? set.date : min), sets[0]?.date ?? subject.first))} bis ${short(sets.reduce((max, set) => (set.date > max ? set.date : max), sets[0]?.date ?? subject.last))}. ` +
      `Update geladen am ${subject.update}.`,
    '',
  );

  // The muscle tables and the series, read on one day.
  const onDay = {} as Record<Variant, Loaded>;
  for (const variant of VARIANTS) onDay[variant] = await load(subject.backup, subject.muscleClock, subject.update, variant, subject.first);
  out.push(`### Je Übung: die Reihe (Stand ${subject.muscleClock}, letzte ${subject.seriesDays} Übungstage)`, '');
  out.push(exerciseSeries(onDay.old.all, onDay.new.all, subject.seriesDays), '');
  for (const range of [30, 90]) {
    out.push(`### Je Muskelgruppe, ${range} Tage (Stand ${subject.muscleClock})`, '', muscleTable(onDay, range), '');
  }

  // The rating round the update.
  const rows: string[][] = [];
  for (const [offset, label] of OFFSETS) {
    const date = addDays(subject.update, offset);
    if (date > subject.last) {
      rows.push([`${label} (${short(date)})`, ...Array.from({ length: RATING_HEAD.length - 1 }, () => 'nach dem Ende der Daten')]);
      continue;
    }
    const loaded = {} as Record<Variant, Loaded>;
    for (const variant of VARIANTS) loaded[variant] = await load(subject.backup, date, subject.update, variant, subject.first);
    rows.push(ratingRow(loaded, date, `${label} (${short(date)})`));
  }
  out.push('### Das Rating um den Tag der Grenze', '', table(RATING_HEAD, rows), '');
  return out.join('\n');
}

/**
 * How much the day of the update matters: the same sixteen weeks, the update
 * loaded on the Monday of each week from 5 to 11, old against new, as
 * replayed thirty days after it.
 */
async function updateDaySpread(): Promise<string> {
  const rows: string[][] = [];
  for (let week = 5; week <= 11; week += 1) {
    const day = week * 7;
    const update = addDays(TRAINING_START, day);
    const clock = addDays(update, 30);
    const backup = beforeUpdate(trainingProfileUpdatedOn(day), update);
    const loaded = {} as Record<'old' | 'new', BossProgression>;
    for (const variant of ['old', 'new'] as const) {
      await replay(backup, clock, update, variant);
      loaded[variant] = await loadBossProgression(clock);
    }
    const at = (variant: 'old' | 'new', offset: number) => {
      const date = addDays(update, offset);
      const index = loaded[variant].history.days.findIndex((entry) => entry.date === date);
      const detail = loaded[variant].gym.detail.find((point) => point.date === date);
      return { rating: loaded[variant].gym.points[index]!.rating, target: detail?.target ?? null, boss: loaded[variant].points[index]!.rating };
    };
    let widest = 0;
    let widestBoss = 0;
    for (let offset = 0; offset <= 30; offset += 1) {
      const delta = at('new', offset).rating - at('old', offset).rating;
      if (Math.abs(delta) > Math.abs(widest)) widest = delta;
      const bossDelta = at('new', offset).boss - at('old', offset).boss;
      if (Math.abs(bossDelta) > Math.abs(widestBoss)) widestBoss = bossDelta;
    }
    const target = (at('new', 0).target ?? 0) - (at('old', 0).target ?? 0);
    rows.push([
      `Woche ${week} (${short(update)})`,
      signed(target),
      ...[0, 1, 7, 14, 30].map((offset) => signed(at('new', offset).rating - at('old', offset).rating)),
      signed(widest),
      signed(widestBoss),
    ]);
  }
  return [
    '### Wie gross ist der Schritt, je nach Tag des Updates?',
    '',
    'Dieselben 16 Wochen, das Update jeweils am Montag der genannten Woche geladen. Unterschied neu minus alt, gerechnet 30 Tage danach.',
    '',
    table(
      ['Update am Montag der', 'Ziel am Tag', 'Gym-Rating am Tag', '+1 Tag', '+7 Tage', '+14 Tage', '+30 Tage', 'grösster Unterschied in 30 Tagen', 'Boss: grösster Unterschied'],
      rows,
    ),
    '',
  ].join('\n');
}

describe.runIf(Boolean(OUT))('the Stage 5b number report', () => {
  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  it('writes the tables', async () => {
    const parts: string[] = ['# Stage 5b — die Zahlen, alt gegen neu', ''];
    const external = process.env.STAGE5B_BACKUP;
    if (external) {
      const backup = readFileSync(external, 'utf8');
      const data = (JSON.parse(backup) as { data: { gymSets: { date: string }[]; settings: { firstUseDate?: string } } }).data;
      const dates = data.gymSets.map((set) => set.date).sort();
      const update = (process.env.STAGE5B_UPDATE ?? addDays(dates[dates.length - 1]! as DateKey, 1)) as DateKey;
      const horizon = addDays(update, 30);
      parts.push(
        await report({
          title: process.env.STAGE5B_TITLE ?? 'Probelauf mit einem Backup',
          backup: beforeUpdate(backup, update),
          update,
          last: horizon,
          first: (data.settings.firstUseDate ?? dates[0]!) as DateKey,
          muscleClock: update,
          seriesDays: 12,
        }),
      );
      expect(diffInDays(dates[0]! as DateKey, update)).toBeGreaterThan(0);
      const stored = await gymSetsRepository.getAll();
      expect(stored.length).toBe(data.gymSets.length);
    } else {
      parts.push(
        await report({
          title: 'Profil «über die Grenze» (16 Wochen, Update am Montag der Woche 11)',
          backup: beforeUpdate(metricCrossingProfile(), METRIC_FROM),
          update: METRIC_FROM,
          last: TRAINING_LAST,
          first: TRAINING_START,
          muscleClock: addDays(METRIC_FROM, 30),
          seriesDays: 16,
        }),
      );
      parts.push(await updateDaySpread());
      parts.push(
        await report({
          title: 'Profil «neue Kennzahl ab Tag 1» (dieselben 16 Wochen, Aufwärmsätze von Anfang an markiert), am leichten Tag',
          backup: strengthProfile(),
          update: TRAINING_START,
          last: TRAINING_LAST,
          first: TRAINING_START,
          muscleClock: LIGHT_DAY,
          seriesDays: 16,
        }),
      );
    }
    mkdirSync(dirname(OUT!), { recursive: true });
    writeFileSync(OUT!, `${parts.join('\n')}\n`);
  }, 600_000);
});

describe.runIf(Boolean(process.env.STAGE5B_PROFILE))('the strength profile as a file', () => {
  it('writes the backup a browser can import', () => {
    const file = process.env.STAGE5B_PROFILE!;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, strengthProfile());
  });
});
