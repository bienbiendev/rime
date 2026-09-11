import { page } from '$app/state';
import type { ResolvedPathname } from '$app/types';
import { env } from '$env/dynamic/public';
import { API_PREFIX, PANEL_PUBLIC_AUTH_ROUTE_IDS } from './constants.js';

/**
 * Joins segments into a root-relative path.
 * @example
 * joinPath('panel', 'pages', '123') // -> /panel/pages/123
 */
export function joinPath(...args: string[]): string {
  if (!Array.isArray(args)) return '/';
  return `/${args.join('/')}`;
}

/**
 * @example
 * apiUrl('pages', '123') // -> /api/pages/123
 */
export function apiUrl(...args: string[]): string {
  return `${API_PREFIX}/${args.join('/')}`;
}

/** Prefixes the configured site origin. For links that leave the app: emails, CORS, `_live`. */
export function absolute(path: string): string {
  return `${env.PUBLIC_RIME_URL}${path}`;
}

export function isApiPathname(pathname: string): boolean {
  return pathname.startsWith(API_PREFIX);
}

export function isPublicPanelAuthRoute(routeId: string | null): boolean {
  return !!routeId && PANEL_PUBLIC_AUTH_ROUTE_IDS.has(routeId);
}

/**
 * Panel-only. Reads `page.params.panel`, which is undefined server-side
 */
export function panelPath(...args: string[]): ResolvedPathname {
  return joinPath(page.params.panel, ...args) as ResolvedPathname;
}

/**
 * Panel-only. Reads `page.params.panel`, which is undefined server-side
 */
export function panelUrl(...args: string[]): ResolvedPathname {
  return absolute(panelPath(...args)) as ResolvedPathname;
}
