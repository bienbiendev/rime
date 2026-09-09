import { VERSIONS_STATUS } from '$lib/core/features/versions/constant.js';
import { VersionOperations } from '$lib/core/features/versions/strategy.js';
import { Hooks } from '$lib/core/pipeline/hooks.js';
import { withVersionsSuffix } from '../naming.js';

/**
 * Exactly one version of a document is published at a time, so publishing one steps the others
 * down first.
 *
 * This was three lines of raw drizzle inside `updatePrototype`'s specific-version branch, guarded
 * by `config.versions.draft` — the adapter reading a feature's config member to decide a feature's
 * rule. It is the same statement here, through `updateWhere`, which is a table, a filter and a
 * patch and knows nothing about what a version or a status is.
 *
 * Runs before the write, as every `beforeUpdate` hook does, and demotes *every* version of the
 * document including the one about to be published — which is then re-published by the write. The
 * two statements are not in a transaction; they were not before either (there are none in the
 * adapter), so a reader between them sees the document with no published version.
 *
 * Isomorphic: it reaches the adapter through `event.locals`, so it imports nothing server-only and
 * needs no `$rime/modules` pair — the feature can carry it directly.
 */
export const demoteOtherVersions = Hooks.beforeUpdate({
  name: 'demoteOtherVersions',
  requires: ['version-operation', 'original-doc'],
  provides: [],
  run: async (args) => {
    const { config, data, event, context } = args;

    // Only a config with drafts has a published version to be the only one of.
    if (!config.versions || !config.versions.draft) return args;
    // A new version's row is written by handleNewVersion as a draft; nothing to demote.
    if (!VersionOperations.isSpecificVersionUpdate(context.versionOperation!)) return args;
    if (data.status !== VERSIONS_STATUS.PUBLISHED) return args;

    await event.locals.rime.adapter.prototype(withVersionsSuffix(config.slug)).updateWhere({
      query: `where[ownerId][equals]=${context.originalDoc!.id}`,
      data: { status: VERSIONS_STATUS.DRAFT }
    });

    return args;
  }
});
