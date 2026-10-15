import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { URL_APP, check, onboard, phone, summary } from './lib.mjs';

/**
 * WP3 Stage 1, B1 — typing into every sheet, on the real production build.
 *
 * The bug: the Sheet's focus effect depended on an inline `onClose`, so each
 * keystroke that re-rendered the caller ran its cleanup (focus back behind
 * the sheet) and then moved focus to the close button. After one letter,
 * typing went nowhere.
 *
 * So the text here is typed with `page.keyboard`, one character per call,
 * into whatever has focus — never with `fill` or `pressSequentially`, which
 * focus the element themselves on every call and would hide exactly that
 * bug. After each character the field must hold the typed prefix *and*
 * still be `document.activeElement`.
 *
 * Every sheet is also opened without touching its field first, so the focus
 * it lands on is the sheet's own choice: the marked field where there is one
 * (exercise search, question text), the custom-name field after "Eigene
 * Übung", and otherwise the dialog itself — never "Schliessen". Escape must
 * close each sheet and put focus back on the control that opened it; where
 * it lands elsewhere, the check says where.
 *
 * Every sheet is typed into at 393, 430 and 320; screenshots of each one
 * mid-typing go to docs/design/wp3/stage1.
 */
const OUT = process.env.OUT ?? 'docs/design/wp3/stage1';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/** Settle time after each character: long enough for a passive effect to run. */
const PER_KEY_MS = 140;

/** A short description of an element, for evidence. Runs in the page. */
const DESCRIBE_SRC = `(el) => {
  if (!el) return 'null';
  if (el === document.body) return 'body';
  let s = el.tagName.toLowerCase();
  if (el.id) s += '#' + el.id;
  const cls = typeof el.className === 'string' ? el.className.trim() : '';
  if (cls) s += '.' + cls.split(/\\s+/).join('.');
  const role = el.getAttribute('role');
  if (role) s += '[role=' + role + ']';
  const aria = el.getAttribute('aria-label');
  if (aria) s += '[aria-label="' + aria + '"]';
  const text = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 30);
  if (!el.id && !aria && text && el.tagName !== 'DIV') s += ' "' + text + '"';
  return s;
}`;

/** What has focus right now, and where it is. */
async function activeInfo(page) {
  return page.evaluate((src) => {
    const describe = eval(src);
    const a = document.activeElement;
    const dialog = a?.closest?.('[role="dialog"]') ?? null;
    return {
      desc: describe(a),
      isBody: a === document.body || a === null,
      connected: Boolean(a?.isConnected),
      inDialog: dialog !== null,
      isDialog: a?.matches?.('.sheet[role="dialog"]') ?? false,
      dialogLabel: (a?.matches?.('[role="dialog"]') ? a : dialog)?.getAttribute('aria-label') ?? null,
      isClose: a?.matches?.('.sheet__close') ?? false,
      initialMarked: a?.hasAttribute?.('data-sheet-initial-focus') ?? false,
    };
  }, DESCRIBE_SRC);
}

/** The field's value and whether it is the focused element, resolved fresh. */
async function fieldState(field) {
  try {
    return await field.evaluate((el, src) => {
      const describe = eval(src);
      return { value: el.value, focused: el === document.activeElement, active: describe(document.activeElement) };
    }, DESCRIBE_SRC, { timeout: 3000 });
  } catch (error) {
    return { value: null, focused: false, active: `field not found (${String(error).split('\n')[0]})` };
  }
}

/**
 * Types `text` one character per call into whatever has focus, asserting
 * after each character that `field` holds the prefix and still has focus.
 * Optionally screenshots once, after the character at `shotAt`.
 */
async function typeLetters(page, label, field, text, { shot, shotAt } = {}) {
  let prefix = '';
  const at = shotAt ?? Math.max(0, Math.ceil(text.length / 2) - 1);
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    await page.keyboard.type(ch);
    prefix += ch;
    await page.waitForTimeout(PER_KEY_MS);
    const s = await fieldState(field);
    check(
      `${label}: after "${prefix}" the field holds it and still has focus`,
      s.value === prefix && s.focused,
      s.value === prefix && s.focused ? '' : `value=${JSON.stringify(s.value)} focused=${s.focused} active=${s.active}`,
    );
    if (shot && i === at) await page.screenshot({ path: shot });
  }
}

