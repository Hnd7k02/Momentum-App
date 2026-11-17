import type { BossProgression } from '../bossService';

/**
 * What a day shows, read off the replay — for the update rehearsal (block 9,
 * step 4).
 *
 * **The same file reads both states.** `scripts/verify/update-live-outputs.mjs`
 * copies it, byte for byte, into the live state `e30becd` and reads that
 * state's replay through it; `updateRehearsal.test.ts` reads this build's
 * through the same lines. So "the past shows the same values" compares the
 * same fields, chosen once: the day's own row (its status, its two scores,
 * each domain's score), the Boss (its rating, ladder position and movement),
 * every domain's ledger, Gym's and Running's ratings and RC2's undivided
 * rating. Nothing here may import anything but types: the live state has
 * none of this build's code.
 */
export function updateOutputs(boss: BossProgression) {
  return boss.history.days.map((row, index) => ({
    date: row.date,
    status: row.status,
    score: row.score,
    recordedScore: row.recordedScore,
    domains: row.domains.map((entry) => [entry.domain, entry.score] as const),
    boss: [boss.points[index]?.rating ?? null, boss.points[index]?.progress ?? null, boss.points[index]?.movement ?? null] as const,
    ledgers: boss.domains.map((entry) => [entry.domain, entry.series[index] ?? null, entry.points[index]?.rating ?? null] as const),
    gym: boss.gym.points[index]?.rating ?? null,
    running: boss.running.points[index]?.rating ?? null,
    legacy: boss.legacy.points[index]?.rating ?? null,
  }));
}

export type UpdateOutputs = ReturnType<typeof updateOutputs>;
