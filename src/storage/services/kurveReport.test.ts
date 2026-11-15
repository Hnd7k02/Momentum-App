import 'fake-indexeddb/auto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { addDays, type DateKey } from '../../core/dates';
import { gymMetricOf } from '../../core/gym/metric';
import { percentChange } from '../../core/gym/performance';
import { mapPerformanceChangeToScore } from '../../core/scoring/performanceCurve';
import { MUSCLE_GROUPS } from '../../core/model';
import { roundShown, shownPerformance } from '../../features/gym/muscleState';
import { closeDatabase, deleteDatabase } from '../db';
import { ensureFoodRetired, ensureGymMetricEra, ensureSessionWindowEra } from '../configService';
import { configSnapshotsRepository } from '../repositories';
import { importBackup } from './backupService';
import { loadBossProgression, type BossProgression } from './bossService';
import { loadGymHistory } from './gymService';
import { withoutGymCurveValue, withoutGymMetricEra } from './fixtures/legacyGymMetric';
import {
  PROGRESSION_START,
  PROGRESSION_WEEKS,
  PROGRESSION_WRITTEN_LAST,
  holdingProfile,
  progressionLast,
  progressionProfile,
  type HoldingOptions,
} from './fixtures/progressionProfile';
import {
  LIGHT_DAY,
  LIGHT_WEEK,
  METRIC_FROM,
  TRAINING_LAST,
  TRAINING_START,
  strengthProfile,
  trainingProfileUpdatedOn,
} from './fixtures/trainingProfile';

/**
 * The numbers of the block "Kurve": the candidates for the curve's one
 * value, old against new (step 1 of `docs/wp3/prompts/prompt-kurve.md`).
 *
 * Not a test of anything: a report, written from the real replay so that no
 * figure in `docs/design/wp3/kurve.md` or in the STOP report is worked out
 * by hand. It runs only when asked:
 *
 *   KURVE_REPORT=docs/design/wp3/kurve npx vitest run kurveReport
 *
 * One history is replayed once as **old** — the device had Stage 5b never
 * been: the best set by `reps × load`, a window's last day against its
 * first, the curve at ten points — and once per candidate as **new**: the
 * Stage 5b metric from the update day, and from that day the curve at the
 * candidate's value. The update loads on the same day in each, with the
 * one-day window and Food off as every update brings them.
 *
 * ## How a candidate reaches the replay
 *
 * As a day's own value does: it is written into the snapshots of the era
 * (`scoring.gymMetric.curveDecadePercent`), and the replay reads it from
 * there for those days and for no others (D177). The candidate "10" names
 * the constants' value; the report holds on every replay that it gives, to
 * the last bit, what the marker without a value gives — the era as Stage 5b
 * built it — and that no candidate moves a day before the update.
 *
 * The design came before the code (the owner's order), and at that point
 * the replay had one curve for every day. The first run of this report
 * therefore handed the candidate in from outside, wrapping
 * `performanceScore()` for a Gym day of the Stage 5b era and for nothing
 * else (commit `c175e69`). Once the value travelled in the snapshot the
 * wrapper went, and the four tables came out byte for byte the same.
 */

const OUT = process.env.KURVE_REPORT;

/** How many percentage points of change multiply the odds by four. Ten is the curve as it stands. */
const CANDIDATES = [10, 8, 6, 5, 4, 3.5, 3, 2.5, 2];

/* ── The candidate, written where a day's value is read ─────────────────── */

/** The curve of `performanceCurve.ts` at a candidate's value. */
const mapWith = (change: number, decade: number): number => mapPerformanceChangeToScore(change, decade);

/** Writes the candidate into every snapshot of the Stage 5b era: the value the replay reads for those days. */
async function setCandidate(decade: number): Promise<void> {
  const all = await configSnapshotsRepository.list();
  await configSnapshotsRepository.replaceAll(
    all.map((snapshot) =>
      gymMetricOf(snapshot.config) === null
        ? snapshot
        : {
            ...snapshot,
            config: {
              ...snapshot.config,
              scoring: { ...snapshot.config.scoring, gymMetric: { ...snapshot.config.scoring.gymMetric!, curveDecadePercent: decade } },
            },
          },
    ),
  );
}

/* ── Replaying ──────────────────────────────────────────────────────────── */

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

/** Imports `backup` at `clock` and loads the update on `update`: with the Stage 5b era (`new`) or as if it never was (`old`). */
async function prepare(backup: string, clock: DateKey, update: DateKey, variant: 'old' | 'new'): Promise<void> {
  await closeDatabase();
  await deleteDatabase();
  setClock({ now: () => at(clock) });
  const result = await importBackup(backup);
  if (!result.ok) throw new Error(result.details.join('; '));
  if (variant === 'old') await withoutGymMetricEra();
  if (clock < update) return;
  await ensureSessionWindowEra(update);
  await ensureFoodRetired(update);
  if (variant === 'old') return;
  await ensureGymMetricEra(update);
}

/** One day of one replay: what the Gym screen and the Boss stand at. */
interface Point {
  date: DateKey;
  rating: number;
  target: number | null;
  performance: number | null;
  boss: number;
}

function pointsOf(boss: BossProgression): Point[] {
  const detail = new Map(boss.gym.detail.map((point) => [point.date, point]));
  return boss.history.days.map((day, index) => ({
    date: day.date,
    rating: boss.gym.points[index]!.rating,
    target: detail.get(day.date)?.target ?? null,
    performance: detail.get(day.date)?.performance ?? null,
    boss: boss.points[index]!.rating,
  }));
}

