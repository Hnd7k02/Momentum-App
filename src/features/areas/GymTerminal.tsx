import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { MUSCLE_TREND_RANGES } from '../../core/config/constants';
import { useToday } from '../../app/useToday';
import { GymOverview } from '../gym/GymOverview';
import { MuscleEntryCard } from '../gym/MuscleEntryCard';
import { TrainingCard } from '../gym/TrainingCard';
import { TrainingPlansSection } from '../gym/TrainingPlansSection';
import { useGymHistoryState } from '../gym/useGymHistory';
import { useGymRatingState } from '../gym/useGymRating';
import { LoadingBlocks } from '../../components';
import { useTrainingLauncher } from '../gym/useTrainingLauncher';
import { takeHubIntent } from '../../app/hubIntent';

/**
 * The Gym hub (WP2-2): the Gym area's front page.
 *
 * ```
 *   1  Training          where this week stands, the last session, and
 *                        the one button — Training erfassen
 *   2  Muskelgruppen     the door to the body and the ten groups
 *   3  Gym-Rating        the board Verlauf used to carry (unchanged)
 *   4  Trainingspläne    the saved plans, subordinate to the two above
 * ```
 *
 * Nothing here computes; every figure arrives from the services that always
 * produced it. The 3D body is not rendered on this page: the entry card
 * draws the bundled SVG figure, and the viewer's lazy chunk is fetched only
 * when the muscle destination opens.
 */
export function GymTerminal({ onOpenMuscles }: { onOpenMuscles(): void }) {
  const date = useToday();
  const plansRef = useRef<HTMLDivElement>(null);

  // The area's own scroller moves, not the document: scrolling the page
  // itself lifted the whole shell and left a blank band under the tab bar.
  const scrollToPlans = () => {
    const target = plansRef.current;
    const scroller = target?.closest<HTMLElement>('.areas__scroll');
    if (!target || !scroller) return;
    const offset = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTo({ top: scroller.scrollTop + offset - 8, behavior: 'smooth' });
  };
  // The cards read the store's change version (WP3, B2), so a finished
  // workout reaches them without a reload key of its own.
  const launcher = useTrainingLauncher({
    date,
    onClosed: () => undefined,
    onManagePlans: scrollToPlans,
  });

  /*
   * While a workout is open the hub is underneath it, so its cards are not
   * kept mounted; when the workout closes they mount again and load what it
   * wrote. What stays mounted elsewhere on the page — Running's board — is
   * kept quiet by the workout holding the change signal (`holdChanges`), so
   * no saved set replays the Boss behind it.
   */
  if (launcher.open) return <>{launcher.overlay}</>;

  return (
    <>
      <HubCards
        onStart={() => launcher.start()}
        onManagePlans={scrollToPlans}
        onOpenMuscles={onOpenMuscles}
        plansRef={plansRef}
      />
      {launcher.overlay}
    </>
  );
}

/** The hub's cards, and the two replays behind them. */
function HubCards({
  onStart,
  onManagePlans,
  onOpenMuscles,
  plansRef,
}: {
  onStart(): void;
  onManagePlans(): void;
  onOpenMuscles(): void;
  plansRef: RefObject<HTMLDivElement>;
}) {
  const range = MUSCLE_TREND_RANGES[0];
  const { view: gymRating, loading: ratingLoading } = useGymRatingState();
  const { history: gym, latestSession, failed: historyFailed } = useGymHistoryState(range);

  /*
   * Opened for the plans (`app/hubIntent.ts`): «Pläne verwalten» on Heute or
   * on Muskelgruppen led here. The plans stand under the rating board, so
   * they are brought into view once both have loaded and the page has its
   * heights — at once, without a travel, since the user did not see where
   * it started — and the focus goes to their heading, where a screen reader
   * arrives too. What still settles above them in the moments after (the
   * Training card's lines) moves the page under them, not them: the place
   * is held until the user touches the page, and no longer than a second.
   */
  const [toPlans, setToPlans] = useState(false);
  const [plansReady, setPlansReady] = useState(false);
  const onPlansReady = useCallback(() => setPlansReady(true), []);
  useEffect(() => {
    if (takeHubIntent() === 'plans') setToPlans(true);
  }, []);
  useEffect(() => {
    if (!toPlans || !plansReady || ratingLoading) return undefined;
    const target = plansRef.current;
    const scroller = target?.closest<HTMLElement>('.areas__scroll');
    if (!target || !scroller) return undefined;
    const bring = () => {
      const offset = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      scroller.scrollTo({ top: scroller.scrollTop + offset - 8, behavior: 'auto' });
    };
    bring();
    const heading = target.querySelector<HTMLElement>('h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    setToPlans(false);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(bring);
    for (const child of Array.from(scroller.children)) observer.observe(child);
    const stop = () => {
      observer.disconnect();
      window.clearTimeout(timer);
      scroller.removeEventListener('pointerdown', stop);
      scroller.removeEventListener('wheel', stop);
      scroller.removeEventListener('touchstart', stop);
    };
    const timer = window.setTimeout(stop, 1000);
    scroller.addEventListener('pointerdown', stop, { passive: true });
    scroller.addEventListener('wheel', stop, { passive: true });
    scroller.addEventListener('touchstart', stop, { passive: true });
    // Not a cleanup of this effect: taking the intent re-renders, and the
    // place is held across that render.
    return undefined;
  }, [toPlans, plansReady, ratingLoading, plansRef]);
  return (
    <>
      <TrainingCard onStart={onStart} onManagePlans={onManagePlans} />
      <MuscleEntryCard
        history={gym}
        rangeDays={range}
        latestSession={latestSession}
        failed={historyFailed}
        onOpen={onOpenMuscles}
      />
      {gymRating ? (
        <GymOverview state={gymRating.state} started={gymRating.started} enabled={gymRating.enabled} provisional={gymRating.provisional} />
      ) : ratingLoading ? (
        // The rating board holds its place, so the plans below do not jump
        // when the replay behind it arrives (contract §11).
        <LoadingBlocks heights={[150, 120]} />
      ) : null}
      <div ref={plansRef}>
        <TrainingPlansSection onReady={onPlansReady} />
      </div>
    </>
  );
}
