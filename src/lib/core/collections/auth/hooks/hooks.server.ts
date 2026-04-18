import { deleteBetterAuthUser } from './after-delete/delete-better-auth-user.server.js';
import { createBetterAuthUser } from './before-create/create-better-auth-user.server.js';
import { preventSupperAdminDeletion } from './before-delete/prevent-superadmin-deletion.server.js';
import { forwardRolesToBetterAuth } from './before-update/forward-roles.server.js';
import { preventSuperAdminMutation } from './before-update/prevent-superadmin-mutation.server.js';
import { preventUserMutations } from './before-update/prevent-user-mutations.server.js';
import { augmentFieldsPassword } from './before-upsert/augment-fields-password.server.js';

export {
  augmentFieldsPassword,
  createBetterAuthUser,
  deleteBetterAuthUser,
  forwardRolesToBetterAuth,
  preventSuperAdminMutation,
  preventSupperAdminDeletion,
  preventUserMutations
};
