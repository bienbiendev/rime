import { augmentAuth, augmentStaff, blankAuthDocument } from '$rime/modules';
import { defineFeature } from '$lib/core/features/define.js';
import type { WithNormalizedAuth } from './augment.js';

/**
 * Signing in: what a collection gains by declaring `auth`.
 *
 * It appends fields (`ownerId`, the password and api-key fields) and contributes hooks at six
 * timings, all of them gated by one `enabled` rather than a condition per hook site. It also owns
 * the `staff` collection, which is a statement about the whole config — see `configure`.
 */
export const auth = defineFeature({
  name: 'auth',
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

  /**
   * A password and its better-auth link are not the document's to hand out — see
   * `blank/module.server.ts`.
   *
   * Through `$rime/modules` because that file reads `PRIVATE_FIELDS`, which must never be
   * reachable from a client build. The name resolves to `undefined` there, which is harmless:
   * `blank()` is only ever assembled server-side.
   */
  blank: blankAuthDocument
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