type Key = 'old' | number;
type Replays = Map<Key, Point[]>;

/** The whole history as replayed on `clock`: old, and new under every candidate. */
async function replays(backup: string, clock: DateKey, update: DateKey): Promise<Replays> {
  const out: Replays = new Map();
  await prepare(backup, clock, update, 'old');
  out.set('old', pointsOf(await loadBossProgression(clock)));
  await prepare(backup, clock, update, 'new');
  // The era as Stage 5b built it: the marker without a value.
  await withoutGymCurveValue();
  const asItStood = pointsOf(await loadBossProgression(clock));
  for (const decade of CANDIDATES) {
    await setCandidate(decade);
    out.set(decade, pointsOf(await loadBossProgression(clock)));
  }
  // The candidate "10" is the curve as it was, and every candidate leaves the days before the update alone.
  expect(out.get(10)).toEqual(asItStood);
  const boundary = asItStood.findIndex((point) => point.date >= update);
  for (const decade of CANDIDATES) {
    expect(out.get(decade)!.slice(0, boundary), `candidate ${decade}: the days before ${update}`).toEqual(out.get('old')!.slice(0, boundary));
  }
  return out;
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

const fixed = (value: number, digits: number): string => Math.abs(value).toFixed(digits).replace('.', ',');
const signed = (value: number, digits = 1): string =>
  `${Number(value.toFixed(digits)) > 0 ? '+' : Number(value.toFixed(digits)) < 0 ? '−' : ''}${fixed(value, digits)}`;
const num = (value: number | null | undefined, digits = 0): string =>
  value === null || value === undefined ? '–' : `${value < 0 ? '−' : ''}${fixed(value, digits)}`;
const short = (date: string): string => `${date.slice(8, 10)}.${date.slice(5, 7)}.`;
const label = (key: Key): string => (key === 'old' ? 'alt' : `neu, ${String(key).replace('.', ',')}`);
const name = (decade: number): string => String(decade).replace('.', ',');

function table(head: string[], rows: string[][]): string {
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((row) => `| ${row.join(' | ')} |`)].join('\n');
}

/* ── 1. The curve itself ────────────────────────────────────────────────── */

const CHANGES = [0, 1, 2, 2.5, 3, 5, 7, 10, 20];

function curveTable(): string {
  const rows = CANDIDATES.map((decade) => [
    name(decade),
    ...CHANGES.map((change) => (change === 0 ? num(mapWith(0, decade)) : `${num(mapWith(change, decade))} / ${num(mapWith(-change, decade))}`)),
  ]);
  return table(['Wert', ...CHANGES.map((change) => (change === 0 ? '0 %' : `±${String(change).replace('.', ',')} %`))], rows);
}

/** The target at full attendance when both windows read `change`. */
const targetAt = (change: number, decade: number): number => 400 + 0.6 * mapWith(change, decade);

/* ── 2. The rating round the update, as the user sees it day by day ─────── */

const OFFSETS = [0, 1, 7, 14, 30];

/** One table: each row a candidate, each column a day as it was seen on that day. */
async function roundTheUpdate(backup: string, update: DateKey, lastWithData: DateKey): Promise<string> {
  const seen = new Map<number, Map<Key, Point>>();
  for (const offset of OFFSETS) {
    const clock = addDays(update, offset);
    const all = await replays(backup, clock, update);
    seen.set(offset, new Map([...all.entries()].map(([key, points]) => [key, points[points.length - 1]!])));
  }
  const keys: Key[] = ['old', ...CANDIDATES];
  const rows = keys.map((key) => {
    const day = (offset: number) => seen.get(offset)!.get(key)!;
    const old = (offset: number) => seen.get(offset)!.get('old')!;
    const rating = (offset: number) =>
      key === 'old' ? num(day(offset).rating, 1) : `${num(day(offset).rating, 1)} (${signed(day(offset).rating - old(offset).rating)})`;
    const boss = (offset: number) =>
      key === 'old' ? num(day(offset).boss, 1) : `${num(day(offset).boss, 1)} (${signed(day(offset).boss - old(offset).boss)})`;
    return [label(key), num(day(0).performance), num(day(0).target), ...OFFSETS.map(rating), boss(0), boss(7), boss(30)];
  });
  const head = [
    'Kurve', 'Leistungswert am Tag', 'Ziel am Tag',
    ...OFFSETS.map((offset) => `Gym-Rating ${offset === 0 ? 'am Tag' : `+${offset}`} (${short(addDays(update, offset))})`),
    'Boss am Tag', 'Boss +7', 'Boss +30',
  ];
  const beyond = OFFSETS.filter((offset) => addDays(update, offset) > lastWithData).map((offset) => `+${offset}`);
  return (
    table(head, rows) +
    (beyond.length > 0
      ? `\n\nDie Historie endet am ${short(lastWithData)}; die Spalten ${beyond.join(', ')} liegen danach. Ab dem siebten Tag ohne Training setzt die Pausen-Regel das Rating (bestehendes Verhalten, D96, D174).`
      : '')
  );
}

/* ── 3. The three readings of "not lower than before" ───────────────────── */

interface Reading {
  /** The lowest new − old on any day of the horizon, with where it stands. */
  lowest: number;
  lowestAt: { update: DateKey; day: number };
  /** Update days with at least one day lower by half a point or more. */
  updatesLower: number;
  /** The longest run of days lower by half a point or more. */
  longestLower: number;
  /** The worst mean of new − old over the first 30, 60 and 90 days. */
  mean: Record<30 | 60 | 90, number>;
}

