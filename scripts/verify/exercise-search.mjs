import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, clipped, onboard, setLanguage, smallTargets, summary } from './lib.mjs';

/**
 * The exercise catalogue and its search, in the workout and in the plan
 * editor (block 7D, D171).
 *
 * **What each of the owner's four words must find is read from the
 * catalogue's source here, not from the search**: "bauch" every exercise
 * whose primary group is the core, "zieh" every one that names the pulling
 * movement, "maschine" every one on a machine, "eigengewicht" every one
 * loaded by body weight. The search is then held to that list exactly — no
 * row missing, no row more. And each row says why it was found: for the
 * equipment and for body weight the word stands in the row.
 *
 * Also: case and the spellings of an umlaut make no difference; two words
 * narrow; a word nobody knows says so and makes "Eigene Übung" the primary
 * action, with the word as its name; the list without a query shows every
 * offered exercise exactly once, under one heading per muscle group; a
 * found exercise is picked and lands in the workout and in the plan; the
 * English screen finds "abs", "pull", "machine" and "bodyweight"; and at
 * 320, 360, 393 and 430 nothing is cut off and every row is a target.
 *
 * On a fixed day, against the production preview (`vite preview --port 4173`).
 */
const WIDTHS = (process.env.WIDTHS ?? '320,360,393,430').split(',').map(Number);
const HEIGHT = { 320: 693, 360: 780, 393: 852, 430: 932 };
const CLOCK = process.env.CLOCK ?? '2026-11-17';

/* ── The catalogue, read from its source: one entry a line ─────────────── */
const list = (text) => [...(text ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1]);
const CATALOGUE = readFileSync('src/core/gym/catalogue.ts', 'utf8')
  .split('\n')
  .filter((line) => /^\s*\{ id: 'ex_/.test(line) && !/deprecated: true/.test(line))
  .map((line) => ({
    id: /id: '([^']+)'/.exec(line)[1],
    de: /names: de\((['"])(.*?)\1/.exec(line)[2],
    en: /names: de\((['"]).*?\1, (['"])(.*?)\2\)/.exec(line)[3],
    primary: list(/primary: \[([^\]]*)\]/.exec(line)?.[1]),
    equipment: /equipment: '([^']+)'/.exec(line)?.[1] ?? null,
    loadType: /loadType: '([^']+)'/.exec(line)?.[1] ?? 'external',
    movement: list(/movement: \[([^\]]*)\]/.exec(line)?.[1]),
  }));
const sorted = (names, language = 'de') => [...names].sort((a, b) => a.localeCompare(b, language));
const namesWhere = (test, language = 'de') => sorted(CATALOGUE.filter(test).map((entry) => entry[language]), language);
const WANT = {
  bauch: namesWhere((entry) => entry.primary.includes('core')),
  zieh: namesWhere((entry) => entry.movement.includes('pull')),
  maschine: namesWhere((entry) => entry.equipment === 'machine'),
  eigengewicht: namesWhere((entry) => entry.loadType === 'bodyweight'),
};
check('the catalogue is read: over a hundred entries, every one with its equipment and its movement',
  CATALOGUE.length > 100 && CATALOGUE.every((entry) => entry.equipment && entry.movement.length > 0),
  `${CATALOGUE.length} entries`);
check('and each of the four words has exercises to find', Object.values(WANT).every((names) => names.length >= 10),
  Object.entries(WANT).map(([word, names]) => `${word} ${names.length}`).join(' · '));

const browser = await chromium.launch({ executablePath: CHROMIUM });

/** The Berlin noon of a day, as an instant. */
function noon(day) {
  for (const offset of ['+01:00', '+02:00']) {
    const instant = new Date(`${day}T12:00:00${offset}`);
    if (Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', hourCycle: 'h23' }).format(instant)) === 12) return instant;
  }
  throw new Error(`no noon on ${day}`);
}

async function device(width, { language = 'de' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: HEIGHT[width] ?? 852 }, deviceScaleFactor: 2, hasTouch: true, timezoneId: 'Europe/Zurich', locale: 'de-CH' });
  await ctx.clock.setSystemTime(noon(CLOCK));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await onboard(page, { gym: 3, running: 0 });
  if (language !== 'de') {
    await setLanguage(page, language);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
  }
  return { ctx, page, errors };
}

const searchBox = (page, language = 'de') => page.getByRole('textbox', { name: language === 'de' ? 'Suchen' : 'Search' });
async function search(page, query, language = 'de') {
  await searchBox(page, language).fill(query);
  await page.waitForTimeout(300);
}
const rows = (page) =>
  page.locator('.gym-picker__row').evaluateAll((list) =>
    list.map((row) => ({
      name: row.querySelector('.gym-picker__name')?.textContent.trim() ?? '',
      meta: row.querySelector('.gym-picker__meta')?.textContent.trim() ?? '',
      height: row.getBoundingClientRect().height,
    })),
  );
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const diff = (got, want) => {
  const missing = want.filter((name) => !got.includes(name));
  const extra = got.filter((name) => !want.includes(name));
  return `${got.length} rows${missing.length ? ` · missing ${missing.join('|')}` : ''}${extra.length ? ` · extra ${extra.join('|')}` : ''}`;
};

