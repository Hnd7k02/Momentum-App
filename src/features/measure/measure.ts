/**
 * The measuring display of the 3D body: what it records (block 7B, D181).
 *
 * Every statement about "smooth" and "fast" in this app is to be measured,
 * on the owner's phone, and there is no other way to those numbers than a
 * display in the app itself. This file is that display's memory: when
 * Muskelgruppen was opened, when the viewer's code, the model and the first
 * picture were there, how long each frame of a rotation took, whether a
 * frame is drawn while nothing moves, and what the renderer says it draws.
 *
 * **It falsifies nothing.** It never asks for a frame and never keeps the
 * loop awake: the viewer tells it about frames that happen anyway, and it
 * tells its readers that something changed at three moments only — the
 * first picture, the end of a motion, and once, a second after that, for
 * the count of idle frames. While the body turns it writes numbers into
 * arrays it already owns. Switched off — every device's state until its
 * owner switches it on — nothing here runs but one boolean test per frame.
 *
 * **It is not data.** The switch lives in the browser's local storage,
 * apart from the database: no field in the schema, nothing in a backup. It
 * is the first and only use of local storage in the app. Where nothing can
 * be stored there, the display stays off.
 */

/* ── The switch ───────────────────────────────────────────────────────── */

/**
 * One key per place the app is served from: the preview build shares its
 * origin with the live app, and switching the one on must not switch the
 * other.
 */
const STORAGE_KEY = `momentum.bodyMeasure:${import.meta.env.BASE_URL}`;

let measuring: boolean | null = null;
const settingListeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // A browser that blocks storage throws on the property itself.
    return null;
  }
}

