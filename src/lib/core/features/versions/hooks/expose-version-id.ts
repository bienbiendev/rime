import { Hooks } from '$lib/core/pipeline/hooks.js';

/**
 * Puts `versionId` on the document.
 *
 * The adapter folds a base row and its content row into one document and says which row the
 * content came from — as `contentId`, its own word, the one `insert` returns and `find` takes.
 * What that row *is* called on a versioned document is this feature's business, and it is the
 * public property the panel, the REST params and every consumer already read.
 *
 * It used to come out of `mergeRawDocumentWithVersion` directly, which made that function a
 * versions method sitting in `adapter-sqlite/util.server.ts`: a thing that has to name a feature
 * in its *return value* belongs to that feature, whatever its file is called.
 *
 * Additive — `contentId` stays. Core code that needs the row rather than the name reads that one
 * (`features/url`, `features/upload`), which is why neither of them has to run after this.
 */
export const exposeVersionId = Hooks.beforeRead({
  name: 'exposeVersionId',
  requires: [],
  provides: ['document'],
  run: async (args) => {
    if (!args.doc.contentId) return args;

    return { ...args, doc: { ...args.doc, versionId: args.doc.contentId } };
  }
});
