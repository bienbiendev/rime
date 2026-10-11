import { area } from '#lib/core/prototype/area/definition.server.js';
import { collection } from '#lib/core/prototype/collection/definition.server.js';
import buildNavigation from '#lib/core/routes/panel-navigation.js';
import { areaFormActions } from '#lib/panel/pages/area/actions.server.js';
import { areaLoad } from '#lib/panel/pages/area/load.server.js';
import { forgotPasswordLoad } from '#lib/panel/pages/auth/forgot-password/load.server.js';
import { resetPasswordLoad } from '#lib/panel/pages/auth/reset-password/load.server.js';
import { signInActions } from '#lib/panel/pages/auth/sign-in/actions.server.js';
import { signInLoad } from '#lib/panel/pages/auth/sign-in/load.server.js';
import { collectionFormActions } from '#lib/panel/pages/collection-document/actions.server.js';
import { documentLoad } from '#lib/panel/pages/collection-document/load.server.js';
import { collectionLoad } from '#lib/panel/pages/collection/load.server.js';
import { dashboardLoad } from '#lib/panel/pages/dashboard/load.server.js';
import { liveLoad } from '#lib/panel/pages/live/load.server.js';
import { checkLiveRedirect } from '#lib/panel/util/live.server.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import type { RouteConfig } from '../config/types.js';
import { RimeError } from '../errors/index.js';

/** The method a handler answers: SvelteKit serves `HEAD` with the `GET` handler. */
const handlerMethod = (event: RequestEvent) =>
  (event.request.method === 'HEAD' ? 'GET' : event.request.method) as keyof RouteConfig;

/** Every prototype's declared REST routes, by prototype name then by sub-path. */
const restRoutes: Record<string, Record<string, RouteConfig>> = {
  collection: collection.rest ?? {},
  area: area.rest ?? {}
};

/**
 * What the generated `/panel/[slug]/...` and `/api/[slug]/...` routes call.
 *
 * Each generated file passes `event` straight through and imports nothing — slug and id are real
 * route params, and the matchers rime generates into `+rime.generated/params.ts`, which the app's
 * `src/params.ts` spreads, have already sorted out which prototype the URL names.
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
      area: areaLoad,
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
    const handler = restRoutes[name]?.[path]?.[handlerMethod(event)];

    // Unreachable while the generated routes match the config — SvelteKit answers an undeclared
    // method with its own 405 first. Here so a route left behind by a config change 404s
    // instead of throwing.
    if (!handler) throw new RimeError(RimeError.NOT_FOUND);

    return handler(event);
  }
};

export const handleRoutes: Handle = async ({ event, resolve }) => {
  const { rime } = event.locals;
  const { isPanel } = rime.routes;

  // The panel sidebar, rebuilt on every page load.
  if (isPanel && event.request.method === 'GET') {
    event.locals.navigation = buildNavigation(rime.config.raw, event);
  }

  event.locals.routes = routeHandlers;

  // Routes declared by a config or a plugin, each keyed by its full pathname.
  const routes =
    '$routes' in rime.config.raw
      ? (rime.config.raw.$routes as Record<string, RouteConfig>)
      : undefined;
  const handler = routes?.[event.url.pathname]?.[handlerMethod(event)];
  if (handler) return handler(event);

  return resolve(event);
};

export type RouteHandlers = typeof routeHandlers;
