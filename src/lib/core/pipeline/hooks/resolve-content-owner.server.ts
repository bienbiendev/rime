import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { RimeError } from '#lib/core/errors/index.js';

/**
 * Which row holds this document's content — the default, which is the document's own row.
 *
 * Versions overrides it: `handleNewVersion` points it at the version row.
 *
 * What reads it: `runUpdate` step 5 hangs blocks, tree nodes and relations off it, and both
 * prototypes' `reread` fetches back the row the write went to.
 */
export const resolveContentOwner = Hooks.beforeUpdate(async function resolveContentOwner(args) {
  const { originalDoc } = args.context;

  if (!originalDoc)
    throw new RimeError(RimeError.OPERATION_ERROR, 'missing originalDoc @resolveContentOwner');

  return { ...args, context: { ...args.context, contentOwnerId: originalDoc.id } };
});
