import type { CollectionLabel } from '$lib/core/config/types.js';
import { capitalize } from '$lib/util/string.js';
import type { Collection } from '../../../types.js';

export type WithNormalizedLabel<T> = Omit<T, 'label'> & { label: CollectionLabel };

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
