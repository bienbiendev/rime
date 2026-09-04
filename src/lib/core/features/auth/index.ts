import { augmentAuth, augmentStaff } from '$rime/modules';
import type { WithNormalizedAuth } from './module.js';
import * as authHooks from './hooks/index.server.js';
import { augmentFieldsPassword } from './hooks/augment-fields-password.server.js';
import { populateAPIKey } from './hooks/populate-api-key.server.js';
import { removePrivateFields } from './hooks/remove-private-fields.server.js';
import { defineFeature } from '../define.js';

/**
 * Signing in: what a collection gains by declaring `auth`.
 *
 * It appends fields (`ownerId`, the password and api-key fields) and contributes hooks at six
 * timings, all of them gated by one `enabled` rather than a condition per hook site. It also owns
 * the `staff` collection, which is a statement about the whole config — see `configure`.
 */
export const auth = defineFeature({
  name: 'auth',
  type: 'augment',
  requires: [],

  /** A collection uses this feature by declaring `auth`. */
  enabled: (config) => !!config.auth,

  augment: augmentAuth,

  /**
   * The `staff` collection, which every config gets whether or not anything declares `auth`.
   *
   * A whole-config step, so `configure` rather than `augment`, and `enabled` does not gate it:
   * signing into the panel does not depend on a user collection existing.
   */
  configure: augmentStaff,

  hooks: {
    // First in `beforeRead`, and by declaration rather than by position: it provides `sanitized`,
    // which everything deriving from the document requires — so nothing can copy a private value
    // into derived data, whoever adds a hook later.
    beforeRead: [removePrivateFields],

    beforeCreate: [augmentFieldsPassword, authHooks.createBetterAuthUser],

    // Self-gates on `auth.type === 'apiKey'`, so it needs no second condition here.
    afterCreate: [populateAPIKey],

    beforeUpdate: [
      augmentFieldsPassword,
      authHooks.preventSuperAdminMutation,
      authHooks.preventUserMutations,
      authHooks.forwardRolesToBetterAuth
    ],

    beforeDelete: [authHooks.preventSupperAdminDeletion],

    afterDelete: [authHooks.deleteBetterAuthUser]
  }
});

/**
 * Normalises `auth`: an author may write `auth: true`, the built config always carries the object.
 *
 * Declared because the augment *changes* the type rather than only appending fields, so the fold
 * in register.ts needs to be told.
 */
declare module '$lib/core/features/register.js' {
  interface FeatureConfigAugment<T> {
    auth: WithNormalizedAuth<T>;
  }
}
