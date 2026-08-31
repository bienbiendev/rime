import { populateURL } from './hooks/populate-url.server.js';

/**
 * The url feature's **phase 3** half — see upload/runtime.server.ts for why every feature is
 * split this way even when, as here, it has no boot seam heavy enough to close a cycle.
 * `operations/pipeline.server.ts` imports only this half, for every feature, so the rule holds
 * uniformly rather than per-feature.
 */
export const urlRuntime = {
  name: 'url',
  appliesTo: ['collection', 'area'],

  enabled: (config: any) => !!config.$url,

  hooks: { populateURL }
} as const;
