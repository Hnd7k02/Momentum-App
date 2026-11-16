import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import {
  CHROMIUM, URL_APP, onboard, openGymHub, openMuscles, seed, seedSheetProfile, setLanguage,
  openGroupSheet, closeGroupSheet, openSheetExercise, closeExercise, bodyAtRest, sheetGone,
} from './lib.mjs';

/**
 * The pictures of block 7C (step 8), on the device of `muscle-sheet.mjs`
 * with one exercise more (`divergent`): the sheet in every state at the
 * four widths; the ten rows before and after their lines stood in one
 * column (D169); the candidates for a single observation (D170); and the
 * exercise detail beside the sheet in the form that was built and in the
 * other (D176).
 *
 * **Two kinds of picture here are not the app as built**, and their file
 * names say so:
 *
 * - `kandidat-*` and `zwei-zahlen-*` are drawn into the real screen from
 *   its real numbers — a candidate the owner chooses from, or the form
 *   that was not built. Nothing of them is in the source.
 * - `zeilen-vorher-*` is the screen with the one rule of D169 taken out
 *   again, as it stood before the block.
 *
 * The card of D168 is photographed by `muscle-card.mjs` (`SHOTS=<dir>`).
 * Run against the production preview (`vite preview --port 4173`).
 */

const OUT = process.env.OUT ?? 'docs/design/wp3/stage7c';
const WIDTHS = (process.env.WIDTHS ?? '320,360,393,430').split(',').map(Number);
const HEIGHT = { 320: 693, 360: 780, 393: 852, 430: 932 };
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROMIUM });
const written = [];

