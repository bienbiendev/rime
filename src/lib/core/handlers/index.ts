import type { Config } from '../config/types.js';
import { auth } from '../features/auth/index.js';
import { cors } from '../features/cors/index.js';
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
   * A feature *owns* its handler — `cors.handler`, `auth.handler` — and this says when each runs.
   * Those are two different questions and they were briefly one: folding
   * `featureHandlers(prototypes)` derived the order from the prototypes' feature lists, which put
   * a security-relevant sequence at the mercy of a list whose actual job is **column order**
   * (CONTRIBUTING rule 2 — reordering it is a migration). It also needed a test to assert that the
   * derived order still matched what this list used to say, which is the mechanism arguing
   * against itself.
   *
   * `cors` before `auth`: a request from a disallowed origin is refused without first being asked
   * to prove who it is.
   *
   * Both handlers are `undefined` on a client build — they come through `$rime/modules` from
   * server-only halves — but this file is server-only, so they are real here.
   */
  return [
    createCMSHandler(await rime),
    cors.handler!,
    auth.handler!,
    ...createPluginsHandler(await rime),
    handleRoutes
  ];
}
