import type { RouteConfig } from '$lib/core/config/types.js';
import { restGet } from './get.server.js';
import { restUpdate } from './update.server.js';

/**
 * The REST surface an area provides: one path, two methods.
 *
 * No `[id]` tier and no POST/DELETE — a singleton has one document, so there is nothing to
 * address and nothing to create or remove. That is not a switch turned off somewhere; it is
 * simply what this prototype declares.
 */
export const rest: Record<string, RouteConfig> = {
  '': { GET: restGet, PATCH: restUpdate }
};
