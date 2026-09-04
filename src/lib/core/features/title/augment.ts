import type { Collection } from '$lib/core/config/types.js';
import { findTitleField } from './find-title.js';

type Input = {
  fields?: Collection<any>['fields'];
  /** See `$titleFallback` below. */
  $titleFallback?: string;
};

type WithAsTitle<T> = T & { asTitle: string };

/**
 * Resolves `asTitle`: the field that stands in for a document wherever one is listed.
 *
 * **It names no feature.** Each one says what its own documents are called by offering
 * `$titleFallback`, and this decides between an explicit title field, whatever was offered, and
 * `id`.
 *
 * The precedence: a field marked as the title wins, then the last feature to offer a fallback,
 * then `id`. "Last to offer" is registry order — upload overwrites where auth defers, so upload
 * wins for a config carrying both.
 */
export const augmentTitle = <T extends Input>(config: T): WithAsTitle<T> => {
  const titleField = findTitleField(config.fields);

  return {
    ...config,
    asTitle: titleField?.path ?? config.$titleFallback ?? 'id'
  };
};
