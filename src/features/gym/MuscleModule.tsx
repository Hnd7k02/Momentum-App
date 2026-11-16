import { Suspense, useCallback, useMemo, useState, type ReactNode } from 'react';
import type { MuscleGroup } from '../../core/model';
import { useToday } from '../../app/useToday';
import { BodyRenderer, MUSCLE_STATE_KEYS, type MuscleState, type MuscleView } from '../../components/BodyRenderer';
import { useT } from '../../i18n/I18nProvider';
import type { ShownMuscle } from './muscleState';
import { BodyBoundary, BodyViewer, toBodyVisuals, visualsByMuscle, type BodyStageState } from '../body';
import { BodyReadout } from '../measure';
import type { MuscleAnalyticsView } from './muscleAnalytics';
import { MuscleRows } from './MuscleRows';
import bodyStill from './assets/body-stage.webp';
import './muscleModule.css';

/**
 * Muskelgruppen: the body on its stage and the ten group rows, as one
 * module.
 *
 * **The stage** (block 7B, contract §8). The body stands on the ground of
 * the screen, without a card, in a box as wide as the screen and as tall as
 * 55 % of what the device shows of it. It is there from the screen's first
 * render — the viewer's code and the model load beside the history, not
 * after it — and until its first picture has been drawn its still stands in
 * the same place at the same size (contract §11), so nothing jumps when the
 * canvas takes over. The same still stands in while a lost graphics context
 * is being replaced: the stage is never an empty field.
 *
 * **It owns no selection.** The Gym screen holds the one selected group and
 * hands it here; the 3D body, the flat figure that stands in for it and the
 * rows all read that one value, so the body, the list and the exercises
 * below can never disagree about what is selected.
 *
 * A tap on the body **selects**; it never clears, and it never turns the
 * body. A miss already does nothing, and making a second tap on the same
 * muscle undo the first turned a small aiming error into a lost selection.
 * The rows keep their toggle, where tapping the highlighted row again is a
 * deliberate act — and a row turns the body to its group when the group
 * faces away.
 *
 * It computes nothing: the visuals are `toBodyVisuals()` and the rows are
 * `toMuscleAnalytics()`, both over what the screen already shows.
 *
 * Under the body stands the row of the five states (contract §7, mock-up
 * 1): a mark and the word, in the order the legend sheet explains them. It
 * is hidden from assistive technology — every row below says its state in
 * words, and the sheet behind ⓘ is the readable legend.
 *
 * The 3D body is behind `React.lazy`, so three.js reaches a device only when
 * this module renders — entering Mind never fetches it. Where
 * WebGL is missing, the chunk cannot be fetched or the viewer throws, the
 * SVG figure takes its place with the same states and the same selection,
 * and the rows below are untouched either way.
 */
/** The five states, in the legend's order. */
export const LEGEND_STATES: readonly MuscleState[] = [
  'improved',
  'unchanged',
  'declined',
  'awaitingBaseline',
  'noData',
];

export function MuscleModule({
  muscles,
  analytics,
  views,
  legend = true,
  notice = null,
  pending = null,
  selected,
  onSelect,
  onToggle,
}: {
  /**
   * The ten groups as the screen shows them for the range
   * (`shownPerformance`); `null` while the history is on its way — the
   * stage is there already, and the body says nothing yet.
   */
  muscles: readonly ShownMuscle[] | null;
  /** The rows' view model, over the same range; `null` with `muscles`. */
  analytics: readonly MuscleAnalyticsView[] | null;
  /** The same groups in the SVG figure's shape, for the stand-in. */
  views: readonly MuscleView[];
  /** The row of the five states under the body; off where nothing is coloured. */
  legend?: boolean;
  /** What is missing, and the one action that supplies it: between the body and the rows. */
  notice?: ReactNode;
  /** In the rows' place while they cannot be shown: the loading surfaces, or the failure. */
  pending?: ReactNode;
  selected: MuscleGroup | null;
  /** A tap on the body: select, never clear. */
  onSelect: (muscle: MuscleGroup) => void;
  /** A tap on a row: the list's own semantics, which include deselecting. */
  onToggle: (muscle: MuscleGroup) => void;
}) {
  // "Vor 3 Tagen" counts from the day the app shows, which moves (B3).
  const today = useToday();
  const t = useT();
  const visuals = useMemo(() => (muscles ? visualsByMuscle(toBodyVisuals(muscles)) : undefined), [muscles]);
  // What stands in the stage: nothing yet, the body, nothing again while a
  // lost context is replaced, or the flat figure.
  const [stage, setStage] = useState<BodyStageState>('loading');
  const flat = useCallback(() => setStage('flat'), []);

  // One figure, whichever way it is drawn: the SVG stands in for the canvas
  // rather than sitting beside it, and brings no second list with it.
  const figure = (
    <div className="muscle-module__figure">
      <BodyRenderer muscles={views} parts="figure" selected={selected} size={132} />
    </div>
  );

  return (
    <div className="muscle-module">
      <div className="body-stage" data-stage={stage}>
        {/* The body's still, where the body will stand: until its first
            picture, and whenever the canvas has none to show. */}
        {stage === 'loading' || stage === 'lost' ? (
          <img className="body-stage__still" src={bodyStill} alt="" aria-hidden="true" decoding="async" />
        ) : null}
        <BodyBoundary fallback={figure} onError={flat}>
          <Suspense fallback={null}>
            <BodyViewer
              visuals={visuals}
              // Before the history is there the body says nothing: one
              // figure in the neutral tone, like its still.
              tinted={muscles !== null}
              selectedMuscle={selected}
              onSelectMuscle={onSelect}
              onStateChange={setStage}
              fallback={figure}
            />
          </Suspense>
        </BodyBoundary>
      </div>

      {/* The measuring display, where its user switched it on (D181):
          beside the canvas, never over it. */}
      <BodyReadout />

      {legend ? (
        <ul className="muscle-legend" aria-hidden="true">
          {LEGEND_STATES.map((state) => (
            <li key={state} className="muscle-legend__item">
              <i className={`muscle-legend__mark muscle-legend__mark--${state}`} />
              {t(MUSCLE_STATE_KEYS[state])}
            </li>
          ))}
        </ul>
      ) : null}

      {notice}

      {analytics ? <MuscleRows views={analytics} today={today} selected={selected} onSelect={onToggle} /> : pending}
    </div>
  );
}
