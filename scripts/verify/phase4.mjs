import { chromium } from 'playwright-core';
import { URL_APP, check, summary, phone, onboard, clipped, smallTargets, openMuscles } from './lib.mjs';
import { inSheet } from './lib.mjs';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function ready(opts = {}, setup = {}) {
  const ctx = await browser.newContext({ ...phone, ...opts });
  const page = await ctx.newPage();
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await onboard(page, { gym: 3, running: 0, ...setup });
  return { ctx, page };
}

/** Opens the gym session from Today. */
async function openGym(page) {
  await page.getByRole('button', { name: 'Session eintragen' }).click();
  await page.waitForTimeout(700);
}

/**
 * Since WP2-1 the picker shows a built-in under its German catalogue name
 * while the search still matches the stored English one, so the search
 * narrows by the English name and the first row is the one wanted.
 */
async function addExercise(page, name) {
  await page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('textbox', { name: 'Suchen' }).fill(name);
  await page.waitForTimeout(300);
  await page.locator('.gym-picker__row').first().click();
  await page.waitForTimeout(600);
}

/** Fills the nth set of the first exercise on screen. */
async function fillSet(page, index, reps, weight) {
  const row = page.locator('.gym-set').nth(index);
  await row.locator('input').first().fill(String(reps));
  await row.locator('input').first().blur();
  await page.waitForTimeout(350);
  await row.locator('input').nth(1).fill(String(weight));
  await row.locator('input').nth(1).blur();
  await page.waitForTimeout(350);
}

{
  const { ctx, page } = await ready();

  /* ── Empty state ──────────────────────────────────────────────────────── */
  await openGym(page);
  check('an empty session says what to do', await page.getByText('Noch keine Übung').isVisible());
  let clip = await clipped(page);
  check('the empty session is not clipped', clip.length === 0, clip.slice(0, 2).join('; '));

  /* ── Picker ───────────────────────────────────────────────────────────── */
  await page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
  await page.waitForTimeout(500);
  const groupLabels = await page.locator('.gym-picker__groups').allTextContents();
  check('the picker lists exercises with their muscle groups',
    (await page.locator('.gym-picker__row').count()) > 10 &&
    groupLabels.every((text) => text.trim().length > 0) &&
    groupLabels.some((text) => text.includes('Brust')),
    groupLabels.slice(0, 2).join(' | '));
  await page.getByRole('textbox', { name: 'Suchen' }).fill('Squat');
  await page.waitForTimeout(300);
  check('search narrows the list', (await page.locator('.gym-picker__row').count()) === 1);
  check('a custom exercise is offered',
    await page.getByRole('button', { name: 'Eigene Übung' }).isVisible());
  await page.locator('.gym-picker__row').first().click();
  await page.waitForTimeout(700);

  /* ── One exercise, several sets ───────────────────────────────────────── */
  check('picking an exercise leaves a set ready to fill',
    (await page.locator('.gym-set').count()) === 1);
  await fillSet(page, 0, 10, 10);
  await page.getByRole('button', { name: /Satz zu .* hinzufügen/ }).click();
  await page.waitForTimeout(600);
  check('the next set is prefilled from the last one',
    (await page.locator('.gym-set').nth(1).locator('input').first().inputValue()) === '10');
  await fillSet(page, 1, 8, 15);
  await page.getByRole('button', { name: /Satz zu .* hinzufügen/ }).click();
  await page.waitForTimeout(600);
  await fillSet(page, 2, 6, 20);

  const best = await page.locator('.gym-exercise__best').first().textContent();
  check('the best set is the decision’s answer, 8 × 15', /8 × 15/.test(best ?? ''), best?.trim());

  await fillSet(page, 2, 6, 22.5);
  const decimal = await page.locator('.gym-set').nth(2).locator('input').nth(1).inputValue();
  check('a decimal weight survives a round trip', decimal === '22.5', decimal);
  clip = await clipped(page);
  check('a session with several sets is not clipped', clip.length === 0, clip.slice(0, 2).join('; '));

  /* ── A second exercise, and a long name ───────────────────────────────── */
  await addExercise(page, 'Romanian Deadlift');
  check('a second exercise is added below the first',
    (await page.locator('.gym-exercise__name').count()) === 2);
  await fillSet(page, 3, 8, 60);
  clip = await clipped(page);
  check('two exercises are not clipped', clip.length === 0, clip.slice(0, 2).join('; '));

  let small = await smallTargets(page);
  check('every control in the session is a real target', small.length === 0, small.slice(0, 3).join('; '));

  /* ── Removing ─────────────────────────────────────────────────────────── */
  await page.getByRole('button', { name: /Satz 3 von .* entfernen/ }).click();
  await page.waitForTimeout(700);
  check('a set can be removed', (await page.locator('.gym-set').count()) === 3);

  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.waitForTimeout(800);
  check('finishing returns to Today', await page.locator('.boss-summary').isVisible());
  check('and the week counts the session',
    /1 \/ 3/.test((await page.locator('.week__value').first().textContent()) ?? ''));

  await ctx.close();
}

