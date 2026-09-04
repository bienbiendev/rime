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
 * It was called core rather than a feature, and that was a description of where it lived, not of
 * what it is. It appends fields (`ownerId`, the password and api-key fields), it contributes
 * hooks at six timings, and every one of those was a `collection.auth ? [...] : []` written into
 * the prototype's pipeline by hand. `enabled` says it once instead, and the conditionals go.
 *
 * That is the whole reason a prototype no longer needs a hook list: every conditional in it was a
 * feature gate wearing a ternary.
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
   * A whole-config step, so `configure` rather than `augment`, and `enabled` does not gate it —
   * signing into the panel does not depend on a user collection existing. It used to be called by
   * name from `core/config/build{,.server}.ts` as `augmentStaff`, which is the config factory
   * knowing which feature owns the staff collection.
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
 * Declared because the augment *changes* the type rather than only appending fields. It used to be
 * carried by a hand-written `augmentAuth(...)` step in each collection factory, which also ran the
 * augment a second time and appended its fields twice; the fold does both now, and this is the
 * type half of it.
 */
declare module '$lib/core/features/register.js' {
  interface FeatureConfigAugment<T> {
    auth: WithNormalizedAuth<T>;
  }
}
