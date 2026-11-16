import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../i18n';
import { BodyMeasure, type RendererFacts } from './measure';
import { readoutGroups, readoutText, type ReadoutEnvironment } from './readout';

/**
 * The measuring display as text (block 7B, D181): what the owner reads on
 * the phone and pastes into the chat. Held here: every value of step 1 is
 * there, each with its unit, and the three legs of the load add up.
 */

const IPHONE: ReadoutEnvironment = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  standalone: true,
  screen: { width: 393, height: 852, pixelRatio: 3 },
  viewport: { width: 393, height: 852 },
  build: 'index-AbCd1234',
};

const RENDERER: RendererFacts = {
  calls: 11,
  triangles: 50152,
  textures: 1,
  textureSizes: ['768\u00A0×\u00A01024'],
  pixelRatio: 2,
  screenPixelRatio: 3,
  bufferWidth: 786,
  bufferHeight: 938,
  stageWidth: 393,
  stageHeight: 469,
  gpu: 'Apple GPU',
};

/** A visit: loaded from the app's store, turned for a while, then at rest. */
function measured(): { measure: BodyMeasure; now: number } {
  const measure = new BodyMeasure();
  measure.opened(1000);
  measure.codeReady(1240, { source: 'cache', bytes: 861_410, viaWorker: true, fetchMs: 38.2 });
  measure.modelReady(1420, { source: 'network', bytes: 706_392, viaWorker: false, fetchMs: 121 });
  measure.firstFrame(1812);
  measure.rendererFacts(RENDERER);
  let now = 3000;
  for (let index = 0; index < 121; index += 1) {
    measure.rendered(now, { rotating: true, selfDriven: true });
    now += index === 60 ? 41 : 1000 / 60;
  }
  measure.rendered(now, { rotating: false, selfDriven: false });
  measure.settled(now);
  measure.dispose();
  return { measure, now: now + 2000 };
}

const de = { t: createTranslator('de'), language: 'de' as const };
const en = { t: createTranslator('en'), language: 'en' as const };
const valueOf = (groups: ReturnType<typeof readoutGroups>, label: string) =>
  groups.flatMap((group) => group.rows).find((row) => row.label === label)?.value;

