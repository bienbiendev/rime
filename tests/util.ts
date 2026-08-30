import type { APIRequestContext } from '@playwright/test';

export const BASE_URL = process.env.PUBLIC_RIME_URL;
export const API_BASE_URL = `${BASE_URL}/api`;

// The panel's URL segment, configurable via RIME_PANEL_ROUTE so the CLI's `rime init` (see
// local-pack-test.sh) can exercise a non-default value end to end. Safe to interpolate
// directly into a string or RegExp: rime's own validation (isValidSlug in
// core/dev/constants.ts) rejects anything but [a-zA-Z][a-zA-Z0-9_-]*, so it can never
// contain a path separator or regex metacharacter.
export const PANEL_SEGMENT = process.env.RIME_PANEL_ROUTE || 'panel';

export function panelUrl(...args: string[]) {
  return args.length
    ? `${BASE_URL}/${PANEL_SEGMENT}/${args.join('/')}`
    : `${BASE_URL}/${PANEL_SEGMENT}`;
}

/** Matches the URL a create action redirects to for a document in the given collection,
 * e.g. panelUrlRe('pages') matches `/panel/pages/abc123` but not `/panel/pages/create`. */
export function panelUrlRe(collection: string): RegExp {
  return new RegExp(`/${PANEL_SEGMENT}/${collection}/(?!create$)[^/]+$`);
}

export const signIn = (email: string, password: string) => {
  return async (request: APIRequestContext) => {
    const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
      data: {
        email,
        password
      }
    });
    const setCookie = response.headers()['set-cookie'];
    const [name, cookie] = setCookie.split('=');
    return {
      cookie: `${name}=${cookie}`
    };
  };
};
