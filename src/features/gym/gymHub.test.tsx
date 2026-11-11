import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../../i18n/I18nProvider';
import { de } from '../../i18n/de';
import { MUSCLE_GROUPS } from '../../core/model';
import { today } from '../../core/clock';
import { addDays } from '../../core/dates';
import { exerciseDays, gymPerformance, gymPerformanceOverSpan, latestComparisons } from '../../core/gym/performance';
import type { GymHistory } from '../../storage/services/gymService';
import { MuscleEntryCard } from './MuscleEntryCard';
import { weekSentence } from './TrainingCard';

/**
 * The Gym hub's door to the muscle groups (WP2-2): what it says before the
 * first workout, what it says after, and what it never loads.
 */

const render = (history: GymHistory | null, latestSession: string | null = null, failed = false) =>
  renderToStaticMarkup(
    <I18nProvider language="de" setLanguage={() => undefined}>
      <MuscleEntryCard
        history={history}
        rangeDays={30}
        latestSession={latestSession}
        failed={failed}
        onOpen={() => undefined}
      />
    </I18nProvider>,
  );

const emptyHistory = (): GymHistory => {
  const days = exerciseDays([]);
  return {
    days,
    comparisons: latestComparisons(days),
    recent: gymPerformance(days),
    overall: gymPerformanceOverSpan(days),
    names: new Map(),
    awaitingBodyweight: [],
  };
};

describe('the muscle entry card before the first workout', () => {
  it('is one named button that says there is no data, and colours nothing as progress', () => {
    const html = render(emptyHistory());
    expect(html).toMatch(/<button[^>]*aria-label="Muskelgruppen öffnen"/);
    // The card names itself once: no grey section label repeating it.
    expect(html).not.toContain('section__label');
    expect(html.match(/>Muskelgruppen</g)?.length ?? 0).toBe(1);
    expect(html).toContain(de['gymHub.muscles.none']);
    expect(html).toContain(de['gymHub.muscles.noneHint']);
    // The preview is a picture, hidden from assistive technology: a still
    // of the approved body, never the SVG diagram and never the viewer.
    expect(html).toMatch(/<span class="gym-hub__preview" aria-hidden="true"><img class="gym-hub__previewBody" src="[^"]*body-preview[^"]*\.webp" alt=""/);
    expect(html).not.toContain('body-renderer');
    // Every group's marker is in its no-data state; no other state exists yet.
    expect(html.match(/gym-hub__previewState--noData/g)?.length ?? 0).toBe(MUSCLE_GROUPS.length);
    for (const state of ['improved', 'unchanged', 'declined', 'awaitingBaseline']) {
      expect(html, state).not.toContain(`gym-hub__previewState--${state}`);
    }
  });

  it('says nothing while it loads: loading is not "not trained yet"', () => {
    // Until STOP 6b the card answered a history that had not arrived with
    // the first-session text, for a frame or two — and for good when the
    // load failed.
    const html = render(null);
    expect(html).toMatch(/<button[^>]*aria-label="Muskelgruppen öffnen"/);
    expect(html.match(/>Muskelgruppen</g)?.length ?? 0).toBe(1);
    expect(html).not.toContain(de['gymHub.muscles.none']);
    expect(html).not.toContain(de['gymHub.muscles.noneHint']);
    // The lines hold their place, and nothing is coloured as progress.
    expect(html).toContain('<span class="gym-hub__musclesSummary">\u00A0</span>');
    expect(html.match(/gym-hub__previewState--noData/g)?.length ?? 0).toBe(MUSCLE_GROUPS.length);
  });

  it('says that the muscle groups could not be loaded when the load failed', () => {
    const html = render(null, null, true);
    expect(html).toContain(de['error.muscles.title']);
    expect(html).not.toContain(de['gymHub.muscles.none']);
    expect(html).not.toContain(de['gymHub.muscles.noneHint']);
  });

  it('does not say "not trained yet" to someone whose last session lies before the range', () => {
    // STOP 6b: a device with months of sessions, the last one six weeks ago,
    // read "Noch nicht trainiert — nach deiner ersten Session …" here while
    // the card above it named that very session.
    const sixWeeksAgo = addDays(today(), -42);
    const html = render(emptyHistory(), sixWeeksAgo);
    expect(html).toContain('Kein Training in den letzten 30 Tagen');
    expect(html).toContain('Letzte Session vor 42 Tagen');
    expect(html).not.toContain(de['gymHub.muscles.none']);
    expect(html).not.toContain(de['gymHub.muscles.noneHint']);
    // Still nothing coloured as progress.
    expect(html.match(/gym-hub__previewState--noData/g)?.length ?? 0).toBe(MUSCLE_GROUPS.length);
  });

  it('says that nothing can be scored yet when the range holds a session without a countable set', () => {
    const html = render(emptyHistory(), today());
    expect(html).toContain(de['gymHub.muscles.unscored']);
    expect(html).not.toContain(de['gymHub.muscles.noneHint']);
  });

  const squat = (date: string, weightGrams: number) => ({
    date, exerciseId: 'ex_squat', muscles: ['quadriceps' as const], primaryMuscles: ['quadriceps' as const],
    sets: [{ id: date, reps: 5, weightGrams, order: 0 }],
  });
  const historyOf = (inputs: Parameters<typeof exerciseDays>[0]): GymHistory => {
    const days = exerciseDays(inputs);
    return {
      days,
      comparisons: latestComparisons(days),
      recent: gymPerformance(days),
      overall: gymPerformanceOverSpan(days),
      names: new Map([['ex_squat', 'Back Squat']]),
      awaitingBodyweight: [],
    };
  };

  it('states the rated groups and the performance trend once a group has enough to compare', () => {
    const html = render(historyOf([squat('2026-03-02', 100000), squat('2026-03-05', 104000), squat('2026-03-09', 110000)]));
    expect(html).toContain('1 von 10 gewertet');
    expect(html).toContain('Leistungstrend +10\u00A0%');
    expect(html).toContain('gym-hub__musclesOverall--improved');
    expect(html).toContain('Letzte 30 Tage');
    expect(html).not.toContain(de['gymHub.muscles.none']);
    // The old word for the figure is gone (contract §13).
    expect(html).not.toContain('Gesamt');
    // One marker lit for the one rated group, the other nine grey.
    expect(html.match(/gym-hub__previewState--improved/g)?.length ?? 0).toBe(1);
    expect(html.match(/gym-hub__previewState--noData/g)?.length ?? 0).toBe(MUSCLE_GROUPS.length - 1);
  });

  it('counts a group as rated only when its row prints a figure (contract §7)', () => {
    // Two exercise days: the comparison exists, and it is too little.
    const html = render(historyOf([squat('2026-03-02', 100000), squat('2026-03-09', 110000)]));
    expect(html).not.toContain('gewertet');
    expect(html).not.toContain('Leistungstrend');
    expect(html).toContain('1 von 10 trainiert');
    expect(html.match(/gym-hub__previewState--awaitingBaseline/g)?.length ?? 0).toBe(1);
    expect(html.match(/gym-hub__previewState--improved/g)?.length ?? 0).toBe(0);
  });

  it('reads a trend inside the band as held, in the text colour', () => {
    const html = render(historyOf([squat('2026-03-02', 100000), squat('2026-03-05', 100000), squat('2026-03-09', 102000)]));
    expect(html).toContain('Leistungstrend Gehalten');
    expect(html).not.toContain('gym-hub__musclesOverall--');
    expect(html.match(/gym-hub__previewState--unchanged/g)?.length ?? 0).toBe(1);
  });
});

