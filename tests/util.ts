import type { APIRequestContext, Page } from '@playwright/test';
import { loadEnv } from 'vite';

/** The repo's environment, read the way the dev server reads it, the shell first. */
export const env = loadEnv('development', process.cwd(), '');

export const BASE_URL = env.SITE_URL;
export const API_BASE_URL = `${BASE_URL}/api`;

// The panel's URL segment, configurable via RIME_PANEL_ROUTE so the CLI's `rime init` (see
// local-pack-test.sh) can exercise a non-default value end to end. Safe to interpolate
// directly into a string or RegExp: rime's own validation (isValidSlug in
// core/dev/constants.ts) rejects anything but [a-zA-Z][a-zA-Z0-9_-]*, so it can never
// contain a path separator or regex metacharacter.
export const PANEL_SEGMENT = env.RIME_PANEL_ROUTE || 'panel';

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

/**
 * Signs in with these credentials and answers the session cookie, ready for `headers`. A refused
 * sign-in throws.
 *
 * The `request` context also keeps the cookie, so a later call in the same test that sends no
 * `cookie` header is signed in too. For an anonymous call, use a fresh context:
 *
 * @example
 * const signInAdmin = signIn('admin@email.com', PASSWORD);
 * await request.get(url, { headers: await signInAdmin(request) });
 * const anonymous = await playwright.request.newContext();
 * await anonymous.get(url);
 */
export const signIn = (email: string, password: string) => {
  return async (request: APIRequestContext) => {
    const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
      data: { email, password }
    });
    if (!response.ok()) {
      throw new Error(`sign-in as ${email} answered ${response.status()}`);
    }
    // "name=value; Max-Age=…; Path=/": the cookie is what comes before the first ";"
    const [cookie] = response.headers()['set-cookie'].split(';');
    return { cookie };
  };
};

/**
 * Signs the page's browser context in through the API, in place of any session it held. The page
 * stays where it is: the next navigation is signed in. The sign-in form is tested in
 * `tests/basic/pages.test.ts`; every other test comes in this way.
 *
 * @example
 * await loginAs(page, ADMIN_EMAIL, PASSWORD);
 * await page.goto(panelUrl('pages'));
 */
export const loginAs = async (page: Page, email: string, password: string) => {
  const context = page.context();
  await context.clearCookies();
  // The context's request shares its cookie jar: the session lands on the browser. A context
  // made with `browser.newContext()` has no `origin` header of its own, so it is sent here.
  const response = await context.request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    headers: { origin: BASE_URL },
    data: { email, password }
  });
  if (!response.ok()) {
    throw new Error(`sign-in as ${email} answered ${response.status()}`);
  }
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
  // A read still waiting when a call timed out: the next call takes its chunk.
  let pending: ReturnType<typeof reader.read> | undefined;

  return {
    async until(needle: string, timeoutMs = 5000) {
      const deadline = Date.now() + timeoutMs;
      while (!received.includes(needle) && Date.now() < deadline) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<'timeout'>((resolve) => {
          timer = setTimeout(() => resolve('timeout'), deadline - Date.now());
        });
        pending ??= reader.read();
        const chunk = await Promise.race([pending, timeout]);
        clearTimeout(timer);
        if (chunk === 'timeout') {
          break;
        }
        pending = undefined;
        if (chunk.done) {
          break;
        }
        received += decoder.decode(chunk.value, { stream: true });
      }
      if (!received.includes(needle)) {
        throw new Error(`"${needle}" never arrived; received:\n${received}`);
      }
      return received;
    }
  };
};
