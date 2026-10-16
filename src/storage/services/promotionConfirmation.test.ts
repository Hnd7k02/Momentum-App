import 'fake-indexeddb/auto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { addDays, type DateKey } from '../../core/dates';
import { confirmationIndicator, confirmedRankHistory, canonicalConfirmation } from '../../core/ranks/confirmation';
import { canonicalJson } from '../../testing/canonical';
import { closeDatabase, deleteDatabase } from '../db';
import { daySettled, snapshotOn, weekTargetThrough, weekWindows } from '../../core/config/closure';
import { configSnapshotsRepository, questionsRepository, settingsRepository } from '../repositories';
import { exportBackup, importBackup } from './backupService';
import { loadBossProgression, type BossProgression } from './bossService';
import { saveAnswer } from './checkInService';
import { applyOnboarding, loadConfiguration } from './configurationService';
import { BREAK_LAST, at as atHour, trainingBreakProfile } from './fixtures/profiles';
import { ensurePromotionConfirmation, reconcilePromotionConfirmation } from './promotionConfirmationService';

/**
 * Promotion confirmation through the real services (D126): activation,
 * persistence, replay, edits inside the window, backups, and the
 * continuity of everything the legacy rule had already awarded.
 */

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

const settingsJson = async () => JSON.stringify((await settingsRepository.get())!.promotionConfirmation);

/** The persisted shape, straight from the settings record. */
const persisted = async () => (await settingsRepository.get())!.promotionConfirmation!;

/**
 * What the fold says about the loaded replay, recomputed from its inputs —
 * the day closure included, read from the snapshots as the service does
 * (D136): a P8 day counts once it is settled, and moves the demotion counter
 * once it is closed.
 */
async function recomputed(boss: BossProgression, today: DateKey) {
  const snapshots = await configSnapshotsRepository.list();
  const weekWindowOf = weekWindows(snapshots);
  const walk = confirmedRankHistory(
    boss.points.map((point, index) => {
      const date = boss.history.days[index]!.date;
      const dayConfig = snapshotOn(snapshots, date);
      const settled = daySettled(date, today, dayConfig, weekWindowOf(date), weekTargetThrough(snapshots, date));
      return {
        date,
        rating: point.rating,
        scored: boss.history.days[index]!.status === 'scored',
        paused: boss.history.paused[index] === true,
        ...(settled === null ? {} : { settled }),
      };
    }),
    { from: boss.confirmation!.from, today },
  );
  return canonicalConfirmation(boss.confirmation!.from, walk.pending);
}

