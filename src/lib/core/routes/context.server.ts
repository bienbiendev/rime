import { RIME_PANEL_ROUTE } from '$app/env/private';
import type { ResolvedPathname } from '$app/types';
import type { PrototypeSlug } from '#lib/core/prototype/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import * as routes from './util.js';

/**
 * The slug of the prototype a panel or API URL names. The URL carries its kebab, and only the
 * config can say which slug that is:
 *
 * ```
 * /api/medias-directories -> $mediasDirectories
 * ```
 *
 * A load passes its own event: SvelteKit then knows the load reads `params.slug`, and runs it
 * again when the slug changes.
 */
export function slugOf(event: Pick<RequestEvent, 'params' | 'locals'>): PrototypeSlug | undefined {
  const kebab = event.params.slug;
  if (!kebab) return undefined;
  return event.locals.rime.config.prototypes.find((p) => p.kebab === kebab)?.slug as
    PrototypeSlug | undefined;
}

/**
 * Built once per request, in `createRimeContext`. Getters, so each reads `event` when asked.
 */
export function createRoutesContext(event: RequestEvent) {
  return {
    /** The slug of the prototype the URL names. A load reads `slugOf(event)` instead. */
    get slug() {
      return slugOf(event);
    },

    /** Whether the request is under `/api`. */
    get isAPI() {
      return routes.isApiPathname(event.url.pathname);
    },

    /** Whether the route is the panel's sign-in, forgot-password or reset-password page. */
    get isPublicAuthRoute() {
      return routes.isPublicPanelAuthRoute(event.route.id);
    },

    /**
     * Whether the request is a panel page that needs a session: a route with the `[panel]` param,
     * sign-in, forgot-password and reset-password excepted. False on a URL no route matched.
     */
    get isPanel() {
      return event.params.panel !== undefined && !routes.isPublicPanelAuthRoute(event.route.id);
    },

    /** The panel's path segment, `RIME_PANEL_ROUTE`. Private: never send it to the client. */
    get panel() {
      return RIME_PANEL_ROUTE;
    },

    /**
     * A root-relative panel path, `/panel/pages/12`. Unlike `panelUrl` in `routes/util.ts`, which
     * the browser uses, this is not an absolute URL.
     */
    panelUrl(...args: string[]): ResolvedPathname {
      return routes.joinPath(RIME_PANEL_ROUTE, ...args) as ResolvedPathname;
    },

    apiUrl: routes.apiUrl,
    absolute: routes.absolute
  };
}
