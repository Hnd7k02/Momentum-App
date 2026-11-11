import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { translate } from './index';
import { de } from './de';
import { en } from './en';
import { MINUS, NBSP, percentText, signedPercentText, withMinus } from './typography';

/**
 * How a number is printed (STOP 6b): a fall with a real minus sign, a number
 * and its percent sign never apart at a line end, one distance range in the
 * singular. Held here for the helpers, for both catalogues and for the
 * source, so that the next figure someone prints cannot quietly bring the
 * hyphen or the breaking space back.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));

describe('a fall carries a minus sign, not a hyphen', () => {
  it('prints negative numbers with U+2212', () => {
    expect(MINUS).toBe('−');
    expect(withMinus(-10)).toBe('−10');
    expect(withMinus(7)).toBe('7');
    expect(withMinus(0)).toBe('0');
    expect(withMinus(-0)).toBe('0');
    expect(withMinus(-0.5)).toBe('−0.5');
  });

  it('is what a negative parameter of any string becomes', () => {
    // The decline is the one string that receives a negative number today.
    expect(translate('de', 'gym.change.declined', { percent: -10 })).toBe('−10 %');
    expect(translate('en', 'gym.change.declined', { percent: -3 })).toBe('−3 %');
    expect(translate('de', 'gymHub.muscles.overall', { change: translate('de', 'gym.change.declined', { percent: -4 }) }))
      .toBe('Gesamt −4 %');
    // A string parameter is left as it is written.
    expect(translate('de', 'gymHub.muscles.overall', { change: 'Gehalten' })).toBe('Gesamt Gehalten');
  });

  it.each([['de', de], ['en', en]] as const)('no %s string writes a hyphen as a sign', (_language, catalogue) => {
    for (const [key, value] of Object.entries(catalogue)) {
      // A hyphen directly before a digit or a placeholder, at the start or
      // after a space, a bracket or a middle dot: "-3", " -{percent}".
      expect(/(^|[\s(·])-(\d|\{)/.test(value), `${key}: ${value}`).toBe(false);
    }
  });
});

describe('a number and its percent sign never part', () => {
  it('joins them with a no-break space', () => {
    expect(NBSP).toBe(' ');
    expect(percentText(67)).toBe('67 %');
    expect(percentText(-3)).toBe('−3 %');
    expect(percentText('1’000')).toBe('1’000 %');
    expect(signedPercentText(12)).toBe('+12 %');
    expect(signedPercentText(-3)).toBe('−3 %');
    expect(signedPercentText(0)).toBe('0 %');
  });

  it.each([['de', de], ['en', en]] as const)('no %s string leaves a breaking space before %%', (_language, catalogue) => {
    let withPercent = 0;
    for (const [key, value] of Object.entries(catalogue)) {
      if (!value.includes('%')) continue;
      withPercent += 1;
      // Every percent sign follows a no-break space: never a plain space,
      // and never the number directly (the catalogue's own convention).
      for (const match of value.matchAll(/(.)%/gu)) {
        expect(match[1], `${key}: ${value}`).toBe(NBSP);
      }
    }
    // The rule is about something: the catalogue does print percentages.
    expect(withPercent).toBeGreaterThanOrEqual(10);
  });

  it('the scan below sees the three ways a breaking space gets in', () => {
    // The same pattern as the scan, on the lines it exists for — one of
    // them stood in BossWeights.tsx until STOP 6b.
    const pattern = /\} %|['"`] %|\d %(?=[`'"<{]|$)/;
    for (const line of [
      '` · ${Math.round(BOSS.MIN_WEIGHT * 100)} % min`',
      '`${average} %`',
      "String(value) + ' %'",
      '<span>{value} %</span>',
      "'100 %'",
      '`(${share} %)`',
    ]) expect(pattern.test(line), line).toBe(true);
    for (const line of ['const odd = index % 2 === 1;', 'width: `${percent}%`', 'percentText(value)', '(i * 7) % 10 < level * 10']) {
      expect(pattern.test(line), line).toBe(false);
    }
  });

  it('no source file prints a figure, a plain space and a percent sign', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) files.push(path);
      }
    };
    walk(SRC);
    const blank = (match: string) => match.replace(/[^\n]/g, ' ');
    const hits: string[] = [];
    for (const path of files) {
      // Comments may write "12 %" while explaining it; only code counts.
      const code = readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, blank)
        .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (match, lead: string) => lead + blank(match.slice(lead.length)));
      code.split('\n').forEach((line, index) => {
        // Three ways a figure meets a plain space and a percent sign in
        // code, whatever follows it ("% min", "%)", the end of the string):
        //   `${x} %…`  and JSX `{x} %…`   — a placeholder, a space, a percent
        //   x + ' %…'                     — a literal that opens with them
        //   '100 %'                       — a digit, then they end a literal
        // The remainder operator is none of these: it has an expression,
        // not a brace or a quote, before its space.
        if (/\} %|['"`] %|\d %(?=[`'"<{]|$)/.test(line)) hits.push(`${path.slice(SRC.length)}:${index + 1} ${line.trim().slice(0, 80)}`);
      });
    }
    expect(hits).toEqual([]);
  });
});

describe('no figure is given its sign by hand', () => {
  it('no source file builds a negative number with a hyphen', () => {
    // `-${value}` or '-' + value: the two ways a hyphen becomes a sign in
    // code. A fall goes through `withMinus()` or `translate()`.
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) files.push(path);
      }
    };
    walk(SRC);
    const hits: string[] = [];
    for (const path of files) {
      readFileSync(path, 'utf8').split('\n').forEach((line, index) => {
        if (/`-\$\{|['"]-['"]\s*\+|\+\s*['"]-['"]/.test(line)) hits.push(`${path.slice(SRC.length)}:${index + 1} ${line.trim().slice(0, 80)}`);
      });
    }
    expect(hits).toEqual([]);
  });
});

describe('one distance range is one', () => {
  it('has a singular beside the plural, in both languages', () => {
    expect(de['running.performance.countedOne']).toBe('1 Distanzbereich gewertet');
    expect(en['running.performance.countedOne']).toBe('1 distance range counted');
    expect(translate('de', 'running.performance.counted', { count: 2 })).toBe('2 Distanzbereiche gewertet');
    expect(translate('de', 'running.performance.counted', { count: 0 })).toBe('0 Distanzbereiche gewertet');
  });

  it('is what Laufen says when exactly one range is measured', () => {
    const source = readFileSync(join(SRC, 'features/running/RunningOverview.tsx'), 'utf8');
    expect(source).toMatch(/measured === 1 \? t\('running\.performance\.countedOne'\) : t\('running\.performance\.counted', \{ count: measured \}\)/);
    // And nothing else prints the plural with a count it has not checked.
    expect(source.match(/running\.performance\.counted'/g)).toHaveLength(1);
  });
});
