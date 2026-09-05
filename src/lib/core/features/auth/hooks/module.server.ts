import { augmentFieldsPassword } from './augment-fields-password.server.js';
import { createBetterAuthUser } from './create-better-auth-user.server.js';
import { deleteBetterAuthUser } from './delete-better-auth-user.server.js';
import { forwardRolesToBetterAuth } from './forward-roles.server.js';
import { populateAPIKey } from './populate-api-key.server.js';
import { preventSupperAdminDeletion } from './prevent-superadmin-deletion.server.js';
import { preventSuperAdminMutation } from './prevent-superadmin-mutation.server.js';
import { preventUserMutations } from './prevent-user-mutations.server.js';
import { removePrivateFields } from './remove-private-fields.server.js';

/**
 * What auth contributes to the document pipeline — six timings' worth.
 *
 * A module of its own with no `module.ts` beside it, which is the convention's rule rather than a
 * preference: when a pair has both halves, `$rime/modules` exports the client half's names on a
 * client build, so a name only the server half declares is simply missing there. Only a module
 * with *no* client half gets its names stubbed to `undefined`. `augmentAuth` is symmetric and
 * belongs in `../module(.server).ts`; these are server-only and belong here.
 *
 * It is also what keeps `features/auth/index.ts` isomorphic. The feature list is reachable from a
 * client build — `create` runs the augments on both sides — so an `index.ts` that imported these
 * hooks by path dragged nine `.server.ts` files into the browser graph, and SvelteKit refused
 * them with "An impossible situation occurred": its own guard fired, then failed to name a route
 * entrypoint because it follows one arbitrary importer branch.
 *
 * The export name is `authHooks`, not `hooks`: every `module(.server).ts` export name has to be
 * unique across the whole package, since they all land in one virtual barrel.
 */
export const authHooks = {
  // First in `beforeRead`, and by declaration rather than by position: it provides `sanitized`,
  // which everything deriving from the document requires — so nothing can copy a private value
  // into derived data, whoever adds a hook later.
  beforeRead: [removePrivateFields],

  beforeCreate: [augmentFieldsPassword, createBetterAuthUser],

  // Self-gates on `auth.type === 'apiKey'`, so it needs no second condition here.
  afterCreate: [populateAPIKey],

  beforeUpdate: [
    augmentFieldsPassword,
    preventSuperAdminMutation,
    preventUserMutations,
    forwardRolesToBetterAuth
  ],

  beforeDelete: [preventSupperAdminDeletion],

  afterDelete: [deleteBetterAuthUser]
};
