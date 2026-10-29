import type { CollectionLabel } from '#lib/core/prototype/collection/types.js';
import { capitalize } from '#lib/util/string.js';
import type { Collection } from '#lib/types.js';

type WithNormalizedLabel<T> = Omit<T, 'label'> & { label: CollectionLabel };

/**
 * A collection's label as `{ singular, plural }`: a string label is both, an object is kept, and
 * no label is the capitalised slug for both.
 *
 * ```ts
 * augmentLabel({ slug: 'pages', label: 'Page' }).label // { singular: 'Page', plural: 'Page' }
 * augmentLabel({ slug: 'news' }).label                 // { singular: 'News', plural: 'News' }
 * ```
 */
export const augmentLabel = <T extends Collection<any>>(config: T): WithNormalizedLabel<T> => {
  let label: CollectionLabel;

  if (typeof config.label === 'string') {
    label = {
      singular: config.label,
      plural: config.label
    };
  } else if (config.label) {
    label = config.label;
  } else {
    label = {
      singular: capitalize(config.slug),
      plural: capitalize(config.slug)
    };
  }

  return { ...config, label };
};
