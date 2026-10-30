import { page } from '$app/state';
import type { ResolvedPathname } from '$app/types';
import { SITE_URL } from '$app/env/public';
import { API_PREFIX, PANEL_PUBLIC_AUTH_ROUTE_IDS } from './constants.js';

/**
 * Joins segments into a root-relative path.
 * @example
 * joinPath('panel', 'pages', '123') // -> /panel/pages/123
 */
export function joinPath(...args: string[]): string {
  return `/${args.join('/')}`;
}

/**
 * @example
 * apiUrl('pages', '123') // -> /api/pages/123
 */
export function apiUrl(...args: string[]): string {
  return `${API_PREFIX}/${args.join('/')}`;
}

/**
 * Prefixes `SITE_URL` to a root-relative path, with or without its trailing slash.
 * @example
 * absolute('/panel') // SITE_URL https://site.com/ -> https://site.com/panel
 */
export function absolute(path: string): string {
  return `${SITE_URL.replace(/\/+$/, '')}${path}`;
}

/** `/api` and the paths under it: `/api/pages` is one, `/apiary` is not. */
export function isApiPathname(pathname: string): boolean {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

/** Whether a route id is the panel's sign-in, forgot-password or reset-password page. */
export function isPublicPanelAuthRoute(routeId: string | null): boolean {
  return !!routeId && PANEL_PUBLIC_AUTH_ROUTE_IDS.has(routeId);
}

/**
 * Panel-only, inside a component: the panel path from `page.params.panel`. Throws on a route with
 * no `[panel]` param.
 */
export function panelPath(...args: string[]): ResolvedPathname {
  if (!page.params.panel) throw new Error('panelPath called on a route without a [panel] param');
  return joinPath(page.params.panel, ...args) as ResolvedPathname;
}

/**
 * Panel-only. `panelPath` prefixed with `SITE_URL`: an absolute URL.
 */
export function panelUrl(...args: string[]): ResolvedPathname {
  return absolute(panelPath(...args)) as ResolvedPathname;
}
