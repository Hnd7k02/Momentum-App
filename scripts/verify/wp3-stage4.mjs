import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { URL_APP, check, clipped, onboard, phone, seed, seedLegacyFood, seedTraining, smallTargets, summary } from './lib.mjs';

/**
 * WP3, Stage 4 — Mind and Gym (P1–P3), on the real production build, under a
 * faked page clock in Europe/Berlin.
 *
 *   A  a device that had Food     seeded as the old build left it — the Food
 *                                 record on, every snapshot carrying it, two
 *                                 weeks of ratings with yesterday's still
 *                                 open — then loaded once: Food is off from
 *                                 today and shown nowhere (Heute, Gestern,
 *                                 Bereiche, Verlauf, Rang and its weights),
 *                                 nothing points to yesterday for it, every
 *                                 rating and entry and the record itself are
 *                                 kept, and a second load writes nothing
 *                                 (D139, D140, D141)
 *   B  its backup                 exported before that load, so Food is on in
 *                                 the file; imported onto a new device it
 *                                 keeps every Food row and is switched off
 *                                 from the import day (D139, D140)
 *   C  a new device               onboarding offers Mind and Gym, Laufen
 *                                 included, and nothing else; set up and
 *                                 used, the Food stores exist and stay empty
 *   D  Gestern's wording          the standard questions speak of yesterday
 *                                 on the Gestern side and of today on Heute
 *                                 (D144)
 *   E  the terminal               Mind | Gym on one line, unclipped (D143)
 *
 * Screenshots of every touched screen at 393×852, 430×932 and 320×693 go to
 * docs/design/wp3/stage4/.
 */
const OUT = process.env.OUT ?? 'docs/design/wp3/stage4';
const TMP = process.env.RELEASE_TMP ?? '/tmp';
mkdirSync(OUT, { recursive: true });
const TZ = 'Europe/Berlin';
const SIZES = [
  [393, 852],
  [430, 932],
  [320, 693],
];
/** A Wednesday, mid-week: yesterday is a Tuesday of the same week. */
const NOW = '2026-10-21T09:00:00+02:00';
const TODAY = '2026-10-21';
const YESTERDAY = '2026-10-20';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/* ── helpers ─────────────────────────────────────────────────────────── */

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const short = (value, n = 300) => {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s && s.length > n ? `${s.slice(0, n)}…` : s;
};
const shot = (page, width, slug) => page.screenshot({ path: `${OUT}/wp3-stage4-${width}-${slug}.png` });
const text = async (locator) =>
  (await locator.count()) > 0 ? ((await locator.first().textContent()) ?? '').replace(/\s+/g, ' ').trim() : null;
const texts = async (locator) => (await locator.allTextContents()).map((value) => value.replace(/\s+/g, ' ').trim());

const idb = (page, store) =>
  page.evaluate(async (s) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const rows = db.objectStoreNames.contains(s)
      ? await new Promise((res, rej) => { const r = db.transaction([s], 'readonly').objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })
      : null;
    db.close();
    return rows;
  }, store);

async function layoutChecks(page, name) {
  const clip = await clipped(page);
  check(`${name}: nothing is clipped`, clip.length === 0, clip.slice(0, 3).join('; '));
  const small = await smallTargets(page);
  check(`${name}: every control is a real target`, small.length === 0, small.slice(0, 4).join('; '));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`${name}: no sideways scroll`, overflow <= 1, `${overflow}px`);
}

/** No Food on screen: no Food element, and none of its words. */
async function noFood(page, name) {
  const found = await page.evaluate(() => ({
    nodes: document.querySelectorAll('[class*="food"]').length,
    words: (document.body.innerText.match(/Ernährung|Essen eintragen|Vorsatz|kcal/g) ?? []),
  }));
  check(`${name}: no Food anywhere`, found.nodes === 0 && found.words.length === 0, short(found));
}

/**
 * Brings an element to the top of Bereiche's own scroll port. Not
 * `scrollIntoView`: that also scrolls the app shell, which is
 * `overflow: hidden` — a script can move it and a finger cannot, so the
 * screenshot would show a layout no user ever sees.
 */
async function scrollAreasTo(page, locator) {
  await locator.evaluate((el) => {
    const port = el.closest('.areas__scroll');
    port.scrollTop += el.getBoundingClientRect().top - port.getBoundingClientRect().top;
  });
  await page.waitForTimeout(400);
}

