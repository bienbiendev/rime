import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant.js';
import type { OperationQuery, ReadIntent } from '$lib/core/pipeline/types.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { Dic } from '$lib/util/types.js';

/**
 * Which version a read means.
 *
 * ```
 * versionId given          that row, whatever its status, auto-saved or not
 * config auto-saves        never an auto-saved row — and, with drafts:
 * config has no drafts     no narrowing — the adapter reads that as the newest row
 * intent 'original'        the published one, always
 * a read                   the published one, unless drafts were asked for
 * ```
 *
 * `versionId` and not `id`, because on a versions table `id` means the document — see
 * `normalizedForShadow` in the where builder.
 *
 * `intent: 'original'` is the one that is not obvious: `?draft=true` on an **update** means
 * "branch a new draft from what is published", the opposite of what it means on a read.
 */
export const versionsReadQuery = (args: {
  config: BuiltArea | BuiltCollection;
  params: { draft?: boolean; versionId?: string };
  intent: ReadIntent;
}): OperationQuery | undefined => {
  const { config, params, intent } = args;

  if (params.versionId) return { where: { versionId: { equals: params.versionId } } };
  if (!config.versions) return undefined;

  const clauses: Dic[] = [];

  if (config.versions.autoSave) clauses.push({ isAutoSave: { not_equals: true } });
  if (config.versions.draft && (intent === 'original' || !params.draft)) {
    clauses.push({ status: { equals: VERSIONS_STATUS.PUBLISHED } });
  }

  if (clauses.length === 0) return undefined;
  return { where: clauses.length === 1 ? clauses[0] : { and: clauses } };
};
