import type { BuiltCollection, Config } from '$lib/core/config/types.js';
import { getStaffCollection } from './derive.js';
// Straight from the collection's own definition, never through `core/config/index.js`: that
// barrel also exports the config builder, which reaches the prototype registry and so every
// feature, including this one. Going through it closes a cycle in which `auth` is `undefined` in
// the collection's feature list at the moment the definition evaluates.
//
// The isomorphic half, and that is the rule rather than a preference: a feature must not import a
// prototype's `definition.server.ts`, which spreads `{ ...base }` at module scope.
import { create } from '$lib/core/prototype/collection/definition.js';

export const augmentStaff = <
  T extends { collections?: BuiltCollection[]; staff?: Config['staff'] }
>(
  config: T
) => {
  const staff = create('staff', getStaffCollection(config.staff));
  return { ...config, collections: [staff, ...(config.collections || [])] } as const;
};
