import { defineFeature } from '$lib/core/features/define.js';

/**
 * Which relation field stands in for a document visually — `asThumbnail`.
 *
 * Listed by collections only: an area is a single document and nothing lists it, so there is
 * nothing for a thumbnail to appear in.
 */
export const thumbnail = defineFeature({
  name: 'thumbnail',
  enabled: () => true
});
