import type { Config } from '../config/types.js';
import { handleAuth } from '../features/auth/handler/index.server.js';
import { handleCORS } from '../features/cors/handler.server.js';
import type { Rime } from '../rime.server.js';
import { createCMSHandler } from './main.server.js';
import { createPluginsHandler } from './plugins.server.js';
import { handleRoutes } from './routes.server.js';

// C -> rime(C)
//      |-> BuildConfig<C> -> B -> async createRime<B> -> Promise<Rime<C>

export default async function <const C extends Config>(rime: Promise<Rime<C>>) {
  /**
   * The request chain, written down.
   *
   * A handler lives with the feature it is about — 253 lines of auth are in `features/auth/` and
   * not here — and this file says when each runs. Those are two different questions, and they were
   * briefly one: folding `featureHandlers(prototypes)` derived the order from the prototypes'
   * feature lists, which put a security-relevant sequence at the mercy of a list whose actual job
   * is **column order** (CONTRIBUTING rule 2 — reordering it is a migration).
   *
   * Imported by path rather than off `FeatureDefinition.handler`, which is gone: this file is
   * server-only, so there is nothing for `$rime/modules` to protect it from, and a property whose
   * only reader names it anyway is an indirection with no second caller.
   *
   * `cors` before `auth`: a request from a disallowed origin is refused without first being asked
   * to prove who it is.
   *
   */
  return [
    createCMSHandler(await rime),
    handleCORS,
    handleAuth,
    ...createPluginsHandler(await rime),
    handleRoutes
  ];
}
