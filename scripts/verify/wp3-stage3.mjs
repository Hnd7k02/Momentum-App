import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { URL_APP, check, clipped, onboard, phone, smallTargets, summary } from './lib.mjs';

/**
 * WP3, Stage 3b — one day back (P8), on the real production build, under a
 * faked page clock in Europe/Berlin.
 *
 *   A  Heute | Gestern on a Monday     the switch, "Gestern ist noch offen"
 *                                      and where it leads; yesterday's
 *                                      answers, run and workout are written
 *                                      for yesterday; the run sheet offers
 *                                      Sunday and Monday only; last week is
 *                                      named as such (D133, D138)
 *   B  the update day                  a profile from before P8: the load
 *                                      appends the P8 era today, yesterday
 *                                      is read-only with the closed copy and
 *                                      no pointer to it (D132)
 *   C  Sunday 23:30 → Monday → Tuesday a week is judged when it is over: the
 *                                      Endurance figure does not move at
 *                                      Sunday midnight, a Sunday workout
 *                                      logged on Monday counts, and the week
 *                                      lands on Tuesday (D134)
 *   D  the break tiles                 the seventh day without a session or
 *                                      a run is carried while it can still be
 *                                      written, and the tiles say the charge
 *                                      is pending; two days on it lands
 *                                      (D135)
 *
 * Screenshots of every touched screen at 393×852, 430×932 and 320×693 go to
 * docs/design/wp3/stage3/.
 */
const OUT = process.env.OUT ?? 'docs/design/wp3/stage3';
mkdirSync(OUT, { recursive: true });
const TZ = 'Europe/Berlin';
const SIZES = [
  [393, 852],
  [430, 932],
  [320, 693],
];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/* ── helpers ─────────────────────────────────────────────────────────── */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const short = (value, n = 300) => {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s && s.length > n ? `${s.slice(0, n)}…` : s;
};
const shot = (page, width, slug) => page.screenshot({ path: `${OUT}/wp3-stage3-${width}-${slug}.png` });

/** YYYY-MM-DD, `n` days from `day`. */
function addDays(day, n) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const range = (from, to) => {
  const days = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
};
/** Monday, Wednesday and Friday of each week beginning on the Mondays given. */
const mwf = (...mondays) => mondays.flatMap((monday) => [monday, addDays(monday, 2), addDays(monday, 4)]);

const pageNow = (page) =>
  page.evaluate(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
const text = async (locator) =>
  (await locator.count()) > 0 ? ((await locator.first().textContent()) ?? '').replace(/\s+/g, ' ').trim() : null;
const label = (page) => text(page.locator('.today__date'));

async function until(read, ok, { timeout = 9000, gap = 200 } = {}) {
  const started = Date.now();
  let value = await read();
  while (!ok(value) && Date.now() - started < timeout) {
    await sleep(gap);
    value = await read();
  }
  return value;
}

const idb = (page, store) =>
  page.evaluate(async (s) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const rows = await new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    db.close();
    return rows;
  }, store);

/**
 * Back-dates the onboarding snapshot to `origin` and writes the history a
 * scenario needs, into the same stores a restored backup writes. `legacy`
 * strips the P8 marker and restores the three-day window, as a profile set
 * up by a build before P8 has them; the next load appends the P8 era.
 */
