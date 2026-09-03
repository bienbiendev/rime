import { defineFeature } from '../define.js';
import { setDocumentThumbnail } from '$lib/core/operations/steps/set-document-thumbnail.server.js';
import { augmentThumbnail } from './augment.js';

/**
 * Which relation field stands in for a document visually — `asThumbnail`.
 *
 * Collections only: an area is a single document and nothing lists it, so there is nothing for a
 * thumbnail to appear in. That is the same reason the area pipeline has no `setDocumentThumbnail`
 * step.
 */
export const thumbnail = defineFeature({
  name: 'thumbnail',
  type: 'augment',
  requires: [],
  enabled: () => true,
  augment: augmentThumbnail,

  hooks: { beforeRead: [setDocumentThumbnail] }
});

/** Resolves `asThumbnail`, which the built collection declares as required. */
declare module '$lib/core/features/register.js' {
  interface FeatureConfigAugment<T> {
    thumbnail: T & { asThumbnail: string | null };
  }
}
