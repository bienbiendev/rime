import { describe, expect, it, vi } from 'vitest';
import { signInActions } from './actions.server.js';

/** The sign-in form posted, better-auth answering `body` with the `set-cookie` lines given. */
const signIn = async (status: number, body: unknown, setCookies: string[] = []) => {
  const headers = new Headers({ 'content-type': 'application/json' });
  for (const line of setCookies) headers.append('set-cookie', line);
  const cookies = { set: vi.fn() };
  const form = new FormData();
  form.set('email', 'admin@site.com');
  form.set('password', 'secret');

  const event = {
    cookies,
    request: new Request('https://site.com/panel/sign-in', { method: 'POST', body: form }),
    locals: {
      rime: {
        auth: { handler: async () => new Response(JSON.stringify(body), { status, headers }) }
      }
    },
    params: { panel: 'panel' }
  };
  // The redirect is thrown: it comes back as the result
  const result = await Promise.resolve(signInActions.default(event as never)).catch(
    (thrown: unknown) => thrown
  );
  return { result, cookies };
};

describe('signInActions.default', () => {
  it('sets every cookie better-auth set, with its own attributes, and goes to the panel', async () => {
    const { result, cookies } = await signIn(200, { user: { id: 'u1' } }, [
      'better-auth.session_token=abc.def; Max-Age=3600; Path=/; HttpOnly; SameSite=Lax',
      'better-auth.session_data=xyz; Max-Age=300; Path=/; HttpOnly; SameSite=Lax'
    ]);

    expect(result).toMatchObject({ status: 302, location: '/panel' });
    expect(cookies.set).toHaveBeenCalledTimes(2);
    expect(cookies.set).toHaveBeenCalledWith(
      'better-auth.session_token',
      'abc.def',
      expect.objectContaining({ maxAge: 3600, path: '/', httpOnly: true, sameSite: 'lax' })
    );
    expect(cookies.set).toHaveBeenCalledWith(
      'better-auth.session_data',
      'xyz',
      expect.objectContaining({ maxAge: 300 })
    );
  });

  it('answers a two-factor step, a 200 with no session, with an error and sets no cookie', async () => {
    const { result, cookies } = await signIn(200, { twoFactorRedirect: true }, [
      'better-auth.two_factor=abc; Max-Age=600; Path=/; HttpOnly'
    ]);

    expect(result).toMatchObject({ status: 400, data: { errors: { _form: 'unauthorized' } } });
    expect(cookies.set).not.toHaveBeenCalled();
  });

  it('answers a refused sign-in with invalid credentials', async () => {
    const { result, cookies } = await signIn(401, { code: 'INVALID_EMAIL_OR_PASSWORD' });

    expect(result).toMatchObject({
      status: 400,
      data: { form: { email: 'admin@site.com' }, errors: { email: 'invalid_credentials' } }
    });
    expect(cookies.set).not.toHaveBeenCalled();
  });
});
