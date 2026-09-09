/**
 * This feature's hooks, by name, so a prototype can place them as `auth.someHook`.
 *
 * A barrel and nothing else — `module.server.ts` beside it is what `$rime/modules` collects, and
 * only files named exactly `module(.server).ts` are, so this one is invisible to that mechanism.
 * It exists because a prototype's `hooks.server.ts` writes the run order and would otherwise carry
 * one import line per hook.
 */
export { augmentFieldsPassword } from './augment-fields-password.server.js';
export { createBetterAuthUser } from './create-better-auth-user.server.js';
export { deleteBetterAuthUser } from './delete-better-auth-user.server.js';
export { forwardRolesToBetterAuth } from './forward-roles.server.js';
export { populateAPIKey } from './populate-api-key.server.js';
export { preventSuperAdminMutation } from './prevent-superadmin-mutation.server.js';
export { preventSupperAdminDeletion } from './prevent-superadmin-deletion.server.js';
export { preventUserMutations } from './prevent-user-mutations.server.js';
export { removePrivateFields } from './remove-private-fields.server.js';
