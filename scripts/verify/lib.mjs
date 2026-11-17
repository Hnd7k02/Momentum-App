// URL_APP=http://127.0.0.1:<port>/Momentum-App/ points a suite at another preview.
export const URL_APP = process.env.URL_APP ?? 'http://127.0.0.1:4173/Momentum-App/';
// The one place the browser binary is named. `/opt/pw-browsers/chromium` is the
// image's link to its current build; CHROMIUM_PATH=<binary> points every suite
// and tool at another one. Never `npx playwright install`.
export const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

/*
 * The browser a suite launches (block 9, step 3). `BROWSER=webkit` launches
 * WebKit — on GitHub, where the workflow installs it at the version of
 * `playwright-core`; a cloud session has Chromium only and never installs a
 * browser. `WEBKIT_PATH` names another WebKit binary. Only the suites in
 * `WEBKIT_SUITES` launch through `launch()`; the others are bound to
 * Chromium and say why in `scripts/verify/README.md`.
 *
 * WebKit under Linux is an early warning, not Safari on an iPhone.
 */
export const BROWSER = process.env.BROWSER ?? 'chromium';
export const WEBKIT = BROWSER === 'webkit';
export const WEBKIT_SUITES = ['release', 'wp3-sheets', 'terminal', 'design-system', 'muscle-sheet'];
export async function launch(options = {}) {
  const { chromium, webkit } = await import('playwright-core');
  if (WEBKIT) return webkit.launch({ ...(process.env.WEBKIT_PATH ? { executablePath: process.env.WEBKIT_PATH } : {}), ...options });
  return chromium.launch({ executablePath: CHROMIUM, ...options });
}
export const results = [];
export const check = (n, p, d = '') => {
  results.push({ n, p, d });
  console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`);
};
export const summary = () => {
  console.log('\n--- summary ---');
  console.log(`${results.filter((r) => r.p).length}/${results.length} checks passed`);
  const bad = results.filter((r) => !r.p);
  if (bad.length) console.log('FAILED:\n' + bad.map((f) => `  • ${f.n}${f.d ? ' — ' + f.d : ''}`).join('\n'));
  return bad.length === 0;
};
export const phone = { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, acceptDownloads: true };

/**
 * Passes the onboarding's opening page — one line and a faint «Screen
 * antippen» (the owner at STOP 7E-b, D192, and after it, D193) — to its
 * first slide. There is no button to find: the whole screen goes on, so
 * every walk taps the middle of the screen, where the line stands, and
 * proves that on its way. Every walk of the flow begins here.
 */
export async function passOpening(page) {
  await page.locator('.onboarding[data-step="opening"]').waitFor({ state: 'visible' });
  const { width, height } = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  await page.mouse.click(Math.round(width / 2), Math.round(height / 2));
  await page.locator('.onboarding[data-step="momentum"]').waitFor({ state: 'visible' });
}

/**
 * Sets the onboarding's question selection to exactly these (block 7E,
 * D191). Mind opens with three starter questions chosen — one per
 * category — so a click on one of them would take it off; each row is set
 * by its own pressed state instead, and a walk that names two questions
 * ends with those two, as it always did.
 */
export async function chooseQuestions(page, wanted) {
  const rows = page.locator('.category-group .question-pick[aria-pressed]');
  const count = await rows.count();
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    const text = (await row.textContent()) ?? '';
    const want = wanted.some((pattern) => pattern.test(text));
    if (want !== ((await row.getAttribute('aria-pressed')) === 'true')) await row.click();
  }
}

/**
 * Walks the onboarding: three concepts, the picker, then setup.
 *
 * Two worlds since WP3 Stage 4: Mind, and Gym with Laufen inside it. Food is
 * not offered (D139), so asking for it fails at once rather than after a
 * click times out; a device that had Food is `seedLegacyFood`'s job.
 */
export async function onboard(page, { questions = [/Wie gut hast du gesch/, /Wie war deine Stimmung/], gym = 3, running = 2, food = false, wellbeing = true } = {}) {
  if (food) throw new Error('onboard: Food is not offered (D139) — use seedLegacyFood for a device that had it');
  await passOpening(page);
  await page.getByRole('button', { name: /Los geht/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();   // two worlds
  await page.getByRole('button', { name: 'Weiter' }).click();   // one rank
  // Domain picker: nothing is chosen until the user chooses (D192); Gym
  // carries the Laufen target too.
  if (wellbeing) await page.getByRole('button', { name: /^Mind/ }).click();
  if (gym || running) await page.getByRole('button', { name: /^Gym/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  if (wellbeing) {
    await chooseQuestions(page, questions);
    await page.getByRole('button', { name: 'Weiter' }).click();
  }
  if (gym || running) {
    // Each target is a group named for what it counts. Since block 7E the
    // two stand in one card, so they are found by that name, not by card.
    const target = (name, count) => page.getByRole('group', { name }).getByRole('button', { name: `${count} pro Woche`, exact: true });
    if (gym) await target('Gym-Sessions pro Woche', gym).click();
    if (running) await target('Läufe pro Woche', running).click();
    await page.getByRole('button', { name: 'Weiter' }).click();
  }
  await page.getByRole('button', { name: 'Starten' }).click();
  await page.waitForTimeout(900);
}

/**
 * Puts the app into a language the way the settings do: the stored record,
 * read again on the next load. Reload after it.
 */
export async function setLanguage(page, language) {
  await page.evaluate(async (language) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const settings = await new Promise((res, rej) => { const r = db.transaction(['settings'], 'readonly').objectStore('settings').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res, rej) => { const tx = db.transaction(['settings'], 'readwrite'); tx.objectStore('settings').put({ ...settings[0], language }); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  }, language);
}

/**
 * Bereiche → Gym → Muskelgruppen (WP2-2). The Gym area opens on its hub;
 * the body and the ten rows live one tap further, on `#/areas/gym/muscles`,
 * which is also the only place the 3D chunk is fetched.
 */
export async function openMuscles(page, { wait = 4500 } = {}) {
  await page.getByRole('button', { name: 'Muskelgruppen öffnen' }).click();
  await page.waitForTimeout(wait);
}

/*
 * ── The muscle sheet (block 7C) ─────────────────────────────────────────
 *
 * A tap on a group's row, or on its muscle on the body, opens the group's
 * sheet; the exercises of a group stand in it, and an exercise's detail is
 * opened from there. Until block 7C a row was a toggle that filtered a list
 * of exercises under the ten rows, and the suites looked there.
 */

/** The group whose sheet stands — by the name in the sheet's title — or `null`. */
export const openGroup = (page) =>
  page.evaluate(() => {
    const scrim = document.querySelector('.sheet-scrim--clear:not([data-leaving])');
    return scrim?.querySelector('.sheet__title')?.textContent?.trim() ?? null;
  });

/** The group whose row is marked as open — by the row's own name — or `null`. */
export const openRow = (page) =>
  page.evaluate(() => document.querySelector('.muscle-row__button[data-open] .muscle-row__name')?.textContent ?? null);

/** Waits until no muscle sheet is in the document any more: it travels out. */
export async function sheetGone(page, { timeout = 4000 } = {}) {
  await page.waitForFunction(() => !document.querySelector('.sheet-scrim--clear'), null, { timeout }).catch(() => undefined);
}

/**
 * Opens a group's sheet from its row. `group` is the row's name as shown
 * ("Brust") or the group's id ("chest"). Waits until the sheet has risen
 * and the body above it has come to rest.
 */
export async function openGroupSheet(page, group, { wait = 500 } = {}) {
  const row = /^[a-z]/.test(group)
    ? page.locator(`.muscle-row__button[data-muscle="${group}"]`)
    : page.locator('.muscle-row__button').filter({ has: page.locator('.muscle-row__name', { hasText: new RegExp(`^${group}$`) }) });
  await row.click();
  await page.locator('.sheet--detents').waitFor({ state: 'visible' });
  await bodyAtRest(page);
  await page.waitForTimeout(wait);
}

/** Closes the muscle sheet as Escape does, and waits until it has gone and the body has come back. */
export async function closeGroupSheet(page, { wait = 300 } = {}) {
  await page.keyboard.press('Escape');
  await sheetGone(page);
  await bodyAtRest(page, { held: false });
  await page.waitForTimeout(wait);
}

/**
 * Waits for the body above a sheet to stand (`held`), or — after the sheet
 * has gone — to have travelled back to the whole picture. Where no 3D body
 * is drawn there is nothing to wait for.
 */
export async function bodyAtRest(page, { held = true, timeout = 8000 } = {}) {
  await page
    .waitForFunction(
      (held) => {
        const viewer = document.querySelector('.body-viewer');
        if (!viewer) return true;
        return held ? viewer.hasAttribute('data-held') : !viewer.hasAttribute('data-held') && viewer.dataset.zoom === '1';
      },
      held,
      { timeout },
    )
    .catch(() => undefined);
}

/** The exercises the open sheet lists: name, best working set, and the change with its word — or the note where there is none. */
export const sheetExercises = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.sheet--detents .muscle-sheet__exercise')].map((row) => {
      const right = row.querySelector('.muscle-sheet__exerciseRight');
      return {
        id: row.getAttribute('data-exercise'),
        name: row.querySelector('.muscle-sheet__exerciseName')?.textContent ?? '',
        set: row.querySelector('.muscle-sheet__exerciseSet')?.textContent ?? '',
        change: row.querySelector('.muscle-sheet__exerciseChange')?.textContent ?? null,
        word: row.querySelector('.muscle-sheet__exerciseState')?.textContent ?? null,
        state: [...(right?.classList ?? [])].find((c) => c.startsWith('muscle-sheet__exerciseRight--'))?.split('--')[1] ?? null,
        color: right ? getComputedStyle(row.querySelector('.muscle-sheet__exerciseChange') ?? right).color : null,
      };
    }),
  );

