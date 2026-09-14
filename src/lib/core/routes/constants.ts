/**
 * Route identity, shared by client and server. Route ids carry the literal folder names, never
 * the configured `RIME_PANEL_ROUTE` segment, so comparing them cannot leak the panel's location.
 */

/** Pathname prefix every rime endpoint sits under. */
export const API_PREFIX = '/api';

export const PANEL_ROUTE_ID = '/(rime)/[panel=panel]';
export const PANEL_SIGN_IN_ROUTE_ID = `${PANEL_ROUTE_ID}/sign-in`;
export const PANEL_FORGOT_PASSWORD_ROUTE_ID = `${PANEL_ROUTE_ID}/forgot-password`;
export const PANEL_RESET_PASSWORD_ROUTE_ID = `${PANEL_ROUTE_ID}/reset-password`;

/** Must stay reachable without a session — a locked-out visitor still needs these. */
export const PANEL_PUBLIC_AUTH_ROUTE_IDS = new Set([
  PANEL_SIGN_IN_ROUTE_ID,
  PANEL_FORGOT_PASSWORD_ROUTE_ID,
  PANEL_RESET_PASSWORD_ROUTE_ID
]);
