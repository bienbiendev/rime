import { STAFF_SLUG } from '../constant.js';
import type { BuiltCollection, Config } from '#lib/core/config/types.js';
import { getStaffCollection } from './derive.js';
// Straight from the collection's own definition, never through `core/config/index.server.js`:
// that barrel also exports `rime`, which reaches the prototype registry and so every feature,
// including this one. Going through it closes an import cycle back to this feature.
//
// The isomorphic half: a feature never imports a prototype's `definition.server.ts`.
import { create } from '#lib/core/prototype/collection/definition.js';

// The staff collection every config gets. Client-side it goes first (the panel lists it
// first), server-side last — the one thing the two halves genuinely disagree on.
export const configureStaff = <
  const T extends { collections?: BuiltCollection[]; staff?: Config['staff'] }
>(
  config: T
) => {
  const staff = create(STAFF_SLUG, getStaffCollection(config.staff));
  return { ...config, collections: [...(config.collections || []), staff] } as const;
};
