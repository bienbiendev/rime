import { augmentAuth, augmentStaff, authHooks } from '$rime/modules';
import type { WithNormalizedAuth } from './module.js';
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

  /**
   * Six timings' worth, listed in `hooks/module.server.ts` and reached through `$rime/modules`.
   *
   * Not imported by path: this file is reachable from a client build — a prototype's feature list
   * is, since `create` runs the augments on both sides — and a `.server.ts` import here drags the
   * whole hook folder into the browser graph.
   */
  hooks: authHooks
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