function emptyReading(): Reading {
  return { lowest: Infinity, lowestAt: { update: '' as DateKey, day: 0 }, updatesLower: 0, longestLower: 0, mean: { 30: Infinity, 60: Infinity, 90: Infinity } };
}

/** Folds one update day's replays into the readings, over `horizon` days after it. */
function read(readings: Map<number, Reading>, all: Replays, update: DateKey, horizon: number): void {
  const old = all.get('old')!;
  const start = old.findIndex((point) => point.date === update);
  const end = Math.min(old.length - 1, start + horizon);
  for (const decade of CANDIDATES) {
    const fresh = all.get(decade)!;
    const reading = readings.get(decade)!;
    let run = 0;
    let anyLower = false;
    const sums: Record<30 | 60 | 90, { sum: number; days: number }> = { 30: { sum: 0, days: 0 }, 60: { sum: 0, days: 0 }, 90: { sum: 0, days: 0 } };
    for (let index = start; index <= end; index += 1) {
      const delta = fresh[index]!.rating - old[index]!.rating;
      if (delta < reading.lowest) {
        reading.lowest = delta;
        reading.lowestAt = { update, day: index - start };
      }
      if (delta <= -0.5) {
        run += 1;
        anyLower = true;
        reading.longestLower = Math.max(reading.longestLower, run);
      } else run = 0;
      for (const span of [30, 60, 90] as const) {
        if (index - start <= span) {
          sums[span].sum += delta;
          sums[span].days += 1;
        }
      }
    }
    if (anyLower) reading.updatesLower += 1;
    for (const span of [30, 60, 90] as const) {
      // Only a full span counts: a mean over fewer days is not that mean.
      if (sums[span].days === span + 1) reading.mean[span] = Math.min(reading.mean[span], sums[span].sum / sums[span].days);
    }
  }
}

interface Settled {
  gym: Map<Key, number>;
  boss: Map<Key, number>;
}

function readingTable(readings: Map<number, Reading>, updates: number, settled: Settled | null): string {
  const rows = CANDIDATES.map((decade) => {
    const reading = readings.get(decade)!;
    const mean = (span: 30 | 60 | 90) => (Number.isFinite(reading.mean[span]) ? signed(reading.mean[span]) : '–');
    return [
      name(decade),
      `${signed(reading.lowest)} (Update ${short(reading.lowestAt.update)}, Tag +${reading.lowestAt.day})`,
      `${reading.updatesLower} von ${updates}`,
      `${reading.longestLower}`,
      mean(30), mean(60), mean(90),
      ...(settled
        ? [
            `${num(settled.gym.get(decade)!, 1)} (${signed(settled.gym.get(decade)! - settled.gym.get('old')!)})`,
            `${num(settled.boss.get(decade)!, 1)} (${signed(settled.boss.get(decade)! - settled.boss.get('old')!)})`,
          ]
        : []),
    ];
  });
  return table(
    [
      'Wert',
      'An jedem Tag: tiefster Unterschied neu − alt',
      'Update-Tage mit einem Tag ≥ 0,5 tiefer',
      'längste Strecke tiefer (Tage)',
      'Im Mittel der ersten 30 Tage: schlechtester Update-Tag', '60 Tage', '90 Tage',
      ...(settled
        ? [
            `Eingependelt: Gym-Rating im Mittel der letzten 8 Wochen (alt ${num(settled.gym.get('old')!, 1)})`,
            `Boss, ebenso (alt ${num(settled.boss.get('old')!, 1)})`,
          ]
        : []),
    ],
    rows,
  );
}

const meanOfLast = (points: Point[], days: number, read: (point: Point) => number): number =>
  points.slice(-days).reduce((sum, point) => sum + read(point), 0) / days;

/* ── 4. The other side ──────────────────────────────────────────────────── */

/**
 * A device set up under this version — the metric and the candidate from its
 * first day — and, as `old`, the same device had Stage 5b never been.
 */
async function underCandidates(backup: string, clock: DateKey, first: DateKey): Promise<Map<Key, Point[]>> {
  const out = new Map<Key, Point[]>();
  await prepare(backup, clock, first, 'old');
  out.set('old', pointsOf(await loadBossProgression(clock)));
  await prepare(backup, clock, first, 'new');
  for (const decade of CANDIDATES) {
    await setCandidate(decade);
    out.set(decade, pointsOf(await loadBossProgression(clock)));
  }
  return out;
}

const range = (points: Point[], from: number, to: number): { mean: number; min: number; max: number } => {
  const values = points.slice(from, to + 1).map((point) => point.rating);
  return { mean: values.reduce((sum, value) => sum + value, 0) / values.length, min: Math.min(...values), max: Math.max(...values) };
};

