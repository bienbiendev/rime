import type { Config } from '$lib/core/factory/config/types.js';
import type { RegisterArea, RegisterCollection } from '$lib/index.js';
import type { RequestEvent } from '@sveltejs/kit';
import { bootRime } from '../boot.server.js';
import type { createConfigContext } from '../factory/config/context.server.js';
import type { BuildConfig } from '../factory/config/index.server.js';
import { logger } from '../logger.server.js';
import { AreaAPI } from './local-api-area.server.js';
import { CollectionAPI } from './local-api-collection.server.js';

export type Rime<C extends Config = Config> = Awaited<ReturnType<typeof createRime<C>>>;
export type RimeContext<C extends Config = Config> = ReturnType<Rime<C>['createRimeContext']>;
export type ConfigContext<C extends Config = Config> = ReturnType<typeof createConfigContext<C>>;

/**
 * Creates the main Rime object
 * that provides access to cms API
 */
export async function createRime<const C extends Config>(config: BuildConfig<C>) {
  // Phases 1 and 2 — codegen (dev only) then boot, in that order, written out in
  // boot.server.ts. Everything below is phase 3: what a request gets.
  const { plugins, configCtx, adapter, auth } = await bootRime(config);

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
