import { defineVersionOperation } from './hooks/define-version-operation.server.js';
import { handleNewVersion } from './hooks/handle-new-version.server.js';

/**
 * The versions feature's **phase 3** half — see upload/runtime.server.ts for why every feature
 * is split this way. Here the split is load-bearing for the same reason: `derive.server.ts`
 * imports `augmentCollectionHooks` from pipeline.server.ts, so the full feature must never be
 * reachable from the pipeline.
 *
 * Note how little of versions this is. Two hooks, against upload's eight — because versions'
 * real weight is not in the document pipeline at all, it is in storage topology and query
 * rewriting, spread across eight adapter files. That asymmetry is the whole reason versions was
 * left until last (docs §14.5, §14.7).
 */
export const versionsRuntime = {
  name: 'versions',
  appliesTo: ['collection', 'area'],

  enabled: (config: any) => !!config.versions,

  hooks: {
    beforeUpdate: { defineVersionOperation },
    beforeUpsert: { handleNewVersion }
  }
} as const;
