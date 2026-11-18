import { URL_APP, check, launch, onboard, passOpening, phone, seed, seedTraining, summary } from './lib.mjs';

/**
 * Back closes every sheet, and a sheet with fields loses nothing typed
 * (the tidy-up of WP3, D187).
 *
 * Until now Back — the gesture from the edge of an iPhone, the button of a
 * browser — closed the muscle sheet and the exercise detail (D185) and left
 * the screen under every other sheet. Now every sheet owns a history entry
 * with the address of the screen it lies on.
 *
 * **A sheet without fields**: opened, Back closes it, the address is the
 * one it was opened on and the screen beneath still stands — and a second
 * Back then leaves the screen, so no entry was left behind.
 *
 * **A sheet with fields**: text is typed into every field, Back closes the
 * sheet, and opened again for the same thing the text stands there. Then
 * its cross closes it, and opened once more it is as stored — the sheet's
 * own way out still discards, as it always did.
 *
 * The muscle sheet and the exercise detail are `muscle-sheet.mjs`'s; they
 * are not walked again here.
 *
 * Run against the production preview (`vite preview --port 4173`).
 */

const WIDTHS = (process.env.WIDTHS ?? '393,320').split(',').map(Number);
const HEIGHT = { 320: 693, 360: 780, 393: 852, 430: 932 };
const browser = await launch();

const tab = (page, name) => page.locator('.tab-bar button', { hasText: name });
const hash = (page) => page.evaluate(() => window.location.hash);
const dialogs = (page) => page.locator('[role="dialog"]:not([inert])').count();
const title = async (page) => ((await page.locator('[role="dialog"] .sheet__title').last().textContent().catch(() => '')) ?? '').trim();

async function seedPlan(page) {
  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const stamp = new Date().toISOString();
    await new Promise((res, rej) => {
      const tx = db.transaction(['gymPlans'], 'readwrite');
      tx.objectStore('gymPlans').put({ id: 'back-plan', kind: 'userTrainingPlan', version: 1, name: 'Push A', exercises: [
        { exerciseId: 'ex_bench_press', name: 'Bench Press', order: 0 }], createdAt: stamp, updatedAt: stamp });
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
  });
}

/** Back, as the gesture and the button make it, and the time a sheet takes to go. */
async function back(page) {
  await page.goBack();
  await page.waitForTimeout(500);
}

/**
 * A sheet without fields: Back closes it and leaves the screen.
 * `stays` is something of the screen beneath that must still stand.
 */
async function backCloses(page, label, { open, name, stays }) {
  const before = await hash(page);
  await open();
  await page.waitForTimeout(600);
  const opened = (await dialogs(page)) === 1 && (name === undefined || (await title(page)) === name);
  check(`${label}: the sheet opens`, opened, `${await dialogs(page)} dialog(s), «${await title(page)}»`);
  if (!opened) return;
  check(`${label}: the address is still the screen's`, (await hash(page)) === before, `${before} → ${await hash(page)}`);
  await back(page);
  check(`${label}: Back closes the sheet`, (await dialogs(page)) === 0, `${await dialogs(page)} dialog(s)`);
  check(`${label}: and the screen stands where it stood`, (await hash(page)) === before && (await page.locator(stays).first().isVisible()), `${before} → ${await hash(page)}`);
}

/**
 * A sheet with fields: what is typed stands again after Back, and the
 * sheet's cross still discards it. `fields` maps a selector to the text
 * typed and to what the field holds when nothing was typed.
 */
