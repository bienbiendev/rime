import type { RimeAuth } from '$lib/core/auth/better-auth/instance.server.js';
import type { Config } from '$lib/core/config/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { Adapter } from './adapter.js';
import { bootRime } from './boot.server.js';
import type { ConfigContext } from './config/context.server.js';
import type { BuildConfig } from './config/index.server.js';
import { logger } from './logger.server.js';
import { areaApi, type AreaAccessor } from './prototype/area/api.server.js';
import { collectionApi, type CollectionAccessor } from './prototype/collection/api.server.js';

// Declared in core/config/context.server.ts, beside `createConfigContext`, and re-exported
// here because this is where consumers have always imported it from.
export type { ConfigContext };

/**
 * What a request gets: `event.locals.rime`.
 *
 * **Declared, not inferred, and that is the whole point of this shape.** Inferring it from
 * `createRime` would make `App.Locals['rime']` depend on everything that function transitively
 * imports; every hook is typed through `HookContext → event: RequestEvent → App.Locals`, so
 * anything in that graph typed in terms of `rime` references itself and TypeScript answers `any`
 * for every hook in the repo — silently.
 *
 * The rule to keep when adding a member: **take types from declared config phantoms, never from
 * `createRime` or `bootRime`.** `$InferPluginsServer` and `RimeAuth` are declared *about* a
 * config, so naming them costs nothing; naming a function that imports the prototype registry puts
 * every hook back in the loop.
 */
export type RimeContext<C extends Config = Config> = {
  /**
   * `rime.collection(slug)` / `rime.area(slug)`.
   *
   * **Named from each prototype's `api.server.ts`, never off its definition**, and that is a
   * correctness requirement rather than a preference. Every hook is typed through `HookContext` →
   * `event.locals.rime` → this, so reading an accessor off a definition — which carries hooks —
   * would make every hook's type depend on itself and TypeScript would answer `any` for all of
   * them. Each `api.server.ts` imports no hooks, so it cuts the loop.
   *
   * These two lines were a `PrototypeAccessors` alias in a file of its own, so that this one did
   * not name a kind. It names two, they are both core's, and the file it took them from is the
   * file it now names.
   */
  collection: CollectionAccessor;
  area: AreaAccessor;
} &
  // A consumer's own plugins, spread at the top level under their own names — `rime.myPlugin.doThing()`.
  // Comes off the config's declared phantom, so a plugin's `actions` stay typed per plugin.
  BuildConfig<C>['$InferPluginsServer'] & {
    logger: typeof logger;
    /** The Better-auth instance, carrying whatever plugins this config declared. */
    auth: RimeAuth<C>;
    /** The drizzle instance and the low-level surface. */
    adapter: Adapter;
    /** The configuration interface. */
    config: ConfigContext<C>;
    /** Overrides `event.locals.locale`. */
    setLocale(locale: string | undefined): void;
    /** The current `event.locals.locale`. */
    getLocale(): string | undefined;
  };

/** The process-wide object. One per boot; `createRimeContext` makes the per-request one above. */
export type Rime<C extends Config = Config> = {
  defineLocale(event: RequestEvent): void;
  auth: RimeAuth<C>;
  adapter: Adapter;
  config: ConfigContext<C>;
  plugins: BuildConfig<C>['$InferPluginsServer'];
  createRimeContext(event: RequestEvent): RimeContext<C>;
};

/**
 * Creates the main Rime object
 * that provides access to cms API
 */
export async function createRime<const C extends Config>(config: BuildConfig<C>): Promise<Rime<C>> {
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

  /**
   * Builds `rime.collection(slug)` / `rime.area(slug)`.
   *
   * The cast is what makes writing it out safe: these types cannot be derived from the values —
   * each accessor carries its own slug literals and document types — so they are declared, on
   * `RimeContext` above, from each prototype's `api.server.ts`. That is rule 1's boundary.
   */
  const buildAccessors = (event: RequestEvent) =>
    ({
      collection: (slug: string) =>
        collectionApi({
          config: configCtx.getCollection(slug),
          event,
          defaultLocale: configCtx.getDefaultLocale()
        }),
      area: (slug: string) =>
        areaApi({
          config: configCtx.getArea(slug),
          event,
          defaultLocale: configCtx.getDefaultLocale()
        })
    }) as Pick<RimeContext, 'collection' | 'area'>;

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

    createRimeContext(event: RequestEvent): RimeContext<C> {
      defineLocale(event);

      // The cast covers the plugin spread only. `plugins` is already `as
      // typeof config.$InferPluginsServer` where bootRime builds it — a runtime
      // `Object.fromEntries` cannot be checked against a mapped type — so re-deriving the same
      // relationship here would only restate that cast, not verify it. Every other member is
      // checked against the declaration above.
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
         * rime.adapter.collection('users').findMany({ query: { where: { id: { equals: '1' } } } })
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
         * One accessor per registered prototype, each handing back that prototype's own local
         * API for this request.
         *
         * @example
         * rime.collection('pages').find({ query: 'where[isHome][equals]=true' })
         * rime.area('settings').find()
         */
        ...buildAccessors(event)
      } as unknown as RimeContext<C>;
    }
  };
}
