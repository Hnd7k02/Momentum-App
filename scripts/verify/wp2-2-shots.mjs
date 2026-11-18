import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { CHROMIUM, URL_APP, check, clipped, onboard, openGroup, openGroupSheet, openGymHub, openMuscles, openRow, phone, seed, seedMuscles, seedTraining, sheetExercises, sheetGone, smallTargets, summary } from './lib.mjs';

/**
 * WP2-2 — the Gym hub, on the real production build, at 393, 360 and 430.
 *
 * Proves the navigation: Heute's Gym label opens the hub, the quick-log
 * action still opens a session directly, the hub exposes Training erfassen
 * and Muskelgruppen at first sight, the muscle destination is its own route
 * and the only place the 3D chunk and the model are fetched, it exists
 * before the first workout without colouring anything, and Back walks the
 * way the user came. Screenshots at 393 and 360 go to docs/design/wp2-2.
 */
const OUT = process.env.OUT ?? 'docs/design/wp2-2';
mkdirSync(OUT, { recursive: true });
const SHOT_WIDTHS = [393, 360];
const CHECK_WIDTHS = [393, 360, 430];
const browser = await chromium.launch({ executablePath: CHROMIUM });

const hash = (page) => page.evaluate(() => location.hash);

/** One saved plan straight into the store, so the chooser has something to offer. */
async function seedPlan(page) {
  return page.evaluate(async () => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const db = await open();
    const stamp = new Date().toISOString();
    await new Promise((res, rej) => {
      const tx = db.transaction(['gymPlans'], 'readwrite');
      tx.objectStore('gymPlans').put({ id: 'wp22-plan', kind: 'userTrainingPlan', version: 1, name: 'Push A', exercises: [
        { exerciseId: 'ex_bench_press', name: 'Bench Press', order: 0 }, { exerciseId: 'ex_triceps_pushdown', name: 'Triceps Pushdown', order: 1 }], createdAt: stamp, updatedAt: stamp });
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
  });
}

async function boot(width, { withData }) {
  const ctx = await browser.newContext({ ...phone, viewport: { width, height: width === 430 ? 932 : 852 } });
  const page = await ctx.newPage();
  const fetched = [];
  const preview = [];
  page.on('response', async (r) => {
    if (/BodyViewer|\.glb/.test(r.url())) fetched.push(r.url().split('/').pop());
    if (/body-preview.*\.webp$/.test(r.url())) preview.push({ file: r.url().split('/').pop(), bytes: (await r.body().catch(() => Buffer.alloc(0))).length });
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await onboard(page, { gym: 3, running: 2 });
  if (withData) {
    await seed(page, { days: 42 });
    await seedTraining(page, { days: 42 });
    await seedMuscles(page, { days: 42 });
    await seedPlan(page);
  }
  // What the hub fetches is counted from here. Since block 7E the
  // onboarding's Gym card shows the same still (D191), so the walk through
  // it fetched the file once already — the same file, which said nothing
  // about the hub (block 9).
  preview.length = 0;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return { ctx, page, fetched, preview, errors };
}

const firstView = (page, selector) => page.locator(selector).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), inView: r.top >= 0 && r.bottom <= window.innerHeight };
});

