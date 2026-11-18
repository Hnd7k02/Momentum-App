import { describe, expect, it, vi } from 'vitest';
import { isUpdate, watchForUpdate } from './serviceWorker';

/**
 * When the app says "Neue Version verfügbar".
 *
 * The browser's parts are stand-ins that report what a browser reports, in
 * the order the test names: a worker with a state, a registration with its
 * three places, and the page's controller.
 */
class Worker extends EventTarget {
  state = 'installing';
  constructor(readonly label: string) {
    super();
  }
  reach(state: string): void {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

class Registration extends EventTarget {
  installing: Worker | null = null;
  waiting: Worker | null = null;
  active: Worker | null = null;
  find(worker: Worker): void {
    this.installing = worker;
    this.dispatchEvent(new Event('updatefound'));
  }
}

function page({ controller = null as Worker | null, waiting = null as Worker | null, active = null as Worker | null } = {}) {
  const container = { controller };
  const registration = new Registration();
  registration.waiting = waiting;
  registration.active = active;
  const offered = vi.fn();
  watchForUpdate(
    container as unknown as Pick<ServiceWorkerContainer, 'controller'>,
    registration as unknown as ServiceWorkerRegistration,
    offered,
  );
  return { container, registration, offered };
}

describe('an update is a worker other than the one that runs the page', () => {
  const first = new Worker('first') as unknown as ServiceWorker;
  const second = new Worker('second') as unknown as ServiceWorker;

  it('a page nobody controls has no update', () => {
    expect(isUpdate(first, null)).toBe(false);
  });
  it('a page controlled by the very worker that installed has none either', () => {
    expect(isUpdate(first, first)).toBe(false);
  });
  it('a page controlled by another worker has one', () => {
    expect(isUpdate(second, first)).toBe(true);
  });
});

describe('a first visit offers no update', () => {
  it('in the order the standard gives: installed, activated, and only then the claim', () => {
    const { container, registration, offered } = page();
    const worker = new Worker('first');
    registration.find(worker);
    worker.reach('installed');
    registration.installing = null;
    registration.active = worker;
    worker.reach('activating');
    container.controller = worker;
    worker.reach('activated');
    expect(offered).not.toHaveBeenCalled();
  });

  it('when the page hears of the claim before it hears that the worker is installed (WebKit, a busy page)', () => {
    const { container, registration, offered } = page();
    const worker = new Worker('first');
    registration.find(worker);
    // The claim is told at once; the states follow as tasks of their own.
    container.controller = worker;
    worker.reach('installed');
    worker.reach('activating');
    worker.reach('activated');
    expect(offered).not.toHaveBeenCalled();
  });

  it('when the registration already names the worker as waiting and the page as its own', () => {
    const worker = new Worker('first');
    const { offered } = page({ controller: worker, waiting: worker });
    expect(offered).not.toHaveBeenCalled();
  });
});

describe('an update is offered', () => {
  it('once, when a new worker has installed beside the one that runs the page', () => {
    const old = new Worker('old');
    old.state = 'activated';
    const { registration, offered } = page({ controller: old, active: old });
    const next = new Worker('next');
    registration.find(next);
    expect(offered).not.toHaveBeenCalled();
    next.reach('installed');
    expect(offered).toHaveBeenCalledTimes(1);
  });

  it('at once, when a version installed on a previous visit is still waiting', () => {
    const old = new Worker('old');
    const next = new Worker('next');
    next.state = 'installed';
    const { offered } = page({ controller: old, active: old, waiting: next });
    expect(offered).toHaveBeenCalledTimes(1);
  });

  it('to a page its first worker claimed while it ran, when a later one installs', () => {
    const { container, registration, offered } = page();
    const first = new Worker('first');
    registration.find(first);
    container.controller = first;
    first.reach('installed');
    first.reach('activated');
    registration.installing = null;
    registration.active = first;
    expect(offered).not.toHaveBeenCalled();

    const next = new Worker('next');
    registration.find(next);
    next.reach('installed');
    expect(offered).toHaveBeenCalledTimes(1);
  });

  it('not for a worker that failed to install', () => {
    const old = new Worker('old');
    const { registration, offered } = page({ controller: old, active: old });
    const next = new Worker('next');
    registration.find(next);
    next.reach('redundant');
    expect(offered).not.toHaveBeenCalled();
  });
});
