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

  it.each([
    ['staff', ['admin'], 'admin'],
    ['staff', ['staff'], 'staff'],
    ['users', ['admin'], 'user'],
    ['users', ['user'], 'user']
  ])(
    'gives an admin creating a %s document with roles %j the role %s',
    async (slug, roles, role) => {
      const { api, run } = setup({
        slug,
        auth: { type: 'password', roles: ['admin', 'staff'] },
        user: { id: 'u1', email: 'u1@site.com', isStaff: true, roles: ['admin'] },
        data: { email: 'new@site.com', name: 'New', password: 'secret', roles }
      });

      const result = await run();
      expect(api.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.any(Headers),
          body: expect.objectContaining({ role })
        })
      );
      expect(result.data.authUserId).toBe('ba-new');
    }
  );

  it.each([
    ['staff', 'staff'],
    ['users', 'user']
  ])(
    'gives a staff member creating a %s document the role %s, without headers',
    async (slug, role) => {
      const { api, run } = setup({
        slug,
        auth: { type: 'password', roles: ['admin', 'staff'] },
        user: { id: 'u1', email: 'u1@site.com', isStaff: true, roles: ['staff'] },
        data: { email: 'new@site.com', name: 'New', password: 'secret', roles: ['admin'] }
      });

      const result = await run();
      const [call] = api.createUser.mock.calls[0] as unknown as [object];
      expect(call).not.toHaveProperty('headers');
      expect(call).toHaveProperty('body.role', role);
      expect(result.data.authUserId).toBe('ba-new');
    }
  );

  it('refuses `isSuperAdmin` outside the init', async () => {
    const { api, run } = setup({
      slug: 'staff',
      auth: { type: 'password' },
      user: { id: 'u1', email: 'u1@site.com', isStaff: true, roles: ['admin'] },
      data: { email: 'new@site.com', password: 'secret', isSuperAdmin: true }
    });

    await expect(run()).rejects.toThrow('unauthorized');
    expect(api.createUser).not.toHaveBeenCalled();
  });

  it('refuses an anonymous create, and an `authUserId` sent outside a sign-up', async () => {
    const { api, run } = setup({
      slug: 'users',
      auth: { type: 'password' },
      data: { email: 'new@site.com', password: 'secret', authUserId: 'ba-sent' }
    });

    await expect(run()).rejects.toThrow('unauthorized');
    expect(api.createUser).not.toHaveBeenCalled();
  });

  it('mails a staff member their api key and puts its ids on the document', async () => {
    const { api, sendMail, run } = setup({
      slug: 'apiKeys',
      auth: { type: 'apiKey' },
      user: { id: 'u1', email: 'u1@site.com', isStaff: true, roles: ['staff'] },
      data: { name: 'Mobile app' }
    });

    const result = await run();
    expect(api.createApiKey).toHaveBeenCalledWith({
      body: { name: 'Mobile app', userId: 'ba1', permissions: { roles: ['user'] } }
    });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'u1@site.com' }));
    expect(result.context.apiKey).toBe('secret');
    expect(result.data).toMatchObject({ apiKeyId: 'k1', authUserId: 'ba1', ownerId: 'u1' });
  });
});