async function open(width, { language = 'de' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: HEIGHT[width] ?? 852 }, deviceScaleFactor: 2, hasTouch: true, locale: 'de-CH' });
  const page = await ctx.newPage();
  await page.goto(URL_APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await onboard(page, { gym: 3, running: 2 });
  await seed(page, { days: 90 });
  await seedSheetProfile(page, { divergent: true });
  if (language !== 'de') await setLanguage(page, language);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (language === 'de') {
    await openGymHub(page);
    await openMuscles(page, { wait: 4000 });
  } else {
    await page.evaluate(() => { window.location.hash = '#/areas/gym/muscles'; });
    await page.locator('.muscle-row').first().waitFor({ state: 'visible' });
    await page.waitForTimeout(4500);
  }
  return { ctx, page };
}
const shot = async (page, name, clip = undefined) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...(clip ? { clip } : {}) });
  written.push(name);
};
const upper = async (page) => { await page.locator('.sheet__grabber').click(); await page.waitForTimeout(700); };
const rangeInSheet = async (page, days) => {
  await page.locator('.sheet--detents .segmented__option', { hasText: String(days) }).click();
  await page.waitForFunction((d) => (document.querySelector('.sheet--detents .muscle-sheet__caption, .sheet--detents .muscle-sheet__sentence')?.textContent ?? '').includes(String(d)), days, { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(1200);
};
const boxOf = async (locator, pad = 8) => {
  const box = await locator.boundingBox();
  return { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 };
};

for (const width of WIDTHS) {
  const { ctx, page } = await open(width);

  /* ── The rows: after, and before (D169) ───────────────────────────────── */
  const rows = page.locator('.muscle-rows');
  await rows.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(500);
  await shot(page, `zeilen-nachher-${width}`);
  const before = await page.addStyleTag({ content: '.muscle-row__chart:not(:empty) + .muscle-row__right { width: auto !important; min-width: 62px !important; max-width: 172px !important; }' });
  await page.waitForTimeout(300);
  await shot(page, `zeilen-vorher-${width}`);
  await before.evaluate((el) => el.remove());
  await page.waitForTimeout(200);

  /* ── The sheet, state by state ────────────────────────────────────────── */
  await openGroupSheet(page, 'chest');
  await shot(page, `sheet-werte-unten-${width}`);
  await upper(page);
  await shot(page, `sheet-werte-oben-${width}`);
  await rangeInSheet(page, 90);
  await shot(page, `sheet-90-tage-${width}`);
  await rangeInSheet(page, 30);
  await closeGroupSheet(page);

  await openGroupSheet(page, 'back');
  await shot(page, `sheet-uneinheitlich-unten-${width}`);
  await upper(page);
  await shot(page, `sheet-uneinheitlich-${width}`);
  await closeGroupSheet(page);

  await openGroupSheet(page, 'biceps');
  await shot(page, `sheet-wenig-${width}`);
  await closeGroupSheet(page);

  await openGroupSheet(page, 'shoulders');
  await shot(page, `sheet-nicht-trainiert-${width}`);
  await closeGroupSheet(page);

  await openGroupSheet(page, 'core');
  await shot(page, `sheet-zurueckgegangen-${width}`);
  await closeGroupSheet(page);

  {
    /* ── D170: a single observation, as it is and as it could be ─────────── */
    // The row. (The focus went back to the row of the sheet closed last; its ring is not the subject.)
    await page.evaluate(() => document.activeElement?.blur?.());
    const row = page.locator('.muscle-row').filter({ has: page.locator('.muscle-row__button[data-muscle="forearms"]') });
    await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(400);
    const stripOf = async () => {
      const copy = page.locator('.muscle-row[data-candidate]');
      const mine = await ((await copy.count()) > 0 ? copy : row).first().boundingBox();
      // With the three rows above it: a candidate is read beside rows that draw a line.
      const above = await page.locator('.muscle-row').filter({ has: page.locator('.muscle-row__button[data-muscle="quadriceps"]') }).first().boundingBox();
      return { x: 0, y: Math.max(0, above.y - 4), width, height: mine.y + mine.height - above.y + 8 };
    };
    await shot(page, `kandidat-punkt-zeile-${width}`, await stripOf());
    // A candidate is drawn on a copy of the row: the row itself is the app's.
    const undoRow = () => row.first().evaluate((el) => { el.parentElement.querySelector('[data-candidate]')?.remove(); el.style.display = ''; });
    const drawRow = (kind) => row.first().evaluate((original, kind) => {
      const el = original.cloneNode(true);
      el.setAttribute('data-candidate', kind);
      original.style.display = 'none';
      original.after(el);
      const svg = el.querySelector('.muscle-row__chart svg');
      const dot = svg.querySelector('circle');
      const w = Number(svg.getAttribute('width'));
      const y = Number(dot.getAttribute('cy'));
      const NS = 'http://www.w3.org/2000/svg';
      if (kind === 'A') {
        // A line from the day the comparison starts from — the zero line — to the value.
        const line = document.createElementNS(NS, 'polyline');
        line.setAttribute('class', 'muscle-row__sparkLine');
        line.setAttribute('points', `3,12 ${w - 3},${y}`);
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke-linecap', 'round');
        svg.insertBefore(line, dot);
        dot.setAttribute('cx', String(w - 3));
      } else if (kind === 'C') {
        // A stroke from the zero line to the value: a value, no direction.
        const stroke = document.createElementNS(NS, 'line');
        stroke.setAttribute('class', 'muscle-row__sparkLine');
        stroke.setAttribute('x1', dot.getAttribute('cx'));
        stroke.setAttribute('x2', dot.getAttribute('cx'));
        stroke.setAttribute('y1', '12');
        stroke.setAttribute('y2', String(y));
        stroke.setAttribute('stroke-linecap', 'round');
        svg.insertBefore(stroke, dot);
      } else if (kind === 'B') {
        // No chart: the row gives its room to words, and says that this is the first comparison.
        el.querySelector('.muscle-row__chart').innerHTML = '';
        const note = document.createElement('span');
        note.className = 'muscle-row__sub muscle-row__days';
        note.textContent = 'Erster Vergleich';
        el.querySelector('.muscle-row__text').appendChild(note);
      }
    }, kind);
    for (const kind of ['A', 'B', 'C']) {
      await drawRow(kind);
      await page.waitForTimeout(200);
      await shot(page, `kandidat-${kind}-zeile-${width}`, await stripOf());
      await undoRow();
    }

    // The sheet's chart.
    await openGroupSheet(page, 'forearms');
    const head = async () => {
      const sheet = await page.locator('.sheet--detents').boundingBox();
      const end = await page.locator('.sheet--detents .muscle-sheet__section').first().boundingBox();
      return { x: 0, y: sheet.y, width, height: Math.min(end.y - sheet.y, (HEIGHT[width] ?? 852) - sheet.y) };
    };
    await shot(page, `kandidat-punkt-sheet-${width}`, await head());
    const chart = page.locator('.sheet--detents .exercise-line').first();
    const undoChart = () => chart.evaluate((el) => { el.parentElement.querySelector('[data-candidate]')?.remove(); el.style.display = ''; });
    const drawChart = (kind) => chart.evaluate((original, kind) => {
      const el = original.cloneNode(true);
      el.setAttribute('data-candidate', kind);
      original.after(el);
      // Measured while both stand, then the app's own chart steps aside.
      const svg = el.querySelector('.exercise-line__svg');
      const end = el.querySelector('.exercise-line__end');
      const plot = el.querySelector('.exercise-line__plot').getBoundingClientRect();
      const zero = el.querySelector('.exercise-line__zero').getBoundingClientRect().top - plot.top;
      const dotY = end.getBoundingClientRect().top + 3 - plot.top;
      const share = (px) => ((px - 3) / (plot.height - 6)) * 100;
      const NS = 'http://www.w3.org/2000/svg';
      original.style.display = 'none';
      if (kind === 'A') {
        const line = document.createElementNS(NS, 'polyline');
        line.setAttribute('class', 'exercise-line__line');
        line.setAttribute('points', `0,${share(zero).toFixed(2)} 100,${share(dotY).toFixed(2)}`);
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.appendChild(line);
        end.style.left = 'calc(3px + (100% - 6px) * 1)';
        const dates = el.querySelector('.gym-detail__dates');
        const first = document.createElement('span');
        // The day the comparison starts from: the group's first day in the range.
        first.textContent = window.__firstDay ?? '';
        dates.insertBefore(first, dates.firstChild);
      } else if (kind === 'C') {
        const stroke = document.createElementNS(NS, 'line');
        stroke.setAttribute('class', 'exercise-line__line');
        stroke.setAttribute('x1', '50');
        stroke.setAttribute('x2', '50');
        stroke.setAttribute('y1', share(zero).toFixed(2));
        stroke.setAttribute('y2', share(dotY).toFixed(2));
        stroke.setAttribute('stroke-linecap', 'round');
        stroke.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.appendChild(stroke);
      } else if (kind === 'B') {
        const note = document.createElement('p');
        note.className = 'muscle-sheet__sentence';
        note.setAttribute('data-candidate', kind);
        note.textContent = `Erster Vergleich: ${el.querySelector('.exercise-line__value').textContent} seit dem ${window.__firstDay}. Ab dem nächsten Trainingstag zeigt Momentum den Verlauf.`;
        el.replaceWith(note);
      }
    }, kind);
    // The first day of the group in the range, as the chart would name it: the carry's and the curls' first day.
    await page.evaluate(() => {
      const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - 15);
      window.__firstDay = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'long' }).format(d);
    });
    for (const kind of ['A', 'B', 'C']) {
      await drawChart(kind);
      await page.waitForTimeout(200);
      await shot(page, `kandidat-${kind}-sheet-${width}`, await head());
      await undoChart();
    }

    // The exercise detail: one day (the carry), and two days (the curls) —
    // where the line already begins at the first day, which is candidate A.
    await upper(page);
    await openSheetExercise(page, 'Farmer’s Walk');
    const chartCard = page.locator('.gym-detail .card', { has: page.locator('.gym-detail__chart') }).first();
    await shot(page, `kandidat-punkt-uebung-${width}`, await boxOf(chartCard, 10));
    const detailChart = page.locator('.gym-detail .exercise-line').first();
    const undoDetail = () => detailChart.evaluate((el) => { el.parentElement.querySelector('[data-candidate]')?.remove(); el.style.display = ''; });
    await detailChart.evaluate((original) => {
      // A: the line begins here — the one day is where it starts, at the left on the zero line.
      const el = original.cloneNode(true);
      el.setAttribute('data-candidate', 'A');
      original.style.display = 'none';
      original.after(el);
      el.querySelector('.exercise-line__end').style.left = 'calc(3px + (100% - 6px) * 0)';
    });
    await shot(page, `kandidat-A-uebung-${width}`, await boxOf(chartCard, 10));
    await undoDetail();
    await detailChart.evaluate((original) => {
      const note = document.createElement('p');
      note.className = 'gym-detail__lineNote';
      note.setAttribute('data-candidate', 'B');
      note.textContent = 'Ein Trainingstag erfasst. Ab dem zweiten zeigt Momentum den Verlauf.';
      original.style.display = 'none';
      original.after(note);
    });
    await shot(page, `kandidat-B-uebung-${width}`, await boxOf(chartCard, 10));
    await undoDetail();
    await closeExercise(page);
    await openSheetExercise(page, 'Hammercurls');
    await shot(page, `uebung-zwei-tage-${width}`, await boxOf(page.locator('.gym-detail .card', { has: page.locator('.gym-detail__chart') }).first(), 10));
    await closeExercise(page);
    await closeGroupSheet(page);

    /* ── D176: one change, and the form with two named ones ─────────────── */
    const twoNamed = async (days) => {
      // The exercise detail: what was built…
      await shot(page, `eine-zahl-uebung-${slug}-${days}-${width}`);
      // …and the other form, drawn into it from its own days.
      await page.evaluate(() => {
        const detail = document.querySelector('.gym-detail');
        const rows = [...detail.querySelectorAll('.visually-hidden tbody tr')].map((tr) => tr.querySelector('td').textContent.match(/([\d.]+)\s*×\s*([\d.]+)/));
        const score = (m) => Number(m[2]) * (30 + Number(m[1]));
        const sinceLast = rows.length > 1 ? (score(rows[0]) / score(rows[1]) - 1) * 100 : null;
        const shown = sinceLast === null ? null : Math.sign(sinceLast) * Math.round(Math.abs(sinceLast) + 1e-9);
        const text = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)} %`;
        const state = (value) => (value >= 2 ? 'improved' : value <= -3 ? 'declined' : 'unchanged');
        const word = { improved: 'Verbessert', unchanged: 'Gehalten', declined: 'Zurückgegangen' };
        const head = detail.querySelector('.gym-detail__head');
        const caption = detail.querySelector('.gym-detail__caption');
        const first = head.querySelector('.gym-detail__change');
        const pair = document.createElement('div');
        pair.style.cssText = 'display:flex;gap:28px;flex-wrap:wrap;padding-bottom:16px';
        const cell = (label, figure, kind) => {
          const box = document.createElement('div');
          box.style.cssText = 'display:flex;flex-direction:column;gap:2px';
          box.innerHTML = `<span class="gym-detail__label">${label}</span><span style="display:flex;align-items:center;gap:8px"><span class="gym-detail__change gym-detail__change--${kind}" style="margin:0">${figure}</span><span class="state-chip state-chip--${kind}">${word[kind]}</span></span>`;
          return box;
        };
        const inRange = first.textContent;
        const inRangeKind = [...first.classList].find((c) => c.startsWith('gym-detail__change--')).split('--')[1];
        pair.appendChild(cell(caption.textContent.replace('Bester Arbeitssatz · ', 'im Zeitraum · '), inRange, inRangeKind));
        if (shown !== null) pair.appendChild(cell('zum letzten Mal', text(shown), state(shown)));
        head.replaceWith(pair);
        caption.remove();
        // Kept by the exercise's name: a sheet lists more than the exercise that was opened.
        const name = detail.getAttribute('aria-label') ?? detail.querySelector('h1, h2')?.textContent ?? '';
        (window.__sinceLast ??= {})[name] = shown === null ? null : { text: text(shown), kind: state(shown), word: word[state(shown)] };
      });
      await shot(page, `zwei-zahlen-uebung-${slug}-${days}-${width}`);
    };
    let slug = '';
    for (const [group, name, tag, ranges] of [['chest', 'Bankdrücken', 'bank', [30, 90]], ['triceps', 'Dips', 'dips', [30]]]) {
      slug = tag;
      for (const days of ranges) {
        if (days === 90) {
          await page.locator('.progress__ranges .segmented__option', { hasText: '90' }).click();
          await page.waitForTimeout(2000);
        }
        await openGroupSheet(page, group);
        await upper(page);
        const list = page.locator('.sheet--detents .muscle-sheet__section').first();
        await shot(page, `eine-zahl-sheet-${tag}-${days}-${width}`, await boxOf(list, 6));
        await openSheetExercise(page, name);
        await twoNamed(days);
        await closeExercise(page);
        // The same two figures in the sheet's rows, under the same names —
        // in every row whose exercise has been opened, not only this one's.
        await page.evaluate(() => {
          for (const row of document.querySelectorAll('.sheet--detents .muscle-sheet__exercise')) {
            const second = (window.__sinceLast ?? {})[row.querySelector('.muscle-sheet__exerciseName').textContent];
            const right = row.querySelector('.muscle-sheet__exerciseRight');
            if (second === undefined || !right) continue;
            const kind = [...right.classList].find((c) => c.startsWith('muscle-sheet__exerciseRight--')).split('--')[1];
            const colour = { improved: 'var(--status-strong-ink)', declined: 'var(--status-weak-ink)', unchanged: 'var(--text-primary)' };
            const line = (figure, label, k) => `<span style="display:flex;align-items:baseline;gap:6px;justify-content:flex-end"><span class="muscle-sheet__exerciseChange" style="color:${colour[k]}">${figure}</span><span class="muscle-sheet__exerciseState">${label}</span></span>`;
            right.innerHTML = line(right.querySelector('.muscle-sheet__exerciseChange').textContent, 'im Zeitraum', kind) + (second ? line(second.text, 'zum letzten Mal', second.kind) : '');
          }
        });
        await page.waitForTimeout(200);
        await shot(page, `zwei-zahlen-sheet-${tag}-${days}-${width}`, await boxOf(list, 6));
        await closeGroupSheet(page);
        if (days === 90) {
          await page.locator('.progress__ranges .segmented__option', { hasText: '30' }).click();
          await page.waitForTimeout(2000);
        }
      }
    }
  }
  await ctx.close();
}

/* ── Once in English ───────────────────────────────────────────────────── */
{
  const { ctx, page } = await open(393, { language: 'en' });
  await page.locator('.muscle-row__button[data-muscle="back"]').click();
  await page.locator('.sheet--detents').waitFor({ state: 'visible' });
  await bodyAtRest(page);
  await page.waitForTimeout(600);
  await shot(page, 'sheet-englisch-unten-393');
  await upper(page);
  await shot(page, 'sheet-englisch-393');
  await page.keyboard.press('Escape');
  await sheetGone(page);
  await ctx.close();
}

await browser.close();
console.log(`${written.length} pictures written to ${OUT}`);
