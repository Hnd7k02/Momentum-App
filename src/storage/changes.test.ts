import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setClock } from '../core/clock';
import { closeDatabase, deleteDatabase, runTransaction } from './db';
import { changeVersion, committedWrites, flushChanges, holdChanges, subscribeToChanges } from './changes';
import { importBackup } from './services/backupService';
import { loadBossProgression } from './services/bossService';
import { loadDay, loadTrainingWeek } from './services/checkInService';
import { existingSessionForDay, latestGymSession, loadGymHistory } from './services/gymService';
import { loadProgression } from './services/ratingService';
import { listTrainingPlans } from './services/trainingPlanService';
import { addDays, type DateKey } from '../core/dates';
import { LAST, at, currentProfile } from './services/fixtures/profiles';

/**
 * The store's change signal (WP3, B2).
 *
 * Screens that read the whole store reload when it moves, so two things must
 * hold: it moves after a committed write and only then, once per burst; and
 * the loads those screens run do not keep it moving. The second is what
 * keeps a reload from causing the next one.
 */

afterEach(async () => {
  setClock(null);
  flushChanges();
  await closeDatabase();
});

describe('the change signal', () => {
  it('moves once per burst of committed writes, and not for reads', async () => {
    await deleteDatabase();
    flushChanges();
    const heard: number[] = [];
    const stop = subscribeToChanges(() => heard.push(changeVersion()));
    const before = changeVersion();

    await runTransaction(['settings'], 'readonly', (tx) => tx.objectStore('settings').count());
    flushChanges();
    expect(heard).toHaveLength(0);

    for (const id of ['a', 'b', 'c']) {
      await runTransaction(['answers'], 'readwrite', (tx) =>
        tx.objectStore('answers').put({ id, date: '2026-10-14', questionId: 'q', value: 5 }),
      );
    }
    flushChanges();
    // One notification for the three writes; the version is the committed
    // count, so it has moved past every one of them.
    expect(heard).toHaveLength(1);
    expect(heard[0]).toBeGreaterThanOrEqual(before + 3);
    stop();
  });

  it('does not move for a write that was rolled back', async () => {
    await deleteDatabase();
    const writes = committedWrites();
    await expect(
      runTransaction(['answers'], 'readwrite', () => {
        throw new Error('refused');
      }),
    ).rejects.toThrow('refused');
    expect(committedWrites()).toBe(writes);
  });

  it('waits for the burst to settle before telling anyone', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      await deleteDatabase();
      const heard: number[] = [];
      const stop = subscribeToChanges(() => heard.push(changeVersion()));
      await runTransaction(['answers'], 'readwrite', (tx) =>
        tx.objectStore('answers').put({ id: 'x', date: '2026-10-14', questionId: 'q', value: 5 }),
      );
      expect(heard).toHaveLength(0);
      vi.advanceTimersByTime(100);
      expect(heard).toHaveLength(1);
      stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('is held while a workout is open and published once, at once, on release', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      await deleteDatabase();
      flushChanges();
      const heard: number[] = [];
      const stop = subscribeToChanges(() => heard.push(changeVersion()));
      const release = holdChanges();
      const nested = holdChanges();
      for (const id of ['s1', 's2', 's3']) {
        await runTransaction(['answers'], 'readwrite', (tx) =>
          tx.objectStore('answers').put({ id, date: '2026-10-14', questionId: 'q', value: 5 }),
        );
        vi.advanceTimersByTime(1000);
      }
      flushChanges();
      expect(heard).toHaveLength(0);
      nested();
      expect(heard).toHaveLength(0);
      release();
      // Synchronous: the screen the workout closes onto already reads it.
      expect(heard).toEqual([committedWrites()]);
      release();
      vi.advanceTimersByTime(1000);
      expect(heard).toHaveLength(1);
      stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('releases with nothing written without telling anyone', () => {
    flushChanges();
    const heard: number[] = [];
    const stop = subscribeToChanges(() => heard.push(changeVersion()));
    holdChanges()();
    expect(heard).toHaveLength(0);
    stop();
  });
});

describe('loadsDoNotWrite', () => {
  /*
   * Every loader a subscribed screen runs, at the four-domain profile's last
   * day. The first round may write — the settings record, the promotion
   * state the Boss reconciles, the seeded catalogue — the second must not,
   * or a reload would publish a change and start the next one.
   */
  async function everySubscribedLoad(date: DateKey) {
    await loadBossProgression(date);
    await loadProgression(date);
    await loadGymHistory(addDays(date, -29), date);
    await loadGymHistory(addDays(date, -6), date);
    await loadDay(date, date);
    await loadTrainingWeek('gym', date);
    await loadTrainingWeek('running', date);
    await latestGymSession();
    await existingSessionForDay(date);
    await listTrainingPlans();
  }

  it('settles after one round on a restored profile', async () => {
    await deleteDatabase();
    setClock({ now: () => at(LAST) });
    const result = await importBackup(currentProfile());
    if (!result.ok) throw new Error(result.details.join('; '));
    await everySubscribedLoad(LAST);
    const settled = committedWrites();
    await everySubscribedLoad(LAST);
    expect(committedWrites()).toBe(settled);
  });

  it('settles after one round when the day has turned', async () => {
    await deleteDatabase();
    setClock({ now: () => at(LAST) });
    const result = await importBackup(currentProfile());
    if (!result.ok) throw new Error(result.details.join('; '));
    await everySubscribedLoad(LAST);
    const next = addDays(LAST, 1);
    setClock({ now: () => at(next) });
    await everySubscribedLoad(next);
    const settled = committedWrites();
    await everySubscribedLoad(next);
    expect(committedWrites()).toBe(settled);
  });
});
