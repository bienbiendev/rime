import { describe, expect, it, vi } from 'vitest';
import { forwardRolesToApiKey } from './forward-roles.server.js';

/** An update of the app `app1`, whose key `k1` an admin made, by `user` sending `roles`. */
const updateApp = async (args: { user: object; roles: string[]; storedRoles?: string[] }) => {
  const updateApiKey = vi.fn(async () => ({}));
  const run = forwardRolesToApiKey({
    config: { slug: 'apps', auth: { type: 'apiKey' } },
    data: { roles: args.roles },
    context: { originalDoc: { id: 'app1', roles: args.storedRoles ?? ['reports'] } },
    event: {
      locals: {
        user: args.user,
        rime: {
          adapter: {
            collection: () => ({
              findMany: async () => [{ apiKeyId: 'k1', authUserId: 'ba-admin' }]
            })
          },
          auth: { api: { updateApiKey } }
        }
      }
    },
    operation: 'update'
  } as never);
  const error = await Promise.resolve(run).then(
    () => undefined,
    (error) => error
  );
  return { error, updateApiKey };
};

const editor = { id: 's2', isStaff: true, roles: ['editor'] };
const admin = { id: 's1', isStaff: true, roles: ['admin'] };

describe('forwardRolesToApiKey', () => {
  it('refuses admin to a key from a caller who is not an admin, and leaves the key as it was', async () => {
    const { error, updateApiKey } = await updateApp({ user: editor, roles: ['admin'] });

    expect(error?.message).toContain('only an admin gives a key admin');
    expect(updateApiKey).not.toHaveBeenCalled();
  });

  it('gives a key the roles an admin saves', async () => {
    const { error, updateApiKey } = await updateApp({ user: admin, roles: ['admin'] });

    expect(error).toBeUndefined();
    expect(updateApiKey).toHaveBeenCalledWith({
      body: { keyId: 'k1', userId: 'ba-admin', permissions: { roles: ['admin'] } }
    });
  });

  it('lets a caller who is not an admin keep the admin role a key already has', async () => {
    const { error } = await updateApp({
      user: editor,
      roles: ['admin', 'reports'],
      storedRoles: ['admin']
    });

    expect(error).toBeUndefined();
  });
});
