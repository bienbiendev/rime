import type { RouteConfig } from '$lib/core/factory/config/types.js';
import { restCreate } from './create.server.js';
import { restDelete } from './delete.server.js';
import { restDeleteById } from './delete-by-id.server.js';
import { restDuplicate } from './duplicate.server.js';
import { restGet } from './get.server.js';
import { restGetById } from './get-by-id.server.js';
import { restUpdateById } from './update-by-id.server.js';

/**
 * The REST surface a collection provides.
 *
 * Declared the way every other route in rime is declared — `RouteConfig` per path, the shape
 * `config.$routes` and `plugin.routes` use — so codegen writes the `+server.ts` files from this
 * and nothing else needs to know a collection has three tiers.
 *
 * Keys are sub-paths under `/api/[slug=collection]`, not absolute pathnames as a plugin's are:
 * a collection has no URL of its own to name, only slugs the user's config supplies.
 */
export const rest: Record<string, RouteConfig> = {
  '': { GET: restGet, POST: restCreate, DELETE: restDelete },
  '[id]': { GET: restGetById, PATCH: restUpdateById, DELETE: restDeleteById },
  '[id]/duplicate': { POST: restDuplicate }
};
