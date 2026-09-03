import type { Collection } from '$lib/core/factory/config/types.js';
import { findThumbnailField } from './find-thumbnail.js';

// Only `fields`. The previous shape also declared `upload` and `auth`, which the body never
// read — the docblock below was copied from augmentTitle, which did use them, and the type came
// along with it.
type Input = {
  fields?: Collection<any>['fields'];
};
type WithAsThumbnail<T> = T & { asThumbnail: string | null };
/**
 * Resolves `asThumbnail`: the relation field that stands in for a document visually, or `null`
 * when the config marks none.
 */
export const augmentThumbnail = <T extends Input>(config: T): WithAsThumbnail<T> => {
  const addAsThumbnail = () => {
    const thumbnailField = findThumbnailField(config.fields);
    return thumbnailField?.path || null;
  };

  return {
    ...config,
    asThumbnail: addAsThumbnail()
  };
};