async function holdingTable(): Promise<string> {
  const weeks = PROGRESSION_WEEKS;
  const end = progressionLast(weeks);
  const EVENT_WEEK = 20;
  const eventDay = EVENT_WEEK * 7;
  const cases: { title: string; options: HoldingOptions; cell(points: Point[]): string }[] = [
    {
      title: 'gleich bleiben: jede Woche dieselben Sätze',
      options: { wave: false },
      cell: (points) => `${num(points[points.length - 1]!.performance)} / ${num(points[points.length - 1]!.rating, 1)}`,
    },
    {
      title: 'gewöhnliches Auf und Ab: zwei Wochen eine Wiederholung mehr, zwei eine weniger (Wochen 13–40: Mittel, tiefster–höchster Stand)',
      options: {},
      cell: (points) => {
        const stats = range(points, 12 * 7, points.length - 1);
        return `${num(stats.mean, 1)} (${num(stats.min)}–${num(stats.max)})`;
      },
    },
    {
      title: `ein einzelner leichter Tag (Sonntag der Woche ${EVENT_WEEK + 1}, alle Arbeitssätze mit 80 %): Rating am Vortag → tiefster Stand der 14 Tage danach`,
      options: { wave: false, lightDayInWeek: EVENT_WEEK },
      cell: (points) => `${num(points[eventDay + 5]!.rating, 1)} → ${num(range(points, eventDay + 6, eventDay + 20).min, 1)}`,
    },
    {
      title: `eine ganze leichte Woche (Woche ${EVENT_WEEK + 1}): Rating am Sonntag davor → tiefster Stand der 21 Tage danach`,
      options: { wave: false, lightWeek: EVENT_WEEK },
      cell: (points) => `${num(points[eventDay - 1]!.rating, 1)} → ${num(range(points, eventDay, eventDay + 27).min, 1)}`,
    },
    {
      title: `ab Woche ${EVENT_WEEK + 1} überall eine Wiederholung weniger, für immer (je Übung −2,4 bis −2,9 %): Rating davor → tiefster Stand → 12 Wochen danach`,
      options: { wave: false, lessFrom: EVENT_WEEK },
      cell: (points) =>
        `${num(points[eventDay - 1]!.rating, 1)} → ${num(range(points, eventDay, points.length - 1).min, 1)} → ${num(points[eventDay + 12 * 7]!.rating, 1)}`,
    },
  ];
  const rows: string[][] = [];
  for (const entry of cases) {
    const all = await underCandidates(holdingProfile(weeks, entry.options), end, PROGRESSION_START);
    rows.push([entry.title, entry.cell(all.get('old')!), ...CANDIDATES.map((decade) => entry.cell(all.get(decade)!))]);
  }
  return table(['Fall', 'alt', ...CANDIDATES.map(name)], rows);
}

/** How a profile's rating falls under each candidate: the days it fell, and its largest fall within a week. */
function fallRow(points: Point[], from: number): string {
  let days = 0;
  let largest = 0;
  for (let index = Math.max(1, from); index < points.length; index += 1) {
    if (points[index]!.rating < points[index - 1]!.rating - 1e-9) days += 1;
    const weekAgo = points[Math.max(from, index - 7)]!.rating;
    largest = Math.min(largest, points[index]!.rating - weekAgo);
  }
  return `${days} / ${signed(largest)}`;
}

/* ── 5. The band beside the new metric ──────────────────────────────────── */

type Band = { title: string; held(percent: number): boolean };
/** The band as built (D153), and the two ways of moving its upper edge the owner's aim allows. */
const BANDS: Band[] = [
  { title: 'heute: −2 bis +2 gehalten', held: (percent) => percent >= -2 && percent <= 2 },
  { title: 'A: −1 bis +1 gehalten', held: (percent) => percent >= -1 && percent <= 1 },
  { title: 'B: −2 bis +1 gehalten', held: (percent) => percent >= -2 && percent <= 1 },
];
const stateUnder = (band: Band, change: number): string => {
  const percent = roundShown(change)!;
  return band.held(percent) ? 'Gehalten' : percent > 0 ? 'Verbessert' : 'Zurückgegangen';
};
const shownText = (change: number): string => `${signed(change, 2)} % → «${signed(roundShown(change)!, 0)} %»`;

function stepTables(): string {
  const out: string[] = [];
  const repRows: string[][] = [];
  for (let reps = 5; reps <= 15; reps += 1) {
    const up = (1 / (30 + reps)) * 100;
    const down = (-1 / (30 + reps)) * 100;
    repRows.push([
      `${reps} → ${reps + 1}`, shownText(up), ...BANDS.map((band) => stateUnder(band, up)),
      `${reps} → ${reps - 1}`, shownText(down), ...BANDS.map((band) => stateUnder(band, down)),
    ]);
  }
  out.push(
    '**Eine Wiederholung mehr, und eine weniger, bei gleichem Gewicht** (Stärke-Score: Last × (30 + Wiederholungen))',
    '',
    table(
      ['mehr', 'Veränderung', ...BANDS.map((band) => band.title), 'weniger', 'Veränderung', ...BANDS.map((band) => band.title)],
      repRows,
    ),
    '',
  );
  const loadRows: string[][] = [];
  for (let kg = 40; kg <= 140; kg += 10) {
    const up = (2.5 / kg) * 100;
    const down = (-2.5 / kg) * 100;
    loadRows.push([
      `${kg} → ${String(kg + 2.5).replace('.', ',')} kg`, shownText(up), ...BANDS.map((band) => stateUnder(band, up)),
      `${kg} → ${String(kg - 2.5).replace('.', ',')} kg`, shownText(down), ...BANDS.map((band) => stateUnder(band, down)),
    ]);
  }
  out.push(
    '**2,5 kg mehr, und 2,5 kg weniger, bei gleichen Wiederholungen**',
    '',
    table(
      ['mehr', 'Veränderung', ...BANDS.map((band) => band.title), 'weniger', 'Veränderung', ...BANDS.map((band) => band.title)],
      loadRows,
    ),
    '',
  );
  const resetRows: string[][] = [];
  for (const kg of [40, 60, 80, 100, 120]) {
    for (const top of [10, 12]) {
      const change = (((kg + 2.5) * 38) / (kg * (30 + top)) - 1) * 100;
      resetRows.push([`${top} × ${kg} kg → 8 × ${String(kg + 2.5).replace('.', ',')} kg`, shownText(change), ...BANDS.map((band) => stateUnder(band, change))]);
    }
  }
  out.push(
    '**Der Tag, an dem das Gewicht steigt und die Wiederholungen auf 8 zurückgehen**',
    '',
    table(['Schritt', 'Veränderung', ...BANDS.map((band) => band.title)], resetRows),
    '',
  );
  return out.join('\n');
}

