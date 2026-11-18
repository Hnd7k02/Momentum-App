import { mkdirSync } from 'node:fs';
import { URL_APP, check, summary, launch, onboard, seed, seedMuscles, setLanguage } from './lib.mjs';

/**
 * The hub's "Muskelgruppen" card holds its place while it loads (D168).
 *
 * The owner's finding on the iPhone: in Bereiche › Gym the title
 * "Muskelgruppen" now and then stood there twice, the upper copy cut in
 * half. The card held two one-line placeholders while its history loaded
 * and up to four lines afterwards, and its text stood in the middle of the
 * picture beside it — so the title moved by half of whatever the text
 * grew, under a sheet of glass.
 *
 * Held here, in every state the card has and at the four widths: **the card
 * is as tall before the history arrives as after, and its title stands in
 * the same place** — measured with the load held back, so the loading state
 * is a state the check can look at and not a frame it has to catch. And
 * nothing is cut off to get there: every line of the card is inside it.
 *
 * In German at the four widths, and in English at the narrowest, where a
 * longer sentence would be the first to outgrow the card.
 *
 * **And what stands on the glass is what a fresh paint would put there**
 * (the tidy-up, D197). The owner's second finding on the iPhone, on a first
 * load now and then: "Noch nicht trainiert" stood there cut in half and the
 * hint under it was missing; a second load was right. The card's text had
 * changed under a living sheet of glass — the two lines that held their
 * place became words — and the picture kept only part of it. So each state
 * is photographed as it stands once the history has arrived, the card is
 * then taken out of the page and put back, which paints it from nothing,
 * and the two pictures must be the same. In Chromium, and in WebKit on
 * GitHub (`BROWSER=webkit`), the nearest thing to Safari a runner has.
 *
 * Run against the production preview (`vite preview --port 4173`).
 */

const OUT = process.env.SHOTS ?? '';
if (OUT) mkdirSync(OUT, { recursive: true });
const WIDTHS = (process.env.WIDTHS ?? '320,360,393,430').split(',').map(Number);
const HEIGHT = { 320: 693, 360: 780, 393: 852, 430: 932 };
/** How long the Gym history is held back: long enough to look at the card. */
const HOLD_MS = 1500;

/**
 * Holds back the one read the card's history waits for — the sets of the
 * range, by date — or makes it fail. A transaction lives only while a
 * request is pending, so the wait is a chain of small requests on the same
 * store, and the real read is made at its end.
 */
const HOLD_GYM_LOAD = () => {
  const real = IDBIndex.prototype.getAll;
  IDBIndex.prototype.getAll = function (...args) {
    const mode = window.__gymLoad;
    if (!mode || this.objectStore.name !== 'gymSets') return real.apply(this, args);
    const index = this;
    const store = this.objectStore;
    const fake = { result: undefined, error: null, onsuccess: null, onerror: null };
    const until = performance.now() + (mode.hold ?? 0);
    const finish = () => {
      if (mode.fail) {
        fake.error = new Error('held back by the check');
        if (fake.onerror) fake.onerror({ target: fake });
        return;
      }
      const request = real.apply(index, args);
      request.onsuccess = () => {
        fake.result = request.result;
        if (fake.onsuccess) fake.onsuccess({ target: fake });
      };
      request.onerror = () => {
        fake.error = request.error;
        if (fake.onerror) fake.onerror({ target: fake });
      };
    };
    const wait = () => {
      if (performance.now() >= until) {
        finish();
        return;
      }
      const keep = store.count();
      keep.onsuccess = wait;
      keep.onerror = finish;
    };
    wait();
    return fake;
  };
};

/** Gym sessions and sets written straight into the store, `back` days ago. */
async function seedSets(page, entries) {
  await page.evaluate(async (list) => {
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
    const sessions = [];
    const sets = [];
    for (const [back, exerciseId, muscles, primary, kg, reps] of list) {
      const at = shift(-back);
      const date = key(at);
      const id = `card-gym-${date}`;
      if (!sessions.some((s) => s.id === id)) {
        sessions.push({ id, date, weekKey: isoWeek(at), performedAt: new Date(shift(-back).setHours(18, 0, 0, 0)).toISOString(),
          planId: null, note: null, legacyCarryOver: false, configSnapshotId: snaps[0].id, createdAt: stamp, updatedAt: stamp });
      }
      sets.push({ id: `card-set-${exerciseId}-${date}`, sessionId: id, exerciseId, date, weightGrams: Math.round(kg * 1000), reps, order: 0,
        muscles, primaryMuscles: primary, loadType: 'external', createdAt: stamp });
    }
    await putAll(db, 'gymSessions', sessions);
    await putAll(db, 'gymSets', sets);
  }, entries);
}

