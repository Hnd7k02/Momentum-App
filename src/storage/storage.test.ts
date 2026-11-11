import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../core/clock';
import { weeklyTargetIn } from '../core/domains';
import { SCHEMA_VERSION } from '../core/model';
import { ALL_STORES, DB_NAME, closeDatabase, databaseName, deleteDatabase, openDatabase } from './db';
import {
  answersRepository,
  configSnapshotsRepository,
  domainsRepository,
  questionsRepository,
  sportsSessionsRepository,
  settingsRepository,
} from './repositories';
import { currentConfigSnapshot, configForDate, ensureCurrentSnapshot } from './configService';

/** Pins "now" so records get deterministic stamps and `today()` is stable. */
function freezeAt(day: string, hour = 9): void {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, hour, 0, 0) });
}

async function setup() {
  const mental = await domainsRepository.ensure('mental', 0, {});
  const sports = await domainsRepository.ensure('sports', 1, { targetPerWeek: 3 });
  return { mental, sports };
}

beforeEach(async () => {
  await deleteDatabase();
  freezeAt('2025-03-31');
});

afterEach(async () => {
  setClock(null);
  await closeDatabase();
});

describe('database', () => {
  it('opens at the current schema version with every store present', async () => {
    const db = await openDatabase();
    expect(db.version).toBe(SCHEMA_VERSION);
    for (const store of ALL_STORES) {
      expect(db.objectStoreNames.contains(store)).toBe(true);
    }
  });

  it('starts empty', async () => {
    expect(await questionsRepository.list()).toEqual([]);
    expect(await answersRepository.getAll()).toEqual([]);
    expect(await settingsRepository.get()).toBeUndefined();
  });

  it('is named "momentum" in the ordinary build', async () => {
    // The live app's data lives under this name; it must never move.
    expect(DB_NAME).toBe('momentum');
    expect((await openDatabase()).name).toBe('momentum');
    expect(databaseName(undefined)).toBe('momentum');
    expect(databaseName('')).toBe('momentum');
  });

  it('lets a preview build name its own database, and nothing else', () => {
    expect(databaseName('momentum-preview')).toBe('momentum-preview');
    expect(databaseName('momentum-preview-2')).toBe('momentum-preview-2');
    // Not this app's form: ignored rather than opened.
    for (const other of ['preview', 'momentum', 'momentum-', 'Momentum-Preview', 'momentum preview', '../momentum', 7, null]) {
      expect(databaseName(other)).toBe('momentum');
    }
  });
});

describe('settings', () => {
  it('creates the day-one record once and reuses it', async () => {
    const first = await settingsRepository.getOrCreate();
    expect(first.language).toBe('de');
    expect(first.firstUseDate).toBe('2025-03-31');
    expect(first.onboardingCompletedAt).toBeNull();

    freezeAt('2025-04-05');
    const second = await settingsRepository.getOrCreate();
    expect(second.firstUseDate).toBe('2025-03-31');
    expect(second.createdAt).toBe(first.createdAt);
  });

  it('persists a language change', async () => {
    await settingsRepository.getOrCreate();
    await settingsRepository.setLanguage('en');
    expect((await settingsRepository.get())?.language).toBe('en');
  });
});

describe('domains', () => {
  it('adds a domain as a record and never duplicates it', async () => {
    const first = await domainsRepository.ensure('sports', 1, { targetPerWeek: 3 });
    const again = await domainsRepository.ensure('sports', 1, { targetPerWeek: 5 });
    expect(again.id).toBe(first.id);
    expect(await domainsRepository.list()).toHaveLength(1);
  });

  it('keeps each domain configuration with the domain it belongs to', async () => {
    const { sports } = await setup();
    expect(sports.type === 'sports' && sports.settings.targetPerWeek).toBe(3);
    await domainsRepository.updateSettings(sports.id, { targetPerWeek: 4 });
    const reloaded = await domainsRepository.findByType('sports');
    expect(reloaded?.type === 'sports' && reloaded.settings.targetPerWeek).toBe(4);
  });

  it('excludes disabled domains from the enabled list', async () => {
    const { sports } = await setup();
    await domainsRepository.setEnabled(sports.id, false);
    expect((await domainsRepository.listEnabled()).map((d) => d.type)).toEqual(['mental']);
  });
});

