import { VERSIONS_STATUS } from '$lib/core/constants.js';
import type { OperationQuery, ReadIntent } from '$lib/core/pipeline/types.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';

/**
 * Which version a read means.
 *
 * Four lines covering what used to be a five-value enum plus two helpers — the three branches
 * `readPrototype` decoded out of `draft` + `versionId` + `config.versions.draft`, and the
 * `shouldRetrieveDraft` table `getOriginalDocument` decoded out of `versionOperation`:
 *
 * - **a named version** — that row, whatever its status. `versionId` rather than `id`, because on
 *   a shadow `id` means the document (see `normalizedForShadow` in the adapter's where builder).
 * - **a config with no drafts** — no narrowing, which the adapter reads as the newest row. There
 *   is no meaningful status on its rows, and filtering on one would match nothing.
 * - **the original of an update** — always the published one. `?draft=true` on an update means
 *   "branch a new draft *from what is published*", which is the opposite of what it means on a
 *   read, and is the whole reason `ReadIntent` exists.
 * - **a read** — the published one, unless drafts were asked for.
 *
 * Checked against all five `VERSIONS_OPERATIONS`: it reproduces `shouldRetrieveDraft` exactly.
 * `UPDATE_VERSION` and `NEW_VERSION_FROM_LATEST` returned `draft: true` there, and both land on a
 * branch above that narrows to a named row or to nothing at all.
 *
 * The object form rather than a query string: an id interpolated into `where[versionId][equals]=…`
 * is a caller's value in a parsed format, and there is no reason to make it round-trip.
 */
export const versionsReadQuery = (args: {
  config: BuiltArea | BuiltCollection;
  params: { draft?: boolean; versionId?: string };
  intent: ReadIntent;
}): OperationQuery | undefined => {
  const { config, params, intent } = args;
  const published = { where: { status: { equals: VERSIONS_STATUS.PUBLISHED } } };

  if (params.versionId) return { where: { versionId: { equals: params.versionId } } };
  if (!config.versions || !config.versions.draft) return undefined;

  return intent === 'original' || !params.draft ? published : undefined;
};
