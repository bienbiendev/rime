import { augmentCORS, handleCORS } from '$rime/modules';
import { defineFeature } from '../define.js';

/**
 * Which origins may call the API, and the handler that enforces it.
 *
 * Both halves of one idea, which is what makes it a feature: it *augments* a config (the
 * `$trustedOrigins` default) and *extends* what happens to a request. `handlers/index.ts` runs
 * the handler between `handleAuth` and the plugins'.
 *
 * Listed by both prototypes, like `panel`, because it belongs to neither: a feature reaches the
 * config through some prototype's list, and CORS is about the API as a whole.
 */
export const cors = defineFeature({
  name: 'cors',
  type: 'augment',
  requires: [],
  enabled: () => true,

  configure: augmentCORS,
  handler: handleCORS
});

/** The origin list is always there once this has run, which is what the handler reads. */
declare module '$lib/core/features/register.js' {
  interface FeatureConfigure<T> {
    cors: T & { $trustedOrigins: string[] };
  }
}
