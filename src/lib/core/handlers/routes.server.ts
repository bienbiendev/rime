import { isPublicPanelAuthRoute } from '$lib/core/constant.server.js';
import { prototypeKebabToSlug } from '$lib/core/naming.js';
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
import { rest as areaRest } from '../areas/rest/index.server.js';
import { rest as collectionRest } from '../collections/rest/index.server.js';

/**
 * Backs the fixed set of generated /panel/[slug=collection|area]/... and
 * /api/[slug=collection|area]/... routes — each of these reads slug/id off
 * event.params itself (a real dynamic route param), so the generated file
 * just passes event straight through, no import needed. The param matchers
 * (src/params/collection.ts, area.ts) already disambiguate collection vs
 * area at the router level, so rest.collection/rest.area need no runtime
 * isArea/id branching — each generated route calls the one method that
 * matches its own folder. Deliberately lives outside rime.server.ts: app
 * authors never touch this, and importing these panel/api wrappers there
 * would make RimeContext's inferred type depend on functions that read
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

  rest: {
    collection: collectionRest,
    area: areaRest
  }
};

export const handleRoutes: Handle = async ({ event, resolve }) => {
  const { rime, user } = event.locals;

  const IS_PUBLIC_AUTH_ROUTE = isPublicPanelAuthRoute(event.route.id);
  const IS_API_ROUTE = event.url.pathname.startsWith('/api');
  const IS_PANEL_ROUTE = event.params.panel !== undefined && !IS_PUBLIC_AUTH_ROUTE;

  // event.params.slug comes straight from the URL, always kebab-case (see
  // src/params/collection.ts, area.ts). Collection/area slugs themselves are
  // camelCase, so rewrite once here — every downstream handler (panel
  // load/actions, REST) can then keep comparing event.params.slug directly
  // against the config's `slug`. Scoped to routes actually matched via our
  // own [slug=collection]/[slug=area] param matchers (route.id carries the
  // matcher name) — a consumer's own app route can also use a `slug` param
  // (e.g. (front)/pages/[slug]) and must be left untouched.

  if ((IS_API_ROUTE || IS_PANEL_ROUTE) && event.params.slug) {
    event.params.slug = prototypeKebabToSlug(event.params.slug);
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
