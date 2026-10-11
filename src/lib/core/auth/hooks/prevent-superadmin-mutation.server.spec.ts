import { describe, expect, it } from 'vitest';
import { preventSuperAdminMutation } from './prevent-superadmin-mutation.server.js';

/** An update of the super-admin, `sa`, by `user`, in `context`. */
const updateSuperAdmin = (args: { user?: object; context?: object }) =>
  preventSuperAdminMutation({
    data: { name: 'Renamed' },
    context: { originalDoc: { id: 'sa' }, ...args.context },
    event: {
      locals: {
        user: args.user,
        // The staff collection holds `sa`, the super-admin
        rime: { adapter: { collection: () => ({ findMany: async () => [{ id: 'sa' }] }) } }
      }
    },
    operation: 'update'
  } as never);

describe('preventSuperAdminMutation', () => {
  it('refuses an update of the super-admin by anyone else', async () => {
    await expect(updateSuperAdmin({ user: { id: 'a1', isSuperAdmin: false } })).rejects.toThrow(
      'unauthorized'
    );
  });

  it("lets rime's own system update through, whoever made the request", async () => {
    const result = await updateSuperAdmin({
      user: { id: 'a1', isSuperAdmin: false },
      context: { isSystemOperation: true }
    });
    expect(result.data).toEqual({ name: 'Renamed' });
  });
});
