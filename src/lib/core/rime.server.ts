// import type { Adapter } from '$lib/adapter-sqlite/index.server.js';
import { dev } from '$app/environment';
import type { Config } from '$lib/core/factory/config/types.js';
import devCache from '$lib/core/dev/cache/index.server.js';
import type { RegisterArea, RegisterCollection } from '$lib/index.js';
import type { RequestEvent } from '@sveltejs/kit';
import { betterAuth } from 'better-auth';
import { AreaAPI } from './local-api/area.server.js';
import { CollectionAPI } from './local-api/collection.server.js';
import { getBaseAuthConfig } from './features/auth/provider/better-auth.server.js';
import { createConfigContext } from './factory/config/context.server.js';
import type { BuildConfig } from './factory/config/index.server.js';
import validate from './factory/config/validate.server.js';
import writeMemo from './factory/config/write.server.js';
import { regenerateDrizzleConfig, regenerateHooks } from './dev/cli/init/templates.js';
import generateRoutes from './dev/generate/routes/index.server.js';
import generateTypes from './dev/generate/types/index.server.js';
import { RimeError } from './errors/index.js';
import i18n from './i18n/index.js';
import { registerTranslation } from './i18n/register.server.js';
import { logger } from './logger/index.server.js';

export type Rime<C extends Config = Config> = Awaited<ReturnType<typeof createRime<C>>>;
export type RimeContext<C extends Config = Config> = ReturnType<Rime<C>['createRimeContext']>;
export type ConfigContext<C extends Config = Config> = ReturnType<typeof createConfigContext<C>>;

/**
 * Creates the main Rime object
 * that provides access to cms API
 */
export async function createRime<const C extends Config>(config: BuildConfig<C>) {
  // Normalize plugins to a simple name->actions map
  const serverPlugins = config.$plugins;
  const plugins = Object.fromEntries(
    serverPlugins.map((plugin) => [plugin.name, plugin.actions ?? {}])
  ) as typeof config.$InferPluginsServer;

  // Creat config interface
  const configCtx = createConfigContext(config);

  // Init adapter to get the generateSchema
  const { createAdapter, generateSchema } = config.$adapter;

  // Generate schema, types, routes
  if (dev) {
    // A `rime generate` CLI run may be regenerating the same .rime cache
    // concurrently (e.g. a running dev server reloading off the CLI's file
    // writes). Skip our own generation this cycle instead of racing it or
    // blocking this request on it — the next natural reload will pick up
    // what the CLI produced.
    if (process.env.RIME_CLI !== 'true' && devCache.get('.cli')) {
      logger.debug('Skipping generation, `rime generate` is already running');
    } else {
      const changed = writeMemo(config);
      const valid = validate(config);
      if (!valid) {
        throw new RimeError('Config not valid');
      }
      if (changed) {
        generateRoutes(config);
        // Before generateSchema(): it shells out to drizzle-kit generate/migrate, which read
        // drizzle.config.ts's schema path straight off disk — stale here means the wrong (or
        // missing) schema file.
        regenerateDrizzleConfig();
        await generateSchema(config);
        await generateTypes(config);
        regenerateHooks();
      } else {
        logger.debug('Nothing to generate');
      }
    }
  }

  // Create adapter, consume the generated schema
  const adapter = await createAdapter(configCtx);

  // Create auth
  const baseAuthconfig = getBaseAuthConfig({ mailer: plugins.mailer, config: configCtx });
  type BetterAuthPlugins = typeof config.$InferAuthPlugins;
  const betterAuthPlugins = Array.isArray(config.$auth?.plugins)
    ? [...baseAuthconfig.plugins, ...(config.$auth.plugins as BetterAuthPlugins)]
    : baseAuthconfig.plugins;

  const auth = betterAuth({
    ...baseAuthconfig,
    plugins: betterAuthPlugins,
    database: adapter.auth.betterAuthAdapter
  });

  // Register translation
  // Register dictionaries for panel Language
  const dictionnaries = await registerTranslation(config.panel.language);
  i18n.init(dictionnaries);

  /**
   * Function that define the locale to use in a request event
   * based on this priority, high to low :
   * - locale inside the url ex: /en/foo
   * - locale from searchParams ex: ?locale=en
   * - locale from cookie
   * - default locale
   */
  function defineLocale(event: RequestEvent) {
    // locale present inside the url params ex : /en/foo
    const params = event.params;

    const paramLocale =
      'locale' in params &&
      typeof params.locale === 'string' &&
      configCtx.getLocalesCodes().includes(params.locale)
        ? params.locale
        : null;

    // locale present as a search param ex : ?locale=en
    const searchParams = event.url.searchParams;
    const hasParams = searchParams.toString();
    const searchParamLocale = hasParams && searchParams.get('locale');

    // locale from the cookie
    const cookieLocale = event.cookies.get('rime.locale');
    const defaultLocale = configCtx.getDefaultLocale();
    const locale = paramLocale || searchParamLocale || cookieLocale;

    if (locale && configCtx.getLocalesCodes().includes(locale)) {
      return (event.locals.locale = locale);
    }
    return (event.locals.locale = defaultLocale);
  }

  return {
    defineLocale,

    get auth() {
      return auth;
    },

    get adapter() {
      return adapter;
    },

    get config() {
      return configCtx;
    },

    get plugins() {
      return plugins;
    },

    createRimeContext(event: RequestEvent) {
      defineLocale(event);
      return {
        logger,

        ...plugins,

        /** The Better-auth instance */
        get auth() {
          return auth;
        },

        /**
         * Provides access to the drizzle instance and some
         * low level functionnalities
         *
         * @example
         * rime.adapter.db.query.pages.findFirst()
         * rime.adatpter.auth.getUserAttributes({ authUserId: '12345', slug: 'users' })
         */
        get adapter() {
          return adapter;
        },

        /**
         * The configuration interface
         *
         * @example
         * rime.config.raw // <- full config object
         * rime.config.getBySlug('posts') // <- Collection config
         * rime.config.areas // <- Areas config
         */
        get config() {
          return configCtx;
        },

        /**
         * This overrides the event.locals.locale.
         */
        setLocale(locale: string | undefined) {
          event.locals.locale = locale;
        },

        /**
         * Get the current event.locals.locale
         */
        getLocale() {
          return event.locals.locale;
        },

        /**
         * Get a collection api
         * @example
         *
         * rime.collection('pages').find({ query: 'where[isHome][equals]=true' })
         */
        collection<Slug extends keyof RegisterCollection>(slug: Slug) {
          const collectionConfig = configCtx.collections[slug];
          return new CollectionAPI<RegisterCollection[Slug]>({
            event,
            config: collectionConfig,
            defaultLocale: configCtx.getDefaultLocale()
          });
        },

        /**
         * Get an area api
         * rime.area('settings').find()
         */
        area<Slug extends keyof RegisterArea>(slug: Slug) {
          const areaConfig = configCtx.areas[slug];
          return new AreaAPI<RegisterArea[Slug]>({
            event,
            config: areaConfig,
            defaultLocale: configCtx.getDefaultLocale()
          });
        }
      };
    }
  } as const;
}
