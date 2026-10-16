import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../../core/clock';
import { OFFERED_DOMAIN_TYPES, enabledDomainsIn, legacySportEnabledIn } from '../../core/domains';
import { suggestionsByCategory, PICKABLE_CATEGORIES } from '../../domains/mental/questionLibrary';
import { closeDatabase, deleteDatabase } from '../db';
import { currentConfigSnapshot } from '../configService';
import { domainsRepository, questionsRepository } from '../repositories';
import {
  addQuestion,
  applyOnboarding,
  loadConfiguration,
  updateQuestion,
} from './configurationService';
import { loadDay } from './checkInService';
import { loadHistory } from './historyService';

/**
 * What a new profile is, and what it is not.
 *
 * The rule this file exists for: **no path in the new product creates an
 * active generic `sports` domain.** It survives as a stored discriminator so
 * a device carrying RC2 history can replay it, and nowhere else.
 */

function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

const TODAY = '2026-03-02';

beforeEach(async () => {
  await deleteDatabase();
  freezeAt(TODAY);
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

describe('a newly created profile', () => {
  it('has Mind, Gym and Running to choose from, and nothing else (D139)', () => {
    expect(OFFERED_DOMAIN_TYPES).toEqual(['mental', 'gym', 'running']);
  });

  it('creates no generic Sport domain, whatever is chosen', async () => {
    await applyOnboarding({
      questions: [{ text: 'A', type: 'boolean', category: 'alltag' }],
      gymTargetPerWeek: 3,
      runningTargetPerWeek: 2,
    });
    expect(await domainsRepository.findByType('sports')).toBeUndefined();
    expect((await loadConfiguration()).legacySport).toBeNull();
  });

  it('writes no generic Sport domain into the config snapshot either', async () => {
    // The snapshot is what history is replayed against. A `sports` entry here
    // would mean the retired domain was scoring days for a brand-new user.
    await applyOnboarding({ questions: [], gymTargetPerWeek: 3, runningTargetPerWeek: 2 });
    const snapshot = await currentConfigSnapshot();
    expect(legacySportEnabledIn(snapshot)).toBe(false);
    expect(snapshot.domains.some((domain) => domain.type === 'sports')).toBe(false);
    expect(enabledDomainsIn(snapshot)).toEqual(['gym', 'running']);
  });

  it('shows no generic Sport card on Today', async () => {
    await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
    const day = await loadDay();
    expect(day.training.map((entry) => entry.domain)).toEqual(['gym']);
  });

  it('creates only what was actually chosen', async () => {
    await applyOnboarding({ questions: [], gymTargetPerWeek: 3 });
    const configuration = await loadConfiguration();
    expect(configuration.domains.gym?.enabled).toBe(true);
    // Not created at all, rather than created and switched off: a domain that
    // does not exist is excluded from scoring instead of scoring as zero.
    expect(configuration.domains.running).toBeNull();
    expect(configuration.domains.food).toBeNull();
  });

  it('gives Gym and Running the targets that were chosen for each', async () => {
    await applyOnboarding({ questions: [], gymTargetPerWeek: 4, runningTargetPerWeek: 2 });
    const day = await loadDay();
    expect(day.training.find((entry) => entry.domain === 'gym')?.progress.target).toBe(4);
    expect(day.training.find((entry) => entry.domain === 'running')?.progress.target).toBe(2);
  });
});

describe('the question library', () => {
  it('offers questions in every category a user picks from', () => {
    const groups = suggestionsByCategory('de');
    expect(groups.map((group) => group.category)).toEqual(PICKABLE_CATEGORIES);
    for (const group of groups) expect(group.questions.length).toBeGreaterThan(1);
  });

  it('never offers "Eigene" as a shelf, because nothing is on it', () => {
    expect(PICKABLE_CATEGORIES).not.toContain('eigene');
  });

  it('has the same questions in both languages, category for category', () => {
    const de = suggestionsByCategory('de');
    const en = suggestionsByCategory('en');
    expect(en.map((group) => group.questions.map((question) => question.id))).toEqual(
      de.map((group) => group.questions.map((question) => question.id)),
    );
    for (const [index, group] of de.entries()) {
      expect(en[index]!.questions.map((question) => question.type)).toEqual(
        group.questions.map((question) => question.type),
      );
    }
  });
});

describe('categories, stored', () => {
  it('keeps the category a question was picked under', async () => {
    await applyOnboarding({
      questions: [
        { text: 'Wie gut hast du geschlafen?', type: 'scale', category: 'gesundheit' },
        { text: 'Hast du heute aufgeräumt?', type: 'boolean', category: 'alltag' },
      ],
    });
    const stored = await questionsRepository.list();
    expect(stored.map((question) => [question.text, question.category])).toEqual([
      ['Wie gut hast du geschlafen?', 'gesundheit'],
      ['Hast du heute aufgeräumt?', 'alltag'],
    ]);
  });

  it('files a question written from scratch under "Eigene" by default', async () => {
    const question = await questionsRepository.create({ domainId: 'dom', text: 'Eigen' });
    expect(question.category).toBe('eigene');
    expect(question.inverted).toBe(false);
  });

  it('carries the category through to the history rows the drill-down reads', async () => {
    await applyOnboarding({
      questions: [{ text: 'Wie war deine Stimmung heute?', type: 'scale', category: 'mental' }],
    });
    const history = await loadHistory(TODAY, TODAY);
    expect(history.questions[0]?.category).toBe('mental');
    expect(history.questions[0]?.type).toBe('scale');
    expect(history.questions[0]?.status).toBe('active');
  });

  it('lets the user move a question to another category, from today forward', async () => {
    const created = await addQuestion({ text: 'Frage', type: 'boolean', category: 'eigene' });
    const before = await currentConfigSnapshot();
    await updateQuestion(created.id, { category: 'gesundheit' });
    const stored = await questionsRepository.get(created.id);
    expect(stored?.category).toBe('gesundheit');
    // The wording and type the question was answered under are untouched.
    expect(stored?.text).toBe('Frage');
    expect(before.questions[0]?.text).toBe('Frage');
  });
});

describe('custom questions', () => {
  it('are ordinary questions once created', async () => {
    await applyOnboarding({
      questions: [{ text: 'Habe ich Gitarre geübt?', type: 'boolean', category: 'eigene' }],
    });
    const day = await loadDay();
    expect(day.mental?.items).toHaveLength(1);
    expect(day.mental?.items[0]?.question.text).toBe('Habe ich Gitarre geübt?');
    expect(day.mental?.items[0]?.question.category).toBe('eigene');
  });

  it('can be written into any category the user likes', async () => {
    const created = await addQuestion({
      text: 'Habe ich meditiert?',
      type: 'boolean',
      category: 'mental',
    });
    expect(created.category).toBe('mental');
    const history = await loadHistory(TODAY, TODAY);
    expect(history.questions.find((row) => row.id === created.id)?.category).toBe('mental');
  });

  it('are asked every day, with no rhythm to configure', async () => {
    const created = await addQuestion({ text: 'Frage', type: 'scale', category: 'alltag' });
    for (const date of ['2026-03-02', '2026-03-03', '2026-03-04']) {
      freezeAt(date);
      const day = await loadDay(date);
      expect(day.mental?.items.some((item) => item.question.id === created.id)).toBe(true);
    }
  });
});
