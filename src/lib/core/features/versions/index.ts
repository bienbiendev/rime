import { defineFeature } from '../define.js';
import { augmentVersions } from './augment.js';

/**
 * Keeps a document's history in a shadow table, and lets one version be the published one.
 *
 * **Registered for its augment only, and that is deliberate.** Two things keep the rest of it out
 * for now:
 *
 * - Its `beforeUpdate` hooks run for *every* config, versioned or not. `defineVersionOperation`
 *   populates `context.versionOperation`, which `assertUpsertContext` then requires on every
 *   update — so gating them behind `enabled` would break updates on non-versioned configs. They
 *   stay listed in operations/pipeline.server.ts until there is a timing that says "always".
 * - Its shadow tables are half in the adapter. `type: 'shadow'` is declared here so the intent is
 *   on record, but nothing reads it yet: making the adapter take a shadow from a feature is its
 *   own job.
 *
 * The augment is isomorphic — it normalises `versions` and adds `status` — so it needs no
 * `$rime/modules` pair, only this definition.
 */
export const versions = defineFeature({
  type: 'shadow',
  extends: ['collection', 'area'],
  requires: [],

  /** A config uses this feature by declaring `versions`. */
  enabled: (config) => !!config.versions,

  augment: augmentVersions
});
