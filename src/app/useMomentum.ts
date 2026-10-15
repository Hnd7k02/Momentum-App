import { useCallback, useEffect, useState } from 'react';
import type { Language } from '../core/model';
import { StorageError, type StorageFailure } from '../storage/db';
import { settingsRepository } from '../storage/repositories';
import type { BossWeights } from '../core/boss';
import type { DomainType } from '../core/model';
import {
  addQuestion,
  applyOnboarding,
  archiveQuestion,
  disableDomain,
  disableDomainType,
  enableDomain,
  loadConfiguration,
  pauseQuestion,
  resumeQuestion,
  setFoodFocus,
  setBossWeights,
  setWeeklyTarget,
  updateQuestion,
  type AppConfiguration,
  type OnboardingSelection,
} from '../storage/services/configurationService';
import { applyLegacySportChoice } from '../storage/services/legacySportService';
import type { LegacySportChoice } from '../core/migration/legacySport';
import type { AreasActions } from '../features/areas/AreasScreen';
import type { WeightUnit } from '../core/gym/weight';

export type MomentumState =
  | { status: 'loading' }
  | { status: 'error'; error: Error; reason: StorageFailure }
  | { status: 'ready'; configuration: AppConfiguration };

/**
 * The application's single connection to storage.
 *
 * Screens receive plain data and callbacks; none of them knows a repository
 * exists. Every mutation goes through the configuration service — which is
 * what appends a configuration revision — and then reloads, so what is on
 * screen is always what is on disk.
 */
export function useMomentum() {
  const [state, setState] = useState<MomentumState>({ status: 'loading' });

  /*
   * A write that was refused, rather than a screen that failed to load.
   *
   * Every mutation used to be fired with no rejection handler at all: a
   * failed write left the interface showing something that was never stored,
   * and a failed `applyOnboarding` stranded a new user on the last
   * onboarding step forever, with no message and nothing to try again.
   */
  const [actionFailed, setActionFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const configuration = await loadConfiguration();
      setState({ status: 'ready', configuration });
    } catch (error: unknown) {
      setState({
        status: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
        // Why it failed decides what the user can do about it.
        reason: error instanceof StorageError ? error.reason : 'failed',
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    (operation: () => Promise<unknown>) => {
      setActionFailed(false);
      operation()
        .then(refresh)
        .catch(() => {
          // Say so, and put the screen back on what is actually stored — the
          // user must never be left looking at a change that did not happen.
          setActionFailed(true);
          void refresh();
        });
    },
    [refresh],
  );

  const setLanguage = useCallback(
    (language: Language) => {
      // Language is not scoring-relevant, so it writes no revision. The
      // screen updates immediately rather than waiting for the round trip.
      setState((previous) =>
        previous.status === 'ready'
          ? {
              status: 'ready',
              configuration: {
                ...previous.configuration,
                settings: { ...previous.configuration.settings, language },
              },
            }
          : previous,
      );
      void settingsRepository.setLanguage(language).catch(() => setActionFailed(true));
    },
    [],
  );

  const setWeightUnit = useCallback((weightUnit: WeightUnit) => {
    // A display preference (WP3, P4), like the language: no revision, and
    // the screen follows at once.
    setState((previous) =>
      previous.status === 'ready'
        ? {
            status: 'ready',
            configuration: {
              ...previous.configuration,
              settings: { ...previous.configuration.settings, weightUnit },
            },
          }
        : previous,
    );
    void settingsRepository.setWeightUnit(weightUnit).catch(() => setActionFailed(true));
  }, []);

  const finishOnboarding = useCallback(
    (selection: OnboardingSelection) => {
      run(() => applyOnboarding(selection));
    },
    [run],
  );

  const areasActions: AreasActions = {
    enableDomain: (type: DomainType) => run(() => enableDomain(type)),
    disableDomain: (type: DomainType) => run(() => disableDomainType(type)),
    setWeeklyTarget: (type: DomainType, target: number) => run(() => setWeeklyTarget(type, target)),
    /*
     * One-way, deliberately. RC2's generic Sport domain can be switched off
     * by a user who has finished with it, and there is nothing anywhere that
     * switches it back on: it is stored history, not an area of the product.
     */
    disableLegacySport: () =>
      run(async () => {
        const configuration = await loadConfiguration();
        if (configuration.legacySport) await disableDomain(configuration.legacySport.id);
      }),
    /*
     * The answer to "what were those RC2 sessions?", applied once.
     *
     * It goes through `run` like every other mutation, so a refused write
     * says so and puts the screen back on what is actually stored — which
     * matters more here than anywhere else, since the question is asked once
     * and a silent failure would lose the user's only chance to answer it.
     */
    chooseLegacySport: (choice: LegacySportChoice) =>
      run(() => applyLegacySportChoice(choice)),
    addQuestion: (draft) => run(() => addQuestion(draft)),
    updateQuestion: (id, draft) => run(() => updateQuestion(id, draft)),
    pauseQuestion: (id) => run(() => pauseQuestion(id)),
    resumeQuestion: (id) => run(() => resumeQuestion(id)),
    archiveQuestion: (id) => run(() => archiveQuestion(id)),
    setFoodFocus: (focus: string) => run(() => setFoodFocus(focus)),
    reload: () => void refresh(),
    setLanguage,
    setWeightUnit,
  };

  return {
    state,
    areasActions,
    // Boss weights are scoring-relevant configuration, so this goes through
    // the same path as everything else: write, append a snapshot, reload.
    setBossWeights: (weights: BossWeights) => run(() => setBossWeights(weights)),
    finishOnboarding,
    setLanguage,
    refresh,
    actionFailed,
    dismissActionFailure: () => setActionFailed(false),
  };
}
