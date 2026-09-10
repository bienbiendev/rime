import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { RimeError } from '$lib/core/errors/index.js';
import { isSuperAdmin } from '$lib/core/auth/user.server.js';

/**
 * Refuses to delete the super-admin.
 *
 * There is exactly one, and nothing in the panel or the API may remove it.
 */
export const preventSupperAdminDeletion = Hooks.beforeDelete(
  async function preventSupperAdminDeletion(args) {
    const { doc, event } = args;
    const isSuperAdminDeletion = await isSuperAdmin(event.locals.rime.adapter, doc.id);
    if (isSuperAdminDeletion) {
      throw new RimeError(RimeError.UNAUTHORIZED, "This user can't be deleted");
    }
    return args;
  }
);
