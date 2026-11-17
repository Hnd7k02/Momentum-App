import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The buttons of the two notices are 44px targets (contract §12).
 *
 * Block 9 found them at 36 and 34px: «Neu laden» in the update notice — the
 * one button the owner taps on the update day — and «Erneut versuchen» in
 * the notice that a refresh did not get through. Neither appears in an
 * ordinary walk through the app, so the browser suites that measure targets
 * never met them; WebKit on GitHub did, once the update notice rose in the
 * middle of a run. This holds the rule where it is written.
 */
const SRC = fileURLToPath(new URL('..', import.meta.url));

function block(file: string, selector: string): string {
  const css = readFileSync(`${SRC}/${file}`, 'utf8');
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} in ${file}`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

describe('the buttons of the two notices are 44px targets (§12, block 9)', () => {
  it('«Neu laden» in the update notice', () => {
    expect(block('app/appShell.css', '.update-banner__action')).toMatch(/min-height:\s*var\(--touch-min\);/);
  });

  it('the retry in the notice that a refresh did not get through', () => {
    expect(block('components/ui.css', '.stale-notice button')).toMatch(/min-height:\s*var\(--touch-min\);/);
  });

  it('and the token is 44px', () => {
    expect(readFileSync(`${SRC}/styles/tokens.css`, 'utf8')).toMatch(/--touch-min:\s*44px;/);
  });
});
