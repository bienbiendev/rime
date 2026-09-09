import type { Dic } from '$lib/util/types.js';
import { areaHooks } from './area/hooks.server.js';
import { collectionHooks } from './collection/hooks.server.js';
import type { PrototypeName } from './index.js';

/**
 * Each prototype's own hooks, by name.
 *
 * Taken from the `hooks.server.ts` files rather than from the server definitions: those spread
 * `{ ...base }` at module scope, so importing one makes the importer depend on an evaluation
 * order, and the spread can arrive without `features`. A list of hooks depends on nothing, which
 * is why this file imports nothing else.
 */
export const prototypeHooks: Record<PrototypeName, Dic> = {
  collection: collectionHooks,
  area: areaHooks
};