describe('the training card\'s week sentence', () => {
  const t = ((key: string, params: Record<string, string | number> = {}) =>
    Object.entries(params).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), (de as Record<string, string>)[key] ?? key)) as unknown as Parameters<typeof weekSentence>[0];

  it('is a fraction only while the target is ahead', () => {
    expect(weekSentence(t, 0, 3)).toBe('0 von 3 Sessions diese Woche');
    expect(weekSentence(t, 2, 3)).toBe('2 von 3 Sessions diese Woche');
    expect(weekSentence(t, 3, 3)).toBe('3 Sessions diese Woche ·\u00A0Ziel\u00A0erreicht');
    expect(weekSentence(t, 1, 1)).toBe('1 Session diese Woche ·\u00A0Ziel\u00A0erreicht');
    expect(weekSentence(t, 7, 3)).toBe('7 Sessions diese Woche ·\u00A0Ziel\u00A03');
  });
});

describe('the hub and the lazy boundary', () => {
  it('never imports the 3D viewer: only the muscle module reaches features/body', () => {
    const here = new URL('.', import.meta.url);
    const hubFiles = ['../areas/GymTerminal.tsx', './TrainingCard.tsx', './MuscleEntryCard.tsx', './useTrainingLauncher.tsx', './GymMusclesScreen.tsx'];
    for (const file of hubFiles) {
      const source = readFileSync(new URL(file, here), 'utf8');
      expect(source, file).not.toMatch(/from '\.\.\/body|from '\.\/BodyViewer|features\/body/);
    }
    // And the one file that does goes through the lazy index, never the viewer itself.
    const module = readFileSync(new URL('./MuscleModule.tsx', here), 'utf8');
    expect(module).toMatch(/from '\.\.\/body'/);
    expect(module).not.toMatch(/body\/BodyViewer/);
  });
});
