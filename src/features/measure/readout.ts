import type { Language, Translator } from '../../i18n';
import { formatNumber } from '../../i18n/format';
import { percentText } from '../../i18n/typography';
import { FAST_FRAME_MS, deviceFacts, type MeasureSnapshot, type ResourceFacts } from './measure';

/**
 * The measuring display, as lines of text (block 7B, D181).
 *
 * One function makes the lines, and the panel and the copied text are both
 * made from them — what the owner reads on the phone is what he pastes into
 * the chat. Every number carries its unit. The words here may be technical
 * (frames per second, draw calls, texture): the display is a tool, switched
 * on by its user, and the one named exception to the rule that the
 * interface carries no technical word.
 */

/** What the display reads from the browser, beside the recorder. */
export interface ReadoutEnvironment {
  userAgent: string;
  /** Opened from the home screen, without the browser's bars. */
  standalone: boolean;
  screen: { width: number; height: number; pixelRatio: number };
  /** The area the page can draw in, in CSS pixels. */
  viewport: { width: number; height: number };
  /** The name of the build's main file, which changes with every build. */
  build: string | null;
}

export interface ReadoutRow {
  label: string;
  value: string;
}

export interface ReadoutGroup {
  title: string;
  /** A sentence in place of rows: why there is nothing to measure. */
  note?: string;
  rows: ReadoutRow[];
}