const tab = async (page, name) => {
  await page.locator('.tab-bar button', { hasText: name }).click();
  await page.waitForTimeout(900);
};
const switchTo = async (page, side) => {
  await page.locator('.today__switch button', { hasText: side }).click();
  await page.waitForTimeout(900);
};

async function newDevice(width, height) {
  const ctx = await browser.newContext({ ...phone, viewport: { width, height }, timezoneId: TZ });
  await ctx.clock.install({ time: NOW });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

/** Six weeks of Mind, Gym and Laufen, and two weeks of Food, as the old build stored them. */
async function legacyDevice(width, height) {
  const device = await newDevice(width, height);
  await onboard(device.page, { gym: 3, running: 2 });
  await seed(device.page, { days: 42 });
  await seedTraining(device.page, { days: 42 });
  device.seeded = await seedLegacyFood(device.page, { days: 14, from: 2 });
  return device;
}

/** IndexedDB hands snapshots back by id; the log reads by date. */
const byDate = (snapshots) => [...snapshots].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom) || a.createdAt.localeCompare(b.createdAt));
const isFoodOn = (snapshot) => snapshot.config.domains.some((domain) => domain.type === 'food' && domain.enabled);

/* ── A, B, D, E: a device that had Food ──────────────────────────────── */

for (const [width, height] of SIZES) {
  const W = `${width}`;
  const { ctx, page, errors } = await legacyDevice(width, height);

  let backup = null;
  if (width === 393) {
    // B, first half: the backup a user took before updating — taken before
    // any load of this build has run, so Food is still on in it.
    await tab(page, 'Bereiche');
    const download = page.waitForEvent('download');
    await page.getByText('Backup exportieren').click();
    backup = `${TMP}/momentum-stage4-legacy-backup.json`;
    await (await download).saveAs(backup);
    const file = JSON.parse(readFileSync(backup, 'utf8')).data;
    check(`B ${W}: the backup taken before the update carries Food, on`,
      file.foodDays.length === 13 && file.foodEntries.length === 4 &&
        file.domains.some((domain) => domain.type === 'food' && domain.enabled) &&
        file.configSnapshots.every(isFoodOn),
      short({ days: file.foodDays.length, entries: file.foodEntries.length }));
  }

  // The first load of this build after the old one left Food on: a real
  // reload, since a hash change alone loads nothing.
  await page.goto(`${URL_APP}#/today`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  if (width === 393) {
    const snapshots = byDate(await idb(page, 'configSnapshots'));
    const last = snapshots[snapshots.length - 1];
    check(`A ${W}: the load appended one snapshot, effective today, with Food off`,
      snapshots.length === 2 && last.effectiveFrom === TODAY && !isFoodOn(last) && isFoodOn(snapshots[0]),
      short(snapshots.map((snapshot) => [snapshot.effectiveFrom, isFoodOn(snapshot)])));
    check(`A ${W}: and the Boss shared over what remains, equally`,
      same(Object.keys(last.config.boss.weights), ['mental', 'gym', 'running']) &&
        Object.values(last.config.boss.weights).every((share) => Math.abs(share - 1 / 3) < 1e-12),
      short(last.config.boss.weights));
    const food = (await idb(page, 'domains')).find((domain) => domain.type === 'food');
    check(`A ${W}: the Food record is kept, switched off, with its focus sentence (P2)`,
      food?.enabled === false && food?.settings.focus === 'Zmittag selber kochen', short(food));
    const days = await idb(page, 'foodDays');
    const entries = await idb(page, 'foodEntries');
    check(`A ${W}: every Food rating and entry is kept`, days.length === 13 && entries.length === 4,
      `${days.length} ratings, ${entries.length} entries`);
    check(`A ${W}: yesterday's rating stays missing — nothing can give it now (D141)`,
      !days.some((day) => day.date === YESTERDAY));
  }

  // D: Heute and Gestern.
  await noFood(page, `A ${W} Heute`);
  const progress = await text(page.locator('.today__progress'));
  check(`A ${W}: Heute counts Mind's questions only`, progress === '0 von 2 beantwortet', String(progress));
  check(`A ${W}: and does not point to Gestern for a Food rating (D141)`,
    (await page.locator('button.today__yesterday').count()) === 0);
  const heute = await texts(page.locator('.check-in__question'));
  check(`D ${W}: Heute asks the questions as stored`,
    same(heute, ['Wie gut hast du geschlafen?', 'Wie war deine Stimmung heute?']), short(heute));
  await layoutChecks(page, `A ${W} Heute`);
  await shot(page, width, 'heute');

  await switchTo(page, 'Gestern');
  await noFood(page, `A ${W} Gestern`);
  const gestern = await texts(page.locator('.check-in__question'));
  check(`D ${W}: Gestern speaks of yesterday`,
    same(gestern, ['Wie gut hast du in der Nacht auf gestern geschlafen?', 'Wie war deine Stimmung gestern?']), short(gestern));
  const done = await text(page.locator('.today__progress'));
  check(`A ${W}: yesterday is complete without its Food rating`, done === 'Gestern erledigt', String(done));
  await layoutChecks(page, `A ${W} Gestern`);
  await shot(page, width, 'gestern');
  // Unfolded, the answer group is named as the question reads.
  await page.locator('.check-in__summary').first().click();
  await page.waitForTimeout(500);
  const group = await page.locator('.check-in [role="radiogroup"]').first().getAttribute('aria-label');
  check(`D ${W}: the answer group is named as it reads`, group === 'Antwort auf: Wie gut hast du in der Nacht auf gestern geschlafen?', String(group));
  await shot(page, width, 'gestern-open');
  await switchTo(page, 'Heute');

  // E: Bereiche, Mind | Gym.
  await tab(page, 'Bereiche');
  const radios = page.getByRole('radiogroup', { name: 'Bereich wählen' }).getByRole('radio');
  check(`E ${W}: the terminal is Mind | Gym`, same(await texts(radios), ['Mind', 'Gym']), short(await texts(radios)));
  const box = await page.getByRole('radiogroup', { name: 'Bereich wählen' }).boundingBox();
  const cut = await radios.evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).length);
  check(`E ${W}: on one line, no label clipped`, box !== null && box.height < 60 && cut === 0, `${box?.height} / ${cut}`);
  check(`E ${W}: the Mind area is named Mind`, same(await texts(page.locator('.areas__domainName')), ['Mind']));
  await noFood(page, `A ${W} Bereiche → Mind`);
  await layoutChecks(page, `E ${W} Bereiche → Mind`);
  await shot(page, width, 'bereiche-mind');
  await page.getByRole('radio', { name: 'Gym' }).click();
  await page.waitForTimeout(2000);
  await noFood(page, `A ${W} Bereiche → Gym`);
  await layoutChecks(page, `E ${W} Bereiche → Gym`);
  await shot(page, width, 'bereiche-gym');
  // Below the area: pause, backup, credits and Einstellungen.
  await scrollAreasTo(page, page.locator('.areas__general'));
  await noFood(page, `A ${W} Weiteres`);
  await shot(page, width, 'bereiche-weiteres');
  await scrollAreasTo(page, page.locator('.section__label', { hasText: /^Einstellungen$/ }));
  await shot(page, width, 'bereiche-einstellungen');

  // Verlauf and Rang.
  await tab(page, 'Verlauf');
  const rows = await texts(page.locator('.heatmap__label'));
  check(`A ${W}: Verlauf has a Mind row and no Ernährung row`, rows.includes('Mind') && !rows.includes('Ernährung'), short(rows));
  await noFood(page, `A ${W} Verlauf`);
  await layoutChecks(page, `A ${W} Verlauf`);
  await shot(page, width, 'verlauf');

  await tab(page, 'Rang');
  const standing = await texts(page.locator('.domain-standing__name'));
  check(`A ${W}: Rang lists Mind, Gym and Laufen`, same(standing, ['Mind', 'Gym', 'Laufen']), short(standing));
  await page.locator('.boss-weights__explain').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const weights = await texts(page.locator('.boss-weights__name'));
  const shares = (await texts(page.locator('.boss-weights__share'))).map((value) => Number(value.replace(/[^0-9]/g, '')));
  check(`A ${W}: the Boss weights are Mind, Gym and Laufen, adding to 100`,
    same(weights, ['Mind', 'Gym', 'Laufen']) && shares.reduce((sum, value) => sum + value, 0) === 100,
    short({ weights, shares }));
  const listed = (await texts(page.locator('.domain-standing__meta'))).map((meta) => Number((meta.match(/(\d+) %/) ?? [])[1]));
  check(`A ${W}: the list of areas states the same shares as the Gewichtung card`, same(listed, shares), short({ listed, shares }));
  await noFood(page, `A ${W} Rang`);
  await layoutChecks(page, `A ${W} Rang`);
  await shot(page, width, 'rang-gewichtung');

  if (width === 393) {
    // A second load writes nothing: the switch-off is done once.
    const before = { snapshots: await idb(page, 'configSnapshots'), domains: await idb(page, 'domains') };
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    check(`A ${W}: a second load writes nothing`,
      same(await idb(page, 'configSnapshots'), before.snapshots) && same(await idb(page, 'domains'), before.domains));
  }

  check(`A ${W}: no page error`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();

  if (backup) {
    // B, second half: the old backup onto a new device.
    const device = await newDevice(width, height);
    await onboard(device.page, { gym: 3, running: 0 });
    await tab(device.page, 'Bereiche');
    await device.page.locator('input[type="file"]').setInputFiles(backup);
    await device.page.waitForTimeout(900);
    const confirm = device.page.getByRole('button', { name: 'Ersetzen' });
    if (await confirm.count()) {
      await confirm.click();
      await device.page.waitForTimeout(1800);
    }
    check(`B ${W}: the old backup restores`, await device.page.locator('.backup__status--ok').isVisible());
    const days = await idb(device.page, 'foodDays');
    const entries = await idb(device.page, 'foodEntries');
    check(`B ${W}: with every Food rating and entry in it`, days.length === 13 && entries.length === 4,
      `${days.length} ratings, ${entries.length} entries`);
    const snapshots = byDate(await idb(device.page, 'configSnapshots'));
    const last = snapshots[snapshots.length - 1];
    check(`B ${W}: and Food switched off from the import day`,
      last.effectiveFrom === TODAY && !isFoodOn(last) && snapshots.slice(0, -1).every(isFoodOn),
      short(snapshots.map((snapshot) => [snapshot.effectiveFrom, isFoodOn(snapshot)])));
    const food = (await idb(device.page, 'domains')).find((domain) => domain.type === 'food');
    check(`B ${W}: the record kept, off, with its sentence`, food?.enabled === false && food?.settings.focus === 'Zmittag selber kochen', short(food));
    check(`B ${W}: the terminal shows Mind | Gym`,
      same(await texts(device.page.getByRole('radiogroup', { name: 'Bereich wählen' }).getByRole('radio')), ['Mind', 'Gym']));
    await noFood(device.page, `B ${W} Bereiche`);
    await tab(device.page, 'Heute');
    await noFood(device.page, `B ${W} Heute`);
    check(`B ${W}: no page error`, device.errors.length === 0, device.errors.slice(0, 2).join(' | '));
    await device.ctx.close();
  }
}

