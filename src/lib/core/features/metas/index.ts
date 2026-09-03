import { defineFeature } from '../define.js';
import { augmentMetas } from './augment.js';

/**
 * The bookkeeping fields every document carries: who edited it and when.
 *
 * It lived in `factory/shared/` because both prototypes used it, which is a statement about
 * *reuse*, not about layer — and reuse is what a feature is for. Nothing here is part of what a
 * document fundamentally is; a config that wanted none of this would still be a valid collection.
 *
 * `enabled` is unconditional: every config gets these. A feature that always applies is still a
 * feature — `extends` says which prototypes, and that is the interesting part.
 */
export const metas = defineFeature({
  type: 'augment',
  extends: ['collection', 'area'],
  requires: [],
  enabled: () => true,
  augment: augmentMetas
});
