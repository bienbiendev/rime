import type { ResolvedPathname } from '$app/types';
import type { RequestEvent } from '@sveltejs/kit';
import { PANEL_ROUTE } from './constants.server.js';
import * as routes from './util.js';

/**
 * Built once per request, in `createRimeContext`.
 *
 * Getters, not values — `handleRoutes` rewrites `event.params.slug`, so these read `event` when
 * asked.
 */
export function createRoutesContext(event: RequestEvent) {
  return {
    get isAPI() {
      return routes.isApiPathname(event.url.pathname);
    },

    get isPublicAuthRoute() {
      return routes.isPublicPanelAuthRoute(event.route.id);
    },

    get isPanel() {
      return event.params.panel !== undefined && !routes.isPublicPanelAuthRoute(event.route.id);
    },

    get panel() {
      return PANEL_ROUTE;
    },

    panelUrl(...args: string[]): ResolvedPathname {
      return routes.joinPath(PANEL_ROUTE, ...args) as ResolvedPathname;
    },

    apiUrl: routes.apiUrl,
    absolute: routes.absolute
  };
}