/** Opens an exercise's detail from the open sheet, by the name its row shows. */
export async function openSheetExercise(page, name, { wait = 600 } = {}) {
  const row = page.locator('.sheet--detents .muscle-sheet__exercise').filter({
    has: page.locator('.muscle-sheet__exerciseName', { hasText: name instanceof RegExp ? name : new RegExp(`^${name}$`) }),
  });
  // The exercises may begin under the fold of the lower height.
  await row.first().scrollIntoViewIfNeeded().catch(() => undefined);
  await row.first().click();
  await page.locator('.gym-detail').waitFor({ state: 'visible' });
  await page.waitForTimeout(wait);
}

/**
 * Opens an exercise's detail wherever the exercise stands: the first group,
 * in the rows' order, whose sheet lists it. For the tools that look at one
 * exercise by name and do not care which group led to it. Returns that
 * group's name, or `null` when no sheet lists the exercise.
 */
export async function openExerciseAnywhere(page, name) {
  const groups = await page.locator('.muscle-row__name').allTextContents();
  for (const group of groups) {
    await openGroupSheet(page, group.trim(), { wait: 200 });
    const row = page.locator('.sheet--detents .muscle-sheet__exercise').filter({
      has: page.locator('.muscle-sheet__exerciseName', { hasText: name instanceof RegExp ? name : new RegExp(`^${name}$`) }),
    });
    if ((await row.count()) > 0) {
      await row.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await row.first().click();
      await page.locator('.gym-detail').waitFor({ state: 'visible' });
      await page.waitForTimeout(600);
      return group.trim();
    }
    await closeGroupSheet(page, { wait: 100 });
  }
  return null;
}