async function history(page, { origin, answered = [], gym = [], runs = [], legacy = false }) {
  return page.evaluate(async ({ origin, answered, gym, runs, legacy }) => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (db, s) => new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const putAll = (db, s, recs) => new Promise((res, rej) => { const tx = db.transaction([s], 'readwrite'); for (const r of recs) tx.objectStore(s).put(r); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    const at = (date, hour) => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d, hour, 0, 0); };
    const isoWeek = (d) => { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3); const y = t.getFullYear(); const f = new Date(y, 0, 4, 12); f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3); return `${pad(y, 4)}-W${pad(1 + Math.round((t - f) / (7 * 86400000)))}`; };
    const db = await open();
    const snaps = await all(db, 'configSnapshots');
    const settings = (await all(db, 'settings'))[0];
    const questions = await all(db, 'questions');
    const domains = await all(db, 'domains');
    const strip = (config) => {
      const { sessionWindowDays: _marker, ...scoring } = config.scoring;
      return { ...config, scoring: { ...scoring, editWindowDays: 3 } };
    };
    await putAll(db, 'configSnapshots', snaps.map((s, i) => ({
      ...s,
      ...(i === 0 ? { effectiveFrom: origin } : {}),
      ...(legacy ? { config: strip(s.config) } : {}),
    })));
    await putAll(db, 'settings', [{ ...settings, firstUseDate: origin }]);
    const stamp = new Date().toISOString();
    const mentalId = domains.find((d) => d.type === 'mental')?.id;
    const snapshotId = snaps[0].id;
    await putAll(db, 'answers', answered.flatMap((date) => questions.map((q) => ({
      id: `${date}#${q.id}`, date, questionId: q.id, domainId: mentalId, value: q.type === 'scale' ? 7 : true,
      valueType: q.type, sensitivity: 'private', configSnapshotId: snapshotId, createdAt: stamp, updatedAt: stamp,
    }))));
    await putAll(db, 'gymSessions', gym.map((date) => ({
      id: `s3-gym-${date}`, date, weekKey: isoWeek(at(date, 12)), performedAt: at(date, 18).toISOString(),
      planId: null, note: null, legacyCarryOver: false, configSnapshotId: snapshotId, createdAt: stamp, updatedAt: stamp,
    })));
    await putAll(db, 'runs', runs.map((date) => ({
      id: `s3-run-${date}`, date, weekKey: isoWeek(at(date, 12)), performedAt: at(date, 7).toISOString(),
      source: 'manual', externalId: null, distanceMetres: 5000, durationSeconds: 1800, elevationMetres: null,
      steps: null, note: null, legacyCarryOver: false, configSnapshotId: snapshotId, createdAt: stamp, updatedAt: stamp,
    })));
    db.close();
  }, { origin, answered, gym, runs, legacy });
}

