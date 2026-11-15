import type { BossProgression } from '../bossService';

/**
 * Everything the replay holds for one day: the row, every domain, the Boss,
 * Gym in full, Running.
 *
 * The proofs that an era leaves earlier days alone compare this, day by
 * day, between two replays of the same history (`gymMetricEra.test.ts`,
 * `gymCurveEra.test.ts`). One definition, so "every output of a day" means
 * the same in each of them.
 */
export function dayOutputs(boss: BossProgression, index: number) {
  const row = boss.history.days[index]!;
  return {
    row,
    domains: boss.domains.map((entry) => [entry.domain, entry.series[index], entry.points[index]]),
    boss: boss.points[index],
    gymPoint: boss.gym.points[index],
    gymDetail: boss.gym.detail.find((point) => point.date === row.date) ?? null,
    gymUnlocked: boss.gym.promotionUnlocked[index],
    running: boss.running.points[index],
  };
}