for (const width of CHECK_WIDTHS) {
  const tag = (letter, slug) => `${OUT}/${width}-${letter}-${slug}.png`;
  const shoot = SHOT_WIDTHS.includes(width);

  /* ── With data: Heute → Gym → hub → Muskelgruppen ───────────────────── */
  {
    const { ctx, page, fetched, preview, errors } = await boot(width, { withData: true });

    // Heute: the Gym label is the door to the body (block 7B, D161) and is
    // named for it; the quick-log action stays. Until block 7B the label
    // was named "Gym öffnen" and led to the hub. Where it leads now, and
    // the way back, is checked further down, once the hub has been seen
    // with nothing 3D fetched.
    check(`${width}: Heute keeps the quick-log action`, await page.getByRole('button', { name: 'Session eintragen' }).isVisible());
    check(`${width}: Heute's Gym label is named for where it leads: Muskelgruppen`, await page.getByRole('button', { name: 'Muskelgruppen öffnen' }).isVisible()
      && (await page.getByRole('button', { name: 'Gym öffnen' }).count()) === 0);
    check(`${width}: Heute itself fetches nothing 3D`, fetched.length === 0, fetched.join(','));
    await openGymHub(page, { wait: 1500 });
    check(`${width}: the tab and the area lead to the hub`, (await hash(page)) === '#/areas/gym', await hash(page));
    check(`${width}: the hub fetches nothing 3D`, fetched.length === 0, fetched.join(','));

    const train = await firstView(page, '.gym-hub__training');
    const muscles = await firstView(page, '.gym-hub__muscles');
    check(`${width}: Training erfassen is the first thing on the hub`, await page.getByRole('button', { name: 'Training erfassen' }).isVisible() && train.inView, JSON.stringify(train));
    check(`${width}: the muscle entry is on screen without scrolling`, muscles.inView, JSON.stringify(muscles));
    check(`${width}: the body preview does not dominate the hub`, muscles.height <= 200, String(muscles.height));
    const summaryText = ((await page.locator('.gym-hub__musclesSummary').textContent()) ?? '').trim();
    const overallText = ((await page.locator('.gym-hub__musclesOverall').textContent()) ?? '').trim();
    check(`${width}: the entry states the counted groups and the overall change`, /^\d+ von 10 gewertet$/.test(summaryText) && /^Leistungstrend ([+\u2212]\d+\s%|Gehalten)$/.test(overallText), `${summaryText} | ${overallText}`);
    const summaryLines = await page.locator('.gym-hub__musclesSummary').evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
    check(`${width}: the count sits on one line`, summaryLines === 1, String(summaryLines));
    const headings = await page.locator('.areas__scroll h2, .areas__scroll .section__label').allTextContents();
    check(`${width}: "Muskelgruppen" is not repeated above its card`, !headings.some((h) => h.trim() === 'Muskelgruppen') && (await page.locator('.gym-hub__musclesTitle').count()) === 1, headings.join('|'));
    check(`${width}: "Laufen" heads its block once`, headings.filter((h) => h.trim() === 'Laufen').length === 1, headings.join('|'));
    check(`${width}: the entry is one named button`, (await page.getByRole('button', { name: 'Muskelgruppen öffnen' }).count()) === 1);
    check(`${width}: the preview is the still of the approved body, not the SVG diagram`, (await page.locator('.gym-hub__previewBody').count()) === 1 && (await page.locator('.gym-hub__muscles .body-renderer').count()) === 0 && (await page.locator('.gym-hub__previewBody').evaluate((img) => img.complete && img.naturalWidth > 0)));
    check(`${width}: the preview is one small asset`, preview.length === 1 && preview[0].bytes > 0 && preview[0].bytes <= 20000, JSON.stringify(preview));
    const lit = await page.locator('.gym-hub__previewState').evaluateAll((els) => els.map((el) => [...el.classList].find((c) => /--(improved|unchanged|declined|awaitingBaseline|noData)$/.test(c))?.split('--')[1]));
    const measuredCount = Number(/^(\d+) von/.exec(summaryText)?.[1] ?? 0);
    check(`${width}: ten markers, lit only where a group is measured`, lit.length === 10 && lit.filter((s) => s === 'improved' || s === 'unchanged' || s === 'declined').length === measuredCount, lit.join(','));
    const weekText = ((await page.locator('.gym-hub__week').textContent()) ?? '').trim();
    // The sentence follows the stored count against the target of 3, whatever
    // weekday the suite runs on: a fraction below, "Ziel erreicht" at, "· Ziel 3" above.
    const sessionsThisWeek = await page.evaluate(async () => {
      const db = await new Promise((res, rej) => { const r = indexedDB.open('momentum'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const rows = await new Promise((res, rej) => { const r = db.transaction(['gymSessions'], 'readonly').objectStore('gymSessions').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const now = new Date(); now.setHours(12, 0, 0, 0);
      const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const from = key(monday);
      const to = key(now);
      return rows.filter((r) => r.date >= from && r.date <= to).length;
    });
    const expectedWeek = sessionsThisWeek < 3 ? `${sessionsThisWeek} von 3 Sessions diese Woche` : sessionsThisWeek === 3 ? '3 Sessions diese Woche ·\u00A0Ziel\u00A0erreicht' : `${sessionsThisWeek} Sessions diese Woche ·\u00A0Ziel\u00A03`;
    check(`${width}: the week line reads the stored count in the right form`, weekText === expectedWeek, `${weekText} | expected ${expectedWeek}`);
    check(`${width}: the plan count is a figure`, ((await page.locator('.gym-hub__plans span').first().textContent()) ?? '').trim() === '1 Plan');
    check(`${width}: the rating board is still on the hub, below`, (await page.locator('[data-metric="gym-rating"]').count()) === 1);
    check(`${width}: the plans are reachable from the hub`, await page.getByRole('button', { name: 'Pläne verwalten' }).isVisible() && (await page.locator('.plans__slots').count()) === 1);
    let clip = await clipped(page);
    check(`${width}: the hub is not clipped`, clip.length === 0, clip.slice(0, 2).join('; '));
    let small = await smallTargets(page);
    check(`${width}: every hub control is a real target`, small.length === 0, small.slice(0, 3).join('; '));
    if (shoot) await page.screenshot({ path: tag('A', 'hub-with-data') });

    // E: plan management from the hub.
    await page.getByRole('button', { name: 'Pläne verwalten' }).click();
    await page.waitForTimeout(900);
    const plans = await firstView(page, '.plans__slots');
    check(`${width}: Pläne verwalten brings the plans into view`, plans.inView && (await page.getByRole('button', { name: /^Push A/ }).isVisible()), JSON.stringify(plans));
    if (shoot) await page.screenshot({ path: tag('E', 'plans-from-hub') });
    await page.locator('.areas__scroll').evaluate((el) => { el.scrollTop = 0; });
    await page.waitForTimeout(400);

    // C: the chooser from the hub's primary action.
    await page.getByRole('button', { name: 'Training erfassen' }).click();
    await page.waitForTimeout(600);
    const chooser = page.locator('[role="dialog"]');
    check(`${width}: Training erfassen opens the plan chooser`, (await chooser.count()) === 1 && (await chooser.getByRole('button', { name: /^Push A/ }).count()) === 1);
    check(`${width}: with the free session second`, await chooser.getByRole('button', { name: 'Freie Session' }).isVisible());
    if (shoot) await page.screenshot({ path: tag('C', 'chooser-from-hub') });
    await chooser.getByRole('button', { name: /^Push A/ }).click();
    await page.waitForTimeout(800);
    check(`${width}: choosing the plan opens the draft on top of the hub`, (await page.locator('.gym-session').count()) === 1 && (await page.locator('.gym-exercise__name').count()) === 2);
    await page.getByRole('button', { name: 'Fertig' }).click();
    await page.waitForTimeout(800);
    check(`${width}: closing the draft returns to the hub, unchanged`, (await hash(page)) === '#/areas/gym' && (await page.locator('.gym-session').count()) === 0);

    // D: the muscle destination.
    await openMuscles(page, { wait: 4500 });
    check(`${width}: Muskelgruppen is its own route`, (await hash(page)) === '#/areas/gym/muscles', await hash(page));
    check(`${width}: and the only place the viewer chunk and the model are fetched`, fetched.some((f) => /^BodyViewer.*\.js$/.test(f)) && fetched.includes('momentum-body.glb'), fetched.join(','));
    check(`${width}: the body and the ten rows are there`, (await page.locator('.body-viewer canvas').count()) === 1 && (await page.locator('.muscle-row').count()) === 10);
    // Until block 7C a list of every exercise stood under the ten rows. The
    // exercises of a group now stand in the group's sheet (contract §9),
    // and under the rows there is the way to the hub and nothing else.
    check(`${width}: the overall tile came along, and no list of exercises stands under the rows`, (await page.locator('[data-metric="gym-overall"]').count()) === 1 && (await page.locator('.gym-progress__row').count()) === 0 && (await page.locator('.gym-muscles__toHub').count()) === 1);
    clip = await clipped(page);
    check(`${width}: the muscle destination is not clipped`, clip.length === 0, clip.slice(0, 2).join('; '));
    // Since block 7B the body's still stands in the stage until the first
    // picture has been drawn (contract §11). The rule is the same — the
    // destination draws the 3D body, not a picture of it — and is held once
    // the stage says the body is shown: no still is left then.
    await page.waitForFunction(() => document.querySelector('.body-stage')?.getAttribute('data-stage') === 'shown', null, { timeout: 30000 }).catch(() => undefined);
    check(`${width}: the destination draws the 3D body, not a still`, (await page.locator('.body-stage').getAttribute('data-stage')) === 'shown' && (await page.locator('.body-viewer canvas').evaluate((c) => c.width > 0 && c.getContext('webgl2') !== null)) && (await page.locator('.muscle-module .body-renderer').count()) === 0 && (await page.locator('.muscle-module img').count()) === 0);
    check(`${width}: the body keeps its views`, (await page.locator('.body-viewer__view').count()) === 3);
    if (shoot) await page.screenshot({ path: tag('D', 'muscles-destination') });
    // D3: a tap on a row opens the group's sheet, with the group's
    // exercises in it; the row is marked while it stands. (Until block 7C
    // the row was a toggle and the check read its pressed state.)
    await openGroupSheet(page, 'Brust');
    check(`${width}: a row opens its group's sheet and is marked as open`, (await openGroup(page)) === 'Brust' && (await openRow(page))?.trim() === 'Brust', `${await openGroup(page)} / ${await openRow(page)}`);
    check(`${width}: the group's exercises stand in its sheet`, (await sheetExercises(page)).length > 0);
    if (shoot) await page.screenshot({ path: tag('D3', 'muscles-selected') });

    // Back, both ways. The first Back closes the sheet and leaves the
    // screen where it is — and the address as it was; the second leaves.
    await page.goBack();
    await sheetGone(page);
    await page.waitForTimeout(600);
    check(`${width}: browser Back closes the sheet and stays on Muskelgruppen`, (await openGroup(page)) === null && (await hash(page)) === '#/areas/gym/muscles' && (await page.locator('.muscle-row').count()) === 10, await hash(page));
    await page.goBack();
    await page.waitForTimeout(900);
    check(`${width}: browser Back returns to the hub`, (await hash(page)) === '#/areas/gym', await hash(page));
    await page.goForward();
    await page.waitForTimeout(900);
    check(`${width}: Forward re-enters Muskelgruppen`, (await hash(page)) === '#/areas/gym/muscles', await hash(page));
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await page.waitForTimeout(900);
    check(`${width}: the screen's back control returns to the hub`, (await hash(page)) === '#/areas/gym', await hash(page));
    await page.goBack();
    await page.waitForTimeout(900);
    // The hub was entered from the area before it — Bereiche opens on Mind —
    // and that is where Back leads. (Until block 7B this walk began on
    // Heute's label, and Back led to Heute.)
    check(`${width}: and Back then leaves the hub the way it was entered`, (await hash(page)) === '#/areas/mental', await hash(page));

    // A deep link.
    await page.goto(`${URL_APP}#/areas/gym/muscles`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000);
    check(`${width}: a link to #/areas/gym/muscles opens the destination`, (await page.locator('.muscle-row').count()) === 10 && ((await page.locator('.gym-muscles__title').textContent()) ?? '').trim() === 'Muskelgruppen');
    // After a link straight to the address there is no place to go back to:
    // the back control leads to the hub.
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await page.waitForTimeout(900);
    check(`${width}: after a direct link the back control leads to the hub`, (await hash(page)) === '#/areas/gym', await hash(page));

    // From Heute straight to the body, and back to Heute (D161).
    await page.locator('.tab-bar button', { hasText: 'Heute' }).click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Muskelgruppen öffnen' }).click();
    await page.waitForTimeout(2500);
    check(`${width}: Heute's Gym label lands on Muskelgruppen directly`, (await hash(page)) === '#/areas/gym/muscles' && (await page.locator('.body-stage').count()) === 1, await hash(page));
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await page.waitForTimeout(900);
    check(`${width}: and the back control returns to Heute`, (await hash(page)) === '#/today', await hash(page));
    await page.getByRole('button', { name: 'Muskelgruppen öffnen' }).click();
    await page.waitForTimeout(1500);
    await page.goBack();
    await page.waitForTimeout(900);
    check(`${width}: so does the browser's own Back`, (await hash(page)) === '#/today', await hash(page));
    await page.getByRole('button', { name: 'Muskelgruppen öffnen' }).click();
    await page.waitForTimeout(1500);
    const toHub = page.getByRole('button', { name: /Zur Gym-Übersicht/ });
    await toHub.scrollIntoViewIfNeeded();
    const toHubBox = await toHub.boundingBox();
    check(`${width}: from Muskelgruppen the hub is one tap away, on a target of its own`, toHubBox !== null && toHubBox.height >= 44, JSON.stringify(toHubBox));
    await toHub.click();
    await page.waitForTimeout(900);
    check(`${width}: that tap leads to the hub, although Back would have led to Heute`, (await hash(page)) === '#/areas/gym' && (await page.getByRole('button', { name: 'Training erfassen' }).isVisible()), await hash(page));
    await page.goBack();
    await page.waitForTimeout(900);
    check(`${width}: and Back from the hub returns to Muskelgruppen, where the tap was made`, (await hash(page)) === '#/areas/gym/muscles', await hash(page));

    // Quick log from Heute still goes straight to the session, not the hub.
    await page.locator('.tab-bar button', { hasText: 'Heute' }).click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Session eintragen' }).click();
    await page.waitForTimeout(700);
    check(`${width}: Heute's quick log opens the chooser directly, no hub in between`, (await hash(page)) === '#/today' && (await page.locator('[role="dialog"]').count()) === 1);
    await page.keyboard.press('Escape');
    check(`${width}: no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* ── Without data: the destination exists before the first workout ───── */
  {
    const { ctx, page, fetched, preview, errors } = await boot(width, { withData: false });
    await openGymHub(page, { wait: 1500 });
    const summaryText = ((await page.locator('.gym-hub__musclesSummary').textContent()) ?? '').trim();
    check(`${width}: with no data the entry says so`, summaryText === 'Noch nicht trainiert', summaryText);
    const states = await page.locator('.gym-hub__previewState').evaluateAll((els) => [...new Set(els.map((el) => [...el.classList].find((c) => c.startsWith('gym-hub__previewState--'))))]);
    check(`${width}: the preview colours nothing as progress`, states.length === 1 && states[0] === 'gym-hub__previewState--noData', states.join(','));
    check(`${width}: the same still stands before the first workout`, (await page.locator('.gym-hub__previewBody').count()) === 1 && preview.length === 1, JSON.stringify(preview));
    check(`${width}: the training card says no session yet`, ((await page.locator('.gym-hub__week').textContent()) ?? '').trim() === 'Noch keine Session erfasst.');
    check(`${width}: nothing 3D on the empty hub`, fetched.length === 0, fetched.join(','));
    if (shoot) await page.screenshot({ path: tag('B', 'hub-no-data') });
    await openMuscles(page, { wait: 4500 });
    check(`${width}: the muscle destination exists with no data`, (await hash(page)) === '#/areas/gym/muscles' && (await page.locator('.muscle-row').count()) === 10);
    const rowStates = (await page.locator('.muscle-row').allTextContents()).map((s) => s.trim());
    check(`${width}: every row says untrained, none fakes a state`, rowStates.length === 10 && rowStates.every((s) => /Noch nicht trainiert/.test(s)), rowStates.join('|').slice(0, 80));
    check(`${width}: the guidance is a status, not an alert`, (await page.locator('.gym-progress__noData[role="status"]').count()) === 1);
    const guidance = await page.locator('.gym-progress__noData').evaluate((el) => {
      const [state, hint] = el.children;
      return { children: el.children.length, stateBlock: getComputedStyle(state).display === 'block' && getComputedStyle(hint).display === 'block', stateBelow: hint.getBoundingClientRect().top >= state.getBoundingClientRect().bottom, text: el.textContent.trim() };
    });
    check(`${width}: the state stands on its own line above the hint`, guidance.children === 2 && guidance.stateBlock && guidance.stateBelow, JSON.stringify(guidance));
    const guidanceAria = await page.locator('.gym-progress__noData').ariaSnapshot();
    check(`${width}: and both are announced as one status`, /^- status: Noch nicht trainiert Ab dem dritten Übungstag einer Gruppe zeigt Momentum ihren Leistungstrend\.$/.test(guidanceAria.trim()), guidanceAria);
    check(`${width}: no fake overall figure`, (await page.locator('[data-metric="gym-overall"]').count()) === 0);
    const clip = await clipped(page);
    check(`${width}: the empty destination is not clipped`, clip.length === 0, clip.slice(0, 2).join('; '));
    if (shoot) await page.screenshot({ path: tag('D2', 'muscles-no-data') });
    // "Pläne verwalten" and Back are two things (block 7B): from the empty
    // Muskelgruppen, opened from Heute, the plan chooser's link leads to the
    // hub — where the plans are — and not back to Heute.
    await page.locator('.tab-bar button', { hasText: 'Heute' }).click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Muskelgruppen öffnen' }).click();
    await page.waitForTimeout(2000);
    // A plan, so that the one action of the empty state opens the chooser.
    await seedPlan(page);
    await page.getByRole('button', { name: 'Training erfassen' }).click();
    await page.waitForTimeout(900);
    const manage = page.locator('[role="dialog"]').getByRole('button', { name: 'Pläne verwalten' });
    check(`${width}: the empty state's action opens the plan chooser over a body that stands still`, (await manage.count()) === 1 && (await page.locator('.body-viewer').getAttribute('data-held')) !== null);
    if ((await manage.count()) === 1) {
      await manage.click();
      await page.waitForTimeout(900);
      check(`${width}: "Pläne verwalten" leads to the hub, not back to Heute`, (await hash(page)) === '#/areas/gym', await hash(page));
      // …and on the hub to the plans themselves (the tidy-up, D163): the
      // move says what it was made for, the hub brings its plans into view
      // and puts the focus on their heading. Back returns to Muskelgruppen.
      await page.waitForTimeout(600);
      const arrived = await firstView(page, '.plans__slots');
      check(`${width}: from the empty Muskelgruppen, "Pläne verwalten" stands at the training plans`, arrived.inView && (await page.getByRole('button', { name: /^Push A/ }).isVisible()), JSON.stringify(arrived));
      const focused = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent }));
      check(`${width}: and the focus is on the plans' heading`, focused.tag === 'H2' && focused.text === 'Trainingspläne', JSON.stringify(focused));
      if (shoot) await page.screenshot({ path: tag('E2', 'plans-from-muscles') });
      await page.goBack();
      await page.waitForTimeout(1500);
      check(`${width}: Back from there returns to Muskelgruppen`, (await hash(page)) === '#/areas/gym/muscles' && (await page.locator('.muscle-row').count()) === 10, await hash(page));

      // The same from Heute: the plan chooser of its Gym card.
      await page.locator('.tab-bar button', { hasText: 'Heute' }).click();
      await page.waitForTimeout(700);
      await page.getByRole('button', { name: 'Session eintragen' }).first().click();
      await page.waitForTimeout(900);
      const fromToday = page.locator('[role="dialog"]').getByRole('button', { name: 'Pläne verwalten' });
      check(`${width}: Heute's Gym card opens the plan chooser`, (await fromToday.count()) === 1);
      if ((await fromToday.count()) === 1) {
        await fromToday.click();
        await page.waitForTimeout(1500);
        const there = await firstView(page, '.plans__slots');
        check(`${width}: from Heute, "Pläne verwalten" stands at the training plans`, (await hash(page)) === '#/areas/gym' && there.inView, `${await hash(page)} ${JSON.stringify(there)}`);
        const focus = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent }));
        check(`${width}: and the focus is on the plans' heading (from Heute)`, focus.tag === 'H2' && focus.text === 'Trainingspläne', JSON.stringify(focus));
        await page.goBack();
        await page.waitForTimeout(900);
        check(`${width}: Back from there returns to Heute`, (await hash(page)) === '#/today', await hash(page));
        // The hub opened for itself starts at its top: the intent was taken once.
        await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
        await page.waitForTimeout(1200);
        const top = await page.locator('.areas__scroll').evaluate((el) => el.scrollTop);
        check(`${width}: the hub opened by its tab starts at its top`, (await hash(page)) === '#/areas/gym' && top === 0, `${await hash(page)} scrollTop ${top}`);
      }
    }
    check(`${width}: no page errors (empty)`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}

await browser.close();
process.exit(summary() ? 0 : 1);
