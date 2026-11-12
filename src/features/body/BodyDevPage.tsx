import { Suspense, useState } from 'react';
import { I18nProvider } from '../../i18n/I18nProvider';
import { signedPercentText } from '../../i18n/typography';
import type { Language } from '../../i18n';
import { MUSCLE_GROUPS, type MuscleGroup } from '../../core/model';
import { BodyViewer, type BodyView, type MuscleVisual } from './index';
// The size of the stage in Muskelgruppen, for `?world=`: the body is judged in the box the app gives it.
import '../gym/muscleModule.css';
import { BODY_LOOK, IDENTITY_COLOR, IDENTITY_UNTRAINED_ALPHA, STATE_COLOR, mutedIdentity, stateIntensity, type BodyLook, type MuscleState } from './tokens';

/**
 * The isolation harness for the 3D body — development only.
 *
 * Reached at `#/dev/body` on the dev server and nowhere else: `main.tsx`
 * mounts this instead of the app only when `import.meta.env.DEV` holds, so
 * the production bundle carries neither the route nor this file. It reads
 * and writes no Momentum data; every state below is a fixture chosen to show
 * one of the five states on each region, the way demo.js does for the
 * standalone package. It exists so the viewer can be reviewed and driven by
 * `scripts/verify/body.mjs` without the Gym screen — it is not a design.
 */

type Fixture = { state: MuscleState; delta: number };

/** Every state at least once, and two magnitudes of improvement. */
const MIXED: Record<MuscleGroup, Fixture> = {
  chest: { state: 'improved', delta: 12 },
  back: { state: 'improved', delta: 3 },
  shoulders: { state: 'unchanged', delta: 0 },
  biceps: { state: 'declined', delta: -6 },
  triceps: { state: 'awaitingBaseline', delta: 0 },
  core: { state: 'improved', delta: 7 },
  quadriceps: { state: 'declined', delta: -3 },
  hamstringsGlutes: { state: 'unchanged', delta: 0 },
  calves: { state: 'noData', delta: 0 },
  forearms: { state: 'noData', delta: 0 },
};

const all = (fixture: Fixture): Record<MuscleGroup, Fixture> =>
  Object.fromEntries(MUSCLE_GROUPS.map((id) => [id, fixture])) as Record<MuscleGroup, Fixture>;

/**
 * `?fixture=` picks the bodies the colour rules are judged on (contract §7,
 * §8): nothing trained, everything held, and the smallest improvement and
 * decline beside held groups.
 */
const FIXTURES: Record<string, Record<MuscleGroup, Fixture>> = {
  mixed: MIXED,
  empty: all({ state: 'noData', delta: 0 }),
  held: all({ state: 'unchanged', delta: 1 }),
  edge: {
    ...all({ state: 'unchanged', delta: 0 }),
    chest: { state: 'improved', delta: 2.5 },
    back: { state: 'improved', delta: 2.5 },
    quadriceps: { state: 'declined', delta: -2.5 },
    hamstringsGlutes: { state: 'declined', delta: -2.5 },
  },
  // The weakest tint beside the strongest, once in green and once in red
  // (block 7A, the fifth picture): chest and thighs at ±3 %, trunk and
  // shoulders at ±12 %, the arms held.
  greens: {
    ...all({ state: 'unchanged', delta: 0 }),
    chest: { state: 'improved', delta: 2.5 },
    quadriceps: { state: 'improved', delta: 2.5 },
    core: { state: 'improved', delta: 12 },
    shoulders: { state: 'improved', delta: 12 },
  },
  reds: {
    ...all({ state: 'unchanged', delta: 0 }),
    chest: { state: 'declined', delta: -2.5 },
    quadriceps: { state: 'declined', delta: -2.5 },
    core: { state: 'declined', delta: -12 },
    shoulders: { state: 'declined', delta: -12 },
  },
};

function visualsOf(fixture: Record<MuscleGroup, Fixture>): Partial<Record<MuscleGroup, MuscleVisual>> {
  const out: Partial<Record<MuscleGroup, MuscleVisual>> = {};
  for (const id of MUSCLE_GROUPS) {
    const { state, delta } = fixture[id];
    out[id] = {
      tint: STATE_COLOR[state].model,
      ground: STATE_COLOR[state].ground,
      intensity: stateIntensity(state, delta),
    };
  }
  return out;
}

/**
 * `?lang=en` and `?model=missing` drive the two cases a fixture cannot.
 * `?model=<path>` loads another file the dev server can reach — a build of
 * the body pipeline, `tools/body/out/<name>.glb` — which is a path that
 * exists here and nowhere in the app. `?world=gym|light` shows the body on
 * the stage of that world, sized as the card in Muskelgruppen sizes it, and
 * `?key=<number>` tries another strength of the key light on the app's look.
 */