async function keepsTyped(page, label, { open, name, fields, stays }) {
  const before = await hash(page);
  await open();
  await page.waitForTimeout(600);
  const opened = (await dialogs(page)) === 1 && (name === undefined || (await title(page)) === name);
  check(`${label}: the sheet opens`, opened, `${await dialogs(page)} dialog(s), «${await title(page)}»`);
  if (!opened) return;
  for (const [selector, { text }] of Object.entries(fields)) {
    await page.locator(`.sheet ${selector}`).fill(text);
    await page.waitForTimeout(120);
  }
  await back(page);
  check(`${label}: Back closes the sheet`, (await dialogs(page)) === 0, `${await dialogs(page)} dialog(s)`);
  check(`${label}: and the screen stands where it stood`, (await hash(page)) === before && (await page.locator(stays).first().isVisible()), `${before} → ${await hash(page)}`);

  await open();
  await page.waitForTimeout(600);
  for (const [selector, { text }] of Object.entries(fields)) {
    const value = await page.locator(`.sheet ${selector}`).inputValue().catch(() => null);
    check(`${label}: ${selector} holds what was typed before Back`, value === text, `«${value}», typed «${text}»`);
  }

  // The sheet's own way out is a decision about what was typed.
  await page.locator('[role="dialog"] .sheet__close').last().click();
  await page.waitForTimeout(500);
  check(`${label}: the cross closes it, and the address did not move`, (await dialogs(page)) === 0 && (await hash(page)) === before, await hash(page));
  await open();
  await page.waitForTimeout(600);
  for (const [selector, { stored }] of Object.entries(fields)) {
    const value = await page.locator(`.sheet ${selector}`).inputValue().catch(() => null);
    check(`${label}: ${selector} is as stored after the cross`, value === stored, `«${value}», stored «${stored}»`);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ ...phone, viewport: { width, height: HEIGHT[width] ?? 852 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  /* ── The onboarding's own question ─────────────────────────────────── */
  {
    const L = `${width} onboarding, a question of one's own`;
    await passOpening(page);
    for (let i = 0; i < 3; i += 1) {
      await page.locator('.onboarding__footer .button--primary').click();
      await page.waitForTimeout(250);
    }
    await page.locator('.world-tile--choice').first().click();
    await page.locator('.onboarding__footer .button--primary').click();
    await page.waitForTimeout(300);
    const onQuestions = (await page.locator('.onboarding[data-step="questions"]').count()) === 1;
    check(`${L}: the flow stands on its questions`, onQuestions);
    if (onQuestions) {
      await keepsTyped(page, L, {
        open: () => page.locator('.question-pick--custom').click(),
        name: 'Neue Frage',
        fields: { '#question-text': { text: 'Habe ich heute gelesen?', stored: '' } },
        stays: '.onboarding[data-step="questions"]',
      });
    }
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
  }

  await onboard(page, { gym: 3, running: 2 });
  await seed(page, { days: 30 });
  await seedTraining(page, { days: 30 });
  await seedPlan(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  /* ── Sheets without fields ─────────────────────────────────────────── */

  // Heute: the plan chooser.
  await backCloses(page, `${width} plan chooser (Heute)`, {
    open: () => page.getByRole('button', { name: 'Session eintragen' }).first().click(),
    name: undefined,
    stays: '.tab-bar',
  });
  check(`${width} plan chooser (Heute): no workout opened behind it`, (await page.locator('.gym-session').count()) === 0);

  // Rang: what the weighting means.
  await tab(page, 'Rang').click();
  await page.waitForTimeout(900);
  await backCloses(page, `${width} weighting (Rang)`, {
    open: () => page.locator('.boss-weights__info').click(),
    name: 'Gewichtung',
    stays: '.boss-weights__info',
  });

  // Bereiche › Mind: the standing's detail and the credits.
  await tab(page, 'Bereiche').click();
  await page.waitForTimeout(900);
  await page.getByRole('radio', { name: 'Mind', exact: true }).click();
  await page.waitForTimeout(900);
  const standing = page.locator('[data-metric="mental-standing"]').first();
  if ((await standing.count()) === 1) {
    await backCloses(page, `${width} Mind's standing (Bereiche)`, {
      open: () => standing.click(),
      stays: '[data-metric="mental-standing"]',
    });
  } else check(`${width} Mind's standing (Bereiche): the tile is there to open`, false);
  await backCloses(page, `${width} credits (Bereiche)`, {
    open: () => page.getByRole('button', { name: /3D-Körpermodell/ }).click(),
    name: 'Danksagungen',
    stays: '.areas__scroll',
  });

  // Bereiche › Gym: the rating's detail and the plan chooser of the hub.
  await page.getByRole('radio', { name: 'Gym', exact: true }).click();
  await page.waitForTimeout(1500);
  const rating = page.locator('[data-metric="gym-rating"]').first();
  if ((await rating.count()) === 1) {
    await backCloses(page, `${width} Gym rating (hub)`, {
      open: () => rating.click(),
      stays: '[data-metric="gym-rating"]',
    });
  } else check(`${width} Gym rating (hub): the tile is there to open`, false);
  check(`${width}: after all of it the hub is still the hub`, (await hash(page)) === '#/areas/gym', await hash(page));

  // Muskelgruppen: the legend, over the body.
  await page.getByRole('button', { name: 'Muskelgruppen öffnen' }).click();
  await page.waitForTimeout(3500);
  await backCloses(page, `${width} legend (Muskelgruppen)`, {
    open: () => page.getByRole('button', { name: 'Legende öffnen' }).click(),
    stays: '.muscle-row',
  });
  // One more Back leaves Muskelgruppen for the hub: no entry was left behind.
  await back(page);
  await page.waitForTimeout(900);
  check(`${width}: a second Back leaves Muskelgruppen for the hub — no entry is left behind`, (await hash(page)) === '#/areas/gym', await hash(page));

  /* ── Sheets with fields ────────────────────────────────────────────── */

  // A new question, and an existing one.
  await page.getByRole('radio', { name: 'Mind', exact: true }).click();
  await page.waitForTimeout(900);
  await keepsTyped(page, `${width} new question`, {
    open: () => page.locator('.areas__scroll').getByRole('button', { name: 'Frage hinzufügen' }).first().click(),
    name: 'Neue Frage',
    fields: { '#question-text': { text: 'Habe ich heute gelesen?', stored: '' } },
    stays: '.areas__scroll',
  });
  await keepsTyped(page, `${width} question edit`, {
    open: () => page.locator('.areas__scroll').getByRole('button', { name: /Wie gut hast du gesch/ }).first().click(),
    name: 'Frage bearbeiten',
    fields: { '#question-text': { text: 'Wie gut hast du diese Nacht geschlafen?', stored: 'Wie gut hast du geschlafen?' } },
    stays: '.areas__scroll',
  });
  const questions = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const rows = await new Promise((res, rej) => { const r = db.transaction(['questions'], 'readonly').objectStore('questions').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return rows.map((row) => row.text);
  });
  check(`${width}: nothing typed and taken back reached storage`, !questions.some((text) => /gelesen|diese Nacht/.test(text)), questions.join(' | '));

  // The run sheet on Heute.
  await tab(page, 'Heute').click();
  await page.waitForTimeout(800);
  const card = page.locator('.card').filter({ has: page.getByRole('button', { name: 'Lauf eintragen' }) });
  await card.getByRole('button', { name: 'Lauf eintragen' }).click();
  await page.waitForTimeout(1200);
  await keepsTyped(page, `${width} run sheet`, {
    open: () => card.locator('button.row--tappable').first().click(),
    name: 'Training',
    fields: {
      '#session-distance': { text: '7,5', stored: '' },
      '#session-duration': { text: '42', stored: '' },
      '#session-note': { text: 'Am See entlang', stored: '' },
    },
    stays: '.tab-bar',
  });

  // The exercise picker in a workout: its search, and the form of an
  // exercise of one's own.
  await page.getByRole('button', { name: 'Session eintragen' }).first().click();
  await page.waitForTimeout(900);
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Freie Session' }).click();
  await page.waitForTimeout(900);
  const workout = (await page.locator('.gym-session').count()) === 1;
  check(`${width} workout: the workout is open`, workout);
  if (workout) {
    const opener = page.locator('.gym-session__bar').getByRole('button', { name: 'Übung hinzufügen' });
    await keepsTyped(page, `${width} exercise picker (workout)`, {
      open: () => opener.click(),
      name: 'Übung wählen',
      fields: { '#exercise-search': { text: 'Kabelzug', stored: '' } },
      stays: '.gym-session',
    });
    // The form of one's own exercise: opened, named, Back — and it stands
    // again as it was left, form and name.
    await opener.click();
    await page.waitForTimeout(500);
    await page.locator('.sheet__footer').getByRole('button', { name: 'Eigene Übung' }).click();
    await page.waitForTimeout(500);
    await page.locator('.sheet #exercise-name').fill('Frontdrücken eng');
    await back(page);
    check(`${width} own exercise: Back closes the picker and the workout stands`, (await dialogs(page)) === 0 && (await page.locator('.gym-session').count()) === 1);
    await opener.click();
    await page.waitForTimeout(600);
    const name = await page.locator('.sheet #exercise-name').inputValue().catch(() => null);
    check(`${width} own exercise: the form stands again with the name typed before Back`, name === 'Frontdrücken eng', `«${name}»`);
    await page.locator('[role="dialog"] .sheet__close').last().click();
    await page.waitForTimeout(500);
    await opener.click();
    await page.waitForTimeout(600);
    check(`${width} own exercise: after the cross the picker opens on its search, empty`,
      (await page.locator('.sheet #exercise-name').count()) === 0 && (await page.locator('.sheet #exercise-search').inputValue().catch(() => null)) === '');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    check(`${width} workout: nothing was written by any of it`, (await page.evaluate(async () => {
      const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const rows = await new Promise((res, rej) => { const r = db.transaction(['exercises'], 'readonly').objectStore('exercises').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      return rows.filter((row) => /Frontdrücken/.test(row.name)).length;
    })) === 0);
  }

  check(`${width}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
