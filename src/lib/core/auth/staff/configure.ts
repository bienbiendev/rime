import { STAFF_SLUG } from '../constant.js';
import type { BuiltCollection, Config } from '#lib/core/config/types.js';
import { getStaffCollection } from './derive.js';
// Straight from the collection's own definition, never through `core/config/index.js`: that
// barrel also exports the config builder, which reaches the prototype registry and so every
// feature, including this one. Going through it closes an import cycle back to this feature.
//
// The isomorphic half, and that is the rule rather than a preference: a feature must not import a
// prototype's `definition.server.ts`, which spreads `{ ...base }` at module scope.
import { create } from '#lib/core/prototype/collection/definition.js';

// The staff collection every config gets. Client-side it goes first (the panel lists it
// first), server-side last — the one thing the two halves genuinely disagree on.
export const configureStaff = <
  T extends { collections?: BuiltCollection[]; staff?: Config['staff'] }
>(
  config: T
) => {
  const staff = create(STAFF_SLUG, getStaffCollection(config.staff));
  return { ...config, collections: [staff, ...(config.collections || [])] } as const;
};
