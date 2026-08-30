import type { BuiltArea, BuiltCollection } from '$lib/core/factory/config/types.js';

export const augmentPrototypes = <
  const T extends { collections?: BuiltCollection[]; areas?: BuiltArea[] }
>(
  config: T
) => {
  return {
    ...config,
    collections: config.collections || [],
    areas: config.areas || []
  } as const;
};