/** Leaves an exercise's detail by its own back button: the sheet it was opened from stands again. */
export async function closeExercise(page, { wait = 400 } = {}) {
  await page.locator('.gym-detail .gym-session__back').click();
  await page.locator('.gym-detail').waitFor({ state: 'detached' });
  await page.waitForTimeout(wait);
}

/**
 * To the Gym hub, the way a finger reaches it from anywhere: the tab, then
 * the area. Until block 7B Heute's Gym label led to the hub and the suites
 * took that way; the label now leads straight to Muskelgruppen (D161) and
 * is named for it — `wp2-2-shots.mjs` holds that way, and its way back.
 */
export async function openGymHub(page, { wait = 600 } = {}) {
  await page.getByRole('button', { name: 'Bereiche' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(wait);
}

/**
 * Turns the body with a finger that keeps moving, as a real one does: an
 * event every `every` ms whatever the frames do, back and forth across the
 * body, for `ms`, and then lets go while it moves.
 *
 * `page.mouse.move` waits until each event has been handled, and a browser
 * that draws slowly handles one a frame: a finger that hops once a frame,
 * which no finger does — and which the measuring display rightly reads as a
 * finger that pauses between hops (D181). Here the events are sent on a
 * clock and none waits for the one before; the browser hands the page
 * several at once, each with the time it was made, as it does on a phone.
 */
export async function fingerTurn(page, { ms = 2000, y = 0.5, from = 0.2, to = 0.8, step = 4, every = 8 } = {}) {
  const client = await page.context().newCDPSession(page);
  const box = await page.locator('.body-viewer canvas').boundingBox();
  const py = box.y + box.height * y;
  const left = box.x + box.width * from;
  const right = box.x + box.width * to;
  const send = (type, x, extra) => client.send('Input.dispatchMouseEvent', { type, x, y: py, pointerType: 'mouse', ...extra });
  await send('mouseMoved', left, { button: 'none' });
  await send('mousePressed', left, { button: 'left', buttons: 1, clickCount: 1 });
  const sent = [];
  let x = left;
  let direction = 1;
  await new Promise((resolve) => {
    const begun = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - begun >= ms) {
        clearInterval(timer);
        resolve();
        return;
      }
      x += direction * step;
      if (x >= right || x <= left) direction = -direction;
      sent.push(send('mouseMoved', x, { button: 'left', buttons: 1 }).catch(() => undefined));
    }, every);
  });
  await Promise.all(sent);
  await send('mouseReleased', x, { button: 'left', buttons: 0, clickCount: 1 });
  await client.detach().catch(() => undefined);
}

/** Reads the stored domains straight out of IndexedDB. */
export async function storedDomains(page) {
  return page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('momentum');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows = await new Promise((res, rej) => {
      const r = db.transaction(['domains'], 'readonly').objectStore('domains').getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return rows.map((d) => ({ type: d.type, enabled: d.enabled, settings: d.settings }));
  });
}

export async function storedQuestions(page) {
  return page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('momentum');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows = await new Promise((res, rej) => {
      const r = db.transaction(['questions'], 'readonly').objectStore('questions').getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return rows.map((q) => ({ text: q.text, type: q.type, category: q.category, inverted: q.inverted }));
  });
}

/** Every element cut off by whatever is clipping it. */
export async function clipped(page) {
  return page.evaluate(() => {
    const bad = [];
    const clipper = (el) => {
      let p = el.parentElement;
      while (p) {
        const s = getComputedStyle(p);
        if (s.overflow !== 'visible' && s.overflowX !== 'visible') return p;
        p = p.parentElement;
      }
      return document.documentElement;
    };
    for (const el of document.querySelectorAll('button, a, input, .card, h1, h2, p, span')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const c = clipper(el);
      const cr = c.getBoundingClientRect();
      const overflowX = r.right - cr.right;
      if (overflowX > 1.5 && getComputedStyle(c).overflowX !== 'auto' && getComputedStyle(c).overflowX !== 'scroll') {
        bad.push(`${el.className || el.tagName} cut by ${overflowX.toFixed(1)}px inside ${c.className || c.tagName}`);
      }
    }
    return [...new Set(bad)];
  });
}

/**
 * Every tap target smaller than the minimum. The limits default to the
 * lenient 40 × 24 the earlier suites were written against; a suite that
 * holds the contract's 44px passes them (`onboarding-7e.mjs`).
 */
