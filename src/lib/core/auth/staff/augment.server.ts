import type { BuiltCollection, Config } from '$lib/core/config/types.js';
import { getStaffCollection } from './derive.js';
// Straight from the collection's own definition, never through `core/config/index.server.js`:
// that barrel also exports `rime`, which reaches the prototype registry and so every feature,
// including this one. Going through it closes a cycle in which `auth` is `undefined` in the
// collection's feature list at the moment the definition evaluates.
//
// The isomorphic half, which is now the only one: `create` is composed by `definePrototype` and
// there is no server copy of it to reach for — and a feature must not import a prototype's
// `definition.server.ts` anyway.
import { create } from '$lib/core/prototype/collection/definition.js';

export const augmentStaff = <
  const T extends { collections?: BuiltCollection[]; staff?: Config['staff'] }
>(
  config: T
) => {
  const staff = create('staff', getStaffCollection(config.staff));
  return { ...config, collections: [...(config.collections || []), staff] } as const;
};
