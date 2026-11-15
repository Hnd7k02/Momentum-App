#!/usr/bin/env node
/**
 * The golden files of the Stage 5b profiles, frozen again for the block
 * "Kurve" — the proof beside the re-freeze (D177).
 *
 *   node scripts/verify/kurve-golden-diff.mjs [<commit before the block>] [<commit of the re-freeze>]
 *
 * The two Stage 5b profiles (`fixtures/trainingProfile.ts`) carry the marker
 * of the era, and from this block on the marker names the curve's value.
 * Their golden files hold days of the era and were never published, so they
 * are frozen once more. This script compares `.github/fixtures` at two
 * commits — by default the last one before the block and the one that froze
 * the files again — and holds what the re-freeze may and may not have done.
 * (It compared with the working tree until the held band became one-sided
 * at STOP Kurve, which moved the state column of seven `*.gym.json`:
 * `band-golden-diff.mjs` is the proof of that step, and this one stays the
 * proof of its own.)
 *
 * 1. Under `.github/fixtures` nothing differs but `stage5b-*` golden files,
 *    and of those not the two of 2026-05-17, which hold no day of the era.
 * 2. Every `*.gym.json` of the two profiles — the exercise-days, the
 *    percentage changes, the muscle groups and their states, at 7, 30 and
 *    90 days — is byte for byte what it was.
 * 3. In a `*.boss.json` every value that differs is one that depends on the
 *    performance level: the level itself, the target, the rating and its
 *    movement, the peak, Gym's ledger, the Boss, and the date of a
 *    promotion. The windows, the percentage changes, attendance, Endurance,
 *    abstinence and decay, the history rows, XP, every other domain and the
 *    confirmation state are the same.
 * 4. In the profile "crossing the metric" no value of a day before the
 *    boundary differs, in any file.
 *
 * Exit 1 on any violation. The table it prints is the record in
 * `docs/design/wp3/kurve-golden.md`.
 */
import { execFileSync } from 'node:child_process';

const BASE = process.argv[2] ?? '78a22ef';
/** The commit that froze the seven files again under the curve. */
const TO = process.argv[3] ?? '6f37680';
const FIXTURES = '.github/fixtures';
const GOLDEN = `${FIXTURES}/wp3-golden`;
/** The Monday the crossing profile loads the update on (`METRIC_FROM`). */
const BOUNDARY = '2026-05-18';
/** The two files that hold no day of the era. */
const BEFORE_THE_ERA = /^stage5b-crossing-the-metric-2026-05-17\.(boss|gym)\.json$/;

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 30 });

const failures = [];
const fail = (message) => {
  failures.push(message);
  console.error(`FAIL  ${message}`);
};

/* ── 1. What differs under .github/fixtures at all ──────────────────────── */

const changed = git('diff', '--name-only', BASE, TO, '--', FIXTURES).split('\n').filter(Boolean);
const untracked = [];
for (const file of [...changed, ...untracked]) {
  const name = file.slice(GOLDEN.length + 1);
  if (!file.startsWith(`${GOLDEN}/stage5b-`)) fail(`${file} differs from ${BASE} and is not a Stage 5b golden file`);
  else if (BEFORE_THE_ERA.test(name)) fail(`${file} holds no day of the era and may not move`);
}

/* ── 2–4. The sixteen files, value by value ─────────────────────────────── */

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

const pattern = (path) => path.map((part) => (/^\d+$/.test(part) ? '[]' : part)).join('.');

/**
 * The fields a different curve may move, and for a per-day one how its day
 * is found. A scalar stands for the day the replay ends on, or — a peak —
 * for the highest day so far.
 */
const DEPENDS_ON_THE_LEVEL = new Map([
  // Gym's rating state, day by day: the level, where the rating was heading, the rating, the share of the gap closed.
  ['gym.detail.[].performance', (file, path) => file.gym.detail[path[2]].date],
  ['gym.detail.[].target', (file, path) => file.gym.detail[path[2]].date],
  ['gym.detail.[].rating', (file, path) => file.gym.detail[path[2]].date],
  ['gym.detail.[].movement', (file, path) => file.gym.detail[path[2]].date],
  ['gym.points.[].rating', (file, path) => file.gym.points[path[2]].date],
  // …and today's.
  ['gym.rating', null],
  ['gym.peak', null],
  ['gym.performance.score', null],
  ['gym.performance.trendScore', null],
  ['gym.performance.ytdScore', null],
  ['outputs.gym.rating', null],
  ['outputs.gym.performance.score', null],
  // Gym's ledger on the shared ladder.
  ['outputs.domains.[].series.[]', (file, path) => file.outputs.history.days[path[4]][0]],
  ['outputs.domains.[].momentum', null],
  ['outputs.domains.[].peakMomentum', null],
  ['outputs.domains.[].progress', null],
  // The Boss, which moves by the weighted movement of the ledgers.
  ['outputs.points.[].[]', (file, path) => file.outputs.history.days[path[2]][0]],
  ['outputs.progress', null],
  // A rank change: [date, kind, rank]. A higher level can confirm a promotion sooner.
  ['outputs.changes.[].[]', (file, path) => file.outputs.changes[path[2]][0]],
]);

const files = git('ls-tree', '--name-only', `${TO}:${GOLDEN}`).split('\n').filter((name) => name.startsWith('stage5b-')).sort();
if (files.length !== 16) fail(`expected the sixteen Stage 5b golden files, found ${files.length}`);

