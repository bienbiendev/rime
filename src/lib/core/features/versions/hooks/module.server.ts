import { defineVersionOperation } from './define-version-operation.server.js';
import { demoteOtherVersions } from './demote-other-versions.js';
import { handleNewVersion } from './handle-new-version.server.js';

/**
 * What `versions` contributes to the document pipeline.
 *
 * A module of its own so `features/versions/index.ts` can list them: that file is reachable from a
 * client build — a prototype's feature list is — and `handleNewVersion` is server-only, so it
 * cannot be imported by path from there (rule 7 in docs/restructure-handoff.md). Only a module with
 * no client half gets its names stubbed to `undefined`, which is what this is; hooks never run on a
 * client, so the feature simply carries none there. Same shape as `features/title/hooks`.
 *
 * `demoteOtherVersions` is isomorphic and joins them here anyway — one list is easier to read than
 * one list plus an exception.
 */
export const versionsHooks = {
  beforeUpdate: [defineVersionOperation, handleNewVersion, demoteOtherVersions]
};