/** Empties the Gym stores: `seed()` leaves bare sessions, and each state brings its own. */
async function clearGym(page) {
  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res, rej) => {
      const tx = db.transaction(['gymSessions', 'gymSets'], 'readwrite');
      tx.objectStore('gymSessions').clear();
      tx.objectStore('gymSets').clear();
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  });
}

/**
 * The card's states (`MuscleEntryCard`), each with what puts a device in it
 * and the line the card then says.
 */
const STATES = [
  {
    name: 'rated',
    words: { de: /von 10 gewertet/, en: /of 10 counted/ },
    seed: async (page) => { await seedMuscles(page, { days: 42 }); },
  },
  {
    name: 'trained, no figure',
    words: { de: /von 10 trainiert/, en: /of 10 trained/ },
    // One exercise on one day: trained, and nothing to compare.
    seed: async (page) => { await seedSets(page, [[3, 'ex_bench_press', ['chest', 'triceps', 'shoulders'], ['chest'], 60, 8]]); },
  },
  {
    name: 'empty range',
    words: { de: /Kein Training in den letzten 30 Tagen/, en: /No training in the last 30 days/ },
    // The last session lies before the range.
    seed: async (page) => { await seedSets(page, [[48, 'ex_bench_press', ['chest', 'triceps', 'shoulders'], ['chest'], 60, 8], [41, 'ex_bench_press', ['chest', 'triceps', 'shoulders'], ['chest'], 62.5, 8]]); },
  },
  {
    name: 'nothing to evaluate',
    words: { de: /Noch nichts auszuwerten/, en: /Nothing to evaluate yet/ },
    // A session in the range whose only set describes no work.
    seed: async (page) => { await seedSets(page, [[2, 'ex_bench_press', ['chest', 'triceps', 'shoulders'], ['chest'], 60, 0]]); },
  },
  {
    name: 'never trained',
    words: { de: /Noch nicht trainiert/, en: /Not trained yet/ },
    seed: async () => undefined,
  },
  {
    name: 'load failed',
    words: { de: /konnten nicht geladen werden/, en: /could not be loaded/ },
    seed: async (page) => { await seedMuscles(page, { days: 42 }); },
    fail: true,
  },
];

const browser = await launch();

/**
 * How far two pictures of the card differ: the pixels that are not the
 * same, and the box they lie in. Counted in the page, which can read a
 * picture; a channel may differ by eight, the noise of a blur drawn twice.
 */
const differ = (page, first, second) =>
  page.evaluate(async ([a, b]) => {
    const read = async (data) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height);
    };
    const [one, two] = [await read(a), await read(b)];
    if (one.width !== two.width || one.height !== two.height) return { pixels: -1, box: `${one.width}×${one.height} against ${two.width}×${two.height}` };
    let pixels = 0;
    let [left, top, right, bottom] = [one.width, one.height, -1, -1];
    for (let y = 0; y < one.height; y += 1) {
      for (let x = 0; x < one.width; x += 1) {
        const i = (y * one.width + x) * 4;
        if (Math.abs(one.data[i] - two.data[i]) > 8 || Math.abs(one.data[i + 1] - two.data[i + 1]) > 8 || Math.abs(one.data[i + 2] - two.data[i + 2]) > 8) {
          pixels += 1;
          left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
      }
    }
    return { pixels, box: pixels ? `x ${left}–${right}, y ${top}–${bottom} of ${one.width}×${one.height}` : '' };
  }, [first.toString('base64'), second.toString('base64')]);

/** Takes the card out of the page and puts it back: its next picture is painted from nothing. */
const paintAfresh = (page) =>
  page.evaluate(async () => {
    const card = document.querySelector('.gym-hub__muscles');
    const frame = () => new Promise((done) => requestAnimationFrame(() => done()));
    card.style.display = 'none';
    await frame();
    await frame();
    card.style.removeProperty('display');
    await frame();
    await frame();
  });

/** Where the card and its title stand, and whether every line of it is inside it. */
const measure = (page) =>
  page.evaluate(() => {
    const card = document.querySelector('.gym-hub__muscles');
    const title = document.querySelector('.gym-hub__musclesTitle');
    if (!card || !title) return null;
    const box = card.getBoundingClientRect();
    const at = title.getBoundingClientRect();
    const lines = [...card.querySelectorAll('.gym-hub__musclesBody > span')].map((span) => {
      const rect = span.getBoundingClientRect();
      return { text: span.textContent, top: rect.top - box.top, bottom: rect.bottom - box.top, cut: span.scrollWidth > span.clientWidth + 1 };
    });
    return {
      height: Math.round(box.height * 10) / 10,
      top: Math.round(box.top * 10) / 10,
      titleTop: Math.round((at.top - box.top) * 10) / 10,
      titleLeft: Math.round((at.left - box.left) * 10) / 10,
      summary: document.querySelector('.gym-hub__musclesSummary')?.textContent ?? '',
      inside: lines.every((line) => line.top >= -0.5 && line.bottom <= box.height + 0.5),
      cut: lines.some((line) => line.cut),
      text: card.innerText.replace(/\s+/g, ' ').trim(),
      scrollWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    };
  });

