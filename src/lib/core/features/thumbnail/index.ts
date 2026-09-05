import { thumbnailHooks } from '$rime/modules';
import { defineFeature } from '../define.js';
import { augmentThumbnail } from './augment.js';

/**
 * Which relation field stands in for a document visually — `asThumbnail`.
 *
 * Listed by collections only: an area is a single document and nothing lists it, so there is
 * nothing for a thumbnail to appear in.
 */
export const thumbnail = defineFeature({
  name: 'thumbnail',
  type: 'augment',
  requires: [],
  enabled: () => true,
  augment: augmentThumbnail,

  hooks: thumbnailHooks
});

/** Resolves `asThumbnail`, which the built collection declares as required. */
declare module '$lib/core/features/register.js' {
  interface FeatureConfigAugment<T> {
    thumbnail: T & { asThumbnail: string | null };
  }
}
