import { makeVersionsCollectionsAliases } from '$rime/modules';
import type { WithVersionsConfig } from './augment.js';
import { defineFeature } from '../define.js';
import { augmentVersions } from './augment.js';

/**
 * Keeps a document's history in a shadow table, and lets one version be the published one.
 *
 * **Carries its augment and its derived collections, but not its hooks**, for two reasons:
 *
 * - Its `beforeUpdate` hooks run for *every* config, versioned or not: `defineVersionOperation`
 *   populates `context.versionOperation`, which `assertUpsertContext` requires on every update.
 *   Gating them behind `enabled` would break updates on non-versioned configs, so the prototypes
 *   list them until there is a timing that means "always".
 * - Its shadow tables are half in the adapter. `type: 'shadow'` records the intent; nothing reads
 *   it yet, and having the adapter take a shadow from a feature is its own job.
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