/** The four words, in an open picker: exactly the exercises they must find, each row saying why. */
async function fourWords(page, P) {
  for (const [word, want] of Object.entries(WANT)) {
    await search(page, word);
    const found = await rows(page);
    const names = sorted(found.map((row) => row.name));
    check(`${P}: «${word}» finds exactly the ${want.length} exercises it must`, same(names, want), diff(names, want));
    if (word === 'maschine' || word === 'eigengewicht') {
      const label = word === 'maschine' ? 'Maschine' : 'Eigengewicht';
      // In the name — inside a word too, "Bauchmaschine" — or beside the groups.
      const silent = found.filter((row) => !`${row.name} ${row.meta}`.toLowerCase().includes(label.toLowerCase()));
      check(`${P}: «${word}» — every row says «${label}», in its name or beside its groups`, silent.length === 0, silent.map((row) => row.name).join('|'));
    }
    if (word === 'bauch') {
      const silent = found.filter((row) => !/Rumpf|Bauch/.test(`${row.name} ${row.meta}`));
      check(`${P}: «bauch» — every row names the core or the belly`, silent.length === 0, silent.map((row) => row.name).join('|'));
    }
  }
}

/* ── The workout, at four widths ───────────────────────────────────────── */
for (const width of WIDTHS) {
  const W = `${width}`;
  const { ctx, page, errors } = await device(width);
  await page.getByRole('button', { name: 'Session eintragen' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
  await page.locator('.gym-picker__row').first().waitFor();
  await page.waitForTimeout(400);

  // Without a query: every offered exercise once, under one heading per group.
  const all = await rows(page);
  const allNames = all.map((row) => row.name);
  check(`${W}: without a query every offered exercise stands exactly once (${allNames.length} of ${CATALOGUE.length})`,
    allNames.length === CATALOGUE.length && new Set(allNames).size === allNames.length && same(sorted(allNames), sorted(CATALOGUE.map((entry) => entry.de))),
    diff(sorted(allNames), sorted(CATALOGUE.map((entry) => entry.de))));
  const headings = await page.locator('.gym-picker__group').allTextContents();
  check(`${W}: under one heading per muscle group, in the app's order`,
    same(headings, ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Rumpf', 'Quadrizeps', 'Beinbeuger und Gesäss', 'Waden', 'Unterarme']), headings.join(' | '));
  const hint = await page.locator('#exercise-search-hint').textContent();
  check(`${W}: the field says what can be searched for, in everyday words`,
    /Name, Muskel, Gerät oder Bewegung/.test(hint ?? '') && (await searchBox(page).getAttribute('aria-describedby')) === 'exercise-search-hint', hint ?? '');
  check(`${W}: every row is a target of 44px or more`, all.every((row) => row.height >= 44), all.filter((row) => row.height < 44).map((row) => row.name).join('|'));
  check(`${W}: nothing is cut off, without a query`, (await clipped(page)).length === 0, (await clipped(page)).slice(0, 3).join(' | '));
  check(`${W}: no small target, without a query`, (await smallTargets(page)).length === 0, (await smallTargets(page)).slice(0, 3).join(' | '));
  check(`${W}: nothing scrolls sideways`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  await fourWords(page, `${W} workout`);
  check(`${W}: nothing is cut off with a query`, (await clipped(page)).length === 0, (await clipped(page)).slice(0, 3).join(' | '));

  // The beginning of a word, case and umlauts.
  await search(page, 'ziehen');
  const ziehen = sorted((await rows(page)).map((row) => row.name));
  check(`${W}: «zieh» finds what «ziehen» finds`, same(ziehen, WANT.zieh), diff(ziehen, WANT.zieh));
  const backs = [];
  for (const spelling of ['RÜCKEN', 'rücken', 'ruecken', 'rucken']) {
    await search(page, spelling);
    backs.push((await rows(page)).map((row) => row.name).join('|'));
  }
  check(`${W}: «RÜCKEN», «rücken», «ruecken» and «rucken» find the same`, new Set(backs).size === 1 && backs[0].length > 0, `${backs.map((list) => list.split('|').length).join(' / ')} rows`);
  await search(page, 'kabel brust');
  const cableChest = sorted((await rows(page)).map((row) => row.name));
  const wantCableChest = namesWhere((entry) => entry.equipment === 'cable' && entry.primary.includes('chest'));
  check(`${W}: «kabel brust» narrows to the chest exercises on the cable`, same(cableChest, wantCableChest), diff(cableChest, wantCableChest));
  // What the search found before, it still finds.
  await search(page, 'Bench Press');
  check(`${W}: the stored English name still finds its exercise first: «Bench Press» → Bankdrücken`, (await rows(page))[0]?.name === 'Bankdrücken', (await rows(page)).slice(0, 3).map((row) => row.name).join('|'));

  // Nothing found: said, and the one action there is.
  await search(page, 'Zercher');
  const empty = (await page.locator('.gym-picker__empty').textContent())?.replace(/\s+/g, ' ').trim() ?? '';
  const footer = page.locator('.sheet__footer').getByRole('button', { name: 'Eigene Übung' });
  check(`${W}: a word without a hit says what was searched, and offers «Eigene Übung» as the primary action`,
    (await page.locator('.gym-picker__row').count()) === 0 && empty.includes('Keine Übung passt zu «Zercher».') && empty.includes('Lege sie als eigene Übung an.') &&
      /button--primary/.test((await footer.getAttribute('class')) ?? ''), empty);
  check(`${W}: nothing is cut off in the empty state`, (await clipped(page)).length === 0, (await clipped(page)).slice(0, 3).join(' | '));
  await footer.click();
  await page.waitForTimeout(400);
  check(`${W}: «Eigene Übung» goes on, with what was searched as the name`, (await page.locator('#exercise-name').inputValue()) === 'Zercher' && (await page.locator('#exercise-name').evaluate((el) => el === document.activeElement)));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Picked, it lands in the workout.
  await page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
  await page.locator('.gym-picker__row').first().waitFor();
  await search(page, 'bauch');
  await page.locator('.gym-picker__row').filter({ has: page.locator('.gym-picker__name', { hasText: /^Rumpfrotation Maschine$/ }) }).click();
  await page.waitForTimeout(700);
  const inWorkout = await page.locator('.gym-exercise__name').allTextContents();
  check(`${W}: a found exercise is picked and stands in the workout`, inWorkout.some((name) => name.trim().startsWith('Rumpfrotation Maschine')), inWorkout.join('|'));
  check(`${W}: no page errors in the workout`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ── The plan editor: the same search, the same hits ───────────────────── */
{
  const { ctx, page, errors } = await device(393);
  await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.waitForTimeout(500);
  await page.getByLabel('Name des Plans').fill('Rumpf');
  await page.getByRole('button', { name: /Übung hinzufügen/ }).first().click();
  await page.locator('.gym-picker__row').first().waitFor();
  await page.waitForTimeout(300);
  check('plan: without a query every offered exercise stands exactly once', (await page.locator('.gym-picker__row').count()) === CATALOGUE.length, String(await page.locator('.gym-picker__row').count()));
  await fourWords(page, 'plan');
  await search(page, 'eigengewicht');
  await page.locator('.gym-picker__row').filter({ has: page.locator('.gym-picker__name', { hasText: /^Nordic Curls$/ }) }).click();
  await page.waitForTimeout(500);
  const lines = await page.locator('.plan-editor__name').allTextContents();
  check('plan: a found exercise is picked and stands in the plan', lines.map((line) => line.trim()).includes('Nordic Curls'), lines.join('|'));
  await page.getByRole('button', { name: 'Plan sichern' }).click();
  await page.waitForTimeout(700);
  const stored = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const plans = await new Promise((res, rej) => { const r = db.transaction(['gymPlans'], 'readonly').objectStore('gymPlans').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    db.close();
    return plans;
  });
  check('plan: saved with the new exercise by its id', JSON.stringify(stored).includes('ex_nordic_hamstring_curl'), JSON.stringify(stored).slice(0, 200));
  check('plan: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ── The English screen ────────────────────────────────────────────────── */
{
  const { ctx, page, errors } = await device(393, { language: 'en' });
  await page.getByRole('button', { name: 'Log a session' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Add an exercise/ }).first().click();
  await page.locator('.gym-picker__row').first().waitFor();
  await page.waitForTimeout(300);
  const english = {
    abs: namesWhere((entry) => entry.primary.includes('core'), 'en'),
    pull: namesWhere((entry) => entry.movement.includes('pull') || /pull/i.test(entry.en), 'en'),
    machine: namesWhere((entry) => entry.equipment === 'machine' || /machine/i.test(entry.en), 'en'),
    bodyweight: namesWhere((entry) => entry.loadType === 'bodyweight', 'en'),
  };
  for (const [word, want] of Object.entries(english)) {
    await search(page, word, 'en');
    const names = sorted((await rows(page)).map((row) => row.name), 'en');
    check(`en: «${word}» finds exactly the ${want.length} exercises it must — by the word, or by the name`, same(names, want), diff(names, want));
  }
  const headings = await page.locator('.gym-picker__group').count();
  await search(page, '', 'en');
  check('en: without a query the headings are the English group names', (await page.locator('.gym-picker__group').first().textContent()) === 'Chest', `${headings}`);
  check('en: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
