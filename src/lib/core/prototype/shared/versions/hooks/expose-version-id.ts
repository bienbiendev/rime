import { Hooks } from '$lib/core/pipeline/define-hook.js';

/**
 * Puts `versionId` on the document.
 *
 * The adapter folds a base row and its content row into one document and says which row the
 * content came from — as `contentId`, its own word, the one `insert` returns and `find` takes.
 * What that row *is* called on a versioned document is this feature's business, and it is the
 * public property the panel, the REST params and every consumer already read.
 *
 * Additive — `contentId` stays, and the code that wants the row rather than the name reads that
 * one, which is why `url` and `upload` need not run after this.
 */
export const exposeVersionId = Hooks.beforeRead(async function exposeVersionId(args) {
  if (!args.doc.contentId) return args;

  return { ...args, doc: { ...args.doc, versionId: args.doc.contentId } };
});
