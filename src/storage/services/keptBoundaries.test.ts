import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { equalWeights } from '../../core/boss';
import { setClock } from '../../core/clock';
import { GYM_METRIC } from '../../core/config/constants';
import { addDays } from '../../core/dates';
import type { AppConfigSnapshot } from '../../core/model';
import { closeDatabase, deleteDatabase } from '../db';
import { ensureFoodRetired, ensureGymMetricEra, ensureSessionWindowEra } from '../configService';
import { configSnapshotsRepository, domainsRepository } from '../repositories';
import { applyOnboarding, loadConfiguration } from './configurationService';
import { enableLegacyFood } from './fixtures/legacyFood';

/**
 * A snapshot dated between today and a kept era boundary keeps its era — in
 * each of the three load steps (block 9, step 4; "Risks and known debt" since
 * the closing review of Stage 5b).
 *
 * The case: the first load after the update wrote all three eras for a day
 * at an instant already past, then the local date moved back across it (a
 * journey west), and a snapshot was written for the day in between, under
 * the old rules. Each step left today alone, as D132, D139 and D177 say, and
 * then gave *every* later snapshot its marker — the one in between too,
 * although its day was lived under the earlier era. One line per step now
 * skips a later snapshot dated before the kept boundary.
 */

const SINCE = '2026-02-23';
const TODAY = '2026-03-04';
const BETWEEN = addDays(TODAY, 1);
const BOUNDARY = addDays(TODAY, 2);
const REMAINING = ['mental', 'gym', 'running'] as const;

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

beforeEach(async () => {
  await deleteDatabase();
});
afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

/** The live build's configuration: none of the three markers, the legacy window. */
function lived(config: AppConfigSnapshot): AppConfigSnapshot {
  const { sessionWindowDays: _window, gymMetric: _metric, ...scoring } = config.scoring;
  return { ...config, scoring: { ...scoring, editWindowDays: 3 } as AppConfigSnapshot['scoring'] };
}

const foodOn = (config: AppConfigSnapshot) => config.domains.some((domain) => domain.type === 'food' && domain.enabled);

async function device(): Promise<AppConfigSnapshot> {
  freezeAt(SINCE);
  await applyOnboarding({ questions: [{ text: 'A', type: 'scale', category: 'eigene' }], gymTargetPerWeek: 3, runningTargetPerWeek: 2 });
  await enableLegacyFood(SINCE);
  const snapshots = (await configSnapshotsRepository.list()).map((snapshot) => ({ ...snapshot, config: lived(snapshot.config) }));
  const base = snapshots[snapshots.length - 1]!;
  const between = lived(base.config);
  await configSnapshotsRepository.replaceAll([
    ...snapshots,
    // Written for the day in between, under the old rules.
    { ...base, id: 'cfg_between', effectiveFrom: BETWEEN, createdAt: `${TODAY}T05:00:00.000Z`, config: between },
    // The three eras, written for the boundary on the first load, at an instant already past.
    {
      ...base,
      id: 'cfg_boundary',
      effectiveFrom: BOUNDARY,
      createdAt: `${TODAY}T04:00:00.000Z`,
      config: {
        ...base.config,
        domains: base.config.domains.map((domain) => (domain.type === 'food' ? { ...domain, enabled: false } : domain)),
        boss: { weights: equalWeights(REMAINING) },
        scoring: { ...base.config.scoring, editWindowDays: 1, sessionWindowDays: 1, gymMetric: GYM_METRIC },
      },
    },
  ]);
  const food = (await domainsRepository.findByType('food'))!;
  await domainsRepository.setEnabled(food.id, false);
  freezeAt(TODAY);
  return between;
}

const onBetween = async () => (await configSnapshotsRepository.list()).filter((snapshot) => snapshot.effectiveFrom === BETWEEN);

describe('a snapshot dated between today and a kept boundary keeps its era', () => {
  it('in the one-day window (D132)', async () => {
    const between = await device();
    expect(await ensureSessionWindowEra(TODAY)).toBe('unchanged');
    const records = await onBetween();
    expect(records).toHaveLength(1);
    expect(records[0]!.config).toEqual(between);
    expect(records[0]!.config.scoring.sessionWindowDays).toBeUndefined();
  });

  it('in the end of Food (D139)', async () => {
    const between = await device();
    expect(await ensureFoodRetired(TODAY)).toBe('unchanged');
    const records = await onBetween();
    expect(records).toHaveLength(1);
    expect(records[0]!.config).toEqual(between);
    expect(foodOn(records[0]!.config)).toBe(true);
  });

  it('in the metric of Stage 5b and its curve (D150, D177)', async () => {
    const between = await device();
    expect(await ensureGymMetricEra(TODAY)).toBe('unchanged');
    const records = await onBetween();
    expect(records).toHaveLength(1);
    expect(records[0]!.config).toEqual(between);
    expect(records[0]!.config.scoring.gymMetric).toBeUndefined();
  });

  it('through a whole first load, and the boundary stays where it was written', async () => {
    const between = await device();
    const before = (await configSnapshotsRepository.list()).map((snapshot) => [snapshot.id, snapshot.effectiveFrom]);
    await loadConfiguration();
    expect((await configSnapshotsRepository.list()).map((snapshot) => [snapshot.id, snapshot.effectiveFrom])).toEqual(before);
    expect((await onBetween())[0]!.config).toEqual(between);
  });
});
