import { describe, expect, it } from 'vitest';
import { databaseName } from '../storage/db';
import { isPreviewBuild } from './preview';

/**
 * Only the preview offers the onboarding as a rehearsal (block 7E, D191),
 * and the preview is the build with a database of its own. The live app,
 * the tests and the suites open `momentum`, and have no such entry.
 */
describe('the preview build', () => {
  it('is the one whose database has a name of its own', () => {
    expect(isPreviewBuild(databaseName('momentum-preview'))).toBe(true);
    expect(isPreviewBuild(databaseName(undefined))).toBe(false);
    expect(isPreviewBuild(databaseName('momentum'))).toBe(false);
    // A name not of the app's form is ignored, and so is the rehearsal.
    expect(isPreviewBuild(databaseName('other'))).toBe(false);
  });

  it('is not this build: the tests run as the live app', () => {
    expect(isPreviewBuild()).toBe(false);
  });
});