beforeEach(async () => {
  await deleteDatabase();
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

/* ── A fresh install climbing under the confirmation rule ───────────────── */

const D0 = '2026-01-05'; // a Monday
const D = (index: number) => addDays(D0, index);

async function climbUntil(last: string, value: (day: string) => number): Promise<void> {
  const questions = await questionsRepository.list();
  for (let day = D0; day <= last; day = addDays(day, 1)) {
    freezeAt(day);
    for (const question of questions) await saveAnswer(day, question.id, value(day));
  }
}

/** 5 on the first day, 6 for five days, then 10 every day. */
const climb = (day: string) => (day === D0 ? 5 : day < D(6) ? 6 : 10);
/** 5 every day: the rating crosses Elite (410) on D17, slowly. */
const steady = () => 5;

const lastRating = (boss: BossProgression) => boss.points[boss.points.length - 1]!.rating;

describe('a fresh install under the confirmation rule', () => {
  beforeEach(async () => {
    freezeAt(D0);
    await applyOnboarding({
      questions: [
        { text: 'A', type: 'scale', category: 'mental' },
        { text: 'B', type: 'scale', category: 'gesundheit' },
      ],
    });
    await loadConfiguration();
  });

  it('A — carries the era from its first day and shows 0/7 at the first threshold, without promoting', async () => {
    // Created today under this version: the boundary is today itself.
    expect(await persisted()).toEqual({ from: D0, targetRankId: null, eligibleDates: [] });

    await climbUntil(D0, climb);
    let boss = await loadBossProgression();
    // Day one already sits above the first threshold (120). It opens at the
    // bottom, it is not promoted, and the indicator says why.
    expect(lastRating(boss)).toBeGreaterThanOrEqual(120);
    expect(boss.rank.id).toBe('rookie');
    expect(boss.changes).toEqual([]);
    expect(boss.pending).toEqual({ targetRankId: 'challenger', eligibleDates: [], required: 7 });
    expect(confirmationIndicator(lastRating(boss), boss.pending)).toEqual({ targetRankId: 'challenger', count: 0, required: 7 });
    expect(await persisted()).toEqual({ from: D0, targetRankId: 'challenger', eligibleDates: [] });

    // The next day, day one is yesterday: it can still be written, so it
    // does not count yet (P8, D136).
    await climbUntil(D(1), climb);
    boss = await loadBossProgression();
    expect(boss.pending?.eligibleDates).toEqual([]);

    // The day after, it can no longer be written, and it counts.
    await climbUntil(D(2), climb);
    boss = await loadBossProgression();
    expect(boss.pending?.eligibleDates).toEqual([D0]);
  });

  it('5, 6, 22, 23 — promotes one rank per confirmation, on the seventh settled day, and starts the next from nothing', async () => {
    // A day counts once it can no longer be written — two days on (D136) —
    // so each promotion lands one day later than under D126 alone, with
    // the same date.
    await climbUntil(D(7), climb);
    let boss = await loadBossProgression();
    expect(boss.rank.id).toBe('rookie');
    expect(boss.pending?.eligibleDates).toEqual([D(0), D(1), D(2), D(3), D(4), D(5)]);

    await climbUntil(D(8), climb);
    boss = await loadBossProgression();
    expect(boss.rank.id).toBe('challenger');
    expect(boss.changes).toEqual([
      { date: D(6), kind: 'promotion', from: 'rookie', to: 'challenger', rating: boss.points[6]!.rating },
    ]);
    // Already above Contender's threshold: 0/7 towards it, nothing carried over.
    expect(boss.pending).toEqual({ targetRankId: 'contender', eligibleDates: [], required: 7 });
    expect(confirmationIndicator(lastRating(boss), boss.pending)).toEqual({ targetRankId: 'contender', count: 0, required: 7 });

    await climbUntil(D(15), climb);
    boss = await loadBossProgression();
    expect(boss.rank.id).toBe('contender');
    expect(boss.changes.map((c) => [c.to, c.date])).toEqual([['challenger', D(6)], ['contender', D(13)]]);
    expect(boss.pending).toEqual({ targetRankId: 'elite', eligibleDates: [], required: 7 });
    expect(boss.peakRank.id).toBe('contender');

    await climbUntil(D(22), climb);
    boss = await loadBossProgression();
    expect(boss.rank.id).toBe('elite');
    expect(boss.changes.map((c) => [c.to, c.date])).toEqual([['challenger', D(6)], ['contender', D(13)], ['elite', D(20)]]);
    expect(await persisted()).toEqual({ from: D0, targetRankId: 'veteran', eligibleDates: [] });
  });

  it('9–12 — persists byte-identical state across replays, saves and reloads', async () => {
    await climbUntil(D(11), climb);
    // The set is reconciled by the replay, so it is current after a load.
    await loadBossProgression();
    const first = await settingsJson();
    // D10 is yesterday and does not count yet (D136).
    expect(JSON.parse(first).eligibleDates).toEqual([D(7), D(8), D(9)]);
    expect(Object.keys(JSON.parse(first))).toEqual(['from', 'targetRankId', 'eligibleDates']);

    await loadBossProgression();
    await loadBossProgression();
    expect(await settingsJson()).toBe(first);
    const { updatedAt } = (await settingsRepository.get())!;

    // The same answer saved again: same rows, same replay, no write.
    const questions = await questionsRepository.list();
    for (const question of questions) await saveAnswer(D(11), question.id, 10);
    const boss = await loadBossProgression();
    expect(await settingsJson()).toBe(first);
    expect((await settingsRepository.get())!.updatedAt).toBe(updatedAt);
    expect(await reconcilePromotionConfirmation(boss.confirmation!)).toBe('unchanged');

    // Closing and reopening the database changes nothing either.
    await closeDatabase();
    const again = await loadBossProgression();
    expect(canonicalJson(again.confirmation)).toBe(canonicalJson(boss.confirmation));
    expect(canonicalJson(again.changes)).toBe(canonicalJson(boss.changes));
  });

  it('14, 15 — an edit inside the window never touches a counted day; the sequence follows history', async () => {
    await climbUntil(D(20), steady); // Elite crossed on D17; today D20: [D17, D18], D19 pending
    let boss = await loadBossProgression();
    expect(boss.rank.id).toBe('contender');
    expect(boss.pending?.eligibleDates).toEqual([D(17), D(18)]);
    const questions = await questionsRepository.list();

    // A counted day can no longer be written: that is what makes it count
    // (P8, D136). Nothing an edit does can reach it.
    await expect(saveAnswer(D(17), questions[0]!.id, 1)).rejects.toThrow();

    // Yesterday can. Both answers to 1: D19 falls below Elite — it has not
    // been counted, so the set is unchanged while it can still be written.
    for (const question of questions) await saveAnswer(D(19), question.id, 1);
    boss = await loadBossProgression();
    expect(boss.points[19]!.rating).toBeLessThan(410);
    expect(boss.pending?.eligibleDates).toEqual([D(17), D(18)]);
    expect(await persisted()).toEqual(await recomputed(boss, D(20)));

    // And back, before it closes: the sequence is rebuilt, not patched.
    for (const question of questions) await saveAnswer(D(19), question.id, 5);
    boss = await loadBossProgression();
    expect(boss.pending?.eligibleDates).toEqual([D(17), D(18)]);
    expect(await persisted()).toEqual(await recomputed(boss, D(20)));

    // Down again, and left: once D19 closes below the threshold, it resets.
    for (const question of questions) await saveAnswer(D(19), question.id, 1);
    freezeAt(D(21));
    for (const question of questions) await saveAnswer(D(21), question.id, 5);
    boss = await loadBossProgression();
    expect(boss.pending?.eligibleDates).toEqual([]);
    expect(await persisted()).toEqual(await recomputed(boss, D(21)));
  });

  it('20 / D — a newer backup keeps its boundary and reconciles its dates from history', async () => {
    await climbUntil(D(11), climb);
    await loadBossProgression(); // the replay is what reconciles the set
    const exported = JSON.stringify(await exportBackup());
    expect(JSON.parse(exported).data.settings.promotionConfirmation).toEqual({
      from: D0, targetRankId: 'contender', eligibleDates: [D(7), D(8), D(9)],
    });

    await deleteDatabase();
    freezeAt('2026-02-10');
    const result = await importBackup(exported);
    expect(result.ok).toBe(true);
    await loadConfiguration(); // must not reset the era
    expect((await persisted()).from).toBe(D0);
    const boss = await loadBossProgression();
    expect(boss.confirmation?.from).toBe(D0);
    expect(await persisted()).toEqual(boss.confirmation);
    expect(await persisted()).toEqual(await recomputed(boss, '2026-02-10'));
    // The boundary the file carried is where the walk still splits, and the
    // legacy prefix is empty: nothing was seeded from the import date.
    expect(boss.changes[0]).toMatchObject({ to: 'challenger', date: D(6) });
  });
});

/* ── B: a legacy settings record without the field ──────────────────────── */

describe('a legacy record upgrading into the feature', () => {
  it('B — activates from tomorrow, and the activation day keeps the legacy opening', async () => {
    freezeAt(D0);
    // A record written before the feature existed: no field at all.
    await settingsRepository.replaceAll({
      id: 'settings', language: 'de', firstUseDate: D0, onboardingCompletedAt: null,
      acknowledgedRankId: null, createdAt: '2026-01-05T08:00:00.000Z', updatedAt: '2026-01-05T08:00:00.000Z',
    });
    expect((await settingsRepository.get())!.promotionConfirmation).toBeUndefined();
    await applyOnboarding({
      questions: [
        { text: 'A', type: 'scale', category: 'mental' },
        { text: 'B', type: 'scale', category: 'gesundheit' },
      ],
    });
    await loadConfiguration(); // the ensure step: an upgrade, so tomorrow
    expect(await persisted()).toEqual({ from: D(1), targetRankId: null, eligibleDates: [] });

    await climbUntil(D0, climb);
    const boss = await loadBossProgression();
    // Same history as the fresh install above, different path: the
    // activation day is legacy, so it opens where the rating is.
    expect(boss.rank.id).toBe('contender');
    expect(boss.changes).toEqual([]);
    expect(boss.pending).toEqual({ targetRankId: 'elite', eligibleDates: [], required: 7 });
    expect(confirmationIndicator(lastRating(boss), boss.pending)).toBeNull();
  });
});

/* ── Existing users: the activation day is legacy, and nothing moves ─────── */

const ACTIVATION_DAY = '2026-07-03'; // a legacy promotion day in the training-break profile
const FIXTURE = new URL('../../../.github/fixtures/stage4/activation.json', import.meta.url);

const four = (boss: BossProgression) => ({
  rank: boss.rank.id,
  peakRank: boss.peakRank.id,
  lifetimeXp: boss.lifetimeXp,
  changes: boss.changes,
});

describe('activation on an existing profile', () => {
  it('17, 18, 13 — keeps the rank, the peak, the XP and the legacy history, promotion of the day included', async () => {
    freezeAt(ACTIVATION_DAY);
    const result = await importBackup(trainingBreakProfile());
    if (!result.ok) throw new Error(result.details.join('; '));

    const before = await loadBossProgression();
    expect(before.confirmation).toBeNull();
    expect(before.pending).toBeNull();
    expect(before.changes[before.changes.length - 1]).toMatchObject({ date: ACTIVATION_DAY, kind: 'promotion', to: 'master' });

    await ensurePromotionConfirmation();
    const after = await loadBossProgression();
    expect(four(after)).toEqual(four(before));
    expect(after.confirmation).toEqual({ from: '2026-07-04', targetRankId: 'champion', eligibleDates: [] });
    expect(after.pending).toEqual({ targetRankId: 'champion', eligibleDates: [], required: 7 });
    // The Boss series itself did not move.
    expect(canonicalJson(after.points)).toBe(canonicalJson(before.points));

    const record = {
      activationDay: ACTIVATION_DAY,
      from: after.confirmation!.from,
      before: four(before),
      after: four(after),
    };
    if (process.env.UPDATE_STAGE2_BASELINE) {
      writeFileSync(fileURLToPath(FIXTURE), canonicalJson(record));
      return;
    }
    if (!existsSync(fileURLToPath(FIXTURE))) throw new Error('No activation fixture; capture it first');
    expect(canonicalJson(record)).toBe(readFileSync(fileURLToPath(FIXTURE), 'utf8'));
  });

  it('does not move the boundary on later loads', async () => {
    freezeAt(ACTIVATION_DAY);
    await importBackup(trainingBreakProfile());
    await ensurePromotionConfirmation();
    freezeAt(addDays(ACTIVATION_DAY, 20));
    await loadConfiguration();
    expect((await persisted()).from).toBe('2026-07-04');
  });

  it('19 — an old backup without the field gets a fresh prospective boundary', async () => {
    const rc2 = readFileSync(new URL('../../../.github/fixtures/rc2-export.json', import.meta.url), 'utf8');
    freezeAt('2026-09-07');
    const result = await importBackup(rc2);
    expect(result.ok).toBe(true);
    expect((await settingsRepository.get())!.promotionConfirmation).toBeUndefined();
    await loadConfiguration();
    expect(await persisted()).toEqual({ from: '2026-09-08', targetRankId: null, eligibleDates: [] });
    const boss = await loadBossProgression();
    expect(boss.confirmation?.from).toBe('2026-09-08');
    expect(boss.pending?.eligibleDates).toEqual([]);
  });

  it('leaves the frozen Stage 2 profile untouched when no era is active', async () => {
    setClock({ now: () => atHour(BREAK_LAST) });
    await importBackup(trainingBreakProfile());
    const boss = await loadBossProgression();
    expect(boss.confirmation).toBeNull();
    expect(boss.pending).toBeNull();
  });
});
