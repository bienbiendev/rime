import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant.js';
import { VersionOperations } from '$lib/core/prototype/shared/versions/strategy.js';

/**
 * Exactly one version of a document is published at a time, so publishing one steps the others
 * down first.
 *
 * Runs before the write, as every `beforeUpdate` hook does, and demotes every other version of
 * the document. The one being published is `context.contentOwnerId` — the selected row, or the
 * row `handleNewVersion` has just inserted for a fork, which the write plan will not touch again —
 * and it is left alone. An auto-save carries the status of the row it branched from and
 * publishes nothing, so it is left out.
 *
 * The two statements are not in a transaction (there are none in the adapter), so a reader
 * between them sees the document with no published version.
 *
 * Isomorphic: it reaches the adapter through `event.locals`, so it imports nothing server-only
 * and needs no `$rime/modules` pair — the feature can carry it directly.
 */
export const demoteOtherVersions = Hooks.beforeUpdate(async function demoteOtherVersions(args) {
  const { config, data, event, context } = args;

  // Only a config with drafts has a published version to be the only one of.
  if (!config.versions || !config.versions.draft) return args;
  if (context.params.autoSave) return args;
  if (VersionOperations.isAutoSaveCreation(context.versionOperation!)) return args;
  if (data.status !== VERSIONS_STATUS.PUBLISHED) return args;

  // On the versions table `id` is the row itself; `contentOwnerId` names it.
  await event.locals.rime.adapter.contentOwner(config.slug).updateWhere({
    query: `where[and][0][ownerId][equals]=${context.originalDoc!.id}&where[and][1][id][not_equals]=${context.contentOwnerId}`,
    data: { status: VERSIONS_STATUS.DRAFT }
  });

  return args;
});
