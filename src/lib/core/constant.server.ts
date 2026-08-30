import path from 'path';

export const PACKAGE_NAME = 'rimecms';
export const RIME_DEV_CACHE_DIR = path.resolve(process.cwd(), 'node_modules', '.rime');

/** Consumer branding image convention: drop a file at static/panel/panel.jpg. Independent
 * of RIME_PANEL_ROUTE — a static asset path, not the app's hideable route. */
export const PANEL_AUTH_IMAGE = '/assets/panel/panel.jpg';

/** The folder name never changes — only src/params/panel.ts's matcher does. Route ids
 * never carry the resolved segment, so comparing event.route.id can't leak the secret. */
export const PANEL_ROUTE_ID = '/(rime)/[panel=panel]';
export const PANEL_SIGN_IN_ROUTE_ID = `${PANEL_ROUTE_ID}/sign-in`;
export const PANEL_FORGOT_PASSWORD_ROUTE_ID = `${PANEL_ROUTE_ID}/forgot-password`;
export const PANEL_RESET_PASSWORD_ROUTE_ID = `${PANEL_ROUTE_ID}/reset-password`;

/** Must stay reachable without a session — a locked-out visitor still needs these. */
const PANEL_PUBLIC_AUTH_ROUTE_IDS = new Set([
  PANEL_SIGN_IN_ROUTE_ID,
  PANEL_FORGOT_PASSWORD_ROUTE_ID,
  PANEL_RESET_PASSWORD_ROUTE_ID
]);

export function isPublicPanelAuthRoute(routeId: string | null): boolean {
  return !!routeId && PANEL_PUBLIC_AUTH_ROUTE_IDS.has(routeId);
}
