import { defineFeature } from '../define.js';
import { augmentUrl } from './augment.js';

/**
 * Gives a document a `url`, computed from the config's own `$url` function.
 *
 * The first feature written to the contract, and the plainest kind: `augment`. It adds one field
 * and one read hook, asks the adapter for nothing, and applies to every prototype — a collection
 * and an area both get a url the same way.
 *
 * **This is the client-safe half**, and it is all the prototype factories need: an augment runs
 * while a config is being built, on both sides. The hooks live in index.server.ts, because
 * `populateURL` reads private env and talks to the adapter — importing them here would drag that
 * into the browser bundle through `factory/collection/index.ts`. The same `augment.ts` /
 * `augment.server.ts` split the repo already uses, one level up.
 */
export const url = defineFeature({
  type: 'augment',
  extends: ['collection', 'area'],
  requires: [],

  /** A config uses this feature by declaring how to build its url. */
  enabled: (config) => !!config.$url,

  augment: augmentUrl
});
