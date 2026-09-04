import type { BuiltCollection, Config } from '$lib/core/config/types.js';
import { getStaffCollection } from './derive.js';
// Straight from the collection's config factory, never through `core/config/index.server.js`: that
// barrel also exports `rime`, which reaches the prototype registry and so every feature, including
// this one. Going through it closes a cycle in which `auth` is `undefined` in `collectionFeatures`
// at the moment the definition evaluates.
import * as Collection from '$lib/core/prototype/collection/config/index.server.js';

export const augmentStaff = <
  const T extends { collections?: BuiltCollection[]; staff?: Config['staff'] }
>(
  config: T
) => {
  const staff = Collection.create('staff', getStaffCollection(config.staff));
  return { ...config, collections: [...(config.collections || []), staff] } as const;
};
