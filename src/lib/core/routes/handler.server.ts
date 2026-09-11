import { area } from '$lib/core/prototype/area/definition.server.js';
import { collection } from '$lib/core/prototype/collection/definition.server.js';
import buildNavigation from '$lib/core/routes/panel-navigation.js';
import { areaFormActions } from '$lib/panel/pages/area/actions.server.js';
import { areaLoad } from '$lib/panel/pages/area/load.server.js';
import { forgotPasswordLoad } from '$lib/panel/pages/auth/forgot-password/load.server.js';
import { resetPasswordLoad } from '$lib/panel/pages/auth/reset-password/load.server.js';
import { signInActions } from '$lib/panel/pages/auth/sign-in/actions.server.js';
import { signInLoad } from '$lib/panel/pages/auth/sign-in/load.server.js';
import { collectionFormActions } from '$lib/panel/pages/collection-document/actions.server.js';
import { documentLoad } from '$lib/panel/pages/collection-document/load.server.js';
import { collectionLoad } from '$lib/panel/pages/collection/load.server.js';
import { dashboardLoad } from '$lib/panel/pages/dashboard/load.server.js';
import { liveLoad } from '$lib/panel/pages/live/load.server.js';
import { checkLiveRedirect } from '$lib/panel/util/live.server.js';
import { type Handle, type RequestEvent, type ServerLoadEvent } from '@sveltejs/kit';
import type { RouteConfig } from '../config/types.js';
import { ERROR_CONTEXT, handleError } from '../errors/handler.server.js';
import { RimeError } from '../errors/index.js';

/** Every prototype's declared REST routes, by prototype name then by sub-path. */
const restRoutes: Record<string, Record<string, RouteConfig>> = {
  collection: collection.rest ?? {},
  area: area.rest ?? {}
};

/**
 * What the generated `/panel/[slug]/...` and `/api/[slug]/...` routes call.
 *
 * Each generated file passes `event` straight through and imports nothing — slug and id are real
 * route params, and the matchers under `src/params/` have already sorted out which prototype the
 * URL names.
 *
 * Lives here rather than on `rime.server.ts`, because these handlers read `event.locals.rime`.
 * Naming them there would make `RimeContext` depend on its own type.
 */
export const routeHandlers = {
  checkLiveRedirect,

  panel: {
    load: {
      collection: collectionLoad,
      document: documentLoad,
      documentVersions: (event: ServerLoadEvent) => documentLoad(event, true),
      area: areaLoad,
      areaVersions: (event: ServerLoadEvent) => areaLoad(event, true),
      dashboard: dashboardLoad,
      live: liveLoad,
      signIn: signInLoad,
      forgotPassword: forgotPasswordLoad,
      resetPassword: resetPasswordLoad
    },
    actions: {
      document: collectionFormActions,
      area: areaFormActions,
      signIn: signInActions.default as (event: RequestEvent) => any
    }
  },

  /**
   * Finds the handler a prototype declared for this sub-path and method.
   *
   * Takes the prototype name and sub-path as strings, so a generated route file names its own
   * and needs no types of its own. A prototype gets an endpoint by declaring it, nothing else.
   */
  rest: (name: string, path: string, event: RequestEvent) => {
    const handler = restRoutes[name]?.[path]?.[event.request.method as keyof RouteConfig];

    // Unreachable while the generated routes match the config — SvelteKit answers an undeclared
    // method with its own 405 first. Here so a route left behind by a config change 404s
    // instead of throwing.
    if (!handler) {
      return handleError(new RimeError(RimeError.NOT_FOUND), { context: ERROR_CONTEXT.API });
    }

    return handler(event);
  }
};

export const handleRoutes: Handle = async ({ event, resolve }) => {
  const { rime } = event.locals;
  const { isAPI, isPanel } = rime.routes;

  // The URL carries a kebab slug, the config carries a camelCase one:
  //
  //   /api/medias-directories -> $mediasDirectories
  //
  // Swapped once here so every panel load, action and REST handler reads `event.params.slug` and
  // compares it to `config.slug` directly. Only on rime's own routes: a front-end route may have
  // a `slug` param too, and that one is none of our business.
  if ((isAPI || isPanel) && event.params.slug) {
    // Found in the config rather than converted back. `medias-directories` is what both
    // `$mediasDirectories` and a collection named `mediasDirectories` kebab to, so the URL alone
    // cannot say which one it means — only the config can.
    //
    // The route matchers are generated from these same kebabs, so a request that got this far
    // always finds its prototype.
    const kebab = event.params.slug;
    const prototype = rime.config.prototypes.find((p) => p.kebab === kebab);
    if (prototype) event.params.slug = prototype.slug;
  }

  // The panel sidebar, rebuilt on every page load.
  if (isPanel && event.request.method === 'GET') {
    event.locals.navigation = buildNavigation(rime.config.raw, event);
  }

  event.locals.routes = routeHandlers;

  // Routes declared by a config or a plugin, each keyed by its full pathname.
  const routes =
    '$routes' in rime.config.raw ? (rime.config.raw.$routes as Record<string, any>) : null;

  if (routes && event.url.pathname in routes) {
    const route = routes[event.url.pathname];
    type RequestMethod = 'POST' | 'GET' | 'PATCH' | 'DELETE';
    const method: RequestMethod = event.request.method as RequestMethod;
    if (method in route && !!route[method]) {
      return route[method](event);
    }
  }

  return resolve(event);
};

export type RouteHandlers = typeof routeHandlers;
