import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant.js';
import type { OperationQuery } from '$lib/core/pipeline/types.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { Dic } from '$lib/util/types.js';

/**
 * Which version a read means.
 *
 * ```
 * versionId given          that row, whatever its status, auto-saved or not
 * config auto-saves        never an auto-saved row — and, with drafts:
 * config has no drafts     no narrowing — the adapter reads that as the newest row
 * latest asked for         the newest row
 * otherwise                the published one
 * ```
 *
 * The same answer for a read and for the row an update starts from: `latest` and `versionId`
 * select a row, and that is all they do. What an update then does to it, case by case, is tabled
 * on `defineVersionUpdateOperation` in `strategy.ts`.
 *
 * `versionId` and not `id`, because on a versions table `id` means the document — see
 * `normalizedForShadow` in the where builder.
 */
export const versionsReadQuery = (args: {
  config: BuiltArea | BuiltCollection;
  params: { latest?: boolean; versionId?: string };
}): OperationQuery | undefined => {
  const { config, params } = args;

  if (params.versionId) return { where: { versionId: { equals: params.versionId } } };
  if (!config.versions) return undefined;

  const clauses: Dic[] = [];

  if (config.versions.autoSave) clauses.push({ isAutoSave: { not_equals: true } });
  if (config.versions.draft && !params.latest) {
    clauses.push({ status: { equals: VERSIONS_STATUS.PUBLISHED } });
  }

  if (clauses.length === 0) return undefined;
  return { where: clauses.length === 1 ? clauses[0] : { and: clauses } };
};
