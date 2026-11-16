import { Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MuscleGroup } from '../../core/model';
import { useToday } from '../../app/useToday';
import { BodyRenderer, MUSCLE_STATE_KEYS, type MuscleState, type MuscleView } from '../../components/BodyRenderer';
import { useT } from '../../i18n/I18nProvider';
import type { ShownMuscle } from './muscleState';
import { BodyBoundary, BodyViewer, toBodyVisuals, visualsByMuscle, type BodyStageState } from '../body';
import type { FocusStrip } from '../body/framing';
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
 * **It owns no selection.** The Gym screen holds the one selected group —
 * the group whose sheet stands (block 7C) — and hands it here; the 3D body,
 * the flat figure that stands in for it and the rows all read that one
 * value, so the body, the list and the sheet can never disagree about what
 * is selected.
 *
 * A tap on the body **opens the group's sheet** and never turns the body;
 * a miss does nothing. A tap on a row opens the same sheet, and turns the
 * body to the group when the group faces away. Closing the sheet clears
 * the selection: there is nothing chosen that is not open.
 *
 * **Above the group's sheet the body shows the group** (block 7C, contract
 * §9, mock-up 2). The sheet covers the lower two thirds of the screen. When
 * it opens, the page is brought to where the stage begins right under the
 * header, and the strip of the stage that is left above the sheet — about
 * 190px on an iPhone — is handed to the viewer, whose camera moves the
 * group into it and then stands: the module holds the viewer from that
 * moment, so no frame arises under the open sheet, and a change of the
 * range draws exactly one. When the sheet goes, the hold ends first, the
 * camera travels back to the whole body, and the page returns to where the
 * user had it.
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
  onOpen,
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
  /** A tap on a muscle of the body: its sheet opens, and the body does not turn. */
  onSelect: (muscle: MuscleGroup) => void;
  /** A tap on a row: its sheet opens, and the body turns to the group if it faces away. */
  onOpen: (muscle: MuscleGroup) => void;
}) {
  // "Vor 3 Tagen" counts from the day the app shows, which moves (B3).
  const today = useToday();
  const t = useT();
  const visuals = useMemo(() => (muscles ? visualsByMuscle(toBodyVisuals(muscles)) : undefined), [muscles]);
  // What stands in the stage: nothing yet, the body, nothing again while a
  // lost context is replaced, or the flat figure.
  const [stage, setStage] = useState<BodyStageState>('loading');
  const flat = useCallback(() => setStage('flat'), []);

  /*
   * The strip above the sheet (see above). It is measured when the sheet
   * opens — once: the sheet's other height and whatever happens on it do
   * not move the body again — and from where the page will stand, so the
   * camera can leave at once while the page is still on its way there.
   */
  const stageRef = useRef<HTMLDivElement>(null);
  const [strip, setStrip] = useState<FocusStrip | null>(null);
  const scrolledFrom = useRef<number | null>(null);
  const open = selected !== null;
  useLayoutEffect(() => {
    const element = stageRef.current;
    const scroller = element?.closest<HTMLElement>('.areas__scroll') ?? null;
    const calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = calm ? 'auto' : 'smooth';
    if (!open) {
      setStrip(null);
      if (scroller && scrolledFrom.current !== null) scroller.scrollTo({ top: scrolledFrom.current, behavior });
      scrolledFrom.current = null;
      return;
    }
    if (!element) return;
    const box = element.getBoundingClientRect();
    let top = box.top;
    let portTop = 0;
    if (scroller) {
      const port = scroller.getBoundingClientRect();
      portTop = port.top;
      // As far as the page can go: the stage's top under the header.
      const wanted = scroller.scrollTop + (box.top - port.top);
      const target = Math.max(0, Math.min(wanted, scroller.scrollHeight - scroller.clientHeight));
      scrolledFrom.current = scroller.scrollTop;
      top = box.top - (target - scroller.scrollTop);
      scroller.scrollTo({ top: target, behavior });
    }
    // Where the sheet's upper edge stands on its lower height.
    const share = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-detent-lower')) || 2 / 3;
    const sheetTop = document.documentElement.clientHeight * (1 - share);
    const height = box.height || 1;
    const from = Math.max(0, Math.min(1, (Math.max(top, portTop) - top) / height));
    const to = Math.max(from, Math.min(1, (sheetTop - top) / height));
    setStrip({ top: from, bottom: to });
    // Only when the sheet opens or goes.
  }, [open]);

  // One figure, whichever way it is drawn: the SVG stands in for the canvas
  // rather than sitting beside it, and brings no second list with it.
  const figure = (
    <div className="muscle-module__figure">
      <BodyRenderer muscles={views} parts="figure" selected={selected} size={132} />
    </div>
  );

  return (
    <div className="muscle-module">
      <div className="body-stage" data-stage={stage} data-focus={open ? '' : undefined} ref={stageRef}>
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
              // The group in the strip above its sheet — and held there:
              // the hold is asked for with the strip, so it takes hold when
              // the camera has arrived and not a frame before.
              focus={strip}
              paused={open && strip !== null}
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

      {analytics ? <MuscleRows views={analytics} today={today} selected={selected} onSelect={onOpen} /> : pending}
    </div>
  );
}
