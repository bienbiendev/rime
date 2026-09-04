import type { BuiltCollection, Config } from '$lib/core/config/types.js';
import { getStaffCollection } from './derive.js';
// Straight from the collection's config factory, never through `core/config/index.js`: that barrel
// also exports the config builder, which reaches the prototype registry and so every feature,
// including this one. Going through it closes a cycle in which `auth` is `undefined` in
// `collectionFeatures` at the moment the definition evaluates.
import * as Collection from '$lib/core/prototype/collection/config/index.js';

export const augmentStaff = <
  T extends { collections?: BuiltCollection[]; staff?: Config['staff'] }
>(
  config: T
) => {
  const staff = Collection.create('staff', getStaffCollection(config.staff));
  return { ...config, collections: [staff, ...(config.collections || [])] } as const;
};