const params = new URLSearchParams(window.location.search);
const FIXTURE = FIXTURES[params.get('fixture') ?? 'mixed'] ?? MIXED;
const LANG: Language = params.get('lang') === 'en' ? 'en' : 'de';
const MODEL = params.get('model');
const MODEL_URL =
  MODEL === 'missing' ? `${import.meta.env.BASE_URL}models/does-not-exist.glb`
  : MODEL ? `${import.meta.env.BASE_URL}${MODEL}`
  : undefined;
const KEY = Number(params.get('key'));
const LOOK: BodyLook = params.get('key') && Number.isFinite(KEY)
  ? { ...BODY_LOOK, key: { ...BODY_LOOK.key, intensity: KEY } }
  : BODY_LOOK;
/** The stage of each world: `--surface-base` around `--surface-secondary`. */
const WORLDS = {
  gym: { page: '#0f0f14', stage: '#232330', ink: '#f2f2f7' },
  light: { page: '#f4f4f8', stage: '#f1f1f5', ink: '#16161d' },
} as const;
const WORLD = WORLDS[params.get('world') as keyof typeof WORLDS] ?? null;
if (params.get('world') === 'gym') document.documentElement.dataset.world = 'gym';

export function BodyDevPage() {
  const [selected, setSelected] = useState<MuscleGroup | null>(null);
  const [mounted, setMounted] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [tinted, setTinted] = useState(true);
  const [view, setView] = useState<BodyView>('front');
  const [angle, setAngle] = useState(0);
  const visuals = visualsOf(FIXTURE);

  return (
    <I18nProvider language={LANG} setLanguage={() => undefined}>
      {/* A white page, not the app's ground (WP3 Stage 6): the host clips the
          canvas with rounded corners, and `body.mjs` holds the canvas's top
          and bottom bands at zero non-white pixels — the ground's lilac wash
          showing through a corner would count as the body touching the frame. */}
      <main style={{ maxWidth: 430, margin: '0 auto', padding: 16, fontFamily: 'system-ui', background: WORLD?.page ?? '#fff', color: WORLD?.ink, minHeight: '100%' }}>
        <h1 style={{ fontSize: 17 }}>Body viewer — dev harness</h1>
        <p data-readout style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          <span data-angle>{angle}</span>° · <span data-view-readout>{view}</span> ·{' '}
          <span data-selected-readout>{selected ?? '–'}</span>
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button type="button" data-action="toggle-mount" onClick={() => setMounted((m) => !m)}>
            {mounted ? 'unmount' : 'mount'}
          </button>
          <button type="button" data-action="remount" onClick={() => setGeneration((g) => g + 1)}>
            remount
          </button>
          <button type="button" data-action="toggle-tint" onClick={() => setTinted((v) => !v)}>
            tint {tinted ? 'off' : 'on'}
          </button>
          <button type="button" data-action="clear" onClick={() => setSelected(null)}>
            clear selection
          </button>
        </div>

        <div
          data-host
          className={WORLD ? 'muscle-module' : undefined}
          style={{ background: WORLD?.stage ?? '#fff', borderRadius: WORLD ? 14 : 20, overflow: 'hidden' }}
        >
          {mounted ? (
            <Suspense fallback={<div data-loading style={{ aspectRatio: '1 / 0.97' }} />}>
              <BodyViewer
                key={generation}
                modelUrl={MODEL_URL}
                visuals={visuals}
                selectedMuscle={selected}
                onSelectMuscle={setSelected}
                tinted={tinted}
                onViewChange={setView}
                onRotate={setAngle}
                fallback={<p data-fallback>WebGL not available</p>}
                look={LOOK}
              />
            </Suspense>
          ) : null}
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
          {MUSCLE_GROUPS.map((id) => {
            const { state, delta } = FIXTURE[id];
            return (
              <li key={id}>
                <button
                  type="button"
                  data-muscle={id}
                  aria-pressed={selected === id}
                  onClick={() => setSelected(id)}
                  style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', padding: '8px 0', background: 'none', border: 0, font: 'inherit', textAlign: 'left' }}
                >
                  <span
                    aria-hidden="true"
                    style={{ width: 12, height: 12, borderRadius: 3, background: mutedIdentity(IDENTITY_COLOR[id], state === 'noData' ? IDENTITY_UNTRAINED_ALPHA : 1) }}
                  />
                  <span style={{ flex: 1 }}>{id}</span>
                  <span style={{ color: STATE_COLOR[state].ink }}>{delta === 0 ? STATE_COLOR[state].text : signedPercentText(delta)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </main>
    </I18nProvider>
  );
}
