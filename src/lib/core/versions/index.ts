import { VERSIONS_STATUS } from '$lib/core/versions/constant.js';
import { makeVersionsCollectionsAliases } from '$rime/modules';
import type { WithVersionsConfig } from './augment.js';
import { defineFeature } from '$lib/core/features/define.js';
import { versionsDocType } from './doc-type.js';

/**
 * Keeps a document's history in a versions table, and lets one version be the published one.
 *
 * **Carries its own hooks**, which it could not until core had a default for what they answer.
 * `handleNewVersion` had to run for *every* config because it was the only thing setting
 * `context.contentOwnerId`, which `assertUpsertContext` requires on every update — so both
 * prototypes listed it by name and `buildPipeline`'s `enabled` gate could not be applied. Core
 * states the default now (`pipeline/hooks/resolve-content-owner.server.ts`: the document's own
 * row) and this feature *overrides* it, which is what a feature is for.
 *
 * The augment is isomorphic — it normalises `versions`, adds `status`, and states `_versions`,
 * the table this config's content lives in. That last one was a `FeatureDefinition.shadow` seam
 * that nothing else ever implemented, folded by five callers; two of them are in `adapter-sqlite/`
 * and read a config member now, which is what keeps the adapter naming no feature.
 *
 * `readQuery` and `writePlan` were the same story: seams with one implementer, folded over every
 * feature to reach it. `versionsReadQuery` and `versionsWritePlan` are imported by name now, and
 * each guards its own not-versioned case on its first line.
 */
export const versions = defineFeature({
  name: 'versions',
  /** A config uses this feature by declaring `versions`. */
  enabled: (config) => !!config.versions,

  /**
   * A versioned config keeps its identity and its `._root()` fields on its own row and everything
   * else on `$<slug>__versions` — the one fact the adapter needs to build the second table and to
   * know which row a write of content belongs on.
   */
  docType: versionsDocType,

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