/** The sheet is open and focus landed on the marked field, before any click. */
async function assertFocusedOnOpen(page, label, field, { title }) {
  const dialogs = page.locator('.sheet[role="dialog"]');
  const count = await dialogs.count();
  const shownTitle = count === 1 ? await dialogs.first().getAttribute('aria-label') : null;
  check(`${label}: the sheet opened ("${title}")`, count === 1 && shownTitle === title, `${count} dialog(s), aria-label=${shownTitle}`);
  const info = await activeInfo(page);
  const s = await fieldState(field);
  check(
    `${label}: on open, focus is in the field without a click`,
    s.focused && info.inDialog && !info.isClose,
    `active=${info.desc}`,
  );
}

/** The sheet is open and focus is on the dialog itself, not on Schliessen. */
async function assertDialogFocused(page, label, { title }) {
  const dialogs = page.locator('.sheet[role="dialog"]');
  const count = await dialogs.count();
  const shownTitle = count === 1 ? await dialogs.first().getAttribute('aria-label') : null;
  check(`${label}: the sheet opened ("${title}")`, count === 1 && shownTitle === title, `${count} dialog(s), aria-label=${shownTitle}`);
  const info = await activeInfo(page);
  check(
    `${label}: on open, focus is on the dialog itself`,
    info.isDialog && info.dialogLabel === title,
    `active=${info.desc}`,
  );
  check(`${label}: on open, focus is not on the close button`, !info.isClose, `active=${info.desc}`);
}

/**
 * Escape closes the sheet, and focus goes back to the control that opened
 * it. Where it lands elsewhere — outside the dialog, still in the document —
 * the check passes as the documented fallback and says where; focus lost to
 * the body, or left in a dialog, fails.
 */
async function assertEscapeReturns(page, label, opener) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const open = await page.locator('.sheet[role="dialog"]').count();
  check(`${label}: Escape closes the sheet`, open === 0, `${open} dialog(s) still open`);
  const info = await activeInfo(page);
  let onOpener = false;
  try {
    onOpener = await opener.evaluate((el) => el === document.activeElement, undefined, { timeout: 2000 });
  } catch {
    onOpener = false;
  }
  const fallback = !onOpener && info.connected && !info.isBody && !info.inDialog;
  check(
    `${label}: Escape returns focus outside the sheet`,
    onOpener || fallback,
    onOpener ? `on the opener: ${info.desc}` : fallback ? `NOT the opener — on ${info.desc}` : `focus lost: ${info.desc}`,
  );
  return { onOpener, active: info.desc };
}