export async function smallTargets(page, { height: minHeight = 40, width: minWidth = 24 } = {}) {
  return page.evaluate(({ minHeight, minWidth }) => {
    const bad = [];
    for (const el of document.querySelectorAll('button, a[href], input, [role="radio"], [role="switch"]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // A visually hidden control is operated through the visible one that
      // labels it — the file input behind an Import button, for instance.
      if (el.closest('.visually-hidden') || el.classList.contains('visually-hidden')) continue;
      // Several controls grow their hit area with a ::before overlay rather
      // than by growing the box, which is how a 31px iOS switch is a 45px
      // target. Measure what the finger actually hits.
      const before = getComputedStyle(el, '::before');
      let height = r.height;
      let width = r.width;
      if (before.content !== 'none' && before.position === 'absolute') {
        // Only a *negative* inset grows the target. A hairline separator is
        // also an absolutely positioned ::before, and counting it would
        // shrink the box to the height of the line.
        const grow = (v) => (v.endsWith('px') && parseFloat(v) < 0 ? -parseFloat(v) : 0);
        height += grow(before.top) + grow(before.bottom);
        width += grow(before.left) + grow(before.right);
      }
      if (height < minHeight || width < minWidth) bad.push(`${el.className || el.tagName} ${width.toFixed(0)}x${height.toFixed(0)}`);
    }
    return [...new Set(bad)];
  }, { minHeight, minWidth });
}

/** Writes past history directly, so Verlauf has something to draw. */
export async function seed(page, { days = 30 } = {}) {
  return page.evaluate(async ({ days }) => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (db, s) => new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const putAll = (db, s, recs) => new Promise((res, rej) => { const tx = db.transaction([s], 'readwrite'); for (const r of recs) tx.objectStore(s).put(r); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    const key = (d) => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const shift = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
    const isoWeek = (d) => { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3); const y = t.getFullYear(); const f = new Date(y, 0, 4, 12); f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3); return `${pad(y, 4)}-W${pad(1 + Math.round((t - f) / (7 * 86400000)))}`; };
    const db = await open();
    const questions = await all(db, 'questions');
    const domains = await all(db, 'domains');
    const snaps = await all(db, 'configSnapshots');
    const settings = await all(db, 'settings');
    const origin = key(shift(-(days + 1)));
    await putAll(db, 'configSnapshots', snaps.map((s, i) => (i === 0 ? { ...s, effectiveFrom: origin } : s)));
    await putAll(db, 'settings', [{ ...settings[0], firstUseDate: origin }]);
    const mentalId = domains.find((d) => d.type === 'mental')?.id;
    const gymOn = domains.some((d) => d.type === 'gym' && d.enabled);
    const answers = [], sessions = [];
    for (let i = days; i >= 1; i -= 1) {
      const date = key(shift(-i));
      const level = 0.4 + ((days - i) / days) * 0.5;
      const stamp = new Date().toISOString();
      for (const q of questions) {
        answers.push({ id: `${date}#${q.id}`, date, questionId: q.id, domainId: mentalId,
          value: q.type === 'scale' ? Math.max(1, Math.min(10, Math.round(level * 10))) : (i * 7) % 10 < level * 10,
          valueType: q.type, sensitivity: 'private', configSnapshotId: snaps[0].id, createdAt: stamp, updatedAt: stamp });
      }
      if (gymOn && i % 3 === 0) {
        const at = new Date(shift(-i).setHours(18, 0, 0, 0)).toISOString();
        sessions.push({ id: `seed-${date}`, date, weekKey: isoWeek(shift(-i)), performedAt: at,
          planId: null, note: null, legacyCarryOver: false, configSnapshotId: snaps[0].id, createdAt: at, updatedAt: at });
      }
    }
    await putAll(db, 'answers', answers);
    if (sessions.length) await putAll(db, 'gymSessions', sessions);
    return { answers: answers.length, sessions: sessions.length };
  }, { days });
}

/**
 * Gym sets and runs across the same window `seed()` fills.
 *
 * `seed()` writes answers and bare gym *sessions*; a session with no sets
 * carries attendance but no performance, and Running it does not touch at
 * all. The geometry suite needs every card on Verlauf to have
 * something to say — a rating, an Endurance figure, a year-to-date change,
 * an attendance line — because the whole point of measuring a card is
 * measuring it with its real content in it.
 *
 * Purely additive: no existing suite calls this.
 */
export async function seedTraining(page, { days = 40, gymPerWeek = 3, runsPerWeek = 2 } = {}) {
  return page.evaluate(async ({ days, gymPerWeek, runsPerWeek }) => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (db, s) => new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const putAll = (db, s, recs) => new Promise((res, rej) => { const tx = db.transaction([s], 'readwrite'); for (const r of recs) tx.objectStore(s).put(r); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    const key = (d) => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const shift = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
    const isoWeek = (d) => { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3); const y = t.getFullYear(); const f = new Date(y, 0, 4, 12); f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3); return `${pad(y, 4)}-W${pad(1 + Math.round((t - f) / (7 * 86400000)))}`; };

    const db = await open();
    const snaps = await all(db, 'configSnapshots');
    const stamp = new Date().toISOString();
    const weeks = Math.floor(days / 7);

    const sessions = [], sets = [], runs = [];
    let n = 0;
    for (let week = 0; week < weeks; week += 1) {
      for (let slot = 0; slot < gymPerWeek; slot += 1) {
        const back = days - (week * 7 + slot * 2);
        const at = shift(-back);
        const date = key(at);
        const id = `geo-gym-${date}-${slot}`;
        sessions.push({ id, date, weekKey: isoWeek(at), performedAt: new Date(shift(-back).setHours(18, 0, 0, 0)).toISOString(),
          planId: null, note: null, legacyCarryOver: false, configSnapshotId: snaps[0].id, createdAt: stamp, updatedAt: stamp });
        // Load climbs week on week, so the year-to-date figure is a real one.
        sets.push({ id: `geo-set-${n}`, sessionId: id, exerciseId: 'ex_squat', date,
          weightGrams: Math.round((80 + week * 5) * 1000), reps: 5, order: 0,
          muscles: ['quadriceps', 'hamstringsGlutes', 'core'], primaryMuscles: ['quadriceps'],
          loadType: 'external', createdAt: stamp });
        n += 1;
      }
      for (let slot = 0; slot < runsPerWeek; slot += 1) {
        const back = days - (week * 7 + 1 + slot * 3);
        const at = shift(-back);
        const date = key(at);
        const minPerKm = 6.0 - week * 0.1;
        runs.push({ id: `geo-run-${date}-${slot}`, date, weekKey: isoWeek(at),
          performedAt: new Date(shift(-back).setHours(7, 0, 0, 0)).toISOString(),
          source: 'manual', externalId: null, distanceMetres: 5000,
          durationSeconds: Math.round(5 * minPerKm * 60), elevationMetres: null, steps: null,
          note: null, legacyCarryOver: false, configSnapshotId: snaps[0].id, createdAt: stamp, updatedAt: stamp });
      }
    }

    await putAll(db, 'gymSessions', sessions);
    await putAll(db, 'gymSets', sets);
    await putAll(db, 'runs', runs);
    return { sessions: sessions.length, sets: sets.length, runs: runs.length };
  }, { days, gymPerWeek, runsPerWeek });
}