function readSetting(): boolean {
  try {
    return storage()?.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Whether the display is switched on. Off wherever nothing was stored. */
export function isMeasuring(): boolean {
  if (measuring === null) measuring = readSetting();
  return measuring;
}

/**
 * Switches the display on or off and returns what now holds — which is
 * `false` after an attempt to switch it on where nothing can be stored: a
 * display that would be gone after the reload it exists for stays off.
 */
export function setMeasuring(on: boolean): boolean {
  try {
    const store = storage();
    if (!store) throw new Error('no storage');
    if (on) store.setItem(STORAGE_KEY, '1');
    else store.removeItem(STORAGE_KEY);
    measuring = store.getItem(STORAGE_KEY) === '1';
  } catch {
    measuring = false;
  }
  for (const listener of settingListeners) listener();
  return measuring;
}

export function subscribeMeasuring(listener: () => void): () => void {
  settingListeners.add(listener);
  return () => settingListeners.delete(listener);
}

/* ── What is recorded ─────────────────────────────────────────────────── */

/**
 * Where a file came from. `memory` is a file this visit did not fetch at
 * all: the code was already evaluated, the model already parsed.
 */
export type LoadSource = 'network' | 'cache' | 'memory' | 'unknown';

export interface ResourceFacts {
  source: LoadSource;
  /** Bytes over the wire for `network`, the stored size for `cache`. */
  bytes: number | null;
  /** Whether the app's own offline store answered. `null` where the browser does not say. */
  viaWorker: boolean | null;
  /** How long the request itself took, in milliseconds; the rest of a leg is the work on what arrived. */
  fetchMs?: number | null;
}

export const NO_RESOURCE: ResourceFacts = { source: 'unknown', bytes: null, viaWorker: null };

/**
 * A file's source, from the browser's own record of the request.
 *
 * `transferSize` is the bytes that crossed the network: zero for an answer
 * out of a cache, the browser's or the app's offline store. A browser that
 * does not report the field leaves the source unknown; it is never guessed
 * from how long the request took.
 */
export function resourceFacts(
  entry:
    | (Pick<PerformanceResourceTiming, 'transferSize' | 'encodedBodySize' | 'decodedBodySize' | 'workerStart'> & { duration?: number })
    | null
    | undefined,
): ResourceFacts {
  // A request was made and the browser kept no record of it: the source is
  // not known. (A file that was not requested at all is `FROM_MEMORY`.)
  if (!entry) return NO_RESOURCE;
  const viaWorker = typeof entry.workerStart === 'number' ? entry.workerStart > 0 : null;
  const fetchMs = typeof entry.duration === 'number' ? entry.duration : null;
  if (typeof entry.transferSize !== 'number') return { source: 'unknown', bytes: null, viaWorker, fetchMs };
  const stored = entry.encodedBodySize || entry.decodedBodySize || null;
  if (entry.transferSize > 0) return { source: 'network', bytes: entry.transferSize, viaWorker, fetchMs };
  return { source: 'cache', bytes: stored, viaWorker, fetchMs };
}

/** The latest request for a file whose address matches `file`, begun at or after `since`. */
export function resourceSince(file: RegExp, since: number): PerformanceResourceTiming | null {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') return null;
  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  let found: PerformanceResourceTiming | null = null;
  for (const entry of entries) {
    // A little slack: the request can begin a moment before the mark it belongs to.
    if (file.test(entry.name) && entry.startTime >= since - 50) found = entry;
  }
  return found;
}

/** What the renderer says about the picture it draws. */
export interface RendererFacts {
  calls: number;
  triangles: number;
  /** Textures the renderer holds. */
  textures: number;
  /** The textures the scene uses, as "768 × 1024". */
  textureSizes: readonly string[];
  /** The pixel ratio the canvas draws with, and the one the screen reports. */
  pixelRatio: number;
  screenPixelRatio: number;
  /** The drawing buffer, in pixels. */
  bufferWidth: number;
  bufferHeight: number;
  /** The stage, in CSS pixels. */
  stageWidth: number;
  stageHeight: number;
  /** The graphics chip as the browser names it, where it does. */
  gpu: string | null;
}

/** Why there is no 3D body to measure. */
export type MeasureFailure = 'unsupported' | 'loadFailed' | 'contextLost';

export interface MeasureSnapshot {
  load: {
    /** Milliseconds from opening Muskelgruppen to each moment; `null` until it is reached. */
    code: number | null;
    model: number | null;
    firstFrame: number | null;
    codeSource: ResourceFacts;
    modelSource: ResourceFacts;
  };
  rotation: {
    /** Frame intervals measured while the body turned. */
    frames: number;
    meanFps: number | null;
    /** The share of those intervals under `FAST_FRAME_MS`, 0–1. */
    fastShare: number | null;
    longestMs: number | null;
  };
  /** Frames in the last second, once the body has rested for one; `null` before. */
  idleFrames: number | null;
  /** The display's rate as the frames show it, in frames per second. */
  displayHz: number | null;
  renderer: RendererFacts | null;
  failure: MeasureFailure | null;
}

/** A frame under this is a fast one (the review's target: 95 % of them). */
export const FAST_FRAME_MS = 25;
/** The body is idle once nothing has moved for this long. */
export const IDLE_AFTER_MS = 1000;
/**
 * A frame a finger asked for follows the one before it only if the finger
 * kept moving: a finger that rests on the body asks for nothing, and the
 * gap until it moves again is a pause, not a slow frame. It kept moving if
 * no more than this lies between two of its events, or between the end of
 * a frame and the next event.
 */
const CONTINUOUS_FINGER_MS = 50;

/**
 * When the finger made the events behind one request: the first and the
 * last, by the events' own times.
 */
export interface FingerSpan {
  first: number;
  last: number;
}

/**
 * The span of one pointer event. A browser that is busy drawing hands
 * several finger events over as one, right before its next frame — and
 * says, where it supports it, when each of them was made. That is what
 * tells a slow frame from a pausing finger: during a slow frame the finger
 * went on making events, during a pause it made none.
 */
export function fingerSpan(event: { timeStamp: number; getCoalescedEvents?: () => readonly { timeStamp: number }[] }): FingerSpan {
  let first = event.timeStamp;
  try {
    const made = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
    const earliest = made[0]?.timeStamp;
    if (typeof earliest === 'number' && earliest < first) first = earliest;
  } catch {
    /* a browser that will not say: the event's own time is all there is */
  }
  return { first, last: event.timeStamp };
}

const RECENT_FRAMES = 512;
const INTERVALS = 2048;

/**
 * The recorder. Every method takes the time, so the arithmetic is tested
 * without a clock; the viewer passes `performance.now()`.
 */
export class BodyMeasure {
  private openedAt: number | null = null;
  private codeAt: number | null = null;
  private modelAt: number | null = null;
  private firstFrameAt: number | null = null;
  private codeSource: ResourceFacts = NO_RESOURCE;
  private modelSource: ResourceFacts = NO_RESOURCE;

  private lastFrameAt: number | null = null;
  /** When the last frame had been drawn: its end, where `lastFrameAt` is its beginning. */
  private lastDrawnAt: number | null = null;
  private lastRotating = false;
  /** The last frame asked for the next one itself: a coast, a travel, a colour on its way. */
  private nextSelfDriven = false;
  /** When the finger last made an event, by the event's own time. */
  private lastFingerAt: number | null = null;
  /** A finger asked for a frame since the last one. */
  private fingerMoved = false;
  /** … and had paused before it did. */
  private fingerPaused = false;
  private lastActiveAt: number | null = null;

  private readonly recent = new Float64Array(RECENT_FRAMES);
  private recentCount = 0;
  private readonly intervals = new Float32Array(INTERVALS);
  private intervalCount = 0;

  private rotationFrames = 0;
  private rotationSum = 0;
  private rotationFast = 0;
  private rotationLongest = 0;

  private renderer: RendererFacts | null = null;
  private failure: MeasureFailure | null = null;

  private readonly listeners = new Set<() => void>();
  private version = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  /** Muskelgruppen was opened: a new visit, and everything counts from here. */
  opened(now: number): void {
    this.openedAt = now;
    this.codeAt = this.modelAt = this.firstFrameAt = null;
    this.codeSource = this.modelSource = NO_RESOURCE;
    this.lastFrameAt = this.lastDrawnAt = this.lastActiveAt = this.lastFingerAt = null;
    this.lastRotating = this.nextSelfDriven = this.fingerMoved = this.fingerPaused = false;
    this.recentCount = this.intervalCount = 0;
    this.rotationFrames = this.rotationSum = this.rotationFast = this.rotationLongest = 0;
    this.renderer = null;
    this.failure = null;
    this.emit();
  }

  /** When the visit began, for a caller that looks up what was fetched since. */
  get since(): number | null {
    return this.openedAt;
  }

  codeReady(now: number, source: ResourceFacts): void {
    if (this.codeAt !== null) return;
    this.codeAt = now;
    this.codeSource = source;
  }

  modelReady(now: number, source: ResourceFacts): void {
    if (this.modelAt !== null) return;
    this.modelAt = now;
    this.modelSource = source;
  }

  /** The first picture with the model in it has been drawn. */
  firstFrame(now: number): void {
    if (this.firstFrameAt !== null) return;
    this.firstFrameAt = now;
    this.emit();
  }

  /**
   * A frame was asked for from outside a frame: a finger moved. `finger` is
   * when it made the events behind this request; without it the request's
   * own time stands for them.
   *
   * The frame this asks for follows the one before it — and the time
   * between the two is a frame's time — if the finger had not paused. Two
   * signs say so, and either is enough:
   *
   * - its events follow one another closely **by their own times**. A slow
   *   frame must not look like a finger that paused, or the slowest frames
   *   would be the ones left out: a browser that needs a tenth of a second
   *   for a frame hands the finger's events over a tenth of a second
   *   apart, but they were made every few milliseconds, and say so;
   * - or the request came soon after the last frame **had been drawn** —
   *   its end, not its beginning, for the same reason.
   */
  requested(now: number, finger: FingerSpan = { first: now, last: now }): void {
    this.lastActiveAt = now;
    const before = this.lastFingerAt;
    const drawn = this.lastDrawnAt ?? this.lastFrameAt;
    const followsFinger = before !== null && finger.first - before <= CONTINUOUS_FINGER_MS;
    const followsFrame = drawn !== null && now - drawn <= CONTINUOUS_FINGER_MS;
    if (!followsFinger && !followsFrame) this.fingerPaused = true;
    this.fingerMoved = true;
    this.lastFingerAt = before === null ? finger.last : Math.max(before, finger.last);
  }

  /** The frame that `rendered` announced has been drawn. */
  drawn(now: number): void {
    this.lastDrawnAt = now;
  }

  /**
   * A frame was drawn. `rotating`: the camera is being turned, by a finger
   * or by itself; `selfDriven`: this frame asked for the next one.
   */
  rendered(now: number, { rotating, selfDriven }: { rotating: boolean; selfDriven: boolean }): void {
    this.recent[this.recentCount % RECENT_FRAMES] = now;
    this.recentCount += 1;
    // This frame follows the last one if that one asked for it, or a finger
    // did that had not paused.
    const follows = this.nextSelfDriven || (this.fingerMoved && !this.fingerPaused);
    if (this.lastFrameAt !== null && follows) {
      const interval = now - this.lastFrameAt;
      this.intervals[this.intervalCount % INTERVALS] = interval;
      this.intervalCount += 1;
      if (rotating && this.lastRotating) {
        this.rotationFrames += 1;
        this.rotationSum += interval;
        if (interval < FAST_FRAME_MS) this.rotationFast += 1;
        if (interval > this.rotationLongest) this.rotationLongest = interval;
      }
    }
    this.lastFrameAt = now;
    this.lastDrawnAt = null;
    this.lastRotating = rotating;
    this.nextSelfDriven = selfDriven;
    this.fingerMoved = this.fingerPaused = false;
    if (rotating || selfDriven) this.lastActiveAt = now;
  }

  rendererFacts(facts: RendererFacts): void {
    this.renderer = facts;
  }

  failed(reason: MeasureFailure): void {
    this.failure = reason;
    this.emit();
  }

  /**
   * A motion has come to rest. The display is told now, and once more when
   * the body has rested for a second — a timer of the display's own, which
   * draws nothing on the canvas.
   */
  settled(now: number): void {
    this.lastActiveAt = now;
    this.emit();
    if (typeof setTimeout !== 'function') return;
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this.emit();
    }, IDLE_AFTER_MS + 100);
  }

  /** Stops the one timer the recorder may hold. */
  dispose(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Changes whenever a reader should look again. */
  getVersion = (): number => this.version;

  private emit(): void {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }

  snapshot(now: number): MeasureSnapshot {
    const since = (at: number | null) => (at === null || this.openedAt === null ? null : Math.max(0, at - this.openedAt));
    const rested = this.lastActiveAt === null ? (this.lastFrameAt === null ? null : now - this.lastFrameAt) : now - this.lastActiveAt;
    let idleFrames: number | null = null;
    if (this.firstFrameAt !== null && rested !== null && rested >= IDLE_AFTER_MS) {
      idleFrames = 0;
      const stored = Math.min(this.recentCount, RECENT_FRAMES);
      for (let index = 0; index < stored; index += 1) {
        if (this.recent[index]! > now - IDLE_AFTER_MS) idleFrames += 1;
      }
    }
    return {
      load: {
        code: since(this.codeAt),
        model: since(this.modelAt),
        firstFrame: since(this.firstFrameAt),
        codeSource: this.codeSource,
        modelSource: this.modelSource,
      },
      rotation: {
        frames: this.rotationFrames,
        meanFps: this.rotationFrames === 0 ? null : (1000 * this.rotationFrames) / this.rotationSum,
        fastShare: this.rotationFrames === 0 ? null : this.rotationFast / this.rotationFrames,
        longestMs: this.rotationFrames === 0 ? null : this.rotationLongest,
      },
      idleFrames,
      displayHz: this.displayHz(),
      renderer: this.renderer,
      failure: this.failure,
    };
  }

  /**
   * The display's rate as the frames show it: frames arrive a whole number
   * of refreshes apart, so the shortest regular interval is one refresh.
   * The lower quartile of the intervals is that interval as long as a
   * quarter of the frames came on time, and jitters less than the minimum.
   */
  private displayHz(): number | null {
    const stored = Math.min(this.intervalCount, INTERVALS);
    if (stored < 8) return null;
    const sorted = Array.from(this.intervals.subarray(0, stored)).sort((a, b) => a - b);
    const quartile = sorted[Math.floor(stored / 4)]!;
    return quartile > 0 ? 1000 / quartile : null;
  }
}

/** The one recorder the app's viewer writes to. */
export const bodyMeasure = new BodyMeasure();

/**
 * What a frame was drawn for, written by the parts of the viewer that know
 * and read once per frame by the one that reports it. `rotating`: the
 * camera is being turned, zoomed or moved, by a finger or by itself;
 * `coasting`: the camera asked for the next frame itself; `easing`: a
 * colour is still on its way and asked for the next frame.
 */
export interface FrameActivity {
  rotating: boolean;
  coasting: boolean;
  easing: boolean;
}

export const idleActivity = (): FrameActivity => ({ rotating: false, coasting: false, easing: false });

/** A file that was not fetched in this visit: it was there already. */
export const FROM_MEMORY: ResourceFacts = { source: 'memory', bytes: null, viaWorker: null };

/* ── Who is asking ────────────────────────────────────────────────────── */

export interface DeviceFacts {
  /** "iPhone", "iPad", "Mac", "Android", … — as far as the browser says. */
  device: string;
  /** "iOS 18.6", "Android 15", … or `null`. The browser may report a fixed number. */
  system: string | null;
  /** "Safari 18.6", "Chrome 131", … or `null` (a home-screen app names none). */
  browser: string | null;
}

/**
 * Device and system out of the user agent. It says "iPhone" and never which
 * one, and from iOS 26 on it reports a fixed system number; the display
 * prints it as the browser's word, with the whole string in the copy.
 */
export function deviceFacts(userAgent: string): DeviceFacts {
  const number = (text: string | undefined) => text?.replace(/_/g, '.') ?? null;
  const apple = /\((iPhone|iPad|iPod)[^)]*? OS (\d+(?:[_.]\d+)*)/.exec(userAgent);
  const android = /Android (\d+(?:\.\d+)*)/.exec(userAgent);
  const mac = /Mac OS X (\d+(?:[_.]\d+)*)/.exec(userAgent);
  const safari = /Version\/(\d+(?:\.\d+)*)[^)]*Safari/.exec(userAgent);
  const chrome = /(?:Chrome|CriOS)\/(\d+)/.exec(userAgent);
  const firefox = /(?:Firefox|FxiOS)\/(\d+)/.exec(userAgent);
  const browser = chrome ? `Chrome ${chrome[1]}` : firefox ? `Firefox ${firefox[1]}` : safari ? `Safari ${safari[1]}` : null;
  if (apple) return { device: apple[1]!, system: `iOS ${number(apple[2])}`, browser };
  if (android) return { device: 'Android', system: `Android ${android[1]}`, browser };
  if (mac) return { device: 'Mac', system: `macOS ${number(mac[1])}`, browser };
  const other = /\(([^;)]+)/.exec(userAgent);
  return { device: other?.[1]?.trim() || 'unknown', system: null, browser };
}
