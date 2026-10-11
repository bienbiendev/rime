import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { RimeError } from '#lib/core/errors/index.js';
import type { Dic } from '#lib/util/types.js';

/**
 * A document keeps at least one version. An auto-saved row is not one: it may always go, and it
 * does not count as the version that stays.
 *
 * Runs on the versions collection's delete. A base row with no readable content row reads as
 * absent everywhere, and every read skips auto-saved rows.
 */
export const preventLastVersionDeletion = Hooks.beforeDelete(
  async function preventLastVersionDeletion(args) {
    const { config, doc, event } = args;
    if (args.context.isSystemOperation) return args;
    if (doc.isAutoSave) return args;

    const versions: Dic[] = [{ ownerId: { equals: doc.ownerId } }];
    if ('isAutoSave' in doc) versions.push({ isAutoSave: { not_equals: true } });

    const rows = await event.locals.rime.adapter.collection(config.slug).findMany({
      query: { where: { and: versions } },
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