/**
 * A device that had Food switched on before WP3 Stage 4 (D139), written the
 * way the old build left it on disk: the Food record — on, with the user's
 * focus sentence — every snapshot carrying it, the Boss shared equally over
 * what was on (domains sorted by id, weights in domain order, exactly as
 * `buildConfigSnapshot` wrote them), a rating for each day from `days` days
 * ago to `from` days ago — `from: 2` leaves yesterday unrated, the update
 * day's one-time cost (D141) — and an entry every third day. Call it after
 * `seed()`, which dates the first snapshot back, and reload: that load
 * switches Food off from today.
 */
export async function seedLegacyFood(page, { days = 14, from = 1, focus = 'Zmittag selber kochen' } = {}) {
  return page.evaluate(async ({ days, from, focus }) => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (db, s) => new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const putAll = (db, s, recs) => new Promise((res, rej) => { const tx = db.transaction([s], 'readwrite'); for (const r of recs) tx.objectStore(s).put(r); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    const key = (d) => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const shift = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };

    const db = await open();
    const stamp = new Date().toISOString();
    const food = { id: 'dom_legacy_food', type: 'food', enabled: true, order: 3, settings: { focus }, createdAt: stamp, updatedAt: stamp };
    await putAll(db, 'domains', [food]);

    const TYPES = ['mental', 'gym', 'running', 'food'];
    const snaps = await all(db, 'configSnapshots');
    await putAll(db, 'configSnapshots', snaps.map((snapshot) => {
      const domains = [
        ...snapshot.config.domains.filter((domain) => domain.type !== 'food'),
        { id: food.id, type: 'food', enabled: true, settings: food.settings },
      ].sort((a, b) => a.id.localeCompare(b.id));
      const config = { ...snapshot.config, domains };
      if (snapshot.config.boss) {
        const enabled = TYPES.filter((type) => domains.some((domain) => domain.type === type && domain.enabled));
        config.boss = { weights: Object.fromEntries(enabled.map((type) => [type, 1 / enabled.length])) };
      }
      return { ...snapshot, config };
    }));

    const foodDays = [], foodEntries = [];
    for (let i = days; i >= from; i -= 1) {
      const date = key(shift(-i));
      foodDays.push({ id: date, date, adherence: 5 + (i % 5), note: null, sensitivity: 'private',
        configSnapshotId: snaps[0].id, createdAt: stamp, updatedAt: stamp });
      if (i % 3 === 0) {
        foodEntries.push({ id: `legacy-food-${date}`, date, foodId: null, label: 'Znüni', grams: null, kcal: 300,
          proteinG: null, carbsG: null, fatG: null, detail: null, sensitivity: 'private',
          configSnapshotId: snaps[0].id, createdAt: stamp, updatedAt: stamp });
      }
    }
    await putAll(db, 'foodDays', foodDays);
    await putAll(db, 'foodEntries', foodEntries);
    db.close();
    return { foodDays: foodDays.length, foodEntries: foodEntries.length };
  }, { days, from, focus });
}

/**
 * Gym sets chosen so every muscle data state is on screen at once.
 *
 * `seedTraining` logs squats only, which leaves seven groups untrained and
 * no way to see a trend, a flat series or a single observation. This adds
 * the rest, as sets carrying the muscles they were logged under:
 *
 *   chest, triceps      12 rising bench days      measured, a real trend
 *   quadriceps, hamstringsGlutes, core   12 rising squat days   measured
 *   back                3 identical pulldown days measured, every point equal
 *   biceps, forearms    2 curl days               a single observation
 *   calves              1 calf-raise day          trained, awaiting a baseline
 *   shoulders           nothing                   no history
 */
