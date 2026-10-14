import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { URL_APP, check, clipped, onboard, phone, smallTargets, summary } from './lib.mjs';

/**
 * WP2-1 — training plans and planned workouts, on the real production
 * build, at 360 and 393px. Screenshots go to docs/design/wp2-1.
 *
 * Proves on screen what the unit tests prove in storage: the plan editor,
 * the five-plan limit and its inline reason, the chooser under
 * "Session eintragen", the draft that writes no session until a set is
 * saved, the last-time line, the extra exercise, and the session that then
 * counts for the week.
 */
const OUT = process.env.OUT ?? 'docs/design/wp2-1';
mkdirSync(OUT, { recursive: true });
const WIDTHS = (process.env.WIDTHS ?? '393,360').split(',').map(Number);
/*
 * A fixed day, so nothing here depends on the weekday it is run (WP3): the
 * hub check after the first session failed on every day but a Monday
 * before B4. CLOCK=YYYY-MM-DD runs it as of another day, in Europe/Berlin,
 * at 10:00 UTC (11:00 or 12:00 local, the same calendar day either way).
 */
const CLOCK = process.env.CLOCK ?? '2026-10-14';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const idb = async (page, store) =>
  page.evaluate(async (s) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  }, store);

/** A bench session two days ago, so "Zuletzt" has something to say. */
async function seedEarlierSession(page) {
  return page.evaluate(async () => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (db, s) => new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const putAll = (db, s, recs) => new Promise((res, rej) => { const tx = db.transaction([s], 'readwrite'); for (const r of recs) tx.objectStore(s).put(r); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    const key = (d) => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const isoWeek = (d) => { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3); const y = t.getFullYear(); const f = new Date(y, 0, 4, 12); f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3); return `${pad(y, 4)}-W${pad(1 + Math.round((t - f) / (7 * 86400000)))}`; };
    const db = await open();
    const snaps = await all(db, 'configSnapshots');
    const at = new Date(); at.setHours(12, 0, 0, 0); at.setDate(at.getDate() - 2);
    const date = key(at);
    const stamp = at.toISOString();
    const id = `wp21-gym-${date}`;
    await putAll(db, 'gymSessions', [{ id, date, weekKey: isoWeek(at), performedAt: stamp, planId: null, note: null, legacyCarryOver: false, configSnapshotId: snaps[0].id, createdAt: stamp, updatedAt: stamp }]);
    await putAll(db, 'gymSets', [
      { id: 'wp21-set-0', sessionId: id, exerciseId: 'ex_bench_press', date, weightGrams: 60000, reps: 8, order: 0, muscles: ['chest', 'triceps', 'shoulders'], primaryMuscles: ['chest'], loadType: 'external', createdAt: stamp },
      { id: 'wp21-set-1', sessionId: id, exerciseId: 'ex_bench_press', date, weightGrams: 62500, reps: 6, order: 1, muscles: ['chest', 'triceps', 'shoulders'], primaryMuscles: ['chest'], loadType: 'external', createdAt: stamp },
    ]);
    return date;
  });
}

async function pickExercise(page, query) {
  await page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
  await page.waitForTimeout(350);
  await page.getByRole('textbox', { name: 'Suchen' }).fill(query);
  await page.waitForTimeout(250);
  await page.locator('.gym-picker__row').first().click();
  await page.waitForTimeout(400);
}

async function createPlan(page, name, queries) {
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.waitForTimeout(500);
  await page.getByLabel('Name des Plans').fill(name);
  for (const query of queries) await pickExercise(page, query);
  await page.getByRole('button', { name: 'Plan sichern' }).click();
  await page.waitForTimeout(700);
}

