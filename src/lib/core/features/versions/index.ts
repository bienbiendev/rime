import { makeVersionsCollectionsAliases } from '$rime/modules';
import type { WithVersionsConfig } from './augment.js';
import { defineFeature } from '../define.js';
import { augmentVersions } from './augment.js';
import { demoteOtherVersions } from './hooks/demote-other-versions.js';
import { withVersionsSuffix } from './naming.js';
import { versionsReadQuery } from './read-query.js';
import { versionsWritePlan } from './write-plan.js';

/**
 * Keeps a document's history in a shadow table, and lets one version be the published one.
 *
 * **Carries only the hooks that a non-versioned config has no use for.** `defineVersionOperation`
 * and `handleNewVersion` run for *every* config, versioned or not — the first populates
 * `context.versionOperation` and the second `context.contentOwnerId`, both of which
 * `assertUpsertContext` requires on every update. `buildPipeline` gates a feature's hooks behind
 * `enabled`, so those two stay listed by the prototypes until there is a timing that means
 * "always". `demoteOtherVersions` is not one of them: a config with no drafts has nothing to
 * demote, so `enabled` is exactly the right gate for it.
 *
 * The augment is isomorphic — it normalises `versions` and adds `status` — so it needs no
 * `$rime/modules` pair.
 */
export const versions = defineFeature({
  name: 'versions',
  type: 'shadow',
  requires: [],

  /** A config uses this feature by declaring `versions`. */
  enabled: (config) => !!config.versions,

  augment: augmentVersions,

  /**
   * A versioned config keeps its identity and its `._root()` fields on its own row and everything
   * else on `$<slug>__versions` — the one fact the adapter needs to build the second table and to
   * know which row a write of content belongs on.
   */
  shadow: (config) => ({ slug: withVersionsSuffix(config.slug) }),

  /** See the note above for why this is the only hook the feature carries. */
  hooks: { beforeUpdate: [demoteOtherVersions] },

  /**
   * Where the two halves of an update land — the base row and the version row. What
   * `versionOperation` used to tell the adapter, said once here instead.
   */
  writePlan: versionsWritePlan,

  /**
   * Which version a read means — the published one, a named one, or the newest. What `draft` and
   * `versionId` used to tell the adapter, said once here instead.
   */
  readQuery: versionsReadQuery,

  /**
   * The `<slug>__versions` collection behind every versioned config, derived after `upload` has
   * derived its directories. `undefined` on the client, where nothing derives them.
   */
  configure: makeVersionsCollectionsAliases
});

/** Turns an author's `versions: true` into a normalised object. */
declare module '$lib/core/features/register.js' {
  interface FeatureConfigAugment<T> {
    versions: WithVersionsConfig<T>;
  }
}