export function readoutGroups(
  snapshot: MeasureSnapshot,
  environment: ReadoutEnvironment,
  { t, language }: { t: Translator; language: Language },
): ReadoutGroup[] {
  const whole = (value: number) => formatNumber(language, Math.round(value));
  const ms = (value: number) => t('measure.ms', { value: whole(value) });
  const source = (facts: ResourceFacts) => {
    const word =
      facts.source === 'cache' && facts.viaWorker === true
        ? t('measure.source.appCache')
        : t(`measure.source.${facts.source}`);
    return [
      word,
      facts.bytes === null ? null : t('measure.kilobytes', { value: whole(facts.bytes / 1000) }),
      // The request itself; the rest of the leg is the work on what arrived.
      facts.fetchMs == null ? null : t('measure.load.fetch', { value: whole(facts.fetchMs) }),
    ]
      .filter((part): part is string => part !== null)
      .join(', ');
  };

  const { load, rotation, renderer } = snapshot;
  const pending = t('measure.load.pending');
  const groups: ReadoutGroup[] = [];

  // Loading: the whole way, then its three legs — each as its own duration,
  // so the three add up to the first line.
  const modelLeg = load.model === null || load.code === null ? null : load.model - load.code;
  const frameLeg = load.firstFrame === null || load.model === null ? null : load.firstFrame - load.model;
  groups.push({
    title: t('measure.group.load'),
    ...(snapshot.failure ? { note: t(`measure.failure.${snapshot.failure}`) } : {}),
    rows: [
      { label: t('measure.load.total'), value: load.firstFrame === null ? pending : ms(load.firstFrame) },
      { label: t('measure.load.code'), value: load.code === null ? pending : `${ms(load.code)} · ${source(load.codeSource)}` },
      { label: t('measure.load.model'), value: modelLeg === null ? pending : `${ms(modelLeg)} · ${source(load.modelSource)}` },
      { label: t('measure.load.firstFrame'), value: frameLeg === null ? pending : ms(frameLeg) },
    ],
  });

  groups.push({
    title: t('measure.group.rotation'),
    rows:
      rotation.meanFps === null || rotation.fastShare === null || rotation.longestMs === null
        ? [{ label: t('measure.rotation.mean'), value: t('measure.rotation.none') }]
        : [
            { label: t('measure.rotation.mean'), value: t('measure.rotation.meanValue', { value: formatNumber(language, rotation.meanFps, 1) }) },
            // Rounded down: 94.6 % of the frames is not yet "95 %".
            { label: t('measure.rotation.fast', { limit: FAST_FRAME_MS }), value: percentText(formatNumber(language, Math.floor(rotation.fastShare * 1000) / 10, 1)) },
            { label: t('measure.rotation.longest'), value: ms(rotation.longestMs) },
            { label: t('measure.rotation.frames'), value: whole(rotation.frames) },
          ],
  });

  groups.push({
    title: t('measure.group.idle'),
    rows: [
      {
        label: t('measure.idle.frames'),
        value: snapshot.idleFrames === null ? t('measure.idle.waiting') : whole(snapshot.idleFrames),
      },
    ],
  });

  groups.push({
    title: t('measure.group.draw'),
    rows: renderer === null
      ? [{ label: t('measure.draw.calls'), value: t('measure.draw.none') }]
      : [
          { label: t('measure.draw.calls'), value: whole(renderer.calls) },
          { label: t('measure.draw.triangles'), value: whole(renderer.triangles) },
          {
            label: t('measure.draw.textures'),
            value: renderer.textureSizes.length === 0 ? whole(renderer.textures) : `${whole(renderer.textures)} · ${renderer.textureSizes.join(', ')}`,
          },
          {
            label: t('measure.draw.pixelRatio'),
            value: t('measure.draw.pixelRatioValue', {
              used: formatNumber(language, renderer.pixelRatio, Number.isInteger(renderer.pixelRatio) ? 0 : 2),
              screen: formatNumber(language, renderer.screenPixelRatio, Number.isInteger(renderer.screenPixelRatio) ? 0 : 2),
            }),
          },
          { label: t('measure.draw.buffer'), value: t('measure.draw.bufferValue', { width: renderer.bufferWidth, height: renderer.bufferHeight }) },
          ...(renderer.gpu ? [{ label: t('measure.draw.gpu'), value: renderer.gpu }] : []),
        ],
  });

  const device = deviceFacts(environment.userAgent);
  const where = environment.standalone
    ? t('measure.device.standalone')
    : device.browser
      ? `${t('measure.device.browser')} (${device.browser})`
      : t('measure.device.browser');
  const stageShare =
    renderer === null || environment.viewport.height <= 0 ? null : (100 * renderer.stageHeight) / environment.viewport.height;
  groups.push({
    title: t('measure.group.device'),
    rows: [
      {
        label: t('measure.device.name'),
        value: [device.device, device.system ? t('measure.device.system', { system: device.system }) : null, where]
          .filter((part): part is string => part !== null)
          .join(' · '),
      },
      {
        label: t('measure.display.rate'),
        value:
          snapshot.displayHz === null
            ? t('measure.display.rateUnknown')
            : t('measure.display.rateValue', { value: whole(snapshot.displayHz) }),
      },
      {
        label: t('measure.device.screen'),
        value: t('measure.device.screenValue', {
          width: environment.screen.width,
          height: environment.screen.height,
          ratio: formatNumber(language, environment.screen.pixelRatio, Number.isInteger(environment.screen.pixelRatio) ? 0 : 2),
        }),
      },
      {
        label: t('measure.device.viewport'),
        value: t('measure.device.viewportValue', { width: environment.viewport.width, height: environment.viewport.height }),
      },
      ...(renderer === null || stageShare === null
        ? []
        : [
            {
              label: t('measure.device.stage'),
              value: t('measure.device.stageValue', {
                width: Math.round(renderer.stageWidth),
                height: Math.round(renderer.stageHeight),
                share: whole(stageShare),
              }),
            },
          ]),
      ...(environment.build ? [{ label: t('measure.device.build'), value: environment.build }] : []),
    ],
  });

  return groups;
}

/**
 * The same lines as plain text, for the chat: a heading, each group and its
 * rows, and the browser's own description of itself at the end — the one
 * line a reader may need that the display does not show.
 */
export function readoutText(title: string, groups: readonly ReadoutGroup[], userAgent: string): string {
  const lines: string[] = [`Momentum · ${title}`];
  for (const group of groups) {
    lines.push('', group.title);
    if (group.note) lines.push(`  ${group.note}`);
    for (const row of group.rows) lines.push(`  ${row.label}: ${row.value}`);
  }
  lines.push('', userAgent);
  // A no-break space is right on a screen and a nuisance in a pasted table.
  return lines.join('\n').replace(/\u00A0/g, ' ');
}
