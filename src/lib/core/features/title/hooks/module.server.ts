import { setDocumentTitle } from './set-document-title.server.js';

/**
 * What title contributes to the document pipeline — one read hook, setting `title` from whatever
 * the augment resolved as `asTitle`.
 *
 * A module of its own with no `module.ts` beside it: only a module with no client half gets its
 * names stubbed to `undefined` on a client build. See features/nested/hooks/module.server.ts.
 * `features/title/index.ts` is reachable from a client build — a prototype's feature list is —
 * so it cannot import a `.server.ts` hook by path.
 */
export const titleHooks = {
  beforeRead: [setDocumentTitle]
};
