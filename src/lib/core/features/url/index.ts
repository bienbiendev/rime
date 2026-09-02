import { urlHooks } from '$rime/modules';
import { defineFeature } from '../define.js';
import { augmentUrl } from './augment.js';

/**
 * Gives a document a `url`, computed from the config's own `$url` function.
 *
 * The first feature written to the contract, and the plainest kind: `augment`. It adds one field
 * and one read hook, asks the adapter for nothing, and applies to every prototype — a collection
 * and an area both get a url the same way.
 *
 * One definition, both sides. The augment is isomorphic, and the hook comes from
 * `module.server.ts` through `$rime/modules`, which resolves to the server half on a server build
 * and to `undefined` on a client one. That is the repo's own convention for this — `fields/link`,
 * `fields/relation` and `core/plugins/cache` are the other pairs — and it is why a feature needs
 * no client and server halves of its *definition*.
 */
export const url = defineFeature({
  type: 'augment',
  extends: ['collection', 'area'],
  requires: [],

  /** A config uses this feature by declaring how to build its url. */
  enabled: (config) => !!config.$url,

  augment: augmentUrl,

  // Read at call time, like every other barrel binding — and `undefined` on the client,
  // where nothing reads it.
  hooks: () => urlHooks
});
