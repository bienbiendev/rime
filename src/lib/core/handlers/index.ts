import type { Config } from '../config/types.js';
import { featureHandlers } from '../features/registry.js';
import { prototypes } from '../prototype/registry.js';
import type { Rime } from '../rime.server.js';
import { createCMSHandler } from './main.server.js';
import { createPluginsHandler } from './plugins.server.js';
import { handleRoutes } from './routes.server.js';

// C -> rime(C)
//      |-> BuildConfig<C> -> B -> async createRime<B> -> Promise<Rime<C>

export default async function <const C extends Config>(rime: Promise<Rime<C>>) {
  return [
    createCMSHandler(await rime),
    // Whatever the registered features contribute. `handleAuth` was named here until it moved onto
    // the feature it is entirely about; `featureHandlers` folds prototype-then-list order, and
    // `collection` lists `auth` before `cors`, so this is the same sequence the list spelled out.
    ...featureHandlers(prototypes),
    ...createPluginsHandler(await rime),
    handleRoutes
  ];
}
