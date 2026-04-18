import { cleanupStoredFiles } from '$lib/core/collections/upload/disk/delete.server.js';
import type { BuiltCollection } from '$lib/core/config/types.js';
import { Hooks } from '$lib/core/operations/hooks/index.server.js';
import type { WithUpload } from '../util/config.js';

/**
 * Hook executed before deleting a document to clean up associated files from storage.
 *
 * This hook performs the following operations:
 * 1. Retrieves the document ID from the deletion event
 * 2. Locates and removes all files associated with the document from storage
 * 3. Ensures no orphaned files remain after document deletion
 *
 */
export const cleanUpFiles = Hooks.beforeDelete(async (args) => {
  const config = args.config as WithUpload<BuiltCollection>;
  const id = args.context.params.id || '';
  await cleanupStoredFiles({ config, rime: args.event.locals.rime, id });
  return args;
});
