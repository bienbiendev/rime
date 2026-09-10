import { dev } from '$app/environment';
import { bootUpload } from '$rime/modules';
import type { Config } from '$lib/core/config/types.js';
import { createConfigContext } from './config/context.server.js';
import type { BuildConfig } from './config/index.server.js';
import { createAuthInstance } from '$lib/core/auth/better-auth/instance.server.js';
// The **server** halves, and it has to be: the isomorphic ones carry `singleton` and `features`
// but no `boot` — so an area's row was never created and every area read 404'd. `boot` is
// server-only by nature; the config factory is the side that legitimately reads the isomorphic
// halves, for `features` alone.
import { area } from './prototype/area/definition.server.js';
import { collection } from './prototype/collection/definition.server.js';
import type { BuiltPrototype, PrototypeDefinition } from './prototype/define.js';
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

  // 3. Upload makes sure the static directory it writes into exists. The only boot step any
  //    feature has ever had, reached through a `FeatureDefinition.boot` seam and a fold over ten
  //    features. `undefined` on a client build, where nothing boots.
  await bootUpload?.(config);

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
  //
  //    Written out per prototype rather than folded over a registry: what a prototype is called
  //    and where its configs are authored are two things core does know, and reading them off a
  //    registry only hid which was which.
  //
  //    Registration takes the config and nothing else: the adapter reads `config.type` and builds
  //    a collection handle or an area handle. It used to be told `singleton`, which is the same
  //    fact under a name the adapter was not allowed to use.
  //
  //    `registered` is annotated, not inferred. A definition is written against its own config
  //    kind — area's `boot` takes a `BuiltArea` — so the two entries have conflicting `slug` types
  //    and an inferred literal reduces the pair to `never`. Sound for the reason it always was:
  //    each definition is only ever handed configs of the kind it is registered under.
  const registered: { prototype: PrototypeDefinition; configs: BuiltPrototype[] }[] = [
    { prototype: collection as PrototypeDefinition, configs: config.collections },
    { prototype: area as PrototypeDefinition, configs: config.areas }
  ];

  for (const prototypeConfig of [...config.collections, ...config.areas]) {
    adapter.registerPrototype({
      config: prototypeConfig,
      // Where this config's content lives, stated by `augmentVersions` rather than worked out by
      // the adapter from the slug. `undefined` for a config nothing deviates.
      versions: prototypeConfig._versions
    });
  }

  for (const { prototype, configs } of registered) {
    if (!prototype.boot) continue;
    for (const prototypeConfig of configs) {
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
