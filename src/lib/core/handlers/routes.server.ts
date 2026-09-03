import { isPublicPanelAuthRoute } from '$lib/core/constants.server.js';
import buildNavigation from '$lib/panel/navigation.js';
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
import { ERROR_CONTEXT, handleError } from '../errors/handler.server.js';
import { RimeError } from '../errors/index.js';
import type { RouteConfig } from '../config/types.js';
import { prototypes } from '../prototype/registry.server.js';

/** Every prototype's declared REST routes, by prototype name then by sub-path. */
const restRoutes: Record<string, Record<string, RouteConfig>> = Object.fromEntries(
  prototypes.map((prototype) => [prototype.name, prototype.rest ?? {}])
);

/**
 * Backs the fixed set of generated /panel/[slug=<prototype>]/... and
 * /api/[slug=<prototype>]/... routes — each of these reads slug/id off
 * event.params itself (a real dynamic route param), so the generated file
 * just passes event straight through, no import needed. The per-prototype
 * param matchers under src/params/ already disambiguate one prototype from
 * another at the router level, so a generated route names only its own
 * prototype and sub-path and needs no runtime kind branching — see `rest`
 * below. Deliberately lives outside rime.server.ts: app authors never touch
 * this, and importing these panel/api wrappers there would make
 * RimeContext's inferred type depend on functions that read
 * event.locals.rime — i.e. on itself.
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
   * Dispatches one generated /api route to the handler its prototype declared for that
   * sub-path and method — the same resolution the `$routes` branch of handleRoutes below does
   * for plugin and config routes, over the same `RouteConfig` shape.
   *
   * By name and path rather than as a nested object the generated files index into: it keeps
   * those files free of any per-prototype typing, and it is the reason a prototype can add an
   * endpoint by declaring it and nothing else.
   */
  rest: (name: string, path: string, event: RequestEvent) => {
    const handler = restRoutes[name]?.[path]?.[event.request.method as keyof RouteConfig];

    // Unreachable while the generated routes are current: codegen exports only the methods a
    // prototype declares, so SvelteKit answers an undeclared one with its own 405 before this
    // runs. Here so a route left behind by a config change 404s rather than throwing.
    if (!handler) {
      return handleError(new RimeError(RimeError.NOT_FOUND), { context: ERROR_CONTEXT.API });
    }

    return handler(event);
  }
};

export const handleRoutes: Handle = async ({ event, resolve }) => {
  const { rime, user } = event.locals;

  const IS_PUBLIC_AUTH_ROUTE = isPublicPanelAuthRoute(event.route.id);
  const IS_API_ROUTE = event.url.pathname.startsWith('/api');
  const IS_PANEL_ROUTE = event.params.panel !== undefined && !IS_PUBLIC_AUTH_ROUTE;

  // event.params.slug comes straight from the URL, always kebab-case (see the
  // generated src/params/<prototype>.ts matchers). Prototype slugs themselves
  // are camelCase, so rewrite once here — every downstream handler (panel
  // load/actions, REST) can then keep comparing event.params.slug directly
  // against the config's `slug`. Scoped to routes actually matched via our
  // own [slug=<prototype>] param matchers (route.id carries the matcher
  // name) — a consumer's own app route can also use a `slug` param
  // (e.g. (front)/pages/[slug]) and must be left untouched.

  if ((IS_API_ROUTE || IS_PANEL_ROUTE) && event.params.slug) {
    // A lookup, not an inverse transform: `medias-directories` is indistinguishable by rule
    // from a user collection named `mediasDirectories`, so only the config can say which
    // prototype a URL segment names. The param matchers are generated from these same kebabs,
    // so a match here is guaranteed for any route that reached this branch.
    const kebab = event.params.slug;
    const prototype = rime.config.prototypes.find((p) => p.kebab === kebab);
    if (prototype) event.params.slug = prototype.slug;
  }

  // build panel navigation
  if (IS_PANEL_ROUTE && event.request.method === 'GET') {
    event.locals.navigation = buildNavigation(rime.config.raw, user, event.params.panel);
  }

  event.locals.routes = routeHandlers;

  // Handle custom routes from config and plugins
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
