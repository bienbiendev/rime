import { RimeError } from '$lib/core/errors/index.js';
import type { Hook } from '$lib/core/pipeline/types.js';

/**
 * An auto-saved version is written or deleted by its owner only, or by rime itself.
 *
 * The row is `context.originalDoc` on an update and `doc` on a delete. Its owner is `updatedBy`,
 * read back as the staff document. A caller the field is hidden from sees nobody, and nobody is
 * not them.
 *
 * A row whose owner was deleted is nobody's. It can still be deleted, by whoever has
 * `access.delete` — that is the only way such a row goes away.
 */
export const guardAutoSaveOwner: Hook<'raw', 'update' | 'delete', 'before'> =
  async function guardAutoSaveOwner(args) {
    if (args.context.isSystemOperation) return args;

    const row = args.doc ?? args.context.originalDoc;
    if (!row?.isAutoSave) return args;

    const owner = row.updatedBy;
    const ownerId = typeof owner === 'string' ? owner : owner?.id;

    if (args.operation === 'delete' && owner === null) return args;
    if (ownerId && ownerId === args.event.locals.user?.id) return args;

    throw new RimeError(
      RimeError.UNAUTHORIZED,
      'an auto-saved version belongs to whoever is writing it'
    );
  };
