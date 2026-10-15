// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setClock } from '../core/clock';
import { closeDatabase, deleteDatabase } from '../storage/db';
import { settingsRepository } from '../storage/repositories';
import { applyOnboarding } from '../storage/services/configurationService';
import { mount, type Mounted } from '../test/dom';
import { useMomentum } from './useMomentum';

/**
 * A display preference the screen follows at once (WP3, P4) — and gives up
 * again when it could not be stored: nobody may be left looking at a unit,
 * or a language, that the next launch would not show.
 */

let mounted: Mounted | null = null;
let latest: ReturnType<typeof useMomentum> | null = null;

function Probe() {
  latest = useMomentum();
  return null;
}

beforeEach(async () => {
  await deleteDatabase();
  setClock({ now: () => new Date(2026, 9, 14, 9, 0, 0) });
  await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
  mounted = await mount(<Probe />);
  await until(() => latest?.state.status === 'ready');
});

afterEach(async () => {
  vi.restoreAllMocks();
  await mounted?.unmount();
  mounted = null;
  latest = null;
  setClock(null);
  await closeDatabase();
});

async function until(ok: () => boolean, rounds = 120): Promise<void> {
  for (let i = 0; i < rounds && !ok(); i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

const settings = () => (latest!.state.status === 'ready' ? latest!.state.configuration.settings : null);

describe('a display preference that could not be stored', () => {
  it('the weight unit goes back to what is stored', async () => {
    vi.spyOn(settingsRepository, 'setWeightUnit').mockRejectedValue(new Error('quota'));
    await act(async () => latest!.areasActions.setWeightUnit('lb'));
    await until(() => latest!.actionFailed && settings()?.weightUnit !== 'lb');
    expect(latest!.actionFailed).toBe(true);
    expect(settings()?.weightUnit).toBeUndefined();
  });

  it('the language goes back to what is stored', async () => {
    const before = settings()?.language;
    vi.spyOn(settingsRepository, 'setLanguage').mockRejectedValue(new Error('quota'));
    await act(async () => latest!.setLanguage(before === 'en' ? 'de' : 'en'));
    await until(() => latest!.actionFailed && settings()?.language === before);
    expect(settings()?.language).toBe(before);
  });

  it('a stored choice stays', async () => {
    await act(async () => latest!.areasActions.setWeightUnit('lb'));
    await until(() => false, 20);
    expect(settings()?.weightUnit).toBe('lb');
    expect((await settingsRepository.get())?.weightUnit).toBe('lb');
  });
});