async function newPage(width, height, time) {
  const ctx = await browser.newContext({ ...phone, viewport: { width, height }, timezoneId: TZ });
  await ctx.clock.install({ time });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

async function reloadOn(page, expectedLabel) {
  await page.reload({ waitUntil: 'networkidle' });
  return until(() => label(page), (value) => value === expectedLabel);
}

async function layoutChecks(page, name) {
  const clip = await clipped(page);
  check(`${name}: nothing is clipped`, clip.length === 0, clip.slice(0, 3).join('; '));
  const small = await smallTargets(page);
  check(`${name}: every control is a real target`, small.length === 0, small.slice(0, 4).join('; '));
}

const switchTo = async (page, side) => {
  await page.locator('.today__switch button', { hasText: side }).click();
  await page.waitForTimeout(500);
};
const pressed = (page, side) => page.locator('.today__switch button', { hasText: side }).getAttribute('aria-pressed');
const yesterdayLine = (page) => page.locator('button.today__yesterday');
const trainingCard = (page, title) =>
  page.locator('section.section').filter({ has: page.locator('.section__label', { hasText: new RegExp(`^${title}$`) }) });

/** Past midnight, with no input: the timer moves the day. */
async function pastMidnight(ctx, page) {
  const ms = await page.evaluate(() => {
    const next = new Date();
    next.setHours(24, 0, 30, 0);
    return next.getTime() - Date.now();
  });
  await ctx.clock.fastForward(ms);
  await ctx.clock.runFor('00:30');
  await page.waitForTimeout(1200);
}

async function openHub(page) {
  await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
  await page.waitForTimeout(600);
  const gym = page.locator('.domain-switch button', { hasText: 'Gym' });
  if ((await gym.count()) > 0) await gym.click();
  await until(() => page.locator('.areas__scroll [data-metric^="gym-"]').count(), (n) => n > 0, { timeout: 9000 });
  await page.waitForTimeout(600);
}
const tile = (page, id) => text(page.locator(`[data-metric="${id}"]`));

/* ── A: Heute | Gestern on a Monday ──────────────────────────────────── */

const MONDAY = '2026-10-19';
for (const [width, height] of SIZES) {
  const W = `A ${width}`;
  const { ctx, page, errors } = await newPage(width, height, `${MONDAY}T09:00:00+02:00`);
  await onboard(page, { gym: 3, running: 2 });
  // Five weeks of history; Sunday left unanswered, with a run logged on it.
  await history(page, {
    origin: '2026-09-14',
    answered: range('2026-09-14', '2026-10-17'),
    gym: [...mwf('2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05'), '2026-10-12', '2026-10-14'],
    runs: ['2026-10-13', '2026-10-15', '2026-10-18'],
  });
  const loaded = await reloadOn(page, 'Montag, 19. Oktober');
  check(`${W}: Heute opens on Montag, 19. Oktober`, loaded === 'Montag, 19. Oktober', String(loaded));
  check(`${W}: the switch is on Heute`, (await pressed(page, 'Heute')) === 'true' && (await pressed(page, 'Gestern')) === 'false');
  const line = await until(() => text(yesterdayLine(page)), (value) => value !== null);
  check(`${W}: "Gestern ist noch offen" points across`, line === 'Gestern ist noch offen', String(line));
  await layoutChecks(page, `${W} Heute`);
  await shot(page, width, 'heute');

  await yesterdayLine(page).click();
  const gestern = await until(() => label(page), (value) => value === 'Sonntag, 18. Oktober');
  check(`${W}: the pointer opens Gestern on Sonntag, 18. Oktober`, gestern === 'Sonntag, 18. Oktober' && (await pressed(page, 'Gestern')) === 'true', String(gestern));
  await page.waitForTimeout(500);
  check(`${W}: and is not shown on the Gestern side`, (await yesterdayLine(page).count()) === 0);
  const weekLabels = await page.locator('.week__label').allTextContents();
  check(`${W}: both training cards are last week`, same(weekLabels, ['Letzte Woche', 'Letzte Woche']), short(weekLabels));
  const gymWeek = await text(trainingCard(page, 'Gym').locator('.week__value'));
  check(`${W}: Gym's last week holds its two sessions`, gymWeek === '2 / 3 Trainings', String(gymWeek));
  await layoutChecks(page, `${W} Gestern`);
  await shot(page, width, 'gestern');

  // Answer yesterday's questions on the Gestern side.
  const items = page.locator('.check-in');
  for (let index = 0; index < (await items.count()); index += 1) {
    await items.nth(index).locator('.answer-scale__value').nth(6).click();
    await page.waitForTimeout(450);
  }
  const done = await until(() => text(page.locator('.today__progress')), (value) => value === 'Gestern erledigt');
  check(`${W}: answered, the Gestern side says "Gestern erledigt"`, done === 'Gestern erledigt', String(done));
  const stored = (await idb(page, 'answers')).filter((answer) => answer.date >= '2026-10-18').map((answer) => answer.date);
  check(`${W}: both answers are stored under 18.10`, stored.length === 2 && stored.every((date) => date === '2026-10-18'), short(stored));
  await shot(page, width, 'gestern-done');

  // Sunday's run: the sheet offers Sunday and Monday, nothing else.
  await trainingCard(page, 'Laufen').locator('.row').last().click();
  await page.locator('.sheet').waitFor({ timeout: 3000 });
  await page.waitForTimeout(400);
  const days = await page.locator('.session-days__day').allTextContents();
  check(`${W}: the run sheet offers So and Mo`, same(days, ['So', 'Mo']), short(days));
  const checked = await page.locator('.session-days__day[aria-checked="true"]').allTextContents();
  check(`${W}: on the run's own day`, same(checked, ['So']), short(checked));
  await layoutChecks(page, `${W} run sheet`);
  await shot(page, width, 'run-sheet');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // A workout started on the Gestern side belongs to yesterday.
  await trainingCard(page, 'Gym').locator('button.week__log').click().catch(async () => {
    await page.getByRole('button', { name: 'Session eintragen' }).click();
  });
  await page.waitForTimeout(800);
  const free = page.locator('[role="dialog"]').getByRole('button', { name: 'Freie Session' });
  if ((await free.count()) > 0) {
    await free.click();
    await page.waitForTimeout(700);
  }
  await page.locator('.gym-session__date').waitFor({ timeout: 5000 });
  const header = await text(page.locator('.gym-session__date'));
  check(`${W}: the workout is dated 18. Oktober`, header === 'Session vom 18. Oktober', String(header));
  check(`${W}: and takes input`, (await page.locator('.gym-session__closed').count()) === 0);
  await layoutChecks(page, `${W} workout for yesterday`);
  await shot(page, width, 'workout-gestern');
  await page.locator('.gym-session .gym-session__back').first().click();
  await page.waitForTimeout(800);
  const sessionsOn18 = (await idb(page, 'gymSessions')).filter((session) => session.date === '2026-10-18');
  check(`${W}: opening and leaving it stored nothing`, sessionsOn18.length === 0, short(sessionsOn18));

  // Back on Heute, the pointer has gone with yesterday's answers.
  await switchTo(page, 'Heute');
  await until(() => label(page), (value) => value === 'Montag, 19. Oktober');
  await page.waitForTimeout(800);
  check(`${W}: back on Heute, nothing points to yesterday any more`, (await yesterdayLine(page).count()) === 0);
  check(`${W}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ── B: the update day ───────────────────────────────────────────────── */

const WEDNESDAY = '2026-10-14';
for (const [width, height] of SIZES) {
  const W = `B ${width}`;
  const { ctx, page, errors } = await newPage(width, height, `${WEDNESDAY}T09:00:00+02:00`);
  await onboard(page, { gym: 3, running: 2 });
  // Lived under the rules before P8; yesterday left unanswered.
  await history(page, {
    origin: '2026-09-14',
    answered: range('2026-09-14', '2026-10-12'),
    gym: [...mwf('2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05'), '2026-10-12'],
    runs: ['2026-10-06', '2026-10-08', '2026-10-13'],
    legacy: true,
  });
  await reloadOn(page, 'Mittwoch, 14. Oktober');
  await page.waitForTimeout(900);
  const snapshots = (await idb(page, 'configSnapshots')).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const last = snapshots[snapshots.length - 1];
  check(`${W}: the load appended the P8 era, effective today`, last?.effectiveFrom === WEDNESDAY && last?.config.scoring.sessionWindowDays === 1 && last?.config.scoring.editWindowDays === 1, short(snapshots.map((s) => [s.effectiveFrom, s.config.scoring.editWindowDays, s.config.scoring.sessionWindowDays ?? null])));
  check(`${W}: and left every earlier snapshot as it was`, snapshots.slice(0, -1).every((s) => s.config.scoring.sessionWindowDays === undefined && s.config.scoring.editWindowDays === 3));
  check(`${W}: nothing points to yesterday`, (await yesterdayLine(page).count()) === 0);

  await switchTo(page, 'Gestern');
  await until(() => label(page), (value) => value === 'Dienstag, 13. Oktober');
  await page.waitForTimeout(600);
  const closed = await text(page.locator('.today__closed'));
  check(`${W}: yesterday says "Dieser Tag ist abgeschlossen."`, closed === 'Dieser Tag ist abgeschlossen.', String(closed));
  const live = await page.locator('.answer-scale__value:not([disabled]), .answer-boolean__option:not([disabled])').count();
  check(`${W}: none of its questions takes an answer`, live === 0 && (await page.locator('.answer-scale__value').count()) > 0, String(live));
  check(`${W}: no session can be logged for it`, (await page.locator('button.week__log').count()) === 0);
  await layoutChecks(page, `${W} Gestern closed`);
  await shot(page, width, 'gestern-closed');

  // An older run opens read-only, with the same copy.
  await trainingCard(page, 'Laufen').locator('.row').first().click();
  await page.locator('.sheet').waitFor({ timeout: 3000 });
  await page.waitForTimeout(400);
  const sheetClosed = await text(page.locator('.session-sheet__closed'));
  check(`${W}: yesterday's run opens read-only`, sheetClosed === 'Dieser Tag ist abgeschlossen.' && (await page.locator('.sheet__footer button').count()) === 0, String(sheetClosed));
  await layoutChecks(page, `${W} run sheet closed`);
  await shot(page, width, 'run-sheet-closed');
  await page.keyboard.press('Escape');
  check(`${W}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ── C: a week judged when it is over ─────────────────────────────────── */
{
  const W = 'C 393';
  const { ctx, page, errors } = await newPage(393, 852, '2026-10-18T23:30:00+02:00');
  await onboard(page, { gym: 3, running: 0 });
  // Two met weeks, then Monday and Wednesday of this one; Sunday not yet.
  await history(page, {
    origin: '2026-09-28',
    answered: range('2026-09-28', '2026-10-18'),
    gym: [...mwf('2026-09-28', '2026-10-05'), '2026-10-12', '2026-10-14'],
  });
  await reloadOn(page, 'Sonntag, 18. Oktober');
  await openHub(page);
  const sunday = await tile(page, 'gym-endurance');
  check(`${W}: on Sunday evening the Endurance Phase stands at 2.0`, /^Ausdauerphase\s*2\.0 von 4 Wochen/.test(sunday ?? ''), String(sunday));

  await pastMidnight(ctx, page);
  check(`${W}: (precondition) past Sunday midnight`, (await pageNow(page)).startsWith('2026-10-19 00:0'), await pageNow(page));
  const monday = await until(() => tile(page, 'gym-endurance'), (value) => value !== null);
  check(`${W}: Monday midnight judges nothing: still 2.0`, /^Ausdauerphase\s*2\.0 von 4 Wochen/.test(monday ?? ''), String(monday));
  await shot(page, 393, 'hub-monday');

  // Sunday's workout, logged on Monday from the Gestern side.
  await page.locator('.tab-bar button', { hasText: 'Heute' }).click();
  await until(() => label(page), (value) => value === 'Montag, 19. Oktober');
  await switchTo(page, 'Gestern');
  await until(() => label(page), (value) => value === 'Sonntag, 18. Oktober');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Session eintragen' }).click();
  await page.waitForTimeout(800);
  const free = page.locator('[role="dialog"]').getByRole('button', { name: 'Freie Session' });
  if ((await free.count()) > 0) await free.click();
  await page.locator('.gym-session__bar').waitFor({ timeout: 5000 });
  await page.locator('.gym-session__bar').getByRole('button', { name: /Übung hinzufügen/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('textbox', { name: 'Suchen' }).fill('Kniebeuge');
  await page.waitForTimeout(350);
  await page.locator('.gym-picker__row').filter({ has: page.locator('.gym-picker__name', { hasText: /^Kniebeuge$/ }) }).first().click();
  await page.waitForTimeout(900);
  const row = page.locator('.gym-set--pending').first();
  await row.locator('input').nth(0).fill('5');
  await row.locator('input').nth(0).blur();
  await page.waitForTimeout(300);
  await row.locator('input').nth(1).fill('100');
  await row.locator('input').nth(1).blur();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.waitForTimeout(1200);
  const stored = (await idb(page, 'gymSessions')).filter((session) => session.date === '2026-10-18');
  check(`${W}: one session stored on Sunday, from Monday`, stored.length === 1, short(stored.map((s) => s.date)));
  const gymWeek = await text(trainingCard(page, 'Gym').locator('.week__value'));
  check(`${W}: last week now holds three`, gymWeek === '3 / 3 Trainings', String(gymWeek));

  await openHub(page);
  const stillMonday = await tile(page, 'gym-endurance');
  check(`${W}: the week is still in progress on Monday: 2.0`, /^Ausdauerphase\s*2\.0 von 4 Wochen/.test(stillMonday ?? ''), String(stillMonday));

  await pastMidnight(ctx, page);
  check(`${W}: (precondition) past Monday midnight`, (await pageNow(page)).startsWith('2026-10-20 00:0'), await pageNow(page));
  const tuesday = await until(() => tile(page, 'gym-endurance'), (value) => /^Ausdauerphase\s*3\.0 von 4 Wochen/.test(value ?? ''));
  check(`${W}: Tuesday judges the week, met: 3.0`, /^Ausdauerphase\s*3\.0 von 4 Wochen/.test(tuesday ?? ''), String(tuesday));
  await shot(page, 393, 'hub-tuesday');
  check(`${W}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ── D: the break tiles while a charge waits ─────────────────────────── */

const BREAK_DAY = '2026-10-14'; // the seventh day without a session or a run
for (const [width, height] of SIZES) {
  const W = `D ${width}`;
  const { ctx, page, errors } = await newPage(width, height, `${BREAK_DAY}T09:00:00+02:00`);
  await onboard(page, { gym: 3, running: 2 });
  // Five met weeks unlock both Endurance Phases; the last session and the
  // last run are on Wednesday 7 October.
  const mondays = ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'];
  await history(page, {
    origin: '2026-08-31',
    answered: range('2026-08-31', '2026-10-13'),
    gym: [...mwf(...mondays), '2026-10-05', '2026-10-06', '2026-10-07'],
    runs: [...mondays.flatMap((monday) => [addDays(monday, 1), addDays(monday, 3)]), '2026-10-06', '2026-10-07'],
  });
  await reloadOn(page, 'Mittwoch, 14. Oktober');
  await openHub(page);
  const gymTile = await until(() => tile(page, 'gym-decay'), (value) => value !== null);
  check(`${W}: the Gym tile counts seven days`, (gymTile ?? '').includes('7 Tage ohne Session'), String(gymTile));
  check(`${W}: and says the charge is pending`, (gymTile ?? '').includes('Abbau ausstehend – zählt, sobald der Tag abgeschlossen ist'), String(gymTile));
  const runTile = await tile(page, 'running-decay');
  check(`${W}: the Laufen tile says the same`, (runTile ?? '').includes('7 Tage ohne Lauf') && (runTile ?? '').includes('Abbau ausstehend'), String(runTile));
  await layoutChecks(page, `${W} hub pending`);
  await page.locator('[data-metric="gym-decay"]').scrollIntoViewIfNeeded();
  await shot(page, width, 'gym-break-pending');
  await page.locator('[data-metric="running-decay"]').scrollIntoViewIfNeeded();
  await shot(page, width, 'run-break-pending');

  await page.locator('[data-metric="gym-decay"] .metric-tile__open').click();
  await page.locator('.sheet').waitFor({ timeout: 3000 });
  await page.waitForTimeout(450);
  const sheet = await text(page.locator('.sheet'));
  check(`${W}: the sheet explains when it counts`, (sheet ?? '').includes('Ein Tag ohne Session zählt erst, wenn er nicht mehr nachgetragen werden kann.'), short(sheet, 400));
  await layoutChecks(page, `${W} pending sheet`);
  await shot(page, width, 'gym-break-sheet');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Two days on, the seventh day has closed: the charge lands.
  await pastMidnight(ctx, page);
  await pastMidnight(ctx, page);
  await page.reload({ waitUntil: 'networkidle' });
  await openHub(page);
  const charged = await until(() => tile(page, 'gym-decay'), (value) => (value ?? '').includes('9 Tage'));
  check(`${W}: on Friday the tile counts nine days`, (charged ?? '').includes('9 Tage ohne Session'), String(charged));
  const lost = Number((charged ?? '').match(/(\d+) % deines Fortschritts abgebaut/)?.[1] ?? 0);
  check(`${W}: and the decay has landed`, lost > 0 && !(charged ?? '').includes('ausstehend'), String(charged));
  await page.locator('[data-metric="gym-decay"]').scrollIntoViewIfNeeded();
  await shot(page, width, 'gym-break-charged');
  check(`${W}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
