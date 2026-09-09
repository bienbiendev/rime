import { defineFeature } from '$lib/core/features/define.js';

/**
 * The bookkeeping fields every document carries: who edited it and when.
 *
 * A feature rather than part of a prototype: nothing here is what a document fundamentally is, and
 * a config carrying none of it would still be a valid collection.
 *
 * `enabled` is unconditional — every config gets these. A feature that always applies is still a
 * feature; which prototypes list it is the interesting part.
 */
export const metas = defineFeature({
  name: 'metas',
  enabled: () => true
});
