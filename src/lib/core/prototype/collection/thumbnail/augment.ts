import type { Collection } from '#lib/core/config/types.js';
import { findThumbnailField } from './find-thumbnail.js';

type Input = {
  fields?: Collection<any>['fields'];
};
type WithAsThumbnail<T> = T & { asThumbnail: string | null };
/**
 * Resolves `asThumbnail`: the relation field that stands in for a document visually, or `null`
 * when the config marks none.
 */
export const augmentThumbnail = <T extends Input>(config: T): WithAsThumbnail<T> => {
  return {
    ...config,
    asThumbnail: findThumbnailField(config.fields)
  };
};
