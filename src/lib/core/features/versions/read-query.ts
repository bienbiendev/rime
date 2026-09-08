import { VERSIONS_STATUS } from '$lib/core/constants.js';
import type { OperationQuery } from '$lib/core/pipeline/types.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';

/**
 * Which version a read means.
 *
 * The three cases `readPrototype` used to decode out of `draft` + `versionId` +
 * `config.versions.draft`, said once here:
 *
 * - **a named version** — that row, whatever its status. `versionId` rather than `id`, because on
 *   a shadow `id` means the document (see `normalizedForShadow` in the adapter's where builder).
 * - **drafts asked for, or a config with no drafts** — no narrowing, which the adapter reads as
 *   the newest row. A config without `versions.draft` has no meaningful status to filter on, and
 *   filtering on one would return nothing.
 * - **otherwise** — the published one.
 *
 * The object form rather than a query string: an id interpolated into `where[versionId][equals]=…`
 * is a caller's value in a parsed format, and there is no reason to make it round-trip.
 */
export const versionsReadQuery = (args: {
  config: BuiltArea | BuiltCollection;
  params: { draft?: boolean; versionId?: string };
}): OperationQuery | undefined => {
  const { config, params } = args;

  if (params.versionId) return { where: { versionId: { equals: params.versionId } } };
  if (params.draft || !config.versions || !config.versions.draft) return undefined;

  return { where: { status: { equals: VERSIONS_STATUS.PUBLISHED } } };
};
