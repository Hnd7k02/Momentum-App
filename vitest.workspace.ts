import { defineWorkspace } from 'vitest/config';

/**
 * Date logic is the one part of Momentum that a single time zone cannot prove
 * correct, so the suite runs twice:
 *
 * - `berlin`   — the primary audience's zone, DST in March and October.
 * - `sao_paulo` — a zone whose DST transition used to happen *at midnight*,
 *   which is what breaks midnight-anchored date arithmetic.
 *
 * `tools` holds the tests of the scripts that build the body model
 * (`tools/body/`). They run a command on a file and know no time zone.
 */
export default defineWorkspace([
  {
    extends: './vite.config.ts',
    test: {
      name: 'berlin',
      env: { TZ: 'Europe/Berlin' },
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      exclude: ['src/**/*.tz.test.ts'],
    },
  },
  {
    extends: './vite.config.ts',
    test: {
      name: 'sao_paulo',
      env: { TZ: 'America/Sao_Paulo' },
      include: ['src/**/*.tz.test.ts'],
    },
  },
  {
    test: {
      name: 'tools',
      environment: 'node',
      include: ['tools/**/*.test.mjs'],
    },
  },
]);
