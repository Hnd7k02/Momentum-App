import { useId, useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useToday } from '../../app/useToday';
import { Figure } from '../../components';
import { GymIcon, MindIcon, TrendUpIcon } from '../../components/Icons';
import { addDays } from '../../core/dates';
import { useI18n, useT } from '../../i18n/I18nProvider';
import { DOMAIN_NAME_KEYS } from '../../i18n/domainNames';
import { formatDayAndMonthShort } from '../../i18n/format';

/**
 * The first slide's picture (block 7E, D190; contract «Onboarding-Ausnahmen»).
 *
 * It shows what the app will look like once there is something to show: a
 * trend over thirty days, today's check-in and the week's sessions. All of
 * it is **example values**, and this is the only place in the product that
 * has any — so it is one image with one description that says so, and it
 * holds no control: nothing in it can be tapped, focused or mistaken for a
 * figure the app computed.
 *
 * It is also the only place a data mark carries colour: the line runs
 * through the onboarding's gradient, the bars behind it are the accent's
 * tint, the Mind segments follow the line and the Gym segments take Gym's
 * accent. Every other step of the flow draws its marks neutral, as the
 * contract has them.
 */

/**
 * The chart's own coordinates. It is as wide as its card and gives up
 * height before the slide has to scroll, so nothing in it may depend on
 * the two scaling alike: the bars are boxes with round ends, the line keeps
 * its width (`non-scaling-stroke`) and the end point is a round box placed
 * by its share of the plot.
 */
const WIDTH = 325;
const HEIGHT = 116;
/** Where each of the eleven bars begins, from the top. */
const BAR_TOPS = [58, 50, 56, 42, 34, 40, 26, 30, 18, 12, 4] as const;
/** The line through the bars' middles, as the reference draws it. */
const LINE =
  'M7.5 78 C12.7 76.7 28.2 70.3 38.5 70 C48.8 69.7 59.2 77.3 69.5 76 C79.8 74.7 90.2 65.7 100.5 62 ' +
  'C110.8 58.3 121.2 54.3 131.5 54 C141.8 53.7 152.2 61.7 162.5 60 C172.8 58.3 183.2 45.7 193.5 44 ' +
  'C203.8 42.3 214.2 51.3 224.5 50 C234.8 48.7 245.2 39.3 255.5 36 C265.8 32.7 276.2 32.7 286.5 30 ' +
  'C296.8 27.3 312.3 21.7 317.5 20';
/** Where the line ends, as shares of the plot. */
const END = { left: 317.5 / WIDTH, top: 20 / HEIGHT } as const;

const MIND = { done: 8, of: 10 } as const;
const GYM = { done: 2, of: 3 } as const;

/**
 * A world's tile: its mark and name, a word for the period, and whatever
 * the tile is about. Gym's is the one dark surface of a screen — the tile
 * declares the Gym world for itself and reads every colour from that set.
 */
