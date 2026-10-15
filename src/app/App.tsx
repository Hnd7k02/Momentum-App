import { useEffect, useState } from 'react';
import { AreasScreen } from '../features/areas/AreasScreen';
import { ProgressScreen } from '../features/progress/ProgressScreen';
import { RankScreen } from '../features/ranking/RankScreen';
import { TodayScreen } from '../features/today/TodayScreen';
import { OnboardingFlow } from '../features/onboarding/OnboardingFlow';
import { I18nProvider, useT } from '../i18n/I18nProvider';
import { Button } from '../components';
import { ToastOutlet, ToastProvider } from '../components/Toast';
import type { BossWeights } from '../core/boss';
import type { StorageFailure } from '../storage/db';
import { registerServiceWorker, type UpdateHandle } from './serviceWorker';
import { TabBar } from './TabBar';
import { useRoute } from './route';
import { useMomentum } from './useMomentum';
import type { AppConfiguration } from '../storage/services/configurationService';
import type { AreasActions } from '../features/areas/AreasScreen';
import './appShell.css';

function MainApp({
  configuration,
  actions,
  onSetBossWeights,
  update,
  actionFailed,
  onDismissFailure,
}: {
  configuration: AppConfiguration;
  actions: AreasActions;
  onSetBossWeights(weights: BossWeights): void;
  update: UpdateHandle | null;
  actionFailed: boolean;
  onDismissFailure(): void;
}) {
  // Today is where the app opens: the daily check-in is the whole point.
  // The tab and the terminal's area are one route, mirrored to the URL.
  const { route, navigate, leave } = useRoute({ tab: 'today', terminal: 'mental' });
  const { tab } = route;

  return (
    <div className="app">
      {/* The outlet sits in the shell's flow above the banners and the tab
          bar, so the toast clears whichever of them is showing. */}
      <ToastProvider>
      <main className="app__content">
        {tab === 'today' ? (
          <TodayScreen
            onGoToAreas={(terminal) => navigate(terminal ? { tab: 'areas', terminal } : { tab: 'areas' })}
            onOpenGym={() => navigate({ tab: 'areas', terminal: 'gym' })}
            onGoToRank={() => navigate({ tab: 'rank' })}
          />
        ) : null}
        {tab === 'progress' ? <ProgressScreen onGoToToday={() => navigate({ tab: 'today' })} /> : null}
        {tab === 'rank' ? (
          <RankScreen configuration={configuration} onSetBossWeights={onSetBossWeights} />
        ) : null}
        {tab === 'areas' ? (
          <AreasScreen
            configuration={configuration}
            actions={actions}
            terminal={route.terminal}
            section={route.section}
            onSelectTerminal={(terminal) => navigate({ terminal })}
            /* Opening a section pushes, so Back returns to the hub; the
               section's own back control leaves the way it was entered —
               walking the pushed entry, or replacing a deep link — so the
               history never holds the hub twice. */
            onOpenSection={(section) => (section ? navigate({ section }) : leave({ section: undefined }))}
          />
        ) : null}
      </main>
      <ToastOutlet />
      {actionFailed ? <ActionFailureBanner onDismiss={onDismissFailure} /> : null}
      {update ? <UpdateBanner onApply={update.apply} /> : null}
      <TabBar active={tab} onSelect={(next) => navigate({ tab: next })} />
      </ToastProvider>
    </div>
  );
}

/**
 * Storage failed. Which failure it was decides what the user can do, so the
 * screen offers the action that actually helps rather than a dead end.
 */
function StorageProblem({ reason, onRetry }: { reason: StorageFailure; onRetry(): void }) {
  const t = useT();
  const body =
    reason === 'unavailable'
      ? t('error.storage.unavailable')
      : reason === 'newerData'
        ? t('error.storage.newer')
        : reason === 'blocked'
          ? t('error.storage.blocked')
          : t('error.storage.body');

  return (
    <div className="stage-placeholder">
      <p className="stage-placeholder__title">{t('error.storage.title')}</p>
      <p className="stage-placeholder__body">{body}</p>
      <div className="stage-placeholder__action">
        {reason === 'newerData' ? (
          <Button variant="primary" onClick={() => window.location.reload()}>
            {t('error.storage.reload')}
          </Button>
        ) : (
          <Button variant="secondary" onClick={onRetry}>
            {t('error.storage.retry')}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * A change that did not get stored.
 *
 * The screen has already been put back on what is actually saved, so this
 * only has to say that the change did not take. It is an `alert` because it
 * contradicts what the user just did.
 */
function ActionFailureBanner({ onDismiss }: { onDismiss(): void }) {
  const t = useT();
  return (
    <div className="update-banner" role="alert">
      <span>{t('error.action')}</span>
      <button type="button" className="update-banner__action" onClick={onDismiss}>
        {t('error.actionDismiss')}
      </button>
    </div>
  );
}

/** Unobtrusive, and it never reloads on its own. */
function UpdateBanner({ onApply }: { onApply(): void }) {
  const t = useT();
  return (
    <div className="update-banner" role="status">
      <span>{t('update.available')}</span>
      <button type="button" className="update-banner__action" onClick={onApply}>
        {t('update.action')}
      </button>
    </div>
  );
}

export function App() {
  const {
    state,
    areasActions,
    setBossWeights,
    finishOnboarding,
    setLanguage,
    refresh,
    actionFailed,
    dismissActionFailure,
  } = useMomentum();
  const [update, setUpdate] = useState<UpdateHandle | null>(null);

  useEffect(() => {
    registerServiceWorker(setUpdate);
  }, []);

  if (state.status === 'loading') {
    return <div className="app" aria-busy="true" />;
  }

  const language = state.status === 'ready' ? state.configuration.settings.language : 'de';

  return (
    <I18nProvider language={language} setLanguage={setLanguage}>
      {state.status === 'error' ? (
        <StorageProblem reason={state.reason} onRetry={() => void refresh()} />
      ) : state.configuration.settings.onboardingCompletedAt === null ? (
        <OnboardingFlow onFinish={finishOnboarding} failed={actionFailed} />
      ) : (
        <MainApp
          configuration={state.configuration}
          actions={areasActions}
          onSetBossWeights={setBossWeights}
          update={update}
          actionFailed={actionFailed}
          onDismissFailure={dismissActionFailure}
        />
      )}
    </I18nProvider>
  );
}
