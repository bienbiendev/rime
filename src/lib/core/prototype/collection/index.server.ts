import type { BuiltCollection } from '$lib/core/factory/config/types.js';
import { definePrototype } from '../define.js';
import { api, type CollectionAccessor } from './api.server.js';
import { rest } from './rest/index.server.js';

/**
 * A collection: many documents, addressed by id, with the full set of operations.
 *
 * It is a definition rather than "the absence of area" so that code iterating the registry sees
 * both kinds, and so `singleton: false` is stated rather than implied. Nothing to do at boot —
 * a collection with no documents is a collection with no documents.
 */
export const collection = definePrototype<BuiltCollection, CollectionAccessor>({
  api: (ctx) => api(ctx),
  rest
});
