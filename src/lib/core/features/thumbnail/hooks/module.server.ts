import { setDocumentThumbnail } from './set-document-thumbnail.server.js';

/**
 * What thumbnail contributes to the document pipeline — one read hook, resolving `_thumbnail`.
 *
 * A module of its own with no `module.ts` beside it, for the reason title's says.
 */
export const thumbnailHooks = {
  beforeRead: [setDocumentThumbnail]
};