async function boot(width, height) {
  const ctx = await browser.newContext({ ...phone, viewport: { width, height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await onboard(page, { gym: 3, running: 2, food: true });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return { ctx, page, errors };
}

const tab = (page, name) => page.locator('.tab-bar button', { hasText: name });

/* ── 1 + 3: the exercise picker in a workout ──────────────────────────── */
async function workoutPicker(page, w, { custom, shot }) {
  const L = `${w} workout picker`;
  await tab(page, 'Heute').click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Session eintragen' }).click();
  await page.waitForTimeout(900);
  // A saved plan would bring the chooser first; the free session is offered there.
  const chooser = page.locator('[role="dialog"]').filter({ has: page.getByRole('button', { name: 'Freie Session' }) });
  if ((await chooser.count()) === 1) {
    await chooser.getByRole('button', { name: 'Freie Session' }).click();
    await page.waitForTimeout(900);
  }
  check(`${L}: the workout screen is open`, (await page.locator('.gym-session').count()) === 1);

  const opener = page.locator('.gym-session__scroll').getByRole('button', { name: 'Übung hinzufügen' }).first();
  await opener.click();
  await page.waitForTimeout(500);
  const search = page.locator('.sheet #exercise-search');
  await assertFocusedOnOpen(page, L, search, { title: 'Übung wählen' });
  check(`${L}: the focused field is the one marked for it`, (await activeInfo(page)).initialMarked);
  await typeLetters(page, `${L} search`, search, 'Bankdrücken', { shot });
  const rows = await page.locator('.gym-picker__row .gym-picker__name').allTextContents();
  check(`${L}: the typed search filters the list`, rows.includes('Bankdrücken'), rows.slice(0, 4).join('|'));
  const escaped = await assertEscapeReturns(page, L, opener);

  if (custom) {
    const C = `${w} custom exercise`;
    await opener.click();
    await page.waitForTimeout(500);
    await assertFocusedOnOpen(page, `${C} (picker)`, search, { title: 'Übung wählen' });
    check(`${C}: the search opens empty again`, (await fieldState(search)).value === '');
    await page.locator('.sheet__footer').getByRole('button', { name: 'Eigene Übung' }).click();
    await page.waitForTimeout(500);
    const nameField = page.locator('.sheet #exercise-name');
    const info = await activeInfo(page);
    const s = await fieldState(nameField);
    check(`${C}: "Eigene Übung" moves focus to the name field by itself`, s.focused && info.inDialog, `active=${info.desc}`);
    await typeLetters(page, `${C} name`, nameField, 'Frontdrücken eng', { shot: custom.shot });
    await assertEscapeReturns(page, C, opener);
  }

  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.waitForTimeout(800);
  return escaped;
}

/* ── 6: the run sheet from Heute ──────────────────────────────────────── */
async function runSheet(page, w, { shot }) {
  const L = `${w} run sheet`;
  await tab(page, 'Heute').click();
  await page.waitForTimeout(700);
  const card = page.locator('.card').filter({ has: page.getByRole('button', { name: 'Lauf eintragen' }) });
  const rows = card.locator('button.row--tappable');
  const before = await rows.count();
  await card.getByRole('button', { name: 'Lauf eintragen' }).click();
  await page.waitForTimeout(1200);
  const after = await rows.count();
  check(`${L}: one tap on "Lauf eintragen" logs one run`, after === before + 1, `${before} → ${after}`);

  const opener = rows.first();
  await opener.click();
  await page.waitForTimeout(600);
  await assertDialogFocused(page, L, { title: 'Training' });

  const distance = page.locator('.sheet #session-distance');
  const duration = page.locator('.sheet #session-duration');
  const note = page.locator('.sheet #session-note');
  check(`${L}: the sheet is the run's — distance, duration and note are there`,
    (await distance.count()) === 1 && (await duration.count()) === 1 && (await note.count()) === 1);

  await distance.click();
  await page.waitForTimeout(250);
  await typeLetters(page, `${L} distance`, distance, '5.2');
  await duration.click();
  await page.waitForTimeout(250);
  await typeLetters(page, `${L} duration`, duration, '31');
  const pace = ((await page.locator('.sheet .session-sheet__hint[role="status"]').textContent().catch(() => '')) ?? '').trim();
  check(`${L}: the pace follows the two typed numbers`, pace === 'Tempo 5:58 min/km', pace);
  await note.click();
  await page.waitForTimeout(250);
  await typeLetters(page, `${L} note`, note, 'Locker', { shot, shotAt: 2 });
  return assertEscapeReturns(page, L, opener);
}

/* ══ 393 × 852, 430 × 932 and 320 × 693: every sheet ════════════════════ */
for (const [w, h] of [[393, 852], [430, 932], [320, 693]]) {
  const shot = (n, slug) => `${OUT}/wp3-sheets-${w}-${n}-${slug}.png`;
  const { ctx, page, errors } = await boot(w, h);

  // 1 and 3: the workout picker, then its custom-exercise form.
  await workoutPicker(page, w, {
    shot: shot(1, 'workout-search'),
    custom: { shot: shot(3, 'custom-exercise') },
  });

  // 2: the plan editor's name field, and its picker.
  {
    const L = `${w} plan editor`;
    await tab(page, 'Bereiche').click();
    await page.waitForTimeout(600);
    await page.getByRole('radio', { name: 'Gym', exact: true }).click();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Pläne verwalten' }).click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Neuer Plan' }).click();
    await page.waitForTimeout(700);
    check(`${L}: Neuer Plan opens the editor`, (await page.locator('.plan-editor').count()) === 1);

    const planName = page.locator('#plan-name');
    await planName.click();
    await page.waitForTimeout(250);
    await typeLetters(page, `${L} name`, planName, 'Push A', { shot: shot(2, 'plan-name') });

    const opener = page.locator('.plan-editor').getByRole('button', { name: 'Übung hinzufügen' });
    await opener.click();
    await page.waitForTimeout(500);
    const search = page.locator('.sheet #exercise-search');
    await assertFocusedOnOpen(page, `${L} picker`, search, { title: 'Übung wählen' });
    await typeLetters(page, `${L} picker search`, search, 'Bankdrücken', { shot: shot(2, 'plan-search') });
    await assertEscapeReturns(page, `${L} picker`, opener);
    check(`${L}: the name typed before the picker is still there`, (await fieldState(planName)).value === 'Push A');
    await page.locator('.plan-editor').getByRole('button', { name: 'Zurück' }).click();
    await page.waitForTimeout(700);
  }

  // 4: a new Wellbeing question.
  {
    const L = `${w} question sheet`;
    await page.getByRole('radio', { name: 'Mental', exact: true }).click();
    await page.waitForTimeout(900);
    const opener = page.locator('.areas__scroll').getByRole('button', { name: 'Frage hinzufügen' }).first();
    await opener.click();
    await page.waitForTimeout(500);
    const text = page.locator('.sheet #question-text');
    await assertFocusedOnOpen(page, L, text, { title: 'Neue Frage' });
    check(`${L}: the focused field is the one marked for it`, (await activeInfo(page)).initialMarked);
    await typeLetters(page, `${L} text`, text, 'Hast du gelesen?', { shot: shot(4, 'question') });
    const add = page.locator('.sheet__footer').getByRole('button', { name: 'Hinzufügen' });
    check(`${L}: the typed text enables Hinzufügen`, (await add.count()) === 1 && (await add.isEnabled()));
    await assertEscapeReturns(page, L, opener);

    // Editing a question opens on the dialog, not the field: editing is as
    // often a pause or an archive, and a keyboard over those is in the way.
    const E = `${w} question edit`;
    const row = page.locator('.areas__scroll').getByRole('button', { name: /Wie gut hast du gesch/ }).first();
    await row.click();
    await page.waitForTimeout(500);
    await assertDialogFocused(page, E, { title: 'Frage bearbeiten' });
    await assertEscapeReturns(page, E, row);
  }

  // 5: the food entry sheet.
  {
    const L = `${w} food sheet`;
    await tab(page, 'Heute').click();
    await page.waitForTimeout(800);
    const opener = page.locator('button.food__add');
    await opener.click();
    await page.waitForTimeout(600);
    await assertDialogFocused(page, L, { title: 'Essen eintragen' });
    const sheet = page.locator('.sheet');
    const name = sheet.getByLabel('Name', { exact: true });
    const grams = sheet.getByLabel('Menge in Gramm', { exact: true });
    const kcal = sheet.getByLabel('Kalorien (kcal)', { exact: true });
    await name.click();
    await page.waitForTimeout(250);
    await typeLetters(page, `${L} name`, name, 'Apfel', { shot: shot(5, 'food'), shotAt: 2 });
    await grams.click();
    await page.waitForTimeout(250);
    await typeLetters(page, `${L} grams`, grams, '150');
    await kcal.click();
    await page.waitForTimeout(250);
    await typeLetters(page, `${L} kcal`, kcal, '78');
    check(`${L}: the name is still there after the numbers`, (await fieldState(name)).value === 'Apfel');
    const add = sheet.getByRole('button', { name: 'Eintragen', exact: true });
    check(`${L}: a complete own entry enables Eintragen`, (await add.count()) === 1 && (await add.isEnabled()));
    await assertEscapeReturns(page, L, opener);
  }

  // 6: the run sheet.
  await runSheet(page, w, { shot: shot(6, 'run-sheet') });

  check(`${w}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