for (const width of WIDTHS) {
  const tag = (letter, slug) => `${OUT}/${width}-${letter}-${slug}.png`;
  const ctx = await browser.newContext({ ...phone, viewport: { width, height: 852 }, timezoneId: 'Europe/Berlin' });
  await ctx.clock.setSystemTime(new Date(`${CLOCK}T10:00:00Z`));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await onboard(page, { gym: 3, running: 0 });
  const earlier = await seedEarlierSession(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  /* ── Bereiche → Gym: the plans section ──────────────────────────────── */
  await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(900);
  const empty = ((await page.locator('.plans__empty').textContent()) ?? '').trim();
  check(`${width}: the plans section starts empty`, empty === 'Noch kein Trainingsplan.', empty);
  await page.locator('.plans__slots').scrollIntoViewIfNeeded();
  await page.screenshot({ path: tag('A', 'plans-empty') });

  /* ── The editor ─────────────────────────────────────────────────────── */
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.waitForTimeout(500);
  const hint = ((await page.locator('.plan-editor__hint').textContent()) ?? '').trim();
  check(`${width}: the creation hint is the approved copy`, hint.startsWith('Ein Trainingsplan ist eine Liste von Übungen') && !/ß/.test(hint), hint.slice(0, 40));

  /* ── The untouched initial state: nothing pre-created, nothing prefilled ── */
  const initial = await page.evaluate(() => {
    const input = document.querySelector('#plan-name');
    const save = [...document.querySelectorAll('button.button--primary')].find((b) => b.textContent.trim() === 'Plan sichern');
    const text = document.querySelector('.gym-session__scroll').textContent;
    return { name: input.value, placeholder: input.getAttribute('placeholder'), lines: document.querySelectorAll('.plan-editor__line').length, saveDisabled: save?.disabled ?? null, text, plans: null };
  });
  check(`${width}: Neuer Plan opens with an empty name`, initial.name === '' && initial.placeholder === null, JSON.stringify([initial.name, initial.placeholder]));
  check(`${width}: Neuer Plan opens with zero exercises`, initial.lines === 0 && initial.text.includes('Füge mindestens eine Übung hinzu.'), String(initial.lines));
  check(`${width}: the save action is not ready until named and filled`, initial.saveDisabled === true, String(initial.saveDisabled));
  const outsideHint = initial.text.replace(hint, '');
  const examples = ['Push', 'Pull', 'Legs', 'Full Body', 'Upper Body'].filter((name) => outsideHint.includes(name));
  check(`${width}: no example plan name appears outside the helper sentence`, examples.length === 0, examples.join('|'));
  check(`${width}: nothing was written by opening the editor`, (await idb(page, 'gymPlans')).length === 0);
  await page.screenshot({ path: tag('B', 'plan-editor-empty') });

  await page.getByLabel('Name des Plans').fill('Push A');
  for (const query of ['Bankdrücken', 'Schrägbank Kurzhantel', 'Seitheben Kabel', 'Pushdown Seil']) await pickExercise(page, query);
  // The name card keeps its full height however long the list below it gets.
  const nameCard = await page.evaluate(() => {
    const input = document.querySelector('#plan-name');
    const i = input.getBoundingClientRect(), c = input.closest('.card').getBoundingClientRect();
    return { inputBottom: i.bottom, cardBottom: c.bottom };
  });
  check(`${width}: the name field is fully inside its card with four exercises below`, nameCard.inputBottom + 12 <= nameCard.cardBottom, JSON.stringify(nameCard));
  const lines = await page.locator('.plan-editor__name').allTextContents();
  check(`${width}: four lines in the order added, under German names`, lines.join('|') === 'Bankdrücken|Schrägbank Kurzhantel|Seitheben Kabel|Pushdown Seil', lines.join('|'));
  await page.getByRole('button', { name: 'Seitheben Kabel nach oben' }).click();
  await page.waitForTimeout(200);
  const reordered = await page.locator('.plan-editor__name').allTextContents();
  check(`${width}: a line moves up by its named control`, reordered[1] === 'Seitheben Kabel', reordered.join('|'));
  const clipEditor = await clipped(page);
  check(`${width}: nothing in the editor is clipped`, clipEditor.length === 0, clipEditor.slice(0, 2).join('; '));
  const smallEditor = await smallTargets(page);
  check(`${width}: every editor control is a real target`, smallEditor.length === 0, smallEditor.slice(0, 3).join('; '));
  await page.screenshot({ path: tag('B2', 'plan-editor-filled-by-script'), fullPage: false });
  await page.getByRole('button', { name: 'Plan sichern' }).click();
  await page.waitForTimeout(700);
  const rows = await page.locator('.plans__slots').textContent();
  check(`${width}: the plan is listed and counted`, /1 von 5/.test(rows ?? ''), rows?.trim());
  check(`${width}: no plan was auto-created`, (await idb(page, 'gymPlans')).length === 1);
  await page.screenshot({ path: tag('C', 'plans-one') });

  /* ── Edit, duplicate, delete ────────────────────────────────────────── */
  await page.getByRole('button', { name: /^Push A/ }).click();
  await page.waitForTimeout(500);
  check(`${width}: editing shows no creation hint`, (await page.locator('.plan-editor__hint').count()) === 0);
  await page.getByRole('button', { name: 'Plan duplizieren' }).click();
  await page.waitForTimeout(700);
  check(`${width}: a duplicate is a second plan`, (await idb(page, 'gymPlans')).length === 2);
  await page.getByRole('button', { name: /Kopie/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Plan löschen' }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Wirklich löschen?' }).click();
  await page.waitForTimeout(700);
  check(`${width}: deleting frees the slot`, (await idb(page, 'gymPlans')).length === 1);

  /* ── The limit ──────────────────────────────────────────────────────── */
  for (const name of ['Pull A', 'Legs', 'Push B', 'Pull B']) await createPlan(page, name, ['Latzug weit']);
  check(`${width}: five plans exist`, (await idb(page, 'gymPlans')).length === 5);
  check(`${width}: exercise counts are figures`, (await page.getByText(/^1 Übung$/).count()) >= 1 && (await page.getByText(/Eine Übung/).count()) === 0);
  check(`${width}: creation is unavailable at five`, (await page.getByRole('button', { name: 'Neuer Plan' }).count()) === 0);
  const limit = ((await page.locator('.plans__limit').textContent()) ?? '').trim();
  check(`${width}: the limit is explained inline`, limit === 'Maximal 5 Pläne. Lösche einen Plan, um Platz für einen neuen zu schaffen.', limit);
  check(`${width}: no modal is open`, (await page.locator('[role="dialog"]').count()) === 0);
  await page.locator('.plans__limit').scrollIntoViewIfNeeded();
  await page.screenshot({ path: tag('D', 'plans-limit') });
  await page.getByRole('button', { name: /^Pull B/ }).click();
  await page.waitForTimeout(500);
  check(`${width}: duplication is unavailable at five`, await page.getByRole('button', { name: 'Plan duplizieren' }).isDisabled());
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.waitForTimeout(400);

  /* ── Today → the chooser → the draft ────────────────────────────────── */
  await page.locator('.tab-bar button', { hasText: 'Heute' }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Session eintragen' }).click();
  await page.waitForTimeout(500);
  check(`${width}: the chooser lists the saved plans first`, (await page.locator('.plan-chooser .row').count()) === 5);
  check(`${width}: the free session is offered second`, await page.getByRole('button', { name: 'Freie Session' }).isVisible());
  await page.screenshot({ path: tag('E', 'chooser') });
  await page.getByRole('button', { name: /^Push A/ }).click();
  await page.waitForTimeout(800);

  const names = await page.locator('.gym-exercise__name').allTextContents();
  check(`${width}: choosing a plan puts every exercise on the page at once`, names.length === 4 && names[0].startsWith('Bankdrücken'), names.join('|'));
  const sessionsBefore = await idb(page, 'gymSessions');
  check(`${width}: opening the plan persisted no session`, sessionsBefore.filter((s) => !s.id.startsWith('wp21-')).length === 0, String(sessionsBefore.length));
  const last = ((await page.locator('.gym-exercise__last').first().textContent()) ?? '').trim();
  check(`${width}: last time is shown from the real earlier session (${earlier})`, /Zuletzt am .* · 8 × 60 kg · 6 × 62.5 kg/.test(last), last);
  const placeholder = await page.locator('.gym-set--pending input').first().getAttribute('placeholder');
  check(`${width}: the pending row suggests last time in the placeholder, not as a value`, placeholder === '8' && (await page.locator('.gym-set--pending input').first().inputValue()) === '');
  const clipDraft = await clipped(page);
  check(`${width}: the draft is not clipped`, clipDraft.length === 0, clipDraft.slice(0, 2).join('; '));
  check(`${width}: no helper sentence under a pending row`, (await page.locator('.gym-exercise__best').count()) === 0);
  // The weight field holds "76.5" and "102.5" fully at this width, as value or placeholder.
  const fit = await page.locator('.gym-set--pending').first().evaluate((row) => {
    const [reps, weight] = row.querySelectorAll('input');
    const content = (i) => { const s = getComputedStyle(i); return i.getBoundingClientRect().width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - parseFloat(s.borderLeftWidth) - parseFloat(s.borderRightWidth); };
    const s = getComputedStyle(weight);
    const c = document.createElement('canvas').getContext('2d');
    c.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const w = (t) => Math.ceil(c.measureText(t).width);
    return { weight: Math.floor(content(weight)), reps: Math.floor(content(reps)), '76.5': w('76.5'), '102.5': w('102.5'), '12': w('12'), fontSize: s.fontSize };
  });
  check(`${width}: the weight field holds 102.5 and 76.5`, fit.weight >= fit['102.5'] && fit.weight >= fit['76.5'], JSON.stringify(fit));
  check(`${width}: the reps field holds two digits`, fit.reps >= fit['12'], JSON.stringify(fit));
  check(`${width}: the inputs keep a 17px font`, fit.fontSize === '17px', fit.fontSize);
  await page.screenshot({ path: tag('F', 'session-draft') });

  // Walk away and come back: still nothing persisted, and the plan is offered again.
  // The seeded session two days ago may share this week, so the count is
  // compared with itself rather than with a literal.
  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.waitForTimeout(700);
  const weekValue = async () => Number((((await page.locator('.week__value').first().textContent()) ?? '').match(/(\d+) \//) ?? [])[1]);
  const weekBefore = await weekValue();
  check(`${width}: backing out of a draft credits nothing`, (await idb(page, 'gymSessions')).filter((s) => !s.id.startsWith('wp21-')).length === 0, String(weekBefore));
  await page.getByRole('button', { name: 'Session eintragen' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /^Push A/ }).click();
  await page.waitForTimeout(800);

  /* ── The first set makes the session ────────────────────────────────── */
  const pending = page.locator('.gym-set--pending').first();
  await pending.locator('input').first().fill('8');
  await pending.locator('input').nth(1).fill('62.5');
  await pending.locator('input').nth(1).blur();
  await page.waitForTimeout(900);
  const sessionsAfter = (await idb(page, 'gymSessions')).filter((s) => !s.id.startsWith('wp21-'));
  const setsAfter = (await idb(page, 'gymSets')).filter((s) => !s.id.startsWith('wp21-'));
  check(`${width}: the first saved set creates exactly one session`, sessionsAfter.length === 1, String(sessionsAfter.length));
  check(`${width}: with exactly one set`, setsAfter.length === 1 && setsAfter[0].reps === 8 && setsAfter[0].weightGrams === 62500, JSON.stringify(setsAfter.map((s) => [s.reps, s.weightGrams])));
  check(`${width}: the session owns its snapshot of the four plan lines`, sessionsAfter[0]?.exercises?.length === 4 && sessionsAfter[0].exercises.every((e) => e.source === 'plan'));
  check(`${width}: the other exercises still wait for their first set`, (await page.locator('.gym-set--pending').count()) === 3);

  // A second set by the ordinary button, prefilled from the first.
  await page.getByRole('button', { name: /Satz zu Bankdrücken hinzufügen/ }).click();
  await page.waitForTimeout(700);
  check(`${width}: the next set is prefilled from the one before`, (await page.locator('.gym-set').nth(1).locator('input').nth(1).inputValue()) === '62.5');

  // An extra exercise, into the session only.
  await pickExercise(page, 'Face Pulls');
  const extra = await page.locator('.gym-exercise__source').allTextContents();
  check(`${width}: an extra exercise is marked as such`, extra.join('|') === 'Zusätzlich', extra.join('|'));
  const planAfter = (await idb(page, 'gymPlans')).find((p) => p.name === 'Push A');
  check(`${width}: the saved plan is untouched by the extra`, planAfter.exercises.length === 4);
  const sessionSnapshot = (await idb(page, 'gymSessions')).filter((s) => !s.id.startsWith('wp21-'))[0];
  check(`${width}: the extra is in the session snapshot`, sessionSnapshot.exercises.length === 5 && sessionSnapshot.exercises[4].source === 'extra');
  const clipSession = await clipped(page);
  check(`${width}: the session is not clipped`, clipSession.length === 0, clipSession.slice(0, 2).join('; '));
  const smallSession = await smallTargets(page);
  check(`${width}: every session control is a real target`, smallSession.length === 0, smallSession.slice(0, 3).join('; '));
  await page.screenshot({ path: tag('G', 'session-logged') });

  /* ── Reload: the same session continues ─────────────────────────────── */
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Session eintragen' }).click();
  await page.waitForTimeout(800);
  check(`${width}: after a reload the day’s session is continued, not re-chosen`, (await page.locator('[role="dialog"]').count()) === 0 && (await page.locator('.gym-exercise__name').count()) === 5);
  check(`${width}: still one session`, (await idb(page, 'gymSessions')).filter((s) => !s.id.startsWith('wp21-')).length === 1);
  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.waitForTimeout(700);
  const weekAfter = await weekValue();
  check(`${width}: the week counts the session once`, weekAfter === weekBefore + 1, `${weekBefore} → ${weekAfter}`);

  /* ── The hub on the day of the first session: a fact, not the ledger ──── */
  // No day is scored yet, so the Boss ledger has not "started" Gym; the
  // Training card still counts the session, because the session log did.
  await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(1500);
  const hubWeek = ((await page.locator('.gym-hub__week').textContent()) ?? '').trim();
  check(`${width}: the hub counts today's session in the week line`, /^\d+ von 3 Sessions diese Woche$/.test(hubWeek), hubWeek);
  check(`${width}: and says one is logged today`, ((await page.locator('.gym-hub__last').textContent()) ?? '').trim() === 'Heute bereits eine Session erfasst.');
  check(`${width}: no page errors`, errors.length === 0, errors.join(' | '));

  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