export function WorldTile({
  world,
  name,
  meta,
  children,
}: {
  world: 'mind' | 'gym';
  name: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <div className="world-tile" data-world={world === 'gym' ? 'gym' : undefined}>
      <div className="world-tile__head">
        <span className="world-tile__icon" aria-hidden="true">
          {world === 'gym' ? <GymIcon size={18} /> : <MindIcon size={18} />}
        </span>
        <span className="world-tile__name">{name}</span>
        {meta ? <span className="world-tile__meta">{meta}</span> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * A row of segments: `done` of `of`. Neutral unless told otherwise — the
 * two coloured kinds exist for the hero alone.
 */
export function Segments({
  done,
  of,
  kind = 'neutral',
}: {
  done: number;
  of: number;
  kind?: 'neutral' | 'line' | 'accent';
}) {
  return (
    <span
      className={`segments segments--${kind}`}
      style={{ '--segments': of } as CSSProperties}
      aria-hidden="true"
    >
      {Array.from({ length: of }, (_, index) => (
        <i
          key={index}
          data-on={index < done ? '' : undefined}
          style={{ '--segment': index } as CSSProperties}
        />
      ))}
    </span>
  );
}

/** The plot gives way down to this, and no further: below it the slide scrolls. */
const PLOT_FLOOR = 64;

/**
 * On a short screen the plot gives up the height the slide lacks, before
 * the slide scrolls (contract §16, «Kurze Bildschirme»). How much is
 * lacking depends on how many lines each sentence takes, which the system
 * font decides and which differs between phones — so it is measured, not
 * assumed: the plot is laid out at its proportion, the slide's overflow is
 * read, and the plot is lowered by that much, never under `PLOT_FLOOR`.
 * Before the first paint, and again whenever the slide's box changes size.
 * It writes nothing but the plot's height.
 */
function useFitPlot(plot: RefObject<HTMLDivElement>): void {
  useLayoutEffect(() => {
    const element = plot.current;
    const slide = element?.closest<HTMLElement>('.onboarding__body');
    if (!element || !slide) return undefined;
    const fit = () => {
      element.style.removeProperty('--plot-height');
      const lacking = slide.scrollHeight - slide.clientHeight;
      if (lacking <= 0) return;
      const height = Math.max(PLOT_FLOOR, element.getBoundingClientRect().height - lacking);
      element.style.setProperty('--plot-height', `${height}px`);
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(fit);
    observer.observe(slide);
    return () => observer.disconnect();
  }, [plot]);
}

export function OnboardingHero() {
  const t = useT();
  const { language } = useI18n();
  const today = useToday();
  const id = useId();
  const line = `${id}-line`;
  const plot = useRef<HTMLDivElement>(null);
  useFitPlot(plot);

  return (
    <div className="onboarding-hero" role="img" aria-label={t('onboarding.hero.label')}>
      <div className="onboarding-card onboarding-hero__trend" data-card aria-hidden="true">
        <div className="onboarding-hero__head">
          <span className="onboarding-hero__title">{t('nav.progress')}</span>
          <span className="onboarding-hero__range">
            <span>{t('progress.rangeDays', { count: 7 })}</span>
            <span data-on="">{t('progress.rangeDays', { count: 30 })}</span>
          </span>
        </div>

        <div className="onboarding-hero__figure">
          <span className="onboarding-hero__change">{t('onboarding.hero.change')}</span>
          <span className="onboarding-hero__chip">
            <TrendUpIcon size={12} />
            {t('progress.rising')}
          </span>
        </div>
        <p className="onboarding-hero__period">{t('onboarding.hero.period')}</p>

        <div className="onboarding-hero__plot" ref={plot}>
          <span className="onboarding-hero__bars">
            {BAR_TOPS.map((top, index) => (
              <i key={index} style={{ '--bar': 1 - top / HEIGHT } as CSSProperties} />
            ))}
          </span>
          <svg
            className="onboarding-hero__chart"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            focusable="false"
          >
            <defs>
              <linearGradient id={line} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={WIDTH} y2="0">
                <stop className="onboarding-hero__line-start" offset="0" />
                <stop className="onboarding-hero__line-mid" offset="0.55" />
                <stop className="onboarding-hero__line-end" offset="1" />
              </linearGradient>
            </defs>
            <path
              className="onboarding-hero__line"
              d={LINE}
              fill="none"
              stroke={`url(#${line})`}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="onboarding-hero__end"
            style={{ left: `${END.left * 100}%`, top: `${END.top * 100}%` }}
          />
        </div>

        <div className="onboarding-hero__axis">
          <span>{formatDayAndMonthShort(language, addDays(today, -30))}</span>
          <span>{formatDayAndMonthShort(language, addDays(today, -15))}</span>
          <span className="onboarding-hero__today">{t('common.today')}</span>
        </div>
      </div>

      <div className="onboarding__tiles" aria-hidden="true">
        <WorldTile world="mind" name={t(DOMAIN_NAME_KEYS.mental)} meta={t('common.today')}>
          <p className="world-tile__figure">
            <Figure text={t('onboarding.hero.mind')} figure={MIND.done} />
          </p>
          <Segments done={MIND.done} of={MIND.of} kind="line" />
        </WorldTile>
        <WorldTile world="gym" name={t(DOMAIN_NAME_KEYS.gym)} meta={t('onboarding.hero.week')}>
          <p className="world-tile__figure">
            <Figure text={t('onboarding.hero.gym')} figure={GYM.done} />
          </p>
          <Segments done={GYM.done} of={GYM.of} kind="accent" />
        </WorldTile>
      </div>
    </div>
  );
}