/* ── C: a new device ─────────────────────────────────────────────────── */

for (const [width, height] of SIZES) {
  const W = `C ${width}`;
  const { ctx, page, errors } = await newDevice(width, height);
  await page.getByRole('button', { name: /Los geht/ }).click();
  await page.waitForTimeout(400);
  check(`${W}: the second screen names two worlds, Laufen inside Gym`,
    (await text(page.locator('.welcome__tagline'))) === 'Zwei Welten' &&
      (await text(page.locator('.onboarding__lead'))) === 'Mind und Gym, Laufen inbegriffen. Du wählst, was zählt.');
  await noFood(page, `${W} concept`);
  await layoutChecks(page, `${W} concept`);
  await shot(page, width, 'onboarding-worlds');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.waitForTimeout(400);
  const choices = await texts(page.locator('.question-pick .question-pick__text'));
  const hints = await texts(page.locator('.question-pick .onboarding__hint'));
  check(`${W}: the picker offers Mind and Gym, and nothing else`, same(choices, ['Mind', 'Gym']), short(choices));
  check(`${W}: Gym names its runs`, hints[1] === 'Gym-Sessions und Läufe, je mit eigenem Wochenziel.', short(hints));
  await noFood(page, `${W} picker`);
  await layoutChecks(page, `${W} picker`);
  await shot(page, width, 'onboarding-picker');

  if (width === 393) {
    await page.goto(URL_APP, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await onboard(page, { gym: 3, running: 2 });
    for (const option of await page.locator('.check-in .answer-scale__value', { hasText: /^7$/ }).all()) {
      await option.click();
      await page.waitForTimeout(250);
    }
    await page.locator('.week__log', { hasText: 'Lauf eintragen' }).click();
    await page.waitForTimeout(900);
    const domains = await idb(page, 'domains');
    const days = await idb(page, 'foodDays');
    const entries = await idb(page, 'foodEntries');
    check(`${W}: set up and used, no Food domain exists`, !domains.some((domain) => domain.type === 'food'), short(domains.map((d) => d.type)));
    check(`${W}: and the Food stores exist and stay empty (D140)`,
      Array.isArray(days) && days.length === 0 && Array.isArray(entries) && entries.length === 0,
      short({ days, entries }));
  }
  check(`${W}: no page error`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
