import type { Adapter } from '#lib/core/adapter.js';
import type { MailerActions } from '#lib/core/plugins/mailer/index.server.js';
import type { Config } from '#lib/types.js';
import { betterAuth } from 'better-auth';
import type { ConfigContext } from '#lib/core/config/context.server.js';
import type { BuildConfig } from '#lib/core/config/index.server.js';
import { getBaseAuthConfig } from './config.server.js';

/**
 * Builds the better-auth instance for a config. Its inferred type, `RimeAuth`, carries the
 * plugins from `config.$auth.plugins`.
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