export async function seedMuscles(page, { days = 42, older = false } = {}) {
  return page.evaluate(async ({ days, older }) => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (db, s) => new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const putAll = (db, s, recs) => new Promise((res, rej) => { const tx = db.transaction([s], 'readwrite'); for (const r of recs) tx.objectStore(s).put(r); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    const key = (d) => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const shift = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
    const isoWeek = (d) => { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3); const y = t.getFullYear(); const f = new Date(y, 0, 4, 12); f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3); return `${pad(y, 4)}-W${pad(1 + Math.round((t - f) / (7 * 86400000)))}`; };

    const db = await open();
    const snaps = await all(db, 'configSnapshots');
    const stamp = new Date().toISOString();
    const sessions = [], sets = [];
    const sessionOn = (back) => {
      const at = shift(-back);
      const date = key(at);
      const id = `mus-gym-${date}`;
      if (!sessions.some((s) => s.id === id)) {
        sessions.push({ id, date, weekKey: isoWeek(at), performedAt: new Date(shift(-back).setHours(18, 0, 0, 0)).toISOString(),
          planId: null, note: null, legacyCarryOver: false, configSnapshotId: snaps[0].id, createdAt: stamp, updatedAt: stamp });
      }
      return { id, date };
    };
    const log = (back, exerciseId, muscles, primary, kg, reps) => {
      const { id, date } = sessionOn(back);
      sets.push({ id: `mus-set-${exerciseId}-${date}`, sessionId: id, exerciseId, date,
        weightGrams: Math.round(kg * 1000), reps, order: 0, muscles, primaryMuscles: primary,
        loadType: 'external', createdAt: stamp });
    };

    // Everything sits inside the last four weeks, so it is all in the range
    // the workspace opens on; a set outside the window is not history, it is
    // simply not in this question.
    for (let i = 0; i < 12; i += 1) {
      const back = 26 - i * 2;
      log(back, 'ex_squat', ['quadriceps', 'hamstringsGlutes', 'core'], ['quadriceps'], 80 + i * 2.5, 5);
      log(back, 'ex_bench_press', ['chest', 'triceps'], ['chest'], 60 + i * 1.5, 5 + (i % 3));
    }
    // Identical performances, so every point of the series is the same number.
    for (const back of [19, 12, 5]) log(back, 'ex_lat_pulldown', ['back'], ['back'], 55, 8);
    // Two days of one exercise: a comparison, on two exercise days — too
    // little for the biceps to state a trend (contract §7).
    for (const back of [15, 6]) log(back, 'ex_hammer_curl', ['biceps', 'forearms'], ['biceps'], 16, 10);
    // With a third exercise day the forearms state one: a single comparable
    // observation, which is a value and not yet a direction.
    log(10, 'ex_farmers_carry', ['forearms'], ['forearms'], 30, 12);
    // One day: trained, with nothing to compare against.
    log(8, 'ex_calf_raise', ['calves'], ['calves'], 40, 12);
    // Asked for: three days of shoulder work that lie before the last 30
    // days and inside the last 90 — what the longer range reaches and the
    // shorter one no longer does.
    if (older) [80, 62, 44].forEach((back, i) => log(back, 'ex_overhead_press', ['shoulders'], ['shoulders'], 40 + i * 2, 8));

    // The catalogue rows the app writes the first time the picker opens, so
    // the rows can name an exercise rather than fall back to its id.
    const known = new Set((await all(db, 'exercises')).map((e) => e.id));
    const catalogue = [
      ['ex_squat', 'Back Squat', ['quadriceps', 'hamstringsGlutes', 'core'], ['quadriceps']],
      ['ex_bench_press', 'Bench Press', ['chest', 'triceps', 'shoulders'], ['chest']],
      ['ex_lat_pulldown', 'Lat Pulldown', ['back', 'biceps'], ['back']],
      ['ex_hammer_curl', 'Hammer Curl', ['biceps', 'forearms'], ['biceps']],
      ['ex_calf_raise', 'Calf Raise', ['calves'], ['calves']],
      ['ex_farmers_carry', "Farmer's Carry", ['forearms', 'core'], ['forearms']],
      ...(older ? [['ex_overhead_press', 'Overhead Press', ['shoulders', 'triceps'], ['shoulders']]] : []),
    ].filter(([id]) => !known.has(id)).map(([id, name, muscles, primaryMuscles]) => ({
      id, name, muscles, primaryMuscles, builtIn: true, loadType: 'external',
      durationSeconds: null, attributes: {}, createdAt: stamp, updatedAt: stamp,
    }));

    await putAll(db, 'gymSessions', sessions);
    await putAll(db, 'gymSets', sets);
    if (catalogue.length) await putAll(db, 'exercises', catalogue);
    return { sessions: sessions.length, sets: sets.length, exercises: catalogue.length };
  }, { days, older });
}

/**
 * The device: every group in a state of its own, set by its sets. A set
 * carries the groups and roles it was logged under, so each exercise here
 * reaches exactly the groups named.
 *
 *   chest        bench press 9×60, 10×60, 8×62.5, 9×62.5 — the check data's
 *                bench: +1.5 % in the range, shown "+2 %"; triceps with it
 *   back         a row that rises a fifth and six exercises that hold: uneven
 *   shoulders    pressed 80, 62 and 44 days ago: nothing in the last 30 days
 *   biceps       curls on two days: too little to compare
 *   core         crunches falling a tenth: declined
 *   quadriceps   squats doubling: +100 %
 *   hamstrings   leg curls, three days alike: held
 *   calves       one day: too little to compare
 *   forearms     the curls' two days and one carry: a single observation, +6 %
 *
 * `divergent` adds dips to the triceps whose last day lies under the one
 * before and whose last days lie over their first: the exercise the
 * pictures of D176 need, where the three comparisons part in their sign.
 * The suite does not ask for it.
 */
