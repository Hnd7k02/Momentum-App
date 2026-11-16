import { useState, useSyncExternalStore } from 'react';
import { useI18n, useT } from '../../i18n/I18nProvider';
import { bodyMeasure, isMeasuring, subscribeMeasuring } from './measure';
import { readoutGroups, readoutText, type ReadoutEnvironment } from './readout';
import './measure.css';

/**
 * The measuring display under the body (block 7B, D181).
 *
 * Off until its user switches it on in the settings; then it stands under
 * the stage and says how long the body took to load, how evenly it turns,
 * whether it draws while nothing moves and what it draws with. It is a
 * tool, not part of the interface: its words may be technical.
 *
 * **It draws nothing on the canvas and asks for no frame.** It reads the
 * recorder when the recorder says something changed — at the first picture,
 * when a motion ends, and once a second later — and on the tap that copies
 * the values, never while the body turns. It stands beside the canvas, not
 * over it, and is a solid surface: nothing here blurs.
 */

/** Whether the display is switched on, as React state. */
export function useMeasuring(): boolean {
  return useSyncExternalStore(subscribeMeasuring, isMeasuring, () => false);
}

function environment(): ReadoutEnvironment {
  const standalone =
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // The entry file's name carries the build's hash: "index-XFfGMUaP".
  const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src ?? '';
  const build = /([^/]+?)\.js(?:\?.*)?$/.exec(entry)?.[1] ?? null;
  return {
    userAgent: navigator.userAgent,
    standalone,
    screen: { width: window.screen.width, height: window.screen.height, pixelRatio: window.devicePixelRatio },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    build,
  };
}

/** Puts text on the clipboard; `false` where the browser will not. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older WebKit, or a context without the clipboard API.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.className = 'body-readout__clipboard';
    document.body.appendChild(area);
    area.select();
    const done = document.execCommand('copy');
    area.remove();
    return done;
  } catch {
    return false;
  }
}

export function BodyReadout() {
  return useMeasuring() ? <ReadoutPanel /> : null;
}

function ReadoutPanel() {
  const t = useT();
  const { language } = useI18n();
  // Re-rendered when the recorder says so, and by the copy button's own state.
  const version = useSyncExternalStore(bodyMeasure.subscribe, bodyMeasure.getVersion, bodyMeasure.getVersion);
  // "Kopiert" holds for the values that were copied: new values, new offer.
  const [copy, setCopy] = useState<{ result: 'done' | 'failed'; version: number } | null>(null);
  const copied = copy !== null && copy.version === version ? copy.result : null;

  const read = () => {
    const surroundings = environment();
    const groups = readoutGroups(bodyMeasure.snapshot(performance.now()), surroundings, { t, language });
    return { groups, text: readoutText(t('measure.title'), groups, surroundings.userAgent) };
  };
  const { groups } = read();

  return (
    <section className="body-readout" aria-label={t('measure.title')} data-readout>
      <div className="body-readout__head">
        <h2 className="body-readout__title">{t('measure.title')}</h2>
        <button
          type="button"
          className="button button--quiet body-readout__copy"
          onClick={() => {
            // Read at the tap, so the idle count is the last second before it.
            void copyText(read().text).then((done) => setCopy({ result: done ? 'done' : 'failed', version }));
          }}
        >
          {copied === 'done' ? t('measure.copied') : t('measure.copy')}
        </button>
      </div>
      {copied === 'failed' ? (
        <p className="body-readout__note" role="status">
          {t('measure.copyFailed')}
        </p>
      ) : null}
      {groups.map((group) => (
        <div key={group.title} className="body-readout__group">
          <h3 className="body-readout__groupTitle">{group.title}</h3>
          {group.note ? <p className="body-readout__note">{group.note}</p> : null}
          <dl className="body-readout__rows">
            {group.rows.map((row) => (
              <div key={row.label} className="body-readout__row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}
