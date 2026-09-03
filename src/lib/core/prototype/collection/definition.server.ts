import type { BuiltCollection } from '$lib/core/config/types.js';
import { definePrototype } from '../define.js';
import { api, type CollectionAccessor } from './api.server.js';
import { collection as base } from './definition.js';
import { collectionHooks } from './hooks.server.js';
import { rest } from './rest/index.server.js';

/**
 * The server half: the same collection, plus what only a server can provide.
 *
 * Same export name as `module.js` — that is what makes the pair resolve — and it takes the
 * client half whole rather than restating it, so the features and hooks are declared once.
 */
export const collection = definePrototype<BuiltCollection, CollectionAccessor>({
  ...base,
  api: (ctx) => api(ctx),
  rest,

  /**
   * The prototype's own document hooks, listed in `hooks.server.ts` beside this file.
   *
   * On the **server half**, and that is a constraint rather than tidiness. The config factory runs
   * on both sides and needs `features`, so it imports the client half — and a hook is typed through
   * `HookContext → event.locals.rime`, which resolves through the config the factory is building.
   * Putting hooks on the client half therefore made every one of them reference itself.
   * They are server-only code regardless; nothing client-side runs a document hook.
   */
  hooks: collectionHooks
});