interface BandCount {
  improved: number;
  held: number;
  declined: number;
  /** Changes that leave the band under a narrower one: shown +2, and shown −2. */
  plusTwo: number;
  minusTwo: number;
}

function countChanges(changes: (number | null)[], band: Band): BandCount {
  const count: BandCount = { improved: 0, held: 0, declined: 0, plusTwo: 0, minusTwo: 0 };
  for (const change of changes) {
    if (change === null) continue;
    const percent = roundShown(change)!;
    if (band.held(percent)) count.held += 1;
    else if (percent > 0) count.improved += 1;
    else count.declined += 1;
    if (percent === 2) count.plusTwo += 1;
    if (percent === -2) count.minusTwo += 1;
  }
  return count;
}

/** The groups' figures and the exercises' last steps of one history at 30 and 90 days, old against new. */
async function bandCounts(title: string, backup: string, clock: DateKey, update: DateKey): Promise<string[][]> {
  const rows: string[][] = [];
  for (const variant of ['old', 'new'] as const) {
    await prepare(backup, clock, update, variant);
    for (const days of [30, 90]) {
      const history = await loadGymHistory(addDays(clock, -(days - 1)), clock);
      const groups = shownPerformance(history.days, history.overall).muscles.map((entry) => entry.change);
      const exercises = [...history.comparisons.values()].map((entry) => percentChange(entry.ratio));
      const cell = (changes: (number | null)[]) =>
        BANDS.map((band) => {
          const count = countChanges(changes, band);
          return `${count.improved} / ${count.held} / ${count.declined}`;
        });
      const rated = groups.filter((change) => change !== null).length;
      const compared = exercises.filter((change) => change !== null).length;
      const today = countChanges(groups, BANDS[0]!);
      const todayExercises = countChanges(exercises, BANDS[0]!);
      rows.push([
        title, variant === 'old' ? 'alt' : 'neu', `${days} Tage`,
        `${rated}`, ...cell(groups), `${today.plusTwo} / ${today.minusTwo}`,
        `${compared}`, ...cell(exercises), `${todayExercises.plusTwo} / ${todayExercises.minusTwo}`,
      ]);
    }
  }
  return rows;
}

/* ── The report ─────────────────────────────────────────────────────────── */

