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
 *
 * **A test has thirty seconds, not five** (the tidy-up of WP3). The replay
 * tests walk a whole profile through weeks of updates — two and a half
 * seconds each here, beside everything else — and on a GitHub runner with
 * two cores one of them crossed vitest's default of five: `gymMetricEra`
 * timed out in run 42 on a file nobody had touched, and the test after it
 * failed on the database the first was still writing. A time limit says
 * the machine was slow, not that a rule broke; what a replay may cost is
 * measured where it is meant (`replayPerformance.test.ts`), and a test
 * that hangs still fails. The tests that need longer say so themselves.
 */
const TEST_TIMEOUT = 30_000;
export default defineWorkspace([
  {
    extends: './vite.config.ts',
    test: {
      name: 'berlin',
      env: { TZ: 'Europe/Berlin' },
      testTimeout: TEST_TIMEOUT,
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      exclude: ['src/**/*.tz.test.ts'],
    },
  },
  {
    extends: './vite.config.ts',
    test: {
      name: 'sao_paulo',
      env: { TZ: 'America/Sao_Paulo' },
      testTimeout: TEST_TIMEOUT,
      include: ['src/**/*.tz.test.ts'],
    },
  },
  {
    test: {
      name: 'tools',
      environment: 'node',
      testTimeout: TEST_TIMEOUT,
      include: ['tools/**/*.test.mjs'],
    },
  },
]);
