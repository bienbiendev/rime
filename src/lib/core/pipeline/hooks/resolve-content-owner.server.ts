import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { RimeError } from '$lib/core/errors/index.js';

/**
 * Which row holds this document's content — the default, which is the document's own row.
 *
 * Every prototype has an answer to this, and for most of them it is this one. It was the `versions`
 * feature answering it for everybody, through `handleNewVersion`'s `default:` branch, which is why
 * both prototypes had to list a versions hook by name and why that hook could not be gated behind
 * `enabled`: gating it left `contentOwnerId` unset on every non-versioned config, and `runUpdate`
 * asserts it.
 *
 * With the default here, a feature that moves the content elsewhere *overrides* it — it requires
 * `content-owner` and answers again — and a config that enables no such feature needs nothing from
 * any feature at all.
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
