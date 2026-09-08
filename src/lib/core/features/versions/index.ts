import { makeVersionsCollectionsAliases, versionsHooks } from '$rime/modules';
import type { WithVersionsConfig } from './augment.js';
import { defineFeature } from '../define.js';
import { augmentVersions } from './augment.js';
import { withVersionsSuffix } from './naming.js';
import { versionsReadQuery } from './read-query.js';
import { versionsWritePlan } from './write-plan.js';

/**
 * Keeps a document's history in a shadow table, and lets one version be the published one.
 *
 * **Carries its own hooks**, which it could not until core had a default for what they answer.
 * `handleNewVersion` had to run for *every* config because it was the only thing setting
 * `context.contentOwnerId`, which `assertUpsertContext` requires on every update — so both
 * prototypes listed it by name and `buildPipeline`'s `enabled` gate could not be applied. Core
 * states the default now (`pipeline/steps/resolve-content-owner.server.ts`: the document's own
 * row) and this feature *overrides* it, which is what a feature is for.
 *
 * `version-operation` is its mark, merged into `FeatureHookMarks` below — core's `CoreHookMark`
 * used to declare it, which is a feature's word in core's closed union.
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
   * Its document hooks. Through `$rime/modules` because `handleNewVersion` is server-only and this
   * file is reachable from a client build — see hooks/module.server.ts.
   */
  hooks: versionsHooks,

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

/**
 * The mark its own hooks order by: `defineVersionOperation` decides which of the five operations
 * an update is, and both `handleNewVersion` and `demoteOtherVersions` wait on it.
 *
 * Declared here rather than in `CoreHookMark`, where it used to be. The union is closed on purpose
 * — a misspelled mark would silently reorder the pipeline instead of erroring — and this is the
 * seam that keeps it closed without core naming a feature.
 */
declare module '$lib/core/pipeline/types.js' {
  interface FeatureHookMarks {
    'version-operation': true;
  }
}
