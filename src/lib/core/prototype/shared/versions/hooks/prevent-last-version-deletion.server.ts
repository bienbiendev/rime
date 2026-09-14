import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { RimeError } from '$lib/core/errors/index.js';

/**
 * A document keeps at least one version.
 *
 * Runs on the versions collection's delete. A base row with no content row reads as absent
 * everywhere, so the last version goes with the document or not at all.
 */
export const preventLastVersionDeletion = Hooks.beforeDelete(
  async function preventLastVersionDeletion(args) {
    const { config, doc, event } = args;
    if (args.context.isSystemOperation) return args;

    const rows = await event.locals.rime.adapter.collection(config.slug).findMany({
      query: { where: { ownerId: { equals: doc.ownerId } } },
      select: ['id']
    });

    if (rows.length <= 1) {
      throw new RimeError(
        RimeError.BAD_REQUEST,
        'the last version of a document cannot be deleted, delete the document'
      );
    }

    return args;
  }
);
