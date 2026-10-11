import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { RimeError } from '#lib/core/errors/index.js';
import { isSuperAdmin } from '#lib/core/auth/user.server.js';

/**
 * Refuses to delete the super-admin through rime's delete. better-auth's routes that could
 * remove its user are closed (`CLOSED_PATHS`, better-auth/config.server.ts).
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