const rows = [];
let identicalGym = 0;
for (const name of files) {
  const before = git('show', `${BASE}:${GOLDEN}/${name}`);
  const after = git('show', `${TO}:${GOLDEN}/${name}`);

  if (name.endsWith('.gym.json')) {
    if (before === after) identicalGym += 1;
    else fail(`${name}: the Gym history a screen reads has moved`);
    continue;
  }
  if (before === after) {
    rows.push({ name, values: 0 });
    if (!BEFORE_THE_ERA.test(name)) fail(`${name}: holds days of the era and did not move — is the value in the profile's marker?`);
    continue;
  }

  const old = JSON.parse(before);
  const now = JSON.parse(after);
  const found = differences(old, now);
  const fields = new Map();
  let earliest = null;
  const moved = [];
  for (const entry of found) {
    const key = pattern(entry.path);
    fields.set(key, (fields.get(key) ?? 0) + 1);
    if (!DEPENDS_ON_THE_LEVEL.has(key)) {
      fail(`${name}: ${entry.path.join('.')} moved (${JSON.stringify(entry.a)} → ${JSON.stringify(entry.b)}) and does not depend on the performance level`);
      continue;
    }
    // Only Gym's ledger may move among the domains.
    if (key.startsWith('outputs.domains.') && now.outputs.domains[entry.path[2]].domain !== 'gym') {
      fail(`${name}: the ledger of ${now.outputs.domains[entry.path[2]].domain} moved at ${entry.path.join('.')}`);
    }
    const dayOf = DEPENDS_ON_THE_LEVEL.get(key);
    if (dayOf === null) continue;
    if (key === 'outputs.changes.[].[]') {
      moved.push(`${old.outputs.changes[entry.path[2]][2]} ${old.outputs.changes[entry.path[2]][0]} → ${now.outputs.changes[entry.path[2]][0]}`);
      // Whichever of the two dates is earlier is the day the difference begins on.
      const day = [old, now].map((file) => dayOf(file, entry.path)).sort()[0];
      if (earliest === null || day < earliest) earliest = day;
      continue;
    }
    const day = dayOf(now, entry.path);
    if (dayOf(old, entry.path) !== day) fail(`${name}: ${entry.path.join('.')} is not the same day in both files`);
    if (earliest === null || day < earliest) earliest = day;
  }

  if (name.startsWith('stage5b-crossing-the-metric-') && earliest !== null && earliest < BOUNDARY) {
    fail(`${name}: a value of ${earliest} moved, a day before the boundary ${BOUNDARY}`);
  }
  // The same number of days, rank changes and domains in both: nothing was added or dropped.
  for (const [label, read] of [
    ['days', (file) => file.outputs.history.days.length],
    ['rank changes', (file) => file.outputs.changes.length],
    ['Gym days', (file) => file.gym.detail.length],
  ]) {
    if (read(old) !== read(now)) fail(`${name}: ${label} ${read(old)} → ${read(now)}`);
  }

  rows.push({
    name,
    values: found.length,
    earliest,
    days: fields.get('gym.detail.[].performance') ?? 0,
    level: [old.gym.performance.score, now.gym.performance.score],
    rating: [old.gym.rating, now.gym.rating],
    boss: [old.outputs.progress, now.outputs.progress],
    moved,
  });
}
if (identicalGym !== 8) fail(`expected the eight *.gym.json byte for byte the same, found ${identicalGym}`);

/* ── The record ─────────────────────────────────────────────────────────── */

const num = (value, digits) => (value === null ? '–' : value.toFixed(digits));
const pair = (values, digits) => `${num(values[0], digits)} → ${num(values[1], digits)}`;
const title = (name) =>
  name
    .replace(/^stage5b-/, '')
    .replace(/\.boss\.json$/, '')
    .replace('crossing-the-metric-', 'crossing ')
    .replace('under-the-metric-from-day-one-', 'from day one ');

console.log(`Compared ${git('rev-parse', '--short', BASE).trim()} with ${git('rev-parse', '--short', TO).trim()}.`);
console.log('');
console.log(`Files under ${FIXTURES} that differ: ${changed.length + untracked.length}.`);
for (const file of [...changed, ...untracked]) console.log(`  ${file}`);
console.log(`*.gym.json of the Stage 5b profiles byte for byte the same: ${identicalGym} of 8.`);
console.log('');
console.log('| File (clock) | Values | Earliest day | Days with another level | Level today | Gym rating today | Boss today | Rank change |');
console.log('|---|---|---|---|---|---|---|---|');
for (const row of rows) {
  if (row.values === 0) {
    console.log(`| ${title(row.name)} | 0 | – | 0 | identical | identical | identical | – |`);
    continue;
  }
  console.log(
    `| ${title(row.name)} | ${row.values} | ${row.earliest ?? '–'} | ${row.days} | ${pair(row.level, 0)} | ${pair(row.rating, 1)} | ${pair(row.boss, 4)} | ${row.moved.length > 0 ? row.moved.join('; ') : 'none'} |`,
  );
}
console.log('');
console.log(
  failures.length === 0
    ? 'PASS  only values that depend on the performance level moved, and none on a day before the boundary.'
    : `${failures.length} violation(s).`,
);
process.exit(failures.length === 0 ? 0 : 1);
