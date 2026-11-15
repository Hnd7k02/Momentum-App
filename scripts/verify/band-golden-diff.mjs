#!/usr/bin/env node
/**
 * The golden files after the held band became one-sided (STOP Kurve, D180)
 * — the proof beside the re-freeze.
 *
 *   node scripts/verify/band-golden-diff.mjs [<commit before the band>] [<commit of the re-freeze> | --worktree]
 *
 * The band decides one thing in a golden file: the **shown state** of a
 * muscle group, the seventh element of its tuple in a `*.gym.json`
 * (`gymOutputsOf()` in `domainOutputs.test.ts`), which the golden test
 * takes from the same function the screen does. Since STOP Kurve a rise
 * counts from a shown +2 % where it counted from +3 %; a fall counts from
 * −3 % as before. This script compares `.github/fixtures` at two commits —
 * by default the last one before the band and the one that froze the files
 * again; `--worktree` compares with the files as they stand — and holds
 * what the re-freeze may and may not have done:
 *
 * 1. Under `.github/fixtures` nothing differs but `*.gym.json` golden
 *    files. Every `*.boss.json` — every rating, every Boss point — is byte
 *    for byte what it was: the band is presentation and reaches no score.
 * 2. In a file that moved, every value that differs is the state of a
 *    muscle group, it went from "unchanged" to "improved", and the figure
 *    that group prints is +2 %.
 * 3. Nothing was left behind: in **every** golden Gym file, moved or not,
 *    each rated group's state is the one-sided band's reading of the figure
 *    it prints — −2 to +1 held, from +2 improved, from −3 declined.
 *
 * Exit 1 on any violation. The table it prints is the record in
 * `docs/design/wp3/kurve-golden.md`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

const BASE = process.argv[2] ?? '1752245';
/** The commit that froze the state column again, or `null` for the files as they stand (`--worktree`). */
const TO = process.argv[3] === '--worktree' ? null : (process.argv[3] ?? '1a769ed');
const FIXTURES = '.github/fixtures';
const GOLDEN = `${FIXTURES}/wp3-golden`;

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 30 });
const before = (path) => git('show', `${BASE}:${path}`);
const after = (path) => (TO === null ? readFileSync(path, 'utf8') : git('show', `${TO}:${path}`));

const failures = [];
const fail = (message) => {
  failures.push(message);
  console.error(`FAIL  ${message}`);
};

/* ── 1. What differs under .github/fixtures at all ──────────────────────── */

const changed = git('diff', '--name-only', BASE, ...(TO === null ? [] : [TO]), '--', FIXTURES).split('\n').filter(Boolean);
const untracked = TO === null ? git('ls-files', '--others', '--exclude-standard', '--', FIXTURES).split('\n').filter(Boolean) : [];
for (const file of [...changed, ...untracked]) {
  if (!(file.startsWith(`${GOLDEN}/`) && file.endsWith('.gym.json'))) fail(`${file} differs from ${BASE} and is not a golden Gym file`);
}

/* ── 2 and 3. Every golden Gym file, group by group ─────────────────────── */

/** The shown whole percent: half away from zero, as `roundShown()` has it. */
const shown = (change) => {
  const rounded = Math.sign(change) * Math.round(Math.abs(change) + 1e-9);
  return rounded === 0 ? 0 : rounded;
};
/** The one-sided band (D180). */
const bandOf = (figure) => (figure >= 2 ? 'improved' : figure <= -3 ? 'declined' : 'unchanged');
const RATED = new Set(['improved', 'unchanged', 'declined']);

/** Every leaf that differs between two JSON values, with its path. */
function differences(a, b, path = [], out = []) {
  if (a === b) return out;
  const both = a !== null && b !== null && typeof a === 'object' && typeof b === 'object';
  if (both && Array.isArray(a) === Array.isArray(b)) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) differences(a[key], b[key], [...path, key], out);
    return out;
  }
  out.push({ path, a, b });
  return out;
}

