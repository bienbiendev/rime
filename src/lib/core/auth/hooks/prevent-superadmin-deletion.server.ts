import { RimeError } from '$lib/core/errors/index.js';
import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { isSuperAdmin } from '$lib/core/auth/user.server.js';

export const preventSupperAdminDeletion = Hooks.beforeDelete({
  name: 'preventSupperAdminDeletion',
  feature: 'auth',
  run: async (args) => {
    const { doc, event } = args;
    const isSuperAdminDeletion = await isSuperAdmin(event.locals.rime.adapter, doc.id);
    if (isSuperAdminDeletion) {
      throw new RimeError(RimeError.UNAUTHORIZED, "This user can't be deleted");
    }
    return args;
  }
});
