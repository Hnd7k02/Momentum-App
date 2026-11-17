import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, createWriteStream } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Every browser suite, by one command (block 9, step 1).
 *
 *   npm run verify                 build everything, serve it, run every suite
 *   npm run verify -- --no-build   use the builds that are there
 *   ONLY=phase2,release npm run verify   a selection, for a quick look
 *
 * What it does, in order:
 *
 * 1. **Builds** the app (`npm run build`), the preview build with a database
 *    of its own (`dist-preview`, for the onboarding's rehearsal) and the live
 *    state `e30becd` — the default branch's head, what the owner's phone runs
 *    today — in a directory outside the repository (`LIVE_DIR`, default
 *    `<tmp>/momentum-live-e30becd`), from `git archive`, with `npm ci`. The
 *    live state is built once and kept; `--rebuild-live` builds it again.
 * 2. **Serves** them: the app on 4173, the preview build on 4174, the live
 *    state on 4273 and the dev server on 5173 (`body.mjs` needs its harness
 *    page). A port already taken fails the run rather than testing whatever
 *    is listening there.
 * 3. **Runs every suite** — every script under `scripts/verify/` that counts
 *    checks — the ordinary ones `JOBS` at a time (default 2), then the five
 *    3D suites **one by one, with nothing else running**: they count frames
 *    and wait for a rotation to settle, and a busy machine says nothing about
 *    the code (README, "Running them"). Each suite writes its pictures into
 *    the run's directory under `.artifacts/verify/`, never into `docs/`.
 * 4. **Prints the table** — suite, passed of total, duration — writes it as
 *    `table.md` and `results.json` beside the logs, stops the servers, and
 *    **exits 1 if anything failed**, a build, a server or a single check.
 *
 * **The one known red check stays red** and is not hidden: `release-proof.mjs`
 * "offline, Gym still shows the 3D body" has failed since before Stage 6b and
 * belongs to the tidy-up (D163). The table marks a suite whose only failures
 * are known ones as such, and the run still exits 1 while it fails.
 *
 * `BROWSER=webkit` runs the suites that can launch WebKit there (block 9,
 * step 3; the list is `WEBKIT_SUITES` in `lib.mjs`) and nothing else.
 * `CHROMIUM_PATH` and `WEBKIT_PATH` name the browsers to launch.
 */

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = new Set(process.argv.slice(2));
const BUILD = !args.has('--no-build');
const REBUILD_LIVE = args.has('--rebuild-live');
const LIVE_COMMIT = 'e30becd';
const LIVE_DIR = process.env.LIVE_DIR ?? join(tmpdir(), `momentum-live-${LIVE_COMMIT}`);
const JOBS = Number(process.env.JOBS ?? Math.max(1, Math.min(2, cpus().length - 1)));
const SUITE_TIMEOUT = Number(process.env.SUITE_TIMEOUT_MS ?? 30 * 60 * 1000);
const BROWSER = process.env.BROWSER ?? 'chromium';
const RUN = process.env.RUN_DIR ?? join(ROOT, '.artifacts', 'verify', new Date().toISOString().replace(/[:.]/g, '-'));

const PORT = { app: 4173, preview: 4174, live: 4273, dev: 5173 };
const ADDRESS = {
  app: `http://127.0.0.1:${PORT.app}/Momentum-App/`,
  preview: `http://127.0.0.1:${PORT.preview}/Momentum-App/`,
  live: `http://127.0.0.1:${PORT.live}/Momentum-App/`,
  dev: `http://127.0.0.1:${PORT.dev}/Momentum-App/`,
};

/**
 * Every suite. `alone`: a 3D suite, run with nothing beside it. `needs`: the
 * servers it reads besides the app.
 */
const SUITES = [
  { name: 'phase2' }, { name: 'phase2-a11y' }, { name: 'phase2-legacy' },
  { name: 'phase3' }, { name: 'phase3-a11y' },
  { name: 'phase4' }, { name: 'phase4-a11y' },
  { name: 'phase41' }, { name: 'phase41-a11y' },
  { name: 'phase5' }, { name: 'phase5-a11y' },
  { name: 'phase7' }, { name: 'phase7-a11y' },
  { name: 'phase8' }, { name: 'phase8-a11y' },
  { name: 'terminal' }, { name: 'geometry' },
  { name: 'release' }, { name: 'release-proof' },
  { name: 'stage4-shots' },
  { name: 'wp2-1-shots' }, { name: 'wp2-2-shots' },
  { name: 'wp3-sheets' }, { name: 'wp3-reload' }, { name: 'wp3-midnight' },
  { name: 'wp3-stage1' }, { name: 'wp3-stage2' }, { name: 'wp3-stage3' }, { name: 'wp3-stage4' },
  { name: 'wp3-stage5b' },
  { name: 'stage5b-import-check', needs: ['live'] },
  { name: 'design-system', webkitEnv: { WIDTHS: '393' } },
  { name: 'exercise-search' },
  { name: 'muscle-card' },
  { name: 'onboarding-7e', needs: ['preview'] },
  // Block 9: the update from the live state, in place and back, on its own
  // port (4295) from both builds.
  { name: 'update-in-place', needs: ['live'] },
  // The 3D suites, one by one.
  { name: 'gym-muscles', alone: true },
  { name: 'muscle-sheet', alone: true },
  { name: 'farbregeln', alone: true },
  { name: 'today-in-charts', alone: true },
  { name: 'access-wp3', alone: true },
  // 1340 taps a width at 12px, each opening and closing a sheet since 7C:
  // about half an hour a width, two hours in all. Its own limit, not a
  // coarser grid.
  { name: 'body-reach', alone: true, timeout: 3 * 60 * 60 * 1000 },
  { name: 'body', alone: true, needs: ['dev'] },
];

/** Checks that are red and known, by suite: the table says so, the exit code does not forgive them. */
const KNOWN_RED = {
  'release-proof': [{ check: 'offline, Gym still shows the 3D body', why: 'red since before Stage 6b; the tidy-up block (D163)' }],
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

const children = new Set();
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const seconds = (ms) => `${(ms / 1000).toFixed(0)} s`;

function run(command, commandArgs, { cwd = ROOT, env = {}, log, timeout = SUITE_TIMEOUT } = {}) {
  return new Promise((done) => {
    const started = Date.now();
    const child = spawn(command, commandArgs, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.add(child);
    const out = log ? createWriteStream(log) : null;
    let text = '';
    const take = (chunk) => { text += chunk; out?.write(chunk); };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    const timer = setTimeout(() => { take(`\n[run-all] timed out after ${seconds(timeout)}\n`); child.kill('SIGKILL'); }, timeout);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      children.delete(child);
      out?.end();
      done({ code: code ?? (signal ? 1 : 0), text, ms: Date.now() - started });
    });
  });
}

function serve(name, commandArgs, cwd) {
  const log = join(RUN, `server-${name}.log`);
  const child = spawn('npx', commandArgs, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  children.add(child);
  const out = createWriteStream(log);
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  child.on('close', () => children.delete(child));
  return child;
}

async function reachable(url, { timeout = 60000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch { /* not up yet */ }
    await sleep(300);
  }
  return false;
}

function signal(child, name) {
  try { process.kill(-child.pid, name); } catch { try { child.kill(name); } catch { /* gone */ } }
}

/** Stops every server and suite still running, and waits until they have gone. */
async function stopAll() {
  const waiting = [...children].map((child) => new Promise((done) => {
    if (child.exitCode !== null || child.signalCode !== null) return done();
    child.once('close', done);
    signal(child, 'SIGTERM');
    setTimeout(() => { signal(child, 'SIGKILL'); done(); }, 5000);
  }));
  await Promise.all(waiting);
}
process.on('SIGINT', () => { stopAll().then(() => process.exit(130)); });
process.on('SIGTERM', () => { stopAll().then(() => process.exit(143)); });

/** "N/M checks passed" — the last one a suite prints; the FAIL lines beside it. */
function readResult(text) {
  const counts = [...text.matchAll(/^(\d+)\/(\d+) checks passed/gm)].at(-1);
  const failed = [...text.matchAll(/^FAIL\s+(.*?)(?:\s+—|$)/gm)].map((m) => m[1].trim());
  return counts ? { passed: Number(counts[1]), total: Number(counts[2]), failed } : { passed: null, total: null, failed };
}

/* ── 1. Builds ─────────────────────────────────────────────────────────── */

mkdirSync(RUN, { recursive: true });
const rows = [];
let broken = false;
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const webkitList = BROWSER === 'webkit' ? (await import('./lib.mjs')).WEBKIT_SUITES : null;
const chosen = SUITES.filter((suite) => (!only || only.has(suite.name)) && (!webkitList || webkitList.includes(suite.name)));
const needed = new Set(['app', ...chosen.flatMap((suite) => suite.needs ?? [])]);

async function step(label, command, commandArgs, options) {
  console.log(`[run-all] ${label} …`);
  const result = await run(command, commandArgs, { ...options, log: join(RUN, `${label.replace(/\W+/g, '-')}.log`) });
  rows.push({ name: label, kind: 'build', ok: result.code === 0, ms: result.ms });
  if (result.code !== 0) { broken = true; console.log(`[run-all] ${label} failed — see ${RUN}`); }
  return result.code === 0;
}

if (BUILD) {
  await step('build: app', 'npm', ['run', 'build']);
  if (needed.has('preview')) {
    await step('build: preview', 'npx', ['vite', 'build', '--outDir', 'dist-preview', '--emptyOutDir'], { env: { VITE_MOMENTUM_DB: 'momentum-preview' } });
  }
}
if (needed.has('live') && (REBUILD_LIVE || !existsSync(join(LIVE_DIR, 'dist', 'index.html')))) {
  rmSync(LIVE_DIR, { recursive: true, force: true });
  mkdirSync(LIVE_DIR, { recursive: true });
  const archive = spawnSync('sh', ['-c', `git -C "${ROOT}" archive ${LIVE_COMMIT} | tar -x -C "${LIVE_DIR}"`]);
  if (archive.status !== 0) { broken = true; rows.push({ name: `build: live ${LIVE_COMMIT}`, kind: 'build', ok: false, ms: 0 }); console.log(String(archive.stderr)); }
  else if (await step(`build: live ${LIVE_COMMIT} (npm ci)`, 'npm', ['ci', '--no-audit', '--no-fund'], { cwd: LIVE_DIR })) {
    await step(`build: live ${LIVE_COMMIT}`, 'npm', ['run', 'build'], { cwd: LIVE_DIR });
  }
}

/* ── 2. Servers ────────────────────────────────────────────────────────── */

if (!broken) {
  for (const [name, port] of Object.entries(PORT)) {
    if (!needed.has(name)) continue;
    if (await reachable(`http://127.0.0.1:${port}/`, { timeout: 500 })) {
      broken = true;
      console.log(`[run-all] port ${port} is taken: stop whatever serves it, so that the suites test this build`);
    }
  }
}
if (!broken) {
  // On the address the suites ask for: `localhost` is IPv6 alone on some
  // machines (a GitHub runner among them), and 127.0.0.1 then finds nobody.
  const host = ['--host', '127.0.0.1'];
  serve('app', ['vite', 'preview', '--port', String(PORT.app), '--strictPort', ...host], ROOT);
  if (needed.has('preview')) serve('preview', ['vite', 'preview', '--outDir', 'dist-preview', '--port', String(PORT.preview), '--strictPort', ...host], ROOT);
  if (needed.has('live')) serve('live', ['vite', 'preview', '--port', String(PORT.live), '--strictPort', ...host], LIVE_DIR);
  if (needed.has('dev')) serve('dev', ['vite', '--port', String(PORT.dev), '--strictPort', ...host], ROOT);
  for (const name of needed) {
    if (!(await reachable(ADDRESS[name]))) { broken = true; console.log(`[run-all] the ${name} server did not answer at ${ADDRESS[name]}`); }
  }
}

/* ── 3. Suites ─────────────────────────────────────────────────────────── */

async function runSuite(suite) {
  const out = join(RUN, suite.name);
  mkdirSync(join(out, 'tmp'), { recursive: true });
  const env = {
    OUT: out, SHOTS: out, BODY_SHOTS: out, RELEASE_TMP: join(out, 'tmp'),
    URL_APP: ADDRESS.app, URL_PREVIEW: ADDRESS.preview, LIVE_URL: ADDRESS.live, BODY_URL: `${ADDRESS.dev}#/dev/body`,
    BROWSER,
    ...(BROWSER === 'webkit' ? (suite.webkitEnv ?? {}) : {}),
  };
  console.log(`[run-all] ${suite.name} …`);
  const result = await run('node', [join('scripts', 'verify', `${suite.name}.mjs`)], { env, log: join(RUN, `${suite.name}.log`), ...(suite.timeout ? { timeout: suite.timeout } : {}) });
  const read = readResult(result.text);
  const known = KNOWN_RED[suite.name] ?? [];
  const unknown = read.failed.filter((name) => !known.some((entry) => name.includes(entry.check)));
  const row = {
    name: suite.name,
    kind: suite.alone ? '3D, alone' : 'suite',
    ok: result.code === 0 && read.total !== null && read.passed === read.total,
    passed: read.passed,
    total: read.total,
    ms: result.ms,
    failed: read.failed,
    knownOnly: result.code !== 0 && read.failed.length > 0 && unknown.length === 0,
  };
  rows.push(row);
  console.log(`[run-all] ${suite.name}: ${read.passed ?? '?'}/${read.total ?? '?'} in ${seconds(result.ms)}${row.ok ? '' : row.knownOnly ? ' — known red only' : ' — FAILED'}`);
  // A red suite says why where its log is read: on GitHub, the job's output
  // is the one place that needs no download.
  if (!row.ok) for (const line of result.text.split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 12)) console.log(`[run-all]   ${line.slice(0, 400)}`);
}

if (!broken) {
  const parallel = chosen.filter((suite) => !suite.alone);
  const queue = [...parallel];
  await Promise.all(Array.from({ length: JOBS }, async () => {
    while (queue.length) await runSuite(queue.shift());
  }));
  for (const suite of chosen.filter((s) => s.alone)) await runSuite(suite);
}
await stopAll();

/* ── 4. The table ──────────────────────────────────────────────────────── */

const lines = [
  `| Suite | Kind | Passed | Duration | Result |`,
  `|---|---|---|---|---|`,
  ...rows.map((row) => `| ${row.name} | ${row.kind} | ${row.total === undefined ? '—' : `${row.passed ?? '?'}/${row.total ?? '?'}`} | ${seconds(row.ms)} | ${row.ok ? 'green' : row.knownOnly ? `red, known: ${row.failed.join('; ')}` : `**red**${row.failed?.length ? `: ${row.failed.slice(0, 3).join('; ')}` : ''}`} |`),
];
const suites = rows.filter((row) => row.kind !== 'build');
const passed = suites.reduce((sum, row) => sum + (row.passed ?? 0), 0);
const total = suites.reduce((sum, row) => sum + (row.total ?? 0), 0);
const unknownRed = rows.filter((row) => !row.ok && !row.knownOnly);
const knownRed = rows.filter((row) => row.knownOnly);
const verdict = broken
  ? 'The run could not start every part: see the lines above.'
  : `${suites.length} suites, ${passed}/${total} checks in ${BROWSER}; ${unknownRed.length} red beyond the known, ${knownRed.length} known red.`;
const table = `${lines.join('\n')}\n\n${verdict}\n`;
writeFileSync(join(RUN, 'table.md'), table);
writeFileSync(join(RUN, 'results.json'), `${JSON.stringify({ browser: BROWSER, rows, passed, total, broken }, null, 2)}\n`);
console.log(`\n${table}\n[run-all] logs and pictures: ${RUN}`);
process.exit(broken || rows.some((row) => !row.ok) ? 1 : 0);
