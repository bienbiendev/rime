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
 * **This used to name `upload` and `auth`.** The old switch fell through
 * `titleField → config.upload ? 'filename' : config.auth?.type === 'password' ? 'email' : …`,
 * which meant a shared augment knew about two features in order to guess for them. Now each one
 * says what its own documents are called, through `$titleFallback`, and this only decides between
 * an explicit title field, whatever was offered, and `id`.
 *
 * The precedence is unchanged: a field marked as the title wins, then the last feature to offer a
 * fallback, then `id`. "Last to offer" is registry order, and upload deliberately overwrites
 * where auth defers — which reproduces the old switch, where `upload` was tested before `auth`.
 */
export const augmentTitle = <T extends Input>(config: T): WithAsTitle<T> => {
  const titleField = findTitleField(config.fields);

  return {
    ...config,
    asTitle: titleField?.path ?? config.$titleFallback ?? 'id'
  };
};
