import { useRef, type RefObject } from 'react';
import { TREND_RANGES } from '../../core/config/constants';
import { useToday } from '../../app/useToday';
import { GymOverview } from '../gym/GymOverview';
import { MuscleEntryCard } from '../gym/MuscleEntryCard';
import { TrainingCard } from '../gym/TrainingCard';
import { TrainingPlansSection } from '../gym/TrainingPlansSection';
import { useGymHistory } from '../gym/useGymHistory';
import { useGymRating } from '../gym/useGymRating';
import { useTrainingLauncher } from '../gym/useTrainingLauncher';

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
  const range = TREND_RANGES[TREND_RANGES.length - 1]!;
  const gymRating = useGymRating();
  const gym = useGymHistory(range);
  return (
    <>
      <TrainingCard onStart={onStart} onManagePlans={onManagePlans} />
      <MuscleEntryCard history={gym} rangeDays={range} onOpen={onOpenMuscles} />
      {gymRating ? (
        <GymOverview state={gymRating.state} started={gymRating.started} enabled={gymRating.enabled} />
      ) : null}
      <div ref={plansRef}>
        <TrainingPlansSection />
      </div>
    </>
  );
}