describe('questions', () => {
  it('defaults to a boolean question, asked every day', async () => {
    const { mental } = await setup();
    const question = await questionsRepository.create({
      domainId: mental.id,
      text: '  Hast du dein Bett gemacht?  ',
    });
    expect(question.text).toBe('Hast du dein Bett gemacht?');
    expect(question.type).toBe('boolean');
    expect(question.status).toBe('active');
    // Questions carry no schedule: an active question is due, full stop.
    expect(question).not.toHaveProperty('rhythm');
  });

  it('asks only active questions', async () => {
    const { mental } = await setup();
    const asked = await questionsRepository.create({ domainId: mental.id, text: 'A' });
    const paused = await questionsRepository.create({ domainId: mental.id, text: 'B' });
    const archived = await questionsRepository.create({ domainId: mental.id, text: 'C' });
    await questionsRepository.setStatus(paused.id, 'paused');
    await questionsRepository.archive(archived.id);

    expect((await questionsRepository.listActive()).map((q) => q.id)).toEqual([asked.id]);
    expect(await questionsRepository.listByDomain(mental.id)).toHaveLength(3);
  });

  it('keeps history when a question is archived', async () => {
    const { mental } = await setup();
    const question = await questionsRepository.create({ domainId: mental.id, text: 'A' });
    const snapshot = await ensureCurrentSnapshot();
    await answersRepository.save({
      date: '2025-03-30',
      questionId: question.id,
      domainId: mental.id,
      value: true,
      valueType: 'boolean',
      configSnapshotId: snapshot.id,
    });

    const archived = await questionsRepository.archive(question.id);
    expect(archived?.archivedAt).not.toBeNull();
    expect(await answersRepository.listByQuestion(question.id)).toHaveLength(1);
    // The question record itself survives too, so old answers stay readable.
    expect(await questionsRepository.get(question.id)).toBeDefined();
  });

  it('resuming a paused question clears nothing', async () => {
    const { mental } = await setup();
    const question = await questionsRepository.create({ domainId: mental.id, text: 'A' });
    await questionsRepository.setStatus(question.id, 'paused');
    const resumed = await questionsRepository.setStatus(question.id, 'active');
    expect(resumed?.status).toBe('active');
    expect(resumed?.archivedAt).toBeNull();
    expect(resumed?.createdAt).toBe(question.createdAt);
  });
});

describe('answers', () => {
  it('stores one answer per question per calendar day', async () => {
    const { mental } = await setup();
    const question = await questionsRepository.create({ domainId: mental.id, text: 'A' });
    const snapshot = await ensureCurrentSnapshot();
    const base = {
      questionId: question.id,
      domainId: mental.id,
      valueType: 'boolean' as const,
      configSnapshotId: snapshot.id,
    };

    await answersRepository.save({ ...base, date: '2025-03-31', value: false });
    await answersRepository.save({ ...base, date: '2025-03-31', value: true });
    await answersRepository.save({ ...base, date: '2025-03-30', value: true });

    const day = await answersRepository.listByDate('2025-03-31');
    expect(day).toHaveLength(1);
    expect(day[0]?.value).toBe(true);
    expect(await answersRepository.getAll()).toHaveLength(2);
  });

  it('keeps the original creation stamp and snapshot when corrected', async () => {
    const { mental } = await setup();
    const question = await questionsRepository.create({ domainId: mental.id, text: 'A' });
    const first = await ensureCurrentSnapshot();
    const original = await answersRepository.save({
      date: '2025-03-31',
      questionId: question.id,
      domainId: mental.id,
      value: 4,
      valueType: 'scale',
      configSnapshotId: first.id,
    });

    freezeAt('2025-04-02');
    const corrected = await answersRepository.save({
      date: '2025-03-31',
      questionId: question.id,
      domainId: mental.id,
      value: 8,
      valueType: 'scale',
      configSnapshotId: 'a-newer-snapshot',
    });

    expect(corrected.value).toBe(8);
    expect(corrected.createdAt).toBe(original.createdAt);
    // The day is still judged by the configuration it was lived under.
    expect(corrected.configSnapshotId).toBe(first.id);
    expect(corrected.updatedAt).not.toBe(original.updatedAt);
  });

  it('reads an inclusive date range', async () => {
    const { mental } = await setup();
    const question = await questionsRepository.create({ domainId: mental.id, text: 'A' });
    const snapshot = await ensureCurrentSnapshot();
    for (const date of ['2025-03-28', '2025-03-29', '2025-03-30', '2025-03-31']) {
      await answersRepository.save({
        date,
        questionId: question.id,
        domainId: mental.id,
        value: true,
        valueType: 'boolean',
        configSnapshotId: snapshot.id,
      });
    }
    const range = await answersRepository.listByDateRange('2025-03-29', '2025-03-31');
    expect(range.map((a) => a.date).sort()).toEqual(['2025-03-29', '2025-03-30', '2025-03-31']);
    expect(await answersRepository.listByDateRange('2025-03-31', '2025-03-29')).toEqual([]);
  });

  it('clearing an answer removes it rather than storing a negative', async () => {
    const { mental } = await setup();
    const question = await questionsRepository.create({ domainId: mental.id, text: 'A' });
    const snapshot = await ensureCurrentSnapshot();
    await answersRepository.save({
      date: '2025-03-31',
      questionId: question.id,
      domainId: mental.id,
      value: true,
      valueType: 'boolean',
      configSnapshotId: snapshot.id,
    });
    await answersRepository.clear('2025-03-31', question.id);
    expect(await answersRepository.get('2025-03-31', question.id)).toBeUndefined();
  });
});