export async function seedSheetProfile(page, { divergent = false } = {}) {
  await page.evaluate(async (divergent) => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (db, s) => new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    const key = (d) => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const shift = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
    const isoWeek = (d) => { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3); const y = t.getFullYear(); const f = new Date(y, 0, 4, 12); f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3); return `${pad(y, 4)}-W${pad(1 + Math.round((t - f) / (7 * 86400000)))}`; };
    const db = await open();
    const snaps = await all(db, 'configSnapshots');
    const stamp = new Date().toISOString();
    const sessions = new Map();
    const sets = [];
    const exercises = new Map();
    let order = 0;
    const log = (back, id, name, muscles, primary, kg, reps, extra = {}) => {
      const at = shift(-back);
      const date = key(at);
      const sessionId = `sheet-gym-${date}`;
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { id: sessionId, date, weekKey: isoWeek(at), performedAt: new Date(shift(-back).setHours(18, 0, 0, 0)).toISOString(),
          planId: null, note: null, legacyCarryOver: false, configSnapshotId: snaps[0].id, createdAt: stamp, updatedAt: stamp });
      }
      order += 1;
      sets.push({ id: `sheet-set-${order}`, sessionId, exerciseId: id, date, weightGrams: Math.round(kg * 1000), reps, order,
        muscles, primaryMuscles: primary, loadType: 'external', createdAt: stamp, ...extra });
      exercises.set(id, { id, name, muscles, primaryMuscles: primary, builtIn: false, loadType: 'external', durationSeconds: null, attributes: {}, createdAt: stamp, updatedAt: stamp });
    };
    // Chest and triceps: the bench press of the check data, with a warm-up
    // and a second working set on its first day.
    log(26, 'sx_bench', 'Bankdrücken', ['chest', 'triceps'], ['chest'], 40, 12, { warmUp: true });
    log(26, 'sx_bench', 'Bankdrücken', ['chest', 'triceps'], ['chest'], 60, 9);
    log(26, 'sx_bench', 'Bankdrücken', ['chest', 'triceps'], ['chest'], 60, 8);
    log(19, 'sx_bench', 'Bankdrücken', ['chest', 'triceps'], ['chest'], 60, 10);
    log(12, 'sx_bench', 'Bankdrücken', ['chest', 'triceps'], ['chest'], 62.5, 8);
    log(5, 'sx_bench', 'Bankdrücken', ['chest', 'triceps'], ['chest'], 62.5, 9);
    // Back: one exercise rises a fifth and six hold — more exercises than
    // the sheet shows at once, so its content scrolls on every phone.
    for (const back of [24, 17, 10]) log(back, 'sx_pulldown', 'Latzug', ['back'], ['back'], 55, 8);
    [[24, 40], [17, 44], [10, 48]].forEach(([back, kg]) => log(back, 'sx_row', 'Rudern am Kabel', ['back'], ['back'], kg, 8));
    [['sx_tbar', 'T-Bar-Rudern', 50], ['sx_dbrow', 'Kurzhantelrudern', 26], ['sx_machine', 'Rudermaschine', 45], ['sx_pullover', 'Überzug am Kabel', 25], ['sx_face', 'Face Pulls', 20]]
      .forEach(([id, name, kg]) => { for (const back of [13, 3]) log(back, id, name, ['back'], ['back'], kg, 10); });
    // Shoulders: before the last 30 days, inside the last 90.
    [[80, 40], [62, 42], [44, 44]].forEach(([back, kg]) => log(back, 'sx_press', 'Überkopfdrücken', ['shoulders'], ['shoulders'], kg, 8));
    // Biceps: two days, a little more on the second. The forearms come
    // along as a secondary group.
    [[15, 16], [6, 17]].forEach(([back, kg]) => log(back, 'sx_curl', 'Hammercurls', ['biceps', 'forearms'], ['biceps'], kg, 10));
    // Forearms: a third exercise day, of an exercise recorded once.
    log(10, 'sx_carry', 'Farmer’s Walk', ['forearms'], ['forearms'], 30, 12);
    // Core: falling a tenth.
    [[22, 40], [15, 38], [8, 36]].forEach(([back, kg]) => log(back, 'sx_crunch', 'Crunch am Kabel', ['core'], ['core'], kg, 10));
    // Quadriceps: doubling. Hamstrings and glutes: three days alike.
    [[23, 50], [16, 75], [9, 100]].forEach(([back, kg]) => log(back, 'sx_squat', 'Kniebeuge', ['quadriceps'], ['quadriceps'], kg, 5));
    for (const back of [23, 16, 9]) log(back, 'sx_legcurl', 'Beinbeuger', ['hamstringsGlutes'], ['hamstringsGlutes'], 45, 10);
    // Calves: one day.
    log(8, 'sx_calf', 'Wadenheben', ['calves'], ['calves'], 40, 12);
    if (divergent) [[25, 100], [18, 90], [11, 104], [4, 96]].forEach(([back, kg]) => log(back, 'sx_dips', 'Dips', ['triceps'], ['triceps'], kg, 5));
    await new Promise((res, rej) => {
      const tx = db.transaction(['gymSessions', 'gymSets', 'exercises'], 'readwrite');
      tx.objectStore('gymSessions').clear();
      tx.objectStore('gymSets').clear();
      for (const record of sessions.values()) tx.objectStore('gymSessions').put(record);
      for (const record of sets) tx.objectStore('gymSets').put(record);
      for (const record of exercises.values()) tx.objectStore('exercises').put(record);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, divergent);
}


/**
 * Opens a metric tile's detail sheet, runs `fn` against the sheet, closes it.
 *
 * Since pass 2 the methodology copy lives in the sheet a tile opens, not on
 * the tile. An assertion that the app *says* something therefore opens the
 * sheet first — the promise is the same, the place has moved.
 */
