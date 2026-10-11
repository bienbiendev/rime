import type { DocTypeContribution } from '#lib/core/dev/codegen/types/contributions.server.js';

/**
 * A versioned document carries the id of the version it was read as.
 *
 * `exposeVersionId` is the hook that puts the value there; this is its type.
 */
export const versionsDocType = (): DocTypeContribution => ({
  members: ['versionId: string']
});
