import { augmentCORS, handleCORS } from '$rime/modules';
import { defineFeature } from '../define.js';

/**
 * Which origins may call the API, and the handler that enforces it.
 *
 * Both halves of one idea, and the reason this is a feature rather than anything else: it
 * *augments* a config (the `$trustedOrigins` default) and it *extends* what happens to a request.
 * They used to be filed apart — `augmentCORS` in the config chain, `handleCORS` in
 * `core/handlers/` — with core naming both and neither knowing about the other.
 *
 * It is the first feature to carry a `handler`, and what that member says is: the request path is
 * a place a feature can reach, not a fixed list in core. `handlers/index.ts` collects them where
 * `handleCORS` used to be named, so the order it ran in is the order it runs in.
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
