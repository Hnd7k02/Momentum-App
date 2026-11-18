// @vitest-environment happy-dom
import { act, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { arriveAt, takeHubIntent } from '../../app/hubIntent';
import { mount, settle, type Mounted } from '../../test/dom';

/**
 * «Pläne verwalten» leads to the plans (the tidy-up of WP3, D163).
 *
 * The plans stand on the Gym hub. Heute and Muskelgruppen send the user
 * there for them, and the hub used to open at its top: the move did not
 * say what it was made for. It does now (`app/hubIntent.ts`), once, and
 * the hub brings its plans into view and puts the focus on their heading —
 * when they and the rating board above them have loaded, not before, and
 * never when the hub is opened for itself.
 */

let ratingLoading = false;
let plansLoaded = true;
const signal: { ready: (() => void) | null } = { ready: null };

vi.mock('../gym/useGymRating', () => ({ useGymRatingState: () => ({ view: null, loading: ratingLoading }) }));
vi.mock('../gym/useGymHistory', () => ({
  useGymHistoryState: () => ({ history: null, latestSession: null, failed: false }),
}));
vi.mock('../gym/TrainingCard', () => ({ TrainingCard: () => <section>Training</section> }));
vi.mock('../gym/MuscleEntryCard', () => ({ MuscleEntryCard: () => <section>Muskelgruppen</section> }));
vi.mock('../gym/useTrainingLauncher', () => ({
  useTrainingLauncher: () => ({ start: () => undefined, overlay: null, open: false }),
}));
vi.mock('../gym/TrainingPlansSection', () => ({
  TrainingPlansSection: ({ onReady }: { onReady?: () => void }) => {
    useEffect(() => {
      signal.ready = onReady ?? null;
      if (plansLoaded) onReady?.();
    }, [onReady]);
    return (
      <section>
        <h2>Trainingspläne</h2>
      </section>
    );
  },
}));

const { GymTerminal } = await import('./GymTerminal');

let mounted: Mounted | null = null;
let scrolls: ScrollToOptions[] = [];

async function openHub(): Promise<HTMLElement> {
  mounted = await mount(
    <div className="areas__scroll">
      <GymTerminal onOpenMuscles={() => undefined} />
    </div>,
  );
  const scroller = mounted.container.querySelector<HTMLElement>('.areas__scroll')!;
  return scroller;
}

beforeEach(() => {
  ratingLoading = false;
  plansLoaded = true;
  signal.ready = null;
  scrolls = [];
  takeHubIntent();
  HTMLElement.prototype.scrollTo = function scrollTo(options?: ScrollToOptions | number) {
    if (typeof options === 'object') scrolls.push(options);
  } as typeof HTMLElement.prototype.scrollTo;
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

describe('the Gym hub, opened for its plans', () => {
  it('brings the plans into view and puts the focus on their heading', async () => {
    arriveAt('plans');
    const scroller = await openHub();
    await settle();
    expect(scrolls.length).toBeGreaterThan(0);
    // At once: the user did not see where the page started.
    expect(scrolls[0]!.behavior).toBe('auto');
    const heading = scroller.querySelector('h2')!;
    expect(heading.textContent).toBe('Trainingspläne');
    expect(document.activeElement).toBe(heading);
    // Reached by script only: the heading is no new tab stop.
    expect(heading.tabIndex).toBe(-1);
  });

  it('opened for itself, starts at its top and moves no focus', async () => {
    const scroller = await openHub();
    await settle();
    expect(scrolls).toEqual([]);
    expect(document.activeElement).not.toBe(scroller.querySelector('h2'));
  });

  it('takes the intent once: the hub opened again starts at its top', async () => {
    arriveAt('plans');
    await openHub();
    await settle();
    await mounted!.unmount();
    scrolls = [];
    await openHub();
    await settle();
    expect(scrolls).toEqual([]);
    expect(takeHubIntent()).toBeNull();
  });

  it('waits for the plans and for the rating board above them', async () => {
    arriveAt('plans');
    plansLoaded = false;
    ratingLoading = true;
    const scroller = await openHub();
    await settle();
    expect(scrolls).toEqual([]);

    // The plans arrive; the board above them is still loading.
    await act(async () => signal.ready?.());
    await settle();
    expect(scrolls).toEqual([]);

    ratingLoading = false;
    await mounted!.rerender(
      <div className="areas__scroll">
        <GymTerminal onOpenMuscles={() => undefined} />
      </div>,
    );
    await settle();
    expect(scrolls.length).toBeGreaterThan(0);
    expect(document.activeElement).toBe(scroller.querySelector('h2'));
  });
});

describe('the intent', () => {
  it('is what was said last, and nothing once taken', () => {
    expect(takeHubIntent()).toBeNull();
    arriveAt('plans');
    expect(takeHubIntent()).toBe('plans');
    expect(takeHubIntent()).toBeNull();
  });
});
