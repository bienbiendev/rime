import { RimeError } from '$lib/core/errors/index.js';
import { Hooks } from '$lib/core/operations/hooks/index.server.js';

export const preventSupperAdminDeletion = Hooks.beforeDelete(async (args) => {
  const { doc, event } = args;
  const isSuperAdminDeletion = await event.locals.rime.adapter.auth.isSuperAdmin(doc.id);
  if (isSuperAdminDeletion) {
    throw new RimeError(RimeError.UNAUTHORIZED, "This user can't be deleted");
  }
  return args;
});
