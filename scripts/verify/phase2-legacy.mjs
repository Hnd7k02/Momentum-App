import { chromium } from 'playwright-core';
import { URL_APP, check, summary, phone, onboard } from './lib.mjs';

/**
 * A device that carries RC2's Sport domain, after the update.
 *
 * The product never creates one; it still has to show one, read-only, to
 * whoever already has it.
 */
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext(phone);
const page = await ctx.newPage();
await page.goto(URL_APP, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await onboard(page, { gym: 3, running: 0 });

// Insert the retired domain the way a migrated device would carry it.
await page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('momentum');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const stamp = new Date().toISOString();
  await new Promise((res, rej) => {
    const tx = db.transaction(['domains'], 'readwrite');
    tx.objectStore('domains').put({
      id: 'dom_legacy_sports', type: 'sports', enabled: true, order: 9,
      settings: { targetPerWeek: 4 }, createdAt: stamp, updatedAt: stamp,
    });
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);

await page.locator('.tab-bar button', { hasText: 'Bereiche' }).click();
await page.waitForTimeout(500);
check('Areas shows the retired Sport domain to whoever has one',
  await page.getByText('Sport (bisher)').isVisible());
check('and explains what it is',
  await page.getByText(/stammen aus der früheren Version/).isVisible());
check('it is not offered as one of the terminal\'s areas',
  (await page.getByRole('radiogroup', { name: 'Bereich wählen' }).getByRole('radio').allTextContents())
    .map((s) => s.trim()).join() === 'Mind,Gym');

await page.locator('.tab-bar button', { hasText: 'Heute' }).click();
await page.waitForTimeout(500);
check('Today shows its week alongside Gym',
  await page.getByRole('heading', { name: 'Sport (bisher)' }).isVisible());
const logButtons = await page.locator('.week__log').allTextContents();
check('but offers no way to log a new session into it',
  logButtons.every((label) => !/Sport/.test(label)), JSON.stringify(logButtons));

await browser.close();
process.exit(summary() ? 0 : 1);
