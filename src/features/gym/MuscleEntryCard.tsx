import { useLayoutEffect, useMemo, useRef } from 'react';
import { MUSCLE_GROUPS } from '../../core/model';
import type { DateKey } from '../../core/dates';
import { useToday } from '../../app/useToday';
import { Section } from '../../components';
import { ChevronRightIcon } from '../../components/Icons';
import { useT } from '../../i18n/I18nProvider';
import { NBSP } from '../../i18n/typography';
import type { GymHistory } from '../../storage/services/gymService';
import { changeWords } from './changeWords';
import { muscleGap } from './muscleGap';
import { NOTHING_SHOWN, shownPerformance } from './muscleState';
import bodyPreview from './assets/body-preview.webp';
import './gymHub.css';

/**
 * The door to muscle-group progress, on the Gym hub (WP2-2).
 *
 * A whole card that is one button, so the destination is obvious and the
 * tap target is the card. The figure inside it is a still of the body —
 * `momentum-body.glb`, rendered once through the real viewer with its data
 * colours off, one figure in the neutral tone (D166), and saved as a small
 * image (`tools/render-body-preview.mjs`).
 * It is a picture of the destination, not a second body: it has no regions,
 * takes no colour and answers no tap of its own. What the data says is
 * carried by the text and, as an accent, by ten small markers in the
 * groups' order, each in the state the module shows — grey before the first
 * workout, so nothing reads as progress that is not. All of it is hidden
 * from assistive technology; the button's name and the lines of text carry
 * the facts. The 3D body is **not** here: it loads only in the destination
 * this card opens.
 *
 * Nothing is computed here: the states, the count of rated groups and the
 * trend are `shownPerformance()`'s — what `GymProgress` shows for the same
 * loaded history, by the one rule in `muscleState.ts`.
 *
 * **What the card says never changes under its glass** (the tidy-up of
 * WP3, D199). The card is there before its history, so that the hub holds
 * its layout (D168) — and it was the one card of the hub whose text then
 * changed inside a living sheet of glass: two lines that held their place
 * became words. On an iPhone, on a first load now and then, the picture
 * kept only part of that: «Noch nicht trainiert» cut through the middle and
 * the hint under it missing, right on the next load — the second finding of
 * this kind on this card (the first was the title standing twice, D168).
 * No runner shows it; what the phone showed is a repaint of only the part
 * of the layer that had held ink before. So the card does what every other
 * card of the hub does: it is put there whole. Whenever its words change,
 * the button is a new element (`key`), which a browser paints from
 * nothing; its place, its height and its title's place are the same, and a
 * keyboard's focus goes with it.
 */
export function MuscleEntryCard({
  history,
  rangeDays,
  latestSession = null,
  failed = false,
  onOpen,
}: {
  /**
   * `null` while loading, and when the load failed (`failed`); a history
   * with no days when the range holds none.
   */
  history: GymHistory | null;
  rangeDays: number;
  /** The day of the latest Gym session of all, `null` before the first. */
  latestSession?: DateKey | null;
  /** The history could not be loaded: the card says so, not "never trained". */
  failed?: boolean;
  onOpen(): void;
}) {
  const t = useT();
  const today = useToday();
  const shown = useMemo(
    () => (history ? shownPerformance(history.days, history.overall) : NOTHING_SHOWN),
    [history],
  );
  const states = shown.muscles;

  const trained = states.filter((view) => view.state !== 'noData').length;
  // "Gewertet" is the groups whose row prints a figure — not the groups the
  // comparison could compute, some of which have too little to compare.
  const measured = shown.rated.length;
  const trend = changeWords(shown.change, t);
  const hasData = (history?.days.length ?? 0) > 0;

  // An empty range is "never trained" only before the first session; with
  // one behind it the card says that the range is empty and how long ago
  // the last session was (STOP 6b). The reasons are `muscleGap`'s.
  //
  // Loading is not "none" either: until the history is there the lines hold
  // their place and say nothing, and a load that failed says that.
  const gap = history ? muscleGap(history, latestSession, today, rangeDays) : null;
  const summary = history === null
    ? failed
      ? t('error.muscles.title')
      : NBSP
    : !hasData
    ? gap?.kind === 'outsideRange'
      ? t('gymHub.muscles.outside', { days: rangeDays })
      : gap?.kind === 'unscored'
        ? t('gymHub.muscles.unscored')
        : t('gymHub.muscles.none')
    : measured > 0
      ? t('gymHub.muscles.summary', { count: measured, total: MUSCLE_GROUPS.length })
      : t('gymHub.muscles.trained', { count: trained, total: MUSCLE_GROUPS.length });
  const overall =
    hasData && measured > 0 && trend !== null
      ? t('gymHub.muscles.overall', { change: trend.text })
      : null;
  // The figure's colour follows the figure as printed (B6) and the band
  // (contract §7): green from +3 %, red from −3 %, the text colour when held.
  const overallTone =
    trend === null || trend.trend === 'unchanged' ? '' : `gym-hub__musclesOverall--${trend.trend}`;

  const rangeLine =
    history === null
      ? NBSP
      : hasData
        ? t('gymHub.muscles.range', { days: rangeDays })
        : gap?.kind === 'outsideRange'
          ? t('gymHub.muscles.outsideShort', { count: gap.daysAgo })
          : gap?.kind === 'unscored'
            ? t('gymHub.muscles.range', { days: rangeDays })
            : t('gymHub.muscles.noneHint');

  // One element for one wording (above): the lines the card prints, and
  // the states its ten markers stand in.
  const wording = [summary, overall ?? '', overallTone, rangeLine, states.map((view) => view.state).join(',')].join('\u0001');
  const button = useRef<HTMLButtonElement>(null);
  // Read before the commit takes the old element away: was the focus on it?
  const focused = useRef(false);
  focused.current = button.current !== null && typeof document !== 'undefined' && document.activeElement === button.current;
  useLayoutEffect(() => {
    if (focused.current && document.activeElement !== button.current) button.current?.focus({ preventScroll: true });
  }, [wording]);

  return (
    // No section label: the card names itself, and it is the section's only
    // card, so a grey "Muskelgruppen" above a bold one was the same word twice.
    <Section>
      <button
        key={wording}
        ref={button}
        type="button"
        className="card gym-hub__muscles"
        data-card
        aria-label={t('gymHub.muscles.open')}
        onClick={onOpen}
      >
        <span className="gym-hub__preview" aria-hidden="true">
          <img className="gym-hub__previewBody" src={bodyPreview} alt="" width={240} height={574} decoding="async" />
          <span className="gym-hub__previewStates">
            {states.map(({ muscle, state }) => (
              <i key={muscle} className={`gym-hub__previewState gym-hub__previewState--${state}`} />
            ))}
          </span>
        </span>
        <span className="gym-hub__musclesBody">
          <span className="gym-hub__musclesTitle">{t('gymHub.muscles.title')}</span>
          <span className="gym-hub__musclesSummary">{summary}</span>
          {overall ? (
            <span className={`gym-hub__musclesOverall ${overallTone}`.trim()}>{overall}</span>
          ) : null}
          <span className="gym-hub__musclesRange">{rangeLine}</span>
        </span>
        <span className="gym-hub__chevron" aria-hidden="true">
          <ChevronRightIcon size={20} />
        </span>
      </button>
    </Section>
  );
}
