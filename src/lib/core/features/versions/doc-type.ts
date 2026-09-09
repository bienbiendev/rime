import type { DocTypeContribution } from '../doc-type.js';

/**
 * A versioned document carries the id of the version it was read as.
 *
 * `dev/codegen/types` pushed this itself, behind `if (collection.versions)` — twice, once per
 * prototype kind. `exposeVersionId` is the hook that puts the value there; this is the type of it.
 */
export const versionsDocType = (): DocTypeContribution => ({
  members: ['versionId: string']
});
