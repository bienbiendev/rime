import { dev } from '$app/env';
import { formFailure } from '#lib/core/errors/handler.server.js';
import { RimeFormError } from '#lib/core/errors/index.js';
import { redirect, type Actions } from '@sveltejs/kit';

export const signInActions: Actions = {
  /**
   * Signs in through better-auth's email and password sign-in, copies the cookie it sets onto the
   * panel's answer, and goes to the panel; a refused sign-in, a rate-limited one included, answers
   * the form with `invalid_credentials`.
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

    const authenticated = response && response.status === 200;

    if (!authenticated) {
      const invalid = new RimeFormError({
        _form: RimeFormError.INVALID_CREDENTIALS,
        email: RimeFormError.INVALID_CREDENTIALS,
        password: RimeFormError.INVALID_CREDENTIALS
      });
      return formFailure(invalid, { email });
    }

    const setCookieHeader = response.headers.get('set-cookie') as string;

    if (setCookieHeader) {
      const parsedCookie = setCookieHeader.split(';')[0];
      const [name, encodedValue] = parsedCookie.split('=');
      const decodedValue = decodeURIComponent(encodedValue);

      cookies.set(name, decodedValue, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 604800,
        secure: !dev
      });
    }

    throw redirect(302, `/${params.panel}`);
  }
};