export async function inSheet(page, metric, fn) {
  // A tile's own button, or — the metrics strip of Muskelgruppen (block 7B)
  // — a cell that is the button itself.
  await page.locator(`[data-metric="${metric}"] .metric-tile__open, button[data-metric="${metric}"]`).click();
  await page.waitForTimeout(450);
  const result = await fn(page.locator('.sheet'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  return result;
}

/**
 * A verify-only profile for the promotion-confirmation indicator (D126).
 *
 * The ordinary seeds leave every past day under the legacy rule, so the
 * indicator never shows on them. This one moves the confirmation boundary
 * back to the origin of the seeded history and rewrites every answer to one
 * constant value, so the whole history is walked by the confirmation rule
 * from a Rookie opening and the state on screen is a pure function of
 * `days` and `value`. Nothing here is a production path: it writes the
 * same stores a restored backup writes, and the app reconciles the pending
 * dates from history on the next load exactly as it would for that backup.
 *
 * Presets, calibrated once against the rating curve and pinned in
 * stage4-shots.mjs: `threshold` (28 days of 10 plus today) renders 0/7,
 * `pending` (32 days of 10) renders 4/7, `below` (28 days of 10) renders no
 * indicator.
 */
export async function seedConfirmation(page, { days = 30, value = 10, today = false } = {}) {
  await seed(page, { days });
  return page.evaluate(async ({ value, today }) => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (db, s) => new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const putAll = (db, s, recs) => new Promise((res, rej) => { const tx = db.transaction([s], 'readwrite'); for (const r of recs) tx.objectStore(s).put(r); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    const db = await open();
    const settings = (await all(db, 'settings'))[0];
    const answers = await all(db, 'answers');
    const rewritten = answers.map((a) => (a.valueType === 'scale' ? { ...a, value } : { ...a, value: true }));
    if (today) {
      // Today answered too, so a threshold can be crossed on the current day
      // itself — the 0/7 case — rather than carried in from yesterday.
      const pad = (n, l = 2) => String(n).padStart(l, '0');
      const now = new Date();
      const date = `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const stamp = now.toISOString();
      for (const q of await all(db, 'questions')) {
        rewritten.push({ id: `${date}#${q.id}`, date, questionId: q.id, domainId: q.domainId,
          value: q.type === 'scale' ? value : true, valueType: q.type, sensitivity: 'private',
          configSnapshotId: rewritten[0]?.configSnapshotId ?? null, createdAt: stamp, updatedAt: stamp });
      }
    }
    await putAll(db, 'answers', rewritten);
    await putAll(db, 'settings', [{
      ...settings,
      promotionConfirmation: { from: settings.firstUseDate, targetRankId: null, eligibleDates: [] },
    }]);
    return { from: settings.firstUseDate, answers: answers.length };
  }, { value, today });
}


/**
 * Text over glass, measured (WP3 Stage 6).
 *
 * A token test can hold an ink against a solid, but a glass card has no one
 * colour: what is behind the text is the fill over whatever the blur made
 * of the ground. So this reads the real pixels. It screenshots the page,
 * draws the image onto a canvas inside the page, and for every visible run
 * of text takes the most common colour in its glyph box that is not the
 * text's own — the background the glyphs actually sit on — and works out
 * the WCAG ratio against the computed text colour (alpha composited).
 *
 * Returns one entry per text element: the text, its class, size, weight,
 * whether WCAG counts it as large, the measured background, the ratio, and
 * whether its colour is the scope's `--text-tertiary` — the caption weight.
 * Stage 6a reported captions apart because the light theme carried them at
 * about 2.5:1; since Stage 6b they are held like any other text (D149), and
 * the flag only says which runs they are.
 */
export async function textContrast(page) {
  const png = (await page.screenshot({ type: 'png' })).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const dpr = img.naturalWidth / window.innerWidth;
    const channel = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const lum = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    const contrast = (a, b) => { const [l, d] = [lum(a), lum(b)].sort((x, y) => y - x); return (l + 0.05) / (d + 0.05); };
    const parse = (css) => { const m = css.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
    const hexToRgb = (hex) => { const h = hex.trim().replace('#', ''); return h.length === 6 ? [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] : null; };
    const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const out = [];
    const seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();
      if (text.length < 2) continue;
      const el = node.parentElement;
      if (!el || seen.has(el) || el.closest('.visually-hidden, script, style')) continue;
      // Hidden from assistive technology is not hidden from the eye: a
      // chart's axis, its dates and its end value are read like any caption
      // and are held like one. Only a drawing's own lettering is left out.
      if (el.closest('[aria-hidden="true"]') && el.closest('svg')) continue;
      // A disabled control is exempt from the contrast requirement, and its
      // reduced opacity is not composited here, so it is left out.
      if (el.closest(':disabled, [aria-disabled="true"]')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter((r) => r.width > 2 && r.height > 2);
      if (rects.length === 0) continue;
      const r = rects[0];
      if (r.top < 0 || r.bottom > window.innerHeight || r.left < 0 || r.right > window.innerWidth) continue;
      const top = document.elementFromPoint(r.left + Math.min(6, r.width / 2), r.top + r.height / 2);
      if (!top || !(el.contains(top) || top.contains(el))) continue;
      seen.add(el);
      const fg = parse(cs.color);
      if (!fg) continue;
      const x0 = Math.floor(r.left * dpr), y0 = Math.floor(r.top * dpr);
      const w = Math.max(1, Math.ceil(r.width * dpr)), h = Math.max(1, Math.ceil(r.height * dpr));
      const data = ctx.getImageData(x0, y0, w, h).data;
      const buckets = new Map();
      for (let i = 0; i < data.length; i += 8) {
        const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
        const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
        b.n += 1; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2];
        buckets.set(key, b);
      }
      const ranked = [...buckets.values()].sort((a, b) => b.n - a.n).map((b) => [b.r / b.n, b.g / b.n, b.b / b.n]);
      // The glyphs are the text colour; the background is the most common
      // colour that is not it.
      const bg = ranked.find((c) => distance(c, fg) > 48) ?? ranked[0];
      const alpha = fg[3];
      const ink = alpha < 1 ? fg.slice(0, 3).map((v, i) => v * alpha + bg[i] * (1 - alpha)) : fg.slice(0, 3);
      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const tertiary = hexToRgb(cs.getPropertyValue('--text-tertiary'));
      out.push({
        text: text.slice(0, 30),
        className: String(el.className || el.tagName).slice(0, 48),
        size,
        weight,
        large: size >= 24 || (size >= 18.66 && weight >= 700),
        fg: ink.map(Math.round),
        bg: bg.map(Math.round),
        ratio: Number(contrast(ink, bg).toFixed(2)),
        tertiary: tertiary !== null && distance(ink, tertiary) < 6,
      });
    }
    return out;
  }, png);
}