/* ── Progress, body renderer and exercise history ───────────────────────── */
{
  const { ctx, page } = await ready();
  let clip = [];
  await openGym(page);
  await addExercise(page, 'Bench Press');
  await fillSet(page, 0, 8, 60);
  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.waitForTimeout(600);

  // A second day, so there is something to compare.
  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (s) => new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const put = (s, recs) => new Promise((res, rej) => { const tx = db.transaction([s], 'readwrite'); for (const rec of recs) tx.objectStore(s).put(rec); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    const pad = (n) => String(n).padStart(2, '0');
    const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const back = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
    const isoWeek = (d) => { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3); const y = t.getFullYear(); const f = new Date(y, 0, 4, 12); f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3); return `${y}-W${pad(1 + Math.round((t - f) / (7 * 86400000)))}`; };
    const snaps = await all('configSnapshots');
    const settings = await all('settings');
    const origin = key(back(30));
    await put('configSnapshots', snaps.map((s, i) => (i === 0 ? { ...s, effectiveFrom: origin } : s)));
    await put('settings', [{ ...settings[0], firstUseDate: origin }]);
    // An older bench day at 50 kg, and an older squat day so a second group exists.
    const earlier = key(back(14));
    const at = new Date(back(14).setHours(18, 0, 0, 0)).toISOString();
    await put('gymSessions', [{ id: 'g_old', date: earlier, weekKey: isoWeek(back(14)), performedAt: at, planId: null, note: null, legacyCarryOver: false, configSnapshotId: snaps[0].id, createdAt: at, updatedAt: at }]);
    await put('gymSets', [
      { id: 's_old1', sessionId: 'g_old', exerciseId: 'ex_bench_press', date: earlier, weightGrams: 50000, reps: 8, order: 0, muscles: ['chest', 'triceps'], createdAt: at },
      { id: 's_old2', sessionId: 'g_old', exerciseId: 'ex_squat', date: earlier, weightGrams: 100000, reps: 5, order: 1, muscles: ['quadriceps', 'hamstringsGlutes'], createdAt: at },
    ]);
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
  await page.waitForTimeout(1200);
  // The Gym area opens on its hub (WP2-2); the hierarchy is on Muskelgruppen.
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(900);
  check('the hub offers the muscle groups as a named destination', await page.getByRole('button', { name: 'Muskelgruppen öffnen' }).isVisible());
  await openMuscles(page, { wait: 1500 });

  check('Progress shows the Gym hierarchy', await page.locator('[data-metric="gym-overall"]').isVisible());
  const counted = await page.locator('[data-metric="gym-overall"] .metric-tile__line').textContent();
  check('it says how many groups were counted', /von 10 Gruppen/.test(counted ?? ''), counted?.trim());
  const overallSheet = await inSheet(page, 'gym-overall', async (sheet) => ({
    weighting: await sheet.getByText(/Jede Muskelgruppe zählt gleich viel/).isVisible(),
    metric: await sheet.getByText(/bester Satz des Tages/).isVisible(),
    text: await sheet.locator('.sheet__body').textContent(),
  }));
  check('it explains the equal weighting', overallSheet.weighting);
  check('it names the metric', overallSheet.metric);
  // Phase 4.1 replaced this copy: performance now feeds the rating, and what
  // the screen has to keep separate is development from absolute strength.
  check('it says what the Gym rating actually measures',
    /40 % Anwesenheit, 60 % persönliche Leistungsentwicklung/.test(overallSheet.text ?? ''));
  check('it keeps the Tombstone boundary visible',
    /Absolute Bestleistungen gehören zu den Meilensteinen/.test(overallSheet.text ?? ''));

  // Since the muscle map the body is drawn in 3D and the groups are rows
  // beneath it; the flat figure is the stand-in when WebGL is missing.
  check('the muscle module draws a body', (await page.locator('.muscle-module').count()) === 1);
  const legend = await page.locator('.muscle-row').count();
  check('and lists all ten groups', legend === 10, String(legend));
  const chestState = await page.locator('.muscle-row', { hasText: 'Brust' }).textContent();
  check('an improved group says so with a signed number', /\+\d+ %/.test(chestState ?? ''), chestState?.trim());
  const calfState = await page.locator('.muscle-row', { hasText: 'Waden' }).textContent();
  check('an untrained group is told apart from a declining one',
    /Noch nicht trainiert/.test(calfState ?? ''), calfState?.trim());

  await page.locator('.muscle-row__button', { hasText: 'Brust' }).click();
  await page.waitForTimeout(500);
  check('selecting a group filters the exercises below it',
    (await page.locator('.gym-progress__row').count()) === 1);

  await page.locator('.gym-progress__row').first().click();
  await page.waitForTimeout(600);
  check('an exercise opens its own history',
    await page.getByRole('heading', { name: 'Bankdrücken' }).isVisible());
  check('the history shows the best-set comparison',
    (await page.locator('.gym-detail__value').first().textContent())?.includes('×'));
  clip = await clipped(page);
  check('the exercise history is not clipped', clip.length === 0, clip.slice(0, 2).join('; '));

  // The detail's own back, not the Muskelgruppen screen's beneath it.
  await page.locator('.gym-detail .gym-session__back').click();
  await page.waitForTimeout(500);

  await page.locator('.tab-bar button', { hasText: 'Rang' }).click();
  await page.waitForTimeout(900);
  const gymRow = await page.locator('.domain-standing', { hasText: 'Gym' }).textContent();
  check('Gym has a rating of its own on the Rank screen', /von 1000/.test(gymRow ?? ''), gymRow?.trim());
  check('Food is not listed: it left the product (D139)',
    (await page.locator('.domain-standing', { hasText: 'Ernährung' }).count()) === 0);

  await ctx.close();
}

/* ── Widths ─────────────────────────────────────────────────────────────── */
for (const width of [320, 360, 393, 430]) {
  const { ctx, page } = await ready({ viewport: { width, height: 780 } });
  await openGym(page);
  await addExercise(page, 'Romanian Deadlift');
  await fillSet(page, 0, 12, 102.5);
  await page.getByRole('button', { name: /Satz zu .* hinzufügen/ }).click();
  await page.waitForTimeout(600);

  let clip = await clipped(page);
  check(`the session is not clipped at ${width}px`, clip.length === 0, clip.slice(0, 3).join('; '));
  let small = await smallTargets(page);
  check(`session targets hold at ${width}px`, small.length === 0, small.slice(0, 3).join('; '));
  const shown = await page.locator('.gym-set').first().locator('input').nth(1).inputValue();
  check(`a decimal weight stays readable at ${width}px`, shown === '102.5', shown);

  await page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
  await page.waitForTimeout(500);
  clip = await clipped(page);
  check(`the picker is not clipped at ${width}px`, clip.length === 0, clip.slice(0, 3).join('; '));
  small = await smallTargets(page);
  check(`picker targets hold at ${width}px`, small.length === 0, small.slice(0, 3).join('; '));
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
