import { augmentNested, nestedHooks } from '$rime/modules';
import { defineFeature } from '../define.js';

/**
 * A collection whose documents form a tree: each one may name a parent and a position among its
 * siblings, and reads can ask for its children.
 *
 * Collections only — an area is a single document, so there is nothing for it to be nested in.
 */
export const nested = defineFeature({
  name: 'nested',
  type: 'augment',
  requires: [],

  /** A config uses this feature by declaring `nested`. */
  enabled: (config) => !!config.nested,

  augment: augmentNested,

  hooks: nestedHooks
});
