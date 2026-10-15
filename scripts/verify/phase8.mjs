import { chromium } from 'playwright-core';
import { URL_APP, check, summary, phone, onboard, clipped, smallTargets } from './lib.mjs';

/**
 * Phase 8: pause periods on the screen, and no rest days anywhere.
 *
 * A pause is the one feature here whose value is easy to misread, so the
 * checks are as much about what the screen *says* as about what it stores:
 * that logging is never blocked, that no streak is promised, and that the
 * app never becomes a mode the user has to leave.
 */

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

const p = (n, l = 2) => String(n).padStart(l, '0');
const key = (d) => `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
const shift = (n) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return key(d);
};

async function ready(viewport = {}, options = {}) {
  const ctx = await browser.newContext({ ...phone, ...viewport });
  const page = await ctx.newPage();
  await page.goto(URL_APP);
  await onboard(page, { gym: 3, running: 0, ...options });
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

async function storedPauses(page) {
  return page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('momentum');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const read = (store) =>
      new Promise((res, rej) => {
        const r = db.transaction([store], 'readonly').objectStore(store).getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    return { pauses: await read('pausePeriods'), restDays: await read('restDays') };
  });
}

/** Fills the pause form. Dates are set through the native control's value. */
async function fillPause(page, from, to, reason = '') {
  const inputs = page.locator('.pause-form__input');
  await inputs.nth(0).fill(from);
  await inputs.nth(1).fill(to);
  if (reason) await inputs.nth(2).fill(reason);
  await page.waitForTimeout(250);
}

/* ── The section exists and says what it is ─────────────────────────────── */
{
  const { ctx, page } = await ready();
  await toAreas(page);

  check('Areas offers a Pause section',
    await page.getByRole('heading', { name: 'Pause' }).isVisible());
  check('it says what a pause does',
    await page.getByText(/verlierst du nichts, weil du nichts machst/).isVisible());
  check('it says what a pause does not do',
    await page.getByText(/Serien laufen nicht weiter/).isVisible());
  check('it says logging keeps working',
    await page.getByText(/Eintragen kannst du weiterhin alles/).isVisible());
  check('it starts with none planned',
    await page.getByText('Keine Pause geplant.').isVisible());

  const body = (await page.locator('body').textContent()) ?? '';
  check('no Rest Day surface appears anywhere in Areas',
    !/Ruhetag|Rest Day|Rest-Tag/i.test(body));
  await ctx.close();
}

/* ── Creating one ───────────────────────────────────────────────────────── */
{
  const { ctx, page } = await ready();
  await toAreas(page);
  await page.getByRole('button', { name: 'Pause planen' }).click();
  await page.waitForTimeout(400);

  check('the form states the limit and the earliest start',
    await page.getByText(/Höchstens 28 Tage\. Frühester Start ist heute\./).isVisible());

  await fillPause(page, shift(0), shift(6), 'Ferien');
  await page.getByRole('button', { name: 'Pause sichern' }).click();
  await page.waitForTimeout(800);

  const { pauses, restDays } = await storedPauses(page);
  check('the pause is stored', pauses.length === 1, JSON.stringify(pauses.length));
  check('with the dates given, and an end date', pauses[0]?.from === shift(0) && pauses[0]?.to === shift(6));
  check('and never open-ended', pauses[0]?.to !== null);
  check('the reason is kept', pauses[0]?.reason === 'Ferien');
  check('no rest day is created by any of it', restDays.length === 0);

  check('it is shown as running', await page.getByText('Läuft').isVisible());
  check('with its length', await page.getByText('7 Tage').isVisible());
  await ctx.close();
}

/* ── The rules, on the screen ───────────────────────────────────────────── */
{
  const { ctx, page } = await ready();
  await toAreas(page);
  await page.getByRole('button', { name: 'Pause planen' }).click();
  await page.waitForTimeout(400);

  // 29 days is one too many.
  await fillPause(page, shift(0), shift(28));
  check('a 29-day pause is refused, and says why',
    await page.getByText('Eine Pause dauert höchstens 28 Tage.').isVisible());
  check('and cannot be saved',
    await page.getByRole('button', { name: 'Pause sichern' }).isDisabled());

  // 28 is allowed.
  await fillPause(page, shift(0), shift(27));
  check('exactly 28 days is allowed',
    !(await page.getByRole('button', { name: 'Pause sichern' }).isDisabled()));

  // A start in the past is refused.
  await fillPause(page, shift(-1), shift(3));
  check('a pause starting yesterday is refused',
    await page.getByText('Eine Pause kann frühestens heute beginnen.').isVisible());

  await fillPause(page, shift(5), shift(1));
  check('an end before the start is refused',
    await page.getByText('Das Ende liegt vor dem Start.').isVisible());

  // Save a valid one, then try to overlap it.
  await fillPause(page, shift(10), shift(15));
  await page.getByRole('button', { name: 'Pause sichern' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Pause planen' }).click();
  await page.waitForTimeout(400);
  await fillPause(page, shift(13), shift(18));
  check('an overlapping pause is refused',
    await page.getByText('Diese Pause überschneidet sich mit einer anderen.').isVisible());
  check('and only the first one is stored', (await storedPauses(page)).pauses.length === 1);
  await ctx.close();
}

/* ── Editing, deleting, ending early ────────────────────────────────────── */
{
  const { ctx, page } = await ready();
  await toAreas(page);

  await page.getByRole('button', { name: 'Pause planen' }).click();
  await page.waitForTimeout(400);
  await fillPause(page, shift(10), shift(15));
  await page.getByRole('button', { name: 'Pause sichern' }).click();
  await page.waitForTimeout(800);

  check('a future pause is shown as planned', await page.getByText('Geplant').isVisible());
  check('and offers change and delete',
    (await page.getByRole('button', { name: 'Ändern' }).count()) === 1 &&
      (await page.getByRole('button', { name: 'Löschen' }).count()) === 1);

  await page.getByRole('button', { name: 'Ändern' }).click();
  await page.waitForTimeout(400);
  await fillPause(page, shift(12), shift(14));
  await page.getByRole('button', { name: 'Pause sichern' }).click();
  await page.waitForTimeout(800);
  const edited = await storedPauses(page);
  check('editing a future pause moves it', edited.pauses[0]?.from === shift(12));
  check('and does not create a second row', edited.pauses.length === 1);

  await page.getByRole('button', { name: 'Löschen' }).click();
  await page.waitForTimeout(800);
  check('deleting a future pause removes it', (await storedPauses(page)).pauses.length === 0);

  // A running pause: no edit/delete, but it can be ended now.
  await page.getByRole('button', { name: 'Pause planen' }).click();
  await page.waitForTimeout(400);
  await fillPause(page, shift(0), shift(20));
  await page.getByRole('button', { name: 'Pause sichern' }).click();
  await page.waitForTimeout(800);

  check('a running pause offers no delete',
    (await page.getByRole('button', { name: 'Löschen' }).count()) === 0);
  check('but it can be ended now',
    (await page.getByRole('button', { name: 'Jetzt beenden' }).count()) === 1);

  await page.getByRole('button', { name: 'Jetzt beenden' }).click();
  await page.waitForTimeout(800);
  const ended = await storedPauses(page);
  check('ending it sets the end to today, never earlier', ended.pauses[0]?.to === shift(0));
  check('and the pause itself is kept, not deleted', ended.pauses.length === 1);
  await ctx.close();
}

/* ── Today, while paused ────────────────────────────────────────────────── */
{
  const { ctx, page } = await ready();
  await toAreas(page);
  await page.getByRole('button', { name: 'Pause planen' }).click();
  await page.waitForTimeout(400);
  await fillPause(page, shift(0), shift(6));
  await page.getByRole('button', { name: 'Pause sichern' }).click();
  await page.waitForTimeout(800);

  await toToday(page);
  check('Today says it is paused', await page.getByText(/Heute ist Pause/).isVisible());
  check('and says progress still counts',
    await page.getByText(/Eintragen und Fortschritt zählen ganz normal weiter/).isVisible());

  check('the Wellbeing questions are still answerable',
    (await page.locator('.answer-boolean__option:not([disabled])').count()) > 0 ||
      (await page.locator('.answer-scale__value:not([disabled])').count()) > 0);
  check('the Gym log button is still there and enabled',
    (await page.locator('.week__log').count()) > 0 &&
      !(await page.locator('.week__log').first().isDisabled()));

  // And logging really does work while paused.
  // A workout is stored with its first saved set (D128), so log one.
  await page.locator('.week__log').first().click();
  await page.waitForTimeout(900);
  await page.locator('.gym-session__bar').getByRole('button', { name: 'Übung hinzufügen' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('textbox', { name: 'Suchen' }).fill('Bankdrücken');
  await page.waitForTimeout(350);
  await page.locator('.gym-picker__row', { hasText: 'Bankdrücken' }).first().click();
  await page.waitForTimeout(700);
  // A barbell set is complete once its load is known.
  await page.locator('.gym-set--pending input').nth(0).fill('8');
  await page.locator('.gym-set--pending input').nth(0).blur();
  await page.locator('.gym-set--pending input').nth(1).fill('60');
  await page.locator('.gym-set--pending input').nth(1).blur();
  await page.waitForTimeout(900);
  const logged = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('momentum');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return new Promise((res, rej) => {
      const r = db.transaction(['gymSessions'], 'readonly').objectStore('gymSessions').getAll();
      r.onsuccess = () => res(r.result.length);
      r.onerror = () => rej(r.error);
    });
  });
  check('a session logged during a pause is stored normally', logged >= 1, String(logged));
  check('and nothing became a modal state — the tab bar still works',
    (await page.locator('.tab-bar__tab').count()) === 4);
  await ctx.close();
}

/* ── Four widths ────────────────────────────────────────────────────────── */
for (const width of [320, 360, 393, 430]) {
  const { ctx, page } = await ready({ viewport: { width, height: 820 } });
  await toAreas(page);
  await page.getByRole('button', { name: 'Pause planen' }).click();
  await page.waitForTimeout(400);
  await fillPause(page, shift(0), shift(13), 'Ferien');
  await page.getByRole('button', { name: 'Pause sichern' }).click();
  await page.waitForTimeout(800);

  const clip = await clipped(page);
  check(`the pause section is not clipped at ${width}px`, clip.length === 0, clip.slice(0, 2).join('; '));
  const small = await smallTargets(page);
  check(`its targets hold at ${width}px`, small.length === 0, small.slice(0, 2).join('; '));
  const noScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  check(`the page does not scroll sideways at ${width}px`, noScroll);

  await page.getByRole('button', { name: 'Pause planen' }).click();
  await page.waitForTimeout(400);
  const formClip = await clipped(page);
  check(`the date form is not clipped at ${width}px`, formClip.length === 0, formClip.slice(0, 2).join('; '));

  await toToday(page);
  const todayClip = await clipped(page);
  check(`the paused status line is not clipped at ${width}px`, todayClip.length === 0,
    todayClip.slice(0, 2).join('; '));
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
