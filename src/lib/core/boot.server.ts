import { dev } from '$app/environment';
import { createAuthInstance } from '$lib/core/auth/better-auth/instance.server.js';
import type { Config } from '$lib/core/config/types.js';
import { bootUpload } from './prototype/collection/upload/boot/index.server.js';
import { createConfigContext } from './config/context.server.js';
import type { BuildConfig } from './config/index.server.js';
import i18n from './i18n/index.js';
import { registerTranslation } from './i18n/register.server.js';
import { area } from './prototype/area/definition.server.js';

/**
 * Phase 2 of three — everything that happens once, when the process starts.
 *
 * A numbered sequence rather than a list of uniform steps, because each one feeds the next: the
 * config context feeds the adapter, the adapter feeds better-auth. Two of those dependencies —
 * schema before adapter, adapter before better-auth — are load-bearing and invisible anywhere
 * else, which is why the order is written out.
 */
export const bootRime = async <const C extends Config>(config: BuildConfig<C>) => {
  // 1. Plugins, flattened to a name -> actions map. First because codegen and better-auth both
  //    read it (the mailer plugin supplies better-auth's transport).
  const plugins = Object.fromEntries(
    config.plugins.map((plugin) => [plugin.name, plugin.actions ?? {}])
    // Named as `BuildConfig<C>['$InferPluginsServer']`, the same way `Rime` declares it, so the
    // two agree. `typeof config.$InferPluginsServer` looks equivalent and is not: indexing the
    // built config picks up `C`'s own `$InferPluginsServer` in the intersection too.
  ) as BuildConfig<C>['$InferPluginsServer'];

  // 2. The config interface — every lookup by slug, the locale list, the raw config.
  const configCtx = createConfigContext(config);

  // 3. Upload makes sure the static directory it writes into exists.
  bootUpload(config);

  // 4. Phase 1, in dev only: write routes, schema and types. Before the adapter, which imports
  //    the schema this produces.
  if (dev) {
    const runCodegen = await import('./codegen.server.js').then((m) => m.runCodegen);
    await runCodegen({ config, generateSchema: config.$adapter.generateSchema });
  }

  // 5. The database. Consumes the schema generated in step 4.
  const adapter = await config.$adapter.createAdapter(configCtx);

  // 6. Register every prototype config with the adapter. It reads `config.type` and builds a
  //    collection handle or an area handle; `adapter.collection(slug)` and `adapter.area(slug)`
  //    serve them from then on.
  //
  //    The first step here that touches the database, deliberately: a prototype whose tables are
  //    missing fails at boot, naming itself, instead of on whichever request first reaches it.
  for (const prototypeConfig of [...config.collections, ...config.areas]) {
    adapter.registerPrototype(prototypeConfig);
  }

  // 7. An area's row has to exist before a request can read it, so `boot` writes it. A collection
  //    has none: nothing needs to be there before the first create.
  for (const areaConfig of config.areas) {
    await area.boot?.({
      config: areaConfig,
      adapter,
      defaultLocale: configCtx.getDefaultLocale()
    });
  }

  // 8. FEATURE (auth): better-auth. After the adapter, whose betterAuthAdapter it stores into.
  //    The instance is built in its own module so `RimeContext` can name its *type* without
  //    naming this one.
  const auth = createAuthInstance({ config, configCtx, mailer: plugins.mailer, adapter });

  // 9. Panel translations, for the configured language.
  i18n.init(await registerTranslation(config.panel.language));

  return { plugins, configCtx, adapter, auth };
};
