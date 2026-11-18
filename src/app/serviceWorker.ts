/**
 * Registering the service worker, and making an update visible.
 *
 * The trap this avoids is the one §4 names: an installed PWA on static
 * hosting keeps serving an old build after a deploy and the user has no way
 * to tell. So a waiting worker is surfaced as a prompt, the reload happens
 * only when the user asks for it, and it happens exactly once.
 */

export interface UpdateHandle {
  /** Applies the waiting version and reloads. */
  apply(): void;
}

/** Guards against a reload loop if `controllerchange` fires more than once. */
let reloading = false;

/**
 * Whether a worker that has installed is an update of what runs this page:
 * it is one when the page is controlled by **another** worker.
 *
 * Asking only whether the page has a controller is not enough. On a very
 * first install the page has none while the worker installs — but the
 * worker claims its page as it activates, and a browser may tell a page of
 * that claim before the page has heard that the worker is installed.
 * WebKit does: it sets `controller` the moment the claim arrives and
 * delivers "installed", which arrived before it, as a task of its own. A
 * page that was busy in between then learns of a first install with a
 * controller already in place — this very worker — and the app offered
 * "Neue Version verfügbar" on a first visit, with a button that could do
 * nothing, because nothing was waiting.
 */
export function isUpdate(worker: ServiceWorker, controller: ServiceWorker | null): boolean {
  return controller !== null && controller !== worker;
}

/**
 * Says when a registration holds an update: at once if a version installed
 * on a previous visit is still waiting, and whenever a worker found later
 * has installed. `container` is asked for the controller at that moment,
 * never before — a page is claimed by its first worker while it runs.
 */
export function watchForUpdate(
  container: Pick<ServiceWorkerContainer, 'controller'>,
  registration: ServiceWorkerRegistration,
  onUpdate: () => void,
): void {
  // A version installed on a previous visit and never accepted.
  if (registration.waiting && isUpdate(registration.waiting, container.controller)) onUpdate();

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && isUpdate(installing, container.controller)) onUpdate();
    });
  });
}

export function registerServiceWorker(onUpdateReady: (handle: UpdateHandle) => void): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const applyFrom = (registration: ServiceWorkerRegistration) => () => {
    const waiting = registration.waiting;
    if (!waiting) return;
    // Reload only once, and only because the user asked.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    waiting.postMessage({ type: 'SKIP_WAITING' });
  };

  const start = () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((registration) => {
        watchForUpdate(navigator.serviceWorker, registration, () => {
          onUpdateReady({ apply: applyFrom(registration) });
        });

        // Check again when the app is brought back to the foreground, which
        // is when a long-installed PWA would otherwise never notice a deploy.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void registration.update();
        });
      })
      .catch(() => {
        // Offline, or the worker is unavailable. The app still runs from
        // whatever is already cached; nothing here is required for it.
      });
  };

  /*
   * This runs from a React effect, which is usually *after* the window load
   * event has already fired — so waiting for that event unconditionally
   * means never registering at all. Registration is deferred only when the
   * page is genuinely still loading, so it never competes with first paint.
   */
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
