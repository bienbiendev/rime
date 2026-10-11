import { syncAreaUrl } from '#lib/core/prototype/shared/url/hooks/sync-area-url.server.js';
import { expect, test } from 'vitest';
import { areaHooks } from './hooks.server.js';

/** The hook a list entry runs: `when(guard, hook)` keeps it as `.step`. */
const stepOf = (entry: any) => entry.step ?? entry;

test('an area with $url writes its url after a save', () => {
  expect((areaHooks.afterUpdate ?? []).map(stepOf)).toContain(syncAreaUrl);
});
