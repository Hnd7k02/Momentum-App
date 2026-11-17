import { DB_NAME } from '../storage/db';

/**
 * Whether this build is the preview (`…/Momentum-preview/`).
 *
 * A preview keeps its data in a database of its own (`VITE_MOMENTUM_DB`,
 * `storage/db.ts`); the live app, the tests and the suites open `momentum`.
 * That name is the one fact that tells the two builds apart, and the one
 * thing only a preview offers hangs on it: **the onboarding as a rehearsal**
 * (block 7E, D191) — walked as a new device walks it, and ended without a
 * write, so the owner can see it again on a device that holds his data.
 * The live app has no such entry and never will.
 */
export function isPreviewBuild(databaseName: string = DB_NAME): boolean {
  return databaseName !== 'momentum';
}