describe('sports sessions', () => {
  it('files a session into its Monday-to-Sunday week', async () => {
    const { sports } = await setup();
    const snapshot = await ensureCurrentSnapshot();
    // Sunday 30 March belongs to the week that began Monday 24 March.
    const sunday = await sportsSessionsRepository.create({
      domainId: sports.id,
      date: '2025-03-30',
      configSnapshotId: snapshot.id,
    });
    const monday = await sportsSessionsRepository.create({
      domainId: sports.id,
      date: '2025-03-31',
      configSnapshotId: snapshot.id,
    });

    expect(sunday.weekKey).toBe('2025-W13');
    expect(monday.weekKey).toBe('2025-W14');
    expect(await sportsSessionsRepository.listByWeek('2025-W13')).toHaveLength(1);
  });

  it('re-files a session when its date is corrected', async () => {
    const { sports } = await setup();
    const snapshot = await ensureCurrentSnapshot();
    const session = await sportsSessionsRepository.create({
      domainId: sports.id,
      date: '2025-03-31',
      configSnapshotId: snapshot.id,
    });
    await sportsSessionsRepository.update(session.id, { date: '2025-03-30' });

    expect(await sportsSessionsRepository.listByWeek('2025-W14')).toHaveLength(0);
    expect(await sportsSessionsRepository.listByWeek('2025-W13')).toHaveLength(1);
  });

  it('allows several sessions on one day and keeps optional detail empty', async () => {
    const { sports } = await setup();
    const snapshot = await ensureCurrentSnapshot();
    await sportsSessionsRepository.create({
      domainId: sports.id,
      date: '2025-03-31',
      note: 'Laufen',
      configSnapshotId: snapshot.id,
    });
    const second = await sportsSessionsRepository.create({
      domainId: sports.id,
      date: '2025-03-31',
      note: 'Kurz',
      configSnapshotId: snapshot.id,
    });

    expect(await sportsSessionsRepository.listByDate('2025-03-31')).toHaveLength(2);
    // The seam version 2 will write exercises into exists and stays null now.
    expect(second.detail).toBeNull();
  });
});

describe('config snapshots', () => {
  it('appends a snapshot only when something scoring-relevant changed', async () => {
    const { mental } = await setup();
    const first = await ensureCurrentSnapshot();
    const unchanged = await ensureCurrentSnapshot();
    expect(unchanged.id).toBe(first.id);

    await questionsRepository.create({ domainId: mental.id, text: 'Neu' });
    freezeAt('2025-04-01');
    const changed = await ensureCurrentSnapshot();
    expect(changed.id).not.toBe(first.id);
    expect(await configSnapshotsRepository.list()).toHaveLength(2);
  });

  it('collapses several changes on the same day into one snapshot', async () => {
    const { mental } = await setup();
    await ensureCurrentSnapshot();
    await questionsRepository.create({ domainId: mental.id, text: 'A' });
    await ensureCurrentSnapshot();
    await questionsRepository.create({ domainId: mental.id, text: 'B' });
    await ensureCurrentSnapshot();

    const snapshots = await configSnapshotsRepository.list();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.config.questions).toHaveLength(2);
  });

  it('scores a past week against the target that was in force then', async () => {
    // January: three sessions a week.
    freezeAt('2025-01-06');
    const { sports } = await setup();
    await ensureCurrentSnapshot();

    // April: the user raises the target to four.
    freezeAt('2025-04-07');
    await domainsRepository.updateSettings(sports.id, { targetPerWeek: 4 });
    await ensureCurrentSnapshot();

    const january = await configForDate('2025-01-20');
    const april = await configForDate('2025-04-10');
    expect(january && weeklyTargetIn(january, 'sports')).toBe(3);
    expect(april && weeklyTargetIn(april, 'sports')).toBe(4);
    // The day the change took effect uses the new target; the day before does not.
    const dayBefore = await configForDate('2025-04-06');
    expect(dayBefore && weeklyTargetIn(dayBefore, 'sports')).toBe(3);
  });

  it('resolves days before the first snapshot to the earliest configuration', async () => {
    freezeAt('2025-04-07');
    await setup();
    await ensureCurrentSnapshot();
    const earlier = await configForDate('2025-01-01');
    expect(earlier).toBeDefined();
    expect(weeklyTargetIn(earlier!, 'sports')).toBe(3);
  });

  it('keeps archived questions in the snapshot so past days keep their meaning', async () => {
    const { mental } = await setup();
    const question = await questionsRepository.create({ domainId: mental.id, text: 'A' });
    await ensureCurrentSnapshot();

    await questionsRepository.archive(question.id);
    freezeAt('2025-04-02');
    await ensureCurrentSnapshot();

    const before = await configForDate('2025-03-31');
    const after = await configForDate('2025-04-02');
    expect(before?.questions[0]?.status).toBe('active');
    expect(after?.questions[0]?.status).toBe('archived');
  });

  it('reports a domain that was not enabled as having no target', async () => {
    await domainsRepository.ensure('mental', 0, {});
    const snapshot = await currentConfigSnapshot();
    expect(weeklyTargetIn(snapshot, 'gym')).toBeNull();
  });
});