/**
 * The muscle tuples of a golden Gym file, with where each stands:
 * `[muscle, status, ratio, exercises, compared, latestScore, state, change]`
 * under `<range>.recent.muscles` and `<range>.overall.muscles`.
 */
function* tuples(file) {
  for (const [range, outputs] of Object.entries(file)) {
    for (const window of ['recent', 'overall']) {
      for (const [index, tuple] of (outputs?.[window]?.muscles ?? []).entries()) yield { range, window, index, tuple };
    }
  }
}

const files = (TO === null ? readdirSync(GOLDEN) : git('ls-tree', '--name-only', `${TO}:${GOLDEN}`).split('\n'))
  .filter((name) => name.endsWith('.gym.json'))
  .sort();
const rows = [];
let checked = 0;
let atTwo = 0;
for (const name of files) {
  const path = `${GOLDEN}/${name}`;
  const now = JSON.parse(after(path));

  // 3. The state of every rated group is the band's reading of its figure.
  for (const { range, window, tuple } of tuples(now)) {
    const [muscle, , , , , , state, change] = tuple;
    if (!RATED.has(state)) continue;
    checked += 1;
    if (change === null) {
      fail(`${name}: ${range} ${window} ${muscle} is ${state} without a figure`);
      continue;
    }
    if (shown(change) === 2) atTwo += 1;
    if (state !== bandOf(shown(change))) fail(`${name}: ${range} ${window} ${muscle} prints ${shown(change)} % and is ${state}`);
  }

  // 2. What moved in this file.
  let old;
  try {
    old = JSON.parse(before(path));
  } catch {
    fail(`${name} is not in ${BASE}`);
    continue;
  }
  const found = differences(old, now);
  if (found.length === 0) continue;
  for (const entry of found) {
    const [range, window, list, index, element] = entry.path;
    const isState = (window === 'recent' || window === 'overall') && list === 'muscles' && element === '6' && entry.path.length === 5;
    if (!isState) {
      fail(`${name}: ${entry.path.join('.')} moved (${JSON.stringify(entry.a)} → ${JSON.stringify(entry.b)}) and is not the state of a muscle group`);
      continue;
    }
    const tuple = now[range][window].muscles[index];
    const figure = shown(tuple[7]);
    if (!(entry.a === 'unchanged' && entry.b === 'improved' && figure === 2)) {
      fail(`${name}: ${range} ${window} ${tuple[0]} went from ${entry.a} to ${entry.b} at ${figure} %`);
    }
    rows.push({ name, range, window, muscle: tuple[0], change: tuple[7], figure });
  }
}

/* ── The record ─────────────────────────────────────────────────────────── */

const title = (name) =>
  name
    .replace(/\.gym\.json$/, '')
    .replace(/^stage5b-crossing-the-metric-/, 'crossing ')
    .replace(/^stage5b-under-the-metric-from-day-one-/, 'from day one ');

console.log(`Compared ${git('rev-parse', '--short', BASE).trim()} with ${TO === null ? 'the working tree' : git('rev-parse', '--short', TO).trim()}.`);
console.log('');
console.log(`Files under ${FIXTURES} that differ: ${changed.length + untracked.length}, all of them *.gym.json.`);
for (const file of [...changed, ...untracked]) console.log(`  ${file}`);
console.log(`Golden Gym files read: ${files.length}. Rated groups checked against the band: ${checked}, of which ${atTwo} print +2 %.`);
console.log('');
console.log('| File (clock) | Range | Window | Group | Change | Shown | State |');
console.log('|---|---|---|---|---|---|---|');
for (const row of rows) {
  console.log(`| ${title(row.name)} | ${row.range} days | ${row.window} | ${row.muscle} | +${row.change.toFixed(2)} % | +${row.figure} % | unchanged → improved |`);
}
console.log('');
console.log(
  failures.length === 0
    ? `PASS  ${rows.length} states moved, each from held to improved at a shown +2 %, and no other value.`
    : `${failures.length} violation(s).`,
);
process.exit(failures.length === 0 ? 0 : 1);
