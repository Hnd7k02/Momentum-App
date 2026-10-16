import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { URL_APP, check, clipped, onboard, openMuscles, phone, seed, seedMuscles, seedTraining, smallTargets, summary } from './lib.mjs';

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
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

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

    // Heute: the label opens the hub; the quick-log action does not.
    check(`${width}: Heute keeps the quick-log action`, await page.getByRole('button', { name: 'Session eintragen' }).isVisible());
    check(`${width}: Heute offers the Gym area by name`, await page.getByRole('button', { name: 'Gym öffnen' }).isVisible());
    await page.getByRole('button', { name: 'Gym öffnen' }).click();
    await page.waitForTimeout(1800);
    check(`${width}: Gym öffnen lands on the hub`, (await hash(page)) === '#/areas/gym', await hash(page));
    check(`${width}: the hub fetches nothing 3D`, fetched.length === 0, fetched.join(','));

    const train = await firstView(page, '.gym-hub__training');
    const muscles = await firstView(page, '.gym-hub__muscles');
    check(`${width}: Training erfassen is the first thing on the hub`, await page.getByRole('button', { name: 'Training erfassen' }).isVisible() && train.inView, JSON.stringify(train));
    check(`${width}: the muscle entry is on screen without scrolling`, muscles.inView, JSON.stringify(muscles));
    check(`${width}: the body preview does not dominate the hub`, muscles.height <= 200, String(muscles.height));
    const summaryText = ((await page.locator('.gym-hub__musclesSummary').textContent()) ?? '').trim();
    const overallText = ((await page.locator('.gym-hub__musclesOverall').textContent()) ?? '').trim();
    check(`${width}: the entry states the counted groups and the overall change`, /^\d+ von 10 gewertet$/.test(summaryText) && /^Gesamt [+-]?\d+ %$/.test(overallText), `${summaryText} | ${overallText}`);
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
    check(`${width}: the overall tile and the exercise list came along`, (await page.locator('[data-metric="gym-overall"]').count()) === 1 && (await page.locator('.gym-progress__row').count()) > 0);
    clip = await clipped(page);
    check(`${width}: the muscle destination is not clipped`, clip.length === 0, clip.slice(0, 2).join('; '));
    check(`${width}: the destination draws the 3D body, not a still`, (await page.locator('.body-viewer canvas').evaluate((c) => c.width > 0 && c.getContext('webgl2') !== null)) && (await page.locator('.muscle-module .body-renderer').count()) === 0 && (await page.locator('.muscle-module img').count()) === 0);
    check(`${width}: the body keeps its views`, (await page.locator('.body-viewer__view').count()) === 3);
    if (shoot) await page.screenshot({ path: tag('D', 'muscles-destination') });
    // D3: a selected muscle highlights on the 3D body, as before.
    await page.locator('.muscle-row').filter({ hasText: 'Brust' }).first().locator('.muscle-row__button').click();
    await page.waitForTimeout(900);
    check(`${width}: selecting a row marks it selected`, (await page.locator('.muscle-row__button[aria-pressed="true"] .muscle-row__name').textContent())?.trim() === 'Brust');
    await page.locator('.body-viewer').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    if (shoot) await page.screenshot({ path: tag('D3', 'muscles-selected') });

    // Back, both ways.
    await page.goBack();
    await page.waitForTimeout(900);
    check(`${width}: browser Back returns to the hub`, (await hash(page)) === '#/areas/gym', await hash(page));
    await page.goForward();
    await page.waitForTimeout(900);
    check(`${width}: Forward re-enters Muskelgruppen`, (await hash(page)) === '#/areas/gym/muscles', await hash(page));
    await page.getByRole('button', { name: 'Zurück' }).click();
    await page.waitForTimeout(900);
    check(`${width}: the screen's back control returns to the hub`, (await hash(page)) === '#/areas/gym', await hash(page));
    await page.goBack();
    await page.waitForTimeout(900);
    check(`${width}: and Back then leaves the area the way it was entered`, (await hash(page)) === '#/today', await hash(page));

    // A deep link.
    await page.goto(`${URL_APP}#/areas/gym/muscles`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000);
    check(`${width}: a link to #/areas/gym/muscles opens the destination`, (await page.locator('.muscle-row').count()) === 10 && ((await page.locator('.screen__title').textContent()) ?? '').trim() === 'Muskelgruppen');

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
    await page.getByRole('button', { name: 'Gym öffnen' }).click();
    await page.waitForTimeout(1500);
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
    check(`${width}: and both are announced as one status`, /^- status: Noch nicht trainiert Nach deiner ersten Session/.test(guidanceAria.trim()), guidanceAria);
    check(`${width}: no fake overall figure`, (await page.locator('[data-metric="gym-overall"]').count()) === 0);
    const clip = await clipped(page);
    check(`${width}: the empty destination is not clipped`, clip.length === 0, clip.slice(0, 2).join('; '));
    if (shoot) await page.screenshot({ path: tag('D2', 'muscles-no-data') });
    check(`${width}: no page errors (empty)`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}

await browser.close();
process.exit(summary() ? 0 : 1);
