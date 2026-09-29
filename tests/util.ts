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

/** The same, as a same-origin path — what the panel actually renders into an `href`. */
export function panelPath(...args: string[]) {
  return args.length ? `/${PANEL_SEGMENT}/${args.join('/')}` : `/${PANEL_SEGMENT}`;
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

/**
 * `GET /api/sse?keys=…` with Node's own fetch: Playwright's request context waits for the whole
 * body, and a stream never ends. The response is answered as soon as the headers are in.
 */
export const openStream = async (keys: string, cookie?: string) => {
  const controller = new AbortController();
  const response = await fetch(`${API_BASE_URL}/sse?keys=${encodeURIComponent(keys)}`, {
    headers: cookie ? { cookie } : {},
    signal: controller.signal
  });
  return { response, close: () => controller.abort() };
};

/** One reader over an open stream; `until` reads on from where the last call stopped. */
export const streamReader = (response: Response) => {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let received = '';
  return {
    async until(needle: string, timeoutMs = 5000) {
      const deadline = Date.now() + timeoutMs;
      while (!received.includes(needle) && Date.now() < deadline) {
        const chunk = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), deadline - Date.now())
          )
        ]);
        if (chunk.done) break;
        received += decoder.decode(chunk.value, { stream: true });
      }
      if (!received.includes(needle)) {
        throw new Error(`"${needle}" never arrived; received:\n${received}`);
      }
      return received;
    }
  };
};
