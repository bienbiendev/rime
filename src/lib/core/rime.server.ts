import type { RimeAuth } from '#lib/core/auth/better-auth/instance.server.js';
import type { Config } from '#lib/core/config/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { Adapter } from './adapter.js';
import { bootRime } from './boot.server.js';
import type { ConfigContext } from './config/context.server.js';
import type { BuildConfig } from './config/index.server.js';
import { knownLocale, requestLocale } from './locale/request.server.js';
import { logger } from './logger.server.js';
import { areaApi, type AreaAccessor } from './prototype/area/api.server.js';
import { collectionApi, type CollectionAccessor } from './prototype/collection/api.server.js';
import { createRoutesContext } from './routes/context.server.js';

// Declared in core/config/context.server.ts, beside `createConfigContext`; consumers import it
// from here.
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
   * Named from each prototype's `api.server.ts`, never off its definition (see `RimeContext`):
   * each `api.server.ts` imports no hooks.
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
    /** The database adapter: per-prototype handles and the low-level surface. */
    adapter: Adapter;
    /** The configuration interface. */
    config: ConfigContext<C>;
    /** What this request knows about its own route. */
    routes: ReturnType<typeof createRoutesContext>;
    /** Sets `event.locals.locale`. A code the config does not list sets the default locale. */
    setLocale(locale: string | undefined): void;
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

  /** Sets `event.locals.locale` from what the request's surface names (see `requestLocale`). */
  function defineLocale(event: RequestEvent) {
    event.locals.locale = requestLocale(event, configCtx);
  }

  /**
   * Builds `rime.collection(slug)` / `rime.area(slug)`.
   *
   * The cast is what makes writing it out safe: these types cannot be derived from the values —
   * each accessor carries its own slug literals and document types — so they are declared, on
   * `RimeContext` above, from each prototype's `api.server.ts`. See the rule on `RimeContext`.
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

      // `as unknown as`: `plugins` is a runtime `Object.fromEntries`, cast to
      // `BuildConfig<C>['$InferPluginsServer']` in bootRime, so this object is not checked
      // against `RimeContext`.
      return {
        logger,
        ...plugins,

        /** The Better-auth instance */
        get auth() {
          return auth;
        },

        /**
         * The database adapter's low-level surface.
         *
         * @example
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
         * Route facts for this request — which surface it is on, and the paths that go with it.
         *
         * @example
         * rime.routes.isAPI
         * rime.routes.panelUrl('pages', id)
         */
        routes: createRoutesContext(event),

        /** Sets `event.locals.locale`. A code the config does not list sets the default locale. */
        setLocale(locale: string | undefined) {
          event.locals.locale = knownLocale(configCtx, locale);
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
