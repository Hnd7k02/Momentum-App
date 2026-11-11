import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, summary, phone, onboard, clipped, smallTargets } from './lib.mjs';

/**
 * Phase 7: the one-time legacy-Sport question, on the screen.
 *
 * Everything about this conversion was built and tested in phase 2 and then
 * reachable from nowhere. What is checked here is the half that was missing:
 * that a migrated user is actually asked, that each branch does what it says,
 * that nobody who never had RC2 data is bothered, and above all that nothing
 * answers on the user's behalf.
 */

const browser = await chromium.launch({
  executablePath: CHROMIUM,
});

/**
 * Puts a device in the state a migrated RC2 user is in: a sports domain, a
 * few sport sessions, and the pending marker the version-2 migration sets.
 */
async function seedMigrated(page, { sessions = 6, targetPerWeek = 4 } = {}) {
  await page.evaluate(
    async ({ sessions, targetPerWeek }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('momentum');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const all = (store) =>
        new Promise((res, rej) => {
          const r = db.transaction([store], 'readonly').objectStore(store).getAll();
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      const putAll = (store, records) =>
        new Promise((res, rej) => {
          const tx = db.transaction([store], 'readwrite');
          for (const record of records) tx.objectStore(store).put(record);
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });

      const p = (n, l = 2) => String(n).padStart(l, '0');
      const key = (d) => `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      const shift = (n) => {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() + n);
        return d;
      };
      const isoWeek = (d) => {
        const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
        t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3);
        const y = t.getFullYear();
        const f = new Date(y, 0, 4, 12);
        f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3);
        return `${p(y, 4)}-W${p(1 + Math.round((t - f) / (7 * 86400000)))}`;
      };

      const stamp = new Date().toISOString();
      const snapshots = await all('configSnapshots');
      const snapshotId = snapshots[0]?.id ?? 'cfg_1';

      await putAll('domains', [
        {
          id: 'dom_legacy_sports',
          type: 'sports',
          enabled: true,
          order: 9,
          settings: { targetPerWeek },
          createdAt: stamp,
          updatedAt: stamp,
        },
      ]);

      const rows = [];
      for (let index = 0; index < sessions; index += 1) {
        const at = shift(-(index * 2 + 1));
        rows.push({
          id: `legacy-seed-${index}`,
          date: key(at),
          weekKey: isoWeek(at),
          performedAt: at.toISOString(),
          // Only some sessions had a duration, exactly as RC2 left them.
          durationMinutes: index % 2 === 0 ? 45 : null,
          note: null,
          configSnapshotId: snapshotId,
          createdAt: stamp,
          updatedAt: stamp,
        });
      }
      await putAll('sportsSessions', rows);

      const settings = await all('settings');
      await putAll('settings', [{ ...settings[0], legacySportMigration: 'pending' }]);
    },
    { sessions, targetPerWeek },
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
}

async function ready(viewport = {}, options = {}, seed = {}) {
  const ctx = await browser.newContext({ ...phone, ...viewport });
  const page = await ctx.newPage();
  await page.goto(URL_APP);
  await onboard(page, { gym: 0, running: 0, ...options });
  await seedMigrated(page, seed);
  return { ctx, page };
}

const toAreas = async (page) => {
  await page.locator('.tab-bar__tab', { hasText: 'Bereiche' }).click();
  await page.waitForTimeout(600);
};
const toToday = async (page) => {
  await page.locator('.tab-bar__tab', { hasText: 'Heute' }).click();
  await page.waitForTimeout(600);
};

/** Reads what the app actually stored about the choice. */
async function storedState(page) {
  return page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('momentum');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const all = (store) =>
      new Promise((res, rej) => {
        const r = db.transaction([store], 'readonly').objectStore(store).getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    const [settings, domains, sports, gym, runs] = await Promise.all([
      all('settings'),
      all('domains'),
      all('sportsSessions'),
      all('gymSessions'),
      all('runs'),
    ]);
    return {
      migration: settings[0]?.legacySportMigration ?? null,
      domains: domains.map((d) => ({ type: d.type, enabled: d.enabled, settings: d.settings })),
      sportsSessions: sports.length,
      gymSessions: gym.length,
      runs: runs.map((r) => ({
        distanceMetres: r.distanceMetres,
        durationSeconds: r.durationSeconds,
        elevationMetres: r.elevationMetres,
        steps: r.steps,
        legacyCarryOver: r.legacyCarryOver,
      })),
    };
  });
}

const pick = (page, label) =>
  page.locator('.legacy-choice__option', { hasText: label }).first().click();

/* ── The question is reachable at all ───────────────────────────────────── */
{
  const { ctx, page } = await ready();

  await toToday(page);
  check('Today points a migrated user at the question',
    await page.getByText('Sag unter Bereiche, was diese Trainings waren.').isVisible());
  check('and the retired log still offers no way to log into it',
    (await page.locator('.week__log').allTextContents()).every((label) => !/Sport/.test(label)));

  await page.getByText('Sag unter Bereiche, was diese Trainings waren.').click();
  await page.waitForTimeout(700);
  check('tapping it lands on Areas',
    await page.getByRole('heading', { name: 'Bereiche', exact: true }).isVisible());

  check('the question is asked inside the card that explains the retired log',
    (await page.locator('.areas__domainName', { hasText: 'Sport (bisher)' }).count()) === 1 &&
      (await page.locator('.legacy-choice').count()) === 1);
  // Scoped to the question's own lead line: the card's header carries a
  // description that reads almost identically, and a page-wide text match
  // finds that one first.
  check('it says how many sessions the answer applies to',
    /6 Trainings aus der früheren Version/.test(
      (await page.locator('.legacy-choice__lead').textContent()) ?? '',
    ));

  const options = await page.locator('.legacy-choice__option').allTextContents();
  check('it offers exactly three branches', options.length === 3, String(options.length));
  check('and names what each one was', options.every((text) => text.trim().length > 0));

  check('it promises the past will not move',
    await page.getByText(/Rang, dein Verlauf und deine bisherigen Wochen bleiben/).isVisible());
  check('and says it is asked only once',
    await page.getByText('Diese Frage wird nur einmal gestellt.').isVisible());
  await ctx.close();
}

/* ── Nothing answers on the user's behalf ───────────────────────────────── */
{
  const { ctx, page } = await ready();
  await toAreas(page);

  const before = await storedState(page);
  check('nothing is preselected',
    (await page.locator('.legacy-choice__option--on').count()) === 0);
  const confirm = page.getByRole('button', { name: 'Antwort übernehmen' });
  check('and the confirm is unavailable until something is picked', await confirm.isDisabled());

  // Wander around the app; the question must survive untouched.
  await toToday(page);
  await toAreas(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await toAreas(page);

  const after = await storedState(page);
  check('reloading and revisiting resolves nothing',
    after.migration === 'pending' && before.migration === 'pending');
  check('and writes nothing into either training log',
    after.gymSessions === 0 && after.runs.length === 0);
  check('the question is simply asked again',
    await page.getByRole('button', { name: 'Antwort übernehmen' }).isVisible());

  // Picking without confirming is still not an answer.
  await pick(page, 'Es waren Gym-Sessions');
  await page.waitForTimeout(300);
  check('picking an option alone does not apply it',
    (await storedState(page)).migration === 'pending');
  check('but it does enable the confirm',
    !(await page.getByRole('button', { name: 'Antwort übernehmen' }).isDisabled()));
  await ctx.close();
}

/* ── Answering: gym ─────────────────────────────────────────────────────── */
{
  const { ctx, page } = await ready();
  await toAreas(page);
  await pick(page, 'Es waren Gym-Sessions');
  await page.getByRole('button', { name: 'Antwort übernehmen' }).click();
  await page.waitForTimeout(1200);

  const state = await storedState(page);
  check('the answer is recorded', state.migration === 'gym');
  check('every session is carried into the gym log', state.gymSessions === 6, String(state.gymSessions));
  check('the legacy sessions themselves are kept, never deleted', state.sportsSessions === 6);
  const gym = state.domains.find((d) => d.type === 'gym');
  check('Gym is switched on', gym?.enabled === true);
  check('and inherits the weekly target the user themselves set',
    gym?.settings?.targetPerWeek === 4, JSON.stringify(gym?.settings));
  check('the retired domain is switched off, not removed',
    state.domains.find((d) => d.type === 'sports')?.enabled === false);

  check('the question is gone from Areas',
    (await page.locator('.legacy-choice').count()) === 0);
  await toToday(page);
  check('and the pointer is gone from Today',
    !(await page.getByText('Sag unter Bereiche, was diese Trainings waren.').isVisible()));
  check('Today now shows Gym', await page.getByRole('heading', { name: 'Gym' }).isVisible());
  await ctx.close();
}

/* ── Answering: running, and the invented-data promise ──────────────────── */
{
  const { ctx, page } = await ready();
  await toAreas(page);
  await pick(page, 'Es waren Läufe');
  await page.getByRole('button', { name: 'Antwort übernehmen' }).click();
  await page.waitForTimeout(1200);

  const state = await storedState(page);
  check('the answer is recorded', state.migration === 'running');
  check('every session becomes a run', state.runs.length === 6, String(state.runs.length));
  check('no distance, elevation or step count is invented',
    state.runs.every((r) => r.distanceMetres === null && r.elevationMetres === null && r.steps === null));
  check('a duration is carried only where RC2 actually had one',
    state.runs.filter((r) => r.durationSeconds !== null).length === 3,
    JSON.stringify(state.runs.map((r) => r.durationSeconds)));
  check('and every carried run is marked as carried over',
    state.runs.every((r) => r.legacyCarryOver === true));
  check('Running inherits the target the user set',
    state.domains.find((d) => d.type === 'running')?.settings?.targetPerWeek === 4);
  await ctx.close();
}

/* ── Answering: keep ────────────────────────────────────────────────────── */
{
  const { ctx, page } = await ready();
  await toAreas(page);
  await pick(page, 'So lassen, wie sie sind');
  await page.getByRole('button', { name: 'Antwort übernehmen' }).click();
  await page.waitForTimeout(1200);

  const state = await storedState(page);
  check('the answer is recorded', state.migration === 'kept');
  check('nothing is written into either training log',
    state.gymSessions === 0 && state.runs.length === 0);
  check('the retired domain stays enabled, because that is what was asked',
    state.domains.find((d) => d.type === 'sports')?.enabled === true);
  check('Gym and Running are not switched on behind the user',
    !state.domains.some((d) => (d.type === 'gym' || d.type === 'running') && d.enabled));
  check('the question is not asked again',
    (await page.locator('.legacy-choice').count()) === 0);

  await toToday(page);
  check('the retired log is still shown',
    await page.getByRole('heading', { name: 'Sport (bisher)' }).isVisible());
  check('but the pointer is gone, because the question is answered',
    !(await page.getByText('Sag unter Bereiche, was diese Trainings waren.').isVisible()));
  await ctx.close();
}

/* ── Somebody who never had RC2 data is never bothered ──────────────────── */
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await page.goto(URL_APP);
  await onboard(page, { gym: 3, running: 0 });

  await toAreas(page);
  check('a fresh profile is never asked', (await page.locator('.legacy-choice').count()) === 0);
  check('and sees no retired domain at all',
    !(await page.getByText('Sport (bisher)').isVisible()));
  await toToday(page);
  check('nor any pointer on Today',
    !(await page.getByText('Sag unter Bereiche, was diese Trainings waren.').isVisible()));
  await ctx.close();
}

/* ── Four widths, and long German labels ────────────────────────────────── */
for (const width of [320, 360, 393, 430]) {
  const { ctx, page } = await ready({ viewport: { width, height: 800 } });
  await toAreas(page);
  await pick(page, 'Es waren Läufe');
  await page.waitForTimeout(300);

  const clip = await clipped(page);
  check(`the question is not clipped at ${width}px`, clip.length === 0, clip.slice(0, 2).join('; '));
  const small = await smallTargets(page);
  check(`its targets hold at ${width}px`, small.length === 0, small.slice(0, 2).join('; '));
  const noScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  check(`the page does not scroll sideways at ${width}px`, noScroll);

  await toToday(page);
  const todayClip = await clipped(page);
  check(`the Today pointer is not clipped at ${width}px`, todayClip.length === 0,
    todayClip.slice(0, 2).join('; '));
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
