import type { Adapter } from '$lib/core/adapter/types.js';
import type { MailerActions } from '$lib/core/plugins/mailer/module.server.js';
import type { Config } from '$lib/types.js';
import { betterAuth } from 'better-auth';
import type { ConfigContext } from '../../../factory/config/context.server.js';
import type { BuildConfig } from '../../../factory/config/index.server.js';
import { getBaseAuthConfig } from './config.server.js';

/**
 * Builds the better-auth instance for a config.
 *
 * Extracted from `bootRime` so its *type* can be named without naming `bootRime`. `RimeContext`
 * declares `auth`, and `bootRime` imports the prototype registry — so referring to
 * `ReturnType<typeof bootRime>` for it would put every prototype definition, and therefore every
 * hook, back into the type graph of `event.locals.rime`. That is the loop this whole change
 * exists to cut. This module imports no registry and no prototype.
 *
 * The inference is the point of extracting it rather than widening it: a consumer's own
 * better-auth plugins come from `config.$auth.plugins`, and `auth` has to keep carrying them so
 * `rime.auth` is typed against the plugins that config actually declared.
 */
export const createAuthInstance = <const C extends Config>(args: {
  config: BuildConfig<C>;
  configCtx: ConfigContext<C>;
  mailer: MailerActions | undefined;
  adapter: Adapter;
}) => {
  const { config, configCtx, mailer, adapter } = args;
  const baseAuthConfig = getBaseAuthConfig({ mailer, config: configCtx });

  return betterAuth({
    ...baseAuthConfig,
    plugins: Array.isArray(config.$auth?.plugins)
      ? [...baseAuthConfig.plugins, ...(config.$auth.plugins as typeof config.$InferAuthPlugins)]
      : baseAuthConfig.plugins,
    database: adapter.auth.betterAuthAdapter
  });
};

/** The better-auth instance as this config produces it, plugins and all. */
export type RimeAuth<C extends Config = Config> = ReturnType<typeof createAuthInstance<C>>;