describe.runIf(Boolean(OUT))('the number report of the block "Kurve"', () => {
  afterEach(async () => {
    setClock(null);
    await closeDatabase();
  });

  const write = (file: string, parts: string[]): void => {
    mkdirSync(OUT!, { recursive: true });
    writeFileSync(`${OUT}/${file}`, `${parts.join('\n')}\n`);
  };

  const importFile = readFileSync(new URL('../../../docs/wp3/stage5b/momentum-pruefdaten-5b.json', import.meta.url), 'utf8');

  it('writes the curve and the rating round the update', async () => {
    const parts: string[] = [
      '# Block «Kurve» — die Kandidaten, alt gegen neu',
      '',
      'Erzeugt von `src/storage/services/kurveReport.test.ts` aus dem echten Replay. «Wert» ist, wie viele Prozentpunkte Veränderung die Chancen vervierfachen; 10 ist die Kurve von heute. «alt» ist dieselbe Historie ohne den Marker von 5b: alte Kennzahl, alte Kurve.',
      '',
      '## Die Kurve je Kandidat',
      '',
      'Leistungswert bei einer Veränderung von +x % / −x % in einem Fenster.',
      '',
      curveTable(),
      '',
      '## Das Rating um den Tag des Updates, wie es an jedem Tag zu sehen ist',
      '',
      'Jede Spalte ist ein eigener Replay mit der Uhr an diesem Tag. In Klammern: neu minus alt.',
      '',
    ];

    for (const update of ['2026-11-02', '2026-11-15'] as DateKey[]) {
      parts.push(`### Prüfdaten (5 Wochen, 194 Sätze), Update am ${short(update)}`, '', await roundTheUpdate(importFile, update, PROGRESSION_WRITTEN_LAST), '');
    }
    const long = progressionProfile();
    for (const [week, note] of [[5, 'der Tag nach dem Ende der Prüfdatei'], [9, 'nach neun Wochen'], [13, 'im Januar, das Jahresfenster ist elf Tage alt'], [22, 'nach 22 Wochen']] as const) {
      const update = addDays(PROGRESSION_START, week * 7);
      parts.push(`### Langes Profil (die Prüfdaten, 40 Wochen), Update am ${short(update)} — ${note}`, '', await roundTheUpdate(long, update, progressionLast()), '');
    }
    parts.push(
      `### Profil «über die Grenze» (16 Wochen), Update am ${short(METRIC_FROM)} (Montag der Woche 11)`, '',
      await roundTheUpdate(beforeUpdate(trainingProfileUpdatedOn(77), METRIC_FROM), METRIC_FROM, TRAINING_LAST), '',
    );
    const early = addDays(TRAINING_START, 35);
    parts.push(
      `### Dasselbe Profil, Update am ${short(early)} (Montag der Woche 6)`, '',
      await roundTheUpdate(beforeUpdate(trainingProfileUpdatedOn(35), early), early, TRAINING_LAST), '',
    );
    write('zahlen-update.md', parts);
  }, 1_800_000);

  it('writes the three readings of "not lower than before"', async () => {
    const parts: string[] = [
      '# Block «Kurve» — «nicht tiefer als vorher», in drei Lesarten',
      '',
      'Erzeugt von `src/storage/services/kurveReport.test.ts`. Jede Historie wird mit der Uhr an ihrem letzten Tag gerechnet; verglichen wird Tag für Tag das Gym-Rating neu minus alt, für jeden Tag des Updates einzeln.',
      '',
    ];

    // The long profile: the update on every day from the sixth week to the 27th.
    const weeks = PROGRESSION_WEEKS;
    const long = progressionProfile(weeks);
    const end = progressionLast(weeks);
    const readings = new Map(CANDIDATES.map((decade) => [decade, emptyReading()]));
    let updates = 0;
    let settled: Settled | null = null;
    for (let day = 35; day <= 189; day += 1) {
      const update = addDays(PROGRESSION_START, day);
      const all = await replays(long, end, update);
      read(readings, all, update, 90);
      updates += 1;
      if (day === 35) {
        settled = {
          gym: new Map([...all.entries()].map(([key, points]) => [key, meanOfLast(points, 56, (point) => point.rating)])),
          boss: new Map([...all.entries()].map(([key, points]) => [key, meanOfLast(points, 56, (point) => point.boss)])),
        };
      }
    }
    parts.push(
      `## Langes Profil: die Prüfdaten, nach derselben Regel 40 Wochen lang`,
      '',
      `Das Update an jedem der ${updates} Tage vom ${short(addDays(PROGRESSION_START, 35))} (dem Tag nach der Prüfdatei) bis zum ${short(addDays(PROGRESSION_START, 189))}; je Update die 90 Tage danach.`,
      '',
      readingTable(readings, updates, settled),
      '',
    );

    // The same, with the update inside the first five weeks.
    const early = new Map(CANDIDATES.map((decade) => [decade, emptyReading()]));
    let earlyUpdates = 0;
    for (let day = 14; day < 35; day += 1) {
      const update = addDays(PROGRESSION_START, day);
      read(early, await replays(long, end, update), update, 90);
      earlyUpdates += 1;
    }
    parts.push(
      `## Dasselbe Profil, das Update in der dritten bis fünften Woche`,
      '',
      `Das Update an jedem der ${earlyUpdates} Tage vom ${short(addDays(PROGRESSION_START, 14))} bis zum ${short(addDays(PROGRESSION_START, 34))}: Beide Fenster sind dann zwei bis fünf Wochen alt.`,
      '',
      readingTable(early, earlyUpdates, null),
      '',
    );

    // The sixteen-week profile, the update on each Monday of weeks 6 to 12.
    const crossing = new Map(CANDIDATES.map((decade) => [decade, emptyReading()]));
    let crossingUpdates = 0;
    for (let week = 5; week <= 11; week += 1) {
      const update = addDays(TRAINING_START, week * 7);
      read(crossing, await replays(beforeUpdate(trainingProfileUpdatedOn(week * 7), update), TRAINING_LAST, update), update, 90);
      crossingUpdates += 1;
    }
    parts.push(
      `## Profil «über die Grenze» (16 Wochen, Viertagesplan mit Pyramide, Drop-Sets, leichter Woche)`,
      '',
      `Das Update an jedem der ${crossingUpdates} Montage der Wochen 6 bis 12; je Update die Tage bis zum Ende des Profils (höchstens 90).`,
      '',
      readingTable(crossing, crossingUpdates, null),
      '',
    );

    // The import file on its own days.
    const fileRows: string[][] = [];
    for (const update of ['2026-11-02', '2026-11-15'] as DateKey[]) {
      const all = await replays(importFile, PROGRESSION_WRITTEN_LAST, update);
      const old = all.get('old')!;
      const start = old.findIndex((point) => point.date === update);
      for (const decade of CANDIDATES) {
        const fresh = all.get(decade)!;
        const deltas = old.slice(start).map((point, index) => fresh[start + index]!.rating - point.rating);
        fileRows.push([
          short(update), name(decade),
          num(old[start]!.performance), num(fresh[start]!.performance),
          num(old[start]!.target), num(fresh[start]!.target),
          signed(deltas[0]!), signed(Math.min(...deltas)), signed(deltas.reduce((sum, value) => sum + value, 0) / deltas.length), signed(deltas[deltas.length - 1]!),
        ]);
      }
    }
    parts.push(
      '## Prüfdaten, bis zu ihrem letzten Tag (15.11.)',
      '',
      'Die Uhr steht am 15.11.; gezählt werden die Tage vom Update bis dorthin — 14 nach dem 02.11., einer am 15.11.',
      '',
      table(
        ['Update', 'Wert', 'Leistung alt', 'neu', 'Ziel alt', 'neu', 'Rating am Tag: neu − alt', 'tiefster Unterschied', 'im Mittel', 'am 15.11.'],
        fileRows,
      ),
      '',
    );

    // What a break after the file's last day costs (existing behaviour, D174).
    const breakRows: string[][] = [];
    for (const update of ['2026-11-02', '2026-11-15'] as DateKey[]) {
      const clock = addDays(PROGRESSION_WRITTEN_LAST, 21);
      const all = await replays(importFile, clock, update);
      const pick = (key: Key, date: DateKey) => all.get(key)!.find((point) => point.date === date)!.rating;
      for (const key of ['old', ...CANDIDATES] as Key[]) {
        breakRows.push([
          short(update), label(key),
          num(pick(key, PROGRESSION_WRITTEN_LAST), 1),
          num(pick(key, addDays(PROGRESSION_WRITTEN_LAST, 6)), 1),
          num(pick(key, addDays(PROGRESSION_WRITTEN_LAST, 7)), 1),
          num(pick(key, addDays(PROGRESSION_WRITTEN_LAST, 14)), 1),
        ]);
      }
    }
    parts.push(
      '## Eine Trainingspause nach der Prüfdatei (bestehendes Verhalten, nicht geändert)',
      '',
      'Kein Training nach dem 15.11., gerechnet am 06.12. Die versäumte Woche senkt das Rating zuerst über die Anwesenheit; ab dem siebten Tag setzt der Abbau das Rating auf den Fortschritt innerhalb der Stufe, die beim Beginn der Pause gehalten wurde (D96, D124). Hält das Rating dann eine tiefere Stufe, endet es eine ganze Stufe tiefer (D174).',
      '',
      table(['Update', 'Kurve', 'Rating am 15.11.', 'am 21.11.', 'am 22.11. (7. Tag)', 'am 29.11. (14. Tag)'], breakRows),
      '',
    );
    write('zahlen-lesarten.md', parts);
  }, 3_600_000);

  it('writes the other side', async () => {
    const parts: string[] = [
      '# Block «Kurve» — die andere Seite',
      '',
      'Erzeugt von `src/storage/services/kurveReport.test.ts`. Die Kurve ist symmetrisch: Was kleine Fortschritte stärker belohnt, bestraft kleine Rückgänge stärker.',
      '',
      '## Was derselbe Wert mit einem kleinen Rückgang tut, als reine Kurve',
      '',
      'Beide Fenster lesen dieselbe Veränderung, die Anwesenheit ist voll. «Ziel» ist, wohin das Rating dann geht; das Rating schliesst pro Tag 10 % der Lücke nach unten.',
      '',
      table(
        ['Wert', 'Ziel bei 0 %', 'bei −1 %', 'bei −2 % (am Bildschirm «Gehalten»)', 'bei −3 %', 'bei −5 %', 'Spanne des Ziels zwischen −2 % und +2 %', 'Rating 850 nach 7 / 14 / 30 Tagen bei −3 %'],
        CANDIDATES.map((decade) => {
          const after = (days: number) => targetAt(-3, decade) + (850 - targetAt(-3, decade)) * 0.9 ** days;
          return [
            name(decade), num(targetAt(0, decade)), num(targetAt(-1, decade)), num(targetAt(-2, decade)), num(targetAt(-3, decade)), num(targetAt(-5, decade)),
            num(targetAt(2, decade) - targetAt(-2, decade)),
            `${num(after(7))} / ${num(after(14))} / ${num(after(30))}`,
          ];
        }),
      ),
      '',
      '## Wer hält: die Person der Prüfdaten ohne Fortschritt, 40 Wochen',
      '',
      'Die Sätze der fünften Woche der Prüfdaten, jede Woche, neue Kennzahl und Kandidat ab dem ersten Tag; «alt» ist dasselbe Tagebuch unter der alten Kennzahl und Kurve. Zellen: Leistungswert / Gym-Rating am letzten Tag in der ersten Zeile, sonst Gym-Rating.',
      '',
      await holdingTable(),
      '',
    ];

    // The two sixteen-week profiles: how often and how far the rating falls.
    const strength = await underCandidates(strengthProfile(), TRAINING_LAST, TRAINING_START);
    const crossingUpdate = METRIC_FROM;
    const crossing = await replays(beforeUpdate(trainingProfileUpdatedOn(77), crossingUpdate), TRAINING_LAST, crossingUpdate);
    const lightSunday = LIGHT_WEEK * 7 + 6;
    const lightDay = strength.get(10)!.findIndex((point) => point.date === LIGHT_DAY);
    const day = (index: number) => ['old' as Key, ...CANDIDATES].map((key) => num(strength.get(key)![index]!.performance));
    parts.push(
      '## Die zwei 16-Wochen-Profile: wie oft und wie weit das Rating fällt',
      '',
      'Zellen: Tage, an denen das Gym-Rating gefallen ist / grösster Rückgang innerhalb von sieben Tagen. «ab Tag 1»: neue Kennzahl von Anfang an, gezählt ab Woche 5. «über die Grenze»: gezählt ab dem Update am Montag der Woche 11.',
      '',
      table(
        ['Profil', 'alt', ...CANDIDATES.map(name)],
        [
          ['ab Tag 1', fallRow(strength.get('old')!, 28), ...CANDIDATES.map((decade) => fallRow(strength.get(decade)!, 28))],
          ['über die Grenze', fallRow(crossing.get('old')!, 77), ...CANDIDATES.map((decade) => fallRow(crossing.get(decade)!, 77))],
        ],
      ),
      '',
      'Der Leistungswert des Profils «ab Tag 1» an den Tagen, die der Median dämpft:',
      '',
      table(
        ['Tag', 'alt', ...CANDIDATES.map(name)],
        [
          [`Sonntag vor der leichten Woche (${short(addDays(TRAINING_START, lightSunday - 7))})`, ...day(lightSunday - 7)],
          [`Sonntag der leichten Woche (${short(addDays(TRAINING_START, lightSunday))})`, ...day(lightSunday)],
          [`Vortag des leichten Tags (${short(addDays(LIGHT_DAY, -1))})`, ...day(lightDay - 1)],
          [`der leichte Tag (${short(LIGHT_DAY)})`, ...day(lightDay)],
        ],
      ),
      '',
    );
    write('zahlen-andere-seite.md', parts);
  }, 1_800_000);

  it('writes the band beside the new metric', async () => {
    const parts: string[] = [
      '# Block «Kurve» — das Band neben der neuen Kennzahl',
      '',
      'Erzeugt von `src/storage/services/kurveReport.test.ts`. «Gehalten» folgt der gezeigten ganzen Zahl (D153): heute −2 bis +2 %. Daneben zwei Varianten, die eine Wiederholung mehr bis 12 Wiederholungen immer als Fortschritt zeigen.',
      '',
      '## Was ein einzelner Schritt liest',
      '',
      stepTables(),
      '## Wie viele Gruppen und Übungen im Band liegen',
      '',
      'Gruppen: die Zahl der Zeile in Muskelgruppen (Median der letzten gegen die ersten Übungstage; alt: letzter gegen ersten Tag). Übungen: der letzte Tag gegen den davor, wie in der Übungsliste. Zellen: verbessert / gehalten / zurückgegangen.',
      '',
    ];
    const rows: string[][] = [];
    rows.push(...(await bandCounts('Prüfdaten, 15.11.', importFile, PROGRESSION_WRITTEN_LAST, PROGRESSION_WRITTEN_LAST)));
    const crossingClock = addDays(METRIC_FROM, 30);
    rows.push(...(await bandCounts(`über die Grenze, ${short(crossingClock)}`, beforeUpdate(trainingProfileUpdatedOn(77), METRIC_FROM), crossingClock, METRIC_FROM)));
    rows.push(...(await bandCounts(`ab Tag 1, ${short(LIGHT_DAY)}`, strengthProfile(), LIGHT_DAY, TRAINING_START)));
    rows.push(...(await bandCounts(`ab Tag 1, ${short(TRAINING_LAST)}`, strengthProfile(), TRAINING_LAST, TRAINING_START)));
    const longClock = addDays(PROGRESSION_START, 20 * 7 - 1);
    rows.push(...(await bandCounts(`langes Profil, ${short(longClock)}`, progressionProfile(), longClock, addDays(PROGRESSION_START, 35))));
    parts.push(
      table(
        [
          'Historie', 'Kennzahl', 'Zeitraum',
          'Gruppen mit Zahl', ...BANDS.map((band) => `Gruppen — ${band.title}`), 'Gruppen bei +2 / −2',
          'Übungen mit Vergleich', ...BANDS.map((band) => `Übungen — ${band.title}`), 'Übungen bei +2 / −2',
        ],
        rows,
      ),
      '',
    );
    write('zahlen-band.md', parts);

    // The groups' changes of three histories, for the pictures of the tint's
    // strength (`scripts/verify/kurve-tint-shots.mjs`): nothing typed by hand.
    const groupsOf = async (id: string, title: string, backup: string, clock: DateKey, update: DateKey, days: number) => {
      await prepare(backup, clock, update, 'new');
      const history = await loadGymHistory(addDays(clock, -(days - 1)), clock);
      const shown = shownPerformance(history.days, history.overall).muscles;
      expect(shown.filter((entry) => entry.change !== null)).toHaveLength(MUSCLE_GROUPS.length);
      return { id, title, groups: Object.fromEntries(shown.map((entry) => [entry.muscle, Math.round(entry.change! * 100) / 100])) };
    };
    writeFileSync(
      `${OUT}/gruppen.json`,
      `${JSON.stringify(
        [
          await groupsOf('pruefdaten-30', 'Prüfdaten, 30 Tage (15.11.)', importFile, PROGRESSION_WRITTEN_LAST, PROGRESSION_WRITTEN_LAST, 30),
          await groupsOf('pruefdaten-90', 'Prüfdaten, 90 Tage (15.11.)', importFile, PROGRESSION_WRITTEN_LAST, PROGRESSION_WRITTEN_LAST, 90),
          await groupsOf('profil-16-wochen-30', `Profil «über die Grenze», 30 Tage (${short(crossingClock)})`, beforeUpdate(trainingProfileUpdatedOn(77), METRIC_FROM), crossingClock, METRIC_FROM, 30),
        ],
        null,
        1,
      )}\n`,
    );
  }, 1_800_000);
});

/**
 * `KURVE_PROFILES=<dir>` writes the block's profiles as backup files, so that
 * a browser can import them for the pictures of the body
 * (`scripts/verify/kurve-shots.mjs`): the five weeks of the import file with
 * nothing changing, in which every group is held.
 */
describe.runIf(Boolean(process.env.KURVE_PROFILES))('the profiles of the block "Kurve" as files', () => {
  it('writes the backups a browser can import', () => {
    const dir = process.env.KURVE_PROFILES!;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/halten-5-wochen.json`, holdingProfile(5, { wave: false }));
  });
});
