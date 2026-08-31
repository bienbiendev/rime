import { dev } from '$app/environment';
import type { Config } from '$lib/core/factory/config/types.js';
import { betterAuth } from 'better-auth';
import { runCodegen } from './codegen.server.js';
import { createConfigContext } from './factory/config/context.server.js';
import type { BuildConfig } from './factory/config/index.server.js';
import { getBaseAuthConfig } from './features/auth/better-auth/config.server.js';
import { upload } from './features/upload/index.server.js';
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
 * Two steps below used to be invisible, and are named here for the first time:
 *
 * - `ensureMedias` is the **upload feature's** boot hook. It ran as a side effect of
 *   createConfigContext, so building a config object created directories on disk.
 * - better-auth's construction is the **auth feature's** boot hook. It was inlined mid-function
 *   in createRime.
 *
 * Both belong to features, and neither had anywhere to be declared. They are the concrete case
 * for a Feature contract with a `boot` hook — see docs/structure-audit.md §14.1.
 */
export const bootRime = async <const C extends Config>(config: BuildConfig<C>) => {
  // 1. Plugins, flattened to a name -> actions map. First because codegen and better-auth both
  //    read it (the mailer plugin supplies better-auth's transport).
  const plugins = Object.fromEntries(
    config.$plugins.map((plugin) => [plugin.name, plugin.actions ?? {}])
  ) as typeof config.$InferPluginsServer;

  // 2. The config interface — every lookup by slug, the locale list, the raw config.
  const configCtx = createConfigContext(config);

  // 3. FEATURE (upload): make sure the static directories the upload feature writes into exist.
  //    Declared by the feature (features/upload/index.server.ts), placed here — a feature says
  //    what it needs at boot, this file says when it happens.
  await upload.boot(config);

  // 4. Phase 1, in dev only: write routes, schema and types. Before the adapter, which imports
  //    the schema this produces.
  if (dev) {
    await runCodegen({ config, generateSchema: config.$adapter.generateSchema });
  }

  // 5. The database. Consumes the schema generated in step 4.
  const adapter = await config.$adapter.createAdapter(configCtx);

  // 6. FEATURE (auth): better-auth. After the adapter, whose betterAuthAdapter it stores into.
  const baseAuthConfig = getBaseAuthConfig({ mailer: plugins.mailer, config: configCtx });
  const auth = betterAuth({
    ...baseAuthConfig,
    plugins: Array.isArray(config.$auth?.plugins)
      ? [...baseAuthConfig.plugins, ...(config.$auth.plugins as typeof config.$InferAuthPlugins)]
      : baseAuthConfig.plugins,
    database: adapter.auth.betterAuthAdapter
  });

  // 7. Panel translations, for the configured language.
  i18n.init(await registerTranslation(config.panel.language));

  return { plugins, configCtx, adapter, auth };
};