describe('the measuring display, as lines', () => {
  it('shows every value of step 1, each with its unit', () => {
    const { measure, now } = measured();
    const groups = readoutGroups(measure.snapshot(now), IPHONE, de);
    expect(groups.map((group) => group.title)).toEqual(['Laden', 'Drehen', 'Leerlauf', 'Zeichnen', 'Gerät']);
    // Loading: the whole way, then code, model and first picture, and where from.
    expect(valueOf(groups, 'Bis zum ersten Bild')).toBe('812\u00A0ms');
    expect(valueOf(groups, 'Code')).toBe('240\u00A0ms · aus dem Speicher der App, 861\u00A0kB, Abruf 38\u00A0ms');
    expect(valueOf(groups, 'Modell')).toBe('180\u00A0ms · aus dem Netz, 706\u00A0kB, Abruf 121\u00A0ms');
    expect(valueOf(groups, 'Erstes Bild')).toBe('392\u00A0ms');
    // Turning: the mean rate, the share of fast frames, the longest frame.
    expect(valueOf(groups, 'Bilder pro Sekunde')).toMatch(/^\d+\.\d im Mittel$/);
    expect(valueOf(groups, 'Bilder unter 25\u00A0ms')).toBe('99.1\u00A0%');
    expect(valueOf(groups, 'Längstes Bild')).toBe('41\u00A0ms');
    expect(valueOf(groups, 'Gemessene Bilder')).toBe('120');
    // Idle: the frames of the last second.
    expect(valueOf(groups, 'Bilder in der letzten Sekunde')).toBe('0');
    // What the renderer draws.
    expect(valueOf(groups, 'Zeichenaufrufe')).toBe('11');
    expect(valueOf(groups, 'Dreiecke')).toBe("50'152");
    expect(valueOf(groups, 'Texturen')).toBe('1 · 768\u00A0×\u00A01024');
    expect(valueOf(groups, 'Pixeldichte')).toBe('2 von 3');
    expect(valueOf(groups, 'Zeichenfläche')).toBe('786\u00A0×\u00A0938 Pixel');
    expect(valueOf(groups, 'Grafikchip')).toBe('Apple GPU');
    // The display, the device and the visible area.
    expect(valueOf(groups, 'Bildrate des Bildschirms')).toBe('etwa 60 pro Sekunde, beobachtet');
    expect(valueOf(groups, 'Gerät')).toBe('iPhone · iOS 18.6 laut Browser · App vom Home-Bildschirm');
    expect(valueOf(groups, 'Bildschirm')).toBe('393\u00A0×\u00A0852 Punkte, Pixeldichte 3');
    expect(valueOf(groups, 'Sichtbarer Bereich')).toBe('393\u00A0×\u00A0852 Punkte');
    expect(valueOf(groups, 'Körperbühne')).toBe('393\u00A0×\u00A0469 Punkte, 55\u00A0% der Höhe');
    expect(valueOf(groups, 'Stand')).toBe('index-AbCd1234');
  });

  it('the three legs of the load add up to the whole', () => {
    const { measure, now } = measured();
    const { load } = measure.snapshot(now);
    expect(load.code! + (load.model! - load.code!) + (load.firstFrame! - load.model!)).toBe(load.firstFrame);
  });

  it('says what it is waiting for, instead of a number it does not have', () => {
    const measure = new BodyMeasure();
    measure.opened(0);
    const groups = readoutGroups(measure.snapshot(100), { ...IPHONE, standalone: false }, de);
    expect(valueOf(groups, 'Bis zum ersten Bild')).toBe('läuft');
    expect(valueOf(groups, 'Code')).toBe('läuft');
    expect(valueOf(groups, 'Bilder pro Sekunde')).toBe('noch nicht gedreht');
    expect(valueOf(groups, 'Bilder in der letzten Sekunde')).toBe('wartet auf eine Sekunde Ruhe');
    expect(valueOf(groups, 'Zeichenaufrufe')).toBe('noch kein Bild');
    expect(valueOf(groups, 'Bildrate des Bildschirms')).toBe('noch nicht beobachtet');
    expect(valueOf(groups, 'Gerät')).toBe('iPhone · iOS 18.6 laut Browser · im Browser');
    expect(valueOf(groups, 'Körperbühne')).toBeUndefined();
  });

  it('a second visit says that code and model were there already', () => {
    const measure = new BodyMeasure();
    measure.opened(0);
    measure.codeReady(2, { source: 'memory', bytes: null, viaWorker: null });
    measure.modelReady(30, { source: 'memory', bytes: null, viaWorker: null });
    const groups = readoutGroups(measure.snapshot(100), IPHONE, de);
    expect(valueOf(groups, 'Code')).toBe('2\u00A0ms · schon geladen');
    expect(valueOf(groups, 'Modell')).toBe('28\u00A0ms · schon geladen');
  });

  it('says why there is no 3D body to measure', () => {
    const measure = new BodyMeasure();
    measure.opened(0);
    measure.failed('unsupported');
    const groups = readoutGroups(measure.snapshot(100), IPHONE, de);
    expect(groups[0]?.note).toBe('Kein 3D auf diesem Gerät. Es steht die flache Figur.');
  });

  it('reads the same in English', () => {
    const { measure, now } = measured();
    const groups = readoutGroups(measure.snapshot(now), IPHONE, en);
    expect(groups.map((group) => group.title)).toEqual(['Loading', 'Turning', 'Idle', 'Drawing', 'Device']);
    expect(valueOf(groups, 'Until the first frame')).toBe('812\u00A0ms');
    expect(valueOf(groups, 'Triangles')).toBe('50,152');
    expect(valueOf(groups, 'Device')).toBe('iPhone · iOS 18.6 according to the browser · app from the home screen');
  });
});

describe('the copied text', () => {
  it('is the same lines, with plain spaces, and ends with the browser\'s own description', () => {
    const { measure, now } = measured();
    const groups = readoutGroups(measure.snapshot(now), IPHONE, de);
    const text = readoutText('Messanzeige', groups, IPHONE.userAgent);
    const lines = text.split('\n');
    expect(lines[0]).toBe('Momentum · Messanzeige');
    expect(lines).toContain('Laden');
    expect(lines).toContain('  Bis zum ersten Bild: 812 ms');
    expect(lines).toContain('  Bilder unter 25 ms: 99.1 %');
    expect(lines).toContain('  Körperbühne: 393 × 469 Punkte, 55 % der Höhe');
    expect(lines[lines.length - 1]).toBe(IPHONE.userAgent);
    expect(text).not.toMatch(/\u00A0/);
    // Every row of the display is a line of the text.
    for (const row of groups.flatMap((group) => group.rows)) {
      expect(text).toContain(`${row.label}: ${row.value}`.replace(/\u00A0/g, ' '));
    }
  });
});
