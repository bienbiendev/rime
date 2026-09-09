import { VERSIONS_STATUS } from '$lib/core/features/versions/constant.js';
import { makeVersionsCollectionsAliases } from '$rime/modules';
import type { WithVersionsConfig } from './augment.js';
import { defineFeature } from '../define.js';
import { augmentVersions } from './augment.js';
import { withVersionsSuffix } from './naming.js';
import { versionsDocType } from './doc-type.js';
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
 * `versions:operation` is its mark, merged into `FeatureHookMarks` below — core's `CoreHookMark`
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
  docType: versionsDocType,

  shadow: (config) => ({ slug: withVersionsSuffix(config.slug) }),

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
   * A bootstrapped document's first version is the published one — otherwise the row exists and no
   * default read can see it, since one narrows to `status = published`. The `status` field's own
   * default is `draft`, which is right for every version made after this one, hence the intent.
   */
  blank: (doc, config, intent) =>
    intent === 'seed' && config.versions?.draft
      ? { ...doc, status: VERSIONS_STATUS.PUBLISHED }
      : doc,

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
