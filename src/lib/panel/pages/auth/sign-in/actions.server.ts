import { formFailure } from '#lib/core/errors/handler.server.js';
import { RimeFormError } from '#lib/core/errors/index.js';
import { redirect, type Actions } from '@sveltejs/kit';
import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies';

export const signInActions: Actions = {
  /**
   * Signs in through better-auth's email and password sign-in, copies the cookies it sets onto the
   * panel's answer, and goes to the panel. A refused sign-in, a rate-limited one included, answers
   * the form with `invalid_credentials`; a sign-in that opens no session, like a two-factor step,
   * with `unauthorized`.
   */
  default: async ({ cookies, request, locals, params }) => {
    const { rime } = locals;

    const data = await request.formData();
    const email = data.get('email')?.toString() || '';
    const password = data.get('password')?.toString() || '';

    // Through better-auth's router, as /api/auth/sign-in/email: its rate limiter runs there only.
    // The visitor's headers go along, so the limiter and the session read the client's address.
    const headers = new Headers(request.headers);
    headers.set('content-type', 'application/json');
    headers.delete('content-length');
    const response = await rime.auth.handler(
      new Request(new URL('/api/auth/sign-in/email', request.url), {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, password })
      })
    );

    // A session answers { user } (rime's after hook), a two-factor step { twoFactorRedirect: true }
    const body = response.status === 200 ? await response.json() : null;

    if (!body?.user) {
      const refused = body
        ? new RimeFormError({ _form: RimeFormError.UNAUTHORIZED })
        : new RimeFormError({
            _form: RimeFormError.INVALID_CREDENTIALS,
            email: RimeFormError.INVALID_CREDENTIALS,
            password: RimeFormError.INVALID_CREDENTIALS
          });
      return formFailure(refused, { email });
    }

    // Every cookie better-auth set, the session's and any plugin's, with its own attributes
    for (const line of response.headers.getSetCookie()) {
      for (const [name, cookie] of parseSetCookieHeader(line)) {
        cookies.set(name, cookie.value, { ...toCookieOptions(cookie), path: cookie.path ?? '/' });
      }
    }

    throw redirect(302, `/${params.panel}`);
  }
};
