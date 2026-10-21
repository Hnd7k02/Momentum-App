// URL_APP=http://127.0.0.1:<port>/Momentum-App/ points a suite at another preview.
export const URL_APP = process.env.URL_APP ?? 'http://127.0.0.1:4173/Momentum-App/';
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
 * Walks the onboarding: three concepts, the picker, then setup.
 *
 * Two worlds since WP3 Stage 4: Mind, and Gym with Laufen inside it. Food is
 * not offered (D139), so asking for it fails at once rather than after a
 * click times out; a device that had Food is `seedLegacyFood`'s job.
 */
export async function onboard(page, { questions = [/Wie gut hast du gesch/, /Wie war deine Stimmung/], gym = 3, running = 2, food = false, wellbeing = true } = {}) {
  if (food) throw new Error('onboard: Food is not offered (D139) — use seedLegacyFood for a device that had it');
  await page.getByRole('button', { name: /Los geht/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();   // two worlds
  await page.getByRole('button', { name: 'Weiter' }).click();   // rank + milestones
  // Domain picker: Mind starts selected; Gym carries the Laufen target too.
  if (!wellbeing) await page.getByRole('button', { name: /^Mind/ }).click();
  if (gym || running) await page.getByRole('button', { name: /^Gym/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  if (wellbeing) {
    for (const q of questions) await page.getByRole('button', { name: q }).first().click();
    await page.getByRole('button', { name: 'Weiter' }).click();
  }
  if (gym || running) {
    const cards = page.locator('.card');
    if (gym) await cards.nth(0).getByRole('button', { name: `${gym} pro Woche` }).click();
    if (running) await cards.nth(1).getByRole('button', { name: `${running} pro Woche` }).click();
    await page.getByRole('button', { name: 'Weiter' }).click();
  }
  await page.getByRole('button', { name: 'Starten' }).click();
  await page.waitForTimeout(900);
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

/** Every tap target smaller than the minimum. */
export async function smallTargets(page) {
  return page.evaluate(() => {
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
      if (height < 40 || width < 24) bad.push(`${el.className || el.tagName} ${width.toFixed(0)}x${height.toFixed(0)}`);
    }
    return [...new Set(bad)];
  });
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
export async function seedMuscles(page, { days = 42 } = {}) {
  return page.evaluate(async ({ days }) => {
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
    // Two days: one comparison, which is a value and not yet a direction.
    for (const back of [15, 6]) log(back, 'ex_hammer_curl', ['biceps', 'forearms'], ['biceps'], 16, 10);
    // One day: trained, with nothing to compare against.
    log(8, 'ex_calf_raise', ['calves'], ['calves'], 40, 12);

    // The catalogue rows the app writes the first time the picker opens, so
    // the rows can name an exercise rather than fall back to its id.
    const known = new Set((await all(db, 'exercises')).map((e) => e.id));
    const catalogue = [
      ['ex_squat', 'Back Squat', ['quadriceps', 'hamstringsGlutes', 'core'], ['quadriceps']],
      ['ex_bench_press', 'Bench Press', ['chest', 'triceps', 'shoulders'], ['chest']],
      ['ex_lat_pulldown', 'Lat Pulldown', ['back', 'biceps'], ['back']],
      ['ex_hammer_curl', 'Hammer Curl', ['biceps', 'forearms'], ['biceps']],
      ['ex_calf_raise', 'Calf Raise', ['calves'], ['calves']],
    ].filter(([id]) => !known.has(id)).map(([id, name, muscles, primaryMuscles]) => ({
      id, name, muscles, primaryMuscles, builtIn: true, loadType: 'external',
      durationSeconds: null, attributes: {}, createdAt: stamp, updatedAt: stamp,
    }));

    await putAll(db, 'gymSessions', sessions);
    await putAll(db, 'gymSets', sets);
    if (catalogue.length) await putAll(db, 'exercises', catalogue);
    return { sessions: sessions.length, sets: sets.length, exercises: catalogue.length };
  }, { days });
}

/**
 * Opens a metric tile's detail sheet, runs `fn` against the sheet, closes it.
 *
 * Since pass 2 the methodology copy lives in the sheet a tile opens, not on
 * the tile. An assertion that the app *says* something therefore opens the
 * sheet first — the promise is the same, the place has moved.
 */
export async function inSheet(page, metric, fn) {
  await page.locator(`[data-metric="${metric}"] .metric-tile__open`).click();
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
 * whether its colour is the scope's `--text-tertiary` (a caption weight the
 * light theme already carries below 4.5:1, reported apart on purpose).
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
      if (!el || seen.has(el) || el.closest('.visually-hidden, script, style, [aria-hidden="true"]')) continue;
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
