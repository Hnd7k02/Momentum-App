import { chromium } from 'playwright-core';
import { URL_APP, check, summary, phone, onboard, storedDomains, storedQuestions, clipped, smallTargets, seed } from './lib.mjs';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function fresh(opts = {}) {
  const ctx = await browser.newContext({ ...phone, ...opts });
  const page = await ctx.newPage();
  await page.goto(URL_APP);
  await page.waitForTimeout(500);
  return { ctx, page };
}

/* ── Onboarding ─────────────────────────────────────────────────────────── */
{
  const { ctx, page } = await fresh();
  check('onboarding opens on the Momentum concept', await page.getByText('Fortschritt sieht man selten').isVisible());

  await page.getByRole('button', { name: /Los geht/ }).click();
  check('second screen names the two worlds, Laufen inside Gym (WP3 Stage 4)',
    await page.getByRole('heading', { name: 'Zwei Welten' }).isVisible() &&
    await page.getByText('Mind und Gym, Laufen inbegriffen. Du wählst, was zählt.').isVisible());
  check('and says nothing of Food',
    !/Ernährung|Essen/.test((await page.locator('.onboarding').textContent()) ?? ''));
  await page.getByRole('button', { name: 'Weiter' }).click();
  check('third screen is rank and milestones',
    await page.getByRole('heading', { name: /Rang und Meilensteine/ }).isVisible());
  await page.getByRole('button', { name: 'Weiter' }).click();

  const picker = await page.getByRole('heading', { name: 'Womit startest du?' }).isVisible();
  check('fourth screen is the domain picker', picker);
  const choices = (await page.locator('.question-pick .question-pick__text').allTextContents()).map((s) => s.trim());
  check('it offers Mind and Gym, and nothing else', JSON.stringify(choices) === JSON.stringify(['Mind', 'Gym']), choices.join(' | '));
  check('Gym is one world, Laufen included',
    await page.getByText('Gym-Sessions und Läufe, je mit eigenem Wochenziel.').isVisible());
  check('no generic Sport domain is offered as a thing to track',
    (await page.getByRole('button', { name: /^Sport$/ }).count()) === 0);
  check('and Food is not offered (D139)', (await page.getByRole('button', { name: /Ernährung/ }).count()) === 0);

  // Deselect everything and check the flow refuses to continue.
  await page.getByRole('button', { name: /^Mind/ }).click();
  const disabled = await page.getByRole('button', { name: 'Weiter' }).isDisabled();
  check('cannot continue with nothing switched on', disabled);
  check('says so rather than only disabling the button',
    await page.getByText('Wähle mindestens einen Bereich').isVisible());
  await page.getByRole('button', { name: /^Mind/ }).click();

  await page.getByRole('button', { name: /^Gym/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();

  check('questions are grouped by category',
    await page.getByRole('heading', { name: 'Gesundheit' }).isVisible() &&
    await page.getByRole('heading', { name: 'Alltag' }).isVisible() &&
    await page.getByRole('heading', { name: 'Eigene' }).isVisible());

  await page.getByRole('button', { name: /Wie gut hast du gesch/ }).first().click();
  await page.getByRole('button', { name: /Wie war deine Stimmung/ }).first().click();
  await page.getByRole('button', { name: 'Weiter' }).click();

  check('the sport step offers two independent targets',
    await page.getByText('Gym-Sessions pro Woche').isVisible() &&
    await page.getByText('Läufe pro Woche').isVisible());

  const cards = page.locator('.card');
  await cards.nth(0).getByRole('button', { name: '4 pro Woche' }).click();
  await cards.nth(1).getByRole('button', { name: '2 pro Woche' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();

  check('the summary lists each target separately',
    await page.getByText('4 Gym-Sessions pro Woche').isVisible() &&
    await page.getByText('2 Läufe pro Woche').isVisible());

  await page.getByRole('button', { name: 'Starten' }).click();
  await page.waitForTimeout(900);

  const domains = await storedDomains(page);
  check('no generic sports domain was created',
    !domains.some((d) => d.type === 'sports'), JSON.stringify(domains.map((d) => d.type)));
  check('gym and running were created with their own targets',
    domains.find((d) => d.type === 'gym')?.settings.targetPerWeek === 4 &&
    domains.find((d) => d.type === 'running')?.settings.targetPerWeek === 2);
  check('Food cannot be chosen, and no Food domain exists',
    !domains.some((d) => d.type === 'food'));

  const questions = await storedQuestions(page);
  check('questions keep the category they were picked under',
    questions.length === 2 &&
    questions.every((q) => ['gesundheit', 'mental'].includes(q.category)),
    JSON.stringify(questions.map((q) => [q.text.slice(0, 12), q.category])));

  await ctx.close();
}

/* ── Custom questions ───────────────────────────────────────────────────── */
{
  const { ctx, page } = await fresh();
  await page.getByRole('button', { name: /Los geht/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();

  await page.getByRole('button', { name: /Eigene Frage/ }).click();
  await page.getByRole('textbox', { name: 'Frage' }).fill('Habe ich Gitarre geübt?');
  check('a custom question can choose its category',
    (await page.getByRole('radio', { name: 'Gesundheit' }).count()) === 1);
  await page.getByRole('radio', { name: 'Mental' }).click();
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Starten' }).click();
  await page.waitForTimeout(900);

  const questions = await storedQuestions(page);
  check('the custom question is stored with the chosen category',
    questions.length === 1 && questions[0].text === 'Habe ich Gitarre geübt?' &&
    questions[0].category === 'mental', JSON.stringify(questions));
  check('it is asked on Today like any other',
    await page.getByText('Habe ich Gitarre geübt?').isVisible());
  await ctx.close();
}

/* ── Today, Areas, and the 1–10 palette ─────────────────────────────────── */
{
  const { ctx, page } = await fresh();
  await onboard(page, { gym: 3, running: 2 });

  check('Today shows a Gym card and a Running card',
    await page.getByRole('heading', { name: 'Gym' }).isVisible() &&
    await page.getByRole('heading', { name: 'Laufen' }).isVisible());
  check('and no generic Sport card',
    (await page.getByRole('heading', { name: /^Sport$/ }).count()) === 0);

  // Answer a scale question and read the band back.
  const six = page.getByRole('radio', { name: /^6 von 10/ }).first();
  await six.click();
  await page.waitForTimeout(400);
  const bg = await six.evaluate((el) => getComputedStyle(el).backgroundColor);
  check('a 6 fills yellow (--status-mixed)', bg === 'rgb(255, 214, 0)', bg);
  const ten = page.getByRole('radio', { name: /^10 von 10/ }).first();
  await ten.click();
  await page.waitForTimeout(300);
  const bg10 = await ten.evaluate((el) => getComputedStyle(el).backgroundColor);
  check('a 10 fills green (--status-strong)', bg10 === 'rgb(0, 184, 91)', bg10);
  check('the band is spelled out next to the number',
    await page.getByText('Stark', { exact: true }).first().isVisible());

  await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
  await page.waitForTimeout(400);
  const areaSwitch = await page.getByRole('radiogroup', { name: 'Bereich wählen' }).getByRole('radio').allTextContents();
  check('Areas offers the two terminal areas in order, and shows one at a time',
    JSON.stringify(areaSwitch.map((s) => s.trim())) === JSON.stringify(['Mind', 'Gym']) &&
      JSON.stringify(await page.locator('.areas__domainName').allTextContents()) === JSON.stringify(['Mind']),
    JSON.stringify(areaSwitch));
  check('questions are grouped by category in Areas',
    await page.getByText('Gesundheit').first().isVisible());
  await ctx.close();
}

/* ── The Verlauf drill-down ─────────────────────────────────────────────── */
{
  const { ctx, page } = await fresh();
  await onboard(page, { gym: 3, running: 0 });
  await seed(page, { days: 30 });
  await page.reload();
  await page.waitForTimeout(900);

  await page.locator('.tab-bar button', { hasText: 'Verlauf' }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Mind/ }).first().click();
  await page.waitForTimeout(300);

  const questionRow = page.getByRole('button', { name: /Wie gut hast du gesch/ }).first();
  check('a question row is tappable in Verlauf', await questionRow.count() > 0);
  await questionRow.click();
  await page.waitForTimeout(400);

  check('it opens the question, not Today',
    await page.getByRole('heading', { name: /Wie gut hast du gesch/ }).isVisible() &&
    (await page.locator('.tab-bar button', { hasText: 'Heute' }).getAttribute('aria-current')) === null);
  check('the detail names the category', await page.getByText('Gesundheit').first().isVisible());
  const shown = await page.locator('.question-detail__figureValue').first().textContent();
  check('it shows the answer as a number, not a percentage',
    /^\d{1,2}$/.test(shown ?? ''), String(shown));
  check('it offers a way to answer today',
    await page.getByRole('button', { name: 'Heute beantworten' }).isVisible());

  const clip = await clipped(page);
  check('the detail view is not clipped at 393px', clip.length === 0, clip.join('; '));

  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.waitForTimeout(300);
  check('going back returns to Verlauf',
    await page.getByRole('heading', { name: 'Verlauf', exact: true }).isVisible());
  await ctx.close();
}

/* ── Narrow widths ──────────────────────────────────────────────────────── */
for (const width of [320, 360, 393, 430]) {
  const { ctx, page } = await fresh({ viewport: { width, height: 780 } });
  await onboard(page, { gym: 3, running: 2 });
  for (const tab of ['Heute', 'Verlauf', 'Rang', 'Bereiche']) {
    await page.locator('.tab-bar button', { hasText: tab }).click();
    await page.waitForTimeout(400);
    const clip = await clipped(page);
    check(`${tab} is not clipped at ${width}px`, clip.length === 0, clip.slice(0, 3).join('; '));
    const small = await smallTargets(page);
    check(`${tab} keeps its tap targets at ${width}px`, small.length === 0, small.slice(0, 3).join('; '));
  }
  await ctx.close();
}

await browser.close();
process.exit(summary() ? 0 : 1);
