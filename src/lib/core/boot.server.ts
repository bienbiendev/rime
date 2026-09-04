import { dev } from '$app/environment';
import type { Config } from '$lib/core/config/types.js';
import { createConfigContext } from './config/context.server.js';
import type { BuildConfig } from './config/index.server.js';
import { createAuthInstance } from './features/auth/better-auth/instance.server.js';
import { bootFeatures } from './features/registry.js';
// The **server** registry, and it has to be: the isomorphic one resolves to each definition's
// client half, which carries `singleton` and `features` but no `boot` — so an area's row was
// never created and every area read 404'd. `boot` is server-only by nature; the config factory is
// the side that legitimately reads the isomorphic registry, for `features` alone.
import { prototypes } from './prototype/registry.server.js';
import i18n from './i18n/index.js';
import { registerTranslation } from './i18n/register.server.js';

/**
 * Phase 2 of three — everything that happens once, when the process starts.
 *
 * The boot equivalent of pipeline.server.ts. It cannot be a flat array of steps the way the
 * hook pipeline is, because boot is a chain with data flow rather than a chain of uniform
 * transforms: the config context feeds the adapter, the adapter feeds better-auth. So it is a
 * numbered sequence instead — the same shape as runUpdate in operations/run.server.ts.
 *
 * The steps stay written out here rather than collected from a registry for the reason
 * pipeline.server.ts is not a loop: order is the interesting part, and two of these
 * dependencies (schema-before-adapter, adapter-before-auth) are load-bearing and invisible
 * anywhere else.
 *
 * Two of the steps belong to features rather than to core, and are declared as their `boot`
 * hooks: upload makes sure the static directory it writes into exists (step 3), and better-auth's
 * construction is the auth feature's.
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

  // 3. Every feature's boot step, in registry order — upload makes sure the static directory it
  //    writes into exists. By feature rather than by function, so boot never knows what any one
  //    of them needs.
  await bootFeatures(prototypes, config);

  // 4. Phase 1, in dev only: write routes, schema and types. Before the adapter, which imports
  //    the schema this produces.
  if (dev) {
    const runCodegen = await import('./codegen.server.js').then((m) => m.runCodegen);
    await runCodegen({ config, generateSchema: config.$adapter.generateSchema });
  }

  // 5. The database. Consumes the schema generated in step 4.
  const adapter = await config.$adapter.createAdapter(configCtx);

  // 6. Register every prototype with the adapter, then run each one's boot hook.
  //
  //    Registration is what lets the adapter stop knowing about kinds: it is handed each
  //    prototype once, with the single shape fact it needs (`singleton` — how many rows, not
  //    what kind), and resolves that prototype's tables there. `adapter.prototype(slug)` serves
  //    it from then on.
  //
  //    This is also the first step here that touches the database, deliberately: a prototype
  //    whose tables are missing now fails at boot, naming itself, instead of on whichever
  //    request first happened to reach it.
  for (const prototype of prototypes) {
    for (const prototypeConfig of configCtx.byPrototype(prototype.name)) {
      adapter.registerPrototype({ config: prototypeConfig, singleton: prototype.singleton });
    }
  }

  for (const prototype of prototypes) {
    if (!prototype.boot) continue;
    for (const prototypeConfig of configCtx.byPrototype(prototype.name)) {
      await prototype.boot({
        config: prototypeConfig,
        adapter,
        defaultLocale: configCtx.getDefaultLocale()
      });
    }
  }

  // 7. FEATURE (auth): better-auth. After the adapter, whose betterAuthAdapter it stores into.
  //    The instance is built in its own module so `RimeContext` can name its *type* without
  //    naming this one — bootRime imports the prototype registry, and RimeContext must not.
  const auth = createAuthInstance({ config, configCtx, mailer: plugins.mailer, adapter });

  // 8. Panel translations, for the configured language.
  i18n.init(await registerTranslation(config.panel.language));

  return { plugins, configCtx, adapter, auth };
};
