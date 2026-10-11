import { describe, expect, it, vi } from 'vitest';
import { RimeFormError } from '#lib/core/errors/index.js';
import { createBetterAuthUser } from './create-better-auth-user.server.js';

/** A create on `slug` by `user`, with better-auth's api and the mailer as spies. */
const setup = (args: { slug: string; auth: object; user?: object; data: object }) => {
  const api = {
    createUser: vi.fn(async () => ({ user: { id: 'ba-new' } })),
    createApiKey: vi.fn(async () => ({ id: 'k1', key: 'secret' }))
  };
  const sendMail = vi.fn(async () => {});
  const run = () =>
    createBetterAuthUser({
      config: { slug: args.slug, auth: args.auth },
      event: {
        request: { headers: new Headers() },
        locals: {
          user: args.user,
          betterAuthUser: args.user && { id: 'ba1' },
          rime: { auth: { api }, mailer: { sendMail } }
        }
      },
      data: args.data,
      context: {},
      operation: 'create'
    } as never);
  return { api, sendMail, run };
};

describe('createBetterAuthUser', () => {
  it('refuses an api key to a signed-in user who is not staff, before the key exists', async () => {
    const { api, sendMail, run } = setup({
      slug: 'apiKeys',
      auth: { type: 'apiKey' },
      user: { id: 'u1', email: 'u1@site.com', isStaff: false, roles: ['user'] },
      data: { name: 'Mobile app' }
    });

    await expect(run()).rejects.toThrow('an api key belongs to a staff member');
    expect(api.createApiKey).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it.each([
    ['an admin', ['admin']],
    ['a staff member', ['staff']]
  ])('asks %s creating a user for a password, before better-auth makes one', async (_, roles) => {
    const { api, run } = setup({
      slug: 'staff',
      auth: { type: 'password', roles: ['admin', 'staff'] },
      user: { id: 'u1', email: 'u1@site.com', isStaff: true, roles },
      data: { email: 'new@site.com', name: 'New' }
    });

    const error = await run().catch((error) => error);
    expect(error).toBeInstanceOf(RimeFormError);
    expect(error.errors).toEqual({ password: RimeFormError.REQUIRED_FIELD });
    expect(api.createUser).not.toHaveBeenCalled();
  });
});
