import type { BuiltCollection, Config } from '$lib/core/config/types.js';
import { getStaffCollection } from './derive.js';
// Imported straight from the collection's config factory, not through `core/config/index.server.js`.
// The barrel also exports `rime`, which is `build.server.ts`, which reaches the prototype registry
// and so every feature - including this one. Going through it closes a cycle that leaves `auth`
// undefined in `collectionFeatures` at the moment the definition evaluates (rule 3 in
// docs/restructure-handoff.md, the same failure the prototype's hook list avoids).
import * as Collection from '$lib/core/prototype/collection/config/index.js';

export const augmentStaff = <
  T extends { collections?: BuiltCollection[]; staff?: Config['staff'] }
>(
  config: T
) => {
  const staff = Collection.create('staff', getStaffCollection(config.staff));
  return { ...config, collections: [staff, ...(config.collections || [])] } as const;
};
