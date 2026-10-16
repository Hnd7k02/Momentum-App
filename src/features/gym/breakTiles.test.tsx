// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DecayPending } from '../../core/scoring/trainingRating';
import { de } from '../../i18n/de';
import { I18nProvider } from '../../i18n/I18nProvider';
import type { GymRatingState } from '../../storage/services/gymRatingService';
import type { RunningRatingState } from '../../storage/services/runningRatingService';
import { mount, type Mounted } from '../../test/dom';
import { RunningOverview } from '../running/RunningOverview';
import { GymOverview } from './GymOverview';

/**
 * The Gym and Laufen break tiles while a charge waits (WP3, P8 — D135).
 *
 * The tile states the run, what has been charged, and whether more waits for
 * a day that can still take a session — naming that day, because only a
 * session for that day prevents it. It stays while a charge waits even once
 * a session today has ended the run.
 */

let mounted: Mounted | null = null;
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

/** The fields the boards read; the rest of a rating state does not matter here. */
function rating(over: {
  abstinence: number | null;
  decayFraction: number;
  decayPending?: DecayPending;
}) {
  return {
    rating: 640,
    peak: 700,
    maintenance: false,
    endurance: { progress: 4, required: 4, unlocked: true },
    sessionsThisWeek: 0,
    weeklyTarget: 3,
    ytd: null,
    ytdChange: null,
    performance: { score: null, components: [] },
    attendanceOnlyRuns: 0,
    abstinence:
      over.abstinence === null ? null : { from: '2026-10-08', through: '2026-10-14', days: over.abstinence },
    decayFraction: over.decayFraction,
    ...(over.decayPending ? { decayPending: over.decayPending } : {}),
  };
}

async function board(domain: 'gym' | 'running', state: ReturnType<typeof rating>) {
  mounted = await mount(
    <I18nProvider language="de" setLanguage={() => undefined}>
      {domain === 'gym' ? (
        <GymOverview state={state as unknown as GymRatingState} started />
      ) : (
        <RunningOverview state={state as unknown as RunningRatingState} started />
      )}
    </I18nProvider>,
  );
}

const tile = (domain: 'gym' | 'running') =>
  document.querySelector(`[data-metric="${domain}-decay"]`)?.textContent ?? null;

async function openSheet(domain: 'gym' | 'running'): Promise<string> {
  await act(async () => document.querySelector<HTMLButtonElement>(`[data-metric="${domain}-decay"] .metric-tile__open`)!.click());
  return document.querySelector('.sheet')?.textContent ?? '';
}

describe('the break tiles while a charge waits (D135)', () => {
  for (const domain of ['gym', 'running'] as const) {
    const days = domain === 'gym' ? de['gym.decay.days'] : de['running.decay.days'];
    const key = (name: string) => de[`${domain}.decay.${name}` as keyof typeof de];

    it(`${domain}: day seven today, nothing charged yet`, async () => {
      await board(domain, rating({ abstinence: 7, decayFraction: 0, decayPending: { day: 'today', days: 7 } }));
      expect(tile(domain)).toContain(days.replace('{days}', '7'));
      expect(tile(domain)).toContain(key('pendingToday'));
      expect(await openSheet(domain)).toContain(key('pendingExplain'));
    });

    it(`${domain}: a session today, and yesterday's charge still waits`, async () => {
      await board(domain, rating({ abstinence: null, decayFraction: 0, decayPending: { day: 'yesterday', days: 7 } }));
      // The run is over: it says until when, and not that a session would end it.
      expect(tile(domain)).toContain(key('daysEnded').replace('{days}', '7'));
      expect(tile(domain)).toContain(key('pendingYesterday'));
      const sheet = await openSheet(domain);
      expect(sheet).toContain(key('pendingExplain'));
      expect(sheet).not.toContain(key('resume'));
    });

    it(`${domain}: a block charged and the next one waiting`, async () => {
      await board(domain, rating({ abstinence: 14, decayFraction: 0.25, decayPending: { day: 'today', days: 14 } }));
      expect(tile(domain)).toContain(key('lostPending').replace('{percent}', '25'));
      expect(await openSheet(domain)).toContain(key('pendingExplain'));
    });

    it(`${domain}: charged, with nothing waiting`, async () => {
      await board(domain, rating({ abstinence: 9, decayFraction: 0.5 }));
      expect(tile(domain)).toContain(key('lost').replace('{percent}', '50'));
      expect(tile(domain)).not.toContain('ausstehend');
      expect(await openSheet(domain)).not.toContain(key('pendingExplain'));
    });

    it(`${domain}: no tile without a break or a waiting charge`, async () => {
      await board(domain, rating({ abstinence: null, decayFraction: 0 }));
      expect(tile(domain)).toBeNull();
    });
  }
});
