import type { Collection } from '$lib/core/config/types.js';
import { findTitleField } from './find-title.js';

type Input = {
  fields?: Collection<any>['fields'];
  /**
   * The prototype's fallback, as any feature before this one left it.
   *
   * Required, not optional: this augment has no default of its own, so a config reaching it
   * without one is a prototype that failed to seed it rather than a document with no name.
   */
  _titleFallback: string;
};

type WithAsTitle<T> = T & { asTitle: string };

/**
 * Resolves `asTitle`: the field that stands in for a document wherever one is listed.
 *
 * **It names no feature, and it owns no default.** The prototype seeds `_titleFallback` with what
 * its documents are called; a feature that knows better overrides it (auth with `email`, upload
 * with `filename`); this reads whatever is left.
 *
 * The precedence: a field marked as the title wins, then the last override, then the prototype's
 * own fallback. "Last override" is registry order — upload comes after auth, so upload wins for a
 * config carrying both.
 */
export const augmentTitle = <T extends Input>(config: T): WithAsTitle<T> => {
  const titleField = findTitleField(config.fields);

  return {
    ...config,
    asTitle: titleField?.path ?? config._titleFallback
  };
};
