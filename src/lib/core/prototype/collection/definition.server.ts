import type { BuiltCollection } from '#lib/core/config/types.js';
import { definePrototype } from '../define.js';
import { collection as base } from './definition.js';
import { rest } from './rest/index.server.js';

/**
 * The server half: the same collection, plus what only a server can provide.
 *
 * It spreads the client half whole rather than restating it.
 */
export const collection = definePrototype<BuiltCollection>({
  ...base,
  rest
});
