import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

/**
 * Not a suite: what the live state shows, day by day, for a backup — read by
 * the live state's own code (block 9, step 4).
 *
 * "Für jeden Tag vor dem Tag des Updates zeigt der neue Stand dieselben
 * Werte, die der alte gezeigt hat … Belege es mit Zahlen aus beiden
 * Ständen." The live state is `e30becd`. This script takes it from history
 * into a directory of its own (`LIVE_DIR`, the one `run-all.mjs` builds),
 * copies `src/storage/services/fixtures/updateOutputs.ts` into it byte for
 * byte, writes a test there that imports `BACKUP` on `REFERENCE` the way the
 * live app does and reads its replay through that file, runs it with the
 * live state's own vitest, and writes the result to `OUT`. Then it removes
 * what it put there.
 *
 *   BACKUP=.github/fixtures/wp3-update/live-profile.json REFERENCE=2026-11-18 \
 *     OUT=.github/fixtures/wp3-update/e30becd-outputs-2026-11-18.json \
 *     node scripts/verify/update-live-outputs.mjs
 *
 * `updateRehearsal.test.ts` compares this build's replay of the same backup,
 * updated on the same day, against that file for every day before it.
 */
const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const LIVE_COMMIT = 'e30becd';
const LIVE_DIR = process.env.LIVE_DIR ?? join(tmpdir(), `momentum-live-${LIVE_COMMIT}`);
const BACKUP = resolve(process.env.BACKUP ?? '.github/fixtures/wp3-update/live-profile.json');
const REFERENCE = process.env.REFERENCE;
const OUT = resolve(process.env.OUT ?? '');
if (!REFERENCE || !process.env.OUT) throw new Error('REFERENCE and OUT are required');

const run = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env } });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed in ${cwd}`);
};

if (!existsSync(join(LIVE_DIR, 'node_modules'))) {
  rmSync(LIVE_DIR, { recursive: true, force: true });
  mkdirSync(LIVE_DIR, { recursive: true });
  run('sh', ['-c', `git -C "${ROOT}" archive ${LIVE_COMMIT} | tar -x -C "${LIVE_DIR}"`], ROOT);
  run('npm', ['ci', '--no-audit', '--no-fund'], LIVE_DIR);
}

const helper = join(LIVE_DIR, 'src/storage/services/fixtures/updateOutputs.ts');
const test = join(LIVE_DIR, 'src/storage/services/zzUpdateOutputs.test.ts');
mkdirSync(dirname(helper), { recursive: true });
copyFileSync(join(ROOT, 'src/storage/services/fixtures/updateOutputs.ts'), helper);
writeFileSync(
  test,
  `import 'fake-indexeddb/auto';
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { setClock } from '../../core/clock';
import { importBackup } from './backupService';
import { loadBossProgression } from './bossService';
import { loadConfiguration } from './configurationService';
import { updateOutputs } from './fixtures/updateOutputs';

it('the live state reads the backup', async () => {
  const reference = ${JSON.stringify(REFERENCE)};
  const [y, m, d] = reference.split('-').map(Number) as [number, number, number];
  setClock({ now: () => new Date(y, m - 1, d, 12, 0, 0) });
  const result = await importBackup(readFileSync(${JSON.stringify(BACKUP)}, 'utf8'));
  if (!result.ok) throw new Error(result.details.join('; '));
  await loadConfiguration();
  const boss = await loadBossProgression(reference);
  writeFileSync(${JSON.stringify(OUT)}, JSON.stringify({ commit: ${JSON.stringify(LIVE_COMMIT)}, reference, days: updateOutputs(boss as never) }, null, 1) + '\\n');
});
`,
);
try {
  mkdirSync(dirname(OUT), { recursive: true });
  run('npx', ['vitest', 'run', '--project', 'berlin', 'src/storage/services/zzUpdateOutputs.test.ts'], LIVE_DIR);
} finally {
  rmSync(test, { force: true });
  rmSync(helper, { force: true });
}
console.log(`written: ${OUT}`);
