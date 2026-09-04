import { makeVersionsCollectionsAliases } from '$rime/modules';
import type { WithVersionsConfig } from './augment.js';
import { defineFeature } from '../define.js';
import { augmentVersions } from './augment.js';
import { withVersionsSuffix } from './naming.js';

/**
 * Keeps a document's history in a shadow table, and lets one version be the published one.
 *
 * **Carries its augment, its shadow and its derived collections, but not its hooks**: its
 * `beforeUpdate` hooks run for *every* config, versioned or not — `defineVersionOperation`
 * populates `context.versionOperation`, which `assertUpsertContext` requires on every update.
 * Gating them behind `enabled` would break updates on non-versioned configs, so the prototypes
 * list them until there is a timing that means "always".
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