/** German at every width; English where the room is least. */
const RUNS = [...WIDTHS.map((width) => ({ width, language: 'de' })), { width: Math.min(...WIDTHS), language: 'en' }];

for (const { width, language } of RUNS) {
  for (const state of STATES) {
    const ctx = await browser.newContext({ viewport: { width, height: HEIGHT[width] ?? 852 }, deviceScaleFactor: 2, hasTouch: true });
    await ctx.addInitScript(HOLD_GYM_LOAD);
    const page = await ctx.newPage();
    const label = `${width}${language === 'de' ? '' : ` ${language}`} · ${state.name}`;
    const tag = `${state.name.replace(/[^a-z]+/g, '-')}${language === 'de' ? '' : `-${language}`}`;
    try {
      await page.goto(URL_APP, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      await onboard(page, { gym: 3, running: 2 });
      await seed(page, { days: 60 });
      await clearGym(page);
      await state.seed(page);
      if (language !== 'de') await setLanguage(page, language);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(900);

      // The history is held back from here on: the hub opens with its card
      // still loading.
      await page.evaluate(({ hold, fail }) => { window.__gymLoad = fail ? { hold, fail: true } : { hold }; }, { hold: HOLD_MS, fail: state.fail === true });
      // By its address rather than by the tab's name, which is the language's.
      await page.evaluate(() => { window.location.hash = '#/areas/gym'; });
      await page.locator('.gym-hub__muscles').waitFor({ state: 'visible' });
      await page.waitForTimeout(350);
      await page.locator('.gym-hub__muscles').scrollIntoViewIfNeeded();
      const loading = await measure(page);
      if (OUT) await page.locator('.gym-hub__muscles').screenshot({ path: `${OUT}/card-${tag}-loading-${width}.png` });
      check(`${label}: while its history loads the card says nothing yet`, loading !== null && loading.summary.trim() === '', JSON.stringify(loading?.summary));

      await page.waitForFunction(() => (document.querySelector('.gym-hub__musclesSummary')?.textContent ?? '').trim() !== '', null, { timeout: 15000 });
      await page.waitForTimeout(250);
      const loaded = await measure(page);
      if (OUT) await page.locator('.gym-hub__muscles').screenshot({ path: `${OUT}/card-${tag}-loaded-${width}.png` });

      check(`${label}: the card is in the state the check asked for`, loaded !== null && state.words[language].test(loaded.text), loaded?.text);
      check(`${label}: the card is as tall before the history arrives as after`,
        loading !== null && loaded !== null && Math.abs(loading.height - loaded.height) <= 0.5,
        `${loading?.height} → ${loaded?.height}`);
      check(`${label}: the title stands in the same place before and after`,
        loading !== null && loaded !== null && Math.abs(loading.titleTop - loaded.titleTop) <= 0.5 && Math.abs(loading.titleLeft - loaded.titleLeft) <= 0.5,
        `top ${loading?.titleTop} → ${loaded?.titleTop}, left ${loading?.titleLeft} → ${loaded?.titleLeft}`);
      check(`${label}: the card itself does not move on the screen`,
        loading !== null && loaded !== null && Math.abs(loading.top - loaded.top) <= 0.5, `${loading?.top} → ${loaded?.top}`);
      check(`${label}: every line of the card is inside it, and none is cut off`, loaded !== null && loaded.inside && !loaded.cut, loaded?.text);
      check(`${label}: nothing scrolls sideways`, loaded !== null && loaded.scrollWidth <= loaded.viewport, `${loaded?.scrollWidth} / ${loaded?.viewport}`);

      // The picture on the glass, against the same card painted from nothing.
      // Its text, where the finding was — not its edge, which shows the
      // ground and what loads beneath the card.
      const stands = await page.locator('.gym-hub__musclesBody').screenshot();
      await paintAfresh(page);
      await page.waitForTimeout(150);
      const afresh = await page.locator('.gym-hub__musclesBody').screenshot();
      if (OUT) await page.locator('.gym-hub__muscles').screenshot({ path: `${OUT}/card-${tag}-afresh-${width}.png` });
      const difference = await differ(page, stands, afresh);
      check(`${label}: the card's text, once its history has arrived, stands as a fresh paint puts it there`,
        difference.pixels === 0, difference.pixels === 0 ? '' : `${difference.pixels} pixels differ, ${difference.box}`);
    } catch (error) {
      check(`${label}: the card could be looked at`, false, String(error).split('\n')[0]);
    }
    await ctx.close();
  }
}

await browser.close();
process.exit(summary() ? 0 : 1);
