import type { Config } from '../config/types.js';
import type { Rime } from '../rime.server.js';
import { handleAuth } from './auth.server.js';
import { handleCORS } from './cors.server.js';
import { createCMSHandler } from './main.server.js';
import { createPluginsHandler } from './plugins.server.js';
import { handleRoutes } from './routes.server.js';

// C -> rime(C)
//      |-> BuildConfig<C> -> B -> async createRime<B> -> Promise<Rime<C>

export default async function <const C extends Config>(rime: Promise<Rime<C>>) {
  return [
    createCMSHandler(await rime),
    handleAuth,
    handleCORS,
    handleRoutes,
    ...createPluginsHandler(await rime)
  ];
}
